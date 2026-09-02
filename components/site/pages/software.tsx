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
import { VideoCard } from "@/components/site/video-player";
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
  SPRESENTATION,
  SDELIVERABLES,
  SFAQ,
  SNAV,
  SOLUTIONS,
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

/**
 * Recenziile sunt ascunse pana cand clientul aduce citatele reale de la
 * oamenii cu care a lucrat. Sectiunea ramane intreaga dedesubt: cand vin
 * textele, se schimba `false` in `true` si se inlocuieste STESTIMONIALS.
 */
const SHOW_TESTIMONIALS = false;

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
        <Solutions />
        <LeadMagnet />
        <Process />
        <Guarantees />
        <Handover />
        <Stats />
        {SHOW_TESTIMONIALS && <Voices />}
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
          <R className="hidden sm:block">
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
            <p className="mt-5 max-w-lg text-[16px] leading-relaxed text-dim sm:mt-6 sm:text-[16.5px]">
              <span className="sm:hidden">
                Aplicații construite pe procesul tău, livrate pe etape scurte,
                predate integral pe numele firmei tale.
              </span>
              <span className="hidden sm:inline">
                Aplicații de business, dashboard-uri, fidelizare, mecanisme de
                vânzare, mobil și SaaS — construite pe procesul tău, livrate pe
                etape scurte, predate integral pe numele firmei tale.
              </span>
            </p>
          </R>

          <R delay={190}>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
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

/* ---------------- Titlu de secțiune, varianta software ---------------- */
function Head({
  eyebrow,
  title,
  lead,
  align = "center",
}: {
  eyebrow: string;
  title: React.ReactNode;
  lead?: React.ReactNode;
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

/**
 * Banda de chemare la actiune, pusa la capatul unei sectiuni.
 * Aceeasi destinatie ca butonul din bara — configuratorul — dar
 * intalnita in momentul in care sectiunea tocmai a ridicat intrebarea.
 */
function CtaBand({ title, body }: { title: string; body: string }) {
  return (
    <R delay={120} className="mx-auto mt-10 max-w-6xl">
      <div className="glass-2 edge-light flex flex-col items-start gap-6 p-7 sm:p-8 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-xl">
          <h3 className="display text-[clamp(1.3rem,2.6vw,1.7rem)]">{title}</h3>
          <p className="mt-2.5 text-[15px] leading-relaxed text-dim">{body}</p>
        </div>
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

/* ---------------- Ce construim ---------------- */
function Solutions() {
  return (
    <section id="solutii" className="relative px-5 py-16 sm:px-6 sm:py-24 lg:py-32">
      <Head
        eyebrow="Ce construim"
        title={
          <>
            Construim orice aplicație la comandă.
            <br />
            <span className="text-dim">Astea sunt cele mai cerute opt.</span>
          </>
        }
        lead={
          <>
            <span className="sm:hidden">
              Dacă procesul tău nu seamănă cu niciunul, construim exact ce îți
              trebuie.
            </span>
            <span className="hidden sm:inline">
              Lista de mai jos nu e un meniu din care trebuie să alegi — sunt
              tipurile care ni se cer cel mai des, puse aici ca să ai de unde
              porni. Dacă procesul tău nu seamănă cu niciunul, construim exact
              ce îți trebuie.
            </span>
          </>
        }
      />

      <ul className="mx-auto mt-10 grid max-w-6xl gap-3 sm:mt-16 md:grid-cols-2 lg:grid-cols-4">
        {SOLUTIONS.map((s, i) => (
          <R as="li" key={s.key} delay={i * 45}>
            <article className="glass bleed lift group flex h-full flex-col p-5 sm:p-6">
              <div className="relative z-10 flex flex-1 flex-col">
                <span className="mb-4 flex size-10 items-center justify-center rounded-panel-sm border border-hair text-a1 sm:mb-5">
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
                {/* specificațiile rămân pe desktop; pe telefon vinde promisiunea */}
                <ul className="mt-4 hidden space-y-1.5 border-t border-hair pt-4 sm:mt-5 sm:block">
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

      {/* Ultimul cuvant al sectiunii ii apartine celui care nu s-a
          regasit in cele opt: el e clientul pe care lista tocmai l-ar
          fi trimis mai departe. */}
      <CtaBand
        title="Nu se potrivește niciunul?"
        body="Cele opt de sus sunt doar exemple. Spune-ne cum lucrezi acum și îți construim sistemul pe procesul tău, nu invers."
      />
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
    <section id="proces" className="relative px-5 py-16 sm:px-6 sm:py-24 lg:py-32">
      <div className="mx-auto grid max-w-6xl gap-8 sm:gap-12 lg:grid-cols-[minmax(0,340px)_1fr] lg:gap-16">
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
            lead={
              <>
                <span className="sm:hidden">
                  Etape scurte, fiecare cu ceva ce poți vedea și folosi.
                </span>
                <span className="hidden sm:inline">
                  Nu semnezi pentru un rezultat la final de an. Semnezi pentru
                  etape scurte, fiecare cu ceva ce poți vedea și folosi.
                </span>
              </>
            }
          />
        </div>

        <ol className="relative grid gap-3">
          {SPROCESS.map((p, i) => (
            <R as="li" key={p.n} delay={i * 60}>
              <article className="glass lift p-5 sm:p-7">
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
                {/* proza explicativă rămâne pe desktop; pe telefon contează livrabilele */}
                <p className="mt-3 hidden max-w-2xl text-[14.5px] leading-relaxed text-dim sm:block">
                  {p.body}
                </p>
                <ul className="mt-4 flex flex-wrap gap-2 sm:mt-5">
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

      <CtaBand
        title="Le vrei trecute în contractul tău?"
        body="Le discutăm punct cu punct la consultanță și pleci cu ele scrise, împreună cu fișa de proiect — a ta, chiar dacă alegi alt furnizor."
      />
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
                Programează consultanța gratuită
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
