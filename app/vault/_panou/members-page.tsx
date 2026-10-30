"use client";

import { useMemo } from "react";
import { approveMember, removeMember, rotateRecoveryCode, VaultDataError } from "@/lib/vault/members";
import { useVault } from "../_components/vault-provider";
import { useVaultDataContext } from "./data";
import { MembersView, type MembersApi } from "./members-view";

const LOCKED = new VaultDataError("forbidden", "Seiful s-a blocat între timp. Deblochează-l din nou.");

/** Containerul ecranului Membri: aprobarea sigilează cheia de date pentru solicitant, eliminarea e un apel `vault_remove_member`, codul se regenerează cu cheile din memorie. */
export function MembersPage() {
  const { supabase, keys, member } = useVault();
  const { members, meta, error, reload } = useVaultDataContext();

  const api = useMemo<MembersApi>(
    () => ({
      async approve(target) {
        if (!supabase || !keys) throw LOCKED;
        await approveMember(supabase, keys, target);
      },
      async remove(target) {
        if (!supabase) throw LOCKED;
        await removeMember(supabase, target.id);
      },
      async regenerateRecoveryCode() {
        if (!supabase || !keys) throw LOCKED;
        return rotateRecoveryCode(supabase, keys);
      },
    }),
    [supabase, keys]
  );

  return <MembersView members={members} meta={meta} selfId={member?.id ?? null} error={error} reload={reload} api={api} />;
}
