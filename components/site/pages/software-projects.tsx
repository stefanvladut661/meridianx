"use client";

import type { ComponentProps } from "react";
import { Link } from "@/i18n/navigation";
import { LEGAL_LINKS } from "@/components/site/legal-links";
import { Mark } from "@/components/site/mark";
import { Reveal } from "@/components/site/motion";
import { Icon } from "@/components/site/ui";
import { DEMOS, demoPoster } from "@/components/site/app-demos/registry";
import type { AppDemoMeta } from "@/components/site/app-demos/types";
import { SREVIEWS, SREVIEW_VIDEO } from "@/components/site/software-content";
import st from "./software-projects.module.css";

/* ============================================================
   Portofoliul de aplicații: cardurile care duc în demo-uri.

   Două folosiri:
   - `ProjectsGrid` — secțiunea de pe /software: primul proiect mare,
     restul în grilă de două. Scurt: nume, ce face, intră în demo.
   - `ProjectsList` — pagina /software/proiecte: fiecare proiect pe
     rândul lui, cu descrierea și funcțiile, alternând partea.

   Imaginea fiecărui card e o compoziție din capturile reale ale
   demo-ului (desktop + telefon), pe culoarea mărcii aplicației —
   fiecare proiect se recunoaște după propria identitate, nu după a
   noastră.
   ============================================================ */

function R(props: ComponentProps<typeof Reveal>) {
  return <Reveal {...props} className={`reveal-fast ${props.className ?? ""}`} />;
}

/**
 * Text în care cratima din interiorul cuvântului nu e loc de rupt
 * rândul: „s-a”, „într-o”, „dintr-un”. Browserul rupe după cratimă, iar
 * „s-” la capăt de rând cu „a” pe următorul se citește ca o greșeală —
 * mai ales în citatele mari, unde rândurile sunt scurte.
 */
export function Unbroken({ text }: { text: string }) {
  return text
    .split(/(\S+-\S+)/)
    .map((part, i) =>
      i % 2 ? (
        <span key={i} className="whitespace-nowrap">
          {part}
        </span>
      ) : (
        part
      )
    );
}

/** Capturile demo-ului, compuse: fereastra de desktop și telefonul peste ea. */
export function ProjectVisual({
  meta,
  eager = false,
  className = "",
}: {
  meta: AppDemoMeta;
  eager?: boolean;
  className?: string;
}) {
  const hasMobile = meta.devices.includes("mobile");
  return (
    <div
      className={`${st.visual} relative overflow-hidden rounded-panel-lg ${className}`}
      style={{ background: meta.brand.bg }}
    >
      <div
        aria-hidden
        className="absolute inset-0 opacity-60"
        style={{
          background: `radial-gradient(ellipse 70% 60% at 30% 0%, color-mix(in oklab, ${meta.brand.accent} 45%, transparent), transparent 70%)`,
        }}
      />
      <div className={`${st.desk} absolute left-[6%] top-[9%] w-[80%] overflow-hidden rounded-t-[10px] bg-white shadow-[0_30px_80px_-20px_rgba(0,0,0,0.55)]`}>
        <div className="flex h-[14px] items-center gap-[3px] bg-[#eef0f0] px-2" aria-hidden>
          <span className="size-[5px] rounded-full bg-[#ff5f57]" />
          <span className="size-[5px] rounded-full bg-[#febc2e]" />
          <span className="size-[5px] rounded-full bg-[#28c840]" />
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element -- captură deja
            generată în WebP la mărimea potrivită (scripts/demo-posters.mjs) */}
        <img
          src={demoPoster(meta.slug, "desktop")}
          alt={`${meta.name}, varianta de desktop`}
          width={1280}
          height={800}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          className="block aspect-[16/10] w-full object-cover object-top"
        />
      </div>
      {hasMobile && (
        <div className={`${st.phone} absolute bottom-[-14%] right-[5%] w-[23%] rounded-[16%/7.5%] bg-[#0c0d0f] p-[1.6%] shadow-[0_24px_60px_-12px_rgba(0,0,0,0.6)]`}>
          {/* eslint-disable-next-line @next/next/no-img-element -- idem */}
          <img
            src={demoPoster(meta.slug, "mobile")}
            alt={`${meta.name}, varianta de telefon`}
            width={390}
            height={844}
            loading={eager ? "eager" : "lazy"}
            decoding="async"
            className="block aspect-[390/844] w-full rounded-[13%/6%] object-cover object-top"
          />
        </div>
      )}
      <span className="absolute left-3 top-3 z-10 flex items-center gap-1.5 rounded-full bg-black/55 px-2.5 py-1 font-md-mono text-[10.5px] uppercase tracking-[0.14em] text-white backdrop-blur-sm">
        <span className={`${st.live} size-1.5 rounded-full bg-[#4ade80]`} aria-hidden />
        Demo interactiv
      </span>
    </div>
  );
}

