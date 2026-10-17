"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FocusEvent,
  type KeyboardEvent,
} from "react";
import { Wordmark } from "@/components/site/mark";
import { Icon } from "@/components/site/ui";
import { SOFTWARE_CONTACT } from "@/components/site/contact";
import { DASH, answersAsText, cleanAnswer } from "./registry";
import type { QuestionnaireConfig } from "./types";
import styles from "./questionnaire.module.css";

/* ============================================================
   CHESTIONAR DE DESCOPERIRE — o întrebare pe ecran, răspuns liber.

   Omul scrie la liniuță: câmpul începe cu „– ", iar fiecare Enter
   deschide un rând nou cu liniuță. Ctrl/⌘ + Enter trece la întrebarea
   următoare. Ce scrie rămâne în localStorage până trimite, ca o
   întrerupere să nu-l coste răspunsurile. Întrebarea marcată
   `atSubmit` nu are pas propriu: e câmpul liber de pe ecranul de
   trimitere, la fel la liniuță.

   Trimite la /api/chestionar, care salvează lead-ul și trimite
   răspunsurile complete pe email. Fără pixel de conversie: e un
   client cu care vorbim deja, nu un lead din reclamă.
   ============================================================ */

type Status = "idle" | "sending" | "error";

interface Draft {
  answers: Record<string, string>;
  step: number;
  name: string;
  email: string;
  sentAt: string | null;
}

