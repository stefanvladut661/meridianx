"use client";

import {
  useId,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { Mark } from "@/components/site/mark";
import { Aperture, SystemNodes } from "./card-icons";
import { PAPER_MODELS, PaperCard } from "./paper-cards";
import {
  COPY,
  FONT,
  GLOBE,
  HALO,
  ICON,
  LINE,
  CARD,
  PEOPLE,
  SAFE,
  SITE,
  T as MT,
  WORDMARK,
  Y,
  meridianCurve,
  sideX,
  wordmarkBaseline,
  type MetalSide,
} from "./card-geometry";

/* ============================================================
   MODELE DE CARTE DE VIZITĂ — masă de lucru, nu pagină de site.

   Cartea e împărțită în două pe verticală, exact cum e împărțită
   firma: stânga VIDEO, dreapta SOFTWARE. Despărțitura nu e decor —
   e modelul de business făcut obiect, și e singurul lucru de pe
   carte care nu poate fi copiat de un concurent.

   Culoarea poartă divizia, nu o decorează: jumătatea video stă pe
   un câmp albastru-cerneală, jumătatea software pe hârtie trasă în
   verde, iar filigranul MERIDIAN — cel mai mare element de pe carte
   — ia culoarea lumii pe care stă. Toate tonurile ies prin
   `color-mix` din `--md-a1`/`--md-a2` ale scope-ului, deci dacă se
   schimbă paleta site-ului, se schimbă și cărțile.

   Contrastele au fost calculate, nu aproximate: text pe câmpul
   albastru 16.8:1, eticheta diviziei 9.2:1, verdele pe hârtie
   5.4:1. Toate peste pragul AA — și niciun sens nu e purtat DOAR de
   culoare, fiindcă o carte de vizită ajunge și scanată alb-negru.

   Unitatea de măsură peste tot e `cqw` (procent din lățimea cărții),
   nu px: cartea e un obiect tipărit de 85mm, deci tot ce stă pe ea
   se măsoară raportat la lățimea ei. Așa 1mm devine exact
   (100/85)cqw — cartea arată identic la orice scară, iar ghidajele
   de tipar sunt corecte, nu aproximative.

   Corpurile de literă sunt alese în puncte tipografice, nu din ochi:
   nimic sub 2.4mm (~6.8pt), fiindcă sub pragul ăsta un număr de
   telefon nu se citește într-un restaurant prost luminat — care e
   exact locul unde se citește.
   ============================================================ */

const CARD_W_MM = 85;
const CARD_H_MM = 55;
const BLEED_MM = 3;
const SAFE_MM = 4;
const PAD_MM = 5;

/** 1mm din cartea reală, exprimat în procente din lățimea ei. */
const MM = 100 / CARD_W_MM;
const mm = (n: number) => `${(n * MM).toFixed(3)}cqw`;

/** Scara tipografică, în mm reali de pe carte. (1mm ≈ 2.83pt) */
const T = {
  name: 3.8, // ~10.8pt — numele și telefonul, capetele ierarhiei
  division: 2.7, // ~7.6pt — divizia, versale, cu accent de culoare
  descriptor: 2.6, // ~7.4pt — cele două-trei cuvinte despre ce facem
  minor: 2.4, // ~6.8pt — rolul și adresa; podeaua de lizibilitate
};

const PERSON = {
  name: "Ștefan Brînzaru",
  role: "Fondator",
  phone: "0771 738 607",
  site: "meridianx.ro",
};

/* Descriptorii vin din poziționarea scrisă în `video-content.ts` și
   `software-content.ts`, nu sunt inventați aici: video vinde
   producție și reclame, nu filmări; software nu vinde licențe,
   construiește sisteme pe măsură. Trei cuvinte fiecare — cât să
   lămurească, nu cât să explice. */
const SIDE = {
  video: {
    division: "VIDEO",
    descriptor: "Producție și reclame",
    lead: PERSON.name,
    minor: PERSON.role,
  },
  software: {
    division: "SOFTWARE",
    descriptor: "Sisteme la comandă",
    lead: PERSON.phone,
    minor: PERSON.site,
  },
} as const;

type Side = keyof typeof SIDE;

type Model = {
  id: string;
  name: string;
  note: string;
  /** Cum se întâlnesc cele două lumi la mijloc. */
  seam: "hair" | "arc" | "node";
  /** Marca MERIDIAN, călare pe cusătură. */
  badge: boolean;
  /** Lumină difuză din colțul de sus al jumătății video. */
  bleed: boolean;
  /** Grilă de blueprint pe jumătatea software. */
  grid: boolean;
};

const MODELS: Model[] = [
  {
    id: "01",
    name: "Câmp",
    note: "Culoarea stă în câmpuri, nu în accente: albastru-cerneală la video, hârtie trasă în verde la software, cu lumină difuză din colț. Cusătura e doar muchia dintre ele.",
    seam: "hair",
    badge: false,
    bleed: true,
    grid: false,
  },
  {
    id: "02",
    name: "Arc",
    note: "Aceleași câmpuri, dar arcul de meridian traversează cusătura și marca stă călare pe ea — cele două lumi se ating, nu doar se învecinează.",
    seam: "arc",
    badge: true,
    bleed: false,
    grid: false,
  },
  {
    id: "03",
    name: "Nod",
    note: "Varianta liniștită: un singur nod pe cusătură, la mijloc. Aceeași structură, cea mai puțină grafică.",
    seam: "node",
    badge: false,
    bleed: false,
    grid: false,
  },
  {
    id: "04",
    name: "Grilă",
    note: "Grilă de blueprint pe jumătatea software — temperamentul diviziei, adus pe hârtie.",
    seam: "hair",
    badge: false,
    bleed: true,
    grid: true,
  },
];

/* ------------------------------------------------------------
   Elementele care trebuie să se alinieze PESTE cusătură —
   filigranul și arcul — se desenează o dată în fiecare jumătate, la
   lățimea întregii cărți, ancorate de marginea exterioară a
   jumătății. Fiecare jumătate are `overflow: hidden`, deci își taie
   singură porțiunea, iar cele două bucăți se întâlnesc exact,
   fiecare cu culoarea lumii ei. Fără clip-path, fără măsurători.
   ------------------------------------------------------------ */
function spanStyle(isVideo: boolean): CSSProperties {
  return { width: "200%", [isVideo ? "left" : "right"]: 0 };
}

/** Filigranul MERIDIAN din subsolul site-ului, coborât pe carte.
    E cel mai mare element de pe carte, deci e și locul unde culoarea
    diviziei are cel mai mult de spus. */
function Watermark({ isVideo }: { isVideo: boolean }) {
  return (
    <p
      aria-hidden
      className="pointer-events-none absolute bottom-0 select-none text-center font-md-display font-semibold"
      style={{
        ...spanStyle(isVideo),
        fontSize: "19cqw",
        lineHeight: 0.78,
        letterSpacing: "-0.035em",
        marginBottom: "-0.16em",
        color: isVideo
          ? "color-mix(in oklab, var(--md-a2) 20%, transparent)"
          : "color-mix(in oklab, var(--md-a1) 26%, transparent)",
      }}
    >
      MERIDIAN
    </p>
  );
}

/** Arcul de meridian, în geometria de pe site, redus la scara cărții.
    La video e lumină (accentul deschis), la software e o geodezică
    desenată — aceleași două temperamente ca pe landing-uri. */
function SeamArc({ isVideo }: { isVideo: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 340 220"
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-y-0"
      style={{ ...spanStyle(isVideo), height: "100%" }}
      fill="none"
    >
      <g
        stroke={isVideo ? "var(--md-a2)" : "var(--md-a1)"}
        strokeOpacity={isVideo ? 0.62 : 0.5}
      >
        <circle cx="170" cy="110" r="72" strokeWidth="1.1" />
        <path d="M170 38 C 124 63, 124 157, 170 182" strokeWidth="1.1" />
        <path d="M170 38 C 216 63, 216 157, 170 182" strokeWidth="1.1" />
      </g>
    </svg>
  );
}

/** Grilă de blueprint — doar pe jumătatea software, ca pe landing. */
function BlueprintGrid() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0"
      style={{
        backgroundImage:
          "linear-gradient(color-mix(in oklab, var(--md-a1) 16%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in oklab, var(--md-a1) 16%, transparent) 1px, transparent 1px)",
        backgroundSize: `${mm(5)} ${mm(5)}`,
        maskImage: "linear-gradient(to bottom, #000 20%, transparent 88%)",
      }}
    />
  );
}

