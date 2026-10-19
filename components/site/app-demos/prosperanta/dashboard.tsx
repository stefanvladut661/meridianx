"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight, ChevronRight, Pause, Play } from "lucide-react";
import { lei, num, pct } from "../kit";
import { C, STATIONS, networkDaily, stationName, stationShare } from "./data";
import { useDemo, type Tx } from "./store";
import { StaffShell } from "./staff";
import { AxisLabels, Card, CardHead, LineChart, LiveDot, Meta, MetricStrip, Pills, SW, de, litri } from "./ui";

/* ============================================================
   Dashboard-ul rețelei: cifrele lunii, litrii pe zi, clasamentul
   stațiilor și fluxul de tranzacții, care se poate opri.
   ============================================================ */

type Range = "7" | "30" | "90";

const FUEL_MIX = [
  { label: "Benzină", value: 46, color: C.red },
  { label: "Motorină", value: 39, color: C.fg },
  { label: "GPL", value: 15, color: C.orange },
];

/** 30.846.215 → „30,8 mil.” (valoarea exactă stă în `title`) */
const mil = (n: number) => `${(n / 1e6).toLocaleString("ro-RO", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} mil.`;

const line = `1px solid ${C.border}`;

export function Dashboard() {
  const { s, mobile } = useDemo();
  const t = s.totals;

  const metrics = (
    <MetricStrip
      cols={mobile ? 2 : 5}
      size={mobile ? "md" : "lg"}
      items={[
        {
          label: "Vânzări în septembrie",
          value: `${mil(t.monthRevenue)} lei`,
          title: lei(t.monthRevenue),
          span: mobile ? 2 : undefined,
          sub: (
            <span className="flex items-center gap-1">
              <span className="flex items-center gap-0.5 font-medium" style={{ color: C.green }}>
                <ArrowUpRight size={13} strokeWidth={2} aria-hidden />
                <span className="sr-only">creștere de </span>8,4%
              </span>
              față de 1–23 aug.
            </span>
          ),
        },
        { label: "Litri în septembrie", value: `${mil(t.monthLitres)} L`, title: `${num(t.monthLitres)} L`, sub: `${num(t.todayLitres)} L azi` },
        { label: "Membri", value: num(t.members), sub: `+${t.newToday} azi` },
        { label: "Puncte emise din mai", value: mil(t.points), title: num(t.points) },
        { label: "Vouchere folosite", value: num(t.vouchers) },
      ]}
    />
  );

  return (
    <StaffShell face="admin" screen="dashboard">
      <div className="prs-scroll absolute inset-0">
        <h1 className="sr-only">Dashboard</h1>
        {mobile ? (
          <main className="space-y-3 px-3 pb-10 pt-3">
            {metrics}
            <LiveFeed limit={6} />
            <TrendCard />
            <TopStations />
          </main>
        ) : (
          <main className="mx-auto max-w-[1232px] space-y-4 px-6 pb-6 pt-5">
            {metrics}
            <div className="grid grid-cols-12 gap-4">
              <div className="col-span-8 space-y-4">
                <TrendCard />
                <TopStations />
              </div>
              {/* fluxul ia exact înălțimea coloanei din stânga */}
              <div className="relative col-span-4">
                <div className="absolute inset-0">
                  <LiveFeed limit={14} fill />
                </div>
              </div>
            </div>
          </main>
        )}
      </div>
    </StaffShell>
  );
}

