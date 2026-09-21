"use client";

import { useEffect, useState } from "react";
import { Mark } from "@/components/site/mark";
import { useVault } from "./vault-provider";
import { useVaultData } from "./use-vault-data";
import { MembersPanel } from "./members-panel";
import { AccountPanel } from "./account-panel";
import { KeyPanel } from "./key-panel";
import { EntriesWorkspace } from "./entries-workspace";
import { Note, formatCountdown } from "./ui";

/**
 * Vault-ul deblocat (feat/vault, fazele 2–3).
 *
 * Aceeași bară ca în admin: marcă, eticheta mono a locului, acțiunile la
 * dreapta. În plus, un singur lucru pe care admin-ul nu-l are și vault-ul
 * nu poate să nu-l aibă: contorul până la auto-blocare. E informație
 * reală — cheile stau în memorie exact atâta timp — și se resetează la
 * orice atingere.
 *
 * Două vederi, comutate din antet: intrările (faza 3, vederea de zi cu
 * zi) și membrii (faza 2). Cererile de aprobare în așteptare se văd pe
 * comutator, ca fondatorul să le observe fără să deschidă vederea.
 * Datele vin dintr-un singur loc (`useVaultData`), ca cele două vederi
 * să nu se contrazică.
 */

type View = "entries" | "members";

export function VaultShell() {
  const vault = useVault();
  const data = useVaultData();
  const [view, setView] = useState<View>("entries");

  const pendingCount = data.members?.filter((row) => !row.wrappedDek).length ?? 0;

  return (
    <div className="relative min-h-dvh">
      <a href="#continut" className="skip-link">
        Sari la conținut
      </a>

      <header className="sticky top-0 z-30 border-b border-hair bg-ink/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-x-3 px-5 sm:h-16 sm:flex-nowrap sm:gap-x-4 sm:px-8">
          <span className="flex h-16 items-center gap-2.5 text-bone">
            <Mark size={22} />
            <span className="font-md-display text-[15px] font-semibold tracking-[0.2em]">
              MERIDIAN
            </span>
          </span>

          <span aria-hidden className="hidden h-4 w-px bg-hair-strong sm:block" />
          <span className="eyebrow hidden sm:inline">Vault</span>

          {/* Pe telefon, comutatorul coboară pe rândul al doilea — la 360 nu
              încap marca, două vederi, ceasul și „Blochează” pe un singur rând. */}
          <nav
            aria-label="Vederi"
            className="order-last flex basis-full items-center gap-1 pb-2.5 sm:order-none sm:ml-2 sm:basis-auto sm:pb-0"
          >
            <ViewButton active={view === "entries"} onClick={() => setView("entries")}>
              Intrări
            </ViewButton>
            <ViewButton active={view === "members"} onClick={() => setView("members")}>
              Membri
              {pendingCount > 0 ? (
                <span
                  className="ml-1.5 inline-flex min-w-5 items-center justify-center rounded-full bg-[#f0b429] px-1.5 py-0.5 font-md-mono text-[10.5px] font-semibold leading-none text-[#2a1a00]"
                  aria-label={`${pendingCount} în așteptare`}
                >
                  {pendingCount}
                </span>
              ) : null}
            </ViewButton>
          </nav>

          <div className="ml-auto flex h-16 items-center gap-3 sm:gap-4">
            <span className="hidden font-md-mono text-[11px] tracking-wide text-dim lg:inline">
              {vault.member?.email}
            </span>
            <AutoLockClock />
            <button
              type="button"
              onClick={() => void vault.lock("Vault-ul e blocat. Cheile au fost șterse din memorie.")}
              className="btn btn-ghost !min-h-9 !px-4 !py-2 !text-[12.5px]"
            >
              Blochează
            </button>
          </div>
        </div>
      </header>

      {/* Lumina celor două lumi, în capul paginii — ca în admin. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[30rem] overflow-hidden [mask-image:linear-gradient(to_bottom,#000_30%,transparent)]"
      >
        <div className="aurora-drift absolute left-[-30%] top-[-45%] h-[26rem] w-[34rem] rounded-full bg-[radial-gradient(closest-side,rgb(47_91_255/0.42),rgb(47_91_255/0.12)_45%,transparent_72%)] sm:left-[-10%] sm:h-[34rem] sm:w-[52rem]" />
        <div className="aurora-drift-2 absolute right-[-30%] top-[-50%] h-[24rem] w-[32rem] rounded-full bg-[radial-gradient(closest-side,rgb(31_181_131/0.36),rgb(31_181_131/0.1)_45%,transparent_72%)] sm:right-[-8%] sm:h-[32rem] sm:w-[48rem]" />
      </div>

      <main id="continut" className="relative mx-auto max-w-[1200px] px-5 py-10 sm:px-8 sm:py-12">
        {vault.notice ? (
          <div className="mb-6 flex flex-wrap items-start gap-3" aria-live="polite">
            <div className="min-w-0 flex-1">
              <Note tone="info">{vault.notice}</Note>
            </div>
            <button type="button" onClick={vault.dismissNotice} className="btn btn-ghost mt-4 !min-h-9 !px-4 !py-2 !text-[12.5px]">
              Am înțeles
            </button>
          </div>
        ) : null}
        {view === "entries" ? (
          <EntriesWorkspace
            snapshot={data.snapshot}
            members={data.members}
            loading={data.loading}
            error={data.error}
            reload={data.reload}
          />
        ) : (
          <>
            <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="eyebrow !text-[11.5px]">Deblocat · cheile stau doar în fila asta</p>
                <h1 className="display mt-2 text-[2.25rem] text-bone sm:text-[2.75rem]">
                  Membri și recuperare
                </h1>
              </div>
              <p className="max-w-[26rem] text-[14.5px] leading-relaxed text-dim">
                De aici se aprobă cererile noi și se ține în viață codul de recuperare. Un membru
                aprobat vede tot ce e în vault, de la următoarea deblocare.
              </p>
            </div>
            <MembersPanel
              members={data.members}
              meta={data.meta}
              loadError={data.error}
              reload={data.reload}
            />
            <KeyPanel members={data.members} onChanged={data.reload} />
            <AccountPanel />
          </>
        )}
      </main>
    </div>
  );
}

function ViewButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`inline-flex min-h-9 items-center rounded-full px-3.5 text-[13px] font-medium transition-colors duration-150 ${
        active ? "bg-bone text-ink" : "text-dim hover:bg-white/[0.06] hover:text-bone"
      }`}
    >
      {children}
    </button>
  );
}

/** `blocare 14:59` — se recalculează la fiecare secundă din ref-ul
    providerului, fără să re-randeze restul paginii la fiecare mișcare
    de mouse. */
function AutoLockClock() {
  const vault = useVault();
  const [remaining, setRemaining] = useState<number | null>(() => vault.remainingUntilAutoLock());

  useEffect(() => {
    const tick = () => setRemaining(vault.remainingUntilAutoLock());
    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [vault]);

  if (remaining === null) return null;
  const urgent = remaining < 60 * 1000;

  return (
    <span
      className={`whitespace-nowrap font-md-mono text-[11px] tracking-[0.08em] tabular-nums ${
        urgent ? "text-[#f0b429]" : "text-dim"
      }`}
      title="Auto-blocare după 15 minute fără activitate"
      aria-label={`Auto-blocare în ${formatCountdown(remaining)}`}
    >
      <span aria-hidden>
        <span className="hidden sm:inline">blocare </span>
        {formatCountdown(remaining)}
      </span>
    </span>
  );
}
