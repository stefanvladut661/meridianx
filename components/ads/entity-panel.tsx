"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { PLATFORM_LABEL } from "@/lib/ads/constants";
import { campaignUrl, managerName } from "@/lib/ads/links";
import { daysBetween, deltaOf, formatAmount, formatCount, formatDelta, formatPercent } from "@/lib/ads/metrics";
import { NO_RESULT, conversionOf, resultsOf } from "@/lib/ads/model/results";
import { RESULT_KIND_LABEL } from "@/lib/ads/model/results";
import { resultText, type RowFigures } from "@/lib/ads/model/rows";
import type { DateRange } from "@/lib/ads/model/selection";
import { canPause } from "@/lib/ads/model/status";
import type { AccountSummary, EntityRow } from "@/lib/ads/model/types";
import type { EntityDay } from "@/lib/ads/model/read";
import { formatLeadDateTime } from "@/app/(admin)/admin/_components/format-date";
import { cn } from "@/lib/utils";
import { ChannelIcon } from "./channel-icon";
import { DayChart } from "./day-chart";
import { IconClose, IconExternal, IconPause } from "./icons";
import { StatusTag } from "./status-tag";
import type { ScreenActions } from "./campaigns-screen";

const LEVEL_LABEL = { campaign: "Campanie", group: "Grup", ad: "Reclamă" } as const;
const CHILD_LABEL = { campaign: "Grupurile campaniei", group: "Reclamele grupului", ad: "" } as const;

/**
 * Panoul din dreapta: un rând deschis fără să pleci din tabel. Cifrele
 * perioadei, graficul pe zile, ce se numără ca rezultat (pe campanie), setările
 * (doar citire), copiii rândului, „Pune pe pauză” și linkul spre platformă.
 *
 * Pe desktop e un panou lângă tabel; pe telefon acoperă ecranul și ține focusul
 * înăuntru (Tab nu iese din el). Escape îl închide și duce focusul înapoi pe rând.
 */
