"use client";

import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { SYSTEM } from "@/components/site/video-content";
import { useShowcase } from "../hooks";
import { Actions, CardHead, Icon, MotionCard, Rise, Title } from "../ui";
import s from "../home2.module.css";
import g from "../graphics.module.css";

/* ============================================================
   SISTEMUL — „Nu livrăm și plecăm”.

   Graficul e bucla: Diagnostic → Producție → Distribuție → Optimizare,
   apoi din nou de la capăt. Cometa trece din pas în pas, pasul activ se
   aprinde, iar în mijloc stau livrabilele lui. Pastila numără ture:
   ideea secțiunii nu e că facem patru pași, ci că nu ne oprim după ei.
   ============================================================ */

const MS = 3800;

/* Nodurile pe cerc, în procente din pătratul buclei: sus, dreapta, jos,
   stânga — în ordinea pașilor, ca cometa să meargă în sensul acelor. */
const POS = [
  { x: 50, y: 13 },
  { x: 87, y: 50 },
  { x: 50, y: 87 },
  { x: 13, y: 50 },
];

const ICONS = ["search", "camera", "megaphone", "chart"] as const;

export function System() {
  const show = useShowcase(SYSTEM.length, MS);
  const base = useId();
  const lap = useLaps(show.step, show.running);

  return (
    <section id="sistem" className={`${s.section} ${s.lazy}`} aria-labelledby={`${base}-t`}>
      <div className={s.container}>
        <div ref={show.zoneRef} className={s.feature} data-media="right">
          <Rise className={s.featureText}>
            <Title id={`${base}-t`} eyebrow="Alături de tine" title="Nu livrăm și plecăm." />
            <p className={s.lead}>
              Aceeași echipă, de la prima cafea la raportul lunar.
            </p>

            <ol className={s.rows}>
              {SYSTEM.map((st, i) => (
                // Clicul pe rând e doar o scurtătură pentru mouse și deget;
                // tastatura are „Următorul” din card, iar textul e tot aici.
                <li
                  key={st.n}
                  className={`${s.row} cursor-pointer`}
                  data-on={show.step === i ? "" : undefined}
                  onClick={() => show.select(i)}
                >
                  <span className="flex items-baseline gap-3">
                    <span className={s.rowTag}>{st.n}</span>
                    <span className="text-[17px] text-bone">{st.title}</span>
                  </span>
                  <span className={s.rowBody}>{st.lead}</span>
                  <span className={s.rowMeta}>{st.outputs.join(" · ")}</span>
                </li>
              ))}
            </ol>
          </Rise>

          <Rise className={s.featureMedia} delay={80}>
            <MotionCard show={show} label="pașii, în buclă">
              <CardHead label="Ciclul lunar" pill={`Luna ${lap}`} />
              <div className={g.body}>
                <Loop step={show.step} reduced={show.reduced} />
              </div>
            </MotionCard>
          </Rise>

          <Rise className={s.featureActions} delay={120}>
            <Actions
              className="mt-2 lg:mt-0"
              note="Vrei să vezi cum ar arăta pentru afacerea ta?"
            />
          </Rise>
        </div>
      </div>
    </section>
  );
}

/** Câte ture complete a făcut bucla: crește când pasul trece din 4 în 1. */
function useLaps(step: number, running: boolean) {
  const [lap, setLap] = useState(1);
  const prev = useRef(step);
  useEffect(() => {
    if (running && prev.current === SYSTEM.length - 1 && step === 0) {
      setLap((l) => (l >= 12 ? 1 : l + 1));
    }
    prev.current = step;
  }, [step, running]);
  return lap;
}

function Loop({ step, reduced }: { step: number; reduced: boolean }) {
  const st = SYSTEM[step];
  const a0 = step * 90;
  const a1 = reduced ? a0 : a0 + 90;
  return (
    <div className={g.loop}>
      <svg viewBox="0 0 100 100" className={g.loopSvg}>
        <circle className={g.ringDash} cx="50" cy="50" r="43" />
        <circle className={g.ring} cx="50" cy="50" r="37" />
        <circle
          key={`arc-${step}`}
          className={g.arc}
          cx="50"
          cy="50"
          r="37"
          pathLength={100}
          style={{ ["--start" as string]: `${a0 - 90}deg`, ["--ms" as string]: `${MS}ms` } as CSSProperties}
        />
      </svg>

      <div
        key={`orbit-${step}`}
        className={g.orbit}
        style={{ ["--a0" as string]: `${a0}deg`, ["--a1" as string]: `${a1}deg`, ["--ms" as string]: `${MS}ms` } as CSSProperties}
      >
        <span className={g.comet} />
      </div>

      {SYSTEM.map((x, i) => (
        <span
          key={x.n}
          className={g.node}
          data-on={i === step ? "" : undefined}
          style={{ left: `${POS[i].x}%`, top: `${POS[i].y}%` }}
        >
          <span className={g.nodeTile}>
            <Icon name={ICONS[i]} size={20} />
          </span>
          <span className={g.nodeName}>{x.title}</span>
        </span>
      ))}

      <div key={`c-${step}`} className={g.center}>
        <span className={`${g.centerTag} ${g.fadeIn}`}>PASUL {st.n}</span>
        <span className={`${g.centerTitle} ${g.rise}`} style={{ ["--at" as string]: "80ms" } as CSSProperties}>
          {st.title}
        </span>
        <span className={g.chipCol}>
          {st.outputs.map((o, i) => (
            <span
              key={o}
              className={`${g.chip} ${g.pop}`}
              style={{ ["--i" as string]: i, ["--step" as string]: "120ms", ["--at" as string]: "260ms" } as CSSProperties}
            >
              {o}
            </span>
          ))}
        </span>
      </div>
    </div>
  );
}
