"use client";

import type { DemoProps } from "../types";
import { Campanii } from "./campanii";
import { Clienti } from "./clienti";
import { Home, Rewards } from "./client";
import { Dashboard } from "./dashboard";
import { Rapoarte } from "./rapoarte";
import { Statie } from "./statie";
import { DemoProvider } from "./store";
import { SCOPED_CSS } from "./ui";

/* ============================================================
   Prosperanța — demo interactiv.
   Trei fețe ale aceleiași aplicații: clientul (puncte, recompense),
   angajatul din stație (litri, vouchere) și adminul rețelei
   (dashboard, clienți, campanii, rapoarte). Toate împart aceeași
   stare, deci o acțiune dintr-un rol se vede imediat în celelalte.
   ============================================================ */

const SCREENS = ["dashboard", "home", "statie", "recompense", "campanii", "clienti", "rapoarte"] as const;
type ScreenId = (typeof SCREENS)[number];
const START: ScreenId = "dashboard";

export default function Demo({ device, screen, go, notify, reducedMotion }: DemoProps) {
  const id: ScreenId = (SCREENS as readonly string[]).includes(screen) ? (screen as ScreenId) : START;
  return (
    <div className={`prs relative h-full w-full overflow-hidden ${reducedMotion ? "prs-rm" : ""}`}>
      <style>{SCOPED_CSS}</style>
      <DemoProvider device={device} go={go} notify={notify} reducedMotion={reducedMotion}>
        {id === "home" && <Home />}
        {id === "recompense" && <Rewards />}
        {id === "statie" && <Statie />}
        {id === "dashboard" && <Dashboard />}
        {id === "clienti" && <Clienti />}
        {id === "campanii" && <Campanii />}
        {id === "rapoarte" && <Rapoarte />}
      </DemoProvider>
    </div>
  );
}
