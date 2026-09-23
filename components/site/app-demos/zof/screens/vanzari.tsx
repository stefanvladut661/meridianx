"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Download, Globe, MapPin, Pause, Play, Search, ShoppingBag, X } from "lucide-react";
import { num } from "../../kit";
import { LOCS, locById, productBySku, type Sale } from "../data";
import { totals, useZof } from "../store";
import { Btn, C, CARD, LiveDot, MONO, PageHeader, Segmented, clock, ron, useTween } from "../ui";

/* ============================================================
   Jurnalul de vânzări: fiecare bon din fiecare magazin, în ordinea
   în care ajunge la server. Filtre reale, bonul se deschide pe linii.
   ============================================================ */

const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");

const PAY_LABEL = { card: "Card", numerar: "Numerar", online: "Online" } as const;
const PAY_COLOR = { card: C.card, numerar: C.cash, online: C.online } as const;

function Lines({ s }: { s: Sale }) {
  const pair = s.items.some((it) => it.qty === 2 && productBySku(it.sku).category === "lentile");
  return (
    <div className="zof-fade px-4 pb-3 pt-1">
      <table className="w-full text-[11.5px]">
        <thead>
          <tr className="text-left text-[10px] uppercase tracking-[0.05em] text-[#808999]">
            <th className="py-1 font-semibold">SKU</th>
            <th className="py-1 font-semibold">Produs</th>
            <th className="py-1 text-right font-semibold">Cant.</th>
            <th className="py-1 text-right font-semibold">Preț</th>
            <th className="py-1 text-right font-semibold">Valoare</th>
          </tr>
        </thead>
        <tbody>
          {s.items.map((it) => {
            const p = productBySku(it.sku);
            return (
              <tr key={it.sku} className="border-t border-[#1C2336]">
                <td className="py-1.5 pr-2 text-[#A3ACBB]" style={{ fontFamily: MONO, fontSize: 11 }}>
                  {it.sku}
                </td>
                <td className="py-1.5 pr-2">
                  {p.brand} {p.name}
                </td>
                <td className="py-1.5 text-right tabular-nums">{it.qty}</td>
                <td className="py-1.5 text-right tabular-nums">{ron(it.price)}</td>
                <td className="py-1.5 text-right font-semibold tabular-nums">{ron(it.qty * it.price)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-1.5 text-[10.5px] text-[#808999]">
        {pair
          ? "Lentila stângă și dreapta, identice pe bon, sunt însumate pe o linie cu cantitate 2 — la fel ca în gestiune."
          : "Idempotent: dacă agentul retrimite bonul, serverul îl recunoaște și nu-l mai numără o dată."}{" "}
        Fără date de pacient.
      </p>
    </div>
  );
}

export default function Vanzari() {
  const { live, mobile, now, reduced, paused, setPaused, notify } = useZof();
  const t = totals(live);
  const [q, setQ] = useState("");
  const [loc, setLoc] = useState("toate");
  const [channel, setChannel] = useState<"toate" | "fizic" | "online">("toate");
  const [pay, setPay] = useState<"toate" | "card" | "numerar">("toate");
  const [open, setOpen] = useState<string | null>(null);
  const hero = useTween(t.rev, !reduced);

  const list = useMemo(() => {
    const f = fold(q.trim());
    return live.sales.filter((s) => {
      if (loc !== "toate" && s.loc !== loc) return false;
      const l = locById(s.loc);
      if (channel !== "toate" && l.type !== channel) return false;
      if (pay !== "toate" && s.pay !== pay) return false;
      if (!f) return true;
      const hay = s.items.map((it) => {
        const p = productBySku(it.sku);
        return `${it.sku} ${p.brand} ${p.name}`;
      });
      return fold(`${s.receipt} ${l.name} ${hay.join(" ")}`).includes(f);
    });
  }, [live.sales, q, loc, channel, pay]);

  const shown = list.slice(0, 40);
  const sum = list.reduce((a, s) => a + s.value, 0);
  const zof = live.locs["zof-ro"];

  const stats = [
    { k: "Încasat azi", v: ron(hero), sub: "toate locațiile" },
    { k: "Bonuri azi", v: num(t.receipts), sub: `${num(t.units)} produse` },
    { k: "Bon mediu", v: ron(t.avg), sub: "azi" },
    { k: "Online · zof.ro", v: ron(zof.rev), sub: `${num(zof.receipts)} comenzi`, c: C.violetText },
  ];

  const clearAll = () => {
    setQ("");
    setLoc("toate");
    setChannel("toate");
    setPay("toate");
  };

  const pauseBtn = (
    <Btn onClick={() => setPaused(!paused)} disabled={reduced} className={mobile ? "flex-1" : ""}>
      {paused ? <Play size={13} aria-hidden /> : <Pause size={13} aria-hidden />}
      {paused ? "Reia fluxul" : "Pune pe pauză"}
    </Btn>
  );
  const exportBtn = (
    <Btn
      className={mobile ? "flex-1" : ""}
      onClick={() => notify("În demo, exportul e oprit. În aplicația reală, jurnalul pleacă în CSV sau Excel, cu filtrele aplicate.")}
    >
      <Download size={13} aria-hidden /> Export CSV
    </Btn>
  );

  const search = (
    <div className="relative min-w-0 flex-1">
      <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#808999]" aria-hidden />
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Caută produs, SKU, brand, bon…"
        aria-label="Caută în vânzări"
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

  const locSelect = (
    <select
      value={loc}
      onChange={(e) => setLoc(e.target.value)}
      aria-label="Locație"
      className={`h-9 rounded-lg border border-[#1C2336] bg-[#0F1729] px-2 text-[12.5px] text-[#E1E7EF] ${mobile ? "min-w-0 flex-1" : "w-[170px]"}`}
    >
      <option value="toate">Toate locațiile</option>
      {LOCS.map((l) => (
        <option key={l.id} value={l.id}>
          {l.name}
        </option>
      ))}
    </select>
  );

  const channelSeg = (
    <Segmented
      small={mobile}
      label="Canal"
      options={[
        { id: "toate", label: "Toate" },
        { id: "fizic", label: "Fizic" },
        { id: "online", label: "Online" },
      ]}
      value={channel}
      onChange={setChannel}
    />
  );
  const paySeg = (
    <Segmented
      small={mobile}
      label="Plată"
      options={[
        { id: "toate", label: "Orice plată" },
        { id: "card", label: "Card" },
        { id: "numerar", label: "Numerar" },
      ]}
      value={pay}
      onChange={setPay}
    />
  );

  const empty = (
    <div className="px-6 py-12 text-center">
      <ShoppingBag size={26} className="mx-auto text-[#808999]/50" aria-hidden />
      <p className="mt-2 text-[13.5px] font-medium">Niciun bon nu se potrivește cu filtrele.</p>
      <p className="mt-1 text-[12px] text-[#808999]">Bonurile noi intră automat; lărgește filtrele ca să le vezi.</p>
      <Btn className="mt-3" onClick={clearAll}>
        Arată toate vânzările
      </Btn>
    </div>
  );

  const liveLine = (
    <span className="flex items-center gap-1.5 text-[12px] text-[#808999]">
      <LiveDot still={reduced || paused} color={paused ? C.dim : C.green} />
      {paused ? "Flux pus pe pauză — bonurile noi așteaptă" : "Bonurile intră pe măsură ce le trimit agenții"}
    </span>
  );

  if (mobile)
    return (
      <div className="zof-in space-y-3">
        <PageHeader mobile title="Jurnal vânzări" subtitle={`${num(t.receipts)} bonuri azi · 9 locații`} meta={liveLine} />
        <div className="flex gap-2">
          {pauseBtn}
          {exportBtn}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {stats.map((s) => (
            <div key={s.k} className={`${CARD} px-3 py-2.5`}>
              <p className="text-[10.5px] text-[#808999]">{s.k}</p>
              <p className="truncate text-[15px] font-bold tabular-nums" style={{ color: s.c }}>
                {s.v}
              </p>
            </div>
          ))}
        </div>
        {search}
        <div className="flex gap-2">
          {locSelect}
          {channelSeg}
        </div>
        <p className="text-[11.5px] text-[#808999]">
          {list.length} bonuri · {ron(sum)}
        </p>
        {list.length === 0 ? (
          <div className={CARD}>{empty}</div>
        ) : (
          <ul className="space-y-2">
            {shown.map((s) => {
              const p = productBySku(s.items[0].sku);
              const l = locById(s.loc);
              const on = open === s.id;
              const fresh = now - s.at < 2500;
              return (
                <li key={s.id} className={`${CARD} overflow-hidden ${fresh ? "zof-flash" : ""}`}>
                  <button type="button" onClick={() => setOpen(on ? null : s.id)} aria-expanded={on} className="flex w-full items-center gap-3 p-3 text-left">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#131C34]/70">
                      {l.type === "online" ? <Globe size={15} className="text-[#A78BFA]" aria-hidden /> : <ShoppingBag size={15} className="text-[#808999]" aria-hidden />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold">
                        {p.brand} {p.name}
                        {s.items.length > 1 && <span className="font-normal text-[#808999]"> +{s.items.length - 1}</span>}
                      </span>
                      <span className="block truncate text-[10.5px] text-[#808999]">
                        {clock(s.at)} · {l.name} · {PAY_LABEL[s.pay].toLowerCase()}
                      </span>
                    </span>
                    <span className="shrink-0 text-right text-[13px] font-bold tabular-nums">{ron(s.value)}</span>
                  </button>
                  {on && <Lines s={s} />}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    );

  return (
    <div className="zof-in space-y-4">
      <PageHeader
        title="Jurnal vânzări"
        subtitle={`${num(t.receipts)} bonuri azi · 9 locații · ${list.length} în filtru`}
        meta={liveLine}
        actions={
          <>
            {pauseBtn}
            {exportBtn}
          </>
        }
      />
      <div className="grid grid-cols-4 gap-3">
        {stats.map((s) => (
          <div key={s.k} className={`${CARD} px-4 py-3`}>
            <p className="text-[11px] text-[#808999]">{s.k}</p>
            <p className="mt-0.5 text-[19px] font-bold tabular-nums" style={{ color: s.c }}>
              {s.v}
            </p>
            <p className="text-[11px] text-[#808999]">{s.sub}</p>
          </div>
        ))}
      </div>
      <div className={`${CARD} flex items-center gap-2 p-3`}>
        {search}
        {locSelect}
        {channelSeg}
        {paySeg}
      </div>
      <section aria-label="Bonuri" className={CARD}>
        <div className="sticky top-0 z-10 grid items-center gap-3 rounded-t-xl border-b border-[#1C2336] bg-[#0A101F] px-4 py-2.5 text-[10.5px] font-semibold uppercase tracking-[0.05em] text-[#808999] [grid-template-columns:72px_104px_minmax(0,1fr)_150px_92px_44px_104px]">
          <span>Ora</span>
          <span>Bon</span>
          <span>Produs</span>
          <span>Locație</span>
          <span>Plată</span>
          <span className="text-right">Buc</span>
          <span className="text-right">Valoare</span>
        </div>
        {list.length === 0 ? (
          empty
        ) : (
          <ul>
            {shown.map((s) => {
              const p = productBySku(s.items[0].sku);
              const l = locById(s.loc);
              const on = open === s.id;
              const fresh = now - s.at < 2500;
              return (
                <li key={s.id} className={`border-b border-[#1C2336] last:border-0 ${on ? "bg-[#0E1629]" : ""} ${fresh ? "zof-flash" : ""}`}>
                  <button
                    type="button"
                    onClick={() => setOpen(on ? null : s.id)}
                    aria-expanded={on}
                    className="grid w-full items-center gap-3 px-4 py-2.5 text-left text-[12.5px] transition-colors hover:bg-[#131C34]/40 [grid-template-columns:72px_104px_minmax(0,1fr)_150px_92px_44px_104px]"
                  >
                    <span className="tabular-nums text-[#A3ACBB]">{clock(s.at)}</span>
                    <span className="flex items-center gap-1 text-[11.5px] text-[#A3ACBB]" style={{ fontFamily: MONO }}>
                      <ChevronDown size={12} className={`shrink-0 transition-transform ${on ? "rotate-180" : "-rotate-90"}`} aria-hidden />
                      {s.receipt}
                    </span>
                    <span className="min-w-0 truncate font-semibold">
                      {p.brand} {p.name}
                      {s.items.length > 1 && <span className="font-normal text-[#808999]"> +{s.items.length - 1} produs</span>}
                      {s.buffered && <span className="ml-1.5 text-[10.5px] font-medium text-[#FBBF24]">din buffer</span>}
                    </span>
                    <span className="flex min-w-0 items-center gap-1.5 text-[#A3ACBB]">
                      {l.type === "online" ? <Globe size={12} className="shrink-0 text-[#A78BFA]" aria-hidden /> : <MapPin size={12} className="shrink-0 text-[#60A5FA]" aria-hidden />}
                      <span className="truncate">{l.name}</span>
                    </span>
                    <span className="flex items-center gap-1.5 text-[#A3ACBB]">
                      <span className="size-2 rounded-full" style={{ background: PAY_COLOR[s.pay] }} aria-hidden />
                      {PAY_LABEL[s.pay]}
                    </span>
                    <span className="text-right tabular-nums">{s.items.reduce((a, it) => a + it.qty, 0)}</span>
                    <span className="text-right font-bold tabular-nums">{ron(s.value)}</span>
                  </button>
                  {on && <Lines s={s} />}
                </li>
              );
            })}
          </ul>
        )}
        {list.length > 0 && (
          <div className="flex items-center justify-between rounded-b-xl border-t border-[#1C2336] bg-[#0E1629] px-4 py-2.5 text-[12px]">
            <span className="text-[#808999]">
              {list.length > shown.length ? `Afișate ultimele ${shown.length} din ${list.length}` : `${list.length} bonuri în filtru`}
            </span>
            <span className="font-semibold tabular-nums">Total: {ron(sum)}</span>
          </div>
        )}
      </section>
    </div>
  );
}
