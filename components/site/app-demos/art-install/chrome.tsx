"use client";

import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  Headphones,
  Mail,
  MapPin,
  Menu,
  MessageCircle,
  Phone,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { DEMO_EMAIL, DEMO_PHONE } from "./data";
import { BTN_OUTLINE_WHITE, BTN_PRIMARY, FOCUS, Logo, MSG, anim, useAI, type Nav } from "./ui";

/* ---------------- Meniul (Navbar.tsx de pe site) ---------------- */

type Leaf = { label: string; run: (n: Nav) => void; screen?: string };

const SERVICES_MENU: Leaf[] = [
  { label: "Pompe de căldură", run: (n) => n.shop("pompe-caldura") },
  { label: "Aer condiționat", run: (n) => n.shop("aer-conditionat") },
  { label: "Centrale termice", run: (n) => n.portfolio("Centrale termice") },
  { label: "Panouri solare & Ventilație", run: (n) => n.portfolio("Panouri solare") },
  { label: "Service & Mentenanță", run: (n) => n.contact({ service: "Service & Mentenanță" }) },
];

const LINKS: (Leaf | { label: "Servicii" })[] = [
  { label: "Acasă", run: (n) => n.go("home"), screen: "home" },
  { label: "Servicii" },
  { label: "Magazin", run: (n) => n.shop(), screen: "magazin" },
  { label: "Despre noi", run: (n) => n.off("Despre noi") },
  { label: "Portofoliu", run: (n) => n.portfolio(), screen: "portofoliu" },
  { label: "Recenzii", run: (n) => n.off("Recenzii") },
  { label: "Contact", run: (n) => n.contact(), screen: "contact" },
];

