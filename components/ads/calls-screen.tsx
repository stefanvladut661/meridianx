"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useMemo, useRef, useState, useTransition } from "react";
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
import { cn } from "@/lib/utils";
import { ChannelIcon } from "./channel-icon";
import { ERROR_TEXT, FIELD, FIELD_INVALID, OK_TEXT } from "./tone";

type Failure = { ok: false; message: string; field?: string };

export interface CallsActions {
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

/** Culoarea spune cât valorează apelul; textul o spune oricum. */
const RESULT_TONE: Record<CallResult, string> = {
  intrebare: "bg-[var(--ap-neutral-soft)] text-bone/80",
  programat: "bg-[var(--ap-accent-soft)] text-[var(--ap-accent-ink)]",
  semnat: "bg-[var(--ap-ok-soft)] text-[var(--ap-ok)]",
};
const RESULT_BAR: Record<CallResult, string> = {
  intrebare: "bg-[#c9ced8]",
  programat: "bg-[var(--md-a1)]",
  semnat: "bg-[var(--ap-ok)]",
};
const RESULT_HINT: Record<CallResult, string> = {
  intrebare: "a întrebat de preț sau de program",
  programat: "o întâlnire, o filmare, o vizionare",
  semnat: "contract sau comandă",
};

type Field = "clientId" | "channel" | "entityId" | "calledOn" | "result" | "note";

/** Ordinea din bara de sus. */
const CHANNEL_ORDER: Platform[] = ["meta", "google", "tiktok"];

function CallForm({
  clients,
  campaigns,
  defaults,
  add,
}: {
  clients: Array<{ id: string; name: string }>;
  campaigns: CallCampaign[];
  defaults: { clientId: string; channel: Platform | null; today: string };
  add: CallsActions["add"];
}) {
  const router = useRouter();
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

  const choices = useMemo(
    () => campaigns.filter((campaign) => campaign.clientId === clientId && (channel === "" || channel === UNKNOWN_CHANNEL || campaign.platform === channel)),
    [campaigns, clientId, channel]
  );
  const clientName = clients.find((client) => client.id === clientId)?.name ?? "";

  const focusField = (field: Field) => {
    const target = form.current?.querySelector<HTMLElement>(`[data-field="${field}"]`);
    target?.focus();
  };

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
      const saved = await add(input);
      if (!saved.ok) {
        if (saved.field) {
          setErrors({ [saved.field as Field]: saved.message });
          focusField(saved.field as Field);
        }
        setStatus({ tone: "error", text: `Apelul nu e notat. ${saved.message}` });
        return;
      }
      setStatus({ tone: "ok", text: `Apel notat${clientId !== defaults.clientId ? ` la ${clientName}` : ""}. Poți nota următorul.` });
      setResult("");
      setNote("");
      setErrors({});
      router.refresh();
    });
  };

  const fieldError = (field: Field) =>
    errors[field] ? (
      <p id={`${id}-${field}-eroare`} className={cn("mt-1 text-[13px]", ERROR_TEXT)}>
        {errors[field]}
      </p>
    ) : null;
  const described = (field: Field, hint?: string) => [errors[field] ? `${id}-${field}-eroare` : null, hint].filter(Boolean).join(" ") || undefined;

  const chip = (selected: boolean, invalid: boolean) =>
    cn(
      "flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border px-3 text-[14px] font-medium transition-colors duration-150 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--md-a1)]",
      selected ? "border-[var(--md-a1)] bg-[var(--ap-accent-soft)] text-[var(--ap-accent-ink)]" : "border-hair-strong bg-char text-bone/85 hover:bg-[var(--ap-hover)]",
      invalid && !selected && "border-[#d93025]/60"
    );

  return (
    <form ref={form} onSubmit={submit} noValidate aria-labelledby={`${id}-titlu`} className="rounded-xl border border-hair bg-char p-4 sm:p-5">
      <h2 id={`${id}-titlu`} className="text-[16px] font-semibold text-bone">
        Notează un apel
      </h2>
      <p className="mt-0.5 text-[13px] text-dim">Cineva a sunat de pe o reclamă. Zece secunde, și din telefon.</p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-[13px] font-medium text-bone">Ziua</span>
          <input
            data-field="calledOn"
            type="date"
            value={calledOn}
            max={defaults.today}
            onChange={(event) => setCalledOn(event.currentTarget.value)}
            aria-invalid={Boolean(errors.calledOn)}
            aria-describedby={described("calledOn")}
            className={cn(FIELD, "mt-1 h-10", errors.calledOn && FIELD_INVALID)}
          />
          {fieldError("calledOn")}
        </label>
        <label className="block">
          <span className="text-[13px] font-medium text-bone">Clientul</span>
          <select
            data-field="clientId"
            value={clientId}
            onChange={(event) => {
              setClientId(event.currentTarget.value);
              setEntityId("");
            }}
            aria-invalid={Boolean(errors.clientId)}
            aria-describedby={described("clientId")}
            className={cn(FIELD, "mt-1 h-10", errors.clientId && FIELD_INVALID)}
          >
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
          {fieldError("clientId")}
        </label>
      </div>

      <fieldset className="mt-4" aria-describedby={described("channel")}>
        <legend className="text-[13px] font-medium text-bone">De unde a aflat</legend>
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
              {option === UNKNOWN_CHANNEL ? null : <ChannelIcon platform={option as Platform} />}
              {option === UNKNOWN_CHANNEL ? "Nu știu" : PLATFORM_LABEL[option as Platform]}
            </label>
          ))}
        </div>
        {fieldError("channel")}
      </fieldset>

      <label className="mt-4 block">
        <span className="text-[13px] font-medium text-bone">
          Campania <span className="font-normal text-dim">(dacă știi)</span>
        </span>
        <select
          data-field="entityId"
          value={entityId}
          onChange={(event) => setEntityId(event.currentTarget.value)}
          aria-invalid={Boolean(errors.entityId)}
          aria-describedby={described("entityId")}
          className={cn(FIELD, "mt-1 h-10", errors.entityId && FIELD_INVALID)}
        >
          <option value="">Nu știu / fără campanie</option>
          {choices.map((campaign) => (
            <option key={campaign.id} value={campaign.id}>
              {channel === "" || channel === UNKNOWN_CHANNEL ? `${PLATFORM_LABEL[campaign.platform]} · ` : ""}
              {campaign.name}
              {campaign.removed ? " (ștearsă)" : ""}
            </option>
          ))}
        </select>
        {choices.length === 0 ? <p className="mt-1 text-[12.5px] text-dim">Clientul n-are campanii citite pe canalul ăsta. Apelul se notează și fără.</p> : null}
        {fieldError("entityId")}
      </label>

      <fieldset className="mt-4" aria-describedby={described("result")}>
        <legend className="text-[13px] font-medium text-bone">Ce a ieșit</legend>
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
              <span className="text-[12px] font-normal text-dim">{RESULT_HINT[option]}</span>
            </label>
          ))}
        </div>
        {fieldError("result")}
      </fieldset>

      <label className="mt-4 block">
        <span className="text-[13px] font-medium text-bone">
          Notă <span className="font-normal text-dim">(opțional)</span>
        </span>
        <textarea
          data-field="note"
          value={note}
          onChange={(event) => setNote(event.currentTarget.value)}
          maxLength={NOTE_MAX}
          rows={2}
          placeholder="Ce a cerut, când revine, cine a vorbit cu el"
          aria-invalid={Boolean(errors.note)}
          aria-describedby={described("note", `${id}-nota-rest`)}
          className={cn(FIELD, "mt-1 resize-y py-2 leading-relaxed", errors.note && FIELD_INVALID)}
        />
        <span id={`${id}-nota-rest`} className="mt-0.5 block text-right text-[12px] text-dim">
          {note.length > NOTE_MAX - 200 ? `${NOTE_MAX - note.length} caractere rămase` : ""}
        </span>
        {fieldError("note")}
      </label>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className="btn btn-light !min-h-11 !px-5 !text-[15px]">
          {pending ? "Se notează…" : "Notează apelul"}
        </button>
        <p role="status" aria-live="polite" className={cn("text-[14px]", status?.tone === "error" ? ERROR_TEXT : OK_TEXT)}>
          {status?.text ?? ""}
        </p>
      </div>
    </form>
  );
}

