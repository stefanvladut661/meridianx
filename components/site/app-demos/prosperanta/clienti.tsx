"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, Download, Search, Minus, Plus, CircleCheck, TriangleAlert, SlidersHorizontal } from "lucide-react";
import { num } from "../kit";
import { C, STATIONS, baseHistory, dateLabel, fuelLabel, phoneMask, stationName, type Customer } from "./data";
import { useDemo } from "./store";
import { PageTitle, StaffShell } from "./staff";
import { Avatar, Bars, Btn, Card, CardHead, Label, Pills, Roll, de, inputCls, inputStyle, litri } from "./ui";

/* ============================================================
   Clienții: căutare după nume sau telefon, fișa clientului cu
   istoricul și ajustarea manuală de puncte (cu motiv, logată).
   ============================================================ */

type Filter = "toti" | "activi" | "inactivi" | "peste500" | "gpl";

const norm = (t: string) =>
  t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const lastLabel = (d: number) => (d === 0 ? "azi" : d === 1 ? "ieri" : `acum ${d} zile`);

export function Clienti() {
  const { s, mobile, notify } = useDemo();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("toti");
  const [sel, setSel] = useState<number | null>(mobile ? null : 0);

  const list = useMemo(() => {
    const t = norm(q.trim());
    const digits = t.replace(/\D/g, "");
    return s.customers
      .filter((c) => {
        if (filter === "activi" && c.last > 30) return false;
        if (filter === "inactivi" && c.last <= 30) return false;
        if (filter === "peste500" && c.points < 500) return false;
        if (filter === "gpl" && c.fuel !== "gpl") return false;
        if (!t) return true;
        return digits.length >= 2 ? c.tail.includes(digits) : norm(c.name).includes(t);
      })
      .sort((a, b) => a.last - b.last || b.points - a.points);
  }, [s.customers, q, filter]);

  const current = sel === null ? null : s.customers.find((c) => c.id === sel) ?? null;
  const exportCsv = () =>
    notify(`În demo, exportul e oprit. În aplicația reală pleacă un fișier CSV cu ${num(s.totals.members)} de clienți, fără parole.`);

  const search = (
    <div className="relative">
      <Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: C.soft }} />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Caută telefon, nume"
        aria-label="Caută clienți după telefon sau nume"
        className={`${inputCls} pl-10`}
        style={inputStyle}
      />
    </div>
  );

  const filters = (
    <Pills<Filter>
      label="Filtre"
      size="sm"
      value={filter}
      onChange={setFilter}
      items={[
        { id: "toti", label: "Toți" },
        { id: "activi", label: "Activi 30 zile" },
        { id: "inactivi", label: "Inactivi" },
        { id: "peste500", label: "Peste 500 p" },
        { id: "gpl", label: "GPL" },
      ]}
    />
  );

  const empty = (
    <div className="px-5 py-10 text-center">
      <p className="text-[14px] font-black uppercase">Niciun client găsit</p>
      <p className="mt-1 text-[13px]" style={{ color: C.mutedFg }}>
        Caută după nume sau după ultimele cifre ale telefonului.
      </p>
      <Btn
        className="mt-4"
        size="sm"
        variant="outline"
        onClick={() => {
          setQ("");
          setFilter("toti");
        }}
      >
        Șterge filtrele
      </Btn>
    </div>
  );

  if (mobile)
    return (
      <StaffShell face="admin" screen="clienti">
        {current ? (
          <div className="prs-scroll absolute inset-0">
            <main className="px-3 pb-10 pt-3">
              <button type="button" onClick={() => setSel(null)} className="mb-3 flex h-10 items-center gap-1.5 rounded-full pr-3 text-[13px] font-black uppercase" style={{ color: C.red }}>
                <ArrowLeft size={18} strokeWidth={2.6} /> Clienți
              </button>
              <Detail c={current} />
            </main>
          </div>
        ) : (
          <div className="prs-scroll absolute inset-0">
            <main className="space-y-3 px-3 pb-10 pt-4">
              <PageTitle title="Clienți" sub={`${num(s.totals.members)} membri · 31.904 activi în 30 de zile`} />
              {search}
              <div className="prs-hscroll -mx-3 px-3">{filters}</div>
              <Card>
                {list.length === 0 && empty}
                <ul>
                  {list.slice(0, 24).map((c, i) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => setSel(c.id)}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left"
                        style={{ borderTop: i ? `1px solid ${C.border}` : undefined }}
                      >
                        <Avatar name={c.name} size={36} tone={c.id === 0 ? "red" : "soft"} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[14px] font-bold">{c.name}</span>
                          <span className="block text-[12px]" style={{ color: C.mutedFg }}>
                            {phoneMask(c.tail)} · {lastLabel(c.last)}
                          </span>
                        </span>
                        <span className="text-[15px] font-black" style={{ color: C.red }}>
                          {num(c.points)}
                          <span className="ml-0.5 text-[10px]">p</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </Card>
              <Btn variant="soft" className="w-full" onClick={exportCsv}>
                <Download size={15} strokeWidth={2.6} /> Export CSV
              </Btn>
            </main>
          </div>
        )}
      </StaffShell>
    );

  return (
    <StaffShell face="admin" screen="clienti">
      <div className="absolute inset-0 flex flex-col">
        <div className="mx-auto w-full max-w-[1232px] shrink-0 px-6 pt-5">
          <PageTitle
            title="Clienți"
            sub={
              <>
                <b className="font-black" style={{ color: C.fg }}>
                  <Roll value={s.totals.members} />
                </b>{" "}
                membri · 31.904 activi în ultimele 30 de zile · {s.totals.newToday} {de(s.totals.newToday)}înscriși azi
              </>
            }
            right={
              <div className="flex items-center gap-2">
                <div className="w-[300px]">{search}</div>
                <Btn variant="outline" onClick={exportCsv}>
                  <Download size={15} strokeWidth={2.6} /> Export CSV
                </Btn>
              </div>
            }
          />
          <div className="mt-4 flex items-center gap-3">
            <SlidersHorizontal size={16} style={{ color: C.soft }} aria-hidden />
            {filters}
            <span className="ml-auto text-[12.5px] font-bold" style={{ color: C.mutedFg }}>
              {list.length} {de(list.length)}rezultate încărcate
            </span>
          </div>
        </div>

        <div className="mx-auto grid min-h-0 w-full max-w-[1232px] flex-1 grid-cols-12 gap-4 px-6 pb-5 pt-4">
          <Card className="col-span-7 flex min-h-0 flex-col overflow-hidden">
            <div
              className="grid shrink-0 grid-cols-[minmax(0,1.9fr)_1.15fr_0.8fr_0.95fr_0.9fr] gap-3 px-5 py-2.5 text-[10.5px] font-bold uppercase tracking-[0.08em]"
              style={{ color: C.mutedFg, borderBottom: `2px solid ${C.border}` }}
            >
              <span>Client</span>
              <span>Telefon</span>
              <span className="text-right">Puncte</span>
              <span className="text-right">Litri total</span>
              <span className="text-right">Ultima</span>
            </div>
            <ul className="prs-scroll min-h-0 flex-1">
              {list.length === 0 && <li>{empty}</li>}
              {list.map((c, i) => {
                const on = c.id === sel;
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => setSel(c.id)}
                      aria-pressed={on}
                      className="grid w-full grid-cols-[minmax(0,1.9fr)_1.15fr_0.8fr_0.95fr_0.9fr] items-center gap-3 px-5 py-2 text-left transition-colors hover:bg-[#FAFAFA]"
                      style={{ borderTop: i ? `1px solid ${C.border}` : undefined, background: on ? "#FDECEE" : undefined }}
                    >
                      <span className="flex min-w-0 items-center gap-2.5">
                        <Avatar name={c.name} size={30} tone={c.id === 0 ? "red" : "soft"} />
                        <span className="truncate text-[13.5px] font-bold">{c.name}</span>
                      </span>
                      <span className="text-[12.5px]" style={{ color: C.mutedFg }}>
                        {phoneMask(c.tail)}
                      </span>
                      <span className="tnum text-right text-[14px] font-black" style={{ color: C.red }}>
                        {num(c.points)}
                      </span>
                      <span className="tnum text-right text-[13px] font-bold">{num(c.litres)}</span>
                      <span className="text-right text-[12.5px]" style={{ color: c.last > 30 ? "#B86E00" : C.mutedFg }}>
                        {lastLabel(c.last)}
                      </span>
                    </button>
                  </li>
                );
              })}
              {list.length > 0 && (
                <li className="px-5 py-3" style={{ borderTop: `1px solid ${C.border}` }}>
                  <button
                    type="button"
                    className="text-[12px] font-black uppercase"
                    style={{ color: C.red }}
                    onClick={() => notify(`În demo sunt încărcați doar primii ${s.customers.length} de clienți. În aplicația reală, lista se încarcă pe pagini, din toți cei ${num(s.totals.members)}.`)}
                  >
                    Încarcă următorii 50
                  </button>
                </li>
              )}
            </ul>
          </Card>
          <div className="prs-scroll col-span-5 min-h-0 pr-0.5">
            {current ? (
              <Detail c={current} />
            ) : (
              <div className="flex h-full items-center justify-center rounded-[18px] p-8 text-center text-[14px]" style={{ border: `2px dashed ${C.border}`, color: C.mutedFg }}>
                Alege un client din listă ca să-i vezi istoricul și punctele.
              </div>
            )}
          </div>
        </div>
      </div>
    </StaffShell>
  );
}

