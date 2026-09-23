"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ChevronRight, Globe, Glasses, Info, MapPin, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { num } from "../../kit";
import {
  AVG_RECEIPT,
  AVG_UNIT,
  LOCS,
  MARGIN,
  PAST,
  PERIODS,
  PREV,
  SHARE,
  STOCK,
  TOP_PRODUCTS,
  TODAY_BASE,
  GROWTH,
  HOURS,
  dayFraction,
  hourly,
  periodRange,
  periodSeries,
  productBySku,
  locById,
  type Period,
  type Sale,
} from "../data";
import { totals, useZof } from "../store";
import {
  C,
  CARD,
  Legend,
  LiveDot,
  Meter,
  PageHeader,
  Segmented,
  StatStrip,
  Trend,
  TrendChart,
  ago,
  clock,
  ron,
  ronCompact,
  useTween,
} from "../ui";
import { AlertRow, activeAlerts, useAlertTarget } from "./alerts";

/* ---------- cifrele unei perioade ---------- */

export function usePeriodFigures(period: Period) {
  const { live } = useZof();
  const t = totals(live);
  const past = PAST[period];
  const rev = past + t.rev;
  const receipts = Math.round(past / (AVG_RECEIPT * 1.01)) + t.receipts;
  const units = Math.round(past / AVG_UNIT) + t.units;
  const zof = live.locs["zof-ro"];
  const online = past * SHARE["zof-ro"] + zof.rev;
  const onlineOrders = Math.round((past * SHARE["zof-ro"]) / 1228) + zof.receipts;
  const payTot = t.pay.card + t.pay.numerar + t.pay.online || 1;
  const pay = {
    card: (rev * t.pay.card) / payTot,
    numerar: (rev * t.pay.numerar) / payTot,
    online: (rev * t.pay.online) / payTot,
  };
  // bonurile care intră live au și ele un corespondent în perioada anterioară,
  // altfel trendul ar urca artificial cu fiecare vânzare din demo
  const prev = PREV[period] + (t.rev - TODAY_BASE) / GROWTH[period];
  return {
    t,
    rev,
    prev,
    trend: (rev / prev - 1) * 100,
    receipts,
    units,
    avg: rev / Math.max(1, receipts),
    online,
    onlineOrders,
    profit: rev * MARGIN,
    pay,
  };
}

/** Eticheta tooltip-ului: la „Azi” graficul e cumulat. */
function tip(period: Period, labels: string[], i: number, values: (number | null)[], now: number) {
  if (period !== "azi") return labels[i];
  let last = 0;
  values.forEach((v, j) => {
    if (v !== null) last = j;
  });
  return i === last ? `acum · ${clock(now, false)}` : `până la ${labels[i]}`;
}

export const hourOf = (t: number) => {
  const d = new Date(t);
  return d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
};

const VS: Record<Period, string> = {
  azi: "vs săpt. trecută",
  "7z": "vs 7 zile anterioare",
  "30z": "vs 30 zile anterioare",
  "12l": "vs anul anterior",
};
const VS_SUB: Record<Period, string> = {
  azi: "aceeași zi și oră",
  "7z": "zilele 8–14 în urmă",
  "30z": "zilele 31–60 în urmă",
  "12l": "cele 12 luni dinainte",
};

/* ---------- panoul cu o cifră mare (ca în aplicație) ---------- */

type Row = { label: string; value: ReactNode; sub?: string; hint?: string; tone?: string; note?: string };

