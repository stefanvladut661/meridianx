"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, CircleCheck, Download, Minus, Plus, Search, TriangleAlert } from "lucide-react";
import { num } from "../kit";
import { C, STATIONS, baseHistory, dateLabel, fuelWord, phoneMask, stationName, type Customer } from "./data";
import { useDemo } from "./store";
import { PageTitle, StaffShell } from "./staff";
import { Avatar, Btn, Card, CardHead, Label, Meta, Pills, SW, de, inputCls, litri, nr, signed, unit } from "./ui";

/* ============================================================
   Clienții: căutare după nume sau telefon, fișa clientului cu
   istoricul și ajustarea manuală de puncte (cu motiv, logată).
   ============================================================ */

type Filter = "toti" | "activi" | "inactivi" | "peste500" | "gpl";

const norm = (t: string) =>
  t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

const lastLabel = (d: number) => (d === 0 ? "azi" : d === 1 ? "ieri" : `acum ${d} ${unit(d, "zi", "zile")}`);

const line = `1px solid ${C.border}`;
const COLS = "grid-cols-[minmax(0,1.9fr)_1.1fr_0.75fr_0.75fr_0.95fr]";

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
  const filtered = q.trim() !== "" || filter !== "toti";
  const count = filtered ? nr(list.length, "rezultat", "rezultate") : `${num(s.customers.length)} din ${num(s.totals.members)}`;
  const exportCsv = () => notify("Exportul CSV e oprit în demo.");
  const clear = () => {
    setQ("");
    setFilter("toti");
  };

  const search = (
    <div className="relative">
      <Search size={17} strokeWidth={SW} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" style={{ color: C.mutedFg }} aria-hidden />
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Caută după nume sau telefon" aria-label="Caută clienți" className={`${inputCls} pl-9`} />
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
        { id: "activi", label: "Activi" },
        { id: "inactivi", label: "Inactivi" },
        { id: "peste500", label: "Peste 500 de puncte" },
        { id: "gpl", label: "GPL" },
      ]}
    />
  );

  const empty = (
    <div className="px-5 py-10 text-center">
      <p className="text-[15px] font-semibold">Niciun client găsit</p>
      <p className="mt-1 text-[13px]" style={{ color: C.mutedFg }}>
        Încearcă ultimele cifre ale telefonului
      </p>
      <Btn className="mt-4" size="sm" variant="secondary" onClick={clear}>
        Șterge filtrele
      </Btn>
    </div>
  );

  const exportBtn = (
    <Btn variant="secondary" className={mobile ? "w-full" : ""} onClick={exportCsv}>
      <Download size={15} strokeWidth={SW} aria-hidden /> Exportă CSV
    </Btn>
  );

  if (mobile)
    return (
      <StaffShell face="admin" screen="clienti">
        {current ? (
          <div className="prs-scroll absolute inset-0">
            <main className="px-3 pb-10 pt-2">
              <button type="button" onClick={() => setSel(null)} className="mb-1 flex h-11 items-center gap-1.5 rounded-[8px] pr-3 text-[14px] font-medium">
                <ArrowLeft size={18} strokeWidth={SW} aria-hidden /> Clienți
              </button>
              <Detail c={current} />
            </main>
          </div>
        ) : (
          <div className="prs-scroll absolute inset-0">
            <main className="space-y-3 px-3 pb-10 pt-4">
              <PageTitle title="Clienți" sub={`${nr(s.totals.members, "membru", "membri")} · 31.904 activi`} />
              {search}
              <div className="prs-hscroll -mx-3 px-3">{filters}</div>
              <Card>
                {list.length === 0 && empty}
                <ul>
                  {list.map((c, i) => (
                    <li key={c.id}>
                      <button type="button" onClick={() => setSel(c.id)} className="row flex w-full items-center gap-3 px-4 py-2.5 text-left" style={{ borderTop: i ? line : undefined }}>
                        <Avatar name={c.name} size={36} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[14px] font-medium">{c.name}</span>
                          <span className="block truncate text-[12.5px]" style={{ color: C.mutedFg }}>
                            {phoneMask(c.tail)} · <span style={c.last > 30 ? { color: C.amber } : undefined}>{lastLabel(c.last)}</span>
                          </span>
                        </span>
                        <span className="shrink-0 text-right">
                          <span className="block text-[14px] font-semibold">{num(c.points)}</span>
                          <span className="block text-[12px]" style={{ color: C.mutedFg }}>
                            {c.points === 1 ? "punct" : "puncte"}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </Card>
              {exportBtn}
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
            sub={`${nr(s.totals.members, "membru", "membri")} · 31.904 activi în ultimele 30 de zile`}
            right={
              <div className="flex items-center gap-2">
                <div className="w-[300px]">{search}</div>
                {exportBtn}
              </div>
            }
          />
          <div className="mt-4 flex items-center gap-3">
            {filters}
            <span className="ml-auto text-[12.5px]" style={{ color: C.mutedFg }} aria-live="polite">
              {count}
            </span>
          </div>
        </div>

        <div className="mx-auto grid min-h-0 w-full max-w-[1232px] flex-1 grid-cols-12 gap-4 px-6 pb-5 pt-3">
          <Card className="col-span-7 flex min-h-0 flex-col overflow-hidden">
            <div className={`grid shrink-0 ${COLS} gap-3 px-4 py-2.5 text-[12.5px] font-medium`} style={{ color: C.mutedFg, borderBottom: line }}>
              <span>Client</span>
              <span>Telefon</span>
              <span className="text-right">Puncte</span>
              <span className="text-right">Litri</span>
              <span className="text-right">Ultima vizită</span>
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
                      className={`row grid w-full ${COLS} items-center gap-3 px-4 py-2 text-left`}
                      style={{ borderTop: i ? line : undefined, background: on ? C.sel : undefined }}
                    >
                      <span className="flex min-w-0 items-center gap-2.5">
                        <Avatar name={c.name} size={28} />
                        <span className="truncate text-[13.5px] font-medium">{c.name}</span>
                      </span>
                      <span className="text-[13px]" style={{ color: C.mutedFg }}>
                        {phoneMask(c.tail)}
                      </span>
                      <span className="text-right text-[13.5px] font-semibold">{num(c.points)}</span>
                      <span className="text-right text-[13.5px]">{num(c.litres)}</span>
                      <span className="text-right text-[13px]" style={{ color: c.last > 30 ? C.amber : C.mutedFg }}>
                        {lastLabel(c.last)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </Card>
          <div className="prs-scroll col-span-5 min-h-0 pr-0.5">
            {current ? (
              <Detail c={current} />
            ) : (
              <div className="flex h-full items-center justify-center rounded-[12px] p-8 text-center text-[14px]" style={{ border: `1px dashed ${C.line}`, color: C.mutedFg }}>
                Alege un client din listă
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

  const apply = () => {
    const d = parseInt(delta, 10);
    if (!d) return setMsg({ ok: false, text: "Scrie o valoare diferită de zero, de exemplu 50 sau −20." });
    if (!reason.trim()) return setMsg({ ok: false, text: "Scrie motivul. Ajustările fără motiv nu se salvează." });
    if (c.points + d < 0) return setMsg({ ok: false, text: `Clientul are doar ${nr(c.points, "punct", "puncte")}.` });
    adjust(c.id, d, reason.trim());
    setMsg({ ok: true, text: `Ajustare aplicată: ${signed(d)} ${unit(Math.abs(d), "punct", "puncte")}` });
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
      <Card className="p-4">
        <div className="flex items-start gap-3">
          <Avatar name={c.name} size={44} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[16px] font-semibold leading-tight">{c.name}</p>
            <p className="mt-0.5 truncate text-[12.5px]" style={{ color: C.mutedFg }}>
              {phoneMask(c.tail)} · {c.mail}
            </p>
            <p className="truncate text-[12.5px]" style={{ color: C.mutedFg }}>
              Membru din {c.since} · stația preferată: {STATIONS[c.fav].name}
            </p>
          </div>
        </div>
        <p className="mt-4 flex items-baseline gap-1.5">
          <span className="text-[28px] font-semibold leading-none tracking-[-0.01em]">{num(c.points)}</span>
          <span className="text-[14px]" style={{ color: C.mutedFg }}>
            {c.points === 1 ? "punct" : `${de(c.points)}puncte`}
          </span>
        </p>
        <p className="mt-2 text-[13px]" style={{ color: C.mutedFg }}>
          {litri(c.litres, 0)} · {nr(c.visits, "alimentare", "alimentări")} · {nr(c.used, "voucher folosit", "vouchere folosite")}
        </p>
      </Card>

      <Card className="p-4">
        <h3 className="text-[14px] font-semibold">Ajustare manuală</h3>
        <div className={`mt-3 grid gap-3 ${mobile ? "grid-cols-1" : "grid-cols-[148px_1fr]"}`}>
          <div>
            <Label htmlFor={`prs-delta-${c.id}`}>Puncte (+/−)</Label>
            <div className="field flex h-11 items-center overflow-hidden rounded-[8px] bg-white">
              <button type="button" aria-label="Scade 10" onClick={() => step(-10)} className="ico flex h-full w-10 shrink-0 items-center justify-center">
                <Minus size={15} strokeWidth={2} />
              </button>
              <input
                id={`prs-delta-${c.id}`}
                value={delta}
                onChange={(e) => {
                  setDelta(e.target.value.replace(/[^\d-]/g, "").slice(0, 5));
                  setMsg(null);
                }}
                onKeyDown={(e) => e.key === "Enter" && apply()}
                inputMode="numeric"
                placeholder="0"
                autoComplete="off"
                className="h-full w-full min-w-0 bg-transparent text-center text-[15px] font-semibold outline-none"
              />
              <button type="button" aria-label="Adaugă 10" onClick={() => step(10)} className="ico flex h-full w-10 shrink-0 items-center justify-center">
                <Plus size={15} strokeWidth={2} />
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
              placeholder="Ex.: bon înregistrat greșit pe 19.09"
              autoComplete="off"
              className={inputCls}
            />
          </div>
        </div>
        <div className={`mt-3 flex gap-3 ${mobile ? "flex-col" : "items-center"}`}>
          <Btn onClick={apply}>Aplică ajustarea</Btn>
          {msg && (
            <p role={msg.ok ? "status" : "alert"} className="flex items-start gap-1.5 text-[13px] font-medium" style={{ color: msg.ok ? C.greenInk : C.red }}>
              {msg.ok ? (
                <CircleCheck size={15} strokeWidth={SW} className="mt-0.5 shrink-0" aria-hidden />
              ) : (
                <TriangleAlert size={15} strokeWidth={SW} className="mt-0.5 shrink-0" aria-hidden />
              )}
              {msg.text}
            </p>
          )}
        </div>
      </Card>

      <Card>
        <CardHead right={<Meta>{history.length}</Meta>}>Istoric</CardHead>
        <ul>
          {history.map((h, i) => (
            <li
              key={h.id}
              className={`flex items-center justify-between gap-3 px-4 py-2.5 ${h.day === 0 ? "a-flash" : ""}`}
              style={{ borderTop: i ? line : undefined }}
            >
              <span className="min-w-0">
                <span className="block truncate text-[13.5px] font-medium">{h.note ? `Ajustare manuală · ${h.note}` : stationName(h.station)}</span>
                <span className="block text-[12.5px]" style={{ color: C.mutedFg }}>
                  {h.day === 0 ? `Azi, ${h.time}` : `${dateLabel(h.day)}, ${h.time}`}
                  {h.note ? "" : ` · ${litri(h.litres, 1)} ${fuelWord(h.fuel)}`}
                </span>
              </span>
              <span className="shrink-0 text-[13.5px] font-semibold">{signed(h.points)}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
