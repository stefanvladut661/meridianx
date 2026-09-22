"use client";

import { Link } from "@/i18n/navigation";
import { useId, useState, type ReactNode } from "react";
import { Mark } from "@/components/site/mark";
import { ClientMark } from "@/components/site/client-marks";
import { LEGAL_LINKS } from "@/components/site/legal-links";
import { VideoLeadForm } from "@/components/site/video-form";
import {
  WorldSwitch,
  WorldSwitchMobileLink,
} from "@/components/site/world-switch";
import {
  Marquee,
  PointerGlow,
  Reveal,
  RotatingWord,
  useReducedMotion,
  useScrolled,
} from "@/components/site/motion";
import {
  AvatarStack,
  Faq,
  Icon,
  SectionHead,
} from "@/components/site/ui";
import { VideoCard, type PortfolioVideo } from "@/components/site/video-player";
import { GlyphFrame, PROBLEM_GLYPHS } from "@/components/site/problem-glyphs";
import { GlyphBox, SERVICE_GLYPHS } from "@/components/site/service-glyphs";
import v from "./video.module.css";
import { FEATURED } from "@/components/site/portfolio-content";
import {
  CONTACT,
  PRESENTATION,
  FAQ,
  NAV,
  PAINS,
  SERVICES,
  STEPS,
  SYSTEM,
  TESTIMONIALS,
  VERTICALS,
} from "@/components/site/video-content";

/* ============================================================
   V4 · HIBRID (AURORA × SIGNAL)
   Capul de la AURORA: bară plutitoare, hero asimetric pe două
   coloane cu placa media și cardurile de date, bandă de industrii,
   grila de probleme.
   Corpul de la SIGNAL: procesul în patru pași, servicii, echipa,
   trei testimoniale, întrebări, CTA. Bento-ul „Lanțul complet” a
   ieșit (2026-09): spunea același lucru ca procesul, cu grafică în plus.
   Paleta e cea din SIGNAL cu accentul mutat pe albastru royal,
   Satoshi, aceleași tokens.
   ============================================================ */

export function VideoScreen() {
  return (
    <div data-scope="video" className="md-root min-h-dvh overflow-clip">
      <Nav />
      <main id="continut">
        {/* --- capul, de la AURORA --- */}
        <Hero />
        <TrustStrip />
        <Work />
        <Problems />
        {/* --- corpul, de la SIGNAL --- */}
        <Process />
        <Services />
        <Social />
        <Questions />
        <FinalCta />
      </main>
      <Foot />
      {/* Dreapta sus: acolo stă software în poartă. */}
      <WorldSwitch to="software" />
    </div>
  );
}

/* ---------------- Navigație ---------------- */

/* Meniul amestecă ancore (secțiuni de pe pagină) cu o rută (portofoliul).
   Ancorele merg cu <a>; ruta trebuie să treacă prin <Link>-ul de i18n,
   altfel pierde prefixul de limbă. Ambele primesc aceleași clase. */
