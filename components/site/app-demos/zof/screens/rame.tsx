"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Download, Glasses, MapPin, Package, Search, X } from "lucide-react";
import { Sparkline, num, series } from "../../kit";
import {
  CATEGORIES,
  PHYSICAL,
  PRODUCTS,
  STOCK,
  stockLevel,
  stockTotal,
  type Category,
  type Product,
} from "../data";
import { useZof } from "../store";
import { Btn, C, CARD, MONO, PageHeader, Segmented, ron, ronCompact } from "../ui";
import { TrendTag } from "./dashboard";

/* ============================================================
   Rame și stoc: catalogul, cu stocul fiecărui produs în fiecare
   magazin. Caută o dată, vezi unde e marfa în toată rețeaua.
   ============================================================ */

type Status = "toate" | "critic" | "epuizat";
type Sort = "vanzari" | "stoc" | "pret";

const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");

const CAT_LABEL: Record<Category, string> = {
  rame: "Rame",
  soare: "Ochelari de soare",
  lentile: "Lentile",
  contact: "Lentile de contact",
  accesorii: "Accesorii",
};

function cellStyle(q: number) {
  const lv = stockLevel(q);
  if (lv === "out") return { color: C.redText, background: "rgba(239,68,68,0.12)" };
  if (lv === "low") return { color: C.amberText, background: "rgba(245,158,11,0.12)" };
  return { color: "#C7D2E0", background: `rgba(37,99,235,${Math.min(0.34, 0.06 + q / 90).toFixed(3)})` };
}

function Cell({ q, name, small }: { q: number; name: string; small?: boolean }) {
  return (
    <span
      className={`flex items-center justify-center rounded-md font-semibold tabular-nums ${small ? "h-6 text-[11px]" : "h-7 text-[12px]"}`}
      style={cellStyle(q)}
      title={`${name}: ${q} buc`}
    >
      {q}
    </span>
  );
}

