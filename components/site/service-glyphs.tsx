import type { CSSProperties, ReactNode } from "react";
import type { ServiceGlyph } from "./video-content";
import s from "./service-glyphs.module.css";

/* ============================================================
   Glifele din „Servicii” (/video).

   Fiecare serviciu are un desen care arată MESERIA, nu o iconiță de
   librărie: aceeași marcă în trei formate, reticulul care alege omul
   din casting, cele trei canale care alimentează o singură curbă,
   panoul care se aprinde și trimite în telefon.

   Regula de aici e aceeași cu cea de la problem-glyphs: desenul
   trebuie să se înțeleagă fără titlu. Dacă ai nevoie de titlu ca să
   pricepi desenul, desenul e decor.

   Toate au 320×84 și trăiesc în <ServiceGlyph>, care le fixează
   înălțimea. Culorile vin din tokens — dacă se schimbă accentul lumii
   video, se schimbă și desenele.
   ============================================================ */

export const SERVICE_GLYPHS: Record<ServiceGlyph, () => ReactNode> = {
  brand: Brand,
  ugc: Ugc,
  performance: Performance,
  outdoor: Outdoor,
};

/** Rama din card: fixează înălțimea, ca toate cardurile să fie la fel. */
export function GlyphBox({ children }: { children: ReactNode }) {
  return (
    <div className={s.frame} aria-hidden>
      {children}
    </div>
  );
}

const VB = "0 0 320 84";

/* indexul de cascadă, citit de animațiile din CSS */
function iv(i: number, o?: number): CSSProperties {
  const st: Record<string, number> = { "--i": i };
  if (o !== undefined) st["--o"] = o;
  return st as CSSProperties;
}

function len(l: number, i: number): CSSProperties {
  return { ["--len" as string]: l, ["--i" as string]: i } as CSSProperties;
}

/* Arcul de meridian, marca din fiecare format. Firul comun al site-ului
   (CLAUDE.md §2), aici la scara unei miniaturi. */
function Arc({ x, y, r }: { x: number; y: number; r: number }) {
  return (
    <path
      d={`M ${x - r} ${y} A ${r} ${r} 0 0 1 ${x + r} ${y}`}
      className={`${s.draw} ${s.hot}`}
      style={len(r * 3.2, 3)}
    />
  );
}

/* ---------- 1. Imaginea brandului ----------
   Aceeași marcă, trei formate: peliculă 16:9, pătrat de feed, vertical
   de story. Mătura de lumină trece peste toate — asta e „peste tot la
   fel”. */
function Brand() {
  return (
    <svg viewBox={VB}>
      <defs>
        <linearGradient id="svcSweep" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor="var(--md-a1)" stopOpacity="0" />
          <stop offset="50%" stopColor="var(--md-a1)" stopOpacity="0.22" />
          <stop offset="100%" stopColor="var(--md-a1)" stopOpacity="0" />
        </linearGradient>
        {/* Rama glifelor are `overflow: visible`, ca desenele să poată
            depăși cadrul. Mătura trebuie totuși ținută înăuntru —
            altfel se vede parcată în afara cardului. */}
        <clipPath id="svcClip">
          <rect x="0" y="0" width="320" height="84" />
        </clipPath>
      </defs>

      <rect
        x={4}
        y={16}
        width={104}
        height={58}
        rx={6}
        className={s.fill}
        style={iv(0, 0.07)}
      />
      <rect
        x={4}
        y={16}
        width={104}
        height={58}
        rx={6}
        className={s.draw}
        style={len(330, 0)}
      />
      <Arc x={56} y={52} r={22} />
      <text x={4} y={82} className={s.mono} style={iv(6)}>
        16:9
      </text>

      <rect
        x={124}
        y={12}
        width={66}
        height={66}
        rx={6}
        className={s.fill}
        style={iv(1, 0.07)}
      />
      <rect
        x={124}
        y={12}
        width={66}
        height={66}
        rx={6}
        className={s.draw}
        style={len(270, 1)}
      />
      <Arc x={157} y={52} r={16} />
      <text x={124} y={82} className={s.mono} style={iv(7)}>
        1:1
      </text>

      <rect
        x={206}
        y={4}
        width={46}
        height={74}
        rx={6}
        className={s.fill}
        style={iv(2, 0.07)}
      />
      <rect
        x={206}
        y={4}
        width={46}
        height={74}
        rx={6}
        className={s.draw}
        style={len(250, 2)}
      />
      <Arc x={229} y={50} r={13} />
      <text x={206} y={82} className={s.mono} style={iv(8)}>
        9:16
      </text>

      {/* mătura, peste toate trei */}
      <g clipPath="url(#svcClip)">
        <rect x={-30} y={0} width={30} height={84} className={s.sweep} />
      </g>
    </svg>
  );
}

