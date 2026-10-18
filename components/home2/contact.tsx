"use client";

import { CONTACT, STEPS } from "@/components/site/video-content";
import { FEATURED } from "@/components/site/portfolio-content";
import { LeadForm } from "./lead-form";
import { Icon, Rise } from "./ui";
import s from "./home2.module.css";

/* ============================================================
   CONTACT — panoul albastru din referință („Stop leaving results on the
   table”) e chenarul formularului.

   Conținutul e cel de pe /video: titlul, cele două căi de aceeași
   greutate (CLAUDE.md §8: vocea pentru cine decide acum, formularul
   pentru cine citește la 23:40) și cei patru pași de după. Pe margini,
   două postere înclinate, ca în referință — clipuri de-ale noastre.
   ============================================================ */

/* Primul și al treilea clip de pe prima pagină: cele mai luminoase. */
const TILTS = [FEATURED[0], FEATURED[2]].filter(Boolean);

export function Contact() {
  return (
    <section id="contact" className={`${s.lazy} px-0 pb-20 pt-6 sm:pb-28`} aria-labelledby="home2-contact-t">
      <div className={s.container}>
        <Rise>
          <div className={s.panel}>
            {TILTS.map((t, i) => (
              <span key={t.slug} aria-hidden className={`${s.tilt} ${i === 0 ? s.tiltL : s.tiltR}`}>
                {/* eslint-disable-next-line @next/next/no-img-element -- poster deja
                    la mărime, ca în portofoliu. */}
                <img src={t.poster} alt="" width={t.w} height={t.h} loading="lazy" decoding="async" />
              </span>
            ))}

            <div className={s.panelHead}>
              <p className={s.panelEyebrow}>Contact</p>
              <h2 id="home2-contact-t" className={s.panelTitle}>
                Gata să vezi unde se pierd clienții?
              </h2>
            </div>

            <div className={s.panelGrid}>
              <div className={`${s.glassCard} flex flex-col`}>
                <p className={s.cardEyebrow}>Cel mai rapid</p>
                <h3 className={s.cardTitle}>Contactează-ne</h3>
                <p className="mt-2 text-[15.5px] leading-relaxed text-white">
                  Pe WhatsApp răspundem în minute, în program.
                </p>

                <ChatPreview />

                <div className="mt-6 grid gap-2.5">
                  <a href={CONTACT.whatsapp} className={`${s.btn} ${s.btnOnBlue} w-full`}>
                    <Icon name="whatsapp" size={18} />
                    WhatsApp
                  </a>
                  <a href={CONTACT.phoneHref} className={`${s.btn} ${s.btnGlassOnBlue} w-full`}>
                    <Icon name="phone" size={16} />
                    {CONTACT.phone}
                  </a>
                </div>
              </div>

              <LeadForm />
            </div>

            <ol className={s.steps}>
              {STEPS.map((x) => (
                <li key={x.n}>
                  <span className="font-md-mono text-[12px] tracking-[0.12em] text-white/90">
                    PASUL {x.n}
                  </span>
                  <p className="mt-2 text-[16.5px] leading-snug text-white">{x.title}</p>
                </li>
              ))}
            </ol>
          </div>
        </Rise>
      </div>
    </section>
  );
}

/**
 * Primele două minute dintr-o conversație pe WhatsApp — grafica de pe
 * /video, pe panoul albastru. Umple golul de lângă formular cu imaginea
 * promisiunii din rândul de deasupra: „răspundem în minute”. Pe telefon
 * nu există gol, deci nici grafica.
 */
function ChatPreview() {
  const bubble = "max-w-[88%] rounded-2xl px-3.5 py-2.5 text-[14.5px] leading-snug";
  const stamp = "mt-1 font-md-mono text-[10.5px] tracking-wider text-white/60";
  return (
    <div aria-hidden className="relative my-auto hidden py-8 md:block">
      <div className="flex flex-col">
        <div className={`${bubble} self-end rounded-br-md bg-white text-[#1e3a8a]`}>
          Salut! Vrem un video pentru showroom.
        </div>
        <span className={`${stamp} self-end`}>14:02</span>

        <div className={`${bubble} mt-3 self-start rounded-bl-md border border-white/20 bg-[#0b1440]/45 text-white`}>
          Trimite-ne linkul paginii — ne uităm acum.
        </div>
        <span className={stamp}>14:04</span>

        <div className="mt-3 flex items-center gap-1 self-start rounded-2xl rounded-bl-md border border-white/20 bg-[#0b1440]/45 px-3.5 py-3">
          {[0, 150, 300].map((delay) => (
            <span
              key={delay}
              className="size-1.5 animate-pulse rounded-full bg-white/70 motion-reduce:animate-none"
              style={{ animationDelay: `${delay}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
