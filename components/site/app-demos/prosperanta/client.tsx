"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Menu,
  MapPin,
  LogOut,
  Shield,
  Wrench,
  Fuel as FuelIcon,
  Navigation,
  Check,
  QrCode,
  Sparkles,
  Gift,
  Clock,
  Loader2,
  X,
} from "lucide-react";
import { FakeQR, StatusBar, num } from "../kit";
import {
  C,
  REWARDS,
  STATIONS,
  baseHistory,
  dateLabel,
  fuelLabel,
  rewardById,
  stationName,
  type Voucher,
} from "./data";
import { StationsMap } from "./map";
import { me, useDemo, type CustTab } from "./store";
import { Bars, Btn, CloseBtn, Logo, Overlay, Pills, RewardGlyph, RoleSwitch, Roll, de, litri, nr } from "./ui";

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

function nextReward(points: number) {
  return REWARDS.find((r) => r.points > points) ?? null;
}

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

  return (
    <div className="absolute inset-0 flex flex-col bg-white">
      {mobile ? (
        <>
          <StatusBar tone="dark" bg="#fff" />
          {screen === "home" ? (
            <header className="flex h-[62px] shrink-0 items-center justify-between px-5" style={{ borderBottom: `1px solid ${C.border}` }}>
              <Logo size={34} />
              <button type="button" aria-label="Meniu" onClick={() => setPanel("menu")} className="-mr-2 flex size-11 items-center justify-center rounded-full">
                <Menu size={28} strokeWidth={2.2} />
              </button>
            </header>
          ) : (
            <header className="flex h-[62px] shrink-0 items-center gap-2 px-3" style={{ borderBottom: `1px solid ${C.border}` }}>
              <button type="button" aria-label="Înapoi" onClick={() => go("home")} className="flex size-11 items-center justify-center rounded-full">
                <ArrowLeft size={24} strokeWidth={2.4} />
              </button>
              <h1 className="flex-1 text-[18px] font-black uppercase tracking-[-0.01em]">Recompensele mele</h1>
              <button type="button" aria-label="Meniu" onClick={() => setPanel("menu")} className="flex size-11 items-center justify-center rounded-full">
                <Menu size={24} strokeWidth={2.2} />
              </button>
            </header>
          )}
        </>
      ) : (
        <header className="flex h-[72px] shrink-0 items-center gap-6 px-8" style={{ borderBottom: `1px solid ${C.border}` }}>
          <button type="button" onClick={() => go("home")} aria-label="Acasă" className="rounded-[10px]">
            <Logo size={38} />
          </button>
          <nav aria-label="Aplicația client" className="flex items-center gap-1">
            {[
              { label: "Acasă", on: screen === "home", act: () => go("home") },
              { label: "Recompense", on: screen === "recompense" && s.custTab === "recompense", act: () => toTab("recompense") },
              { label: "Vouchere", on: screen === "recompense" && s.custTab === "vouchere", act: () => toTab("vouchere") },
              { label: "Istoric", on: screen === "recompense" && s.custTab === "istoric", act: () => toTab("istoric") },
              { label: "Stații", on: false, act: () => setPanel("stations") },
            ].map((n) => (
              <button
                key={n.label}
                type="button"
                onClick={n.act}
                aria-current={n.on ? "page" : undefined}
                className="relative h-10 rounded-full px-3.5 text-[13px] font-black uppercase transition-colors hover:bg-[#F5F5F5]"
                style={{ color: n.on ? C.red : C.fg }}
              >
                {n.label}
                {n.on && <span className="absolute inset-x-3.5 -bottom-[15px] h-[3px] rounded-full" style={{ background: C.red }} />}
              </button>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <span className="flex h-10 items-center gap-2 rounded-full px-4 text-[13px] font-black uppercase text-white" style={{ background: C.heroGrad }}>
              <Roll value={m.points} /> puncte
            </span>
            <RoleSwitch face="client" compact />
          </div>
        </header>
      )}

      <div className="relative min-h-0 flex-1">
        {children(setPanel)}
        <PointsToast />
      </div>

      {/* ---------- meniul (sertarul din dreapta, ca în aplicația reală) ---------- */}
      <Overlay open={panel === "menu"} onClose={close} label="Meniu" kind="right">
        <div className="flex h-full flex-col px-6 pb-8 pt-14">
          <div className="flex items-center justify-between">
            <p className="text-[19px] font-black uppercase">{m.name}</p>
            <CloseBtn onClick={close} />
          </div>
          <p className="mt-1 text-[13px]" style={{ color: C.mutedFg }}>
            <Roll value={m.points} /> {de(m.points)}puncte · membru din {m.since}
          </p>
          <nav aria-label="Meniu" className="mt-6 flex flex-col text-[15px] font-bold uppercase">
            {menuItems.map((it) => (
              <button key={it.label} type="button" onClick={it.on} className="py-3 text-left" style={{ borderBottom: `1px solid ${C.border}` }}>
                {it.label}
              </button>
            ))}
            <button type="button" onClick={() => go("statie")} className="flex items-center gap-2 py-3 text-left" style={{ borderBottom: `1px solid ${C.border}` }}>
              <Wrench size={19} strokeWidth={2.4} /> Angajat
            </button>
            <button type="button" onClick={() => go("dashboard")} className="flex items-center gap-2 py-3 text-left" style={{ borderBottom: `1px solid ${C.border}` }}>
              <Shield size={19} strokeWidth={2.4} /> Admin
            </button>
            <button
              type="button"
              onClick={() => notify("În demo, deconectarea e oprită. În aplicația reală, sesiunea se închide și revii la ecranul de conectare.")}
              className="mt-4 flex items-center gap-2 py-3 text-left"
              style={{ color: C.red }}
            >
              <LogOut size={19} strokeWidth={2.4} /> Deconectare
            </button>
          </nav>
        </div>
      </Overlay>

      <Overlay open={panel === "how"} onClose={close} label="Cum funcționează" kind={mobile ? "bottom" : "center"} width={520}>
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
      className={`a-in pointer-events-none absolute z-30 flex items-center gap-3 rounded-[18px] bg-[#1A1A1A] p-3 pr-5 text-white ${
        mobile ? "left-3 right-3 top-3" : "right-8 top-5 w-[380px]"
      }`}
      style={{ boxShadow: "0 18px 40px -12px rgba(0,0,0,.45)" }}
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-[14px]" style={{ background: C.heroGrad }}>
        <FuelIcon size={22} strokeWidth={2.4} />
      </span>
      <span className="min-w-0">
        <span className="block text-[15px] font-black uppercase">+{t.points} puncte</span>
        <span className="block truncate text-[12.5px] text-white/75">
          {litri(t.litres, 2)} {fuelLabel(t.fuel)} · {stationName(t.station)}
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
            <main className="space-y-4 px-4 pb-10 pt-3">
              <Hero points={m.points} next={next} />
              <section className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => toTab("vouchere")}
                  className="flex min-h-[130px] flex-col justify-between rounded-[24px] p-5 text-left text-[14px] font-black uppercase text-white"
                  style={{ background: C.red }}
                >
                  <span>
                    Voucherele mele
                    {active > 0 && (
                      <span className="mt-1.5 block w-fit rounded-full bg-white/20 px-2 py-0.5 text-[10.5px] tracking-[0.04em]">{active === 1 ? "1 activ" : `${active} active`}</span>
                    )}
                  </span>
                  <span className="self-end rounded-full p-2" style={{ background: C.fg }}>
                    <ArrowRight size={16} strokeWidth={2.6} />
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => toTab("istoric")}
                  className="flex min-h-[130px] flex-col justify-between rounded-[24px] bg-white p-5 text-left text-[14px] font-black uppercase"
                  style={{ border: `2px solid ${C.red}`, color: C.red }}
                >
                  Istoric alimentări
                  <span className="self-end rounded-full p-2 text-white" style={{ background: C.red }}>
                    <ArrowRight size={16} strokeWidth={2.6} />
                  </span>
                </button>
              </section>
              {campaign && <CampaignBanner title={campaign.title} description={campaign.description} kind={campaign.kind} onClick={() => toTab("recompense")} />}
              <button
                type="button"
                onClick={() => toTab("recompense")}
                className="block w-full rounded-full px-7 py-5 text-left text-[16px] font-black uppercase text-white"
                style={{ background: C.red }}
              >
                Recompensele mele
              </button>
              <button
                type="button"
                onClick={() => open("how")}
                className="block w-full rounded-full bg-white px-7 py-5 text-left text-[16px] font-black uppercase"
                style={{ border: `2px solid ${C.red}`, color: C.red }}
              >
                Cum funcționează
              </button>
              <button
                type="button"
                onClick={() => open("stations")}
                className="mt-2 flex w-full items-center gap-4 rounded-[24px] p-5 text-left text-[16px] font-black uppercase text-white"
                style={{ background: C.red, boxShadow: C.shadow }}
              >
                <span className="rounded-full bg-white p-2" style={{ color: C.red }}>
                  <MapPin size={24} strokeWidth={2.4} />
                </span>
                <span className="flex-1">Stațiile noastre</span>
                <span className="rounded-full p-2" style={{ background: C.fg }}>
                  <ArrowRight size={16} strokeWidth={2.6} />
                </span>
              </button>
            </main>
          </div>
        ) : (
          <div className="prs-scroll absolute inset-0">
            <main className="mx-auto max-w-[1216px] px-8 pb-8 pt-6">
              <div className="mb-5 flex items-end justify-between">
                <div>
                  <h1 className="text-[30px] font-black uppercase leading-none tracking-[-0.02em]">Bună, {m.name.split(" ")[0]}</h1>
                  <p className="mt-2 text-[14px]" style={{ color: C.mutedFg }}>
                    Membru din {m.since} · {nr(m.visits, "alimentare", "alimentări")} · {litri(m.litres, 0)} în total
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => open("how")}
                  className="flex items-center gap-2 rounded-full px-3 py-2 text-[13px] font-bold transition-colors hover:bg-[#F5F5F5]"
                  style={{ color: C.mutedFg }}
                >
                  <Clock size={15} /> Spune numărul de telefon la casă și primești 1 punct pe litru.
                  <span className="font-black uppercase" style={{ color: C.red }}>Cum funcționează</span>
                </button>
              </div>

              <div className="grid grid-cols-12 gap-5">
                <div className="col-span-5">
                  <Hero points={m.points} next={next} big />
                </div>
                <div className="col-span-7">
                  {campaign ? (
                    <CampaignBanner title={campaign.title} description={campaign.description} kind={campaign.kind} onClick={() => toTab("recompense")} big />
                  ) : (
                    <div className="flex h-full items-center justify-center rounded-[24px] text-[14px]" style={{ border: `2px dashed ${C.border}`, color: C.mutedFg }}>
                      Nicio campanie activă acum. Revino în weekend.
                    </div>
                  )}
                </div>

                <div className="col-span-3 flex flex-col gap-4">
                  <button
                    type="button"
                    onClick={() => toTab("vouchere")}
                    className="flex flex-1 flex-col justify-between rounded-[24px] p-5 text-left text-[15px] font-black uppercase text-white"
                    style={{ background: C.red, minHeight: 148 }}
                  >
                    <span>
                      Voucherele mele
                      <span className="mt-2 block w-fit rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] tracking-[0.04em]">{active === 1 ? "1 activ" : `${active} active`}</span>
                    </span>
                    <span className="self-end rounded-full p-2" style={{ background: C.fg }}>
                      <ArrowRight size={17} strokeWidth={2.6} />
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => toTab("istoric")}
                    className="flex flex-1 flex-col justify-between rounded-[24px] bg-white p-5 text-left text-[15px] font-black uppercase"
                    style={{ border: `2px solid ${C.red}`, color: C.red, minHeight: 148 }}
                  >
                    Istoric alimentări
                    <span className="self-end rounded-full p-2 text-white" style={{ background: C.red }}>
                      <ArrowRight size={17} strokeWidth={2.6} />
                    </span>
                  </button>
                </div>

                <div className="col-span-4">
                  <RewardsAtHand points={m.points} onOpen={() => toTab("recompense")} />
                </div>

                <div className="col-span-5">
                  <div className="relative flex h-full items-center overflow-hidden rounded-[24px]" style={{ border: `2px solid ${C.border}`, background: "#F1F0EC" }}>
                    <StationsMap nearest={0} you={YOU} onSelect={() => open("stations")} label="Deschide stația" />
                    <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between p-4">
                      <span className="rounded-full bg-white px-3.5 py-2 text-[12px] font-black uppercase shadow-[0_4px_12px_rgba(0,0,0,.08)]">
                        Stațiile noastre · 16
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => open("stations")}
                      className="absolute bottom-3 right-3 z-10 flex h-10 items-center gap-2 rounded-full px-4 text-[12px] font-black uppercase text-white"
                      style={{ background: C.red, boxShadow: C.shadow }}
                    >
                      <MapPin size={15} strokeWidth={2.6} /> Toate stațiile
                    </button>
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

