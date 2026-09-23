"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { EXAMPLE_PLAN } from "@/lib/ads/example-plan";
import { OBJECTIVE_LABEL, PLATFORM_LABEL, type Platform } from "@/lib/ads/constants";
import { parsePlanText, replaceSmartQuotes, type PlanTextResult } from "@/lib/ads/plan-json";
import { setIn } from "@/lib/ads/plan-path";
import { countOf } from "@/lib/ads/plan-derive";
import { joinRo, summarizePlan, type PlanSummary } from "@/lib/ads/plan-summary";
import { validatePlan, type PlanProblem } from "@/lib/ads/plan-validate";
import type { WorkspaceSummary } from "@/lib/ads/workspaces";
import { cn } from "@/lib/utils";
import { AdsPreview } from "./ads-preview";
import { PlanFormProvider, fieldId, groupByPath } from "./fields";
import { PauseSeal } from "./pause-seal";
import { PlanForm } from "./plan-form";
import { ERROR_DOT, ERROR_TEXT, FIELD, OK_TEXT, WARNING_DOT, WARNING_TEXT } from "./tone";

/**
 * /admin/ads/nou — planul lipit, citit în română, corectat pe loc.
 *
 * Două surse ale aceluiași adevăr: textul JSON (stânga) și planul citit din
 * el (dreapta). Lipești → planul se citește singur, după o pauză scurtă.
 * Corectezi în dreapta → JSON-ul se rescrie din plan, gata de copiat
 * înapoi în conversația din care a venit. Comentariile din JSON nu
 * supraviețuiesc rescrierii, și interfața spune asta.
 *
 * FAZA 1: nimic de aici nu vorbește cu o platformă. Butonul de creare
 * există, dezactivat, cu motivul scris lângă el.
 */

const STORAGE_KEY = "meridian_ads_plan";
const PARSE_DELAY = 200;

type SyntaxProblem = Extract<PlanTextResult, { ok: false }>;

/** Comentarii `//` la început de rând sau după spațiu — nu `https://`. */
function hasComments(text: string): boolean {
  return /(^|\s)\/\/|\/\*/m.test(text);
}

/** Primul element existent pe drumul căii în sus: câmpul, mesajul lui, apoi părinții. */
function jumpTo(path: string) {
  const parts = path.split(".");
  for (let length = parts.length; length >= 1; length -= 1) {
    const candidate = parts.slice(0, length).join(".");
    const element =
      document.getElementById(fieldId(candidate)) ??
      document.getElementById(`${fieldId(candidate)}-msg`);
    if (element) {
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      element.scrollIntoView({ block: "center", behavior: reduced ? "auto" : "smooth" });
      if (!element.matches("input, select, textarea, button")) element.setAttribute("tabindex", "-1");
      element.focus({ preventScroll: true });
      return;
    }
  }
}

