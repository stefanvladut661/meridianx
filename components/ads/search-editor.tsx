"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { exampleSearchPlanFor } from "@/lib/ads/google/search/example";
import { summarizeSearchPlan } from "@/lib/ads/google/search/summary";
import type { SearchCheck, SearchCheckResponse, SearchCreateResponse } from "@/lib/ads/google/search/types";
import { validateSearchPlan } from "@/lib/ads/google/search/validate";
import { countOf } from "@/lib/ads/plan-derive";
import { parseSearchPlanText, replaceSmartQuotes, type PlanTextResult } from "@/lib/ads/plan-json";
import type { PlanProblem } from "@/lib/ads/plan-validate";
import type { WorkspaceSummary } from "@/lib/ads/workspaces";
import { cn } from "@/lib/utils";
import { PauseSeal } from "./pause-seal";
import { ProblemList } from "./problem-list";
import { SearchCheckPanel } from "./search-check-panel";
import { SearchCreateResult } from "./search-create-result";
import { SearchPreview } from "./search-preview";
import { ERROR_TEXT, FIELD, OK_TEXT } from "./tone";

/**
 * /admin/ads/cautare — planul de căutare lipit, citit în română, verificat
 * pe contul real și creat pe pauză.
 *
 * Același drum ca planul video: lipești → se citește singur → „Verifică în
 * Google” (tot planul trimis cu `validateOnly`, fără să se creeze nimic) →
 * „Creează pe pauză” doar pe o verificare fără erori a EXACT planului de pe
 * ecran. Corecturile se fac în JSON (sau în conversația din care a venit):
 * un plan de căutare are sute de rânduri, iar un formular pentru fiecare
 * cuvânt ar fi mai lent decât textul.
 */

const STORAGE_KEY = "meridian_ads_search_plan";
const VIDEO_STORAGE_KEY = "meridian_ads_plan";
const BATCH_STORAGE_KEY = "meridian_ads_batch";
const PARSE_DELAY = 250;
const UNREACHABLE = "Serverul n-a răspuns (rețea sau sesiune). Nu s-a trimis nimic spre Google. Încearcă din nou.";

type SyntaxProblem = Extract<PlanTextResult, { ok: false }>;

export interface SearchEditorActions {
  checkPlan: (input: { plan: unknown; workspace: string }) => Promise<SearchCheckResponse>;
  createPaused: (input: { plan: unknown; workspace: string; fingerprint: string }) => Promise<SearchCreateResponse>;
}

