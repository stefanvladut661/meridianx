"use client";

import { Link } from "@/i18n/navigation";
import { useState } from "react";
import { Mark } from "@/components/site/mark";
import { LEGAL_LINKS } from "@/components/site/legal-links";
import { VideoLeadForm } from "@/components/site/video-form";
import {
  WorldSwitch,
  WorldSwitchMobileLink,
} from "@/components/site/world-switch";
import {
  CountUp,
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
  MediaFrame,
  SectionHead,
  TestimonialWall,
} from "@/components/site/ui";
import {
  CAPABILITY_STATS,
  CONTACT,
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

/* ============================================================
   V4 · HIBRID (AURORA × SIGNAL)
   Capul de la AURORA: bară plutitoare, hero asimetric pe două
   coloane cu placa media și cardurile de date, bandă de industrii,
   grila de probleme.
   Corpul de la SIGNAL, de la „Un mecanism, nu o listă de servicii"
   în jos: bento, ciclul lunar, servicii, cifre, testimoniale,
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
    <header className="fixed inset-x-0 top-0 z-50 px-4 pt-4 sm:px-6">
      <nav
        className={`ws-inset-right mx-auto flex max-w-6xl items-center gap-3 rounded-full border px-3 py-2 transition-all duration-500 sm:px-4 ${
          scrolled
            ? "border-hair bg-black/55 backdrop-blur-xl"
            : "border-transparent bg-transparent"
        }`}
        aria-label="Principal"
      >
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2.5 pl-1 text-bone"
        >
          <Mark size={26} />
          <span className="font-md-display text-[15px] font-semibold tracking-[0.18em]">
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
          className="btn btn-ghost ml-auto hidden !min-h-10 !px-4 !py-2 !text-[13px] lg:ml-0 md:inline-flex"
        >
          <Icon name="phone" size={15} />
          Sună acum
        </a>
        <a
          href="#contact"
          className="btn btn-primary ml-auto !min-h-10 !px-4 !py-2 !text-[13px] sm:ml-0"
        >
          Cere ofertă
        </a>

        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls="meniu-v4"
          className="flex size-10 shrink-0 items-center justify-center rounded-full border border-hair text-bone lg:hidden"
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
        id="meniu-v4"
        hidden={!open}
        className="glass-2 mx-auto mt-2 max-w-6xl overflow-hidden p-2 lg:hidden"
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
          <Reveal>
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
            <p className="mt-6 max-w-lg text-[17px] leading-relaxed text-dim">
              Filmăm, montăm și distribuim pe Meta, TikTok și Google. Tu nu
              primești un folder cu clipuri — primești un flux constant de
              oameni care sună, rezervă și cumpără.
            </p>
          </Reveal>

          <Reveal delay={230}>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
              <a href="#contact" className="btn btn-primary">
                Cere un plan de creștere
                <Icon name="arrowRight" size={17} className="arw" />
              </a>
              <a href="#sistem" className="btn btn-ghost">
                <Icon name="play" size={14} />
                Vezi cum lucrăm
              </a>
            </div>
          </Reveal>

          <Reveal delay={300}>
            <dl className="mt-12 grid max-w-lg grid-cols-3 gap-6 border-t border-hair pt-7">
              {CAPABILITY_STATS.slice(0, 3).map((s) => (
                <div key={s.label}>
                  <dt className="sr-only">{s.label}</dt>
                  <dd>
                    <span className="display block text-[clamp(1.7rem,4vw,2.3rem)] text-bone">
                      <CountUp to={s.value} suffix={s.suffix} />
                    </span>
                    <span className="mt-1 block text-[13px] leading-snug text-dim">
                      {s.label}
                    </span>
                  </dd>
                </div>
              ))}
            </dl>
          </Reveal>
        </div>

        {/* placa media + carduri flotante */}
        <Reveal delay={140} variant="scale" className="relative">
          <MediaFrame
            label="Showreel MERIDIAN"
            meta="Selecție 2026 · HORECA, imobiliare, auto"
            duration="1:12"
            tone={0}
            className="shadow-[0_40px_120px_-40px_rgba(0,0,0,0.9)]"
          />

          <div className="glass-2 edge-light float absolute -left-3 bottom-8 w-[188px] p-3.5 sm:-left-8 sm:w-[212px]">
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

          <div className="glass-2 edge-light float-2 absolute -right-2 top-8 w-[176px] p-3.5 sm:-right-6">
            <div className="flex items-center gap-2">
              <span className="rec-dot" aria-hidden />
              <span className="font-md-mono text-[11px] tracking-wider text-bone">
                ZIUA 01 / FILMARE
              </span>
            </div>
            <p className="mt-2 text-[13px] leading-snug text-dim">
              Dintr-o singură zi ies{" "}
              <span className="text-bone">30+ materiale</span> pentru trei
              platforme.
            </p>
          </div>
        </Reveal>
      </div>
    </PointerGlow>
  );
}

