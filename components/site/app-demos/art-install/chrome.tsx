"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Headphones, Mail, MapPin, Menu, MessageCircle, Phone, Sparkles, X } from "lucide-react";
import { ADDRESS, EMAIL, PHONE } from "./data";
import { Logo, MSG, btnOutlineWhite, btnPrimary, container, useAI, type Nav } from "./ui";

/* ---------------- Meniul (Navbar.tsx de pe site) ---------------- */

/* Paginile de servicii nu fac parte din demo: pe site, fiecare are
   ruta ei (/servicii/...). */
const SERVICES_MENU = [
  "Pompe de căldură",
  "Aer condiționat",
  "Centrale termice",
  "Panouri solare & Ventilație",
  "Service & Mentenanță",
];

type Leaf = { label: string; run: (n: Nav) => void; screen?: string };

const LINKS: (Leaf | { label: "Servicii" })[] = [
  { label: "Acasă", run: (n) => n.go("home"), screen: "home" },
  { label: "Servicii" },
  { label: "Magazin", run: (n) => n.go("magazin"), screen: "magazin" },
  { label: "Despre noi", run: (n) => n.off("Despre noi") },
  { label: "Portofoliu", run: (n) => n.go("portofoliu"), screen: "portofoliu" },
  { label: "Recenzii", run: (n) => n.off("Recenzii") },
  { label: "Contact", run: (n) => n.go("contact"), screen: "contact" },
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
  const { mobile, nav } = useAI();
  const [dd, setDd] = useState(false);
  const ddRef = useRef<HTMLDivElement>(null);
  const hover = useRef(false);

  /* Lista se închide la orice schimbare de pagină. */
  useEffect(() => {
    setDd(false);
  }, [screen]);

  /* Pentru tastatură: lista „Servicii” se închide la Escape sau la click în afara ei. */
  useEffect(() => {
    if (!dd || mobile) return;
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
  }, [dd, mobile]);

  /* Pe prima pagină bara e transparentă până la 50px de derulare,
     inclusiv cu meniul de telefon deschis (ca pe site). */
  const bg = solid ? "bg-[#0A0C0F] shadow-lg shadow-[#0A0C0F]/20" : "bg-transparent";

  if (mobile) {
    return (
      <nav aria-label="Meniu principal" className={`absolute inset-x-0 top-[44px] z-40 transition-all duration-300 ${bg}`}>
        <div className={`${container(true)} flex h-16 items-center justify-between`}>
          <button type="button" onClick={() => nav.go("home")} className="flex items-center gap-2" aria-label="Art Instal, prima pagină">
            <Logo size={40} />
          </button>
          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-expanded={menuOpen}
            aria-label={menuOpen ? "Închide meniul" : "Deschide meniul"}
            className="p-2 text-[#F6F3EE]"
          >
            {menuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
        {menuOpen && <MobileMenu close={() => setMenuOpen(false)} open={dd} setOpen={setDd} />}
      </nav>
    );
  }

  return (
    <nav aria-label="Meniu principal" className={`absolute inset-x-0 top-0 z-40 transition-all duration-300 ${bg}`}>
      <div className={`${container(false)} flex h-20 items-center justify-between`}>
        <button type="button" onClick={() => nav.go("home")} className="flex items-center gap-2" aria-label="Art Instal, prima pagină">
          <Logo size={48} />
        </button>
        <div className="flex items-center gap-7">
          {LINKS.map((l) =>
            "run" in l ? (
              <button
                key={l.label}
                type="button"
                onClick={() => l.run(nav)}
                aria-current={l.screen === screen ? "page" : undefined}
                className={`text-sm font-medium transition-colors ${
                  l.screen === screen ? "text-[#F97015]" : "text-[#F6F3EE]/80 hover:text-[#F97015]"
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
                  className="flex items-center gap-1 text-sm font-medium text-[#F6F3EE]/80 transition-colors hover:text-[#F97015]"
                >
                  Servicii
                  <ChevronDown size={14} className={`transition-transform ${dd ? "rotate-180" : ""}`} />
                </button>
                {dd && (
                  <div className="absolute left-0 top-full w-56 pt-2">
                    <div className="rounded-[12px] border border-[#272C35] bg-[#15181E] py-2 shadow-xl">
                      {SERVICES_MENU.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => {
                            setDd(false);
                            nav.off(s);
                          }}
                          className="block w-full px-4 py-2.5 text-left text-sm text-[#EBE7E0] transition-colors hover:bg-[#F97015]/10 hover:text-[#F97015]"
                        >
                          {s}
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
            className="flex items-center gap-1.5 rounded-full border border-[#A370EB]/40 px-3 py-1.5 text-sm font-semibold text-[#A370EB] transition-colors hover:bg-[#A370EB] hover:text-white"
          >
            <Sparkles size={14} /> Calculator
          </button>
          <button type="button" onClick={() => nav.off("Parteneriat")} className={`${btnOutlineWhite(false)} px-4 py-2 text-sm`}>
            Parteneriat
          </button>
          <button type="button" onClick={() => nav.go("contact")} className={`${btnPrimary(false)} px-5 py-2 text-sm`}>
            Solicită ofertă
          </button>
        </div>
      </div>
    </nav>
  );
}

function MobileMenu({ close, open, setOpen }: { close: () => void; open: boolean; setOpen: (v: boolean) => void }) {
  const { nav } = useAI();
  const run = (f: () => void) => {
    close();
    f();
  };
  return (
    <div className="ai-noscroll absolute inset-x-0 top-16 z-40 overflow-y-auto bg-[#0A0C0F]" style={{ height: 844 - 44 - 64 }}>
      <div className="flex flex-col gap-4 p-6">
        {LINKS.map((l) =>
          "run" in l ? (
            <button
              key={l.label}
              type="button"
              onClick={() => run(() => l.run(nav))}
              className="text-left text-lg font-medium text-[#F6F3EE] transition-colors"
            >
              {l.label}
            </button>
          ) : (
            <div key="servicii">
              <button
                type="button"
                aria-expanded={open}
                onClick={() => setOpen(!open)}
                className="flex w-full items-center gap-2 text-left text-lg font-medium text-[#F6F3EE]"
              >
                Servicii
                <ChevronDown size={16} className={`transition-transform ${open ? "rotate-180" : ""}`} />
              </button>
              {open && (
                <div className="ml-4 mt-2 flex flex-col gap-2">
                  {SERVICES_MENU.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => run(() => nav.off(s))}
                      className="text-left text-[#F6F3EE]/70 transition-colors"
                    >
                      {s}
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
          className="mt-4 flex items-center justify-center gap-2 rounded-full border border-[#A370EB]/50 py-2.5 font-semibold text-[#A370EB]"
        >
          <Sparkles size={16} /> Calculator pompă
        </button>
        <button type="button" onClick={() => run(() => nav.off("Parteneriat"))} className={`${btnOutlineWhite(true)} mt-2 px-8 py-3.5 text-center`}>
          Parteneriat
        </button>
        <button type="button" onClick={() => run(() => nav.go("contact"))} className={`${btnPrimary(true)} mt-2 px-8 py-3.5 text-center`}>
          Solicită ofertă
        </button>
      </div>
    </div>
  );
}

/* ---------------- Subsolul (Footer.tsx) ---------------- */

export function Footer() {
  const { mobile, nav, notify } = useAI();
  const link = `text-left text-sm text-[#F6F3EE]/70 transition-colors ${mobile ? "" : "hover:text-[#F97015]"}`;
  const company: [string, () => void][] = [
    ["Acasă", () => nav.go("home")],
    ["Serviciile noastre", () => nav.off("Pompe de căldură")],
    ["Portofoliu", () => nav.go("portofoliu")],
    ["Despre noi", () => nav.off("Despre noi")],
    ["Recenzii", () => nav.off("Recenzii")],
    ["Contact", () => nav.go("contact")],
  ];
  const services: [string, string][] = [
    ["Pompe de căldură", "Pompe de căldură"],
    ["Aer condiționat", "Aer condiționat"],
    ["Centrale termice", "Centrale termice"],
    ["Panouri solare", "Panouri solare & Ventilație"],
    ["Ventilație", "Panouri solare & Ventilație"],
    ["Service & Mentenanță", "Service & Mentenanță"],
  ];
  const hov = mobile ? "" : "hover:text-[#F97015]";
  return (
    <footer className="bg-[#0A0C0F] text-[#F6F3EE]">
      <div className={`${container(mobile)} py-16`}>
        <div className={`grid gap-10 ${mobile ? "grid-cols-1" : "grid-cols-4"}`}>
          <div>
            <button type="button" onClick={() => nav.go("home")} className="mb-4 flex items-center gap-2" aria-label="Art Instal, prima pagină">
              <Logo size={48} />
            </button>
            <p className="mb-4 text-sm leading-relaxed text-[#F6F3EE]/70">
              Specializați în soluții HVAC complete — de la consultanță la service post-vânzare.
            </p>
            {/* Ghilimeaua de închidere e ASCII, ca pe site. */}
            <p className="text-sm italic text-[#F97015]">„Soluții de confort, accesibile!&quot;</p>
            <div className="mt-6 flex gap-4">
              {["Facebook", "Instagram", "TikTok", "YouTube"].map((s) => (
                <button key={s} type="button" onClick={() => notify(MSG.external)} className={`text-sm text-[#F6F3EE]/60 transition-colors ${hov}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div>
            <h4 className="mb-4 text-lg font-bold">Companie</h4>
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
            <h4 className="mb-4 text-lg font-bold">Servicii</h4>
            <ul className="space-y-2.5">
              {services.map(([l, page]) => (
                <li key={l}>
                  <button type="button" onClick={() => nav.off(page)} className={link}>
                    {l}
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="mb-4 text-lg font-bold">Contact</h4>
            <p className="mb-2 text-sm font-semibold text-[#F97015]">24/7 Urgențe:</p>
            <button type="button" onClick={() => notify(MSG.call)} className={`mb-4 flex items-center gap-2 text-xl font-bold transition-colors ${hov}`}>
              <Phone size={18} /> {PHONE}
            </button>
            <div className="mb-3 flex items-center gap-2 text-sm text-[#F6F3EE]/70">
              <MapPin size={14} className="shrink-0" />
              <span>{ADDRESS}</span>
            </div>
            <p className="mb-1 text-sm text-[#F6F3EE]/60">Trimite un mesaj:</p>
            <button type="button" onClick={() => notify(MSG.email)} className={`flex items-center gap-2 text-sm transition-colors ${hov}`}>
              <Mail size={14} /> {EMAIL}
            </button>
          </div>
        </div>

        <div className="mt-10 border-t border-[#F6F3EE]/10 pt-6">
          <div className="mb-4 flex flex-wrap justify-center gap-4 text-sm">
            {["Politica de Confidențialitate", "|", "Politica de Cookie-uri", "|", "Termeni și Condiții"].map((l, i) =>
              l === "|" ? (
                <span key={i} className="text-[#F6F3EE]/20" aria-hidden>
                  |
                </span>
              ) : (
                <button key={l} type="button" onClick={() => nav.off(l)} className={`text-[#F6F3EE]/60 transition-colors ${hov}`}>
                  {l}
                </button>
              )
            )}
          </div>
          <div className={`flex items-center justify-between gap-4 ${mobile ? "flex-col" : "flex-row"}`}>
            <div className="flex items-center gap-2">
              <span className="text-[#F97015]">⭐</span>
              <span className="font-bold">4.98 / 5</span>
              <span className="text-sm text-[#F6F3EE]/60">· Recenzii verificate Google</span>
            </div>
            <p className="text-sm text-[#F6F3EE]/50">Copyright 2026 — Art Instal Suppliers SRL | Toate drepturile rezervate</p>
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

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  /* Pe site, scurtătura spre calculator lipsește doar pe /calculator
     (rezultatele sunt pe aceeași pagină). */
  const onCalc = screen === "calculator" || screen === "recomandare";
  const fab = `relative flex size-14 items-center justify-center rounded-full text-white shadow-xl transition-transform duration-200 active:scale-95 ${
    mobile ? "" : "hover:scale-105"
  }`;
  const row = (tint: string) =>
    `group flex items-center gap-3 rounded-[12px] px-3 py-2.5 text-left transition-colors ${mobile ? "" : tint}`;
  return (
    <div className="absolute z-30 flex flex-col items-end gap-3" style={mobile ? { right: 20, bottom: 20 } : { right: 24, bottom: 24 }}>
      {open && (
        <div className="w-64 overflow-hidden rounded-[16px] border border-[#272C35] bg-[#15181E] shadow-2xl shadow-[#EBE7E0]/10">
          <div className="border-b border-[#272C35] bg-[#15181E]/50 px-4 py-3">
            <p className="ai-h text-sm font-bold text-[#EBE7E0]">Contact rapid</p>
            <p className="text-xs text-[#9096A2]">Alege metoda preferată</p>
          </div>
          <div className="flex flex-col gap-1 p-2">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                notify(MSG.call);
              }}
              className={row("hover:bg-[#F97015]/10")}
            >
              <span
                className={`flex size-9 shrink-0 items-center justify-center rounded-full bg-[#F97015]/10 text-[#F97015] transition-colors ${
                  mobile ? "" : "group-hover:bg-[#F97015] group-hover:text-white"
                }`}
              >
                <Phone size={16} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-[#EBE7E0]">Sună acum</span>
                <span className="block text-xs text-[#9096A2]">{PHONE}</span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                notify(MSG.whatsapp);
              }}
              className={row("hover:bg-[#25D466]/10")}
            >
              <span
                className={`flex size-9 shrink-0 items-center justify-center rounded-full bg-[#25D466]/10 text-[#25D466] transition-colors ${
                  mobile ? "" : "group-hover:bg-[#25D466] group-hover:text-[#F6F3EE]"
                }`}
              >
                <MessageCircle size={16} fill="currentColor" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-[#EBE7E0]">WhatsApp</span>
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
          className={`group ${fab} bg-[#A370EB] shadow-[#A370EB]/40`}
        >
          {!reduced && (
            <span
              aria-hidden
              className="absolute inset-0 rounded-full bg-[#A370EB] opacity-25"
              style={{ animation: "aiPing 2.8s cubic-bezier(0,0,.2,1) infinite" }}
            />
          )}
          <Sparkles size={22} className="relative" />
          {!mobile && (
            <span className="pointer-events-none absolute right-full top-1/2 mr-3 -translate-y-1/2 whitespace-nowrap rounded-[12px] border border-[#272C35] bg-[#15181E] px-3 py-1.5 text-xs font-semibold text-[#EBE7E0] opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
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
        className={`${fab} bg-[#F97015] shadow-[#F97015]/30`}
      >
        {!open && !reduced && (
          <span
            aria-hidden
            className="absolute inset-0 rounded-full bg-[#F97015] opacity-30"
            style={{ animation: "aiPing 2.5s cubic-bezier(0,0,.2,1) infinite" }}
          />
        )}
        <span className="relative flex items-center justify-center">{open ? <X size={22} /> : <Headphones size={22} />}</span>
      </button>
    </div>
  );
}