/* ---------- 2. Filmări UGC și cu actori ----------
   Patru oameni în cadre verticale; reticulul sare de la unul la altul.
   Casting, nu „un om cu un telefon”. */
function Ugc() {
  const xs = [8, 82, 156, 230];
  return (
    <svg viewBox={VB}>
      {xs.map((x, k) => (
        <g key={x}>
          <rect
            x={x}
            y={6}
            width={58}
            height={72}
            rx={7}
            className={s.fill}
            style={iv(k, 0.08)}
          />
          <rect
            x={x}
            y={6}
            width={58}
            height={72}
            rx={7}
            className={s.draw}
            style={len(266, k)}
          />
          {/* omul, abstract: cap și umeri */}
          <circle
            cx={x + 29}
            cy={35}
            r={10}
            className={s.draw}
            style={len(64, k + 1)}
          />
          <path
            d={`M ${x + 12} 72 a 17 17 0 0 1 34 0`}
            className={s.draw}
            style={len(56, k + 1)}
          />
        </g>
      ))}

      {/* reticulul de casting — patru colțuri */}
      <g className={s.pick}>
        <path d="M 4 2 h 12 M 4 2 v 12" />
        <path d="M 66 2 h -12 M 66 2 v 12" />
        <path d="M 4 82 h 12 M 4 82 v -12" />
        <path d="M 66 82 h -12 M 66 82 v -12" />
      </g>
    </svg>
  );
}

/* ---------- 3. Performance marketing ----------
   Trei canale intră într-o singură curbă care urcă. Punctul o parcurge
   la nesfârșit: campania nu e un eveniment, e un flux. */
function Performance() {
  const CURVE = "M 62 68 C 110 66, 140 52, 170 40 S 236 16, 258 12";
  return (
    <svg viewBox={VB}>
      {/* canalele */}
      {[
        { y: 20, label: "META" },
        { y: 44, label: "TIKTOK" },
        { y: 68, label: "GOOGLE" },
      ].map((c, k) => (
        <g key={c.label}>
          <circle cx={10} cy={c.y} r={3.5} className={s.feed} style={iv(k)} />
          <text x={20} y={c.y + 3} className={s.mono} style={iv(k)}>
            {c.label}
          </text>
          <path
            d={`M 56 ${c.y} C 60 ${c.y}, 60 68, 64 68`}
            className={s.draw}
            style={len(40, k)}
          />
        </g>
      ))}

      {/* curba, o singură linie care urcă */}
      <path d={CURVE} className={`${s.draw} ${s.hot}`} style={len(230, 3)} />
      <circle cx={62} cy={68} r={3.2} className={s.rider} />

      {/* vârful */}
      <path
        d="M 250 18 l 8 -6 l 2 10"
        className={`${s.draw} ${s.hot}`}
        style={len(24, 5)}
      />
      <text x={236} y={40} className={s.mono} style={iv(6)}>
        Cereri
      </text>
    </svg>
  );
}

/* ---------- 4. Reclamă outdoor ----------
   Panoul se aprinde, iar de la el pleacă o linie spre telefon, unde
   pică cererea. Panoul singur e un afiș; panoul legat de o ofertă e
   marketing. */
function Outdoor() {
  return (
    <svg viewBox={VB}>
      {/* panoul */}
      <rect
        x={6}
        y={8}
        width={150}
        height={52}
        rx={5}
        className={s.lamp}
        style={iv(0)}
      />
      <rect
        x={6}
        y={8}
        width={150}
        height={52}
        rx={5}
        className={s.draw}
        style={len(404, 0)}
      />
      <Arc x={81} y={44} r={22} />
      {/* picioarele */}
      <path
        d="M 48 60 v 20 M 114 60 v 20 M 30 80 h 102"
        className={s.draw}
        style={len(142, 1)}
      />

      {/* drumul spre ofertă */}
      <path
        d="M 160 34 h 56"
        className={`${s.draw} ${s.cool}`}
        style={len(56, 2)}
      />
      <path
        d="M 210 29 l 7 5 l -7 5"
        className={`${s.draw} ${s.cool}`}
        style={len(20, 3)}
      />

      {/* telefonul, cu pingul de cerere */}
      <rect
        x={244}
        y={6}
        width={42}
        height={70}
        rx={8}
        className={s.fill}
        style={iv(3, 0.08)}
      />
      <rect
        x={244}
        y={6}
        width={42}
        height={70}
        rx={8}
        className={s.draw}
        style={len(210, 3)}
      />
      <circle
        cx={265}
        cy={41}
        r={5}
        className={`${s.fill} ${s.hotFill}`}
        style={iv(4, 1)}
      />
      <circle cx={265} cy={41} r={9} className={s.ping} />
    </svg>
  );
}
