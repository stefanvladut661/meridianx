"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, FileJson, ShieldCheck, Wand2 } from "lucide-react";
import { examplePlanFor } from "@/lib/ads/example-plan";
import { CURRENCIES, OBJECTIVE_LABEL, PLATFORM_LABEL, type Platform } from "@/lib/ads/constants";
import { parsePlanText, replaceSmartQuotes, type PlanTextResult } from "@/lib/ads/plan-json";
import { asRecord, asString, getIn, setIn } from "@/lib/ads/plan-path";
import { countOf, formatMoney, rawVideosOf } from "@/lib/ads/plan-derive";
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
import { ConfirmDialog, InlineNote } from "../ui/actions";
import { Btn, Card, SectionTitle } from "../ui/primitives";
import { SoftSelect } from "../ui/select";
import { EmptyState } from "../ui/states";
import { AdsPreview } from "./ads-preview";
import { CheckPanel } from "./check-panel";
import { CreateResult } from "./create-result";
import { PlanFormProvider, groupByPath } from "./fields";
import { HouseRule } from "./house-rule";
import { PlanForm } from "./plan-form";
import { ProblemList } from "./problem-list";
import { ROW_ERROR } from "./tone";

/**
 * /admin/ads/nou — planul lipit, citit în română, corectat pe loc.
 *
 * Două surse ale aceluiași adevăr: textul JSON (stânga) și planul citit din
 * el (dreapta). Lipești → planul se citește singur, după o pauză scurtă.
 * Corectezi în dreapta → JSON-ul se rescrie din plan, gata de copiat
 * înapoi în conversația din care a venit. Comentariile din JSON nu
 * supraviețuiesc rescrierii, și interfața spune asta.
 *
 * Apoi, pe platformă: „Verifică în Meta / TikTok / Google" citește contul real (cont, monedă,
 * pagină, pixel, video, fiecare nume din targetare) și abia după o
 * verificare fără erori, pe EXACT planul de pe ecran, se deblochează
 * „Creează pe pauză". O corectură după verificare o face veche. Crearea
 * trece printr-o confirmare cu bugetul și plafonul spațiului.
 */

