"use client";

import { useRef, useState } from "react";

/**
 * Showreel-ul de pe home (FAZA 2). Video local cu poster obligatoriu,
 * fără autoplay, fără sunet nepornit de utilizator. Fișierul real nu
 * există încă: la play eșuat afișăm marcajul de placeholder, cinstit.
 * Înlocuirea = un singur fișier la /public/video/showreel.mp4.
 */
export function Showreel() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<"idle" | "playing" | "missing">("idle");

  async function handlePlay() {
    const video = videoRef.current;
    if (!video) return;
    try {
      await video.play();
      setState("playing");
    } catch {
      setState("missing");
    }
  }

  return (
    <div
      className="relative aspect-video overflow-hidden rounded-lg border border-line bg-surface"
      data-focus-cursor=""
      data-focus-label="SHOWREEL"
    >
      <video
        ref={videoRef}
        poster="/video/posters/showreel.svg"
        preload="none"
        playsInline
        controls={state === "playing"}
        onError={() => setState("missing")}
        className="h-full w-full object-cover"
      >
        <source src="/video/showreel.mp4" type="video/mp4" />
      </video>

      {state !== "playing" ? (
        <button
          type="button"
          onClick={handlePlay}
          aria-label="Redă showreel-ul"
          className="group absolute inset-0 flex items-center justify-center bg-black/25 transition-colors hover:bg-black/10"
        >
          <span className="flex size-20 items-center justify-center rounded-full border border-v-bone/40 bg-bg/60 backdrop-blur-sm transition-transform duration-300 group-hover:scale-110">
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="ml-1 size-7 text-fg"
            >
              <path d="M8 5.5v13l11-6.5-11-6.5Z" />
            </svg>
          </span>
        </button>
      ) : null}

      {/* colțuri de cadru pe rama media (nu HUD de viewport — acela e al shell-ului) */}
      <span aria-hidden="true" className="pointer-events-none absolute inset-3">
        <span className="absolute left-0 top-0 size-5 border-l-2 border-t-2 border-v-bone/50" />
        <span className="absolute right-0 top-0 size-5 border-r-2 border-t-2 border-v-bone/50" />
        <span className="absolute bottom-0 left-0 size-5 border-b-2 border-l-2 border-v-bone/50" />
        <span className="absolute bottom-0 right-0 size-5 border-b-2 border-r-2 border-v-bone/50" />
      </span>

      {state === "missing" ? (
        <p className="absolute inset-x-0 bottom-0 bg-bg/85 p-4 text-center font-mono text-xs tracking-[0.2em] text-fg/80">
          {/* i18n: */}
          SHOWREEL PLACEHOLDER — FILMUL REAL SE ATAȘEAZĂ LA
          /PUBLIC/VIDEO/SHOWREEL.MP4
        </p>
      ) : null}
    </div>
  );
}