/* ---------------- Secțiunea de pe /software ---------------- */
export function ProjectsGrid() {
  const [first, ...rest] = DEMOS;
  return (
    <div className="mx-auto mt-12 grid max-w-6xl gap-4 sm:mt-16 md:grid-cols-2 lg:gap-5">
      <R className="md:col-span-2">
        <ProjectCard meta={first} featured eager />
      </R>
      {rest.map((m, i) => (
        <R key={m.slug} delay={(i % 2) * 70}>
          <ProjectCard meta={m} />
        </R>
      ))}
    </div>
  );
}

function ProjectCard({
  meta,
  featured = false,
  eager = false,
}: {
  meta: AppDemoMeta;
  featured?: boolean;
  eager?: boolean;
}) {
  return (
    <Link
      href={`/software/proiecte/${meta.slug}`}
      className={`${st.card} group grid h-full overflow-hidden rounded-panel-lg border border-hair bg-char transition-colors duration-200 hover:border-hair-strong ${
        featured ? "lg:grid-cols-[1.35fr_1fr]" : ""
      }`}
    >
      <ProjectVisual
        meta={meta}
        eager={eager}
        className={`aspect-[16/11] !rounded-none ${featured ? "lg:aspect-auto lg:min-h-[380px]" : ""}`}
      />
      <div className={`flex flex-col p-5 sm:p-6 ${featured ? "lg:justify-center lg:p-10" : ""}`}>
        <p className="font-md-mono text-[11px] uppercase tracking-[0.16em] text-dim">
          {meta.kind}
        </p>
        <h3
          className={`display mt-2 ${
            featured ? "text-[clamp(1.6rem,3vw,2.3rem)]" : "text-[clamp(1.35rem,2.2vw,1.6rem)]"
          }`}
        >
          {meta.name}
        </h3>
        <p className="mt-1 text-[13.5px] text-dim">{meta.client}</p>
        <p className={`mt-3 leading-relaxed text-bone/90 ${featured ? "text-[16px]" : "text-[14.5px]"}`}>
          {meta.headline}
        </p>
        {featured && (
          <ul className="mt-5 hidden flex-wrap gap-2 sm:flex">
            {meta.features.slice(0, 4).map((f) => (
              <li key={f} className="rounded-panel-sm border border-hair px-2.5 py-1 text-[12.5px] text-dim">
                {f}
              </li>
            ))}
          </ul>
        )}
        <span className="mt-5 inline-flex items-center gap-2 text-[14.5px] font-medium text-a1">
          Încearcă demo-ul
          <Icon name="arrowRight" size={15} className="transition-transform duration-200 group-hover:translate-x-1" />
        </span>
      </div>
    </Link>
  );
}

/* ---------------- Pagina /software/proiecte ----------------
   Bara de sus e proprie, ca la portofoliul video: meniul de pe
   /software e făcut din ancore către secțiuni care aici nu există. */