function NavLink({
  href,
  className,
  onClick,
  children,
}: {
  href: string;
  className: string;
  onClick?: () => void;
  children: ReactNode;
}) {
  if (href.startsWith("#")) {
    return (
      <a href={href} className={className} onClick={onClick}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={className} onClick={onClick}>
      {children}
    </Link>
  );
}

function Nav() {
  const [open, setOpen] = useState(false);
  const scrolled = useScrolled(20);

  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-50 px-4 pt-4 sm:px-6">
      <nav
        className={`ws-inset-right pointer-events-auto mx-auto flex max-w-6xl items-center gap-2 rounded-full border px-2.5 py-2 transition-all duration-500 sm:gap-3 sm:px-4 ${
          scrolled
            ? "border-hair bg-black/55 backdrop-blur-xl"
            : "border-transparent bg-transparent"
        }`}
        aria-label="Principal"
      >
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 pl-0.5 text-bone sm:gap-2.5 sm:pl-1"
        >
          <span className="block origin-left scale-[0.82] sm:scale-100">
            <Mark size={26} />
          </span>
          <span className="font-md-display text-[13px] font-semibold tracking-[0.1em] sm:text-[15px] sm:tracking-[0.18em]">
            MERIDIAN
          </span>
        </Link>

        <ul className="mx-auto hidden items-center gap-1 lg:flex">
          {NAV.map((n) => (
            <li key={n.href}>
              <NavLink
                href={n.href}
                className="rounded-full px-3.5 py-2 text-sm text-dim transition-colors hover:bg-white/5 hover:text-bone"
              >
                {n.label}
              </NavLink>
            </li>
          ))}
        </ul>

        <a
          href={CONTACT.phoneHref}
          /* `!hidden`: .btn din globals.css setează display:inline-flex și, fiind
             nelayered, bate utilitarul `hidden`. Fără `!`, butonul rămânea
             vizibil pe telefon și scotea bara din ecran. */
          className="btn btn-ghost ml-auto !hidden shrink-0 whitespace-nowrap !min-h-10 !px-3.5 !py-2 !text-[13px] lg:ml-0 lg:!px-4 md:!inline-flex"
        >
          <Icon name="phone" size={15} />
          Sună acum
        </a>
        <a
          href="#contact"
          className="btn btn-primary ml-auto shrink-0 whitespace-nowrap !min-h-10 !px-3.5 !py-2 !text-[12.5px] sm:ml-0 sm:!px-4 sm:!text-[13px]"
        >
          Cere ofertă
        </a>

        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls="meniu-v4"
          className="flex size-10 shrink-0 touch-manipulation items-center justify-center rounded-full border border-hair bg-white/[0.04] text-bone lg:hidden"
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
          id="meniu-v4"
          className="pointer-events-auto mx-auto mt-2 max-w-6xl overflow-hidden rounded-panel border border-hair bg-ink p-2 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.95)] lg:hidden"
        >
          <ul>
            {NAV.map((n) => (
              <li key={n.href}>
                <NavLink
                  href={n.href}
                  onClick={() => setOpen(false)}
                  className="block rounded-panel-sm px-4 py-3 text-[15px] text-bone hover:bg-white/5"
                >
                  {n.label}
                </NavLink>
              </li>
            ))}
            <li>
              <a
                href={CONTACT.phoneHref}
                className="flex items-center gap-2 rounded-panel-sm px-4 py-3 text-[15px] text-a3 hover:bg-white/5"
              >
                <Icon name="phone" size={16} />
                {CONTACT.phone}
              </a>
            </li>
            <li className="border-t border-hair px-4">
              <WorldSwitchMobileLink to="software" />
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
    <PointerGlow className="relative overflow-hidden pb-20 pt-32 sm:pt-40 lg:pb-32 lg:pt-48">
      {/* lumină ambientală */}
      <div
        aria-hidden
        className="aurora aurora-drift"
        style={{
          width: "clamp(340px, 46vw, 760px)",
          height: "clamp(340px, 46vw, 760px)",
          right: "-8%",
          top: "-6%",
          background:
            "radial-gradient(circle, color-mix(in oklab, var(--md-a1) 62%, transparent), transparent 62%)",
          opacity: 0.5,
        }}
      />
      <div
        aria-hidden
        className="aurora aurora-drift-2"
        style={{
          width: "clamp(300px, 40vw, 640px)",
          height: "clamp(300px, 40vw, 640px)",
          right: "18%",
          top: "18%",
          background:
            "radial-gradient(circle, color-mix(in oklab, var(--md-a2) 55%, transparent), transparent 60%)",
          opacity: 0.42,
        }}
      />
      <div
        aria-hidden
        className="techgrid pointer-events-none absolute inset-0 opacity-60"
      />

      <div className="relative z-10 mx-auto grid max-w-6xl items-center gap-14 px-5 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:gap-10">
        <div>
          <Reveal className="hidden sm:block">
            <span className="pill">
              <AvatarStack />
              <span className="text-dim">
                Echipă in-house
                <span className="mx-1.5 text-white/25">·</span>
                producție <span className="text-bone">+</span> campanii
              </span>
            </span>
          </Reveal>

          {/* Titlul intră rând cu rând, iar ultimul cuvânt se rotește:
              „vinde” e promisiunea, celelalte două spun același lucru
              din alt unghi. Sub reduced-motion rămâne „vinde”. */}
          <h1 className="display mt-7 text-[clamp(2.3rem,6vw,4.2rem)]">
            <Reveal as="div" delay={90}>
              Social Media Marketing
            </Reveal>
            <Reveal as="div" delay={170}>
              <span className="text-dim">&amp; Conținut Video</span>
            </Reveal>
            <Reveal as="div" delay={250}>
              care{" "}
              <RotatingWord
                words={["vinde", "convinge", "aduce clienți"]}
                interval={2600}
                className="text-a1"
              />
            </Reveal>
          </h1>

          <Reveal delay={340}>
            <p className="mt-6 max-w-lg text-[16px] leading-relaxed text-dim sm:text-[17px]">
              Gândim strategia, filmăm și edităm materiale video de impact
              care îți transformă afacerea într-un brand pe care publicul îl
              recunoaște și îl cumpără.
            </p>
          </Reveal>

          <Reveal delay={420}>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
              <a href="#contact" className="btn btn-primary">
                Cere ofertă
                <Icon name="arrowRight" size={17} className="arw" />
              </a>
              <Link href="/video/portofoliu" className="btn btn-ghost">
                <Icon name="play" size={14} />
                Vezi portofoliul
              </Link>
            </div>
          </Reveal>
        </div>

        {/* placa media + carduri flotante */}
        <Reveal delay={140} variant="scale" className="relative">
          <VideoCard
            item={PRESENTATION}
            eager
            className="shadow-[0_40px_120px_-40px_rgba(0,0,0,0.9)]"
          />

          {/* Cardurile stau sub placă, nu peste film. Decalajul mic pe
              verticală e intenționat — plutesc, nu sunt aliniate la rigla. */}
          <div className="mt-4 hidden items-start gap-4 sm:flex">
            <div className="glass-2 edge-light float w-[212px] flex-1 -rotate-[0.6deg] p-3.5">
              <p className="eyebrow mb-2 !text-[10px]">Campanie live</p>
              <div className="flex items-end gap-1.5" aria-hidden>
                {[28, 44, 36, 58, 47, 70, 62].map((h, i) => (
                  <span
                    key={i}
                    className="flex-1 rounded-sm"
                    style={{
                      height: h,
                      background:
                        i > 4
                          ? "linear-gradient(180deg,var(--md-a1),color-mix(in oklab,var(--md-a1) 20%,transparent))"
                          : "rgb(255 255 255 / 0.14)",
                    }}
                  />
                ))}
              </div>
              <p className="mt-2.5 text-[11px] text-dim">
                Cereri de ofertă, ultimele 7 zile
                <span className="ml-1 text-white/30">(exemplu)</span>
              </p>
            </div>

            <div className="glass-2 edge-light float-2 mt-5 w-[176px] flex-1 rotate-[0.8deg] p-3.5">
              <div className="flex items-center gap-2">
                <span className="rec-dot" aria-hidden />
                <span className="font-md-mono text-[11px] tracking-wider text-bone">
                  ȘEDINȚA 01 / FILMARE
                </span>
              </div>
              <p className="mt-2 text-[14.5px] leading-snug text-dim">
                Din fiecare ședință ies{" "}
                <span className="text-bone">mai multe unghiuri</span>, tăiate
                pentru trei platforme.
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    </PointerGlow>
  );
}

