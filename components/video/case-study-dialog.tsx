"use client";

import type { Project } from "@/content/types";
import { Dialog } from "@/components/ui/dialog";
import { SEGMENT_LABELS, projectCode } from "./segments";

/**
 * Case study scurt în overlay (FAZA 2, portofoliu video).
 * Folosește <Dialog> din components/ui — focus trap, Escape și
 * restaurarea focusului vin din <dialog> nativ. Video cu poster
 * obligatoriu, fără autoplay.
 */
export function CaseStudyDialog({
  project,
  onClose,
}: {
  project: Project | null;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={project !== null}
      onClose={onClose}
      title={project?.title ?? ""}
      className="max-w-3xl"
    >
      {project ? (
        <div className="space-y-6">
          <p className="-mt-2 font-mono text-xs tracking-[0.2em] text-muted">
            {projectCode(project)}
            {project.segment
              ? ` · ${SEGMENT_LABELS[project.segment].toUpperCase()}`
              : ""}
            {project.year ? ` · ${project.year}` : ""}
            {project.isPlaceholder ? (
              <span className="ml-3 rounded-xs border border-line px-1.5 py-0.5 text-[10px]">
                PLACEHOLDER
              </span>
            ) : null}
          </p>

          <div className="overflow-hidden rounded-md border border-line">
            {project.media.kind === "video" ? (
              <video
                controls
                preload="none"
                playsInline
                poster={project.media.poster}
                aria-label={project.media.alt}
                className="aspect-video w-full bg-bg object-cover"
              >
                <source src={project.media.src} type="video/mp4" />
              </video>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element -- postere SVG locale, fără optimizator
              <img
                src={project.media.src}
                alt={project.media.alt}
                className="aspect-video w-full object-cover"
              />
            )}
          </div>

          {project.isPlaceholder ? (
            <p className="font-mono text-[11px] leading-relaxed tracking-wider text-muted">
              {/* i18n: */}
              STUDIU DE CAZ PLACEHOLDER — PROIECTUL REAL (VIDEO + CIFRE) SE
              MONTEAZĂ AICI CU UN SINGUR COMMIT.
            </p>
          ) : null}

          <dl className="space-y-5">
            <div>
              <dt className="font-mono text-xs tracking-[0.25em] text-accent-2">
                {/* i18n: */}
                CONTEXT
              </dt>
              <dd className="mt-2 text-sm leading-relaxed text-fg/80">
                {project.context}
              </dd>
            </div>
            {project.challenge ? (
              <div>
                <dt className="font-mono text-xs tracking-[0.25em] text-accent-2">
                  {/* i18n: */}
                  PROVOCAREA
                </dt>
                <dd className="mt-2 text-sm leading-relaxed text-fg/80">
                  {project.challenge}
                </dd>
              </div>
            ) : null}
            <div>
              <dt className="font-mono text-xs tracking-[0.25em] text-accent-2">
                {/* i18n: */}
                CE AM FILMAT
              </dt>
              <dd className="mt-2 text-sm leading-relaxed text-fg/80">
                {project.solution}
              </dd>
            </div>
            <div>
              <dt className="font-mono text-xs tracking-[0.25em] text-accent-2">
                {/* i18n: */}
                REZULTAT
              </dt>
              <dd className="mt-2 text-sm leading-relaxed text-fg/80">
                {project.result}
              </dd>
            </div>
          </dl>

          {project.metrics && project.metrics.length > 0 ? (
            <div className="grid grid-cols-2 gap-3">
              {project.metrics.map((metric) => (
                <div
                  key={metric.label}
                  className="rounded-sm border border-line bg-bg/60 p-3"
                >
                  <p className="font-mono text-lg text-accent-2">
                    {metric.value}
                  </p>
                  <p className="mt-1 text-xs text-muted">{metric.label}</p>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </Dialog>
  );
}
