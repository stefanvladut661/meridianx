"use client";

import Link from "next/link";
import { useId, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Megaphone, Phone, PhoneCall, Plus, Trash2 } from "lucide-react";
import { PLATFORM_LABEL, type Platform } from "@/lib/ads/constants";
import { formatDay } from "@/lib/ads/metrics";
import { resultUnit } from "@/lib/ads/model/results";
import {
  CALL_RESULTS,
  CALL_RESULT_LABEL,
  NOTE_MAX,
  UNKNOWN_CHANNEL,
  callBreakdown,
  callDayProblem,
  callFormSchema,
  countCalls,
  type CallFormInput,
  type CallResult,
  type CallRow,
} from "@/lib/ads/model/calls-shared";
import { Btn, Card, Pill, SegmentedControl, Stat, type PillTone } from "@/components/panou/ui/primitives";
import { EmptyState } from "@/components/panou/ui/states";
import { ConfirmDialog, InlineNote } from "@/components/panou/ui/actions";
import { Modal } from "@/components/panou/ui/modal";
import { SoftSelect, TextInput } from "@/components/panou/ui/select";
import { useToast } from "@/components/panou/ui/toast";
import { useQueryParams } from "@/components/panou/ui/use-query-params";
import { cn } from "@/lib/utils";
import { CanalMark } from "./canal-mark";

/**
 * Apeluri (CallsPage din redesign). Aspectul e al prototipului: antet cu filtru,
 * carduri cu nota apelului, fereastră pentru „Notează”, confirmare la ștergere.
 * Datele sunt cele reale: apelurile se notează de mână (ziua, canalul, campania,
 * ce a ieșit), iar „Șterge nota” scoate apelul din listă și din numărătoarea
 * campaniei. Nimic de aici nu ajunge la Meta, Google sau TikTok.
 */

type Failure = { ok: false; message: string; field?: string };

export interface ApeluriActions {
  add: (input: CallFormInput) => Promise<{ ok: true; id: string } | Failure>;
  remove: (input: { id: string }) => Promise<{ ok: true } | Failure>;
}

export interface CallCampaign {
  id: string;
  name: string;
  platform: Platform;
  clientId: string;
  removed: boolean;
}

type Field = "clientId" | "channel" | "entityId" | "calledOn" | "result" | "note";

const CHANNEL_ORDER: Platform[] = ["meta", "google", "tiktok"];

const RESULT_TONE: Record<CallResult, PillTone> = { intrebare: "neutral", programat: "lav", semnat: "mint" };
const RESULT_BAR: Record<CallResult, string> = { intrebare: "bg-white/25", programat: "bg-lav", semnat: "bg-mint" };
const RESULT_HINT: Record<CallResult, string> = {
  intrebare: "a întrebat de preț sau de program",
  programat: "o întâlnire, o filmare, o vizionare",
  semnat: "contract sau comandă",
};

const LABEL = "text-[11px] uppercase tracking-[0.12em] text-muted-foreground";
const TEXTAREA =
  "mt-1.5 w-full resize-y rounded-lg border border-white/[0.12] bg-white/[0.03] p-3 text-[12.5px] outline-none placeholder:text-muted-foreground/60 focus:border-lav/50";

/** Chip-ul radio: culoarea spune care e ales, bordura roz spune că lipsește. */
const chip = (selected: boolean, invalid: boolean) =>
  cn(
    "flex min-h-9 cursor-pointer items-center gap-2 rounded-lg border px-3 text-[12.5px] font-medium transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-lav",
    selected ? "border-lav/40 bg-lav/12 text-[#D8CCFF]" : "border-white/[0.12] bg-white/[0.03] text-foreground/80 hover:bg-white/[0.06]",
    invalid && !selected && "border-rose/50"
  );

