import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { fromBytea, toBytea } from "./bytea";
import {
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
 * Stratul de date al membrilor (feat/vault, fazele 2 și 7).
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

/** Tot ce are un membru activ în memorie, după deblocare. */
export interface KeyMaterial {
  dek: Uint8Array;
  publicKey: Uint8Array;
  privateKey: Uint8Array;
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
    case "PGRST202": // funcție necunoscută în schema cache
      return new VaultDataError(
        "not_migrated",
        "Tabelele vault-ului lipsesc din baza de date. Aplică migrarea 3 (supabase/migrations/00000000000003_vault.sql) în SQL editor."
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
export function openKeys(member: VaultMember, kek: Uint8Array): KeyMaterial {
  if (!member.wrappedDek) {
    throw new VaultDataError("forbidden", "Membrul e încă în așteptare — nu are DEK sigilat.");
  }
  const privateKey = unwrapPrivateKey(
    kek,
    { ciphertext: member.encryptedPrivateKey, nonce: member.privateKeyNonce },
    member.id
  );
  try {
    const dek = openDek(member.wrappedDek, member.publicKey, privateKey);
    return { dek, publicKey: member.publicKey, privateKey };
  } catch (error) {
    wipe(privateKey);
    throw error;
  }
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
      keys: { dek, publicKey: pair.publicKey, privateKey: pair.privateKey },
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
  dek: Uint8Array,
  target: VaultMember
): Promise<void> {
  const sealed = sealDek(dek, target.publicKey);
  const { error } = await supabase.rpc("vault_approve_member", {
    p_member: target.id,
    p_wrapped_dek: toBytea(sealed),
  });
  if (error) throw describeDbError(error);
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
export async function rotateRecoveryCode(
  supabase: SupabaseClient,
  dek: Uint8Array
): Promise<string> {
  const current = await fetchMeta(supabase);
  const recovery = generateRecoveryCode();
  const box = wrapDekForRecovery(recovery.key, dek);
  wipe(recovery.key);

  const { error } = await supabase
    .from("vault_meta")
    .update({
      recovery_wrapped_dek: toBytea(box.ciphertext),
      recovery_nonce: toBytea(box.nonce),
      recovery_rotations: current.recoveryRotations + 1,
    })
    .eq("id", true);
  if (error) throw describeDbError(error);
  return recovery.code;
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
  dek: Uint8Array
): Promise<KeyMaterial> {
  const pair = generateMemberKeyPair();
  const wrappedPrivate = wrapPrivateKey(kek, pair.privateKey, memberId);
  const sealed = sealDek(dek, pair.publicKey);
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
  return { dek, publicKey: pair.publicKey, privateKey: pair.privateKey };
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
  const wrappedPrivate = wrapPrivateKey(kek, keys.privateKey, memberId);
  const sealed = sealDek(keys.dek, keys.publicKey);
  const { error } = await supabase.rpc("vault_rekey_self", {
    p_public_key: toBytea(keys.publicKey),
    p_encrypted_private_key: toBytea(wrappedPrivate.ciphertext),
    p_private_key_nonce: toBytea(wrappedPrivate.nonce),
    p_wrapped_dek: toBytea(sealed),
  });
  if (error) throw describeDbError(error);
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
): Promise<Uint8Array> {
  const recoveryKey = recoveryKeyFromCode(code);
  if (!recoveryKey) {
    throw new VaultCryptoError(
      "invalid_input",
      "Codul are 8 grupuri de 5 caractere (litere și cifre). Verifică ce ai tastat — liniuțele și spațiile nu contează."
    );
  }
  try {
    const meta = await fetchMeta(supabase);
    try {
      return unwrapDekFromRecovery(recoveryKey, {
        ciphertext: meta.recoveryWrappedDek,
        nonce: meta.recoveryNonce,
      });
    } catch {
      throw new VaultCryptoError(
        "decrypt_failed",
        "Codul nu deschide vault-ul. Ori e tastat greșit, ori a fost regenerat între timp — codul vechi nu mai e valabil."
      );
    }
  } finally {
    wipe(recoveryKey);
  }
}
