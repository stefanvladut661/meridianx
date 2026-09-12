import type { CSSProperties, ReactNode } from "react";
import type { PainGlyph } from "./video-content";
import s from "./problem-glyphs.module.css";

/* ============================================================
   Glifele din „Probleme” (/video).

   Fiecare simptom din PAINS are un desen care îl ARATĂ — nu o iconiță,
   ci chiar situația: marțea goală lângă sâmbăta plină, cele 40 de poze
   și zeroul de lângă ele, agenda cu ferestre, lead-urile reci, curba
   reclamei care se stinge, materialul publicat dar nedistribuit.
   Ochiul citește desenul în jumătate de secundă, apoi propoziția;
   explicația se deschide la cerere.

   Desenele arată tiparul din simptom, nu cifre de rezultat — singurul
   număr e „40 de fotografii”, care e deja în textul simptomului.

   `caption` e eticheta din colțul cardului: spune ce arată desenul.
   Stă lângă desen, nu în content, fiindcă se schimbă doar odată cu el.
   ============================================================ */

export const PROBLEM_GLYPHS: Record<
  PainGlyph,
  { caption: string; Draw: () => ReactNode }
> = {
  saptamana: { caption: "Luni – duminică", Draw: Saptamana },
  pozele: { caption: "40 foto · vizionări", Draw: Pozele },
  agenda: { caption: "Agenda săptămânii", Draw: Agenda },
  leaduri: { caption: "Lead-uri, pe temperatură", Draw: Leaduri },
  curba: { caption: "Performanța reclamei", Draw: Curba },
  tabloul: { caption: "Publicat vs distribuit", Draw: Tabloul },
};

/** Rama din card: fixează înălțimea și lasă SVG-ul să respire. */
export function GlyphFrame({ children }: { children: ReactNode }) {
  return (
    <div className={s.frame} aria-hidden>
      {children}
    </div>
  );
}

const VB = "0 0 320 100";

/* indexul de cascadă, citit de animațiile din CSS */
function iv(i: number): CSSProperties {
  return { ["--i" as string]: i };
}

