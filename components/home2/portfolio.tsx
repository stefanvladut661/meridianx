"use client";

import { useEffect, useRef, useState } from "react";
import { Link } from "@/i18n/navigation";
import { FEATURED } from "@/components/site/portfolio-content";
import { VERTICALS } from "@/components/site/video-content";
import { VideoCard } from "@/components/site/video-player";
import { Marquee } from "@/components/site/motion";
import { Icon, Rise, Title } from "./ui";
import s from "./home2.module.css";

/* ============================================================
   PORTOFOLIU — imediat sub film, ca trecerea să nu fie bruscă.

   Aceleași clipuri ca pe /video, în aceeași ordine. Rămân statice și
   nu pornesc singure: playerul e cel de acum (VideoCard), neschimbat —
   posterul până la apăsare, apoi filmul cu sunet. Rândul are forma
   caruselelor din referință: carduri verticale pe toată lățimea, iar
   când nu încap toate, se derulează, cu săgeți pentru mouse.
   ============================================================ */

export function Portfolio() {
  const track = useRef<HTMLUListElement>(null);
  const [edge, setEdge] = useState({ overflow: false, left: false, right: false });

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const measure = () => {
      const overflow = el.scrollWidth > el.clientWidth + 2;
      setEdge({
        overflow,
        left: overflow && el.scrollLeft > 4,
        right: overflow && el.scrollLeft + el.clientWidth < el.scrollWidth - 4,
      });
    };
    measure();
    el.addEventListener("scroll", measure, { passive: true });
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", measure);
      ro.disconnect();
    };
  }, []);

  const nudge = (dir: 1 | -1) => {
    const el = track.current;
    if (!el) return;
    const card = el.querySelector("li");
    const step = card ? card.getBoundingClientRect().width + 16 : 240;
    el.scrollBy({
      left: dir * step * 2,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
  };

  return (
    <section id="materiale" className="relative pb-16 pt-8 sm:pb-24 sm:pt-12" aria-labelledby="home2-port-t">
      <Rise className={`${s.container} ${s.sectionHead}`}>
        <Title id="home2-port-t" eyebrow="Portofoliu" title="Ce am construit" dim="până acum." />
      </Rise>

      <Rise delay={90}>
        <div
          className={s.reel}
          data-overflow={edge.overflow ? "" : undefined}
          data-can-left={edge.left ? "" : undefined}
          data-can-right={edge.right ? "" : undefined}
        >
        <ul ref={track} className={s.reelTrack} aria-label="Clipuri din portofoliu">
          {FEATURED.map((v) => (
            <li key={v.slug} className={s.reelItem}>
              <VideoCard item={v} />
            </li>
          ))}
          <li className={s.reelItem}>
            <Link href="/video/portofoliu" className={s.moreCard}>
              <span className="grid size-12 place-items-center rounded-full border border-hair text-a1">
                <Icon name="arrowRight" size={18} />
              </span>
              <span className="text-[15.5px] font-medium text-bone">Vezi tot portofoliul</span>
              <span className="text-[13.5px] leading-relaxed text-dim">
                Toate filmările și fotografiile, pe client.
              </span>
            </Link>
          </li>
        </ul>
        <span aria-hidden className={`${s.reelFade} ${s.reelFadeL}`} />
        <span aria-hidden className={`${s.reelFade} ${s.reelFadeR}`} />

        <div className={s.reelNav}>
          <button
            type="button"
            className={s.ctrl}
            onClick={() => nudge(-1)}
            disabled={!edge.left}
            aria-label="Clipurile anterioare"
          >
            <Icon name="arrowRight" size={14} className="rotate-180" />
          </button>
          <button
            type="button"
            className={s.ctrl}
            onClick={() => nudge(1)}
            disabled={!edge.right}
            aria-label="Clipurile următoare"
          >
            <Icon name="arrowRight" size={14} />
          </button>
        </div>
        </div>
      </Rise>

      {/* Banda de industrii de pe /video, mai discretă. */}
      <div className={s.strip}>
        <p className="sr-only">Industrii în care lucrăm</p>
        <Marquee duration={48}>
          {VERTICALS.map((x) => (
            <span key={x.key} className="flex items-center gap-3 whitespace-nowrap px-6 sm:px-9">
              <span className="text-[15px] text-zinc-200 sm:text-[17px]">{x.label}</span>
              <span className="size-1 rounded-full bg-a1" aria-hidden />
              <span className="text-[14px] text-dim">{x.short}</span>
            </span>
          ))}
        </Marquee>
      </div>
    </section>
  );
}
