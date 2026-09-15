"use client";

import { Link } from "@/i18n/navigation";
import { Mark } from "@/components/site/mark";
import { LEGAL_LINKS } from "@/components/site/legal-links";
import { Reveal, ScrollProgress } from "@/components/site/motion";
import { Icon } from "@/components/site/ui";
import { VideoCard } from "@/components/site/video-player";
import {
  PHOTOS,
  VIDEOS,
  groupByClient,
  photoSrc,
  photoSrcSet,
  type PortfolioPhoto,
} from "@/components/site/portfolio-content";
import { CONTACT } from "@/components/site/video-content";

/* ============================================================
   PORTOFOLIU — toate materialele, împărțite pe client.

   Nu pe tip de material și nu pe industrie: cine deschide un
   portofoliu vrea să vadă ce am făcut PENTRU CINEVA, cap-coadă. Un
   restaurant cu două filmări și nouă fotografii spune mai mult despre
   felul în care lucrăm decât aceleași materiale împrăștiate într-o
   galerie de video și una de poze.

   Bara de sus e proprie, nu cea de pe /video: acolo linkurile sunt
   ancore către secțiuni care aici nu există, iar un meniu care duce
   în gol e mai rău decât un meniu scurt.
   ============================================================ */

function Nav() {
  return (
    <header className="sticky top-0 z-50 border-b border-hair bg-ink/85 backdrop-blur-xl">
      <nav
        className="ws-inset-right mx-auto flex h-16 max-w-6xl items-center gap-4 px-5 sm:px-6"
        aria-label="Principal"
      >
        <Link href="/video" className="flex items-center gap-2.5 text-bone">
          <Mark size={24} />
          <span className="flex items-baseline gap-1.5">
            <span className="font-md-display text-[15px] font-bold tracking-tight">
              MERIDIAN
            </span>
            <span className="font-md-mono text-[11px] tracking-widest text-dim">
              VIDEO
            </span>
          </span>
        </Link>

        <Link
          href="/video"
          className="ml-auto flex items-center gap-2 text-[13.5px] text-dim transition-colors hover:text-bone"
        >
          <Icon name="arrowRight" size={15} className="rotate-180" />
          Înapoi la divizie
        </Link>

        <a
          href={CONTACT.phoneHref}
          className="btn btn-primary !min-h-10 !rounded-panel-sm !px-4 !py-2 !text-[13px]"
        >
          <Icon name="phone" size={15} />
          <span className="hidden sm:inline">{CONTACT.phone}</span>
          <span className="sm:hidden">Sună</span>
        </a>
      </nav>
    </header>
  );
}

/* Grila cere o singura silueta. 14 din 20 de fotografii sunt deja 4:5,
   deci ala e formatul comun: cele mai inalte (2:3) se decupeaza centrat,
   egal sus si jos, iar patratele pierd cate putin din laterale. Fisierul
   ramane intreg — decupajul e doar incadrare, prin object-cover. */
const PHOTO_RATIO = "4 / 5";

function Photo({ photo }: { photo: PortfolioPhoto }) {
  return (
    <figure
      className="overflow-hidden rounded-panel-lg border border-hair bg-char"
      style={{ aspectRatio: PHOTO_RATIO }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- variantele
          responsive sunt deja generate în WebP de scripts/portfolio-build.mjs;
          optimizatorul lui Next ar reface aceeași muncă la fiecare deploy. */}
      <img
        src={photoSrc(photo)}
        srcSet={photoSrcSet(photo)}
        sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
        alt={`${photo.alt} — ${photo.client}`}
        loading="lazy"
        decoding="async"
        width={photo.w}
        height={photo.h}
        className="size-full object-cover object-center"
      />
    </figure>
  );
}

