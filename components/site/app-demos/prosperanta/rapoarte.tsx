"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Download, FileText, Plug, Receipt, RefreshCw } from "lucide-react";
import { dec, lei, num } from "../kit";
import { C, STATIONS, stationDaily, stationHourly, stationShare } from "./data";
import { StationsMap } from "./map";
import { useDemo } from "./store";
import { PageTitle, StaffShell } from "./staff";
import { Avatar, Bars, Btn, Card, CardHead, LiveDot, Meta, MetricStrip, Pills, SW, nr, unit } from "./ui";

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

const line = `1px solid ${C.border}`;

export function Rapoarte() {
  const { s, mobile, notify, setRepStation } = useDemo();
  const [period, setPeriod] = useState<Period>("7");
  const st = STATIONS[s.repStation];

  const data = useMemo(() => {
    if (period === "azi") {
      /* de la 06:00 până la ora curentă; ultima bară e ora în curs */
      const hour = Math.floor(s.clock / 3600);
      const part = (s.clock % 3600) / 3600;
      const h = stationHourly(st.id, hour).map((x, i, a) => (i === a.length - 1 ? { ...x, litres: x.litres * part } : x));
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
  }, [period, st.id, s.shiftBase, s.clock]);

  const periodPills = (
    <Pills<Period>
      label="Interval"
      size="sm"
      value={period}
      onChange={setPeriod}
      stretch={mobile}
      items={[
        { id: "azi", label: "Azi" },
        { id: "7", label: "7 zile" },
        { id: "30", label: "30 de zile" },
      ]}
    />
  );

  const download = () => notify("Descărcarea PDF e oprită în demo.");

  const kpis = (
    <MetricStrip
      cols={mobile ? 2 : 5}
      size={mobile ? "md" : "lg"}
      items={[
        { label: "Litri", value: num(data.litres), span: mobile ? 2 : undefined },
        { label: "Vânzări", value: money(data.litres * AVG_PRICE) },
        { label: "Puncte emise", value: num(data.points) },
        { label: "Tranzacții", value: num(data.tx) },
        { label: "Vouchere validate", value: num(data.vouchers) },
      ]}
    />
  );

  const chart = (
    <Card>
      <CardHead>{period === "azi" ? "Litri pe oră" : "Litri pe zi"}</CardHead>
      <div className="px-4 pb-3 pt-3">
        <Bars
          values={data.rows.map((r) => r.litres)}
          labels={data.rows.map((r) => r.label)}
          highlight={data.rows.length - 1}
          height={mobile ? 120 : 132}
          every={mobile && period === "30" ? 6 : data.every}
          format={(n) => `${num(n)} L`}
          ticks
        />
      </div>
    </Card>
  );

  const map = (
    <Card className="overflow-hidden">
      <StationsMap selected={st.id} onSelect={setRepStation} sizeByVolume label="Alege stația" />
      <div className="px-4 py-3" style={{ borderTop: line }}>
        <p className="truncate text-[15px] font-semibold">{st.name}</p>
        <p className="text-[12.5px]" style={{ color: C.mutedFg }}>
          {st.town} · {(stationShare(st.id) * 100).toLocaleString("ro-RO", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}% din litrii rețelei
        </p>
      </div>
    </Card>
  );

  if (mobile)
    return (
      <StaffShell face="admin" screen="rapoarte">
        <div className="prs-scroll absolute inset-0">
          <main className="space-y-3 px-3 pb-10 pt-4">
            <PageTitle title="Rapoarte" />
            {map}
            {periodPills}
            {kpis}
            {chart}
            <Team />
            <Integrations />
            <Invoices />
            <Btn variant="secondary" className="w-full" onClick={download}>
              <Download size={15} strokeWidth={SW} aria-hidden /> Descarcă PDF
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
            right={
              <div className="flex items-center gap-3">
                {periodPills}
                <Btn variant="secondary" size="sm" onClick={download}>
                  <Download size={14} strokeWidth={SW} aria-hidden /> Descarcă PDF
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
            {kpis}
            {chart}
            <div className="grid grid-cols-2 items-start gap-4">
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
      <CardHead right={<Meta>{nr(st.staff.length, "angajat", "angajați")}</Meta>}>Echipa</CardHead>
      <ul>
        {st.staff.map((name, i) => {
          const on = i === 0;
          const ops = on ? (st.id === 0 ? s.shiftBase.ops : 90 + ((st.id * 37) % 70)) : 0;
          return (
            <li key={name} className="flex items-center gap-3 px-4 py-2.5" style={{ borderTop: i ? line : undefined }}>
              <Avatar name={name} size={32} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-medium">{name}</p>
                <p className="text-[12.5px]" style={{ color: C.mutedFg }}>
                  {shifts[i % 3]}
                </p>
              </div>
              {on ? (
                <div className="shrink-0 text-right">
                  <p className="flex items-center justify-end gap-1.5 text-[12.5px] font-medium" style={{ color: C.green }}>
                    <LiveDot /> În tură
                  </p>
                  <p className="text-[12.5px]" style={{ color: C.mutedFg }}>
                    {nr(ops, "operațiune", "operațiuni")}
                  </p>
                </div>
              ) : (
                <span className="shrink-0 text-[12.5px]" style={{ color: C.mutedFg }}>
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
  const { s, sync, rm } = useDemo();
  const [busy, setBusy] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  /* rezultatul se vede pe loc, în ora ultimei sincronizări */
  const run = () => {
    if (busy) return;
    setBusy(true);
    timer.current = window.setTimeout(
      () => {
        setBusy(false);
        sync();
      },
      rm ? 50 : 1200
    );
  };

  const invoices = 184 + s.invoices.length - 5;
  const rows = [
    { icon: Plug, name: "Case de marcat Rompetrol", line: `${num(s.totals.todayTx)} ${unit(s.totals.todayTx, "tranzacție importată", "tranzacții importate")} azi` },
    { icon: Receipt, name: "Facturare clienți firmă", line: `${num(invoices)} ${unit(invoices, "factură emisă", "facturi emise")} azi` },
  ];

  return (
    <Card>
      <CardHead>Integrări</CardHead>
      <ul>
        {rows.map((r, i) => {
          const I = r.icon;
          return (
            <li key={r.name} className="flex items-start gap-3 px-4 py-3" style={{ borderTop: i ? line : undefined }}>
              <I size={16} strokeWidth={SW} className="mt-0.5 shrink-0" style={{ color: C.mutedFg }} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-medium">{r.name}</p>
                <p className="text-[12.5px]" style={{ color: C.mutedFg }}>
                  {r.line}
                </p>
              </div>
              <span className="flex shrink-0 items-center gap-1.5 pt-0.5 text-[12.5px] font-medium" style={{ color: C.green }}>
                <LiveDot /> Conectat
              </span>
            </li>
          );
        })}
      </ul>
      <div className="flex items-center justify-between gap-3 px-4 py-2.5" style={{ borderTop: line }}>
        <p className="text-[12.5px]" style={{ color: C.mutedFg }} aria-live="polite">
          Ultima sincronizare:{" "}
          <span className="font-semibold" style={{ color: C.fg }}>
            {s.lastSync}
          </span>
        </p>
        <Btn size="sm" variant="secondary" onClick={run} disabled={busy} aria-busy={busy}>
          <RefreshCw size={14} strokeWidth={SW} className={busy ? "a-spin" : ""} aria-hidden />
          {busy ? "Se sincronizează…" : "Sincronizează"}
        </Btn>
      </div>
    </Card>
  );
}

function Invoices() {
  const { s, notify } = useDemo();
  return (
    <Card>
      <CardHead>Facturi recente</CardHead>
      <ul>
        {s.invoices.slice(0, 5).map((f, i) => (
          <li key={f.no} style={{ borderTop: i ? line : undefined }}>
            <button type="button" onClick={() => notify("Descărcarea facturii e oprită în demo.")} className="row flex w-full items-center gap-3 px-4 py-2.5 text-left">
              <FileText size={16} strokeWidth={SW} className="shrink-0" style={{ color: C.mutedFg }} aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] font-medium">{f.company}</span>
                <span className="block text-[12.5px]" style={{ color: C.mutedFg }}>
                  {f.no} · {f.time}
                </span>
              </span>
              <span className="shrink-0 text-[13.5px] font-semibold">{dec(f.value)} lei</span>
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}