function Half({ side, model }: { side: Side; model: Model }) {
  const isVideo = side === "video";
  const copy = SIDE[side];
  const DisciplineMark = isVideo ? Aperture : SystemNodes;

  return (
    <div
      data-scope={side}
      className="relative w-1/2 overflow-hidden text-bone"
      style={{
        /* Câmpul poartă divizia. Albastrul iese din accentul lumii
           video, verdele din cel software — deci rămân legate de
           paletă, nu sunt două hexuri copiate aici. */
        background: isVideo
          ? "color-mix(in oklab, var(--md-a1) 16%, var(--md-bg))"
          : "color-mix(in oklab, var(--md-a3) 7%, var(--md-bg))",
      }}
    >
      {model.grid && !isVideo && <BlueprintGrid />}

      {model.bleed && isVideo && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 0% 0%, color-mix(in oklab, var(--md-a1) 45%, transparent), transparent 68%)",
          }}
        />
      )}

      {model.seam === "arc" && <SeamArc isVideo={isVideo} />}
      <Watermark isVideo={isVideo} />

      <div
        className="relative z-10 flex h-full flex-col justify-between"
        style={{ padding: mm(PAD_MM) }}
      >
        <div className={isVideo ? "" : "flex flex-col items-end text-right"}>
          <div className="flex items-center" style={{ gap: mm(1.6) }}>
            {/* Semnul disciplinei stă înaintea numelui ei la video și
                după el la software — jumătățile se oglindesc, ca
                privirea să plece dinspre cusătură spre exterior. */}
            {isVideo && (
              <span className="text-a2">
                <DisciplineMark size={mm(4)} />
              </span>
            )}
            <span
              className="font-md-display font-bold uppercase leading-none text-a2"
              style={{ fontSize: mm(T.division), letterSpacing: "0.16em" }}
            >
              {copy.division}
            </span>
            {!isVideo && (
              <span className="text-a1">
                <DisciplineMark size={mm(4)} />
              </span>
            )}
          </div>

          <p
            className="text-bone/85"
            style={{
              fontSize: mm(T.descriptor),
              marginTop: mm(1.8),
              maxWidth: mm(30),
              lineHeight: 1.3,
            }}
          >
            {copy.descriptor}
          </p>
        </div>

        <div className={isVideo ? "" : "text-right"}>
          <p
            className="font-md-display font-semibold leading-[1.05]"
            style={{
              fontSize: mm(T.name),
              letterSpacing: "-0.015em",
              /* Cifrele telefonului cu lățime fixă: se citesc în grupuri,
                 nu ca un șir care dansează. */
              fontVariantNumeric: isVideo ? undefined : "tabular-nums",
            }}
          >
            {copy.lead}
          </p>
          <p
            className="text-dim"
            style={{ fontSize: mm(T.minor), marginTop: mm(1.4) }}
          >
            {copy.minor}
          </p>
        </div>
      </div>
    </div>
  );
}

