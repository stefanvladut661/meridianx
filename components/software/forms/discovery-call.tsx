"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Discovery call — Cal.com în iframe (FAZA 5, divizia SOFTWARE).
 *
 * Fără librărie de embed: nu adăugăm o dependență ca să afișăm un
 * calendar (CLAUDE.md §6.5). Iframe-ul se montează abia când secțiunea
 * intră în viewport — nu costă nimic la încărcarea paginii și nu
 * cheamă un terț înainte ca vizitatorul să ajungă acolo.
 *
 * Construit local, nu împrumutat din `components/video/cta/`: cele
 * două lumi nu partajează componente vizuale (CLAUDE.md §2).
 * Fără `NEXT_PUBLIC_CAL_SOFTWARE` nu randăm un calendar mort.
 */

function calUrls() {
  const slug = process.env.NEXT_PUBLIC_CAL_SOFTWARE;
  if (!slug) return null;
  const base = slug.startsWith("http") ? slug : `https://cal.com/${slug}`;
  const separator = base.includes("?") ? "&" : "?";
  return { base, embed: `${base}${separator}embed=true&theme=dark` };
}

export function DiscoveryCall({ className }: { className?: string }) {
  const urls = calUrls();
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

  if (!urls) {
    if (process.env.NODE_ENV !== "production") {
      return (
        <p className={cn("font-mono text-xs text-accent-2", className)}>
          DEV · setează NEXT_PUBLIC_CAL_SOFTWARE ca să apară calendarul.
        </p>
      );
    }
    return null;
  }

  return (
    <div
      ref={ref}
      className={cn("overflow-hidden rounded-md border border-line bg-surface", className)}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3">
        <p className="font-mono text-[11px] tracking-[0.24em] text-accent">
          {/* i18n: */}
          DISCOVERY CALL · 30 MIN · GRATUIT
        </p>
        <a
          href={urls.base}
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-xs tracking-wider text-muted underline-offset-4 transition-colors duration-150 hover:text-fg hover:underline"
        >
          {/* i18n: */}
          deschide în fereastră nouă →
        </a>
      </div>
      {mounted ? (
        <iframe
          src={urls.embed}
          // i18n:
          title="Programare discovery call — MERIDIAN Software"
          loading="lazy"
          className="h-[42rem] w-full border-0 bg-bg"
        />
      ) : (
        <div className="flex h-[42rem] w-full items-center justify-center">
          <p className="font-mono text-xs tracking-[0.2em] text-muted">
            {/* i18n: */}
            SE ÎNCARCĂ CALENDARUL…
          </p>
        </div>
      )}
    </div>
  );
}
