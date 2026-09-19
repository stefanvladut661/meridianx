import sodium from "libsodium-wrappers-sumo";

/**
 * Stratul criptografic al vault-ului (feat/vault, faza 1).
 *
 * PUR: fără I/O, fără Supabase, fără DOM. Primește bytes și string-uri,
 * întoarce bytes și string-uri. Singurul loc din proiect care atinge
 * libsodium. Nu se modifică fără cerere explicită și revizuire umană —
 * vezi `app/vault/CLAUDE.md`.
 *
 * MODELUL (Bitwarden-style, o singură parolă master, două chei separate):
 *
 *   parolă master + salt(email)
 *     → Argon2id (ops 4, mem 256 MiB, 32 bytes)         → masterKey
 *   kdf_derive(masterKey, id 1, "mrdvault")             → authHash
 *   kdf_derive(masterKey, id 2, "mrdvault")             → KEK
 *
 *   authHash pleacă la Supabase Auth ca parolă — dă sesiune reală, deci
 *   RLS funcționează și încercările de login sunt limitate de Supabase.
 *   KEK nu părăsește NICIODATĂ browserul: criptează cheia privată X25519
 *   a membrului. DEK-ul vault-ului (32 bytes aleatori, unic) e sigilat
 *   separat pentru fiecare membru (crypto_box_seal către cheia lui
 *   publică) — așa se adaugă al doilea membru fără să-i știi parola.
 *   Intrările se criptează cu DEK (XChaCha20-Poly1305, nonce aleator).
 *
 * DE CE salt din email, nu aleator stocat: salt-ul trebuie cunoscut
 * ÎNAINTE de login (din el iese authHash-ul cu care te loghezi), iar
 * baza nu se poate citi fără sesiune. Rolul salt-ului e unicitatea per
 * utilizator, nu secretul — emailul o garantează. E exact modelul
 * Bitwarden. Decizie confirmată de om, 2026-09-19.
 *
 * DE CE crypto_kdf_derive_from_key, nu HKDF-SHA256: wrapper-ul
 * libsodium-wrappers-sumo 0.8.4 expune doar CONSTANTELE HKDF, nu și
 * funcțiile; ele există numai în modulul C brut, cu pointeri gestionați
 * manual — adică exact „criptografie de mână". `crypto_kdf_derive_from_key`
 * e KDF-ul canonic libsodium (BLAKE2b cu cheie, context + id de subcheie),
 * face același lucru: două chei independente din una. Decizie confirmată.
 *
 * DATE ADIȚIONALE (AD) pe fiecare AEAD: ciphertextul e legat de rândul
 * căruia îi aparține (`vault_entries:<id>`). Un server rău-intenționat
 * care mută un payload de pe o intrare pe alta nu obține un decrypt
 * valid. Nu e criptografie nouă — e exact pentru asta există AD.
 *
 * NICIODATĂ aici: Math.random, AES-CBC, MD5, SHA1, chei în storage,
 * logging de valori. Nu adăuga funcții de export în clar.
 */

// ---------------------------------------------------------------------------
// Parametri — parte din contract. Schimbarea lor invalidează toate cheile
// existente (un membru nu s-ar mai putea loga), deci cer migrare de date.
// ---------------------------------------------------------------------------

export const KDF = {
  version: 1,
  /** Argon2id, „moderate" + un pas. 1–2 s pe un laptop. */
  opslimit: 4,
  /** 256 MiB. Sub asta, un GPU sparge parole slabe prea ieftin. */
  memlimit: 256 * 1024 * 1024,
  keyBytes: 32,
} as const;

/** Prefix de domeniu pentru salt — ca același email să nu dea același
    salt în alt sistem care ar folosi tot BLAKE2b(email). */
const SALT_DOMAIN = "meridian-vault-salt-v1:";

/** Contextul KDF: exact 8 caractere, cerință libsodium. */
const KDF_CONTEXT = "mrdvault";
const SUBKEY_AUTH = 1;
const SUBKEY_ENC = 2;

/** Cheia BLAKE2b pentru derivarea cheii de recuperare (16–64 bytes). */
const RECOVERY_DOMAIN = "meridian-vault-recovery-v1";

/** Codul de recuperare: 25 bytes = 200 biți = exact 40 de simboluri
    Crockford base32 = 8 grupuri de 5. (32 bytes ar da 52 de simboluri,
    care nu se împart în grupuri egale; 200 de biți de entropie sunt cu
    mult peste ce poate fi ghicit.) */
const RECOVERY_BYTES = 25;
const RECOVERY_GROUPS = 8;
const RECOVERY_GROUP_LEN = 5;