function Card({ model, guides }: { model: Model; guides: boolean }) {
  return (
    <article
      className="relative isolate overflow-hidden shadow-[0_22px_55px_-24px_rgb(0_0_0/0.8)]"
      style={{
        aspectRatio: `${CARD_W_MM} / ${CARD_H_MM}`,
        containerType: "inline-size",
        borderRadius: mm(2),
      }}
    >
      <div className="absolute inset-0 flex">
        <Half side="video" model={model} />
        <Half side="software" model={model} />
      </div>

      {/* Cusătura primește o muchie proprie. Nu e cosmetică: la tipar,
          o abatere de tăiere de o jumătate de milimetru s-ar vedea ca
          o dungă murdară acolo unde se ating două câmpuri pline. Cu o
          linie declarată, abaterea intră în ea. */}
      <span
        aria-hidden
        className="absolute inset-y-0 left-1/2 z-20 -translate-x-1/2"
        style={{ width: "1px", background: "rgb(255 255 255 / 0.16)" }}
      />

      {model.seam === "node" && (
        <span
          aria-hidden
          className="absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            width: mm(1.8),
            height: mm(1.8),
            background: "#a9b0ff",
            boxShadow: `0 0 0 ${mm(1.2)} rgb(169 176 255 / 0.22)`,
          }}
        />
      )}

      {model.badge && (
        <span
          aria-hidden
          className="absolute left-1/2 top-1/2 z-20 grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full"
          style={{
            width: mm(11),
            height: mm(11),
            background: "#0f1127",
            boxShadow: "inset 0 0 0 1px rgb(169 176 255 / 0.35)",
          }}
        >
          <Mark size={20} className="text-[#a9b0ff]" />
        </span>
      )}

      {guides && (
        <>
          {/* zona sigură — niciun text nu iese din ea */}
          <span
            aria-hidden
            className="pointer-events-none absolute z-30"
            style={{
              inset: mm(SAFE_MM),
              outline: "1px dashed rgb(255 90 90 / 0.75)",
            }}
          />
          {/* mijlocul cărții, dacă se pliază sau se taie în două */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-1/2 z-30"
            style={{
              width: "1px",
              background:
                "repeating-linear-gradient(to bottom, rgb(255 90 90 / 0.75) 0 4px, transparent 4px 8px)",
            }}
          />
        </>
      )}
    </article>
  );
}