/* ---------------- Bandă de încredere ---------------- */
function TrustStrip() {
  return (
    <section className="relative border-y border-hair bg-char/40 py-4 sm:py-6">
      <p className="sr-only">Industrii în care lucrăm</p>
      <Marquee duration={44}>
        {VERTICALS.map((v) => (
          <span
            key={v.key}
            className="flex items-center gap-2 whitespace-nowrap px-4 sm:gap-3 sm:px-8"
          >
            <span className="display text-[15px] text-bone/80 sm:text-[clamp(1.1rem,2.4vw,1.6rem)]">
              {v.label}
            </span>
            <span className="size-1 rounded-full bg-a1" aria-hidden />
            <span className="hidden text-sm text-dim sm:inline">{v.short}</span>
          </span>
        ))}
      </Marquee>
    </section>
  );
}

/* ---------------- Materiale ---------------- */
/**
 * Banda de materiale. Verticale, fiindcă așa au fost filmate — un 9:16
 * întins pe lățimea paginii ar fi două benzi negre și un video mic.
 *
 * Banda derulează pe orizontală și se prinde în `snap`, același gest și
 * pe telefon și pe desktop: pe telefon e gestul cu care oamenii se uită
 * deja la reels, iar pe desktop nu adaugă înălțime paginii, deci nu
 * împinge restul conținutului mai jos. Ultimul card duce la portofoliu,
 * ca banda să nu se termine în gol.
 */
