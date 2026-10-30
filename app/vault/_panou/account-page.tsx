"use client";

import { useMemo } from "react";
import { countStaleRows, reencryptAll } from "@/lib/vault/entries";
import { grantMissing, keyringStatus, rotateDek } from "@/lib/vault/keyring";
import { VaultDataError } from "@/lib/vault/members";
import { useToast } from "@/components/panou/ui/toast";
import { useVault } from "../_components/vault-provider";
import { AccountView, type AccountApi } from "./account-view";
import { useVaultDataContext } from "./data";

const LOCKED = new VaultDataError("forbidden", "Seiful s-a blocat între timp. Deblochează-l din nou.");

/** Containerul ecranului Contul meu: parola master (providerul face derivarea și re-sigilarea), inelul de chei (`keyring.ts`) și re-criptarea (`entries.ts`). */
export function AccountPage() {
  const vault = useVault();
  const { supabase, keys, member, changeMasterPassword } = vault;
  const { members, reload } = useVaultDataContext();
  const { notify } = useToast();

  const api = useMemo<AccountApi>(
    () => ({
      changePassword: (current, next, onStep) => changeMasterPassword(current, next, onStep),
      async keyringStatus() {
        if (!supabase || !keys || !members) throw LOCKED;
        const [status, stale] = await Promise.all([keyringStatus(supabase, keys, members), countStaleRows(supabase, keys.currentDekId)]);
        return { status, stale };
      },
      async rotate() {
        if (!supabase || !keys || !members) throw LOCKED;
        const result = await rotateDek(supabase, keys, members);
        return result.recoveryCode;
      },
      async reencrypt(onProgress) {
        if (!supabase || !keys) throw LOCKED;
        return reencryptAll(supabase, keys, onProgress);
      },
      async grant(target) {
        if (!supabase || !keys) throw LOCKED;
        await grantMissing(supabase, keys, target);
      },
    }),
    [supabase, keys, members, changeMasterPassword]
  );

  return (
    <AccountView
      email={member?.email ?? null}
      members={members}
      api={api}
      reload={reload}
      onLock={() => {
        void vault.lock();
        notify("Seif blocat acum. Cheia a fost ștearsă din memorie.");
      }}
    />
  );
}
