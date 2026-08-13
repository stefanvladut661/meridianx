"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { calEmbedSrc, calHref } from "./channels";

/**
 * Programare de call — Cal.com în iframe (FAZA 3).
 *
 * Deliberat FĂRĂ librărie de embed: nu adăugăm o dependență nouă doar
 * ca să punem un calendar (CLAUDE.md §6.5). Iframe-ul se montează abia
 * când secțiunea intră în viewport, deci nu costă nimic la LCP și nu
 * cheamă un terț înainte ca vizitatorul să ajungă acolo.
 *
 * Fără `NEXT_PUBLIC_CAL_VIDEO` nu randăm nimic — mai bine lipsește
 * decât să arate un calendar mort.
 */
export function CalEmbed({ className }: { className?: string }) {
  const src = calEmbedSrc();
  const href = calHref();
  const ref = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element || mounted) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setMounted(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [mounted]);

  if (!src || !href) {
    if (process.env.NODE_ENV !== "production") {
      return (
        <p className={cn("font-mono text-xs text-accent-2", className)}>
          DEV · setează NEXT_PUBLIC_CAL_VIDEO ca să apară calendarul.
        </p>
      );
    }
    return null;
  }

  return (
    <div
      ref={ref}
      className={cn(
        "overflow-hidden rounded-md border border-line bg-surface",
        className
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3">
        <p className="font-mono text-[11px] tracking-[0.28em] text-accent-2">
          {/* i18n: */}
          CALL DE DESCOPERIRE · 20 MIN
        </p>
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-xs tracking-wider text-fg/70 underline-offset-4 hover:text-fg hover:underline"
        >
          {/* i18n: */}
          deschide în fereastră nouă →
        </a>
      </div>
      {mounted ? (
        <iframe
          src={src}
          // i18n:
          title="Programare call de descoperire — MERIDIAN Video"
          loading="lazy"
          className="h-[42rem] w-full border-0 bg-bg"
        />
      ) : (
        <div className="flex h-[42rem] w-full items-center justify-center">
          <p className="font-mono text-xs tracking-[0.25em] text-fg/60">
            {/* i18n: */}
            SE ÎNCARCĂ CALENDARUL…
          </p>
        </div>
      )}
    </div>
  );
}
