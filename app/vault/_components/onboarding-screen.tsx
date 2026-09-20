"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useVault } from "./vault-provider";
import { BusyPanel } from "./unlock-screen";
import { Card, FIELD, Note, PrimaryButton } from "./ui";
import { RecoveryCode } from "./recovery-code";

/**
 * Ecranele dintre sesiune și vault (feat/vault, fazele 2 și 7):
 *
 * - keys-missing   — cont autentificat, fără chei: le generează acum;
 *                    serverul decide dacă e fondator sau solicitant.
 * - recovery-code  — a fost fondator: codul, o singură dată.
 * - pending        — a fost solicitant: așteaptă aprobarea.
 * - recovery       — membru activ cu chei sub parola veche: codul de recuperare.
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

  if (vault.phase.kind === "recovery") {
    return <RecoveryScreen headingRef={headingRef} />;
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

/**
 * Recuperarea cu codul (faza 7). Omul a activat contul cu o parolă
 * temporară (primită de la echipă după ce a pierdut parola master) și
 * și-a ales o parolă master nouă — dar cheile lui din vault sunt
 * împachetate cu cea veche. Codul de pe hârtie deschide DEK-ul din
 * `vault_meta`; cu KEK-ul parolei noi (încă în memorie) se refac cheile.
 *
 * Câmpul acceptă orice formă: cu sau fără liniuțe, litere mici, I/L/O
 * confundate — `recoveryKeyFromCode` canonicalizează. Forma greșită se
 * spune imediat; codul greșit abia după ce serverul a dat blob-ul.
 */
function RecoveryScreen({ headingRef }: { headingRef: React.RefObject<HTMLHeadingElement | null> }) {
  const vault = useVault();
  const [code, setCode] = useState("");
  const [noCode, setNoCode] = useState(false);
  const id = useId();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!code.trim()) return;
    void vault.recoverWithCode(code);
  }

  return (
    <Card wide>
      <p className="eyebrow mt-8 !text-[11.5px]">Recuperare · codul de pe hârtie</p>
      <h1 ref={headingRef} tabIndex={-1} className="display mt-3 text-[2.125rem] text-bone outline-none">
        Cheile nu se deschid cu parola asta
      </h1>
      <p className="mt-3 text-[15px] leading-relaxed text-dim">
        Parola master pe care tocmai ai ales-o e nouă, dar cheile tale din vault sunt împachetate
        cu cea veche. Codul de recuperare deschide vault-ul și îți reface cheile cu parola de acum.
        Datele nu se ating.
      </p>
      <p className="mt-3 font-md-mono text-[12px] tracking-[0.06em] text-dim">{vault.member?.email}</p>

      <div aria-live="polite">{vault.error ? <Note tone="error">{vault.error}</Note> : null}</div>

      <form onSubmit={onSubmit} className="mt-6" noValidate>
        <label htmlFor={id} className="eyebrow !text-[11.5px]">
          Codul de recuperare
        </label>
        <input
          id={id}
          type="text"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          placeholder="XXXXX-XXXXX-XXXXX-XXXXX-XXXXX-XXXXX-XXXXX-XXXXX"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          className={`${FIELD} mt-2 h-12 font-md-mono !text-[14px] tracking-[0.08em]`}
        />
        <p className="mt-2 text-[13px] leading-relaxed text-dim">
          8 grupuri de 5. Liniuțele, spațiile și literele mici nu contează.
        </p>
        <PrimaryButton disabled={!code.trim()}>Recuperează accesul</PrimaryButton>
      </form>

      <div className="flex flex-wrap items-baseline gap-x-5">
        <button
          type="button"
          onClick={() => setNoCode((value) => !value)}
          aria-expanded={noCode}
          className="mt-5 text-[14px] text-dim underline-offset-4 transition-colors hover:text-bone hover:underline"
        >
          {noCode ? "Ascunde" : "N-am codul"}
        </button>
        <LockLink />
      </div>
      {noCode ? (
        <p className="mt-3 rounded-panel-sm border-l-[3px] border-bone/70 bg-bone/[0.06] px-3.5 py-2.5 text-[14px] leading-relaxed text-bone">
          Fără cod, contul ăsta nu mai poate deschide vault-ul. Un membru activ te elimină din
          Membri și te reinvită — primești chei noi și vezi din nou tot. Dacă erai singurul membru
          activ, vault-ul rămâne închis: exact de asta codul se notează pe hârtie.
        </p>
      ) : null}
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