function Work() {
  return (
    <section id="materiale" className="relative px-5 py-24 sm:px-6 lg:py-32">
      <SectionHead
        eyebrow="Materiale"
        title="Filmate de noi, pentru clienți reali."
        lead="Apasă pe oricare. Pornesc cu sunet și se reiau de la capăt."
      />

      <Reveal delay={90} className="mx-auto mt-14 max-w-6xl">
        <ul
          className="fade-x flex snap-x snap-mandatory gap-3 overflow-x-auto pb-3"
          style={{ scrollbarWidth: "none" }}
        >
          {FEATURED.map((v, i) => (
            <li
              key={v.slug}
              className="w-[58vw] max-w-[264px] shrink-0 snap-start sm:w-[34vw] lg:w-[238px]"
            >
              <VideoCard item={v} eager={i === 0} />
            </li>
          ))}

          <li className="w-[58vw] max-w-[264px] shrink-0 snap-start sm:w-[34vw] lg:w-[238px]">
            <Link
              href="/video/portofoliu"
              className="glass lift group flex h-full flex-col items-center justify-center gap-4 rounded-panel-lg p-6 text-center"
              style={{ aspectRatio: "9 / 16" }}
            >
              <span className="grid size-14 place-items-center rounded-full border border-hair text-a1 transition-transform duration-300 group-hover:scale-110">
                <Icon name="arrowRight" size={20} />
              </span>
              <span className="text-[16.5px] font-medium text-bone">
                Vezi tot portofoliul
              </span>
              <span className="text-[14.5px] leading-relaxed text-dim">
                Toate filmările și fotografiile, pe client.
              </span>
            </Link>
          </li>
        </ul>
      </Reveal>
    </section>
  );
}

/* ---------------- Rând de ofertă ----------------
   Același buton, repetat după secțiunile în care omul tocmai s-a
   convins de ceva: probleme, proces, servicii, testimoniale. Clientul
   de video decide repede — nu-l trimitem să caute butonul din bară.
   Vocabular constant (CLAUDE.md §4): peste tot „Cere ofertă". */
function OfferRow({
  text,
  className = "",
}: {
  text: string;
  className?: string;
}) {
  return (
    <Reveal
      className={`mx-auto flex max-w-6xl flex-col items-center justify-center gap-3 sm:flex-row sm:gap-5 ${className}`}
    >
      <p className="text-center text-[15px] text-dim sm:text-left">{text}</p>
      <div className="flex flex-col gap-2.5 sm:flex-row">
        <a href="#contact" className="btn btn-primary">
          Cere ofertă
          <Icon name="arrowRight" size={16} className="arw" />
        </a>
        <a href={CONTACT.whatsapp} className="btn btn-ghost">
          <Icon name="whatsapp" size={16} />
          WhatsApp
        </a>
      </div>
    </Reveal>
  );
}

/* ---------------- Probleme ----------------
   Explicația e înlocuită cu dovada: fiecare simptom are un desen care
   îl arată (problem-glyphs.tsx). Grila se citește în cinci secunde —
   desen, propoziție, ce facem — iar cauza se deschide la „De ce se
   întâmplă”, cu același accordion ca la întrebări. */
function Problems() {
  return (
    <section
      id="probleme"
      className="relative px-5 py-16 sm:px-6 sm:py-24 lg:py-32"
    >
      <SectionHead
        eyebrow="Ce te costă acum"
        title="Ce probleme auzim cel mai des"
        lead="Și pe care le și rezolvăm."
      />

      <ul className="mx-auto mt-10 grid max-w-6xl gap-3 sm:mt-16 sm:gap-4 md:grid-cols-2 lg:grid-cols-3">
        {PAINS.map((p, i) => (
          <Reveal
            as="li"
            key={p.tag}
            delay={i * 70}
            /* Al șaselea card („Toate”) e concluzia celorlalte cinci. Pe
               telefon, unde cardurile stau unul sub altul, lista se scurtează
               fără el; pe tabletă și desktop e nevoie de el ca grila 3×2 să
               fie plină. */
            className={p.tag === "Toate" ? "hidden md:block" : ""}
          >
            <ProblemCard pain={p} />
          </Reveal>
        ))}
      </ul>

      <OfferRow
        className="mt-10 sm:mt-14"
        text="Te-ai recunoscut într-unul? Hai să vorbim despre el."
      />
    </section>
  );
}

function ProblemCard({ pain }: { pain: (typeof PAINS)[number] }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const { caption, Draw } = PROBLEM_GLYPHS[pain.glyph];

  return (
    <article
      className={`glass lift flex h-full flex-col p-5 sm:px-6 sm:pt-6 sm:pb-4 ${
        open ? "acc-open" : ""
      }`}
    >
      {/* Nișa e primul lucru care se citește: omul se caută pe el în
          grilă, nu citește șase simptome ca să vadă care e al lui. De
          aceea e mai mare decât un eyebrow obișnuit și poartă culoarea
          caldă a diviziei, nu griul. */}
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-md-mono text-[14px] uppercase tracking-[0.16em] text-a1 sm:text-[15px]">
          {pain.tag}
        </span>
        {/* ce arată desenul, în aceeași voce mono ca eyebrow-ul */}
        <span className="whitespace-nowrap font-md-mono text-[10px] uppercase tracking-[0.14em] text-dim/75">
          {caption}
        </span>
      </div>

      <GlyphFrame>
        <Draw />
      </GlyphFrame>

      <h3 className="mt-4 text-[19px] font-medium leading-snug text-bone sm:text-[21px]">
        „{pain.symptom}”
      </h3>

      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className="mt-auto inline-flex items-center gap-2 self-start pt-4 text-[15px] text-dim transition-colors hover:text-bone"
      >
        <span className="acc-sign inline-flex">
          <Icon name="plus" size={15} />
        </span>
        De ce se întâmplă
      </button>
      <div id={id} className="acc-body" role="region">
        <div>
          <p className="pt-2.5 text-[15.5px] leading-relaxed text-dim sm:text-[16px]">
            {pain.cause}
          </p>
        </div>
      </div>
    </article>
  );
}

