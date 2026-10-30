"use client";

import { useMemo } from "react";
import { createEntries, ensureClients } from "@/lib/vault/entries";
import { VaultDataError } from "@/lib/vault/members";
import { Card } from "@/components/panou/ui/primitives";
import { ErrorState, LoadingRows } from "@/components/panou/ui/states";
import { useVault } from "../_components/vault-provider";
import { useVaultDataContext } from "./data";
import { ImportView, type ImportApi } from "./import-view";
import { PageHead } from "./ui";

/** Containerul importului: criptează și scrie rândurile cu cheia curentă; clienții lipsă se creează, cei existenți se refolosesc după nume. */
export function ImportPage() {
  const { supabase, keys } = useVault();
  const { snapshot, error, reload } = useVaultDataContext();
  const clients = snapshot?.clients;

  const api = useMemo<ImportApi>(
    () => ({
      async run(rows, onProgress) {
        if (!supabase || !keys || !clients) throw new VaultDataError("forbidden", "Seiful s-a blocat între timp. Deblochează-l din nou.");
        const names = Array.from(new Set(rows.map((row) => row.clientName)));
        const idByName = await ensureClients(supabase, keys, names, clients);
        const items = rows.map((row) => ({ clientId: idByName.get(row.clientName)!, payload: row.payload }));
        const imported = await createEntries(supabase, keys, items, onProgress);
        const clientsCreated = names.filter((name) => !clients.some((client) => client.id === idByName.get(name))).length;
        return { imported, clientsCreated };
      },
    }),
    [supabase, keys, clients]
  );

  if (!snapshot) {
    return (
      <>
        <PageHead title="Import" text="Trei pași. Secretele se criptează în browser înainte să fie salvate." />
        <Card className="overflow-hidden p-0">
          {error ? <ErrorState title="Seiful nu s-a încărcat" text={error} onRetry={() => void reload()} /> : <LoadingRows rows={4} cols={3} />}
        </Card>
      </>
    );
  }

  return <ImportView clients={snapshot.clients} entries={snapshot.entries} api={api} reload={reload} />;
}
