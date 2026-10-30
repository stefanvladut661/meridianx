"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { OBJECTIVE_LABEL, PLATFORM_LABEL, type Objective } from "@/lib/ads/constants";
import { exampleBatchFor } from "@/lib/ads/example-plan";
import { countOf, formatMoney, rawVideosOf } from "@/lib/ads/plan-derive";
import { BATCH_MAX, budgetTotals, problemsForClaude, readBatch, type BatchItem } from "@/lib/ads/plan-batch";
import { replaceSmartQuotes } from "@/lib/ads/plan-json";
import { asRecord, getIn } from "@/lib/ads/plan-path";
import type { PlanProblem } from "@/lib/ads/plan-validate";
import { managerName } from "@/lib/ads/links";
import type { CheckResponse, CreateResponse, JobView, PlatformCheck } from "@/lib/ads/types";
import type { WorkspaceSummary } from "@/lib/ads/workspaces";
import { cn } from "@/lib/utils";
import { PauseSeal } from "./pause-seal";
import { ProblemList } from "./problem-list";
import { ERROR_DOT, ERROR_TEXT, FIELD, OK_DOT, OK_TEXT, WARNING_DOT, WARNING_TEXT } from "./tone";

/**
 * /admin/ads/lot — mai multe planuri odată.
 *
 * Același drum ca la un plan singur, pe rânduri: lipești lotul → fiecare
 * plan se validează pe loc → „Verifică tot" citește conturile reale, plan
 * cu plan → „Creează pe pauză" creează doar planurile verificate fără
 * erori, tot oprite. Corecturile nu se fac aici: problemele se copiază
 * pentru conversația în care s-a scris lotul, iar răspunsul ei se lipește
 * înapoi. Un plan creat deja (în ultimele două săptămâni) se sare.
 */

const STORAGE_KEY = "meridian_ads_batch";
const PARSE_DELAY = 250;
const UNREACHABLE = "Serverul n-a răspuns (rețea sau sesiune). Nu s-a trimis nimic spre platformă.";

type CheckState =
  | { state: "checking" }
  | { state: "done"; check: PlatformCheck }
  | { state: "failed"; message: string; problems: PlanProblem[] };

type CreateState =
  | { state: "creating" }
  /** v2: crearea pe pași merge sau așteaptă limita de cereri a platformei. */
  | { state: "waiting"; job: JobView }
  | { state: "done"; result: Extract<CreateResponse, { ok: true }> }
  | { state: "failed"; result: Extract<CreateResponse, { ok: false }> };

export interface BatchEditorActions {
  checkBatchPlan: (input: { plan: unknown; screenWorkspace: string }) => Promise<CheckResponse>;
  createBatchPlan: (input: { plan: unknown; screenWorkspace: string; fingerprint: string }) => Promise<CreateResponse>;
  /** v2: „Continuă” o creare pe pași, de unde a rămas. */
  continueJob?: (input: { jobId: string }) => Promise<CreateResponse>;
}

