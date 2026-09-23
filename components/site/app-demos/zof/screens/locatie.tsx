"use client";

import { useMemo, useRef, useEffect } from "react";
import {
  ArrowLeft,
  Banknote,
  CreditCard,
  Globe,
  Glasses,
  MapPin,
  Receipt,
  RefreshCw,
  ShoppingBag,
  TrendingUp,
} from "lucide-react";
import { Donut, num, rng } from "../../kit";
import { GROWTH, LOCS, PAST, PHYSICAL, PREV, PRODUCTS, SHARE, hourly, hourlyLastWeek, HOURS, locById, stockLevel, type Loc } from "../data";
import { useZof } from "../store";
import { Btn, C, CARD, Columns, Legend, LiveDot, MONO, Trend, ago, clock, ron, ronCompact, useTween } from "../ui";
import { hourOf, SaleLine } from "./dashboard";
import { StatusBadge, SyncProgress } from "./locatii";

/* ============================================================
   O locație în detaliu: vânzările de azi pe ore, încasările,
   bonurile care intră și agentul care le aduce.
   ============================================================ */

const DRIFT = [2.4, -1.1, 3.2, 0.6, -2.3, 1.4, -0.7, 1.8, 4.6];

function useLocFigures(l: Loc) {
  const { live } = useZof();
  const x = live.locs[l.id];
  const i = LOCS.indexOf(l);
  const liveAdd = x.rev - l.today;
  const lastWeek = (PREV.azi * SHARE[l.id] + liveAdd / GROWTH.azi) / (1 + DRIFT[i] / 100);
  const d30 = PAST["30z"] * SHARE[l.id] + x.rev;
  const prev30 = (PREV["30z"] * SHARE[l.id] + liveAdd / GROWTH["30z"]) / (1 + DRIFT[i] / 200);
  return {
    x,
    trendToday: (x.rev / lastWeek - 1) * 100,
    d30,
    trend30: (d30 / prev30 - 1) * 100,
    avg: x.rev / Math.max(1, x.receipts),
    pay: { card: x.rev * l.pay[0], numerar: x.rev * l.pay[1], online: x.rev * l.pay[2] },
  };
}

/** Produsele cu cele mai multe vânzări în locație (30 de zile) + stocul ei. */
function topAt(l: Loc) {
  const j = PHYSICAL.findIndex((p) => p.id === l.id);
  const r = rng(700 + LOCS.indexOf(l));
  // online se vând rame, ochelari de soare și lentile de contact; lentilele se montează în magazin
  const ok = l.type === "online" ? ["rame", "soare", "contact"] : ["rame", "soare", "lentile", "contact"];
  return PRODUCTS.filter((p) => ok.includes(p.category))
    .map((p) => {
      const sold = Math.max(1, Math.round(p.sold30 * 3 * SHARE[l.id] * (0.6 + r() * 0.8)));
      return { p, sold, stock: j >= 0 ? p.stock[j] : p.stock.reduce((a, b) => a + b, 0) };
    })
    .sort((a, b) => b.sold * b.p.price - a.sold * a.p.price)
    .slice(0, 6);
}

