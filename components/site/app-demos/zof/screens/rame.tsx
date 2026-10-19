"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Download } from "lucide-react";
import { Sparkline, num, series } from "../../kit";
import { CATEGORIES, PHYSICAL, PRODUCTS, STOCK, stockLevel, stockTotal, type Category, type Product } from "../data";
import { useZof } from "../store";
import { Btn, C, CARD, MONO, Meter, PageHeader, SearchField, Segmented, SelectField, TrendArrow, plural, ron, ronCompact } from "../ui";

/* ============================================================
   Produse: catalogul, cu stocul fiecărui produs în fiecare
   magazin. O căutare arată unde e marfa în toată rețeaua.
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

const COLS = "[grid-template-columns:minmax(0,1fr)_88px_repeat(8,44px)_52px_96px]";

/** Cifra stocului: simplă; nuanță doar la 1–2 buc (critic) și la 0 (epuizat). */
function Cell({ q, small }: { q: number; small?: boolean }) {
  const lv = stockLevel(q);
  const tone =
    lv === "out"
      ? "bg-(--z-crit-soft) font-medium text-(--z-crit-text)"
      : lv === "low"
        ? "bg-(--z-warn-soft) font-medium text-(--z-warn)"
        : "text-(--z-fg)";
  return (
    <span className={`flex items-center justify-center rounded-md tabular-nums ${small ? "h-6 text-[12px]" : "h-7 text-[13px]"} ${tone}`}>
      {q}
    </span>
  );
}

