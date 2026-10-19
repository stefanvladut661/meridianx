"use client";

import { useId, type ReactNode } from "react";
import { Mark } from "@/components/site/mark";
import { Aperture, SystemNodes } from "./card-icons";
import {
  CARD,
  COPY,
  FONT,
  GLOBE,
  ICON,
  PEOPLE,
  SAFE,
  SITE,
  T,
  Y,
  meridianCurve,
  sideX,
  type MetalSide,
} from "./card-geometry";

/* ============================================================
   PE CARTON, COLOR — 07…10. Modelul 02 cu amândoi, pe hârtie.

   Aceeași structură ca pe metal, la aceleași cote (card-geometry):
   divizia sus, omul jos, globul cu marca pe cusătură, MERIDIANX la
   bază. Ce se schimbă de la o variantă la alta nu e așezarea, ci
   MATERIALUL logicii — cum e purtată despărțirea dintre lumi:

     07 Cerneală   — moștenitorul direct al lui 02: câmp de cerneală
                     contra hârtie, lumină din colț, filigran la 20%.
     08 Bloc       — indigo plin contra verde plin, text alb. Culoarea
                     nu mai e ton, e bloc. Filigranul e o umbră a
                     câmpului, nu o culoare în plus.
     09 Geodezică  — cusătura nu mai e dreaptă: e un arc de meridian
                     în S, iar câmpurile curg unul în altul. Globul
                     stă cu polul de sus pe hârtie și cu cel de jos în
                     cerneală.
     10 Folio      — o singură hârtie bone pentru amândoi; lumile se
                     despart doar prin culoarea cernelii. Marca e disc
                     de folio argintiu, MERIDIANX e timbru sec.

   Pe carton nu există constrângeri de gravură, deci filigranul e din
   nou plin și translucid, sub text, ca la 02 — dar coborât doar
   0,4 mm sub muchie, ca piciorul lui E să rămână vizibil.

   Tot ce trece peste cusătură (site-ul, globul, filigranul, marca)
   se desenează de două ori: o dată în culorile software, pe toată
   cartea, și o dată în culorile video, tăiat la forma câmpului video.
   Așa fiecare bucată ia culoarea lumii pe care stă, indiferent dacă
   cusătura e dreaptă sau curbă.
   ============================================================ */

/** Culorile unei lumi pe o carte. Fixe, nu din variabile CSS: la
    tipar culorile trebuie să fie aceleași pe orice ecran. */
type Tone = {
  field: string;
  text: string;
  muted: string;
  accent: string;
  line: string;
  wm: string;
};

export type PaperModel = {
  id: string;
  name: string;
  note: string;
  /** Ce se cere tipografiei. */
  print: string;
  seam: "straight" | "geodesic";
  video: Tone;
  software: Tone;
  badge: { disc: string; ring?: string; mark: string } | "split" | "foil";
  seamLine?: string;
  /** Lumină difuză din colțul de sus al câmpului video. */
  light?: boolean;
  /** Gradient de cerneală pe câmpul video, de sus în jos. */
  inkGradient?: [string, string];
  /** Filigranul în timbru sec (relief fără culoare). */
  emboss?: boolean;
};

const INK: Tone = {
  field: "#10122A",
  text: "#F2F3F8",
  muted: "rgba(242,243,248,0.82)",
  accent: "#A9B0FF",
  line: "rgba(169,176,255,0.62)",
  wm: "rgba(169,176,255,0.2)",
};

const PAPER: Tone = {
  field: "#EDF2EE",
  text: "#12171B",
  muted: "rgba(18,23,27,0.78)",
  accent: "#14543F",
  line: "rgba(28,110,84,0.5)",
  wm: "rgba(28,110,84,0.22)",
};

const BONE = "#F4F3EE";

