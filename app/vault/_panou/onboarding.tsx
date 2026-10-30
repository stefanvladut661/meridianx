"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Clock, KeyRound, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { Btn, Card, Pill } from "@/components/panou/ui/primitives";
import { InlineNote } from "@/components/panou/ui/actions";
import { TextInput } from "@/components/panou/ui/select";
import { useVault } from "../_components/vault-provider";
import { RecoveryCodeBox, RecoveryWarning } from "./recovery-code";
import { argonDetail, STEP_LABEL } from "./unlock";
import { BusyBlock, LABEL_CLASS, LabeledInput } from "./ui";

/**
 * Cele două drumuri care nu sunt „deschide seiful”: ACTIVAREA (prima intrare:
 * parolă temporară → parolă master → chei → cod de recuperare sau așteptare) și
 * RECUPERAREA (cheile nu se deschid cu parola de acum → codul de pe hârtie).
 * Markup-ul e al paginilor ActivatePage și RecoverPage din prototip; pașii sunt
 * cei reali ai mașinii de stări din provider. Numerotarea e legitimă aici: chiar
 * e o secvență.
 */

const MIN_MASTER_LENGTH = 12;

function PageIntro({ title, text, back }: { title: string; text: string; back: boolean }) {
  return (
    <div>
      {back ? (
        <Link href="/vault" className="text-[11.5px] text-muted-foreground hover:text-foreground">
          ← Vault
        </Link>
      ) : null}
      <h1 className={cn("text-[22px] font-semibold leading-none sm:text-[26px]", back && "mt-2")}>{title}</h1>
      <p className="mt-2 text-[12.5px] leading-relaxed text-muted-foreground">{text}</p>
    </div>
  );
}

/** Butonul „Blochează și ieși” de pe ecranele cu sesiune deschisă, dar fără seif deschis încă. */
function LeaveButton() {
  const { lock } = useVault();
  return (
    <Btn size="sm" variant="ghost" onClick={() => void lock()}>
      Blochează și ieși
    </Btn>
  );
}

// ---------------------------------------------------------------------------
// Activarea
// ---------------------------------------------------------------------------

export function ActivateFlow() {
  const vault = useVault();
  const { phase } = vault;
  // Emailul rămâne la ActivateFlow: dacă pasul eșuează, formularul se reface, dar adresa nu se retastează.
  const [email, setEmail] = useState("");

  // Pasul curent în secvența de 3: parola master → cheile → codul (sau aprobarea).
  let step = 0;
  if (phase.kind === "keys-missing") step = 1;
  else if (phase.kind === "recovery-code" || phase.kind === "pending") step = 2;
  else if (phase.kind === "busy" && (phase.step === "registering" || phase.from === "onboarding")) step = phase.step === "registering" ? 1 : 2;
  const labels = ["Parola master", "Cheile", phase.kind === "pending" ? "Aprobare" : "Codul de recuperare"];

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <PageIntro
        title="Activează seiful"
        text="Prima intrare. Alegi parola master, apoi primești codul de recuperare o singură dată (sau aprobarea unui membru, dacă seiful există deja)."
        back={phase.kind === "locked"}
      />

      <ol className="flex flex-wrap gap-1.5" aria-label="Pașii activării">
        {labels.map((label, i) => (
          <li
            key={label}
            aria-current={i === step ? "step" : undefined}
            className="flex items-center gap-1.5 rounded-full border border-white/[0.07] px-2.5 py-1 text-[11.5px] text-muted-foreground"
          >
            <span className={cn("pu-num flex h-4 w-4 items-center justify-center rounded-full text-[9px]", i === step ? "bg-lav text-[#171222]" : "bg-white/[0.08]")}>{i < step ? "✓" : i + 1}</span>
            {label}
          </li>
        ))}
      </ol>

      {phase.kind === "busy" ? (
        <Card className="pu-sealed">
          <BusyBlock label={STEP_LABEL[phase.step]} detail={phase.step === "deriving" ? argonDetail : undefined} startedAt={phase.startedAt} />
        </Card>
      ) : phase.kind === "keys-missing" ? (
        <KeysMissingCard replacing={phase.replacing} />
      ) : phase.kind === "recovery-code" ? (
        <RecoveryCodeCard code={phase.code} />
      ) : phase.kind === "pending" ? (
        <PendingCard />
      ) : (
        <ActivateForm email={email} onEmail={setEmail} />
      )}
    </div>
  );
}

