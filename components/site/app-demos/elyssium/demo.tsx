"use client";

import type { DemoProps } from "../types";
import { C } from "./data";
import { DemoProvider } from "./store";
import { FONT } from "./ui";
import Acasa from "./screens/Acasa";
import Anunturi from "./screens/Anunturi";
import Clienti from "./screens/Clienti";
import Dashboard from "./screens/Dashboard";
import Facturi from "./screens/Facturi";
import Receptie from "./screens/Receptie";
import Scanare from "./screens/Scanare";

/* ============================================================
   Demo-ul Elyssium Wellness: aplicația clientului (abonamentul în
   telefon, intrarea cu QR) și panoul recepției (scanări live,
   clienți, vânzări, anunțuri, facturare SmartBill).

   Ecranele: acasa · scanare · receptie · clienti · dashboard ·
   anunturi · facturi. Starea comună (clienți, scanări, facturi) stă
   în DemoProvider, deci ce faci pe un ecran se vede pe celelalte.
   ============================================================ */

function Ecran({ screen }: { screen: string }) {
  switch (screen) {
    case "scanare":
      return <Scanare />;
    case "receptie":
      return <Receptie />;
    case "clienti":
      return <Clienti />;
    case "dashboard":
      return <Dashboard />;
    case "anunturi":
      return <Anunturi />;
    case "facturi":
      return <Facturi />;
    default:
      return <Acasa />;
  }
}

export default function Demo({ device, screen, go, notify, reducedMotion }: DemoProps) {
  return (
    <div
      className="relative h-full w-full overflow-hidden"
      style={{ background: C.fundal, color: C.text, fontFamily: FONT, colorScheme: "light", fontSize: 15, lineHeight: 1.5, letterSpacing: "normal" }}
    >
      <DemoProvider device={device} rm={reducedMotion} go={go} notify={notify}>
        <Ecran key={`${device}-${screen}`} screen={screen} />
      </DemoProvider>
    </div>
  );
}
