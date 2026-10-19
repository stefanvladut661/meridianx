"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, Check, ChevronRight, CircleHelp, Loader2, LogOut, MapPin, Menu, Navigation, QrCode } from "lucide-react";
import { FakeQR, StatusBar, num } from "../kit";
import {
  C,
  REWARDS,
  STATIONS,
  baseHistory,
  clockLabel,
  dateLabel,
  fuelLabel,
  fuelWord,
  rewardById,
  stationName,
  type Voucher,
} from "./data";
import { StationsMap } from "./map";
import { me, useDemo, type CustTab } from "./store";
import { Badge, Bars, Btn, Card, CardHead, CloseBtn, Logo, Mark, Meta, MetricStrip, NavTabs, Overlay, Pills, RewardGlyph, SW, de, litri, nr } from "./ui";

/* ============================================================
   Aplicația clientului: acasă, recompense, vouchere, istoric.
   Pe telefon e copia fidelă a aplicației reale (max-w-md);
   pe desktop, aceeași identitate pe un layout de ecran lat.
   ============================================================ */

type Panel = "how" | "stations" | "menu" | null;

const YOU: [number, number] = [272, 247];
const KM_PER_UNIT = 0.057;
function stationsByDistance() {
  return STATIONS.map((s) => ({ s, km: Math.hypot(s.x - YOU[0], s.y - YOU[1]) * KM_PER_UNIT })).sort((a, b) => a.km - b.km);
}
const kmLabel = (km: number) => `${km.toLocaleString("ro-RO", { maximumFractionDigits: 1, minimumFractionDigits: 1 })} km`;

export function nextReward(points: number) {
  return REWARDS.find((r) => r.points > points) ?? null;
}

const line = `1px solid ${C.border}`;

/* ---------------- shell ---------------- */

