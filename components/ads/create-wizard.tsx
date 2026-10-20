"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import {
  CURRENCIES,
  MAX_VIDEOS,
  OBJECTIVES,
  OBJECTIVES_WITH_CONVERSION,
  OBJECTIVE_LABEL,
  PLATFORM_LABEL,
  type Objective,
  type Platform,
} from "@/lib/ads/constants";
import { getIn, setIn } from "@/lib/ads/plan-path";
import { PLAN_FORMAT } from "@/lib/ads/plan-schema";
import { countOf } from "@/lib/ads/plan-derive";
import { joinRo, summarizePlan } from "@/lib/ads/plan-summary";
import { validatePlan, type PlanProblem } from "@/lib/ads/plan-validate";
import type { CheckResponse, CreateResponse, PlatformCheck, UploadStatus } from "@/lib/ads/types";
import type { WorkspaceSummary } from "@/lib/ads/workspaces";
import { aspectLabel, durationLabel, type MaterialRow, type MaterialUploadRow } from "@/lib/ads/materials-shared";
import type { AccountSummary } from "@/lib/ads/model/types";
import { cn } from "@/lib/utils";
import { AdsPreview } from "./ads-preview";
import { ChannelIcon } from "./channel-icon";
import { CheckPanel } from "./check-panel";
import { CreateResult } from "./create-result";
import { PlanFormProvider, fieldId, groupByPath } from "./fields";
import {
  AudienceFields,
  BudgetFields,
  ConversionFields,
  CreativeTextFields,
  DestinationFields,
  EnhancementsFields,
  PlatformFields,
} from "./plan-form";
import { TextField } from "./fields";
import { ProblemList } from "./problem-list";
import { ERROR_TEXT, OK_TEXT } from "./tone";

/**
 * „Creează” (v2): o campanie pe pași — canal → obiectiv → public și buget →
 * reclame (din Materiale) → verificare → „Creează pe pauză”.
 *
 * Formularul scrie EXACT planul JSON din „Importă JSON” (cu `channel`), îl
 * validează cu aceleași reguli și trece prin aceeași verificare și creare pe
 * pauză. Materialele alese se trimit în contul de reclame abia la verificare,
 * o singură dată pe cont; în plan intră id-ul lor din biblioteca contului.
 */

type Failure = { ok: false; message: string };

export interface WizardActions {
  chooseWorkspace: (formData: FormData) => Promise<void>;
  checkPlan: (input: { plan: unknown; workspace: string }) => Promise<CheckResponse>;
  createPaused: (input: { plan: unknown; workspace: string; fingerprint: string; allowDuplicate: boolean }) => Promise<CreateResponse>;
  continueJob: (input: { jobId: string }) => Promise<CreateResponse>;
  sendMaterial: (input: { materialId: string; workspace: string; adAccount: string }) => Promise<{ ok: true; upload: MaterialUploadRow } | Failure>;
  materialStatus: (input: { materialId: string; workspace: string; adAccount: string }) => Promise<{ ok: true; status: UploadStatus; upload: MaterialUploadRow } | Failure>;
}

const STEPS = [
  { key: "canal", title: "Canal", prefixes: ["format", "channel", "workspace", "ad_account"] },
  { key: "obiectiv", title: "Obiectiv", prefixes: ["campaign.name", "campaign.objective", "conversion", "destination"] },
  { key: "public", title: "Public și buget", prefixes: ["audience", "campaign.daily_budget", "campaign.currency", "campaign"] },
  { key: "reclame", title: "Reclame", prefixes: ["creative", "meta", "tiktok", "google"] },
  { key: "verificare", title: "Verificare", prefixes: [] as string[] },
] as const;

const OBJECTIVE_HINT: Record<Objective, string> = {
  leads: "Oameni care îți lasă datele: formular pe site sau în platformă. Cere pixelul.",
  traffic: "Clicuri spre pagină. Platforma caută oamenii care dau clic, nu pe cei care cumpără.",
  sales: "Cumpărături pe site, măsurate cu pixelul.",
  video_views: "Oameni care se uită la video. Bun pentru încălzirea publicului.",
  awareness: "Cât mai mulți oameni din public, de mai multe ori.",
};

const UTM_SOURCE: Record<Platform, string> = { meta: "facebook", tiktok: "tiktok", google: "google" };
const UTM_MEDIUM: Record<Platform, string> = { meta: "paid_social", tiktok: "paid_social", google: "paid_video" };
const STORAGE_KEY = "meridian_ads_wizard";
const POLL_MS = 3000;
const UNREACHABLE = "Serverul n-a răspuns (rețea sau sesiune). Nu s-a trimis nimic spre platformă. Încearcă din nou.";

