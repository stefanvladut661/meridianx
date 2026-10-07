"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { DemoProps } from "../types";
import { StatusBar } from "../kit";
import { EMPTY_FORM, type CalcForm, type PfCategory } from "./data";
import { AICtx, BODY, C, DemoStyles, anim, type ContactPrefill, type Nav } from "./ui";
import { Fabs, Footer, Navbar } from "./chrome";
import { Home } from "./screens/home";
import { Calculator } from "./screens/calculator";
import { Shop } from "./screens/shop";
import { Portfolio } from "./screens/portfolio";
import { Contact } from "./screens/contact";
import { Reviews } from "./screens/reviews";
import { About } from "./screens/about";

/* ============================================================
   Art Instal Suppliers — replica site-ului confortsolutions.ro,
   pagină cu pagină, după sursa lui: prima pagină, calculatorul de
   pompe de căldură (cu recomandarea sub formular, ca pe site),
   magazinul, portofoliul, recenziile, „Despre noi” și contactul.
   Demo pe pânză fixă: ecranul vine din `props.screen`, navigarea
   trece prin `props.go`. Restul stării e internă.

   „recomandare” nu e o pagină separată pe site: e calculatorul cu
   exemplul completat și rezultatele afișate — pasul din tur pentru
   cine nu vrea să completeze șapte câmpuri.
   ============================================================ */

const SCREENS = ["home", "calculator", "recomandare", "magazin", "portofoliu", "contact", "despre", "recenzii"] as const;
type Screen = (typeof SCREENS)[number];

export default function Demo({ device, screen, go, notify, reducedMotion }: DemoProps) {
  const mobile = device === "mobile";
  const cur: Screen = (SCREENS as readonly string[]).includes(screen) ? (screen as Screen) : "home";

  const [scroller, setScroller] = useState<HTMLDivElement | null>(null);
  const [overlay, setOverlay] = useState<HTMLDivElement | null>(null);
  const [form, setForm] = useState<CalcForm>(EMPTY_FORM);
  const [pfCat, setPfCat] = useState<PfCategory>("Toate");
  const [prefill, setPrefill] = useState<ContactPrefill>({});
  const [nonce, setNonce] = useState(0);
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const viaNav = useRef(false);

  /* La fiecare schimbare de ecran: sus, meniul închis. Dacă ecranul a
     venit din turul ghidat (nu din site), filtrele revin la implicit. */
  useEffect(() => {
    if (!viaNav.current) {
      setPfCat("Toate");
      setPrefill({});
    }
    viaNav.current = false;
    setMenuOpen(false);
    setScrolled(false);
    scroller?.scrollTo({ top: 0 });
  }, [cur, nonce, scroller]);

  const nav: Nav = useMemo(() => {
    const move = (s: string) => {
      viaNav.current = true;
      setNonce((n) => n + 1);
      go(s);
    };
    return {
      go: move,
      /* Magazinul real n-are filtre: categoria cerută doar deschide pagina. */
      shop: () => move("magazin"),
      portfolio: (cat = "Toate") => {
        setPfCat(cat);
        move("portofoliu");
      },
      contact: (p = {}) => {
        setPrefill(p);
        move("contact");
      },
      off: (page) =>
        notify(`Pagina „${page}” nu face parte din demo. Pe site-ul real, se deschide din meniu.`),
    };
  }, [go, notify]);

  const ctx = useMemo(
    () => ({ device, mobile, reduced: reducedMotion, scroller, overlay, notify, nav, form, setForm }),
    [device, mobile, reducedMotion, scroller, overlay, notify, nav, form]
  );

  const solid = cur !== "home" || scrolled;

  let page: React.ReactNode;
  switch (cur) {
    case "calculator":
      page = <Calculator />;
      break;
    case "recomandare":
      page = <Calculator example />;
      break;
    case "magazin":
      page = <Shop />;
      break;
    case "portofoliu":
      page = <Portfolio key={`${pfCat}-${nonce}`} initialCat={pfCat} />;
      break;
    case "contact":
      page = <Contact key={`c-${nonce}-${prefill.service ?? ""}`} prefill={prefill} />;
      break;
    case "despre":
      page = <About />;
      break;
    case "recenzii":
      page = <Reviews />;
      break;
    default:
      page = <Home />;
  }

  return (
    <AICtx.Provider value={ctx}>
      <div
        className="relative h-full w-full overflow-hidden antialiased"
        style={{ background: C.bg, color: C.fg, fontFamily: BODY, colorScheme: "dark" }}
      >
        {mobile && (
          <div className="absolute inset-x-0 top-0 z-50">
            <StatusBar tone="light" bg={C.navy} />
          </div>
        )}
        <DemoStyles />

        <div
          ref={setScroller}
          data-ai-scroll=""
          onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 50)}
          className="ai-noscroll absolute inset-x-0 bottom-0 overflow-y-auto overflow-x-hidden"
          style={{ top: mobile ? 44 : 0 }}
        >
          <main key={`${cur}-${nonce}`} style={anim(reducedMotion, "aiFadeIn .35s ease-out both")}>
            {page}
          </main>
          <Footer />
          {mobile && <div className="h-5 bg-[#0A0C0F]" aria-hidden />}
        </div>

        <Navbar screen={cur} solid={solid} menuOpen={menuOpen} setMenuOpen={setMenuOpen} />
        {!menuOpen && <Fabs screen={cur} />}

        <div
          ref={setOverlay}
          className="pointer-events-none absolute inset-x-0 bottom-0 z-[60]"
          style={{ top: mobile ? 44 : 0 }}
        />
      </div>
    </AICtx.Provider>
  );
}