/* ---------------- Bandă de încredere ---------------- */
function TrustStrip() {
  return (
    <section className="relative border-y border-hair bg-char/40 py-6">
      <p className="sr-only">Industrii în care lucrăm</p>
      <Marquee duration={44}>
        {VERTICALS.map((v) => (
          <span
            key={v.key}
            className="flex items-center gap-3 whitespace-nowrap px-8"
          >
            <span className="display text-[clamp(1.1rem,2.4vw,1.6rem)] text-bone/80">
              {v.label}
            </span>
            <span className="size-1 rounded-full bg-a1" aria-hidden />
            <span className="text-sm text-dim">{v.short}</span>
          </span>
        ))}
      </Marquee>
    </section>
  );
}

/* ---------------- Probleme ---------------- */
function Problems() {
  return (
    <section id="probleme" className="relative px-5 py-24 sm:px-6 lg:py-32">
      <SectionHead
        eyebrow="Ce te costă acum"
        title={
          <>
            Problema nu e că nu ai conținut.
            <br />
            <span className="text-dim">E că nu ajunge la cine cumpără.</span>
          </>
        }
        lead="Am strâns tiparele pe care le vedem cel mai des, pe industrii. Dacă îți recunoști afacerea în vreunul, știi deja de unde începem."
      />

      <ul className="mx-auto mt-16 grid max-w-6xl gap-4 md:grid-cols-2 lg:grid-cols-3">
        {PAINS.map((p, i) => (
          <Reveal as="li" key={p.symptom} delay={i * 70}>
            <article className="glass bleed lift group h-full p-6 sm:p-7">
              <div className="relative z-10">
                <span className="eyebrow">{p.tag}</span>
                <h3 className="mt-4 text-[19px] font-medium leading-snug text-bone">
                  „{p.symptom}”
                </h3>
                <p className="mt-3.5 text-[15px] leading-relaxed text-dim">
                  {p.cause}
                </p>
                <div className="rule my-5" />
                <p className="flex gap-2.5 text-[14px] leading-relaxed text-a3">
                  <Icon name="check" size={16} className="mt-0.5 shrink-0" />
                  {p.fix}
                </p>
              </div>
            </article>
          </Reveal>
        ))}
      </ul>
    </section>
  );
}


