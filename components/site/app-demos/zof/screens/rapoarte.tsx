"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChartColumn,
  Download,
  FileSpreadsheet,
  FileText,
  Globe,
  LoaderCircle,
  MapPin,
  Package,
  ShoppingBag,
  TrendingUp,
} from "lucide-react";
import { num } from "../../kit";
import {
  AVG_RECEIPT,
  BRANDS,
  CATEGORY_SPLIT,
  LOCS,
  PAST,
  SHARE,
  daysAgo,
  monthly,
  rangeLabel,
  sumDays,
} from "../data";
import { totals, useZof } from "../store";
import { Btn, C, CARD, Columns, Legend, Meter, PageHeader, Segmented, StatStrip, Trend, ron, ronCompact, useTween } from "../ui";

/* ============================================================
   Rapoarte: cifrele financiare ale rețelei pe perioade lungi,
   plus cele șase rapoarte exportabile din aplicația reală.
   ============================================================ */

type RP = "30z" | "90z" | "12l";
const OPTIONS: { id: RP; label: string }[] = [
  { id: "30z", label: "30 zile" },
  { id: "90z", label: "90 zile" },
  { id: "12l", label: "12 luni" },
];
const GROW: Record<RP, number> = { "30z": 1.091, "90z": 1.097, "12l": 1.131 };
const MARG: Record<RP, number> = { "30z": 0.479, "90z": 0.476, "12l": 0.472 };
const PAST90 = sumDays(1, 89);

const REPORTS = [
  { id: "vanzari", title: "Raport vânzări", text: "Toate bonurile din perioadă, pe linii", icon: ShoppingBag },
  { id: "stoc", title: "Raport stoc", text: "Situația stocului în toate locațiile", icon: Package },
  { id: "produse", title: "Performanță produse", text: "Venit, bucăți vândute și stoc per produs", icon: ChartColumn },
  { id: "trenduri", title: "Analiză trenduri", text: "Produse în creștere, stabile, în scădere", icon: TrendingUp },
  { id: "online", title: "Raport online", text: "Comenzile din magazinul zof.ro", icon: Globe },
  { id: "locatii", title: "Performanță locații", text: "Comparație între magazine", icon: MapPin },
];
const FORMATS = [
  { id: "CSV", label: "CSV", icon: Download, note: "separator „;”, se deschide direct în Excel" },
  { id: "XLSX", label: "Excel", icon: FileSpreadsheet, note: "antet fixat și filtre" },
  { id: "PDF", label: "PDF", icon: FileText, note: "cu diacritice și sumar" },
] as const;

function ReportCard({ r }: { r: (typeof REPORTS)[number] }) {
  const { notify, reduced, mobile } = useZof();
  const [busy, setBusy] = useState<string | null>(null);
  const t = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(t.current), []);
  const run = (f: (typeof FORMATS)[number]) => {
    const done = () => {
      setBusy(null);
      notify(`În demo, exportul e oprit. În aplicația reală, „${r.title}” pleacă în ${f.label}: ${f.note}.`);
    };
    if (reduced) return done();
    setBusy(f.id);
    t.current = window.setTimeout(done, 700);
  };
  const buttons = (
    <div className="flex gap-2">
      {FORMATS.map((f) => (
        <Btn
          key={f.id}
          size={mobile ? "xs" : "sm"}
          onClick={() => run(f)}
          disabled={busy !== null}
          className="flex-1"
          label={`${r.title}, ${f.label}`}
        >
          {busy === f.id ? <LoaderCircle size={13} className="zof-spin" aria-hidden /> : <f.icon size={13} aria-hidden />}
          {f.label}
        </Btn>
      ))}
    </div>
  );
  if (mobile)
    return (
      <li className="p-3.5">
        <div className="mb-2.5 flex items-start gap-3">
          <span className="rounded-lg bg-[#2563EB]/10 p-2">
            <r.icon size={16} className="text-[#60A5FA]" aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="block text-[13.5px] font-semibold">{r.title}</span>
            <span className="block text-[11.5px] text-[#808999]">{r.text}</span>
          </span>
        </div>
        {buttons}
      </li>
    );
  return (
    <div className={`${CARD} flex flex-col p-5`}>
      <div className="mb-3 flex items-start justify-between">
        <span className="rounded-xl bg-[#2563EB]/10 p-2.5">
          <r.icon size={18} className="text-[#60A5FA]" aria-hidden />
        </span>
        <span className="rounded-full bg-[#131C34] px-2 py-0.5 text-[10px] font-semibold text-[#A3ACBB]">CSV / Excel / PDF</span>
      </div>
      <h3 className="text-[14px] font-semibold">{r.title}</h3>
      <p className="mb-4 mt-0.5 flex-1 text-[12px] text-[#808999]">{r.text}</p>
      {buttons}
    </div>
  );
}