function Detail({ c }: { c: Customer }) {
  const { s, adjust, mobile } = useDemo();
  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const history = [...(s.extra[c.id] ?? []), ...baseHistory(c)];
  const fuelings = history.filter((h) => !h.note);
  const last8 = fuelings.slice(0, 8).reverse();

  const apply = () => {
    const d = parseInt(delta, 10);
    if (!d) return setMsg({ ok: false, text: "Scrie o valoare diferită de zero, de exemplu 50 sau −20." });
    if (!reason.trim()) return setMsg({ ok: false, text: "Scrie motivul. Ajustările fără motiv nu se salvează." });
    if (c.points + d < 0) return setMsg({ ok: false, text: `Clientul are doar ${c.points} puncte. Nu poți scădea mai mult.` });
    adjust(c.id, d, reason.trim());
    setMsg({ ok: true, text: `Ajustare aplicată: ${d > 0 ? "+" : ""}${d} puncte. Apare în istoricul clientului.` });
    setDelta("");
    setReason("");
  };

  const step = (n: number) => {
    setDelta((d) => {
      const v = (parseInt(d, 10) || 0) + n;
      return v ? String(v) : "";
    });
    setMsg(null);
  };

  return (
    <div className="space-y-3">
      <Card className="p-5">
        <div className="flex items-start gap-3">
          <Avatar name={c.name} size={48} tone={c.id === 0 ? "red" : "soft"} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[18px] font-black uppercase leading-tight">{c.name}</p>
            <p className="mt-0.5 text-[12.5px]" style={{ color: C.mutedFg }}>
              {phoneMask(c.tail)} · {c.mail}
            </p>
            <p className="text-[12.5px]" style={{ color: C.mutedFg }}>
              Membru din {c.since} · preferă {STATIONS[c.fav].name}
            </p>
          </div>
        </div>
        <div className="mt-4 flex items-end justify-between gap-3">
          <p className="text-[36px] font-black leading-none" style={{ color: C.red }}>
            <Roll value={c.points} /> <span className="text-[15px] uppercase">puncte</span>
          </p>
          <div className="w-[150px]">
            <Bars values={last8.map((h) => h.litres)} labels={last8.map(() => "")} height={40} highlight={last8.length - 1} />
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {[
            { l: "Litri total", v: num(c.litres) },
            { l: "Alimentări", v: num(c.visits) },
            { l: "Vouchere folosite", v: num(c.used) },
          ].map((x) => (
            <div key={x.l} className="rounded-[14px] px-3 py-2" style={{ background: C.muted }}>
              <p className="truncate text-[10px] font-bold uppercase tracking-[0.06em]" style={{ color: C.mutedFg }}>
                {x.l}
              </p>
              <p className="tnum text-[17px] font-black">{x.v}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-5">
        <p className="text-[13px] font-black uppercase">Ajustare manuală</p>
        <div className={`mt-3 grid gap-3 ${mobile ? "grid-cols-1" : "grid-cols-[150px_1fr]"}`}>
          <div>
            <Label htmlFor={`prs-delta-${c.id}`}>Delta (+/−)</Label>
            <div className="flex h-11 items-center overflow-hidden rounded-[12px]" style={inputStyle}>
              <button type="button" aria-label="Scade 10" onClick={() => step(-10)} className="flex h-full w-9 shrink-0 items-center justify-center hover:bg-[#F5F5F5]">
                <Minus size={15} strokeWidth={2.6} />
              </button>
              <input
                id={`prs-delta-${c.id}`}
                value={delta}
                onChange={(e) => {
                  setDelta(e.target.value.replace(/[^\d-]/g, "").slice(0, 5));
                  setMsg(null);
                }}
                inputMode="numeric"
                placeholder="0"
                className="tnum h-full w-full min-w-0 bg-transparent text-center text-[15px] font-black outline-none"
              />
              <button type="button" aria-label="Adaugă 10" onClick={() => step(10)} className="flex h-full w-9 shrink-0 items-center justify-center hover:bg-[#F5F5F5]">
                <Plus size={15} strokeWidth={2.6} />
              </button>
            </div>
          </div>
          <div>
            <Label htmlFor={`prs-reason-${c.id}`}>Motiv</Label>
            <input
              id={`prs-reason-${c.id}`}
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                setMsg(null);
              }}
              onKeyDown={(e) => e.key === "Enter" && apply()}
              placeholder="ex. bon scanat greșit pe 19.09"
              className={inputCls}
              style={inputStyle}
            />
          </div>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <Btn onClick={apply}>Aplică</Btn>
          {msg && (
            <p role={msg.ok ? "status" : "alert"} className="flex items-start gap-1.5 text-[12.5px] font-bold" style={{ color: msg.ok ? C.green : C.red }}>
              {msg.ok ? <CircleCheck size={15} className="mt-0.5 shrink-0" /> : <TriangleAlert size={15} className="mt-0.5 shrink-0" />}
              {msg.text}
            </p>
          )}
        </div>
      </Card>

      <Card>
        <CardHead>Istoric ({history.length})</CardHead>
        <ul>
          {history.map((h, i) => (
            <li key={h.id} className={`flex items-center justify-between gap-3 px-5 py-2.5 text-[13px] ${h.day === 0 ? "a-flash" : ""}`} style={{ borderTop: i ? `1px solid ${C.border}` : undefined }}>
              <span className="min-w-0">
                <span className="block truncate font-bold">
                  {h.note ? `Ajustare manuală · ${h.note}` : `${stationName(h.station)} · ${litri(h.litres, 1)} ${fuelLabel(h.fuel)}`}
                </span>
                <span className="text-[11.5px]" style={{ color: C.mutedFg }}>
                  {h.day === 0 ? `Azi, ${h.time}` : `${dateLabel(h.day)} ${h.time}`}
                </span>
              </span>
              <span className="shrink-0 font-black" style={{ color: h.points < 0 ? C.fg : C.red }}>
                {h.points > 0 ? "+" : ""}
                {h.points}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
