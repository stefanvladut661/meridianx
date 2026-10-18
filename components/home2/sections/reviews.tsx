"use client";

import { useId } from "react";
import { TESTIMONIALS } from "@/components/site/video-content";
import { ClientMark } from "@/components/site/client-marks";
import { VideoCard, type PortfolioVideo } from "@/components/site/video-player";
import { useShowcase } from "../hooks";
import { Actions, Icon, Rise, SkipIcon, Title } from "../ui";
import s from "../home2.module.css";
import g from "../graphics.module.css";

/* ============================================================
   RECENZII — „Unul a zis-o în fața camerei. Restul, în scris.”

   Cardul ține exact asta: recenzia filmată la E45, care pornește doar
   la apăsare și cu sunet (playerul de pe /video, neschimbat), iar lângă
   ea citatele scrise, pe rând. Aici cardul nu e decor: citatele sunt
   conținut, deci nu stau sub `aria-hidden`.
   ============================================================ */

const MS = 7200;

const REVIEW_VIDEO: PortfolioVideo = {
  slug: "recenzie-e45",
  client: "E45 Restobar",
  title: "Recenzie, filmată la ei în local",
  kind: "Recenzie",
  src: "/video/recenzii/e45.mp4",
  poster: "/video/recenzii/e45.webp",
  w: 720,
  h: 1280,
  seconds: 97,
  audio: true,
};

function Logo({ t, size }: { t: (typeof TESTIMONIALS)[number]; size: number }) {
  return t.logo ? (
    /* eslint-disable-next-line @next/next/no-img-element -- logo deja
       curățat și adus la 128px, ca pe /video. */
    <img
      src={t.logo}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      className={g.whoLogo}
      style={{ width: size, height: size }}
    />
  ) : (
    <ClientMark name={t.who} size={size} />
  );
}

export function Reviews() {
  const show = useShowcase(TESTIMONIALS.length, MS);
  const base = useId();
  const t = TESTIMONIALS[show.step];

  return (
    <section id="recenzii" className={`${s.section} ${s.lazy}`} aria-labelledby={`${base}-t`}>
      <div className={s.container}>
        <div ref={show.zoneRef} className={s.feature} data-media="right">
          <Rise className={s.featureText}>
            <Title
              id={`${base}-t`}
              eyebrow="Recenzii"
              title="Nu ne credeți pe noi."
              dim="Credeți-i pe ei."
            />
            <p className={s.lead}>Unul a zis-o în fața camerei. Restul, în scris.</p>

            <ul className={s.rows}>
              {TESTIMONIALS.map((x, i) => (
                // Scurtătură pentru mouse și deget; aceleași recenzii se
                // aleg și din punctele de sub citat.
                <li
                  key={x.who}
                  className={`${s.row} flex cursor-pointer items-center gap-3`}
                  data-on={show.step === i ? "" : undefined}
                  onClick={() => show.select(i)}
                >
                  <Logo t={x} size={34} />
                  <span className="min-w-0">
                    <span className="block truncate text-[15.5px] text-bone">{x.who}</span>
                    <span className="block truncate text-[13.5px] text-dim">{x.where}</span>
                  </span>
                </li>
              ))}
            </ul>
          </Rise>

          <Rise className={s.featureMedia} delay={80}>
            <div className={`${s.card} ${g.host} ${g.reviewsCard}`}>
              <div className={s.cardCtrls}>
                <button
                  type="button"
                  data-pause
                  className={s.ctrl}
                  onClick={show.toggle}
                  aria-label={show.running ? "Oprește schimbarea recenziilor" : "Pornește schimbarea recenziilor"}
                >
                  <Icon name={show.running ? "pause" : "play"} size={13} />
                </button>
                <button
                  type="button"
                  className={s.ctrl}
                  onClick={show.next}
                  aria-label="Recenzia următoare"
                >
                  <SkipIcon size={13} />
                </button>
              </div>

              <div className={g.reviews}>
                <div className={g.reviewVideo}>
                  <p className={`${g.quoteTag} mb-3`}>În fața camerei</p>
                  <VideoCard item={REVIEW_VIDEO} className="w-full" />
                </div>

                <div
                  className={g.quoteBox}
                  role="group"
                  aria-roledescription="carusel"
                  aria-label="Recenzii scrise"
                >
                  <p className={g.quoteTag}>În scris</p>
                  <figure key={show.step} className={show.reduced ? "" : g.quoteAnim}>
                    <blockquote className={g.quote}>„{t.quote}”</blockquote>
                    <figcaption className={g.who}>
                      <Logo t={t} size={38} />
                      <span className="min-w-0">
                        <span className="block truncate text-[14.5px] text-bone">{t.who}</span>
                        <span className="block truncate text-[13px] text-dim">{t.where}</span>
                      </span>
                    </figcaption>
                  </figure>
                  <div className={g.dots}>
                    {TESTIMONIALS.map((x, i) => (
                      <button
                        key={x.who}
                        type="button"
                        className={g.dotBtn}
                        data-on={i === show.step ? "" : undefined}
                        aria-current={i === show.step ? "true" : undefined}
                        aria-label={`Recenzia de la ${x.who}`}
                        onClick={() => show.select(i)}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </Rise>

          <Rise className={s.featureActions} delay={120}>
            <Actions className="mt-2 lg:mt-0" note="Următorul citat poate fi al tău." />
          </Rise>
        </div>
      </div>
    </section>
  );
}