/** Alfabetul Crockford: fără I, L, O, U — nu se confundă la dictare. */
const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

// ---------------------------------------------------------------------------
// Tipuri
// ---------------------------------------------------------------------------

/** Ciphertext + nonce-ul lui. Cheia și AD-ul vin din context. */
export interface SealedBox {
  ciphertext: Uint8Array;
  nonce: Uint8Array;
}

/** Ce iese din parola master. `authHash` e string fiindcă pleacă la
    Supabase ca parolă; `kek` e buffer, ca să poată fi zeroizat. */
export interface MasterMaterial {
  authHash: string;
  kek: Uint8Array;
}

export interface MemberKeyPair {
  publicKey: Uint8Array;
  privateKey: Uint8Array;
}

export interface RecoveryCode {
  /** Forma afișată omului: `XXXXX-XXXXX-…` (8 grupuri). O singură dată. */
  code: string;
  /** Cheia derivată din cod — împachetează DEK-ul. */
  key: Uint8Array;
}

export type VaultCryptoErrorCode =
  | "kdf_failed"
  | "decrypt_failed"
  | "invalid_input";

/** Erorile stratului criptografic spun CE s-a întâmplat, nu de ce nu
    s-a putut — mesajul e sigur de afișat, nu conține niciun byte de
    conținut. */
export class VaultCryptoError extends Error {
  readonly code: VaultCryptoErrorCode;
  constructor(code: VaultCryptoErrorCode, message: string) {
    super(message);
    this.name = "VaultCryptoError";
    this.code = code;
  }
}

/** Datele adiționale — leagă fiecare ciphertext de rândul lui. */
export const AD = {
  memberPrivateKey: (memberId: string) => `vault_members:${memberId}`,
  client: (clientId: string) => `vault_clients:${clientId}`,
  entry: (entryId: string) => `vault_entries:${entryId}`,
  recovery: "vault_meta:recovery",
} as const;

// ---------------------------------------------------------------------------
// Inițializare
// ---------------------------------------------------------------------------

/**
 * libsodium se încarcă asincron (wasm). Orice altă funcție de aici
 * presupune că `ready()` a fost așteptat o dată. Se poate apela oricând,
 * e ieftin după prima dată.
 */
export async function ready(): Promise<void> {
  await sodium.ready;
}

// ---------------------------------------------------------------------------
// Derivare din parola master
// ---------------------------------------------------------------------------

/** Aceeași normalizare ca Supabase Auth: spații tăiate, litere mici. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * NFC: „ă" tastat pe macOS (a + breve combinat) și „ă" tastat pe
 * Windows (un singur code point) sunt aceeași parolă. Fără asta, aceeași
 * parolă ar deriva chei diferite pe două sisteme. Nu se face trim —
 * un spațiu la capăt e parte din parolă.
 */
export function normalizePassword(password: string): string {
  return password.normalize("NFC");
}

/** Salt-ul Argon2id: BLAKE2b(prefix + email), exact SALTBYTES (16). */
export function deriveSalt(email: string): Uint8Array {
  const normalized = normalizeEmail(email);
  if (!normalized) throw new VaultCryptoError("invalid_input", "Email gol.");
  return sodium.crypto_generichash(
    sodium.crypto_pwhash_SALTBYTES,
    sodium.from_string(SALT_DOMAIN + normalized),
    null
  );
}

/**
 * Parolă master → { authHash, kek }.
 *
 * SINCRON și scump (1–2 s, 256 MiB): blochează firul pe care rulează.
 * UI-ul afișează starea de încărcare ÎNAINTE să apeleze (și lasă un
 * cadru să se picteze), sau rulează într-un Web Worker.
 *
 * masterKey trăiește doar în interiorul funcției: după ce ies cele două
 * subchei, e zeroizat. Bytes-ii parolei la fel. String-ul parolei nu
 * poate fi zeroizat în JavaScript — limitare de limbaj, nu de design.
 */