/* HORECA — săptămâna în bare: weekendul plin, marțea goală. */
function Saptamana() {
  const h = [30, 18, 34, 44, 70, 88, 80];
  const days = ["L", "M", "M", "J", "V", "S", "D"];
  const w = 30;
  const gap = 12;
  const x0 = (320 - (7 * w + 6 * gap)) / 2;
  return (
    <svg viewBox={VB}>
      {h.map((v, k) => {
        const x = x0 + k * (w + gap);
        const hot = k === 1;
        const strong = k >= 5;
        return (
          <g key={k}>
            <rect
              x={x}
              y={84 - v}
              width={w}
              height={v}
              rx={3}
              className={`${s.bar} ${hot ? s.barHot : ""} ${
                strong ? s.barStrong : ""
              }`}
              style={iv(k)}
            />
            <text
              x={x + w / 2}
              y={97}
              textAnchor="middle"
              className={`${s.mono} ${hot ? s.hot : ""}`}
            >
              {days[k]}
            </text>
            {hot && (
              <text
                x={x + w / 2}
                y={84 - v - 8}
                textAnchor="middle"
                className={`${s.mono} ${s.hot} ${s.fade}`}
                style={iv(14)}
              >
                19:00
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/* IMOBILIARE — patruzeci de poze, zero vizionări. */
function Pozele() {
  const size = 16;
  const gap = 4;
  const cells = Array.from({ length: 40 }, (_, k) => ({
    x: 10 + (k % 10) * (size + gap),
    y: 8 + Math.floor(k / 10) * (size + gap),
  }));
  return (
    <svg viewBox={VB}>
      {cells.map((c, k) => (
        <rect
          key={k}
          x={c.x}
          y={c.y}
          width={size}
          height={size}
          rx={2.5}
          className={s.cell}
          style={iv(k)}
        />
      ))}
      <text x={10} y={98} className={s.mono}>
        40 de fotografii
      </text>
      <text x={266} y={70} textAnchor="middle" className={s.zero}>
        0
      </text>
      <text
        x={266}
        y={92}
        textAnchor="middle"
        className={`${s.mono} ${s.fade}`}
        style={iv(40)}
      >
        vizionări
      </text>
    </svg>
  );
}

/* WELLNESS — agenda săptămânii, cu ferestrele punctate. */
function Agenda() {
  const cols = 5;
  const rows = 4;
  const cw = 44;
  const ch = 15;
  const gap = 4;
  const x0 = 42;
  const y0 = 8;
  const empty = [2, 6, 9, 13, 17];
  const hours = ["09", "11", "14", "17"];
  const days = ["L", "M", "M", "J", "V"];
  const cells = Array.from({ length: cols * rows }, (_, k) => ({
    x: x0 + (k % cols) * (cw + gap),
    y: y0 + Math.floor(k / cols) * (ch + gap),
  }));
  return (
    <svg viewBox={VB}>
      {hours.map((t, r) => (
        <text
          key={t}
          x={x0 - 10}
          y={y0 + r * (ch + gap) + ch - 3}
          textAnchor="end"
          className={s.mono}
        >
          {t}
        </text>
      ))}
      {cells.map((c, k) => {
        const e = empty.indexOf(k);
        return e >= 0 ? (
          <rect
            key={k}
            x={c.x + 0.5}
            y={c.y + 0.5}
            width={cw - 1}
            height={ch - 1}
            rx={3}
            className={s.cellEmpty}
            style={iv(e)}
          />
        ) : (
          <rect
            key={k}
            x={c.x}
            y={c.y}
            width={cw}
            height={ch}
            rx={3}
            className={s.cell}
            style={iv(k)}
          />
        );
      })}
      {days.map((d, c) => (
        <text
          key={c}
          x={x0 + c * (cw + gap) + cw / 2}
          y={97}
          textAnchor="middle"
          className={s.mono}
        >
          {d}
        </text>
      ))}
    </svg>
  );
}

/* AUTO — lead-urile care vin: aproape toate reci. */
function Leaduri() {
  const rows = [
    { name: 96, temp: 14, warm: false },
    { name: 70, temp: 22, warm: false },
    { name: 110, temp: 10, warm: false },
    { name: 84, temp: 18, warm: false },
    { name: 92, temp: 86, warm: true },
    { name: 64, temp: 12, warm: false },
  ];
  return (
    <svg viewBox={VB}>
      {rows.map((r, k) => {
        const y = 6 + k * 15.5;
        return (
          <g key={k} className={s.row} style={iv(k)}>
            <circle cx={16} cy={y + 4} r={4} className={s.cold} />
            <rect
              x={28}
              y={y + 1}
              width={r.name}
              height={6}
              rx={3}
              fill="currentColor"
              opacity={0.14}
            />
            <rect
              x={180}
              y={y + 1}
              width={110}
              height={6}
              rx={3}
              fill="currentColor"
              opacity={0.06}
            />
            <rect
              x={180}
              y={y + 1}
              width={r.temp}
              height={6}
              rx={3}
              className={r.warm ? s.warm : s.cold}
            />
            {(k === 0 || r.warm) && (
              <text
                x={296}
                y={y + 7}
                className={`${s.mono} ${r.warm ? s.hot : ""}`}
              >
                {r.warm ? "cald" : "rece"}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/* ECOMMERCE — reclama care urcă, apoi se stinge. Linia punctată e
   frecvența: de câte ori a văzut-o același om. */
function Curba() {
  return (
    <svg viewBox={VB}>
      <path d="M12 90 L300 22" className={s.lineDim} />
      <text x={304} y={18} textAnchor="end" className={s.mono}>
        frecvență
      </text>
      <path
        d="M12 82 C40 74 66 44 112 32 S150 20 176 28 S212 58 238 72 S274 88 302 88"
        pathLength={1}
        className={s.line}
      />
      <text
        x={150}
        y={14}
        textAnchor="middle"
        className={`${s.mono} ${s.hot} ${s.fade}`}
        style={iv(20)}
      >
        luna trecută
      </text>
      <text
        x={302}
        y={100}
        textAnchor="end"
        className={`${s.mono} ${s.fade}`}
        style={iv(46)}
      >
        acum
      </text>
    </svg>
  );
}

/* TOATE — un videoclip frumos: publicat, nedistribuit. */
function Tabloul() {
  return (
    <svg viewBox={VB}>
      <g className={s.fade} style={iv(0)}>
        <rect x={12} y={8} width={124} height={84} rx={8} className={s.plate} />
        <path d="M66 36v28l24-14-24-14Z" className={s.play} />
      </g>
      <g className={s.fade} style={iv(10)}>
        <path d="m164 33 5 5 9-10" className={s.check} />
        <text x={188} y={37} className={s.mono}>
          publicat
        </text>
        <rect
          x={236}
          y={31}
          width={68}
          height={5}
          rx={2.5}
          fill="currentColor"
          opacity={0.35}
        />
      </g>
      <g className={s.fade} style={iv(22)}>
        <text x={162} y={68} className={`${s.mono} ${s.hot}`}>
          distribuit
        </text>
        <path d="M236 65.5h68" className={s.dash} />
      </g>
    </svg>
  );
}