function TrendCard() {
  const { mobile } = useDemo();
  const [range, setRange] = useState<Range>("30");
  const data = useMemo(() => networkDaily(+range), [range]);
  const avg = data.reduce((a, d) => a + d.total, 0) / data.length;
  const share = (data.reduce((a, d) => a + d.club, 0) / data.reduce((a, d) => a + d.total, 0)) * 100;
  const best = data.reduce((b, d) => (d.total > b.total ? d : b), data[0]);
  /* axa Y pornește de la zero; vârful, rotunjit la 30 de mii */
  const top = Math.ceil(Math.max(...data.map((d) => d.total)) / 30_000) * 30_000;
  const ticks = [0, 1, 2, 3].map((k) => (top * k) / 3);

  const stats = [
    { l: "Medie", v: `${num(avg)} L` },
    { l: "Cota club", v: pct(share) },
    { l: "Vârf", v: best.label },
  ];

  return (
    <Card>
      <CardHead
        right={
          <Pills<Range>
            label="Interval"
            size="sm"
            value={range}
            onChange={setRange}
            items={[
              { id: "7", label: "7 zile" },
              { id: "30", label: "30 de zile" },
              { id: "90", label: "90 de zile" },
            ]}
          />
        }
      >
        Litri pe zi
      </CardHead>
      <div className={mobile ? "px-3 pb-3 pt-3" : "px-4 pb-4 pt-3"}>
        <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-[12.5px]">
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded-full" style={{ background: C.fg }} aria-hidden /> Total rețea
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded-full" style={{ background: C.red }} aria-hidden /> Membri club
          </span>
          {!mobile && (
            <span className="ml-auto flex gap-5" style={{ color: C.mutedFg }}>
              {stats.map((x) => (
                <span key={x.l}>
                  {x.l}{" "}
                  <span className="font-semibold" style={{ color: C.fg }}>
                    {x.v}
                  </span>
                </span>
              ))}
            </span>
          )}
        </div>
        <LineChart
          height={mobile ? 150 : 156}
          top={top}
          ticks={ticks}
          series={[
            { values: data.map((d) => d.total), color: C.fg },
            { values: data.map((d) => d.club), color: C.red },
          ]}
        />
        <AxisLabels labels={data.map((d) => d.label)} count={mobile ? 4 : 7} gutter />
      </div>
      {mobile && (
        <dl className="grid grid-cols-3 gap-px" style={{ borderTop: line, background: C.border }}>
          {stats.map((x) => (
            <div key={x.l} className="bg-white px-3 py-2.5">
              <dt className="text-[12.5px]" style={{ color: C.mutedFg }}>
                {x.l}
              </dt>
              <dd className="text-[14px] font-semibold">{x.v}</dd>
            </div>
          ))}
        </dl>
      )}
    </Card>
  );
}