export function ProjectsIndexScreen() {
  return (
    <div data-scope="software" className="md-root min-h-dvh overflow-clip">
      <header className="sticky top-0 z-50 border-b border-hair bg-ink/85 backdrop-blur-xl">
        <nav
          className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-5 sm:px-6"
          aria-label="Principal"
        >
          <Link href="/software" className="flex items-center gap-2.5 text-bone">
            <Mark size={24} />
            <span className="flex items-baseline gap-1.5">
              <span className="font-md-display text-[15px] font-bold tracking-tight">MERIDIAN</span>
              <span className="hidden font-md-mono text-[11px] tracking-widest text-dim sm:inline">
                SOFTWARE
              </span>
            </span>
          </Link>
          <Link
            href="/software"
            className="ml-auto flex items-center gap-2 text-[13.5px] text-dim transition-colors hover:text-bone"
          >
            <Icon name="arrowRight" size={15} className="rotate-180" />
            <span className="hidden sm:inline">Înapoi la divizie</span>
            <span className="sm:hidden">Înapoi</span>
          </Link>
          <Link
            href="/software#configurator"
            className="btn btn-primary !min-h-10 !rounded-panel-sm !px-4 !py-2 !text-[13px]"
          >
            Consultanță
          </Link>
        </nav>
      </header>

      <main id="continut">
        <section className="relative px-5 pb-10 pt-16 sm:px-6 lg:pt-24">
          <div aria-hidden className="techgrid pointer-events-none absolute inset-0" />
          <R className="relative mx-auto max-w-3xl text-center">
            <p className="eyebrow mb-4 flex items-center justify-center gap-2">
              <span className="node-dot" aria-hidden />
              Proiecte
            </p>
            <h1 className="display text-[clamp(2.2rem,6vw,4rem)]">Aplicații livrate. Încearcă-le.</h1>
            <p className="mx-auto mt-5 max-w-xl text-[16.5px] leading-relaxed text-dim">
              Fiecare proiect are un demo pe care îl poți folosi, pe desktop și pe
              telefon. Datele din demo sunt inventate; aplicațiile sunt reale.
            </p>
          </R>
        </section>

        <section className="px-5 pb-20 pt-8 sm:px-6 lg:pb-28">
          <ProjectsList />
        </section>

        <section className="px-5 pb-24 sm:px-6">
          <R className="mx-auto max-w-6xl">
            <div className="glass-2 edge-light flex flex-col items-start gap-5 p-6 sm:p-8 lg:flex-row lg:items-center lg:justify-between">
              <h2 className="display text-[clamp(1.4rem,2.8vw,1.9rem)]">
                Următoarea aplicație poate fi a ta.
              </h2>
              <Link href="/software#configurator" className="btn btn-primary shrink-0 !rounded-panel-sm !px-7">
                <Icon name="calendar" size={17} />
                Programează consultanța gratuită
              </Link>
            </div>
          </R>
        </section>
      </main>

      <footer className="border-t border-hair">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-8 gap-y-3 px-5 py-6 text-[13px] text-dim sm:px-6">
          <span>© 2026 MERIDIAN.</span>
          <nav aria-label="Documente legale">
            <ul className="flex flex-wrap gap-x-5 gap-y-1">
              {LEGAL_LINKS.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="transition-colors hover:text-bone">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </footer>
    </div>
  );
}

export function ProjectsList() {
  return (
    <ol className="mx-auto grid max-w-6xl gap-16 sm:gap-24">
      {DEMOS.map((m, i) => {
        const flip = i % 2 === 1;
        /* Clientul care a spus ceva despre proiect își are citatul chiar
           lângă el; recenzia întreagă, cu clipul, stă pe /software. */
        const review = SREVIEWS.find((r) => r.project === m.slug);
        return (
          <li key={m.slug}>
            <R>
              <article className="grid items-center gap-7 lg:grid-cols-[1.25fr_1fr] lg:gap-12">
                <Link
                  href={`/software/proiecte/${m.slug}`}
                  className={`${st.card} block ${flip ? "lg:order-2" : ""}`}
                  aria-label={`Deschide demo-ul ${m.name}`}
                >
                  <ProjectVisual meta={m} eager={i === 0} className="aspect-[16/11]" />
                </Link>
                <div>
                  <p className="font-md-mono text-[11px] uppercase tracking-[0.16em] text-dim">
                    {m.kind}
                  </p>
                  <h2 className="display mt-2 text-[clamp(1.7rem,3.4vw,2.4rem)]">{m.name}</h2>
                  <p className="mt-1 text-[14px] text-dim">{m.client}</p>
                  <p className="mt-4 text-[16.5px] leading-relaxed text-bone">{m.headline}</p>
                  <p className="mt-3 text-[15px] leading-relaxed text-dim">{m.summary}</p>
                  <ul className="mt-5 grid gap-2 sm:grid-cols-2">
                    {m.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-[14px] text-bone">
                        <Icon name="check" size={15} className="mt-0.5 shrink-0 text-a1" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  {review && (
                    <figure className="mt-6 rounded-panel-sm border border-hair bg-white/[0.03] p-4 sm:p-5">
                      <blockquote className="text-[15px] leading-relaxed text-bone">
                        „<Unbroken text={review.quote} />”
                      </blockquote>
                      <figcaption className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-dim">
                        <span>{review.who}</span>
                        <Link
                          href="/software#recenzii"
                          className="inline-flex items-center gap-1.5 font-medium text-a1 transition-colors hover:text-bone"
                        >
                          {SREVIEW_VIDEO ? "Vezi recenzia filmată" : "Toate recenziile"}
                          <Icon name="arrowRight" size={13} />
                        </Link>
                      </figcaption>
                    </figure>
                  )}
                  <Link
                    href={`/software/proiecte/${m.slug}`}
                    className="btn btn-primary mt-7 !rounded-panel-sm !px-6"
                  >
                    Încearcă demo-ul
                    <Icon name="arrowRight" size={16} />
                  </Link>
                </div>
              </article>
            </R>
          </li>
        );
      })}
    </ol>
  );
}
