"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { examplePlanFor } from "@/lib/ads/example-plan";
import { OBJECTIVE_LABEL, PLATFORM_LABEL, type Platform } from "@/lib/ads/constants";
import { parsePlanText, replaceSmartQuotes, type PlanTextResult } from "@/lib/ads/plan-json";
import { getIn, setIn } from "@/lib/ads/plan-path";
import { countOf } from "@/lib/ads/plan-derive";
import { joinRo, summarizePlan, type PlanSummary } from "@/lib/ads/plan-summary";
import { validatePlan, type PlanProblem } from "@/lib/ads/plan-validate";
import type {
  CreateResponse,
  LibraryResponse,
  PlatformCheck,
  CheckResponse,
  UploadActions,
} from "@/lib/ads/types";
import type { WorkspaceSummary } from "@/lib/ads/workspaces";
import { cn } from "@/lib/utils";
import { AdsPreview } from "./ads-preview";
import { CreateResult } from "./create-result";
import { PlanFormProvider, groupByPath } from "./fields";
import { CheckPanel } from "./check-panel";
import { PauseSeal } from "./pause-seal";
import { PlanForm } from "./plan-form";
import { ProblemList } from "./problem-list";
import { ERROR_TEXT, FIELD, OK_TEXT } from "./tone";

/**
 * /admin/ads/nou — planul lipit, citit în română, corectat pe loc.
 *
 * Două surse ale aceluiași adevăr: textul JSON (stânga) și planul citit din
 * el (dreapta). Lipești → planul se citește singur, după o pauză scurtă.
 * Corectezi în dreapta → JSON-ul se rescrie din plan, gata de copiat
 * înapoi în conversația din care a venit. Comentariile din JSON nu
 * supraviețuiesc rescrierii, și interfața spune asta.
 *
 * Apoi, pe platformă: „Verifică în Meta / TikTok" citește contul real (cont, monedă,
 * pagină, pixel, video, fiecare nume din targetare) și abia după o
 * verificare fără erori, pe EXACT planul de pe ecran, se deblochează
 * „Creează pe pauză". O corectură după verificare o face veche.
 */

const STORAGE_KEY = "meridian_ads_plan";
const PARSE_DELAY = 200;

type SyntaxProblem = Extract<PlanTextResult, { ok: false }>;

