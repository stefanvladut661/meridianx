"use client";

import { Link } from "@/i18n/navigation";
import { useEffect, useRef, useState, type ComponentProps } from "react";
import { Mark } from "@/components/site/mark";
import { LEGAL_LINKS } from "@/components/site/legal-links";
import { Marquee, Reveal, useScrolled } from "@/components/site/motion";
import { Faq, Icon } from "@/components/site/ui";
import { VideoCard } from "@/components/site/video-player";
import { Configurator } from "@/components/site/configurator";
import { SCREENS } from "@/components/site/software-screens";
import st from "./software.module.css";
import { ObfuscatedEmail } from "@/components/site/obfuscated-email";
import {
  WorldSwitch,
  WorldSwitchMobileLink,
} from "@/components/site/world-switch";
import {
  AUDIENCE,
  CONSULT_OUTPUT,
  GUARANTEES,
  SCONTACT,
  SPRESENTATION,
  SFAQ,
  SNAV,
  SOLUTIONS,
  SPROCESS,
  SREVIEWS,
  SREVIEW_VIDEO,
} from "@/components/site/software-content";
import { getDemo } from "@/components/site/app-demos/registry";
import { ProjectsGrid, Unbroken } from "./software-projects";

/* ============================================================
   MERIDIAN SOFTWARE — landing corporate.

   Aceeași gramatică de suprafețe ca la video (glass, glow difuz,
   spațiu generos), alt temperament: colțuri strânse, grilă vizibilă,
   motion sub 400ms, zero flourish cinematic. Video cumpără cu ochii,
   software cumpără cu încrederea — de-aia pagina duce spre un
   configurator care produce un document, nu spre un showreel.

   Culorile nu sunt scrise nicăieri în componente: vin din
   [data-scope="software"], deci paleta se schimbă dintr-un singur loc.
   ============================================================ */

export function SoftwareScreen() {

  return (
    <div
      data-scope="software"
      className="md-root min-h-dvh overflow-clip"
    >
      <Nav />
      <main id="continut">
        <Hero />
        <AudienceStrip />
        <Solutions />
        <Process />
        <Guarantees />
        <Questions />
        {/* Dovezile stau lângă formular: proiectele, care se pot încerca,
            apoi ce spun clienții. Formularul rămâne ultimul — cine ajunge
            acolo a văzut deja ce facem, cum lucrăm și ce garantăm. */}
        <Projects />
        <Reviews />
        <LeadMagnet />
      </main>
      <Foot />
      {/* Stânga sus: acolo stă video în poartă. */}
      <WorldSwitch to="video" />
    </div>
  );
}

/** Reveal-ul lumii software: acelaşi mecanism, dar sub 400ms. */
function R(props: ComponentProps<typeof Reveal>) {
  return (
    <Reveal {...props} className={`reveal-fast ${props.className ?? ""}`} />
  );
}

