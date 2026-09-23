"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { LogOut, Menu, MapPin, Smartphone, Shield, Wrench } from "lucide-react";
import { StatusBar } from "../kit";
import { C, clockLabel } from "./data";
import { useDemo } from "./store";
import { CloseBtn, LiveDot, Logo, Overlay, Pills, RoleSwitch } from "./ui";

/* ============================================================
   Rama panourilor de personal: angajatul din stație și adminul.
   Adminul păstrează navigarea reală: antet + file-pastilă.
   ============================================================ */

type AdminTab = "dashboard" | "statii" | "angajati" | "rapoarte" | "clienti" | "campanii" | "recompense-admin" | "combustibil";

const TABS: { id: AdminTab; label: string; locked?: string }[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "statii", label: "Stații", locked: "În demo, secțiunea Stații e închisă. În aplicația reală, aici se adaugă stațiile noi, cu adresă și coordonate pe hartă." },
  { id: "angajati", label: "Angajați", locked: "În demo, secțiunea Angajați e închisă. În aplicația reală, aici se dau drepturi de angajat și se atribuie fiecare om unei stații." },
  { id: "rapoarte", label: "Rapoarte" },
  { id: "clienti", label: "Clienți" },
  { id: "campanii", label: "Campanii" },
  { id: "recompense-admin", label: "Recompense", locked: "În demo, catalogul de recompense e doar de citit. În aplicația reală, adminul adaugă recompense, schimbă pragurile de puncte și vede fiecare voucher folosit." },
  { id: "combustibil", label: "Combustibil", locked: "Punctele pe litru se reglează în demo din pagina Campanii, secțiunea „Reguli de punctare”." },
];