/* ---------------- Bento ---------------- */
function Bento() {
  return (
    <section id="sistem" className="relative px-5 py-24 sm:px-6 lg:py-32">
      <SectionHead
        eyebrow="Cum funcționează"
        title={
          <>
            Un mecanism, nu
            <br />
            <span className="grad-text-soft">o listă de servicii</span>
          </>
        }
        lead="Fiecare piesă alimentează piesa următoare. De asta funcționează mai bine împreună decât separat."
      />

      <div className="mx-auto mt-16 grid max-w-6xl gap-4 lg:grid-cols-3">
        {/* 1 — o zi de filmare */}
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
                O zi de filmare, 30+ materiale
              </h3>
              <p className="mt-2.5 text-[14.5px] leading-relaxed text-dim">
                Filmăm modular, pe blocuri. Din aceeași ieșire ies variante
                verticale, orizontale, scurte și lungi.
              </p>
            </div>
          </article>
        </Reveal>

        {/* 2 — testare hook-uri */}
        <Reveal delay={90} className="lg:col-span-2">
          <article className="glass bleed relative h-full overflow-hidden p-7">
            <div className="relative z-10 max-w-md">
              <h3 className="text-[19px] font-medium text-bone">
                Testăm mesaje, nu presupuneri
              </h3>
              <p className="mt-2.5 text-[14.5px] leading-relaxed text-dim">
                Același produs, patru unghiuri diferite. Publicul alege, nu
                părerea din ședință.
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
                  pentru omul care caută deja ce vinzi.
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

        {/* 4 — raport */}
        <Reveal delay={130}>
          <article className="glass bleed relative h-full overflow-hidden p-7">
            <div className="relative z-10">
              <h3 className="text-[19px] font-medium text-bone">
                Raport pe înțeles
              </h3>
              <p className="mt-2.5 text-[14.5px] leading-relaxed text-dim">
                Începe cu cereri și comenzi. Reach-ul e a treia coloană, nu
                prima.
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
    <section className="relative px-5 py-24 sm:px-6 lg:py-32">
      <SectionHead
        eyebrow="Ciclul lunar"
        title="Patru pași, repetați la nesfârșit"
        lead="Fiecare rotire folosește ce a învățat cea dinainte. De asta luna a treia costă la fel și livrează mai mult."
      />

      <ol className="relative mx-auto mt-16 grid max-w-6xl gap-4 md:grid-cols-2 lg:grid-cols-4">
        <span
          aria-hidden
          className="rule absolute inset-x-8 top-[46px] hidden lg:block"
        />
        {SYSTEM.map((s, i) => (
          <Reveal as="li" key={s.n} delay={i * 90} className="relative">
            <article className="glass lift h-full p-6">
              <span className="relative z-10 mb-6 flex size-11 items-center justify-center rounded-full border border-hair bg-ink font-md-mono text-[13px] text-a2">
                {s.n}
              </span>
              <h3 className="text-[18px] font-medium text-bone">{s.title}</h3>
              <p className="mt-1.5 text-[14px] text-a2">{s.lead}</p>
              <p className="mt-3.5 text-[14.5px] leading-relaxed text-dim">
                {s.body}
              </p>
              <ul className="mt-5 space-y-2 border-t border-hair pt-4">
                {s.outputs.map((o) => (
                  <li
                    key={o}
                    className="flex gap-2.5 text-[13.5px] text-dim"
                  >
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
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <div className="glass-2 edge-light relative overflow-hidden p-8 sm:p-12">
            <div
              aria-hidden
              className="aurora aurora-drift"
              style={{
                width: "70%",
                height: "120%",
                left: "50%",
                bottom: "-70%",
                translate: "-50% 0",
                background:
                  "radial-gradient(circle, color-mix(in oklab, var(--md-a1) 60%, transparent), transparent 62%)",
                opacity: 0.4,
              }}
            />
            <dl className="relative z-10 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
              {CAPABILITY_STATS.map((s) => (
                <div key={s.label}>
                  <dd className="display text-[clamp(2.2rem,5vw,3rem)] text-bone">
                    <CountUp to={s.value} suffix={s.suffix} />
                  </dd>
                  <dt className="mt-2 text-[14px] font-medium text-bone">
                    {s.label}
                  </dt>
                  <p className="mt-1 text-[13px] leading-relaxed text-dim">
                    {s.note}
                  </p>
                </div>
              ))}
            </dl>
          </div>
        </Reveal>

        <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_minmax(0,400px)]">
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
            Aici vor sta cuvintele
            <br />
            <span className="grad-text-soft">clienților noștri</span>
          </>
        }
        lead="Preferăm un spațiu gol sincer în locul unor citate inventate. Se completează pe măsură ce se închid primele campanii."
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
                  <a href={CONTACT.whatsapp} className="btn btn-primary !w-full">
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
            <a href={CONTACT.whatsapp} className="btn btn-ghost !min-h-10 !px-4 !py-2 !text-[13px]">
              <Icon name="whatsapp" size={15} />
              WhatsApp
            </a>
            <a href={CONTACT.phoneHref} className="btn btn-ghost !min-h-10 !px-4 !py-2 !text-[13px]">
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
          {CONTACT.isPlaceholder && " Datele de contact de pe această pagină sunt placeholder."}
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