/** Detaliul unui produs: unde e, cât, cât se vinde. */
function Detail({ p }: { p: Product }) {
  const { mobile, notify } = useZof();
  const tot = stockTotal(p);
  const max = Math.max(...p.stock, 1);
  const where = PHYSICAL.map((l, i) => ({ l, q: p.stock[i] })).sort((a, b) => b.q - a.q);
  const trend = useMemo(() => series(30, { seed: p.sku.length * 31 + p.price, start: 10, drift: 0.01, noise: 0.5 }), [p]);
  const margin = ((p.price - p.cost) / p.price) * 100;
  const empty = where.filter((w) => w.q === 0).map((w) => w.l.name);
  return (
    <div className={`zof-fade grid gap-4 ${mobile ? "grid-cols-1 pt-3" : "grid-cols-[1.25fr_1fr] p-4 pt-1"}`}>
      <div>
        <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.07em] text-[#808999]">Stoc pe locații · {tot} buc</p>
        <ul className="space-y-1.5">
          {where.map(({ l, q }) => (
            <li key={l.id} className="flex items-center gap-2 text-[12px]">
              <MapPin size={12} className="shrink-0 text-[#60A5FA]" aria-hidden />
              <span className="w-[112px] shrink-0 truncate text-[#A3ACBB]">{l.name}</span>
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#131C34]" aria-hidden>
                <span
                  className="block h-full rounded-full"
                  style={{ width: `${(q / max) * 100}%`, background: q === 0 ? C.red : q <= 2 ? C.amber : C.blue }}
                />
              </span>
              <span className="w-12 text-right font-semibold tabular-nums" style={{ color: q === 0 ? C.redText : q <= 2 ? C.amberText : C.fg }}>
                {q} buc
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className="space-y-3">
        <dl className="grid grid-cols-3 gap-2 text-[12px]">
          <div className="rounded-lg bg-[#0F1729] p-2.5">
            <dt className="text-[10.5px] text-[#808999]">Preț vânzare</dt>
            <dd className="mt-0.5 font-bold tabular-nums">{ron(p.price)}</dd>
          </div>
          <div className="rounded-lg bg-[#0F1729] p-2.5">
            <dt className="text-[10.5px] text-[#808999]">Preț achiziție</dt>
            <dd className="mt-0.5 font-bold tabular-nums">{ron(p.cost)}</dd>
          </div>
          <div className="rounded-lg bg-[#0F1729] p-2.5">
            <dt className="text-[10.5px] text-[#808999]">Marjă</dt>
            <dd className="mt-0.5 font-bold tabular-nums text-[#34D399]">{margin.toFixed(0)}%</dd>
          </div>
        </dl>
        <div className="rounded-lg bg-[#0F1729] p-2.5">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-[#808999]">Vânzări în rețea · 30 de zile</span>
            <span className="font-semibold tabular-nums">
              {num(p.sold30 * 3)} buc · {ronCompact(p.sold30 * 3 * p.price)}
            </span>
          </div>
          <div className="mt-1.5">
            <Sparkline values={trend} color={C.blue} height={34} />
          </div>
        </div>
        <p className="text-[11.5px] leading-snug text-[#808999]">
          {empty.length
            ? `Lipsește din ${empty.join(", ")}. Clientul de acolo îl poate primi din ${where[0].l.name} (${where[0].q} buc).`
            : `În stoc în toate cele 8 magazine. Cele mai multe bucăți: ${where[0].l.name} (${where[0].q}).`}
        </p>
        <Btn
          size="xs"
          onClick={() => notify("În demo, fișa produsului nu se descarcă. În aplicația reală pleacă în PDF, cu stocul pe locații.")}
        >
          <Download size={12} aria-hidden /> Fișă produs (PDF)
        </Btn>
      </div>
    </div>
  );
}

export default function Rame() {
  const { mobile, notify } = useZof();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<Category | "toate">("toate");
  const [status, setStatus] = useState<Status>("toate");
  const [sort, setSort] = useState<Sort>("vanzari");
  const [open, setOpen] = useState<string | null>("RB3025-001");

  const list = useMemo(() => {
    const f = fold(q.trim());
    let xs = PRODUCTS.filter((p) => (cat === "toate" || p.category === cat) && (!f || fold(`${p.sku} ${p.brand} ${p.name}`).includes(f)));
    if (status === "critic") xs = xs.filter((p) => p.stock.some((s) => s > 0 && s <= 2));
    if (status === "epuizat") xs = xs.filter((p) => p.stock.some((s) => s === 0));
    return [...xs].sort((a, b) =>
      sort === "stoc" ? stockTotal(b) - stockTotal(a) : sort === "pret" ? b.price - a.price : b.sold30 * b.price - a.sold30 * a.price
    );
  }, [q, cat, status, sort]);

  const search = (
    <div className="relative min-w-0 flex-1">
      <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#808999]" aria-hidden />
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Caută SKU, brand, model… (ex. aviator)"
        aria-label="Caută produs în toate magazinele"
        className="h-9 w-full rounded-lg border border-[#1C2336] bg-[#0F1729] pl-9 pr-8 text-[13px] text-[#E1E7EF] placeholder:text-[#808999] focus:border-[#2563EB]"
      />
      {q && (
        <button
          type="button"
          onClick={() => setQ("")}
          aria-label="Șterge căutarea"
          className="absolute right-1.5 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-[#808999] hover:text-[#E1E7EF]"
        >
          <X size={13} aria-hidden />
        </button>
      )}
    </div>
  );

  const statusSeg = (
    <Segmented
      small={mobile}
      full={mobile}
      label="Stare stoc"
      options={[
        { id: "toate", label: "Toate" },
        { id: "critic", label: "Stoc critic" },
        { id: "epuizat", label: "Epuizat undeva" },
      ]}
      value={status}
      onChange={setStatus}
    />
  );

  const cats = (
    <div role="group" aria-label="Categorie" className={`zof-noscroll flex gap-1.5 overflow-x-auto ${mobile ? "-mx-4 px-4" : ""}`}>
      {CATEGORIES.map((c) => {
        const on = c.id === cat;
        return (
          <button
            key={c.id}
            type="button"
            aria-pressed={on}
            onClick={() => setCat(c.id)}
            className={`shrink-0 rounded-full border px-3 py-1 text-[12px] font-medium transition-colors ${
              on ? "border-[#2563EB] bg-[#2563EB]/15 text-[#93C5FD]" : "border-[#1C2336] text-[#A3ACBB] hover:border-[#283149] hover:text-[#E1E7EF]"
            }`}
          >
            {c.label}
          </button>
        );
      })}
    </div>
  );

  const empty = (
    <div className="px-6 py-12 text-center">
      <Package size={28} className="mx-auto text-[#808999]/50" aria-hidden />
      <p className="mt-2 text-[13.5px] font-medium">Niciun produs nu se potrivește{q ? ` cu „${q}”` : ""}.</p>
      <p className="mt-1 text-[12px] text-[#808999]">Caută după brand, model sau SKU, ori scoate filtrele.</p>
      <Btn
        className="mt-3"
        onClick={() => {
          setQ("");
          setCat("toate");
          setStatus("toate");
        }}
      >
        Arată tot catalogul
      </Btn>
    </div>
  );

  const header = (
    <PageHeader
      mobile={mobile}
      title="Rame și stoc"
      subtitle={`${num(STOCK.catalog)} produse în catalog · stoc la zi în 8 magazine`}
      actions={
        !mobile && (
          <Btn onClick={() => notify("În demo, exportul e oprit. În aplicația reală, stocul pleacă în Excel, cu o coloană pe fiecare magazin.")}>
            <Download size={13} aria-hidden /> Export stoc
          </Btn>
        )
      }
    />
  );

  const kpis = [
    { k: "Bucăți în stoc", v: num(STOCK.units) },
    { k: "Valoare stoc", v: ronCompact(STOCK.value) },
    { k: "Stoc critic", v: `${STOCK.critical} produse`, c: C.amberText },
    { k: "Epuizate", v: `${STOCK.outOfStock} produse`, c: C.redText },
  ];

  if (mobile)
    return (
      <div className="zof-in space-y-3">
        {header}
        <div className="grid grid-cols-2 gap-2">
          {kpis.map((x) => (
            <div key={x.k} className={`${CARD} px-3 py-2.5`}>
              <p className="text-[10.5px] text-[#808999]">{x.k}</p>
              <p className="text-[15px] font-bold tabular-nums" style={{ color: x.c }}>
                {x.v}
              </p>
            </div>
          ))}
        </div>
        {search}
        {cats}
        {statusSeg}
        <p className="text-[11.5px] text-[#808999]">
          {list.length} produse · atinge un produs ca să vezi unde e
        </p>
        {list.length === 0 ? (
          <div className={CARD}>{empty}</div>
        ) : (
          <ul className="space-y-2">
            {list.map((p) => {
              const on = open === p.sku;
              return (
                <li key={p.sku} className={`${CARD} p-3`}>
                  <button
                    type="button"
                    onClick={() => setOpen(on ? null : p.sku)}
                    aria-expanded={on}
                    className="block w-full text-left"
                  >
                    <span className="flex items-start gap-3">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[#131C34]/70">
                        <Glasses size={17} className="text-[#808999]" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-semibold">
                          {p.brand} {p.name}
                        </span>
                        <span className="block truncate text-[10.5px] text-[#808999]">
                          <span style={{ fontFamily: MONO }}>{p.sku}</span> · {CAT_LABEL[p.category]}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block text-[13px] font-bold tabular-nums">{ron(p.price)}</span>
                        <span className="block text-[10.5px] text-[#808999]">{stockTotal(p)} buc total</span>
                      </span>
                    </span>
                    <span className="mt-2.5 grid grid-cols-8 gap-1">
                      {PHYSICAL.map((l, i) => (
                        <span key={l.id} className="text-center">
                          <span className="mb-0.5 block text-[9px] font-medium text-[#808999]">{l.code}</span>
                          <Cell q={p.stock[i]} name={l.name} small />
                        </span>
                      ))}
                    </span>
                    <span className="mt-2 flex items-center justify-center text-[#808999]">
                      <ChevronDown size={14} className={`transition-transform ${on ? "rotate-180" : ""}`} aria-hidden />
                    </span>
                  </button>
                  {on && <Detail p={p} />}
                </li>
              );
            })}
          </ul>
        )}
        <Legend8 />
      </div>
    );

  return (
    <div className="zof-in space-y-4">
      {header}
      <div className="grid grid-cols-4 gap-3">
        {kpis.map((x) => (
          <div key={x.k} className={`${CARD} px-4 py-3`}>
            <p className="text-[11px] text-[#808999]">{x.k}</p>
            <p className="mt-0.5 text-[17px] font-bold tabular-nums" style={{ color: x.c }}>
              {x.v}
            </p>
          </div>
        ))}
      </div>

      <div className={`${CARD} space-y-3 p-3`}>
        <div className="flex items-center gap-2">
          {search}
          {statusSeg}
          <label className="flex items-center gap-2 text-[12px] text-[#808999]">
            Sortare
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
              className="h-9 rounded-lg border border-[#1C2336] bg-[#0F1729] px-2 text-[12.5px] text-[#E1E7EF]"
            >
              <option value="vanzari">Venit (30 zile)</option>
              <option value="stoc">Stoc total</option>
              <option value="pret">Preț</option>
            </select>
          </label>
        </div>
        {cats}
      </div>

      <section aria-label="Stoc pe locații" className={CARD}>
        <div className="sticky top-0 z-10 grid items-end gap-1.5 rounded-t-xl border-b border-[#1C2336] bg-[#0A101F] px-4 py-2.5 text-[10.5px] font-semibold uppercase tracking-[0.05em] text-[#808999] [grid-template-columns:minmax(0,1fr)_84px_repeat(8,44px)_52px_92px]">
          <span>Produs</span>
          <span className="text-right">Preț</span>
          {PHYSICAL.map((l) => (
            <span key={l.id} className="text-center" title={l.name}>
              <abbr title={l.name} className="no-underline">
                {l.code}
              </abbr>
            </span>
          ))}
          <span className="text-right">Total</span>
          <span className="text-right">30 zile</span>
        </div>
        {list.length === 0 ? (
          empty
        ) : (
          <ul>
            {list.map((p) => {
              const on = open === p.sku;
              return (
                <li key={p.sku} className={`border-b border-[#1C2336] last:rounded-b-xl last:border-0 ${on ? "bg-[#0E1629]" : ""}`}>
                  <button
                    type="button"
                    onClick={() => setOpen(on ? null : p.sku)}
                    aria-expanded={on}
                    className="grid w-full items-center gap-1.5 px-4 py-2 text-left transition-colors hover:bg-[#131C34]/40 [grid-template-columns:minmax(0,1fr)_84px_repeat(8,44px)_52px_92px]"
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      <ChevronDown size={13} className={`shrink-0 text-[#808999] transition-transform ${on ? "rotate-180" : "-rotate-90"}`} aria-hidden />
                      <span className="min-w-0">
                        <span className="block truncate text-[12.5px] font-semibold">
                          {p.brand} {p.name}
                        </span>
                        <span className="block truncate text-[10.5px] text-[#808999]">
                          <span style={{ fontFamily: MONO }}>{p.sku}</span> · {CAT_LABEL[p.category]}
                        </span>
                      </span>
                    </span>
                    <span className="text-right text-[12px] font-semibold tabular-nums">{ron(p.price)}</span>
                    {PHYSICAL.map((l, i) => (
                      <Cell key={l.id} q={p.stock[i]} name={l.name} />
                    ))}
                    <span className="text-right text-[12.5px] font-bold tabular-nums">{stockTotal(p)}</span>
                    <span className="text-right">
                      <span className="block text-[11.5px] font-semibold tabular-nums">{num(p.sold30 * 3)} buc</span>
                      <TrendTag trend={p.trend} />
                    </span>
                  </button>
                  {on && <Detail p={p} />}
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <Legend8 />
    </div>
  );
}

function Legend8() {
  return (
    <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[#808999]">
      {PHYSICAL.map((l) => (
        <span key={l.id}>
          <b className="font-semibold text-[#A3ACBB]">{l.code}</b> {l.name}
        </span>
      ))}
      <span className="flex items-center gap-1.5">
        <span className="size-2.5 rounded-sm" style={{ background: "rgba(245,158,11,0.5)" }} aria-hidden /> 1–2 buc
      </span>
      <span className="flex items-center gap-1.5">
        <span className="size-2.5 rounded-sm" style={{ background: "rgba(239,68,68,0.5)" }} aria-hidden /> epuizat
      </span>
    </p>
  );
}
