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
  Settings,
  ShoppingCart,
  Store,
  Sun,
} from "lucide-react";
import { StatusBar, useInterval } from "../kit";
import type { DemoProps } from "../types";
import { simBase, type Period } from "./data";
import { initLive, reducer, totals, useZof, ZofCtx, type Ctx } from "./store";
import { C, FONT, LiveDot, ZOF_CSS, ZofMark } from "./ui";
import { AlertsPanel, activeAlerts } from "./screens/alerts";
import Dashboard from "./screens/dashboard";
import Locatii from "./screens/locatii";
import Locatie from "./screens/locatie";
import Rame from "./screens/rame";
import Vanzari from "./screens/vanzari";
import Rapoarte from "./screens/rapoarte";

/* ============================================================
   Zof Stoc Online — demo interactiv.

   Dashboard-ul central al rețelei Zof Optogerman: vânzările și
   stocul din toate magazinele, aduse online de agenții care citesc
   gestiunea locală (DorSoft / Access), plus magazinul zof.ro.
   ============================================================ */

const SCREENS: Record<string, ComponentType> = {
  dashboard: Dashboard,
  locatii: Locatii,
  locatie: Locatie,
  rame: Rame,
  vanzari: Vanzari,
  rapoarte: Rapoarte,
};

const NAV = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "locatii", label: "Locații", icon: Store },
  { id: "rame", label: "Rame", icon: Glasses },
  { id: "vanzari", label: "Vânzări", icon: ShoppingCart },
  { id: "rapoarte", label: "Rapoarte", icon: FileText },
] as const;

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
  const [collapsed, setCollapsed] = useState(false);
  const timers = useRef<number[]>([]);
  const syncing = useRef(new Set<string>());

  useEffect(() => {
    const t = timers.current;
    return () => t.forEach((id) => window.clearTimeout(id));
  }, []);

  // ceasul (relative „acum 12 s”) și fluxul viu — oprite sub reduced motion
  useInterval(() => setWall(Date.now()), 1000, !reducedMotion);
  useInterval(() => dispatch({ type: "sale", at: simNow() }), 3400, !reducedMotion && !paused);
  useInterval(() => dispatch({ type: "beat", at: simNow() }), 2300, !reducedMotion);

  const sync = useCallback(
    (id: string) => {
      if (syncing.current.has(id)) return;
      syncing.current.add(id);
      dispatch({ type: "syncStart", id });
      const steps = reducedMotion ? [0, 0, 0] : [650, 1300, 1950];
      steps.forEach((ms) => timers.current.push(window.setTimeout(() => dispatch({ type: "syncStep", id }), ms)));
      timers.current.push(
        window.setTimeout(
          () => {
            dispatch({ type: "syncDone", id, at: simNow() });
            syncing.current.delete(id);
            setWall(Date.now());
          },
          reducedMotion ? 0 : 2600
        )
      );
    },
    [reducedMotion, simNow]
  );

  const syncAll = useCallback(() => {
    Object.keys(live.locs).forEach((id, i) => {
      if (reducedMotion) sync(id);
      else timers.current.push(window.setTimeout(() => sync(id), i * 140));
    });
  }, [live.locs, reducedMotion, sync]);

  const openLoc = useCallback(
    (id: string) => {
      setLoc(id);
      go("locatie");
    },
    [go]
  );

  const alertCount = alertsRead ? 0 : activeAlerts(live).length;
  const now = clockRef.base + (wall - clockRef.mount);

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

  return (
    <ZofCtx.Provider value={ctx}>
      <div
        className={`zof-root relative h-full w-full overflow-hidden ${reducedMotion ? "zof-still" : ""}`}
        style={{ background: C.bg, color: C.fg, fontFamily: FONT }}
      >
        <style>{ZOF_CSS}</style>
        {mobile ? (
          <div className="flex h-full flex-col">
            <div className="shrink-0 bg-[#0A0F1E]">
              <StatusBar tone="light" bg="#0A0F1E" />
              <header className="flex h-14 items-center justify-between border-b border-[#1C2336] px-4">
                <div className="flex items-center gap-2">
                  <ZofMark size={28} />
                  <span className="text-[14.5px] font-bold">Zof Stoc Online</span>
                </div>
                <div className="flex items-center gap-1">
                  <SyncPill />
                  <button
                    type="button"
                    onClick={() => setAlertsOpen(true)}
                    aria-label={`Alerte${alertCount ? `: ${alertCount} noi` : ""}`}
                    className="relative flex size-10 items-center justify-center rounded-lg text-[#A3ACBB] hover:bg-[#131D33]"
                  >
                    <Bell size={20} aria-hidden />
                    {alertCount > 0 && (
                      <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#EF4444] px-1 text-[9.5px] font-bold text-white">
                        {alertCount}
                      </span>
                    )}
                  </button>
                </div>
              </header>
            </div>
            <main key={id} className="zof-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 pb-6 pt-4">
              <Screen />
              <Footer />
            </main>
            <nav aria-label="Navigare" className="shrink-0 border-t border-[#1C2336] bg-[#0A0F1E] px-2 pb-5">
              <ul className="flex h-16 items-center justify-around">
                {NAV.map((n) => {
                  const on = navId === n.id;
                  return (
                    <li key={n.id}>
                      <button
                        type="button"
                        onClick={() => go(n.id)}
                        aria-current={on ? "page" : undefined}
                        className={`flex w-[66px] flex-col items-center gap-0.5 rounded-lg py-1.5 transition-colors ${
                          on ? "text-[#60A5FA]" : "text-[#808999] hover:text-[#E1E7EF]"
                        }`}
                      >
                        <n.icon size={21} aria-hidden strokeWidth={on ? 2.3 : 2} />
                        <span className="text-[10.5px] font-medium">{n.label}</span>
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
            />
            <main key={id} className="zof-scroll relative min-w-0 flex-1 overflow-y-auto overflow-x-hidden">
              <div className="px-6 pb-2 pt-6">
                <Screen />
              </div>
              <Footer />
            </main>
          </div>
        )}
        {alertsOpen && (
          <AlertsPanel
            onClose={() => setAlertsOpen(false)}
            read={alertsRead}
            onRead={() => setAlertsRead(true)}
          />
        )}
      </div>
    </ZofCtx.Provider>
  );
}

/* ---------------- bara laterală (desktop) ---------------- */

function Sidebar({
  active,
  collapsed,
  onToggle,
  alertCount,
  onAlerts,
}: {
  active: string;
  collapsed: boolean;
  onToggle: () => void;
  alertCount: number;
  onAlerts: () => void;
}) {
  const { go, notify, live, now, reduced } = useZof();
  const t = totals(live);
  const item = `group relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[14px] font-medium transition-colors duration-200`;
  return (
    <aside
      className={`flex h-full shrink-0 flex-col border-r border-[#1C2336] bg-[#0A101F]/90 transition-[width] duration-300 ${
        collapsed ? "w-16" : "w-60"
      }`}
    >
      <div className="flex h-16 items-center border-b border-[#1C2336] px-4">
        <div className={`flex items-center gap-2 ${collapsed ? "mx-auto" : ""}`}>
          <ZofMark />
          {!collapsed && (
            <div>
              <p className="text-[14px] font-bold leading-none">Zof Stoc Online</p>
              <p className="mt-1 text-[10.5px] text-[#808999]">Business Intelligence</p>
            </div>
          )}
        </div>
      </div>

      <nav aria-label="Navigare" className="zof-scroll flex-1 space-y-0.5 overflow-y-auto px-2 py-3">
        {NAV.map((n) => {
          const on = active === n.id;
          return (
            <button
              key={n.id}
              type="button"
              onClick={() => go(n.id)}
              aria-current={on ? "page" : undefined}
              aria-label={collapsed ? n.label : undefined}
              className={`${item} ${collapsed ? "justify-center px-0" : ""} ${
                on
                  ? "bg-[#2563EB] text-white shadow-md shadow-[#2563EB]/20"
                  : "text-[#808999] hover:bg-[#131C34]/60 hover:text-[#E1E7EF]"
              }`}
            >
              <n.icon size={18} className="shrink-0" aria-hidden />
              {!collapsed && <span>{n.label}</span>}
              {collapsed && <Tip label={n.label} />}
            </button>
          );
        })}
        <div className="my-2 border-t border-[#1C2336]" />
        <button
          type="button"
          onClick={onAlerts}
          aria-label={collapsed ? `Alerte${alertCount ? `: ${alertCount}` : ""}` : undefined}
          className={`${item} ${collapsed ? "justify-center px-0" : ""} text-[#808999] hover:bg-[#131C34]/60 hover:text-[#E1E7EF]`}
        >
          <Bell size={18} className="shrink-0" aria-hidden />
          {!collapsed && <span>Alerte</span>}
          {alertCount > 0 && (
            <span
              className={`absolute ${collapsed ? "-right-0.5 -top-0.5" : "right-3"} flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#EF4444] px-1 text-[10px] font-bold text-white`}
            >
              {alertCount}
            </span>
          )}
          {collapsed && <Tip label="Alerte" />}
        </button>
        <button
          type="button"
          onClick={() =>
            notify("În demo, setările sunt închise. În aplicația reală, adminul gestionează aici utilizatorii și pragurile de stoc critic.")
          }
          aria-label={collapsed ? "Setări" : undefined}
          className={`${item} ${collapsed ? "justify-center px-0" : ""} text-[#808999] hover:bg-[#131C34]/60 hover:text-[#E1E7EF]`}
        >
          <Settings size={18} className="shrink-0" aria-hidden />
          {!collapsed && <span>Setări</span>}
          {collapsed && <Tip label="Setări" />}
        </button>
      </nav>

      {!collapsed && (
        <button
          type="button"
          onClick={() => go("locatii")}
          className="mx-2 mb-2 rounded-lg border border-[#1C2336] bg-[#0F1729] px-3 py-2.5 text-left transition-colors hover:border-[#283149]"
        >
          <span className="flex items-center gap-2 text-[11.5px] font-semibold">
            <LiveDot still={reduced} color={t.online === 9 ? C.green : C.amber} />
            {t.online}/9 agenți conectați
          </span>
          <span className="mt-1 block text-[11px] text-[#808999]">
            ultima sincronizare {agoShort(now - t.lastSync)}
          </span>
        </button>
      )}

      <div className="space-y-0.5 border-t border-[#1C2336] p-2">
        <button
          type="button"
          onClick={() => notify("În demo rămâne modul întunecat. Aplicația reală are și mod luminos, salvat pe fiecare dispozitiv.")}
          aria-label={collapsed ? "Mod luminos" : undefined}
          className={`${item} ${collapsed ? "justify-center px-0" : ""} text-[#808999] hover:bg-[#131C34]/60 hover:text-[#E1E7EF]`}
        >
          <Sun size={18} className="shrink-0" aria-hidden />
          {!collapsed && <span>Mod luminos</span>}
        </button>
        <button
          type="button"
          onClick={() => notify("În demo nu te poți deconecta. În aplicația reală, sesiunea se închide și pe server.")}
          aria-label={collapsed ? "Deconectare" : undefined}
          className={`${item} ${collapsed ? "justify-center px-0" : ""} text-[#808999] hover:bg-[#EF4444]/10 hover:text-[#F87171]`}
        >
          <LogOut size={18} className="shrink-0" aria-hidden />
          {!collapsed && <span>Deconectare</span>}
        </button>
        <button
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? "Extinde meniul" : "Restrânge meniul"}
          className="flex w-full items-center justify-center rounded-lg py-2 text-[#808999] transition-colors hover:bg-[#131C34]/60 hover:text-[#E1E7EF]"
        >
          {collapsed ? <ChevronRight size={16} aria-hidden /> : <ChevronLeft size={16} aria-hidden />}
        </button>
      </div>
    </aside>
  );
}

function Tip({ label }: { label: string }) {
  return (
    <span
      className="pointer-events-none invisible absolute left-full z-50 ml-2 whitespace-nowrap rounded-md border border-[#283149] bg-[#0E1629] px-2 py-1 text-[12px] font-medium text-[#E1E7EF] opacity-0 shadow-lg transition-opacity group-hover:visible group-hover:opacity-100 group-focus-visible:visible group-focus-visible:opacity-100"
      aria-hidden
    >
      {label}
    </span>
  );
}

function agoShort(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 5) return "chiar acum";
  if (s < 60) return `acum ${s} s`;
  return `acum ${Math.floor(s / 60)} min`;
}

/** Pastila din antetul de telefon: câți agenți sunt online. */
function SyncPill() {
  const { live, go, reduced } = useZof();
  const t = totals(live);
  return (
    <button
      type="button"
      onClick={() => go("locatii")}
      className="flex h-8 items-center gap-1.5 rounded-full border border-[#1C2336] bg-[#0F1729] px-2.5 text-[11.5px] font-semibold text-[#E1E7EF]"
      aria-label={`${t.online} din 9 agenți conectați. Deschide Locații.`}
    >
      <LiveDot still={reduced} color={t.online === 9 ? C.green : C.amber} size={7} />
      {t.online}/9
    </button>
  );
}

function Footer() {
  return (
    <footer className="px-4 py-6 text-center">
      <p className="text-[11px] font-light tracking-wide text-[#808999]/60">Developed by Meridian Systems</p>
    </footer>
  );
}