function ActivateForm({ email, onEmail }: { email: string; onEmail: (value: string) => void }) {
  const vault = useVault();
  const [temp, setTemp] = useState("");
  const [pass, setPass] = useState("");
  const [confirm, setConfirm] = useState("");

  const canContinue = email.trim().length > 0 && temp.length > 0 && pass.length >= MIN_MASTER_LENGTH && pass === confirm;

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canContinue) return;
    void vault.activate(email.trim(), temp, pass);
  }

  return (
    <Card className="pu-sealed">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-mint" aria-hidden="true" />
        <p className="text-[13px] font-medium">Parola master nu se poate reseta</p>
      </div>
      <InlineNote tone="rose" className="mt-3">
        Dacă o uiți și pierzi și codul de recuperare, datele din seif nu mai pot fi deschise de nimeni. Nici noi nu le putem recupera.
      </InlineNote>
      <div aria-live="polite">
        {vault.notice ? <InlineNote tone="neutral" className="mt-3">{vault.notice}</InlineNote> : null}
        {vault.error ? <InlineNote tone="rose" className="mt-3">{vault.error}</InlineNote> : null}
      </div>
      <form onSubmit={onSubmit} noValidate className="mt-3 space-y-3">
        <LabeledInput label="Email" type="email" value={email} onChange={(event) => onEmail(event.target.value)} autoComplete="username" spellCheck={false} mono={false} placeholder="numele@firma.ro" />
        <LabeledInput
          label="Parola temporară (primită de la echipă)"
          type="password"
          value={temp}
          onChange={(event) => setTemp(event.target.value)}
          autoComplete="current-password"
          hint="Contul îl creează echipa din Supabase → Authentication → Users. Parola asta se înlocuiește acum."
        />
        <LabeledInput
          label={`Parolă master (min. ${MIN_MASTER_LENGTH} caractere)`}
          type="password"
          value={pass}
          onChange={(event) => setPass(event.target.value)}
          autoComplete="new-password"
          hint={pass.length >= MIN_MASTER_LENGTH ? "lungime bună" : `${pass.length} / ${MIN_MASTER_LENGTH} caractere`}
        />
        <LabeledInput
          label="Repetă parola"
          type="password"
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          autoComplete="new-password"
          error={confirm && pass !== confirm ? "parolele nu se potrivesc" : null}
        />
        <p className="text-[10.5px] leading-relaxed text-muted-foreground">
          Contul devine dedicat seifului: după activare intră doar prin parola master. Dacă aceeași adresă intră și în /admin, folosește altă adresă aici.
        </p>
        <Btn type="submit" variant="primary" className="w-full justify-center" disabled={!canContinue} icon={KeyRound}>
          Activează contul
        </Btn>
      </form>
    </Card>
  );
}

function KeysMissingCard({ replacing }: { replacing: boolean }) {
  const vault = useVault();
  return (
    <Card className="pu-sealed">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] font-medium">{replacing ? "Cheile se refac" : "Sesiune deschisă. Cheile lipsesc."}</p>
        <Pill tone="neutral" className="font-mono text-[10px]">
          {vault.member?.email}
        </Pill>
      </div>
      <p className="mt-2 text-[12.5px] leading-relaxed text-muted-foreground">
        {replacing
          ? "Cererea ta era în așteptare cu chei împachetate cu parola veche. Se generează altele, cu parola de acum; cererea rămâne în așteptare."
          : "Se generează acum perechea ta de chei. Dacă seiful e gol, îl inițializezi tu și primești codul de recuperare. Dacă există deja, cererea ta ajunge la un membru activ."}
      </p>
      <div aria-live="polite">{vault.error ? <InlineNote tone="rose" className="mt-3">{vault.error}</InlineNote> : null}</div>
      <Btn variant="primary" className="mt-4 w-full justify-center" icon={KeyRound} onClick={() => void vault.registerKeys()}>
        Generează cheile
      </Btn>
      <div className="mt-2">
        <LeaveButton />
      </div>
    </Card>
  );
}