/* ---------------- Navigație ---------------- */
function Nav() {
  const [open, setOpen] = useState(false);
  const scrolled = useScrolled(20);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-colors duration-300 ${
        scrolled
          ? "border-b border-hair bg-ink/85 backdrop-blur-xl"
          : "border-b border-transparent"
      }`}
    >
      <nav
        className="ws-inset-left mx-auto flex h-16 max-w-6xl items-center gap-4 px-5 sm:px-6"
        aria-label="Principal"
      >
        <Link href="/" className="flex shrink-0 items-center gap-2 text-bone sm:gap-2.5">
          <span className="block origin-left scale-[0.85] sm:scale-100">
            <Mark size={24} />
          </span>
          <span className="flex items-baseline gap-1.5">
            <span className="font-md-display text-[14px] font-bold tracking-tight sm:text-[15px]">
              MERIDIAN
            </span>
            <span className="hidden font-md-mono text-[11px] tracking-widest text-dim sm:inline">
              SOFTWARE
            </span>
          </span>
        </Link>

        <ul className="mx-auto hidden items-center gap-5 lg:flex xl:gap-7">
          {SNAV.map((n) => (
            <li key={n.href}>
              <a
                href={n.href}
                className="whitespace-nowrap text-[14px] text-dim transition-colors duration-200 hover:text-bone"
              >
                {n.label}
              </a>
            </li>
          ))}
        </ul>

        {/* Între 1024 și 1280 nu încap și meniul, și telefonul, pe un rând:
            acolo telefonul cedează locul (rămâne în subsol, la Contact),
            altfel legăturile se rup pe două rânduri. */}
        <a
          href={SCONTACT.phoneHref}
          className="ml-auto hidden items-center gap-2 whitespace-nowrap text-[13.5px] text-dim transition-colors hover:text-bone md:flex lg:ml-0 lg:hidden xl:flex"
        >
          <Icon name="phone" size={15} />
          {SCONTACT.phone}
        </a>
        <a
          href="#configurator"
          className="btn btn-primary ml-auto shrink-0 whitespace-nowrap !min-h-10 !rounded-panel-sm !px-3.5 !py-2 !text-[12.5px] sm:!px-4 sm:!text-[13px] md:ml-4"
        >
          <span className="sm:hidden">Consultanță</span>
          <span className="hidden sm:inline">Consultanță gratuită</span>
        </a>

        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls="meniu-soft"
          className="flex size-10 shrink-0 touch-manipulation items-center justify-center rounded-panel-sm border border-hair bg-white/[0.04] text-bone lg:hidden"
        >
          <span className="sr-only">Meniu</span>
          <span className="relative block h-3 w-4">
            <span
              className="absolute inset-x-0 top-0 h-px bg-current transition-transform duration-300"
              style={{ transform: open ? "translateY(6px) rotate(45deg)" : "" }}
            />
            <span
              className="absolute inset-x-0 top-1.5 h-px bg-current transition-opacity duration-300"
              style={{ opacity: open ? 0 : 1 }}
            />
            <span
              className="absolute inset-x-0 top-3 h-px bg-current transition-transform duration-300"
              style={{
                transform: open ? "translateY(-6px) rotate(-45deg)" : "",
              }}
            />
          </span>
        </button>
      </nav>

      {open && (
        <div
          id="meniu-soft"
          className="border-t border-hair bg-ink px-5 py-2 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.95)] sm:px-6 lg:hidden"
        >
          <ul className="mx-auto max-w-6xl">
            {SNAV.map((n) => (
              <li key={n.href}>
                <a
                  href={n.href}
                  onClick={() => setOpen(false)}
                  className="block border-b border-hair py-3.5 text-[15px] text-bone"
                >
                  {n.label}
                </a>
              </li>
            ))}
            <li>
              <a
                href={SCONTACT.phoneHref}
                className="flex items-center gap-2 py-3.5 text-[15px] text-a2"
              >
                <Icon name="phone" size={16} />
                {SCONTACT.phone}
              </a>
            </li>
            <li className="border-t border-hair">
              <WorldSwitchMobileLink to="video" />
            </li>
          </ul>
        </div>
      )}
    </header>
  );
}

/* ---------------- Hero ---------------- */
function Hero() {
  return (
    <section className="relative overflow-hidden pb-20 pt-24 sm:pt-28 lg:pb-24">
      <div
        aria-hidden
        className="aurora aurora-drift"
        style={{
          width: "clamp(320px, 44vw, 720px)",
          height: "clamp(320px, 44vw, 720px)",
          right: "-10%",
          top: "-10%",
          background:
            "radial-gradient(circle, color-mix(in oklab, var(--md-a1) 60%, transparent), transparent 62%)",
          opacity: "var(--md-glow-o, 0.4)",
        }}
      />
      <div
        aria-hidden
        className="aurora aurora-drift-2"
        style={{
          width: "clamp(260px, 34vw, 540px)",
          height: "clamp(260px, 34vw, 540px)",
          right: "26%",
          top: "22%",
          background:
            "radial-gradient(circle, color-mix(in oklab, var(--md-a3) 45%, transparent), transparent 62%)",
          opacity: "var(--md-glow-o, 0.4)",
        }}
      />
      <div
        aria-hidden
        className="techgrid pointer-events-none absolute inset-0"
      />

      <div className="relative z-10 mx-auto grid max-w-6xl items-center gap-14 px-5 sm:px-6 lg:grid-cols-[1.02fr_1fr] lg:gap-12">
        <div>
          <R>
            <h1 className="display mt-4 text-[clamp(2.3rem,5.8vw,4.1rem)]">
              Software construit{" "}
              <span className="text-a2">pe felul în care lucrezi.</span>
            </h1>
          </R>

          <R delay={70}>
            <p className="mt-5 max-w-lg text-[16px] leading-relaxed text-dim sm:mt-6 sm:text-[16.5px]">
              Aplicații, dashboard-uri și integrări, livrate pe etape scurte și
              predate pe numele firmei tale.
            </p>
          </R>

          <R delay={130}>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <a
                href="#configurator"
                className="btn btn-primary !rounded-panel-sm"
              >
                <Icon name="calendar" size={17} />
                Programează consultanța gratuită
              </a>
              <a href="#solutii" className="btn btn-ghost !rounded-panel-sm">
                Vezi ce construim
                <Icon name="arrowRight" size={16} className="arw" />
              </a>
            </div>
          </R>

          <R delay={190}>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2.5">
              {[
                "Ofertă fermă, pe etape",
                "Cod și conturi pe firma ta",
                "Fișă de proiect, chiar dacă nu semnezi",
              ].map((t) => (
                <li
                  key={t}
                  className="flex items-center gap-2 text-[13.5px] text-dim"
                >
                  <Icon name="check" size={15} className="text-a1" />
                  {t}
                </li>
              ))}
            </ul>
          </R>
        </div>

        <R delay={110} variant="scale" className="relative">
          <VideoCard
            item={SPRESENTATION}
            eager
            className="shadow-[0_40px_120px_-40px_rgba(0,0,0,0.9)]"
          />

          {/* Cardurile stau sub placă, nu peste film; decalajul mic e intenționat. */}
          <div className="mt-4 hidden items-start gap-4 sm:flex">
          <div className="glass-2 edge-light float w-[196px] flex-1 -rotate-[0.6deg] p-3.5">
            <p className="font-md-mono text-[10.5px] uppercase tracking-[0.16em] text-dim">
              Etapa 01
            </p>
            <p className="mt-1.5 text-[13.5px] leading-snug text-bone">
              Prima versiune, în mâinile echipei
            </p>
            <div
              className="mt-3 h-1 w-full overflow-hidden rounded-full bg-glass"
              aria-hidden
            >
              <span className="block h-full w-3/5 rounded-full bg-a1" />
            </div>
            <p className="mt-2 text-[11.5px] text-dim">
              săptămâna 5 <span className="text-dim/70">(exemplu)</span>
            </p>
          </div>

          <div className="glass-2 edge-light float-2 mt-5 w-[172px] flex-1 rotate-[0.8deg] p-3.5">
            <div className="flex items-center gap-2">
              <Icon name="shield" size={15} className="text-a1" />
              <span className="font-md-mono text-[10.5px] uppercase tracking-[0.16em] text-dim">
                Predare
              </span>
            </div>
            <p className="mt-2 text-[13px] leading-snug text-dim">
              Cod, conturi și documentație pe{" "}
              <span className="text-bone">numele tău</span>.
            </p>
          </div>
          </div>
        </R>
      </div>
    </section>
  );
}

/* ---------------- Cine sunt clienții ---------------- */
function AudienceStrip() {
  return (
    <section className="relative border-y border-hair bg-char/50 py-4 sm:py-6">
      <p className="sr-only">Domenii în care lucrăm</p>
      <Marquee duration={46}>
        {AUDIENCE.map((a) => (
          <span
            key={a.label}
            className="flex items-center gap-2 whitespace-nowrap px-4 sm:gap-3 sm:px-7"
          >
            <span className="node-dot" aria-hidden />
            <span className="text-[14px] font-medium text-bone sm:text-[15px]">
              {a.label}
            </span>
            <span className="hidden text-[13.5px] text-dim sm:inline">{a.short}</span>
          </span>
        ))}
      </Marquee>
    </section>
  );
}

/* ---------------- Titlu de secțiune, varianta software ----------------
   Doar eyebrow + titlu. Subtitlurile au fost scoase: titlul trebuie să
   se țină singur, iar ce merită explicat stă în conținutul secțiunii. */
function Head({
  eyebrow,
  title,
  align = "center",
}: {
  eyebrow: string;
  title: React.ReactNode;
  align?: "center" | "left";
}) {
  const c = align === "center";
  return (
    <R className={`${c ? "mx-auto text-center" : ""} max-w-3xl`}>
      <p
        className={`eyebrow mb-4 flex items-center gap-2 ${
          c ? "justify-center" : ""
        }`}
      >
        <span className="node-dot" aria-hidden />
        {eyebrow}
      </p>
      <h2 className="display text-[clamp(2rem,5vw,3.3rem)]">{title}</h2>
    </R>
  );
}

/**
 * Banda de chemare la acțiune, pusă la capătul unei secțiuni: o
 * întrebare și butonul. Aceeași destinație ca butonul din bară.
 */
function CtaBand({ title }: { title: string }) {
  return (
    <R delay={120} className="mx-auto mt-10 max-w-6xl">
      <div className="glass-2 edge-light flex flex-col items-start gap-5 p-6 sm:p-7 lg:flex-row lg:items-center lg:justify-between">
        <h3 className="display text-[clamp(1.3rem,2.6vw,1.7rem)]">{title}</h3>
        <a
          href="#configurator"
          className="btn btn-primary shrink-0 !rounded-panel-sm !px-7"
        >
          <Icon name="calendar" size={17} />
          Programează consultanța gratuită
        </a>
      </div>
    </R>
  );
}

/* ---------------- Ce construim ----------------
   Vitrină cu file, nu grilă de carduri: în stânga numele, în dreapta
   un ecran care arată aplicația lucrând. Filele avansează singure cât
   timp nimeni nu le atinge; primul clic, tastă sau hover preia
   controlul. Sub prefers-reduced-motion nu avansează deloc. */
const TAB_MS = 6000;

function Solutions() {
  const [active, setActive] = useState(0);
  const [auto, setAuto] = useState(true);
  const [hold, setHold] = useState(false);
  const [inView, setInView] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setAuto(false);
    }
    const el = wrap.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => setInView(e.isIntersecting),
      { threshold: 0.35 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const pick = (i: number, focus = false) => {
    const n = (i + SOLUTIONS.length) % SOLUTIONS.length;
    setAuto(false);
    setActive(n);
    if (focus) tabs.current[n]?.focus();
  };

  const onKey = (e: React.KeyboardEvent) => {
    const map: Record<string, number> = {
      ArrowDown: active + 1,
      ArrowRight: active + 1,
      ArrowUp: active - 1,
      ArrowLeft: active - 1,
      Home: 0,
      End: SOLUTIONS.length - 1,
    };
    if (e.key in map) {
      e.preventDefault();
      pick(map[e.key], true);
    }
  };

  const cur = SOLUTIONS[active];
  const Screen = SCREENS[cur.key];

  return (
    <section id="solutii" className="relative px-5 py-16 sm:px-6 sm:py-24 lg:py-28">
      <Head eyebrow="Ce construim" title="Orice aplicație, la comandă." />

      <div
        ref={wrap}
        onMouseEnter={() => setHold(true)}
        onMouseLeave={() => setHold(false)}
        className="mx-auto mt-10 grid max-w-6xl gap-4 sm:mt-14 lg:grid-cols-[minmax(0,300px)_1fr] lg:gap-8"
      >
        <div
          role="tablist"
          aria-label="Tipuri de aplicații"
          aria-orientation="vertical"
          onKeyDown={onKey}
          className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] sm:-mx-6 sm:px-6 lg:mx-0 lg:flex-col lg:gap-0 lg:overflow-visible lg:px-0 lg:pb-0"
        >
          {SOLUTIONS.map((s, i) => {
            const on = i === active;
            return (
              <button
                key={s.key}
                ref={(el) => {
                  tabs.current[i] = el;
                }}
                id={`tab-${s.key}`}
                type="button"
                role="tab"
                aria-selected={on}
                aria-controls="panou-solutii"
                tabIndex={on ? 0 : -1}
                onClick={() => pick(i)}
                className={`relative shrink-0 whitespace-nowrap rounded-full border px-4 py-2 text-[14.5px] transition-colors duration-200 lg:rounded-none lg:border-0 lg:border-l-2 lg:py-3.5 lg:pl-5 lg:text-left lg:text-[19px] lg:font-medium ${
                  on
                    ? "border-a1 bg-a1/10 text-bone lg:border-a1 lg:bg-transparent"
                    : "border-hair text-dim hover:text-bone lg:border-hair"
                }`}
              >
                {s.title}
              </button>
            );
          })}
        </div>

        <R delay={60}>
          <div className="glass-2 edge-light overflow-hidden !p-0">
            <div className="relative flex items-center gap-3 border-b border-hair px-4 py-2.5">
              <span className="flex gap-1.5" aria-hidden>
                <span className="size-2.5 rounded-full bg-hair" />
                <span className="size-2.5 rounded-full bg-hair" />
                <span className="size-2.5 rounded-full bg-hair" />
              </span>
              <span className="truncate font-md-mono text-[11.5px] text-dim">
                firma-ta.ro/<span className="text-bone">{cur.path}</span>
              </span>
              <span className="ml-auto shrink-0 rounded-full border border-hair px-2 py-0.5 font-md-mono text-[9.5px] uppercase tracking-widest text-dim">
                schiță
              </span>
              {auto && (
                <span
                  key={active}
                  aria-hidden
                  className={`${st.progress} absolute inset-x-0 bottom-[-1px] h-0.5 bg-a1`}
                  style={
                    {
                      "--dur": `${TAB_MS}ms`,
                      animationPlayState: inView && !hold ? "running" : "paused",
                    } as React.CSSProperties
                  }
                  onAnimationEnd={() =>
                    setActive((a) => (a + 1) % SOLUTIONS.length)
                  }
                />
              )}
            </div>

            <div
              id="panou-solutii"
              role="tabpanel"
              aria-labelledby={`tab-${cur.key}`}
              tabIndex={0}
              className="focus-visible:outline-offset-[-2px]"
            >
              <div className="bg-char/40 px-3 py-4 sm:px-6 sm:py-6">
                <Screen key={cur.key} />
              </div>
              <div className="flex flex-col gap-1 border-t border-hair px-5 py-4 sm:flex-row sm:items-baseline sm:gap-4 sm:px-6">
                <h3 className="shrink-0 text-[16px] font-medium text-bone">
                  {cur.title}
                </h3>
                <p className="text-[14.5px] text-dim">{cur.line}</p>
                {"demo" in cur && getDemo(cur.demo) && (
                  <Link
                    href={`/software/proiecte/${cur.demo}`}
                    className="mt-2 inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap text-[14px] font-medium text-a1 transition-colors hover:text-bone sm:ml-auto sm:mt-0"
                  >
                    Proiect real: {getDemo(cur.demo)?.name}
                    <Icon name="arrowRight" size={14} />
                  </Link>
                )}
              </div>
            </div>
          </div>
        </R>
      </div>

      <CtaBand title="Nu e în listă? Construim pe procesul tău." />
    </section>
  );
}

/* ---------------- Proces ----------------
   O șină cu cinci noduri, desenată de la stânga la dreapta (pe telefon,
   de sus în jos). Fiecare etapă: un titlu scurt și un singur rând. */
function Process() {
  return (
    <section id="proces" className="relative px-5 py-16 sm:px-6 sm:py-24 lg:py-28">
      <Head eyebrow="Cum lucrăm" title="De la apel la predare." />

      <R className="mx-auto mt-12 max-w-6xl sm:mt-16">
        <ol className={st.rail}>
          {SPROCESS.map((p, i) => (
            <li
              key={p.n}
              className={st.step}
              style={{ ["--i" as string]: i } as React.CSSProperties}
            >
              {i < SPROCESS.length - 1 && <span className={st.seg} aria-hidden />}
              <span className={st.node} aria-hidden>
                {p.n}
              </span>
              <div className="pt-2 lg:pt-0 lg:pr-4">
                <h3 className="display text-[clamp(1.25rem,1.9vw,1.5rem)]">
                  <span className="sr-only">Etapa {i + 1}: </span>
                  {p.title}
                </h3>
                <p className="mt-2 text-[14.5px] leading-relaxed text-dim">
                  {p.line}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </R>
    </section>
  );
}

/* ---------------- Garanții ----------------
   Nu încă o grilă de carduri: o foaie de contract. Clauzele se bifează
   pe rând, iar semnătura noastră se scrie la final — exact promisiunea
   secțiunii: ce e aici intră în contract. */
function Guarantees() {
  return (
    <section id="garantii" className="relative px-5 py-16 sm:px-6 sm:py-24 lg:py-28">
      <Head eyebrow="Garanții" title="Scrise în contract, nu pe site." />

      <R className="mx-auto mt-12 max-w-5xl sm:mt-16">
        <div className={`${st.sheet} px-5 py-7 sm:px-10 sm:py-10`}>
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-hair pb-5">
            <p className="font-md-mono text-[11px] uppercase tracking-[0.18em] text-dim">
              Anexa 1 · Obligațiile MERIDIAN
            </p>
            <p className="font-md-mono text-[11px] text-dim">pag. 1 / 1</p>
          </div>

          <ol className="mt-2 grid gap-x-12 md:grid-cols-2">
            {GUARANTEES.map((g, i) => (
              <li
                key={g.title}
                className="flex gap-4 border-b border-hair py-5 sm:py-6"
                style={{ ["--i" as string]: i } as React.CSSProperties}
              >
                <svg viewBox="0 0 28 28" className={st.box} aria-hidden>
                  <rect x="1" y="1" width="26" height="26" rx="6" className={st.boxFrame} />
                  <path d="M8 14.5l4 4 8-9" className={st.tick} />
                </svg>
                <div>
                  <p className="font-md-mono text-[10.5px] uppercase tracking-[0.16em] text-dim">
                    Art. {i + 1}
                  </p>
                  <h3 className="display mt-1 text-[clamp(1.25rem,2.2vw,1.6rem)]">
                    {g.title}
                  </h3>
                  {g.line && (
                    <p className="mt-1.5 text-[14.5px] leading-relaxed text-dim">
                      {g.line}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>

          <div className="mt-8 grid items-end gap-8 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto]">
            <div>
              <svg viewBox="0 0 250 60" className="h-12 w-auto" aria-hidden>
                <path
                  d="M8 42 C 24 6, 42 4, 36 34 S 58 58, 72 26 S 92 10, 98 34 S 124 50, 142 22 C 150 8, 166 30, 182 28 S 214 20, 242 32"
                  className={st.signature}
                />
              </svg>
              <div className="border-t border-hair pt-2 font-md-mono text-[11px] uppercase tracking-[0.16em] text-dim">
                Pentru MERIDIAN
              </div>
            </div>
            <div>
              <div className="flex h-12 items-end pb-2">
                <span className={st.caret} aria-hidden />
              </div>
              <div className="border-t border-hair pt-2 font-md-mono text-[11px] uppercase tracking-[0.16em] text-dim">
                Pentru firma ta
              </div>
            </div>
            <a
              href="#configurator"
              className="btn btn-primary !rounded-panel-sm !px-6 sm:col-span-2 lg:col-span-1"
            >
              <Icon name="calendar" size={17} />
              Le vreau în contract
            </a>
          </div>
        </div>
      </R>
    </section>
  );
}

/* ---------------- Proiecte ----------------
   Portofoliul de aplicații. Fiecare card duce într-un demo care se
   poate folosi — dovada nu e o captură, e aplicația. */
function Projects() {
  return (
    <section id="proiecte" className="relative px-5 py-16 sm:px-6 sm:py-24 lg:py-28">
      <Head eyebrow="Proiecte" title="Aplicații livrate. Încearcă-le." />
      <ProjectsGrid />
      <R delay={80} className="mt-8 flex justify-center">
        <Link href="/software/proiecte" className="btn btn-ghost !rounded-panel-sm">
          Toate proiectele, pe larg
          <Icon name="arrowRight" size={16} className="arw" />
        </Link>
      </R>
    </section>
  );
}

/* ---------------- Recenzii ----------------
   Clientul filmat în stânga, citatul lui scris în dreapta, ca pe
   /video. Clipul e orizontal (un interviu la birou, nu un vertical de
   telefon), deci ia jumătate de rând, nu o coloană îngustă: pe desktop
   cele două plăci au aceeași înălțime, pe telefon videoul vine primul,
   pe toată lățimea. Citatul duce la demo-ul proiectului despre care
   vorbește — dovada de lângă dovadă. */
function Reviews() {
  const video = SREVIEW_VIDEO;
  return (
    <section id="recenzii" className="relative px-5 py-16 sm:px-6 sm:py-24 lg:py-28">
      <Head eyebrow="Recenzii" title="Spus de clienți, nu de noi." />
      <div
        className={`mx-auto mt-12 grid max-w-5xl gap-5 sm:mt-16 ${
          video ? "lg:grid-cols-[minmax(0,1.12fr)_minmax(0,1fr)] lg:gap-6" : ""
        }`}
      >
        {video && (
          <R variant="scale" className="min-w-0 lg:self-center">
            <VideoCard item={video} className="w-full" />
          </R>
        )}
        <div className="flex min-w-0 flex-col gap-4">
          {SREVIEWS.map((r, i) => (
            <R key={r.who} delay={i * 70} className="flex-1">
              <ReviewCard r={r} compact={Boolean(video)} />
            </R>
          ))}
        </div>
      </div>
    </section>
  );
}

function ReviewCard({
  r,
  compact = false,
}: {
  r: (typeof SREVIEWS)[number];
  /** Lângă clip, pe jumătate de rând: citatul mai mic, ca să nu crească
      placa peste înălțimea videoului. */
  compact?: boolean;
}) {
  const project = r.project ? getDemo(r.project) : undefined;
  return (
    <figure
      className={`glass-2 edge-light relative flex h-full flex-col overflow-hidden ${
        compact ? "p-6 sm:p-8" : "p-7 sm:p-10"
      }`}
    >
      <svg
        viewBox="0 0 48 36"
        className="absolute right-6 top-6 h-9 w-12 text-a1/15 sm:right-9 sm:top-9 sm:h-12 sm:w-16"
        fill="currentColor"
        aria-hidden
      >
        <path d="M0 36V21.6C0 9.6 6.4 2.4 19.2 0l2 5.2C14 7.2 10.8 11.2 10.4 17.2H20V36H0Zm28 0V21.6C28 9.6 34.4 2.4 47.2 0l.8 5.2c-7.2 2-10.4 6-10.8 12H48V36H28Z" />
      </svg>
      <blockquote className="relative max-w-3xl flex-1">
        <p
          className={`display leading-snug ${
            compact
              ? "pr-10 text-[clamp(1.35rem,2.3vw,1.75rem)] sm:pr-14"
              : "text-[clamp(1.35rem,2.7vw,1.95rem)]"
          }`}
        >
          „<Unbroken text={r.quote} />”
        </p>
      </blockquote>
      <figcaption className="mt-7 flex flex-wrap items-center justify-between gap-x-4 gap-y-4 border-t border-hair pt-6">
        {/* Logo-ul și numele stau împreună: la 360px, dacă se rupe ceva
            pe rândul următor, e legătura, nu numele de lângă logo. */}
        <span className="flex min-w-0 items-center gap-4">
          {r.logo && (
            /* eslint-disable-next-line @next/next/no-img-element -- logo deja
               curățat și adus la 128px (public/video/recenzii/); are text alb,
               deci stă pe plăcuță închisă și pe fundalul deschis al lumii software */
            <img
              src={r.logo}
              alt=""
              width={44}
              height={44}
              loading="lazy"
              decoding="async"
              className="size-12 shrink-0 rounded-panel-sm bg-[#1b1f24] object-contain p-1"
            />
          )}
          <span className="min-w-0">
            <span className="block text-[15px] font-medium text-bone">{r.who}</span>
            <span className="block text-[13.5px] text-dim">{r.where}</span>
          </span>
        </span>
        {project && (
          <Link
            href={`/software/proiecte/${project.slug}`}
            className="ml-auto inline-flex items-center gap-2 whitespace-nowrap text-[14px] font-medium text-a1 transition-colors hover:text-bone"
          >
            Încearcă proiectul lor
            <Icon name="arrowRight" size={15} />
          </Link>
        )}
      </figcaption>
    </figure>
  );
}

/* ---------------- Întrebări ---------------- */
function Questions() {
  return (
    <section id="intrebari" className="relative px-5 py-16 sm:px-6 sm:py-24 lg:py-28">
      <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[minmax(0,320px)_1fr] lg:gap-20">
        <div className="lg:sticky lg:top-24 lg:self-start">
          <Head align="left" eyebrow="Întrebări" title="Răspunsuri directe" />
        </div>
        <R delay={70}>
          <Faq items={SFAQ} />
        </R>
      </div>
    </section>
  );
}

/* ---------------- Configurator ----------------
   Ultima secțiune a paginii: cine a ajuns aici a văzut ce facem, cum și
   ce garantăm — acum e momentul formularului, nu la mijloc. */
function LeadMagnet() {
  return (
    <section id="configurator" className="relative px-5 pb-24 pt-16 sm:px-6 sm:pt-24 lg:pb-32 lg:pt-28">
      <div
        aria-hidden
        className="aurora aurora-drift"
        style={{
          width: "min(80vw, 760px)",
          height: "min(60vw, 520px)",
          left: "50%",
          top: "8%",
          translate: "-50% 0",
          background:
            "radial-gradient(ellipse, color-mix(in oklab, var(--md-a1) 45%, transparent), transparent 64%)",
          opacity: "var(--md-glow-o, 0.4)",
        }}
      />

      <div className="relative z-10 mx-auto max-w-6xl">
        <Head
          eyebrow="Configurator de proiect"
          title={
            <>
              Două minute acum,
              <br />
              <span className="text-a2">o fișă de proiect după.</span>
            </>
          }
        />

        <R delay={90} className="mt-12">
          <Configurator />
        </R>

        <R delay={140}>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {CONSULT_OUTPUT.map((c) => (
              <li
                key={c.title}
                className="glass flex items-center gap-3 p-4 text-[14.5px] font-medium text-bone"
              >
                <Icon name="check" size={16} className="shrink-0 text-a1" />
                {c.title}
              </li>
            ))}
          </ul>
        </R>
      </div>
    </section>
  );
}

/* ---------------- Footer ---------------- */
function Foot() {
  return (
    <footer className="relative overflow-hidden border-t border-hair">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 sm:px-6 md:grid-cols-[1.5fr_1fr_1fr]">
        <div>
          <span className="flex items-center gap-2.5 text-bone">
            <Mark size={24} />
            <span className="flex items-baseline gap-1.5">
              <span className="font-md-display text-[15px] font-bold tracking-tight">
                MERIDIAN
              </span>
              <span className="font-md-mono text-[11px] tracking-widest text-dim">
                SOFTWARE
              </span>
            </span>
          </span>
          <p className="mt-4 max-w-sm text-[14px] leading-relaxed text-dim">
            Software la comandă pentru firme care digitalizează serios: aplicații
            de business, dashboard-uri, fidelizare, mobil, SaaS și site-uri de
            conversie.
          </p>
        </div>

        <div>
          <p className="eyebrow mb-4">Navigare</p>
          <ul className="space-y-2.5">
            {SNAV.map((n) => (
              <li key={n.href}>
                <a
                  href={n.href}
                  className="text-[14px] text-dim transition-colors hover:text-bone"
                >
                  {n.label}
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="eyebrow mb-4">Contact</p>
          <ul className="space-y-2.5">
            <li>
              <a
                href={SCONTACT.phoneHref}
                className="text-[14px] text-dim transition-colors hover:text-bone"
              >
                {SCONTACT.phone}
              </a>
            </li>
            <li>
              <ObfuscatedEmail
                address={SCONTACT.email}
                fallbackHref="#configurator"
                fallbackLabel=" — deschide formularul de contact"
                className="text-[14px] text-dim transition-colors hover:text-bone"
              />
            </li>
            <li>
              <a
                href="#configurator"
                className="text-[14px] text-a2 transition-colors hover:text-bone"
              >
                Programează consultanța gratuită
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-8 gap-y-3 border-t border-hair px-5 py-6 text-[13px] text-dim sm:px-6">
        <span>
          © 2026 MERIDIAN.
          {SCONTACT.isPlaceholder && " Adresa de email de pe această pagină e încă provizorie."}
        </span>
        <nav aria-label="Documente legale">
          <ul className="flex flex-wrap gap-x-5 gap-y-1">
            {LEGAL_LINKS.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className="transition-colors hover:text-bone"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <p
        aria-hidden
        className="display pointer-events-none select-none px-5 text-center text-[17vw] leading-[0.78] text-bone/[0.055] sm:px-6"
        style={{ marginBottom: "-0.16em" }}
      >
        MERIDIAN
      </p>
    </footer>
  );
}