function Chips() {
  const { loc, openLoc, live, mobile } = useZof();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (el && ref.current) {
      const box = ref.current;
      box.scrollLeft = el.offsetLeft - box.clientWidth / 2 + el.clientWidth / 2;
    }
  }, [loc]);
  return (
    <div
      ref={ref}
      role="group"
      aria-label="Alege locația"
      className={`zof-noscroll flex gap-1.5 overflow-x-auto pr-8 [mask-image:linear-gradient(to_right,black_calc(100%-40px),transparent)] ${mobile ? "-mx-4 px-4" : ""}`}
    >
      {LOCS.map((l) => {
        const on = l.id === loc;
        const warn = live.locs[l.id].status === "warning";
        return (
          <button
            key={l.id}
            type="button"
            aria-pressed={on}
            onClick={() => openLoc(l.id)}
            className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors ${
              on
                ? "border-[#2563EB] bg-[#2563EB] text-white"
                : "border-[#1C2336] bg-[#0A101F] text-[#A3ACBB] hover:border-[#283149] hover:text-[#E1E7EF]"
            }`}
          >
            <span className="size-1.5 rounded-full" style={{ background: warn ? C.amber : on ? "#fff" : C.green }} aria-hidden />
            {l.name}
          </button>
        );
      })}
    </div>
  );
}

function StatCard({
  title,
  value,
  icon: Icon,
  tint,
  trend,
  sub,
}: {
  title: string;
  value: string;
  icon: typeof Receipt;
  tint: string;
  trend?: number;
  sub?: string;
}) {
  const { mobile } = useZof();
  return (
    <div className={`${CARD} p-4`}>
      <div className="mb-2.5 flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-[0.07em] text-[#808999]">{title}</span>
        <span className="rounded-lg p-1.5" style={{ background: `${tint}1A` }}>
          <Icon size={15} style={{ color: tint }} aria-hidden />
        </span>
      </div>
      <p className={`truncate ${mobile ? "text-[19px]" : "text-[22px]"} font-bold leading-tight tracking-[-0.01em] tabular-nums`}>{value}</p>
      <p className="mt-1.5 flex items-center gap-2 text-[11.5px] text-[#808999]">
        {trend !== undefined && <Trend value={trend} className="font-semibold" />}
        {sub && <span className="truncate">{sub}</span>}
      </p>
    </div>
  );
}

function HourlyCard({ l }: { l: Loc }) {
  const { live, now, mobile } = useZof();
  const x = live.locs[l.id];
  const minuteKey = Math.floor(hourOf(now) * 60);
  const values = useMemo(() => hourly(x.rev, minuteKey / 60), [x.rev, minuteKey]);
  const compare = useMemo(() => hourlyLastWeek().map((v) => v * SHARE[l.id]), [l.id]);
  const cur = values.reduce<number>((a, v, i) => (v !== null ? i : a), 0);
  return (
    <section aria-label="Vânzări pe ore" className={`${CARD} ${mobile ? "p-4" : "p-5"}`}>
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h3 className="text-[14px] font-semibold">Vânzări pe ore · azi</h3>
          <p className="mt-0.5 text-[11.5px] text-[#808999]">
            {l.type === "online" ? "comenzi pe ore" : "program 09:00 – 22:00"} · ora curentă în curs
          </p>
        </div>
        {!mobile && (
          <Legend
            items={[
              { label: "azi", color: C.blue },
              { label: "aceeași zi, săpt. trecută", color: C.compare },
            ]}
          />
        )}
      </div>
      <Columns
        name={`Vânzări pe ore la ${l.name}`}
        values={values}
        compare={compare}
        labels={HOURS.map((h) => (mobile ? `${h}` : `${String(h).padStart(2, "0")}:00`))}
        height={mobile ? 130 : 188}
        fmt={ron}
        compareName="săpt. trecută"
        current={cur}
      />
      {mobile && (
        <div className="mt-2.5">
          <Legend
            items={[
              { label: "azi", color: C.blue },
              { label: "săpt. trecută", color: C.compare },
            ]}
          />
        </div>
      )}
    </section>
  );
}

function PayCard({ l, pay }: { l: Loc; pay: { card: number; numerar: number; online: number } }) {
  const { mobile } = useZof();
  const parts = [
    { k: "Card", v: pay.card, c: C.card, icon: CreditCard },
    { k: "Numerar", v: pay.numerar, c: C.cash, icon: Banknote },
    { k: "Online", v: pay.online, c: C.online, icon: Globe },
  ].filter((p) => p.v > 0);
  const tot = parts.reduce((s, p) => s + p.v, 0) || 1;
  const main = parts[0];
  return (
    <section aria-label="Încasări" className={`${CARD} h-full ${mobile ? "p-4" : "p-5"}`}>
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="text-[14px] font-semibold">Încasări · azi</h3>
        <span className="text-[10.5px] text-[#808999]">{l.type === "online" ? "plătite la comandă" : "din casa de marcat"}</span>
      </div>
      <div className={`flex items-center ${mobile ? "gap-4" : "flex-col gap-4"}`}>
        <Donut parts={parts.map((p) => ({ value: p.v, color: p.c }))} size={mobile ? 116 : 140} thickness={mobile ? 14 : 16} track="#131C34">
          <span className="text-[20px] font-bold tabular-nums">{Math.round((main.v / tot) * 100)}%</span>
          <span className="text-[10.5px] text-[#808999]">{main.k.toLowerCase()}</span>
        </Donut>
        <ul className="w-full min-w-0 flex-1 space-y-2">
          {parts.map((p) => (
            <li key={p.k} className="flex items-center gap-2 text-[12.5px]">
              <span className="size-2 shrink-0 rounded-full" style={{ background: p.c }} aria-hidden />
              <span className="flex-1 text-[#A3ACBB]">{p.k}</span>
              <span className="font-semibold tabular-nums">{ron(p.v)}</span>
              <span className="w-8 text-right text-[11px] tabular-nums text-[#808999]">{Math.round((p.v / tot) * 100)}%</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Receipts({ l }: { l: Loc }) {
  const { live, now, mobile, reduced } = useZof();
  const list = live.sales.filter((s) => s.loc === l.id).slice(0, mobile ? 5 : 7);
  const pending = live.buffered.filter((s) => s.loc === l.id).length;
  return (
    <section aria-label="Bonuri recente" className={`${CARD} ${mobile ? "p-4" : "p-5"}`}>
      <div className="mb-1 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-[14px] font-semibold">
          <LiveDot still={reduced} color={pending ? C.amber : C.green} /> Bonuri recente
        </h3>
        <span className="text-[10.5px] text-[#808999]">{pending ? `${pending} în buffer local` : "în timp real"}</span>
      </div>
      {list.length ? (
        <ul className="-mx-2.5">
          {list.map((s) => (
            <SaleLine key={s.id} s={s} now={now} compact showLoc={false} />
          ))}
        </ul>
      ) : (
        <p className="py-6 text-center text-[12px] text-[#808999]">
          {pending
            ? "Bonurile noi așteaptă în bufferul local al magazinului. Apasă „Sincronizează acum”."
            : "Bonurile noi apar aici în câteva secunde."}
        </p>
      )}
    </section>
  );
}

function TopHere({ l }: { l: Loc }) {
  const { mobile, go } = useZof();
  const top = useMemo(() => topAt(l), [l]);
  return (
    <section aria-label="Top produse în locație" className={`${CARD} ${mobile ? "p-4" : "p-5"}`}>
      <div className="mb-1 flex items-center justify-between">
        <h3 className="text-[14px] font-semibold">Top produse aici</h3>
        <span className="text-[10.5px] text-[#808999]">30 de zile · stoc în magazin</span>
      </div>
      <ul className="-mx-2.5">
        {top.map(({ p, sold, stock }) => {
          const lv = stockLevel(stock);
          return (
            <li key={p.sku}>
              <button type="button" onClick={() => go("rame")} className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left hover:bg-[#131C34]/50">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#131C34]/70">
                  <Glasses size={15} className="text-[#808999]" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12px] font-semibold">
                    {p.brand} {p.name}
                  </span>
                  <span className="block text-[10.5px] text-[#808999]">
                    {num(sold)} vândute · {ronCompact(sold * p.price)}
                  </span>
                </span>
                {l.type === "fizic" && (
                  <span
                    className="shrink-0 rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold tabular-nums"
                    style={{
                      color: lv === "out" ? C.redText : lv === "low" ? C.amberText : C.dim2,
                      background: lv === "out" ? "rgba(239,68,68,0.1)" : lv === "low" ? "rgba(245,158,11,0.1)" : "#131C34",
                    }}
                  >
                    {stock} buc
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function AgentCard({ l }: { l: Loc }) {
  const { live, now, sync, mobile } = useZof();
  const x = live.locs[l.id];
  const rows: [string, string, boolean?][] = [
    ["Conector", l.connector, true],
    ["Sursa datelor", `${l.source} · ${l.method}`],
    [l.type === "online" ? "Canal" : "Ultima sursă citită", l.file, true],
    ["Versiune agent", l.agent, true],
    ["Watermark", clock(x.lastSync), true],
    ["Heartbeat", ago(now - x.lastBeat)],
    ["Înregistrări azi", num(x.records)],
  ];
  return (
    <section aria-label="Agent și sincronizare" className={`${CARD} ${mobile ? "p-4" : "p-5"}`}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-[14px] font-semibold">Agent și sincronizare</h3>
        <StatusBadge x={x} />
      </div>
      <dl className="divide-y divide-[#1C2336] text-[12px]">
        {rows.map(([k, v, mono]) => (
          <div key={k} className="flex items-center justify-between gap-3 py-1.5">
            <dt className="shrink-0 text-[#808999]">{k}</dt>
            <dd className="truncate text-right font-medium text-[#E1E7EF]" style={mono ? { fontFamily: MONO, fontSize: 11.5 } : undefined}>
              {v}
            </dd>
          </div>
        ))}
      </dl>
      {l.type === "fizic" && (
        <p className="mt-2 text-[11px] leading-snug text-[#808999]">
          Doar citire: agentul nu scrie niciodată înapoi în {l.source === "Access" ? "baza Access" : "DorSoft"}. Fără date de pacient — doar SKU,
          cantitate, preț, oră.
        </p>
      )}
      <div className="mt-3 space-y-2">
        <SyncProgress l={l} x={x} />
        <Btn onClick={() => sync(l.id)} disabled={x.sync !== null} variant={x.status === "warning" ? "primary" : "outline"} className="w-full">
          <RefreshCw size={13} className={x.sync !== null ? "zof-spin" : ""} aria-hidden />
          {x.sync !== null ? "Se sincronizează" : "Sincronizează acum"}
        </Btn>
      </div>
    </section>
  );
}

export default function Locatie() {
  const { loc, go, mobile, now, reduced } = useZof();
  const l = locById(loc);
  const f = useLocFigures(l);
  const hero = useTween(f.x.rev, !reduced);
  const Icon = l.type === "online" ? Globe : MapPin;
  const warn = f.x.status === "warning";

  const head = (
    <div className={`${CARD} ${mobile ? "p-4" : "flex items-center gap-5 p-5"}`}>
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span
          className="flex size-11 shrink-0 items-center justify-center rounded-xl"
          style={{ background: l.type === "online" ? "rgba(124,58,237,0.14)" : "rgba(37,99,235,0.14)" }}
        >
          <Icon size={20} className={l.type === "online" ? "text-[#A78BFA]" : "text-[#60A5FA]"} aria-hidden />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className={`${mobile ? "text-[20px]" : "text-[22px]"} font-bold leading-tight tracking-[-0.02em]`}>{l.name}</h1>
            <StatusBadge x={f.x} />
          </div>
          <p className="mt-0.5 text-[12.5px] text-[#808999]">
            {l.type === "online" ? "Magazin online · Shopify" : `${l.city} · magazin fizic · ${l.source}`}
          </p>
          <p className={`mt-1 flex items-center gap-1.5 text-[12px] ${warn ? "text-[#FBBF24]" : "text-[#808999]"}`}>
            <LiveDot still={reduced} color={warn ? C.amber : C.green} size={7} />
            {warn ? `agentul tace de ${ago(now - f.x.lastBeat).replace("acum ", "")} · datele așteaptă local` : `sincronizat ${ago(now - f.x.lastSync)}`}
          </p>
        </div>
      </div>
      <div className={mobile ? "mt-4" : "shrink-0 text-right"}>
        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[#808999]">Vânzări azi</p>
        <p className={`${mobile ? "text-[30px]" : "text-[32px]"} mt-1 font-bold leading-none tracking-[-0.02em] tabular-nums`}>{ron(hero)}</p>
        <p className={`mt-1.5 flex items-center gap-2 text-[12px] text-[#808999] ${mobile ? "" : "justify-end"}`}>
          <Trend value={f.trendToday} className="font-semibold" /> vs aceeași zi, săpt. trecută
        </p>
      </div>
    </div>
  );

  const stats = (
    <div className={`grid gap-3 ${mobile ? "grid-cols-2" : "grid-cols-4"}`}>
      <StatCard title="Bonuri azi" value={num(f.x.receipts)} icon={Receipt} tint={C.blue} sub={`${num(f.x.units)} produse`} />
      <StatCard title="Bon mediu" value={ron(f.avg)} icon={ShoppingBag} tint={C.violet} sub="azi" />
      <StatCard title="30 de zile" value={ronCompact(f.d30)} icon={TrendingUp} tint={C.green} trend={f.trend30} />
      <StatCard
        title="Stoc în magazin"
        value={l.type === "online" ? "din rețea" : ronCompact(l.stockValue)}
        icon={Glasses}
        tint={C.amber}
        sub={l.type === "online" ? "vinde din stocul magazinelor" : `${num(l.stockUnits)} buc`}
      />
    </div>
  );

  return (
    <div className="zof-in space-y-4">
      <div className={`flex ${mobile ? "flex-col gap-3" : "items-center gap-3"}`}>
        <Btn variant="ghost" onClick={() => go("locatii")} className="-ml-2 self-start">
          <ArrowLeft size={15} aria-hidden /> Toate locațiile
        </Btn>
        <div className="min-w-0 flex-1">
          <Chips />
        </div>
      </div>
      {head}
      {stats}
      {mobile ? (
        <>
          <HourlyCard l={l} />
          <PayCard l={l} pay={f.pay} />
          <Receipts l={l} />
          <AgentCard l={l} />
          <TopHere l={l} />
        </>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <HourlyCard l={l} />
            </div>
            <PayCard l={l} pay={f.pay} />
          </div>
          <div className="grid grid-cols-3 items-start gap-4">
            <Receipts l={l} />
            <TopHere l={l} />
            <AgentCard l={l} />
          </div>
        </>
      )}
    </div>
  );
}
