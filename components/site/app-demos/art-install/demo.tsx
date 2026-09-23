"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DemoProps } from "../types";
import { StatusBar } from "../kit";
import {
  EMPTY_FORM,
  EXAMPLE_FORM,
  formInput,
  type CalcForm,
  type CalcInput,
  type PfCategory,
  type ProductCategory,
} from "./data";
import { AICtx, BODY, C, DemoStyles, anim, type ContactPrefill, type Nav } from "./ui";
import { Fabs, Footer, Navbar } from "./chrome";
import { Home } from "./screens/home";
import { Calculator } from "./screens/calculator";
import { Result } from "./screens/result";
import { Shop } from "./screens/shop";
import { Portfolio } from "./screens/portfolio";
import { Contact } from "./screens/contact";

/* ============================================================
   Art Instal Suppliers — site HVAC cu calculator de pompe de
   căldură. Demo pe pânză fixă: ecranul vine din `props.screen`,
   navigarea trece prin `props.go`. Restul stării e internă.
   ============================================================ */

const SCREENS = ["home", "calculator", "recomandare", "magazin", "portofoliu", "contact"] as const;
type Screen = (typeof SCREENS)[number];

const EXAMPLE_INPUT = formInput(EXAMPLE_FORM) as CalcInput;

export default function Demo({ device, screen, go, notify, reducedMotion }: DemoProps) {
  const mobile = device === "mobile";
  const cur: Screen = (SCREENS as readonly string[]).includes(screen) ? (screen as Screen) : "home";

  const [scroller, setScroller] = useState<HTMLDivElement | null>(null);
  const [overlay, setOverlay] = useState<HTMLDivElement | null>(null);
  const [form, setForm] = useState<CalcForm>(EMPTY_FORM);
  const [calcStep, setCalcStep] = useState(0);
  const [computed, setComputed] = useState<{ input: CalcInput; form: CalcForm } | null>(null);
  const [shopCat, setShopCat] = useState<ProductCategory | "toate">("toate");
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
      setShopCat("toate");
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
      shop: (cat = "toate") => {
        setShopCat(cat);
        move("magazin");
      },
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

  const onComputed = useCallback(() => {
    const input = formInput(form);
    if (!input) return;
    setComputed({ input, form });
    nav.go("recomandare");
  }, [form, nav]);

  const ctx = useMemo(
    () => ({ device, mobile, reduced: reducedMotion, scroller, overlay, notify, nav, form, setForm }),
    [device, mobile, reducedMotion, scroller, overlay, notify, nav, form]
  );

  const solid = cur !== "home" || scrolled;

  let page: React.ReactNode;
  switch (cur) {
    case "calculator":
      page = <Calculator step={calcStep} setStep={setCalcStep} onComputed={onComputed} />;
      break;
    case "recomandare":
      page = computed ? (
        <Result input={computed.input} form={computed.form} isExample={false} />
      ) : (
        <Result input={EXAMPLE_INPUT} form={EXAMPLE_FORM} isExample />
      );
      break;
    case "magazin":
      page = <Shop key={`${shopCat}-${nonce}`} initialCat={shopCat} />;
      break;
    case "portofoliu":
      page = <Portfolio key={`${pfCat}-${nonce}`} initialCat={pfCat} />;
      break;
    case "contact":
      page = <Contact key={`c-${nonce}-${prefill.context ?? ""}-${prefill.service ?? ""}`} prefill={prefill} />;
      break;
    default:
      page = <Home />;
  }

  return (
    <AICtx.Provider value={ctx}>
      <div
        className="relative h-full w-full overflow-hidden antialiased"
        style={{ background: C.bg, color: C.fg, fontFamily: BODY }}
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