function RecoveryCodeCard({ code }: { code: string }) {
  const vault = useVault();
  const [saved, setSaved] = useState(false);
  return (
    <Card className="pu-sealed">
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-medium">Codul tău de recuperare</p>
        <Pill tone="apricot">o singură afișare</Pill>
      </div>
      <p className="mt-1 text-[11.5px] text-muted-foreground">Seiful a fost inițializat. Notează codul pe hârtie, nu într-o captură de ecran: e singura cale înapoi dacă parola master se pierde.</p>
      <div className="mt-3">
        <RecoveryCodeBox code={code} />
      </div>
      <RecoveryWarning />
      <label className="mt-3 flex items-start gap-2 text-[11.5px] text-muted-foreground">
        <input type="checkbox" checked={saved} onChange={(event) => setSaved(event.target.checked)} className="mt-0.5 accent-[#8FE3B0]" />
        L-am salvat într-un loc sigur, în afara seifului. Știu că nu se mai afișează.
      </label>
      <Btn variant="primary" className="mt-3 w-full justify-center" icon={CheckCircle2} disabled={!saved} onClick={() => vault.acknowledgeRecoveryCode()}>
        Intră în seif
      </Btn>
    </Card>
  );
}

function PendingCard() {
  const vault = useVault();
  return (
    <Card className="pu-sealed">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-apricot" aria-hidden="true" />
          <p className="text-[14px] font-medium">În așteptare</p>
        </div>
        <Pill tone="apricot" dot>
          cererea a ajuns la echipă
        </Pill>
      </div>
      <p className="mt-2 text-[12.5px] leading-relaxed text-muted-foreground">
        Un membru activ trebuie să-ți aprobe accesul din lista de membri, ca să primești cheia. Nu se întâmplă automat. Până atunci nu vezi nimic, nici măcar numele clienților. Poți lăsa fila deschisă și verifica din nou.
      </p>
      <p className="mt-2 font-mono text-[11px] text-muted-foreground">{vault.member?.email}</p>
      <div aria-live="polite">{vault.error ? <InlineNote tone="rose" className="mt-3">{vault.error}</InlineNote> : null}</div>
      <div className="mt-3 flex flex-wrap justify-between gap-2">
        <LeaveButton />
        <Btn size="sm" variant="outline" onClick={() => void vault.recheckPending()}>
          Verifică din nou
        </Btn>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Recuperarea
// ---------------------------------------------------------------------------

export function RecoverFlow() {
  const vault = useVault();
  const { phase } = vault;
  const entering = phase.kind === "recovery" || (phase.kind === "busy" && (phase.step === "recovering" || phase.step === "rekeying"));

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <PageIntro title="Recuperare" text="Cu codul de recuperare, fără parola master." back={phase.kind === "locked"} />
      {entering ? <CodeEntry /> : <RecoverSteps />}
    </div>
  );
}

/** Seiful e încuiat și parola s-a pierdut: calea reală, în trei pași (aici numerotarea e o secvență adevărată). */
function RecoverSteps() {
  const items: { title: ReactNode; text: ReactNode }[] = [
    {
      title: "Ceri o parolă temporară",
      text: "Cineva din echipă îți setează o parolă temporară din Supabase → Authentication → Users. Nimeni nu poate vedea sau reseta parola master veche.",
    },
    { title: "Activezi contul cu ea", text: "Alegi o parolă master nouă. Cheile tale din seif sunt încă împachetate cu cea veche, așa că seiful îți cere codul." },
    { title: "Introduci codul de recuperare", text: "Codul de pe hârtie deschide cheia de date și îți reface cheile cu parola nouă. Datele nu se ating." },
  ];
  return (
    <Card className="pu-sealed">
      <div className="flex items-center gap-2">
        <KeyRound className="h-4 w-4 text-mint" aria-hidden="true" />
        <p className="text-[13px] font-medium">Ai pierdut parola master?</p>
      </div>
      <ol className="mt-3 space-y-3">
        {items.map((item, index) => (
          <li key={index} className="flex gap-3">
            <span className="pu-num mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-[10px]">{index + 1}</span>
            <div>
              <p className="text-[12.5px] font-medium">{item.title}</p>
              <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted-foreground">{item.text}</p>
            </div>
          </li>
        ))}
      </ol>
      <InlineNote tone="neutral" className="mt-4">
        Fără codul de pe hârtie nu se poate: un membru activ te elimină din Membri și te reinvită, iar primești chei noi.
      </InlineNote>
      <Link href="/vault/activare" className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-lav px-4 text-[13.5px] font-medium text-[#171222] transition-colors hover:bg-[#D4C7FF]">
        <KeyRound className="h-4 w-4" aria-hidden="true" />
        Activează cu parola temporară
      </Link>
    </Card>
  );
}

/** Pasul 3 al recuperării: codul. Forma greșită se spune imediat; codul greșit abia după ce serverul a dat blob-ul. */
function CodeEntry() {
  const vault = useVault();
  const [code, setCode] = useState("");
  const [missing, setMissing] = useState(false);
  const { phase } = vault;

  if (phase.kind === "busy") {
    return (
      <Card className="pu-sealed">
        <BusyBlock label={STEP_LABEL[phase.step]} startedAt={phase.startedAt} />
      </Card>
    );
  }

  if (missing) {
    return (
      <Card className="pu-sealed">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-rose" aria-hidden="true" />
          <p className="text-[14px] font-medium">Cheile lipsesc</p>
        </div>
        <p className="mt-2 text-[12.5px] leading-relaxed text-muted-foreground">
          Fără codul de recuperare, cheile tale nu se mai pot deschide: sunt împachetate cu parola veche. Datele rămân criptate pe server, dar contul ăsta nu le mai poate citi.
        </p>
        <div className="mt-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
          <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Ce poți face</p>
          <ul className="mt-1.5 space-y-1.5 text-[12px] text-foreground/80">
            <li className="flex items-start gap-1.5">
              <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-mint" aria-hidden="true" /> Un membru activ te elimină din Membri și te reinvită: primești chei noi și vezi din nou tot.
            </li>
            <li className="flex items-start gap-1.5">
              <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-mint" aria-hidden="true" /> Dacă erai singurul membru activ, seiful rămâne închis. Exact de asta codul se notează pe hârtie.
            </li>
          </ul>
        </div>
        <div className="mt-3 flex flex-wrap justify-between gap-2">
          <Btn size="sm" variant="ghost" onClick={() => setMissing(false)}>
            Înapoi la cod
          </Btn>
          <LeaveButton />
        </div>
      </Card>
    );
  }

  return (
    <Card className="pu-sealed">
      <p className="text-[13px] font-medium">Cheile nu se deschid cu parola asta</p>
      <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">
        Parola master pe care tocmai ai ales-o e nouă, dar cheile tale din seif sunt împachetate cu cea veche. Codul de recuperare deschide seiful și îți reface cheile cu parola de acum. Datele nu se ating.
      </p>
      <p className="mt-2 font-mono text-[11px] text-muted-foreground">{vault.member?.email}</p>
      <div aria-live="polite">{vault.error ? <InlineNote tone="rose" className="mt-3">{vault.error}</InlineNote> : null}</div>
      <form
        className="mt-3"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (code.trim()) void vault.recoverWithCode(code);
        }}
      >
        <label htmlFor="cod-recuperare" className={LABEL_CLASS}>
          Cod de recuperare
        </label>
        <TextInput
          id="cod-recuperare"
          className="mt-1.5 font-mono tracking-[0.1em]"
          placeholder="XXXXX-XXXXX-XXXXX-XXXXX-XXXXX-XXXXX-XXXXX-XXXXX"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          autoFocus
        />
        <p className="mt-1.5 text-[10.5px] text-muted-foreground">8 grupuri de 5. Liniuțele, spațiile și literele mici nu contează.</p>
        <Btn type="submit" variant="primary" className="mt-4 w-full justify-center" icon={KeyRound} disabled={code.trim().length < 8}>
          Recuperează accesul
        </Btn>
      </form>
      <InlineNote tone="neutral" className="mt-3">
        Codul deschide cheia de date singur, fără parola veche: de asta se ține pe hârtie, offline. Cheile tale se refac cu parola master de acum.
      </InlineNote>
      <div className="mt-4 flex flex-wrap justify-between gap-2 border-t border-white/[0.07] pt-3 text-[11.5px]">
        <button type="button" onClick={() => setMissing(true)} className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
          Nu am codul
        </button>
        <button type="button" onClick={() => void vault.lock()} className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
          Blochează și ieși
        </button>
      </div>
    </Card>
  );
}
