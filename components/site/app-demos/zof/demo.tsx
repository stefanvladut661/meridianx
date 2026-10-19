"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type ComponentType } from "react";
import {
  Bell,
  ChevronLeft,
  ChevronRight,
  FileText,
  Glasses,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Settings,
  ShoppingCart,
  Store,
  Sun,
  X,
} from "lucide-react";
import { StatusBar, useInterval } from "../kit";
import type { DemoProps } from "../types";
import { simBase, type Period } from "./data";
import { inter } from "./fonts";
import { initLive, reducer, useZof, ZofCtx, type Ctx } from "./store";
import { C, FONT, Overlay, ZOF_CSS, ZofMark, clock } from "./ui";
import { AlertsPanel, activeAlerts } from "./screens/alerts";
import Dashboard from "./screens/dashboard";
import Locatii from "./screens/locatii";
import Locatie from "./screens/locatie";
import Rame from "./screens/rame";
import Vanzari from "./screens/vanzari";
import Rapoarte from "./screens/rapoarte";

/* ============================================================
   Zof Stoc Online — demo interactiv.

   Panoul central al rețelei Zof Optogerman: vânzările și stocul
   din toate magazinele, aduse de agenții care citesc gestiunea
   locală (DorSoft / Access), plus magazinul zof.ro.

   Tema luminoasă e cea implicită (posterul se fotografiază așa);
   butonul din meniu comută pe tema întunecată a aplicației.
   ============================================================ */

const SCREENS: Record<string, ComponentType> = {
  dashboard: Dashboard,
  locatii: Locatii,
  locatie: Locatie,
  rame: Rame,
  vanzari: Vanzari,
  rapoarte: Rapoarte,
};

/* Ordinea din aplicația reală; „Locații” stă unde e „Conectori” acolo. */
const PAGES = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "rame", label: "Produse", icon: Glasses },
  { id: "vanzari", label: "Vânzări", icon: ShoppingCart },
  { id: "rapoarte", label: "Rapoarte", icon: FileText },
  { id: "locatii", label: "Locații", icon: Store },
] as const;

/* ritmul datelor: un import la 25 s, semnalele de viață la 30 s */
const IMPORT_MS = 25_000;
const BEAT_MS = 30_000;
const TICK_MS = 30_000;
const SYNC_MS = 1600;
const RESULT_MS = 4000;

type Theme = "light" | "dark";

