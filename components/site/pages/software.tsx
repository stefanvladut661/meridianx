"use client";

import { Link } from "@/i18n/navigation";
import { useState, type ComponentProps } from "react";
import { Mark } from "@/components/site/mark";
import { LEGAL_LINKS } from "@/components/site/legal-links";
import {
  CountUp,
  Marquee,
  Reveal,
  ScrollProgress,
  useScrolled,
} from "@/components/site/motion";
import { Faq, Icon } from "@/components/site/ui";
import { Configurator } from "@/components/site/configurator";
import {
  WorldSwitch,
  WorldSwitchMobileLink,
} from "@/components/site/world-switch";
import {
  AUDIENCE,
  CONSULT_OUTPUT,
  GUARANTEES,
  INTEGRATIONS,
  SCONTACT,
  SDELIVERABLES,
  SFAQ,
  SNAV,
  SOLUTIONS,
  SPAINS,
  SPROCESS,
  SSTATS,
  STESTIMONIALS,
} from "@/components/site/software-content";

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
      <ScrollProgress />
      <Nav />
      <main id="continut">
        <Hero />
        <AudienceStrip />
        <Problems />
        <Solutions />
        <LeadMagnet />
        <Process />
        <Guarantees />
        <Handover />
        <Stats />
        <Voices />
        <Questions />
        <FinalCta />
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
        <Link href="/" className="flex items-center gap-2.5 text-bone">
          <Mark size={24} />
          <span className="flex items-baseline gap-1.5">
            <span className="font-md-display text-[15px] font-bold tracking-tight">
              MERIDIAN
            </span>
            <span className="font-md-mono text-[11px] tracking-widest text-dim">
              SOFTWARE
            </span>
          </span>
        </Link>

        <ul className="mx-auto hidden items-center gap-7 lg:flex">
          {SNAV.map((n) => (
            <li key={n.href}>
              <a
                href={n.href}
                className="text-[14px] text-dim transition-colors duration-200 hover:text-bone"
              >
                {n.label}
              </a>
            </li>
          ))}
        </ul>

        <a
          href={SCONTACT.phoneHref}
          className="ml-auto hidden items-center gap-2 text-[13.5px] text-dim transition-colors hover:text-bone lg:ml-0 md:flex"
        >
          <Icon name="phone" size={15} />
          {SCONTACT.phone}
        </a>
        <a
          href="#configurator"
          className="btn btn-primary ml-auto !min-h-10 !rounded-panel-sm !px-4 !py-2 !text-[13px] md:ml-4"
        >
          Programează consultanța
        </a>

        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls="meniu-soft"
          className="flex size-10 shrink-0 items-center justify-center rounded-panel-sm border border-hair text-bone lg:hidden"
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

      <div
        id="meniu-soft"
        hidden={!open}
        className="border-t border-hair bg-ink/95 px-5 py-2 backdrop-blur-xl sm:px-6 lg:hidden"
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
    </header>
  );
}

/* ---------------- Hero ---------------- */
function Hero() {
  return (
    <section className="relative overflow-hidden pb-20 pt-28 sm:pt-36 lg:pb-28 lg:pt-44">
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
            <span className="pill">
              <span className="node-dot" aria-hidden />
              <span className="text-dim">
                Pentru firme cu{" "}
                <span className="text-bone">finanțare de digitalizare</span>
              </span>
            </span>
          </R>

          <R delay={70}>
            <h1 className="display mt-7 text-[clamp(2.2rem,5.8vw,4rem)]">
              Ai banii aprobați și un termen.
              <br />
              <span className="text-a2">
                Noi îi transformăm în infrastructură
              </span>{" "}
              pe care echipa chiar o folosește.
            </h1>
          </R>

          <R delay={130}>
            <p className="mt-6 max-w-lg text-[16.5px] leading-relaxed text-dim">
              Aplicații de business, dashboard-uri, fidelizare, mecanisme de
              vânzare, mobil și SaaS — construite pe procesul tău, livrate pe
              etape scurte, predate integral pe numele firmei tale.
            </p>
          </R>

          <R delay={190}>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
              <a
                href="#configurator"
                className="btn btn-primary !rounded-panel-sm"
              >
                <Icon name="calendar" size={17} />
                Programează consultanța
              </a>
              <a href="#solutii" className="btn btn-ghost !rounded-panel-sm">
                Vezi ce construim
                <Icon name="arrowRight" size={16} className="arw" />
              </a>
            </div>
          </R>

          <R delay={250}>
            <ul className="mt-9 flex flex-wrap gap-x-6 gap-y-2.5">
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
          <AppSurface />

          <div className="glass-2 edge-light float absolute -left-3 bottom-10 w-[196px] p-3.5 sm:-left-7">
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

          <div className="glass-2 edge-light float-2 absolute -right-2 top-10 w-[172px] p-3.5 sm:-right-6">
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
        </R>
      </div>
    </section>
  );
}

