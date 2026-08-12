import { useId } from "react";
import { cn } from "@/lib/utils";

/**
 * Arcul de meridian al gateway-ului (FAZA 1).
 *
 * ACEEAȘI geometrie, două dialecte:
 * - „video":    arc de lumină — glow cald, gradient tungsten → daylight
 * - „software": geodezică precisă — 1px semnal + gradații de măsură
 *
 * Fiecare jumătate a gateway-ului randează arcul într-o „fereastră"
 * lată cât viewportul, ancorată la marginea ei de ecran; când jumătățile
 * se redimensionează, ferestrele alunecă peste același desen, deci
 * linia rămâne continuă peste cusătură — doar limbajul ei se schimbă.
 *
 * Culori brute --v-* / --s-* permise: fiecare dialect trăiește exclusiv
 * în jumătatea lumii lui (sub data-world corespunzător).
 */

const ARC_PATH = "M -40 740 C 420 720, 1020 220, 1480 160";

export function MeridianArc({
  dialect,
  className,
}: {
  dialect: "video" | "software";
  className?: string;
}) {
  const id = useId();
  const warmId = `${id}-warm`;
  const glowId = `${id}-glow`;

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 1440 900"
      preserveAspectRatio="none"
      fill="none"
      className={cn("h-full w-full", className)}
    >
      {dialect === "video" ? (
        <>
          <defs>
            <linearGradient id={warmId} x1="0" y1="1" x2="1" y2="0">
              <stop offset="0" stopColor="var(--v-tungsten)" stopOpacity="0" />
              <stop offset="0.4" stopColor="var(--v-tungsten)" />
              <stop offset="1" stopColor="var(--v-daylight)" />
            </linearGradient>
            <filter id={glowId} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="9" />
            </filter>
          </defs>
          {/* halo-ul cald — se intensifică pe hover (clase de pe wrapper) */}
          <path
            d={ARC_PATH}
            stroke={`url(#${warmId})`}
            strokeWidth="11"
            strokeLinecap="round"
            filter={`url(#${glowId})`}
            className="opacity-40 transition-opacity duration-700 ease-out group-data-[active=video]/gw:opacity-80"
          />
          {/* firul de lumină */}
          <path
            d={ARC_PATH}
            stroke={`url(#${warmId})`}
            strokeWidth="1.75"
            strokeLinecap="round"
            className="opacity-80 transition-opacity duration-700 ease-out group-data-[active=video]/gw:opacity-100"
          />
        </>
      ) : (
        <>
          {/* geodezica — 1px, precisă */}
          <path
            d={ARC_PATH}
            stroke="var(--s-signal)"
            strokeWidth="1"
            className="opacity-55 transition-opacity duration-300 ease-out group-data-[active=software]/gw:opacity-95"
          />
          {/* gradațiile de măsură de-a lungul geodezicei */}
          <path
            d={ARC_PATH}
            stroke="var(--s-signal)"
            strokeWidth="10"
            strokeDasharray="1.25 88"
            className="opacity-45 transition-opacity duration-300 ease-out group-data-[active=software]/gw:opacity-90"
          />
          {/* noduri de date la gradațiile mari */}
          <path
            d={ARC_PATH}
            stroke="var(--s-data)"
            strokeWidth="4"
            strokeDasharray="2 358"
            strokeDashoffset="-178"
            className="opacity-0 transition-opacity duration-300 ease-out group-data-[active=software]/gw:opacity-90"
          />
        </>
      )}
    </svg>
  );
}
