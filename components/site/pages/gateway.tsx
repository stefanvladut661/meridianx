"use client";

import { Link } from "@/i18n/navigation";
import { Mark } from "@/components/site/mark";
import { LEGAL_LINKS } from "@/components/site/legal-links";
import { MeridianSoftware, MeridianVideo } from "@/components/site/meridian";
import { Reveal } from "@/components/site/motion";
import { Icon } from "@/components/site/ui";
import { CONTACT } from "@/components/site/video-content";
import { SCONTACT } from "@/components/site/software-content";

/* ============================================================
   POARTA — pagina intermediară, rădăcina site-ului.

   Singura pagină în care cele două lumi apar împreună. Regula din
   CLAUDE.md §2 rămâne: nu se amestecă. Aici se ating, atât — fiecare
   jumătate poartă propriul [data-scope], deci propria paletă, propriile
   raze de colț și propriul temperament. Shell-ul (bara, banda de jos,
   footer-ul) e neutru intenționat, ca să nu concureze cu niciuna.

   Firul comun e arcul de meridian: același traseu în ambele jumătăți,
   tratat diferit — lumină care circulă la video, geodezică desenată pe
   grilă la software. Cele două arcuri se întâlnesc exact la cusătură,
   unde stă marca.

   Decizia trebuie luată în trei secunde, deci nu există nimic de citit
   înainte de alegere. Argumentele stau sub fold, pentru cine ezită.
   ============================================================ */

export function GatewayScreen() {

  return (
    <div data-scope="gate" className="md-root min-h-dvh overflow-clip">
      <TopBar />

      <main id="continut">
        <div className="gate-split flex min-h-dvh flex-col lg:flex-row">
          <VideoHalf />
          <Seam />
          <SoftwareHalf />
        </div>

        <Band />
      </main>

      <Foot />
    </div>
  );
}

/* ---------------- Bara de sus ---------------- */
function TopBar() {
  return (
    <header className="absolute inset-x-0 top-0 z-30">
      <div className="mx-auto flex h-16 max-w-[1500px] items-center gap-4 px-5 sm:px-8">
        <Link href="/" className="flex items-center gap-2.5 text-bone">
          <Mark size={24} />
          <span className="font-md-display text-[15px] font-semibold tracking-[0.2em]">
            MERIDIAN
          </span>
        </Link>

        <span className="ml-auto hidden items-center gap-6 md:flex">
          <span className="font-md-mono text-[11px] uppercase tracking-[0.18em] text-dim">
            Video &amp; Software
          </span>
          <a
            href={CONTACT.phoneHref}
            className="flex items-center gap-2 text-[13.5px] text-dim transition-colors hover:text-bone"
          >
            <Icon name="phone" size={15} />
            {CONTACT.phone}
          </a>
        </span>

        <a
          href="#amandoua"
          className="btn btn-ghost ml-auto !min-h-9 !px-4 !py-2 !text-[12.5px] md:ml-0"
        >
          Nu știu ce îmi trebuie
        </a>
      </div>
    </header>
  );
}

/* ---------------- Cusătura ---------------- */
function Seam() {
  return (
    <div
      className="relative z-20 h-px w-full shrink-0 lg:h-auto lg:w-px"
      aria-hidden
    >
      <span
        className="absolute inset-0 block"
        style={{
          background:
            "linear-gradient(to right, transparent, rgb(255 255 255 / 0.22), transparent)",
        }}
      />
      <span
        className="absolute inset-0 hidden lg:block"
        style={{
          background:
            "linear-gradient(to bottom, transparent, rgb(255 255 255 / 0.22) 20%, rgb(255 255 255 / 0.22) 80%, transparent)",
        }}
      />
      <span className="absolute left-1/2 top-1/2 flex size-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-hair bg-ink text-bone">
        <Mark size={22} />
      </span>
    </div>
  );
}