export function SearchEditor({
  workspaces,
  currentWorkspaceId,
  actions,
}: {
  workspaces: WorkspaceSummary[];
  currentWorkspaceId: string;
  /** Lipsă = doar citire și validare (fără verificare pe Google). */
  actions?: SearchEditorActions;
}) {
  const current = workspaces.find((workspace) => workspace.id === currentWorkspaceId) ?? workspaces[0];
  const router = useRouter();

  const [text, setText] = useState("");
  const [draft, setDraft] = useState<Record<string, unknown> | null>(null);
  const [syntax, setSyntax] = useState<SyntaxProblem | null>(null);
  const [restored, setRestored] = useState(false);
  const [copied, setCopied] = useState(false);
  const [check, setCheck] = useState<{ key: string; check: SearchCheck } | null>(null);
  const [checkFailure, setCheckFailure] = useState<{ message: string; problems: PlanProblem[] } | null>(null);
  const [result, setResult] = useState<SearchCreateResponse | null>(null);
  const [checking, startCheck] = useTransition();
  const [creating, startCreate] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Planul supraviețuiește unui refresh în același tab (sessionStorage: are id-uri de cont).
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
    const timer = window.setTimeout(() => {
      if (text.trim() === "") {
        setDraft(null);
        setSyntax(null);
        return;
      }
      const parsed = parseSearchPlanText(text);
      if (parsed.ok) {
        setDraft(parsed.value);
        setSyntax(null);
      } else {
        setSyntax(parsed);
      }
    }, PARSE_DELAY);
    return () => window.clearTimeout(timer);
  }, [text, restored]);

  const validation = useMemo(() => (draft ? validateSearchPlan(draft, { currentWorkspace: current.id }) : null), [draft, current.id]);
  const summary = useMemo(() => (draft ? summarizeSearchPlan(draft) : null), [draft]);
  const errorPaths = useMemo(() => new Set((validation?.errors ?? []).map((problem) => problem.path)), [validation]);

  const planKey = useMemo(() => (draft ? JSON.stringify(draft) : ""), [draft]);
  const freshCheck = check && check.key === planKey ? check.check : null;

  const runCheck = () => {
    if (!draft || !actions) return;
    const key = planKey;
    setResult(null);
    setCheckFailure(null);
    startCheck(async () => {
      try {
        const response = await actions.checkPlan({ plan: draft, workspace: current.id });
        if (response.ok) setCheck({ key, check: response.check });
        else setCheckFailure({ message: response.message, problems: response.problems ?? [] });
      } catch {
        setCheckFailure({ message: UNREACHABLE, problems: [] });
      }
    });
  };

  const runCreate = () => {
    if (!draft || !freshCheck || !actions) return;
    startCreate(async () => {
      try {
        const response = await actions.createPaused({ plan: draft, workspace: current.id, fingerprint: freshCheck.fingerprint });
        setResult(response);
        if (!response.ok && response.recheck) setCheck(null);
      } catch {
        setResult({ ok: false, message: UNREACHABLE });
      }
    });
  };

  const moveTo = (key: string, href: string) => {
    try {
      sessionStorage.setItem(key, text);
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* fără stocare, planul se lipește din nou acolo */
    }
    router.push(href);
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

  const created = result?.ok === true && freshCheck !== null;
  const campaignCount = summary?.totals.campaigns ?? 0;
  const step: { action: "none" | "check" | "create"; reason: string } = !draft
    ? { action: "none", reason: "Lipește un plan de căutare ca să-l poți verifica." }
    : syntax
      ? { action: "none", reason: "Repară întâi JSON-ul din stânga." }
      : errorCount > 0
        ? { action: "none", reason: `${errorCount === 1 ? "Un lucru" : countOf(errorCount, "lucruri")} de corectat mai sus.` }
        : current.platform !== "google"
          ? { action: "none", reason: "Planurile de căutare se creează doar în spațiile Google: schimbă spațiul din selectorul de sus." }
          : !actions
            ? { action: "none", reason: "Planul e valid. Verificarea pe Google și crearea pe pauză nu sunt încă legate de pagina asta." }
            : !current.tokenConfigured
              ? { action: "none", reason: `Planul e valid, dar spațiul ${current.name} nu are cheie: setează ${current.tokenEnv} în Vercel și fă redeploy.` }
              : created
                ? { action: "none", reason: "Create. Pentru alt plan, schimbă JSON-ul și verifică din nou." }
                : !freshCheck
                  ? {
                      action: "check",
                      reason: check
                        ? "Planul s-a schimbat de la verificare. Verifică din nou înainte de creare."
                        : "Întâi verificarea pe contul real: contul, moneda, numele, locațiile, adresele și toată crearea, trimisă la Google fără să se creeze nimic.",
                    }
                  : !freshCheck.ok
                    ? { action: "check", reason: `Google: ${freshCheck.errors.length === 1 ? "un lucru" : countOf(freshCheck.errors.length, "lucruri")} de corectat mai sus.` }
                    : {
                        action: "create",
                        reason: `Se creează în ${freshCheck.account?.name ?? "contul din plan"}: ${campaignCount === 1 ? "o campanie" : countOf(campaignCount, "campanii")}, ${countOf(summary?.totals.adGroups ?? 0, "grupuri")}, ${countOf(summary?.totals.ads ?? 0, "anunțuri")} — toate oprite, într-o singură cerere.`,
                      };
  const busy = checking || creating;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start xl:gap-12">
      {/* ---------------------------------------------------------- JSON */}
      <section aria-labelledby="search-json" className="min-w-0 lg:sticky lg:top-[7.75rem]">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="search-json" className="eyebrow">
            Planul de căutare · JSON
          </h2>
          <p className="font-md-mono text-[11px] tabular-nums text-dim">{text ? countOf(text.split("\n").length, "rânduri") : "gol"}</p>
        </div>
        <label htmlFor="search-text" className="sr-only">
          Planul de căutare, în format JSON
        </label>
        <textarea
          id="search-text"
          ref={textareaRef}
          value={text}
          onChange={(event) => setText(event.target.value)}
          readOnly={busy}
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          aria-describedby="search-status"
          aria-invalid={syntax ? true : undefined}
          placeholder={'{\n  "format": "meridian-google-search/1",\n  "workspace": "google-clienti",\n  …\n}'}
          className={cn(
            FIELD,
            "mt-3 h-[22rem] resize-y whitespace-pre py-3 font-md-mono text-[12.5px] leading-[1.6] lg:h-[calc(100dvh-17rem)] lg:min-h-[24rem]",
            syntax && "!border-[#ff6b6b]/60"
          )}
        />
        <div id="search-status" className="mt-3 min-h-6 text-[13.5px] leading-snug">
          {syntax ? (
            <div className={ERROR_TEXT}>
              <p>{syntax.message}</p>
              <div className="mt-2 flex flex-wrap gap-3">
                {syntax.fix === "smart_quotes" ? (
                  <button type="button" onClick={() => setText(replaceSmartQuotes(text))} className="underline underline-offset-4 hover:text-bone">
                    Înlocuiește ghilimelele
                  </button>
                ) : null}
                {syntax.fix === "video" ? (
                  <button type="button" onClick={() => moveTo(VIDEO_STORAGE_KEY, "/admin/ads/nou")} className="underline underline-offset-4 hover:text-bone">
                    Deschide în „Plan nou”
                  </button>
                ) : null}
                {syntax.fix === "batch" ? (
                  <button type="button" onClick={() => moveTo(BATCH_STORAGE_KEY, "/admin/ads/lot")} className="underline underline-offset-4 hover:text-bone">
                    Deschide lotul
                  </button>
                ) : null}
              </div>
            </div>
          ) : draft ? (
            <p className={errorCount > 0 ? ERROR_TEXT : OK_TEXT}>{status}</p>
          ) : (
            <p className="text-dim">Lipește planul primit. Se citește singur — nu trebuie apăsat nimic.</p>
          )}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setText(exampleSearchPlanFor(current.id))}
            disabled={busy}
            className="btn btn-ghost !min-h-10 !px-4 !py-2 !text-[13px] disabled:opacity-40"
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
              setCheck(null);
              setResult(null);
              textareaRef.current?.focus();
            }}
            disabled={!text || busy}
            className="btn btn-ghost !min-h-10 !px-4 !py-2 !text-[13px] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Golește
          </button>
        </div>
      </section>

      {/* --------------------------------------------------- Previzualizare */}
      <section aria-labelledby="search-preview" className="min-w-0">
        <h2 id="search-preview" className="sr-only">
          Ce se creează
        </h2>
        <p role="status" className="sr-only">
          {status}
        </p>

        <PauseSeal />

        {!draft || !summary || !validation ? (
          <div className="mt-6 rounded-panel-lg border border-dashed border-hair-strong px-6 py-10 text-center">
            <p className="font-md-display text-[1.375rem] font-semibold text-bone">Aici citești campaniile de căutare.</p>
            <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-bone/70">
              Lipește planul în stânga: vezi fiecare campanie cu bugetul, zonele și programul ei, cuvintele cheie pe
              grupuri, negativele și anunțurile arătate cum apar în Google. Conflictele dintre negative și cuvinte
              le găsește portalul.
            </p>
            <button type="button" onClick={() => setText(exampleSearchPlanFor(current.id))} className="btn btn-light mt-6">
              Încarcă exemplul comentat
            </button>
            <p className="mt-3 text-[13px] text-dim">Două campanii pentru o firmă inventată, cu o listă comună și toate tipurile de materiale.</p>
          </div>
        ) : (
          <div className={cn("mt-6 space-y-6 transition-opacity duration-150", syntax && "pointer-events-none opacity-50")}>
            <div className="space-y-3">
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
            <SearchPreview
              summary={summary}
              operations={validation.operations}
              errorPaths={errorPaths}
              accountLabel={summary.account}
              volumes={freshCheck?.volumes ?? null}
            />
            {check ? <SearchCheckPanel check={check.check} stale={check.key !== planKey} /> : null}
          </div>
        )}

        {checkFailure ? (
          <div role="alert" className="mt-4 space-y-3">
            <div className="rounded-panel-lg border border-[#ff6b6b]/35 bg-[#ff6b6b]/[0.05] px-5 py-4">
              <p className={cn("text-[15px] font-semibold", ERROR_TEXT)}>Verificarea pe Google n-a mers.</p>
              <p className="mt-1.5 text-[14px] leading-relaxed text-bone/80">{checkFailure.message}</p>
            </div>
            <ProblemList title="De corectat" problems={checkFailure.problems} tone="error" />
          </div>
        ) : null}

        {result ? (
          <div className="mt-4">
            <SearchCreateResult result={result} />
          </div>
        ) : null}

        <div className="mt-4 rounded-panel-lg border border-hair bg-ink/92 px-4 py-4 lg:sticky lg:bottom-0 lg:z-10 lg:rounded-b-none lg:backdrop-blur-md sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex shrink-0 flex-wrap gap-2">
              {step.action === "check" ? (
                <button type="button" onClick={runCheck} disabled={busy} aria-describedby="search-reason" className="btn btn-light disabled:cursor-wait disabled:opacity-60">
                  {checking ? "Se verifică în Google…" : check ? "Verifică din nou" : "Verifică în Google"}
                </button>
              ) : null}
              <button
                type="button"
                onClick={runCreate}
                disabled={step.action !== "create" || busy}
                aria-describedby="search-reason"
                className={cn(
                  "btn shrink-0 disabled:cursor-not-allowed disabled:opacity-45",
                  step.action === "check" ? "btn-ghost" : "btn-light",
                  creating && "disabled:cursor-wait"
                )}
              >
                {creating ? "Se creează pe pauză…" : "Creează pe pauză"}
              </button>
              {step.action === "create" ? (
                <button type="button" onClick={runCheck} disabled={busy} className="btn btn-ghost disabled:cursor-wait disabled:opacity-60">
                  {checking ? "Se verifică…" : "Verifică din nou"}
                </button>
              ) : null}
            </div>
            <p id="search-reason" className="text-[13.5px] leading-snug text-bone/75" aria-live="polite">
              {checking
                ? "Google caută contul, numele campaniilor și listelor, locațiile, conversiile de apel și adresele, apoi verifică toată crearea, fără să creeze nimic…"
                : creating
                  ? "Se creează tot planul într-o singură cerere: totul sau nimic. Nu închide pagina."
                  : step.reason}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