export const PAPER_MODELS: PaperModel[] = [
  {
    id: "07",
    name: "Cerneală",
    seam: "straight",
    video: INK,
    software: PAPER,
    badge: { disc: "#0F1127", ring: "rgba(169,176,255,0.35)", mark: "#A9B0FF" },
    seamLine: "rgba(255,255,255,0.16)",
    light: true,
    inkGradient: ["#171B44", "#0B0C1F"],
    note: "Moștenitorul direct al lui 02, cu amândoi pe carte. Cerneala video e un gradient care se stinge spre jos, cu lumină din colțul de sus; hârtia software rămâne calmă. Filigranul ia culoarea lumii pe care stă.",
    print: "Carton 350 g mat · CMYK · lac selectiv UV pe glob și marcă",
  },
  {
    id: "08",
    name: "Bloc",
    seam: "straight",
    video: {
      field: "#5B5BF0",
      text: "#FFFFFF",
      muted: "rgba(255,255,255,0.86)",
      accent: "#FFFFFF",
      line: "rgba(255,255,255,0.72)",
      wm: "rgba(12,12,60,0.24)",
    },
    software: {
      field: "#1C6E54",
      text: "#FFFFFF",
      muted: "rgba(255,255,255,0.86)",
      accent: "#FFFFFF",
      line: "rgba(255,255,255,0.72)",
      wm: "rgba(3,28,20,0.26)",
    },
    badge: "split",
    note: "Culoarea nu mai e ton, e bloc: indigo plin contra verde plin, text alb pe amândouă. Marca stă pe un disc alb și își schimbă culoarea la cusătură. Filigranul e o umbră a câmpului, nu o a treia culoare — cartea rămâne cu două.",
    print: "Carton 350 g mat · CMYK sau 2 Pantone · muchii vopsite (edge painting) indigo / verde",
  },
  {
    id: "09",
    name: "Geodezică",
    seam: "geodesic",
    video: INK,
    software: PAPER,
    badge: { disc: "#0F1127", ring: "rgba(169,176,255,0.35)", mark: "#A9B0FF" },
    note: "Cusătura nu mai e dreaptă: e un arc de meridian în S, exact motivul de pe site. Câmpurile curg unul în altul, globul stă cu polul de sus pe hârtie și cu cel de jos în cerneală, iar MERIDIANX se rupe pe curbă, nu pe verticală.",
    print: "Carton 350 g mat · CMYK · opțional folio argintiu pe marcă",
  },
  {
    id: "10",
    name: "Folio",
    seam: "straight",
    video: {
      field: BONE,
      text: "#12171B",
      muted: "rgba(18,23,27,0.7)",
      accent: "#4A4CE0",
      line: "rgba(74,76,224,0.6)",
      wm: "transparent",
    },
    software: {
      field: BONE,
      text: "#12171B",
      muted: "rgba(18,23,27,0.7)",
      accent: "#1C6E54",
      line: "rgba(28,110,84,0.6)",
      wm: "transparent",
    },
    badge: "foil",
    seamLine: "rgba(18,23,27,0.14)",
    emboss: true,
    note: "Varianta tactilă: o singură hârtie bone pentru amândoi, lumile se despart doar prin culoarea cernelii — indigo la video, verde la software. Marca e un disc de folio argintiu, MERIDIANX e timbru sec: se simte, nu se vede decât în lumină razantă.",
    print: "Carton 400 g necretat, bone · 2 culori · folio argintiu la cald pe marcă · timbru sec pe MERIDIANX",
  },
];

const W = CARD.w;
const H = CARD.h;
const CX = W / 2;

/** Filigranul coboară 0,4 mm sub muchie: literele ating marginea,
    dar piciorul lui E (1,5 mm) rămâne vizibil. */
const WM_SIZE = 15;
const WM_BASELINE = H + 0.4;

/** Forma câmpului video. La cusătura geodezică e un S cubic care
    trece exact prin centrul globului: punctele de control sunt la
    ±20 mm de axă, iar suma ordonatelor lor (16 + 30) dă mijlocul
    curbei la 23,5 — centrul globului. Bombarea maximă e ~5,5 mm. */
function leftField(seam: PaperModel["seam"]) {
  if (seam === "geodesic") {
    return `M${CX} 0 C${CX - 20} 16, ${CX + 20} 30, ${CX} ${H} L0 ${H} L0 0 Z`;
  }
  return `M0 0 H${CX} V${H} H0 Z`;
}

function Ink({
  x,
  y,
  size,
  fill,
  anchor = "start",
  weight = 500,
  tracking = 0,
  tabular = false,
  children,
}: {
  x: number;
  y: number;
  size: number;
  fill: string;
  anchor?: "start" | "middle" | "end";
  weight?: number;
  tracking?: number;
  tabular?: boolean;
  children: string;
}) {
  return (
    <text
      x={anchor === "end" ? x + tracking * size : x}
      y={y}
      fontSize={size}
      fontWeight={weight}
      textAnchor={anchor}
      fill={fill}
      className="font-md-display"
      style={{
        letterSpacing: tracking ? `${tracking}em` : undefined,
        fontVariantNumeric: tabular ? "tabular-nums" : undefined,
      }}
    >
      {children}
    </text>
  );
}