/* ---------------- Jumătatea VIDEO ---------------- */
function VideoHalf() {
  return (
    <Link
      href="/video"
      data-scope="video"
      className="gate-half group relative flex min-h-[46dvh] flex-1 items-center overflow-hidden bg-ink px-5 py-14 text-bone sm:px-8 sm:py-20 lg:min-h-0 lg:py-24"
    >
      <div
        aria-hidden
        className="aurora aurora-drift"
        style={{
          width: "min(85vw, 620px)",
          height: "min(85vw, 620px)",
          right: "-14%",
          top: "-12%",
          background:
            "radial-gradient(circle, color-mix(in oklab, var(--md-a1) 62%, transparent), transparent 62%)",
          opacity: 0.42,
        }}
      />
      <MeridianVideo
        className="pointer-events-none absolute top-1/2 right-[-22%] w-[min(78vw,560px)] -translate-y-1/2 text-bone opacity-70 transition-transform duration-700 group-hover:translate-x-[-3%] lg:right-[-16%]"
      />
      <div className="grain absolute inset-0" aria-hidden />

      <div className="relative z-10 ml-auto w-full max-w-lg lg:mr-[6%]">
        <Reveal>
          <p className="eyebrow flex items-center gap-2.5">
            <span className="rec-dot" aria-hidden />
            Divizia 01
          </p>
        </Reveal>

        <Reveal delay={80}>
          <h2 className="display mt-6 text-[clamp(2.4rem,5.6vw,4.2rem)]">
            VIDEO
          </h2>
          <p className="mt-3 text-[clamp(1.05rem,2vw,1.35rem)] leading-snug text-a2">
            Conținut care aduce clienți, nu vizualizări.
          </p>
        </Reveal>

        <Reveal delay={150}>
          <p className="mt-6 max-w-md text-[15.5px] leading-relaxed text-dim">
            Filmăm, montăm și distribuim pe Meta, TikTok și Google. Pentru
            afaceri care trăiesc din clienți care revin.
          </p>
        </Reveal>

        <Reveal delay={210}>
          <ul className="mt-7 hidden flex-wrap gap-2 sm:flex">
            {["HORECA", "Imobiliare", "Wellness", "Auto", "eCommerce"].map(
              (t) => (
                <li
                  key={t}
                  className="rounded-full border border-hair px-3 py-1.5 text-[12.5px] text-dim"
                >
                  {t}
                </li>
              )
            )}
          </ul>
        </Reveal>

        <Reveal delay={270}>
          <span className="btn btn-primary mt-9">
            Intră în video
            <Icon name="arrowRight" size={17} className="arw" />
          </span>
          <p className="mt-5 font-md-mono text-[11px] tracking-[0.14em] text-dim">
            00:00:12:04 · 24 FPS
          </p>
        </Reveal>
      </div>
    </Link>
  );
}

