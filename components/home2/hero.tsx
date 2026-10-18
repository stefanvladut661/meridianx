"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PRESENTATION } from "@/components/site/video-content";
import { useInView, useReducedMotion } from "./hooks";
import { ArrowUpRight, Icon } from "./ui";
import s from "./home2.module.css";

/* ============================================================
   HERO — ca în poza cu hero-ul: titlul centrat în două tonuri,
   subtitlul cu serviciile scoase în evidență, un singur buton în locul
   câmpului de URL, iar dedesubt filmul de prezentare în chenarul de
   sticlă, pe lumina albastră care urcă de jos.
   ============================================================ */

export function Hero() {
  return (
    <section className={s.hero} aria-labelledby="home2-hero-t">
      <div aria-hidden className={s.heroBg}>
        <span className={s.heroGlow} />
        <span className={s.heroCornerL} />
        <span className={s.heroCornerR} />
        <span className={s.heroFade} />
      </div>

      <div className={s.container}>
        <div className={s.heroInner}>
          {/* Textul titlului de acum, de pe /video. Cuvântul care se
              rotea acolo stă pe loc: în referință titlul e static, iar un
              cuvânt de lățime variabilă ar muta tot rândul centrat. */}
          <h1 id="home2-hero-t" className={s.h1}>
            Social Media Marketing &amp; Conținut Video{" "}
            <span className="text-white/60">care vinde</span>
          </h1>

          <p className={s.heroSub}>
            <strong>Video, reclame și campanii</strong> pe{" "}
            <strong>Meta, TikTok și Google</strong>, plus{" "}
            <strong>site-uri și aplicații</strong> la comandă.
          </p>

          <a href="#contact" className={s.heroBtn}>
            Cere ofertă
            <span className={s.heroBtnIcon} aria-hidden>
              <ArrowUpRight size={17} />
            </span>
          </a>

          <ul className={s.heroChecks}>
            <li>
              <Icon name="check" size={13} />
              Ofertă fermă după prima discuție
            </li>
            <li>
              <Icon name="check" size={13} />
              Contul de reclame rămâne pe numele tău
            </li>
          </ul>
        </div>

        <div className={s.frame}>
          <HeroVideo />
        </div>
      </div>
    </section>
  );
}

/**
 * Filmul de prezentare.
 *
 * Prima afișare e doar posterul — o imagine WebP de ~56KB, care e și
 * candidatul LCP. Fișierul video (5MB) nu se atinge până nu s-a încărcat
 * pagina de tot; abia atunci pornește o previzualizare fără sunet, cât
 * filmul e pe ecran, ca rama să trăiască exact ca în referință. Pe
 * conexiuni măsurate sau 2G și sub reduced-motion nu pornește nimic
 * singur: rămâne posterul cu butonul de redare.
 *
 * Filmul e vorbit, deci butonul din mijloc îl reia de la capăt, cu
 * sunet. Sunetul nu pornește niciodată singur (CLAUDE.md §7).
 */
