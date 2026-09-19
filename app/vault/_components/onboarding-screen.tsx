"use client";

import { useEffect, useRef } from "react";
import { useVault } from "./vault-provider";
import { BusyPanel } from "./unlock-screen";
import { Card, Note, PrimaryButton } from "./ui";
import { RecoveryCode } from "./recovery-code";

/**
 * Ecranele dintre sesiune și vault (feat/vault, faza 2):
 *
 * - keys-missing   — cont autentificat, fără chei: le generează acum;
 *                    serverul decide dacă e fondator sau solicitant.
 * - recovery-code  — a fost fondator: codul, o singură dată.
 * - pending        — a fost solicitant: așteaptă aprobarea.
 * - busy           — pasul în curs, în aceeași fișă.
 *
 * Numerotarea „pasul N din 3" e legitimă aici: chiar e o secvență
 * (activare → chei → cod sau așteptare), și omul vrea să știe cât mai
 * are.
 */
export function OnboardingScreen() {
  const vault = useVault();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const kind = vault.phase.kind;

  useEffect(() => {
    headingRef.current?.focus();
  }, [kind]);

  if (vault.phase.kind === "busy") {
    return (
      <Card>
        <BusyPanel step={vault.phase.step} startedAt={vault.phase.startedAt} kdfMs={vault.lastKdfMs} />
      </Card>
    );
  }

  if (vault.phase.kind === "keys-missing") {
    const { replacing } = vault.phase;
    return (
      <Card>
        <p className="eyebrow mt-8 !text-[11.5px]">Prima intrare · pasul 2 din 3</p>
        <h1 ref={headingRef} tabIndex={-1} className="display mt-3 text-[2.125rem] text-bone outline-none">
          {replacing ? "Cheile se refac" : "Sesiune deschisă. Cheile lipsesc."}
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-dim">
          {replacing
            ? "Cererea ta era în așteptare cu chei împachetate cu parola veche. Se generează altele, cu parola de acum; cererea rămâne în așteptare."
            : "Se generează acum perechea ta de chei. Dacă vault-ul e gol, îl inițializezi tu și primești codul de recuperare. Dacă există deja, cererea ta ajunge la un membru activ."}
        </p>
        <p className="mt-3 font-md-mono text-[12px] tracking-[0.06em] text-dim">
          {vault.member?.email}
        </p>

        <div aria-live="polite">{vault.error ? <Note tone="error">{vault.error}</Note> : null}</div>

        <PrimaryButton type="button" onClick={() => void vault.registerKeys()}>
          Generează cheile
        </PrimaryButton>
        <LockLink />
      </Card>
    );
  }

  if (vault.phase.kind === "recovery-code") {
    return (
      <Card wide>
        <p className="eyebrow mt-8 !text-[11.5px]">Vault inițializat · pasul 3 din 3</p>
        <h1 ref={headingRef} tabIndex={-1} className="display mt-3 text-[2.125rem] text-bone outline-none">
          Codul de recuperare
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-dim">
          Se afișează o singură dată. Notează-l pe hârtie, nu în captură de ecran: e singura
          cale înapoi dacă parola master se pierde. Se poate regenera oricând dintre membri.
        </p>
        <RecoveryCode
          code={vault.phase.code}
          onConfirm={vault.acknowledgeRecoveryCode}
          confirmLabel="Intră în vault"
        />
      </Card>
    );
  }

  // pending
  return (
    <Card>
      <p className="eyebrow mt-8 !text-[11.5px]">În așteptare · pasul 3 din 3</p>
      <h1 ref={headingRef} tabIndex={-1} className="display mt-3 text-[2.125rem] text-bone outline-none">
        Cererea a ajuns la echipă
      </h1>
      <p className="mt-3 text-[15px] leading-relaxed text-dim">
        Un membru activ trebuie să-ți aprobe accesul din lista de membri. Până atunci nu vezi
        nimic — nici măcar numele clienților. Poți lăsa fila deschisă și verifica din nou.
      </p>
      <p className="mt-3 font-md-mono text-[12px] tracking-[0.06em] text-dim">{vault.member?.email}</p>

      <div aria-live="polite">{vault.error ? <Note tone="error">{vault.error}</Note> : null}</div>

      <PrimaryButton type="button" onClick={() => void vault.recheckPending()}>
        Verifică din nou
      </PrimaryButton>
      <LockLink />
    </Card>
  );
}

function LockLink() {
  const vault = useVault();
  return (
    <button
      type="button"
      onClick={() => void vault.lock()}
      className="mt-5 text-[14px] text-dim underline-offset-4 transition-colors hover:text-bone hover:underline"
    >
      Blochează și ieși
    </button>
  );
}
