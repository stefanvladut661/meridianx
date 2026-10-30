"use client";

import { useCallback, useMemo } from "react";
import {
  createClient,
  createEntry,
  deleteEntry,
  listVersions,
  loadDeleted,
  renameClient,
  restoreEntry,
  restoreVersion,
  updateEntry,
} from "@/lib/vault/entries";
import { VaultDataError } from "@/lib/vault/members";
import { useQueryParams } from "@/components/panou/ui/use-query-params";
import { useToast } from "@/components/panou/ui/toast";
import { useVault } from "../_components/vault-provider";
import { useVaultDataContext } from "./data";
import { NEW_CLIENT } from "./entry-editor";
import { EntriesView, type EntriesApi, type EntriesTab } from "./entries-view";

/**
 * Containerul ecranului „Intrări”: leagă `EntriesView` de seiful real. Aici sunt
 * singurele apeluri către `lib/vault/entries` ale ecranului; cheile și clientul
 * Supabase vin din provider (non-null doar cât seiful e deblocat) și nu pleacă
 * mai departe de aceste funcții. Intrarea deschisă și tab-ul stau în adresă
 * (`?intrare=<id>`, `?tab=cos`); căutarea NU: numele de clienți nu ajung în URL.
 */

const LOCKED = new VaultDataError("forbidden", "Seiful s-a blocat între timp. Deblochează-l din nou.");

export function EntriesPage() {
  const vault = useVault();
  const data = useVaultDataContext();
  const { notify } = useToast();
  const { get, setMany } = useQueryParams();
  const { supabase, keys } = vault;

  const selectedId = get("intrare") || null;
  const tab: EntriesTab = get("tab") === "cos" ? "cos" : "intrari";

  const api = useMemo<EntriesApi>(
    () => ({
      async saveEntry({ mode, entry, clientChoice, newClientName, payload }) {
        if (!supabase || !keys) throw LOCKED;
        const clientId = clientChoice === NEW_CLIENT ? await createClient(supabase, keys, newClientName) : clientChoice;
        if (mode === "edit" && entry) {
          await updateEntry(supabase, keys, { id: entry.id, version: entry.version, dekId: entry.dekId }, clientId, payload);
          return entry.id;
        }
        return createEntry(supabase, keys, clientId, payload);
      },
      async deleteEntry(entry, lastOfClient) {
        if (!supabase) throw LOCKED;
        await deleteEntry(supabase, { id: entry.id, version: entry.version, clientId: entry.clientId }, lastOfClient);
      },
      async renameClient(clientId, name) {
        if (!supabase || !keys) throw LOCKED;
        await renameClient(supabase, keys, clientId, name);
      },
      async listVersions(entryId) {
        if (!supabase || !keys) throw LOCKED;
        return listVersions(supabase, keys, entryId);
      },
      async restoreVersion(entry, version) {
        if (!supabase || !keys || version.content.status !== "ok") throw LOCKED;
        await restoreVersion(supabase, keys, { id: entry.id, version: entry.version, clientId: entry.clientId, dekId: entry.dekId }, version.content.payload);
      },
      async loadDeleted() {
        if (!supabase || !keys) throw LOCKED;
        return loadDeleted(supabase, keys);
      },
      async restoreDeleted(item) {
        if (!supabase) throw LOCKED;
        await restoreEntry(supabase, { id: item.entry.id, clientId: item.entry.clientId });
      },
    }),
    [supabase, keys]
  );

  const onSelect = useCallback((id: string | null) => setMany({ intrare: id }), [setMany]);
  const onTab = useCallback((next: EntriesTab) => setMany({ tab: next === "intrari" ? "" : next, intrare: "" }), [setMany]);

  return (
    <EntriesView
      snapshot={data.snapshot}
      members={data.members}
      error={data.error}
      reload={data.reload}
      api={api}
      selectedId={selectedId}
      tab={tab}
      onSelect={onSelect}
      onTab={onTab}
      onLock={() => {
        void vault.lock();
        notify("Seif blocat. Cheia a fost ștearsă din memorie.");
      }}
    />
  );
}
