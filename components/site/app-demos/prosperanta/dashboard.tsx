"use client";

import { useMemo, useState } from "react";
import { ArrowUpRight, Fuel as FuelIcon, Ticket, ChevronRight, UserPlus } from "lucide-react";
import { AreaChart, Donut, Sparkline, lei, num, pct, series } from "../kit";
import { C, STATIONS, networkDaily, stationName, stationShare } from "./data";
import { useDemo, type Tx } from "./store";
import { StaffShell } from "./staff";
import { AxisLabels, Card, CardHead, LiveDot, Pills, Roll, de, litri } from "./ui";

/* ============================================================
   Dashboard-ul rețelei: cifrele lunii care se mișcă live,
   litrii pe zi, clasamentul stațiilor și fluxul de tranzacții.
   ============================================================ */

type Range = "7" | "30" | "90";

const FUEL_MIX = [
  { label: "Benzină", value: 46, color: C.red },
  { label: "Motorină", value: 39, color: C.fg },
  { label: "GPL", value: 15, color: C.orange },
];

export function Dashboard() {
  const { s, mobile } = useDemo();
  const t = s.totals;

  const kpis = [
    { l: "Litri · septembrie", v: <Roll value={t.monthLitres} />, sub: `azi ${num(t.todayLitres)} L`, seed: 3 },
    { l: "Membri club", v: <Roll value={t.members} />, sub: `+${t.newToday} noi azi`, seed: 5 },
    { l: "Puncte emise", v: <Roll value={t.points} />, sub: "din mai 2026", seed: 8 },
    { l: "Vouchere folosite", v: <Roll value={t.vouchers} />, sub: "în 16 stații", seed: 11 },
  ];

  const revenue = (
    <section
      className={`relative overflow-hidden rounded-[20px] text-white ${mobile ? "p-5" : "col-span-2 p-5"}`}
      style={{ background: C.heroGrad, boxShadow: C.shadow }}
      aria-label="Vânzări carburant"
    >
      <p className="flex items-center gap-2 text-[11.5px] font-bold uppercase tracking-[0.14em] opacity-95">
        <LiveDot color="#fff" /> Vânzări carburant · septembrie
      </p>
      <p className={`mt-2 font-black leading-none tracking-[-0.02em] ${mobile ? "text-[34px]" : "text-[36px]"}`}>
        <Roll value={t.monthRevenue} format={lei} />
      </p>
      <div className="mt-2.5 flex items-center justify-between gap-2">
        <p className="truncate text-[12.5px] font-medium opacity-95">
          Azi <b className="font-black tnum">{lei(t.todayRevenue)}</b> · <span className="tnum">{num(t.todayTx)}</span> {de(t.todayTx)}tranzacții
        </p>
        <span className="flex shrink-0 items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-black">
          <ArrowUpRight size={13} strokeWidth={3} /> 8,4% vs. aug.
        </span>
      </div>
    </section>
  );

  const tiles = kpis.map((k) => (
    <div key={k.l} className="flex flex-col rounded-[20px] bg-white p-4" style={{ border: `2px solid ${C.border}` }}>
      <p className="truncate text-[10.5px] font-bold uppercase tracking-[0.08em]" style={{ color: C.mutedFg }}>
        {k.l}
      </p>
      <p className={`mt-1 font-black leading-tight ${mobile ? "text-[22px]" : "text-[25px]"}`} style={{ color: C.red }}>
        {k.v}
      </p>
      <div className="mt-auto flex items-end justify-between gap-2 pt-1.5">
        <p className="truncate text-[11.5px] font-bold" style={{ color: C.mutedFg }}>
          {k.sub}
        </p>
        <div className="w-[56px] shrink-0">
          <Sparkline values={series(14, { seed: k.seed, drift: 0.02 })} color={C.red} height={22} strokeWidth={1.8} />
        </div>
      </div>
    </div>
  ));

  return (
    <StaffShell face="admin" screen="dashboard">
      <div className="prs-scroll absolute inset-0">
        {mobile ? (
          <main className="space-y-3 px-3 pb-10 pt-3">
            {revenue}
            <div className="grid grid-cols-2 gap-3">{tiles}</div>
            <LiveFeed limit={6} />
            <TrendCard />
            <TopStations />
          </main>
        ) : (
          <main className="mx-auto max-w-[1232px] space-y-4 px-6 pb-6 pt-5">
            <div className="grid grid-cols-6 gap-4">
              {revenue}
              {tiles}
            </div>
            <div className="grid grid-cols-12 gap-4">
              <div className="col-span-8 space-y-4">
                <TrendCard />
                <TopStations />
              </div>
              <div className="col-span-4">
                <LiveFeed limit={10} fill />
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
              { id: "30", label: "30 zile" },
              { id: "90", label: "90 zile" },
            ]}
          />
        }
      >
        Litri pe zi
      </CardHead>
      <div className={mobile ? "px-3 pt-3" : "px-5 pt-3"}>
        <div className="mb-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-[12px] font-bold">
          <span className="flex items-center gap-1.5">
            <span className="h-[3px] w-4 rounded-full" style={{ background: C.red }} /> Total rețea
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-[3px] w-4 rounded-full" style={{ background: C.orange }} /> Membri club
          </span>
          {!mobile && (
            <span className="ml-auto flex gap-5" style={{ color: C.mutedFg }}>
              <span>
                Medie <b className="font-black" style={{ color: C.fg }}>{num(avg)} L</b>
              </span>
              <span>
                Cota club <b className="font-black" style={{ color: C.fg }}>{pct(share)}</b>
              </span>
              <span>
                Vârf <b className="font-black" style={{ color: C.fg }}>{best.label}</b>
              </span>
            </span>
          )}
        </div>
        <AreaChart
          height={mobile ? 150 : 128}
          series={[
            { values: data.map((d) => d.total), color: C.red },
            { values: data.map((d) => d.club), color: C.orange },
          ]}
          grid="rgba(0,0,0,0.07)"
        />
        <AxisLabels labels={data.map((d) => d.label)} count={mobile ? 4 : 7} />
      </div>
      {mobile && (
        <div className="grid grid-cols-3 gap-2 px-3 pb-3 pt-1 text-[11px]" style={{ color: C.mutedFg }}>
          <span>
            Medie
            <b className="block text-[13.5px] font-black" style={{ color: C.fg }}>
              {num(avg / 1000)} mii L
            </b>
          </span>
          <span>
            Cota club
            <b className="block text-[13.5px] font-black" style={{ color: C.fg }}>
              {pct(share)}
            </b>
          </span>
          <span>
            Vârf
            <b className="block text-[13.5px] font-black" style={{ color: C.fg }}>
              {best.label}
            </b>
          </span>
        </div>
      )}
      {!mobile && <div className="h-3" />}
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
      <CardHead right={<span className="text-[12px] font-bold" style={{ color: C.mutedFg }}>litri · septembrie</span>}>Top stații</CardHead>
      <div className={mobile ? "" : "flex"}>
        <ul className={`${mobile ? "px-2 py-2" : "flex-1 px-3 py-2"}`}>
          {rows.map((r, i) => (
            <li key={r.st.id}>
              <button
                type="button"
                onClick={() => open(r.st.id)}
                className="group flex w-full items-center gap-3 rounded-[12px] px-2 py-[5px] text-left transition-colors hover:bg-[#FAFAFA]"
              >
                <span className="w-4 shrink-0 text-[12px] font-black" style={{ color: C.soft }}>
                  {i + 1}
                </span>
                <span className="w-[118px] shrink-0 truncate text-[13px] font-bold">{r.st.name}</span>
                <span className="relative h-[18px] flex-1 overflow-hidden rounded-full" style={{ background: C.muted }}>
                  <span
                    className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-500"
                    style={{ width: `${(r.litres / max) * 100}%`, background: i === 0 ? C.heroGrad : "#F28C96" }}
                  />
                </span>
                <span className="tnum w-[76px] shrink-0 text-right text-[12.5px] font-black">{num(r.litres)}</span>
                <ChevronRight size={15} className="shrink-0 opacity-30 transition-opacity group-hover:opacity-100" />
              </button>
            </li>
          ))}
        </ul>
        <div
          className={`flex items-center gap-4 ${mobile ? "px-5 pb-4 pt-2" : "w-[250px] shrink-0 px-5"}`}
          style={mobile ? { borderTop: `2px solid ${C.border}` } : { borderLeft: `2px solid ${C.border}` }}
        >
          <Donut parts={FUEL_MIX} size={mobile ? 96 : 104} thickness={15} track={C.muted}>
            <span className="text-[10px] font-bold uppercase" style={{ color: C.mutedFg }}>
              mix
            </span>
          </Donut>
          <ul className="space-y-1.5">
            {FUEL_MIX.map((f) => (
              <li key={f.label} className="flex items-center gap-2 text-[12.5px] font-bold">
                <span className="size-2.5 rounded-full" style={{ background: f.color }} />
                {f.label}
                <span className="font-black">{f.value}%</span>
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
    <li
      className={`flex items-center gap-3 px-4 py-2.5 ${t.mine ? "a-flash" : first ? "a-in" : ""}`}
      style={{ borderTop: first ? undefined : `1px solid ${C.border}` }}
    >
      <span
        className="flex size-8 shrink-0 items-center justify-center rounded-full"
        style={{ background: v ? "#FFF3E0" : "#FDECEE", color: v ? "#B86E00" : C.red }}
      >
        {v ? <Ticket size={15} strokeWidth={2.4} /> : <FuelIcon size={15} strokeWidth={2.4} />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-bold">
          {t.name}
          {t.mine && (
            <span className="ml-1.5 rounded-full px-1.5 py-0.5 text-[9px] font-black uppercase text-white" style={{ background: C.red }}>
              tu
            </span>
          )}
        </p>
        <p className="truncate text-[11.5px]" style={{ color: C.mutedFg }}>
          {stationName(t.station)} · {t.time}
        </p>
      </div>
      <p className="shrink-0 text-right text-[12.5px] font-black" style={{ color: v ? "#B86E00" : C.red }}>
        {v ? (
          <span className="block max-w-[110px] truncate">{t.reward}</span>
        ) : (
          <>
            +{t.points}p · <span className="tnum">{t.litres.toFixed(1).replace(".", ",")}L</span>
          </>
        )}
      </p>
    </li>
  );
}

export function LiveFeed({ limit, fill = false }: { limit: number; fill?: boolean }) {
  const { s } = useDemo();
  return (
    <Card className={fill ? "flex h-full flex-col" : ""}>
      <CardHead
        right={
          <span className="flex items-center gap-1.5 text-[12px] font-bold" style={{ color: C.mutedFg }}>
            <UserPlus size={13} /> {s.totals.newToday} {de(s.totals.newToday)}membri noi azi
          </span>
        }
      >
        <LiveDot /> Tranzacții live
      </CardHead>
      <ul className={fill ? "min-h-0 flex-1 overflow-hidden" : ""} aria-live="off">
        {s.feed.slice(0, limit).map((t, i) => (
          <FeedRow key={t.id} t={t} first={i === 0} />
        ))}
      </ul>
      <p className="px-4 py-2.5 text-[11.5px]" style={{ borderTop: `1px solid ${C.border}`, color: C.mutedFg }}>
        Pe azi: <b className="tnum font-black" style={{ color: C.fg }}>{num(s.totals.todayTx)}</b> {de(s.totals.todayTx)}tranzacții ·{" "}
        <b className="tnum font-black" style={{ color: C.fg }}>{litri(s.totals.todayLitres, 0)}</b>
      </p>
    </Card>
  );
}