function Hero({ points, next, big = false }: { points: number; next: ReturnType<typeof nextReward>; big?: boolean }) {
  const remaining = next ? next.points - points : 0;
  const progress = next ? Math.min(100, (points / next.points) * 100) : 100;
  return (
    <section
      className={`relative overflow-hidden rounded-[24px] text-white ${big ? "flex h-full flex-col justify-between p-7" : "p-6"}`}
      style={{ background: C.heroGrad, boxShadow: C.shadow, minHeight: big ? 250 : undefined }}
      aria-label="Puncte disponibile"
    >
      <div>
        <p className="text-[12px] font-bold uppercase tracking-[0.2em] opacity-90">Puncte disponibile</p>
        <p className={`mt-2 font-black leading-none ${big ? "text-[76px]" : "text-[60px]"}`}>
          <Roll value={points} /> <span className={`${big ? "text-[28px]" : "text-[24px]"} font-extrabold`}>PUNCTE</span>
        </p>
      </div>
      <div>
        <div className="mt-5 h-3 w-full overflow-hidden rounded-full bg-white/30">
          <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${progress}%`, background: C.orange }} />
        </div>
        <p className="mt-3 text-[14px] font-medium opacity-95">
          {next ? (
            <>
              Mai ai <b className="font-black">{remaining}</b> {remaining === 1 ? "punct" : `${de(remaining)}puncte`} până la {next.title}
            </>
          ) : (
            "Ai atins toate recompensele disponibile!"
          )}
        </p>
      </div>
    </section>
  );
}

function CampaignBanner({
  title,
  description,
  kind,
  onClick,
  big = false,
}: {
  title: string;
  description: string;
  kind: string;
  onClick: () => void;
  big?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative block w-full overflow-hidden rounded-[24px] text-left ${big ? "h-full min-h-[250px] p-8 pr-28" : "p-6 pr-20"}`}
      style={{ background: C.campGrad }}
    >
      <span
        className="pointer-events-none absolute -right-4 -top-8 font-black leading-none text-white/[0.09]"
        style={{ fontSize: big ? 230 : 150 }}
        aria-hidden
      >
        {kind === "dublu" ? "×2" : kind === "bonus" ? "+" : "★"}
      </span>
      <span className="relative block text-[12px] font-black uppercase tracking-[0.2em]" style={{ color: C.orange }}>
        Campania săptămânii
      </span>
      <span className={`relative mt-2 block font-black uppercase leading-[1.05] text-white ${big ? "text-[38px]" : "text-[24px]"}`}>{title}</span>
      <span className={`relative mt-2 block text-white/95 ${big ? "max-w-[480px] text-[16px]" : "text-[14px]"}`}>{description}</span>
      <span
        className={`absolute top-1/2 -translate-y-1/2 rounded-full bg-white ${big ? "right-8 p-4" : "right-5 p-3"}`}
        style={{ color: C.red }}
      >
        <ArrowRight size={big ? 24 : 20} strokeWidth={2.6} />
      </span>
    </button>
  );
}

