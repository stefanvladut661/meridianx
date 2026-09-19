"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { loadVault, type VaultSnapshot } from "@/lib/vault/entries";
import {
  fetchMeta,
  listMembers,
  VaultDataError,
  type VaultMember,
  type VaultMeta,
} from "@/lib/vault/members";
import { VaultCryptoError } from "@/lib/vault/crypto";
import { useVault } from "./vault-provider";

/**
 * Datele vault-ului deblocat, într-un singur loc (feat/vault, faza 3).
 *
 * Shell-ul le încarcă o dată, după deblocare, și le dă mai departe
 * listei și panoului de membri. O singură sursă, ca eticheta „în
 * așteptare" din antet și lista de membri să spună același lucru.
 *
 * Reîncărcarea e manuală (butonul) sau la revenirea în filă după mai
 * mult de 30 s — o echipă adaugă intrări din mai multe browsere, iar
 * cine se întoarce la filă trebuie să vadă ce au pus ceilalți fără să
 * știe că există un buton.
 */

const STALE_AFTER_MS = 30 * 1000;

export interface VaultData {
  snapshot: VaultSnapshot | null;
  members: VaultMember[] | null;
  meta: VaultMeta | null;
  error: string | null;
  loading: boolean;
  reload: () => Promise<void>;
}

export function describeLoadError(error: unknown): string {
  if (error instanceof VaultDataError || error instanceof VaultCryptoError) return error.message;
  if (error instanceof Error && /fetch|network/i.test(error.message)) {
    return "Nu ne putem conecta la Supabase. Verifică rețeaua și încearcă din nou.";
  }
  return "Datele nu s-au putut încărca dintr-un motiv necunoscut. Reîncarcă și încearcă din nou.";
}

export function useVaultData(): VaultData {
  const { supabase, keys } = useVault();
  const [snapshot, setSnapshot] = useState<VaultSnapshot | null>(null);
  const [members, setMembers] = useState<VaultMember[] | null>(null);
  const [meta, setMeta] = useState<VaultMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const loadedAtRef = useRef(0);
  const inFlightRef = useRef(false);

  const reload = useCallback(async () => {
    if (!supabase || !keys || inFlightRef.current) return;
    inFlightRef.current = true;
    setLoading(true);
    try {
      const [nextSnapshot, nextMembers, nextMeta] = await Promise.all([
        loadVault(supabase, keys.dek),
        listMembers(supabase),
        fetchMeta(supabase),
      ]);
      setSnapshot(nextSnapshot);
      setMembers(nextMembers);
      setMeta(nextMeta);
      setError(null);
      loadedAtRef.current = Date.now();
    } catch (cause) {
      setError(describeLoadError(cause));
    } finally {
      inFlightRef.current = false;
      setLoading(false);
    }
  }, [supabase, keys]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - loadedAtRef.current > STALE_AFTER_MS) void reload();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [reload]);

  return { snapshot, members, meta, error, loading, reload };
}