function NoteForm({
  clients,
  campaigns,
  defaults,
  add,
  onClose,
}: {
  clients: Array<{ id: string; name: string }>;
  campaigns: CallCampaign[];
  defaults: { clientId: string; channel: Platform | null; today: string };
  add: ApeluriActions["add"];
  onClose: () => void;
}) {
  const router = useRouter();
  const { notify } = useToast();
  const id = useId();
  const [pending, start] = useTransition();
  const [clientId, setClientId] = useState(defaults.clientId);
  const [channel, setChannel] = useState<string>(defaults.channel ?? "");
  const [entityId, setEntityId] = useState("");
  const [calledOn, setCalledOn] = useState(defaults.today);
  const [result, setResult] = useState<string>("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [status, setStatus] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const form = useRef<HTMLFormElement>(null);
  const [saved, setSaved] = useState(0);

  const choices = useMemo(
    () => campaigns.filter((campaign) => campaign.clientId === clientId && (channel === "" || channel === UNKNOWN_CHANNEL || campaign.platform === channel)),
    [campaigns, clientId, channel]
  );
  const clientName = clients.find((client) => client.id === clientId)?.name ?? "";

  const focusField = (field: Field) => form.current?.querySelector<HTMLElement>(`[data-field="${field}"] select, [data-field="${field}"] input, [data-field="${field}"] textarea, [data-field="${field}"]`)?.focus();

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setStatus(null);
    const input: CallFormInput = { clientId, channel: channel as CallFormInput["channel"], entityId, calledOn, result: result as CallResult, note };
    const parsed = callFormSchema.safeParse(input);
    const found: Partial<Record<Field, string>> = {};
    if (!parsed.success) for (const issue of parsed.error.issues) found[issue.path[0] as Field] ??= issue.message;
    const dayProblem = /^\d{4}-\d{2}-\d{2}$/.test(calledOn) ? callDayProblem(calledOn, defaults.today) : null;
    if (dayProblem) found.calledOn ??= dayProblem;
    setErrors(found);
    const first = (["calledOn", "clientId", "channel", "entityId", "result", "note"] as Field[]).find((field) => found[field]);
    if (first) {
      setStatus({ tone: "error", text: "Apelul nu e notat: completează ce e marcat." });
      focusField(first);
      return;
    }
    start(async () => {
      const response = await add(input).catch(() => ({ ok: false as const, message: "Serverul n-a răspuns. Apelul nu e notat; încearcă din nou." }) as Failure);
      if (!response.ok) {
        if (response.field) {
          setErrors({ [response.field as Field]: response.message });
          focusField(response.field as Field);
        }
        setStatus({ tone: "error", text: `Apelul nu e notat. ${response.message}` });
        return;
      }
      const text = `Apel notat${clientId !== defaults.clientId ? ` la ${clientName}` : ""}.`;
      notify(text);
      setStatus({ tone: "ok", text: `${text} Poți nota următorul.` });
      setSaved((count) => count + 1);
      setResult("");
      setNote("");
      setErrors({});
      router.refresh();
    });
  };

  const fieldError = (field: Field) =>
    errors[field] ? (
      <p id={`${id}-${field}-eroare`} className="mt-1 text-[11.5px] text-rose">
        {errors[field]}
      </p>
    ) : null;

  return (
    <form ref={form} onSubmit={submit} noValidate aria-labelledby={`${id}-titlu`}>
      <h2 id={`${id}-titlu`} className="text-[16px] font-semibold">
        Notează un apel
      </h2>
      <p className="text-[12px] text-muted-foreground">Cineva a sunat de pe o reclamă. Zece secunde, și din telefon.</p>

      <div className="mt-4 space-y-3">
        <div className="grid items-end gap-3 sm:grid-cols-2">
          <label className="block">
            <span className={LABEL}>Ziua</span>
            <TextInput
              data-field="calledOn"
              type="date"
              className="mt-1.5"
              value={calledOn}
              max={defaults.today}
              onChange={(event) => setCalledOn(event.currentTarget.value)}
              aria-invalid={Boolean(errors.calledOn)}
              aria-describedby={errors.calledOn ? `${id}-calledOn-eroare` : undefined}
            />
            {fieldError("calledOn")}
          </label>
          <div data-field="clientId">
            <SoftSelect
              label="Clientul"
              value={clientId}
              onChange={(value) => {
                setClientId(value);
                setEntityId("");
              }}
              options={clients.map((client) => ({ value: client.id, label: client.name }))}
            />
            {fieldError("clientId")}
          </div>
        </div>

        <fieldset aria-describedby={errors.channel ? `${id}-channel-eroare` : undefined}>
          <legend className={LABEL}>De unde a aflat</legend>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {[...CHANNEL_ORDER, UNKNOWN_CHANNEL].map((option, index) => (
              <label key={option} className={chip(channel === option, Boolean(errors.channel))}>
                <input
                  {...(index === 0 ? { "data-field": "channel" } : {})}
                  type="radio"
                  name={`${id}-canal`}
                  value={option}
                  checked={channel === option}
                  onChange={() => {
                    setChannel(option);
                    if (option !== UNKNOWN_CHANNEL && campaigns.find((campaign) => campaign.id === entityId)?.platform !== option) setEntityId("");
                  }}
                  className="sr-only"
                />
                {option === UNKNOWN_CHANNEL ? "Nu știu" : <CanalMark platform={option as Platform} size="sm" />}
              </label>
            ))}
          </div>
          {fieldError("channel")}
        </fieldset>

        <div data-field="entityId">
          <SoftSelect
            label="Legătură cu o campanie (dacă știi)"
            value={entityId || "none"}
            onChange={(value) => setEntityId(value === "none" ? "" : value)}
            options={[
              { value: "none", label: "Nu știu / fără campanie" },
              ...choices.map((campaign) => ({
                value: campaign.id,
                label: `${channel === "" || channel === UNKNOWN_CHANNEL ? `${PLATFORM_LABEL[campaign.platform]} · ` : ""}${campaign.name}${campaign.removed ? " (ștearsă)" : ""}`,
              })),
            ]}
          />
          {choices.length === 0 ? <p className="mt-1 text-[11px] text-muted-foreground">Clientul n-are campanii citite pe canalul ăsta. Apelul se notează și fără.</p> : null}
          {fieldError("entityId")}
        </div>

        <fieldset aria-describedby={errors.result ? `${id}-result-eroare` : undefined}>
          <legend className={LABEL}>Ce a ieșit</legend>
          <div className="mt-1.5 grid gap-2 sm:grid-cols-3">
            {CALL_RESULTS.map((option, index) => (
              <label key={option} className={cn(chip(result === option, Boolean(errors.result)), "min-h-14 flex-col items-start justify-center gap-0 py-2")}>
                <input
                  {...(index === 0 ? { "data-field": "result" } : {})}
                  type="radio"
                  name={`${id}-rezultat`}
                  value={option}
                  checked={result === option}
                  onChange={() => setResult(option)}
                  className="sr-only"
                />
                <span>{CALL_RESULT_LABEL[option]}</span>
                <span className="text-[11px] font-normal text-muted-foreground">{RESULT_HINT[option]}</span>
              </label>
            ))}
          </div>
          {fieldError("result")}
        </fieldset>

        <label className="block">
          <span className={LABEL}>
            Notă <span className="normal-case tracking-normal">(opțional)</span>
          </span>
          <textarea
            data-field="note"
            value={note}
            onChange={(event) => setNote(event.currentTarget.value)}
            maxLength={NOTE_MAX}
            rows={3}
            placeholder="Ce a cerut, când revine, cine a vorbit cu el"
            aria-invalid={Boolean(errors.note)}
            aria-describedby={errors.note ? `${id}-note-eroare` : undefined}
            className={cn(TEXTAREA, errors.note && "border-rose/50")}
          />
          <span className="mt-0.5 block text-right text-[11px] text-muted-foreground">{note.length > NOTE_MAX - 200 ? `${NOTE_MAX - note.length} caractere rămase` : ""}</span>
          {fieldError("note")}
        </label>
      </div>

      <p role="status" aria-live="polite" className={cn("mt-3 min-h-4 text-[12px]", status?.tone === "error" ? "text-rose" : "text-mint")}>
        {status?.text ?? ""}
      </p>

      <div className="mt-3 flex justify-end gap-2">
        <Btn variant="ghost" onClick={onClose}>
          {saved > 0 ? "Gata" : "Renunță"}
        </Btn>
        <Btn type="submit" variant="primary" disabled={pending}>
          {pending ? "Se notează…" : "Notează apelul"}
        </Btn>
      </div>
    </form>
  );
}

