"use client";

import { Link } from "@/i18n/navigation";
import { LEGAL_LINKS } from "@/components/site/legal-links";
import { Mark } from "@/components/site/mark";
import { Icon } from "@/components/site/ui";
import { DEMOS, demoPoster } from "@/components/site/app-demos/registry";
import type { AppDemoMeta } from "@/components/site/app-demos/types";
import { SREVIEWS, SREVIEW_VIDEO } from "@/components/site/software-content";
import st from "./software-projects.module.css";

/* ============================================================
   Portofoliul de aplicații: cardurile care duc în demo-uri.

   Două folosiri:
   - `ProjectsGrid`: secțiunea de pe /software. Primul proiect mare,
     restul în grilă de două. Nume, client, ce face, intră în demo.
   - `ProjectsList`: pagina /software/proiecte. Fiecare proiect pe
     rândul lui, cu descrierea scurtă și dovada lui, dacă are.

   Imaginea fiecărui card e captura demo-ului, pe o scenă neutră,
   aceeași pentru toate: proiectul se recunoaște după propriul ecran.
   ============================================================ */

/**
 * Text în care cratima din interiorul cuvântului nu e loc de rupt
 * rândul: „s-a”, „într-o”, „dintr-un”. Browserul rupe după cratimă, iar
 * „s-” la capăt de rând cu „a” pe următorul se citește ca o greșeală,
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

/** „5 aplicații”, „20 de aplicații”: în română, de la 20 în sus vine „de”. */
function countRo(n: number, word: string) {
  const r = n % 100;
  return r === 0 || r >= 20 ? `${n} de ${word}` : `${n} ${word}`;
}

/**
 * Produsul are o față separată pe telefon (aplicația clientului, a
 * membrului) dacă turul are pași marcați pentru telefon. Atunci captura
 * de telefon arată fața aceea (vezi `posterScreen` în viewer.tsx) și
 * cardul o pune lângă captura de desktop.
 */
function hasPhoneFace(meta: AppDemoMeta) {
  return meta.devices.includes("mobile") && meta.tour.some((t) => t.device === "mobile");
}

