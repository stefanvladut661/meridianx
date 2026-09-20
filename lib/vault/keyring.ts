import type { SupabaseClient } from "@supabase/supabase-js";
import { toBytea } from "./bytea";
import { encrypt, generateDek, generateRecoveryCode, sealDek, wipe, wrapDekForRecovery } from "./crypto";
import {
  dekRecoveryAd,
  describeDbError,
  fetchDeks,
  fetchMemberDeks,
  grantDeks,
  LEGACY_DEK,
  VaultDataError,
  type KeyMaterial,
  type MemberDek,
  type VaultDek,
  type VaultMember,
} from "./members";
import { newId } from "./entries";

/**
 * Rotația cheii de date (feat/vault, faza 10). Vezi migrarea 4 pentru
 * model. Aici: un singur apel atomic pe server (`vault_rotate_dek`), apoi
 * inelul din memorie primește cheia nouă ca „curentă". Re-criptarea
 * rândurilor e separată (`reencryptAll`, în `entries.ts`) și reluabilă.
 *
 * Rotația produce un COD DE RECUPERARE NOU, afișat o singură dată, ca la
 * inițializare. Codul vechi nu mai deschide nimic.
 */

export interface RotationResult {
  recoveryCode: string;
  dekId: string;
}

/**
 * Cheie nouă pentru vault. MUTEAZĂ `keys` în loc (inelul, cheia curentă,
 * id-ul) — obiectul e cel din providerul de sub UI, iar tot ce scrie după
 * apel trebuie să folosească deja cheia nouă.
 *
 * `members` trebuie să fie lista COMPLETĂ a membrilor (activi + în
 * așteptare); serverul verifică oricum că toți activii primesc cheia.
 */
export async function rotateDek(
  supabase: SupabaseClient,
  keys: KeyMaterial,
  members: VaultMember[]
): Promise<RotationResult> {
  const legacy = keys.ring.get(LEGACY_DEK);
  if (!legacy) throw new VaultDataError("forbidden", "Nu ai cheia originală a vault-ului — nu poți roti.");

  const dekId = newId();
  const dek = generateDek();
  const recovery = generateRecoveryCode();
  try {
    const legacyBox = wrapDekForRecovery(recovery.key, legacy);
    const deks: Array<{ id: string; recovery_wrapped_dek: string; recovery_nonce: string }> = [];
    for (const [id, key] of keys.ring) {
      if (id === LEGACY_DEK) continue;
      const box = encrypt(recovery.key, key, dekRecoveryAd(id));
      deks.push({ id, recovery_wrapped_dek: toBytea(box.ciphertext), recovery_nonce: toBytea(box.nonce) });
    }
    const fresh = encrypt(recovery.key, dek, dekRecoveryAd(dekId));
    deks.push({ id: dekId, recovery_wrapped_dek: toBytea(fresh.ciphertext), recovery_nonce: toBytea(fresh.nonce) });

    const sealed = members
      .filter((member) => member.wrappedDek !== null)
      .map((member) => ({ member_id: member.id, sealed_dek: toBytea(sealDek(dek, member.publicKey)) }));

    const { error } = await supabase.rpc("vault_rotate_dek", {
      p_dek_id: dekId,
      p_legacy_wrapped: toBytea(legacyBox.ciphertext),
      p_legacy_nonce: toBytea(legacyBox.nonce),
      p_deks: deks,
      p_sealed: sealed,
    });
    if (error) {
      wipe(dek);
      throw describeDbError(error);
    }

    keys.ring.set(dekId, dek);
    keys.dek = dek;
    keys.currentDekId = dekId;
    return { recoveryCode: recovery.code, dekId };
  } finally {
    wipe(recovery.key);
  }
}

export interface KeyringStatus {
  deks: VaultDek[];
  /** Cheia curentă: `null` = originala, altfel rândul din `vault_deks`. */
  current: VaultDek | null;
  /** Membri activi cărora le lipsește cel puțin o cheie rotită. */
  missing: Array<{ member: VaultMember; dekIds: string[] }>;
  /** Chei rotite din bază pe care membrul curent nu le are în inel. */
  ownMissing: string[];
}

/** Starea inelului, pentru panoul de chei: ce chei există, cine nu le are. */
export async function keyringStatus(
  supabase: SupabaseClient,
  keys: KeyMaterial,
  members: VaultMember[]
): Promise<KeyringStatus> {
  const [deks, memberDeks] = await Promise.all([fetchDeks(supabase), fetchMemberDeks(supabase)]);
  const have = new Map<string, Set<string>>();
  for (const row of memberDeks as MemberDek[]) {
    if (!have.has(row.memberId)) have.set(row.memberId, new Set());
    have.get(row.memberId)!.add(row.dekId);
  }
  const missing: KeyringStatus["missing"] = [];
  for (const member of members) {
    if (!member.wrappedDek) continue;
    const dekIds = deks.filter((dek) => !have.get(member.id)?.has(dek.id)).map((dek) => dek.id);
    if (dekIds.length) missing.push({ member, dekIds });
  }
  return {
    deks,
    current: deks.find((dek) => dek.retiredAt === null) ?? null,
    missing,
    ownMissing: deks.filter((dek) => !keys.ring.has(dek.id)).map((dek) => dek.id),
  };
}

/** Acordă unui membru toate cheile rotite pe care le ai. */
export async function grantMissing(supabase: SupabaseClient, keys: KeyMaterial, member: VaultMember): Promise<void> {
  await grantDeks(supabase, keys, member);
}
