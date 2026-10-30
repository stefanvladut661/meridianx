"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Eraser, FileJson, ShieldCheck, Wand2 } from "lucide-react";
import { exampleSearchPlanFor } from "@/lib/ads/google/search/example";
import { summarizeSearchPlan } from "@/lib/ads/google/search/summary";
import type { SearchCheck, SearchCheckResponse, SearchCreateResponse } from "@/lib/ads/google/search/types";
import { validateSearchPlan } from "@/lib/ads/google/search/validate";
import { countOf } from "@/lib/ads/plan-derive";
import { parseSearchPlanText, replaceSmartQuotes, type PlanTextResult } from "@/lib/ads/plan-json";
import type { PlanProblem } from "@/lib/ads/plan-validate";
import type { WorkspaceSummary } from "@/lib/ads/workspaces";
import { ConfirmDialog, CopyButton, InlineNote } from "@/components/panou/ui/actions";
import { Btn, Card, SectionTitle, Stamp } from "@/components/panou/ui/primitives";
import { EmptyState } from "@/components/panou/ui/states";
import { cn } from "@/lib/utils";
import { CautariPlanCheck } from "./cautari-plan-check";
import { CautariPlanPreview } from "./cautari-plan-preview";
import { PlanProbleme } from "./cautari-plan-probleme";
import { CautariPlanResult } from "./cautari-plan-result";

/**
 * Planul de căutare lipit, citit în română, verificat pe contul real și creat
 * pe pauză — cu structura din „Plan nou” (1. lipit, 2. citit, 3. verificat).
 *
 * Același drum ca planul video: lipești → se citește singur → „Verifică în
 * Google” (tot planul trimis cu `validateOnly`, fără să se creeze nimic) →
 * „Creează pe pauză” doar pe o verificare fără erori a EXACT planului de pe
 * ecran, după o confirmare. Corecturile se fac în JSON (sau în conversația din
 * care a venit): un plan de căutare are sute de rânduri, iar un formular
 * pentru fiecare cuvânt ar fi mai lent decât textul.
 */

const STORAGE_KEY = "meridian_ads_search_plan";
const VIDEO_STORAGE_KEY = "meridian_ads_plan";
const BATCH_STORAGE_KEY = "meridian_ads_batch";
const PARSE_DELAY = 250;
const UNREACHABLE = "Serverul n-a răspuns (rețea sau sesiune). Nu s-a trimis nimic spre Google. Încearcă din nou.";

type SyntaxProblem = Extract<PlanTextResult, { ok: false }>;

export interface CautariPlanActions {
  checkPlan: (input: { plan: unknown; workspace: string }) => Promise<SearchCheckResponse>;
  createPaused: (input: { plan: unknown; workspace: string; fingerprint: string }) => Promise<SearchCreateResponse>;
}

const linkClass = "underline underline-offset-4 hover:text-foreground";