function ProblemList({
  title,
  problems,
  tone,
}: {
  title: string;
  problems: PlanProblem[];
  tone: "error" | "warning";
}) {
  if (problems.length === 0) return null;
  return (
    <section
      aria-label={title}
      className={cn(
        "rounded-panel-lg border px-5 py-4",
        tone === "error" ? "border-[#ff6b6b]/35 bg-[#ff6b6b]/[0.05]" : "border-[#f0b429]/30 bg-[#f0b429]/[0.04]"
      )}
    >
      <h3 className={cn("flex items-center gap-2 text-[14.5px] font-semibold", tone === "error" ? ERROR_TEXT : WARNING_TEXT)}>
        <span aria-hidden className={cn("h-2 w-2 rounded-full", tone === "error" ? ERROR_DOT : WARNING_DOT)} />
        {title}
      </h3>
      <ul className="mt-3 space-y-2">
        {problems.map((problem, index) => (
          <li key={index}>
            <button
              type="button"
              onClick={() => jumpTo(problem.path)}
              className="group flex w-full items-start gap-3 rounded-panel-sm px-1 py-0.5 text-left text-[14px] leading-snug text-bone/85 hover:text-bone"
            >
              <span aria-hidden className="mt-[3px] font-md-mono text-[11px] text-dim group-hover:text-bone">
                →
              </span>
              <span>{problem.message}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function PlanSentence({
  summary,
  platform,
  workspaceName,
}: {
  summary: PlanSummary;
  platform: Platform;
  workspaceName: string | null;
}) {
  const adCount = summary.ads.length;
  const dash = <span className="text-dim">—</span>;

  return (
    <div>
      <p className="font-md-display text-[1.375rem] font-semibold leading-snug tracking-tight text-bone sm:text-[1.625rem]">
        {summary.objective
          ? `O campanie de ${summary.objective.toLowerCase()}`
          : summary.objectiveInvalid
            ? "O campanie cu obiectivul de corectat"
            : "O campanie fără obiectiv"}
        {workspaceName ? ` în ${workspaceName}` : ` pe ${PLATFORM_LABEL[platform]}`},{" "}
        {summary.budget
          ? `cu ${summary.budget}`
          : summary.budgetInvalid
            ? "cu bugetul de corectat"
            : "fără buget"}
        .
      </p>
      <p className="mt-3 text-[15.5px] leading-relaxed text-bone/80">
        Pentru oameni de {summary.age}
        {summary.platformAge ? ` (pe TikTok, ${summary.platformAge})` : ""}, {summary.gender}, din{" "}
        {summary.places.length > 0 ? joinRo(summary.places) : dash}
        {summary.languages ? `, care folosesc aplicația în ${summary.languages}` : ""}.{" "}
        {adCount === 0
          ? "Nicio reclamă încă."
          : `${adCount === 1 ? "O reclamă" : countOf(adCount, "reclame")} ${summary.cta ? `cu butonul „${summary.cta}”` : summary.ctaInvalid ? "cu butonul de corectat" : "fără buton ales"}.`}
      </p>
      <p className="mt-4 font-md-mono text-[12px] tracking-wide text-dim">
        1 campanie → 1 set de reclame → {adCount === 1 ? "1 reclamă" : countOf(adCount, "reclame")}
        {summary.monthly ? ` · ${summary.monthly}` : ""}
      </p>
    </div>
  );
}

export function PlanEditor({
  workspaces,
  currentWorkspaceId,
  chooseWorkspace,
}: {
  workspaces: WorkspaceSummary[];
  currentWorkspaceId: string;
  chooseWorkspace: (formData: FormData) => Promise<void>;
}) {
  const current = workspaces.find((workspace) => workspace.id === currentWorkspaceId) ?? workspaces[0];

  const [text, setText] = useState("");
  const [draft, setDraft] = useState<Record<string, unknown> | null>(null);
  const [syntax, setSyntax] = useState<SyntaxProblem | null>(null);
  const [rewritten, setRewritten] = useState(false);
  const [copied, setCopied] = useState(false);
  const [restored, setRestored] = useState(false);
  const [switching, startSwitch] = useTransition();

  const draftRef = useRef<Record<string, unknown> | null>(null);
  const skipParse = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Planul supraviețuiește unui refresh în același tab. sessionStorage, nu
  // localStorage: conține id-uri de cont și nu are ce căuta după închidere.
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) setText(saved);
    } catch {
      /* stocare indisponibilă — pornim gol */
    }
    setRestored(true);
  }, []);

  useEffect(() => {
    if (!restored) return;
    try {
      if (text) sessionStorage.setItem(STORAGE_KEY, text);
      else sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* fără stocare, planul trăiește doar în pagină */
    }

    // Textul tocmai a fost rescris dintr-o corectură: planul e deja la zi.
    if (skipParse.current) {
      skipParse.current = false;
      return;
    }

    const timer = window.setTimeout(() => {
      if (text.trim() === "") {
        draftRef.current = null;
        setDraft(null);
        setSyntax(null);
        setRewritten(false);
        return;
      }
      const result = parsePlanText(text);
      if (result.ok) {
        draftRef.current = result.value;
        setDraft(result.value);
        setSyntax(null);
      } else {
        setSyntax(result);
      }
    }, PARSE_DELAY);
    return () => window.clearTimeout(timer);
  }, [text, restored]);

  const update = (path: string, value: unknown) => {
    const next = setIn(draftRef.current ?? {}, path, value);
    draftRef.current = next;
    setDraft(next);
    if (hasComments(text)) setRewritten(true);
    skipParse.current = true;
    setText(JSON.stringify(next, null, 2));
    setSyntax(null);
  };

  const validation = useMemo(
    () => (draft ? validatePlan(draft, { currentWorkspace: current.id }) : null),
    [draft, current.id]
  );
  const errors = useMemo(() => groupByPath(validation?.errors ?? []), [validation]);
  const warnings = useMemo(() => groupByPath(validation?.warnings ?? []), [validation]);

  const planWorkspace = workspaces.find((workspace) => workspace.id === draft?.workspace) ?? null;
  const platform: Platform = (planWorkspace ?? current).platform;
  const summary = useMemo(() => (draft ? summarizePlan(draft, platform) : null), [draft, platform]);

  const switchWorkspace = (id: string) => {
    const formData = new FormData();
    formData.set("workspace", id);
    startSwitch(() => chooseWorkspace(formData));
  };

  const goToLine = (line: number, column: number) => {
    const area = textareaRef.current;
    if (!area) return;
    const lines = area.value.split("\n");
    let position = 0;
    for (let index = 0; index < line - 1 && index < lines.length; index += 1) {
      position += lines[index].length + 1;
    }
    position += Math.max(0, column - 1);
    area.focus();
    area.setSelectionRange(position, position + 1);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      textareaRef.current?.select();
    }
  };

  const errorCount = validation?.errors.length ?? 0;
  const warningCount = validation?.warnings.length ?? 0;
  const status = !draft
    ? syntax
      ? "JSON-ul nu se poate citi."
      : "Niciun plan încă."
    : syntax
      ? "JSON-ul nu se mai poate citi. Previzualizarea arată ultima versiune citită."
      : errorCount > 0
        ? `${errorCount === 1 ? "Un lucru" : countOf(errorCount, "lucruri")} de corectat${warningCount ? `, ${warningCount} de citit` : ""}.`
        : `Planul e valid${warningCount ? `, cu ${warningCount === 1 ? "un lucru" : countOf(warningCount, "lucruri")} de citit` : ""}.`;

  const createReason = !draft
    ? "Lipește un plan ca să-l poți verifica."
    : syntax
      ? "Repară întâi JSON-ul din stânga."
      : errorCount > 0
        ? `${errorCount === 1 ? "Un lucru" : countOf(errorCount, "lucruri")} de corectat mai sus.`
        : !current.tokenConfigured
          ? `Planul e valid. Spațiul ${current.name} nu are token (${current.tokenEnv}), iar conectarea la platformă vine în faza 2.`
          : `Planul e valid. Conectarea la ${PLATFORM_LABEL[platform]} vine în faza 2 — deocamdată portalul doar verifică.`;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start xl:gap-12">
      {/* ---------------------------------------------------------- JSON */}
      <section aria-labelledby="plan-json" className="min-w-0 lg:sticky lg:top-[7.75rem]">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="plan-json" className="eyebrow">
            Planul · JSON
          </h2>
          <p className="font-md-mono text-[11px] tabular-nums text-dim">
            {text ? countOf(text.split("\n").length, "rânduri") : "gol"}
          </p>
        </div>

        <label htmlFor="plan-text" className="sr-only">
          Planul de campanie, în format JSON
        </label>
        <textarea
          id="plan-text"
          ref={textareaRef}
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setRewritten(false);
          }}
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          aria-describedby="plan-status"
          aria-invalid={syntax ? true : undefined}
          placeholder={'{\n  "workspace": "meta-meridian",\n  …\n}'}
          className={cn(
            FIELD,
            "mt-3 h-[22rem] resize-y whitespace-pre py-3 font-md-mono text-[12.5px] leading-[1.6] lg:h-[calc(100dvh-17rem)] lg:min-h-[24rem]",
            syntax && "!border-[#ff6b6b]/60"
          )}
        />

        <div id="plan-status" className="mt-3 min-h-6 text-[13.5px] leading-snug">
          {syntax ? (
            <div className={ERROR_TEXT}>
              <p>{syntax.message}</p>
              <div className="mt-2 flex flex-wrap gap-3">
                {syntax.line !== null ? (
                  <button
                    type="button"
                    onClick={() => goToLine(syntax.line ?? 1, syntax.column ?? 1)}
                    className="underline underline-offset-4 hover:text-bone"
                  >
                    Du-mă la rândul {syntax.line}
                  </button>
                ) : null}
                {syntax.fix === "smart_quotes" ? (
                  <button
                    type="button"
                    onClick={() => setText(replaceSmartQuotes(text))}
                    className="underline underline-offset-4 hover:text-bone"
                  >
                    Înlocuiește ghilimelele
                  </button>
                ) : null}
              </div>
            </div>
          ) : draft ? (
            <p className={errorCount > 0 ? ERROR_TEXT : OK_TEXT}>{status}</p>
          ) : (
            <p className="text-dim">
              Lipește planul primit. Se citește singur — nu trebuie apăsat nimic.
            </p>
          )}
          {rewritten ? (
            <p className="mt-2 text-dim">
              JSON-ul s-a rescris din corecturi, fără comentarii. Copiază-l dacă vrei să-l duci înapoi în
              conversație.
            </p>
          ) : null}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setText(EXAMPLE_PLAN);
              setRewritten(false);
            }}
            className="btn btn-ghost !min-h-10 !px-4 !py-2 !text-[13px]"
          >
            Încarcă exemplul
          </button>
          <button
            type="button"
            onClick={copy}
            disabled={!text}
            className="btn btn-ghost !min-h-10 !px-4 !py-2 !text-[13px] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {copied ? "Copiat" : "Copiază JSON-ul"}
          </button>
          <button
            type="button"
            onClick={() => {
              setText("");
              setRewritten(false);
              textareaRef.current?.focus();
            }}
            disabled={!text}
            className="btn btn-ghost !min-h-10 !px-4 !py-2 !text-[13px] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Golește
          </button>
        </div>
      </section>

      {/* --------------------------------------------------- Previzualizare */}
      <section aria-labelledby="plan-preview" className="min-w-0">
        <h2 id="plan-preview" className="sr-only">
          Ce se creează
        </h2>
        <p role="status" className="sr-only">
          {status}
        </p>

        <PauseSeal />

        {!draft || !summary || !validation ? (
          <div className="mt-6 rounded-panel-lg border border-dashed border-hair-strong px-6 py-10 text-center">
            <p className="font-md-display text-[1.375rem] font-semibold text-bone">
              Aici citești planul în română.
            </p>
            <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-bone/70">
              Lipește JSON-ul în stânga: vezi cui se adresează, cât costă pe zi și pe lună, ce texte
              intră în fiecare reclamă și ce lipsește. Corectezi aici, iar JSON-ul se rescrie singur.
            </p>
            <button
              type="button"
              onClick={() => setText(EXAMPLE_PLAN)}
              className="btn btn-light mt-6"
            >
              Încarcă exemplul comentat
            </button>
            <p className="mt-3 text-[13px] text-dim">
              O campanie de {OBJECTIVE_LABEL.leads.toLowerCase()} pe Meta, cu destinație website.
            </p>
          </div>
        ) : (
          <div
            className={cn("transition-opacity duration-150", (syntax || switching) && "pointer-events-none opacity-50")}
            aria-busy={switching || undefined}
          >
            <div className="mt-6 rounded-panel-lg border border-hair bg-char/60 px-5 py-6 sm:px-7">
              <PlanSentence
                summary={summary}
                platform={platform}
                workspaceName={planWorkspace?.name ?? null}
              />
            </div>

            <div className="mt-6 space-y-3">
              <ProblemList
                title={validation.errors.length === 1 ? "Un lucru de corectat" : `${countOf(validation.errors.length, "lucruri")} de corectat`}
                problems={validation.errors}
                tone="error"
              />
              <ProblemList
                title={validation.warnings.length === 1 ? "Un lucru de citit" : `${countOf(validation.warnings.length, "lucruri")} de citit`}
                problems={validation.warnings}
                tone="warning"
              />
            </div>

            <div className="mt-6">
              <PlanFormProvider value={{ draft, update, errors, warnings }}>
                <PlanForm
                  platform={platform}
                  summary={summary}
                  workspaces={workspaces}
                  currentWorkspace={current}
                  onSwitchWorkspace={switchWorkspace}
                />
              </PlanFormProvider>
            </div>

            <section aria-labelledby="ads-list" className="border-t border-hair py-7">
              <h3 id="ads-list" className="eyebrow !text-[11.5px] !text-bone">
                Reclamele care se creează
              </h3>
              <AdsPreview
                summary={summary}
                rotating={draft.creative !== undefined && (draft.creative as Record<string, unknown>).variants === "platform_rotates"}
                className="mt-4"
              />
            </section>
          </div>
        )}

        {/* Lipită jos doar pe ecrane mari: pe telefon ar mânca un sfert din
            ecran la fiecare derulare, iar planul se citește oricum până la capăt. */}
        <div className="mt-2 rounded-panel-lg border border-hair bg-ink/92 px-4 py-4 lg:sticky lg:bottom-0 lg:z-10 lg:rounded-b-none lg:backdrop-blur-md sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              disabled
              aria-describedby="create-reason"
              className="btn btn-light shrink-0 disabled:cursor-not-allowed disabled:opacity-45"
            >
              Creează pe pauză
            </button>
            <p id="create-reason" className="text-[13.5px] leading-snug text-bone/75">
              {createReason}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
