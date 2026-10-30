"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight, Copy, ExternalLink, Layers, Loader2, Play, ShieldCheck, Square, Wand2, CheckCircle2 } from "lucide-react";
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
import { ConfirmDialog, InlineNote } from "../ui/actions";
import { Btn, btnClass, Card, Pill, SectionTitle, type PillTone } from "../ui/primitives";
import { EmptyState, ProgressBar } from "../ui/states";
import { useToast } from "../ui/toast";
import { ProblemList } from "./problem-list";
import { WorkspacePicker } from "./workspace-picker";

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
  /** Schimbă spațiul de lucru (cookie); spațiul nu mai are bară sus, deci îl alege ecranul. */
  chooseWorkspace?: (formData: FormData) => Promise<void>;
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

const TONE_PILL: Record<Tone, PillTone> = {
  ok: "mint",
  warning: "apricot",
  error: "rose",
  busy: "sky",
  none: "neutral",
};

/** Eticheta scurtă din Pill (ca în prototip) și, dedesubt, propoziția care o explică. */
function rowStatus(row: Row): { tone: Tone; label: string; detail: string | null; link: string | null } {
  const { item, check, create } = row;
  if (create?.state === "creating") return { tone: "busy", label: "Se creează pe pauză", detail: null, link: null };
  if (create?.state === "waiting") {
    const { job } = create;
    const step = `pasul ${job.stepsDone + 1} din ${job.stepsTotal}`;
    return job.status === "waiting" && job.waitUntil
      ? { tone: "busy", label: "Așteaptă platforma", detail: `${PLATFORM_LABEL[job.platform]} a cerut o pauză — reiau la ${clockTime.format(new Date(job.waitUntil))}, de la ${step}`, link: job.adsManagerUrl }
      : { tone: "busy", label: "Se creează pe pauză", detail: `Se creează pe pauză — ${step}`, link: job.adsManagerUrl };
  }
  if (create?.state === "done") return { tone: "ok", label: "Creată pe pauză", detail: "Creată — oprită", link: create.result.adsManagerUrl };
  if (create?.state === "failed") {
    const result = create.result;
    if (result.duplicate) return { tone: "warning", label: "Creată deja — sărită", detail: null, link: result.duplicate.adsManagerUrl };
    if (result.partial) return { tone: "error", label: "Creată pe jumătate", detail: "Ce s-a creat e oprit.", link: result.partial.adsManagerUrl };
    return { tone: "error", label: "Crearea a eșuat", detail: null, link: null };
  }
  if (check?.state === "checking") return { tone: "busy", label: "Se verifică", detail: null, link: null };
  if (check?.state === "done") {
    return check.check.ok
      ? { tone: "ok", label: "Verificat", detail: "Verificat — gata de creat", link: null }
      : {
          tone: "error",
          label: "Problemă",
          detail: `${PLATFORM_LABEL[check.check.platform]}: ${check.check.errors.length === 1 ? "un lucru" : countOf(check.check.errors.length, "lucruri")} de corectat`,
          link: null,
        };
  }
  if (check?.state === "failed") return { tone: "error", label: "Verificarea n-a mers", detail: null, link: null };
  if (!item.valid) {
    return {
      tone: "error",
      label: "Problemă",
      detail: `${item.errors.length === 1 ? "Un lucru" : countOf(item.errors.length, "lucruri")} de corectat`,
      link: null,
    };
  }
  if (!row.tokenConfigured) return { tone: "warning", label: "Fără token", detail: "Spațiul n-are token", link: null };
  if (row.needsUpload) return { tone: "warning", label: "Video de urcat", detail: "Video-ul trebuie urcat întâi", link: null };
  return { tone: "none", label: "De verificat", detail: "Valid — de verificat", link: null };
}

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
    <div className="space-y-2 text-[12px] leading-snug text-foreground/80">
      <ul className="space-y-1">
        {facts.map((fact) => (
          <li key={fact}>{fact}</li>
        ))}
      </ul>
      {names.length > 0 ? (
        <p className="text-muted-foreground">
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
  const { notify } = useToast();

  const [text, setText] = useState("");
  const [parsedText, setParsedText] = useState("");
  const [restored, setRestored] = useState(false);
  const [checks, setChecks] = useState<Record<string, CheckState>>({});
  const [creates, setCreates] = useState<Record<string, CreateState>>({});
  const [run, setRun] = useState<{ kind: "check" | "create"; done: number; total: number; name: string } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [copied, setCopied] = useState<"problems" | "json" | null>(null);
  const [announcement, setAnnouncement] = useState("");
  /** Crearea s-a terminat (sau s-a oprit) cel puțin o dată pentru lotul de pe ecran. */
  const [createdOnce, setCreatedOnce] = useState(false);
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
  const skipped = rows.filter((row) => row.create?.state === "failed" && Boolean(row.create.result.duplicate));
  const problemRows = rows.filter((row) => rowProblems(row).length > 0);
  const busy = run !== null;

  const runChecks = async () => {
    const targets = checkable;
    if (targets.length === 0) return;
    stopRef.current = false;
    setConfirming(false);
    setCreatedOnce(false);
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
    setCreatedOnce(true);
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
      if (what === "problems") notify("Problemele sunt în clipboard, gata de lipit în Claude.");
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
  const failedCreates = rows.filter((row) => row.create?.state === "failed" && !row.create.result.duplicate).length;

  const syntax = batch && !batch.ok ? batch : null;
  const reason = run
    ? `${run.kind === "check" ? "Se verifică" : "Se creează pe pauză"} ${run.done + 1} din ${run.total}: „${run.name}”…`
    : creatable.length > 0
      ? `${creatable.length === 1 ? "Un plan verificat" : countOf(creatable.length, "planuri verificate")}, gata de creat — oprite.`
      : checkable.length > 0
        ? "Întâi verificarea pe conturile reale: contul, pagina sau identitatea, pixelul, video-ul, targetarea."
        : problemRows.length > 0
          ? "Copiază problemele, dă-le conversației și lipește aici lotul corectat."
          : created.length > 0
            ? "Lotul e creat. Campaniile te așteaptă oprite în platforme."
            : "Niciun plan gata de verificat.";

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start">
      {/* ---------------------------------------------------------- Lotul lipit */}
      <div className="min-w-0 space-y-4">
        <Card className="p-4 sm:p-5">
          <WorkspacePicker workspaces={workspaces} current={current} action={actions.chooseWorkspace} disabled={busy} />
        </Card>

        <Card className="flex flex-col">
          <SectionTitle
            title="Lipește lotul"
            hint="O listă JSON de planuri. Se citește singur, plan cu plan."
            action={
              <Btn size="xs" variant="ghost" icon={Wand2} onClick={() => setText(exampleBatchFor(owner))} disabled={busy}>
                Încarcă exemplul
              </Btn>
            }
          />
          <label htmlFor="batch-text" className="sr-only">
            Lotul de planuri, în format JSON
          </label>
          <textarea
            id="batch-text"
            ref={textareaRef}
            value={text}
            onChange={(event) => setText(event.target.value)}
            readOnly={busy}
            rows={14}
            spellCheck={false}
            autoCapitalize="off"
            autoComplete="off"
            aria-describedby="batch-status"
            aria-invalid={syntax ? true : undefined}
            placeholder={'{\n  "plans": [\n    { "workspace": "meta-meridian", … },\n    { "workspace": "tiktok-meridian", … }\n  ]\n}'}
            className={cn(
              "mt-3 min-h-[16rem] w-full flex-1 resize-y whitespace-pre rounded-xl border border-white/[0.1] bg-[#0A0A0E] p-3 font-mono text-[11.5px] leading-relaxed text-foreground/85 outline-none placeholder:text-muted-foreground/50 focus:border-lav/50",
              syntax && "!border-rose/60"
            )}
          />
          <div id="batch-status" className="mt-3 text-[12.5px] leading-snug">
            {syntax ? (
              <InlineNote tone="rose">
                <p>{syntax.message}</p>
                {syntax.fix === "smart_quotes" ? (
                  <button type="button" onClick={() => setText(replaceSmartQuotes(text))} className="mt-2 underline underline-offset-4 hover:text-foreground">
                    Înlocuiește ghilimelele
                  </button>
                ) : null}
              </InlineNote>
            ) : batch?.ok ? (
              <InlineNote tone={validCount === items.length ? "mint" : "rose"}>
                {validCount === items.length
                  ? `${items.length === 1 ? "Un plan valid" : `Toate cele ${items.length} planuri sunt valide`}.`
                  : `${validCount} din ${items.length} valide · ${countOf(items.length - validCount, "planuri")} de corectat.`}
                {batch.tooMany ? ` Lotul avea mai mult de ${BATCH_MAX} de planuri: s-au citit primele ${BATCH_MAX}.` : ""}
              </InlineNote>
            ) : (
              <p className="text-muted-foreground">Lipește lotul primit din conversație. Se citește singur.</p>
            )}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Btn size="sm" variant="outline" icon={Copy} onClick={() => copy("json")} disabled={!text}>
              {copied === "json" ? "Copiat" : "Copiază JSON-ul"}
            </Btn>
            <Btn
              size="sm"
              variant="ghost"
              onClick={() => {
                setText("");
                setChecks({});
                setCreates({});
                setCreatedOnce(false);
                textareaRef.current?.focus();
              }}
              disabled={!text || busy}
            >
              Golește
            </Btn>
            <span className="text-[11px] text-muted-foreground">maxim {BATCH_MAX}, un proprietar</span>
          </div>
          <p className="mt-4 text-[11.5px] leading-relaxed text-muted-foreground">
            Formatul și contextul conturilor, gata de dat conversației care scrie lotul:{" "}
            <Link href="/admin/ads/claude" className="text-foreground/85 underline underline-offset-4 hover:text-lav">
              Pentru Claude
            </Link>
            .
          </p>
        </Card>
      </div>

      {/* ---------------------------------------------------------- Rândurile */}
      <section aria-labelledby="batch-rows" className="min-w-0 space-y-4">
        <h2 id="batch-rows" className="sr-only">
          Planurile din lot
        </h2>
        <p role="status" className="sr-only">
          {announcement}
        </p>

        {items.length === 0 ? (
          <Card className="p-0">
            <EmptyState
              icon={Layers}
              title="Un lot = mai multe campanii odată."
              text="Aceeași reclamă pe Meta, TikTok și Google, sau zece variante de public. Fiecare plan se verifică pe contul lui și se creează oprit; un plan creat deja se sare."
              action={
                <Btn size="sm" variant="primary" onClick={() => setText(exampleBatchFor(owner))}>
                  Încarcă un lot de exemplu
                </Btn>
              }
              hint={`Lotul e pentru ${owner === "clienti" ? "banii clienților" : "reclamele agenției"} — spațiul ales mai sus.`}
            />
          </Card>
        ) : (
          <>
            <Card className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12px]">
                  <Pill tone={owner === "clienti" ? "apricot" : "neutral"}>{owner === "clienti" ? "Banii clienților" : "Reclamele agenției"}</Pill>
                  <span className="text-muted-foreground">{items.length === 1 ? "Un plan" : countOf(items.length, "planuri")}</span>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-muted-foreground">{validCount} valide</span>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-muted-foreground">{checkedOk} verificate</span>
                  <span className="text-muted-foreground">·</span>
                  <span className={problemRows.length > 0 ? "text-rose" : "text-muted-foreground"}>{problemRows.length} cu probleme</span>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-muted-foreground">{created.length} create</span>
                  {allTotals.length > 0 ? (
                    <>
                      <span className="text-muted-foreground">·</span>
                      <span className="pu-num">{allTotals.map((total) => formatMoney(total.amount, total.currency)).join(" + ")}/zi total</span>
                    </>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {busy ? (
                    <Btn
                      size="sm"
                      variant="danger"
                      icon={Square}
                      onClick={() => {
                        stopRef.current = true;
                        notify("Se oprește după planul curent.", "warn");
                      }}
                    >
                      Oprește după planul ăsta
                    </Btn>
                  ) : (
                    <>
                      <Btn
                        size="sm"
                        variant="outline"
                        icon={CheckCircle2}
                        onClick={runChecks}
                        disabled={checkable.length === 0}
                      >
                        {checkable.length === 0
                          ? "Nimic de verificat"
                          : checkable.every((row) => row.check?.state === "done")
                            ? `Verifică din nou (${checkable.length})`
                            : `Verifică tot (${checkable.length})`}
                      </Btn>
                      {creatable.length > 0 ? (
                        <Btn size="sm" variant="primary" icon={Play} onClick={() => setConfirming(true)}>
                          Creează pe pauză ({creatable.length})
                        </Btn>
                      ) : null}
                      {createdOnce ? (
                        <Link href="/admin/ads" className={btnClass({ variant: "outline", size: "sm" })}>
                          Vezi campaniile
                        </Link>
                      ) : null}
                    </>
                  )}
                </div>
              </div>
              {run ? (
                <div className="mt-3">
                  <ProgressBar value={(run.done / run.total) * 100} tone="lav" />
                </div>
              ) : null}
              <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground" aria-live="polite">
                {run ? <Loader2 className="h-3 w-3 shrink-0 animate-spin" aria-hidden="true" /> : null}
                {reason}
              </p>
            </Card>

            <Card className="overflow-hidden p-0">
              <ol className="divide-y divide-white/[0.05]">
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
                    row.item.dailyBudget !== null ? `${formatMoney(row.item.dailyBudget, row.item.currency)}/zi` : null,
                    row.item.summary ? (row.item.summary.ads.length === 1 ? "1 reclamă" : countOf(row.item.summary.ads.length, "reclame")) : null,
                  ].filter(Boolean);
                  const workspace = row.item.workspace ? workspaces.find((item) => item.id === row.item.workspace?.id) : null;
                  const hasDetails = problems.length > 0 || row.item.warnings.length > 0 || row.check?.state === "done" || Boolean(row.create);
                  return (
                    <li key={`${row.item.index}-${row.item.key.length}`}>
                      <div className="flex flex-wrap items-center gap-3 px-4 py-3">
                        <span className="pu-num w-6 shrink-0 text-[11px] text-muted-foreground">{String(row.item.index + 1).padStart(2, "0")}</span>
                        <div className="min-w-0 flex-1">
                          <p className="break-words text-[13px]">{row.item.name}</p>
                          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
                            {workspace ? (
                              <span
                                className={cn(
                                  "rounded-full border px-2 py-0.5 font-mono text-[10.5px]",
                                  workspace.owner === "clienti" ? "border-apricot/35 text-apricot" : "border-white/[0.12] text-foreground/80"
                                )}
                              >
                                {workspace.name}
                              </span>
                            ) : (
                              <span className="font-mono text-[10.5px] text-rose">spațiu necunoscut</span>
                            )}
                            {facts.length > 0 ? <span>{facts.join(" · ")}</span> : null}
                          </p>
                          {status.detail && status.detail !== status.label ? (
                            <p className={cn("mt-1 text-[11px] leading-snug", status.tone === "error" ? "text-rose" : status.tone === "warning" ? "text-apricot" : "text-muted-foreground")}>
                              {status.detail}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1">
                          {status.link && row.item.workspace ? (
                            <a
                              href={status.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[11.5px] text-foreground/80 underline underline-offset-4 hover:text-lav"
                            >
                              {managerName(row.item.workspace.platform)}
                              <ExternalLink className="h-3 w-3" aria-hidden="true" />
                              <span className="sr-only"> (se deschide într-un tab nou)</span>
                            </a>
                          ) : null}
                          <Pill tone={TONE_PILL[status.tone]} dot={status.tone === "busy"}>
                            {status.label}
                          </Pill>
                        </div>
                      </div>

                      {hasDetails ? (
                        <details className="group border-t border-white/[0.05]">
                          <summary className="flex cursor-pointer list-none items-center gap-1.5 px-4 py-2 text-[11.5px] text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
                            <ChevronRight className="h-3 w-3 transition-transform duration-150 group-open:rotate-90" aria-hidden="true" />
                            Detalii
                            {problems.length > 0 ? ` · ${problems.length === 1 ? "o problemă" : countOf(problems.length, "probleme")}` : ""}
                            {row.item.warnings.length > 0
                              ? ` · ${row.item.warnings.length === 1 ? "un lucru de citit" : countOf(row.item.warnings.length, "lucruri de citit")}`
                              : ""}
                          </summary>
                          <div className="space-y-3 px-4 pb-4">
                            {row.create?.state === "failed" ? (
                              <p className={cn("text-[12.5px] leading-snug", row.create.result.duplicate ? "text-apricot" : "text-rose")}>{row.create.result.message}</p>
                            ) : null}
                            {row.create?.state === "done" && row.create.result.storeWarning ? (
                              <p className="text-[12.5px] leading-snug text-apricot">{row.create.result.storeWarning}</p>
                            ) : null}
                            {row.check?.state === "done" ? <CheckSummary check={row.check.check} /> : null}
                            <ProblemList title={problems.length === 1 ? "De corectat" : `De corectat (${problems.length})`} problems={problems} tone="error" linked={false} />
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
            </Card>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5 text-mint" aria-hidden="true" /> toate campaniile se creează oprite
              </p>
              <Btn size="sm" variant="outline" icon={Copy} disabled={problemRows.length === 0} onClick={() => copy("problems")}>
                {copied === "problems" ? "Copiat" : `Copiază problemele pentru Claude${problemRows.length > 0 ? ` (${problemRows.length})` : ""}`}
              </Btn>
            </div>

            {createdOnce && !busy ? (
              <Card className="border-mint/20 bg-mint/[0.05]">
                <p className="text-[13px] font-medium text-[#C4F5D8]">Lot terminat</p>
                <p className="mt-1 text-[12px] leading-relaxed text-[#C4F5D8]/75">
                  {created.length} create pe pauză, {skipped.length} sărite pentru că existau deja, {failedCreates} cu probleme, {creatable.length} oprite înainte de creare.
                </p>
              </Card>
            ) : null}
          </>
        )}
      </section>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={creatable.length === 1 ? "Creezi o campanie pe pauză?" : `Creezi ${creatable.length} campanii pe pauză?`}
        description={`Se împart pe spațiile de lucru din planuri${
          toCreateByWorkspace.size > 0 ? ` (${[...toCreateByWorkspace.entries()].map(([name, count]) => `${count} în ${name}`).join(", ")})` : ""
        }. Fiecare pornește oprită.`}
        consequence={`${creatable.length === 1 ? "O campanie" : `${creatable.length} campanii`}${
          creatableTotals.length > 0 ? ` · buget zilnic total ${creatableTotals.map((total) => formatMoney(total.amount, total.currency)).join(" + ")}, dacă le pornești pe toate` : ""
        }. Plafonul fiecărui spațiu se verifică și la creare; un plan care îl depășește se sare, nu se forțează. Pornirea rămâne la tine, în platformă.`}
        confirmLabel={`Creează pe pauză (${creatable.length})`}
        tone="primary"
        onConfirm={() => {
          void runCreates();
        }}
      />
    </div>
  );
}