export default function Demo({ device, screen, go, notify, reducedMotion }: DemoProps) {
  const mobile = device === "mobile";
  const [clockRef] = useState(() => ({ base: simBase(), mount: Date.now() }));
  const simNow = useCallback(() => clockRef.base + (Date.now() - clockRef.mount), [clockRef]);
  const [live, dispatch] = useReducer(reducer, clockRef.base, initLive);
  const [wall, setWall] = useState(() => Date.now());
  const [loc, setLoc] = useState("arges-mall");
  const [period, setPeriod] = useState<Period>("azi");
  const [paused, setPaused] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [alertsRead, setAlertsRead] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [theme, setTheme] = useState<Theme>("light");
  const timers = useRef<number[]>([]);
  const syncing = useRef(new Set<string>());

  useEffect(() => {
    const t = timers.current;
    return () => t.forEach((id) => window.clearTimeout(id));
  }, []);

  // importurile și semnalele de viață; sub reduced motion datele stau pe loc
  useInterval(() => setWall(Date.now()), TICK_MS, !reducedMotion);
  useInterval(() => dispatch({ type: "import", at: simNow() }), IMPORT_MS, !reducedMotion && !paused);
  useInterval(() => dispatch({ type: "beat", at: simNow() }), BEAT_MS, !reducedMotion);

  const later = useCallback((fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  }, []);

  const sync = useCallback(
    (id: string) => {
      if (syncing.current.has(id)) return;
      syncing.current.add(id);
      dispatch({ type: "syncStart", id });
      const ms = reducedMotion ? 0 : SYNC_MS;
      later(() => {
        dispatch({ type: "syncDone", id, at: simNow() });
        syncing.current.delete(id);
        setWall(Date.now());
      }, ms);
      later(() => dispatch({ type: "syncClear", id }), ms + RESULT_MS);
    },
    [reducedMotion, simNow, later]
  );

  const syncAll = useCallback(() => {
    Object.keys(live.locs).forEach((id, i) => {
      if (reducedMotion) sync(id);
      else later(() => sync(id), i * 120);
    });
  }, [live.locs, reducedMotion, sync, later]);

  const openLoc = useCallback(
    (id: string) => {
      setLoc(id);
      go("locatie");
    },
    [go]
  );

  const now = clockRef.base + (wall - clockRef.mount);
  const alertCount = alertsRead ? 0 : activeAlerts(live, now).length;

  const ctx: Ctx = useMemo(
    () => ({
      live,
      device,
      mobile,
      reduced: reducedMotion,
      now: Math.max(now, live.sales[0]?.at ?? 0),
      go,
      notify,
      sync,
      syncAll,
      loc,
      openLoc,
      period,
      setPeriod,
      paused,
      setPaused,
      openAlerts: () => setAlertsOpen(true),
    }),
    [live, device, mobile, reducedMotion, now, go, notify, sync, syncAll, loc, openLoc, period, paused]
  );

  const id = SCREENS[screen] ? screen : "dashboard";
  const Screen = SCREENS[id];
  const navId = id === "locatie" ? "locatii" : id;
  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  return (
    <ZofCtx.Provider value={ctx}>
      <div
        data-theme={theme}
        className={`zof-root ${inter.variable} relative h-full w-full overflow-hidden ${reducedMotion ? "zof-still" : ""}`}
        style={{ background: C.bg, color: C.fg, fontFamily: FONT }}
      >
        <style>{ZOF_CSS}</style>
        {mobile ? (
          <div className="flex h-full flex-col">
            <div className="shrink-0 border-b border-(--z-border) bg-(--z-surface)">
              <StatusBar tone={theme === "dark" ? "light" : "dark"} bg="var(--z-surface)" time={clock(ctx.now)} />
              <header className="flex h-14 items-center justify-between pl-4 pr-2">
                <div className="flex items-center gap-2">
                  <ZofMark size={28} />
                  <span className="text-[14px] font-semibold">Zof Stoc Online</span>
                </div>
                <div className="flex items-center">
                  <button
                    type="button"
                    onClick={() => setAlertsOpen(true)}
                    aria-label={`Alerte${alertCount ? `: ${alertCount} necitite` : ""}`}
                    className="relative flex size-10 items-center justify-center rounded-lg text-(--z-fg-2) transition-colors duration-150 hover:bg-(--z-hover)"
                  >
                    <Bell size={20} aria-hidden />
                    {alertCount > 0 && <Count n={alertCount} className="absolute right-1 top-1" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => setMenuOpen(true)}
                    aria-label="Meniu"
                    className="flex size-10 items-center justify-center rounded-lg text-(--z-fg-2) transition-colors duration-150 hover:bg-(--z-hover)"
                  >
                    <Menu size={20} aria-hidden />
                  </button>
                </div>
              </header>
            </div>
            <main key={id} className="zof-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 pt-4">
              <Screen />
              <Footer />
            </main>
            <nav aria-label="Navigare" className="shrink-0 border-t border-(--z-border) bg-(--z-surface) px-1 pb-5">
              <ul className="flex h-16 items-center justify-around">
                {PAGES.map((n) => {
                  const on = navId === n.id;
                  return (
                    <li key={n.id}>
                      <button
                        type="button"
                        onClick={() => go(n.id)}
                        aria-current={on ? "page" : undefined}
                        className={`flex w-[70px] flex-col items-center gap-1 rounded-lg py-1.5 transition-colors duration-150 ${
                          on ? "text-(--z-primary-text)" : "text-(--z-fg-3) hover:text-(--z-fg)"
                        }`}
                      >
                        <n.icon size={20} aria-hidden strokeWidth={on ? 2.25 : 2} />
                        <span className="text-[11px] font-medium leading-none">{n.label}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </nav>
          </div>
        ) : (
          <div className="flex h-full">
            <Sidebar
              active={navId}
              collapsed={collapsed}
              onToggle={() => setCollapsed((c) => !c)}
              alertCount={alertCount}
              onAlerts={() => setAlertsOpen(true)}
              theme={theme}
              onTheme={toggleTheme}
            />
            <main key={id} className="zof-scroll relative min-w-0 flex-1 overflow-y-auto overflow-x-hidden">
              <div className="px-6 pb-2 pt-6">
                <Screen />
              </div>
              <Footer />
            </main>
          </div>
        )}
        {alertsOpen && <AlertsPanel onClose={() => setAlertsOpen(false)} read={alertsRead} onRead={() => setAlertsRead(true)} />}
        {menuOpen && (
          <MenuSheet
            active={navId}
            onClose={() => setMenuOpen(false)}
            alertCount={alertCount}
            onAlerts={() => {
              setMenuOpen(false);
              setAlertsOpen(true);
            }}
            theme={theme}
            onTheme={toggleTheme}
          />
        )}
      </div>
    </ZofCtx.Provider>
  );
}

/* ---------------- piese comune ale meniului ---------------- */

function Count({ n, className = "", big }: { n: number; className?: string; big?: boolean }) {
  return (
    <span
      className={`flex ${big ? "h-[18px] min-w-[18px]" : "h-4 min-w-4"} items-center justify-center rounded-full px-1 text-[10px] font-semibold tabular-nums text-white ${className}`}
      style={{ background: "var(--z-count)" }}
    >
      {n}
    </span>
  );
}

const ITEM = "group relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[14px] font-medium transition-colors duration-150";
const IDLE = "text-(--z-fg-2) hover:bg-(--z-hover) hover:text-(--z-fg)";

/* ---------------- bara laterală (desktop) ---------------- */

function Sidebar({
  active,
  collapsed,
  onToggle,
  alertCount,
  onAlerts,
  theme,
  onTheme,
}: {
  active: string;
  collapsed: boolean;
  onToggle: () => void;
  alertCount: number;
  onAlerts: () => void;
  theme: Theme;
  onTheme: () => void;
}) {
  const { go, notify } = useZof();
  const narrow = collapsed ? "justify-center px-0" : "";
  const page = (n: (typeof PAGES)[number]) => {
    const on = active === n.id;
    return (
      <button
        key={n.id}
        type="button"
        onClick={() => go(n.id)}
        aria-current={on ? "page" : undefined}
        aria-label={collapsed ? n.label : undefined}
        className={`${ITEM} ${narrow} ${on ? "bg-(--z-primary) text-white" : IDLE}`}
      >
        <n.icon size={18} className="shrink-0" aria-hidden />
        {!collapsed && <span>{n.label}</span>}
        {collapsed && <Tip label={n.label} />}
      </button>
    );
  };
  return (
    <aside
      className={`flex h-full shrink-0 flex-col border-r border-(--z-border) bg-(--z-surface) transition-[width] duration-200 ease-out ${
        collapsed ? "w-16" : "w-60"
      }`}
    >
      <div className="flex h-16 shrink-0 items-center border-b border-(--z-border) px-4">
        <div className={`flex items-center gap-2 ${collapsed ? "mx-auto" : ""}`}>
          <ZofMark />
          {!collapsed && (
            <div className="whitespace-nowrap">
              <p className="text-[14px] font-semibold leading-none">Zof Stoc Online</p>
              <p className="mt-1 text-[11px] leading-none text-(--z-fg-3)">Stocuri și vânzări</p>
            </div>
          )}
        </div>
      </div>

      <nav aria-label="Navigare" className="zof-scroll flex-1 space-y-0.5 overflow-y-auto overflow-x-hidden px-2 py-3">
        {PAGES.slice(0, 4).map(page)}
        <button
          type="button"
          onClick={onAlerts}
          aria-label={collapsed ? `Alerte${alertCount ? `: ${alertCount} necitite` : ""}` : undefined}
          className={`${ITEM} ${narrow} ${IDLE}`}
        >
          <Bell size={18} className="shrink-0" aria-hidden />
          {!collapsed && <span>Alerte</span>}
          {alertCount > 0 && (
            <Count big n={alertCount} className={`absolute ${collapsed ? "right-2 top-1" : "right-3"}`} />
          )}
          {collapsed && <Tip label="Alerte" />}
        </button>
        {page(PAGES[4])}
        <button
          type="button"
          onClick={() => notify("Setările sunt închise în demo.")}
          aria-label={collapsed ? "Setări" : undefined}
          className={`${ITEM} ${narrow} ${IDLE}`}
        >
          <Settings size={18} className="shrink-0" aria-hidden />
          {!collapsed && <span>Setări</span>}
          {collapsed && <Tip label="Setări" />}
        </button>
      </nav>

      <div className="space-y-0.5 border-t border-(--z-border) p-2">
        <button type="button" onClick={onTheme} aria-label={collapsed ? themeLabel(theme) : undefined} className={`${ITEM} ${narrow} ${IDLE}`}>
          {theme === "dark" ? <Sun size={18} className="shrink-0" aria-hidden /> : <Moon size={18} className="shrink-0" aria-hidden />}
          {!collapsed && <span>{themeLabel(theme)}</span>}
          {collapsed && <Tip label={themeLabel(theme)} />}
        </button>
        <button
          type="button"
          onClick={() => notify("Deconectarea e oprită în demo.")}
          aria-label={collapsed ? "Deconectare" : undefined}
          className={`${ITEM} ${narrow} text-(--z-fg-2) hover:bg-(--z-crit-soft) hover:text-(--z-crit-text)`}
        >
          <LogOut size={18} className="shrink-0" aria-hidden />
          {!collapsed && <span>Deconectare</span>}
          {collapsed && <Tip label="Deconectare" />}
        </button>
        <button
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? "Extinde meniul" : "Restrânge meniul"}
          className="flex w-full items-center justify-center rounded-lg py-2 text-(--z-fg-3) transition-colors duration-150 hover:bg-(--z-hover) hover:text-(--z-fg)"
        >
          {collapsed ? <ChevronRight size={16} aria-hidden /> : <ChevronLeft size={16} aria-hidden />}
        </button>
      </div>
    </aside>
  );
}

const themeLabel = (t: Theme) => (t === "dark" ? "Mod luminos" : "Mod întunecat");

function Tip({ label }: { label: string }) {
  return (
    <span
      className="pointer-events-none invisible absolute left-full z-50 ml-2 whitespace-nowrap rounded-md border border-(--z-border) bg-(--z-surface) px-2 py-1 text-[12px] font-medium text-(--z-fg) opacity-0 transition-opacity duration-150 group-hover:visible group-hover:opacity-100 group-focus-visible:visible group-focus-visible:opacity-100"
      style={{ boxShadow: "var(--z-tip)" }}
      aria-hidden
    >
      {label}
    </span>
  );
}

/* ---------------- meniul de pe telefon ---------------- */

function MenuSheet({
  active,
  onClose,
  alertCount,
  onAlerts,
  theme,
  onTheme,
}: {
  active: string;
  onClose: () => void;
  alertCount: number;
  onAlerts: () => void;
  theme: Theme;
  onTheme: () => void;
}) {
  const { go, notify } = useZof();
  const row = "flex w-full items-center gap-3 rounded-lg px-3 py-3 text-[14px] font-medium transition-colors duration-150";
  const open = (id: string) => {
    onClose();
    go(id);
  };
  return (
    <Overlay onClose={onClose} labelledBy="zof-menu-title" closeLabel="Închide meniul" placement="menu">
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-(--z-border) pl-4 pr-2">
        <div className="flex items-center gap-2">
          <ZofMark size={28} />
          <h2 id="zof-menu-title" className="text-[14px] font-semibold">
            Meniu
          </h2>
        </div>
        <button
          type="button"
          data-autofocus
          onClick={onClose}
          aria-label="Închide meniul"
          className="flex size-10 items-center justify-center rounded-lg text-(--z-fg-2) hover:bg-(--z-hover)"
        >
          <X size={18} aria-hidden />
        </button>
      </div>
      <nav aria-label="Meniu" className="zof-scroll min-h-0 flex-1 space-y-0.5 overflow-y-auto p-3">
        {PAGES.slice(0, 4).map((n) => {
          const on = active === n.id;
          return (
            <button key={n.id} type="button" onClick={() => open(n.id)} aria-current={on ? "page" : undefined} className={`${row} ${on ? "bg-(--z-primary) text-white" : IDLE}`}>
              <n.icon size={20} aria-hidden />
              {n.label}
            </button>
          );
        })}
        <button type="button" onClick={onAlerts} className={`${row} ${IDLE}`}>
          <Bell size={20} aria-hidden />
          <span className="flex-1 text-left">Alerte</span>
          {alertCount > 0 && <Count big n={alertCount} />}
        </button>
        {(() => {
          const n = PAGES[4];
          const on = active === n.id;
          return (
            <button type="button" onClick={() => open(n.id)} aria-current={on ? "page" : undefined} className={`${row} ${on ? "bg-(--z-primary) text-white" : IDLE}`}>
              <n.icon size={20} aria-hidden />
              {n.label}
            </button>
          );
        })()}
        <button type="button" onClick={() => notify("Setările sunt închise în demo.")} className={`${row} ${IDLE}`}>
          <Settings size={20} aria-hidden />
          Setări
        </button>
      </nav>
      <div className="space-y-0.5 border-t border-(--z-border) p-3">
        <button type="button" onClick={onTheme} className={`${row} ${IDLE}`}>
          {theme === "dark" ? <Sun size={20} aria-hidden /> : <Moon size={20} aria-hidden />}
          {themeLabel(theme)}
        </button>
        <button type="button" onClick={() => notify("Deconectarea e oprită în demo.")} className={`${row} text-(--z-fg-2) hover:bg-(--z-crit-soft) hover:text-(--z-crit-text)`}>
          <LogOut size={20} aria-hidden />
          Deconectare
        </button>
      </div>
    </Overlay>
  );
}

function Footer() {
  return (
    <footer className="px-4 py-6 text-center">
      <p className="text-[11px] font-light tracking-wide text-(--z-fg-3)">Dezvoltat de Meridian Systems</p>
    </footer>
  );
}