const STORAGE_KEY = "meridian_ads_plan";
/** Cheia lotului (`batch-editor.tsx`): un lot lipit aici se mută acolo cu un clic. */
const BATCH_STORAGE_KEY = "meridian_ads_batch";
/** Cheia planului de căutare (`search-editor.tsx`): la fel, un plan de căutare se mută acolo. */
const SEARCH_STORAGE_KEY = "meridian_ads_search_plan";
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
  const dash = <span className="text-muted-foreground">—</span>;

  return (
    <div>
      <p className="text-[15px] font-semibold leading-snug tracking-[-0.01em]">
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
      <p className="mt-2 text-[13px] leading-relaxed text-foreground/80">
        Pentru oameni de {summary.age}
        {summary.platformAge ? ` (pe ${PLATFORM_LABEL[platform]}, ${summary.platformAge})` : ""}, {summary.gender}, din{" "}
        {summary.places.length > 0 ? joinRo(summary.places) : dash}
        {summary.languages ? `, care folosesc aplicația în ${summary.languages}` : ""}.{" "}
        {adCount === 0
          ? "Nicio reclamă încă."
          : `${adCount === 1 ? "O reclamă" : countOf(adCount, "reclame")} ${summary.cta ? `cu butonul „${summary.cta}”` : summary.ctaInvalid ? "cu butonul de corectat" : "fără buton ales"}.`}
      </p>
      <p className="mt-3 font-mono text-[11px] tracking-wide text-muted-foreground">
        1 campanie → 1 set de reclame → {adCount === 1 ? "1 reclamă" : countOf(adCount, "reclame")}
        {summary.videos.length > 1 ? ` (${summary.videos.length} video-uri × texte)` : ""}
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
  /** v2: „Continuă” o creare pe pași (limita de cereri a platformei). */
  continueJob?: (input: { jobId: string }) => Promise<CreateResponse>;
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
  const router = useRouter();

  const [text, setText] = useState("");
  const [draft, setDraft] = useState<Record<string, unknown> | null>(null);
  const [syntax, setSyntax] = useState<SyntaxProblem | null>(null);
  const [rewritten, setRewritten] = useState(false);
  const [copied, setCopied] = useState(false);
  const [restored, setRestored] = useState(false);
  const [switching, startSwitch] = useTransition();
  const [confirm, setConfirm] = useState(false);

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
      const parsed = parsePlanText(text);
      if (parsed.ok) {
        draftRef.current = parsed.value;
        setDraft(parsed.value);
        setSyntax(null);
      } else {
        setSyntax(parsed);
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

  const loadFile = async (file: File | undefined) => {
    if (!file) return;
    setText(await file.text());
    setRewritten(false);
  };

  /** „Lipește alt plan”: totul de la capăt, ca la prima intrare pe ecran. */
  const startOver = () => {
    setText("");
    setRewritten(false);
    setResult(null);
    setCheck(null);
    setCheckFailure(null);
    draftRef.current = null;
    setDraft(null);
    setSyntax(null);
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

  const pendingUpload = draft ? rawVideosOf(draft).some(({ value }) => asRecord(value)?.source === "upload") : false;
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
            : pendingUpload
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

  // Plafonul spațiului, în moneda planului: ce se spune în confirmare.
  const currencyText = asString(getIn(draft ?? {}, "campaign.currency"));
  const currency = CURRENCIES.find((item) => item === currencyText) ?? null;
  const cap = currency ? (current.dailyBudgetCap[currency] ?? null) : null;
  const campaignName = asString(getIn(draft ?? {}, "campaign.name"));

  // Creată: ca în prototip, ecranul se înlocuiește cu cardul de la sfârșit.
  if (result?.ok) {
    return (
      <div className="mx-auto max-w-2xl">
        <CreateResult result={result} platform={current.platform} pending={creating} onCreateAnyway={() => runCreate(true)} continueJob={actions.continueJob} onResult={setResult} onAnother={startOver} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        {/* ---------------------------------------------------------- JSON */}
        <Card className="flex flex-col lg:sticky lg:top-20">
          <SectionTitle
            title="1. Planul lipit"
            hint="Acceptă blocuri ```json, comentarii și virgule în plus. Se citește singur."
            action={
              <Btn
                size="xs"
                variant="ghost"
                icon={Wand2}
                onClick={() => {
                  setText(examplePlanFor(current));
                  setRewritten(false);
                }}
              >
                Încarcă exemplul
              </Btn>
            }
          />
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
              "mt-3 h-[22rem] w-full resize-y whitespace-pre rounded-xl border border-white/[0.1] bg-[#0A0A0E] p-3 font-mono text-[11.5px] leading-relaxed text-foreground/85 outline-none placeholder:text-muted-foreground/50 focus:border-lav/50 lg:h-[calc(100dvh-26rem)] lg:min-h-[22rem]",
              syntax && "!border-rose/60"
            )}
          />

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Btn size="sm" variant="outline" onClick={copy} disabled={!text}>
              {copied ? "Copiat" : "Copiază JSON-ul"}
            </Btn>
            <Btn
              size="sm"
              variant="ghost"
              onClick={() => {
                setText("");
                setRewritten(false);
                textareaRef.current?.focus();
              }}
              disabled={!text}
            >
              Golește
            </Btn>
            <span className="text-[11px] text-muted-foreground">sau</span>
            <label className="cursor-pointer text-[11.5px] text-foreground/70 underline underline-offset-4 hover:text-foreground has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-lav">
              încarcă un fișier .json
              <input
                type="file"
                accept=".json,application/json"
                className="sr-only"
                onChange={(event) => {
                  void loadFile(event.target.files?.[0]);
                  event.target.value = "";
                }}
              />
            </label>
          </div>

          <div id="plan-status" className="mt-3 space-y-2 text-[12.5px] leading-snug">
            {syntax ? (
              <InlineNote tone="rose">
                <p>{syntax.message}</p>
                <div className="mt-2 flex flex-wrap gap-3">
                  {syntax.line !== null ? (
                    <button
                      type="button"
                      onClick={() => goToLine(syntax.line ?? 1, syntax.column ?? 1)}
                      className="underline underline-offset-4 hover:text-white"
                    >
                      Du-mă la rândul {syntax.line}
                    </button>
                  ) : null}
                  {syntax.fix === "smart_quotes" ? (
                    <button
                      type="button"
                      onClick={() => setText(replaceSmartQuotes(text))}
                      className="underline underline-offset-4 hover:text-white"
                    >
                      Înlocuiește ghilimelele
                    </button>
                  ) : null}
                  {syntax.fix === "search" ? (
                    <button
                      type="button"
                      onClick={() => {
                        try {
                          sessionStorage.setItem(SEARCH_STORAGE_KEY, text);
                          sessionStorage.removeItem(STORAGE_KEY);
                        } catch {
                          /* fără stocare, planul se lipește din nou acolo */
                        }
                        router.push("/admin/ads/cautare");
                      }}
                      className="underline underline-offset-4 hover:text-white"
                    >
                      Deschide în „Căutare”
                    </button>
                  ) : null}
                  {syntax.fix === "batch" ? (
                    <button
                      type="button"
                      onClick={() => {
                        try {
                          sessionStorage.setItem(BATCH_STORAGE_KEY, text);
                          sessionStorage.removeItem(STORAGE_KEY);
                        } catch {
                          /* fără stocare, lotul se lipește din nou acolo */
                        }
                        router.push("/admin/ads/lot");
                      }}
                      className="underline underline-offset-4 hover:text-white"
                    >
                      Deschide lotul
                    </button>
                  ) : null}
                </div>
              </InlineNote>
            ) : draft ? (
              <InlineNote tone={errorCount > 0 ? "rose" : "mint"}>{status}</InlineNote>
            ) : (
              <p className="text-muted-foreground">Lipește planul primit. Se citește singur — nu trebuie apăsat nimic.</p>
            )}
            {rewritten ? (
              <InlineNote tone="neutral">
                JSON-ul s-a rescris din corecturi, fără comentarii. Copiază-l dacă vrei să-l duci înapoi în conversație.
              </InlineNote>
            ) : null}
          </div>
        </Card>

        {/* ------------------------------------------------ Planul citit */}
        <div className="min-w-0 space-y-4">
          <p role="status" className="sr-only">
            {status}
          </p>

          {!draft || !summary || !validation ? (
            <>
              <Card padded={false}>
                <EmptyState
                  icon={FileJson}
                  title="Aici apare planul citit"
                  text="Lipește JSON-ul în stânga: vezi pe rânduri obiectivul, bugetul, publicul, textele și materialul — în română, nu în JSON. Corectezi aici, iar JSON-ul se rescrie singur."
                  action={
                    <Btn
                      size="sm"
                      variant="primary"
                      onClick={() => {
                        setText(examplePlanFor(current));
                        setRewritten(false);
                      }}
                    >
                      Încarcă exemplul comentat
                    </Btn>
                  }
                  hint={`O campanie de ${OBJECTIVE_LABEL.leads.toLowerCase()} pe ${platformLabel}, cu destinație website.`}
                />
              </Card>
              <HouseRule>Planul se creează oprit, fără excepții. Nu există buton de pornire, de ștergere sau de schimbare a bugetului.</HouseRule>
            </>
          ) : (
            <>
              <Card className={cn("transition-opacity duration-150", (syntax || switching) && "pointer-events-none opacity-50")} aria-busy={switching || undefined}>
                <SectionTitle title="2. Citit în română" hint="corectează direct în câmpuri" />

                <div className="mt-3 rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-4">
                  <PlanSentence summary={summary} platform={platform} workspaceName={planWorkspace?.name ?? null} />
                </div>

                <div className="mt-3 space-y-2">
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

                <div className="mt-4 border-t border-white/[0.06] pt-4">
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

                <section aria-labelledby="ads-list" className="mt-4 border-t border-white/[0.06] pt-4">
                  <h3 id="ads-list" className="text-[13.5px] font-medium">
                    Reclamele care se creează
                  </h3>
                  <AdsPreview
                    summary={summary}
                    rotating={draft.creative !== undefined && (draft.creative as Record<string, unknown>).variants === "platform_rotates"}
                    className="mt-3"
                  />
                </section>

                <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-white/[0.06] pt-4">
                  <div className="min-w-[190px] flex-1">
                    <SoftSelect
                      label="Spațiu de lucru"
                      value={current.id}
                      disabled={switching}
                      onChange={switchWorkspace}
                      options={workspaces.map((workspace) => ({ value: workspace.id, label: workspace.name }))}
                    />
                    <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground" aria-live="polite">
                      {current.owner === "clienti" ? (
                        <span className="font-medium text-apricot">Banii clienților</span>
                      ) : (
                        <span className="text-foreground/80">Reclamele agenției</span>
                      )}
                      {" · "}
                      {current.tokenConfigured ? "token setat" : "fără token — doar verificare"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">Plafon zilnic</p>
                    <p className="pu-num text-[13px]">{currency && cap !== null ? formatMoney(cap, currency) : "—"}</p>
                  </div>
                </div>
              </Card>

              <Card>
                <SectionTitle
                  title="3. Verificare pe conturi"
                  hint="obiectiv, buget, material, texte"
                  action={
                    <Btn size="sm" variant={step.action === "check" ? "primary" : "outline"} onClick={runCheck} disabled={step.action === "none" || busy} aria-describedby="create-reason">
                      {checking ? `Se verifică în ${platformLabel}…` : check ? "Verifică din nou" : `Verifică în ${platformLabel}`}
                    </Btn>
                  }
                />

                {check ? (
                  <div className={cn("mt-3", (syntax || switching) && "pointer-events-none opacity-50")}>
                    <CheckPanel check={check.check} stale={check.key !== planKey} />
                  </div>
                ) : (
                  <p className="mt-3 text-[12px] leading-relaxed text-muted-foreground">
                    Verificarea citește contul ales: pagină, pixel, acțiune de conversie și biblioteca de video. Nu se creează nimic.
                  </p>
                )}

                {checkFailure ? (
                  <div role="alert" className="mt-3 space-y-2">
                    <div className={ROW_ERROR}>
                      <span>
                        <span className="font-medium">Verificarea pe {platformLabel} n-a mers.</span> {checkFailure.message}
                      </span>
                    </div>
                    <ProblemList title="De corectat" problems={checkFailure.problems} tone="error" />
                  </div>
                ) : null}

                <p id="create-reason" className="mt-3 text-[12px] leading-snug text-foreground/75" aria-live="polite">
                  {checking
                    ? current.platform === "google"
                      ? "Google caută contul, conversia, video-urile și fiecare nume din targetare, apoi verifică toată crearea, fără să creeze nimic…"
                      : `${platformLabel} caută contul, ${current.platform === "meta" ? "pagina" : "identitatea"}, pixelul, video-ul și fiecare nume din targetare…`
                    : creating
                      ? "Se creează campania, setul și reclamele, una câte una. Nu închide pagina."
                      : step.reason}
                </p>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] pt-4">
                  <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <ShieldCheck className="h-3.5 w-3.5 text-mint" aria-hidden="true" /> se creează oprit, fără excepții
                  </p>
                  <Btn
                    size="md"
                    variant="primary"
                    iconRight={ArrowRight}
                    disabled={step.action !== "create" || busy}
                    aria-describedby="create-reason"
                    onClick={() => setConfirm(true)}
                  >
                    {creating ? "Se creează pe pauză…" : "Creează pe pauză"}
                  </Btn>
                </div>
              </Card>
            </>
          )}

          {checkFailure && (!draft || !summary || !validation) ? (
            <div role="alert" className="space-y-2">
              <div className={ROW_ERROR}>
                <span>
                  <span className="font-medium">Verificarea pe {platformLabel} n-a mers.</span> {checkFailure.message}
                </span>
              </div>
              <ProblemList title="De corectat" problems={checkFailure.problems} tone="error" />
            </div>
          ) : null}

          {result && !result.ok ? (
            <CreateResult
              result={result}
              platform={current.platform}
              pending={creating}
              onCreateAnyway={() => runCreate(true)}
              continueJob={actions.continueJob}
              onResult={setResult}
            />
          ) : null}
        </div>
      </div>

      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Creezi campania pe pauză?"
        description={`${campaignName ?? "(fără nume)"} · ${platformLabel} · ${summary?.objective ?? "obiectiv de corectat"}`}
        consequence={`Se creează o campanie oprită${summary?.budget ? `, cu buget de ${summary.budget}` : ""}. Plafonul spațiului ales: ${currency && cap !== null ? `${formatMoney(cap, currency)}/zi` : "nesetat pentru moneda planului"}. Pornirea rămâne la tine, în platformă.`}
        confirmLabel="Creează pe pauză"
        tone="primary"
        onConfirm={() => runCreate(false)}
      />
    </div>
  );
}
