"use client";

import { ChevronRight, Clock, Package, TrendingDown, TrendingUp, TriangleAlert, WifiOff, X } from "lucide-react";
import { ALERTS, type Alert } from "../data";
import { useZof, type Live } from "../store";
import { Btn, Overlay, minsSince, plural } from "../ui";

/* Centrul de alerte: panou lateral (desktop) sau foaie de jos (telefon). */

const ICON = { critic: TriangleAlert, epuizat: Package, trend: TrendingUp, agent: WifiOff, scadere: TrendingDown };

/* Culoarea doar pe icon și pe cuvântul severității, și doar la Ridicat / Mediu. */
const SEV: Record<Alert["severity"], { label: string; tone?: string }> = {
  high: { label: "Ridicat", tone: "text-(--z-crit)" },
  medium: { label: "Mediu", tone: "text-(--z-warn)" },
  info: { label: "Informativ" },
  low: { label: "Scăzut" },
};

/** Alerta agentului ține de stare: dispare după sincronizare, vechimea crește. */
export function activeAlerts(live: Live, now: number): Alert[] {
  const cl = live.locs.campulung;
  return ALERTS.flatMap((a) => {
    if (a.kind !== "agent") return [a];
    if (cl.status !== "warning") return [];
    const m = minsSince(now - cl.lastBeat);
    const n = live.buffered.filter((s) => s.loc === "campulung").length;
    return [{ ...a, minutes: m, text: `Câmpulung: fără semnal de ${m} min, ${plural(n, "bon", "bonuri")} în așteptare` }];
  });
}

const ago = (m: number) => (m < 60 ? `acum ${m} min` : m < 120 ? "acum o oră" : `acum ${Math.floor(m / 60)} ore`);

/** Un rând de alertă, într-o listă cu separatoare (`<ul className="divide-y">`). */
export function AlertRow({ a, onOpen }: { a: Alert; onOpen?: () => void }) {
  const Icon = ICON[a.kind] ?? Clock;
  const s = SEV[a.severity];
  const body = (
    <>
      <Icon size={16} className={`mt-px shrink-0 ${s.tone ?? "text-(--z-fg-3)"}`} aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] leading-snug text-(--z-fg)">{a.text}</span>
        <span className="mt-1 block text-[12px] text-(--z-fg-3)">
          <span className={s.tone ? `font-medium ${s.tone}` : undefined}>{s.label}</span> · {ago(a.minutes)}
        </span>
      </span>
      {onOpen && <ChevronRight size={14} className="mt-0.5 shrink-0 text-(--z-fg-3)" aria-hidden />}
    </>
  );
  const cls = "flex w-full items-start gap-3 px-5 py-3 text-left";
  return (
    <li>
      {onOpen ? (
        <button type="button" onClick={onOpen} className={`${cls} transition-colors duration-150 hover:bg-(--z-hover)`}>
          {body}
        </button>
      ) : (
        <div className={cls}>{body}</div>
      )}
    </li>
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
  const { live, mobile, now } = useZof();
  const target = useAlertTarget();
  const list = activeAlerts(live, now);

  return (
    <Overlay onClose={onClose} labelledBy="zof-alerts-title" closeLabel="Închide alertele" placement={mobile ? "bottom" : "right"}>
      {mobile && <span className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-(--z-border-strong)" aria-hidden />}
      <div className="flex shrink-0 items-center justify-between border-b border-(--z-border) py-4 pl-5 pr-3">
        <div>
          <h2 id="zof-alerts-title" className="text-[16px] font-semibold">
            Centru de alerte
          </h2>
          <p className="text-[13px] tabular-nums text-(--z-fg-3)">{plural(list.length, "alertă activă", "alerte active")}</p>
        </div>
        <button
          type="button"
          data-autofocus
          onClick={onClose}
          aria-label="Închide"
          className="flex size-9 items-center justify-center rounded-lg text-(--z-fg-2) transition-colors duration-150 hover:bg-(--z-hover)"
        >
          <X size={18} aria-hidden />
        </button>
      </div>
      <ul className="zof-scroll min-h-0 flex-1 divide-y divide-(--z-border) overflow-y-auto">
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
      </ul>
      <div className={`flex shrink-0 border-t border-(--z-border) px-4 pt-3 ${mobile ? "" : "pb-3"}`}>
        <Btn onClick={onRead} disabled={read} className="flex-1">
          {read ? "Marcate ca citite" : "Marchează ca citite"}
        </Btn>
      </div>
    </Overlay>
  );
}