/* ============================================================
   PE CARD — 05 și 06. Modelul 02, fără culoare.

   Pe metal există o singură „cerneală”: ce e gravat și ce nu. Nu
   există transparență, nici „pe jumătate”. Dispar deci câmpurile
   colorate, lumina din colț și filigranul la 20%. Rămân exact
   elementele lui 02: divizia sus, omul jos, globul cu marca pe
   cusătură, MERIDIANX la bază.

   Filigranul nu e nici plin, nici conturat: e hașurat. Hașura e
   echivalentul pe metal al opacității de 20% — de la distanță e un
   ton, de aproape sunt linii, sub deget e o textură. Nu e conturat
   fiindcă glifele fontului sunt construite din contururi suprapuse
   (barele lui E, D, N trec peste tulpini); pline nu se vede, dar
   conturate scot triunghiuri la colțuri. Hașura e tăiată după forma
   PLINĂ a literelor, deci colțurile ies curate.

   Ce desparte lumile când nu mai au culoare: la 05, grosimea liniei
   (video groasă, software subțire — convenția din desenul tehnic,
   raport 1:2); la 06, câmpul — jumătatea video e gravată în
   întregime, ca un câmp de culoare, iar textul de pe ea rămâne
   negravat. Restul e identic între cele două.

   Toate cotele vin din `metal-geometry.ts`, în milimetri, și tot de
   acolo le citește și generatorul de DXF pentru gravor: fiecare carte
   e un SVG cu viewBox 90×50, o unitate = un milimetru, deci ce se
   vede aici e exact ce se gravează.

   Textul poartă un halou de culoarea fondului (paint-order: stroke):
   unde o linie ar trece pe sub el, se întrerupe curat.
   ============================================================ */

type Finish = "negru" | "otel";

const FINISHES: Record<
  Finish,
  { label: string; detail: string; ground: string; ink: string }
> = {
  negru: {
    label: "Negru anodizat",
    detail: "gravura descoperă argintiul de sub stratul negru",
    ground: "#111216",
    ink: "#d3d6dc",
  },
  otel: {
    label: "Inox periat",
    detail: "marcajul laser înnegrește oțelul",
    ground: "#c6cad0",
    ink: "#1a1c21",
  },
};

type MonoModel = {
  id: string;
  name: string;
  note: string;
  /** Jumătatea video gravată în întregime, ca un câmp. */
  field: boolean;
};

const MONO_MODELS: MonoModel[] = [
  {
    id: "05",
    name: "Linie",
    field: false,
    note: "Totul din linii. Globul lui 02 cu marca pe cusătură, MERIDIANX hașurat fin la bază — un ton de la distanță, o textură sub deget — fiecare om în jumătatea lui. Singurul lucru care desparte lumile e grosimea liniei: video groasă, software subțire, ca într-un desen tehnic.",
  },
  {
    id: "06",
    name: "Câmp",
    field: true,
    note: "Aceeași carte, dar jumătatea video e gravată în întregime — cum era câmpul albastru la 02. Textul și liniile de pe ea rămân negravate, iar la cusătură desenul se inversează: hașura din MERIDIANX e jumătate negativ, jumătate pozitiv.",
  },
];

const ro = (n: number) => String(n).replace(".", ",");