function slug(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

function monthLabel(): string {
  return new Intl.DateTimeFormat("ro-RO", { month: "short", year: "numeric", timeZone: "Europe/Bucharest" }).format(new Date()).replace(".", "");
}

/** Planul de pornire pentru un cont: ce e comun se păstrează dintr-un plan început pe alt canal. */
function draftFor(account: AccountSummary, previous: Record<string, unknown> | null, defaults: { agency: boolean; clientName: string; sitePixel: Partial<Record<Platform, string>> }): Record<string, unknown> {
  const platform = account.platform;
  const keep = (path: string, fallback: unknown) => {
    const value = previous ? getIn(previous, path) : undefined;
    return value === undefined ? fallback : value;
  };
  const objective = keep("campaign.objective", "leads") as string;
  const currency = (CURRENCIES as readonly string[]).includes(account.currency ?? "") ? account.currency : "RON";
  const plan: Record<string, unknown> = {
    format: PLAN_FORMAT,
    channel: platform,
    workspace: account.workspace,
    ad_account: account.adAccount,
    campaign: {
      name: keep("campaign.name", ""),
      objective,
      daily_budget: keep("campaign.daily_budget", 50),
      currency,
    },
    audience: keep("audience", { locations: [{ type: "country", code: "RO" }], age_min: 25, age_max: 54, gender: "all", languages: ["ro"], interests: [] }),
    destination: {
      type: "website",
      url: keep("destination.url", defaults.agency ? "https://www.meridianx.ro/" : ""),
      utm: { source: UTM_SOURCE[platform], medium: UTM_MEDIUM[platform], campaign: keep("destination.utm.campaign", "") },
    },
    creative: {
      thumbnail: "auto",
      primary_texts: keep("creative.primary_texts", [""]),
      ...(platform !== "tiktok" ? { headlines: keep("creative.headlines", [""]) } : {}),
      ...(platform === "google" ? { descriptions: keep("creative.descriptions", [""]) } : {}),
      cta: keep("creative.cta", objective === "leads" ? "get_quote" : "learn_more"),
      variants: platform === "google" ? "platform_rotates" : "one_ad_per_text",
    },
  };
  if (OBJECTIVES_WITH_CONVERSION.includes(objective as Objective)) {
    plan.conversion = { pixel_id: defaults.agency ? (defaults.sitePixel[platform] ?? "") : "", event: "lead" };
  }
  if (platform === "meta") {
    plan.meta = { page_id: "", special_ad_categories: [], advantage_audience: false, placements: "automatic", enhancements: { advantage_creative: false, ad_sources: false, multi_advertiser_ads: false } };
  } else if (platform === "tiktok") {
    plan.tiktok = { identity_type: "TT_USER", identity_id: "", placements: "tiktok_only", enhancements: { automatic_enhancements: false, auto_add_assets: false, translate_and_dub: false, music_refresh: false } };
  } else {
    plan.google = {
      business_name: defaults.agency ? "MERIDIAN" : defaults.clientName.slice(0, 25),
      logo_url: defaults.agency ? "https://www.meridianx.ro/brand/icon-512.png" : "",
      optimized_targeting: false,
      enhancements: { video_enhancements: false, text_assets: false },
    };
  }
  return plan;
}

/** Video-urile planului, din materialele alese: id-ul din bibliotecă dacă e gata în cont, altfel „de trimis”. */
function withVideos(draft: Record<string, unknown>, materials: MaterialRow[], ready: Map<string, string>): Record<string, unknown> {
  const videos = materials.map((material) => {
    const id = ready.get(material.id);
    return id ? { source: "library", video_id: id } : { source: "upload", file_name: material.name.slice(0, 200) };
  });
  const creative = { ...((draft.creative as Record<string, unknown>) ?? {}) };
  delete creative.video;
  delete creative.videos;
  if (videos.length === 1) creative.video = videos[0];
  else if (videos.length > 1) creative.videos = videos;
  return { ...draft, creative };
}

function belongs(path: string, prefixes: readonly string[]): boolean {
  return prefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}.`));
}

/** Pasul unei probleme: primul ai cărui prefixe o cuprind (cel mai specific întâi, „campaign” la Public). */
function stepOf(path: string): number {
  for (const [index, step] of STEPS.entries()) {
    if (step.key === "public" && belongs(path, ["campaign"]) && !belongs(path, ["campaign.daily_budget", "campaign.currency"])) continue;
    if (belongs(path, step.prefixes)) return index;
  }
  return path.startsWith("campaign") ? 1 : 0;
}

type MaterialState = { phase: "waiting" | "sending" | "processing" | "ready" | "failed"; message?: string; videoId?: string };

function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("rounded-xl border border-hair bg-white p-4 sm:p-5", className)}>{children}</div>;
}

export function CreateWizard({
  client,
  accounts,
  materials,
  workspaces,
  sitePixel,
  actions,
}: {
  client: { id: string; name: string; owner: "agentie" | "clienti" };
  accounts: AccountSummary[];
  materials: MaterialRow[];
  workspaces: WorkspaceSummary[];
  sitePixel: Partial<Record<Platform, string>>;
  actions: WizardActions;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [reached, setReached] = useState(0);
  const [attempted, setAttempted] = useState<Set<number>>(new Set());
  const [accountId, setAccountId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, unknown> | null>(null);
  const [chosen, setChosen] = useState<string[]>([]);
  const [states, setStates] = useState<Record<string, MaterialState>>({});
  const [check, setCheck] = useState<{ key: string; check: PlatformCheck } | null>(null);
  const [checkFailure, setCheckFailure] = useState<{ message: string; problems: PlanProblem[] } | null>(null);
  const [result, setResult] = useState<CreateResponse | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [checking, startCheck] = useTransition();
  const [creating, startCreate] = useTransition();
  const [notice, setNotice] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const draftRef = useRef<Record<string, unknown> | null>(null);

  const account = accounts.find((item) => item.id === accountId) ?? null;
  const platform: Platform | null = account?.platform ?? null;
  const workspace = account ? (workspaces.find((item) => item.id === account.workspace) ?? null) : null;
  const picked = useMemo(() => chosen.map((id) => materials.find((material) => material.id === id)).filter((material): material is MaterialRow => Boolean(material)), [chosen, materials]);

  // Ce e deja gata în contul ales (din Materiale sau trimis acum).
  const readyIds = useMemo(() => {
    const map = new Map<string, string>();
    if (!account) return map;
    for (const material of materials) {
      const upload = material.uploads.find((item) => item.platform === account.platform && item.adAccount === account.adAccount && item.status === "ready" && item.videoId);
      if (upload?.videoId) map.set(material.id, upload.videoId);
    }
    for (const [id, state] of Object.entries(states)) if (state.phase === "ready" && state.videoId) map.set(id, state.videoId);
    return map;
  }, [account, materials, states]);

  const plan = useMemo(() => (draft ? withVideos(draft, picked, readyIds) : null), [draft, picked, readyIds]);
  const validation = useMemo(() => (plan && account ? validatePlan(plan, { currentWorkspace: account.workspace }) : null), [plan, account]);
  // Avertismentul „video nou, urcă-l la Materialul” e al editorului JSON; aici materialele au rândul lor la verificare.
  const warnings = useMemo(() => (validation?.warnings ?? []).filter((item) => !/^creative\.videos?(\.\d+)?$/.test(item.path)), [validation]);
  const allErrors = useMemo(() => validation?.errors ?? [], [validation]);
  const shownErrors = useMemo(() => groupByPath(allErrors.filter((problem) => attempted.has(stepOf(problem.path)) || attempted.has(4))), [allErrors, attempted]);
  const shownWarnings = useMemo(() => groupByPath(warnings), [warnings]);
  const summary = useMemo(() => (plan && platform ? summarizePlan(plan, platform) : null), [plan, platform]);
  const planKey = useMemo(() => (plan ? JSON.stringify(plan) : ""), [plan]);
  const freshCheck = check && check.key === planKey ? check.check : null;

  // Pagina se reîncarcă fără să piardă lucrul (în tabul ăsta): sessionStorage, nu localStorage — planul are id-uri de cont.
  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "null") as { clientId: string; accountId: string | null; draft: Record<string, unknown> | null; chosen: string[]; step: number; reached: number } | null;
      if (saved && saved.clientId === client.id && accounts.some((item) => item.id === saved.accountId)) {
        setAccountId(saved.accountId);
        setDraft(saved.draft);
        draftRef.current = saved.draft;
        setChosen(saved.chosen.filter((id) => materials.some((material) => material.id === id)));
        setStep(Math.min(saved.step, 3));
        setReached(Math.min(saved.reached, 3));
      }
    } catch {
      /* stocare indisponibilă — pornim de la capăt */
    }
    setRestored(true);
    // Doar la deschidere.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!restored) return;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ clientId: client.id, accountId, draft, chosen, step, reached }));
    } catch {
      /* fără stocare, lucrul trăiește doar în pagină */
    }
  }, [restored, client.id, accountId, draft, chosen, step, reached]);

  const update = (path: string, value: unknown) => {
    const before = draftRef.current ?? {};
    let next = setIn(before, path, value);
    // utm_campaign urmează numele campaniei cât timp n-a fost scris de mână.
    if (path === "campaign.name") {
      const utm = String(getIn(before, "destination.utm.campaign") ?? "");
      if (!utm || utm === slug(String(getIn(before, "campaign.name") ?? ""))) next = setIn(next, "destination.utm.campaign", slug(String(value ?? "")) || undefined);
    }
    draftRef.current = next;
    setDraft(next);
  };

  const goTo = (index: number) => {
    setStep(index);
    setReached((value) => Math.max(value, index));
    window.requestAnimationFrame(() => heading.current?.focus());
  };

  const chooseAccount = (next: AccountSummary) => {
    setAccountId(next.id);
    let fresh = draftFor(next, draftRef.current, { agency: client.owner === "agentie", clientName: client.name, sitePixel });
    // Un nume propus din start: clientul, obiectivul, luna. Se corectează la pasul următor.
    if (!String(getIn(fresh, "campaign.name") ?? "").trim()) {
      const name = `${client.name} · ${OBJECTIVE_LABEL[(getIn(fresh, "campaign.objective") as Objective) ?? "leads"] ?? "Campanie"} · ${monthLabel()}`;
      fresh = setIn(fresh, "campaign.name", name);
      if (!String(getIn(fresh, "destination.utm.campaign") ?? "")) fresh = setIn(fresh, "destination.utm.campaign", slug(name));
    }
    draftRef.current = fresh;
    setDraft(fresh);
    setCheck(null);
    setResult(null);
    setStates({});
    const formData = new FormData();
    formData.set("workspace", next.workspace);
    void actions.chooseWorkspace(formData);
  };

  const chooseObjective = (objective: Objective) => {
    update("campaign.objective", objective);
    const needs = OBJECTIVES_WITH_CONVERSION.includes(objective);
    if (needs && getIn(draftRef.current ?? {}, "conversion") === undefined && platform) {
      update("conversion", { pixel_id: client.owner === "agentie" ? (sitePixel[platform] ?? "") : "", event: "lead" });
    }
    if (!needs && getIn(draftRef.current ?? {}, "conversion") !== undefined) update("conversion", undefined);
    // Numele propus urmează obiectivul cât timp e cel propus.
    const name = String(getIn(draftRef.current ?? {}, "campaign.name") ?? "").trim();
    const proposed = OBJECTIVES.some((item) => name === `${client.name} · ${OBJECTIVE_LABEL[item]} · ${monthLabel()}`);
    if (!name || proposed) update("campaign.name", `${client.name} · ${OBJECTIVE_LABEL[objective]} · ${monthLabel()}`);
  };

  const next = () => {
    setAttempted((current) => new Set(current).add(step));
    if (step === 0 && !account) {
      setNotice("Alege contul în care se creează campania.");
      return;
    }
    if (step === 3 && picked.length === 0) {
      setNotice("Alege cel puțin un video din Materiale.");
      return;
    }
    const own = allErrors.filter((problem) => stepOf(problem.path) === step && !/^creative\.videos?(\.\d+)?(\.|$)/.test(problem.path));
    if (own.length > 0) {
      setNotice(`${own.length === 1 ? "Un lucru" : countOf(own.length, "lucruri")} de corectat pe pasul ăsta.`);
      window.requestAnimationFrame(() => document.getElementById(fieldId(own[0].path))?.focus());
      return;
    }
    setNotice(null);
    goTo(step + 1);
  };

  const toggleMaterial = (id: string) => {
    setNotice(null);
    setChosen((current) => (current.includes(id) ? current.filter((item) => item !== id) : current.length >= MAX_VIDEOS ? current : [...current, id]));
  };

  /** Trimite materialele care nu sunt încă în cont și așteaptă până le termină platforma. */
  const prepareMaterials = async (): Promise<Map<string, string> | null> => {
    if (!account) return null;
    const ids = new Map(readyIds);
    const pending = picked.filter((material) => !ids.has(material.id));
    if (pending.length === 0) return ids;
    setPreparing(true);
    try {
      const formData = new FormData();
      formData.set("workspace", account.workspace);
      await actions.chooseWorkspace(formData);
      for (const material of pending) {
        setStates((current) => ({ ...current, [material.id]: { phase: "sending" } }));
        const sent = await actions.sendMaterial({ materialId: material.id, workspace: account.workspace, adAccount: account.adAccount }).catch(() => ({ ok: false as const, message: UNREACHABLE }));
        if (!sent.ok) {
          setStates((current) => ({ ...current, [material.id]: { phase: "failed", message: sent.message } }));
          return null;
        }
        setStates((current) => ({ ...current, [material.id]: { phase: "processing" } }));
        const started = Date.now();
        for (;;) {
          const status = await actions.materialStatus({ materialId: material.id, workspace: account.workspace, adAccount: account.adAccount }).catch(() => ({ ok: false as const, message: UNREACHABLE }));
          if (!status.ok) {
            setStates((current) => ({ ...current, [material.id]: { phase: "failed", message: status.message } }));
            return null;
          }
          if (status.upload.status === "ready" && status.upload.videoId) {
            ids.set(material.id, status.upload.videoId);
            setStates((current) => ({ ...current, [material.id]: { phase: "ready", videoId: status.upload.videoId ?? undefined } }));
            break;
          }
          if (status.upload.status === "failed") {
            setStates((current) => ({ ...current, [material.id]: { phase: "failed", message: status.status.message ?? "Platforma n-a putut procesa fișierul." } }));
            return null;
          }
          if (Date.now() - started > 15 * 60_000) {
            setStates((current) => ({ ...current, [material.id]: { phase: "failed", message: "Platforma procesează de peste 15 minute. Reîncearcă verificarea mai târziu: trimiterea nu se repetă." } }));
            return null;
          }
          await new Promise((resolve) => window.setTimeout(resolve, POLL_MS));
        }
      }
      return ids;
    } finally {
      setPreparing(false);
    }
  };

  const runCheck = () => {
    if (!account || !draftRef.current) return;
    setAttempted((current) => new Set(current).add(4));
    setResult(null);
    setCheckFailure(null);
    startCheck(async () => {
      const ids = await prepareMaterials();
      if (!ids) return;
      const ready = withVideos(draftRef.current ?? {}, picked, ids);
      const key = JSON.stringify(ready);
      try {
        const formData = new FormData();
        formData.set("workspace", account.workspace);
        await actions.chooseWorkspace(formData);
        const response = await actions.checkPlan({ plan: ready, workspace: account.workspace });
        if (response.ok) setCheck({ key, check: response.check });
        else setCheckFailure({ message: response.message, problems: response.problems ?? [] });
      } catch {
        setCheckFailure({ message: UNREACHABLE, problems: [] });
      }
    });
  };

  const runCreate = (allowDuplicate: boolean) => {
    if (!account || !plan || !freshCheck) return;
    startCreate(async () => {
      try {
        const response = await actions.createPaused({ plan, workspace: account.workspace, fingerprint: freshCheck.fingerprint, allowDuplicate });
        setResult(response);
        if (!response.ok && response.recheck) setCheck(null);
        if (response.ok) router.refresh();
      } catch {
        setResult({ ok: false, message: UNREACHABLE });
      }
    });
  };

  const openInEditor = () => {
    if (!plan) return;
    try {
      sessionStorage.setItem("meridian_ads_plan", JSON.stringify(plan, null, 2));
    } catch {
      /* fără stocare, editorul pornește gol */
    }
    router.push("/admin/ads/nou");
  };

  const byPlatform = useMemo(() => {
    // Ordinea din bara de sus: Meta, Google, TikTok.
    const groups = new Map<Platform, AccountSummary[]>();
    for (const platform of ["meta", "google", "tiktok"] as const) {
      const list = accounts.filter((item) => item.platform === platform);
      if (list.length > 0) groups.set(platform, list);
    }
    return groups;
  }, [accounts]);
  const listed = materials.filter((material) => material.status === "ready" && (material.clientId === null || material.clientId === client.id));

  if (accounts.length === 0) {
    return (
      <Card className="mt-6 max-w-2xl">
        <p className="text-[15px] font-semibold text-bone">{client.name} n-are încă niciun cont de reclame legat.</p>
        <p className="mt-1 text-[14px] text-bone/80">Campania se creează într-un cont al clientului. Leagă-i contul din pagina Clienți, apoi revino aici.</p>
        <Link href="/admin/ads/clienti" className="btn btn-light mt-4 !min-h-10 !px-4 !text-[14px]">
          Leagă un cont
        </Link>
      </Card>
    );
  }

  const checkLabel = platform ? PLATFORM_LABEL[platform] : "platformă";
  const created = result?.ok === true;
  const totalErrors = allErrors.filter((problem) => !/^creative\.videos?(\.\d+)?$/.test(problem.path)).length;

  return (
    <div className="mt-5">
      {/* Pașii: un drum, nu un meniu. Pașii deja atinși se pot redeschide. */}
      <nav aria-label="Pașii campaniei">
        <ol className="flex flex-wrap gap-x-1 gap-y-2 text-[13.5px]">
          {STEPS.map((item, index) => {
            const errorsHere = attempted.has(index) && allErrors.some((problem) => stepOf(problem.path) === index && !/^creative\.videos?/.test(problem.path));
            const current = index === step;
            return (
              <li key={item.key} className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={index > reached || creating}
                  onClick={() => goTo(index)}
                  aria-current={current ? "step" : undefined}
                  className={cn(
                    "flex min-h-9 items-center gap-2 rounded-lg px-2.5 font-medium transition-colors duration-150 disabled:cursor-default",
                    current ? "bg-[var(--ap-accent-soft)] text-[var(--ap-accent-ink)]" : index <= reached ? "text-bone/85 hover:bg-[var(--ap-hover)]" : "text-dim"
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "grid h-5 w-5 place-items-center rounded-full text-[11px] tabular-nums",
                      current ? "bg-[var(--md-a1)] text-white" : errorsHere ? "bg-[var(--ap-error)] text-white" : index < reached ? "bg-[var(--ap-ok)] text-white" : "border border-hair-strong text-dim"
                    )}
                  >
                    {index + 1}
                  </span>
                  {item.title}
                  {errorsHere ? <span className="sr-only"> (de corectat)</span> : null}
                </button>
                {index < STEPS.length - 1 ? (
                  <span aria-hidden className="text-dim">
                    →
                  </span>
                ) : null}
              </li>
            );
          })}
        </ol>
      </nav>

      <div className="mt-5 grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start">
        <div className="min-w-0">
          <h2 ref={heading} tabIndex={-1} className="text-[1.125rem] font-semibold text-bone">
            {step + 1}. {STEPS[step].title}
          </h2>

          <PlanFormProvider value={{ draft: draft ?? {}, update, errors: shownErrors, warnings: shownWarnings }}>
            <div className="mt-4 space-y-5">
              {step === 0 ? (
                <Card>
                  <p className="text-[13.5px] text-dim">
                    Contul lui {client.name} în care se creează campania. Clientul îl schimbi din bara de sus.
                  </p>
                  <div className="mt-4 space-y-4">
                    {[...byPlatform.entries()].map(([group, list]) => (
                      <fieldset key={group}>
                        <legend className="flex items-center gap-2 text-[13px] font-medium text-bone">
                          <ChannelIcon platform={group} />
                          {PLATFORM_LABEL[group]}
                        </legend>
                        <div className="mt-2 grid gap-2 sm:grid-cols-2">
                          {list.map((item) => {
                            const space = workspaces.find((entry) => entry.id === item.workspace);
                            const blocked = !space?.tokenConfigured;
                            return (
                              <label
                                key={item.id}
                                className={cn(
                                  "flex cursor-pointer items-start gap-3 rounded-lg border px-3.5 py-3 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--md-a1)]",
                                  accountId === item.id ? "border-[var(--md-a1)] bg-[var(--ap-accent-soft)]" : "border-hair-strong hover:bg-[var(--ap-hover)]",
                                  blocked && "cursor-not-allowed opacity-60"
                                )}
                              >
                                <input type="radio" name="cont" className="sr-only" checked={accountId === item.id} disabled={blocked} onChange={() => chooseAccount(item)} />
                                <span className="min-w-0">
                                  <span className="block text-[14.5px] font-semibold text-bone">{item.name ?? item.adAccount}</span>
                                  <span className="block font-md-mono text-[12px] text-dim">
                                    {item.adAccount} · {item.currency ?? "—"}
                                  </span>
                                  {blocked ? <span className="mt-1 block text-[12.5px] text-[var(--ap-warn)]">Spațiul n-are token: {space?.tokenEnv ?? "tokenul"} lipsește în Vercel.</span> : null}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </fieldset>
                    ))}
                  </div>
                </Card>
              ) : null}

              {step === 1 && platform ? (
                <>
                  <Card>
                    <fieldset>
                      <legend className="text-[13px] font-medium text-bone">Ce vrei de la campanie</legend>
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        {OBJECTIVES.map((objective) => {
                          const selected = getIn(draft ?? {}, "campaign.objective") === objective;
                          return (
                            <label
                              key={objective}
                              className={cn(
                                "flex cursor-pointer flex-col rounded-lg border px-3.5 py-3 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--md-a1)]",
                                selected ? "border-[var(--md-a1)] bg-[var(--ap-accent-soft)]" : "border-hair-strong hover:bg-[var(--ap-hover)]"
                              )}
                            >
                              <input id={objective === "leads" ? fieldId("campaign.objective") : undefined} type="radio" name="obiectiv" className="sr-only" checked={selected} onChange={() => chooseObjective(objective)} />
                              <span className={cn("text-[14.5px] font-semibold", selected ? "text-[var(--ap-accent-ink)]" : "text-bone")}>{OBJECTIVE_LABEL[objective]}</span>
                              <span className="text-[12.5px] leading-snug text-dim">{OBJECTIVE_HINT[objective]}</span>
                            </label>
                          );
                        })}
                      </div>
                    </fieldset>
                    <div className="mt-4">
                      <TextField path="campaign.name" label={`Numele campaniei în ${PLATFORM_LABEL[platform]}`} />
                    </div>
                  </Card>
                  {getIn(draft ?? {}, "conversion") !== undefined ? (
                    <Card>
                      <p className="mb-3 text-[13px] font-medium text-bone">Ce se numără</p>
                      <ConversionFields platform={platform} />
                    </Card>
                  ) : null}
                  <Card>
                    <p className="mb-3 text-[13px] font-medium text-bone">Unde ajunge omul</p>
                    {summary ? <DestinationFields summary={summary} /> : null}
                  </Card>
                </>
              ) : null}

              {step === 2 && platform ? (
                <>
                  <Card>
                    <AudienceFields platform={platform} />
                  </Card>
                  <Card>
                    <p className="mb-3 text-[13px] font-medium text-bone">Bugetul</p>
                    <BudgetFields />
                    {summary?.monthly ? <p className="mt-2 text-[13px] text-dim">{summary.monthly}, dacă rulează toată luna.</p> : null}
                    {workspace ? (
                      <p className="mt-1 text-[12.5px] text-dim">
                        Plafonul spațiului {workspace.name}: {Object.entries(workspace.dailyBudgetCap).map(([currency, cap]) => `${cap} ${currency}`).join(" · ")} pe zi.
                      </p>
                    ) : null}
                  </Card>
                </>
              ) : null}

              {step === 3 && platform ? (
                <>
                  <Card>
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="text-[13px] font-medium text-bone">
                        Video-urile, din Materiale <span className="font-normal text-dim">· {chosen.length} din cel mult {MAX_VIDEOS}</span>
                      </p>
                      <Link href="/admin/ads/materiale" className="text-[13px] text-[var(--md-a1)] hover:underline">
                        Urcă un video nou
                      </Link>
                    </div>
                    {listed.length === 0 ? (
                      <p className="mt-2 text-[14px] text-dim">Niciun material pentru {client.name} încă. Urcă video-ul în Materiale, apoi revino: pașii făcuți rămân.</p>
                    ) : (
                      <ul className="mt-3 grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
                        {listed.map((material) => {
                          const selected = chosen.includes(material.id);
                          const inAccount = readyIds.has(material.id);
                          const order = chosen.indexOf(material.id);
                          return (
                            <li key={material.id}>
                              <label
                                className={cn(
                                  "flex h-full cursor-pointer flex-col overflow-hidden rounded-lg border has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--md-a1)]",
                                  selected ? "border-[var(--md-a1)] ring-1 ring-[var(--md-a1)]" : "border-hair-strong hover:bg-[var(--ap-hover)]"
                                )}
                              >
                                <span className="relative block aspect-video min-h-0 shrink-0 overflow-hidden bg-[#0f1115]">
                                  {material.previewUrl ? <video src={`${material.previewUrl}#t=0.1`} preload="metadata" muted playsInline className="absolute inset-0 h-full w-full object-contain" aria-hidden /> : null}
                                  {selected ? (
                                    <span className="absolute left-2 top-2 grid h-6 min-w-6 place-items-center rounded-full bg-[var(--md-a1)] px-1.5 text-[12px] font-semibold text-white">{order + 1}</span>
                                  ) : null}
                                </span>
                                <span className="flex items-start gap-2 p-3">
                                  <input type="checkbox" checked={selected} onChange={() => toggleMaterial(material.id)} disabled={!selected && chosen.length >= MAX_VIDEOS} className="mt-0.5 h-4 w-4 shrink-0" />
                                  <span className="min-w-0">
                                    <span className="block text-[14px] font-semibold leading-snug text-bone">{material.name}</span>
                                    <span className="block text-[12px] text-dim">{[durationLabel(material.durationSeconds), aspectLabel(material.width, material.height)].filter(Boolean).join(" · ") || "—"}</span>
                                    <span className={cn("block text-[12px]", inAccount ? OK_TEXT : "text-dim")}>{inAccount ? "deja în contul ăsta" : "se trimite în cont la verificare"}</span>
                                  </span>
                                </span>
                              </label>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                    {chosen.length > 1 ? <p className="mt-2 text-[12.5px] text-dim">Cu mai multe video-uri, se face câte o reclamă pentru fiecare video × text, în același grup.</p> : null}
                  </Card>
                  <Card>
                    <p className="mb-3 text-[13px] font-medium text-bone">Textele și butonul</p>
                    <div className="space-y-5">
                      <CreativeTextFields platform={platform} />
                    </div>
                  </Card>
                  <Card>
                    <p className="mb-3 text-[13px] font-medium text-bone">Ce cere {PLATFORM_LABEL[platform]}</p>
                    <div className="space-y-5">
                      <PlatformFields platform={platform} />
                    </div>
                  </Card>
                  <details className="rounded-xl border border-hair bg-white p-4 sm:p-5">
                    <summary className="cursor-pointer text-[13px] font-medium text-bone">Îmbunătățiri automate · toate oprite</summary>
                    <p className="mt-2 text-[12.5px] text-dim">Un testimonial filmat nu se lasă rescris de platformă. Le pornești doar știind ce fac.</p>
                    <div className="mt-3">
                      <EnhancementsFields platform={platform} />
                    </div>
                  </details>
                </>
              ) : null}

              {step === 4 && platform && summary ? (
                <>
                  <Card>
                    <p className="text-[1.125rem] font-semibold leading-snug text-bone">
                      {summary.objective ? `O campanie de ${summary.objective.toLowerCase()}` : "O campanie"} pe {PLATFORM_LABEL[platform]}, în {account?.name ?? account?.adAccount},{" "}
                      {summary.budget ? `cu ${summary.budget}` : "fără buget"}.
                    </p>
                    <p className="mt-2 text-[14.5px] leading-relaxed text-bone/80">
                      Pentru oameni de {summary.age}, {summary.gender}, din {summary.places.length > 0 ? joinRo(summary.places) : "—"}. {summary.ads.length === 1 ? "O reclamă" : countOf(summary.ads.length, "reclame")}
                      {summary.cta ? ` cu butonul „${summary.cta}”` : ""}. Totul se creează oprit; o pornești tu, din {PLATFORM_LABEL[platform]}.
                    </p>
                    <AdsPreview summary={summary} rotating={getIn(plan ?? {}, "creative.variants") === "platform_rotates"} className="mt-4" />
                  </Card>

                  <Card>
                    <p className="text-[13px] font-medium text-bone">Video-urile în contul de reclame</p>
                    <ul className="mt-2 space-y-1.5 text-[13.5px]">
                      {picked.map((material) => {
                        const state = readyIds.has(material.id) ? { phase: "ready" as const } : (states[material.id] ?? { phase: "waiting" as const });
                        const text =
                          state.phase === "ready"
                            ? "în biblioteca contului"
                            : state.phase === "sending"
                              ? `se trimite în ${PLATFORM_LABEL[platform]}…`
                              : state.phase === "processing"
                                ? `${PLATFORM_LABEL[platform]} îl procesează…`
                                : state.phase === "failed"
                                  ? `n-a mers: ${state.message ?? ""}`
                                  : "se trimite la verificare";
                        return (
                          <li key={material.id} className="flex flex-wrap gap-x-2">
                            <span className="font-medium text-bone">{material.name}</span>
                            <span className={state.phase === "ready" ? OK_TEXT : state.phase === "failed" ? ERROR_TEXT : "text-dim"}>{text}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </Card>

                  {totalErrors > 0 ? (
                    <Card className="border-[var(--ap-error)]/30">
                      <p className={cn("text-[14.5px] font-semibold", ERROR_TEXT)}>{totalErrors === 1 ? "Un lucru" : countOf(totalErrors, "lucruri")} de corectat înainte de verificare</p>
                      <ul className="mt-2 space-y-1.5 text-[13.5px]">
                        {allErrors
                          .filter((problem) => !/^creative\.videos?(\.\d+)?$/.test(problem.path))
                          .slice(0, 12)
                          .map((problem, index) => (
                            <li key={`${problem.path}-${index}`} className="flex flex-wrap gap-x-2">
                              <span className="text-bone/85">{problem.message}</span>
                              <button type="button" onClick={() => goTo(stepOf(problem.path))} className="text-[var(--md-a1)] underline underline-offset-4">
                                la pasul {stepOf(problem.path) + 1}
                              </button>
                            </li>
                          ))}
                      </ul>
                    </Card>
                  ) : null}

                  {check ? <CheckPanel check={check.check} stale={check.key !== planKey} /> : null}

                  {checkFailure ? (
                    <div role="alert" className="space-y-3">
                      <Card className="border-[var(--ap-error)]/30">
                        <p className={cn("text-[15px] font-semibold", ERROR_TEXT)}>Verificarea pe {checkLabel} n-a mers.</p>
                        <p className="mt-1.5 text-[14px] leading-relaxed text-bone/80">{checkFailure.message}</p>
                      </Card>
                      <ProblemList title="De corectat" problems={checkFailure.problems} tone="error" />
                    </div>
                  ) : null}

                  {result ? (
                    <CreateResult result={result} platform={platform} pending={creating} onCreateAnyway={() => runCreate(true)} continueJob={actions.continueJob} onResult={setResult} />
                  ) : null}

                  <details className="rounded-xl border border-hair bg-white p-4 sm:p-5">
                    <summary className="cursor-pointer text-[13px] font-medium text-bone">Planul, în JSON</summary>
                    <p className="mt-2 text-[12.5px] text-dim">Același format ca la „Importă JSON”. Îl poți duce acolo ca să-l corectezi de mână sau să-l dai mai departe.</p>
                    <pre className="mt-3 max-h-80 overflow-auto rounded-lg border border-hair bg-[var(--ap-side)] p-3 font-md-mono text-[12px] leading-relaxed text-bone/85">{JSON.stringify(plan, null, 2)}</pre>
                    <button type="button" onClick={openInEditor} className="btn btn-ghost mt-3 !min-h-9 !px-3 !text-[13px]">
                      Deschide în „Importă JSON”
                    </button>
                  </details>
                </>
              ) : null}
            </div>
          </PlanFormProvider>

          {/* Bara de jos: înapoi, mai departe, sau verificarea și crearea. */}
          <div className="mt-5 flex flex-col gap-3 rounded-xl border border-hair bg-white px-4 py-3.5 sm:flex-row sm:items-center">
            <div className="flex shrink-0 flex-wrap gap-2">
              {step > 0 ? (
                <button type="button" onClick={() => goTo(step - 1)} disabled={checking || creating} className="btn btn-ghost !min-h-10 !px-4 !text-[14px]">
                  Înapoi
                </button>
              ) : null}
              {step < 4 ? (
                <button type="button" onClick={next} className="btn btn-light !min-h-10 !px-4 !text-[14px]">
                  Continuă
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={runCheck}
                    disabled={checking || creating || totalErrors > 0 || created}
                    className={cn("btn !min-h-10 !px-4 !text-[14px]", freshCheck?.ok ? "btn-ghost" : "btn-light")}
                  >
                    {checking ? (preparing ? "Se pregătesc video-urile…" : `Se verifică în ${checkLabel}…`) : check ? "Verifică din nou" : `Verifică în ${checkLabel}`}
                  </button>
                  <button
                    type="button"
                    onClick={() => runCreate(false)}
                    disabled={!freshCheck?.ok || checking || creating || created}
                    className={cn("btn !min-h-10 !px-4 !text-[14px] disabled:opacity-45", freshCheck?.ok ? "btn-light" : "btn-ghost")}
                  >
                    {creating ? "Se creează pe pauză…" : "Creează pe pauză"}
                  </button>
                </>
              )}
            </div>
            <p role="status" aria-live="polite" className={cn("text-[13.5px] leading-snug", notice ? ERROR_TEXT : "text-bone/75")}>
              {notice ??
                (step < 4
                  ? `Pasul ${step + 1} din ${STEPS.length}.`
                  : created
                    ? "Creată. Campania e oprită; o pornești din platformă."
                    : checking
                      ? preparing
                        ? `Video-urile ajung în contul de reclame; ${checkLabel} le procesează. Nu închide pagina.`
                        : `${checkLabel} caută contul, pixelul, video-urile și fiecare nume din targetare…`
                      : creating
                        ? "Se creează campania, grupul și reclamele, una câte una. Nu închide pagina."
                        : totalErrors > 0
                          ? "Corectează întâi ce e mai sus."
                          : freshCheck?.ok
                            ? `Se creează în ${freshCheck.account?.name ?? "contul ales"}: 1 campanie, 1 grup, ${summary?.ads.length === 1 ? "1 reclamă" : countOf(summary?.ads.length ?? 0, "reclame")} — toate oprite.`
                            : check
                              ? "Planul s-a schimbat sau verificarea a găsit ceva de corectat. Verifică din nou."
                              : "Întâi verificarea pe contul real: video-urile ajung în cont, apoi se verifică totul fără să se creeze nimic.")}
            </p>
          </div>
        </div>

        {/* Dreapta: rezumatul, mereu la vedere pe ecrane mari. */}
        <aside aria-label="Rezumatul campaniei" className="hidden xl:sticky xl:top-20 xl:block">
          <Card>
            <p className="text-[12px] font-medium uppercase tracking-wide text-dim">Campania, până acum</p>
            <dl className="mt-3 space-y-2.5 text-[13.5px]">
              <div>
                <dt className="text-dim">Contul</dt>
                <dd className="flex items-center gap-1.5 text-bone">
                  {platform ? <ChannelIcon platform={platform} /> : null}
                  {account ? (account.name ?? account.adAccount) : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-dim">Obiectivul</dt>
                <dd className="text-bone">{summary?.objective ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-dim">Bugetul</dt>
                <dd className="text-bone">{summary?.budget ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-dim">Publicul</dt>
                <dd className="text-bone">{summary ? `${summary.age}, ${summary.places.length > 0 ? joinRo(summary.places) : "—"}` : "—"}</dd>
              </div>
              <div>
                <dt className="text-dim">Reclamele</dt>
                <dd className="text-bone">{summary ? (summary.ads.length === 1 ? "1 reclamă" : countOf(summary.ads.length, "reclame")) : "—"}</dd>
              </div>
            </dl>
            {attempted.size > 0 && totalErrors > 0 ? <p className={cn("mt-3 text-[12.5px]", ERROR_TEXT)}>{totalErrors === 1 ? "Un lucru" : countOf(totalErrors, "lucruri")} de corectat.</p> : null}
          </Card>
        </aside>
      </div>
    </div>
  );
}