function CallItem({ call, remove }: { call: CallRow; remove: CallsActions["remove"] }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const campaignHref = call.entityId && call.platform ? `/admin/ads?client=${call.clientId}&canal=${call.platform}&rand=${call.entityId}` : null;
  return (
    <li className="grid gap-x-4 gap-y-1.5 px-4 py-3 sm:grid-cols-[8.5rem_minmax(0,1fr)_auto] sm:items-start">
      <span className={cn("inline-flex w-fit items-center rounded-md px-2 py-0.5 text-[12.5px] font-semibold", RESULT_TONE[call.result])}>{CALL_RESULT_LABEL[call.result]}</span>
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-x-2 text-[14px] text-bone">
          {call.platform ? <ChannelIcon platform={call.platform} labelled /> : <span className="text-[13px] text-dim">canal necunoscut</span>}
          {campaignHref ? (
            <Link href={campaignHref} className="font-medium hover:text-[var(--md-a1)] hover:underline">
              {call.campaignName ?? "campania"}
            </Link>
          ) : (
            <span className="text-dim">fără campanie</span>
          )}
        </p>
        {call.note ? <p className="mt-0.5 whitespace-pre-line text-[13.5px] leading-relaxed text-bone/85">{call.note}</p> : null}
        <p className="mt-0.5 text-[12px] text-dim">notat de {call.createdByEmail ?? "—"}</p>
        {error ? (
          <p role="alert" className={cn("mt-1 text-[13px]", ERROR_TEXT)}>
            {error}
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2 sm:justify-end">
        {confirming ? (
          <>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const removed = await remove({ id: call.id });
                  if (!removed.ok) {
                    setError(`Nota n-a fost ștearsă. ${removed.message}`);
                    return;
                  }
                  router.refresh();
                })
              }
              className="btn btn-ghost !min-h-9 !border-[var(--ap-error)]/40 !px-3 !py-1.5 !text-[13px] !text-[var(--ap-error)]"
            >
              {pending ? "Se șterge…" : "Da, șterge nota"}
            </button>
            <button type="button" onClick={() => setConfirming(false)} className="btn btn-ghost !min-h-9 !px-3 !py-1.5 !text-[13px]">
              Renunță
            </button>
          </>
        ) : (
          <button type="button" onClick={() => setConfirming(true)} className="btn btn-ghost !min-h-9 !px-3 !py-1.5 !text-[13px] text-dim">
            Șterge nota
          </button>
        )}
      </div>
    </li>
  );
}