export default function Rapoarte() {
  const { live, mobile, reduced } = useZof();
  const [p, setP] = useState<RP>("30z");
  const t = totals(live);
  const past = p === "30z" ? PAST["30z"] : p === "90z" ? PAST90 : PAST["12l"];
  const rev = past + t.rev;
  const prev = rev / GROW[p];
  const profit = rev * MARG[p];
  const receipts = Math.round(past / (AVG_RECEIPT * 1.01)) + t.receipts;
  const avg = rev / receipts;
  const heroRev = useTween(rev, !reduced);
  const range = p === "30z" ? rangeLabel(29) : p === "90z" ? rangeLabel(89) : `${daysAgo(364).toLocaleDateString("ro-RO", { month: "short", year: "numeric" })} – azi`;

  const m = useMemo(() => monthly(t.rev), [t.rev]);
  const stores = LOCS.map((l) => ({ l, v: past * SHARE[l.id] + live.locs[l.id].rev })).sort((a, b) => b.v - a.v);
  const maxStore = stores[0].v;

  const kpis = [
    { k: "Venit", v: ronCompact(heroRev), trend: (GROW[p] - 1) * 100, sub: `${ronCompact(prev)} perioada anterioară` },
    { k: "Profit estimat", v: ronCompact(profit), trend: (GROW[p] - 1) * 100 + 1.3, sub: "înainte de TVA, chirii, salarii", c: C.greenText },
    { k: "Marjă estimată", v: `${(MARG[p] * 100).toLocaleString("ro-RO", { maximumFractionDigits: 1 })}%`, trend: 0.8, sub: "pe produsele cu preț de achiziție" },
    { k: "Bon mediu", v: ron(avg), trend: 3.4, sub: `${num(receipts)} bonuri` },
  ];

  const yearTotal = m.values.reduce<number>((a, v) => a + (v ?? 0), 0);
  const doneMonths = m.values.slice(0, 11).map((v) => v ?? 0);
  const bestM = doneMonths.indexOf(Math.max(...doneMonths));
  const yearSummary = [
    { k: "Total 12 luni", v: ronCompact(yearTotal), sub: "luna curentă inclusă" },
    { k: "Cea mai bună lună", v: ronCompact(doneMonths[bestM]), sub: m.labels[bestM] },
    { k: "vs anul trecut", v: `+${((GROW["12l"] - 1) * 100).toLocaleString("ro-RO", { maximumFractionDigits: 1 })}%`, sub: ronCompact(yearTotal / GROW["12l"]), color: C.greenText },
  ];

  const brandMax = BRANDS[0].revenue;
  const scale = rev / (PAST["30z"] + t.rev);

  return (
    <div className="zof-in space-y-4">
      <PageHeader
        mobile={mobile}
        title="Rapoarte"
        subtitle={`Analiză financiară · toate locațiile · ${range}`}
        actions={<Segmented label="Perioada raportului" options={OPTIONS} value={p} onChange={setP} full={mobile} />}
      />

      <div className={`grid gap-3 ${mobile ? "grid-cols-2" : "grid-cols-4"}`}>
        {kpis.map((k) => (
          <div key={k.k} className={`${CARD} ${mobile ? "p-3.5" : "p-4"}`}>
            <p className="text-[11px] font-medium uppercase tracking-[0.07em] text-[#808999]">{k.k}</p>
            <p className={`${mobile ? "text-[17px]" : "text-[22px]"} mt-1.5 truncate font-bold leading-tight tabular-nums`} style={{ color: k.c }}>
              {k.v}
            </p>
            <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-[11px] text-[#808999]">
              <Trend value={k.trend} className="font-semibold" />
              {!mobile && <span className="truncate">{k.sub}</span>}
            </p>
          </div>
        ))}
      </div>

      <div className={`grid gap-4 ${mobile ? "grid-cols-1" : "grid-cols-3"}`}>
        <section aria-label="Venituri lunare" className={`${CARD} ${mobile ? "p-4" : "col-span-2 p-5"}`}>
          <div className="mb-3 flex items-start justify-between gap-2">
            <div>
              <h3 className="text-[14px] font-semibold">Venituri lunare</h3>
              <p className="mt-0.5 text-[11.5px] text-[#808999]">ultimele 12 luni, față de aceleași luni de anul trecut</p>
            </div>
            {!mobile && (
              <Legend
                items={[
                  { label: "ultimele 12 luni", color: C.blue },
                  { label: "anul anterior", color: C.compare },
                ]}
              />
            )}
          </div>
          <Columns
            name="Venituri lunare"
            values={m.values}
            compare={m.compare}
            labels={m.labels}
            height={mobile ? 150 : 222}
            fmt={ronCompact}
            compareName="anul anterior"
            current={11}
          />
          {mobile && (
            <div className="mt-2.5">
              <Legend
                items={[
                  { label: "ultimele 12 luni", color: C.blue },
                  { label: "anul anterior", color: C.compare },
                ]}
              />
            </div>
          )}
          <StatStrip items={yearSummary} small={mobile} />
        </section>

        <section aria-label="Vânzări per magazin" className={`${CARD} ${mobile ? "p-4" : "p-5"}`}>
          <div className="mb-3 flex items-baseline justify-between">
            <h3 className="text-[14px] font-semibold">Vânzări per magazin</h3>
            <span className="text-[10.5px] text-[#808999]">{OPTIONS.find((o) => o.id === p)!.label}</span>
          </div>
          <ul className="space-y-2.5">
            {stores.map(({ l, v }) => (
              <li key={l.id}>
                <div className="mb-1 flex items-center justify-between gap-2 text-[12px]">
                  <span className="flex min-w-0 items-center gap-1.5">
                    {l.type === "online" ? <Globe size={12} className="shrink-0 text-[#A78BFA]" aria-hidden /> : <MapPin size={12} className="shrink-0 text-[#60A5FA]" aria-hidden />}
                    <span className="truncate">{l.name}</span>
                  </span>
                  <span className="shrink-0 font-semibold tabular-nums">{ronCompact(v)}</span>
                </div>
                <Meter value={(v / maxStore) * 100} color={l.type === "online" ? C.violet : C.primary} h={6} />
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className={`grid gap-4 ${mobile ? "grid-cols-1" : "grid-cols-2"}`}>
        <section aria-label="Branduri" className={`${CARD} ${mobile ? "p-4" : "p-5"}`}>
          <div className="mb-2 flex items-baseline justify-between">
            <h3 className="text-[14px] font-semibold">Analiză branduri — venituri</h3>
            <span className="text-[10.5px] text-[#808999]">trend vs perioada anterioară</span>
          </div>
          <ul>
            {BRANDS.map((b, i) => (
              <li key={b.name} className="flex items-center gap-3 border-t border-[#1C2336] py-2 first:border-0">
                <span className="w-5 text-right text-[11px] font-bold text-[#808999]">#{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-[12.5px] font-semibold">{b.name}</span>
                    <span className="shrink-0 text-[12.5px] font-bold tabular-nums">{ronCompact(b.revenue * scale)}</span>
                  </span>
                  <span className="mt-1 flex items-center gap-2">
                    <Meter value={(b.revenue / brandMax) * 100} color={C.blue} h={4} />
                    <span className="w-14 shrink-0 text-right text-[10.5px]">
                      <Trend value={b.trend} />
                    </span>
                  </span>
                  <span className="mt-0.5 block text-[10.5px] text-[#808999]">
                    {num(b.products)} produse · {num(b.units * scale)} vândute
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section aria-label="Categorii" className={`${CARD} ${mobile ? "p-4" : "p-5"}`}>
          <div className="mb-2 flex items-baseline justify-between">
            <h3 className="text-[14px] font-semibold">Analiză categorii</h3>
            <span className="text-[10.5px] text-[#808999]">cota din venit</span>
          </div>
          <ul className="space-y-3 pt-1">
            {CATEGORY_SPLIT.map((c) => (
              <li key={c.name}>
                <div className="mb-1 flex items-center justify-between gap-2 text-[12.5px]">
                  <span className="truncate text-[#E1E7EF]">{c.name}</span>
                  <span className="shrink-0 tabular-nums">
                    <b className="font-bold">{ronCompact(rev * c.share)}</b>
                    <span className="ml-2 text-[11px] text-[#808999]">{Math.round(c.share * 100)}%</span>
                  </span>
                </div>
                <Meter value={(c.share / CATEGORY_SPLIT[0].share) * 100} color={C.blue} h={6} />
              </li>
            ))}
          </ul>
          <p className="mt-4 rounded-lg bg-[#0F1729] px-3 py-2.5 text-[11.5px] leading-snug text-[#808999]">
            Categoria vine din gestiune: lentilele se vând în perechi, iar consultația și montajul rămân vânzări, fără stoc.
          </p>
        </section>
      </div>

      <div>
        <h2 className="mb-3 text-[14px] font-semibold">Exporturi</h2>
        {mobile ? (
          <ul className={`${CARD} divide-y divide-[#1C2336]`}>
            {REPORTS.map((r) => (
              <ReportCard key={r.id} r={r} />
            ))}
          </ul>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {REPORTS.map((r) => (
              <ReportCard key={r.id} r={r} />
            ))}
          </div>
        )}
        <p className="mt-3 text-[11px] text-[#808999]">
          Excel (.xlsx): numerele rămân numere, antetul e fixat și are filtre. CSV: separator „;”, UTF-8 — se deschide direct în Excel. PDF: cu
          diacritice.
        </p>
      </div>
    </div>
  );
}
