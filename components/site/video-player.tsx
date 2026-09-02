"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "./ui";

/* ============================================================
   PLAYER DE PORTOFOLIU — vertical, cu sunet, pornit de mână.

   Trei decizii care fac diferența între „merge" și „nu enervează":

   1. Videoul nu există până la prima apăsare. Cardul e o imagine
      `loading="lazy"` plus un buton; elementul <video> se montează abia
      la click. Așa pagina cu nouă materiale nu descarcă nouă fișiere de
      7–24MB, ci nouă postere de ~60KB. Asta e tot ce înseamnă „calitate
      maximă în limita încărcării rapide": calitatea rămâne întreagă în
      fișier, dar octeții pleacă doar când cineva chiar vrea să vadă.

   2. Un singur material sună o dată. Fără asta, două carduri apăsate la
      rând cântă unul peste altul — cel mai rapid mod de a face un
      vizitator să închidă pagina.

   3. Ce iese din ecran se oprește. Sunetul care continuă dintr-un card
      pe care nu-l mai vezi e sunet pe care nu-l poți opri fără să-l
      cauți.

   `loop` face reluarea de la capăt cerută; `playsInline` ține videoul în
   pagină pe iPhone în loc să-l arunce în player-ul de sistem — altfel
   navigarea pe telefon s-ar rupe la fiecare apăsare.
   ============================================================ */

export type PortfolioVideo = {
  slug: string;
  client: string;
  title: string;
  kind: string;
  src: string;
  poster: string;
  w: number;
  h: number;
  seconds: number;
  audio: boolean;
  lowRes?: boolean;
};

/** Materialul care sună acum. Modul-scope: unul per filă, nu per pagină. */
let sounding: HTMLVideoElement | null = null;

