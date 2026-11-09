"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
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
import { CopyButton, InlineNote } from "@/components/panou/ui/actions";
import { Btn, Card, Pill, SectionTitle } from "@/components/panou/ui/primitives";
import { Info } from "@/components/panou/ui/info";
import { SoftSelect } from "@/components/panou/ui/select";
import { useToast } from "@/components/panou/ui/toast";
import { cn } from "@/lib/utils";
import { Camp, campClass, descriere } from "./cautari-conversii-ui";

/**
 * Crearea acțiunilor standard de lead pe un cont Google existent: bifezi ce
 * lipsește din cont, ajustezi (numele, categoria, ferestrele, durata apelului),
 * verifici la Google (`validateOnly`) și abia apoi creezi — exact ce s-a
 * verificat, sau nimic (amprenta). O conversie nu cheltuie bani; portalul nu
 * șterge nimic și nu schimbă nicio acțiune existentă.
 */

function counted(count: number, one: string, many: string): string {
  return count === 1 ? `1 ${one}` : countOf(count, many);
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

export function ConversiiCreare({
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
  const { notify } = useToast();
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
          notify(response.created.length === 1 ? "Acțiune de conversie creată." : `${response.created.length} acțiuni de conversie create.`);
          router.refresh();
        } else if (response.recheck) setPreview(null);
      } catch {
        setCreated({ ok: false, message: "Serverul n-a răspuns. Nu se știe dacă s-au creat: reîncarcă pagina și verifică lista înainte să reîncerci." });
      }
    });
  };

  const field = (kind: LeadKind, name: string) => fieldErrors.get(`${kind}.${name}`);

  return (
    <Card>
      <SectionTitle
        title="Acțiuni standard lipsă"
        info="Bifate doar cele care lipsesc. Se creează pornite (o conversie nu cheltuie bani), fără date despre client în nume."
      />

      <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-start">
        <ul className="min-w-0 space-y-2.5">
          {LEAD_KINDS.map((kind) => {
            const spec = LEAD_ACTIONS[kind];
            const draft = drafts[kind];
            const id = (name: string) => `${kind}-${name}`;
            return (
              <li key={kind} className={cn("rounded-xl border px-4 py-3.5 transition-colors", draft.on ? "border-lav/25 bg-lav/[0.04]" : "border-white/[0.07]")}>
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    id={id("on")}
                    checked={draft.on}
                    disabled={Boolean(blocked)}
                    onChange={(event) => update(kind, { on: event.target.checked })}
                    className="mt-1 h-4 w-4 shrink-0 accent-lav"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="flex items-center gap-1.5">
                        <label htmlFor={id("on")} className="cursor-pointer text-[15px] font-medium">
                          {spec.title}
                        </label>
                        <Info label={`Ce numără „${spec.title}”`}>{spec.what}</Info>
                      </span>
                      <span className="font-mono text-[12px] uppercase tracking-[0.14em] text-muted-foreground">{spec.type}</span>
                    </div>
                    {existing[kind] ? (
                      <p className="mt-1.5 text-[13.5px] leading-snug text-[#FFC79C]">Există deja „{existing[kind]}”: o a doua principală ar număra dublu.</p>
                    ) : null}
                  </div>
                </div>

                {draft.on ? (
                  <fieldset className="mt-4 grid gap-x-3 gap-y-3 sm:grid-cols-2 sm:pl-7">
                    <legend className="sr-only">Setările pentru „{spec.title}”</legend>
                    <Camp id={id("name")} label="Nume" error={field(kind, "name")} className="sm:col-span-2">
                      <input
                        id={id("name")}
                        value={draft.name}
                        maxLength={CONVERSION_LIMITS.nameMax + 20}
                        onChange={(event) => update(kind, { name: event.target.value })}
                        className={campClass(Boolean(field(kind, "name")))}
                        {...descriere(id("name"), field(kind, "name"))}
                      />
                    </Camp>
                    <Camp id={id("category")} label="Categoria">
                      <SoftSelect
                        id={id("category")}
                        value={draft.category}
                        onChange={(value) => update(kind, { category: value as LeadCategory })}
                        options={LEAD_CATEGORIES.map((category) => ({ value: category, label: CATEGORY_LABEL[category] ?? category }))}
                      />
                    </Camp>
                    <Camp id={id("counting")} label="Numărarea">
                      <SoftSelect
                        id={id("counting")}
                        value={draft.counting}
                        onChange={(value) => update(kind, { counting: value as CountingType })}
                        options={COUNTING_TYPES.map((counting) => ({ value: counting, label: COUNTING_SHORT[counting] }))}
                      />
                    </Camp>
                    <Camp
                      id={id("clickWindow")}
                      label="Zile după clic"
                      error={field(kind, "clickWindowDays")}
                      hint={`1–${spec.call ? CONVERSION_LIMITS.clickWindow.callMax : CONVERSION_LIMITS.clickWindow.max}`}
                    >
                      <input
                        id={id("clickWindow")}
                        inputMode="numeric"
                        value={draft.clickWindow}
                        onChange={(event) => update(kind, { clickWindow: event.target.value })}
                        className={campClass(Boolean(field(kind, "clickWindowDays")), true)}
                        {...descriere(id("clickWindow"), field(kind, "clickWindowDays"), true)}
                      />
                    </Camp>
                    {spec.call ? (
                      <Camp id={id("callSeconds")} label="Durata minimă (s)" error={field(kind, "callSeconds")} info="Un apel mai scurt nu e lead.">
                        <input
                          id={id("callSeconds")}
                          inputMode="numeric"
                          value={draft.callSeconds}
                          onChange={(event) => update(kind, { callSeconds: event.target.value })}
                          className={campClass(Boolean(field(kind, "callSeconds")), true)}
                          {...descriere(id("callSeconds"), field(kind, "callSeconds"))}
                        />
                      </Camp>
                    ) : (
                      <Camp id={id("viewWindow")} label="Zile după afișare" error={field(kind, "viewWindowDays")} hint={`1–${CONVERSION_LIMITS.viewWindow.max}`}>
                        <input
                          id={id("viewWindow")}
                          inputMode="numeric"
                          value={draft.viewWindow}
                          onChange={(event) => update(kind, { viewWindow: event.target.value })}
                          className={campClass(Boolean(field(kind, "viewWindowDays")), true)}
                          {...descriere(id("viewWindow"), field(kind, "viewWindowDays"), true)}
                        />
                      </Camp>
                    )}
                    <Camp id={id("value")} label={`Valoare (${account.currency})`} error={field(kind, "value")} info="Aceeași la fiecare conversie.">
                      <input
                        id={id("value")}
                        inputMode="decimal"
                        value={draft.value}
                        placeholder="fără"
                        onChange={(event) => update(kind, { value: event.target.value })}
                        className={campClass(Boolean(field(kind, "value")), true)}
                        {...descriere(id("value"), field(kind, "value"))}
                      />
                    </Camp>
                    <label className="flex items-center gap-2.5 self-end pb-1.5 text-[14px] text-foreground/85 sm:col-span-2">
                      <input type="checkbox" checked={draft.primary} onChange={(event) => update(kind, { primary: event.target.checked })} className="h-4 w-4 accent-lav" />
                      Principală (contează la licitare)
                    </label>
                  </fieldset>
                ) : null}
              </li>
            );
          })}
        </ul>

        <div className="min-w-0 space-y-3 lg:sticky lg:top-24">
          {blocked ? <InlineNote tone="rose">{blocked}</InlineNote> : null}
          <div className="flex flex-wrap gap-2">
            <Btn variant="primary" size="sm" onClick={runPreview} disabled={chosen.length === 0 || previewing || creating || Boolean(blocked)}>
              {previewing ? "Se verifică…" : "Verifică în Google"}
            </Btn>
            <Btn variant="mint" size="sm" icon={Check} onClick={runCreate} disabled={!fresh?.ok || creating || previewing}>
              {creating ? "Se creează…" : `Creează ${chosen.length === 1 ? "acțiunea" : "acțiunile"}`}
            </Btn>
          </div>
          <p className="text-[13.5px] leading-snug text-muted-foreground" aria-live="polite">
            {chosen.length === 0
              ? "Bifează o acțiune."
              : preview && !fresh
                ? "Formular schimbat: verifică din nou."
                : fresh?.ok
                  ? `Gata: ${counted(fresh.operations, "acțiune", "acțiuni")}.`
                  : "Verifică întâi în Google. Nu se creează nimic."}
          </p>
          {general.length > 0 ? (
            <ul role="alert" className="space-y-1 text-[14px] leading-snug text-rose">
              {general.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          ) : null}
          {problem ? (
            <p role="alert" className="text-[14px] leading-snug text-rose">
              {problem}
            </p>
          ) : null}
          {created ? <Creata result={created} /> : null}
          {fresh ? <Verificare preview={fresh} /> : null}
        </div>
      </div>
    </Card>
  );
}