export function deriveMasterMaterial(
  email: string,
  password: string
): MasterMaterial {
  const salt = deriveSalt(email);
  const passwordBytes = sodium.from_string(normalizePassword(password));
  if (passwordBytes.length === 0) {
    throw new VaultCryptoError("invalid_input", "Parola e goală.");
  }

  let masterKey: Uint8Array;
  try {
    masterKey = sodium.crypto_pwhash(
      KDF.keyBytes,
      passwordBytes,
      salt,
      KDF.opslimit,
      KDF.memlimit,
      sodium.crypto_pwhash_ALG_ARGON2ID13
    );
  } catch {
    // Singura cauză reală: browserul n-a putut crește memoria wasm la
    // 256 MiB (telefon vechi, filă cu memorie limitată).
    throw new VaultCryptoError(
      "kdf_failed",
      "Browserul n-a putut aloca memoria pentru derivarea cheii (256 MB). Închide alte file sau încearcă de pe un calculator."
    );
  } finally {
    sodium.memzero(passwordBytes);
  }

  try {
    const auth = sodium.crypto_kdf_derive_from_key(
      KDF.keyBytes,
      SUBKEY_AUTH,
      KDF_CONTEXT,
      masterKey
    );
    const kek = sodium.crypto_kdf_derive_from_key(
      KDF.keyBytes,
      SUBKEY_ENC,
      KDF_CONTEXT,
      masterKey
    );
    const authHash = sodium.to_base64(auth, sodium.base64_variants.ORIGINAL);
    sodium.memzero(auth);
    return { authHash, kek };
  } finally {
    sodium.memzero(masterKey);
  }
}

// ---------------------------------------------------------------------------
// Chei
// ---------------------------------------------------------------------------

/** Perechea X25519 a unui membru. Privata se împachetează cu KEK. */
export function generateMemberKeyPair(): MemberKeyPair {
  const pair = sodium.crypto_box_keypair();
  return { publicKey: pair.publicKey, privateKey: pair.privateKey };
}

/** DEK-ul vault-ului: 32 bytes aleatori, generat O SINGURĂ DATĂ. */
export function generateDek(): Uint8Array {
  return sodium.randombytes_buf(sodium.crypto_aead_xchacha20poly1305_ietf_KEYBYTES);
}

// ---------------------------------------------------------------------------
// AEAD — XChaCha20-Poly1305, nonce aleator de 24 bytes per operație
// ---------------------------------------------------------------------------

export function encrypt(
  key: Uint8Array,
  plaintext: Uint8Array,
  additionalData: string
): SealedBox {
  const nonce = sodium.randombytes_buf(
    sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES
  );
  const ciphertext = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
    plaintext,
    sodium.from_string(additionalData),
    null,
    nonce,
    key
  );
  return { ciphertext, nonce };
}

/** Aruncă `decrypt_failed` la cheie greșită, AD greșit sau date alterate —
    libsodium nu spune care, și nici noi. */
export function decrypt(
  key: Uint8Array,
  box: SealedBox,
  additionalData: string
): Uint8Array {
  try {
    return sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
      null,
      box.ciphertext,
      sodium.from_string(additionalData),
      box.nonce,
      key
    );
  } catch {
    throw new VaultCryptoError(
      "decrypt_failed",
      "Datele nu s-au putut decripta: cheie greșită sau conținut alterat."
    );
  }
}

/** JSON → bytes → AEAD. Plaintextul intermediar e zeroizat. */
export function encryptJson<T>(
  key: Uint8Array,
  value: T,
  additionalData: string
): SealedBox {
  const plaintext = sodium.from_string(JSON.stringify(value));
  try {
    return encrypt(key, plaintext, additionalData);
  } finally {
    sodium.memzero(plaintext);
  }
}

/** AEAD → bytes → JSON. String-ul rezultat nu poate fi zeroizat. */
export function decryptJson<T>(
  key: Uint8Array,
  box: SealedBox,
  additionalData: string
): T {
  const plaintext = decrypt(key, box, additionalData);
  try {
    return JSON.parse(sodium.to_string(plaintext)) as T;
  } catch {
    throw new VaultCryptoError(
      "decrypt_failed",
      "Conținutul decriptat nu e în formatul așteptat."
    );
  } finally {
    sodium.memzero(plaintext);
  }
}

// ---------------------------------------------------------------------------
// Împachetarea cheilor
// ---------------------------------------------------------------------------

/** Cheia privată a membrului, criptată cu KEK, legată de id-ul lui. */
export function wrapPrivateKey(
  kek: Uint8Array,
  privateKey: Uint8Array,
  memberId: string
): SealedBox {
  return encrypt(kek, privateKey, AD.memberPrivateKey(memberId));
}

export function unwrapPrivateKey(
  kek: Uint8Array,
  box: SealedBox,
  memberId: string
): Uint8Array {
  return decrypt(kek, box, AD.memberPrivateKey(memberId));
}

/**
 * DEK-ul, sigilat către cheia publică a unui membru (crypto_box_seal:
 * cheie efemeră + X25519 + XSalsa20-Poly1305). Doar cine are cheia
 * privată corespunzătoare îl deschide — nici cine l-a sigilat nu mai
 * poate. Așa se adaugă un membru fără să-i cunoști parola.
 */
export function sealDek(dek: Uint8Array, recipientPublicKey: Uint8Array): Uint8Array {
  return sodium.crypto_box_seal(dek, recipientPublicKey);
}

