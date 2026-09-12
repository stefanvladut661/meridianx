"use client";

import { Link } from "@/i18n/navigation";
import { useId, useState } from "react";
import { Mark } from "@/components/site/mark";
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
  ScrollProgress,
  useScrolled,
} from "@/components/site/motion";
import {
  AvatarStack,
  Faq,
  Icon,
  SectionHead,
  TestimonialWall,
} from "@/components/site/ui";
import { VideoCard } from "@/components/site/video-player";
import { GlyphFrame, PROBLEM_GLYPHS } from "@/components/site/problem-glyphs";
import { FEATURED } from "@/components/site/portfolio-content";
import {
  CLIENTS,
  CONTACT,
  PRESENTATION,
  CREW,
  DELIVERABLES,
  EDGES,
  FAQ,
  NAV,
  PAINS,
  SERVICES,
  STEPS,
  SYSTEM,
  VERTICALS,
} from "@/components/site/video-content";
import { ClientMark } from "@/components/site/client-marks";

/* ============================================================
   V4 · HIBRID (AURORA × SIGNAL)
   Capul de la AURORA: bară plutitoare, hero asimetric pe două
   coloane cu placa media și cardurile de date, bandă de industrii,
   grila de probleme.
   Corpul de la SIGNAL, de la „Filmarea e o zi" în jos: bento,
   ciclul lunar, servicii, cifre, testimoniale,
   întrebări, CTA.
   Paleta e integral cea din SIGNAL — indigo, Satoshi, aceleași
   tokens. Se schimbă arhitectura, nu lumea cromatică.
   ============================================================ */

export function VideoScreen() {
  return (
    <div data-scope="video" className="md-root min-h-dvh overflow-clip">
      <ScrollProgress />
      <Nav />
      <main id="continut">
        {/* --- capul, de la AURORA --- */}
        <Hero />
        <TrustStrip />
        <Work />
        <Problems />
        {/* --- corpul, de la SIGNAL --- */}
        <Bento />
        <Process />
        <Services />
        <Numbers />
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
              <a
                href={n.href}
                className="rounded-full px-3.5 py-2 text-sm text-dim transition-colors hover:bg-white/5 hover:text-bone"
              >
                {n.label}
              </a>
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
                <a
                  href={n.href}
                  onClick={() => setOpen(false)}
                  className="block rounded-panel-sm px-4 py-3 text-[15px] text-bone hover:bg-white/5"
                >
                  {n.label}
                </a>
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

          <Reveal delay={90}>
            <h1 className="display mt-7 text-[clamp(2.4rem,6.4vw,4.4rem)]">
              Conținutul frumos nu plătește salarii.
              <br />
              <span className="text-dim">Cel care aduce </span>
              <RotatingWord
                words={["clienți", "rezervări", "cereri", "comenzi"]}
                className="text-a2"
              />
              <span className="text-dim">, da.</span>
            </h1>
          </Reveal>

          <Reveal delay={160}>
            <p className="mt-5 max-w-lg text-[16px] leading-relaxed text-dim sm:mt-6 sm:text-[17px]">
              <span className="sm:hidden">
                Filmăm, montăm și distribuim. Primești oameni care sună și
                rezervă, nu un folder cu clipuri.
              </span>
              <span className="hidden sm:inline">
                Filmăm, montăm și distribuim pe Meta, TikTok și Google. Tu nu
                primești un folder cu clipuri — primești un flux constant de
                oameni care sună, rezervă și cumpără.
              </span>
            </p>
          </Reveal>

          <Reveal delay={230}>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
              <a href="#contact" className="btn btn-primary">
                Cere un plan de creștere
                <Icon name="arrowRight" size={17} className="arw" />
              </a>
              <Link href="/video/portofoliu" className="btn btn-ghost">
                <Icon name="play" size={14} />
                Vezi portofoliul
              </Link>
            </div>
          </Reveal>

          <Reveal delay={300}>
            <div className="mt-12 max-w-lg border-t border-hair pt-7">
              <p className="eyebrow mb-4">Au trecut prin sistem</p>
              <ul className="flex flex-wrap gap-x-5 gap-y-3">
                {CLIENTS.slice(0, 6).map((c) => (
                  <li
                    key={c}
                    className="flex items-center gap-2 text-[13.5px] text-dim"
                  >
                    <ClientMark name={c} size={22} />
                    {c}
                  </li>
                ))}
              </ul>
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
                  ZIUA 01 / FILMARE
                </span>
              </div>
              <p className="mt-2 text-[13px] leading-snug text-dim">
                Dintr-o zi ies{" "}
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
              <span className="text-[15px] font-medium text-bone">
                Vezi tot portofoliul
              </span>
              <span className="text-[13px] leading-relaxed text-dim">
                Toate filmările și fotografiile, pe client.
              </span>
            </Link>
          </li>
        </ul>
      </Reveal>
    </section>
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
        title={
          <>
            Problema nu e că nu ai conținut.
            <br />
            <span className="text-dim">E că nu ajunge la cine cumpără.</span>
          </>
        }
        lead="Șase tipare pe care le vedem cel mai des. Dacă unul e al tău, îl recunoști din desen."
      />

      <ul className="mx-auto mt-10 grid max-w-6xl gap-3 sm:mt-16 sm:gap-4 md:grid-cols-2 lg:grid-cols-3">
        {PAINS.map((p, i) => (
          <Reveal as="li" key={p.tag} delay={i * 70}>
            <ProblemCard pain={p} />
          </Reveal>
        ))}
      </ul>
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
      <div className="flex items-baseline justify-between gap-3">
        <span className="eyebrow">{pain.tag}</span>
        {/* ce arată desenul, în aceeași voce mono ca eyebrow-ul */}
        <span className="whitespace-nowrap font-md-mono text-[10px] uppercase tracking-[0.14em] text-dim/75">
          {caption}
        </span>
      </div>

      <GlyphFrame>
        <Draw />
      </GlyphFrame>

      <h3 className="mt-4 text-[17px] font-medium leading-snug text-bone sm:text-[19px]">
        „{pain.symptom}”
      </h3>
      <p className="mt-3 flex gap-2.5 text-[14px] leading-relaxed text-a3">
        <Icon name="check" size={16} className="mt-0.5 shrink-0" />
        {pain.fix}
      </p>

      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className="mt-auto inline-flex items-center gap-2 self-start pt-4 text-[13px] text-dim transition-colors hover:text-bone"
      >
        <span className="acc-sign inline-flex">
          <Icon name="plus" size={14} />
        </span>
        De ce se întâmplă
      </button>
      <div id={id} className="acc-body" role="region">
        <div>
          <p className="pt-2.5 text-[14px] leading-relaxed text-dim">
            {pain.cause}
          </p>
        </div>
      </div>
    </article>
  );
}