function clock(total: number) {
  const m = Math.floor(total / 60);
  const s = Math.floor(total % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function VideoCard({
  item,
  className = "",
  eager = false,
}: {
  item: PortfolioVideo;
  className?: string;
  /** Posterul primului material se încarcă imediat, restul leneș. */
  eager?: boolean;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [armed, setArmed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(item.seconds);
  const [isFull, setIsFull] = useState(false);

  // Prima apăsare montează videoul; efectul de mai jos îl pornește.
  useEffect(() => {
    if (!armed) return;
    const el = ref.current;
    if (!el) return;
    if (sounding && sounding !== el) sounding.pause();
    sounding = el;
    el.play().catch(() => {
      // Browserul a refuzat pornirea cu sunet. Ne întoarcem la poster, ca
      // butonul să rămână apăsabil, în loc să lăsăm un cadru mort.
      setArmed(false);
      setPlaying(false);
    });

    /* Elementul e prins în variabilă, nu citit din `ref` la curățare: la
       demontare `ref.current` e deja null, deci verificarea n-ar mai
       găsi nimic și am lăsa în urmă o referință către un video mort. */
    return () => {
      if (sounding === el) sounding = null;
    };
  }, [armed]);

  const toggle = useCallback(() => {
    const el = ref.current;
    if (!armed || !el) {
      setArmed(true);
      return;
    }
    if (el.paused) {
      if (sounding && sounding !== el) sounding.pause();
      sounding = el;
      el.play().catch(() => setPlaying(false));
    } else {
      el.pause();
    }
  }, [armed]);

  // Ce iese complet din ecran tace.
  useEffect(() => {
    const el = box.current;
    if (!el || !armed) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) ref.current?.pause();
      },
      { threshold: 0 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [armed]);

  const toggleMute = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.muted = !el.muted;
    setMuted(el.muted);
  }, []);

  /* Derularea: input-ul de tip range e stratul de interacțiune (click,
     tragere, săgeți de la tastatură); bara vizibilă de dedesubt rămâne
     doar afișaj, ca să putem controla exact cum arată. */
  const seek = useCallback(
    (value: number) => {
      const el = ref.current;
      if (!el || !duration) return;
      el.currentTime = (value / 1000) * duration;
      setProgress(value / 10);
    },
    [duration]
  );

  /* Fullscreen pe container (controalele rămân vizibile); pe iPhone
     containerul nu poate intra în fullscreen, deci cădem pe playerul
     nativ al videoului. */
  const toggleFull = useCallback(() => {
    const boxEl = box.current;
    const el = ref.current;
    if (document.fullscreenElement) {
      void document.exitFullscreen();
      return;
    }
    if (boxEl?.requestFullscreen) {
      void boxEl.requestFullscreen();
    } else {
      (
        el as HTMLVideoElement & { webkitEnterFullscreen?: () => void }
      )?.webkitEnterFullscreen?.();
    }
  }, []);

  useEffect(() => {
    const onChange = () => setIsFull(document.fullscreenElement === box.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  return (
    <div
      ref={box}
      className={`group relative overflow-hidden rounded-panel-lg border border-hair bg-char ${className}`}
      style={{ aspectRatio: isFull ? undefined : `${item.w} / ${item.h}` }}
    >
      {armed ? (
        <video
          ref={ref}
          src={item.src}
          poster={item.poster}
          loop
          playsInline
          preload="auto"
          className={`absolute inset-0 size-full ${isFull ? "object-contain" : "object-cover"}`}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onLoadedMetadata={(e) => {
            if (e.currentTarget.duration) setDuration(e.currentTarget.duration);
          }}
          onTimeUpdate={(e) => {
            const v = e.currentTarget;
            if (v.duration) setProgress((v.currentTime / v.duration) * 100);
          }}
        />
      ) : (
        /* eslint-disable-next-line @next/next/no-img-element -- poster deja
           dimensionat și convertit în WebP de scripts/portfolio-build.mjs;
           optimizatorul lui Next n-ar mai avea ce adăuga. */
        <img
          src={item.poster}
          alt={`${item.title} — ${item.client}`}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          className="absolute inset-0 size-full object-cover"
        />
      )}

      {/* Umbră doar sus și jos, ca textul să se citească peste orice cadru. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgb(0 0 0 / 0.55) 0%, transparent 26%, transparent 62%, rgb(0 0 0 / 0.72) 100%)",
        }}
      />

      <button
        type="button"
        onClick={toggle}
        aria-label={
          playing ? `Oprește ${item.title}` : `Redă ${item.title}, cu sunet`
        }
        className="absolute inset-0 z-20 flex items-center justify-center focus-visible:outline-none"
      >
        <span
          className={`grid size-16 place-items-center rounded-full border border-white/25 bg-black/45 text-white backdrop-blur-md transition-all duration-300 group-hover:scale-105 ${
            playing ? "scale-90 opacity-0 group-hover:opacity-100" : "opacity-100"
          }`}
        >
          <Icon
            name={playing ? "pause" : "play"}
            size={22}
            className={playing ? "" : "ml-1"}
          />
        </span>
      </button>

      {/* Antetul: cine și ce. Deasupra butonului la citire, sub el la click. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between gap-3 p-4">
        <span className="min-w-0">
          <span className="block truncate text-[13.5px] font-medium text-white">
            {item.client}
          </span>
          <span className="mt-0.5 block truncate text-[12px] text-white/65">
            {item.title}
          </span>
        </span>
        <span className="shrink-0 rounded-full bg-black/50 px-2 py-0.5 font-md-mono text-[11px] text-white/85">
          {clock(item.seconds)}
        </span>
      </div>

      {/* Sunetul se poate tăia fără să oprești materialul: cineva îl
          deschide într-un birou și nu vrea să fie el evenimentul zilei. */}
      {armed && (
        <button
          type="button"
          onClick={toggleFull}
          aria-label={isFull ? "Ieși din ecran complet" : "Ecran complet"}
          className="absolute bottom-3 right-14 z-30 grid size-9 place-items-center rounded-full border border-white/20 bg-black/50 text-white backdrop-blur-md transition-colors hover:bg-black/70"
        >
          <Icon name="expand" size={15} />
        </button>
      )}

      {armed && (
        <button
          type="button"
          onClick={toggleMute}
          aria-pressed={muted}
          aria-label={muted ? "Pornește sunetul" : "Oprește sunetul"}
          className="absolute bottom-3 right-3 z-30 grid size-9 place-items-center rounded-full border border-white/20 bg-black/50 text-white backdrop-blur-md transition-colors hover:bg-black/70"
        >
          <Icon name={muted ? "muted" : "sound"} size={16} />
        </button>
      )}

      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 z-30 h-[4px] bg-white/15 transition-[height] duration-200 group-hover:h-[6px]"
        style={{ opacity: armed ? 1 : 0 }}
      >
        <span
          className="block h-full bg-a1"
          style={{ width: `${progress}%`, transition: "width 120ms linear" }}
        />
      </div>

      {armed && (
        <input
          type="range"
          min={0}
          max={1000}
          value={Math.round(progress * 10)}
          onChange={(e) => seek(Number(e.currentTarget.value))}
          aria-label={`Derulează ${item.title}`}
          aria-valuetext={`${clock((progress / 100) * duration)} din ${clock(duration)}`}
          className="absolute inset-x-0 bottom-0 z-40 h-5 w-full cursor-pointer appearance-none bg-transparent opacity-0 focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-a1 [&::-moz-range-thumb]:size-3 [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-a1 [&::-webkit-slider-thumb]:size-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-a1"
        />
      )}
    </div>
  );
}