function Wordmark({ fill, dx = 0, dy = 0 }: { fill: string; dx?: number; dy?: number }) {
  return (
    <text
      x={CX + dx}
      y={WM_BASELINE + dy}
      fontSize={WM_SIZE}
      fontWeight={FONT.wordmark.weight}
      textAnchor="middle"
      fill={fill}
      className="font-md-display"
      style={{ letterSpacing: `${FONT.wordmark.tracking}em` }}
    >
      MERIDIANX
    </text>
  );
}

const curvePath = (dir: -1 | 1) => {
  const { p0, c1, c2, p1 } = meridianCurve(dir);
  return `M${p0[0]} ${p0[1]} C${c1[0]} ${c1[1]}, ${c2[0]} ${c2[1]}, ${p1[0]} ${p1[1]}`;
};

/** Globul lui 02 — cerc plus două meridiane — într-o singură culoare;
    culoarea per lume o dă Split. Grosimea e cea de pe 02 (1,1 în
    viewBox 340 ≈ 0,28 mm). */
function GlobeLines({ stroke }: { stroke: string }) {
  const { cx, cy, r } = GLOBE;
  return (
    <g fill="none" stroke={stroke} strokeWidth={0.28}>
      <circle cx={cx} cy={cy} r={r} />
      <path d={curvePath(-1)} />
      <path d={curvePath(1)} />
    </g>
  );
}

function Person({ side, tone }: { side: MetalSide; tone: Tone }) {
  const isVideo = side === "video";
  const x = sideX(side);
  const DisciplineMark = isVideo ? Aperture : SystemNodes;
  return (
    <g>
      <g
        transform={`translate(${x.icon} ${Y.division - ICON.size * 0.75})`}
        style={{ color: tone.accent }}
      >
        <DisciplineMark size={String(ICON.size)} />
      </g>
      <Ink
        x={x.division}
        y={Y.division}
        size={T.division}
        weight={FONT.division.weight}
        tracking={FONT.division.tracking}
        anchor={x.anchor}
        fill={tone.accent}
      >
        {COPY[side].division}
      </Ink>
      <Ink
        x={x.edge}
        y={Y.descriptor}
        size={T.descriptor}
        weight={FONT.descriptor.weight}
        anchor={x.anchor}
        fill={tone.muted}
      >
        {COPY[side].descriptor}
      </Ink>
      <Ink
        x={x.edge}
        y={Y.name}
        size={T.name}
        weight={FONT.name.weight}
        tracking={FONT.name.tracking}
        anchor={x.anchor}
        fill={tone.text}
      >
        {PEOPLE[side].name}
      </Ink>
      <Ink
        x={x.edge}
        y={Y.phone}
        size={T.phone}
        weight={FONT.phone.weight}
        tabular
        anchor={x.anchor}
        fill={tone.text}
      >
        {PEOPLE[side].phone}
      </Ink>
    </g>
  );
}

export function PaperGuides() {
  return (
    <g fill="none" stroke="rgb(255 90 90 / 0.8)" strokeWidth={0.15}>
      <rect
        x={SAFE}
        y={SAFE}
        width={W - 2 * SAFE}
        height={H - 2 * SAFE}
        strokeDasharray="0.8 0.6"
      />
      <line x1={CX} y1={0} x2={CX} y2={H} strokeDasharray="0.8 0.6" />
    </g>
  );
}