/** Capturile demo-ului: desktopul și, unde e o față de telefon, telefonul. */
export function ProjectVisual({
  meta,
  eager = false,
  className = "",
}: {
  meta: AppDemoMeta;
  eager?: boolean;
  className?: string;
}) {
  const mobile = meta.devices.includes("mobile");
  const phone = hasPhoneFace(meta);
  return (
    <div className={`${st.visual} ${phone ? st.withPhone : ""} ${className}`}>
      <div className={st.shot}>
        <picture>
          {mobile && <source media="(max-width: 639.98px)" srcSet={demoPoster(meta.slug, "mobile")} />}
          {/* eslint-disable-next-line @next/next/no-img-element -- captură deja
              generată în WebP la mărimea potrivită (scripts/demo-posters.mjs) */}
          <img
            src={demoPoster(meta.slug, "desktop")}
            alt={`Ecran din demo-ul ${meta.name}`}
            width={1280}
            height={800}
            loading={eager ? "eager" : "lazy"}
            fetchPriority={eager ? "high" : undefined}
            decoding="async"
            className={st.img}
          />
        </picture>
      </div>
      {phone && (
        <div className={st.phone}>
          <div className={st.screen}>
            {/* eslint-disable-next-line @next/next/no-img-element -- idem */}
            <img
              src={demoPoster(meta.slug, "mobile")}
              alt={`${meta.name} pe telefon`}
              width={390}
              height={844}
              loading="lazy"
              decoding="async"
              className={st.img}
            />
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- Secțiunea de pe /software ---------------- */
export function ProjectsGrid() {
  const [first, ...rest] = DEMOS;
  return (
    <div className="mx-auto mt-12 grid max-w-6xl gap-4 sm:mt-16 md:grid-cols-2 lg:gap-5">
      <div className="md:col-span-2">
        <ProjectCard meta={first} featured />
      </div>
      {rest.map((m) => (
        <ProjectCard key={m.slug} meta={m} />
      ))}
    </div>
  );
}

function ProjectCard({ meta, featured = false }: { meta: AppDemoMeta; featured?: boolean }) {
  return (
    <article
      className={`${st.card} group relative grid h-full overflow-hidden rounded-panel border border-hair bg-char transition-colors duration-200 hover:border-hair-strong ${
        featured ? "lg:grid-cols-[1.35fr_1fr]" : ""
      }`}
    >
      <ProjectVisual meta={meta} />
      <div className={`flex flex-col p-5 sm:p-6 ${featured ? "lg:justify-center lg:p-10" : ""}`}>
        <h3
          className={`display ${
            featured ? "text-[clamp(1.6rem,2.8vw,2.15rem)]" : "text-[clamp(1.3rem,2vw,1.5rem)]"
          }`}
        >
          <Link
            href={`/software/proiecte/${meta.slug}`}
            className={`${st.cardLink} after:absolute after:inset-0 after:content-['']`}
          >
            {meta.name}
          </Link>
        </h3>
        <p className="mt-1.5 text-[13px] text-dim">{meta.client}</p>
        <p className={`mt-3 leading-relaxed text-bone/85 ${featured ? "text-[16px]" : "text-[14.5px]"}`}>
          {meta.headline}
        </p>
        <span
          aria-hidden
          className="mt-5 inline-flex items-center gap-1.5 text-[14px] font-medium text-a1 underline-offset-4 group-hover:underline"
        >
          Încearcă demo-ul
          <Icon name="arrowRight" size={15} />
        </span>
      </div>
    </article>
  );
}

/* ---------------- Pagina /software/proiecte ----------------
   Bara de sus e proprie, ca la portofoliul video: meniul de pe
   /software e făcut din ancore către secțiuni care aici nu există. */
export function ProjectsIndexScreen() {
  return (
    <div data-scope="software" className="md-root min-h-dvh overflow-clip">
      <header className="sticky top-0 z-50 border-b border-hair bg-ink">
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
            className="ml-auto flex items-center gap-2 text-[13.5px] text-dim transition-colors duration-150 hover:text-bone"
          >
            <Icon name="arrowRight" size={15} className="rotate-180" />
            <span className="hidden sm:inline">Înapoi la Software</span>
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
        <section className="px-5 pb-10 pt-12 sm:px-6 sm:pt-16 lg:pb-14 lg:pt-20">
          <div className="mx-auto max-w-6xl">
            <h1 className="display text-[clamp(2.3rem,5vw,3.4rem)]">Proiecte</h1>
            <p className="mt-3 text-[15px] text-dim">
              {countRo(DEMOS.length, "aplicații")} · cifrele din demo-uri sunt inventate
            </p>
          </div>
        </section>

        <section className="px-5 pb-20 sm:px-6 lg:pb-28">
          <ProjectsList />
        </section>

        <section className="px-5 pb-20 sm:px-6 lg:pb-24">
          <div className="mx-auto flex max-w-6xl flex-col items-start gap-5 rounded-panel border border-hair bg-char p-6 sm:p-8 md:flex-row md:items-center md:justify-between">
            <h2 className="text-[clamp(1.3rem,2.4vw,1.6rem)] font-semibold leading-tight tracking-[-0.02em]">
              Consultanță gratuită, 30 de minute
            </h2>
            <Link href="/software#configurator" className="btn btn-primary shrink-0 !rounded-panel-sm !px-6">
              <Icon name="calendar" size={17} />
              Programează consultanța
            </Link>
          </div>
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

/* Fiecare rând: captura (în stânga, la toate, ca ochiul să coboare pe o
   singură linie), numele, clientul, descrierea și demo-ul. Ce are în
   plus un proiect e dovada lui reală: citatul clientului, site-ul live. */
export function ProjectsList() {
  return (
    <ol className="mx-auto grid max-w-6xl gap-14 sm:gap-20">
      {DEMOS.map((m, i) => {
        /* Clientul care a spus ceva despre proiect își are citatul chiar
           lângă el; recenzia întreagă, cu clipul, stă pe /software. */
        const review = SREVIEWS.find((r) => r.project === m.slug);
        return (
          <li key={m.slug}>
            <article className="grid items-center gap-6 lg:grid-cols-[1.2fr_1fr] lg:gap-14">
              {/* Scurtătură pentru mouse; din tastatură și pentru cititoare
                  de ecran, drumul e butonul „Încearcă demo-ul”. */}
              <Link
                href={`/software/proiecte/${m.slug}`}
                tabIndex={-1}
                aria-hidden
                className={`${st.card} block overflow-hidden rounded-panel border border-hair transition-colors duration-200 hover:border-hair-strong`}
              >
                <ProjectVisual meta={m} eager={i === 0} />
              </Link>
              <div className="max-w-xl">
                <h2 className="display text-[clamp(1.6rem,3vw,2.2rem)]">{m.name}</h2>
                <p className="mt-1.5 text-[14px] text-dim">{m.client}</p>
                <p className="mt-4 text-[15.5px] leading-relaxed text-bone/85">{m.summary}</p>
                {review && (
                  <figure className="mt-6 rounded-panel border border-hair bg-char p-5">
                    <blockquote className="text-[15px] leading-relaxed text-bone">
                      „<Unbroken text={review.quote} />”
                    </blockquote>
                    <figcaption className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-dim">
                      <span>{review.who}</span>
                      <Link
                        href="/software#recenzii"
                        className="inline-flex items-center gap-1.5 font-medium text-a1 underline-offset-4 hover:underline"
                      >
                        {SREVIEW_VIDEO ? "Vezi recenzia filmată" : "Toate recenziile"}
                        <Icon name="arrowRight" size={13} />
                      </Link>
                    </figcaption>
                  </figure>
                )}
                <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
                  <Link
                    href={`/software/proiecte/${m.slug}`}
                    className="btn btn-primary !min-h-11 !rounded-panel-sm !px-5 !text-[14px]"
                  >
                    Încearcă demo-ul
                    <Icon name="arrowRight" size={16} />
                  </Link>
                  {m.host && (
                    <a
                      href={`https://${m.host}`}
                      target="_blank"
                      rel="noopener"
                      className="inline-flex items-center gap-1 text-[14px] text-dim underline decoration-hair-strong underline-offset-4 transition-colors duration-150 hover:text-bone hover:decoration-current"
                    >
                      {m.host}
                      <Icon name="arrow" size={13} />
                      <span className="sr-only"> (se deschide într-o filă nouă)</span>
                    </a>
                  )}
                </div>
              </div>
            </article>
          </li>
        );
      })}
    </ol>
  );
}
