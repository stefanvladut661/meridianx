"use client";

import { useCallback, useEffect, useState, type ComponentType } from "react";
import {
  DEMO_CANVAS,
  type DemoDevice,
  type DemoProps,
} from "@/components/site/app-demos/types";

/* ============================================================
   DOAR PENTRU LUCRU (redesign-ul demo-urilor, 2026-10). SE ȘTERGE.

   Pânza unui singur demo, fără vizualizator și fără registru: ruta
   oficială (/software/proiecte/<slug>) importă toate demo-urile, deci o
   eroare de compilare într-unul oprește capturile tuturor. Aici fiecare
   demo are ruta lui (/demo-dev/<slug>?device=&screen=), cu aceleași
   reguli ca modul `?capture=1`: pânza nescalată, id="demo-capture".

   Toast-ul de la notify() apare SUB pânză (#demo-toast), ca o captură
   la mărimea pânzei să nu-l prindă, dar textul să poată fi citit.
   ============================================================ */

export function DevCanvas({
  Demo,
  first,
}: {
  Demo: ComponentType<DemoProps>;
  first: string;
}) {
  const [ready, setReady] = useState(false);
  const [device, setDevice] = useState<DemoDevice>("desktop");
  const [screen, setScreen] = useState(first);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const d = q.get("device");
    if (d === "desktop" || d === "mobile") setDevice(d);
    const s = q.get("screen");
    if (s) setScreen(s);
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(m.matches);
    setReady(true);
  }, []);

  const notify = useCallback((text: string) => {
    setToast(text);
    console.info("[notify]", text);
  }, []);

  if (!ready) return null;
  const c = DEMO_CANVAS[device];

  return (
    <>
      <div
        id="demo-capture"
        data-screen={screen}
        style={{ width: c.w, height: c.h, overflow: "hidden", position: "relative" }}
      >
        <Demo
          device={device}
          screen={screen}
          go={setScreen}
          notify={notify}
          reducedMotion={reducedMotion}
        />
      </div>
      {toast && (
        <p
          id="demo-toast"
          role="status"
          style={{ position: "absolute", left: 8, top: c.h + 8, font: "13px system-ui", color: "#888" }}
        >
          {toast}
        </p>
      )}
    </>
  );
}