/** Text gravat: umplut cu „cerneală”, cu halou de fond dedesubt. */
function Etched({
  x,
  y,
  size,
  anchor = "start",
  weight = 500,
  tracking = 0,
  tabular = false,
  children,
}: {
  x: number;
  y: number;
  size: number;
  anchor?: "start" | "middle" | "end";
  weight?: number;
  /** În em. La ancorare pe dreapta se scade spațiul de după ultima literă. */
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
      className="font-md-display"
      fill="currentColor"
      stroke="var(--ground)"
      strokeWidth={HALO}
      strokeLinejoin="round"
      paintOrder="stroke"
      style={{
        letterSpacing: tracking ? `${tracking}em` : undefined,
        fontVariantNumeric: tabular ? "tabular-nums" : undefined,
      }}
    >
      {children}
    </text>
  );
}

const curvePath = (dir: -1 | 1) => {
  const { p0, c1, c2, p1 } = meridianCurve(dir);
  return `M${p0[0]} ${p0[1]} C${c1[0]} ${c1[1]}, ${c2[0]} ${c2[1]}, ${p1[0]} ${p1[1]}`;
};

/** Globul lui 02 — cerc plus cele două meridiane — cu marca pe
    cusătură. Fiecare jumătate își are grosimea ei de linie. */
function Globe({ weight }: { weight: { video: number; software: number } }) {
  const { cx, cy, r, badge, mark, gap } = GLOBE;
  const left = `M${cx} ${cy - r} A${r} ${r} 0 0 0 ${cx} ${cy + r}`;
  const right = `M${cx} ${cy - r} A${r} ${r} 0 0 1 ${cx} ${cy + r}`;

  return (
    <g>
      <g fill="none" stroke="currentColor" strokeLinecap="round">
        <path d={left} strokeWidth={weight.video} />
        <path d={curvePath(-1)} strokeWidth={weight.video} />
        <path d={right} strokeWidth={weight.software} />
        <path d={curvePath(1)} strokeWidth={weight.software} />
      </g>
      <circle cx={cx} cy={cy} r={badge + gap} fill="var(--ground)" />
      <circle
        cx={cx}
        cy={cy}
        r={badge}
        fill="none"
        stroke="currentColor"
        strokeWidth={LINE.thick}
      />
      <g transform={`translate(${cx - mark / 2} ${cy - mark / 2})`}>
        <Mark size={mark} />
      </g>
    </g>
  );
}

/** Forma plină a filigranului — intră într-un clipPath, nu se vede
    niciodată direct. */
function WordmarkShape() {
  return (
    <text
      x={CARD.w / 2}
      y={wordmarkBaseline}
      fontSize={WORDMARK.size}
      fontWeight={FONT.wordmark.weight}
      textAnchor="middle"
      className="font-md-display"
      style={{ letterSpacing: `${FONT.wordmark.tracking}em` }}
    >
      {WORDMARK.text}
    </text>
  );
}

/** MERIDIANX la bază, hașurat: linii la 45° tăiate după forma
    literelor. Liniile acoperă toată banda de jos a cărții; clipul
    păstrează doar ce cade în litere. */
function EtchedWordmark({ clip }: { clip: string }) {
  const top = wordmarkBaseline - WORDMARK.size;
  const step = WORDMARK.pitch * Math.SQRT2;
  const lines: ReactNode[] = [];
  for (let c = top; c <= CARD.w + CARD.h; c += step) {
    /* Linia x + y = c, urcând spre dreapta („///”), tăiată la bandă. */
    lines.push(
      <line
        key={c.toFixed(3)}
        x1={c - CARD.h}
        y1={CARD.h}
        x2={c - top}
        y2={top}
      />,
    );
  }
  return (
    <g
      clipPath={`url(#${clip})`}
      stroke="currentColor"
      strokeWidth={LINE.thin}
      strokeLinecap="butt"
    >
      {lines}
    </g>
  );
}

/** O jumătate: divizia cu semnul ei, descriptorul, numele, telefonul.
    Semnul stă înaintea numelui diviziei la video și după el la
    software — jumătățile se oglindesc. */