/** Detaliul unui produs: stocul pe magazine, prețurile, vânzările. */
function Detail({ p }: { p: Product }) {
  const { mobile, notify } = useZof();
  const tot = stockTotal(p);
  const max = Math.max(...p.stock, 1);
  const where = PHYSICAL.map((l, i) => ({ l, q: p.stock[i] })).sort((a, b) => b.q - a.q);
  const trend = useMemo(() => series(30, { seed: p.sku.length * 31 + p.price, start: 10, drift: 0.01, noise: 0.5 }), [p]);
  const margin = ((p.price - p.cost) / p.price) * 100;
  const sold = p.sold30 * 3;
  return (
    <div className={`zof-fade grid ${mobile ? "grid-cols-1 gap-5 pt-4" : "grid-cols-[1.2fr_1fr] gap-8 px-4 pb-5 pt-2"}`}>
      <div>
        <p className="mb-2.5 text-[12px] font-medium text-(--z-fg-2)">Stoc pe locații · {tot} buc</p>
        <ul className="space-y-1.5">
          {where.map(({ l, q }) => (
            <li key={l.id} className="grid grid-cols-[120px_minmax(0,1fr)_48px] items-center gap-3 text-[13px]">
              <span className="truncate text-(--z-fg-2)">{l.name}</span>
              <Meter value={(q / max) * 100} color={q === 0 ? C.crit : q <= 2 ? C.warnDot : C.primary} h={6} />
              <span
                className={`text-right tabular-nums ${q === 0 ? "font-medium text-(--z-crit-text)" : q <= 2 ? "font-medium text-(--z-warn)" : ""}`}
              >
                {q} buc
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className="space-y-4">
        <dl className="grid grid-cols-3 gap-3">
          {(
            [
              ["Preț vânzare", ron(p.price)],
              ["Preț achiziție", ron(p.cost)],
              ["Marjă", `${margin.toFixed(0)}%`],
            ] as const
          ).map(([k, v]) => (
            <div key={k} className="min-w-0">
              <dt className="text-[12px] text-(--z-fg-3)">{k}</dt>
              <dd className="mt-0.5 truncate text-[14px] font-semibold tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="border-t border-(--z-border) pt-3">
          <div className="flex items-baseline justify-between gap-3 text-[12px]">
            <span className="text-(--z-fg-3)">Vânzări, 30 de zile</span>
            <span className="font-medium tabular-nums">
              {num(sold)} buc · {ronCompact(sold * p.price)}
            </span>
          </div>
          <div className="mt-2 text-(--z-primary)">
            <Sparkline values={trend} color="currentColor" height={36} fill={false} />
          </div>
        </div>
        <Btn size="xs" onClick={() => notify("Fișa PDF e oprită în demo.")}>
          <Download size={13} aria-hidden /> Fișă produs (PDF)
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

  const filtered = q.trim() !== "" || cat !== "toate" || status !== "toate";
  const clear = () => {
    setQ("");
    setCat("toate");
    setStatus("toate");
  };
  const count = filtered ? plural(list.length, "produs", "produse") : `Afișate ${list.length} din ${num(STOCK.catalog)} de produse`;

  const search = <SearchField value={q} onChange={setQ} placeholder="Caută după SKU, brand sau model" label="Caută produs în toate magazinele" />;

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
            className={`h-7 shrink-0 rounded-full border px-3 text-[12px] font-medium transition-colors duration-150 ${
              on
                ? "border-(--z-primary) bg-(--z-primary-soft) text-(--z-primary-text)"
                : "border-(--z-border-strong) text-(--z-fg-2) hover:bg-(--z-hover) hover:text-(--z-fg)"
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
      <p className="text-[14px] font-medium">{q.trim() ? `Niciun produs pentru „${q.trim()}”` : "Niciun produs pentru filtrele alese"}</p>
      <Btn className="mt-3" onClick={clear}>
        Șterge filtrele
      </Btn>
    </div>
  );

  const header = (
    <PageHeader
      mobile={mobile}
      title="Produse"
      subtitle={`${num(STOCK.catalog)} de produse în catalog`}
      actions={
        !mobile && (
          <Btn onClick={() => notify("Exportul e oprit în demo.")}>
            <Download size={14} aria-hidden /> Export stoc
          </Btn>
        )
      }
    />
  );

  if (mobile)
    return (
      <div className="space-y-3">
        {header}
        {search}
        {cats}
        {statusSeg}
        <p className="pt-1 text-[12px] tabular-nums text-(--z-fg-2)">{count}</p>
        {list.length === 0 ? (
          <div className={CARD}>{empty}</div>
        ) : (
          <ul className={`${CARD} divide-y divide-(--z-border)`}>
            {list.map((p) => {
              const on = open === p.sku;
              return (
                <li key={p.sku} className="px-3.5 py-3">
                  <button
                    type="button"
                    onClick={() => setOpen(on ? null : p.sku)}
                    aria-expanded={on}
                    aria-label={`${p.brand} ${p.name}, ${ron(p.price)}, ${stockTotal(p)} buc în stoc`}
                    className="block w-full text-left"
                  >
                    <span className="flex items-start gap-3">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-medium">
                          {p.brand} {p.name}
                        </span>
                        <span className="mt-0.5 block truncate text-[12px] text-(--z-fg-3)">
                          <span style={{ fontFamily: MONO, fontSize: 11.5 }}>{p.sku}</span> · {CAT_LABEL[p.category]}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block text-[14px] font-semibold tabular-nums">{ron(p.price)}</span>
                        <span className="block text-[12px] tabular-nums text-(--z-fg-3)">{stockTotal(p)} buc</span>
                      </span>
                      <ChevronDown
                        size={16}
                        className={`mt-0.5 shrink-0 text-(--z-fg-3) transition-transform duration-150 ${on ? "rotate-180" : ""}`}
                        aria-hidden
                      />
                    </span>
                    <span className="mt-2.5 grid grid-cols-8 gap-1" aria-hidden>
                      {PHYSICAL.map((l, i) => (
                        <span key={l.id} className="text-center">
                          <span className="mb-0.5 block text-[10px] font-medium text-(--z-fg-3)">{l.code}</span>
                          <Cell q={p.stock[i]} small />
                        </span>
                      ))}
                    </span>
                  </button>
                  {on && <Detail p={p} />}
                </li>
              );
            })}
          </ul>
        )}
        <CodeLegend />
      </div>
    );

  return (
    <div className="space-y-4">
      {header}
      <div className={`${CARD} space-y-3 p-3`}>
        <div className="flex items-center gap-2">
          {search}
          {statusSeg}
          <label className="flex items-center gap-2 text-[13px] text-(--z-fg-2)">
            Sortare
            <SelectField value={sort} onChange={(v) => setSort(v as Sort)} label="Sortare" className="w-[164px]">
              <option value="vanzari">Venit, 30 de zile</option>
              <option value="stoc">Stoc total</option>
              <option value="pret">Preț</option>
            </SelectField>
          </label>
        </div>
        {cats}
      </div>

      <section aria-label="Stoc pe locații" className={CARD}>
        <div
          className={`sticky top-0 z-10 grid items-center gap-1.5 rounded-t-xl border-b border-(--z-border) bg-(--z-surface-2) px-4 py-2.5 text-[12px] font-medium text-(--z-fg-3) ${COLS}`}
        >
          <span className="pl-[25px]">Produs</span>
          <span className="text-right">Preț</span>
          {PHYSICAL.map((l) => (
            <span key={l.id} className="text-center">
              <abbr title={l.name} className="no-underline">
                {l.code}
              </abbr>
            </span>
          ))}
          <span className="text-right">Total</span>
          <span className="pr-[18px] text-right">30 zile</span>
        </div>
        {list.length === 0 ? (
          empty
        ) : (
          <ul>
            {list.map((p) => {
              const on = open === p.sku;
              return (
                <li key={p.sku} className={`border-b border-(--z-border) ${on ? "bg-(--z-surface-2)" : ""}`}>
                  <button
                    type="button"
                    onClick={() => setOpen(on ? null : p.sku)}
                    aria-expanded={on}
                    aria-label={`${p.brand} ${p.name}, ${ron(p.price)}, ${stockTotal(p)} buc în stoc`}
                    className={`grid w-full items-center gap-1.5 px-4 py-2 text-left transition-colors duration-150 hover:bg-(--z-hover) ${COLS}`}
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      <ChevronDown
                        size={15}
                        className={`shrink-0 text-(--z-fg-3) transition-transform duration-150 ${on ? "" : "-rotate-90"}`}
                        aria-hidden
                      />
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] font-medium">
                          {p.brand} {p.name}
                        </span>
                        <span className="block truncate text-[12px] text-(--z-fg-3)">
                          <span style={{ fontFamily: MONO, fontSize: 11.5 }}>{p.sku}</span> · {CAT_LABEL[p.category]}
                        </span>
                      </span>
                    </span>
                    <span className="text-right text-[13px] tabular-nums">{ron(p.price)}</span>
                    {PHYSICAL.map((l, i) => (
                      <Cell key={l.id} q={p.stock[i]} />
                    ))}
                    <span className="text-right text-[13px] font-semibold tabular-nums">{stockTotal(p)}</span>
                    <span className="flex items-center justify-end gap-1 text-[13px] tabular-nums">
                      {num(p.sold30 * 3)} buc
                      <span className="flex w-[14px] justify-end">
                        <TrendArrow trend={p.trend} />
                      </span>
                    </span>
                  </button>
                  {on && <Detail p={p} />}
                </li>
              );
            })}
          </ul>
        )}
        {list.length > 0 && (
          <p className="rounded-b-xl px-4 py-2.5 text-[12px] tabular-nums text-(--z-fg-3)">{count}</p>
        )}
      </section>
      <CodeLegend />
    </div>
  );
}

/** Codurile magazinelor din antetul matricei + cele două praguri de stoc. */
function CodeLegend() {
  return (
    <p className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] text-(--z-fg-2)">
      {PHYSICAL.map((l) => (
        <span key={l.id}>
          <b className="font-semibold text-(--z-fg)">{l.code}</b> {l.name}
        </span>
      ))}
      <span className="flex items-center gap-1.5">
        <span className="flex h-5 min-w-5 items-center justify-center rounded-md bg-(--z-warn-soft) px-1 text-[11px] font-medium text-(--z-warn)" aria-hidden>
          2
        </span>
        1–2 buc
      </span>
      <span className="flex items-center gap-1.5">
        <span className="flex h-5 min-w-5 items-center justify-center rounded-md bg-(--z-crit-soft) px-1 text-[11px] font-medium text-(--z-crit-text)" aria-hidden>
          0
        </span>
        epuizat
      </span>
    </p>
  );
}
