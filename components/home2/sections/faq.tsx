"use client";

import { useId, useState, type CSSProperties } from "react";
import { FAQ } from "@/components/site/video-content";
import { Mark } from "@/components/site/mark";
import { useShowcase } from "../hooks";
import { Icon, MotionCard, Rise, Title } from "../ui";
import s from "../home2.module.css";
import g from "../graphics.module.css";

/* ============================================================
   ÎNTREBĂRI — „Ce ne întreabă toți”.

   Lista e cea de pe /video, cu răspunsurile întregi, în cardurile
   rotunjite ale site-ului de referință. Graficul e o conversație:
   întrebarea vine ca mesaj, apoi „scrie…”, apoi primul rând din
   răspuns. Deschizi o întrebare din listă, conversația sare la ea.
   ============================================================ */

const MS = 6400;

/** Primul rând din răspuns, pentru bula din conversație. */
function excerpt(a: string): string {
  const parts = a.match(/[^.!?]+[.!?]+/g) ?? [a];
  let out = "";
  for (const p of parts) {
    out += p;
    if (out.trim().length >= 40) break;
  }
  out = out.trim();
  if (out.length <= 150) return out;
  const cut = out.slice(0, 146);
  return `${cut.slice(0, cut.lastIndexOf(" "))}…`;
}

export function Questions() {
  const show = useShowcase(FAQ.length, MS);
  const [open, setOpen] = useState<number | null>(0);
  const base = useId();

  return (
    <section id="intrebari" className={`${s.section} ${s.lazy}`} aria-labelledby={`${base}-t`}>
      <div className={s.container}>
        <div ref={show.zoneRef} className={s.feature} data-media="left" data-solo="">
          <Rise className={s.featureText}>
            <Title id={`${base}-t`} eyebrow="Întrebări" title="Ce ne întreabă" dim="toți" />

            <div className={s.faq}>
              {FAQ.map((it, i) => {
                const isOpen = open === i;
                return (
                  <div key={it.q} className={s.faqItem} data-open={isOpen ? "" : undefined}>
                    <h3>
                      <button
                        type="button"
                        className={s.faqQ}
                        aria-expanded={isOpen}
                        aria-controls={`${base}-a${i}`}
                        onClick={() => {
                          setOpen(isOpen ? null : i);
                          if (!isOpen) show.select(i);
                        }}
                      >
                        <span>{it.q}</span>
                        <span className={s.faqSign} aria-hidden>
                          <Icon name="plus" size={16} />
                        </span>
                      </button>
                    </h3>
                    <div
                      id={`${base}-a${i}`}
                      role="region"
                      aria-label={it.q}
                      className={s.acc}
                      data-open={isOpen ? "" : undefined}
                    >
                      <div>
                        <p className={s.faqA}>{it.a}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Rise>

          <Rise className={s.featureMedia} delay={80}>
            <MotionCard show={show} label="întrebările, ca într-o conversație">
              <Chat step={show.step} />
            </MotionCard>
          </Rise>
        </div>
      </div>
    </section>
  );
}

function Chat({ step }: { step: number }) {
  const prev = (step - 1 + FAQ.length) % FAQ.length;
  const at = (ms: number) => ({ ["--at" as string]: `${ms}ms` }) as CSSProperties;
  return (
    <div className={g.chat}>
      <div className={g.chatHead}>
        <span className={g.chatAvatar}>
          <Mark size={22} />
        </span>
        <span className="min-w-0">
          <span className={`${g.chatName} block`}>MERIDIAN</span>
          <span className={g.chatSub}>răspundem în minute, în program</span>
        </span>
      </div>

      <div key={step} className={g.thread}>
        {/* Perechea dinainte rămâne deasupra, stinsă — firul curge. */}
        <div className={`${g.msg} ${g.msgMe} ${g.old}`}>{FAQ[prev].q}</div>
        <div className={`${g.msg} ${g.msgUs} ${g.old}`}>{excerpt(FAQ[prev].a)}</div>

        <div className={g.grow} style={at(150)}>
          <div>
            <div className={`${g.msg} ${g.msgMe}`}>{FAQ[step].q}</div>
          </div>
        </div>
        <div className={g.grow} style={at(700)}>
          <div>
            <div className={g.shrink} style={at(2100)}>
              <div>
                <span className={g.typing}>
                  <i />
                  <i />
                  <i />
                </span>
              </div>
            </div>
          </div>
        </div>
        <div className={g.grow} style={at(2200)}>
          <div>
            <div className={`${g.msg} ${g.msgUs}`}>{excerpt(FAQ[step].a)}</div>
          </div>
        </div>
      </div>

      <div className={g.composer}>
        <span>Scrie-ne întrebarea ta…</span>
        <span className={g.send}>
          <Icon name="arrowRight" size={14} />
        </span>
      </div>
    </div>
  );
}