export function PaperCard({ model, guides }: { model: PaperModel; guides: boolean }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const left = leftField(model.seam);
  const leftClip = `${id}-left`;
  const { video: v, software: s } = model;
  const { cx, cy, badge } = GLOBE;
  const mark = 5;

  /** Desenează de două ori: software pe toată cartea, video tăiat la
      câmpul lui. Tot ce stă călare pe cusătură trece pe aici. */
  const Split = ({ render }: { render: (tone: Tone, side: MetalSide) => ReactNode }) => (
    <>
      {render(s, "software")}
      <g clipPath={`url(#${leftClip})`}>{render(v, "video")}</g>
    </>
  );

  return (
    <article
      className="relative isolate overflow-hidden shadow-[0_22px_55px_-24px_rgb(0_0_0/0.8)]"
      style={{
        aspectRatio: `${W} / ${H}`,
        containerType: "inline-size",
        borderRadius: `${((CARD.corner / W) * 100).toFixed(3)}cqw`,
      }}
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="absolute inset-0 h-full w-full"
        role="img"
        aria-label={`Carte de vizită ${model.id} ${model.name}, pe carton`}
      >
        <defs>
          <clipPath id={leftClip}>
            <path d={left} />
          </clipPath>
          {model.inkGradient && (
            <linearGradient id={`${id}-ink`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={model.inkGradient[0]} />
              <stop offset="1" stopColor={model.inkGradient[1]} />
            </linearGradient>
          )}
          {model.light && (
            <radialGradient
              id={`${id}-light`}
              gradientUnits="userSpaceOnUse"
              cx="0"
              cy="0"
              r="42"
            >
              <stop offset="0" stopColor="#5B5BF0" stopOpacity="0.5" />
              <stop offset="1" stopColor="#5B5BF0" stopOpacity="0" />
            </radialGradient>
          )}
          {model.badge === "foil" && (
            <linearGradient id={`${id}-foil`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#E9E7E1" />
              <stop offset="0.42" stopColor="#ADAAA2" />
              <stop offset="0.58" stopColor="#DDDBD5" />
              <stop offset="1" stopColor="#8F8C85" />
            </linearGradient>
          )}
        </defs>

        {/* câmpurile */}
        <rect width={W} height={H} fill={s.field} />
        <path d={left} fill={model.inkGradient ? `url(#${id}-ink)` : v.field} />
        {model.light && <path d={left} fill={`url(#${id}-light)`} />}

        {/* filigranul — sub tot, ca la 02 */}
        {model.emboss ? (
          <>
            <Wordmark fill="rgba(0,0,0,0.13)" dx={0.16} dy={0.16} />
            <Wordmark fill="rgba(255,255,255,0.96)" dx={-0.16} dy={-0.16} />
            <Wordmark fill={BONE} />
          </>
        ) : (
          <Split render={(tone) => <Wordmark fill={tone.wm} />} />
        )}

        {/* cusătura, sub glob și sub marcă */}
        {model.seamLine && (
          <line x1={CX} y1={0} x2={CX} y2={H} stroke={model.seamLine} strokeWidth={0.2} />
        )}

        {/* globul */}
        <Split render={(tone) => <GlobeLines stroke={tone.line} />} />

        {/* marca, călare pe cusătură */}
        {model.badge === "split" ? (
          <>
            <circle cx={cx} cy={cy} r={badge} fill="#FFFFFF" />
            <Split
              render={(tone) => (
                <g
                  transform={`translate(${cx - mark / 2} ${cy - mark / 2})`}
                  style={{ color: tone.field }}
                >
                  <Mark size={mark} />
                </g>
              )}
            />
          </>
        ) : model.badge === "foil" ? (
          <>
            <circle cx={cx} cy={cy} r={badge} fill={`url(#${id}-foil)`} />
            <circle
              cx={cx}
              cy={cy}
              r={badge}
              fill="none"
              stroke="rgba(18,23,27,0.14)"
              strokeWidth={0.2}
            />
            <g
              transform={`translate(${cx - mark / 2} ${cy - mark / 2})`}
              style={{ color: BONE }}
            >
              <Mark size={mark} />
            </g>
          </>
        ) : (
          <>
            <circle cx={cx} cy={cy} r={badge} fill={model.badge.disc} />
            {model.badge.ring && (
              <circle
                cx={cx}
                cy={cy}
                r={badge}
                fill="none"
                stroke={model.badge.ring}
                strokeWidth={0.2}
              />
            )}
            <g
              transform={`translate(${cx - mark / 2} ${cy - mark / 2})`}
              style={{ color: model.badge.mark }}
            >
              <Mark size={mark} />
            </g>
          </>
        )}

        {/* oamenii */}
        <Person side="video" tone={v} />
        <Person side="software" tone={s} />

        {/* site-ul, pe axa cusăturii */}
        <Split
          render={(tone) => (
            <Ink
              x={CX}
              y={Y.division}
              size={T.site}
              weight={FONT.site.weight}
              tracking={FONT.site.tracking}
              anchor="middle"
              fill={tone.muted}
            >
              {SITE}
            </Ink>
          )}
        />

        {guides && <PaperGuides />}
      </svg>
    </article>
  );
}
