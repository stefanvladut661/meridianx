import { Fragment } from "react";
import { cn } from "@/lib/utils";

/**
 * Text care intră pe cuvinte, nu pe blocuri (FAZA 2, divizia VIDEO).
 *
 * Server-friendly și CSS-pur: cuvintele sunt vizibile în HTML și se
 * animă cu keyframes din <VideoMotionStyles /> (inclus o dată per
 * pagină). Sub prefers-reduced-motion animația e anulată din CSS,
 * textul e pur și simplu acolo.
 */
export interface WordRevealProps {
  text: string;
  className?: string;
  /** Întârzierea primului cuvânt, în ms. */
  delay?: number;
  /** Pasul dintre cuvinte, în ms. */
  step?: number;
}

export function WordReveal({
  text,
  className,
  delay = 0,
  step = 60,
}: WordRevealProps) {
  const words = text.split(" ");

  return (
    <span className={cn("inline", className)}>
      {words.map((word, index) => (
        <Fragment key={`${word}-${index}`}>
          <span className="-mb-[0.12em] inline-block overflow-hidden pb-[0.12em] align-bottom">
            <span
              className="mv-word inline-block will-change-transform"
              style={{ animationDelay: `${delay + index * step}ms` }}
            >
              {word}
            </span>
          </span>
          {index < words.length - 1 ? " " : null}
        </Fragment>
      ))}
    </span>
  );
}
