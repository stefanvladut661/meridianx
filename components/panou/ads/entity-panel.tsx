"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { ExternalLink, PauseCircle, X } from "lucide-react";
import { PLATFORM_LABEL } from "@/lib/ads/constants";
import { campaignUrl, managerName } from "@/lib/ads/links";
import { daysBetween, deltaOf, formatAmount, formatCount, formatPercent, type Delta, type Direction } from "@/lib/ads/metrics";
import { NO_RESULT, RESULT_KIND_LABEL, conversionOf, resultsOf } from "@/lib/ads/model/results";
import { resultText, type RowFigures } from "@/lib/ads/model/rows";
import type { DateRange } from "@/lib/ads/model/selection";
import { canPause } from "@/lib/ads/model/status";
import type { AccountSummary, EntityRow } from "@/lib/ads/model/types";
import type { EntityDay } from "@/lib/ads/model/read";
import { cn } from "@/lib/utils";
import { Btn, btnClass, SectionTitle } from "../ui/primitives";
import { dateTimeRo } from "../ui/format";
import { SoftSelect } from "../ui/select";
import { ChannelMark } from "./channel-mark";
import type { ScreenActions } from "./campaigns-screen";
import { DayChart } from "./day-chart";
import { DeltaChip } from "./delta-chip";
import { StatusPill } from "./status-pill";

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

  const stat = (label: string, value: string, change?: { current: number | null; previous: number | null; direction: Direction }) => {
    const delta: Delta | null = change ? deltaOf(change.current, change.previous, change.direction) : null;
    return (
      <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-3 py-2.5">
        <dt className="text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">{label}</dt>
        {/* „289 de lead-uri” încape întreg, pe două rânduri dacă trebuie — nu tăiat. */}
        <dd className={cn("pu-num mt-1 font-medium leading-snug", value.length > 11 ? "text-[14px]" : "text-[17px]")}>{value}</dd>
        {delta && delta.percent !== null ? (
          <dd className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
            <DeltaChip delta={delta} /> față de înainte
          </dd>
        ) : null}
      </div>
    );
  };

  const settings: Array<[string, ReactNode]> = [
    ...(entity.dailyBudget ? [["Buget pe zi", formatAmount(entity.dailyBudget, currency)] as [string, string]] : []),
    ...(entity.lifetimeBudget ? [["Buget total", formatAmount(entity.lifetimeBudget, currency)] as [string, string]] : []),
    ...entity.settings.facts,
    ["Id pe platformă", <span key="id" className="font-mono text-[11.5px]">{entity.platformId}</span>],
    ...(account ? [["Contul", `${account.name ?? account.adAccount} (${account.adAccount})`] as [string, string]] : []),
  ];

  return (
    <div
      ref={panel}
      role="dialog"
      aria-modal="false"
      aria-labelledby="panou-titlu"
      onKeyDown={onKeyDown}
      className="animate-rise fixed inset-0 z-50 flex flex-col overflow-y-auto bg-[#121216] shadow-[0_30px_80px_-30px_rgba(0,0,0,0.95)] sm:inset-y-0 sm:left-auto sm:right-0 sm:w-[460px] sm:border-l sm:border-white/[0.09]"
    >
      <div className="sticky top-0 z-10 border-b border-white/[0.07] bg-[#121216] px-5 py-4">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2 text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
              <ChannelMark platform={entity.platform} size="sm" label={false} />
              {LEVEL_LABEL[entity.level]} · {PLATFORM_LABEL[entity.platform]}
            </p>
            <h2 id="panou-titlu" ref={heading} tabIndex={-1} className="mt-2 text-[17px] font-semibold leading-snug outline-none">
              {entity.name}
            </h2>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <StatusPill status={entity.status} />
              {entity.statusDetail ? <span className="font-mono text-[10.5px] text-muted-foreground">{entity.statusDetail}</span> : null}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-transparent text-muted-foreground transition-colors hover:bg-white/[0.07] hover:text-foreground"
          >
            <X className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only">Închide detaliile</span>
          </button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {canPause(entity.status) ? (
            canPauseHere ? (
              <Btn size="sm" variant="outline" icon={PauseCircle} onClick={onPause}>
                Pune pe pauză
              </Btn>
            ) : (
              <p className="text-[11.5px] text-muted-foreground">Pauza pe {PLATFORM_LABEL[entity.platform]} din portal vine într-o fază următoare.</p>
            )
          ) : null}
          {manager ? (
            <a href={manager} target="_blank" rel="noopener noreferrer" className={btnClass({ variant: "primary", size: "sm", className: "gap-1.5" })}>
              Deschide în {entity.platform === "meta" ? "Meta" : managerName(entity.platform)}
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
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
          {daysError ? <p className="text-[12.5px] text-rose">{daysError}</p> : null}
          {days === null && !daysError ? <p className="text-[12.5px] text-muted-foreground">Se citesc zilele…</p> : null}
          {days ? (
            <>
              <DayChart title="Cheltuit pe zi" name="Cheltuit" days={series((day) => day.figures.spend)} unit={{ type: "money", currency }} withTable={false} />
              {figures.results !== null && entity.resultKey ? (
                <DayChart
                  title={`${RESULT_KIND_LABEL[figures.resultKind]} pe zi`}
                  name={RESULT_KIND_LABEL[figures.resultKind]}
                  color="#FFB27A"
                  days={series((day) => resultsOf(day.figures, entity.resultKey) ?? 0)}
                  unit={{ type: "count" }}
                  withTable={false}
                />
              ) : null}
            </>
          ) : null}
        </section>

        {entity.level === "campaign" ? (
          <section aria-labelledby="rezultat-titlu">
            <SectionTitle title={<span id="rezultat-titlu">Ce se numără ca rezultat</span>} />
            {catalog.length === 0 ? (
              <p className="mt-2 text-[12.5px] leading-relaxed text-muted-foreground">
                {account?.measured === false
                  ? `Contul n-are nicio conversie configurată, deci rezultatele sunt „nemăsurat”. ${entity.platform === "google" ? "Le poți crea din Căutări → Conversii." : `Configurează-le în ${PLATFORM_LABEL[entity.platform]}.`}`
                  : "Catalogul conversiilor apare după prima actualizare a contului."}
              </p>
            ) : (
              <>
                <SoftSelect
                  className="mt-3"
                  ariaLabel="Conversia numărată ca rezultat"
                  value={entity.resultChosen ? (entity.resultKey ?? NO_RESULT) : ""}
                  disabled={saving}
                  onChange={(value) => {
                    setResultError(null);
                    startSaving(async () => {
                      const result = await actions.setResult({ entityId: entity.id, key: value === "" ? null : value });
                      if (!result.ok) setResultError(result.message);
                      else router.refresh();
                    });
                  }}
                  options={[
                    { value: "", label: `Implicit${!entity.resultChosen && chosen ? ` — ${chosen.label}` : !entity.resultChosen ? " — nemăsurat" : ""}` },
                    ...catalog.map((entry) => ({ value: entry.key, label: `${entry.label} (${RESULT_KIND_LABEL[entry.kind].toLowerCase()})` })),
                    { value: NO_RESULT, label: "Nemăsurat (nu număra nimic)" },
                  ]}
                />
                <p className="mt-2 text-[11.5px] leading-relaxed text-muted-foreground">Grupurile și reclamele campaniei numără același lucru. Implicitul vine din ce optimizează campania.</p>
                {resultError ? <p role="alert" className="mt-1 text-[12px] text-rose">{resultError}</p> : null}
              </>
            )}
          </section>
        ) : parents.campaign ? (
          <p className="text-[12.5px] text-muted-foreground">
            Rezultatul se numără ca la campania{" "}
            <button type="button" onClick={() => onOpen(parents.campaign!)} className="font-medium text-lav underline underline-offset-4">
              {parents.campaign.name}
            </button>
            .
          </p>
        ) : null}

        <section aria-labelledby="setari-titlu">
          <SectionTitle title={<span id="setari-titlu">Setări <span className="font-normal text-muted-foreground">(doar citire)</span></span>} />
          <dl className="mt-3 divide-y divide-white/[0.05] rounded-xl border border-white/[0.07] text-[12.5px]">
            {settings.map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4 px-3 py-2">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="min-w-0 break-words text-right">{value}</dd>
              </div>
            ))}
          </dl>
          {entity.settings.texts?.length ? (
            <ul className="mt-3 grid gap-1.5 text-[12.5px] text-foreground/85">
              {entity.settings.texts.map((text, index) => (
                <li key={`${index}-${text}`} className="rounded-lg bg-white/[0.04] px-2.5 py-1.5">
                  {text}
                </li>
              ))}
            </ul>
          ) : null}
          {entity.settings.url ? (
            <p className="mt-2 break-all text-[12px] text-muted-foreground">
              Duce la: <span className="text-foreground/85">{entity.settings.url}</span>
            </p>
          ) : null}
          {entity.portalCampaignId ? (
            <p className="mt-3">
              <Link href={`/admin/ads/${entity.portalCampaignId}`} className={btnClass({ variant: "outline", size: "sm" })}>
                Planul trimis din portal
              </Link>
            </p>
          ) : null}
        </section>

        {entity.level !== "ad" ? (
          <section aria-labelledby="copii-titlu">
            <SectionTitle title={<span id="copii-titlu">{CHILD_LABEL[entity.level]} <span className="font-normal text-muted-foreground">({descendants.length})</span></span>} />
            {descendants.length === 0 ? (
              <p className="mt-2 text-[12.5px] text-muted-foreground">
                {entity.platform === "google" && entity.kind === "PERFORMANCE_MAX" ? "Performance Max n-are grupuri de reclame: cifrele sunt doar pe campanie." : "Niciunul citit din cont."}
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-white/[0.05] rounded-xl border border-white/[0.07]">
                {descendants
                  .slice()
                  .sort((a, b) => (childFigures.get(b.id)?.spend ?? 0) - (childFigures.get(a.id)?.spend ?? 0))
                  .slice(0, 30)
                  .map((child) => (
                    <li key={child.id}>
                      <button type="button" onClick={() => onOpen(child)} className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition-colors hover:bg-white/[0.04]">
                        <span className="min-w-0 truncate text-[12.5px] font-medium">{child.name}</span>
                        <span className="flex shrink-0 items-center gap-2">
                          <span className="pu-num text-[11.5px] text-muted-foreground">{formatAmount(childFigures.get(child.id)?.spend ?? 0, currency)}</span>
                          <StatusPill status={child.status} />
                        </span>
                      </button>
                    </li>
                  ))}
              </ul>
            )}
          </section>
        ) : null}

        <p className="text-[11.5px] text-muted-foreground">Citit din cont {dateTimeRo(entity.lastSeenAt)}. Portalul nu schimbă nimic aici în afară de pauză.</p>
      </div>
    </div>
  );
}