function Person({ side }: { side: MetalSide }) {
  const isVideo = side === "video";
  const copy = COPY[side];
  const who = PEOPLE[side];
  const x = sideX(side);
  const DisciplineMark = isVideo ? Aperture : SystemNodes;

  return (
    <g>
      <g transform={`translate(${x.icon} ${Y.division - ICON.size * 0.75})`}>
        <DisciplineMark size={String(ICON.size)} />
      </g>
      <Etched
        x={x.division}
        y={Y.division}
        size={MT.division}
        weight={FONT.division.weight}
        tracking={FONT.division.tracking}
        anchor={x.anchor}
      >
        {copy.division}
      </Etched>
      <Etched
        x={x.edge}
        y={Y.descriptor}
        size={MT.descriptor}
        weight={FONT.descriptor.weight}
        anchor={x.anchor}
      >
        {copy.descriptor}
      </Etched>
      <Etched
        x={x.edge}
        y={Y.name}
        size={MT.name}
        weight={FONT.name.weight}
        tracking={FONT.name.tracking}
        anchor={x.anchor}
      >
        {who.name}
      </Etched>
      <Etched
        x={x.edge}
        y={Y.phone}
        size={MT.phone}
        weight={FONT.phone.weight}
        tabular
        anchor={x.anchor}
      >
        {who.phone}
      </Etched>
    </g>
  );
}

/** Tot desenul, o singură dată. La 06 se desenează de două ori: o
    dată normal, o dată inversat și tăiat la jumătatea video. */
function Sheet({ model, wordmarkClip }: { model: MonoModel; wordmarkClip: string }) {
  return (
    <>
      <Person side="video" />
      <Person side="software" />
      {/* Site-ul stă pe axa cusăturii, deasupra globului: coloana
          din mijloc poartă firma, jumătățile poartă oamenii. */}
      <Etched
        x={CARD.w / 2}
        y={Y.division}
        size={MT.site}
        weight={FONT.site.weight}
        anchor="middle"
        tracking={FONT.site.tracking}
      >
        {SITE}
      </Etched>
      <Globe
        weight={
          model.field
            ? { video: 0.2, software: 0.2 }
            : { video: LINE.thick, software: LINE.thin }
        }
      />
      <EtchedWordmark clip={wordmarkClip} />
    </>
  );
}

function MonoGuides() {
  return (
    <g fill="none" stroke="rgb(255 90 90 / 0.8)" strokeWidth={0.15}>
      <rect
        x={SAFE}
        y={SAFE}
        width={CARD.w - 2 * SAFE}
        height={CARD.h - 2 * SAFE}
        strokeDasharray="0.8 0.6"
      />
      <line
        x1={CARD.w / 2}
        y1={0}
        x2={CARD.w / 2}
        y2={CARD.h}
        strokeDasharray="0.8 0.6"
      />
    </g>
  );
}

function MonoCard({
  model,
  finish,
  guides,
}: {
  model: MonoModel;
  finish: Finish;
  guides: boolean;
}) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const f = FINISHES[finish];

  return (
    <article
      className="relative isolate overflow-hidden shadow-[0_22px_55px_-24px_rgb(0_0_0/0.8)]"
      style={{
        aspectRatio: `${CARD.w} / ${CARD.h}`,
        containerType: "inline-size",
        borderRadius: `${((CARD.corner / CARD.w) * 100).toFixed(3)}cqw`,
      }}
    >
      <svg
        viewBox={`0 0 ${CARD.w} ${CARD.h}`}
        className="absolute inset-0 h-full w-full"
        role="img"
        aria-label={`Carte de vizită ${model.id} ${model.name}, ${f.label.toLowerCase()}`}
        style={{ "--ground": f.ground, color: f.ink } as CSSProperties}
      >
        <defs>
          {/* Forma filigranului, o singură dată: la 06 desenul se
              randează de două ori și ar dubla id-ul. */}
          <clipPath id={`${id}-wm`}>
            <WordmarkShape />
          </clipPath>
        </defs>
        <rect width={CARD.w} height={CARD.h} fill="var(--ground)" />
        <Sheet model={model} wordmarkClip={`${id}-wm`} />

        {model.field && (
          <>
            <defs>
              <clipPath id={`${id}-field`}>
                <rect x={0} y={0} width={CARD.w / 2} height={CARD.h} />
              </clipPath>
            </defs>
            {/* Jumătatea video, gravată: fondul devine cerneală și
                cerneala devine fond, pentru tot ce stă pe ea. */}
            <g
              clipPath={`url(#${id}-field)`}
              style={{ "--ground": f.ink, color: f.ground } as CSSProperties}
            >
              <rect width={CARD.w / 2} height={CARD.h} fill={f.ink} />
              <Sheet model={model} wordmarkClip={`${id}-wm`} />
            </g>
          </>
        )}

        {guides && <MonoGuides />}

        {/* Reflexul metalului stă peste tot, ca în realitate; nu face
            parte din desen. */}
        <defs>
          <linearGradient
            id={`${id}-sheen`}
            gradientUnits="userSpaceOnUse"
            x1="0"
            y1="0"
            x2={CARD.w}
            y2={CARD.h}
          >
            <stop offset="0" stopColor="#fff" stopOpacity="0.09" />
            <stop offset="0.45" stopColor="#fff" stopOpacity="0" />
            <stop offset="1" stopColor="#000" stopOpacity="0.14" />
          </linearGradient>
        </defs>
        <rect width={CARD.w} height={CARD.h} fill={`url(#${id}-sheen)`} />
      </svg>
    </article>
  );
}