const clockTime = new Intl.DateTimeFormat("ro-RO", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Bucharest" });

interface Row {
  item: BatchItem;
  tokenConfigured: boolean;
  needsUpload: boolean;
  check: CheckState | undefined;
  create: CreateState | undefined;
}

type Tone = "ok" | "warning" | "error" | "busy" | "none";

function rowStatus(row: Row): { tone: Tone; text: string; link: string | null } {
  const { item, check, create } = row;
  if (create?.state === "creating") return { tone: "busy", text: "Se creează pe pauză…", link: null };
  if (create?.state === "waiting") {
    const { job } = create;
    const step = `pasul ${job.stepsDone + 1} din ${job.stepsTotal}`;
    return job.status === "waiting" && job.waitUntil
      ? { tone: "busy", text: `${PLATFORM_LABEL[job.platform]} a cerut o pauză — reiau la ${clockTime.format(new Date(job.waitUntil))}, de la ${step}`, link: job.adsManagerUrl }
      : { tone: "busy", text: `Se creează pe pauză — ${step}`, link: job.adsManagerUrl };
  }
  if (create?.state === "done") return { tone: "ok", text: "Creată — oprită", link: create.result.adsManagerUrl };
  if (create?.state === "failed") {
    const result = create.result;
    if (result.duplicate) return { tone: "warning", text: "Creată deja — sărită", link: result.duplicate.adsManagerUrl };
    if (result.partial) return { tone: "error", text: "Creată pe jumătate — oprită", link: result.partial.adsManagerUrl };
    return { tone: "error", text: "Crearea a eșuat", link: null };
  }
  if (check?.state === "checking") return { tone: "busy", text: "Se verifică…", link: null };
  if (check?.state === "done") {
    return check.check.ok
      ? { tone: "ok", text: "Verificat — gata de creat", link: null }
      : {
          tone: "error",
          text: `${PLATFORM_LABEL[check.check.platform]}: ${check.check.errors.length === 1 ? "un lucru" : countOf(check.check.errors.length, "lucruri")} de corectat`,
          link: null,
        };
  }
  if (check?.state === "failed") return { tone: "error", text: "Verificarea n-a mers", link: null };
  if (!item.valid) {
    return {
      tone: "error",
      text: `${item.errors.length === 1 ? "Un lucru" : countOf(item.errors.length, "lucruri")} de corectat`,
      link: null,
    };
  }
  if (!row.tokenConfigured) return { tone: "warning", text: "Spațiul n-are token", link: null };
  if (row.needsUpload) return { tone: "warning", text: "Video-ul trebuie urcat întâi", link: null };
  return { tone: "none", text: "Valid — de verificat", link: null };
}

const TONE_TEXT: Record<Tone, string> = {
  ok: OK_TEXT,
  warning: WARNING_TEXT,
  error: ERROR_TEXT,
  busy: "text-bone/80",
  none: "text-dim",
};

const TONE_DOT: Record<Tone, string> = {
  ok: OK_DOT,
  warning: WARNING_DOT,
  error: ERROR_DOT,
  busy: "bg-bone/70 motion-safe:animate-pulse",
  none: "border border-hair-strong",
};

/** Ce probleme are rândul, din orice pas — pentru lista de copiat. */
function rowProblems(row: Row): PlanProblem[] {
  const { item, check, create } = row;
  if (create?.state === "failed" && !create.result.duplicate) {
    return [{ path: "", message: create.result.message }, ...(create.result.problems ?? [])];
  }
  if (check?.state === "failed") return [{ path: "", message: check.message }, ...check.problems];
  if (check?.state === "done" && !check.check.ok) return check.check.errors;
  if (!item.valid) return item.errors;
  return [];
}

function CheckSummary({ check }: { check: PlatformCheck }) {
  const names = [...check.locations, ...check.languages, ...check.interests, ...check.behaviors];
  const facts = [
    check.account ? `Contul: ${check.account.name} (${check.account.currency})` : "Contul: nu se vede",
    check.identity ? `${check.platform === "meta" ? "Pagina" : check.platform === "tiktok" ? "Identitatea" : "Firma"}: ${check.identity.name}` : null,
    check.pixel ? `${check.platform === "google" ? "Conversia" : "Pixelul"}: ${check.pixel.name}` : null,
    check.video ? `Video: ${check.video.title ?? check.video.id}${check.video.ready ? "" : " (încă se procesează)"}` : null,
  ].filter(Boolean);
  return (
    <div className="space-y-2 text-[13.5px] leading-snug text-bone/80">
      <ul className="space-y-1">
        {facts.map((fact) => (
          <li key={fact}>{fact}</li>
        ))}
      </ul>
      {names.length > 0 ? (
        <p className="text-dim">
          Targetarea, cum a înțeles-o {PLATFORM_LABEL[check.platform]}:{" "}
          {names.map((name) => `${name.asked} → ${name.found ?? "negăsit"}`).join(" · ")}
        </p>
      ) : null}
    </div>
  );
}

export function BatchEditor({
  workspaces,
  currentWorkspaceId,
  actions,
}: {
  workspaces: WorkspaceSummary[];
  currentWorkspaceId: string;
  actions: BatchEditorActions;
}) {
  const current = workspaces.find((workspace) => workspace.id === currentWorkspaceId) ?? workspaces[0];
  const owner = current.owner;

  const [text, setText] = useState("");
  const [parsedText, setParsedText] = useState("");
  const [restored, setRestored] = useState(false);
  const [checks, setChecks] = useState<Record<string, CheckState>>({});
  const [creates, setCreates] = useState<Record<string, CreateState>>({});
  const [run, setRun] = useState<{ kind: "check" | "create"; done: number; total: number; name: string } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [copied, setCopied] = useState<"problems" | "json" | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const stopRef = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Lotul supraviețuiește unui refresh în același tab (ca planul singur).
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) {
        setText(saved);
        setParsedText(saved);
      }
    } catch {
      /* fără stocare — pornim gol */
    }
    setRestored(true);
  }, []);

  useEffect(() => {
    if (!restored) return;
    try {
      if (text) sessionStorage.setItem(STORAGE_KEY, text);
      else sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* lotul trăiește doar în pagină */
    }
    const timer = window.setTimeout(() => setParsedText(text), PARSE_DELAY);
    return () => window.clearTimeout(timer);
  }, [text, restored]);

  const batch = useMemo(() => (parsedText.trim() ? readBatch(parsedText, owner) : null), [parsedText, owner]);
  const items = batch?.ok ? batch.items : [];

  const rows: Row[] = items.map((item) => {
    const summary = workspaces.find((workspace) => workspace.id === item.workspace?.id);
    return {
      item,
      tokenConfigured: summary?.tokenConfigured ?? false,
      needsUpload: rawVideosOf(item.record).some(({ value }) => asRecord(value)?.source === "upload"),
      check: checks[item.key],
      create: creates[item.key],
    };
  });

  const isCreated = (row: Row) =>
    row.create?.state === "done" || (row.create?.state === "failed" && Boolean(row.create.result.duplicate || row.create.result.partial));
  const checkable = rows.filter((row) => row.item.valid && row.tokenConfigured && !row.needsUpload && !isCreated(row));
  const creatable = rows.filter(
    (row) => row.check?.state === "done" && row.check.check.ok && !isCreated(row) && row.create?.state !== "creating" && row.create?.state !== "waiting"
  );
  const created = rows.filter((row) => row.create?.state === "done");
  const problemRows = rows.filter((row) => rowProblems(row).length > 0);
  const busy = run !== null;

  const runChecks = async () => {
    const targets = checkable;
    if (targets.length === 0) return;
    stopRef.current = false;
    setConfirming(false);
    for (const [position, row] of targets.entries()) {
      if (stopRef.current) break;
      setRun({ kind: "check", done: position, total: targets.length, name: row.item.name });
      setChecks((previous) => ({ ...previous, [row.item.key]: { state: "checking" } }));
      let next: CheckState;
      try {
        const response = await actions.checkBatchPlan({ plan: row.item.raw, screenWorkspace: current.id });
        next = response.ok
          ? { state: "done", check: response.check }
          : { state: "failed", message: response.message, problems: response.problems ?? [] };
      } catch {
        next = { state: "failed", message: UNREACHABLE, problems: [] };
      }
      setChecks((previous) => ({ ...previous, [row.item.key]: next }));
    }
    setRun(null);
    setAnnouncement(stopRef.current ? "Verificarea lotului s-a oprit." : "Verificarea lotului s-a terminat.");
  };

  const runCreates = async () => {
    const targets = creatable;
    if (targets.length === 0) return;
    stopRef.current = false;
    setConfirming(false);
    for (const [position, row] of targets.entries()) {
      if (stopRef.current) break;
      const check = row.check?.state === "done" ? row.check.check : null;
      if (!check) continue;
      setRun({ kind: "create", done: position, total: targets.length, name: row.item.name });
      setCreates((previous) => ({ ...previous, [row.item.key]: { state: "creating" } }));
      let next: CreateState;
      try {
        let response = await actions.createBatchPlan({
          plan: row.item.raw,
          screenWorkspace: current.id,
          fingerprint: check.fingerprint,
        });
        // v2: o creare pe pași care așteaptă limita platformei se reia aici, la ora
        // spusă, înainte de planul următor (lotul nu sare peste ea în tăcere).
        while (!response.ok && response.job && actions.continueJob && (response.job.status === "running" || response.job.status === "waiting")) {
          const job = response.job;
          setCreates((previous) => ({ ...previous, [row.item.key]: { state: "waiting", job } }));
          const until = job.status === "waiting" && job.waitUntil ? Date.parse(job.waitUntil) : 0;
          while (Date.now() < until && !stopRef.current) await new Promise((resolve) => window.setTimeout(resolve, 1000));
          if (stopRef.current) break;
          response = await actions.continueJob({ jobId: job.id });
        }
        next = response.ok ? { state: "done", result: response } : response.job && !response.partial ? { state: "waiting", job: response.job } : { state: "failed", result: response };
        // Verificarea veche nu mai e de încredere: s-a schimbat ceva de atunci.
        if (!response.ok && response.recheck) {
          setChecks((previous) => {
            const copy = { ...previous };
            delete copy[row.item.key];
            return copy;
          });
        }
      } catch {
        next = { state: "failed", result: { ok: false, message: UNREACHABLE } };
      }
      setCreates((previous) => ({ ...previous, [row.item.key]: next }));
    }
    setRun(null);
    setAnnouncement(stopRef.current ? "Crearea lotului s-a oprit." : "Crearea lotului s-a terminat.");
  };

  const copy = async (what: "problems" | "json") => {
    const value =
      what === "json"
        ? text
        : problemsForClaude(
            problemRows.map((row) => ({
              index: row.item.index,
              name: row.item.name,
              workspaceId: row.item.workspace?.id ?? null,
              problems: rowProblems(row),
            }))
          );
    try {
      await navigator.clipboard.writeText(value);
      setCopied(what);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      textareaRef.current?.select();
    }
  };

  // Ce s-ar crea acum, pe spații, și cât ar costa pe zi dacă le pornești pe toate.
  const toCreateByWorkspace = new Map<string, number>();
  for (const row of creatable) {
    const name = row.item.workspace ? workspaces.find((workspace) => workspace.id === row.item.workspace?.id)?.name : null;
    if (name) toCreateByWorkspace.set(name, (toCreateByWorkspace.get(name) ?? 0) + 1);
  }
  const creatableTotals = budgetTotals(creatable.map((row) => row.item));
  const allTotals = budgetTotals(items.filter((item) => item.valid));
  const validCount = items.filter((item) => item.valid).length;
  const checkedOk = rows.filter((row) => row.check?.state === "done" && row.check.check.ok).length;

  const syntax = batch && !batch.ok ? batch : null;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start xl:gap-12">
      {/* ---------------------------------------------------------- JSON */}
      <section aria-labelledby="batch-json" className="min-w-0 lg:sticky lg:top-[7.75rem]">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="batch-json" className="eyebrow">
            Lotul · JSON
          </h2>
          <p className="font-md-mono text-[11px] tabular-nums text-dim">
            {items.length > 0 ? countOf(items.length, "planuri") : text ? countOf(text.split("\n").length, "rânduri") : "gol"}
          </p>
        </div>
        <label htmlFor="batch-text" className="sr-only">
          Lotul de planuri, în format JSON
        </label>
        <textarea
          id="batch-text"
          ref={textareaRef}
          value={text}
          onChange={(event) => setText(event.target.value)}
          readOnly={busy}
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          aria-describedby="batch-status"
          aria-invalid={syntax ? true : undefined}
          placeholder={'{\n  "plans": [\n    { "workspace": "meta-meridian", … },\n    { "workspace": "tiktok-meridian", … }\n  ]\n}'}
          className={cn(
            FIELD,
            "mt-3 h-[20rem] resize-y whitespace-pre py-3 font-md-mono text-[12.5px] leading-[1.6] lg:h-[calc(100dvh-17rem)] lg:min-h-[24rem]",
            syntax && "!border-[#d93025]/60"
          )}
        />
        <div id="batch-status" className="mt-3 min-h-6 text-[13.5px] leading-snug">
          {syntax ? (
            <div className={ERROR_TEXT}>
              <p>{syntax.message}</p>
              {syntax.fix === "smart_quotes" ? (
                <button
                  type="button"
                  onClick={() => setText(replaceSmartQuotes(text))}
                  className="mt-2 underline underline-offset-4 hover:text-bone"
                >
                  Înlocuiește ghilimelele
                </button>
              ) : null}
            </div>
          ) : batch?.ok ? (
            <p className={validCount === items.length ? OK_TEXT : ERROR_TEXT}>
              {validCount === items.length
                ? `${items.length === 1 ? "Un plan valid" : `Toate cele ${items.length} planuri sunt valide`}.`
                : `${validCount} din ${items.length} valide · ${countOf(items.length - validCount, "planuri")} de corectat.`}
              {batch.tooMany ? ` Lotul avea mai mult de ${BATCH_MAX} de planuri: s-au citit primele ${BATCH_MAX}.` : ""}
            </p>
          ) : (
            <p className="text-dim">Lipește lotul primit din conversație. Se citește singur.</p>
          )}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setText(exampleBatchFor(owner))}
            disabled={busy}
            className="btn btn-ghost !min-h-10 !px-4 !py-2 !text-[13px] disabled:opacity-40"
          >
            Încarcă exemplul
          </button>
          <button
            type="button"
            onClick={() => copy("json")}
            disabled={!text}
            className="btn btn-ghost !min-h-10 !px-4 !py-2 !text-[13px] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {copied === "json" ? "Copiat" : "Copiază JSON-ul"}
          </button>
          <button
            type="button"
            onClick={() => {
              setText("");
              setChecks({});
              setCreates({});
              textareaRef.current?.focus();
            }}
            disabled={!text || busy}
            className="btn btn-ghost !min-h-10 !px-4 !py-2 !text-[13px] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Golește
          </button>
        </div>
        <p className="mt-4 text-[13px] leading-relaxed text-dim">
          Formatul și contextul conturilor, gata de dat conversației care scrie lotul:{" "}
          <Link href="/admin/ads/claude" className="text-bone/85 underline underline-offset-4 hover:text-bone">
            Pentru Claude
          </Link>
          .
        </p>
      </section>

      {/* ---------------------------------------------------------- Rândurile */}
      <section aria-labelledby="batch-rows" className="min-w-0">
        <h2 id="batch-rows" className="sr-only">
          Planurile din lot
        </h2>
        <p role="status" className="sr-only">
          {announcement}
        </p>

        <PauseSeal />

        {items.length === 0 ? (
          <div className="mt-6 rounded-panel-lg border border-dashed border-hair-strong px-6 py-10 text-center">
            <p className="font-md-display text-[1.375rem] font-semibold text-bone">Un lot = mai multe campanii odată.</p>
            <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-bone/70">
              Aceeași reclamă pe Meta, TikTok și Google, sau zece variante de public. Fiecare plan se verifică
              pe contul lui și se creează oprit; un plan creat deja se sare.
            </p>
            <button type="button" onClick={() => setText(exampleBatchFor(owner))} className="btn btn-light mt-6">
              Încarcă un lot de exemplu
            </button>
            <p className="mt-3 text-[13px] text-dim">
              Lotul e pentru {owner === "clienti" ? "banii clienților" : "reclamele agenției"} — spațiul ales sus.
            </p>
          </div>
        ) : (
          <>
            <div className="mt-6 rounded-panel-lg border border-hair bg-char/60 px-5 py-5 sm:px-7">
              <p className="font-md-display text-[1.375rem] font-semibold leading-snug tracking-tight text-bone sm:text-[1.5rem]">
                {items.length === 1 ? "Un plan" : countOf(items.length, "planuri")} pentru{" "}
                {owner === "clienti" ? "banii clienților" : "reclamele agenției"}.
              </p>
              <p className="mt-2 text-[14.5px] leading-relaxed text-bone/75">
                {validCount} valide · {checkedOk} verificate · {created.length} create
                {allTotals.length > 0
                  ? ` · ${allTotals.map((total) => formatMoney(total.amount, total.currency)).join(" + ")} pe zi dacă pornești tot ce e valid`
                  : ""}
                .
              </p>
            </div>

            <ol className="mt-6 space-y-3">
              {rows.map((row) => {
                const status = rowStatus(row);
                const problems = rowProblems(row);
                const objective = getIn(row.item.record, "campaign.objective");
                const facts = [
                  row.item.kind === "search"
                    ? row.item.searchFacts
                    : typeof objective === "string" && objective in OBJECTIVE_LABEL
                      ? OBJECTIVE_LABEL[objective as Objective]
                      : null,
                  row.item.dailyBudget !== null ? `${formatMoney(row.item.dailyBudget, row.item.currency)} pe zi` : null,
                  row.item.summary ? (row.item.summary.ads.length === 1 ? "1 reclamă" : countOf(row.item.summary.ads.length, "reclame")) : null,
                ].filter(Boolean);
                const workspace = row.item.workspace ? workspaces.find((item) => item.id === row.item.workspace?.id) : null;
                return (
                  <li key={`${row.item.index}-${row.item.key.length}`} className="rounded-panel-lg border border-hair bg-ink/40">
                    <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-5">
                      <div className="flex min-w-0 gap-3">
                        <span aria-hidden className={cn("mt-[7px] h-2 w-2 shrink-0 rounded-full", TONE_DOT[status.tone])} />
                        <div className="min-w-0">
                          <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                            <span className="font-md-mono text-[11.5px] tabular-nums text-dim">
                              {String(row.item.index + 1).padStart(2, "0")}
                            </span>
                            <span className="min-w-0 break-words text-[15px] font-semibold text-bone">{row.item.name}</span>
                          </p>
                          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-bone/70">
                            {workspace ? (
                              <span
                                className={cn(
                                  "rounded-full border px-2 py-0.5 font-md-mono text-[11px]",
                                  workspace.owner === "clienti" ? "border-[#f0b429]/50 text-[var(--ap-warn)]" : "border-hair-strong text-bone/80"
                                )}
                              >
                                {workspace.name}
                              </span>
                            ) : (
                              <span className={cn("font-md-mono text-[11px]", ERROR_TEXT)}>spațiu necunoscut</span>
                            )}
                            {facts.length > 0 ? <span>{facts.join(" · ")}</span> : null}
                          </p>
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 pl-5 sm:pl-0 sm:text-right">
                        <span className={cn("text-[13.5px] font-medium", TONE_TEXT[status.tone])}>{status.text}</span>
                        {status.link && row.item.workspace ? (
                          <a
                            href={status.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[13px] text-bone underline underline-offset-4 hover:text-bone/80"
                          >
                            {managerName(row.item.workspace.platform)}
                            <span aria-hidden> ↗</span>
                            <span className="sr-only"> (se deschide într-un tab nou)</span>
                          </a>
                        ) : null}
                      </div>
                    </div>

                    {problems.length > 0 || row.item.warnings.length > 0 || row.check?.state === "done" || row.create ? (
                      <details className="group border-t border-hair">
                        <summary className="cursor-pointer list-none px-4 py-2.5 text-[13px] text-dim hover:text-bone sm:px-5 [&::-webkit-details-marker]:hidden">
                          <span aria-hidden className="mr-1.5 inline-block transition-transform duration-150 group-open:rotate-90">
                            ›
                          </span>
                          Detalii
                          {problems.length > 0 ? ` · ${problems.length === 1 ? "o problemă" : countOf(problems.length, "probleme")}` : ""}
                          {row.item.warnings.length > 0
                            ? ` · ${row.item.warnings.length === 1 ? "un lucru de citit" : countOf(row.item.warnings.length, "lucruri de citit")}`
                            : ""}
                        </summary>
                        <div className="space-y-3 px-4 pb-4 sm:px-5">
                          {row.create?.state === "failed" ? (
                            <p className={cn("text-[14px] leading-snug", row.create.result.duplicate ? WARNING_TEXT : ERROR_TEXT)}>
                              {row.create.result.message}
                            </p>
                          ) : null}
                          {row.create?.state === "done" && row.create.result.storeWarning ? (
                            <p className={cn("text-[14px] leading-snug", WARNING_TEXT)}>{row.create.result.storeWarning}</p>
                          ) : null}
                          {row.check?.state === "done" ? <CheckSummary check={row.check.check} /> : null}
                          <ProblemList
                            title={problems.length === 1 ? "De corectat" : `De corectat (${problems.length})`}
                            problems={problems}
                            tone="error"
                            linked={false}
                          />
                          <ProblemList
                            title="De citit"
                            problems={[...row.item.warnings, ...(row.check?.state === "done" ? row.check.check.warnings : [])]}
                            tone="warning"
                            linked={false}
                          />
                        </div>
                      </details>
                    ) : null}
                  </li>
                );
              })}
            </ol>
          </>
        )}

        {/* ---------------------------------------------------- Acțiunile */}
        {items.length > 0 ? (
          <div className="mt-4 rounded-panel-lg border border-hair bg-ink/92 px-4 py-4 lg:sticky lg:bottom-0 lg:z-10 lg:rounded-b-none lg:backdrop-blur-md sm:px-6">
            {confirming ? (
              <div className="space-y-3">
                <p className="text-[14.5px] leading-relaxed text-bone">
                  Se creează {creatable.length === 1 ? "o campanie" : countOf(creatable.length, "campanii")}, toate oprite:{" "}
                  {[...toCreateByWorkspace.entries()].map(([name, count]) => `${count} în ${name}`).join(", ")}.
                  {creatableTotals.length > 0
                    ? ` Dacă le pornești pe toate: ${creatableTotals.map((total) => formatMoney(total.amount, total.currency)).join(" + ")} pe zi.`
                    : ""}
                </p>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={runCreates} className="btn btn-light">
                    Creează {creatable.length} pe pauză
                  </button>
                  <button type="button" onClick={() => setConfirming(false)} className="btn btn-ghost">
                    Renunță
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                <div className="flex shrink-0 flex-wrap gap-2">
                  {busy ? (
                    <button
                      type="button"
                      onClick={() => {
                        stopRef.current = true;
                      }}
                      className="btn btn-ghost"
                    >
                      Oprește după planul ăsta
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={runChecks}
                        disabled={checkable.length === 0}
                        className={cn(
                          "btn disabled:cursor-not-allowed disabled:opacity-45",
                          creatable.length > 0 ? "btn-ghost" : "btn-light"
                        )}
                      >
                        {checkable.length === 0
                          ? "Nimic de verificat"
                          : checkable.every((row) => row.check?.state === "done")
                            ? `Verifică din nou (${checkable.length})`
                            : `Verifică tot (${checkable.length})`}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirming(true)}
                        disabled={creatable.length === 0}
                        className={cn(
                          "btn disabled:cursor-not-allowed disabled:opacity-45",
                          creatable.length > 0 ? "btn-light" : "btn-ghost"
                        )}
                      >
                        Creează pe pauză{creatable.length > 0 ? ` (${creatable.length})` : ""}
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => copy("problems")}
                    disabled={problemRows.length === 0}
                    className="btn btn-ghost disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    {copied === "problems"
                      ? "Copiat"
                      : `Copiază problemele pentru Claude${problemRows.length > 0 ? ` (${problemRows.length})` : ""}`}
                  </button>
                </div>
                <p className="text-[13.5px] leading-snug text-bone/75" aria-live="polite">
                  {run
                    ? `${run.kind === "check" ? "Se verifică" : "Se creează pe pauză"} ${run.done + 1} din ${run.total}: „${run.name}”…`
                    : creatable.length > 0
                      ? `${creatable.length === 1 ? "Un plan verificat" : countOf(creatable.length, "planuri verificate")}, gata de creat — oprite.`
                      : checkable.length > 0
                        ? "Întâi verificarea pe conturile reale: contul, pagina sau identitatea, pixelul, video-ul, targetarea."
                        : problemRows.length > 0
                          ? "Copiază problemele, dă-le conversației și lipește aici lotul corectat."
                          : created.length > 0
                            ? "Lotul e creat. Campaniile te așteaptă oprite în platforme."
                            : "Niciun plan gata de verificat."}
                </p>
              </div>
            )}
          </div>
        ) : null}
      </section>
    </div>
  );
}