export function openDek(
  sealed: Uint8Array,
  publicKey: Uint8Array,
  privateKey: Uint8Array
): Uint8Array {
  try {
    return sodium.crypto_box_seal_open(sealed, publicKey, privateKey);
  } catch {
    throw new VaultCryptoError(
      "decrypt_failed",
      "DEK-ul nu s-a putut desigila cu cheia acestui membru."
    );
  }
}

// ---------------------------------------------------------------------------
// Recuperare
// ---------------------------------------------------------------------------

function base32Encode(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += CROCKFORD[(value >>> (bits - 5)) & 31];
      bits -= 5;
      value &= (1 << bits) - 1;
    }
  }
  if (bits > 0) out += CROCKFORD[(value << (5 - bits)) & 31];
  return out;
}

function base32Decode(symbols: string): Uint8Array {
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const symbol of symbols) {
    const index = CROCKFORD.indexOf(symbol);
    if (index < 0) return new Uint8Array(0);
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
      value &= (1 << bits) - 1;
    }
  }
  return Uint8Array.from(out);
}

/**
 * Canonicalizează ce a tastat sau lipit omul: litere mari, separatoarele
 * dispar, iar confuziile clasice se corectează (Crockford: I și L → 1,
 * O → 0). Întoarce doar simbolurile.
 */
function canonicalRecoverySymbols(input: string): string {
  return input
    .toUpperCase()
    .replace(/[IL]/g, "1")
    .replace(/O/g, "0")
    .replace(/[^0-9A-Z]/g, "");
}

function formatRecoveryCode(symbols: string): string {
  const groups: string[] = [];
  for (let i = 0; i < symbols.length; i += RECOVERY_GROUP_LEN) {
    groups.push(symbols.slice(i, i + RECOVERY_GROUP_LEN));
  }
  return groups.join("-");
}

/** Cheia de recuperare: BLAKE2b cu cheie de domeniu peste bytes-ii
    codului. Codul are 200 de biți de entropie, deci nu are nevoie de
    Argon2id — nu e o parolă pe care s-o ghicească cineva. */
function recoveryKeyFromBytes(codeBytes: Uint8Array): Uint8Array {
  return sodium.crypto_generichash(
    sodium.crypto_aead_xchacha20poly1305_ietf_KEYBYTES,
    codeBytes,
    sodium.from_string(RECOVERY_DOMAIN)
  );
}

/**
 * Cod nou. Se afișează O SINGURĂ DATĂ; bytes-ii lui nu se stochează
 * nicăieri — doar DEK-ul împachetat cu cheia derivată din el.
 */
export function generateRecoveryCode(): RecoveryCode {
  const bytes = sodium.randombytes_buf(RECOVERY_BYTES);
  try {
    const symbols = base32Encode(bytes);
    return { code: formatRecoveryCode(symbols), key: recoveryKeyFromBytes(bytes) };
  } finally {
    sodium.memzero(bytes);
  }
}

/**
 * Din ce a tastat omul → cheia de recuperare, sau `null` dacă nu are
 * forma unui cod (lungime greșită sau simboluri din afara alfabetului).
 * Nu spune dacă e codul CORECT — asta se află abia la desigilare.
 */
export function recoveryKeyFromCode(input: string): Uint8Array | null {
  const symbols = canonicalRecoverySymbols(input);
  if (symbols.length !== RECOVERY_GROUPS * RECOVERY_GROUP_LEN) return null;
  const bytes = base32Decode(symbols);
  if (bytes.length !== RECOVERY_BYTES) return null;
  try {
    return recoveryKeyFromBytes(bytes);
  } finally {
    sodium.memzero(bytes);
  }
}

export function wrapDekForRecovery(recoveryKey: Uint8Array, dek: Uint8Array): SealedBox {
  return encrypt(recoveryKey, dek, AD.recovery);
}

export function unwrapDekFromRecovery(recoveryKey: Uint8Array, box: SealedBox): Uint8Array {
  return decrypt(recoveryKey, box, AD.recovery);
}

// ---------------------------------------------------------------------------
// Zeroizare
// ---------------------------------------------------------------------------

/** `sodium.memzero` peste tot ce primește; ignoră null/undefined, ca
    apelantul să poată zeroiza „tot ce are" fără verificări. */
export function wipe(...buffers: Array<Uint8Array | null | undefined>): void {
  for (const buffer of buffers) {
    if (buffer && buffer.length > 0) sodium.memzero(buffer);
  }
}

/** Comparație în timp constant — pentru verificări de chei, nu `===`. */
export function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && sodium.memcmp(a, b);
}