/** Ce a găsit verificarea: ce se creează, ce s-ar dubla, avertismentele. */
function Verificare({ preview }: { preview: ConversionsPreview }) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3.5">
      <Pill tone={preview.ok ? "mint" : "rose"} dot>
        {preview.ok ? "Google acceptă tot" : "Nu se poate crea așa"}
      </Pill>
      <ul className="mt-3 space-y-3">
        {preview.rows.map((row) => (
          <li key={row.kind}>
            <p className="text-[14px] [overflow-wrap:anywhere]">{row.name}</p>
            <p className="mt-0.5 text-[12.5px] leading-snug text-muted-foreground">{row.facts.join(" · ")}</p>
            {row.similar ? <p className="mt-1 text-[12.5px] leading-snug text-[#FFC79C]">{row.similar}</p> : null}
          </li>
        ))}
      </ul>
      {preview.warnings.length > 0 ? (
        <ul className="mt-3 space-y-1 border-t border-white/[0.06] pt-3 text-[13px] leading-snug text-[#FFC79C]">
          {preview.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** Rezultatul creării: fiecare acțiune cu id-ul și eticheta ei, gata de copiat. */
function Creata({ result }: { result: ConversionsCreateResponse }) {
  if (!result.ok) {
    return (
      <InlineNote tone="rose">
        <span role="alert">{result.message}</span>
      </InlineNote>
    );
  }
  return (
    <InlineNote tone="mint">
      <div role="status">
        <p className="font-medium">{result.created.length === 1 ? "Acțiune creată." : `${result.created.length} acțiuni create.`}</p>
        <ul className="mt-2.5 space-y-2.5">
          {result.created.map((item) => (
            <li key={item.id || item.name} className="text-[13.5px]">
              <span>{item.name}</span> <span className="opacity-70">· {CONVERSION_TYPE_LABEL[item.type] ?? item.type} · id {item.id || "—"}</span>
              {item.sendTo ? (
                <span className="mt-1 flex flex-wrap items-center gap-2">
                  <code className="font-mono text-[13px] [overflow-wrap:anywhere]">{sendToText(item.sendTo)}</code>
                  <CopyButton value={sendToText(item.sendTo)} label="Copiază eticheta" size="xs" variant="ghost" />
                </span>
              ) : (
                <span className="mt-0.5 block text-[13px] opacity-70">
                  {item.type === "AD_CALL"
                    ? "Fără etichetă: se leagă de butonul de apel (assets.call.conversion_action_id)."
                    : "Eticheta apare în ~1 minut: reîncarcă pagina."}
                </span>
              )}
            </li>
          ))}
        </ul>
        {result.journalWarning ? <p className="mt-3 text-[13px] text-[#FFC79C]">{result.journalWarning}</p> : null}
      </div>
    </InlineNote>
  );
}