/* ---------------- Proces ----------------
   Mesajul e prezența, nu repetiția: nu „aceiași patru pași la
   nesfârșit”, ci „rămânem lângă tine după livrare”. Poartă id-ul
   `sistem` fiindcă aici duce linkul din meniu. */
function Process() {
  return (
    <section
      id="sistem"
      className="relative px-5 py-16 sm:px-6 sm:py-24 lg:py-32"
    >
      <SectionHead
        eyebrow="Alături de tine"
        title="Nu livrăm și plecăm"
        lead="Aceeași echipă, de la prima cafea la raportul lunar."
      />

      <ol className="relative mx-auto mt-10 grid max-w-6xl gap-3 sm:mt-16 sm:gap-4 md:grid-cols-2 lg:grid-cols-4">
        <span
          aria-hidden
          className="rule absolute inset-x-8 top-[46px] hidden lg:block"
        />
        {SYSTEM.map((s, i) => (
          <Reveal as="li" key={s.n} delay={i * 90} className="relative">
            <article className="glass lift h-full p-5 sm:p-6">
              <span className="relative z-10 mb-4 flex size-10 items-center justify-center rounded-full border border-hair bg-ink font-md-mono text-[13px] text-a2 sm:mb-6 sm:size-11">
                {s.n}
              </span>
              {/* Titlu, un rând de explicație, livrabilele. Proza de sub
                  ele a plecat: pasul se înțelege din ce rămâne la tine
                  după el, nu din încă un paragraf care îl repovestește. */}
              <h3 className="text-[20px] font-medium text-bone">{s.title}</h3>
              <p className="mt-2 text-[15.5px] leading-snug text-a2">
                {s.lead}
              </p>
              <ul className="mt-4 space-y-2 border-t border-hair pt-3.5 sm:mt-5 sm:pt-4">
                {s.outputs.map((o) => (
                  <li key={o} className="flex gap-2.5 text-[14.5px] text-dim">
                    <Icon
                      name="check"
                      size={15}
                      className="mt-0.5 shrink-0 text-a1"
                    />
                    {o}
                  </li>
                ))}
              </ul>
            </article>
          </Reveal>
        ))}
      </ol>

      <OfferRow
        className="mt-10 sm:mt-14"
        text="Vrei să vezi cum ar arăta pentru afacerea ta?"
      />
    </section>
  );
}

/* ---------------- Servicii ----------------

   Fiecare serviciu are desenul lui (service-glyphs.tsx): ce vinzi se
   vede înainte de ce scrii. Layoutul a trecut de la „titlu lipit în
   stânga + 2x2 carduri" la titlu deasupra și patru carduri pe un rând,
   tocmai ca desenele să încapă fără ca secțiunea să se lungească — pe
   un laptop intră întreagă într-un ecran.

   Cutia de preț a coborât sub carduri, pe toată lățimea: acolo e locul
   ei firesc, după ce ai citit ce se poate cumpăra. */
