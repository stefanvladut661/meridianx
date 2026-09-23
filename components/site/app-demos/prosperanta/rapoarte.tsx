"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Download, RefreshCw, FileText, Plug, Receipt, UserRound, CircleCheck } from "lucide-react";
import { dec, lei, num } from "../kit";
import { C, STATIONS, stationDaily, stationHourly, stationShare } from "./data";
import { StationsMap } from "./map";
import { useDemo } from "./store";
import { PageTitle, StaffShell } from "./staff";
import { Bars, Btn, Card, CardHead, LiveDot, Pills, de } from "./ui";

/* ============================================================
   Rapoarte pe stație: cifrele pe interval, grafic, echipa din
   stație și legăturile cu sistemele externe (casele de marcat
   Rompetrol și facturarea pentru clienții firmă).
   ============================================================ */

type Period = "azi" | "7" | "30";
const AVG_PRICE = 7.12;
/** 820.265 lei · peste un milion: 3,50 mil. lei */
const money = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toLocaleString("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} mil. lei` : lei(n);

export function Rapoarte() {
  const { s, mobile, notify, setRepStation } = useDemo();
  const [period, setPeriod] = useState<Period>("7");
  const st = STATIONS[s.repStation];

  const data = useMemo(() => {
    if (period === "azi") {
      const h = stationHourly(st.id, 9);
      const scale = st.id === 0 ? s.shiftBase.litres / h.reduce((a, x) => a + x.litres, 0) : 1;
      const rows = h.map((x) => ({ label: `${x.label}:00`, litres: x.litres * scale }));
      const litres = rows.reduce((a, x) => a + x.litres, 0);
      const tx = st.id === 0 ? s.shiftBase.ops : Math.round(litres / 38.5);
      return {
        rows,
        litres,
        tx,
        points: st.id === 0 ? s.shiftBase.points : Math.round(litres * 0.9),
        vouchers: st.id === 0 ? s.shiftBase.vouchers : Math.round(tx * 0.08),
        every: 1,
      };
    }
    const d = stationDaily(st.id, +period);
    return {
      rows: d.map((x) => ({ label: x.label, litres: x.litres })),
      litres: d.reduce((a, x) => a + x.litres, 0),
      tx: d.reduce((a, x) => a + x.tx, 0),
      points: d.reduce((a, x) => a + x.points, 0),
      vouchers: d.reduce((a, x) => a + x.vouchers, 0),
      every: period === "30" ? 5 : 1,
    };
  }, [period, st.id, s.shiftBase]);

  const periodPills = (
    <Pills<Period>
      label="Interval"
      size="sm"
      value={period}
      onChange={setPeriod}
      items={[
        { id: "azi", label: "Azi" },
        { id: "7", label: "7 zile" },
        { id: "30", label: "30 zile" },
      ]}
    />
  );

  const download = () =>
    notify(`În demo, descărcarea e oprită. În aplicația reală pleacă raportul PDF pentru stația ${st.name}, cu fiecare zi și fiecare voucher.`);

  const kpis = [
    { l: "Litri total", v: num(data.litres) },
    { l: "Vânzări", v: money(data.litres * AVG_PRICE) },
    { l: "Puncte emise", v: num(data.points) },
    { l: "Tranzacții", v: num(data.tx) },
    { l: "Vouchere", v: num(data.vouchers) },
  ];

  const kpiGrid = (
    <div className={`grid gap-3 ${mobile ? "grid-cols-2" : "grid-cols-[1fr_1.35fr_1fr_1fr_0.85fr]"}`}>
      {kpis.map((k, i) => (
        <div
          key={k.l}
          className={`rounded-[18px] bg-white p-4 ${mobile && i === 0 ? "col-span-2" : ""}`}
          style={{ border: `2px solid ${C.border}` }}
        >
          <p className="truncate text-[10.5px] font-bold uppercase tracking-[0.08em]" style={{ color: C.mutedFg }}>
            {k.l}
          </p>
          <p className="tnum mt-1 truncate text-[22px] font-black leading-tight" style={{ color: C.red }}>
            {k.v}
          </p>
        </div>
      ))}
    </div>
  );

  const chart = (
    <Card>
      <CardHead right={<span className="text-[12px] font-bold" style={{ color: C.mutedFg }}>{period === "azi" ? "litri pe oră, de la 06:00" : "litri pe zi"}</span>}>
        {st.name}
      </CardHead>
      <div className="px-5 pb-4 pt-4">
        <Bars
          values={data.rows.map((r) => r.litres)}
          labels={data.rows.map((r) => r.label)}
          highlight={data.rows.length - 1}
          height={mobile ? 120 : 132}
          every={mobile && period === "30" ? 6 : data.every}
          format={(n) => `${num(n)} L`}
        />
      </div>
    </Card>
  );

  const map = (
    <Card className="overflow-hidden">
      <StationsMap selected={st.id} onSelect={setRepStation} sizeByVolume label="Alege stația" />
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-[15px] font-black uppercase">{st.name}</p>
          <p className="text-[12px]" style={{ color: C.mutedFg }}>
            {st.town} · {dec(stationShare(st.id) * 100)}% din volumul rețelei
          </p>
        </div>
        <span className="shrink-0 rounded-full px-2.5 py-1 text-[10.5px] font-black uppercase" style={{ background: C.greenBg, color: C.green }}>
          Deschisă
        </span>
      </div>
    </Card>
  );

  if (mobile)
    return (
      <StaffShell face="admin" screen="rapoarte">
        <div className="prs-scroll absolute inset-0">
          <main className="space-y-3 px-3 pb-10 pt-4">
            <PageTitle title="Rapoarte" sub="Pe stație și pe interval. Atinge un pin ca să schimbi stația." />
            {map}
            {periodPills}
            {kpiGrid}
            {chart}
            <Team />
            <Integrations />
            <Invoices />
            <Btn variant="soft" className="w-full" onClick={download}>
              <Download size={15} strokeWidth={2.6} /> Descarcă raportul
            </Btn>
          </main>
        </div>
      </StaffShell>
    );

  return (
    <StaffShell face="admin" screen="rapoarte">
      <div className="absolute inset-0 flex flex-col">
        <div className="mx-auto w-full max-w-[1232px] shrink-0 px-6 pt-5">
          <PageTitle
            title="Rapoarte"
            sub="Pe stație și pe interval · tranzacțiile vin din casele de marcat, facturile pleacă singure"
            right={
              <div className="flex items-center gap-3">
                {periodPills}
                <Btn variant="outline" size="sm" onClick={download}>
                  <Download size={14} strokeWidth={2.6} /> Raport PDF
                </Btn>
              </div>
            }
          />
        </div>
        <div className="mx-auto grid min-h-0 w-full max-w-[1232px] flex-1 grid-cols-12 gap-4 px-6 pb-5 pt-4">
          <div className="prs-scroll col-span-4 min-h-0 space-y-4 pr-0.5">
            {map}
            <Team />
          </div>
          <div className="prs-scroll col-span-8 min-h-0 space-y-4 pr-0.5">
            {kpiGrid}
            {chart}
            <div className="grid grid-cols-2 gap-4">
              <Integrations />
              <Invoices />
            </div>
          </div>
        </div>
      </div>
    </StaffShell>
  );
}

/* ---------------- echipa stației ---------------- */

function Team() {
  const { s } = useDemo();
  const st = STATIONS[s.repStation];
  const shifts = ["Tura 1 · 07–15", "Tura 2 · 15–23", "Tura 3 · 23–07"];
  return (
    <Card>
      <CardHead right={<span className="text-[12px] font-bold" style={{ color: C.mutedFg }}>{st.staff.length} angajați</span>}>Echipa stației</CardHead>
      <ul>
        {st.staff.map((name, i) => {
          const on = i === 0;
          const ops = on ? (st.id === 0 ? s.shiftBase.ops : 90 + ((st.id * 37) % 70)) : 0;
          const vouchers = on ? (st.id === 0 ? s.shiftBase.vouchers : 6 + (st.id % 9)) : 0;
          return (
            <li key={name} className="flex items-center gap-3 px-5 py-3" style={{ borderTop: i ? `1px solid ${C.border}` : undefined }}>
              <span
                className="flex size-9 shrink-0 items-center justify-center rounded-full"
                style={{ background: on ? C.red : C.muted, color: on ? "#fff" : C.mutedFg }}
              >
                <UserRound size={17} strokeWidth={2.4} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-bold">{name}</p>
                <p className="text-[11.5px]" style={{ color: C.mutedFg }}>
                  {shifts[i % 3]}
                </p>
              </div>
              {on ? (
                <div className="text-right">
                  <p className="flex items-center justify-end gap-1.5 text-[10.5px] font-black uppercase" style={{ color: C.green }}>
                    <LiveDot color={C.green} /> În tură
                  </p>
                  <p className="tnum text-[12px] font-bold">
                    {num(ops)} op. · {vouchers} vouchere
                  </p>
                </div>
              ) : (
                <span className="text-[11px] font-bold uppercase" style={{ color: C.soft }}>
                  Liber
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

/* ---------------- integrări ---------------- */

function Integrations() {
  const { s, notify, sync, rm } = useDemo();
  const [busy, setBusy] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const run = () => {
    if (busy) return;
    setBusy(true);
    timer.current = window.setTimeout(
      () => {
        setBusy(false);
        sync();
        notify("În demo, sincronizarea e simulată. În aplicația reală, tranzacțiile vin din casele de marcat, iar facturile pleacă spre programul de facturare.");
      },
      rm ? 50 : 1200
    );
  };

  const rows = [
    {
      icon: <Plug size={17} strokeWidth={2.4} />,
      name: "Case de marcat Rompetrol",
      line: (
        <>
          <b className="tnum font-black" style={{ color: C.fg }}>{num(s.totals.todayTx)}</b> {de(s.totals.todayTx)}tranzacții importate azi
        </>
      ),
    },
    {
      icon: <Receipt size={17} strokeWidth={2.4} />,
      name: "Facturare clienți firmă",
      line: (
        <>
          <b className="tnum font-black" style={{ color: C.fg }}>{184 + s.invoices.length - 5}</b> {de(184 + s.invoices.length - 5)}facturi emise azi
        </>
      ),
    },
  ];

  return (
    <Card>
      <CardHead>Integrări</CardHead>
      <ul>
        {rows.map((r, i) => (
          <li key={r.name} className="flex items-center gap-3 px-5 py-3" style={{ borderTop: i ? `1px solid ${C.border}` : undefined }}>
            <span className="flex size-9 shrink-0 items-center justify-center rounded-[12px]" style={{ background: "#FDECEE", color: C.red }}>
              {r.icon}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13.5px] font-black uppercase">{r.name}</p>
              <p className="text-[12px]" style={{ color: C.mutedFg }}>
                {r.line}
              </p>
            </div>
            <span className="flex shrink-0 items-center gap-1 text-[10.5px] font-black uppercase" style={{ color: C.green }}>
              <CircleCheck size={13} strokeWidth={2.8} /> Conectat
            </span>
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-between gap-3 px-5 py-3" style={{ borderTop: `1px solid ${C.border}` }}>
        <p className="text-[12px]" style={{ color: C.mutedFg }}>
          Ultima sincronizare: <b className="tnum font-black" style={{ color: C.fg }}>{s.lastSync}</b>
        </p>
        <Btn size="sm" variant="dark" onClick={run} disabled={busy} aria-busy={busy}>
          <RefreshCw size={13} strokeWidth={2.8} className={busy ? "a-spin" : ""} />
          {busy ? "Se sincronizează" : "Sincronizează"}
        </Btn>
      </div>
    </Card>
  );
}

function Invoices() {
  const { s, notify } = useDemo();
  return (
    <Card>
      <CardHead right={<span className="text-[12px] font-bold" style={{ color: C.mutedFg }}>automat, la fiecare bon pe firmă</span>}>Facturi recente</CardHead>
      <ul>
        {s.invoices.slice(0, 5).map((f, i) => (
          <li key={f.no} style={{ borderTop: i ? `1px solid ${C.border}` : undefined }}>
            <button
              type="button"
              onClick={() => notify(`În demo, factura nu se deschide. În aplicația reală se descarcă PDF-ul facturii ${f.no}.`)}
              className={`flex w-full items-center gap-3 px-5 py-2.5 text-left transition-colors hover:bg-[#FAFAFA] ${i === 0 ? "a-in" : ""}`}
            >
              <FileText size={16} className="shrink-0" style={{ color: C.soft }} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-bold">{f.company}</span>
                <span className="block text-[11.5px]" style={{ color: C.mutedFg }}>
                  {f.no} · {f.time}
                </span>
              </span>
              <span className="tnum shrink-0 text-[13px] font-black">{dec(f.value)} lei</span>
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

