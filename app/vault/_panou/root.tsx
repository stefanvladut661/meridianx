"use client";

import { useState, type ReactNode } from "react";
import { PanouFrame } from "@/components/panou/layout/frame";
import { Card } from "@/components/panou/ui/primitives";
import { EmptyState } from "@/components/panou/ui/states";
import { ShieldAlert } from "lucide-react";
import { VaultProvider, useVault } from "../_components/vault-provider";
import { VaultGate } from "./gate";

/**
 * Rădăcina client a Vault-ului, pusă o singură dată în `app/vault/layout.tsx`:
 * providerul seifului (mașina de stări, cheile în ref-uri) și cadrul comun al
 * panoului. Stă în layout, nu în pagini, ca starea deblocată să supraviețuiască
 * navigării între Intrări, Import, Export, Membri și Contul meu.
 *
 * Cadrul este `PanouFrame`, partea de client a lui `PanouShell`. `PanouShell` e
 * un component de server care citește din baza adminului alertele și numerele
 * din meniu; Vault-ul are sesiune SEPARATĂ de cea de admin (Supabase în memorie)
 * și nu atinge baza adminului, deci primește cadrul gol (fără alerte) și emailul
 * membrului seifului, cunoscut abia în browser, după deblocare.
 */

export function VaultRoot({ configured, children }: { configured: boolean; children: ReactNode }) {
  if (!configured) {
    return (
      <PanouFrame email={null} alerts={[]} badges={{}}>
        <SetupNotice />
      </PanouFrame>
    );
  }
  return (
    <VaultProvider>
      <Session>{children}</Session>
    </VaultProvider>
  );
}

function Session({ children }: { children: ReactNode }) {
  const { member } = useVault();
  const [pending, setPending] = useState(0);
  return (
    <PanouFrame email={member?.email ?? null} alerts={[]} badges={pending > 0 ? { vault: pending } : {}}>
      <VaultGate onPending={setPending}>{children}</VaultGate>
    </PanouFrame>
  );
}

/** Fără Supabase, un formular de deblocare ar fi un drum înfundat cu un câmp de parolă: mai bine o explicație. */
function SetupNotice() {
  return (
    <div className="mx-auto max-w-xl">
      <Card className="p-0">
        <EmptyState
          icon={ShieldAlert}
          title="Vault-ul nu e configurat"
          text={
            <>
              Vault-ul vorbește direct cu Supabase din browser. Completează în <code className="font-mono text-foreground/80">.env.local</code> variabilele{" "}
              <code className="font-mono text-foreground/80">NEXT_PUBLIC_SUPABASE_URL</code> și <code className="font-mono text-foreground/80">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>, apoi repornește serverul. Apoi aplică
              migrările 3 și 4 în SQL editor.
            </>
          }
        />
      </Card>
    </div>
  );
}
