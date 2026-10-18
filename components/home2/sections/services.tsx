"use client";

import { useId, type CSSProperties } from "react";
import { SERVICES, type ServiceGlyph } from "@/components/site/video-content";
import { Mark } from "@/components/site/mark";
import { useShowcase } from "../hooks";
import {
  CardHead,
  Icon,
  MotionCard,
  Rise,
  StepTrack,
  Title,
} from "../ui";
import s from "../home2.module.css";
import g from "../graphics.module.css";

/* ============================================================
   SERVICII — cele patru de pe /video, cu textele lor.

   Graficul arată meseria din fiecare serviciu: aceeași marcă în trei
   formate, castingul care alege omul, cele trei canale care se strâng
   într-un singur plan, panoul care trimite spre o ofertă.
   ============================================================ */

const MS = 5200;

/* Eticheta din stânga sus: numele serviciului, scurtat cât să încapă
   lângă butoanele din mijlocul cardului. */
const LABEL: Record<ServiceGlyph, string> = {
  brand: "Imaginea brandului",
  ugc: "UGC și actori",
  performance: "Performance",
  outdoor: "Outdoor",
};

/* Pastila din colțul cardului: ce arată desenul, în două-trei cuvinte. */
const PILL: Record<ServiceGlyph, string> = {
  brand: "Trei formate",
  ugc: "Casting",
  performance: "Un singur plan",
  outdoor: "Panou → ofertă",
};

const v = (o: Record<string, string | number>) => o as CSSProperties;

export function Services() {
  const show = useShowcase(SERVICES.length, MS);
  const base = useId();
  const svc = SERVICES[show.step];
  const Draw = DRAW[svc.glyph];

  return (
    <section id="servicii" className={`${s.section} ${s.lazy}`} aria-labelledby={`${base}-t`}>
      <div className={s.container}>
        <div ref={show.zoneRef} className={s.feature} data-media="left">
          <Rise className={s.featureText}>
            <Title
              id={`${base}-t`}
              eyebrow="Servicii"
              title="Ce putem lua"
              dim="pe umerii noștri."
            />
            <p className={s.lead}>
              Poți începe cu una singură. Merg cel mai bine împreună.
            </p>

            <ul className={s.rows}>
              {SERVICES.map((x, i) => (
                // Scurtătură pentru mouse și deget; textul e tot aici, iar
                // tastatura are „Următorul” din card.
                <li
                  key={x.key}
                  className={`${s.row} cursor-pointer`}
                  data-on={show.step === i ? "" : undefined}
                  onClick={() => show.select(i)}
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <h3 className="text-[17px] text-bone">{x.title}</h3>
                    <a
                      href="#contact"
                      className="inline-flex min-h-8 items-center gap-1.5 text-[14px] font-medium text-a2 transition-colors hover:text-bone"
                    >
                      Cere ofertă
                      <Icon name="arrowRight" size={14} />
                      <span className="sr-only"> pentru {x.title}</span>
                    </a>
                  </div>
                  <span className={s.rowBody}>{x.blurb}</span>
                  <span className={s.rowMeta}>{x.bullets.join(" · ")}</span>
                </li>
              ))}
            </ul>
          </Rise>

          <Rise className={s.featureMedia} delay={80}>
            <MotionCard show={show} label="serviciile, unul câte unul">
              <CardHead label={LABEL[svc.glyph]} pill={PILL[svc.glyph]} />
              <StepTrack show={show} count={SERVICES.length} ms={MS} />
              <div key={show.step} className={g.body}>
                <Draw />
              </div>
            </MotionCard>
          </Rise>

          {/* Cutia de preț din /video, în locul rândului de butoane. */}
          <Rise className={s.featureActions} delay={120}>
            <div className="mt-2 lg:mt-0">
              <div className={s.actions}>
                <a href="#contact" className={`${s.btn} ${s.btnLight}`}>
                  Cere ofertă
                  <Icon name="arrowRight" size={17} className={s.arw} />
                </a>
              </div>
              <p className={s.actionsNote}>
                Prețul se face pe proiect.{" "}
                <span className="text-bone">Ofertă fermă după prima discuție.</span>
              </p>
            </div>
          </Rise>
        </div>
      </div>
    </section>
  );
}

/* ---------------- desenele ---------------- */

const DRAW: Record<ServiceGlyph, () => React.ReactNode> = {
  brand: Formats,
  ugc: Casting,
  performance: Channels,
  outdoor: Outdoor,
};

/* Imaginea brandului — aceeași marcă în film, foto și social. */
const FORMATS = [
  { name: "Film", ratio: "16:9", w: 46, r: "-5deg" },
  { name: "Foto", ratio: "4:5", w: 25, r: "0deg" },
  { name: "Social", ratio: "9:16", w: 19, r: "5deg" },
];

function Formats() {
  return (
    <div className={g.formats}>
      {FORMATS.map((f, i) => (
        <div key={f.name} className={g.fmt} style={v({ "--i": i, "--r0": f.r, width: `${f.w}%` })}>
          <div className={g.shot} style={{ aspectRatio: f.ratio.replace(":", " / ") }}>
            <span className={g.shotMark}>
              <Mark size={34} className="h-auto w-full" />
            </span>
            <span className={g.shotLines}>
              <i />
              <i />
            </span>
          </div>
          <span className={g.fmtName}>{f.name}</span>
          <span className={g.fmtRatio}>{f.ratio}</span>
        </div>
      ))}
    </div>
  );
}

/* Filmări UGC și cu actori — castingul alege omul potrivit publicului,
   apoi ies variantele pentru testare. */
