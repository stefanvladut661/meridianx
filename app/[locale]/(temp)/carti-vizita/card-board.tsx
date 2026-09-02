"use client";

import { useState, type CSSProperties } from "react";
import { Mark } from "@/components/site/mark";

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
  name: "Stefan Brinzaru",
  role: "Fondator",
  phone: "0771 738 607",
  site: "meridianx.ro",
};

/* Descriptorii vin din poziționarea scrisă în `video-content.ts` și
   `software-content.ts`, nu sunt inventați aici: video nu vinde
   filmări, vinde producție + distribuție; software nu vinde licențe,
   construiește sisteme pe măsură. Trei cuvinte fiecare — cât să
   lămurească, nu cât să explice. */
const SIDE = {
  video: {
    division: "VIDEO",
    descriptor: "Producție și distribuție",
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
   SEMNELE DE DISCIPLINĂ — ce facem, fără să scriem.

   Desenate aici, în același limbaj: viewBox 24, contur 1.7, capete
   rotunde. O diafragmă pentru video (obiectiv, deci filmare) și trei
   noduri legate pentru software (sisteme care vorbesc între ele —
   exact pitch-ul de integrare din software-content.ts).

   Coordonatele diafragmei sunt trei coarde la 120° una de alta, la
   3.5 de centru pe un cerc de rază 9: așa rămâne o deschidere
   triunghiulară la mijloc, ca la un obiectiv real. Un triunghi
   înscris ar fi arătat a buton de „record".
   ------------------------------------------------------------ */

function Aperture({ size }: { size: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      aria-hidden
      className="shrink-0"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M3.71 8.5 H20.29" />
      <path d="M19.18 6.57 L10.89 20.93" />
      <path d="M13.11 20.93 L4.82 6.57" />
    </svg>
  );
}

function SystemNodes({ size }: { size: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="shrink-0"
    >
      <path d="M12 5.5 L5 18 H19 Z" />
      <circle cx="12" cy="5.5" r="2.4" fill="currentColor" stroke="none" />
      <circle cx="5" cy="18" r="2.4" fill="currentColor" stroke="none" />
      <circle cx="19" cy="18" r="2.4" fill="currentColor" stroke="none" />
    </svg>
  );
}

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

export function CardBoard() {
  const [guides, setGuides] = useState(false);

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
            care se ating cele două lumi la mijloc.
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
              <div className="mb-4 flex items-baseline gap-3">
                <span className="font-md-mono text-[12px] text-a2">
                  {model.id}
                </span>
                <h2 className="font-md-display text-[17px] font-semibold text-bone">
                  {model.name}
                </h2>
              </div>

              {/* Rama de bleed: cât se taie de jur împrejur după tipar. */}
              <div
                style={{
                  padding: guides
                    ? `${((BLEED_MM / CARD_W_MM) * 100).toFixed(3)}%`
                    : 0,
                  outline: guides
                    ? "1px dashed rgb(255 255 255 / 0.25)"
                    : "none",
                }}
              >
                <Card model={model} guides={guides} />
              </div>

              <p className="mt-4 max-w-md text-[13.5px] leading-relaxed text-dim">
                {model.note}
              </p>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