export function CallsScreen({
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
  actions: CallsActions;
}) {
  const count = countCalls(calls);
  const byDay = new Map<string, CallRow[]>();
  for (const call of calls) byDay.set(call.calledOn, [...(byDay.get(call.calledOn) ?? []), call]);
  const unlinked = calls.filter((call) => !call.entityId).length;

  return (
    <div className="mt-5 grid gap-6 xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] xl:items-start">
      <div className="xl:sticky xl:top-20">
        {missing ? (
          <div role="alert" className="rounded-xl border border-[var(--ap-error)]/30 bg-[var(--ap-error-soft)] px-5 py-4 text-[14px] text-bone/85">
            <p className="font-semibold text-[var(--ap-error)]">Apelurile nu se pot nota încă.</p>
            <p className="mt-1">{missing}</p>
          </div>
        ) : (
          <CallForm clients={clients} campaigns={campaigns} defaults={defaults} add={actions.add} />
        )}
      </div>

      <section aria-labelledby="apeluri-lista">
        <h2 id="apeluri-lista" className="text-[16px] font-semibold text-bone">
          {count.total === 0 ? "Niciun apel notat" : resultUnit(count.total, "call").replace(/^./, (letter) => letter.toUpperCase())}
          <span className="font-normal text-dim">
            {" "}
            · {scope.client} · {scope.period.toLowerCase()}
            {scope.channel ? ` · ${scope.channel}` : ""}
          </span>
        </h2>

        {count.total > 0 ? (
          <div className="mt-2">
            <p className="text-[14px] text-bone/85">{callBreakdown(count)}</p>
            {/* Cât din apeluri ajung mai departe: întrebare → programare → contract. */}
            <div aria-hidden className="mt-2 flex h-2 overflow-hidden rounded-full bg-[var(--ap-neutral-soft)]">
              {[...CALL_RESULTS].reverse().map((result) =>
                count.byResult[result] > 0 ? <span key={result} className={RESULT_BAR[result]} style={{ width: `${(count.byResult[result] / count.total) * 100}%` }} /> : null
              )}
            </div>
            {unlinked > 0 ? (
              <p className="mt-2 text-[12.5px] text-dim">
                {unlinked === count.total ? "Niciunul nu e legat de o campanie" : `${unlinked} din ${count.total} nu sunt legate de o campanie`} — în Campanii, coloana „Apeluri notate” le
                numără doar pe cele legate.
              </p>
            ) : null}
          </div>
        ) : !missing ? (
          <p className="mt-2 max-w-xl text-[14.5px] leading-relaxed text-dim">
            Când sună cineva de pe o reclamă, notează-l în stânga: ziua, de unde a aflat și ce a ieșit. Platformele numără clicul pe „Sună”; doar tu știi ce s-a vorbit.
          </p>
        ) : null}

        <div className="mt-5 grid gap-5">
          {[...byDay.entries()].map(([day, list]) => (
            <section key={day} aria-label={formatDay(day, true)}>
              <h3 className="text-[13px] font-semibold text-dim first-letter:uppercase">
                {formatDay(day, true)} · {resultUnit(list.length, "call")}
              </h3>
              <ul className="mt-2 divide-y divide-hair rounded-xl border border-hair bg-char">
                {list.map((call) => (
                  <CallItem key={call.id} call={call} remove={actions.remove} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      </section>
    </div>
  );
}