export function ClientShell({ screen, children }: { screen: "home" | "recompense"; children: (open: (p: Panel) => void) => ReactNode }) {
  const { mobile, s, go, notify, setCustTab } = useDemo();
  const [panel, setPanel] = useState<Panel>(null);
  const m = me(s);
  const close = () => setPanel(null);
  const toTab = (t: CustTab) => {
    setCustTab(t);
    go("recompense");
    close();
  };

  const menuItems: { label: string; on: () => void }[] = [
    { label: "Acasă", on: () => { go("home"); close(); } },
    { label: "Vouchere", on: () => toTab("vouchere") },
    { label: "Istoric alimentări", on: () => toTab("istoric") },
    { label: "Recompense", on: () => toTab("recompense") },
    { label: "Cum funcționează", on: () => setPanel("how") },
    { label: "Stațiile noastre", on: () => setPanel("stations") },
  ];

  const menuBtn = (
    <button type="button" aria-label="Meniu" onClick={() => setPanel("menu")} className="ico flex size-11 items-center justify-center rounded-full" style={{ color: C.fg }}>
      <Menu size={24} strokeWidth={SW} />
    </button>
  );

  return (
    <div className="absolute inset-0 flex flex-col bg-white">
      {mobile ? (
        <>
          <StatusBar tone="dark" bg="#fff" time={clockLabel(s.clock)} />
          {screen === "home" ? (
            <header className="flex h-14 shrink-0 items-center justify-between pl-4 pr-2" style={{ borderBottom: line }}>
              <Logo size={30} />
              {menuBtn}
            </header>
          ) : (
            <header className="flex h-14 shrink-0 items-center gap-1 px-2" style={{ borderBottom: line }}>
              <button type="button" aria-label="Înapoi" onClick={() => go("home")} className="ico flex size-11 items-center justify-center rounded-full" style={{ color: C.fg }}>
                <ArrowLeft size={22} strokeWidth={SW} />
              </button>
              <h1 className="min-w-0 flex-1 truncate text-[17px] font-semibold">Recompensele mele</h1>
              {menuBtn}
            </header>
          )}
        </>
      ) : (
        <header className="flex h-16 shrink-0 items-stretch gap-8 px-8" style={{ borderBottom: line }}>
          <button type="button" onClick={() => go("home")} aria-label="Acasă" className="self-center rounded-[8px]">
            <Logo size={32} />
          </button>
          <NavTabs
            label="Aplicația client"
            items={[
              { id: "home", label: "Acasă", on: screen === "home", onClick: () => go("home") },
              { id: "recompense", label: "Recompense", on: screen === "recompense" && s.custTab === "recompense", onClick: () => toTab("recompense") },
              { id: "vouchere", label: "Vouchere", on: screen === "recompense" && s.custTab === "vouchere", onClick: () => toTab("vouchere") },
              { id: "istoric", label: "Istoric", on: screen === "recompense" && s.custTab === "istoric", onClick: () => toTab("istoric") },
              { id: "statii", label: "Stații", on: false, onClick: () => setPanel("stations") },
            ]}
          />
          <span className="ml-auto flex h-9 items-center self-center rounded-full px-3.5 text-[14px] font-semibold" style={{ background: C.muted }}>
            {nr(m.points, "punct", "puncte")}
          </span>
        </header>
      )}

      <div className="relative min-h-0 flex-1">
        {children(setPanel)}
        <PointsToast />
      </div>

      {/* ---------- meniul (sertarul din dreapta, ca în aplicația reală) ---------- */}
      <Overlay open={panel === "menu"} onClose={close} label="Meniu" kind="right">
        <div className="flex h-full flex-col pb-8 pl-6 pr-3 pt-12">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-[17px] font-semibold">{m.name}</p>
            <CloseBtn onClick={close} />
          </div>
          <p className="text-[13px]" style={{ color: C.mutedFg }}>
            {nr(m.points, "punct", "puncte")} · membru din {m.since}
          </p>
          <nav aria-label="Meniu" className="mt-5 flex flex-col pr-3 text-[16px] font-medium">
            {menuItems.map((it) => (
              <button key={it.label} type="button" onClick={it.on} className="py-3 text-left" style={{ borderBottom: line }}>
                {it.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => notify("Deconectarea e oprită în demo.")}
              className="mt-3 flex items-center gap-2 py-3 text-left"
              style={{ color: C.red }}
            >
              <LogOut size={18} strokeWidth={SW} /> Deconectare
            </button>
          </nav>
        </div>
      </Overlay>

      <Overlay open={panel === "how"} onClose={close} label="Cum funcționează" kind={mobile ? "bottom" : "center"} width={480}>
        <HowItWorks onClose={close} />
      </Overlay>

      <Overlay open={panel === "stations"} onClose={close} label="Stațiile noastre" kind={mobile ? "bottom" : "center"} width={880}>
        <StationsPanel onClose={close} />
      </Overlay>
    </div>
  );
}

/* Notificarea „ai primit puncte” — apare în aplicația clientului când
   angajatul (sau alimentarea automată de pe ecranul de start) adaugă litri. */
function PointsToast() {
  const { s, clearToast, mobile } = useDemo();
  const t = s.toast;
  useEffect(() => {
    if (!t) return;
    const id = window.setTimeout(clearToast, 5200);
    return () => window.clearTimeout(id);
  }, [t, clearToast]);
  if (!t) return null;
  return (
    <div
      key={t.id}
      role="status"
      className={`a-in pointer-events-none absolute z-30 flex items-center gap-3 rounded-[12px] p-3 pr-4 text-white ${mobile ? "left-3 right-3 top-3" : "right-8 top-4 w-[360px]"}`}
      style={{ background: C.fg, boxShadow: "0 8px 24px -12px rgba(0,0,0,0.35)" }}
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-[8px] bg-white">
        <Mark size={22} />
      </span>
      <span className="min-w-0">
        <span className="block text-[15px] font-semibold">+{nr(t.points, "punct", "puncte")}</span>
        <span className="block truncate text-[13px] text-white/75">
          {litri(t.litres, 2)} {fuelWord(t.fuel)} · {stationName(t.station)}
        </span>
      </span>
    </div>
  );
}

/* ---------------- ACASĂ ---------------- */

export function Home() {
  const { s, mobile, rm, go, setCustTab, addFuel, autoDone } = useDemo();
  const m = me(s);
  const next = nextReward(m.points);
  const campaign = s.campaigns.find((c) => c.active && !c.draft) ?? null;
  const active = s.vouchers.filter((v) => v.customer === 0 && v.status === "active").length;

  /* o singură dată pe sesiune: clientul e la pompă și primește puncte */
  const fired = useRef(false);
  useEffect(() => {
    if (s.autoDone || rm || fired.current) return;
    fired.current = true;
    const id = window.setTimeout(() => {
      addFuel(0, "benzina", 38.4);
      autoDone();
    }, 3800);
    return () => {
      window.clearTimeout(id);
      fired.current = false;
    };
  }, [s.autoDone, rm, addFuel, autoDone]);

  const toTab = (t: CustTab) => {
    setCustTab(t);
    go("recompense");
  };

  return (
    <ClientShell screen="home">
      {(open) =>
        mobile ? (
          <div className="prs-scroll absolute inset-0">
            <main className="space-y-3 px-4 pb-10 pt-4">
              <Hero points={m.points} next={next} />
              <div className="grid grid-cols-2 gap-3">
                <Tile title="Voucherele mele" note={activeLabel(active)} onClick={() => toTab("vouchere")} />
                <Tile title="Istoric alimentări" onClick={() => toTab("istoric")} />
              </div>
              {campaign && <CampaignBanner title={campaign.title} description={campaign.description} onClick={() => toTab("recompense")} />}
              <RewardsPill onClick={() => toTab("recompense")} />
              <HomeLinks onHow={() => open("how")} onStations={() => open("stations")} />
            </main>
          </div>
        ) : (
          <div className="prs-scroll absolute inset-0">
            <main className="mx-auto max-w-[1216px] px-8 pb-8 pt-6">
              <div className="mb-5 flex items-end justify-between gap-6">
                <div>
                  <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.01em]">Bună, {m.name.split(" ")[0]}</h1>
                  <p className="mt-0.5 text-[13px]" style={{ color: C.mutedFg }}>
                    Membru din {m.since} · {nr(m.visits, "alimentare", "alimentări")}
                  </p>
                </div>
                <button type="button" onClick={() => open("how")} className="link flex items-center gap-1.5 rounded-[6px] text-[13px]">
                  <CircleHelp size={16} strokeWidth={SW} /> Cum funcționează
                </button>
              </div>

              <div className="grid grid-cols-12 gap-5">
                <div className="col-span-5">
                  <Hero points={m.points} next={next} big />
                </div>
                <div className="col-span-7">
                  {campaign ? (
                    <CampaignBanner title={campaign.title} description={campaign.description} onClick={() => toTab("recompense")} big />
                  ) : (
                    <div className="flex h-full min-h-[220px] items-center justify-center rounded-[16px] text-[14px]" style={{ border: `1px dashed ${C.line}`, color: C.mutedFg }}>
                      Nicio campanie activă
                    </div>
                  )}
                </div>

                <div className="col-span-3 flex flex-col gap-5">
                  <Tile title="Voucherele mele" note={activeLabel(active)} onClick={() => toTab("vouchere")} grow />
                  <Tile title="Istoric alimentări" onClick={() => toTab("istoric")} grow />
                </div>

                <div className="col-span-4">
                  <RewardsCard points={m.points} onOpen={() => toTab("recompense")} />
                </div>

                <div className="col-span-5">
                  <div className="relative h-full overflow-hidden rounded-[12px]" style={{ border: line, background: "#F1F0EC" }}>
                    <StationsMap nearest={0} you={YOU} onSelect={() => open("stations")} label="Deschide stația" />
                    <span className="pointer-events-none absolute left-3 top-3 z-10 rounded-full bg-white px-3 py-1 text-[13px] font-medium" style={{ border: line }}>
                      16 stații
                    </span>
                    <Btn variant="secondary" size="sm" onClick={() => open("stations")} className="absolute bottom-3 right-3 z-10">
                      <MapPin size={15} strokeWidth={SW} /> Toate stațiile
                    </Btn>
                  </div>
                </div>
              </div>
            </main>
          </div>
        )
      }
    </ClientShell>
  );
}

const activeLabel = (n: number) => (n === 0 ? undefined : n === 1 ? "1 activ" : `${n} active`);

/* ---------------- piesele ecranului de start ----------------
   Exportate: previzualizarea din Campanii folosește exact aceleași piese. */

export function Hero({ points, next, big = false }: { points: number; next: ReturnType<typeof nextReward>; big?: boolean }) {
  const remaining = next ? next.points - points : 0;
  const progress = next ? Math.min(100, (points / next.points) * 100) : 100;
  return (
    <section
      className={`rounded-[16px] text-white ${big ? "flex h-full min-h-[220px] flex-col justify-between p-6" : "p-5"}`}
      style={{ background: C.red }}
      aria-label="Puncte disponibile"
    >
      <div>
        <p className="text-[13px] font-medium">Puncte disponibile</p>
        <p className={`mt-1 font-semibold leading-none tracking-[-0.02em] ${big ? "text-[56px]" : "text-[48px]"}`}>
          {num(points)} <span className="text-[17px] font-medium tracking-normal">{points === 1 ? "punct" : `${de(points)}puncte`}</span>
        </p>
      </div>
      <div className={big ? "" : "mt-5"}>
        <div className="h-2 w-full overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,0.3)" }}>
          <div className="h-full rounded-full" style={{ width: `${progress}%`, background: C.orange }} />
        </div>
        <p className="mt-2.5 text-[14px]">
          {next ? (
            <>
              Mai ai {nr(remaining, "punct", "puncte")} până la {next.title}
            </>
          ) : (
            "Ai puncte pentru orice recompensă"
          )}
        </p>
      </div>
    </section>
  );
}

