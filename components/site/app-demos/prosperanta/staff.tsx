"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { LogOut } from "lucide-react";
import { StatusBar } from "../kit";
import { C, clockLabel } from "./data";
import { useDemo } from "./store";
import { Logo, NavTabs, SW } from "./ui";

/* ============================================================
   Rama panourilor de personal: angajatul din stație și adminul.
   Adminul păstrează navigarea reală: antet + file sub antet.
   ============================================================ */

type AdminTab = "dashboard" | "rapoarte" | "clienti" | "campanii";

const TABS: { id: AdminTab; label: string }[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "rapoarte", label: "Rapoarte" },
  { id: "clienti", label: "Clienți" },
  { id: "campanii", label: "Campanii" },
];

export function StaffShell({ face, screen, children }: { face: "angajat" | "admin"; screen: string; children: ReactNode }) {
  const { mobile, go, notify, s } = useDemo();
  const tabsRef = useRef<HTMLDivElement>(null);

  /* pe telefon, fila activă poate sta în afara ecranului: o aducem în vedere */
  useEffect(() => {
    const nav = tabsRef.current;
    const el = nav?.querySelector<HTMLElement>('[aria-current="page"]');
    if (nav && el) nav.scrollLeft = Math.max(0, el.offsetLeft - 16);
  }, [screen]);
  const logout = () => notify("Deconectarea e oprită în demo.");

  const logoutBtn = (
    <button type="button" onClick={logout} aria-label="Deconectare" className="ico flex size-9 items-center justify-center rounded-full">
      <LogOut size={18} strokeWidth={SW} />
    </button>
  );

  const tabs =
    face === "admin" ? (
      <div
        ref={tabsRef}
        className={`prs-hscroll flex h-11 shrink-0 items-stretch bg-white ${mobile ? "px-4" : "px-6"}`}
        style={{ borderBottom: `1px solid ${C.border}` }}
      >
        <NavTabs
          label="Secțiuni"
          items={TABS.map((t) => ({ id: t.id, label: t.label, on: t.id === screen, onClick: () => go(t.id) }))}
        />
      </div>
    ) : null;

  return (
    <div className="absolute inset-0 flex flex-col" style={{ background: face === "admin" ? C.canvas : "#fff" }}>
      {mobile && <StatusBar tone="dark" bg="#fff" time={clockLabel(s.clock)} />}
      <header
        className={`flex h-14 shrink-0 items-center gap-4 bg-white ${mobile ? "pl-4 pr-2" : "px-6"}`}
        style={{ borderBottom: face === "admin" ? undefined : `1px solid ${C.border}` }}
      >
        <Logo size={mobile ? 28 : 30} />
        {face === "angajat" && !mobile && (
          <>
            <span className="h-5 w-px" style={{ background: C.border }} aria-hidden />
            <span className="text-[14px] font-medium">Calea Craiovei, Pitești</span>
          </>
        )}
        <div className="ml-auto flex items-center gap-2">
          {!mobile && (
            <span className="text-[13px]" style={{ color: C.mutedFg }}>
              {face === "admin" ? "Admin rețea" : "Ionuț Dobre · casa 2"}
            </span>
          )}
          {logoutBtn}
        </div>
      </header>
      {tabs}

      <div className="relative min-h-0 flex-1">{children}</div>
    </div>
  );
}

/** Titlul unei pagini de admin, cu acțiuni în dreapta. */
export function PageTitle({ title, sub, right }: { title: string; sub?: ReactNode; right?: ReactNode }) {
  const { mobile } = useDemo();
  return (
    <div className={`flex ${mobile ? "flex-col gap-3" : "items-center justify-between gap-6"}`}>
      <div className="min-w-0">
        <h1 className={`font-semibold leading-tight tracking-[-0.01em] ${mobile ? "text-[20px]" : "text-[22px]"}`}>{title}</h1>
        {sub && (
          <p className="mt-0.5 truncate text-[13px]" style={{ color: C.mutedFg }}>
            {sub}
          </p>
        )}
      </div>
      {right}
    </div>
  );
}