function Panel({
  title,
  onMore,
  hero,
  heroColor,
  caption,
  rows,
  children,
}: {
  title: string;
  onMore: () => void;
  hero: ReactNode;
  heroColor?: string;
  caption: ReactNode;
  rows: Row[];
  children?: ReactNode;
}) {
  return (
    <section aria-label={title} className={`${CARD} flex flex-col p-5`}>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-[14px] font-semibold">{title}</h3>
        <button type="button" onClick={onMore} className="flex items-center gap-0.5 rounded text-[12px] font-medium text-[#60A5FA] hover:underline">
          Detalii <ChevronRight size={12} aria-hidden />
        </button>
      </div>
      <p className="truncate text-[30px] font-bold leading-none tracking-[-0.02em] tabular-nums" style={{ color: heroColor }}>
        {hero}
      </p>
      <p className="mt-1.5 text-[12px] text-[#808999]">{caption}</p>
      {children}
      <dl className="mt-4 divide-y divide-[#1C2336] border-t border-[#1C2336]">
        {rows.map((r) => (
          <div key={r.label} className="flex items-start justify-between gap-3 py-2 text-[13px]" title={r.hint}>
            <dt className="text-[#808999]">
              <span className="inline-flex items-center gap-1">
                {r.label}
                {r.hint && <Info size={11} className="opacity-60" aria-label="explicație" />}
              </span>
              {r.sub && <span className="block text-[10.5px] leading-tight text-[#808999]/80">{r.sub}</span>}
            </dt>
            <dd className="flex items-center gap-1.5 text-right font-semibold tabular-nums" style={{ color: r.tone }}>
              {r.value}
              {r.note && <span className="font-normal text-[#808999]">· {r.note}</span>}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function PayBar({ pay, h = 8 }: { pay: { card: number; numerar: number; online: number }; h?: number }) {
  const tot = pay.card + pay.numerar + pay.online || 1;
  const parts = [
    { v: pay.card, c: C.card },
    { v: pay.numerar, c: C.cash },
    { v: pay.online, c: C.online },
  ].filter((p) => p.v > 0);
  return (
    <div className="flex w-full gap-[2px] overflow-hidden rounded-full" style={{ height: h }} aria-hidden>
      {parts.map((p, i) => (
        <span key={i} className="block h-full transition-[width] duration-700" style={{ width: `${(p.v / tot) * 100}%`, background: p.c }} />
      ))}
    </div>
  );
}

/* ---------- ecranul ---------- */

export default function Dashboard() {
  const z = useZof();
  const { mobile, period, setPeriod, now, reduced, go } = z;
  const f = usePeriodFigures(period);
  const heroRev = useTween(f.rev, !reduced);
  const heroProfit = useTween(f.profit, !reduced);
  const range = periodRange(period);
  const time = clock(now, false);
  const caption =
    period === "azi" ? `azi până la ${time} · ${num(f.units)} produse` : `${range} · ${num(f.units)} produse`;

  const payTot = f.pay.card + f.pay.numerar + f.pay.online;
  const pctOf = (v: number) => `${Math.round((v / payTot) * 100)}%`;

  const liveLine = (
    <span className="flex items-center gap-1.5 text-[12px] text-[#808999]">
      <LiveDot still={reduced} />
      Live · {f.t.online}/9 locații conectate · ultima sincronizare {ago(now - f.t.lastSync)}
    </span>
  );

  const periodSwitch = (
    <Segmented label="Perioada" options={PERIODS} value={period} onChange={setPeriod} full={mobile} />
  );

  if (mobile) return <MobileDashboard f={f} heroRev={heroRev} caption={caption} liveLine={liveLine} periodSwitch={periodSwitch} />;

  return (
    <div className="zof-in">
      <PageHeader
        title="Dashboard"
        subtitle="Zof Optogerman — Prezentare generală"
        meta={liveLine}
        actions={periodSwitch}
      />

      <div className="grid grid-cols-3 items-start gap-4">
        <Panel
          title="Vânzări"
          onMore={() => go("vanzari")}
          hero={ron(heroRev)}
          caption={caption}
          rows={[
            { label: "Bonuri", sub: range, value: num(f.receipts) },
            { label: "Bon mediu", sub: range, value: ron(f.avg) },
            {
              label: VS[period],
              sub: `${VS_SUB[period]} · ${ronCompact(f.prev)}`,
              value: <Trend value={f.trend} />,
              hint: "Comparație cu perioada anterioară de aceeași lungime. La „Azi”: aceeași zi de săptămâna trecută, până la aceeași oră.",
            },
            { label: "Online (zof.ro)", sub: range, value: ron(f.online), note: `${num(f.onlineOrders)} comenzi` },
          ]}
        />
        <Panel
          title="Financiar"
          onMore={() => go("rapoarte")}
          hero={ron(heroProfit)}
          heroColor={C.greenText}
          caption={`profit estimat · marjă ${(MARGIN * 100).toLocaleString("ro-RO", { maximumFractionDigits: 1 })}% · ${period === "azi" ? "azi" : range}`}
          rows={[
            { label: "Card", value: ron(f.pay.card), note: pctOf(f.pay.card) },
            { label: "Numerar", value: ron(f.pay.numerar), note: pctOf(f.pay.numerar) },
            { label: "Online (plătit la comandă)", value: ron(f.pay.online), note: pctOf(f.pay.online) },
            {
              label: "Marjă estimată",
              value: `${(MARGIN * 100).toLocaleString("ro-RO", { maximumFractionDigits: 1 })}%`,
              hint: "Profit estimat = Σ cantitate × (preț de vânzare − preț de achiziție). Estimare brută: nu scade TVA, chirii, salarii.",
            },
          ]}
        >
          <div className="mt-3">
            <PayBar pay={f.pay} />
            <div className="mt-2">
              <Legend
                items={[
                  { label: "Card", color: C.card },
                  { label: "Numerar", color: C.cash },
                  { label: "Online", color: C.online },
                ]}
              />
            </div>
          </div>
        </Panel>
        <Panel
          title="Rețea și stoc"
          onMore={() => go("locatii")}
          hero={
            <span>
              {f.t.online}
              <span className="text-[#808999]">/9</span> <span className="text-[18px] font-semibold text-[#A3ACBB]">online</span>
            </span>
          }
          caption={`8 magazine + zof.ro · sync ${ago(now - f.t.lastSync)}`}
          rows={[
            { label: "Înregistrări sincronizate azi", value: num(f.t.records) },
            { label: "Valoare stoc", sub: `${num(STOCK.units)} buc în 8 magazine`, value: ronCompact(STOCK.value) },
            { label: "Stoc critic", value: `${STOCK.critical} produse`, tone: C.amberText },
            { label: "Epuizate", value: `${STOCK.outOfStock} produse`, tone: C.redText },
          ]}
        />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-4">
        <div className="col-span-2">
          <SalesChart period={period} />
        </div>
        <LocationsCard period={period} />
      </div>

      <div className="mt-4 grid grid-cols-3 items-start gap-4">
        <LiveSales />
        <TopProducts />
        <AlertsCard />
      </div>
    </div>
  );
}

/* ---------- grafic ---------- */

export function SalesChart({ period, height = 286, compact }: { period: Period; height?: number; compact?: boolean }) {
  const { live, now, reduced } = useZof();
  const [mode, setMode] = useState<"ron" | "buc">("ron");
  const t = totals(live);
  const hour = hourOf(now);
  const minuteKey = Math.floor(hour * 60);
  const s = useMemo(() => periodSeries(period, t.rev, minuteKey / 60), [period, t.rev, minuteKey]);
  const conv = (v: number) => (mode === "ron" ? v : v / AVG_UNIT);
  const values = s.values.map((v) => (v === null ? null : conv(v)));
  const compare = s.compare.map(conv);
  const fmt = mode === "ron" ? ron : (v: number) => `${num(v)} buc`;
  const cur = PERIODS.find((p) => p.id === period)!;
  const body = (
    <>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[14px] font-semibold">Evoluție vânzări</h3>
          {!compact && (
            <p className="mt-0.5 text-[11.5px] text-[#808999]">
              {period === "azi" ? "cumulat de la 09:00" : periodRange(period)} · toate locațiile
            </p>
          )}
        </div>
        <Segmented
          small
          label="Unitate"
          options={[
            { id: "ron", label: "RON" },
            { id: "buc", label: "Unități" },
          ]}
          value={mode}
          onChange={setMode}
        />
      </div>
      <TrendChart
        name={`Evoluție vânzări, ${cur.long}`}
        values={values}
        compare={compare}
        labels={s.labels}
        height={height}
        fmt={fmt}
        fmtAxis={mode === "ron" ? undefined : (v) => num(v)}
        compareName={s.compareLabel}
        live
        still={reduced}
        lastX={s.lastX}
        partialLast={s.partial}
        tipLabel={(i) => tip(period, s.labels, i, s.values, now)}
        maxLabels={compact ? 4 : period === "30z" ? 8 : 7}
      />
      <div className="mt-2.5">
        <Legend
          items={[
            { label: period === "azi" ? "azi" : cur.long, color: C.blue },
            { label: s.compareLabel, color: C.compare, dashed: true },
          ]}
        />
      </div>
      {!compact && <StatStrip items={chartSummary(period, s, t.rev, t.receipts, minuteKey / 60)} />}
    </>
  );
  return <section aria-label="Evoluție vânzări" className={`${CARD} h-full p-5 ${compact ? "p-4" : ""}`}>{body}</section>;
}

/** Trei cifre sub grafic: vârful, ritmul, estimarea / totalul. */
function chartSummary(
  period: Period,
  s: ReturnType<typeof periodSeries>,
  todayRev: number,
  receipts: number,
  hour: number
) {
  if (period === "azi") {
    const h = hourly(todayRev, hour);
    const done = Math.max(1, Math.floor(hour) - HOURS[0]);
    let best = 0;
    for (let i = 1; i < done; i++) if ((h[i] ?? 0) > (h[best] ?? 0)) best = i;
    const elapsed = Math.max(1, hour - HOURS[0]);
    return [
      { k: "Ora de vârf", v: `${HOURS[best]}:00–${HOURS[best] + 1}:00`, sub: ron(h[best] ?? 0) },
      { k: "Ritm", v: `${num(receipts / elapsed)} bonuri / oră`, sub: `${ron(todayRev / elapsed)} / oră` },
      { k: "Estimare la închidere", v: `≈ ${ronCompact(todayRev / dayFraction(hour))}`, sub: "la ritmul de azi, până la 22:00", color: C.blueText },
    ];
  }
  const done = s.values.slice(0, -1).map((v) => v ?? 0);
  const best = done.indexOf(Math.max(...done));
  const total = s.values.reduce<number>((a, v) => a + (v ?? 0), 0);
  const unit = period === "12l" ? "lună" : "zi";
  return [
    { k: `Cea mai bună ${unit}`, v: ronCompact(done[best]), sub: s.labels[best] },
    { k: `Medie pe ${unit}`, v: ronCompact(done.reduce((a, b) => a + b, 0) / done.length), sub: `${unit === "lună" ? "lunile" : "zilele"} încheiate` },
    { k: "Total perioadă", v: ronCompact(total), sub: periodRange(period), color: C.blueText },
  ];
}

/* ---------- locații ---------- */

export function LocationsCard({ period, limit }: { period: Period; limit?: number }) {
  const { live, openLoc, now, mobile } = useZof();
  const rows = LOCS.map((l) => ({ l, v: PAST[period] * SHARE[l.id] + live.locs[l.id].rev, x: live.locs[l.id] })).sort(
    (a, b) => b.v - a.v
  );
  const total = rows.reduce((s, r) => s + r.v, 0);
  const shown = limit ? rows.slice(0, limit) : rows;
  return (
    <section aria-label="Performanță locații" className={`${CARD} ${mobile ? "p-4" : "p-5"}`}>
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h3 className="text-[14px] font-semibold">Performanță locații</h3>
        <span className="text-[10.5px] tabular-nums text-[#808999]">{PERIODS.find((p) => p.id === period)!.long}</span>
      </div>
      <ul className="-mx-2.5 space-y-0.5">
        {shown.map(({ l, v, x }) => {
          const pct = (v / total) * 100;
          const warn = x.status === "warning";
          return (
            <li key={l.id}>
              <button
                type="button"
                onClick={() => openLoc(l.id)}
                aria-label={`${l.name}: ${ron(v)}, ${num(x.receipts)} bonuri azi. Deschide locația.`}
                className="w-full rounded-lg px-2.5 py-1.5 text-left transition-colors hover:bg-[#131C34]/60"
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2">
                    {l.type === "online" ? (
                      <Globe size={14} className="shrink-0 text-[#A78BFA]" aria-hidden />
                    ) : (
                      <MapPin size={14} className="shrink-0 text-[#60A5FA]" aria-hidden />
                    )}
                    <span className="truncate text-[12.5px] font-semibold">{l.name}</span>
                    {l.type === "online" && (
                      <span className="rounded-full bg-[#7C3AED]/15 px-1.5 py-0.5 text-[9px] font-semibold text-[#A78BFA]">ONLINE</span>
                    )}
                    {warn && (
                      <span className="rounded-full bg-[#F59E0B]/12 px-1.5 py-0.5 text-[9px] font-semibold text-[#FBBF24]">ÎN URMĂ</span>
                    )}
                  </span>
                  <span className="shrink-0 text-[12.5px] font-bold tabular-nums">{ron(v)}</span>
                </span>
                <span className="mt-1.5 flex items-center gap-2">
                  <Meter value={pct} color={l.type === "online" ? C.violet : C.primary} h={5} />
                  <span className="w-8 shrink-0 text-right text-[10.5px] font-medium tabular-nums text-[#808999]">{pct.toFixed(0)}%</span>
                  <span className={`w-[86px] shrink-0 text-right text-[10.5px] tabular-nums ${warn ? "text-[#FBBF24]" : "text-[#808999]"}`}>
                    sync {ago(now - x.lastSync).replace("acum ", "")}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* ---------- vânzări live ---------- */

export function SaleLine({ s, now, compact, showLoc = true }: { s: Sale; now: number; compact?: boolean; showLoc?: boolean }) {
  const p = productBySku(s.items[0].sku);
  const l = locById(s.loc);
  const fresh = now - s.at < 2500;
  return (
    <li className={`flex items-center gap-3 rounded-lg px-2.5 py-2 ${fresh ? "zof-flash" : ""}`}>
      <span className="w-[54px] shrink-0 text-[11px] tabular-nums text-[#808999]">{clock(s.at)}</span>
      <span className="min-w-0 flex-1">
        <span className={`block truncate ${compact ? "text-[12px]" : "text-[12.5px]"} font-semibold`}>
          {p.brand} {p.name}
          {s.items.length > 1 && <span className="font-normal text-[#808999]"> +{s.items.length - 1}</span>}
        </span>
        <span className="block truncate text-[10.5px] text-[#808999]">
          {showLoc && <>{l.name} · </>}
          {s.receipt} · {s.pay === "card" ? "card" : s.pay === "numerar" ? "numerar" : "online"}
          {s.buffered && <span className="text-[#FBBF24]"> · din buffer</span>}
        </span>
      </span>
      <span className="shrink-0 text-[12.5px] font-bold tabular-nums">{ron(s.value)}</span>
    </li>
  );
}

function LiveSales() {
  const { live, now, go, reduced, paused } = useZof();
  return (
    <section aria-label="Vânzări live" className={`${CARD} p-5`}>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-[14px] font-semibold">
          <LiveDot still={reduced || paused} color={paused ? C.dim : C.green} /> Vânzări live
        </h3>
        <button type="button" onClick={() => go("vanzari")} className="flex items-center gap-0.5 rounded text-[12px] font-medium text-[#60A5FA] hover:underline">
          Jurnal <ChevronRight size={12} aria-hidden />
        </button>
      </div>
      <ul aria-live="off" className="-mx-2.5">
        {live.sales.slice(0, 6).map((s) => (
          <SaleLine key={s.id} s={s} now={now} compact />
        ))}
      </ul>
    </section>
  );
}

/* ---------- top produse ---------- */

export function TrendTag({ trend }: { trend: "up" | "down" | "stable" }) {
  if (trend === "up")
    return (
      <span className="flex items-center justify-end gap-0.5 text-[10px] font-semibold text-[#34D399]">
        <TrendingUp size={12} aria-hidden /> Creștere
      </span>
    );
  if (trend === "down")
    return (
      <span className="flex items-center justify-end gap-0.5 text-[10px] font-semibold text-[#F87171]">
        <TrendingDown size={12} aria-hidden /> Scădere
      </span>
    );
  return (
    <span className="flex items-center justify-end gap-0.5 text-[10px] font-semibold text-[#808999]">
      <Minus size={12} aria-hidden /> Stabil
    </span>
  );
}

export function TopProducts({ limit = 6 }: { limit?: number }) {
  const { go, mobile } = useZof();
  return (
    <section aria-label="Top produse" className={`${CARD} ${mobile ? "p-4" : "p-5"}`}>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-[14px] font-semibold">Top produse</h3>
        <span className="text-[10.5px] text-[#808999]">ultimele 30 de zile</span>
      </div>
      <ul className="-mx-2.5">
        {TOP_PRODUCTS.slice(0, limit).map((p, i) => (
          <li key={p.sku}>
            <button
              type="button"
              onClick={() => go("rame")}
              className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-[#131C34]/50"
            >
              <span className="w-5 text-right text-[11px] font-bold text-[#808999]">#{i + 1}</span>
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#131C34]/70">
                <Glasses size={15} className="text-[#808999]" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12px] font-semibold">
                  {p.brand} {p.name}
                </span>
                <span className="block truncate text-[10.5px] text-[#808999]">
                  {p.sku} · {num(p.sold30 * 3)} vândute
                </span>
              </span>
              <span className="shrink-0 text-right">
                <span className="block text-[12px] font-semibold tabular-nums">{ronCompact(p.sold30 * 3 * p.price)}</span>
                <TrendTag trend={p.trend} />
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ---------- alerte ---------- */

function AlertsCard() {
  const { live, openAlerts } = useZof();
  const target = useAlertTarget();
  return (
    <section aria-label="Alerte recente" className={`${CARD} p-5`}>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-[14px] font-semibold">Alerte recente</h3>
        <button type="button" onClick={openAlerts} className="flex items-center gap-0.5 rounded text-[12px] font-medium text-[#60A5FA] hover:underline">
          Vezi toate <ChevronRight size={12} aria-hidden />
        </button>
      </div>
      <div className="space-y-2">
        {activeAlerts(live)
          .slice(0, 4)
          .map((a) => (
            <AlertRow key={a.id} a={a} compact onOpen={() => target(a)} />
          ))}
      </div>
    </section>
  );
}

/* ---------- telefon ---------- */

function MobileDashboard({
  f,
  heroRev,
  caption,
  liveLine,
  periodSwitch,
}: {
  f: ReturnType<typeof usePeriodFigures>;
  heroRev: number;
  caption: string;
  liveLine: ReactNode;
  periodSwitch: ReactNode;
}) {
  const { period, live, now, go, reduced } = useZof();
  const target = useAlertTarget();
  const p = PERIODS.find((x) => x.id === period)!;
  const payTot = f.pay.card + f.pay.numerar + f.pay.online;
  return (
    <div className="zof-in space-y-3">
      <PageHeader mobile title="Dashboard" subtitle="Zof Optogerman — Prezentare generală" meta={liveLine} />
      {periodSwitch}

      <section aria-label="Vânzări" className={`${CARD} overflow-hidden p-4`}>
        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[#808999]">Vânzări · {p.long}</p>
        <p className="mt-1.5 text-[32px] font-bold leading-none tracking-[-0.02em] tabular-nums">{ron(heroRev)}</p>
        <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-[#808999]">
          <Trend value={f.trend} className="font-semibold" />
          <span>{VS[period]} · {VS_SUB[period]}</span>
        </p>
        <p className="mt-0.5 text-[11.5px] text-[#808999]">{caption}</p>
        <div className="-mx-1 mt-3">
          <SalesChartMini period={period} />
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3">
        <Tile label="Profit estimat" value={ronCompact(f.profit)} color={C.greenText} sub={`marjă ${(MARGIN * 100).toLocaleString("ro-RO")}%`} />
        <Tile label="Bon mediu" value={ron(f.avg)} sub={`${num(f.receipts)} bonuri`} />
        <Tile label="Online · zof.ro" value={ronCompact(f.online)} sub={`${num(f.onlineOrders)} comenzi`} />
        <button type="button" onClick={() => go("locatii")} className="text-left">
          <Tile label="Agenți conectați" value={`${f.t.online}/9`} sub={`sync ${ago(now - f.t.lastSync)}`} color={f.t.online === 9 ? C.greenText : C.amberText} />
        </button>
      </div>

      <section aria-label="Încasări" className={`${CARD} p-4`}>
        <div className="mb-3 flex items-baseline justify-between">
          <h3 className="text-[14px] font-semibold">Încasări</h3>
          <span className="text-[10.5px] text-[#808999]">{p.long}</span>
        </div>
        <PayBar pay={f.pay} h={10} />
        <ul className="mt-3 space-y-1.5 text-[12.5px]">
          {[
            { k: "Card", v: f.pay.card, c: C.card },
            { k: "Numerar", v: f.pay.numerar, c: C.cash },
            { k: "Online", v: f.pay.online, c: C.online },
          ].map((r) => (
            <li key={r.k} className="flex items-center gap-2">
              <span className="size-2 rounded-full" style={{ background: r.c }} aria-hidden />
              <span className="flex-1 text-[#A3ACBB]">{r.k}</span>
              <span className="font-semibold tabular-nums">{ron(r.v)}</span>
              <span className="w-9 text-right text-[11px] tabular-nums text-[#808999]">{Math.round((r.v / payTot) * 100)}%</span>
            </li>
          ))}
        </ul>
      </section>

      <LocationsCard period={period} />

      <section aria-label="Vânzări live" className={`${CARD} p-4`}>
        <div className="mb-1 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-[14px] font-semibold">
            <LiveDot still={reduced} /> Vânzări live
          </h3>
          <button type="button" onClick={() => go("vanzari")} className="flex items-center gap-0.5 text-[12px] font-medium text-[#60A5FA]">
            Jurnal <ChevronRight size={12} aria-hidden />
          </button>
        </div>
        <ul className="-mx-2.5">
          {live.sales.slice(0, 5).map((s) => (
            <SaleLine key={s.id} s={s} now={now} compact />
          ))}
        </ul>
      </section>

      <section aria-label="Alerte" className={`${CARD} space-y-2 p-4`}>
        <h3 className="mb-1 text-[14px] font-semibold">Alerte recente</h3>
        {activeAlerts(live)
          .slice(0, 3)
          .map((a) => (
            <AlertRow key={a.id} a={a} compact onOpen={() => target(a)} />
          ))}
      </section>

      <TopProducts limit={5} />
    </div>
  );
}

function Tile({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className={`${CARD} h-full p-3.5`}>
      <p className="text-[10.5px] font-medium uppercase tracking-[0.06em] text-[#808999]">{label}</p>
      <p className="mt-1.5 truncate text-[18px] font-bold leading-tight tabular-nums" style={{ color }}>
        {value}
      </p>
      {sub && <p className="mt-0.5 truncate text-[11px] text-[#808999]">{sub}</p>}
    </div>
  );
}

function SalesChartMini({ period }: { period: Period }) {
  const { live, now, reduced } = useZof();
  const t = totals(live);
  const minuteKey = Math.floor(hourOf(now) * 60);
  const s = useMemo(() => periodSeries(period, t.rev, minuteKey / 60), [period, t.rev, minuteKey]);
  return (
    <TrendChart
      name="Evoluție vânzări"
      values={s.values}
      compare={s.compare}
      labels={s.labels}
      height={116}
      fmt={ron}
      compareName={s.compareLabel}
      live
      still={reduced}
      lastX={s.lastX}
      partialLast={s.partial}
      tipLabel={(i) => tip(period, s.labels, i, s.values, now)}
      maxLabels={4}
    />
  );
}
