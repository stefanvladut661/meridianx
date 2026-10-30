"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Lock, LogOut, RefreshCw, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { Btn, Card } from "@/components/panou/ui/primitives";
import { InlineNote } from "@/components/panou/ui/actions";
import { useToast } from "@/components/panou/ui/toast";
import { clearClipboardNow } from "../_components/clipboard";
import { useVault } from "../_components/vault-provider";
import { VaultDataProvider, useVaultDataContext } from "./data";
import { formatCountdown } from "./format";
import { ActivateFlow, RecoverFlow } from "./onboarding";
import { UnlockScreen } from "./unlock";

/**
 * Poarta (VaultGate din prototip), o singură dată, în layout: ce se vede depinde
 * de faza mașinii de stări, nu de rută.
 *
 *   încuiat            → poarta de deblocare (în afară de /activare și /recuperare, care au pagina lor)
 *   activare / chei    → fluxul de activare (parolă → chei → cod sau aprobare)
 *   recuperare         → codul de pe hârtie
 *   deblocat           → fâșia (N intrări · M clienți · decriptate local în X ms · contor) și pagina
 *
 * Cât seiful e deblocat, datele decriptate trăiesc într-un provider care se
 * demontează la blocare: nimic decriptat nu rămâne în memorie după „Blochează”.
 */
export function VaultGate({ children, onPending }: { children: ReactNode; onPending: (count: number) => void }) {
  const { phase } = useVault();
  const pathname = usePathname();
  const { notify } = useToast();

  // „Seiful e deschis”: o singură dată, la trecerea în deblocat.
  const previous = useRef(phase.kind);
  useEffect(() => {
    if (previous.current !== "unlocked" && phase.kind === "unlocked") notify("Seiful e deschis. Cheia există doar în acest browser.");
    previous.current = phase.kind;
  }, [phase.kind, notify]);

  if (phase.kind === "unlocked") {
    return (
      <VaultDataProvider onPending={onPending}>
        <UnlockedFrame>{children}</UnlockedFrame>
      </VaultDataProvider>
    );
  }

  const ownPage = pathname === "/vault/activare" || pathname === "/vault/recuperare";
  const fromLocked = phase.kind === "locked" || (phase.kind === "busy" && phase.from === "locked");
  if (fromLocked) return ownPage ? <>{children}</> : <UnlockScreen />;

  if (phase.kind === "recovery" || (phase.kind === "busy" && (phase.step === "recovering" || phase.step === "rekeying"))) return <RecoverFlow />;
  return <ActivateFlow />;
}

/** Ce învelește paginile cât seiful e deschis: fâșia, mesajul providerului și golirea clipboardului la blocare. */
function UnlockedFrame({ children }: { children: ReactNode }) {
  const { notice, dismissNotice } = useVault();

  // La blocare (demontare) și la părăsirea paginii, clipboardul nu rămâne cu o parolă.
  useEffect(() => {
    const clear = () => clearClipboardNow();
    window.addEventListener("pagehide", clear);
    return () => {
      window.removeEventListener("pagehide", clear);
      clearClipboardNow();
    };
  }, []);

  return (
    <div className="space-y-4">
      <VaultBar />
      {notice ? (
        <InlineNote tone="neutral">
          <span className="flex flex-wrap items-start gap-3">
            <span className="min-w-0 flex-1" role="status">
              {notice}
            </span>
            <button type="button" onClick={dismissNotice} className="underline underline-offset-2">
              Am înțeles
            </button>
          </span>
        </InlineNote>
      ) : null}
      {children}
    </div>
  );
}

/**
 * Fâșia de sub antet. Cifrele sunt reale: câte rânduri, câți clienți, în cât
 * timp s-au decriptat LOCAL (afirmația modelului zero-knowledge, cu cifre) și
 * cât mai e până la auto-blocare (15 minute fără activitate).
 */
function VaultBar() {
  const vault = useVault();
  const { snapshot, loading, reload } = useVaultDataContext();
  const [remaining, setRemaining] = useState<number | null>(() => vault.remainingUntilAutoLock());

  useEffect(() => {
    const tick = () => setRemaining(vault.remainingUntilAutoLock());
    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [vault]);

  const { notify } = useToast();
  const urgent = remaining !== null && remaining < 60 * 1000;

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-mint/15 bg-mint/[0.04] px-3.5 py-2.5">
      <span className="flex items-center gap-1.5 text-[11.5px] text-[#B4F2CD]" aria-live="polite">
        <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
        {snapshot ? (
          <>
            {snapshot.entries.length} {snapshot.entries.length === 1 ? "intrare" : "intrări"}, {snapshot.clients.length} {snapshot.clients.length === 1 ? "client" : "clienți"}, decriptate local în{" "}
            <span className="pu-num font-mono">{Math.max(1, Math.round(snapshot.decryptMs))} ms</span>
          </>
        ) : loading ? (
          "se descarcă și se decriptează…"
        ) : (
          "seif deschis"
        )}
      </span>
      {remaining !== null ? (
        <span className={cn("flex items-center gap-1.5 text-[11.5px]", urgent ? "text-apricot" : "text-muted-foreground")} title="Auto-blocare după 15 minute fără activitate">
          <Lock className="h-3 w-3" aria-hidden="true" /> se blochează în <span className="pu-num font-mono text-foreground/80">{formatCountdown(remaining)}</span>
        </span>
      ) : null}
      <span className="ml-auto flex items-center gap-1">
        <Btn size="xs" variant="ghost" icon={RefreshCw} disabled={loading} onClick={() => void reload()} aria-label="Reîncarcă datele din seif">
          {loading ? "Se reîncarcă…" : "Reîncarcă"}
        </Btn>
        <Btn
          size="xs"
          variant="ghost"
          icon={LogOut}
          onClick={() => {
            void vault.lock();
            notify("Seif blocat. Cheia a fost ștearsă din memorie.");
          }}
        >
          Blochează acum
        </Btn>
      </span>
    </div>
  );
}

/** Cardul pentru rutele care n-au sens cu seiful deja deschis (activare, recuperare). */
export function AlreadyOpen({ title, text }: { title: string; text: string }) {
  return (
    <div className="mx-auto max-w-xl">
      <Card className="pu-sealed">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-mint" aria-hidden="true" />
          <h1 className="text-[15px] font-semibold">{title}</h1>
        </div>
        <p className="mt-2 text-[12.5px] leading-relaxed text-muted-foreground">{text}</p>
        <Link
          href="/vault"
          className="mt-4 inline-flex h-8 items-center justify-center rounded-lg border border-white/[0.14] px-3 text-[12.5px] font-medium text-foreground transition-colors hover:bg-white/[0.06]"
        >
          Mergi la intrări
        </Link>
      </Card>
    </div>
  );
}