/** Comentarii `//` la început de rând sau după spațiu — nu `https://`. */
function hasComments(text: string): boolean {
  return /(^|\s)\/\/|\/\*/m.test(text);
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

export interface PlanEditorActions {
  chooseWorkspace: (formData: FormData) => Promise<void>;
  checkPlan: (input: { plan: unknown; workspace: string }) => Promise<CheckResponse>;
  createPaused: (input: {
    plan: unknown;
    workspace: string;
    fingerprint: string;
    allowDuplicate: boolean;
  }) => Promise<CreateResponse>;
  listLibrary: (input: { workspace: string; adAccount: string }) => Promise<LibraryResponse>;
  prepareUpload: (input: {
    workspace: string;
    adAccount: string;
    file: { name: string; size: number; type: string };
  }) => ReturnType<UploadActions["prepare"]>;
  sendUpload: (input: {
    workspace: string;
    adAccount: string;
    stagingName: string;
    fileName: string;
  }) => ReturnType<UploadActions["send"]>;
  uploadStatus: (input: {
    workspace: string;
    adAccount: string;
    videoId: string;
    stagingName: string;
  }) => ReturnType<UploadActions["status"]>;
}

const UNREACHABLE = "Serverul n-a răspuns (rețea sau sesiune). Nu s-a trimis nimic spre platformă. Încearcă din nou.";

export function PlanEditor({
  workspaces,
  currentWorkspaceId,
  actions,
}: {
  workspaces: WorkspaceSummary[];
  currentWorkspaceId: string;
  actions: PlanEditorActions;
}) {
  const current = workspaces.find((workspace) => workspace.id === currentWorkspaceId) ?? workspaces[0];
  const platformLabel = PLATFORM_LABEL[current.platform];

  const [text, setText] = useState("");
  const [draft, setDraft] = useState<Record<string, unknown> | null>(null);
  const [syntax, setSyntax] = useState<SyntaxProblem | null>(null);
  const [rewritten, setRewritten] = useState(false);
  const [copied, setCopied] = useState(false);
  const [restored, setRestored] = useState(false);
  const [switching, startSwitch] = useTransition();

  // Verificarea pe platformă ține de EXACT planul verificat (`key`): orice
  // corectură o face „veche", iar crearea se blochează până la o nouă verificare.
  const [check, setCheck] = useState<{ key: string; check: PlatformCheck } | null>(null);
  const [checkFailure, setCheckFailure] = useState<{ message: string; problems: PlanProblem[] } | null>(null);
  const [result, setResult] = useState<CreateResponse | null>(null);
  const [checking, startCheck] = useTransition();
  const [creating, startCreate] = useTransition();

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
    startSwitch(() => actions.chooseWorkspace(formData));
  };

  // Cheia planului verificat: JSON-ul lui, stabil cât timp nu se schimbă nimic.
  const planKey = useMemo(() => (draft ? JSON.stringify(draft) : ""), [draft]);
  const freshCheck = check && check.key === planKey ? check.check : null;

  const runCheck = () => {
    if (!draft) return;
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

  const runCreate = (allowDuplicate: boolean) => {
    if (!draft || !freshCheck) return;
    startCreate(async () => {
      try {
        const response = await actions.createPaused({
          plan: draft,
          workspace: current.id,
          fingerprint: freshCheck.fingerprint,
          allowDuplicate,
        });
        setResult(response);
        // Verificarea veche nu mai e de încredere: s-a schimbat ceva de atunci.
        if (!response.ok && response.recheck) setCheck(null);
      } catch {
        setResult({ ok: false, message: UNREACHABLE });
      }
    });
  };

  const loadLibrary =
    current.tokenConfigured
      ? (adAccount: string) => actions.listLibrary({ workspace: current.id, adAccount })
      : undefined;

  // Contul se citește la momentul apelului: omul îl poate corecta între pași.
  const accountNow = () => String(getIn(draftRef.current ?? {}, "ad_account") ?? "");
  const upload: UploadActions | undefined =
    current.tokenConfigured
      ? {
          prepare: (file) => actions.prepareUpload({ workspace: current.id, adAccount: accountNow(), file }),
          send: ({ stagingName, fileName }) =>
            actions.sendUpload({ workspace: current.id, adAccount: accountNow(), stagingName, fileName }),
          status: ({ videoId, stagingName }) =>
            actions.uploadStatus({ workspace: current.id, adAccount: accountNow(), videoId, stagingName }),
        }
      : undefined;

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

  const videoSource = draft ? getIn(draft, "creative.video.source") : undefined;
  const created = result?.ok === true && freshCheck !== null;

  /* Ce se poate face acum, într-un singur loc: pasul următor, dacă e
     disponibil, și propoziția care spune de ce (sau ce urmează). */
  const step: { action: "none" | "check" | "create"; reason: string } = !draft
    ? { action: "none", reason: "Lipește un plan ca să-l poți verifica." }
    : syntax
      ? { action: "none", reason: "Repară întâi JSON-ul din stânga." }
      : errorCount > 0
        ? { action: "none", reason: `${errorCount === 1 ? "Un lucru" : countOf(errorCount, "lucruri")} de corectat mai sus.` }
        : !current.tokenConfigured
            ? {
                action: "none",
                reason: `Planul e valid, dar spațiul ${current.name} nu are token: setează ${current.tokenEnv} în Vercel și fă redeploy.`,
              }
            : videoSource === "upload"
              ? {
                  action: "none",
                  reason: `Planul e valid. Urcă întâi video-ul, la „Materialul”: când ${platformLabel} termină de procesat, planul trece singur pe el și se poate verifica.`,
                }
              : created
                ? { action: "none", reason: "Creată. Pentru încă o campanie, schimbă planul și verifică din nou." }
                : !freshCheck
                  ? {
                      action: "check",
                      reason: check
                        ? "Planul s-a schimbat de la verificare. Verifică din nou înainte de creare."
                        : "Întâi verificarea pe contul real: contul, pagina, pixelul, video-ul și fiecare nume din targetare.",
                    }
                  : !freshCheck.ok
                    ? {
                        action: "check",
                        reason: `${platformLabel}: ${freshCheck.errors.length === 1 ? "un lucru" : countOf(freshCheck.errors.length, "lucruri")} de corectat mai sus.`,
                      }
                    : {
                        action: "create",
                        reason: `Se creează în ${freshCheck.account?.name ?? "contul din plan"}: 1 campanie, 1 set, ${
                          summary?.ads.length === 1 ? "1 reclamă" : countOf(summary?.ads.length ?? 0, "reclame")
                        } — toate oprite.`,
                      };
  const busy = checking || creating;

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
              setText(examplePlanFor(current));
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
              onClick={() => setText(examplePlanFor(current))}
              className="btn btn-light mt-6"
            >
              Încarcă exemplul comentat
            </button>
            <p className="mt-3 text-[13px] text-dim">
              O campanie de {OBJECTIVE_LABEL.leads.toLowerCase()} pe {platformLabel}, cu destinație website.
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
                  loadLibrary={loadLibrary}
                  upload={upload}
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

            {check ? <CheckPanel check={check.check} stale={check.key !== planKey} /> : null}
          </div>
        )}

        {checkFailure ? (
          <div role="alert" className="mt-2 space-y-3">
            <div className="rounded-panel-lg border border-[#ff6b6b]/35 bg-[#ff6b6b]/[0.05] px-5 py-4">
              <p className={cn("text-[15px] font-semibold", ERROR_TEXT)}>Verificarea pe {platformLabel} n-a mers.</p>
              <p className="mt-1.5 text-[14px] leading-relaxed text-bone/80">{checkFailure.message}</p>
            </div>
            <ProblemList title="De corectat" problems={checkFailure.problems} tone="error" />
          </div>
        ) : null}

        {result ? (
          <div className="mt-2">
            <CreateResult
              result={result}
              platform={current.platform}
              pending={creating}
              onCreateAnyway={() => runCreate(true)}
            />
          </div>
        ) : null}

        {/* Lipită jos doar pe ecrane mari: pe telefon ar mânca un sfert din
            ecran la fiecare derulare, iar planul se citește oricum până la capăt. */}
        <div className="mt-2 rounded-panel-lg border border-hair bg-ink/92 px-4 py-4 lg:sticky lg:bottom-0 lg:z-10 lg:rounded-b-none lg:backdrop-blur-md sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex shrink-0 flex-wrap gap-2">
              {step.action === "check" ? (
                <button
                  type="button"
                  onClick={runCheck}
                  disabled={busy}
                  aria-describedby="create-reason"
                  className="btn btn-light disabled:cursor-wait disabled:opacity-60"
                >
                  {checking ? `Se verifică în ${platformLabel}…` : check ? "Verifică din nou" : `Verifică în ${platformLabel}`}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => runCreate(false)}
                disabled={step.action !== "create" || busy}
                aria-describedby="create-reason"
                className={cn(
                  "btn shrink-0 disabled:cursor-not-allowed disabled:opacity-45",
                  step.action === "check" ? "btn-ghost" : "btn-light",
                  creating && "disabled:cursor-wait"
                )}
              >
                {creating ? "Se creează pe pauză…" : "Creează pe pauză"}
              </button>
              {step.action === "create" ? (
                <button
                  type="button"
                  onClick={runCheck}
                  disabled={busy}
                  className="btn btn-ghost disabled:cursor-wait disabled:opacity-60"
                >
                  {checking ? "Se verifică…" : "Verifică din nou"}
                </button>
              ) : null}
            </div>
            <p id="create-reason" className="text-[13.5px] leading-snug text-bone/75" aria-live="polite">
              {checking
                ? `${platformLabel} caută contul, ${current.platform === "meta" ? "pagina" : "identitatea"}, pixelul, video-ul și fiecare nume din targetare…`
                : creating
                  ? "Se creează campania, setul și reclamele, una câte una. Nu închide pagina."
                  : step.reason}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
