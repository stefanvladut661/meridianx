import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { fromBytea, toBytea } from "./bytea";
import {
  decrypt,
  encrypt,
  generateDek,
  generateMemberKeyPair,
  generateRecoveryCode,
  openDek,
  recoveryKeyFromCode,
  sealDek,
  unwrapDekFromRecovery,
  unwrapPrivateKey,
  VaultCryptoError,
  wipe,
  wrapDekForRecovery,
  wrapPrivateKey,
} from "./crypto";

/**
 * Stratul de date al membrilor (feat/vault, fazele 2, 7 și 10).
 *
 * Singurul loc care vorbește cu `vault_members` / `vault_meta` și cu
 * funcțiile `vault_*` din migrarea 3. Primește un client Supabase cu
 * sesiune (din `lib/vault/supabase.ts`) și chei în clar din memorie;
 * întoarce rânduri tipizate și chei. Presupune `ready()` deja așteptat
 * (crypto.ts) — o face providerul, o singură dată, înainte de orice.
 *
 * Ce NU face: nu decide nimic despre UI, nu ține stare. Nu loghează
 * valori — nici măcar la eroare.
 */

// ---------------------------------------------------------------------------
// Tipuri
// ---------------------------------------------------------------------------

export interface VaultMember {
  id: string;
  email: string;
  publicKey: Uint8Array;
  encryptedPrivateKey: Uint8Array;
  privateKeyNonce: Uint8Array;
  /** `null` = în așteptare (fără acces la date). */
  wrappedDek: Uint8Array | null;
  approvedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface VaultMeta {
  recoveryWrappedDek: Uint8Array;
  recoveryNonce: Uint8Array;
  recoveryRotations: number;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Cheia legacy (originala, din `vault_members.wrapped_dek`) are id-ul
    gol în inel; rândurile o indică prin `dek_id = null`. */
export const LEGACY_DEK = "";

/**
 * Tot ce are un membru activ în memorie, după deblocare.
 *
 * Faza 10: un INEL de chei, nu una singură. `dek` e cheia CURENTĂ (cu ea
 * se criptează tot ce e nou), `currentDekId` id-ul ei (`null` = legacy),
 * `ring` toate cheile pe care membrul le-a putut deschide — rândurile
 * vechi și istoricul se citesc cu cheia lor (`dek_id`).
 */
export interface KeyMaterial {
  dek: Uint8Array;
  currentDekId: string | null;
  ring: Map<string, Uint8Array>;
  publicKey: Uint8Array;
  privateKey: Uint8Array;
}

/** O cheie rotită (`vault_deks`). */
export interface VaultDek {
  id: string;
  recoveryWrappedDek: Uint8Array;
  recoveryNonce: Uint8Array;
  createdBy: string | null;
  createdAt: string;
  retiredAt: string | null;
}

/** O cheie rotită, sigilată pentru un membru (`vault_member_deks`). */
export interface MemberDek {
  memberId: string;
  dekId: string;
  sealedDek: Uint8Array;
}

/** Cheia cu care se deschide un rând, după `dek_id`-ul lui. Aruncă
    `decrypt_failed` dacă membrul n-o are — mesajul spune ce să ceară. */
export function dekFor(keys: KeyMaterial, dekId: string | null): Uint8Array {
  const key = keys.ring.get(dekId ?? LEGACY_DEK);
  if (!key) {
    throw new VaultCryptoError(
      "decrypt_failed",
      "Rândul e criptat cu o cheie pe care nu o ai. Cere unui membru activ să-ți acorde cheile lipsă (din Membri)."
    );
  }
  return key;
}

export type RegisterOutcome =
  | { outcome: "bootstrapped"; keys: KeyMaterial; recoveryCode: string }
  | { outcome: "joined" };

export type VaultDataErrorCode =
  | "not_migrated"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "network"
  | "unknown";

/** Mesajul e pentru om: spune ce s-a întâmplat și, unde există, ce să
    facă. Codul e pentru UI, ca să aleagă ce ecran urmează. */
export class VaultDataError extends Error {
  readonly code: VaultDataErrorCode;
  constructor(code: VaultDataErrorCode, message: string) {
    super(message);
    this.name = "VaultDataError";
    this.code = code;
  }
}

// ---------------------------------------------------------------------------
// Erori
// ---------------------------------------------------------------------------

/** SQLSTATE-urile pe care le ridică migrarea 3, plus cele de infrastructură. */
export function describeDbError(error: PostgrestError | { message: string; code?: string }): VaultDataError {
  const code = "code" in error ? error.code : undefined;
  switch (code) {
    case "42P01": // undefined_table
    case "42883": // undefined_function
    case "42703": // undefined_column (dek_id → migrarea 4)
    case "PGRST202": // funcție necunoscută în schema cache
      return new VaultDataError(
        "not_migrated",
        /dek|vault_deks|vault_member_deks|rotate|grant_deks|reseal|rewrap/i.test(error.message) || code === "42703"
          ? "Inelul de chei lipsește din baza de date. Aplică migrarea 4 (supabase/migrations/00000000000004_vault_keyring.sql) în SQL editor."
          : "Tabelele vault-ului lipsesc din baza de date. Aplică migrarea 3 (supabase/migrations/00000000000003_vault.sql) în SQL editor."
      );
    case "42501": // insufficient_privilege
      return new VaultDataError(
        "forbidden",
        "Nu ai drepturi pentru operația asta. Doar un membru activ o poate face."
      );
    case "P0002": // no_data_found
      return new VaultDataError("not_found", "Membrul nu mai există sau a fost deja aprobat.");
    case "23505": // unique_violation
      return new VaultDataError("conflict", "Starea vault-ului s-a schimbat între timp. Reîncarcă și încearcă din nou.");
    case "23514": // check_violation
      return new VaultDataError("conflict", error.message.replace(/^vault: /, ""));
    default:
      if (/fetch|network|Failed to fetch/i.test(error.message)) {
        return new VaultDataError("network", "Nu ne putem conecta la Supabase. Verifică rețeaua și încearcă din nou.");
      }
      return new VaultDataError("unknown", `Supabase a răspuns cu o eroare: ${error.message}`);
  }
}

// ---------------------------------------------------------------------------
// Citire
// ---------------------------------------------------------------------------

const MEMBER_COLUMNS =
  "id, email, public_key, encrypted_private_key, private_key_nonce, wrapped_dek, approved_by, created_at, updated_at";

interface MemberRow {
  id: string;
  email: string;
  public_key: string;
  encrypted_private_key: string;
  private_key_nonce: string;
  wrapped_dek: string | null;
  approved_by: string | null;
  created_at: string;
  updated_at: string;
}

function parseMember(row: MemberRow): VaultMember {
  return {
    id: row.id,
    email: row.email,
    publicKey: fromBytea(row.public_key),
    encryptedPrivateKey: fromBytea(row.encrypted_private_key),
    privateKeyNonce: fromBytea(row.private_key_nonce),
    wrappedDek: row.wrapped_dek === null ? null : fromBytea(row.wrapped_dek),
    approvedBy: row.approved_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Rândul propriu — vizibil prin RLS chiar și în așteptare. `null` =
    contul e autentificat, dar nu și-a depus încă cheile. */
export async function fetchOwnMember(
  supabase: SupabaseClient,
  memberId: string
): Promise<VaultMember | null> {
  const { data, error } = await supabase
    .from("vault_members")
    .select(MEMBER_COLUMNS)
    .eq("id", memberId)
    .maybeSingle()
    .overrideTypes<MemberRow, { merge: false }>();
  if (error) throw describeDbError(error);
  return data ? parseMember(data) : null;
}

/** Toți membrii — RLS îi arată doar unui membru activ. */
export async function listMembers(supabase: SupabaseClient): Promise<VaultMember[]> {
  const { data, error } = await supabase
    .from("vault_members")
    .select(MEMBER_COLUMNS)
    .order("created_at", { ascending: true })
    .overrideTypes<MemberRow[], { merge: false }>();
  if (error) throw describeDbError(error);
  return (data ?? []).map(parseMember);
}

interface MetaRow {
  recovery_wrapped_dek: string;
  recovery_nonce: string;
  recovery_rotations: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export async function fetchMeta(supabase: SupabaseClient): Promise<VaultMeta> {
  const { data, error } = await supabase
    .from("vault_meta")
    .select("recovery_wrapped_dek, recovery_nonce, recovery_rotations, created_by, created_at, updated_at")
    .eq("id", true)
    .single()
    .overrideTypes<MetaRow, { merge: false }>();
  if (error) throw describeDbError(error);
  return {
    recoveryWrappedDek: fromBytea(data.recovery_wrapped_dek),
    recoveryNonce: fromBytea(data.recovery_nonce),
    recoveryRotations: data.recovery_rotations,
    createdBy: data.created_by,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

// ---------------------------------------------------------------------------
// Chei
// ---------------------------------------------------------------------------

/**
 * Membru activ: cheia privată se desface cu KEK, DEK-ul cu perechea.
 * Aruncă `VaultCryptoError("decrypt_failed")` la KEK greșit — ceea ce,
 * după un login reușit cu authHash-ul din aceeași parolă, înseamnă că
 * rândul a fost alterat, nu că parola e greșită.
 */
export function openKeys(
  member: VaultMember,
  kek: Uint8Array,
  deks: VaultDek[] = [],
  memberDeks: MemberDek[] = []
): KeyMaterial {
  if (!member.wrappedDek) {
    throw new VaultDataError("forbidden", "Membrul e încă în așteptare — nu are DEK sigilat.");
  }
  const privateKey = unwrapPrivateKey(
    kek,
    { ciphertext: member.encryptedPrivateKey, nonce: member.privateKeyNonce },
    member.id
  );
  try {
    const legacy = openDek(member.wrappedDek, member.publicKey, privateKey);
    const ring = new Map<string, Uint8Array>([[LEGACY_DEK, legacy]]);
    for (const sealed of memberDeks) {
      if (sealed.memberId !== member.id) continue;
      try {
        ring.set(sealed.dekId, openDek(sealed.sealedDek, member.publicKey, privateKey));
      } catch {
        // O sigilare alterată nu blochează deblocarea; rândurile ei
        // apar ca ilizibile, cu mesajul de „cere cheia".
      }
    }
    return withCurrent(ring, deks, member.publicKey, privateKey);
  } catch (error) {
    wipe(privateKey);
    throw error;
  }
}

/** Cheia curentă = singura din `vault_deks` fără `retired_at`, altfel
    legacy. Dacă membrul n-o are în inel, nu poate scrie nimic corect —
    mai bine oprit aici decât să scrie sub cheia retrasă. */
function withCurrent(
  ring: Map<string, Uint8Array>,
  deks: VaultDek[],
  publicKey: Uint8Array,
  privateKey: Uint8Array
): KeyMaterial {
  const active = deks.find((dek) => dek.retiredAt === null);
  const currentDekId = active ? active.id : null;
  const dek = ring.get(currentDekId ?? LEGACY_DEK);
  if (!dek) {
    for (const key of ring.values()) wipe(key);
    throw new VaultDataError(
      "forbidden",
      "Cheia curentă a vault-ului a fost rotită și încă nu ți-a fost acordată. Cere unui membru activ să-ți acorde cheile din Membri, apoi deblochează din nou."
    );
  }
  return { dek, currentDekId, ring, publicKey, privateKey };
}

interface DekRow {
  id: string;
  recovery_wrapped_dek: string;
  recovery_nonce: string;
  created_by: string | null;
  created_at: string;
  retired_at: string | null;
}

/** Toate cheile rotite, cele mai vechi primele. Gol pe un vault fără rotații. */
export async function fetchDeks(supabase: SupabaseClient): Promise<VaultDek[]> {
  const { data, error } = await supabase
    .from("vault_deks")
    .select("id, recovery_wrapped_dek, recovery_nonce, created_by, created_at, retired_at")
    .order("created_at", { ascending: true })
    .overrideTypes<DekRow[], { merge: false }>();
  if (error) throw describeDbError(error);
  return (data ?? []).map((row) => ({
    id: row.id,
    recoveryWrappedDek: fromBytea(row.recovery_wrapped_dek),
    recoveryNonce: fromBytea(row.recovery_nonce),
    createdBy: row.created_by,
    createdAt: row.created_at,
    retiredAt: row.retired_at,
  }));
}

interface MemberDekRow {
  member_id: string;
  dek_id: string;
  sealed_dek: string;
}

/** Sigilările: ale unui membru, sau toate (pentru „cui îi lipsește"). */
export async function fetchMemberDeks(supabase: SupabaseClient, memberId?: string): Promise<MemberDek[]> {
  let query = supabase.from("vault_member_deks").select("member_id, dek_id, sealed_dek");
  if (memberId) query = query.eq("member_id", memberId);
  const { data, error } = await query.overrideTypes<MemberDekRow[], { merge: false }>();
  if (error) throw describeDbError(error);
  return (data ?? []).map((row) => ({
    memberId: row.member_id,
    dekId: row.dek_id,
    sealedDek: fromBytea(row.sealed_dek),
  }));
}

/** Cheile rotite din inel (fără legacy), sigilate către o cheie publică —
    forma pe care o iau `vault_grant_deks` și `vault_reseal_self`. */
function sealRing(keys: KeyMaterial, publicKey: Uint8Array): Array<{ dek_id: string; sealed_dek: string }> {
  const out: Array<{ dek_id: string; sealed_dek: string }> = [];
  for (const [id, key] of keys.ring) {
    if (id === LEGACY_DEK) continue;
    out.push({ dek_id: id, sealed_dek: toBytea(sealDek(key, publicKey)) });
  }
  return out;
}

/** Un membru activ acordă altuia cheile rotite pe care le are. Nimic de
    făcut pe un vault fără rotații. */
export async function grantDeks(supabase: SupabaseClient, keys: KeyMaterial, target: VaultMember): Promise<void> {
  const sealed = sealRing(keys, target.publicKey);
  if (sealed.length === 0) return;
  const { error } = await supabase.rpc("vault_grant_deks", { p_member: target.id, p_sealed: sealed });
  if (error) throw describeDbError(error);
}

/** După chei noi: cheile rotite, re-sigilate către propria cheie publică nouă. */
export async function resealSelf(supabase: SupabaseClient, keys: KeyMaterial): Promise<void> {
  const sealed = sealRing(keys, keys.publicKey);
  const { error } = await supabase.rpc("vault_reseal_self", { p_sealed: sealed });
  if (error) throw describeDbError(error);
}

/**
 * Un cont autentificat FĂRĂ rând în `vault_members` își depune cheile.
 *
 * Serverul decide atomic dacă e primul: `vault_bootstrap` reușește o
 * singură dată în viața vault-ului (lock + rând unic în `vault_meta`),
 * iar a doua oară ridică `unique_violation` — atunci același material
 * de chei intră prin `vault_join`, în așteptare. Nu există o cale de a
 * afla „e inițializat?" fără sesiune de membru (RLS), și nici nu e
 * nevoie: încercarea e răspunsul, fără cursă între două browsere.
 *
 * La bootstrap, DEK-ul și codul de recuperare se generează AICI, o
 * singură dată; codul se întoarce ca să fie afișat o singură dată.
 */
export async function registerKeys(
  supabase: SupabaseClient,
  memberId: string,
  kek: Uint8Array
): Promise<RegisterOutcome> {
  const pair = generateMemberKeyPair();
  const wrappedPrivate = wrapPrivateKey(kek, pair.privateKey, memberId);

  const dek = generateDek();
  const recovery = generateRecoveryCode();
  const recoveryBox = wrapDekForRecovery(recovery.key, dek);
  wipe(recovery.key);
  const sealedForSelf = sealDek(dek, pair.publicKey);

  const bootstrap = await supabase.rpc("vault_bootstrap", {
    p_public_key: toBytea(pair.publicKey),
    p_encrypted_private_key: toBytea(wrappedPrivate.ciphertext),
    p_private_key_nonce: toBytea(wrappedPrivate.nonce),
    p_wrapped_dek: toBytea(sealedForSelf),
    p_recovery_wrapped_dek: toBytea(recoveryBox.ciphertext),
    p_recovery_nonce: toBytea(recoveryBox.nonce),
  });

  if (!bootstrap.error) {
    return {
      outcome: "bootstrapped",
      keys: {
        dek,
        currentDekId: null,
        ring: new Map([[LEGACY_DEK, dek]]),
        publicKey: pair.publicKey,
        privateKey: pair.privateKey,
      },
      recoveryCode: recovery.code,
    };
  }

  // Orice altă eroare decât „deja inițializat" e reală.
  if (bootstrap.error.code !== "23505") {
    wipe(dek, pair.privateKey);
    throw describeDbError(bootstrap.error);
  }

  // Vault-ul există: DEK-ul generat aici nu e al nimănui — dispare.
  wipe(dek);

  const join = await supabase.rpc("vault_join", {
    p_public_key: toBytea(pair.publicKey),
    p_encrypted_private_key: toBytea(wrappedPrivate.ciphertext),
    p_private_key_nonce: toBytea(wrappedPrivate.nonce),
  });
  wipe(pair.privateKey);
  if (join.error) throw describeDbError(join.error);

  return { outcome: "joined" };
}

/** Un membru activ sigilează DEK-ul către cheia publică a unuia în
    așteptare. DEK-ul nu părăsește browserul decât sigilat. */
export async function approveMember(
  supabase: SupabaseClient,
  keys: KeyMaterial,
  target: VaultMember
): Promise<void> {
  const legacy = keys.ring.get(LEGACY_DEK);
  if (!legacy) throw new VaultDataError("forbidden", "Nu ai cheia originală a vault-ului — nu poți aproba.");
  const sealed = sealDek(legacy, target.publicKey);
  const { error } = await supabase.rpc("vault_approve_member", {
    p_member: target.id,
    p_wrapped_dek: toBytea(sealed),
  });
  if (error) throw describeDbError(error);
  // Cheile rotite, dacă există: fără ele, membrul nou n-ar citi nimic scris după rotații.
  await grantDeks(supabase, keys, target);
}

export async function removeMember(supabase: SupabaseClient, memberId: string): Promise<void> {
  const { error } = await supabase.rpc("vault_remove_member", { p_member: memberId });
  if (error) throw describeDbError(error);
}

/**
 * Cod de recuperare nou: cel vechi nu mai deschide nimic din clipa în
 * care update-ul reușește. Codul se întoarce ca să fie afișat o
 * singură dată.
 */
export async function rotateRecoveryCode(supabase: SupabaseClient, keys: KeyMaterial): Promise<string> {
  const legacy = keys.ring.get(LEGACY_DEK);
  if (!legacy) throw new VaultDataError("forbidden", "Nu ai cheia originală a vault-ului.");
  const recovery = generateRecoveryCode();
  try {
    const box = wrapDekForRecovery(recovery.key, legacy);
    const rotated = wrapRingForRecovery(keys, recovery.key);

    const { error } = await supabase.rpc("vault_rewrap_recovery", {
      p_legacy_wrapped: toBytea(box.ciphertext),
      p_legacy_nonce: toBytea(box.nonce),
      p_deks: rotated,
    });
    if (error) throw describeDbError(error);
    return recovery.code;
  } finally {
    wipe(recovery.key);
  }
}

/** AD-ul blob-ului de recuperare al unei chei rotite — legat de rândul ei. */
export const dekRecoveryAd = (dekId: string) => `vault_deks:${dekId}:recovery`;

/** Cheile rotite din inel, împachetate cu o cheie de recuperare. */
export function wrapRingForRecovery(
  keys: KeyMaterial,
  recoveryKey: Uint8Array
): Array<{ id: string; recovery_wrapped_dek: string; recovery_nonce: string }> {
  const out: Array<{ id: string; recovery_wrapped_dek: string; recovery_nonce: string }> = [];
  for (const [id, key] of keys.ring) {
    if (id === LEGACY_DEK) continue;
    const box = encrypt(recoveryKey, key, dekRecoveryAd(id));
    out.push({ id, recovery_wrapped_dek: toBytea(box.ciphertext), recovery_nonce: toBytea(box.nonce) });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Chei noi pentru un membru activ (faza 7): schimbarea parolei master și
// recuperarea cu codul trec amândouă pe aici. DEK-ul NU se schimbă —
// doar perechea membrului și ambalajele ei.
// ---------------------------------------------------------------------------

/**
 * Pereche X25519 nouă, privata împachetată cu `kek` (de regulă unul
 * derivat dintr-o parolă nouă), DEK-ul re-sigilat către noua publică,
 * totul depus atomic prin `vault_rekey_self`. Întoarce noile chei, gata
 * de pus în memorie. Cheile vechi rămân ale apelantului — el decide
 * când le zeroizează (după ce știe că și parola Supabase s-a schimbat).
 */
export async function rekeySelf(
  supabase: SupabaseClient,
  memberId: string,
  kek: Uint8Array,
  ring: { dek: Uint8Array; currentDekId: string | null; ring: Map<string, Uint8Array> }
): Promise<KeyMaterial> {
  const legacy = ring.ring.get(LEGACY_DEK);
  if (!legacy) throw new VaultDataError("forbidden", "Nu ai cheia originală a vault-ului.");
  const pair = generateMemberKeyPair();
  const wrappedPrivate = wrapPrivateKey(kek, pair.privateKey, memberId);
  const sealed = sealDek(legacy, pair.publicKey);
  const { error } = await supabase.rpc("vault_rekey_self", {
    p_public_key: toBytea(pair.publicKey),
    p_encrypted_private_key: toBytea(wrappedPrivate.ciphertext),
    p_private_key_nonce: toBytea(wrappedPrivate.nonce),
    p_wrapped_dek: toBytea(sealed),
  });
  if (error) {
    wipe(pair.privateKey);
    throw describeDbError(error);
  }
  const keys: KeyMaterial = {
    dek: ring.dek,
    currentDekId: ring.currentDekId,
    ring: ring.ring,
    publicKey: pair.publicKey,
    privateKey: pair.privateKey,
  };
  // Cheile rotite, sub noua cheie publică — separat, fiindcă funcția din
  // migrarea 3 nu le cunoaște. Dacă pică, apelantul întoarce totul.
  await resealSelf(supabase, keys);
  return keys;
}

/**
 * Cheile EXISTENTE, re-depuse sub un alt KEK — pentru întoarcerea din
 * drum când parola Supabase nu s-a putut schimba după `rekeySelf`:
 * cheile noi ar fi împachetate cu o parolă pe care contul n-o are.
 */
export async function rewrapSelf(
  supabase: SupabaseClient,
  memberId: string,
  kek: Uint8Array,
  keys: KeyMaterial
): Promise<void> {
  const legacy = keys.ring.get(LEGACY_DEK);
  if (!legacy) throw new VaultDataError("forbidden", "Nu ai cheia originală a vault-ului.");
  const wrappedPrivate = wrapPrivateKey(kek, keys.privateKey, memberId);
  const sealed = sealDek(legacy, keys.publicKey);
  const { error } = await supabase.rpc("vault_rekey_self", {
    p_public_key: toBytea(keys.publicKey),
    p_encrypted_private_key: toBytea(wrappedPrivate.ciphertext),
    p_private_key_nonce: toBytea(wrappedPrivate.nonce),
    p_wrapped_dek: toBytea(sealed),
  });
  if (error) throw describeDbError(error);
  await resealSelf(supabase, keys);
}

/**
 * DEK-ul din blob-ul de recuperare, cu codul de pe hârtie. Cere sesiune
 * de membru ACTIV (RLS pe `vault_meta`) — exact situația „am parolă
 * temporară nouă, dar cheile mele sunt împachetate cu parola veche".
 * Codul greșit și codul cu formă greșită dau mesaje diferite: al doilea
 * se vede fără să atingem serverul.
 */
export async function openDekWithRecoveryCode(
  supabase: SupabaseClient,
  code: string
): Promise<{ dek: Uint8Array; currentDekId: string | null; ring: Map<string, Uint8Array> }> {
  const recoveryKey = recoveryKeyFromCode(code);
  if (!recoveryKey) {
    throw new VaultCryptoError(
      "invalid_input",
      "Codul are 8 grupuri de 5 caractere (litere și cifre). Verifică ce ai tastat — liniuțele și spațiile nu contează."
    );
  }
  try {
    const [meta, deks] = await Promise.all([fetchMeta(supabase), fetchDeks(supabase)]);
    let legacy: Uint8Array;
    try {
      legacy = unwrapDekFromRecovery(recoveryKey, {
        ciphertext: meta.recoveryWrappedDek,
        nonce: meta.recoveryNonce,
      });
    } catch {
      throw new VaultCryptoError(
        "decrypt_failed",
        "Codul nu deschide vault-ul. Ori e tastat greșit, ori a fost regenerat între timp — codul vechi nu mai e valabil."
      );
    }
    const ring = new Map<string, Uint8Array>([[LEGACY_DEK, legacy]]);
    for (const dek of deks) {
      try {
        ring.set(
          dek.id,
          decrypt(recoveryKey, { ciphertext: dek.recoveryWrappedDek, nonce: dek.recoveryNonce }, dekRecoveryAd(dek.id))
        );
      } catch {
        // O cheie rotită neîmpachetată cu codul curent: rândurile ei
        // rămân ilizibile până le acordă un membru activ.
      }
    }
    const active = deks.find((dek) => dek.retiredAt === null);
    const currentDekId = active ? active.id : null;
    const current = ring.get(currentDekId ?? LEGACY_DEK);
    if (!current) {
      for (const key of ring.values()) wipe(key);
      throw new VaultCryptoError(
        "decrypt_failed",
        "Codul deschide cheia originală, dar nu și cheia curentă (rotită). Cere unui membru activ să-ți acorde cheile după ce îți refaci contul."
      );
    }
    return { dek: current, currentDekId, ring };
  } finally {
    wipe(recoveryKey);
  }
}
