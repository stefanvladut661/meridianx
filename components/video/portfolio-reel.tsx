"use client";

import {
  useEffect,
  useRef,
  useState,
  type FocusEvent,
} from "react";
import Image from "next/image";
import type { Project, VideoSegment } from "@/content/types";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/lib/hooks/use-reduced-motion";
import { Container } from "@/components/ui/container";
import { loadMotion, type MotionBundle } from "./motion/motion";
import { CaseStudyDialog } from "./case-study-dialog";
import { SEGMENT_LABELS, VIDEO_SEGMENTS, projectCode } from "./segments";

type SegmentFilter = VideoSegment | "toate";
type ScrollTriggerInstance = InstanceType<MotionBundle["ScrollTrigger"]>;

const FILTERS: SegmentFilter[] = ["toate", ...VIDEO_SEGMENTS];

/**
 * Signature-ul paginii de portofoliu (FAZA 2): reel orizontal
 * scroll-driven, ca o bandă de peliculă derulată de scroll.
 *
 * - Desktop (≥1024px) + motion permis: track pinned, GSAP ScrollTrigger
 *   scrub. GSAP se încarcă lazy, după mount.
 * - Mobil / prefers-reduced-motion / fără JS: listă verticală completă —
 *   același conținut, nimic pierdut. SSR-ul randează lista verticală;
 *   reel-ul e o îmbunătățire aplicată după mount (fără mismatch).
 * - Tastatură: cardurile sunt butoane în ordinea documentului; la focus
 *   în reel, fereastra sare la poziția de scroll a cardului, deci focusul
 *   e mereu vizibil. Overlay-ul de case study are focus trap nativ.
 */
export function PortfolioReel({
  projects,
  initialSegment,
}: {
  projects: Project[];
  initialSegment?: VideoSegment;
}) {
  const reducedMotion = useReducedMotion();
  const [filter, setFilter] = useState<SegmentFilter>(initialSegment ?? "toate");
  const [reelActive, setReelActive] = useState(false);
  const [openProject, setOpenProject] = useState<Project | null>(null);

  const pinRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const counterRef = useRef<HTMLSpanElement>(null);
  const scrollTriggerRef = useRef<ScrollTriggerInstance | null>(null);

  const filtered =
    filter === "toate"
      ? projects
      : projects.filter((project) => project.segment === filter);
  const count = filtered.length;

  // Pagina poate fi servită static (SSG), caz în care searchParams-ul
  // de pe server e gol: sincronizăm o dată, la mount, din URL-ul real.
  useEffect(() => {
    const param = new URLSearchParams(window.location.search).get("segment");
    if (param && (VIDEO_SEGMENTS as string[]).includes(param)) {
      setFilter(param as VideoSegment);
    }
  }, []);

  useEffect(() => {
    if (reducedMotion) {
      setReelActive(false);
      return;
    }
    const mql = window.matchMedia("(min-width: 1024px)");
    const apply = () => setReelActive(mql.matches);
    apply();
    mql.addEventListener("change", apply);
    return () => mql.removeEventListener("change", apply);
  }, [reducedMotion]);

  useEffect(() => {
    if (!reelActive || count === 0) return;
    let disposed = false;
    let ctx: { revert: () => void } | null = null;

    void loadMotion().then(({ gsap, ScrollTrigger }) => {
      if (disposed) return;
      const pin = pinRef.current;
      const track = trackRef.current;
      if (!pin || !track) return;

      const distance = () => Math.max(0, track.scrollWidth - pin.clientWidth);

      ctx = gsap.context(() => {
        const tween = gsap.to(track, {
          x: () => -distance(),
          ease: "none",
          scrollTrigger: {
            trigger: pin,
            start: "top top",
            end: () => `+=${Math.max(distance(), 1)}`,
            pin: true,
            scrub: 1,
            anticipatePin: 1,
            invalidateOnRefresh: true,
            onUpdate: (self) => {
              const counter = counterRef.current;
              if (!counter) return;
              const index = Math.min(
                count,
                Math.max(1, Math.round(self.progress * (count - 1)) + 1)
              );
              counter.textContent = `${String(index).padStart(2, "0")} / ${String(count).padStart(2, "0")}`;
            },
          },
        });
        scrollTriggerRef.current = tween.scrollTrigger ?? null;
      }, pin);
      ScrollTrigger.refresh();
    });

    return () => {
      disposed = true;
      scrollTriggerRef.current = null;
      ctx?.revert();
    };
  }, [reelActive, filter, count]);

  function handleTrackFocus(event: FocusEvent<HTMLDivElement>) {
    const scrollTrigger = scrollTriggerRef.current;
    const pin = pinRef.current;
    const track = trackRef.current;
    if (!scrollTrigger || !pin || !track) return;
    const card = (event.target as HTMLElement).closest<HTMLElement>(
      "[data-reel-card]"
    );
    if (!card) return;
    const distance = Math.max(1, track.scrollWidth - pin.clientWidth);
    const progress = Math.min(
      1,
      Math.max(0, (card.offsetLeft - 48) / distance)
    );
    window.scrollTo({
      top: scrollTrigger.start + progress * (scrollTrigger.end - scrollTrigger.start),
      behavior: "auto",
    });
  }

  return (
    <div>
      <Container size="wide">
        <div
          role="group"
          // i18n:
          aria-label="Filtrează proiectele după segment"
          className="flex flex-wrap gap-2"
        >
          {FILTERS.map((value) => {
            const active = value === filter;
            return (
              <button
                key={value}
                type="button"
                aria-pressed={active}
                onClick={() => setFilter(value)}
                className={cn(
                  "rounded-sm border px-3.5 py-2 font-mono text-xs uppercase tracking-[0.15em] transition-colors",
                  active
                    ? "border-accent bg-accent text-accent-contrast"
                    : "border-line text-fg/70 hover:border-muted hover:text-fg"
                )}
              >
                {value === "toate" ? "Toate" : SEGMENT_LABELS[value]}
              </button>
            );
          })}
        </div>
      </Container>

      {count === 0 ? (
        <Container size="wide">
          <p className="mt-14 max-w-xl text-lg text-fg/70">
            {/* i18n: */}
            Încă n-am publicat proiecte pe segmentul ăsta — dar exact asta
            filmăm. Alege alt filtru sau scrie-ne ce ai de arătat lumii.
          </p>
        </Container>
      ) : reelActive ? (
        <div
          ref={pinRef}
          className="relative mt-4 flex min-h-svh flex-col justify-center overflow-hidden"
        >
          <div
            ref={trackRef}
            onFocus={handleTrackFocus}
            className="flex w-max items-stretch gap-10 pl-[max(1.5rem,calc((100vw-88rem)/2+2rem))] pr-[24vw]"
          >
            {filtered.map((project) => (
              <div
                key={project.id}
                data-reel-card
                className="w-[min(62vw,50rem)] shrink-0"
              >
                <ProjectCard
                  project={project}
                  onOpen={() => setOpenProject(project)}
                />
              </div>
            ))}
          </div>
          <div className="pointer-events-none absolute inset-x-0 bottom-8 flex items-center justify-between px-6 font-mono text-xs tracking-[0.25em] text-fg/60 lg:px-12">
            {/* i18n: */}
            <span>SCROLL = DERULARE PELICULĂ</span>
            <span ref={counterRef}>
              01 / {String(count).padStart(2, "0")}
            </span>
          </div>
        </div>
      ) : (
        <Container size="wide">
          <div className="mt-10 grid gap-x-8 gap-y-12 sm:grid-cols-2">
            {filtered.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onOpen={() => setOpenProject(project)}
              />
            ))}
          </div>
        </Container>
      )}

      <CaseStudyDialog
        project={openProject}
        onClose={() => setOpenProject(null)}
      />
    </div>
  );
}