export function PortfolioScreen() {
  const groups = groupByClient();
  const photoCount = PHOTOS.length;

  return (
    <div data-scope="video" className="md-root min-h-dvh overflow-clip">
      <ScrollProgress />
      <Nav />

      <main id="continut">
        <section className="relative px-5 pb-6 pt-20 sm:px-6 lg:pt-28">
          <div
            aria-hidden
            className="aurora aurora-drift"
            style={{
              width: "min(80vw, 760px)",
              height: "min(60vw, 520px)",
              left: "50%",
              top: "-6%",
              translate: "-50% 0",
              background:
                "radial-gradient(ellipse, color-mix(in oklab, var(--md-a1) 42%, transparent), transparent 66%)",
              opacity: "var(--md-glow-o, 0.4)",
            }}
          />
          <Reveal className="relative z-10 mx-auto max-w-3xl text-center">
            <h1 className="display text-[clamp(2.2rem,6vw,4rem)]">
              Portofoliu
            </h1>
            <p className="mt-6 text-[17px] leading-relaxed text-dim">
              {VIDEOS.length} materiale video și {photoCount} fotografii,
              filmate și montate de noi. Sunt așezate pe client, nu pe tip de
              material: așa se vede ce iese dintr-o colaborare, nu dintr-un
              clip.
            </p>
            <p className="mt-4 text-[14px] text-dim">
              Toate pornesc cu sunet, la apăsare.
            </p>
          </Reveal>
        </section>

        {groups.map((g, gi) => (
          <section
            key={g.client}
            className="relative px-5 py-14 sm:px-6 lg:py-20"
          >
            <div className="mx-auto max-w-6xl">
              <Reveal className="mb-8 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 border-b border-hair pb-5">
                <h2 className="display text-[clamp(1.5rem,3.4vw,2.1rem)]">
                  {g.client}
                </h2>
                <p className="font-md-mono text-[12px] uppercase tracking-[0.18em] text-dim">
                  {g.kind} ·{" "}
                  {[
                    g.videos.length ? `${g.videos.length} video` : null,
                    g.photos.length ? `${g.photos.length} foto` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </Reveal>

              {g.videos.length > 0 && (
                <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {g.videos.map((v, i) => (
                    <Reveal as="li" key={v.slug} delay={i * 60}>
                      <VideoCard item={v} eager={gi === 0 && i === 0} />
                    </Reveal>
                  ))}
                </ul>
              )}

              {g.photos.length > 0 && (
                <ul
                  className={`grid gap-3 sm:grid-cols-2 lg:grid-cols-3 ${
                    g.videos.length ? "mt-3" : ""
                  }`}
                >
                  {g.photos.map((p, i) => (
                    <Reveal as="li" key={p.slug} delay={i * 45}>
                      <Photo photo={p} />
                    </Reveal>
                  ))}
                </ul>
              )}
            </div>
          </section>
        ))}

        <section className="relative px-5 pb-24 pt-10 sm:px-6">
          <Reveal variant="scale" className="mx-auto max-w-6xl">
            <div className="glass-2 edge-light relative overflow-hidden px-6 py-14 text-center sm:px-12 sm:py-16">
              <h2 className="display mx-auto max-w-2xl text-[clamp(1.7rem,4.4vw,2.7rem)]">
                Următoarea ședință de filmare poate fi a ta.
              </h2>
              <p className="mx-auto mt-5 max-w-xl text-[16px] leading-relaxed text-dim">
                Spune-ne ce vinzi și cui. Îți spunem ce merită filmat și cum
                se distribuie după.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <a
                  href={CONTACT.phoneHref}
                  className="btn btn-primary !rounded-panel-sm !px-7"
                >
                  <Icon name="phone" size={16} />
                  {CONTACT.phone}
                </a>
                <a href={CONTACT.whatsapp} className="btn btn-ghost !rounded-panel-sm">
                  <Icon name="whatsapp" size={16} />
                  WhatsApp
                </a>
              </div>
            </div>
          </Reveal>
        </section>
      </main>

      <footer className="relative overflow-hidden border-t border-hair">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-8 gap-y-3 px-5 py-6 text-[13px] text-dim sm:px-6">
          <span>© 2026 MERIDIAN.</span>
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
    </div>
  );
}