/** Rama de bleed: cât se taie de jur împrejur după tipar. */
function BleedFrame({
  guides,
  children,
}: {
  guides: boolean;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        padding: guides ? `${((BLEED_MM / CARD_W_MM) * 100).toFixed(3)}%` : 0,
        outline: guides ? "1px dashed rgb(255 255 255 / 0.25)" : "none",
      }}
    >
      {children}
    </div>
  );
}

function ModelTitle({ id, name }: { id: string; name: string }) {
  return (
    <div className="mb-4 flex items-baseline gap-3">
      <span className="font-md-mono text-[12px] text-a2">{id}</span>
      <h3 className="font-md-display text-[17px] font-semibold text-bone">
        {name}
      </h3>
    </div>
  );
}

export function CardBoard() {
  const [guides, setGuides] = useState(false);
  const [finish, setFinish] = useState<Finish>("negru");

  return (
    <main data-scope="gate" className="md-root min-h-dvh">
      <div className="mx-auto max-w-6xl px-5 py-14 sm:px-6 sm:py-20">
        <header className="max-w-2xl">
          <h1
            className="display text-bone"
            style={{ fontSize: "clamp(2rem, 5vw, 3.2rem)" }}
          >
            Modele de carte de vizită
          </h1>
          <p className="mt-5 text-[15px] leading-relaxed text-dim">
            Pagină temporară, nu face parte din site. Patru variante ale
            aceleiași cărți: împărțită în două, stânga{" "}
            <span className="text-bone">video</span> pe câmp albastru-cerneală,
            dreapta <span className="text-bone">software</span> pe hârtie trasă
            în verde. Fiecare jumătate spune ce face în trei cuvinte și cu un
            singur semn desenat — diafragmă pentru video, noduri legate pentru
            software. Structura e identică la toate patru; diferă doar felul în
            care se ating cele două lumi la mijloc. Mai jos, două variante ale
            lui 02 pentru gravură pe metal, fără culoare, și patru pe carton
            color, cu amândoi pe carte.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
            <button
              type="button"
              onClick={() => setGuides((g) => !g)}
              aria-pressed={guides}
              className="rounded-panel-sm border border-hair-strong px-4 py-2 font-md-mono text-[12px] uppercase tracking-[0.18em] text-bone transition-colors hover:bg-glass"
            >
              {guides ? "Ascunde ghidajele" : "Arată ghidajele de tipar"}
            </button>
            <p className="font-md-mono text-[12px] text-dim">
              {CARD_W_MM}×{CARD_H_MM} mm · bleed {BLEED_MM} mm · zonă sigură{" "}
              {SAFE_MM} mm · corp minim {T.minor} mm (~6.8pt)
            </p>
          </div>
        </header>

        <div className="mt-14 grid gap-x-10 gap-y-14 lg:grid-cols-2">
          {MODELS.map((model) => (
            <section key={model.id}>
              <ModelTitle id={model.id} name={model.name} />
              <BleedFrame guides={guides}>
                <Card model={model} guides={guides} />
              </BleedFrame>
              <p className="mt-4 max-w-md text-[13.5px] leading-relaxed text-dim">
                {model.note}
              </p>
            </section>
          ))}
        </div>

        <section className="mt-24" aria-labelledby="metal">
          <header className="max-w-2xl">
            <div className="flex items-baseline gap-3">
              <span className="font-md-mono text-[12px] text-a2">05–06</span>
              <h2
                id="metal"
                className="display text-bone"
                style={{ fontSize: "clamp(1.5rem, 3.5vw, 2.2rem)" }}
              >
                Pe metal, fără culoare
              </h2>
            </div>
            <p className="mt-5 text-[15px] leading-relaxed text-dim">
              Modelul 02, adus pe metal. Pe metal există o singură „cerneală”:
              ce e gravat și ce nu — deci dispar câmpurile de culoare și
              transparențele. Rămân exact elementele lui 02, la aceleași
              locuri: divizia sus, omul jos, globul cu marca pe cusătură,
              MERIDIANX la bază — hașurat fin, ca să rămână filigran și să
              se simtă sub deget. Diferă un singur lucru: cum se despart
              lumile.{" "}
              <span className="text-bone">05</span> le desparte prin grosimea
              liniei, <span className="text-bone">06</span> prin câmp —
              jumătatea video gravată în întregime.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
              <div
                role="group"
                aria-label="Finisajul metalului"
                className="flex flex-wrap gap-2"
              >
                {(Object.keys(FINISHES) as Finish[]).map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setFinish(key)}
                    aria-pressed={finish === key}
                    className={`rounded-panel-sm border px-4 py-2 font-md-mono text-[12px] uppercase tracking-[0.18em] transition-colors ${
                      finish === key
                        ? "border-hair-strong bg-glass text-bone"
                        : "border-hair text-dim hover:text-bone"
                    }`}
                  >
                    {FINISHES[key].label}
                  </button>
                ))}
              </div>
              <p className="font-md-mono text-[12px] text-dim">
                {FINISHES[finish].detail} · linie {ro(LINE.thin)} /{" "}
                {ro(LINE.thick)} mm · 1 unitate SVG = 1 mm
              </p>
            </div>
          </header>

          <div className="mt-14 grid gap-x-10 gap-y-14 lg:grid-cols-2">
            {MONO_MODELS.map((model) => (
              <section key={model.id}>
                <ModelTitle id={model.id} name={model.name} />
                <BleedFrame guides={guides}>
                  <MonoCard model={model} finish={finish} guides={guides} />
                </BleedFrame>
                <p className="mt-4 max-w-md text-[13.5px] leading-relaxed text-dim">
                  {model.note}
                </p>
              </section>
            ))}
          </div>
        </section>

        <section className="mt-24" aria-labelledby="carton">
          <header className="max-w-2xl">
            <div className="flex items-baseline gap-3">
              <span className="font-md-mono text-[12px] text-a2">07–10</span>
              <h2
                id="carton"
                className="display text-bone"
                style={{ fontSize: "clamp(1.5rem, 3.5vw, 2.2rem)" }}
              >
                Pe carton, color
              </h2>
            </div>
            <p className="mt-5 text-[15px] leading-relaxed text-dim">
              Modelul 02 cu amândoi pe carte, la 90×50, pe hârtie. Aceeași
              așezare ca pe metal — divizia sus, omul jos, globul cu marca pe
              cusătură, MERIDIANX la bază. Ce se schimbă de la una la alta nu
              e așezarea, ci <span className="text-bone">materialul</span>{" "}
              despărțirii dintre lumi: cerneală contra hârtie, bloc contra
              bloc, o cusătură care se curbează, sau o singură hârtie pe care
              lumile se despart doar prin culoarea cernelii.
            </p>
            <p className="mt-4 font-md-mono text-[12px] text-dim">
              {CARD.w}×{CARD.h} mm · colțuri R{CARD.corner} · bleed {BLEED_MM}{" "}
              mm · zonă sigură {SAFE} mm
            </p>
          </header>

          <div className="mt-14 grid gap-x-10 gap-y-14 lg:grid-cols-2">
            {PAPER_MODELS.map((model) => (
              <section key={model.id}>
                <ModelTitle id={model.id} name={model.name} />
                <BleedFrame guides={guides}>
                  <PaperCard model={model} guides={guides} />
                </BleedFrame>
                <p className="mt-4 max-w-md text-[13.5px] leading-relaxed text-dim">
                  {model.note}
                </p>
                <p className="mt-2 max-w-md font-md-mono text-[11.5px] leading-relaxed text-dim/80">
                  {model.print}
                </p>
              </section>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