/**
 * Card de proiect cu efect de focus-pull: posterul stă ușor defocalizat
 * și „prinde focus” la hover/focus — lentila care găsește subiectul.
 * Marcat data-focus-cursor pentru reticul.
 */
function ProjectCard({
  project,
  onOpen,
}: {
  project: Project;
  onOpen: () => void;
}) {
  const code = projectCode(project);
  return (
    <article>
      <button
        type="button"
        onClick={onOpen}
        data-focus-cursor=""
        data-focus-label={code}
        // i18n:
        aria-label={`Deschide studiul de caz: ${project.title}`}
        className="group block w-full rounded-md text-left"
      >
        <span className="relative block aspect-video overflow-hidden rounded-md border border-line bg-surface">
          <Image
            src={project.media.poster ?? project.media.src}
            alt={project.media.alt}
            fill
            unoptimized
            sizes="(min-width: 1024px) 62vw, (min-width: 640px) 50vw, 100vw"
            className="scale-[1.03] object-cover blur-[3px] transition-[filter,transform] duration-500 group-hover:scale-100 group-hover:blur-none group-focus-visible:scale-100 group-focus-visible:blur-none"
          />
          {project.isPlaceholder ? (
            <span className="absolute right-3 top-3 rounded-xs border border-v-bone/25 bg-bg/70 px-2 py-1 font-mono text-[10px] tracking-[0.2em] text-fg/80">
              PLACEHOLDER
            </span>
          ) : null}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-2.5 opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100"
          >
            <span className="absolute left-0 top-0 size-4 border-l border-t border-v-bone/60" />
            <span className="absolute right-0 top-0 size-4 border-r border-t border-v-bone/60" />
            <span className="absolute bottom-0 left-0 size-4 border-b border-l border-v-bone/60" />
            <span className="absolute bottom-0 right-0 size-4 border-b border-r border-v-bone/60" />
          </span>
        </span>
        <span className="mt-4 flex items-baseline justify-between gap-4 font-mono text-xs tracking-[0.2em] text-fg/60">
          <span>
            {code}
            {project.segment
              ? ` · ${SEGMENT_LABELS[project.segment].toUpperCase()}`
              : ""}
          </span>
          <span>{project.year ?? ""}</span>
        </span>
        <span className="mt-2 block font-display text-2xl tracking-tight text-fg transition-colors group-hover:text-accent-2">
          {project.title}
        </span>
        <span className="mt-1 block text-sm text-fg/60">{project.client}</span>
      </button>
    </article>
  );
}