export function StaffShell({ face, screen, children }: { face: "angajat" | "admin"; screen: string; children: ReactNode }) {
  const { mobile, go, notify, s } = useDemo();
  const [menu, setMenu] = useState(false);
  const tabsRef = useRef<HTMLElement>(null);

  /* pe telefon, fila activă poate sta în afara ecranului: o aducem în vedere */
  useEffect(() => {
    const nav = tabsRef.current;
    const el = nav?.querySelector<HTMLElement>("[aria-selected=\"true\"]");
    if (nav && el) nav.scrollLeft = Math.max(0, el.offsetLeft - 12);
  }, [screen]);
  const logout = () => notify("În demo, deconectarea e oprită. În aplicația reală, sesiunea se închide și revii la ecranul de conectare.");

  const onTab = (id: AdminTab) => {
    const t = TABS.find((x) => x.id === id)!;
    if (t.locked) notify(t.locked);
    else go(id);
  };

  const tabs =
    face === "admin" ? (
      <Pills<AdminTab>
        label="Secțiuni admin"
        value={(TABS.some((t) => t.id === screen) ? screen : "dashboard") as AdminTab}
        onChange={onTab}
        items={TABS.map((t) => ({ id: t.id, label: t.label, locked: !!t.locked }))}
        size={mobile ? "sm" : "md"}
      />
    ) : null;

  return (
    <div className="absolute inset-0 flex flex-col" style={{ background: face === "admin" ? "#FAFAFA" : "#fff" }}>
      {mobile ? (
        <>
          <StatusBar tone="dark" bg="#fff" />
          <header className="flex h-[58px] shrink-0 items-center gap-3 bg-white px-4" style={{ borderBottom: `1px solid ${C.border}` }}>
            <Logo size={30} sub="" />
            <span className="text-[12px] font-black uppercase" style={{ color: C.red }}>
              {face === "admin" ? "Admin" : "Angajat"}
            </span>
            <button type="button" aria-label="Meniu" onClick={() => setMenu(true)} className="-mr-1 ml-auto flex size-11 items-center justify-center rounded-full">
              <Menu size={26} strokeWidth={2.2} />
            </button>
          </header>
          {tabs && (
            <nav ref={tabsRef} aria-label="Secțiuni" className="prs-hscroll relative shrink-0 bg-white px-3 py-2" style={{ borderBottom: `1px solid ${C.border}` }}>
              {tabs}
            </nav>
          )}
        </>
      ) : (
        <>
          <header className="flex h-[64px] shrink-0 items-center gap-4 bg-white px-6" style={{ borderBottom: `1px solid ${C.border}` }}>
            <Logo size={34} sub={face === "admin" ? "Panou de administrare" : "Panou angajat"} />
            <span className="rounded-full px-3 py-1 text-[12px] font-black uppercase" style={{ background: "#FDECEE", color: C.red }}>
              {face === "admin" ? "Admin" : "Angajat"}
            </span>
            {face === "angajat" && (
              <span className="flex items-center gap-1.5 text-[13px] font-bold" style={{ color: C.mutedFg }}>
                <MapPin size={15} strokeWidth={2.4} style={{ color: C.red }} /> Stația Calea Craiovei, Pitești · Tura 07:00–15:00
              </span>
            )}
            <div className="ml-auto flex items-center gap-3">
              <RoleSwitch face={face} compact />
              <button
                type="button"
                onClick={logout}
                aria-label="Deconectare"
                className="flex size-10 items-center justify-center rounded-full transition-colors hover:bg-[#FDECEE]"
                style={{ color: C.red }}
              >
                <LogOut size={20} strokeWidth={2.4} />
              </button>
            </div>
          </header>
          {tabs && (
            <nav aria-label="Secțiuni" className="flex h-[54px] shrink-0 items-center gap-4 bg-white px-6" style={{ borderBottom: `1px solid ${C.border}` }}>
              {tabs}
              <span className="ml-auto flex items-center gap-2 text-[12.5px] font-bold" style={{ color: C.mutedFg }}>
                <LiveDot /> LIVE · Azi, 23 sept. · <span className="tnum">{clockLabel(s.clock)}</span>
              </span>
            </nav>
          )}
        </>
      )}

      <div className="relative min-h-0 flex-1">{children}</div>

      <Overlay open={menu} onClose={() => setMenu(false)} label="Meniu" kind="right">
        <div className="flex h-full flex-col px-6 pb-8 pt-14">
          <div className="flex items-center justify-between">
            <p className="text-[19px] font-black uppercase">{face === "admin" ? "Admin" : "Ionuț Dobre"}</p>
            <CloseBtn onClick={() => setMenu(false)} />
          </div>
          <p className="mt-1 text-[13px]" style={{ color: C.mutedFg }}>
            {face === "admin" ? "Rețeaua Prosperanța · 16 stații" : "Stația Calea Craiovei · Tura 07:00–15:00"}
          </p>
          <nav aria-label="Meniu" className="mt-6 flex flex-col text-[15px] font-bold uppercase">
            {face === "admin" &&
              TABS.filter((t) => !t.locked).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    go(t.id);
                    setMenu(false);
                  }}
                  className="py-3 text-left"
                  style={{ borderBottom: `1px solid ${C.border}`, color: t.id === screen ? C.red : C.fg }}
                >
                  {t.label}
                </button>
              ))}
            <button type="button" onClick={() => go("home")} className="flex items-center gap-2 py-3 text-left" style={{ borderBottom: `1px solid ${C.border}` }}>
              <Smartphone size={19} strokeWidth={2.4} /> Aplicația client
            </button>
            {face === "admin" ? (
              <button type="button" onClick={() => go("statie")} className="flex items-center gap-2 py-3 text-left" style={{ borderBottom: `1px solid ${C.border}` }}>
                <Wrench size={19} strokeWidth={2.4} /> Angajat
              </button>
            ) : (
              <button type="button" onClick={() => go("dashboard")} className="flex items-center gap-2 py-3 text-left" style={{ borderBottom: `1px solid ${C.border}` }}>
                <Shield size={19} strokeWidth={2.4} /> Admin
              </button>
            )}
            <button type="button" onClick={logout} className="mt-4 flex items-center gap-2 py-3 text-left" style={{ color: C.red }}>
              <LogOut size={19} strokeWidth={2.4} /> Deconectare
            </button>
          </nav>
        </div>
      </Overlay>
    </div>
  );
}

/** Titlul unei pagini de admin, cu acțiuni în dreapta. */
export function PageTitle({ title, sub, right }: { title: string; sub?: ReactNode; right?: ReactNode }) {
  const { mobile } = useDemo();
  return (
    <div className={`flex ${mobile ? "flex-col gap-3" : "items-end justify-between gap-6"}`}>
      <div className="min-w-0">
        <h1 className={`font-black uppercase leading-none tracking-[-0.02em] ${mobile ? "text-[24px]" : "text-[28px]"}`}>{title}</h1>
        {sub && (
          <p className="mt-2 text-[13.5px]" style={{ color: C.mutedFg }}>
            {sub}
          </p>
        )}
      </div>
      {right}
    </div>
  );
}
