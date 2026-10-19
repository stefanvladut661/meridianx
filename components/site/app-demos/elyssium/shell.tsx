"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
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
  ScanLine,
  Settings,
  User,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { StatusBar } from "../kit";
import { C, STAFF_EU, dataScurta, ora, ziSapt } from "./data";
import { useDemo } from "./store";
import { Avatar, Btn, CIFRE, Punct, Wordmark, focus, scrollY, useAnim } from "./ui";

/* ============================================================
   Ramele: panoul staff (sidebar + bara de sus, ca LayoutStaff.tsx)
   și aplicația client (tab-urile din (tabs)/_layout.tsx).
   ============================================================ */

type Item = { k: string; eticheta: string; icon: LucideIcon; screen?: string; badge?: number; msg?: string };

const MENIU: Item[] = [
  { k: "dashboard", eticheta: "Dashboard", icon: LayoutDashboard, screen: "dashboard" },
  { k: "receptie", eticheta: "Scanări", icon: ScanLine, screen: "receptie" },
  { k: "clienti", eticheta: "Clienți", icon: Users, screen: "clienti" },
  { k: "verificari", eticheta: "Verificări", icon: BadgeCheck, badge: 2, msg: "Verificările nu sunt incluse în demo." },
  { k: "abonamente", eticheta: "Abonamente", icon: CreditCard, msg: "Lista de abonamente nu e inclusă în demo." },
  { k: "anunturi", eticheta: "Anunțuri", icon: Megaphone, screen: "anunturi" },
  { k: "facturi", eticheta: "Rapoarte", icon: FolderOpen, screen: "facturi" },
  { k: "setari", eticheta: "Setări", icon: Settings, msg: "Setările nu sunt incluse în demo." },
];

const LOGOUT = "Deconectarea e oprită în demo.";