/** Mock de interfață — echivalentul software al plăcii media de la video.
 *  Nu e un screenshot furat: e desenat din tokens, deci își schimbă
 *  culoarea odată cu paleta. Marcat vizibil ca exemplu. */
function AppSurface() {
  const rows = [
    { t: "Comandă #2481 · Producție", s: "în lucru", on: true },
    { t: "Comandă #2480 · Livrare", s: "expediat", on: false },
    { t: "Comandă #2478 · Facturare", s: "încasat", on: false },
  ];
  const bars = [38, 52, 44, 67, 58, 78, 71];

  return (
    <div className="glass-2 edge-light relative overflow-hidden rounded-panel-lg p-2.5 shadow-[0_36px_100px_-40px_rgba(0,0,0,0.75)]">
      <div className="rounded-panel border border-hair bg-char">
        {/* bara de titlu */}
        <div className="flex items-center gap-3 border-b border-hair px-4 py-3">
          <span className="flex gap-1.5" aria-hidden>
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="size-2 rounded-full border border-hair-strong"
              />
            ))}
          </span>
          <span className="font-md-mono text-[11px] tracking-wider text-dim">
            operatiuni.firma.ro
          </span>
          <span className="ml-auto rounded-full border border-hair px-2 py-0.5 font-md-mono text-[9.5px] uppercase tracking-widest text-dim">
            exemplu
          </span>
        </div>

        <div className="grid grid-cols-[44px_1fr] sm:grid-cols-[56px_1fr]">
          {/* sidebar */}
          <div
            className="flex flex-col items-center gap-2.5 border-r border-hair py-4"
            aria-hidden
          >
            {["layers", "chart", "users", "link"].map((n, i) => (
              <span
                key={n}
                className={`flex size-8 items-center justify-center rounded-panel-sm ${
                  i === 0 ? "bg-a1 text-on-a1" : "text-dim"
                }`}
              >
                <Icon
                  name={n as "layers" | "chart" | "users" | "link"}
                  size={16}
                />
              </span>
            ))}
          </div>

          {/* conținut */}
          <div className="p-4 sm:p-5">
            <div className="grid grid-cols-3 gap-2" aria-hidden>
              {[
                { k: "În lucru", v: "18" },
                { k: "Întârziate", v: "2" },
                { k: "Azi", v: "41" },
              ].map((t) => (
                <div
                  key={t.k}
                  className="rounded-panel-sm border border-hair px-3 py-2.5"
                >
                  <p className="text-[10.5px] text-dim">{t.k}</p>
                  <p className="display mt-0.5 text-[1.15rem] text-bone">
                    {t.v}
                  </p>
                </div>
              ))}
            </div>

            <div
              className="mt-4 flex h-20 items-end gap-1.5 rounded-panel-sm border border-hair px-3 pb-3 pt-2"
              aria-hidden
            >
              {bars.map((h, i) => (
                <span
                  key={i}
                  className={`flex-1 rounded-t-[3px] ${
                    i > 4 ? "bg-a1" : "bg-hair-strong"
                  }`}
                  style={{ height: `${h}%` }}
                />
              ))}
            </div>

            <ul className="mt-4 grid gap-1.5" aria-hidden>
              {rows.map((r) => (
                <li
                  key={r.t}
                  className="flex items-center gap-3 rounded-panel-sm border border-hair px-3 py-2.5"
                >
                  <span className="min-w-0 flex-1 truncate text-[12px] text-bone">
                    {r.t}
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10.5px] ${
                      r.on
                        ? "bg-a1 text-on-a1"
                        : "border border-hair text-dim"
                    }`}
                  >
                    {r.s}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Cine sunt clienții ---------------- */
function AudienceStrip() {
  return (
    <section className="relative border-y border-hair bg-char/50 py-6">
      <p className="sr-only">Domenii în care lucrăm</p>
      <Marquee duration={46}>
        {AUDIENCE.map((a) => (
          <span
            key={a.label}
            className="flex items-center gap-3 whitespace-nowrap px-7"
          >
            <span className="node-dot" aria-hidden />
            <span className="text-[15px] font-medium text-bone">{a.label}</span>
            <span className="text-[13.5px] text-dim">{a.short}</span>
          </span>
        ))}
      </Marquee>
    </section>
  );
}

/* ---------------- Titlu de secțiune, varianta software ---------------- */
function Head({
  eyebrow,
  title,
  lead,
  align = "center",
}: {
  eyebrow: string;
  title: React.ReactNode;
  lead?: string;
  align?: "center" | "left";
}) {
  const c = align === "center";
  return (
    <R className={`${c ? "mx-auto text-center" : ""} max-w-2xl`}>
      <p
        className={`eyebrow mb-4 flex items-center gap-2 ${
          c ? "justify-center" : ""
        }`}
      >
        <span className="node-dot" aria-hidden />
        {eyebrow}
      </p>
      <h2 className="display text-[clamp(1.9rem,4.6vw,3rem)]">{title}</h2>
      {lead && (
        <p className="mt-5 text-[16.5px] leading-relaxed text-dim">{lead}</p>
      )}
    </R>
  );
}

/* ---------------- Probleme ---------------- */
function Problems() {
  return (
    <section id="probleme" className="relative px-5 py-24 sm:px-6 lg:py-32">
      <Head
        eyebrow="Diagnostic"
        title={
          <>
            Banii de digitalizare se pierd
            <br />
            <span className="text-dim">în trei feluri previzibile.</span>
          </>
        }
        lead="Software care nu se potrivește procesului, ecrane pe care nu le deschide nimeni și dependența de un furnizor. Toate se pot evita din faza de scop."
      />

      <ul className="mx-auto mt-16 grid max-w-6xl gap-3">
        {SPAINS.map((p, i) => (
          <R as="li" key={p.symptom} delay={i * 50}>
            <article className="glass lift grid gap-5 p-6 sm:p-7 lg:grid-cols-[150px_1fr_1fr] lg:items-start lg:gap-9">
              <p className="eyebrow lg:pt-1">{p.tag}</p>
              <div>
                <h3 className="text-[17.5px] font-medium leading-snug text-bone">
                  {p.symptom}
                </h3>
                <p className="mt-3 text-[14.5px] leading-relaxed text-dim">
                  {p.cause}
                </p>
              </div>
              <p className="flex gap-3 border-t border-hair pt-4 text-[14.5px] leading-relaxed text-a2 lg:border-l lg:border-t-0 lg:pl-9 lg:pt-1">
                <Icon name="arrow" size={16} className="mt-0.5 shrink-0" />
                {p.fix}
              </p>
            </article>
          </R>
        ))}
      </ul>
    </section>
  );
}

/* ---------------- Ce construim ---------------- */
function Solutions() {
  return (
    <section id="solutii" className="relative px-5 py-24 sm:px-6 lg:py-32">
      <Head
        eyebrow="Ce construim"
        title="Opt tipuri de proiect, o singură echipă"
        lead="Poți începe cu unul. De obicei, al doilea vine din primul — pentru că datele există deja și se pot folosi."
      />

      <ul className="mx-auto mt-16 grid max-w-6xl gap-3 md:grid-cols-2 lg:grid-cols-4">
        {SOLUTIONS.map((s, i) => (
          <R as="li" key={s.key} delay={i * 45}>
            <article className="glass bleed lift group flex h-full flex-col p-6">
              <div className="relative z-10 flex flex-1 flex-col">
                <span className="mb-5 flex size-10 items-center justify-center rounded-panel-sm border border-hair text-a1">
                  <Icon
                    name={
                      s.icon as
                        | "layers"
                        | "spark"
                        | "chart"
                        | "target"
                        | "cloud"
                        | "phone"
                        | "search"
                        | "link"
                    }
                    size={18}
                  />
                </span>
                <h3 className="text-[16.5px] font-medium leading-snug text-bone">
                  {s.title}
                </h3>
                <p className="mt-2.5 flex-1 text-[14px] leading-relaxed text-dim">
                  {s.blurb}
                </p>
                <ul className="mt-5 space-y-1.5 border-t border-hair pt-4">
                  {s.bullets.map((b) => (
                    <li
                      key={b}
                      className="flex items-center gap-2 text-[12.5px] text-dim"
                    >
                      <span
                        className="size-1 rotate-45 bg-a1"
                        aria-hidden
                      />
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          </R>
        ))}
      </ul>
    </section>
  );
}

/* ---------------- Lead magnet ---------------- */
function LeadMagnet() {
  return (
    <section id="configurator" className="relative px-5 py-24 sm:px-6 lg:py-32">
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
          lead="Răspunde la patru întrebări și vezi pe loc conturul proiectului: module, etape, interval de timp. La final îl primești în scris și îl poți folosi ca să compari orice altă ofertă."
        />

        <R delay={90} className="mt-14">
          <Configurator />
        </R>

        <R delay={140}>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {CONSULT_OUTPUT.map((c) => (
              <li key={c.title} className="glass p-5">
                <h3 className="text-[14.5px] font-medium text-bone">
                  {c.title}
                </h3>
                <p className="mt-2 text-[13px] leading-relaxed text-dim">
                  {c.body}
                </p>
              </li>
            ))}
          </ul>
        </R>
      </div>
    </section>
  );
}

/* ---------------- Proces ---------------- */
function Process() {
  return (
    <section id="proces" className="relative px-5 py-24 sm:px-6 lg:py-32">
      <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[minmax(0,340px)_1fr] lg:gap-16">
        <div className="lg:sticky lg:top-24 lg:self-start">
          <Head
            align="left"
            eyebrow="Cum lucrăm"
            title={
              <>
                Cinci etape.
                <br />
                Fiecare cu livrabil.
              </>
            }
            lead="Nu semnezi pentru un rezultat la final de an. Semnezi pentru etape scurte, fiecare cu ceva ce poți vedea și folosi."
          />
        </div>

        <ol className="relative grid gap-3">
          {SPROCESS.map((p, i) => (
            <R as="li" key={p.n} delay={i * 60}>
              <article className="glass lift p-6 sm:p-7">
                <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                  <span className="font-md-mono text-[13px] text-a1">
                    {p.n}
                  </span>
                  <h3 className="display text-[1.35rem]">{p.title}</h3>
                  <span className="rounded-full border border-hair px-2.5 py-0.5 font-md-mono text-[11px] text-dim">
                    {p.dur}
                  </span>
                </div>
                <p className="mt-3 text-[14.5px] text-a2">{p.lead}</p>
                <p className="mt-3 max-w-2xl text-[14.5px] leading-relaxed text-dim">
                  {p.body}
                </p>
                <ul className="mt-5 flex flex-wrap gap-2">
                  {p.out.map((o) => (
                    <li
                      key={o}
                      className="flex items-center gap-2 rounded-panel-sm border border-hair px-3 py-1.5 text-[12.5px] text-dim"
                    >
                      <Icon name="check" size={13} className="text-a1" />
                      {o}
                    </li>
                  ))}
                </ul>
              </article>
            </R>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ---------------- Garanții ---------------- */
function Guarantees() {
  return (
    <section id="garantii" className="relative px-5 py-24 sm:px-6 lg:py-32">
      <Head
        eyebrow="Garanții"
        title="Ce ne obligăm să facem"
        lead="Nu sunt sloganuri. Sunt lucrurile pe care le trecem în contract și pe care ni le poți reproșa dacă nu le respectăm."
      />

      <ul className="mx-auto mt-16 grid max-w-6xl gap-3 md:grid-cols-2 lg:grid-cols-3">
        {GUARANTEES.map((g, i) => (
          <R as="li" key={g.title} delay={i * 50}>
            <article className="glass lift h-full p-6 sm:p-7">
              <span className="mb-5 flex size-10 items-center justify-center rounded-panel-sm border border-hair text-a1">
                <Icon
                  name={
                    g.icon as
                      | "clock"
                      | "check"
                      | "spark"
                      | "chart"
                      | "shield"
                      | "target"
                  }
                  size={18}
                />
              </span>
              <h3 className="text-[16.5px] font-medium leading-snug text-bone">
                {g.title}
              </h3>
              <p className="mt-3 text-[14.5px] leading-relaxed text-dim">
                {g.body}
              </p>
            </article>
          </R>
        ))}
      </ul>
    </section>
  );
}

/* ---------------- Livrabile + integrări ---------------- */
function Handover() {
  return (
    <section className="relative px-5 py-24 sm:px-6 lg:py-32">
      <div className="mx-auto grid max-w-6xl gap-3 lg:grid-cols-[1fr_minmax(0,420px)]">
        <R>
          <article className="glass-2 edge-light bleed relative h-full overflow-hidden p-7 sm:p-9">
            <div className="relative z-10">
              <p className="eyebrow mb-5">La predare</p>
              <h3 className="display text-[clamp(1.5rem,3.4vw,2.1rem)]">
                Pleci cu tot. Inclusiv cu noi din drum.
              </h3>
              <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-dim">
                Dependența de furnizor e cea mai scumpă linie invizibilă dintr-un
                proiect software. O eliminăm din start, ca decizia de a lucra mai
                departe cu noi să fie una de business, nu de acces.
              </p>
              <ul className="mt-7 grid gap-3 sm:grid-cols-2">
                {SDELIVERABLES.map((d) => (
                  <li key={d} className="flex gap-3 text-[14.5px] text-dim">
                    <Icon
                      name="check"
                      size={16}
                      className="mt-0.5 shrink-0 text-a1"
                    />
                    {d}
                  </li>
                ))}
              </ul>
            </div>
          </article>
        </R>

        <R delay={90}>
          <article className="glass h-full p-7">
            <p className="eyebrow mb-5">Integrări frecvente</p>
            <ul className="flex flex-wrap gap-2">
              {INTEGRATIONS.map((n) => (
                <li
                  key={n}
                  className="rounded-panel-sm border border-hair px-3 py-1.5 text-[13px] text-dim"
                >
                  {n}
                </li>
              ))}
            </ul>
            <div className="rule my-7" />
            <p className="text-[14.5px] leading-relaxed text-dim">
              Dacă sistemul tău nu e în listă, întreabă. În aproape toate
              cazurile există o cale de integrare — iar dacă nu există, îți
              spunem asta la consultanță, nu după semnare.
            </p>
            <a
              href="#configurator"
              className="btn btn-ghost mt-7 !rounded-panel-sm !min-h-11 !py-2.5 !text-[14px]"
            >
              Verifică-ți sistemele
              <Icon name="arrowRight" size={15} className="arw" />
            </a>
          </article>
        </R>
      </div>
    </section>
  );
}

/* ---------------- Cifre ---------------- */
function Stats() {
  return (
    <section className="relative px-5 py-16 sm:px-6 lg:py-24">
      <div className="mx-auto max-w-6xl">
        <dl className="grid gap-px overflow-hidden rounded-panel-lg border border-hair bg-hair sm:grid-cols-2 lg:grid-cols-4">
          {SSTATS.map((s, i) => (
            <R key={s.label} delay={i * 60}>
              <div className="h-full bg-ink p-7">
                <dd className="display text-[clamp(2.2rem,5vw,3rem)] leading-none text-a1">
                  <CountUp to={s.value} suffix={s.suffix} />
                </dd>
                <dt className="mt-3.5 text-[14.5px] text-bone">{s.label}</dt>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-dim">
                  {s.note}
                </p>
              </div>
            </R>
          ))}
        </dl>
        <p className="mt-3 text-[12px] text-dim">
          Cifre de capabilitate, marcate ca exemplu — se confirmă înainte de
          publicare.
        </p>
      </div>
    </section>
  );
}

/* ---------------- Testimoniale ---------------- */
function Voices() {
  return (
    <section className="relative px-5 py-24 sm:px-6 lg:py-32">
      <Head
        eyebrow="Clienți"
        title="Locul rezervat pentru primele recenzii"
        lead="Nu punem citate scrise de noi. Pe măsură ce primele proiecte se predau, aici apar cuvintele oamenilor cu care am lucrat — cu acordul lor scris."
      />
      <ul className="mx-auto mt-14 grid max-w-6xl gap-3 md:grid-cols-3">
        {STESTIMONIALS.map((t, i) => (
          <R as="li" key={i} delay={i * 70}>
            <article className="glass h-full p-6 sm:p-7">
              <p className="text-[14.5px] leading-relaxed text-dim">
                {t.quote}
              </p>
              <div className="mt-6 flex items-center gap-3 border-t border-hair pt-5">
                <span
                  className="size-9 rounded-full border border-hair bg-glass"
                  aria-hidden
                />
                <span>
                  <span className="block text-[13.5px] text-bone">{t.who}</span>
                  <span className="block text-[12.5px] text-dim">
                    {t.where}
                  </span>
                </span>
                <span className="ml-auto rounded-full border border-hair px-2 py-0.5 font-md-mono text-[9.5px] uppercase tracking-widest text-dim">
                  exemplu
                </span>
              </div>
            </article>
          </R>
        ))}
      </ul>
    </section>
  );
}

/* ---------------- Întrebări ---------------- */
function Questions() {
  return (
    <section id="intrebari" className="relative px-5 py-24 sm:px-6 lg:py-32">
      <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[minmax(0,320px)_1fr] lg:gap-20">
        <div className="lg:sticky lg:top-24 lg:self-start">
          <Head
            align="left"
            eyebrow="Întrebări"
            title="Răspunsuri directe"
            lead="Inclusiv la cele la care furnizorii răspund de obicei evaziv."
          />
        </div>
        <R delay={70}>
          <Faq items={SFAQ} />
        </R>
      </div>
    </section>
  );
}

/* ---------------- CTA final ---------------- */
function FinalCta() {
  return (
    <section className="relative px-5 pb-24 pt-8 sm:px-6">
      <R variant="scale" className="mx-auto max-w-6xl">
        <div className="glass-2 edge-light relative overflow-hidden px-6 py-16 text-center sm:px-12 sm:py-20">
          <div
            aria-hidden
            className="aurora aurora-drift"
            style={{
              width: "min(85vw, 720px)",
              height: "min(60vw, 460px)",
              left: "50%",
              bottom: "-56%",
              translate: "-50% 0",
              background:
                "radial-gradient(circle, color-mix(in oklab, var(--md-a1) 75%, transparent), transparent 62%)",
              opacity: "var(--md-glow-o, 0.4)",
            }}
          />
          <div className="blueprint absolute inset-0 opacity-70" aria-hidden />

          <div className="relative z-10">
            <h2 className="display mx-auto max-w-3xl text-[clamp(1.9rem,5vw,3.2rem)]">
              Treizeci de minute, și pleci cu proiectul scris.
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-[16.5px] leading-relaxed text-dim">
              Fără prezentare de agenție. Ne uităm la procesul care te doare, îl
              desenăm împreună și îți trimitem fișa de proiect — a ta, chiar dacă
              alegi alt furnizor.
            </p>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <a
                href="#configurator"
                className="btn btn-primary !rounded-panel-sm !px-7"
              >
                <Icon name="calendar" size={17} />
                Programează consultanța
              </a>
              <a
                href={SCONTACT.phoneHref}
                className="btn btn-ghost !rounded-panel-sm"
              >
                <Icon name="phone" size={16} />
                {SCONTACT.phone}
              </a>
            </div>
          </div>
        </div>
      </R>
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
              <a
                href={`mailto:${SCONTACT.email}`}
                className="text-[14px] text-dim transition-colors hover:text-bone"
              >
                {SCONTACT.email}
              </a>
            </li>
            <li>
              <a
                href="#configurator"
                className="text-[14px] text-a2 transition-colors hover:text-bone"
              >
                Programează consultanța
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-8 gap-y-3 border-t border-hair px-5 py-6 text-[13px] text-dim sm:px-6">
        <span>
          © 2026 MERIDIAN.
          {SCONTACT.isPlaceholder && " Datele de contact de pe această pagină sunt placeholder."}
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