function TopStations() {
  const { s, mobile, go, setRepStation } = useDemo();
  const rows = STATIONS.map((st) => ({ st, litres: s.totals.monthLitres * stationShare(st.id) }))
    .sort((a, b) => b.litres - a.litres)
    .slice(0, 5);
  const max = rows[0].litres;
  const open = (id: number) => {
    setRepStation(id);
    go("rapoarte");
  };
  return (
    <Card>
      <CardHead right={<Meta>litri, septembrie</Meta>}>Top stații</CardHead>
      <div className={mobile ? "" : "flex"}>
        <ol className="min-w-0 flex-1 px-2 py-2">
          {rows.map((r, i) => (
            <li key={r.st.id}>
              <button type="button" onClick={() => open(r.st.id)} className="row flex w-full items-center gap-3 rounded-[8px] px-2 py-[7px] text-left">
                <span className="w-3 shrink-0 text-[12.5px]" style={{ color: C.mutedFg }}>
                  {i + 1}
                </span>
                <span className={`${mobile ? "w-[104px]" : "w-[124px]"} shrink-0 truncate text-[13.5px] font-medium`}>{r.st.name}</span>
                <span className="relative h-1.5 min-w-0 flex-1 overflow-hidden rounded-[3px]" style={{ background: C.muted }} aria-hidden>
                  <span className="absolute inset-y-0 left-0 rounded-[3px]" style={{ width: `${(r.litres / max) * 100}%`, background: C.red }} />
                </span>
                <span className="w-[62px] shrink-0 text-right text-[13px] font-semibold">{num(r.litres)}</span>
                <ChevronRight size={16} strokeWidth={SW} className="shrink-0" style={{ color: C.mutedFg }} aria-hidden />
              </button>
            </li>
          ))}
        </ol>
        <div className={mobile ? "px-4 pb-4 pt-3" : "w-[236px] shrink-0 px-4 py-3"} style={mobile ? { borderTop: line } : { borderLeft: line }}>
          <h4 className="text-[13px] font-semibold">Combustibil</h4>
          <div
            className="mt-3 flex h-2.5 gap-0.5 overflow-hidden rounded-[2px]"
            role="img"
            aria-label={FUEL_MIX.map((f) => `${f.label} ${f.value}%`).join(", ")}
          >
            {FUEL_MIX.map((f) => (
              <span key={f.label} style={{ width: `${f.value}%`, background: f.color }} />
            ))}
          </div>
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[12.5px]">
            {FUEL_MIX.map((f) => (
              <li key={f.label} className="flex items-center gap-1.5">
                <span className="size-2 rounded-[2px]" style={{ background: f.color }} aria-hidden />
                {f.label} <span className="font-semibold">{f.value}%</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Card>
  );
}

function FeedRow({ t, first }: { t: Tx; first: boolean }) {
  const v = t.kind === "voucher";
  return (
    <li className={`flex min-h-[44px] items-center gap-3 px-4 py-1.5 ${t.mine ? "a-flash" : ""}`} style={{ borderTop: first ? undefined : line }}>
      <span className="w-10 shrink-0 text-[12.5px]" style={{ color: C.mutedFg }}>
        {t.time}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13.5px] font-medium leading-snug">{t.name}</p>
        <p className="truncate text-[12.5px] leading-snug" style={{ color: C.mutedFg }}>
          {stationName(t.station)}
        </p>
      </div>
      <div className="min-w-0 max-w-[48%] shrink-0 text-right">
        <p className="truncate text-[13.5px] font-medium leading-snug">{v ? t.reward : litri(t.litres, 1)}</p>
        <p className="text-[12px] leading-snug" style={{ color: C.mutedFg }}>
          {v ? "voucher" : `+${t.points} p`}
        </p>
      </div>
    </li>
  );
}

/** Rândurile care încap întregi în înălțimea dată (fără un rând tăiat jos). */
function useFit(limit: number, enabled: boolean) {
  const ref = useRef<HTMLUListElement>(null);
  const [fit, setFit] = useState(limit);
  useEffect(() => {
    const el = ref.current;
    if (!enabled || !el) return;
    const ro = new ResizeObserver(() => setFit(Math.max(1, Math.min(limit, Math.floor(el.clientHeight / 45)))));
    ro.observe(el);
    return () => ro.disconnect();
  }, [limit, enabled]);
  return [ref, enabled ? fit : limit] as const;
}

export function LiveFeed({ limit, fill = false }: { limit: number; fill?: boolean }) {
  const { s, togglePause } = useDemo();
  const [ref, count] = useFit(limit, fill);
  const paused = s.paused;
  return (
    <Card className={fill ? "flex h-full flex-col" : ""}>
      <CardHead
        right={
          <span className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 text-[12.5px]" style={{ color: C.mutedFg }}>
              <LiveDot color={paused ? C.soft : C.green} /> {paused ? "În pauză" : "Live"}
            </span>
            {/* eticheta se schimbă odată cu starea, deci fără aria-pressed */}
            <button type="button" onClick={togglePause} className="ico flex h-7 items-center gap-1 rounded-[6px] px-2 text-[12.5px] font-medium">
              {paused ? <Play size={14} strokeWidth={SW} aria-hidden /> : <Pause size={14} strokeWidth={SW} aria-hidden />}
              {paused ? "Reia" : "Pauză"}
            </button>
          </span>
        }
      >
        Tranzacții
      </CardHead>
      <ul ref={ref} className={fill ? "min-h-0 flex-1 overflow-hidden" : ""} aria-live="off">
        {s.feed.slice(0, count).map((t, i) => (
          <FeedRow key={t.id} t={t} first={i === 0} />
        ))}
      </ul>
      <p className="px-4 py-2.5 text-[12.5px]" style={{ borderTop: line, color: C.mutedFg }}>
        Azi:{" "}
        <span className="font-semibold" style={{ color: C.fg }}>
          {num(s.totals.todayTx)}
        </span>{" "}
        {de(s.totals.todayTx)}tranzacții ·{" "}
        <span className="font-semibold" style={{ color: C.fg }}>
          {litri(s.totals.todayLitres, 0)}
        </span>
      </p>
    </Card>
  );
}