function CallCard({ call, onDelete }: { call: CallRow; onDelete: (call: CallRow) => void }) {
  const campaignHref = call.entityId && call.platform ? `/admin/ads?client=${call.clientId}&canal=${call.platform}&rand=${call.entityId}` : null;
  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone={RESULT_TONE[call.result]} dot>
              {CALL_RESULT_LABEL[call.result]}
            </Pill>
            {call.platform ? <CanalMark platform={call.platform} size="sm" /> : <span className="text-[11.5px] text-muted-foreground">canal necunoscut</span>}
          </div>
          <p className="mt-1.5 flex flex-wrap items-center gap-2 text-[11.5px] text-muted-foreground">
            <Megaphone className="h-3 w-3" aria-hidden="true" />
            {campaignHref ? (
              <Link href={campaignHref} className="text-foreground/80 underline-offset-2 hover:text-lav hover:underline">
                {call.campaignName ?? "campania"}
              </Link>
            ) : (
              <span>Nu e legat de nicio campanie</span>
            )}
            <span>·</span>
            <span>notat de {call.createdByEmail ?? "—"}</span>
          </p>
          {call.note ? (
            <div className="mt-2 rounded-lg border border-white/[0.06] bg-white/[0.025] px-3 py-2">
              <p className="whitespace-pre-line text-[12px] leading-relaxed text-foreground/80">{call.note}</p>
            </div>
          ) : null}
        </div>
        <Btn size="sm" variant="ghost" icon={Trash2} onClick={() => onDelete(call)} aria-label={`Șterge nota apelului din ${formatDay(call.calledOn, true)}`}>
          Șterge nota
        </Btn>
      </div>
    </Card>
  );
}

