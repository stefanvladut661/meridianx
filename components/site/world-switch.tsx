"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "@/i18n/navigation";
import { Mark } from "./mark";

/* ============================================================
   COMUTATORUL DE DIVIZII — sfert de cerc lipit în colț.

   Poarta lasă o memorie spațială: video în stânga, software în
   dreapta. Colțul o respectă — pe pagina de video stă dreapta sus
   (acolo unde stă software în poartă), pe software stânga sus.
   Cine a trecut o dată prin poartă știe deja unde să se uite.

   Sfertul poartă `data-scope`-ul diviziei în care duce, nu al paginii
   pe care stă: e o deschidere spre cealaltă lume, colorată ca acolo.
   La apăsare, culoarea aceea crește din colț până acoperă ecranul,
   apoi se face navigarea — tranziția explică unde ai ajuns.

   Interiorul: numele diviziei, săgeata alături de el orientată spre
   colț, și un arc fin de meridian cu un nod pe el — același motiv ca
   pe poartă, redus la un sfert. La hover arcul se completează și
   nodul crește.

   Sub 640px nu se afișează: în colțul de sus al unui telefon stă bara
   de navigație. Acolo, trecerea stă în meniul mobil.
   ============================================================ */

type Target = "video" | "software";

const TARGETS: Record<
  Target,
  { href: string; name: string; side: "left" | "right" }
> = {
  video: { href: "/video", name: "VIDEO", side: "left" },
  software: { href: "/software", name: "SOFTWARE", side: "right" },
};

/** Arcul + nodul, oglindite după colț. Geometrie explicită, nu magie. */
function Meridian({ isLeft }: { isLeft: boolean }) {
  // Cerc de rază 86 cu centrul chiar în colț, arc între 25° și 70°.
  const d = isLeft
    ? "M 78 36 A 86 86 0 0 1 29 81"
    : "M 42 36 A 86 86 0 0 0 91 81";
  const node = isLeft ? { cx: 58, cy: 63 } : { cx: 62, cy: 63 };

  return (
    <svg
      viewBox="0 0 120 120"
      className="pointer-events-none absolute inset-0 size-full"
      fill="none"
      aria-hidden
    >
      <path
        className="ws-arc"
        d={d}
        pathLength={100}
        stroke="var(--md-a1)"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle className="ws-node" {...node} r="2" fill="var(--md-a1)" />
    </svg>
  );
}

function Arrow({ isLeft }: { isLeft: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="15"
      height="15"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`ws-arrow shrink-0 text-a1 ${isLeft ? "-rotate-90" : ""}`}
      aria-hidden
    >
      <path d="M7 17 17 7M9 7h8v8" />
    </svg>
  );
}

export function WorldSwitch({ to }: { to: Target }) {
  const t = TARGETS[to];
  const isLeft = t.side === "left";
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);
  const [origin, setOrigin] = useState({ x: 0, y: 0 });
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  /* Vălul crește din colțul propriu-zis, nu din centrul casetei —
     altfel pare că pornește din aer. */
  const onClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    e.preventDefault();
    const r = e.currentTarget.getBoundingClientRect();
    setOrigin({ x: isLeft ? r.left : r.right, y: r.top });
    setLeaving(true);
    window.setTimeout(() => router.push(t.href), 560);
  };

  return (
    <>
      <Link
        href={t.href}
        onClick={onClick}
        data-scope={to}
        data-side={t.side}
        aria-label={`Treci la divizia ${t.name.toLowerCase()}`}
        className="ws-corner hidden text-bone sm:block"
      >
        {/* strălucirea difuză a diviziei de dincolo, dinspre colț */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background: `radial-gradient(circle at ${
              isLeft ? "0% 0%" : "100% 0%"
            }, color-mix(in oklab, var(--md-glow, var(--md-a1)) 30%, transparent), transparent 76%)`,
          }}
        />

        <span
          className={`absolute top-[15px] flex items-center gap-2 ${
            isLeft ? "left-4 flex-row" : "right-4 flex-row-reverse"
          }`}
        >
          <Arrow isLeft={isLeft} />
          <span className="font-md-display text-[13px] font-bold uppercase leading-none tracking-[0.05em] text-bone">
            {t.name}
          </span>
        </span>

        <Meridian isLeft={isLeft} />
      </Link>

      {/* Vălul merge prin portal direct în <body>: sfertul are `translate`
          din animația de intrare, deci ar deveni bloc de conținere pentru
          orice descendent `fixed`, iar vălul n-ar mai acoperi ecranul. */}
      {mounted &&
        leaving &&
        createPortal(
          <div
            data-scope={to}
            className="fixed inset-0 z-[90]"
            aria-hidden
            style={{ pointerEvents: "none" }}
          >
            <span
              className="ws-wipe"
              style={{ left: origin.x, top: origin.y }}
            />
            <span className="ws-wipe-label fixed inset-0 z-[91] grid place-items-center">
              <span className="flex flex-col items-center gap-4 text-bone">
                <Mark size={44} />
                <span className="font-md-display text-[clamp(1.6rem,5vw,2.6rem)] font-bold tracking-[0.2em]">
                  {t.name}
                </span>
              </span>
            </span>
          </div>,
          document.body
        )}
    </>
  );
}

/** Varianta pentru meniul de telefon, unde sfertul din colț nu încape. */
export function WorldSwitchMobileLink({ to }: { to: Target }) {
  const t = TARGETS[to];
  return (
    <Link
      href={t.href}
      className="flex items-center gap-2.5 py-3.5 text-[15px] text-a2"
    >
      <Arrow isLeft={t.side === "left"} />
      Treci la {t.name.toLowerCase()}
    </Link>
  );
}
