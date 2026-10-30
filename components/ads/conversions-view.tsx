"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CATEGORY_LABEL,
  CONVERSION_LIMITS,
  CONVERSION_TYPE_LABEL,
  COUNTING_TYPES,
  LEAD_ACTIONS,
  LEAD_CATEGORIES,
  LEAD_KINDS,
  defaultLeadAction,
  sendToText,
  validateConversionsRequest,
  type CountingType,
  type LeadCategory,
  type LeadKind,
} from "@/lib/ads/google/conversions/standard";
import type { ConversionsCreateResponse, ConversionsPreview, ConversionsPreviewResponse } from "@/lib/ads/google/conversions/types";
import { countOf } from "@/lib/ads/plan-derive";
import { cn } from "@/lib/utils";
import { ERROR_TEXT, FIELD, FIELD_INVALID, LABEL, OK_TEXT, WARNING_TEXT } from "./tone";

/**
 * /admin/ads/conversii, crearea acțiunilor standard de lead: bifezi ce
 * lipsește din cont, ajustezi (numele, categoria, ferestrele, durata
 * apelului), verifici la Google (`validateOnly`) și abia apoi creezi — exact
 * ce s-a verificat, sau nimic (amprenta).
 */

function counted(count: number, one: string, many: string): string {
  return count === 1 ? `1 ${one}` : countOf(count, many);
}

export function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 2000);
        } catch {
          setCopied(false);
        }
      }}
      className="relative rounded-panel-sm border border-hair px-2 py-0.5 text-[11.5px] text-dim transition-colors duration-150 hover:border-hair-strong hover:text-bone"
    >
      <span aria-live="polite">{copied ? "Copiat" : "Copiază"}</span>
      <span className="sr-only"> {label}</span>
    </button>
  );
}

interface Draft {
  on: boolean;
  name: string;
  category: LeadCategory;
  counting: CountingType;
  clickWindow: string;
  viewWindow: string;
  callSeconds: string;
  value: string;
  primary: boolean;
}

function initialDraft(kind: LeadKind, on: boolean): Draft {
  const action = defaultLeadAction(kind);
  return {
    on,
    name: action.name,
    category: action.category,
    counting: action.counting,
    clickWindow: String(action.clickWindowDays),
    viewWindow: action.viewWindowDays === null ? "" : String(action.viewWindowDays),
    callSeconds: action.callSeconds === null ? "" : String(action.callSeconds),
    value: "",
    primary: action.primary,
  };
}

/** În câmpul îngust al formularului; pe larg, `COUNTING_LABEL`. */
const COUNTING_SHORT: Record<CountingType, string> = { ONE_PER_CLICK: "una pe clic", MANY_PER_CLICK: "fiecare" };

/** „1,5” → 1.5; gol → NaN (schema spune „scrie un număr”). */
const numberOf = (text: string) => (text.trim() === "" ? Number.NaN : Number(text.trim().replace(",", ".")));

type CreateAction = (input: { workspace: string; adAccount: string; request: unknown; fingerprint: string }) => Promise<ConversionsCreateResponse>;
type PreviewAction = (input: { workspace: string; adAccount: string; request: unknown }) => Promise<ConversionsPreviewResponse>;