export function Navbar({
  screen,
  solid,
  menuOpen,
  setMenuOpen,
}: {
  screen: string;
  solid: boolean;
  menuOpen: boolean;
  setMenuOpen: (v: boolean) => void;
}) {
  const { mobile, nav, reduced } = useAI();
  const [dd, setDd] = useState(false);
  const ddRef = useRef<HTMLDivElement>(null);
  const hover = useRef(false);

  /* Lista se închide la orice schimbare de pagină. */
  useEffect(() => {
    setDd(false);
  }, [screen]);

  /* Închide lista „Servicii” la click în afara ei sau la Escape. */
  useEffect(() => {
    if (!dd) return;
    const onDown = (e: MouseEvent) => {
      if (ddRef.current && !ddRef.current.contains(e.target as Node)) setDd(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setDd(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [dd]);

  const bg = solid || menuOpen ? "bg-[#0A0C0F] shadow-lg shadow-black/30" : "bg-transparent";

  if (mobile) {
    return (
      <nav aria-label="Meniu principal" className={`absolute inset-x-0 top-[44px] z-40 transition-all duration-300 ${bg}`}>
        <div className="flex h-16 items-center justify-between px-4">
          <button type="button" onClick={() => nav.go("home")} className={`rounded ${FOCUS}`} aria-label="Art Instal — acasă">
            <Logo size={40} />
          </button>
          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-expanded={menuOpen}
            aria-label={menuOpen ? "Închide meniul" : "Deschide meniul"}
            className={`rounded-lg p-2 text-[#F6F3EE] ${FOCUS}`}
          >
            {menuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
        {menuOpen && <MobileMenu close={() => setMenuOpen(false)} reduced={reduced} />}
      </nav>
    );
  }

  return (
    <nav aria-label="Meniu principal" className={`absolute inset-x-0 top-0 z-40 transition-all duration-300 ${bg}`}>
      <div className="mx-auto flex h-20 max-w-[1216px] items-center justify-between">
        <button type="button" onClick={() => nav.go("home")} className={`rounded ${FOCUS}`} aria-label="Art Instal — acasă">
          <Logo size={48} />
        </button>
        <div className="flex items-center gap-[18px]">
          {LINKS.map((l) =>
            "run" in l ? (
              <button
                key={l.label}
                type="button"
                onClick={() => l.run(nav)}
                aria-current={l.screen === screen ? "page" : undefined}
                className={`rounded text-sm font-medium transition-colors ${FOCUS} ${
                  l.screen === screen ? "text-[#F97316]" : "text-[#F6F3EE]/80 hover:text-[#F97316]"
                }`}
              >
                {l.label}
              </button>
            ) : (
              <div
                key="servicii"
                ref={ddRef}
                className="relative"
                onMouseEnter={() => {
                  hover.current = true;
                  setDd(true);
                }}
                onMouseLeave={() => {
                  hover.current = false;
                  setDd(false);
                }}
              >
                <button
                  type="button"
                  aria-expanded={dd}
                  aria-haspopup="true"
                  onClick={() => setDd((v) => (hover.current ? true : !v))}
                  className={`flex items-center gap-1 rounded text-sm font-medium text-[#F6F3EE]/80 transition-colors hover:text-[#F97316] ${FOCUS}`}
                >
                  Servicii
                  <ChevronDown size={14} className={`transition-transform ${dd ? "rotate-180" : ""}`} />
                </button>
                {dd && (
                  <div className="absolute left-0 top-full w-60 pt-2">
                    <div
                      className="rounded-lg border border-[#272C35] bg-[#15181E] py-2 shadow-xl shadow-black/40"
                      style={anim(reduced, "aiFadeIn .18s ease-out both")}
                    >
                      {SERVICES_MENU.map((s) => (
                        <button
                          key={s.label}
                          type="button"
                          onClick={() => {
                            setDd(false);
                            s.run(nav);
                          }}
                          className={`block w-full px-4 py-2.5 text-left text-sm text-[#EBE6E0] transition-colors hover:bg-[#F97316]/10 hover:text-[#F97316] ${FOCUS}`}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          )}
          <button
            type="button"
            onClick={() => nav.go("calculator")}
            aria-current={screen === "calculator" || screen === "recomandare" ? "page" : undefined}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors ${FOCUS} ${
              screen === "calculator" || screen === "recomandare"
                ? "border-[#A370EB] bg-[#A370EB] text-white"
                : "border-[#A370EB]/40 text-[#A370EB] hover:bg-[#A370EB] hover:text-white"
            }`}
          >
            <Sparkles size={14} /> Calculator
          </button>
          <button type="button" onClick={() => nav.off("Parteneriat")} className={`${BTN_OUTLINE_WHITE} px-4 py-2 text-sm`}>
            Parteneriat
          </button>
          <button type="button" onClick={() => nav.contact()} className={`${BTN_PRIMARY} px-5 py-2 text-sm`}>
            Solicită ofertă
          </button>
        </div>
      </div>
    </nav>
  );
}

function MobileMenu({ close, reduced }: { close: () => void; reduced: boolean }) {
  const { nav } = useAI();
  const [open, setOpen] = useState(false);
  const run = (f: () => void) => {
    close();
    f();
  };
  return (
    <div
      className="ai-noscroll absolute inset-x-0 top-16 z-40 overflow-y-auto bg-[#0A0C0F] px-6 pb-10 pt-4"
      style={{ height: 844 - 44 - 64, ...anim(reduced, "aiFadeIn .2s ease-out both") }}
    >
      <div className="flex flex-col gap-4">
        {LINKS.map((l) =>
          "run" in l ? (
            <button
              key={l.label}
              type="button"
              onClick={() => run(() => l.run(nav))}
              className={`rounded text-left text-lg font-medium text-[#F6F3EE] transition-colors hover:text-[#F97316] ${FOCUS}`}
            >
              {l.label}
            </button>
          ) : (
            <div key="servicii">
              <button
                type="button"
                aria-expanded={open}
                onClick={() => setOpen((v) => !v)}
                className={`flex w-full items-center gap-2 rounded text-left text-lg font-medium text-[#F6F3EE] ${FOCUS}`}
              >
                Servicii
                <ChevronDown size={16} className={`transition-transform ${open ? "rotate-180" : ""}`} />
              </button>
              {open && (
                <div className="ml-4 mt-2 flex flex-col gap-2">
                  {SERVICES_MENU.map((s) => (
                    <button
                      key={s.label}
                      type="button"
                      onClick={() => run(() => s.run(nav))}
                      className={`rounded text-left text-[15px] text-[#F6F3EE]/70 hover:text-[#F97316] ${FOCUS}`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        )}
        <button
          type="button"
          onClick={() => run(() => nav.go("calculator"))}
          className={`mt-4 flex items-center justify-center gap-2 rounded-full border border-[#A370EB]/50 py-2.5 font-semibold text-[#A370EB] ${FOCUS}`}
        >
          <Sparkles size={16} /> Calculator pompă
        </button>
        <button type="button" onClick={() => run(() => nav.off("Parteneriat"))} className={`${BTN_OUTLINE_WHITE} mt-2 px-8 py-3.5`}>
          Parteneriat
        </button>
        <button type="button" onClick={() => run(() => nav.contact())} className={`${BTN_PRIMARY} mt-2 px-8 py-3.5`}>
          Solicită ofertă
        </button>
      </div>
    </div>
  );
}

/* ---------------- Subsolul (Footer.tsx) ---------------- */

export function Footer() {
  const { mobile, nav, notify } = useAI();
  const link = `rounded text-left text-sm text-[#F6F3EE]/70 transition-colors hover:text-[#F97316] ${FOCUS}`;
  const company: [string, () => void][] = [
    ["Acasă", () => nav.go("home")],
    ["Calculator pompă", () => nav.go("calculator")],
    ["Portofoliu", () => nav.portfolio()],
    ["Despre noi", () => nav.off("Despre noi")],
    ["Recenzii", () => nav.off("Recenzii")],
    ["Contact", () => nav.contact()],
  ];
  const services: [string, () => void][] = [
    ["Pompe de căldură", () => nav.shop("pompe-caldura")],
    ["Aer condiționat", () => nav.shop("aer-conditionat")],
    ["Centrale termice", () => nav.portfolio("Centrale termice")],
    ["Panouri solare", () => nav.portfolio("Panouri solare")],
    ["Ventilație", () => nav.contact({ service: "Ventilație" })],
    ["Service & Mentenanță", () => nav.contact({ service: "Service & Mentenanță" })],
  ];
  return (
    <footer className="bg-[#0A0C0F] text-[#F6F3EE]">
      <div className={mobile ? "px-4 py-14" : "mx-auto max-w-[1216px] py-16"}>
        <div className={mobile ? "grid grid-cols-1 gap-10" : "grid grid-cols-4 gap-10"}>
          <div>
            <button type="button" onClick={() => nav.go("home")} className={`mb-4 rounded ${FOCUS}`} aria-label="Art Instal — acasă">
              <Logo size={48} />
            </button>
            <p className="mb-4 text-sm leading-relaxed text-[#F6F3EE]/70">
              Specializați în soluții HVAC complete — de la consultanță la service post-vânzare.
            </p>
            <p className="ai-h text-sm italic text-[#F97316]">„Soluții de confort, accesibile!”</p>
            <div className="mt-6 flex gap-4">
              {["Facebook", "Instagram", "TikTok", "YouTube"].map((s) => (
                <button key={s} type="button" onClick={() => notify(MSG.external)} className={link}>
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div>
            <h4 className="ai-h mb-4 text-lg font-bold">Companie</h4>
            <ul className="space-y-2.5">
              {company.map(([l, f]) => (
                <li key={l}>
                  <button type="button" onClick={f} className={link}>
                    {l}
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="ai-h mb-4 text-lg font-bold">Servicii</h4>
            <ul className="space-y-2.5">
              {services.map(([l, f]) => (
                <li key={l}>
                  <button type="button" onClick={f} className={link}>
                    {l}
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="ai-h mb-4 text-lg font-bold">Contact</h4>
            <p className="mb-2 text-sm font-semibold text-[#F97316]">24/7 Urgențe:</p>
            <button
              type="button"
              onClick={() => notify(MSG.call)}
              className={`mb-4 flex items-center gap-2 rounded text-xl font-bold transition-colors hover:text-[#F97316] ${FOCUS}`}
            >
              <Phone size={18} /> {DEMO_PHONE}
            </button>
            <div className="mb-3 flex items-center gap-2 text-sm text-[#F6F3EE]/70">
              <MapPin size={14} />
              <span>Pitești, județul Argeș</span>
            </div>
            <p className="mb-1 text-sm text-[#F6F3EE]/60">Trimite un mesaj:</p>
            <button
              type="button"
              onClick={() => notify(MSG.email)}
              className={`flex items-center gap-2 rounded text-sm transition-colors hover:text-[#F97316] ${FOCUS}`}
            >
              <Mail size={14} /> {DEMO_EMAIL}
            </button>
          </div>
        </div>

        <div className="mt-10 border-t border-[#F6F3EE]/10 pt-6">
          <div className="mb-4 flex flex-wrap justify-center gap-x-4 gap-y-2 text-sm">
            {["Politica de Confidențialitate", "Politica de Cookie-uri", "Termeni și Condiții"].map((l, i) => (
              <span key={l} className="flex items-center gap-4">
                {i > 0 && <span className="text-[#F6F3EE]/20">|</span>}
                <button type="button" onClick={() => nav.off(l)} className={`rounded text-[#F6F3EE]/60 transition-colors hover:text-[#F97316] ${FOCUS}`}>
                  {l}
                </button>
              </span>
            ))}
          </div>
          <div className={`flex items-center justify-between gap-4 ${mobile ? "flex-col" : ""}`}>
            <div className="flex items-center gap-2 text-sm">
              <ShieldCheck size={16} className="text-[#F97316]" />
              <span className="font-bold">Partener autorizat Daikin</span>
              <span className="text-[#F6F3EE]/60">· Autorizație Dealer 2026</span>
            </div>
            <p className={`text-sm text-[#F6F3EE]/50 ${mobile ? "text-center" : ""}`}>
              Copyright 2026 — Art Instal Suppliers SRL | Toate drepturile rezervate
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ---------------- Butoanele plutitoare (QuickContactFab.tsx) ---------------- */

export function Fabs({ screen }: { screen: string }) {
  const { mobile, nav, notify, reduced } = useAI();
  const [open, setOpen] = useState(false);
  const [tip, setTip] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const onCalc = screen === "calculator" || screen === "recomandare";
  const size = mobile ? "size-12" : "size-14";
  return (
    <div
      className="absolute z-50 flex flex-col items-end gap-3"
      style={mobile ? { right: 14, bottom: 32 } : { right: 24, bottom: 24 }}
    >
      {open && (
        <div
          className="w-64 overflow-hidden rounded-2xl border border-[#272C35] bg-[#15181E] shadow-2xl shadow-black/50"
          style={anim(reduced, "aiFadeUp .2s ease-out both")}
        >
          <div className="border-b border-[#272C35] bg-[#15181E] px-4 py-3">
            <p className="ai-h text-sm font-bold text-[#EBE6E0]">Contact rapid</p>
            <p className="text-xs text-[#9096A2]">Alege metoda preferată</p>
          </div>
          <div className="flex flex-col gap-1 p-2">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                notify(MSG.call);
              }}
              className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-[#F97316]/10 ${FOCUS}`}
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#F97316]/10 text-[#F97316] transition-colors group-hover:bg-[#F97316] group-hover:text-white">
                <Phone size={16} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-[#EBE6E0]">Sună acum</span>
                <span className="block text-xs text-[#9096A2]">{DEMO_PHONE}</span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                notify(MSG.whatsapp);
              }}
              className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-[#25D466]/10 ${FOCUS}`}
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#25D466]/10 text-[#25D466] transition-colors group-hover:bg-[#25D466] group-hover:text-white">
                <MessageCircle size={16} fill="currentColor" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-[#EBE6E0]">WhatsApp</span>
                <span className="block text-xs text-[#9096A2]">Răspundem în minute</span>
              </span>
            </button>
          </div>
        </div>
      )}

      {!onCalc && (
        <button
          type="button"
          aria-label="Calculator pompă de căldură"
          onClick={() => nav.go("calculator")}
          onMouseEnter={() => setTip(true)}
          onMouseLeave={() => setTip(false)}
          onFocus={() => setTip(true)}
          onBlur={() => setTip(false)}
          className={`relative flex ${size} items-center justify-center rounded-full bg-[#A370EB] text-white shadow-xl shadow-[#A370EB]/40 transition-transform duration-200 hover:scale-105 active:scale-95 ${FOCUS}`}
        >
          {!reduced && (
            <span
              aria-hidden
              className="absolute inset-0 rounded-full bg-[#A370EB] opacity-25"
              style={{ animation: "aiPing 2.8s cubic-bezier(0,0,.2,1) infinite" }}
            />
          )}
          <Sparkles size={22} className="relative" />
          {tip && !mobile && (
            <span className="pointer-events-none absolute right-full top-1/2 mr-3 -translate-y-1/2 whitespace-nowrap rounded-lg border border-[#272C35] bg-[#15181E] px-3 py-1.5 text-xs font-semibold text-[#EBE6E0] shadow-lg">
              Ce pompă să aleg?
            </span>
          )}
        </button>
      )}

      <button
        type="button"
        aria-label={open ? "Închide meniul de contact" : "Deschide meniul de contact rapid"}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={`relative flex ${size} items-center justify-center rounded-full bg-[#F97316] text-white shadow-xl shadow-black/40 ring-2 ring-[#0E1115]/50 transition-transform duration-200 hover:scale-105 active:scale-95 ${FOCUS}`}
      >
        {!open && !reduced && (
          <span
            aria-hidden
            className="absolute inset-0 rounded-full bg-[#F97316] opacity-30"
            style={{ animation: "aiPing 2.5s cubic-bezier(0,0,.2,1) infinite" }}
          />
        )}
        <span className="relative flex items-center justify-center">{open ? <X size={22} /> : <Headphones size={22} />}</span>
      </button>
    </div>
  );
}