export function CautariPlanEditor({
  workspaces,
  currentWorkspaceId,
  actions,
}: {
  workspaces: WorkspaceSummary[];
  currentWorkspaceId: string;
  /** Lipsă = doar citire și validare (fără verificare pe Google). */
  actions?: CautariPlanActions;
}) {
  const current = workspaces.find((workspace) => workspace.id === currentWorkspaceId) ?? workspaces[0];
  const router = useRouter();

  const [text, setText] = useState("");
  const [draft, setDraft] = useState<Record<string, unknown> | null>(null);
  const [syntax, setSyntax] = useState<SyntaxProblem | null>(null);
  const [restored, setRestored] = useState(false);
  const [check, setCheck] = useState<{ key: string; check: SearchCheck } | null>(null);
  const [checkFailure, setCheckFailure] = useState<{ message: string; problems: PlanProblem[] } | null>(null);
  const [result, setResult] = useState<SearchCreateResponse | null>(null);
  const [checking, setChecking] = useState(false);
  const [creating, setCreating] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const confirmOpen = useRef(false);
  const pendingResult = useRef<SearchCreateResponse | null>(null);
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

  const runCheck = async () => {
    if (!draft || !actions) return;
    const key = planKey;
    setResult(null);
    setCheckFailure(null);
    setChecking(true);
    try {
      const response = await actions.checkPlan({ plan: draft, workspace: current.id });
      if (response.ok) setCheck({ key, check: response.check });
      else setCheckFailure({ message: response.message, problems: response.problems ?? [] });
    } catch {
      setCheckFailure({ message: UNREACHABLE, problems: [] });
    } finally {
      setChecking(false);
    }
  };

  const showResult = (response: SearchCreateResponse) => {
    setResult(response);
    if (!response.ok && response.recheck) setCheck(null);
  };

  // Rezultatul apare abia după ce dialogul se închide: altfel focusul revine pe buton și îl pierde.
  const runCreate = async () => {
    if (!draft || !freshCheck || !actions) return;
    setCreating(true);
    let response: SearchCreateResponse;
    try {
      response = await actions.createPaused({ plan: draft, workspace: current.id, fingerprint: freshCheck.fingerprint });
    } catch {
      response = { ok: false, message: UNREACHABLE };
    }
    setCreating(false);
    if (confirmOpen.current) pendingResult.current = response;
    else showResult(response);
  };

  const changeConfirm = (open: boolean) => {
    confirmOpen.current = open;
    setConfirm(open);
    if (!open && pendingResult.current) {
      showResult(pendingResult.current);
      pendingResult.current = null;
    }
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

  const loadExample = () => {
    setText(exampleSearchPlanFor(current.id));
    setCheck(null);
    setResult(null);
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
    <div className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start">
      <ConfirmDialog
        open={confirm}
        onOpenChange={changeConfirm}
        title="Creezi planul pe pauză?"
        description={`${campaignCount === 1 ? "O campanie de căutare" : `${countOf(campaignCount, "campanii")} de căutare`} în ${freshCheck?.account?.name ?? "contul din plan"}.`}
        consequence="Totul pleacă într-o singură cerere, totul sau nimic, cu toate campaniile oprite. Pornirea rămâne la tine, în Google Ads."
        confirmLabel="Creează pe pauză"
        tone="primary"
        onConfirm={runCreate}
      />

      {/* ------------------------------------------------------------ 1. JSON */}
      <Card as="section" aria-labelledby="search-json" className="flex min-w-0 flex-col lg:sticky lg:top-20">
        <SectionTitle
          title={<span id="search-json">1. Planul de căutare</span>}
          hint="Lipește planul primit. Se citește singur — nu trebuie apăsat nimic."
          action={
            <Btn size="xs" variant="ghost" icon={Wand2} onClick={loadExample} disabled={busy}>
              Încarcă exemplul
            </Btn>
          }
        />
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
            "mt-3 h-[22rem] w-full resize-y whitespace-pre rounded-xl border border-white/[0.1] bg-[#0A0A0E] p-3 font-mono text-[11.5px] leading-relaxed text-foreground/85 outline-none placeholder:text-muted-foreground/50 focus:border-lav/50 lg:h-[calc(100dvh-24rem)] lg:min-h-[22rem]",
            syntax && "!border-rose/50"
          )}
        />
        <div className="mt-1.5 text-right font-mono text-[10.5px] text-muted-foreground">{text ? countOf(text.split("\n").length, "rânduri") : "gol"}</div>

        <div id="search-status" className="mt-2 min-h-6 text-[12px] leading-snug">
          {syntax ? (
            <InlineNote tone="rose">
              <p>{syntax.message}</p>
              <div className="mt-2 flex flex-wrap gap-3">
                {syntax.fix === "smart_quotes" ? (
                  <button type="button" onClick={() => setText(replaceSmartQuotes(text))} className={linkClass}>
                    Înlocuiește ghilimelele
                  </button>
                ) : null}
                {syntax.fix === "video" ? (
                  <button type="button" onClick={() => moveTo(VIDEO_STORAGE_KEY, "/admin/ads/nou")} className={linkClass}>
                    Deschide în „Plan nou”
                  </button>
                ) : null}
                {syntax.fix === "batch" ? (
                  <button type="button" onClick={() => moveTo(BATCH_STORAGE_KEY, "/admin/ads/lot")} className={linkClass}>
                    Deschide lotul
                  </button>
                ) : null}
              </div>
            </InlineNote>
          ) : draft ? (
            <InlineNote tone={errorCount > 0 ? "rose" : "mint"}>{status}</InlineNote>
          ) : (
            <p className="text-muted-foreground">Nimic de citit încă.</p>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {text ? (
            <CopyButton value={text} label="Copiază JSON-ul" size="xs" variant="ghost" />
          ) : (
            <Btn size="xs" variant="ghost" disabled>
              Copiază JSON-ul
            </Btn>
          )}
          <Btn
            size="xs"
            variant="ghost"
            icon={Eraser}
            disabled={!text || busy}
            onClick={() => {
              setText("");
              setCheck(null);
              setResult(null);
              setCheckFailure(null);
              textareaRef.current?.focus();
            }}
          >
            Golește
          </Btn>
        </div>
      </Card>

      {/* ------------------------------------------- 2. Citit + 3. Verificare */}
      <section aria-labelledby="search-preview" className="min-w-0 space-y-4">
        <h2 id="search-preview" className="sr-only">
          Ce se creează
        </h2>
        <p role="status" className="sr-only">
          {status}
        </p>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <Stamp>Se creează oprită</Stamp>
          <span className="text-[11.5px] text-muted-foreground">Portalul nu are niciun buton care pornește o campanie. O activezi tu, din Google Ads.</span>
        </div>

        {!draft || !summary || !validation ? (
          <Card className="p-0">
            <EmptyState
              icon={FileJson}
              title="Aici citești campaniile de căutare"
              text="Lipește planul în stânga: vezi fiecare campanie cu bugetul, zonele și programul ei, cuvintele cheie pe grupuri, negativele și anunțurile arătate cum apar în Google."
              action={
                <Btn size="sm" variant="primary" icon={Wand2} onClick={loadExample}>
                  Încarcă exemplul comentat
                </Btn>
              }
              hint="Două campanii pentru o firmă inventată, cu o listă comună și toate tipurile de materiale. Conflictele dintre negative și cuvinte le găsește portalul."
            />
          </Card>
        ) : (
          <div className={cn("space-y-4 transition-opacity duration-150", syntax && "pointer-events-none opacity-50")}>
            <div className="space-y-2">
              <PlanProbleme
                title={validation.errors.length === 1 ? "Un lucru de corectat" : `${countOf(validation.errors.length, "lucruri")} de corectat`}
                problems={validation.errors}
                tone="error"
              />
              <PlanProbleme
                title={validation.warnings.length === 1 ? "Un lucru de citit" : `${countOf(validation.warnings.length, "lucruri")} de citit`}
                problems={validation.warnings}
                tone="warning"
              />
            </div>
            <CautariPlanPreview
              title="2. Citit în română"
              summary={summary}
              operations={validation.operations}
              errorPaths={errorPaths}
              accountLabel={summary.account}
              volumes={freshCheck?.volumes ?? null}
            />
            {check ? <CautariPlanCheck check={check.check} stale={check.key !== planKey} /> : null}
          </div>
        )}

        {checkFailure ? (
          <div role="alert" className="space-y-2">
            <InlineNote tone="rose">
              <p className="text-[13px] font-semibold">Verificarea pe Google n-a mers.</p>
              <p className="mt-1.5">{checkFailure.message}</p>
            </InlineNote>
            <PlanProbleme title="De corectat" problems={checkFailure.problems} tone="error" />
          </div>
        ) : null}

        {result ? <CautariPlanResult result={result} /> : null}

        <Card padded={false} className="z-10 p-4 lg:sticky lg:bottom-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 flex-1 basis-60">
              <h3 className="flex items-center gap-1.5 text-[13px] font-semibold">
                <ShieldCheck className="h-3.5 w-3.5 text-mint" aria-hidden="true" />
                3. Verificare în Google
              </h3>
              <p id="search-reason" className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground" aria-live="polite">
                {checking
                  ? "Google caută contul, numele campaniilor și listelor, locațiile, conversiile de apel și adresele, apoi verifică toată crearea, fără să creeze nimic…"
                  : creating
                    ? "Se creează tot planul într-o singură cerere: totul sau nimic. Nu închide pagina."
                    : step.reason}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              {step.action === "check" ? (
                <Btn variant="primary" size="md" onClick={runCheck} disabled={busy} aria-describedby="search-reason">
                  {checking ? "Se verifică în Google…" : check ? "Verifică din nou" : "Verifică în Google"}
                </Btn>
              ) : null}
              <Btn
                variant={step.action === "create" ? "primary" : "outline"}
                size="md"
                iconRight={ArrowRight}
                onClick={() => changeConfirm(true)}
                disabled={step.action !== "create" || busy}
                aria-describedby="search-reason"
              >
                {creating ? "Se creează pe pauză…" : "Creează pe pauză"}
              </Btn>
              {step.action === "create" ? (
                <Btn variant="outline" size="md" onClick={runCheck} disabled={busy}>
                  {checking ? "Se verifică…" : "Verifică din nou"}
                </Btn>
              ) : null}
            </div>
          </div>
        </Card>
      </section>
    </div>
  );
}