function Services() {
  return (
    <section id="servicii" className="relative px-5 py-20 sm:px-6 lg:py-28">
      <div className="mx-auto max-w-6xl">
        <SectionHead
          align="left"
          eyebrow="Servicii"
          title="Ce putem lua pe umerii noștri"
          lead="Poți începe cu una singură. Merg cel mai bine împreună."
        />

        <ul className="mt-10 grid gap-3 sm:grid-cols-2 lg:mt-14 lg:grid-cols-4">
          {SERVICES.map((s, i) => {
            const Draw = SERVICE_GLYPHS[s.glyph];
            return (
              <Reveal as="li" key={s.key} delay={i * 70}>
                <article className="glass lift flex h-full flex-col p-5 sm:p-6">
                  <GlyphBox>
                    <Draw />
                  </GlyphBox>
                  <h3 className="text-[19.5px] font-medium leading-snug text-bone">
                    {s.title}
                  </h3>
                  <p className="mt-2.5 text-[15.5px] leading-relaxed text-dim">
                    {s.blurb}
                  </p>
                  <ul className="mt-4 flex flex-wrap gap-1.5">
                    {s.bullets.map((b) => (
                      <li
                        key={b}
                        className="rounded-full border border-hair px-2.5 py-1 text-[13px] text-dim"
                      >
                        {b}
                      </li>
                    ))}
                  </ul>
                  {/* Fiecare serviciu are drumul lui spre formular; textul
                      din link spune pe ce serviciu se cere oferta. */}
                  <a
                    href="#contact"
                    className="mt-auto inline-flex min-h-11 items-center gap-1.5 self-start pt-4 text-[15px] font-medium text-a2 transition-colors hover:text-bone"
                  >
                    Cere ofertă
                    <Icon name="arrowRight" size={15} className="arw" />
                    <span className="sr-only"> pentru {s.title}</span>
                  </a>
                </article>
              </Reveal>
            );
          })}
        </ul>

        <Reveal delay={140} className="mt-3">
          <div className="glass edge-light flex flex-wrap items-center gap-x-8 gap-y-4 p-6 sm:p-7">
            <p className="min-w-[220px] flex-1 text-[16px] leading-relaxed text-dim">
              Prețul se face pe proiect.
              <span className="block text-bone">
                Ofertă fermă după prima discuție.
              </span>
            </p>
            <a href="#contact" className="btn btn-primary">
              Cere ofertă
              <Icon name="arrowRight" size={16} className="arw" />
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}


/* ---------------- Recenzii ----------------

   Un client filmat, lângă restul recenziilor în scris. Ordinea nu e
   întâmplătoare: pe o pagină de agenție video, dovada trebuie să fie
   ea însăși video — altfel vindem filmare cu text. Omul din stânga
   vorbește, coloana din dreapta curge încet pe lângă el.

   Videoul nu pornește singur și n-are sunet până nu-l ceri: VideoCard
   montează elementul abia la apăsare (CLAUDE.md §7). */
const REVIEW_VIDEO: PortfolioVideo = {
  slug: "recenzie-e45",
  client: "E45 Restobar",
  title: "Recenzie, filmată la ei în local",
  kind: "Recenzie",
  src: "/video/recenzii/e45.mp4",
  poster: "/video/recenzii/e45.webp",
  w: 720,
  h: 1280,
  seconds: 97,
  audio: true,
};

function ReviewCard({ t }: { t: (typeof TESTIMONIALS)[number] }) {
  return (
    <article className="glass p-6">
      <p className="text-[16px] leading-relaxed text-bone sm:text-[16.5px]">
        „{t.quote}”
      </p>
      <div className="mt-5 flex items-center gap-3">
        {/* Logo-ul real, dacă îl avem: e semnătura recenziei. Cade pe
            marca desenată din client-marks.tsx pentru clienții care n-au
            trimis încă unul — plăcuța are aceeași mărime în ambele
            cazuri, deci rândul nu tresare. */}
        {t.logo ? (
          /* eslint-disable-next-line @next/next/no-img-element -- logo deja
             curățat de fundal și adus la 128px, ca posterele din
             portofoliu; optimizatorul lui Next n-ar mai avea ce adăuga. */
          <img
            src={t.logo}
            alt=""
            width={38}
            height={38}
            loading="lazy"
            decoding="async"
            className="size-[38px] shrink-0 rounded-[11px] border border-hair bg-white/[0.06] object-contain p-[3px]"
          />
        ) : (
          <ClientMark name={t.who} size={38} />
        )}
        <span className="min-w-0">
          <span className="block truncate text-[14.5px] font-medium text-bone">
            {t.who}
          </span>
          <span className="block truncate text-[13px] text-dim">{t.where}</span>
        </span>
        {t.isPlaceholder && (
          <span className="ml-auto shrink-0 rounded-full border border-hair px-2 py-0.5 font-md-mono text-[10px] uppercase tracking-widest text-dim">
            exemplu
          </span>
        )}
      </div>
    </article>
  );
}

/**
 * Coloana care curge. Marquee vertical din globals.css: lista e scrisă
 * de două ori, iar animația urcă exact cu o copie, deci bucla nu se
 * vede. Se oprește la hover, ca să poți citi ce ți-a sărit în ochi.
 *
 * Sub prefers-reduced-motion nu curge nimic și nici nu se taie nimic:
 * recenziile se așază una sub alta, întregi. O coloană cu înălțime fixă
 * și animația oprită ar ascunde jumătate din ele fără nicio cale de a
 * ajunge la restul.
 */
function ReviewStream() {
  const reduced = useReducedMotion();

  if (reduced) {
    return (
      <Reveal delay={90}>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          {TESTIMONIALS.map((t) => (
            <li key={t.who}>
              <ReviewCard t={t} />
            </li>
          ))}
        </ul>
      </Reveal>
    );
  }

  return (
    <Reveal delay={90} className="min-w-0 lg:h-full">
      {/* `h-full` pe desktop: coloana se întinde exact cât placa video de
          lângă ea, oricât ar fi aceea. Înălțimea rândului o dă videoul,
          care are raport fix — deci nu se învârt una după alta. */}
      <div className="marquee-col fade-y h-[420px] overflow-hidden lg:h-full">
        <div className="marquee-v" style={{ ["--dur" as string]: "52s" }}>
          {[0, 1].map((copy) => (
            <ul key={copy} className="grid shrink-0 gap-4 pb-4" aria-hidden={copy === 1}>
              {TESTIMONIALS.map((t) => (
                <li key={t.who}>
                  <ReviewCard t={t} />
                </li>
              ))}
            </ul>
          ))}
        </div>
      </div>
    </Reveal>
  );
}

function Social() {
  return (
    <section className="relative px-5 py-24 sm:px-6 lg:py-32">
      <SectionHead
        eyebrow="Recenzii"
        title={
          <>
            Nu ne credeți pe noi.
            <br />
            <span className="grad-text-soft">Credeți-i pe ei.</span>
          </>
        }
        lead="Unul a zis-o în fața camerei. Restul, în scris."
      />

      {/* Placa video e ținută scurtă pe desktop (max 300px, adică ~530px
          înălțime la 9:16): e o dovadă, nu materialul principal al
          paginii. Pe telefon nu mai ocupă tot ecranul — se oprește la
          270px lățime, centrată, cât să se vadă că e un om care
          vorbește, nu un banner. */}
      <div className="mx-auto mt-14 grid max-w-5xl gap-5 lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)] lg:gap-6">
        <Reveal variant="scale" className="mx-auto w-full max-w-[270px] lg:max-w-none">
          <VideoCard item={REVIEW_VIDEO} className="w-full" />
        </Reveal>
        <ReviewStream />
      </div>

      <OfferRow
        className="mt-10 sm:mt-14"
        text="Următorul citat poate fi al tău."
      />
    </section>
  );
}

/* ---------------- Întrebări ---------------- */
function Questions() {
  return (
    <section id="intrebari" className="relative px-5 py-24 sm:px-6 lg:py-32">
      <SectionHead eyebrow="Întrebări" title="Ce ne întreabă toți" />
      <Reveal delay={80} className="mx-auto mt-14 max-w-3xl">
        <Faq items={FAQ} />
      </Reveal>
    </section>
  );
}

/* ---------------- CTA final ---------------- */

/**
 * Grafică decorativă pentru cardul de contact: primele două minute ale
 * unei conversații pe WhatsApp, cu orele la vedere. Cardul are înălțimea
 * formularului de lângă el, iar golul de sub un singur rând de text nu se
 * umple cu încă un paragraf — se umple cu imaginea promisiunii din
 * rândul ăla: „răspundem în minute”. Pe telefon nu există gol, deci nici
 * grafica; butoanele vin imediat sub titlu.
 */
function ChatPreview() {
  const bubble =
    "max-w-[85%] rounded-panel px-3.5 py-2.5 text-[14.5px] leading-snug";
  const stamp = "mt-1 font-md-mono text-[10.5px] tracking-wider text-dim/75";
  return (
    <div aria-hidden className="relative my-auto hidden py-8 md:block">
      <div
        className="pointer-events-none absolute inset-x-8 top-1/2 h-40 -translate-y-1/2 rounded-full opacity-40 blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, color-mix(in oklab, var(--md-a1) 45%, transparent), transparent)",
        }}
      />
      <div className="relative flex flex-col">
        <div className={`${bubble} self-end rounded-br-sm bg-a1 text-on-a1`}>
          Salut! Vrem un video pentru showroom.
        </div>
        <span className={`${stamp} self-end`}>14:02</span>

        <div className={`${bubble} mt-3 self-start rounded-bl-sm border border-hair bg-ink/60 text-bone`}>
          Trimite-ne linkul paginii — ne uităm acum.
        </div>
        <span className={stamp}>14:04</span>

        <div className="mt-3 flex items-center gap-1 self-start rounded-panel rounded-bl-sm border border-hair bg-ink/60 px-3.5 py-3">
          {[0, 150, 300].map((delay) => (
            <span
              key={delay}
              className="size-1.5 animate-pulse rounded-full bg-dim motion-reduce:animate-none"
              style={{ animationDelay: `${delay}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function FinalCta() {
  return (
    <section id="contact" className="relative px-5 pb-24 pt-8 sm:px-6">
      <Reveal variant="scale" className="mx-auto max-w-5xl">
        <div className={`glass-2 edge-light relative overflow-hidden px-6 py-16 text-center sm:px-12 sm:py-20 ${v.ctaBox}`}>
          <div
            aria-hidden
            className="aurora aurora-drift"
            style={{
              width: "90%",
              height: "130%",
              left: "50%",
              bottom: "-72%",
              translate: "-50% 0",
              background:
                "radial-gradient(circle closest-side, color-mix(in oklab, var(--md-a1) 85%, transparent), transparent)",
              opacity: 0.7,
            }}
          />
          <div className="relative z-10">
            <h2 className="display mx-auto max-w-2xl text-[clamp(2rem,5.4vw,3.3rem)]">
              Gata să vezi unde se pierd clienții?
            </h2>
            {/* Două căi, aceeași greutate (CLAUDE.md §8): vocea pentru
                cine decide acum, formularul pentru cine citește la 23:40.
                Nu ascundem a doua sub „alte metode de contact". */}
            <div className="mx-auto mt-11 grid max-w-4xl gap-4 text-left md:grid-cols-2">
              <div className="glass edge-light flex flex-col p-7">
                <p className="eyebrow">Cel mai rapid</p>
                <h3 className="display mt-3 text-[clamp(1.2rem,2.6vw,1.5rem)]">
                  Contactează-ne
                </h3>
                <p className="mt-2 text-[15.5px] leading-relaxed text-dim">
                  Pe WhatsApp răspundem în minute, în program.
                </p>

                <ChatPreview />

                <div className="mt-6 flex flex-col gap-2.5">
                  <a
                    href={CONTACT.whatsapp}
                    className="btn btn-primary !w-full"
                  >
                    <Icon name="whatsapp" size={17} />
                    WhatsApp
                  </a>
                  <a href={CONTACT.phoneHref} className="btn btn-ghost !w-full">
                    <Icon name="phone" size={16} />
                    {CONTACT.phone}
                  </a>
                </div>
              </div>

              <VideoLeadForm />
            </div>

            <ol className="mx-auto mt-14 grid max-w-3xl gap-6 text-left sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((s) => (
                <li key={s.n} className="border-t border-hair pt-4">
                  <span className="font-md-mono text-[12px] text-a2">
                    PASUL {s.n}
                  </span>
                  <p className="mt-2 text-[16.5px] font-medium leading-snug text-bone">
                    {s.title}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

/* ---------------- Footer ---------------- */
function Foot() {
  return (
    <footer className="relative overflow-hidden border-t border-hair">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <span className="flex items-center gap-2.5 text-bone">
            <Mark size={25} />
            <span className="font-md-display text-[16px] font-bold tracking-tight">
              MERIDIAN
            </span>
          </span>
          <p className="mt-4 max-w-xs text-[15px] leading-relaxed text-dim">
            Producție video și campanii plătite, sub același acoperiș. Partener
            pe termen lung, nu furnizor de proiect.
          </p>
          <div className="mt-6 flex gap-2">
            <a
              href={CONTACT.whatsapp}
              className="btn btn-ghost !min-h-10 !px-4 !py-2 !text-[13px]"
            >
              <Icon name="whatsapp" size={15} />
              WhatsApp
            </a>
            <a
              href={CONTACT.phoneHref}
              className="btn btn-ghost !min-h-10 !px-4 !py-2 !text-[13px]"
            >
              <Icon name="phone" size={15} />
              Sună
            </a>
          </div>
        </div>

        <div>
          <p className="eyebrow mb-4">Navigare</p>
          <ul className="space-y-2.5">
            {NAV.map((n) => (
              <li key={n.href}>
                <NavLink
                  href={n.href}
                  className="text-[15px] text-dim transition-colors hover:text-bone"
                >
                  {n.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="eyebrow mb-4">Industrii</p>
          <ul className="space-y-2.5">
            {VERTICALS.map((v) => (
              <li key={v.key} className="text-[15px] text-dim">
                {v.label}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-8 gap-y-3 border-t border-hair px-5 py-6 text-[13px] text-dim sm:px-6">
        <span>
          © 2026 MERIDIAN.
          {CONTACT.isPlaceholder &&
            " Adresa de email de pe această pagină e încă provizorie."}
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
        className="display pointer-events-none select-none px-5 text-center text-[18vw] leading-[0.78] text-white/[0.05] sm:px-6"
        style={{ marginBottom: "-0.16em" }}
      >
        MERIDIAN
      </p>
    </footer>
  );
}