export function ApeluriScreen({
  clients,
  campaigns,
  calls,
  defaults,
  scope,
  missing,
  actions,
}: {
  clients: Array<{ id: string; name: string }>;
  campaigns: CallCampaign[];
  calls: CallRow[];
  defaults: { clientId: string; channel: Platform | null; today: string };
  /** „Termo Exemplu · ultimele 7 zile · Meta” — ce arată lista. */
  scope: { client: string; period: string; channel: string | null };
  missing: string | null;
  actions: ApeluriActions;
}) {
  const router = useRouter();
  const { notify } = useToast();
  const { get, setMany } = useQueryParams();
  const only = get("doar", "toate");
  const filter: CallResult | "toate" = (CALL_RESULTS as readonly string[]).includes(only) ? (only as CallResult) : "toate";
  const [writing, setWriting] = useState(false);
  const [deleting, setDeleting] = useState<CallRow | null>(null);

  const total = countCalls(calls);
  const unlinked = calls.filter((call) => !call.entityId).length;
  const list = filter === "toate" ? calls : calls.filter((call) => call.result === filter);
  const byDay = new Map<string, CallRow[]>();
  for (const call of list) byDay.set(call.calledOn, [...(byDay.get(call.calledOn) ?? []), call]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold leading-none sm:text-[26px]">Apeluri</h1>
          <p className="mt-2 max-w-2xl text-[12.5px] text-muted-foreground">
            Apelurile venite de pe reclame, notate de mână. Platformele știu doar că cineva a apăsat „Sună”; ce a ieșit din apel știi tu.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {calls.length > 0 ? (
            <SegmentedControl
              options={[
                { value: "toate", label: "Toate" },
                ...CALL_RESULTS.map((result) => ({ value: result, label: CALL_RESULT_LABEL[result] })),
              ]}
              value={filter}
              onChange={(value) => setMany({ doar: value === "toate" ? "" : value })}
              ariaLabel="Filtru apeluri după rezultat"
              size="sm"
              className="max-w-full overflow-x-auto pu-no-scrollbar"
            />
          ) : null}
          <Btn size="sm" variant="primary" icon={Plus} disabled={Boolean(missing)} onClick={() => setWriting(true)}>
            Notează un apel
          </Btn>
        </div>
      </div>

      {missing ? (
        <InlineNote tone="rose">
          <p className="font-medium">Apelurile nu se pot nota încă.</p>
          <p className="mt-1">{missing}</p>
        </InlineNote>
      ) : null}

      {total.total > 0 ? (
        <Card>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Stat className="col-span-2 sm:col-span-1" label="Apeluri" value={total.total} hint={`${scope.client} · ${scope.period.toLowerCase()}${scope.channel ? ` · ${scope.channel}` : ""}`} />
            <Stat label="Programate" value={total.byResult.programat} tone="dim" />
            <Stat label="Semnate" value={total.byResult.semnat} tone="dim" />
          </div>
          {/* Cât din apeluri ajung mai departe: întrebare → programare → contract. */}
          <div aria-hidden="true" className="mt-4 flex h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
            {[...CALL_RESULTS].reverse().map((result) =>
              total.byResult[result] > 0 ? <span key={result} className={RESULT_BAR[result]} style={{ width: `${(total.byResult[result] / total.total) * 100}%` }} /> : null
            )}
          </div>
          <p className="mt-2 text-[11.5px] text-muted-foreground">
            {callBreakdown(total)}
            {unlinked > 0
              ? ` · ${unlinked === total.total ? "niciunul nu e legat de o campanie" : `${unlinked} din ${total.total} nu sunt legate de o campanie`}; în Campanii, coloana „Apeluri notate” le numără doar pe cele legate`
              : ""}
            .
          </p>
        </Card>
      ) : null}

      {list.length === 0 ? (
        <Card className="p-0">
          <EmptyState
            icon={PhoneCall}
            title={calls.length === 0 ? "Niciun apel notat" : `Niciun apel „${CALL_RESULT_LABEL[filter as CallResult].toLowerCase()}”`}
            text={
              calls.length === 0
                ? "Când sună cineva de pe o reclamă, notează-l: ziua, de unde a aflat și ce a ieșit. Platformele numără clicul pe „Sună”; doar tu știi ce s-a vorbit."
                : "Alege „Toate” ca să vezi apelurile din perioada asta, indiferent de rezultat."
            }
            action={
              calls.length === 0 ? (
                <Btn size="sm" variant="primary" icon={Plus} disabled={Boolean(missing)} onClick={() => setWriting(true)}>
                  Notează primul apel
                </Btn>
              ) : (
                <Btn size="sm" variant="outline" onClick={() => setMany({ doar: "" })}>
                  Vezi toate apelurile
                </Btn>
              )
            }
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {[...byDay.entries()].map(([day, items]) => (
            <section key={day} aria-label={formatDay(day, true)}>
              <h2 className="mb-2 px-1 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                <Phone className="mr-1.5 inline h-3 w-3 align-[-1px]" aria-hidden="true" />
                {formatDay(day, true)} · {resultUnit(items.length, "call")}
              </h2>
              <ul className="space-y-2.5">
                {items.map((call) => (
                  <li key={call.id}>
                    <CallCard call={call} onDelete={setDeleting} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <Modal open={writing} onOpenChange={setWriting} label="Notează un apel" className="max-h-[calc(100dvh-2rem)] w-[min(36rem,calc(100vw-2rem))] overflow-y-auto">
        <NoteForm clients={clients} campaigns={campaigns} defaults={defaults} add={actions.add} onClose={() => setWriting(false)} />
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Ștergi nota apelului?"
        description={deleting ? `${formatDay(deleting.calledOn, true)} · ${deleting.platform ? PLATFORM_LABEL[deleting.platform] : "canal necunoscut"} · ${CALL_RESULT_LABEL[deleting.result]}` : ""}
        consequence="Apelul dispare din listă și din numărătoarea campaniei. Nu se poate anula; îl poți nota din nou de mână."
        confirmLabel="Șterge nota"
        onConfirm={async () => {
          if (!deleting) return;
          const removed = await actions.remove({ id: deleting.id }).catch(() => ({ ok: false as const, message: "Serverul n-a răspuns." }) as Failure);
          if (!removed.ok) {
            notify(`Nota n-a fost ștearsă. ${removed.message}`, "error");
            return;
          }
          notify("Nota a fost ștearsă.");
          router.refresh();
        }}
      />
    </div>
  );
}