const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("ro-RO", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function Questionnaire({ config }: { config: QuestionnaireConfig }) {
  const uid = useId();
  const steps = config.questions.filter((q) => !q.atSubmit);
  const closing = config.questions.find((q) => q.atSubmit) ?? null;
  const total = steps.length;
  const REVIEW = total + 1;
  const DONE = total + 2;
  const storageKey = `meridian:chestionar:${config.slug}`;

  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [name, setName] = useState(config.defaults.name);
  const [email, setEmail] = useState(config.defaults.email);
  const [website, setWebsite] = useState("");
  const [sentAt, setSentAt] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [copyNote, setCopyNote] = useState("");
  const [restored, setRestored] = useState(false);
  const [navigated, setNavigated] = useState(false);

  const fieldRef = useRef<HTMLTextAreaElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  /** Unde ajunge cursorul după ce am rescris valoarea unui câmp. */
  const caret = useRef<{ field: HTMLTextAreaElement; at: number } | null>(null);

  /* Ciorna se citește după montare, nu în render: serverul nu are
     localStorage, iar o stare diferită la hidratare ar strica pagina. */
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        const draft = JSON.parse(raw) as Partial<Draft>;
        if (draft.answers && typeof draft.answers === "object") {
          const clean: Record<string, string> = {};
          for (const question of config.questions) {
            const value = (draft.answers as Record<string, unknown>)[question.id];
            if (typeof value === "string") clean[question.id] = value;
          }
          setAnswers(clean);
        }
        if (typeof draft.name === "string") setName(draft.name);
        if (typeof draft.email === "string") setEmail(draft.email);
        if (typeof draft.sentAt === "string") setSentAt(draft.sentAt);
        if (typeof draft.step === "number" && draft.step >= 0 && draft.step <= DONE) {
          setStep(Math.floor(draft.step));
        }
      }
    } catch {
      /* Fără stocare (fereastră privată, date blocate): formularul merge
         la fel, doar că nu ține minte între vizite. */
    }
    setRestored(true);
  }, [storageKey, config.questions, DONE]);

  useEffect(() => {
    if (!restored) return;
    const timer = window.setTimeout(() => {
      try {
        const draft: Draft = { answers, step, name, email, sentAt };
        window.localStorage.setItem(storageKey, JSON.stringify(draft));
      } catch {
        /* vezi mai sus */
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [restored, answers, step, name, email, sentAt, storageKey]);

  /* La fiecare pas nou: sus pe pagină și focus pe ce urmează de făcut.
     Pe ecranele mari direct în câmp; pe telefon pe titlu, ca tastatura
     să nu acopere întrebarea înainte s-o citească. */
  useEffect(() => {
    if (!navigated) return;
    window.scrollTo({ top: 0 });
    const wide = window.matchMedia("(min-width: 768px)").matches;
    const target = wide && fieldRef.current ? fieldRef.current : headingRef.current;
    target?.focus({ preventScroll: true });
  }, [step, navigated]);

  useIsoLayoutEffect(() => {
    if (!caret.current) return;
    const { field, at } = caret.current;
    field.selectionStart = at;
    field.selectionEnd = at;
    caret.current = null;
  });

  const go = useCallback(
    (next: number) => {
      setNavigated(true);
      setStep(Math.max(0, Math.min(DONE, next)));
    },
    [DONE]
  );

  const question = step >= 1 && step <= total ? steps[step - 1] : null;
  const answered = steps.filter((q) => cleanAnswer(answers[q.id] ?? "") !== "");
  const closingAnswered = closing !== null && cleanAnswer(answers[closing.id] ?? "") !== "";

  function setAnswer(id: string, value: string) {
    setAnswers((current) => ({ ...current, [id]: value }));
  }

  /** Comportamentul „la liniuță", pentru orice câmp de răspuns. */
  function dashField(id: string, onAdvance?: () => void) {
    return {
      value: answers[id] ?? "",
      onChange: (event: ChangeEvent<HTMLTextAreaElement>) => setAnswer(id, event.target.value),
      onFocus: (event: FocusEvent<HTMLTextAreaElement>) => {
        if (!answers[id]) {
          caret.current = { field: event.currentTarget, at: DASH.length };
          setAnswer(id, DASH);
        }
      },
      onBlur: () => {
        if (cleanAnswer(answers[id] ?? "") === "") setAnswer(id, "");
      },
      onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => {
        if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
        if (event.ctrlKey || event.metaKey) {
          if (!onAdvance) return;
          event.preventDefault();
          onAdvance();
          return;
        }
        if (event.shiftKey || event.altKey) return;
        event.preventDefault();
        const field = event.currentTarget;
        const { selectionStart, selectionEnd, value } = field;
        const insert = `\n${DASH}`;
        caret.current = { field, at: selectionStart + insert.length };
        setAnswer(id, value.slice(0, selectionStart) + insert + value.slice(selectionEnd));
      },
    };
  }

  async function submit() {
    if (status === "sending") return;
    setCopyNote("");
    if (name.trim().length < 2) {
      setStatus("error");
      setError("Scrieți-vă numele, ca să știm de la cine sunt răspunsurile.");
      return;
    }
    if (email.trim() && !EMAIL_PATTERN.test(email.trim())) {
      setStatus("error");
      setError("Adresa de e-mail nu pare completă. Verificați-o sau lăsați câmpul gol.");
      return;
    }
    if (answered.length === 0 && !closingAnswered) {
      setStatus("error");
      setError("Nu ați răspuns încă la nicio întrebare. Începeți cu prima, e suficientă.");
      return;
    }

    setStatus("sending");
    setError("");
    let response: Response;
    try {
      response = await fetch("/api/chestionar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: config.slug,
          name: name.trim(),
          email: email.trim(),
          answers,
          website,
        }),
      });
    } catch {
      setStatus("error");
      setError(
        "Conexiunea a căzut înainte să ajungă răspunsurile. Încercați din nou; nu se pierde nimic din ce ați scris."
      );
      return;
    }

    if (response.ok) {
      setStatus("idle");
      setSentAt(new Date().toISOString());
      go(DONE);
      return;
    }

    setStatus("error");
    setError(
      response.status === 429
        ? "Au plecat deja câteva trimiteri în ultimele minute. Mai încercați peste puțin timp."
        : `Nu am putut trimite răspunsurile. Încercați din nou peste câteva minute sau copiați-le și trimiteți-le la ${SOFTWARE_CONTACT.email}.`
    );
  }

  async function copyAnswers() {
    const text = answersAsText(config, answers);
    try {
      await navigator.clipboard.writeText(text);
      setCopyNote("Răspunsurile au fost copiate. Le puteți lipi într-un e-mail.");
    } catch {
      setCopyNote(`Copierea nu a mers în acest browser. Scrieți-ne la ${SOFTWARE_CONTACT.email}.`);
    }
  }

  /* ---------- bara de sus ---------- */
  const counter =
    step === 0
      ? `${total} întrebări`
      : step <= total
        ? `${pad(step)} / ${pad(total)}`
        : step === REVIEW
          ? "Verificare"
          : "Trimis";

  const header = (
    <header className="sticky top-0 z-30 border-b border-hair bg-ink/90 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-5 pt-4 sm:px-8">
        <Wordmark size={22} className="text-bone" />
        <span className="eyebrow min-w-0 truncate">
          <span className="hidden sm:inline">Chestionar · </span>
          {config.subject}
        </span>
      </div>
      <div className="mx-auto flex w-full max-w-3xl items-end gap-4 px-5 pb-3 pt-3 sm:px-8">
        <nav aria-label="Întrebările" className={`${styles.ticks} min-w-0 flex-1`}>
          {steps.map((q, index) => {
            const done = cleanAnswer(answers[q.id] ?? "") !== "";
            const current = step === index + 1;
            return (
              <button
                key={q.id}
                type="button"
                className={styles.tick}
                data-state={current ? "current" : done ? "done" : "todo"}
                aria-current={current ? "step" : undefined}
                aria-label={`Întrebarea ${index + 1}${done ? ", cu răspuns" : ""}: ${q.title}`}
                onClick={() => go(index + 1)}
              >
                <span aria-hidden />
              </button>
            );
          })}
        </nav>
        <span className="shrink-0 font-md-mono text-[12px] tabular-nums text-dim">{counter}</span>
      </div>
    </header>
  );

  /* ---------- pașii ---------- */
  let body: React.ReactNode = null;

  if (step === 0) {
    body = (
      <section aria-labelledby={`${uid}-h`} className={styles.step} key="intro">
        <p className="eyebrow">Pentru {config.clientName}</p>
        <h1
          id={`${uid}-h`}
          ref={headingRef}
          tabIndex={-1}
          className="display mt-5 text-[clamp(2.3rem,7vw,3.6rem)] outline-none"
        >
          Bună ziua, {config.salutation}.
        </h1>
        <p className="mt-6 max-w-[60ch] text-[18px] leading-relaxed text-dim">{config.intro}</p>

        <dl className="mt-10 divide-y divide-hair border-y border-hair">
          {[
            [`${total} întrebări`, "Fiecare pe ecranul ei. Puteți sări peste oricare."],
            ["La liniuță", "Fiecare Enter începe un rând nou, cu liniuță. Scrieți tot ce vă trece prin minte."],
            ["Nu se pierde", "Ce scrieți rămâne salvat în acest browser până trimiteți."],
          ].map(([label, text]) => (
            <div key={label} className="grid gap-1 py-4 sm:grid-cols-[11rem_1fr] sm:gap-6">
              <dt className="font-md-mono text-[12px] uppercase tracking-[0.18em] text-a1">{label}</dt>
              <dd className="text-[15.5px] leading-relaxed text-bone">{text}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-10">
          <button type="button" className="btn btn-primary" onClick={() => go(1)}>
            {answered.length > 0 ? "Continuați de unde ați rămas" : "Începeți"}
            <Icon name="arrowRight" size={18} className="arw" />
          </button>
        </div>
      </section>
    );
  } else if (question) {
    const hintId = question.hint ? `${uid}-hint` : undefined;
    body = (
      <section aria-labelledby={`${uid}-q`} className={styles.step} key={question.id}>
        <p className="eyebrow">
          Întrebarea {pad(step)} din {pad(total)} · {question.section}
        </p>
        <h2
          id={`${uid}-q`}
          ref={headingRef}
          tabIndex={-1}
          className="display mt-5 text-[clamp(1.6rem,4.4vw,2.45rem)] outline-none"
          style={{ lineHeight: 1.12 }}
        >
          {question.title}
        </h2>
        {question.hint && (
          <p id={hintId} className="mt-4 max-w-[60ch] text-[16px] leading-relaxed text-dim">
            {question.hint}
          </p>
        )}

        <textarea
          id={`${uid}-a-${question.id}`}
          ref={fieldRef}
          aria-labelledby={`${uid}-q`}
          aria-describedby={hintId}
          {...dashField(question.id, () => go(step + 1))}
          rows={9}
          maxLength={12000}
          placeholder={`${DASH}scrieți aici`}
          className="mt-8 block min-h-60 w-full resize-y rounded-panel border border-hair-strong bg-char px-4 py-3.5 text-[17px] leading-[1.65] text-bone outline-none transition-colors duration-200 placeholder:text-dim focus:border-a1"
        />
        <p className="mt-3 hidden font-md-mono text-[11.5px] text-dim md:block">
          Enter: rând nou cu liniuță · Shift + Enter: rând nou fără liniuță · Ctrl + Enter: mai departe
        </p>

        <div className="mt-8 flex items-center justify-between gap-3">
          <button type="button" className="btn btn-ghost" onClick={() => go(step - 1)}>
            Înapoi
          </button>
          <button type="button" className="btn btn-primary" onClick={() => go(step + 1)}>
            {step === total ? "Verificați răspunsurile" : "Continuați"}
            <Icon name="arrowRight" size={18} className="arw" />
          </button>
        </div>
      </section>
    );
  } else if (step === REVIEW) {
    body = (
      <section aria-labelledby={`${uid}-r`} className={styles.step} key="review">
        <p className="eyebrow">Ultimul pas</p>
        <h2
          id={`${uid}-r`}
          ref={headingRef}
          tabIndex={-1}
          className="display mt-5 text-[clamp(1.9rem,5vw,2.8rem)] outline-none"
        >
          Verificați și trimiteți
        </h2>
        <p className="mt-4 max-w-[60ch] text-[16.5px] leading-relaxed text-dim">
          {answered.length} din {total} întrebări au răspuns. Puteți modifica oricare înainte să trimiteți.
          {sentAt && ` Ați trimis deja o variantă pe ${formatDate(sentAt)}; dacă o trimiteți din nou, o primim pe cea nouă.`}
        </p>

        <ol className="mt-8 divide-y divide-hair border-y border-hair">
          {steps.map((q, index) => {
            const answer = cleanAnswer(answers[q.id] ?? "");
            return (
              <li key={q.id} className="flex items-start gap-4 py-5">
                <span className="w-7 shrink-0 pt-0.5 font-md-mono text-[12px] tabular-nums text-dim">
                  {pad(index + 1)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-medium leading-snug text-bone">{q.title}</p>
                  {answer ? (
                    <p className="mt-2 whitespace-pre-wrap break-words text-[15px] leading-relaxed text-dim">
                      {answer}
                    </p>
                  ) : (
                    <p className="mt-2 text-[14px] text-dim">Fără răspuns</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => go(index + 1)}
                  className="shrink-0 rounded-panel-sm px-2 py-1 text-[13.5px] font-medium text-a1 underline-offset-4 hover:underline"
                  aria-label={`Modificați răspunsul la întrebarea ${index + 1}`}
                >
                  Modificați
                </button>
              </li>
            );
          })}
        </ol>

        {closing && (
          <div className="mt-10">
            <label
              htmlFor={`${uid}-a-${closing.id}`}
              className="block text-[17px] font-medium leading-snug text-bone"
            >
              {closing.title}
            </label>
            {closing.hint && (
              <p id={`${uid}-closing-hint`} className="mt-2 max-w-[60ch] text-[14.5px] leading-relaxed text-dim">
                {closing.hint}
              </p>
            )}
            <textarea
              id={`${uid}-a-${closing.id}`}
              aria-describedby={closing.hint ? `${uid}-closing-hint` : undefined}
              {...dashField(closing.id)}
              rows={5}
              maxLength={12000}
              placeholder={`${DASH}scrieți aici`}
              className="mt-4 block min-h-36 w-full resize-y rounded-panel border border-hair-strong bg-char px-4 py-3.5 text-[16px] leading-[1.65] text-bone outline-none transition-colors duration-200 placeholder:text-dim focus:border-a1"
            />
          </div>
        )}

        <div className="mt-10 grid gap-5 sm:grid-cols-2">
          <label className="grid gap-2">
            <span className="text-[13.5px] font-medium text-dim">Numele dumneavoastră</span>
            <input
              id={`${uid}-name`}
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoComplete="name"
              maxLength={120}
              className="rounded-panel border border-hair-strong bg-char px-3.5 py-3 text-[15px] text-bone outline-none transition-colors duration-200 placeholder:text-dim focus:border-a1"
            />
          </label>
          <label className="grid gap-2">
            <span className="text-[13.5px] font-medium text-dim">E-mail, ca să vă răspundem</span>
            <input
              id={`${uid}-email`}
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              maxLength={254}
              className="rounded-panel border border-hair-strong bg-char px-3.5 py-3 text-[15px] text-bone outline-none transition-colors duration-200 placeholder:text-dim focus:border-a1"
            />
          </label>
        </div>

        <div className="hp-field" aria-hidden>
          <label htmlFor={`${uid}-website`}>Site web</label>
          <input
            id={`${uid}-website`}
            name="website"
            tabIndex={-1}
            autoComplete="off"
            value={website}
            onChange={(event) => setWebsite(event.target.value)}
          />
        </div>

        <div role="status" aria-live="polite" className="mt-6 empty:hidden">
          {status === "error" && error && (
            <p className="rounded-panel-sm border border-a2/50 bg-glass px-3.5 py-3 text-[14px] leading-relaxed text-bone">
              {error}
            </p>
          )}
          {copyNote && <p className="mt-3 text-[14px] text-dim">{copyNote}</p>}
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
          <button type="button" className="btn btn-ghost" onClick={() => go(total)}>
            Înapoi
          </button>
          <div className="flex flex-wrap items-center gap-3">
            {status === "error" && (
              <button type="button" className="btn btn-ghost" onClick={copyAnswers}>
                Copiați răspunsurile
              </button>
            )}
            <button
              type="button"
              className="btn btn-primary"
              onClick={submit}
              aria-busy={status === "sending"}
            >
              {status === "sending" ? "Se trimit…" : "Trimiteți răspunsurile"}
              {status !== "sending" && <Icon name="arrowRight" size={18} className="arw" />}
            </button>
          </div>
        </div>
      </section>
    );
  } else {
    body = (
      <section aria-labelledby={`${uid}-d`} className={styles.step} key="done">
        <p className="eyebrow">
          {/* `.eyebrow` e CSS nelayerizat și își impune culoarea; accentul
              stă pe un span din interior, unde utilitarul ajunge. */}
          <span className="inline-flex items-center gap-2 text-a1">
            <Icon name="check" size={16} />
            Răspunsuri trimise
          </span>
        </p>
        <h2
          id={`${uid}-d`}
          ref={headingRef}
          tabIndex={-1}
          className="display mt-5 text-[clamp(2.1rem,6vw,3.2rem)] outline-none"
        >
          Mulțumim, {config.salutation}.
        </h2>
        <p className="mt-6 max-w-[58ch] text-[18px] leading-relaxed text-dim">
          Le citim cu atenție și revenim cu propunerea. Dacă vă mai vine ceva în minte, puteți modifica
          răspunsurile și le trimiteți din nou.
        </p>
        <div className="mt-10 flex flex-wrap items-center gap-4">
          <button type="button" className="btn btn-ghost" onClick={() => go(REVIEW)}>
            Modificați răspunsurile
          </button>
          <p className="text-[14.5px] text-dim">
            Ne găsiți și la{" "}
            <a href={`mailto:${SOFTWARE_CONTACT.email}`} className="text-a1 underline-offset-4 hover:underline">
              {SOFTWARE_CONTACT.email}
            </a>{" "}
            sau la{" "}
            <a href={SOFTWARE_CONTACT.phoneHref} className="text-a1 underline-offset-4 hover:underline">
              {SOFTWARE_CONTACT.phone}
            </a>
            .
          </p>
        </div>
      </section>
    );
  }

  return (
    <div data-scope="software" className="md-root min-h-dvh">
      {header}
      <main className="mx-auto w-full max-w-3xl px-5 pb-24 pt-10 sm:px-8 sm:pt-16">
        <div className="cfg-panel p-6 sm:p-10">{body}</div>
      </main>
      <p className="sr-only" aria-live="polite">
        {question ? `Întrebarea ${step} din ${total}` : ""}
      </p>
    </div>
  );
}