function Meniu({ activ, onAles }: { activ: string; onAles?: () => void }) {
  const { go, notify } = useDemo();
  return (
    <nav aria-label="Meniul panoului" className="flex flex-col gap-0.5">
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
            className={`flex items-center gap-2.5 rounded-[8px] px-2.5 py-2 text-left transition-colors duration-150 ${on ? "" : "hover:bg-[#F3F4F6]"} ${focus}`}
            style={{
              background: on ? C.fMov : undefined,
              color: on ? C.mov : C.text,
              fontWeight: on ? 600 : 500,
              fontSize: 14,
              lineHeight: "20px",
            }}
          >
            <Icon size={18} strokeWidth={1.8} aria-hidden style={{ color: on ? C.mov : C.text2 }} />
            <span className="flex-1">{it.eticheta}</span>
            {it.badge && (
              <span
                className="rounded-full px-1.5 text-center"
                style={{ background: C.fMov, color: C.mov, fontSize: 11.5, fontWeight: 600, lineHeight: "18px", minWidth: 20, ...CIFRE }}
              >
                {it.badge}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}

/** Câți oameni sunt acum în sală. Singurul indicator „acum” din panou. */
function InSala() {
  const { st } = useDemo();
  return (
    <span
      className="flex shrink-0 items-center gap-1.5 rounded-[6px] px-2 py-0.5"
      style={{ background: C.fActiv, color: C.succes, fontSize: 13, fontWeight: 600, lineHeight: "20px" }}
    >
      <Punct />
      <span style={CIFRE}>{st.inSala}</span> în sală
    </span>
  );
}

const ziua = () => {
  const z = ziSapt(0);
  return `${z.charAt(0).toUpperCase()}${z.slice(1)}`;
};

export function StaffShell({ activ, children }: { activ: string; children: ReactNode }) {
  const { mobile, st, notify } = useDemo();
  const a = useAnim();
  const [deschis, setDeschis] = useState(false);
  const logout = () => notify(LOGOUT);

  if (mobile) {
    return (
      <div className="relative flex h-full flex-col" style={{ background: C.fundal }}>
        <StatusBar tone="dark" bg={C.card} time={ora(st.now)} />
        <header className="flex h-[52px] shrink-0 items-center gap-2 pl-2 pr-4" style={{ background: C.card, borderBottom: `1px solid ${C.contur}` }}>
          <button
            type="button"
            aria-label="Deschide meniul"
            aria-expanded={deschis}
            onClick={() => setDeschis(true)}
            className={`flex size-10 items-center justify-center rounded-[8px] hover:bg-[#F3F4F6] ${focus}`}
          >
            <Menu size={22} color={C.text} />
          </button>
          <Wordmark size={17} />
          <span className="ml-auto">
            <InSala />
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
              className={`absolute inset-y-0 left-0 flex w-[280px] flex-col px-3 pb-8 ${a("drawer")}`}
              style={{ background: C.card, paddingTop: 56, boxShadow: "0 16px 40px rgba(17,24,39,0.18)" }}
              onKeyDown={(e) => e.key === "Escape" && setDeschis(false)}
            >
              <div className="mb-5 flex items-center justify-between pl-2.5">
                <Wordmark size={20} />
                <button type="button" aria-label="Închide meniul" onClick={() => setDeschis(false)} className={`flex size-9 items-center justify-center rounded-[8px] hover:bg-[#F3F4F6] ${focus}`}>
                  <X size={20} color={C.text2Tare} />
                </button>
              </div>
              <Meniu activ={activ} onAles={() => setDeschis(false)} />
              <div className="mt-auto flex items-center gap-2.5 border-t px-2.5 pt-4" style={{ borderColor: C.contur }}>
                <Avatar prenume="Ioana" nume="Radu" tint={3} size={32} />
                <span className="flex-1" style={{ fontSize: 14, fontWeight: 500 }}>
                  {STAFF_EU}
                </span>
                <button type="button" onClick={logout} aria-label="Deconectare" className={`flex size-9 items-center justify-center rounded-[8px] hover:bg-[#F3F4F6] ${focus}`}>
                  <LogOut size={17} color={C.text2Tare} />
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
      <aside className="flex w-[232px] shrink-0 flex-col px-3 pb-5 pt-5" style={{ background: C.card, borderRight: `1px solid ${C.contur}` }}>
        <div className="mb-6 px-2.5">
          <Wordmark size={21} />
        </div>
        <Meniu activ={activ} />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-[56px] shrink-0 items-center gap-4 px-6" style={{ background: C.card, borderBottom: `1px solid ${C.contur}` }}>
          <span style={{ fontSize: 14, color: C.text2 }}>
            <span style={{ color: C.text, fontWeight: 500 }}>{ziua()}</span>, {dataScurta(0)}
          </span>
          <InSala />
          <div className="ml-auto flex items-center gap-2.5">
            <Avatar prenume="Ioana" nume="Radu" tint={3} size={30} />
            <span style={{ fontSize: 14, fontWeight: 500 }}>{STAFF_EU}</span>
            <Btn v="secundar" mic onClick={logout} className="ml-2">
              Deconectare
            </Btn>
          </div>
        </header>
        <main className={`min-h-0 flex-1 ${scrollY}`}>{children}</main>
      </div>
    </div>
  );
}

/** Titlul de pagină din panou: h1 + acțiunile din dreapta. Spațiul de sub el îl dă pagina. */
export function AntetPagina({ titlu, sub, children }: { titlu: string; sub?: ReactNode; children?: ReactNode }) {
  const { mobile } = useDemo();
  return (
    <div className={`flex ${mobile ? "flex-col items-start gap-3" : `${sub ? "items-end" : "items-center"} justify-between gap-4`}`}>
      <div className="min-w-0">
        <h1 style={{ fontSize: mobile ? 22 : 24, fontWeight: 600, color: C.text, lineHeight: 1.25, letterSpacing: "-0.01em" }}>{titlu}</h1>
        {sub && <p style={{ fontSize: 13.5, color: C.text2, marginTop: 2, ...CIFRE }}>{sub}</p>}
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

/** Bulina de notificări a aplicației client: coral, cu cifra închisă (7:1). */
export function Bulina({ n, className = "", style }: { n: number; className?: string; style?: CSSProperties }) {
  return (
    <span
      aria-hidden
      className={`flex items-center justify-center rounded-full px-1 ${className}`}
      style={{ background: C.coral, color: C.text, fontSize: 10.5, fontWeight: 600, lineHeight: "16px", minWidth: 16, height: 16, ...CIFRE, ...style }}
    >
      {n}
    </span>
  );
}

export const NOTIFICARI = "Notificările nu se deschid în demo.";

export function ClientShell({
  children,
  onTab,
}: {
  children: ReactNode;
  onTab: (k: string) => void;
}) {
  const { mobile, notify, st } = useDemo();
  if (mobile) {
    return (
      <div className="relative flex h-full flex-col" style={{ background: C.fundal }}>
        <StatusBar tone="dark" bg={C.fundal} time={ora(st.now)} />
        <div className={`min-h-0 flex-1 ${scrollY}`}>{children}</div>
        <nav
          aria-label="Tab-urile aplicației"
          className="flex shrink-0 items-start justify-around px-1 pt-1.5"
          style={{ background: C.card, borderTop: `1px solid ${C.contur}`, paddingBottom: 26 }}
        >
          {TABURI.map((t) => {
            const on = t.k === "acasa";
            const Icon = t.icon;
            return (
              <button
                key={t.k}
                type="button"
                aria-current={on ? "page" : undefined}
                aria-label={t.badge ? `${t.eticheta}, ${t.badge} necitite` : undefined}
                onClick={() => onTab(t.k)}
                className={`relative flex w-[74px] flex-col items-center gap-0.5 rounded-[8px] py-1 ${focus}`}
                style={{ color: on ? C.mov : C.text2 }}
              >
                <Icon size={24} strokeWidth={on ? 2.2 : 1.8} fill={on && t.k === "acasa" ? C.fMov : "none"} aria-hidden />
                <span style={{ fontSize: 11, fontWeight: on ? 600 : 500 }}>{t.eticheta}</span>
                {t.badge && <Bulina n={t.badge} className="absolute left-[42px] top-[-1px]" />}
              </button>
            );
          })}
        </nav>
      </div>
    );
  }
  return (
    <div className="flex h-full flex-col" style={{ background: C.fundal }}>
      <header className="flex h-[64px] shrink-0 items-center gap-6 px-8" style={{ background: C.card, borderBottom: `1px solid ${C.contur}` }}>
        <Wordmark size={20} />
        <nav aria-label="Secțiunile aplicației" className="ml-6 flex items-center gap-1">
          {TABURI.map((t) => {
            const on = t.k === "acasa";
            const Icon = t.icon;
            return (
              <button
                key={t.k}
                type="button"
                aria-current={on ? "page" : undefined}
                aria-label={t.badge ? `${t.eticheta}, ${t.badge} necitite` : undefined}
                onClick={() => onTab(t.k)}
                className={`relative flex items-center gap-2 rounded-full px-3.5 py-2 transition-colors duration-150 ${on ? "" : "hover:bg-[#F3F4F6] hover:text-[#111827]"} ${focus}`}
                style={{ background: on ? C.fMov : undefined, color: on ? C.mov : C.text2Tare, fontWeight: on ? 600 : 500, fontSize: 14, lineHeight: "20px" }}
              >
                <Icon size={17} strokeWidth={1.9} aria-hidden />
                {t.eticheta}
                {t.badge && <Bulina n={t.badge} />}
              </button>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <button
            type="button"
            aria-label="Notificări, 2 necitite"
            onClick={() => notify(NOTIFICARI)}
            className={`relative flex size-10 items-center justify-center rounded-full hover:bg-[#F3F4F6] ${focus}`}
          >
            <Bell size={20} color={C.mov} fill={C.fMov} aria-hidden />
            <Bulina n={2} className="absolute right-1 top-1" />
          </button>
          <Avatar prenume="Andrei" nume="Mocanu" size={34} />
        </div>
      </header>
      <div className={`min-h-0 flex-1 ${scrollY}`}>{children}</div>
    </div>
  );
}