export function ConversionsView({
  workspace,
  account,
  existing,
  blocked,
  actions,
}: {
  workspace: string;
  account: { id: string; currency: string };
  /** Pe fel: numele unei acțiuni active de același fel deja în cont. */
  existing: Record<LeadKind, string | null>;
  /** Conversiile se gestionează în alt cont — crearea e oprită, cu motivul. */
  blocked: string | null;
  actions: { preview: PreviewAction; create: CreateAction };
}) {
  const router = useRouter();
  const [drafts, setDrafts] = useState<Record<LeadKind, Draft>>(
    () => Object.fromEntries(LEAD_KINDS.map((kind) => [kind, initialDraft(kind, !existing[kind])])) as Record<LeadKind, Draft>
  );
  const [attempted, setAttempted] = useState(false);
  const [preview, setPreview] = useState<{ key: string; preview: ConversionsPreview } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [created, setCreated] = useState<ConversionsCreateResponse | null>(null);
  const [previewing, startPreview] = useTransition();
  const [creating, startCreate] = useTransition();

  const chosen = LEAD_KINDS.filter((kind) => drafts[kind].on);
  const request = {
    actions: chosen.map((kind) => {
      const draft = drafts[kind];
      const call = LEAD_ACTIONS[kind].call;
      return {
        kind,
        name: draft.name.trim(),
        category: draft.category,
        counting: draft.counting,
        clickWindowDays: numberOf(draft.clickWindow),
        viewWindowDays: call ? null : numberOf(draft.viewWindow),
        callSeconds: call ? numberOf(draft.callSeconds) : null,
        value: draft.value.trim() === "" ? null : numberOf(draft.value),
        primary: draft.primary,
      };
    }),
  };
  const key = JSON.stringify(request);
  const fresh = preview && preview.key === key ? preview.preview : null;
  const local = validateConversionsRequest(request);

  // Erorile pe câmp: întâi cele din browser (după prima încercare), apoi cele de la server.
  const fieldErrors = new Map<string, string>();
  const general: string[] = [];
  const addError = (path: string, message: string) => {
    const match = /^actions\.(\d+)(?:\.(\w+))?/.exec(path);
    const kind = match ? chosen[Number(match[1])] : undefined;
    if (kind && match?.[2]) {
      if (!fieldErrors.has(`${kind}.${match[2]}`)) fieldErrors.set(`${kind}.${match[2]}`, message);
    } else general.push(kind ? `${LEAD_ACTIONS[kind].title}: ${message}` : message);
  };
  if (attempted && !local.ok) local.errors.forEach((error) => addError(error.path, error.message));
  if (fresh) fresh.errors.forEach((error) => addError(error.path, error.message));

  const update = (kind: LeadKind, patch: Partial<Draft>) => setDrafts((previous) => ({ ...previous, [kind]: { ...previous[kind], ...patch } }));

  const runPreview = () => {
    setAttempted(true);
    setProblem(null);
    setCreated(null);
    if (!local.ok) return;
    startPreview(async () => {
      try {
        const response = await actions.preview({ workspace, adAccount: account.id, request });
        if (response.ok) setPreview({ key, preview: response.preview });
        else setProblem(response.message);
      } catch {
        setProblem("Serverul n-a răspuns. Nu s-a trimis nimic spre Google.");
      }
    });
  };
  const runCreate = () => {
    if (!fresh?.ok) return;
    startCreate(async () => {
      try {
        const response = await actions.create({ workspace, adAccount: account.id, request, fingerprint: fresh.fingerprint });
        setCreated(response);
        if (response.ok) {
          setPreview(null);
          setAttempted(false);
          setDrafts((previous) => Object.fromEntries(LEAD_KINDS.map((kind) => [kind, { ...previous[kind], on: false }])) as Record<LeadKind, Draft>);
          router.refresh();
        } else if (response.recheck) setPreview(null);
      } catch {
        setCreated({ ok: false, message: "Serverul n-a răspuns. Nu se știe dacă acțiunile s-au creat: reîncarcă pagina și uită-te în tabel înainte să încerci din nou." });
      }
    });
  };

  const field = (kind: LeadKind, name: string) => fieldErrors.get(`${kind}.${name}`);
  const errorProps = (kind: LeadKind, name: string) => {
    const message = field(kind, name);
    return message ? { "aria-invalid": true, "aria-describedby": `${kind}-${name}-eroare` } : {};
  };
  const errorText = (kind: LeadKind, name: string) => {
    const message = field(kind, name);
    return message ? (
      <p id={`${kind}-${name}-eroare`} className={cn("mt-1.5 text-[12.5px] leading-snug", ERROR_TEXT)}>
        {message}
      </p>
    ) : null;
  };

  return (
    <section aria-labelledby="actiuni-standard" className="grid gap-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-start">
      <div className="min-w-0">
        <h2 id="actiuni-standard" className="eyebrow">
          Acțiunile standard de lead
        </h2>
        <p className="mt-2 max-w-2xl text-[13.5px] leading-relaxed text-dim">
          Bifate implicit doar cele care lipsesc din cont. Se creează pornite — o conversie nu cheltuie bani — și fără nimic despre client în nume.
        </p>
        <ul className="mt-4 divide-y divide-hair rounded-panel-lg border border-hair">
          {LEAD_KINDS.map((kind) => {
            const spec = LEAD_ACTIONS[kind];
            const draft = drafts[kind];
            const id = (name: string) => `${kind}-${name}`;
            return (
              <li key={kind} className={cn("px-4 py-4 sm:px-5", draft.on && "bg-glass")}>
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    id={id("on")}
                    checked={draft.on}
                    disabled={Boolean(blocked)}
                    onChange={(event) => update(kind, { on: event.target.checked })}
                    className="mt-1 h-4 w-4 shrink-0 accent-[var(--md-a1)]"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <label htmlFor={id("on")} className="cursor-pointer text-[15px] font-semibold text-bone">
                        {spec.title}
                      </label>
                      <span className="font-md-mono text-[11px] uppercase tracking-[0.14em] text-dim">{spec.type}</span>
                    </div>
                    <p className="mt-1 text-[13.5px] leading-snug text-bone/70">{spec.what}</p>
                    {existing[kind] ? (
                      <p className={cn("mt-1 text-[13px] leading-snug", WARNING_TEXT)}>
                        Contul are deja „{existing[kind]}”. O a doua acțiune principală pentru același lucru ar număra de două ori.
                      </p>
                    ) : null}
                  </div>
                </div>

                {draft.on ? (
                  <fieldset className="mt-4 grid gap-x-4 gap-y-3 sm:grid-cols-2 sm:pl-7 xl:grid-cols-4">
                    <legend className="sr-only">Setările pentru „{spec.title}”</legend>
                    <div className="sm:col-span-2">
                      <label htmlFor={id("name")} className={LABEL}>
                        Numele în Google Ads
                      </label>
                      <input
                        id={id("name")}
                        value={draft.name}
                        maxLength={CONVERSION_LIMITS.nameMax + 20}
                        onChange={(event) => update(kind, { name: event.target.value })}
                        className={cn(FIELD, "mt-1.5 h-10 text-[14px]", field(kind, "name") && FIELD_INVALID)}
                        {...errorProps(kind, "name")}
                      />
                      {errorText(kind, "name")}
                    </div>
                    <div>
                      <label htmlFor={id("category")} className={LABEL}>
                        Categoria
                      </label>
                      <select
                        id={id("category")}
                        value={draft.category}
                        onChange={(event) => update(kind, { category: event.target.value as LeadCategory })}
                        className={cn(FIELD, "mt-1.5 h-10 text-[14px]")}
                      >
                        {LEAD_CATEGORIES.map((category) => (
                          <option key={category} value={category}>
                            {CATEGORY_LABEL[category]}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor={id("counting")} className={LABEL}>
                        Numărarea
                      </label>
                      <select
                        id={id("counting")}
                        value={draft.counting}
                        onChange={(event) => update(kind, { counting: event.target.value as CountingType })}
                        className={cn(FIELD, "mt-1.5 h-10 text-[14px]")}
                      >
                        {COUNTING_TYPES.map((counting) => (
                          <option key={counting} value={counting}>
                            {COUNTING_SHORT[counting]}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor={id("clickWindow")} className={LABEL}>
                        Zile după clic
                      </label>
                      <input
                        id={id("clickWindow")}
                        inputMode="numeric"
                        value={draft.clickWindow}
                        onChange={(event) => update(kind, { clickWindow: event.target.value })}
                        className={cn(FIELD, "mt-1.5 h-10 font-md-mono text-[14px]", field(kind, "clickWindowDays") && FIELD_INVALID)}
                        {...errorProps(kind, "clickWindowDays")}
                      />
                      {errorText(kind, "clickWindowDays") ?? (
                        <p className="mt-1.5 text-[12px] text-dim">
                          1–{spec.call ? CONVERSION_LIMITS.clickWindow.callMax : CONVERSION_LIMITS.clickWindow.max}
                        </p>
                      )}
                    </div>
                    {spec.call ? (
                      <div>
                        <label htmlFor={id("callSeconds")} className={LABEL}>
                          Durata minimă (s)
                        </label>
                        <input
                          id={id("callSeconds")}
                          inputMode="numeric"
                          value={draft.callSeconds}
                          onChange={(event) => update(kind, { callSeconds: event.target.value })}
                          className={cn(FIELD, "mt-1.5 h-10 font-md-mono text-[14px]", field(kind, "callSeconds") && FIELD_INVALID)}
                          {...errorProps(kind, "callSeconds")}
                        />
                        {errorText(kind, "callSeconds") ?? <p className="mt-1.5 text-[12px] text-dim">Un apel mai scurt nu e lead.</p>}
                      </div>
                    ) : (
                      <div>
                        <label htmlFor={id("viewWindow")} className={LABEL}>
                          Zile după afișare
                        </label>
                        <input
                          id={id("viewWindow")}
                          inputMode="numeric"
                          value={draft.viewWindow}
                          onChange={(event) => update(kind, { viewWindow: event.target.value })}
                          className={cn(FIELD, "mt-1.5 h-10 font-md-mono text-[14px]", field(kind, "viewWindowDays") && FIELD_INVALID)}
                          {...errorProps(kind, "viewWindowDays")}
                        />
                        {errorText(kind, "viewWindowDays") ?? <p className="mt-1.5 text-[12px] text-dim">1–{CONVERSION_LIMITS.viewWindow.max}</p>}
                      </div>
                    )}
                    <div>
                      <label htmlFor={id("value")} className={LABEL}>
                        Valoare ({account.currency})
                      </label>
                      <input
                        id={id("value")}
                        inputMode="decimal"
                        value={draft.value}
                        placeholder="fără"
                        onChange={(event) => update(kind, { value: event.target.value })}
                        className={cn(FIELD, "mt-1.5 h-10 font-md-mono text-[14px]", field(kind, "value") && FIELD_INVALID)}
                        {...errorProps(kind, "value")}
                      />
                      {errorText(kind, "value") ?? <p className="mt-1.5 text-[12px] text-dim">Aceeași la fiecare conversie.</p>}
                    </div>
                    <label className="flex items-center gap-3 self-start pt-6 text-[14px] text-bone/85 sm:col-span-2 xl:col-span-1">
                      <input type="checkbox" checked={draft.primary} onChange={(event) => update(kind, { primary: event.target.checked })} className="h-4 w-4 accent-[var(--md-a1)]" />
                      Principală (contează la licitare)
                    </label>
                  </fieldset>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>

      <div className="min-w-0 space-y-4 lg:sticky lg:top-[8rem]">
        {blocked ? (
          <p role="alert" className={cn("rounded-panel-lg border border-[#d93025]/30 px-4 py-3 text-[14px] leading-relaxed", ERROR_TEXT)}>
            {blocked}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={runPreview} disabled={chosen.length === 0 || previewing || creating || Boolean(blocked)} className="btn btn-light disabled:cursor-not-allowed disabled:opacity-45">
            {previewing ? "Se verifică…" : "Verifică în Google"}
          </button>
          <button type="button" onClick={runCreate} disabled={!fresh?.ok || creating || previewing} className="btn btn-ghost disabled:cursor-not-allowed disabled:opacity-45">
            {creating ? "Se creează…" : `Creează ${chosen.length === 1 ? "acțiunea" : "acțiunile"}`}
          </button>
        </div>
        <p className="text-[13px] leading-snug text-dim" aria-live="polite">
          {chosen.length === 0
            ? "Bifează o acțiune ca s-o creezi."
            : preview && !fresh
              ? "Ai schimbat formularul: verifică din nou."
              : fresh?.ok
                ? `Gata de creat: ${counted(fresh.operations, "acțiune", "acțiuni")}, într-o singură cerere.`
                : "Întâi verificarea: regulile Google, numele din cont, apoi validateOnly."}
        </p>
        {general.length > 0 ? (
          <ul role="alert" className={cn("space-y-1 text-[14px] leading-snug", ERROR_TEXT)}>
            {general.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        ) : null}
        {problem ? <p role="alert" className={cn("text-[14px]", ERROR_TEXT)}>{problem}</p> : null}
        {created ? <CreatedResult result={created} /> : null}
        {fresh ? <PreviewRows preview={fresh} /> : null}
      </div>
    </section>
  );
}

function PreviewRows({ preview }: { preview: ConversionsPreview }) {
  return (
    <div className="rounded-panel-lg border border-hair bg-char/60 px-4 py-4">
      <p className={cn("text-[13.5px] font-semibold", preview.ok ? OK_TEXT : ERROR_TEXT)}>
        {preview.ok ? "Google acceptă tot. Nimic creat încă." : "Nu se poate crea așa — vezi problemele."}
      </p>
      <ul className="mt-3 space-y-3">
        {preview.rows.map((row) => (
          <li key={row.kind}>
            <p className="text-[14px] font-medium text-bone [overflow-wrap:anywhere]">{row.name}</p>
            <p className="mt-0.5 text-[12.5px] leading-snug text-dim">{row.facts.join(" · ")}</p>
            {row.similar ? <p className={cn("mt-1 text-[12.5px] leading-snug", WARNING_TEXT)}>{row.similar}</p> : null}
          </li>
        ))}
      </ul>
      {preview.warnings.length > 0 ? (
        <ul className={cn("mt-3 space-y-1 border-t border-hair pt-3 text-[12.5px] leading-snug", WARNING_TEXT)}>
          {preview.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function CreatedResult({ result }: { result: ConversionsCreateResponse }) {
  if (!result.ok) {
    return (
      <p role="alert" className={cn("text-[14px]", ERROR_TEXT)}>
        {result.message}
      </p>
    );
  }
  return (
    <div role="status" className="rounded-panel-lg border border-[#1fb583]/30 bg-[#1fb583]/[0.05] px-4 py-4">
      <p className={cn("text-[14px] font-semibold", OK_TEXT)}>{result.created.length === 1 ? "Acțiune creată." : `${result.created.length} acțiuni create.`}</p>
      <ul className="mt-3 space-y-2.5">
        {result.created.map((item) => (
          <li key={item.id || item.name} className="text-[13.5px]">
            <span className="text-bone">{item.name}</span>{" "}
            <span className="text-dim">· {CONVERSION_TYPE_LABEL[item.type] ?? item.type} · id {item.id || "—"}</span>
            {item.sendTo ? (
              <span className="mt-1 flex flex-wrap items-center gap-2">
                <code className="font-md-mono text-[12.5px] text-bone/90 [overflow-wrap:anywhere]">{sendToText(item.sendTo)}</code>
                <CopyButton value={sendToText(item.sendTo)} label={`eticheta pentru ${item.name}`} />
              </span>
            ) : (
              <span className="mt-0.5 block text-[12.5px] text-dim">
                {item.type === "AD_CALL" ? "Fără etichetă: se leagă de butonul de apel (planul de căutare, assets.call.conversion_action_id)." : "Eticheta n-a apărut încă: reîncarcă pagina peste un minut."}
              </span>
            )}
          </li>
        ))}
      </ul>
      {result.journalWarning ? <p className={cn("mt-3 text-[12.5px]", WARNING_TEXT)}>{result.journalWarning}</p> : null}
    </div>
  );
}