function RewardsAtHand({ points, onOpen }: { points: number; onOpen: () => void }) {
  const list = REWARDS.filter((r) => r.points <= points).slice(-2).concat(REWARDS.filter((r) => r.points > points).slice(0, 2));
  return (
    <section className="flex h-full flex-col rounded-[24px] bg-white p-5" style={{ border: `2px solid ${C.border}` }}>
      <div className="flex items-center justify-between">
        <h2 className="text-[14px] font-black uppercase">Recompense la îndemână</h2>
        <button type="button" onClick={onOpen} className="rounded-full px-2 py-1 text-[12px] font-black uppercase" style={{ color: C.red }}>
          Toate
        </button>
      </div>
      <ul className="mt-3 flex flex-1 flex-col justify-between gap-2">
        {list.map((r) => {
          const can = points >= r.points;
          const pct = Math.min(100, (points / r.points) * 100);
          return (
            <li key={r.id}>
              <button type="button" onClick={onOpen} className="flex w-full items-center gap-3 rounded-[14px] p-2 text-left transition-colors hover:bg-[#FAFAFA]">
                <span
                  className="flex size-10 shrink-0 items-center justify-center rounded-[12px]"
                  style={{ background: can ? C.red : "#FDECEE", color: can ? "#fff" : C.red }}
                >
                  <RewardGlyph icon={r.icon} size={19} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-[13.5px] font-black uppercase">{r.title}</span>
                    <span className="shrink-0 text-[12px] font-black" style={{ color: can ? C.green : C.red }}>
                      {can ? "Disponibil" : `${r.points - points} p`}
                    </span>
                  </span>
                  <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full" style={{ background: C.muted }}>
                    <span className="block h-full rounded-full" style={{ width: `${pct}%`, background: can ? C.green : C.orange }} />
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* ---------------- panouri: cum funcționează, stații ---------------- */

function HowItWorks({ onClose }: { onClose: () => void }) {
  const steps = [
    "Alimentează la oricare dintre cele 16 stații din rețea",
    "Spune angajatului numărul tău de telefon — primești 1 punct pentru fiecare litru",
    "Acumulează puncte și revendică recompense din aplicație",
    "Arată voucherul generat la stație pentru a-l folosi",
  ];
  return (
    <div className="flex max-h-full flex-col">
      <div className="flex items-center justify-between px-6 pb-2 pt-6">
        <h2 className="text-[20px] font-black uppercase">Cum funcționează</h2>
        <CloseBtn onClick={onClose} />
      </div>
      <div className="prs-scroll space-y-3 px-5 pb-9 pt-2">
        {steps.map((t, i) => (
          <div key={t} className="flex gap-4 rounded-[24px] bg-white p-5" style={{ border: `2px solid ${C.border}` }}>
            <span className="flex size-12 shrink-0 items-center justify-center rounded-full text-[20px] font-black text-white" style={{ background: C.red }}>
              {i + 1}
            </span>
            <p className="pt-1.5 text-[15px] font-medium leading-snug">{t}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function StationsPanel({ onClose }: { onClose: () => void }) {
  const { mobile, notify } = useDemo();
  const list = useMemo(stationsByDistance, []);
  const [sel, setSel] = useState<number>(list[0].s.id);
  const selRow = list.find((x) => x.s.id === sel)!;
  const route = () => notify(`În demo, navigația e oprită. În aplicația reală se deschide traseul până la stația ${selRow.s.name}.`);

  const row = (s: (typeof STATIONS)[number], km: number, i: number) => {
    const on = s.id === sel;
    return (
      <li key={s.id}>
        <button
          type="button"
          onClick={() => setSel(s.id)}
          aria-pressed={on}
          className="flex w-full items-center gap-3 rounded-[16px] px-3 py-2.5 text-left transition-colors"
          style={{ background: on ? "#FDECEE" : "transparent" }}
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full text-white" style={{ background: on ? C.fg : C.red }}>
            <MapPin size={17} strokeWidth={2.6} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[14px] font-black uppercase">{s.name}</span>
            <span className="block text-[12.5px]" style={{ color: C.mutedFg }}>
              {s.town} · {kmLabel(km)}
            </span>
          </span>
          {i === 0 && (
            <span className="rounded-full px-2 py-1 text-[10px] font-black uppercase text-white" style={{ background: C.red }}>
              Cea mai apropiată
            </span>
          )}
        </button>
      </li>
    );
  };

  if (mobile)
    return (
      <div className="flex h-[760px] max-h-full flex-col">
        <div className="flex items-center justify-between px-5 pb-3 pt-5">
          <h2 className="text-[20px] font-black uppercase">Stațiile noastre</h2>
          <CloseBtn onClick={onClose} />
        </div>
        <StationsMap selected={sel} nearest={list[0].s.id} you={YOU} onSelect={setSel} />
        <div className="flex items-center gap-3 px-5 py-3" style={{ borderBottom: `1px solid ${C.border}` }}>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-black uppercase">{selRow.s.name}</p>
            <p className="text-[12.5px]" style={{ color: C.mutedFg }}>
              {selRow.s.town} · {kmLabel(selRow.km)} · deschis non-stop
            </p>
          </div>
          <Btn size="sm" onClick={route}>
            <Navigation size={14} strokeWidth={2.6} /> Traseu
          </Btn>
        </div>
        <ul className="prs-scroll flex-1 px-2 pb-8 pt-1">
          {list.map((x, i) => row(x.s, x.km, i))}
        </ul>
      </div>
    );

  return (
    <div className="flex h-[640px] max-h-full flex-col">
      <div className="flex items-center justify-between px-7 pb-4 pt-6">
        <div>
          <h2 className="text-[22px] font-black uppercase">Stațiile noastre</h2>
          <p className="text-[13px]" style={{ color: C.mutedFg }}>
            16 stații în Pitești și în împrejurimi. Punctele se strâng și se folosesc la oricare.
          </p>
        </div>
        <CloseBtn onClick={onClose} />
      </div>
      <div className="flex min-h-0 flex-1 gap-5 px-7 pb-7">
        <div className="flex min-w-0 flex-[1.5] flex-col overflow-hidden rounded-[20px]" style={{ border: `2px solid ${C.border}` }}>
          <StationsMap selected={sel} nearest={list[0].s.id} you={YOU} onSelect={setSel} />
          <div className="flex flex-1 items-center gap-3 px-4">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[16px] font-black uppercase">{selRow.s.name}</p>
              <p className="text-[13px]" style={{ color: C.mutedFg }}>
                {selRow.s.town} · {kmLabel(selRow.km)} de tine · deschis non-stop
              </p>
            </div>
            <Btn size="sm" onClick={route}>
              <Navigation size={14} strokeWidth={2.6} /> Traseu
            </Btn>
          </div>
        </div>
        <ul className="prs-scroll min-w-0 flex-1 pr-1">
          {list.map((x, i) => row(x.s, x.km, i))}
        </ul>
      </div>
    </div>
  );
}

/* ---------------- RECOMPENSE / VOUCHERE / ISTORIC ---------------- */

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
      items={[
        { id: "recompense", label: "Recompense" },
        { id: "vouchere", label: `Vouchere${activeCount ? ` · ${activeCount}` : ""}` },
        { id: "istoric", label: "Istoric" },
      ]}
    />
  );

  return (
    <ClientShell screen="recompense">
      {() => (
        <>
          <div className="prs-scroll absolute inset-0">
            {mobile ? (
              <main className="px-4 pb-10 pt-4">
                {tabs}
                <div className="mt-4">
                  {s.custTab === "recompense" && <RewardList points={m.points} onGenerated={setGenerated} />}
                  {s.custTab === "vouchere" && <VoucherList vouchers={myVouchers} onOpen={setQr} />}
                  {s.custTab === "istoric" && <HistoryList />}
                </div>
              </main>
            ) : (
              <main className="mx-auto max-w-[1216px] px-8 pb-8 pt-6">
                <div className="flex items-end justify-between gap-6">
                  <div>
                    <h1 className="text-[30px] font-black uppercase leading-none tracking-[-0.02em]">
                      {s.custTab === "recompense" ? "Recompensele mele" : s.custTab === "vouchere" ? "Voucherele mele" : "Istoric alimentări"}
                    </h1>
                    <p className="mt-2 text-[14px]" style={{ color: C.mutedFg }}>
                      Ai <b className="font-black" style={{ color: C.fg }}><Roll value={m.points} /></b> {de(m.points)}puncte disponibile. Voucherele sunt valabile 90 de zile, la toate stațiile.
                    </p>
                  </div>
                  {tabs}
                </div>
                <div className="mt-6">
                  {s.custTab === "recompense" && <RewardList points={m.points} onGenerated={setGenerated} />}
                  {s.custTab === "vouchere" && <VoucherList vouchers={myVouchers} onOpen={setQr} />}
                  {s.custTab === "istoric" && <HistoryList />}
                </div>
              </main>
            )}
          </div>

          <Overlay open={!!generated} onClose={() => setGenerated(null)} label="Voucher generat" kind={mobile ? "bottom" : "center"} width={440}>
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
  const { mobile, redeem, setCustTab } = useDemo();
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
          Ai <span className="font-black" style={{ color: C.fg }}><Roll value={points} /></span> {de(points)}puncte disponibile.
        </p>
      )}
      <ul className={mobile ? "space-y-3" : "grid grid-cols-4 gap-4"}>
        {REWARDS.map((r) => {
          const can = points >= r.points;
          const missing = r.points - points;
          return (
            <li
              key={r.id}
              className="flex flex-col rounded-[24px] bg-white p-5"
              style={{ border: `2px solid ${C.border}`, boxShadow: can ? C.shadow : undefined }}
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-[30px] font-black leading-none" style={{ color: C.red }}>
                  {r.points} <span className="text-[13px] uppercase">puncte</span>
                </p>
                <span
                  className="flex size-10 shrink-0 items-center justify-center rounded-[12px]"
                  style={{ background: can ? C.red : "#FDECEE", color: can ? "#fff" : C.red }}
                >
                  <RewardGlyph icon={r.icon} />
                </span>
              </div>
              <p className="mt-2 text-[15px] font-bold uppercase">{r.title}</p>
              <p className="mt-1 text-[13.5px] leading-snug" style={{ color: C.mutedFg }}>
                {r.description}
              </p>
              <div className={mobile ? "" : "mt-auto"}>
                {!can && (
                  <div className="mt-4">
                    <div className="h-1.5 overflow-hidden rounded-full" style={{ background: C.muted }}>
                      <div className="h-full rounded-full" style={{ width: `${(points / r.points) * 100}%`, background: C.orange }} />
                    </div>
                    <p className="mt-1.5 text-[12px] font-bold" style={{ color: C.mutedFg }}>
                      Îți mai trebuie {nr(missing, "punct", "puncte")}
                    </p>
                  </div>
                )}
                <Btn className="mt-4 w-full" size="lg" disabled={!can || busy !== null} onClick={() => claim(r.id)}>
                  {busy === r.id ? (
                    <>
                      <Loader2 size={16} className="a-spin" /> Se generează...
                    </>
                  ) : (
                    "Revendică"
                  )}
                </Btn>
              </div>
            </li>
          );
        })}
        {!mobile && (
          <li className="flex flex-col justify-between rounded-[24px] p-5 text-white" style={{ background: C.campGrad }}>
            <div>
              <p className="text-[12px] font-black uppercase tracking-[0.2em]" style={{ color: C.orange }}>
                Cum strângi mai repede
              </p>
              <p className="mt-2 text-[21px] font-black uppercase leading-[1.1]">GPL: 2 puncte pe litru</p>
              <p className="mt-2 text-[13.5px] leading-snug text-white/95">
                Benzina și motorina aduc 1 punct pe litru. În weekend, punctele se dublează la toate stațiile.
              </p>
            </div>
            <Btn variant="white" size="lg" className="mt-4 w-full" onClick={() => setCustTab("istoric")}>
              Vezi istoricul
            </Btn>
          </li>
        )}
      </ul>
    </>
  );
}

function statusOf(v: Voucher) {
  return v.status === "used" ? "Folosit" : v.status === "expired" ? "Expirat" : "Activ";
}

function VoucherList({ vouchers, onOpen }: { vouchers: Voucher[]; onOpen: (v: Voucher) => void }) {
  const { mobile, setCustTab } = useDemo();
  if (!vouchers.length)
    return (
      <div className="rounded-[24px] p-8 text-center" style={{ border: `2px dashed ${C.border}` }}>
        <p className="font-black uppercase">Nu ai vouchere încă</p>
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
            <button
              type="button"
              onClick={() => onOpen(v)}
              className="a-in flex w-full flex-col rounded-[24px] bg-white p-5 text-left"
              style={{ border: `2px solid ${C.border}`, boxShadow: on ? C.shadow : undefined, opacity: on ? 1 : 0.78 }}
            >
              <span className="flex w-full items-start justify-between gap-3">
                <span className="min-w-0">
                  <span className="block text-[11.5px] font-bold uppercase tracking-[0.08em]" style={{ color: C.mutedFg }}>
                    {rewardById(v.reward).title}
                  </span>
                  <span className="mt-1 block truncate text-[26px] font-black tracking-[0.04em]" style={{ color: on ? C.red : "#9A9A9A" }}>
                    {v.code}
                  </span>
                </span>
                <span
                  className="shrink-0 rounded-full px-3 py-1 text-[11px] font-black uppercase"
                  style={on ? { background: C.orange, color: C.fg } : { background: C.muted, color: C.mutedFg }}
                >
                  {statusOf(v)}
                </span>
              </span>
              <span className="mt-3 flex w-full items-center justify-between text-[12.5px]" style={{ color: C.mutedFg }}>
                <span>{v.status === "used" && v.usedAt ? `Folosit: ${v.usedAt}` : `Expiră: ${v.expires}`}</span>
                {on && (
                  <span className="flex items-center gap-1 font-black uppercase" style={{ color: C.red }}>
                    <QrCode size={14} strokeWidth={2.6} /> Arată codul
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
  const { s, setCustTab, go, pickVoucher } = useDemo();
  const v = s.vouchers.find((x) => x.code === code);
  const rw = v ? rewardById(v.reward) : null;
  return (
    <div className="flex flex-col">
      <div className="relative overflow-hidden rounded-t-[24px] px-6 pb-6 pt-6 text-white" style={{ background: C.heroGrad }}>
        <div className="flex items-start justify-between">
          <span className="flex size-11 items-center justify-center rounded-full bg-white" style={{ color: C.red }}>
            <Check size={24} strokeWidth={3} />
          </span>
          <button type="button" onClick={onClose} aria-label="Închide" className="flex size-10 items-center justify-center rounded-full bg-white/15">
            <X size={20} strokeWidth={2.6} />
          </button>
        </div>
        <p className="mt-4 text-[12px] font-bold uppercase tracking-[0.2em] opacity-90">Voucher generat</p>
        <p className="mt-1 text-[26px] font-black uppercase leading-tight">{rw?.title}</p>
      </div>
      <div className="flex flex-col items-center px-6 pb-8 pt-6">
        <div className="rounded-[18px] bg-white p-3" style={{ border: `2px solid ${C.border}` }}>
          <FakeQR size={150} color={C.fg} seed={codeSeed(code)} />
        </div>
        <p className="mt-4 text-[28px] font-black tracking-[0.05em]" style={{ color: C.red }}>
          {code}
        </p>
        <p className="mt-1 text-center text-[13.5px]" style={{ color: C.mutedFg }}>
          Arată codul la casă, în oricare dintre cele 16 stații. Expiră pe {v?.expires}.
        </p>
        <div className="mt-6 grid w-full grid-cols-2 gap-3">
          <Btn
            variant="outline"
            onClick={() => {
              setCustTab("vouchere");
              onClose();
            }}
          >
            Vouchere
          </Btn>
          <Btn
            onClick={() => {
              pickVoucher(code);
              go("statie");
            }}
          >
            Validează <ArrowRight size={15} strokeWidth={2.6} />
          </Btn>
        </div>
        <p className="mt-3 text-center text-[12px]" style={{ color: C.soft }}>
          „Validează” deschide panoul angajatului, cu codul deja completat.
        </p>
      </div>
    </div>
  );
}

function VoucherQR({ v, onClose }: { v: Voucher; onClose: () => void }) {
  const { go, pickVoucher } = useDemo();
  const on = v.status === "active";
  return (
    <div className="flex flex-col items-center px-6 pb-8 pt-5">
      <div className="flex w-full items-center justify-between">
        <span className="text-[12px] font-bold uppercase tracking-[0.1em]" style={{ color: C.mutedFg }}>
          {rewardById(v.reward).title}
        </span>
        <CloseBtn onClick={onClose} />
      </div>
      <div className="relative mt-2 rounded-[18px] bg-white p-3" style={{ border: `2px solid ${C.border}` }}>
        <FakeQR size={180} color={on ? C.fg : "#BDBDBD"} seed={codeSeed(v.code)} />
        {!on && (
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="rotate-[-12deg] rounded-full bg-white px-4 py-1.5 text-[16px] font-black uppercase" style={{ border: `2px solid ${C.fg}` }}>
              {statusOf(v)}
            </span>
          </span>
        )}
      </div>
      <p className="mt-4 text-[28px] font-black tracking-[0.05em]" style={{ color: on ? C.red : "#9A9A9A" }}>
        {v.code}
      </p>
      <p className="mt-1 text-[13.5px]" style={{ color: C.mutedFg }}>
        {v.status === "used" && v.usedAt ? `Folosit pe ${v.usedAt}` : `Expiră pe ${v.expires}`}
      </p>
      {on && (
        <Btn
          className="mt-6 w-full"
          size="lg"
          onClick={() => {
            pickVoucher(v.code);
            go("statie");
          }}
        >
          Validează ca angajat <ArrowRight size={16} strokeWidth={2.6} />
        </Btn>
      )}
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
    <div className="grid grid-cols-3 gap-2">
      {[
        { l: "Alimentări", v: num(month.length) },
        { l: "Litri", v: litri(monthL, 0) },
        { l: "Puncte", v: `+${num(monthP)}` },
      ].map((x) => (
        <div key={x.l} className="rounded-[16px] p-3" style={{ background: C.muted }}>
          <p className="text-[10.5px] font-bold uppercase tracking-[0.08em]" style={{ color: C.mutedFg }}>
            {x.l}
          </p>
          <p className="mt-0.5 text-[18px] font-black" style={{ color: x.l === "Puncte" ? C.red : C.fg }}>
            {x.v}
          </p>
        </div>
      ))}
    </div>
  );

  const list = (
    <ul className="space-y-3">
      {items.map((h) => (
        <li key={h.id} className="a-in flex items-center justify-between rounded-[16px] bg-white p-4" style={{ border: `2px solid ${C.border}` }}>
          <div className="min-w-0">
            <p className="truncate text-[14px] font-black uppercase">{stationName(h.station)}</p>
            <p className="text-[12px]" style={{ color: C.mutedFg }}>
              {h.day === 0 ? `Azi, ${h.time}` : `${dateLabel(h.day)} ${h.time}`}
            </p>
            <p className="mt-1 text-[14px]">
              {litri(h.litres, 2)} · {fuelLabel(h.fuel)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[26px] font-black leading-none" style={{ color: C.red }}>
              +{h.points}
            </p>
            <p className="mt-1 text-[11px] font-bold uppercase" style={{ color: C.mutedFg }}>
              puncte
            </p>
          </div>
        </li>
      ))}
    </ul>
  );

  if (mobile)
    return (
      <div className="space-y-4">
        <div>
          <p className="mb-2 text-[12px] font-bold uppercase tracking-[0.1em]" style={{ color: C.mutedFg }}>
            Septembrie
          </p>
          {summary}
        </div>
        {list}
      </div>
    );

  const months = [212, 286, 331, 298, Math.round(monthL)];
  return (
    <div className="grid grid-cols-12 gap-6">
      <div className="col-span-7">{list}</div>
      <aside className="col-span-5 space-y-4">
        <div className="rounded-[24px] p-6 text-white" style={{ background: C.heroGrad, boxShadow: C.shadow }}>
          <p className="text-[12px] font-bold uppercase tracking-[0.2em] opacity-90">Septembrie, până azi</p>
          <p className="mt-2 text-[44px] font-black leading-none">
            +{num(monthP)} <span className="text-[18px]">puncte</span>
          </p>
          <p className="mt-2 text-[14px] opacity-95">
            din {litri(monthL, 1)} alimentați în {nr(month.length, "vizită", "vizite")}
          </p>
        </div>
        <div className="rounded-[24px] bg-white p-5" style={{ border: `2px solid ${C.border}` }}>
          <div className="flex items-center justify-between">
            <p className="text-[13px] font-black uppercase">Litri pe lună</p>
            <p className="flex items-center gap-1.5 text-[12px] font-bold" style={{ color: C.mutedFg }}>
              <Sparkles size={13} /> mai – sept.
            </p>
          </div>
          <div className="mt-3">
            <Bars values={months} labels={["Mai", "Iun", "Iul", "Aug", "Sep"]} highlight={4} height={130} format={(n) => litri(n, 0)} />
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-[20px] p-4" style={{ background: C.muted }}>
          <Gift size={20} style={{ color: C.red }} />
          <p className="text-[13px] leading-snug">
            Cea mai vizitată stație: <b className="font-black uppercase">Calea Craiovei</b>, 18 alimentări din 41.
          </p>
        </div>
      </aside>
    </div>
  );
}