export function EntityPanel({
  entity,
  figures,
  previousFigures,
  account,
  parents,
  descendants,
  childFigures,
  range,
  actions,
  canPauseHere,
  onPause,
  onOpen,
  onClose,
}: {
  entity: EntityRow;
  figures: RowFigures;
  previousFigures: RowFigures;
  account: AccountSummary | null;
  parents: { campaign: EntityRow | null; group: EntityRow | null };
  descendants: EntityRow[];
  childFigures: Map<string, RowFigures>;
  range: DateRange;
  actions: ScreenActions;
  canPauseHere: boolean;
  onPause: () => void;
  onOpen: (entity: EntityRow) => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const panel = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const [days, setDays] = useState<EntityDay[] | null>(null);
  const [daysError, setDaysError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const [resultError, setResultError] = useState<string | null>(null);
  const catalog = account?.conversions ?? [];
  const currency = entity.currency ?? "";
  // Acțiunile vin ca obiect nou la fiecare reîmprospătare a paginii; zilele se
  // cer din nou doar pentru alt rând sau altă perioadă, nu la fiecare randare.
  const daysAction = useRef(actions.days);
  useEffect(() => {
    daysAction.current = actions.days;
  });

  useEffect(() => {
    heading.current?.focus();
  }, [entity.id]);

  // Răspunsul se primește dacă e pentru rândul și perioada încă deschise. Fără
  // anulare la curățarea efectului: Next pune acțiunile la coadă, iar o cerere
  // dublată (React în dezvoltare montează efectele de două ori) poate să nu plece.
  const wanted = useRef("");
  useEffect(() => {
    const key = `${entity.id}|${range.from}|${range.to}`;
    wanted.current = key;
    daysAction
      .current({ entityIds: [entity.id], from: range.from, to: range.to })
      .then((result) => {
        if (wanted.current !== key) return;
        if (result.ok) setDays(result.days);
        else setDaysError(result.message);
      })
      .catch(() => {
        if (wanted.current === key) setDaysError("Zilele nu s-au putut citi. Reîncarcă pagina.");
      });
  }, [entity.id, range.from, range.to]);

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      onClose();
      return;
    }
    // Pe telefon panoul e ecran întreg: Tab rămâne înăuntru.
    if (event.key !== "Tab" || window.innerWidth >= 1024 || !panel.current) return;
    const focusable = [...panel.current.querySelectorAll<HTMLElement>("a[href], button:not([disabled]), select, input, [tabindex='0']")];
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const manager = account ? campaignUrl(entity.platform, account.adAccount, entity.campaignId) : null;
  const chosen = conversionOf(catalog, entity.resultKey);
  const series = (value: (day: EntityDay) => number) => {
    const byDate = new Map((days ?? []).map((day) => [day.date, day]));
    return daysBetween(range.from, range.to).map((date) => ({ date, value: byDate.has(date) ? value(byDate.get(date)!) : 0 }));
  };

  const stat = (label: string, value: string, delta?: { current: number | null; previous: number | null; direction: "up_good" | "up_bad" | "neutral" }) => {
    const change = delta ? deltaOf(delta.current, delta.previous, delta.direction) : null;
    return (
      <div className="rounded-lg border border-hair px-3 py-2.5">
        <dt className="text-[12px] text-dim">{label}</dt>
        {/* „289 de lead-uri” încape întreg, pe două rânduri dacă trebuie — nu tăiat. */}
        <dd className={cn("mt-0.5 font-semibold leading-snug tabular-nums text-bone", value.length > 11 ? "text-[14px]" : "text-[16px]")}>{value}</dd>
        {change && change.percent !== null ? (
          <dd className={cn("text-[11.5px]", change.tone === "good" ? "text-[var(--ap-ok)]" : change.tone === "bad" ? "text-[var(--ap-error)]" : "text-dim")}>
            {formatDelta(change)} <span className="text-dim">față de înainte</span>
          </dd>
        ) : null}
      </div>
    );
  };

  return (
    <div
      ref={panel}
      role="dialog"
      aria-modal="false"
      aria-labelledby="panou-titlu"
      onKeyDown={onKeyDown}
      className="ads-panel-enter fixed inset-0 z-50 flex flex-col overflow-y-auto bg-white shadow-2xl sm:inset-y-0 sm:left-auto sm:right-0 sm:w-[460px] sm:border-l sm:border-hair"
    >
      <div className="sticky top-0 z-10 border-b border-hair bg-white px-5 py-3.5">
        <div className="flex items-start gap-3">
          <ChannelIcon platform={entity.platform} size={20} className="mt-1 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-medium uppercase tracking-[0.12em] text-dim">
              {LEVEL_LABEL[entity.level]} · {PLATFORM_LABEL[entity.platform]}
            </p>
            <h2 id="panou-titlu" ref={heading} tabIndex={-1} className="mt-0.5 text-[17px] font-semibold leading-snug text-bone outline-none">
              {entity.name}
            </h2>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <StatusTag status={entity.status} />
              {entity.statusDetail ? <span className="font-md-mono text-[11px] text-dim">{entity.statusDetail}</span> : null}
            </div>
          </div>
          <button type="button" onClick={onClose} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-dim hover:bg-[var(--ap-hover)] hover:text-bone">
            <IconClose />
            <span className="sr-only">Închide detaliile</span>
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {canPause(entity.status) ? (
            canPauseHere ? (
              <button type="button" onClick={onPause} className="btn btn-ghost !min-h-9 !gap-1.5 !px-3 !py-1.5 !text-[13px]">
                <IconPause size={15} />
                Pune pe pauză
              </button>
            ) : (
              <p className="text-[12.5px] text-dim">Pauza pe {PLATFORM_LABEL[entity.platform]} din portal vine într-o fază următoare.</p>
            )
          ) : null}
          {manager ? (
            <a href={manager} target="_blank" rel="noopener noreferrer" className="btn btn-ghost !min-h-9 !gap-1.5 !px-3 !py-1.5 !text-[13px]">
              Deschide în {entity.platform === "meta" ? "Meta" : managerName(entity.platform)}
              <IconExternal size={14} />
              <span className="sr-only">(se deschide într-o filă nouă)</span>
            </a>
          ) : null}
        </div>
      </div>

      <div className="grid gap-6 px-5 py-5">
        <section aria-label="Cifrele perioadei">
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {stat("Cheltuit", formatAmount(figures.spend, currency), { current: figures.spend, previous: previousFigures.spend || null, direction: "neutral" })}
            {stat("Rezultate", resultText(figures), { current: figures.results, previous: previousFigures.results || null, direction: "up_good" })}
            {stat("Cost / rezultat", figures.costPerResult === null ? "—" : formatAmount(figures.costPerResult, currency))}
            {stat("Clickuri", formatCount(figures.clicks), { current: figures.clicks, previous: previousFigures.clicks || null, direction: "up_good" })}
            {stat("Afișări", formatCount(figures.impressions))}
            {stat("CTR", formatPercent(figures.ctr))}
          </dl>
        </section>

        <section aria-label="Pe zile" className="grid gap-5">
          {daysError ? <p className="text-[13px] text-[var(--ap-error)]">{daysError}</p> : null}
          {days === null && !daysError ? <p className="text-[13px] text-dim">Se citesc zilele…</p> : null}
          {days ? (
            <>
              <DayChart title="Cheltuit pe zi" days={series((day) => day.figures.spend)} unit={{ type: "money", currency }} withTable={false} />
              {figures.results !== null && entity.resultKey ? (
                <DayChart title={`${RESULT_KIND_LABEL[figures.resultKind]} pe zi`} days={series((day) => resultsOf(day.figures, entity.resultKey) ?? 0)} unit={{ type: "count" }} withTable={false} />
              ) : null}
            </>
          ) : null}
        </section>

        {entity.level === "campaign" ? (
          <section aria-labelledby="rezultat-titlu">
            <h3 id="rezultat-titlu" className="text-[14px] font-semibold text-bone">
              Ce se numără ca rezultat
            </h3>
            {catalog.length === 0 ? (
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-dim">
                {account?.measured === false
                  ? `Contul n-are nicio conversie configurată, deci rezultatele sunt „nemăsurat”. ${entity.platform === "google" ? "Le poți crea din Căutări → Conversii." : `Configurează-le în ${PLATFORM_LABEL[entity.platform]}.`}`
                  : "Catalogul conversiilor apare după prima actualizare a contului."}
              </p>
            ) : (
              <>
                <label className="mt-2 block">
                  <span className="sr-only">Conversia numărată ca rezultat</span>
                  <select
                    value={entity.resultChosen ? (entity.resultKey ?? NO_RESULT) : ""}
                    disabled={saving}
                    onChange={(event) => {
                      const value = event.currentTarget.value;
                      setResultError(null);
                      startSaving(async () => {
                        const result = await actions.setResult({ entityId: entity.id, key: value === "" ? null : value });
                        if (!result.ok) setResultError(result.message);
                        else router.refresh();
                      });
                    }}
                    className="h-10 w-full rounded-lg border border-hair-strong bg-white px-2.5 text-[14px] text-bone"
                  >
                    <option value="">Implicit{!entity.resultChosen && chosen ? ` — ${chosen.label}` : !entity.resultChosen ? " — nemăsurat" : ""}</option>
                    {catalog.map((entry) => (
                      <option key={entry.key} value={entry.key}>
                        {entry.label} ({RESULT_KIND_LABEL[entry.kind].toLowerCase()})
                      </option>
                    ))}
                    <option value={NO_RESULT}>Nemăsurat (nu număra nimic)</option>
                  </select>
                </label>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-dim">
                  Grupurile și reclamele campaniei numără același lucru. Implicitul vine din ce optimizează campania.
                </p>
                {resultError ? <p className="mt-1 text-[13px] text-[var(--ap-error)]">{resultError}</p> : null}
              </>
            )}
          </section>
        ) : parents.campaign ? (
          <p className="text-[13px] text-dim">
            Rezultatul se numără ca la campania{" "}
            <button type="button" onClick={() => onOpen(parents.campaign!)} className="font-medium text-[var(--md-a1)] underline underline-offset-4">
              {parents.campaign.name}
            </button>
            .
          </p>
        ) : null}

        <section aria-labelledby="setari-titlu">
          <h3 id="setari-titlu" className="text-[14px] font-semibold text-bone">
            Setări <span className="font-normal text-dim">(doar citire)</span>
          </h3>
          <dl className="mt-2 divide-y divide-hair rounded-lg border border-hair text-[13.5px]">
            {[
              ...(entity.dailyBudget ? [["Buget pe zi", formatAmount(entity.dailyBudget, currency)] as [string, string]] : []),
              ...(entity.lifetimeBudget ? [["Buget total", formatAmount(entity.lifetimeBudget, currency)] as [string, string]] : []),
              ...entity.settings.facts,
              ["Id pe platformă", entity.platformId] as [string, string],
              ...(account ? [["Contul", `${account.name ?? account.adAccount} (${account.adAccount})`] as [string, string]] : []),
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4 px-3 py-2">
                <dt className="text-dim">{label}</dt>
                <dd className="min-w-0 break-words text-right text-bone">{value}</dd>
              </div>
            ))}
          </dl>
          {entity.settings.texts?.length ? (
            <ul className="mt-3 grid gap-1.5 text-[13.5px] text-bone/85">
              {entity.settings.texts.map((text, index) => (
                <li key={`${index}-${text}`} className="rounded-md bg-[var(--ap-neutral-soft)] px-2.5 py-1.5">
                  {text}
                </li>
              ))}
            </ul>
          ) : null}
          {entity.settings.url ? (
            <p className="mt-2 break-all text-[12.5px] text-dim">
              Duce la: <span className="text-bone/85">{entity.settings.url}</span>
            </p>
          ) : null}
          {entity.portalCampaignId ? (
            <p className="mt-2 text-[13px]">
              <Link href={`/admin/ads/${entity.portalCampaignId}`} className="font-medium text-[var(--md-a1)] underline underline-offset-4">
                Planul trimis din portal
              </Link>
            </p>
          ) : null}
        </section>

        {entity.level !== "ad" ? (
          <section aria-labelledby="copii-titlu">
            <h3 id="copii-titlu" className="text-[14px] font-semibold text-bone">
              {CHILD_LABEL[entity.level]} <span className="font-normal text-dim">({descendants.length})</span>
            </h3>
            {descendants.length === 0 ? (
              <p className="mt-1.5 text-[13px] text-dim">{entity.platform === "google" && entity.kind === "PERFORMANCE_MAX" ? "Performance Max n-are grupuri de reclame: cifrele sunt doar pe campanie." : "Niciunul citit din cont."}</p>
            ) : (
              <ul className="mt-2 divide-y divide-hair rounded-lg border border-hair">
                {descendants
                  .slice()
                  .sort((a, b) => (childFigures.get(b.id)?.spend ?? 0) - (childFigures.get(a.id)?.spend ?? 0))
                  .slice(0, 30)
                  .map((child) => (
                    <li key={child.id}>
                      <button type="button" onClick={() => onOpen(child)} className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-[var(--ap-hover)]">
                        <span className="min-w-0 truncate text-[13.5px] font-medium text-bone">{child.name}</span>
                        <span className="flex shrink-0 items-center gap-2">
                          <span className="text-[12.5px] tabular-nums text-dim">{formatAmount(childFigures.get(child.id)?.spend ?? 0, currency)}</span>
                          <StatusTag status={child.status} />
                        </span>
                      </button>
                    </li>
                  ))}
              </ul>
            )}
          </section>
        ) : null}

        <p className="text-[12px] text-dim">Citit din cont {formatLeadDateTime(entity.lastSeenAt)}. Portalul nu schimbă nimic aici în afară de pauză.</p>
      </div>
    </div>
  );
}
