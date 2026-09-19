"use client";

import { useEffect, useState } from "react";
import { Mark } from "@/components/site/mark";
import { useVault } from "./vault-provider";
import { MembersPanel } from "./members-panel";
import { formatCountdown } from "./ui";

/**
 * Vault-ul deblocat (feat/vault, faza 2).
 *
 * Aceeași bară ca în admin: marcă, eticheta mono a locului, acțiunile la
 * dreapta. În plus, un singur lucru pe care admin-ul nu-l are și vault-ul
 * nu poate să nu-l aibă: contorul până la auto-blocare. E informație
 * reală — cheile stau în memorie exact atâta timp — și se resetează la
 * orice atingere.
 *
 * Conținutul fazei 2 e administrarea membrilor. Lista intrărilor (faza
 * 3) intră sub același antet.
 */
export function VaultShell() {
  const vault = useVault();

  return (
    <div className="relative min-h-dvh">
      <a href="#continut" className="skip-link">
        Sari la conținut
      </a>

      <header className="sticky top-0 z-30 border-b border-hair bg-ink/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[1200px] items-center gap-4 px-5 sm:px-8">
          <span className="flex items-center gap-2.5 text-bone">
            <Mark size={22} />
            <span className="font-md-display text-[15px] font-semibold tracking-[0.2em]">
              MERIDIAN
            </span>
          </span>

          <span aria-hidden className="hidden h-4 w-px bg-hair-strong sm:block" />
          <span className="eyebrow hidden sm:inline">Vault</span>

          <div className="ml-auto flex items-center gap-4">
            <span className="hidden font-md-mono text-[11px] tracking-wide text-dim md:inline">
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
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow !text-[11.5px]">Deblocat · cheile stau doar în fila asta</p>
            <h1 className="display mt-2 text-[2.25rem] text-bone sm:text-[2.75rem]">Membri și recuperare</h1>
          </div>
          <p className="max-w-[26rem] text-[14.5px] leading-relaxed text-dim">
            Lista intrărilor vine în faza 3. Până atunci, de aici se aprobă cererile noi și se
            ține în viață codul de recuperare.
          </p>
        </div>

        <MembersPanel />
      </main>
    </div>
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