function HeroVideo() {
  const reduced = useReducedMotion();
  const box = useRef<HTMLDivElement>(null);
  const ref = useRef<HTMLVideoElement>(null);
  const inView = useInView(box, 0.15);
  const [armed, setArmed] = useState(false);
  const [preview, setPreview] = useState(false);
  const [sound, setSound] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);

  /* Previzualizarea se armează după `load`, nu înainte: n-are voie să
     concureze cu primele octeți ai paginii. */
  useEffect(() => {
    if (reduced) return;
    let t: ReturnType<typeof setTimeout> | undefined;
    const arm = () => {
      const net = (
        navigator as Navigator & {
          connection?: { saveData?: boolean; effectiveType?: string };
        }
      ).connection;
      if (net?.saveData || (net?.effectiveType ?? "").includes("2g")) return;
      t = setTimeout(() => {
        setPreview(true);
        setArmed(true);
      }, 400);
    };
    if (document.readyState === "complete") arm();
    else window.addEventListener("load", arm, { once: true });
    return () => {
      if (t) clearTimeout(t);
      window.removeEventListener("load", arm);
    };
  }, [reduced]);

  // Previzualizarea merge doar cât rama e pe ecran.
  useEffect(() => {
    const el = ref.current;
    if (!el || !armed || sound || !preview) return;
    if (inView) {
      el.muted = true;
      void el.play().catch(() => {});
    } else {
      el.pause();
    }
  }, [armed, sound, preview, inView]);

  // Cu sunet: ce iese complet din ecran tace, ca playerele din portofoliu.
  useEffect(() => {
    if (sound && !inView) ref.current?.pause();
  }, [sound, inView]);

  /* Un singur film sună odată: dacă pornește altul (un clip din
     portofoliu, recenzia), filmul din hero se oprește. */
  useEffect(() => {
    const onPlay = (e: Event) => {
      const other = e.target as HTMLVideoElement;
      const me = ref.current;
      if (!me || other === me || other.muted) return;
      if (!me.paused && !me.muted) me.pause();
    };
    document.addEventListener("play", onPlay, true);
    return () => document.removeEventListener("play", onPlay, true);
  }, []);

  /* Pornirea cu sunet. Elementul <video> poate să nu existe încă
     (reduced-motion, conexiune lentă): atunci îl montăm, iar efectul de
     mai jos îl pornește imediat ce apare — tot în gestul omului. */
  const startSound = useCallback(() => {
    setSound(true);
    setArmed(true);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el || !sound) return;
    document.querySelectorAll("video").forEach((v) => {
      if (v !== el && !v.paused && !v.muted) v.pause();
    });
    el.currentTime = 0;
    el.muted = false;
    setMuted(false);
    el.play().catch(() => {
      // Browserul a refuzat sunetul: rămânem pe poster, cu butonul activ.
      el.muted = true;
      setMuted(true);
      setSound(false);
    });
  }, [sound, armed]);

  const togglePlay = () => {
    const el = ref.current;
    if (!el) return;
    if (el.paused) void el.play().catch(() => {});
    else el.pause();
  };

  const toggleMute = () => {
    const el = ref.current;
    if (!el) return;
    if (!sound) {
      startSound();
      return;
    }
    el.muted = !el.muted;
    setMuted(el.muted);
  };

  return (
    <div ref={box} className={s.screen}>
      {/* eslint-disable-next-line @next/next/no-img-element -- posterul e
          deja la mărimea lui (1280×720, WebP), ca pe /video. */}
      <img
        src={PRESENTATION.poster}
        alt={`${PRESENTATION.title} — ${PRESENTATION.client}`}
        width={1280}
        height={720}
        loading="eager"
        fetchPriority="high"
        decoding="async"
      />

      {armed && (
        <video
          ref={ref}
          src={PRESENTATION.src}
          poster={PRESENTATION.poster}
          playsInline
          muted
          loop={!sound}
          // Nimic din fișier nu pleacă până nu e rama pe ecran sau nu cere
          // omul filmul cu sunet.
          preload={sound || inView ? "auto" : "none"}
          disablePictureInPicture
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onVolumeChange={(e) => setMuted(e.currentTarget.muted)}
          onEnded={() => {
            // Filmul cu sunet s-a terminat: înapoi la previzualizare.
            setSound(false);
            const el = ref.current;
            if (el && preview) {
              el.muted = true;
              void el.play().catch(() => {});
            }
          }}
        />
      )}

      {!sound && (
        <button type="button" className={s.playBig} onClick={startSound}>
          <span className={s.playBigPill}>
            <span className={s.playBigDot}>
              <Icon name="play" size={15} className="ml-0.5" />
            </span>
            {preview ? "Vezi filmul cu sunet" : "Vezi filmul de prezentare"}
            <span className="font-md-mono text-[12px] text-white/60">
              0:{String(PRESENTATION.seconds).padStart(2, "0")}
            </span>
          </span>
        </button>
      )}

      {armed && (
        <div className={s.ctrlBar}>
          <button
            type="button"
            className={s.ctrl}
            onClick={toggleMute}
            aria-label={sound && !muted ? "Oprește sunetul" : "Pornește sunetul"}
          >
            <Icon name={sound && !muted ? "sound" : "muted"} size={15} />
          </button>
          <button
            type="button"
            className={s.ctrl}
            onClick={togglePlay}
            aria-label={playing ? "Pune pauză filmului" : "Redă filmul"}
          >
            <Icon name={playing ? "pause" : "play"} size={13} />
          </button>
        </div>
      )}
    </div>
  );
}
