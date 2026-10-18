"use client";

import { useId, useState, type CSSProperties } from "react";
import { PAINS, type PainGlyph } from "@/components/site/video-content";
import { useShowcase } from "../hooks";
import {
  Actions,
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
   PROBLEME — textele de pe /video, în layoutul din referință.

   Coloana de text e conținutul: simptomul se vede, cauza se deschide
   la cerere, exact ca acum. Graficul din stânga desenează simptomul
   rândului activ; trece singur prin toate șase, iar un clic pe un rând
   îl alege pe acela.

   Desenele arată tiparul din simptom, nu cifre de rezultat. Singurul
   număr e „40 de fotografii”, care e deja în textul simptomului.
   ============================================================ */

const MS = 5200;

/* Eticheta din pastila cardului — aceleași etichete ca desenele de pe
   /video (problem-glyphs.tsx), unde spun ce arată desenul. */
const CAPTION: Record<PainGlyph, string> = {
  saptamana: "Luni – duminică",
  pozele: "40 foto · vizionări",
  agenda: "Agenda săptămânii",
  leaduri: "Lead-uri, pe temperatură",
  curba: "Performanța reclamei",
  tabloul: "Publicat vs distribuit",
};

const v = (o: Record<string, string | number>) => o as CSSProperties;

export function Problems() {
  const show = useShowcase(PAINS.length, MS);
  const [open, setOpen] = useState<number | null>(null);
  const base = useId();
  const pain = PAINS[show.step];
  const Draw = DRAW[pain.glyph];

  return (
    <section id="probleme" className={`${s.section} ${s.lazy}`} aria-labelledby={`${base}-t`}>
      <div className={s.container}>
        <div ref={show.zoneRef} className={s.feature} data-media="left">
          <Rise className={s.featureText}>
            <Title
              id={`${base}-t`}
              eyebrow="Ce te costă acum"
              title="Ce probleme auzim cel mai des."
              dim="Și pe care le și rezolvăm."
            />

            <ul className={s.rows}>
              {PAINS.map((p, i) => {
                const isOpen = open === i;
                return (
                  <li key={p.tag}>
                    <button
                      type="button"
                      className={s.row}
                      data-on={show.step === i ? "" : undefined}
                      aria-expanded={isOpen}
                      aria-controls={`${base}-c${i}`}
                      onClick={() => {
                        setOpen(isOpen ? null : i);
                        show.select(i);
                      }}
                    >
                      <span className="flex items-start justify-between gap-4">
                        <span className="min-w-0">
                          <span className={s.rowTag}>{p.tag}</span>
                          <span className={s.rowTitle}>„{p.symptom}”</span>
                        </span>
                        <span
                          className={`${s.whySign} mt-1 grid size-7 shrink-0 place-items-center rounded-full border border-hair text-dim`}
                          aria-hidden
                        >
                          <Icon name="plus" size={14} />
                        </span>
                      </span>
                      <span className="sr-only"> De ce se întâmplă</span>
                    </button>
                    <div
                      id={`${base}-c${i}`}
                      role="region"
                      aria-label={`De ce se întâmplă: ${p.tag}`}
                      className={s.acc}
                      data-open={isOpen ? "" : undefined}
                    >
                      <div>
                        <p className={`${s.rowBody} pb-3 pl-[18px] pr-12`}>
                          <span className="text-bone">De ce se întâmplă. </span>
                          {p.cause}
                        </p>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Rise>

          <Rise className={s.featureMedia} delay={80}>
            <MotionCard show={show} label="problemele, una câte una">
              <CardHead label={pain.tag} pill={CAPTION[pain.glyph]} />
              <StepTrack show={show} count={PAINS.length} ms={MS} />
              <div key={show.step} className={g.body}>
                <Draw />
              </div>
            </MotionCard>
          </Rise>

          <Rise className={s.featureActions} delay={120}>
            <Actions
              className="mt-2 lg:mt-0"
              note="Te-ai recunoscut într-unul? Hai să vorbim despre el."
            />
          </Rise>
        </div>
      </div>
    </section>
  );
}

/* ---------------- desenele ---------------- */

const DRAW: Record<PainGlyph, () => React.ReactNode> = {
  saptamana: Week,
  pozele: Photos,
  agenda: Agenda,
  leaduri: Leads,
  curba: Curve,
  tabloul: Shelf,
};

/* HORECA — mesele ocupate seara, pe zile: weekendul plin, marțea goală. */
const DAYS = ["L", "M", "M", "J", "V", "S", "D"];
const TAKEN = [2, 0, 2, 3, 4, 5, 5];

function Week() {
  return (
    <div className={g.week}>
      {DAYS.map((d, k) => {
        const hot = k === 1;
        return (
          <div key={k} className="flex min-w-0 flex-col justify-end">
            <div className={`${g.day} ${hot ? g.dayHot : ""}`}>
              {Array.from({ length: 5 }).map((_, j) => {
                const on = j < TAKEN[k];
                return (
                  <span
                    key={j}
                    className={`${g.table} ${on ? g.tableOn : hot ? g.tableEmpty : ""} ${g.pop}`}
                    style={v({ "--i": k * 4 + j, "--step": "34ms" })}
                  />
                );
              })}
              {hot && <span className={g.flag}>Marți, 19:00 · mese goale</span>}
            </div>
            <p className={`${g.dayName} ${hot ? g.dayNameHot : ""}`}>{d}</p>
          </div>
        );
      })}
    </div>
  );
}

/* Imobiliare — 40 de fotografii, zero vizionări serioase. */
const HUES = [28, 210, 36, 200, 18, 42, 220, 30];

function Photos() {
  return (
    <>
      <div className={g.stats}>
        <span className={g.stat}>
          <span className={`${g.num} ${g.count}`} style={v({ "--to": 40 })} />
          <span className={g.unit}>fotografii</span>
        </span>
        <span className={g.stat}>
          <span className={`${g.num} ${g.numBlue}`}>0</span>
          <span className={g.unit}>vizionări serioase</span>
        </span>
      </div>
      <div className={g.photos}>
        {Array.from({ length: 40 }).map((_, i) => (
          <span
            key={i}
            className={`${g.photo} ${g.pop}`}
            style={v({
              "--i": i,
              "--step": "30ms",
              "--h": HUES[(i * 5) % HUES.length],
              "--a": `${140 + ((i * 37) % 60)}deg`,
            })}
          />
        ))}
      </div>
      <span className={g.swipe}>
        <Icon name="arrowRight" size={13} className="rotate-90" />
        Cumpărătorul derulează mai departe
      </span>
    </>
  );
}

/* Wellness — reclamele merg, agenda rămâne cu ferestre. */
const HOURS = ["09", "11", "13", "15", "17", "19"];
const BOOKED = new Set(["0-1", "1-3", "2-0", "3-2", "4-4", "0-4", "2-5", "4-1"]);

function Agenda() {
  let gap = 0;
  return (
    <>
      <div className={g.adbar}>
        <span className={g.live}>
          <span className={g.liveDot} />
          Reclame active
        </span>
        <span className={g.spend} />
      </div>
      <div className={g.agenda}>
        <span />
        {["L", "M", "M", "J", "V"].map((d, i) => (
          <span key={i} className={`${g.hour} text-center`}>
            {d}
          </span>
        ))}
        {HOURS.map((h, r) => (
          <AgendaRow key={h} hour={h}>
            {[0, 1, 2, 3, 4].map((c) =>
              BOOKED.has(`${c}-${r}`) ? (
                <span
                  key={c}
                  className={`${g.slot} ${g.slotOn} ${g.pop}`}
                  style={v({ "--i": r + c, "--step": "90ms", "--at": "200ms" })}
                />
              ) : (
                <span
                  key={c}
                  className={`${g.slot} ${g.slotGap}`}
                  style={v({ "--i": gap++ % 7 })}
                />
              )
            )}
          </AgendaRow>
        ))}
      </div>
      <div className={g.legend}>
        <span>
          <i className={g.swatch} style={{ background: "#3b82f6" }} />
          programat
        </span>
        <span>
          <i
            className={g.swatch}
            style={{ border: "1px dashed rgb(147 197 253 / 0.7)" }}
          />
          ferestre libere
        </span>
      </div>
    </>
  );
}

function AgendaRow({ hour, children }: { hour: string; children: React.ReactNode }) {
  return (
    <>
      <span className={g.hour}>{hour}</span>
      {children}
    </>
  );
}

/* Auto — stocul stă pe loc, lead-urile care vin sunt reci. */
const STOCK = ["SUV · 2021", "Hatchback · 2020", "Sedan · 2022", "Break · 2019"];

function Leads() {
  return (
    <div className={g.split}>
      <div>
        <p className={g.colHead}>Stoc</p>
        {STOCK.map((c, i) => (
          <div key={c} className={`${g.car} ${g.pop}`} style={v({ "--i": i })}>
            <CarIcon />
            <span className={g.carText}>
              <span className={g.carName}>{c}</span>
              <span className={g.carState}>în stoc, neschimbat</span>
            </span>
          </div>
        ))}
      </div>
      <div>
        <p className={g.colHead}>Lead-uri noi</p>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={g.lead} style={v({ "--i": i })}>
            <span className={g.avatar} />
            <span className={g.bars}>
              <i className={g.bar} />
              <i className={g.bar} style={{ width: `${48 + ((i * 17) % 30)}%` }} />
            </span>
            <span className={g.cold}>
              <SnowIcon />
              rece
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CarIcon() {
  return (
    <svg viewBox="0 0 32 18" className={g.carIcon} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
      <path d="M2 12.5V10l3-1.2L9 4h10.5l4.5 4.6 4.6 1.1 1.4 1.3v1.5" />
      <circle cx="8.5" cy="13.5" r="2.5" />
      <circle cx="24" cy="13.5" r="2.5" />
      <path d="M11 13.5h10.5" />
    </svg>
  );
}

function SnowIcon() {
  return (
    <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7" />
    </svg>
  );
}

/* eCommerce — reclama care mergea luna trecută se stinge brusc. */
function Curve() {
  const line =
    "M 6 188 C 60 176 96 132 140 92 C 168 66 186 46 204 44 C 222 42 228 70 240 118 C 252 160 270 182 300 188 C 330 193 360 194 394 195";
  return (
    <div className={g.chart}>
      <svg viewBox="0 0 400 230" preserveAspectRatio="none">
        <defs>
          <linearGradient id="hx-area" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#3b82f6" stopOpacity="0.35" />
            <stop offset="1" stopColor="#3b82f6" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[40, 90, 140, 190].map((y) => (
          <line key={y} className={g.gridline} x1="0" x2="400" y1={y} y2={y} />
        ))}
        <line className={g.divider} x1="222" x2="222" y1="10" y2="205" />
        <path className={g.area} d={`${line} L 394 205 L 6 205 Z`} fill="url(#hx-area)" />
        <path className={g.curve} d={line} pathLength={1} />
        <circle className={g.dot} cx="394" cy="195" r="6" />
      </svg>
      <span className={g.note} style={v({ left: "30%", top: "2%", "--at": "1200ms" })}>
        Aceeași reclamă
      </span>
      <span className={g.note} style={v({ right: "0", bottom: "22%", "--at": "2300ms" })}>
        S-a stins
      </span>
      <div className={g.axis}>
        <span>Luna trecută</span>
        <span>Luna asta</span>
      </div>
    </div>
  );
}

/* Toate — un clip frumos, publicat, pe care nu l-a distribuit nimeni. */
function Shelf() {
  return (
    <>
      <div className={g.frameArt}>
        <div className={g.art}>
          <span className={g.artPlay}>
            <span>
              <Icon name="play" size={16} className="ml-0.5" />
            </span>
          </span>
          <span className={g.artBar} />
        </div>
      </div>
      <div className={g.statusRows}>
        <div className={g.status}>
          <span className={g.statusName}>Publicat</span>
          <span className={g.statusBar} style={v({ "--k": 1, "--at": "300ms" })} />
          <span className={g.statusVal} data-ok="">
            gata
          </span>
        </div>
        <div className={g.status}>
          <span className={g.statusName}>Distribuit</span>
          <span className={g.statusBar} style={v({ "--k": 0, "--at": "1100ms" })} />
          <span className={g.statusVal}>nimic</span>
        </div>
      </div>
    </>
  );
}