/* ---------------- Bento ---------------- */
function Bento() {
  return (
    <section id="sistem" className="relative px-5 py-24 sm:px-6 lg:py-32">
      <SectionHead
        eyebrow="Lanțul complet"
        title={
          <>
            Filmarea e o zi.
            <br />
            <span className="grad-text-soft">Restul e treaba noastră.</span>
          </>
        }
        lead="Camera e partea vizibilă. Înainte de ea stă decizia ce filmăm, după ea stau campaniile care duc materialul la om. Le ținem pe amândouă, ca să nu ajungi tu dispecer între trei furnizori."
      />

      <div className="mx-auto mt-16 grid max-w-6xl gap-4 lg:grid-cols-3">
        {/* 1 — unghiul, decis inainte de camera */}
        <Reveal className="lg:col-span-1">
          <article className="glass bleed relative flex h-full min-h-[340px] flex-col justify-end overflow-hidden p-7">
            <div
              className="absolute inset-x-7 top-7 grid grid-cols-4 gap-1.5 opacity-90"
              aria-hidden
            >
              {Array.from({ length: 12 }).map((_, i) => (
                <span
                  key={i}
                  className="rounded-[3px] border border-hair"
                  style={{
                    aspectRatio: "9 / 16",
                    background:
                      i === 5
                        ? "linear-gradient(180deg, color-mix(in oklab, var(--md-a1) 70%, transparent), transparent)"
                        : "rgb(255 255 255 / 0.05)",
                  }}
                />
              ))}
            </div>
            <div className="relative z-10 mt-auto pt-40">
              <h3 className="text-[19px] font-medium text-bone">
                Unghiul, înainte de cameră
              </h3>
              <p className="mt-2.5 text-[14.5px] leading-relaxed text-dim">
                Ce obiecție trebuie spartă, ce întrebare pune omul înainte să
                cumpere. De acolo iese lista de filmat: același produs, mai
                multe unghiuri.
              </p>
            </div>
          </article>
        </Reveal>

        {/* 2 — testare hook-uri */}
        <Reveal delay={90} className="lg:col-span-2">
          <article className="glass bleed relative h-full overflow-hidden p-7">
            <div className="relative z-10 max-w-md">
              <h3 className="text-[19px] font-medium text-bone">
                Publicul decide, nu ședința
              </h3>
              <p className="mt-2.5 text-[14.5px] leading-relaxed text-dim">
                Punem în aer unghiurile una lângă alta și ne uităm care aduce
                cereri. Ce nu se ridică se oprește, fără dezbateri.
              </p>
            </div>
            <ul className="relative z-10 mt-7 space-y-2.5" aria-hidden>
              {[
                { t: "Hook: problema", w: 88, on: true },
                { t: "Hook: prețul", w: 34, on: false },
                { t: "Hook: dovada", w: 71, on: true },
              ].map((r, i) => (
                <li
                  key={r.t}
                  className={`flex items-center gap-4 rounded-panel-sm border px-4 py-3 ${
                    r.on
                      ? "border-a1/40 bg-a1/10"
                      : "border-hair bg-white/[0.02]"
                  }`}
                  style={{ marginLeft: i * 14 }}
                >
                  <span className="text-[14px] text-bone">{r.t}</span>
                  <span className="ml-auto h-1.5 w-24 overflow-hidden rounded-full bg-white/10 sm:w-40">
                    <span
                      className="block h-full rounded-full"
                      style={{
                        width: `${r.w}%`,
                        background: r.on
                          ? "linear-gradient(90deg,var(--md-a1),var(--md-a2))"
                          : "rgb(255 255 255 / 0.2)",
                      }}
                    />
                  </span>
                </li>
              ))}
            </ul>
          </article>
        </Reveal>

        {/* 3 — distribuție */}
        <Reveal delay={60} className="lg:col-span-2">
          <article className="glass bleed relative h-full overflow-hidden p-7">
            <div className="relative z-10 grid gap-7 sm:grid-cols-[1fr_auto] sm:items-center">
              <div className="max-w-sm">
                <h3 className="text-[19px] font-medium text-bone">
                  Trei platforme, un singur plan
                </h3>
                <p className="mt-2.5 text-[14.5px] leading-relaxed text-dim">
                  Meta pentru cerere latentă, TikTok pentru atenție, Google
                  pentru omul care caută deja ce vinzi. Le pornim, le ținem și
                  le tăiem noi — tu nu intri în managerul de reclame.
                </p>
              </div>
              <ul className="flex gap-2.5" aria-hidden>
                {["Meta", "TikTok", "Google"].map((p, i) => (
                  <li
                    key={p}
                    className="glass-2 flex w-[86px] flex-col items-center gap-2 rounded-panel px-3 py-4"
                    style={{ transform: `translateY(${i === 1 ? -10 : 0}px)` }}
                  >
                    <span
                      className="flex size-9 items-center justify-center rounded-full text-a2"
                      style={{
                        background:
                          i === 1
                            ? "color-mix(in oklab, var(--md-a1) 30%, transparent)"
                            : "rgb(255 255 255 / 0.06)",
                      }}
                    >
                      <Icon name="megaphone" size={17} />
                    </span>
                    <span className="text-[12.5px] text-bone">{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          </article>
        </Reveal>

        {/* 4 — dupa livrare */}
        <Reveal delay={130}>
          <article className="glass bleed relative h-full overflow-hidden p-7">
            <div className="relative z-10">
              <h3 className="text-[19px] font-medium text-bone">
                Nu se termină la livrare
              </h3>
              <p className="mt-2.5 text-[14.5px] leading-relaxed text-dim">
                Vezi ce a adus cereri, în ordinea asta. Ce funcționează intră în
                următorul set de filmări, ce nu, nu mai primește buget.
              </p>
              <ul className="mt-6 space-y-3" aria-hidden>
                {[
                  "Cereri de ofertă",
                  "Apeluri primite",
                  "Rezervări online",
                  "Acoperire",
                ].map((k, i) => (
                  <li
                    key={k}
                    className="flex items-center justify-between border-b border-hair pb-2.5 text-[13.5px]"
                  >
                    <span className={i === 3 ? "text-dim" : "text-bone"}>
                      {k}
                    </span>
                    <span
                      className="h-1.5 w-16 rounded-full"
                      style={{
                        background:
                          i === 3
                            ? "rgb(255 255 255 / 0.15)"
                            : "linear-gradient(90deg,var(--md-a1),var(--md-a2))",
                      }}
                    />
                  </li>
                ))}
              </ul>
            </div>
          </article>
        </Reveal>
      </div>
    </section>
  );
}

/* ---------------- Proces ---------------- */
function Process() {
  return (
    <section className="relative px-5 py-16 sm:px-6 sm:py-24 lg:py-32">
      <SectionHead
        eyebrow="Ciclul lunar"
        title="Patru pași, repetați la nesfârșit"
        lead={
          <>
            <span className="sm:hidden">
              Luna a treia costă la fel și livrează mai mult.
            </span>
            <span className="hidden sm:inline">
              Fiecare rotire folosește ce a învățat cea dinainte. De asta luna a
              treia costă la fel și livrează mai mult.
            </span>
          </>
        }
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
              <h3 className="text-[18px] font-medium text-bone">{s.title}</h3>
              <p className="mt-1.5 text-[14px] text-a2">{s.lead}</p>
              {/* proza explicativă rămâne pe desktop; pe telefon contează livrabilele */}
              <p className="mt-3.5 hidden text-[14.5px] leading-relaxed text-dim sm:block">
                {s.body}
              </p>
              <ul className="mt-4 space-y-2 border-t border-hair pt-3.5 sm:mt-5 sm:pt-4">
                {s.outputs.map((o) => (
                  <li key={o} className="flex gap-2.5 text-[13.5px] text-dim">
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
    </section>
  );
}

/* ---------------- Servicii ---------------- */
function Services() {
  return (
    <section id="servicii" className="relative px-5 py-24 sm:px-6 lg:py-32">
      <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[minmax(0,380px)_1fr] lg:gap-16">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <SectionHead
            align="left"
            eyebrow="Servicii"
            title="Ce putem lua pe umerii noștri"
            lead="Poți începe cu o singură piesă. Dar câștigul mare apare când producția și distribuția stau în aceleași mâini."
            className="!max-w-none"
          />
          <Reveal delay={120}>
            <div className="glass mt-8 p-5">
              <p className="text-[14px] leading-relaxed text-dim">
                Prețurile se stabilesc pe proiect, în funcție de zile de
                filmare, locații, actori și bugetul media administrat.
                <span className="mt-2 block text-bone">
                  Primești ofertă fermă după apelul de diagnostic.
                </span>
              </p>
            </div>
          </Reveal>
        </div>

        <ul className="grid gap-3 sm:grid-cols-2">
          {SERVICES.map((s, i) => (
            <Reveal as="li" key={s.key} delay={i * 55}>
              <article className="glass lift h-full p-6">
                <h3 className="text-[18px] font-medium text-bone">{s.title}</h3>
                <p className="mt-3 text-[14.5px] leading-relaxed text-dim">
                  {s.blurb}
                </p>
                <ul className="mt-5 flex flex-wrap gap-2">
                  {s.bullets.map((b) => (
                    <li
                      key={b}
                      className="rounded-full border border-hair px-2.5 py-1 text-[12.5px] text-dim"
                    >
                      {b}
                    </li>
                  ))}
                </ul>
              </article>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ---------------- Cifre + livrabile ---------------- */
function Numbers() {
  return (
    <section id="echipa" className="relative px-5 py-24 sm:px-6 lg:py-32">
      <SectionHead
        eyebrow="Echipa"
        title={
          <>
            Aceiași oameni,
            <br />
            <span className="grad-text-soft">de la scenariu la raport</span>
          </>
        }
        lead="Nu subcontractăm. Cine scrie scenariul stă lângă cine se uită peste campanii o lună mai târziu — așa nu are cine să dea vina pe celălalt."
      />

      <div className="mx-auto mt-16 max-w-6xl">
        <div className="grid gap-4 lg:grid-cols-[1fr_minmax(0,400px)]">
          <div className="grid gap-4 sm:grid-cols-2">
            {EDGES.map((e, i) => (
              <Reveal key={e.title} delay={i * 60}>
                <article className="glass lift h-full p-6">
                  <h3 className="text-[17px] font-medium text-bone">
                    {e.title}
                  </h3>
                  <p className="mt-2.5 text-[14.5px] leading-relaxed text-dim">
                    {e.body}
                  </p>
                </article>
              </Reveal>
            ))}
          </div>

          <Reveal delay={120}>
            <article className="glass h-full p-7">
              <p className="eyebrow mb-5">Ce rămâne la tine</p>
              <ul className="space-y-3.5">
                {DELIVERABLES.map((d) => (
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
              <div className="rule my-6" />
              <p className="eyebrow mb-4">Echipa care le produce</p>
              <ul className="flex flex-wrap gap-2">
                {CREW.map((c) => (
                  <li
                    key={c.role}
                    className="rounded-full border border-hair px-3 py-1.5 text-[13px] text-dim"
                  >
                    {c.role}
                  </li>
                ))}
              </ul>
            </article>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ---------------- Testimoniale ---------------- */
function Social() {
  return (
    <section className="relative px-5 py-24 sm:px-6 lg:py-32">
      <SectionHead
        eyebrow="Testimoniale"
        title={
          <>
            Nu ne credeți pe noi.
            <br />
            <span className="grad-text-soft">Credeți-i pe ei.</span>
          </>
        }
        lead="HORECA, imobiliare, instalații, retail. Oameni cu afaceri diferite care au trecut prin același proces."
      />
      <div className="mx-auto mt-14 max-w-6xl">
        <TestimonialWall />
      </div>
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
function FinalCta() {
  return (
    <section id="contact" className="relative px-5 pb-24 pt-8 sm:px-6">
      <Reveal variant="scale" className="mx-auto max-w-5xl">
        <div className="glass-2 edge-light relative overflow-hidden px-6 py-16 text-center sm:px-12 sm:py-20">
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
                "radial-gradient(circle, color-mix(in oklab, var(--md-a1) 85%, transparent), transparent 60%)",
              opacity: 0.7,
            }}
          />
          <div className="relative z-10">
            <h2 className="display mx-auto max-w-2xl text-[clamp(2rem,5.4vw,3.3rem)]">
              Gata să vezi unde se pierd clienții?
            </h2>
            <p className="mx-auto mt-5 max-w-lg text-[16.5px] leading-relaxed text-dim">
              Douăzeci de minute, fără prezentare de agenție. Ne uităm la ce
              faci acum și îți spunem ce am schimba primul.
            </p>
            {/* Două căi, aceeași greutate (CLAUDE.md §8): vocea pentru
                cine decide acum, formularul pentru cine citește la 23:40.
                Nu ascundem a doua sub „alte metode de contact". */}
            <div className="mx-auto mt-11 grid max-w-4xl gap-4 text-left md:grid-cols-2">
              <div className="glass edge-light flex flex-col justify-between p-7">
                <div>
                  <p className="eyebrow">Cel mai rapid</p>
                  <h3 className="display mt-3 text-[clamp(1.2rem,2.6vw,1.5rem)]">
                    Scrie-ne acum
                  </h3>
                  <p className="mt-2 text-[14px] leading-relaxed text-dim">
                    Pe WhatsApp răspundem în minute, în program. Trimite-ne
                    linkul paginii tale și îți spunem pe loc ce am schimba.
                  </p>
                </div>
                <div className="mt-7 flex flex-col gap-2.5">
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
                  <p className="mt-2 text-[15px] font-medium text-bone">
                    {s.title}
                  </p>
                  <p className="mt-1 text-[13.5px] leading-relaxed text-dim">
                    {s.body}
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
          <p className="mt-4 max-w-xs text-[14px] leading-relaxed text-dim">
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
          <p className="eyebrow mb-4">Industrii</p>
          <ul className="space-y-2.5">
            {VERTICALS.map((v) => (
              <li key={v.key} className="text-[14px] text-dim">
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