export function Tile({ title, note, onClick, grow = false }: { title: string; note?: string; onClick?: () => void; grow?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`row flex min-h-[96px] flex-col justify-between rounded-[12px] bg-white p-4 text-left ${grow ? "flex-1" : ""}`}
      style={{ border: line }}
    >
      <span>
        <span className="block text-[15px] font-semibold leading-snug">{title}</span>
        {note && (
          <span className="mt-0.5 block text-[13px]" style={{ color: C.mutedFg }}>
            {note}
          </span>
        )}
      </span>
      <ChevronRight size={18} strokeWidth={SW} className="self-end" style={{ color: C.mutedFg }} aria-hidden />
    </button>
  );
}

export function CampaignBanner({ title, description, onClick, big = false }: { title: string; description: string; onClick?: () => void; big?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative block w-full rounded-[16px] text-left text-white ${big ? "h-full min-h-[220px] p-7 pr-24" : "p-5 pr-16"}`}
      style={{ background: C.redDeep }}
    >
      <span className="block text-[13px] font-medium">Campania săptămânii</span>
      <span className={`mt-1.5 block break-words font-semibold leading-tight ${big ? "text-[28px]" : "text-[20px]"}`}>{title}</span>
      <span className={`mt-1.5 block ${big ? "max-w-[460px] text-[16px] leading-snug" : "text-[14px] leading-snug"}`}>{description}</span>
      <span
        className={`absolute top-1/2 flex -translate-y-1/2 items-center justify-center rounded-full bg-white ${big ? "right-7 size-12" : "right-4 size-10"}`}
        style={{ color: C.redDeep }}
        aria-hidden
      >
        <ArrowRight size={big ? 22 : 18} strokeWidth={2} />
      </span>
    </button>
  );
}

export function RewardsPill({ onClick }: { onClick?: () => void }) {
  return (
    <Btn onClick={onClick} className="h-[52px] w-full text-[16px]" style={{ borderRadius: 9999 }}>
      Recompensele mele
    </Btn>
  );
}

export function HomeLinks({ onHow, onStations }: { onHow?: () => void; onStations?: () => void }) {
  const items = [
    { label: "Cum funcționează", icon: CircleHelp, on: onHow },
    { label: "Stațiile noastre", icon: MapPin, on: onStations },
  ];
  return (
    <div className="overflow-hidden rounded-[12px] bg-white" style={{ border: line }}>
      {items.map((it, i) => {
        const I = it.icon;
        return (
          <button
            key={it.label}
            type="button"
            onClick={it.on}
            className="row flex h-[52px] w-full items-center gap-3 px-4 text-left"
            style={{ borderTop: i ? line : undefined }}
          >
            <I size={20} strokeWidth={SW} style={{ color: C.mutedFg }} aria-hidden />
            <span className="flex-1 text-[15px] font-medium">{it.label}</span>
            <ChevronRight size={18} strokeWidth={SW} style={{ color: C.mutedFg }} aria-hidden />
          </button>
        );
      })}
    </div>
  );
}

function RewardsCard({ points, onOpen }: { points: number; onOpen: () => void }) {
  const list = REWARDS.filter((r) => r.points <= points).slice(-2).concat(REWARDS.filter((r) => r.points > points).slice(0, 2));
  return (
    <Card className="flex h-full flex-col">
      <CardHead
        right={
          <button type="button" onClick={onOpen} className="link rounded-[6px] text-[13px]">
            Vezi toate
          </button>
        }
      >
        Recompense
      </CardHead>
      <ul className="flex flex-1 flex-col">
        {list.map((r, i) => {
          const can = points >= r.points;
          const pct = Math.min(100, (points / r.points) * 100);
          return (
            <li key={r.id} className="flex flex-1" style={{ borderTop: i ? line : undefined }}>
              <button type="button" onClick={onOpen} className="row flex w-full flex-col justify-center gap-2 px-4 py-2.5 text-left">
                <span className="flex w-full items-center gap-2.5">
                  <span className="shrink-0" style={{ color: C.mutedFg }}>
                    <RewardGlyph icon={r.icon} size={18} />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[14px] font-medium">{r.title}</span>
                  <span className="shrink-0 text-[12.5px] font-medium" style={{ color: can ? C.green : C.mutedFg }}>
                    {can ? "Disponibilă" : `încă ${num(r.points - points)} p`}
                  </span>
                </span>
                {!can && (
                  <span className="ml-[28px] block h-1 overflow-hidden rounded-full" style={{ background: C.muted }}>
                    <span className="block h-full rounded-full" style={{ width: `${pct}%`, background: C.orange }} />
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

/* ---------------- panouri: cum funcționează, stații ---------------- */

/** „1 punct”, „2 puncte”, „1,5 puncte” */
const perLitre = (v: number) => (v === 1 ? "1 punct" : `${String(v).replace(".", ",")} puncte`);

function HowItWorks({ onClose }: { onClose: () => void }) {
  const { s } = useDemo();
  const { benzina, motorina, gpl } = s.ppl;
  const rate =
    benzina === motorina
      ? `Primești ${perLitre(benzina)} pe litru, ${String(gpl).replace(".", ",")} la GPL.`
      : `Primești ${perLitre(benzina)} pe litrul de benzină, ${String(motorina).replace(".", ",")} la motorină și ${String(gpl).replace(".", ",")} la GPL.`;
  const steps = [
    "Alimentează la oricare dintre cele 16 stații.",
    `Spune angajatului numărul de telefon. ${rate}`,
    "Schimbă punctele pe recompense, din aplicație.",
    "Arată codul voucherului la casă.",
  ];
  return (
    <div className="flex max-h-full flex-col">
      <div className="flex items-center justify-between pb-1 pl-5 pr-3 pt-4">
        <h2 className="text-[18px] font-semibold">Cum funcționează</h2>
        <CloseBtn onClick={onClose} />
      </div>
      <ol className="prs-scroll px-5 pb-8">
        {steps.map((t, i) => (
          <li key={i} className="flex gap-3 py-3.5" style={{ borderTop: i ? line : undefined }}>
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold" style={{ border: `1px solid ${C.fg}` }}>
              {i + 1}
            </span>
            <p className="pt-px text-[15px] leading-snug">{t}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}

function StationsPanel({ onClose }: { onClose: () => void }) {
  const { mobile, notify } = useDemo();
  const list = useMemo(stationsByDistance, []);
  const [sel, setSel] = useState<number>(list[0].s.id);
  const selRow = list.find((x) => x.s.id === sel)!;
  const route = () => notify("Navigația spre stație e oprită în demo.");

  const row = (s: (typeof STATIONS)[number], km: number, i: number) => {
    const on = s.id === sel;
    return (
      <li key={s.id}>
        <button
          type="button"
          onClick={() => setSel(s.id)}
          aria-pressed={on}
          className="row flex w-full items-center gap-3 rounded-[8px] px-3 py-2.5 text-left"
          style={on ? { background: C.muted } : undefined}
        >
          <MapPin size={16} strokeWidth={SW} className="shrink-0" style={{ color: on ? C.red : C.mutedFg }} aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[14px] font-medium">{s.name}</span>
            <span className="block text-[12.5px]" style={{ color: C.mutedFg }}>
              {s.town} · {kmLabel(km)}
            </span>
          </span>
          {i === 0 && <Badge tone="outline">Cea mai apropiată</Badge>}
        </button>
      </li>
    );
  };

  const selected = (
    <div className="flex items-center gap-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-semibold">{selRow.s.name}</p>
        <p className="text-[12.5px]" style={{ color: C.mutedFg }}>
          {selRow.s.town} · la {kmLabel(selRow.km)}
        </p>
      </div>
      <Btn size="sm" onClick={route}>
        <Navigation size={14} strokeWidth={SW} /> Traseu
      </Btn>
    </div>
  );

  if (mobile)
    return (
      <div className="flex h-[760px] max-h-full flex-col">
        <div className="flex items-center justify-between pb-2 pl-5 pr-3 pt-4">
          <h2 className="text-[18px] font-semibold">Stațiile noastre</h2>
          <CloseBtn onClick={onClose} />
        </div>
        <StationsMap selected={sel} nearest={list[0].s.id} you={YOU} onSelect={setSel} />
        <div className="px-5 py-3" style={{ borderBottom: line }}>
          {selected}
        </div>
        <ul className="prs-scroll flex-1 px-2 pb-8 pt-1">{list.map((x, i) => row(x.s, x.km, i))}</ul>
      </div>
    );

  return (
    <div className="flex h-[640px] max-h-full flex-col">
      <div className="flex items-center justify-between pb-3 pl-6 pr-4 pt-4">
        <h2 className="text-[20px] font-semibold">Stațiile noastre</h2>
        <CloseBtn onClick={onClose} />
      </div>
      <div className="flex min-h-0 flex-1 gap-5 px-6 pb-6">
        <div className="flex min-w-0 flex-[1.5] flex-col overflow-hidden rounded-[12px]" style={{ border: line }}>
          <StationsMap selected={sel} nearest={list[0].s.id} you={YOU} onSelect={setSel} />
          <div className="flex flex-1 items-center px-4">
            <div className="w-full">{selected}</div>
          </div>
        </div>
        <ul className="prs-scroll min-w-0 flex-1 pr-1">{list.map((x, i) => row(x.s, x.km, i))}</ul>
      </div>
    </div>
  );
}

/* ---------------- RECOMPENSE / VOUCHERE / ISTORIC ---------------- */

const TITLES: Record<CustTab, string> = { recompense: "Recompensele mele", vouchere: "Voucherele mele", istoric: "Istoric alimentări" };

export function Rewards() {
  const { s, mobile, setCustTab } = useDemo();
  const m = me(s);
  const myVouchers = s.vouchers.filter((v) => v.customer === 0);
  const activeCount = myVouchers.filter((v) => v.status === "active").length;
  const [generated, setGenerated] = useState<string | null>(null);
  const [qr, setQr] = useState<Voucher | null>(null);

  const tabs = (
    <Pills<CustTab>
      label="Secțiuni"
      value={s.custTab}
      onChange={setCustTab}
      stretch={mobile}
      items={[
        { id: "recompense", label: "Recompense" },
        { id: "vouchere", label: "Vouchere", count: activeCount || undefined },
        { id: "istoric", label: "Istoric" },
      ]}
    />
  );

  const body = (
    <>
      {s.custTab === "recompense" && <RewardList points={m.points} onGenerated={setGenerated} />}
      {s.custTab === "vouchere" && <VoucherList vouchers={myVouchers} onOpen={setQr} />}
      {s.custTab === "istoric" && <HistoryList />}
    </>
  );

  return (
    <ClientShell screen="recompense">
      {() => (
        <>
          <div className="prs-scroll absolute inset-0">
            {mobile ? (
              <main className="px-4 pb-10 pt-4">
                {tabs}
                <div className="mt-4">{body}</div>
              </main>
            ) : (
              <main className="mx-auto max-w-[1216px] px-8 pb-8 pt-6">
                <div className="flex items-end justify-between gap-6">
                  <div>
                    <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.01em]">{TITLES[s.custTab]}</h1>
                    {s.custTab === "recompense" && (
                      <p className="mt-0.5 text-[13px]" style={{ color: C.mutedFg }}>
                        Voucherele sunt valabile 90 de zile
                      </p>
                    )}
                  </div>
                  {tabs}
                </div>
                <div className="mt-5">{body}</div>
              </main>
            )}
          </div>

          <Overlay open={!!generated} onClose={() => setGenerated(null)} label="Recompensă revendicată" kind={mobile ? "bottom" : "center"} width={440}>
            {generated && <VoucherDone code={generated} onClose={() => setGenerated(null)} />}
          </Overlay>
          <Overlay open={!!qr} onClose={() => setQr(null)} label="Voucher" kind={mobile ? "bottom" : "center"} width={420}>
            {qr && <VoucherQR v={qr} onClose={() => setQr(null)} />}
          </Overlay>
        </>
      )}
    </ClientShell>
  );
}

function RewardList({ points, onGenerated }: { points: number; onGenerated: (code: string) => void }) {
  const { mobile, redeem } = useDemo();
  const [busy, setBusy] = useState<number | null>(null);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const claim = (id: number) => {
    setBusy(id);
    timer.current = window.setTimeout(() => {
      const code = redeem(id);
      setBusy(null);
      onGenerated(code);
    }, 750);
  };

  return (
    <>
      {mobile && (
        <p className="mb-3 text-[14px]" style={{ color: C.mutedFg }}>
          <span className="font-semibold" style={{ color: C.fg }}>
            {num(points)}
          </span>{" "}
          {points === 1 ? "punct disponibil" : `${de(points)}puncte disponibile`}
        </p>
      )}
      <ul className={mobile ? "space-y-3" : "grid grid-cols-4 gap-4"}>
        {REWARDS.map((r) => {
          const can = points >= r.points;
          const missing = r.points - points;
          return (
            <li key={r.id} className="flex flex-col rounded-[12px] bg-white p-4" style={{ border: line }}>
              <p className="flex items-center gap-2 text-[15px] font-semibold">
                <span className="shrink-0" style={{ color: C.red }}>
                  <RewardGlyph icon={r.icon} size={20} />
                </span>
                {r.title}
              </p>
              <p className="mt-1 text-[13px] font-medium" style={{ color: C.mutedFg }}>
                {nr(r.points, "punct", "puncte")}
              </p>
              <p className="mt-1 text-[13px] leading-snug" style={{ color: C.mutedFg }}>
                {r.description}
              </p>
              <div className={mobile ? "mt-4" : "mt-auto pt-4"}>
                {!can && (
                  <div className="mb-3">
                    <p className="text-[12.5px]" style={{ color: C.mutedFg }}>
                      Încă {nr(missing, "punct", "puncte")}
                    </p>
                    <div className="mt-1.5 h-1 overflow-hidden rounded-full" style={{ background: C.muted }}>
                      <div className="h-full rounded-full" style={{ width: `${(points / r.points) * 100}%`, background: C.orange }} />
                    </div>
                  </div>
                )}
                <Btn variant="outline" className="w-full" disabled={!can || busy !== null} onClick={() => claim(r.id)}>
                  {busy === r.id ? (
                    <>
                      <Loader2 size={16} strokeWidth={SW} className="a-spin" /> Se generează…
                    </>
                  ) : (
                    "Revendică"
                  )}
                </Btn>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}

function statusOf(v: Voucher) {
  return v.status === "used" ? "Folosit" : v.status === "expired" ? "Expirat" : "Activ";
}

function voucherDate(v: Voucher) {
  return v.status === "used" && v.usedAt ? `Folosit pe ${v.usedAt}` : v.status === "expired" ? `Expirat pe ${v.expires}` : `Expiră pe ${v.expires}`;
}

function VoucherList({ vouchers, onOpen }: { vouchers: Voucher[]; onOpen: (v: Voucher) => void }) {
  const { mobile, setCustTab } = useDemo();
  if (!vouchers.length)
    return (
      <div className="rounded-[12px] px-6 py-10 text-center" style={{ border: `1px dashed ${C.line}` }}>
        <p className="text-[15px] font-semibold">Nu ai vouchere încă</p>
        <Btn className="mt-4" onClick={() => setCustTab("recompense")}>
          Alege o recompensă
        </Btn>
      </div>
    );
  return (
    <ul className={mobile ? "space-y-3" : "grid grid-cols-3 gap-4"}>
      {vouchers.map((v) => {
        const on = v.status === "active";
        return (
          <li key={v.code}>
            <button type="button" onClick={() => onOpen(v)} className="row flex w-full flex-col rounded-[12px] bg-white p-4 text-left" style={{ border: line }}>
              <span className="flex w-full items-center justify-between gap-3">
                <span className="truncate text-[14px] font-semibold">{rewardById(v.reward).title}</span>
                {on && <Badge tone="green">Activ</Badge>}
              </span>
              <span className="mono mt-1 block truncate text-[16px] font-medium" style={{ color: on ? C.fg : C.mutedFg }}>
                {v.code}
              </span>
              <span className="mt-3 flex w-full items-center justify-between gap-3 text-[13px]" style={{ color: C.mutedFg }}>
                <span>{voucherDate(v)}</span>
                {on && (
                  <span className="flex items-center gap-1 font-semibold" style={{ color: C.red }}>
                    <QrCode size={14} strokeWidth={SW} /> Arată codul
                  </span>
                )}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function codeSeed(code: string) {
  let h = 7;
  for (const ch of code) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

function VoucherDone({ code, onClose }: { code: string; onClose: () => void }) {
  const { s, mobile, setCustTab, go, pickVoucher } = useDemo();
  const v = s.vouchers.find((x) => x.code === code);
  const rw = v ? rewardById(v.reward) : null;
  return (
    <div className="flex flex-col">
      <div className="flex items-start justify-between pl-5 pr-3 pt-4">
        <span className="mt-1 flex size-10 items-center justify-center rounded-full" style={{ background: C.greenBg, color: C.green }}>
          <Check size={20} strokeWidth={2.25} aria-hidden />
        </span>
        <CloseBtn onClick={onClose} />
      </div>
      <div className="px-5 pt-3">
        <p className="text-[13px]" style={{ color: C.mutedFg }}>
          Recompensă revendicată
        </p>
        <p className="text-[20px] font-semibold leading-tight">{rw?.title}</p>
      </div>
      <div className="flex flex-col items-center px-5 pb-6 pt-5">
        <div className="rounded-[12px] bg-white p-3" style={{ border: line }}>
          <FakeQR size={150} color={C.fg} seed={codeSeed(code)} />
        </div>
        <p className="mono mt-4 text-[20px] font-semibold">{code}</p>
        <p className="mt-1 text-center text-[13.5px]" style={{ color: C.mutedFg }}>
          Arată codul la casă. Expiră pe {v?.expires}.
        </p>
        <div className={`mt-5 grid w-full gap-3 ${mobile ? "grid-cols-1" : "grid-cols-2"}`}>
          <Btn
            variant="secondary"
            className={mobile ? "order-2" : ""}
            onClick={() => {
              setCustTab("vouchere");
              onClose();
            }}
          >
            Vezi voucherele
          </Btn>
          <Btn
            className={mobile ? "order-1" : ""}
            onClick={() => {
              pickVoucher(code);
              go("statie");
            }}
          >
            Validează în stație
          </Btn>
        </div>
      </div>
    </div>
  );
}

function VoucherQR({ v, onClose }: { v: Voucher; onClose: () => void }) {
  const { go, pickVoucher } = useDemo();
  const on = v.status === "active";
  return (
    <div className="flex flex-col items-center pb-6 pl-5 pr-3 pt-4">
      <div className="flex w-full items-center justify-between gap-3">
        <p className="truncate text-[16px] font-semibold">{rewardById(v.reward).title}</p>
        <CloseBtn onClick={onClose} />
      </div>
      <div className="mr-2 flex w-full flex-col items-center">
        <div className="relative mt-3 rounded-[12px] bg-white p-3" style={{ border: line }}>
          <FakeQR size={180} color={on ? C.fg : "#C4C4C4"} seed={codeSeed(v.code)} />
          {!on && (
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="rounded-full bg-white px-3.5 py-1 text-[14px] font-semibold" style={{ border: `1px solid ${C.fg}` }}>
                {statusOf(v)}
              </span>
            </span>
          )}
        </div>
        <p className="mono mt-4 text-[20px] font-semibold" style={{ color: on ? C.fg : C.mutedFg }}>
          {v.code}
        </p>
        <p className="mt-1 text-[13.5px]" style={{ color: C.mutedFg }}>
          {voucherDate(v)}
        </p>
        {on && (
          <Btn
            className="mt-5 w-full"
            size="lg"
            onClick={() => {
              pickVoucher(v.code);
              go("statie");
            }}
          >
            Validează în stație
          </Btn>
        )}
      </div>
    </div>
  );
}

function HistoryList() {
  const { s, mobile } = useDemo();
  const m = me(s);
  const items = [...(s.extra[0] ?? []), ...baseHistory(m)].filter((h) => !h.note);
  const month = items.filter((h) => h.day <= 22);
  const monthL = month.reduce((a, h) => a + h.litres, 0);
  const monthP = month.reduce((a, h) => a + h.points, 0);

  const summary = (
    <section>
      <h2 className="mb-2 text-[13px] font-semibold">Septembrie</h2>
      <MetricStrip
        cols={3}
        size="md"
        items={[
          { label: "Alimentări", value: num(month.length) },
          { label: "Litri", value: monthL.toLocaleString("ro-RO", { maximumFractionDigits: 1, minimumFractionDigits: 1 }) },
          { label: "Puncte", value: `+${num(monthP)}` },
        ]}
      />
    </section>
  );

  const list = (
    <Card>
      <ul>
        {items.map((h, i) => (
          <li key={h.id} className={`flex items-center justify-between gap-3 px-4 py-3 ${h.day === 0 ? "a-flash" : ""}`} style={{ borderTop: i ? line : undefined }}>
            <div className="min-w-0">
              <p className="truncate text-[14px] font-medium">{stationName(h.station)}</p>
              <p className="text-[12.5px]" style={{ color: C.mutedFg }}>
                {h.day === 0 ? `Azi, ${h.time}` : `${dateLabel(h.day)}, ${h.time}`}
              </p>
            </div>
            <div className="shrink-0 text-right text-[13px]">
              <p>
                {litri(h.litres, 1)} · {fuelLabel(h.fuel)}
              </p>
              <p className="font-semibold">+{h.points} p</p>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );

  if (mobile)
    return (
      <div className="space-y-4">
        {summary}
        {list}
      </div>
    );

  const months = [212, 286, 331, 298, Math.round(monthL)];
  return (
    <div className="grid grid-cols-12 gap-6">
      <div className="col-span-7">{list}</div>
      <aside className="col-span-5 space-y-4">
        {summary}
        <Card>
          <CardHead right={<Meta>mai–sept.</Meta>}>Litri pe lună</CardHead>
          <div className="px-4 pb-3 pt-2">
            <Bars values={months} labels={["mai", "iun.", "iul.", "aug.", "sept."]} highlight={4} height={130} format={(n) => litri(n, 0)} ticks />
          </div>
        </Card>
      </aside>
    </div>
  );
}
