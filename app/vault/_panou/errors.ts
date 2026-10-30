import { VaultCryptoError } from "@/lib/vault/crypto";
import { VaultDataError } from "@/lib/vault/members";

/**
 * Mesajul pentru om al unei erori din stratul Vault. `VaultDataError` și
 * `VaultCryptoError` au deja mesaje scrise pentru om (ce s-a întâmplat și ce
 * să faci); orice altceva primește mesajul de rezervă al locului unde a apărut.
 */
export function describeError(error: unknown, fallback: string): string {
  if (error instanceof VaultDataError || error instanceof VaultCryptoError) return error.message;
  if (error instanceof Error && /fetch|network/i.test(error.message)) {
    return "Nu ne putem conecta la Supabase. Verifică rețeaua și încearcă din nou.";
  }
  return fallback;
}

/** Conflictul de versiune: altcineva a salvat aceeași intrare între timp. */
export function isConflict(error: unknown): boolean {
  return error instanceof VaultDataError && error.code === "conflict";
}
