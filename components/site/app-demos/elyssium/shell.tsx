"use client";

import { useState, type ReactNode } from "react";
import {
  BadgeCheck,
  Bell,
  CreditCard,
  Dumbbell,
  FolderOpen,
  House,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  MessageCircle,
  Radio,
  Settings,
  Smartphone,
  User,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { StatusBar } from "../kit";
import { C, STAFF_EU, ora, ziSapt, dataLunga } from "./data";
import { useDemo } from "./store";
import { Avatar, LiveDot, Wordmark, focus, scrollY, useAnim } from "./ui";

/* ============================================================
   Ramele: panoul staff (sidebar + bara de sus, ca LayoutStaff.tsx)
   și aplicația client (tab-urile din (tabs)/_layout.tsx).
   ============================================================ */

type Item = { k: string; eticheta: string; icon: LucideIcon; screen?: string; badge?: number; msg?: string };

const MENIU: Item[] = [
  { k: "dashboard", eticheta: "Dashboard", icon: LayoutDashboard, screen: "dashboard" },
  { k: "receptie", eticheta: "Scanări live", icon: Radio, screen: "receptie" },
  { k: "clienti", eticheta: "Clienți", icon: Users, screen: "clienti" },
  {
    k: "verificari",
    eticheta: "Verificări",
    icon: BadgeCheck,
    badge: 2,
    msg: "Verificările nu sunt incluse în demo. În aplicația reală, recepția aprobă aici carnetele de student și legitimațiile MAI/MApN trimise din telefon.",
  },
  {
    k: "abonamente",
    eticheta: "Abonamente",
    icon: CreditCard,
    msg: "Vederea de ansamblu a abonamentelor nu e inclusă în demo. În aplicația reală arată cine expiră în 7 zile și cine n-a reînnoit.",
  },
  { k: "anunturi", eticheta: "Anunțuri", icon: Megaphone, screen: "anunturi" },
  { k: "facturi", eticheta: "Rapoarte", icon: FolderOpen, screen: "facturi" },
  {
    k: "setari",
    eticheta: "Setări",
    icon: Settings,
    msg: "Setările nu sunt incluse în demo. În aplicația reală se editează aici prețurile, cota TVA, programul, codul QR de la recepție și seria de facturi.",
  },
];

function Meniu({ activ, onAles }: { activ: string; onAles?: () => void }) {
  const { go, notify } = useDemo();
  return (
    <nav aria-label="Meniul panoului" className="flex flex-col gap-1">
      {MENIU.map((it) => {
        const on = it.k === activ;
        const Icon = it.icon;
        return (
          <button
            key={it.k}
            type="button"
            aria-current={on ? "page" : undefined}
            onClick={() => {
              onAles?.();
              if (it.screen) go(it.screen);
              else if (it.msg) notify(it.msg);
            }}
            className={`flex items-center gap-2.5 rounded-[12px] px-3 py-2.5 text-left transition-colors duration-150 ${on ? "" : "hover:bg-[#FAFAF8]"} ${focus}`}
            style={{
              background: on ? C.fMov : undefined,
              color: on ? C.mov : C.text,
              fontWeight: on ? 600 : 500,
              fontSize: 15,
            }}
          >
            <Icon size={18} strokeWidth={on ? 2.2 : 1.8} style={{ color: on ? C.mov : C.text2 }} />
            <span className="flex-1">{it.eticheta}</span>
            {it.badge && (
              <span className="rounded-full px-1.5 text-[11px] font-bold leading-[18px]" style={{ background: C.coral, color: "#fff", minWidth: 18, textAlign: "center" }}>
                {it.badge}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}

function SpreClient({ onAles }: { onAles?: () => void }) {
  const { go } = useDemo();
  return (
    <button
      type="button"
      onClick={() => {
        onAles?.();
        go("acasa");
      }}
      className={`mt-auto flex items-center gap-2.5 rounded-[12px] px-3 py-2.5 text-left hover:bg-[#FAFAF8] ${focus}`}
      style={{ border: `1px dashed ${C.contur}`, fontSize: 13.5, color: C.text2 }}
    >
      <Smartphone size={17} style={{ color: C.mov }} />
      <span>
        <span className="block font-semibold" style={{ color: C.text }}>
          Aplicația clientului
        </span>
        cum arată pe telefon
      </span>
    </button>
  );
}

export function StaffShell({ activ, children }: { activ: string; children: ReactNode }) {
  const { mobile, st, notify } = useDemo();
  const a = useAnim();
  const [deschis, setDeschis] = useState(false);
  const logout = () => notify("În demo, deconectarea e oprită. În aplicația reală, sesiunea recepției se închide pe acest calculator.");

  if (mobile) {
    return (
      <div className="relative flex h-full flex-col" style={{ background: C.fundal }}>
        <StatusBar tone="dark" bg={C.card} />
        <header className="flex h-[54px] shrink-0 items-center gap-2 px-3" style={{ background: C.card, borderBottom: `1px solid ${C.contur}` }}>
          <button
            type="button"
            aria-label="Deschide meniul"
            aria-expanded={deschis}
            onClick={() => setDeschis(true)}
            className={`flex size-10 items-center justify-center rounded-[12px] hover:bg-[#F3F4F6] ${focus}`}
          >
            <Menu size={22} color={C.text} />
          </button>
          <Wordmark size={18} suffix="STAFF" />
          <span className="ml-auto flex items-center gap-1.5 rounded-full px-2.5 py-1" style={{ background: C.fActiv, color: C.succes, fontSize: 12, fontWeight: 700 }}>
            <LiveDot size={7} />
            {st.inSala} în sală
          </span>
        </header>
        <div className={`min-h-0 flex-1 ${scrollY}`}>
          <div className="px-4 pb-10 pt-4">{children}</div>
        </div>

        {deschis && (
          <div className="absolute inset-0 z-40">
            <button
              type="button"
              aria-label="Închide meniul"
              tabIndex={-1}
              className={`absolute inset-0 ${a("fade")}`}
              style={{ background: "rgba(17,24,39,0.4)" }}
              onClick={() => setDeschis(false)}
            />
            <aside
              className={`absolute inset-y-0 left-0 flex w-[286px] flex-col gap-1 px-4 pb-8 ${a("drawer")}`}
              style={{ background: C.card, paddingTop: 56, boxShadow: "0 20px 50px rgba(17,24,39,0.2)" }}
              onKeyDown={(e) => e.key === "Escape" && setDeschis(false)}
            >
              <div className="mb-5 flex items-center justify-between px-2">
                <Wordmark size={22} suffix="WELLNESS · STAFF" />
                <button type="button" aria-label="Închide meniul" onClick={() => setDeschis(false)} className={`flex size-9 items-center justify-center rounded-[10px] hover:bg-[#F3F4F6] ${focus}`}>
                  <X size={20} color={C.text2} />
                </button>
              </div>
              <Meniu activ={activ} onAles={() => setDeschis(false)} />
              <SpreClient onAles={() => setDeschis(false)} />
              <div className="mt-3 flex items-center gap-2.5 px-2">
                <Avatar prenume="Ioana" nume="Radu" tint={3} size={32} />
                <span className="flex-1 text-[14px] font-semibold">{STAFF_EU}</span>
                <button type="button" onClick={logout} aria-label="Deconectare" className={`flex size-9 items-center justify-center rounded-[10px] hover:bg-[#FDECEC] ${focus}`}>
                  <LogOut size={17} color={C.text2} />
                </button>
              </div>
            </aside>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-full" style={{ background: C.fundal }}>
      <aside className="flex w-[232px] shrink-0 flex-col gap-1 px-4 pb-5 pt-6" style={{ background: C.card, borderRight: `1px solid ${C.contur}` }}>
        <div className="mb-6 px-2">
          <Wordmark size={22} suffix="WELLNESS · STAFF" />
        </div>
        <Meniu activ={activ} />
        <SpreClient />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-[58px] shrink-0 items-center gap-4 px-6" style={{ background: C.card, borderBottom: `1px solid ${C.contur}` }}>
          <span style={{ fontSize: 14, color: C.text2 }}>
            <span className="font-semibold capitalize" style={{ color: C.text }}>
              {ziSapt(0)}
            </span>
            , {dataLunga(0)} · <span style={{ fontVariantNumeric: "tabular-nums" }}>{ora(st.now)}</span>
          </span>
          <span className="flex items-center gap-2 rounded-full px-3 py-1" style={{ background: C.fActiv, color: C.succes, fontSize: 13, fontWeight: 600 }}>
            <LiveDot size={7} />
            <span style={{ fontVariantNumeric: "tabular-nums" }}>{st.inSala}</span> oameni în sală acum
          </span>
          <div className="ml-auto flex items-center gap-3">
            <Avatar prenume="Ioana" nume="Radu" tint={3} size={32} />
            <span className="text-[14.5px] font-semibold">{STAFF_EU}</span>
            <button
              type="button"
              onClick={logout}
              className={`rounded-[12px] px-3.5 py-2 text-[14px] font-semibold transition-colors hover:text-[#DC2626] hover:[box-shadow:inset_0_0_0_1.5px_#DC2626] ${focus}`}
              style={{ color: C.text2, boxShadow: `inset 0 0 0 1.5px ${C.contur}` }}
            >
              Deconectare
            </button>
          </div>
        </header>
        <main className={`min-h-0 flex-1 ${scrollY}`}>{children}</main>
      </div>
    </div>
  );
}

/** Titlul de pagină din panou: h1 26px + acțiuni în dreapta. */
export function AntetPagina({ titlu, sub, children }: { titlu: string; sub?: ReactNode; children?: ReactNode }) {
  const { mobile } = useDemo();
  return (
    <div className={`flex ${mobile ? "flex-col items-start gap-3" : "items-end justify-between gap-4"} mb-5`}>
      <div className="min-w-0">
        <h1 style={{ fontSize: mobile ? 24 : 26, fontWeight: 700, color: C.text, lineHeight: 1.2 }}>{titlu}</h1>
        {sub && <p style={{ fontSize: 14, color: C.text2, marginTop: 4 }}>{sub}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

/* ---------------- aplicația client ---------------- */

const TABURI = [
  { k: "acasa", eticheta: "Acasă", icon: House },
  { k: "abonament", eticheta: "Abonament", icon: CreditCard },
  { k: "antrenamente", eticheta: "Antrenamente", icon: Dumbbell },
  { k: "social", eticheta: "Social", icon: MessageCircle, badge: 3 },
  { k: "profil", eticheta: "Profil", icon: User },
];

export function ClientShell({
  children,
  onTab,
}: {
  children: ReactNode;
  onTab: (k: string) => void;
}) {
  const { mobile, notify } = useDemo();
  if (mobile) {
    return (
      <div className="relative flex h-full flex-col" style={{ background: C.fundal }}>
        <StatusBar tone="dark" bg={C.fundal} />
        <div className={`min-h-0 flex-1 ${scrollY}`}>{children}</div>
        <nav
          aria-label="Tab-urile aplicației"
          className="flex shrink-0 items-start justify-around px-1 pt-2"
          style={{ background: C.card, borderTop: `1px solid ${C.contur}`, paddingBottom: 28 }}
        >
          {TABURI.map((t) => {
            const on = t.k === "acasa";
            const Icon = t.icon;
            return (
              <button
                key={t.k}
                type="button"
                aria-current={on ? "page" : undefined}
                onClick={() => onTab(t.k)}
                className={`relative flex w-[74px] flex-col items-center gap-1 rounded-[10px] py-0.5 ${focus}`}
                style={{ color: on ? C.mov : C.text2 }}
              >
                <Icon size={24} strokeWidth={on ? 2.3 : 1.7} fill={on && t.k === "acasa" ? C.fMov : "none"} />
                <span style={{ fontSize: 11, fontWeight: 500 }}>{t.eticheta}</span>
                {t.badge && (
                  <span className="absolute left-[42px] top-[-3px] rounded-full px-1 text-[10px] font-bold leading-4" style={{ background: C.coral, color: "#fff", minWidth: 16, textAlign: "center" }}>
                    {t.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    );
  }
  return (
    <div className="flex h-full flex-col" style={{ background: C.fundal }}>
      <header className="flex h-[66px] shrink-0 items-center gap-6 px-8" style={{ background: C.card, borderBottom: `1px solid ${C.contur}` }}>
        <Wordmark size={21} />
        <nav aria-label="Secțiunile aplicației" className="ml-6 flex items-center gap-1">
          {TABURI.map((t) => {
            const on = t.k === "acasa";
            const Icon = t.icon;
            return (
              <button
                key={t.k}
                type="button"
                aria-current={on ? "page" : undefined}
                onClick={() => onTab(t.k)}
                className={`relative flex items-center gap-2 rounded-full px-3.5 py-2 text-[14.5px] transition-colors ${on ? "" : "hover:bg-[#F3F4F6]"} ${focus}`}
                style={{ background: on ? C.fMov : undefined, color: on ? C.mov : C.text2, fontWeight: on ? 600 : 500 }}
              >
                <Icon size={17} strokeWidth={on ? 2.2 : 1.8} />
                {t.eticheta}
                {t.badge && (
                  <span className="rounded-full px-1.5 text-[10.5px] font-bold leading-4" style={{ background: C.coral, color: "#fff" }}>
                    {t.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <button
            type="button"
            aria-label="Notificări, 2 necitite"
            onClick={() => notify("În demo, clopoțelul nu se deschide. În aplicația reală, aici apar anunțurile sălii și reamintirea cu 3 zile înainte de expirare.")}
            className={`relative flex size-10 items-center justify-center rounded-full hover:bg-[#F3F4F6] ${focus}`}
          >
            <Bell size={21} color={C.mov} fill={C.fMov} />
            <span className="absolute right-1 top-1 flex size-[17px] items-center justify-center rounded-full text-[10px] font-bold" style={{ background: C.coral, color: "#fff" }}>
              2
            </span>
          </button>
          <Avatar prenume="Andrei" nume="Mocanu" size={36} />
        </div>
      </header>
      <div className={`min-h-0 flex-1 ${scrollY}`}>{children}</div>
    </div>
  );
}