const TINTS = [
  ["#3f3f46", "#27272a"],
  ["#52525b", "#3f3f46"],
  ["#3f3f46", "#18181b"],
  ["#4b5563", "#1f2937"],
  ["#60a5fa", "#1d4ed8"],
  ["#3f3f46", "#27272a"],
];
const PICK = 4;

function Casting() {
  return (
    <>
      <div className={g.castWrap}>
        <div className={g.cast}>
          {TINTS.map(([a, b], i) => (
            <div
              key={i}
              className={`${g.face} ${i === PICK ? g.picked : ""}`}
              style={v({ "--i": i, "--at": "2350ms" })}
            >
              <svg viewBox="0 0 40 40" className={g.faceSvg}>
                <defs>
                  <linearGradient id={`hx-f${i}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor={i === PICK ? a : "#71717a"} />
                    <stop offset="1" stopColor={i === PICK ? b : "#3f3f46"} />
                  </linearGradient>
                </defs>
                <circle cx="20" cy="20" r="20" fill="#1f1f24" />
                <circle cx="20" cy="16" r="7" fill={`url(#hx-f${i})`} />
                <path d="M7 36c2-8 8-11 13-11s11 3 13 11" fill={`url(#hx-f${i})`} />
              </svg>
              <span className={g.faceLine} />
              <span className={g.faceLine} />
              {i === PICK && (
                <span className={g.tick} style={v({ "--at": "2350ms" })}>
                  <Icon name="check" size={12} />
                </span>
              )}
            </div>
          ))}
        </div>
        <span className={g.reticle} />
      </div>
      <div className={g.variants}>
        {["A", "B", "C"].map((x, i) => (
          <div key={x} className={g.variant} style={v({ "--i": i })}>
            <span className={g.variantTag}>{x}</span>
            <span className="grid gap-[1.1cqw]">
              <i className={g.bar} />
              <i className={g.bar} style={{ width: `${70 - i * 12}%` }} />
              <i className={g.bar} style={{ width: `${45 + i * 10}%` }} />
            </span>
          </div>
        ))}
      </div>
    </>
  );
}

/* Performance — Meta, TikTok și Google, un singur plan, contul tău. */
const CHANNELS = [
  { name: "Meta", y: 18, c: "#60a5fa" },
  { name: "TikTok", y: 43, c: "#93c5fd" },
  { name: "Google", y: 68, c: "#bfdbfe" },
];

function Channels() {
  return (
    <div className={g.flow}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none">
        {CHANNELS.map((ch) => (
          <path
            key={ch.name}
            className={g.wire}
            d={`M 8 ${ch.y} C 45 ${ch.y}, 45 43, 60 43`}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
      {CHANNELS.map((ch, i) => (
        <span
          key={ch.name}
          className={g.channel}
          style={v({ top: `${ch.y}%`, "--i": i, "--c": ch.c })}
        >
          <span className={g.channelDot} />
          {ch.name}
        </span>
      ))}
      <span className={g.planNode} style={{ left: "76%", top: "43%" }}>
        Un singur plan
        <svg viewBox="0 0 100 30" className={g.planSpark} preserveAspectRatio="none">
          <path
            className={g.planLine}
            d="M 2 26 C 20 24 26 18 40 17 C 54 16 60 10 72 8 C 84 6 90 4 98 3"
            pathLength={1}
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </span>
      <span className={g.owner}>
        <Icon name="shield" size={15} />
        Contul rămâne pe numele tău
      </span>
    </div>
  );
}

/* Reclamă outdoor — locația, panoul, drumul spre oferta online. */
const PINS = [
  { x: 14, y: 30 },
  { x: 40, y: 56 },
  { x: 62, y: 22 },
];
const CHOSEN = 1;

function Outdoor() {
  return (
    <div className={g.city}>
      <div className={g.blocks}>
        {Array.from({ length: 16 }).map((_, i) => (
          <span key={i} className={g.block} />
        ))}
      </div>
      {PINS.map((p, i) => (
        <span
          key={i}
          className={`${g.pin} ${i === CHOSEN ? g.pinOn : ""}`}
          style={v({ left: `${p.x}%`, top: `${p.y}%`, "--i": i })}
        >
          <svg viewBox="0 0 24 30" fill="currentColor">
            <path d="M12 0C5.4 0 0 5.2 0 11.7 0 20 12 30 12 30s12-10 12-18.3C24 5.2 18.6 0 12 0Zm0 16.4a4.6 4.6 0 1 1 0-9.2 4.6 4.6 0 0 1 0 9.2Z" />
          </svg>
        </span>
      ))}
      <span className={g.board} style={{ left: `${PINS[CHOSEN].x}%`, top: `${PINS[CHOSEN].y - 7}%` }}>
        <span className={g.boardFace}>
          <i />
          <i />
        </span>
        <span className={g.boardLegs}>
          <span />
          <span />
        </span>
      </span>
      <svg
        className={g.pathReveal}
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible" }}
      >
        <path
          className={g.path}
          d={`M ${PINS[CHOSEN].x + 8} ${PINS[CHOSEN].y - 18} C 60 40, 66 46, 74 46`}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <span className={g.phone}>
        <span className={g.phoneScreen}>
          <span className={g.phoneHero} />
          <i />
          <i style={{ width: "62%" }} />
          <span className={g.phoneBtn}>Ofertă</span>
        </span>
      </span>
      <div className={g.stepsRow}>
        <span style={v({ "--at": "1100ms" })}>Locație</span>
        <span aria-hidden>→</span>
        <span style={v({ "--at": "1600ms" })}>Panou</span>
        <span aria-hidden>→</span>
        <span style={v({ "--at": "3300ms" })}>Ofertă</span>
      </div>
    </div>
  );
}
