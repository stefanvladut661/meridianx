export type Format = "9x16" | "4x5";

export const FORMATS: Record<Format, { width: number; height: number }> = {
  "9x16": { width: 1080, height: 1920 },
  "4x5": { width: 1080, height: 1350 },
};

export type Layout = {
  W: number;
  H: number;
  /** Zona în care stă conținutul-cheie: sub interfața de sus, deasupra celei de jos. */
  top: number;
  bottom: number;
  /** Poziția verticală de la care se așază scena de 1000 px înălțime. */
  stage: number;
  /** Începutul zonei de 900 px de sub pastila de stare, pentru scenele din body. */
  content: number;
  tall: boolean;
};

export type Rect = { x: number; y: number; w: number; h: number };

export const CONTENT_H = 900;

// În Reels, interfața acoperă ~14% sus și ~35% jos din 9:16. În feed (4:5)
// rămâne doar o margine mică. Scenele sunt desenate pe o scenă de 1080×1000.
export const STAGE_H = 1000;

export const layoutFor = (W: number, H: number): Layout => {
  const tall = H / W > 1.5;
  const top = tall ? Math.round(H * 0.14) : 70;
  const bottom = tall ? Math.round(H * 0.665) : H - 70;
  const stage = Math.round(top + (bottom - top - STAGE_H) / 2);
  const cTop = top + 120;
  const content = Math.round(cTop + (bottom + 10 - cTop - CONTENT_H) / 2);
  return { W, H, top, bottom, stage, content, tall };
};

/** Pastila de stare care rămâne sus pe tot body-ul. */
export const pillRect = (L: Layout): Rect => ({ x: 90, y: L.top + 4, w: 900, h: 88 });