/* ---------------- Jumătatea SOFTWARE ---------------- */
function SoftwareHalf() {
  return (
    <Link
      href="/software"
      data-scope="software"
      className="gate-half group relative flex min-h-[46dvh] flex-1 items-center overflow-hidden bg-ink px-5 py-14 text-bone sm:px-8 sm:py-20 lg:min-h-0 lg:py-24"
    >
      <div
        aria-hidden
        className="aurora aurora-drift-2"
        style={{
          width: "min(85vw, 620px)",
          height: "min(85vw, 620px)",
          left: "-14%",
          bottom: "-12%",
          background:
            "radial-gradient(circle, color-mix(in oklab, var(--md-a1) 55%, transparent), transparent 62%)",
          opacity: "var(--md-glow-o, 0.4)",
        }}
      />
      <div
        aria-hidden
        className="blueprint pointer-events-none absolute inset-0 opacity-80"
      />
      <Reveal
        variant="scale"
        className="pointer-events-none absolute top-1/2 left-[-22%] w-[min(78vw,560px)] -translate-y-1/2 text-bone transition-transform duration-700 group-hover:translate-x-[3%] lg:left-[-16%]"
      >
        <MeridianSoftware className="w-full opacity-80" />
      </Reveal>

      <div className="relative z-10 mr-auto w-full max-w-lg lg:ml-[6%]">
        <Reveal>
          <p className="eyebrow flex items-center gap-2.5">
            <span className="node-dot" aria-hidden />
            Divizia 02
          </p>
        </Reveal>

        <Reveal delay={80}>
          <h2 className="display mt-6 text-[clamp(2.4rem,5.6vw,4.2rem)]">
            SOFTWARE
          </h2>
          <p className="mt-3 text-[clamp(1.05rem,2vw,1.35rem)] leading-snug text-a2">
            Infrastructură care chiar se folosește.
          </p>
        </Reveal>

        <Reveal delay={150}>
          <p className="mt-6 max-w-md text-[15.5px] leading-relaxed text-dim">
            Aplicații la comandă, dashboard-uri, fidelizare, SaaS și mobil.
            Pentru firme care digitalizează cu finanțare și cu termen.
          </p>
        </Reveal>

        <Reveal delay={210}>
          <ul className="mt-7 hidden flex-wrap gap-2 sm:flex">
            {[
              "Aplicații de business",
              "Dashboard-uri",
              "Fidelizare",
              "Mobil",
              "SaaS",
            ].map((t) => (
              <li
                key={t}
                className="rounded-panel-sm border border-hair px-3 py-1.5 text-[12.5px] text-dim"
              >
                {t}
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal delay={270}>
          <span className="btn btn-primary mt-9 !rounded-panel-sm">
            Intră în software
            <Icon name="arrowRight" size={17} className="arw" />
          </span>
          <p className="mt-5 font-md-mono text-[11px] tracking-[0.14em] text-dim">
            44°26′N 26°06′E · BUCUREȘTI
          </p>
        </Reveal>
      </div>
    </Link>
  );
}

/* ---------------- Banda de sub fold ---------------- */
const POINTS = [
  {
    title: "Un singur punct de contact",
    body: "Vorbești cu aceiași oameni, indiferent de divizie. În spate lucrează două echipe diferite, pentru că un editor bun nu e și un arhitect de software bun.",
  },
  {
    title: "Nu amestecăm",
    body: "Video optimizează pentru impact, software pentru încredere. Sunt două meserii cu reguli opuse, iar noi refuzăm să le tratăm la fel doar ca să pară consecvent.",
  },
  {
    title: "Se ajută reciproc",
    body: "O campanie video are nevoie de o pagină care nu pierde omul la final. Un magazin nou are nevoie de material care să-l pornească. De obicei al doilea proiect vine din primul.",
  },
];

function Band() {
  return (
    <section
      id="amandoua"
      className="relative border-t border-hair px-5 py-20 sm:px-8 lg:py-28"
    >
      <div className="mx-auto max-w-[1500px]">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,380px)_1fr] lg:gap-20">
          <Reveal>
            <p className="eyebrow mb-5">O agenție, două echipe</p>
            <h2 className="display text-[clamp(1.9rem,4.4vw,2.9rem)]">
              De ce nu suntem
              <br />
              o singură divizie
            </h2>
            <p className="mt-5 text-[16px] leading-relaxed text-dim">
              Pentru că ar fi o minciună comodă. Sunt două feluri diferite de a
              cumpăra, două ritmuri și doi oameni diferiți care semnează.
            </p>
          </Reveal>

          <ul className="grid gap-3 sm:grid-cols-3">
            {POINTS.map((p, i) => (
              <Reveal as="li" key={p.title} delay={i * 70}>
                <article className="glass lift h-full p-6">
                  <span className="font-md-mono text-[12px] text-dim">
                    0{i + 1}
                  </span>
                  <h3 className="mt-4 text-[16.5px] font-medium leading-snug text-bone">
                    {p.title}
                  </h3>
                  <p className="mt-3 text-[14.5px] leading-relaxed text-dim">
                    {p.body}
                  </p>
                </article>
              </Reveal>
            ))}
          </ul>
        </div>

        <Reveal delay={120} className="mt-4">
          <div className="glass-2 edge-light relative overflow-hidden p-7 sm:p-9">
            <div className="relative z-10 flex flex-wrap items-center gap-x-10 gap-y-6">
              <div className="min-w-[260px] flex-1">
                <h3 className="display text-[clamp(1.4rem,3vw,1.9rem)]">
                  Tot nu știi în ce parte să mergi?
                </h3>
                <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-dim">
                  Sună și spune-ne ce încerci să rezolvi. În cinci minute îți
                  spunem dacă e o problemă de vizibilitate sau una de proces —
                  și dacă răspunsul e „niciuna dintre ele”, îți spunem și asta.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <a href={CONTACT.phoneHref} className="btn btn-primary">
                  <Icon name="phone" size={16} />
                  {CONTACT.phone}
                </a>
                <a href={CONTACT.whatsapp} className="btn btn-ghost">
                  <Icon name="whatsapp" size={16} />
                  WhatsApp
                </a>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ---------------- Footer ---------------- */
function Foot() {
  return (
    <footer className="relative overflow-hidden border-t border-hair">
      <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-x-10 gap-y-5 px-5 py-8 sm:px-8">
        <span className="flex items-center gap-2.5 text-bone">
          <Mark size={22} />
          <span className="font-md-display text-[14px] font-semibold tracking-[0.2em]">
            MERIDIAN
          </span>
        </span>

        <nav aria-label="Divizii" className="flex gap-5">
          <Link
            href="/video"
            className="text-[14px] text-dim transition-colors hover:text-bone"
          >
            Video
          </Link>
          <Link
            href="/software"
            className="text-[14px] text-dim transition-colors hover:text-bone"
          >
            Software
          </Link>
        </nav>

        <span className="ml-auto flex flex-wrap gap-x-6 gap-y-2">
          <a
            href={`mailto:${CONTACT.email}`}
            className="text-[13.5px] text-dim transition-colors hover:text-bone"
          >
            {CONTACT.email}
          </a>
          <a
            href={`mailto:${SCONTACT.email}`}
            className="text-[13.5px] text-dim transition-colors hover:text-bone"
          >
            {SCONTACT.email}
          </a>
        </span>
      </div>

      <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-x-8 gap-y-3 border-t border-hair px-5 py-5 text-[12.5px] text-dim sm:px-8">
        <span>
          © 2026 MERIDIAN.
          {(CONTACT.isPlaceholder || SCONTACT.isPlaceholder) && " Datele de contact de pe această pagină sunt placeholder."}
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
    </footer>
  );
}
