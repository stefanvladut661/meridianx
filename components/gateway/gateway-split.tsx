"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import type { Division } from "@/lib/division";
import { useDivision } from "@/lib/hooks/use-division";
import { MeridianMark } from "@/components/shell/logo";
import { LanguageSwitch } from "@/components/shell/language-switch";
import { MeridianArc } from "./meridian-arc";
import { CoordReadout } from "./coord-readout";
import { TimecodeTeaser } from "./timecode-teaser";

/**
 * Gateway-ul split-screen MERIDIAN (FAZA 1).
 *
 * Un singur arc de meridian traversează cusătura dintre lumi: fiecare
 * jumătate e o „fereastră" lată cât viewportul peste același desen,
 * deci linia e continuă — dar în video e arc de lumină, în software
 * geodezică pe grilă. La hover/focus, jumătatea activă se extinde
 * (~60/40, doar motion-safe) și își dezvăluie lumea: platoul se aprinde
 * (temperatură de culoare, REC, timecode live), instrumentul se
 * calibrează (grilă, coordonate care se fixează, gradații).
 *
 * Mobil: două panouri stivuite, fără hover — tap direct.
 * Reduced motion: totul static; stările de hover apar instant, fără
 * expansiune de layout.
 */

export function GatewaySplit() {
  const t = useTranslations();
  const [active, setActive] = useState<Division | null>(null);
  const { setDivision } = useDivision();

  return (
    <main
      data-active={active ?? "none"}
      className="group/gw relative flex min-h-dvh flex-col bg-bg text-fg"
    >
      <h1 className="sr-only">MERIDIAN — {t("gateway.choosePrompt")}</h1>

      {/* banda de brand — pe desktop plutește peste cusătură */}
      <div className="relative z-20 flex flex-col items-center gap-1.5 px-4 pb-5 pt-6 text-center md:pointer-events-none md:absolute md:inset-x-0 md:top-0 md:pb-0 md:pt-8">
        <span className="inline-flex items-center gap-2">
          <MeridianMark className="size-4" />
          <span className="font-display text-sm font-semibold tracking-[0.25em]">
            MERIDIAN
          </span>
        </span>
        <p className="text-xs text-muted">{t("gateway.choosePrompt")}</p>
      </div>

      <div className="flex flex-1 flex-col md:flex-row">
        {/* ============ VIDEO — platoul ============ */}
        <section
          data-world="video"
          onMouseEnter={() => setActive("video")}
          onMouseLeave={() => setActive(null)}
          className={cn(
            "relative flex-1 overflow-hidden bg-bg text-fg",
            "transition-[flex-grow] duration-[380ms] ease-[cubic-bezier(0.3,0.7,0,1)]",
            "md:motion-safe:group-data-[active=video]/gw:grow-[1.5]"
          )}
        >
          {/* temperatura de culoare: tungsten jos-stânga, daylight sus-dreapta */}
          <div
            aria-hidden="true"
            className="absolute inset-0 opacity-55 transition-opacity duration-700 ease-out group-data-[active=video]/gw:opacity-100"
            style={{
              backgroundImage:
                "radial-gradient(115% 90% at 12% 88%, rgba(255,140,59,0.24), transparent 58%), radial-gradient(95% 75% at 88% 8%, rgba(67,201,224,0.13), transparent 55%)",
            }}
          />

          {/* fereastra peste arcul comun — ancorată la marginea stângă a ecranului */}
          <div
            aria-hidden="true"
            className="absolute left-0 top-0 h-full w-screen"
          >
            <MeridianArc dialect="video" />
          </div>

          {/* conținutul */}
          <div className="relative z-10 flex h-full min-h-[44dvh] flex-col items-start justify-center gap-4 px-6 py-16 sm:px-10 md:min-h-0 md:px-[4vw] md:py-0">
            {/* colțuri de viewfinder — apar când platoul se aprinde */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-3 inset-y-8 opacity-0 transition-opacity duration-700 ease-out group-data-[active=video]/gw:opacity-70 sm:inset-x-5 md:inset-y-14"
            >
              <span className="absolute left-0 top-0 size-5 border-l border-t border-v-tungsten" />
              <span className="absolute right-0 top-0 size-5 border-r border-t border-v-tungsten" />
              <span className="absolute bottom-0 left-0 size-5 border-b border-l border-v-tungsten" />
              <span className="absolute bottom-0 right-0 size-5 border-b border-r border-v-tungsten" />
            </div>

            <span className="font-mono text-[11px] tracking-[0.2em] text-v-tungsten">
              WB 3200K <span className="text-v-dim">&rarr;</span>{" "}
              <span className="text-v-daylight">5600K</span>
            </span>
            <h2 className="font-display text-[clamp(2.5rem,6vw,7rem)] font-semibold leading-[0.95] tracking-tight">
              {t("gateway.video.title")}
            </h2>
            <p className="max-w-sm text-base leading-relaxed text-muted transition-colors duration-500 group-data-[active=video]/gw:text-fg">
              {t("gateway.video.promise")}
            </p>
            <span
              aria-hidden="true"
              className="mt-2 inline-flex items-center gap-2 rounded-sm border border-v-tungsten/35 px-4 py-2 text-sm text-fg transition-colors duration-500 group-data-[active=video]/gw:border-v-tungsten"
            >
              {t("gateway.video.enter")}
              <span className="transition-transform duration-500 group-data-[active=video]/gw:translate-x-0.5">
                &rarr;
              </span>
            </span>

            {/* camera rulează cât timp ești aici */}
            <TimecodeTeaser
              active={active === "video"}
              className="absolute bottom-6 left-6 opacity-0 transition-opacity duration-500 group-data-[active=video]/gw:opacity-100 sm:left-10 md:bottom-16 md:left-[4vw]"
            />
          </div>

          <Link
            href="/video"
            aria-label={t("gateway.video.aria")}
            onClick={() => setDivision("video")}
            onFocus={() => setActive("video")}
            onBlur={() => setActive(null)}
            className="absolute inset-2 z-20"
          />
        </section>

        {/* cusătura — meridianul zero; lată 0, urmărește granița flex */}
        <div aria-hidden="true" className="relative hidden w-0 md:block">
          <span className="absolute left-0 top-[15%] z-30 inline-flex -translate-x-1/2 items-center justify-center rounded-full border border-line bg-bg px-2 py-1 font-mono text-[10px] tracking-[0.1em] text-fg">
            0&deg;
          </span>
        </div>

        {/* ============ SOFTWARE — instrumentul ============ */}
        <section
          data-world="software"
          onMouseEnter={() => setActive("software")}
          onMouseLeave={() => setActive(null)}
          className={cn(
            "relative flex-1 overflow-hidden border-t border-line bg-bg text-fg md:border-l md:border-t-0",
            "transition-[flex-grow] duration-[380ms] ease-[cubic-bezier(0.3,0.7,0,1)]",
            "md:motion-safe:group-data-[active=software]/gw:grow-[1.5]"
          )}
        >
          {/* grila de blueprint — se calibrează la activare */}
          <div
            aria-hidden="true"
            className="absolute inset-0 opacity-40 transition-opacity duration-300 ease-out group-data-[active=software]/gw:opacity-75"
            style={{
              backgroundImage:
                "linear-gradient(var(--s-grid) 1px, transparent 1px), linear-gradient(90deg, var(--s-grid) 1px, transparent 1px)",
              backgroundSize: "48px 48px",
            }}
          />
          {/* grila fină — apare doar când instrumentul e activ */}
          <div
            aria-hidden="true"
            className="absolute inset-0 opacity-0 transition-opacity duration-300 ease-out group-data-[active=software]/gw:opacity-30"
            style={{
              backgroundImage:
                "linear-gradient(var(--s-grid) 1px, transparent 1px), linear-gradient(90deg, var(--s-grid) 1px, transparent 1px)",
              backgroundSize: "12px 12px",
            }}
          />

          {/* fereastra peste arcul comun — ancorată la marginea dreaptă a ecranului */}
          <div
            aria-hidden="true"
            className="absolute right-0 top-0 h-full w-screen"
          >
            <MeridianArc dialect="software" />
          </div>

          {/* rigla de gradații de-a lungul cusăturii */}
          <div
            aria-hidden="true"
            className="absolute inset-y-0 left-0 hidden flex-col justify-between py-12 pl-2 opacity-50 transition-opacity duration-300 group-data-[active=software]/gw:opacity-100 md:flex"
          >
            {Array.from({ length: 13 }).map((_, i) => (
              <span
                key={i}
                className={cn(
                  "h-px",
                  i % 4 === 0 ? "w-4 bg-s-signal" : "w-2 bg-s-muted/60"
                )}
              />
            ))}
          </div>

          {/* conținutul */}
          <div className="relative z-10 flex h-full min-h-[44dvh] flex-col items-start justify-center gap-4 px-6 py-16 sm:px-10 md:min-h-0 md:px-[4vw] md:py-0">
            <CoordReadout
              active={active === "software"}
              className="text-[11px] tracking-[0.2em] text-s-signal"
            />
            <h2 className="font-display text-[clamp(2.5rem,6vw,7rem)] font-semibold leading-[0.95] tracking-tight">
              {t("gateway.software.title")}
            </h2>
            <p className="max-w-sm text-base leading-relaxed text-muted transition-colors duration-300 group-data-[active=software]/gw:text-fg">
              {t("gateway.software.promise")}
            </p>
            <span
              aria-hidden="true"
              className="mt-2 inline-flex items-center gap-2 rounded-sm border border-line px-4 py-2 text-sm text-fg transition-colors duration-300 group-data-[active=software]/gw:border-s-signal"
            >
              {t("gateway.software.enter")}
              <span className="text-s-signal transition-transform duration-300 group-data-[active=software]/gw:translate-x-0.5">
                &rarr;
              </span>
            </span>
          </div>

          <Link
            href="/software"
            aria-label={t("gateway.software.aria")}
            onClick={() => setDivision("software")}
            onFocus={() => setActive("software")}
            onBlur={() => setActive(null)}
            className="absolute inset-2 z-20"
          />
        </section>
      </div>

      {/* banda de jos — tagline + limbă */}
      <div className="relative z-20 flex items-center justify-between gap-4 border-t border-line px-4 py-4 md:pointer-events-none md:absolute md:inset-x-0 md:bottom-0 md:border-t-0 md:px-8 md:py-5">
        <p className="hidden text-xs text-muted sm:block">{t("common.tagline")}</p>
        <LanguageSwitch className="pointer-events-auto" />
      </div>
    </main>
  );
}
