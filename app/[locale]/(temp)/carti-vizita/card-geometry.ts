/* ============================================================
   GEOMETRIA CĂRȚII — o singură sursă de adevăr (metal și carton).

   Tot ce e aici e în milimetri reali de pe carte. Modulul e citit de
   două locuri: `card-board.tsx` (previzualizarea din browser) și
   generatorul de DXF pentru gravor. Dacă se schimbă o cotă aici, se
   schimbă în amândouă — de-aia nu are importuri, nici React, nici
   aliasuri de cale: trebuie să poată fi încărcat și de Node direct.
   ============================================================ */

/** 90×50 e standardul românesc de carte de vizită; R3 la colțuri e
    raza uzuală la cărțile de metal. */
export const CARD = { w: 90, h: 50, corner: 3 };

/** Marginea la care se aliniază textul și zona în care nimic nu se
    apropie de muchie. */
export const PAD = 5;
export const SAFE = 4;

/** Grosimi de linie în mm. Raport 1:2 între subțire și groasă, ca în
    desenul tehnic. 0,15 e sub ce distinge ochiul ca „linie groasă” și
    peste ce poate trage curat un laser. */
export const LINE = { thin: 0.15, thick: 0.32 };

/** Corpurile de literă, în mm. Nimic sub 2,4: pragul de lizibilitate
    pentru un telefon citit în lumină proastă. */
export const T = { division: 2.7, descriptor: 2.6, name: 3.6, phone: 2.8, site: 2.4 };

/** Grosimile fontului (Satoshi Variable, axa wght) și spațierea
    dintre litere, în em. Aceleași ca pe cărțile color. */
export const FONT = {
  division: { weight: 700, tracking: 0.16 },
  descriptor: { weight: 500, tracking: 0 },
  name: { weight: 600, tracking: -0.015 },
  phone: { weight: 500, tracking: 0 },
  site: { weight: 500, tracking: 0.04 },
  wordmark: { weight: 600, tracking: -0.035 },
  /** Înălțimea majusculelor în em, din font (capHeight 740/1000). */
  capHeight: 0.74,
};

/** Liniile de bază ale textului. Rândul de sus e măsurat de la muchia
    de sus, rândul cu oamenii de la cea de jos. Tot desenul stă cât de
    sus permite zona sigură (semnul diviziei atinge 4 mm de muchie),
    ca filigranul de jos să se vadă cât mai mult. */
export const Y = {
  division: 7,
  descriptor: 12.3,
  name: CARD.h - 16.3,
  phone: CARD.h - 12.1,
};

/** Semnul disciplinei: 4 mm, la 1,6 mm de numele diviziei. */
export const ICON = { size: 4, gap: 1.6 };

/** Globul lui 02 — cerc plus două meridiane — cu marca pe cusătură.
    Meridianele sunt curbe Bézier cu punctele de control la aceleași
    proporții din rază ca pe site (SeamArc). Discul de fond al mărcii
    întrerupe liniile la `gap` mm de inel. */
export const GLOBE = { cx: CARD.w / 2, cy: 23.5, r: 14.5, badge: 5.5, mark: 6, gap: 0.6 };
export const MERIDIAN_K = { x: 0.639, y: 0.653 };

/** Filigranul de la bază: hașurat, tăiat de marginea de jos. Corpul e
    ales ca literele să ocupe lățimea cărții minus 6 mm pe fiecare
    parte; `gapAbove` e aerul dintre telefoane și vârful literelor.
    Linia de bază iese 1,6 mm sub muchie — piciorul lui E rămâne sub
    tăietură; s-a încercat și varianta cu literele așezate pe muchie
    (bleed 0,4), dar urca prea mult restul desenului. */
export const WORDMARK = {
  text: "MERIDIANX",
  size: 15,
  pitch: 0.5,
  gapAbove: 2.6,
};

/** Linia de bază a filigranului, derivată: telefoane + aer + majuscule. */
export const wordmarkBaseline =
  Y.phone + WORDMARK.gapAbove + FONT.capHeight * WORDMARK.size;

/** Haloul de fond din jurul textului: unde o linie ar trece pe sub el,
    se întrerupe la atâția mm. */
export const HALO = 0.6;

export const SITE = "meridianx.ro";

export const COPY = {
  video: { division: "VIDEO", descriptor: "Producție și reclame" },
  software: { division: "SOFTWARE", descriptor: "Sisteme la comandă" },
};

export const PEOPLE = {
  video: { name: "Vlăduț Savu", phone: "0766 990 184" },
  software: { name: "Ștefan Brînzaru", phone: "0771 738 607" },
};

export type MetalSide = "video" | "software";

/** Pozițiile pe orizontală ale unei jumătăți: marginea de aliniere a
    textului, colțul semnului și marginea numelui diviziei. */
export function sideX(side: MetalSide) {
  const isVideo = side === "video";
  return {
    edge: isVideo ? PAD : CARD.w - PAD,
    icon: isVideo ? PAD : CARD.w - PAD - ICON.size,
    division: isVideo
      ? PAD + ICON.size + ICON.gap
      : CARD.w - PAD - ICON.size - ICON.gap,
    anchor: (isVideo ? "start" : "end") as "start" | "end",
  };
}

/** Punctele de control ale meridianului care se bombează spre `dir`. */
export function meridianCurve(dir: -1 | 1) {
  const { cx, cy, r } = GLOBE;
  const kx = MERIDIAN_K.x * r;
  const ky = MERIDIAN_K.y * r;
  return {
    p0: [cx, cy - r] as [number, number],
    c1: [cx + dir * kx, cy - ky] as [number, number],
    c2: [cx + dir * kx, cy + ky] as [number, number],
    p1: [cx, cy + r] as [number, number],
  };
}
