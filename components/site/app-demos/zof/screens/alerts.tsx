"use client";

import { useEffect, useRef } from "react";
import { Clock, Package, TrendingDown, TrendingUp, TriangleAlert, WifiOff, X, ChevronRight } from "lucide-react";
import { ALERTS, type Alert } from "../data";
import { useZof, type Live } from "../store";
import { C } from "../ui";

/* Centrul de alerte: panou lateral (desktop) sau foaie de jos (telefon). */

const ICON = { critic: TriangleAlert, epuizat: Package, trend: TrendingUp, agent: WifiOff, scadere: TrendingDown };
const SEV: Record<Alert["severity"], { bar: string; bg: string; label: string; color: string }> = {
  high: { bar: C.red, bg: "rgba(239,68,68,0.06)", label: "Ridicat", color: C.redText },
  medium: { bar: C.amber, bg: "rgba(245,158,11,0.06)", label: "Mediu", color: C.amberText },
  info: { bar: C.blue, bg: "rgba(59,130,246,0.06)", label: "Informativ", color: C.blueText },
  low: { bar: "#64748B", bg: "rgba(19,28,52,0.4)", label: "Scăzut", color: C.dim2 },
};

/** Alerta agentului dispare când Câmpulung s-a resincronizat. */
export function activeAlerts(live: Live) {
  return ALERTS.filter((a) => a.kind !== "agent" || live.locs.campulung.status === "warning");
}

export function AlertRow({ a, onOpen, compact }: { a: Alert; onOpen?: () => void; compact?: boolean }) {
  const Icon = ICON[a.kind] ?? Clock;
  const s = SEV[a.severity];
  const body = (
    <>
      <Icon size={compact ? 14 : 15} className="mt-0.5 shrink-0 text-[#A3ACBB]" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className={`block ${compact ? "text-[12px]" : "text-[13px]"} font-medium leading-snug text-[#E1E7EF]`}>{a.text}</span>
        <span className="mt-1 flex items-center gap-2 text-[10.5px] text-[#808999]">
          <span className="font-semibold" style={{ color: s.color }}>
            {s.label}
          </span>
          · acum {a.minutes < 60 ? `${a.minutes} min` : a.minutes < 120 ? "o oră" : `${Math.floor(a.minutes / 60)} ore`}
        </span>
      </span>
      {onOpen && <ChevronRight size={14} className="mt-0.5 shrink-0 text-[#808999]" aria-hidden />}
    </>
  );
  const cls = `flex w-full items-start gap-2.5 rounded-lg border-l-2 p-3 text-left`;
  const style = { borderLeftColor: s.bar, background: s.bg };
  return onOpen ? (
    <button type="button" onClick={onOpen} className={`${cls} transition-colors hover:brightness-125`} style={style}>
      {body}
    </button>
  ) : (
    <div className={cls} style={style}>
      {body}
    </div>
  );
}

export function useAlertTarget() {
  const { go, openLoc } = useZof();
  return (a: Alert) => {
    if (a.kind === "agent") openLoc("campulung");
    else if (a.kind === "trend" || a.kind === "scadere") go("rapoarte");
    else go("rame");
  };
}

export function AlertsPanel({ onClose, read, onRead }: { onClose: () => void; read: boolean; onRead: () => void }) {
  const { live, mobile } = useZof();
  const target = useAlertTarget();
  const list = activeAlerts(live);
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    return () => prev?.focus?.();
  }, []);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== "Tab" || !panelRef.current) return;
    const f = panelRef.current.querySelectorAll<HTMLElement>("button");
    if (!f.length) return;
    const first = f[0];
    const last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <div className="absolute inset-0 z-40" onKeyDown={onKey}>
      <button type="button" aria-label="Închide alertele" tabIndex={-1} onClick={onClose} className="zof-fade absolute inset-0 bg-black/50" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="zof-alerts-title"
        className={`absolute flex flex-col border-[#283149] bg-[#0A101F] shadow-2xl shadow-black/60 ${
          mobile
            ? "zof-up inset-x-0 bottom-0 max-h-[78%] rounded-t-2xl border-t pb-6"
            : "zof-slide bottom-0 right-0 top-0 w-[400px] border-l"
        }`}
      >
        {mobile && <span className="mx-auto mt-2 h-1 w-10 rounded-full bg-[#283149]" aria-hidden />}
        <div className="flex items-center justify-between border-b border-[#1C2336] px-5 py-4">
          <div>
            <h2 id="zof-alerts-title" className="text-[16px] font-semibold">
              Centru de alerte
            </h2>
            <p className="text-[12px] text-[#808999]">
              {list.length} alerte active{read ? " · citite" : ""}
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Închide"
            className="flex size-9 items-center justify-center rounded-lg text-[#A3ACBB] hover:bg-[#131D33]"
          >
            <X size={18} aria-hidden />
          </button>
        </div>
        <div className="zof-scroll min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
          {list.map((a) => (
            <AlertRow
              key={a.id}
              a={a}
              onOpen={() => {
                onClose();
                target(a);
              }}
            />
          ))}
        </div>
        <div className="flex gap-2 border-t border-[#1C2336] px-4 pt-3">
          <button
            type="button"
            onClick={onRead}
            disabled={read}
            className="h-9 flex-1 rounded-lg border border-[#283149] text-[13px] font-medium hover:bg-[#131D33] disabled:opacity-50"
          >
            {read ? "Toate sunt citite" : "Marchează ca citite"}
          </button>
        </div>
      </div>
    </div>
  );
}
