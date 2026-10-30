/**
 * Bucățile clipului pentru TikTok, după „Media Transfer Guide”:
 *  - `chunk_size` între 5 MB și 64 MB;
 *  - `total_chunk_count` = floor(video_size / chunk_size), între 1 și 1000;
 *  - ultima bucată preia restul și poate ajunge la 128 MB;
 *  - un clip sub 64 MB pleacă într-o singură bucată: `chunk_size` = `video_size`, `total_chunk_count` = 1;
 *  - `Content-Range: bytes {primul}-{ultimul}/{total}`, bucățile în ordine.
 *
 * Fișier pur, fără importuri: îl citesc și serverul, și testul (`tiktok-chunks.test.mjs`).
 *
 * Ghidul nu spune dacă „MB” e 10^6 sau 2^20, deci plafoanele se țin sub ambele citiri: nimic
 * peste 64 · 10^6 octeți la o bucată, nimic sub 5 · 2^20 octeți (în afara clipului dintr-o bucată).
 */

const MB = 1_000_000;
const MIB = 1024 * 1024;

/** Până aici (inclusiv) clipul pleacă întreg. */
export const SINGLE_CHUNK_MAX = 64 * MB;
/** Mărimea țintă a unei bucăți la clipurile mai mari: între 5 și 64 MB în orice citire a lui „MB”. */
const TARGET_CHUNK = 32 * MIB;
const MAX_CHUNK = 64 * MB;
const MAX_LAST_CHUNK = 128 * MB;
const MAX_TOTAL = 1000;

export interface ChunkPlan {
  chunkSize: number;
  total: number;
}

export function chunkPlan(size: number): ChunkPlan {
  if (!Number.isInteger(size) || size <= 0) throw new RangeError(`Mărimea clipului (${size}) nu e un număr de octeți valid.`);
  if (size <= SINGLE_CHUNK_MAX) return { chunkSize: size, total: 1 };

  // Peste 64 MB: bucăți egale (ultima ia restul de cel mult `total - 1` octeți). Cel puțin două,
  // fiindcă „total = 1” cere ca bucata să fie cât tot clipul, iar aici ar rămâne mai mică.
  const total = Math.min(MAX_TOTAL, Math.max(2, Math.floor(size / TARGET_CHUNK)));
  const chunkSize = Math.floor(size / total);
  const last = size - (total - 1) * chunkSize;
  if (chunkSize > MAX_CHUNK || last > MAX_LAST_CHUNK) throw new RangeError(`Clipul de ${(size / MB).toFixed(1)} MB nu încape în regulile de bucăți ale TikTok.`);
  return { chunkSize, total };
}

/** Octeții bucății `index` (de la 0): primul și ultimul, inclusiv. Ultima bucată merge până la capătul clipului. */
export function chunkRange(index: number, plan: ChunkPlan, size: number): { start: number; end: number } {
  if (!Number.isInteger(index) || index < 0 || index >= plan.total) throw new RangeError(`Bucata ${index} nu există (sunt ${plan.total}).`);
  const start = index * plan.chunkSize;
  const end = index === plan.total - 1 ? size - 1 : start + plan.chunkSize - 1;
  return { start, end };
}

export function contentRange(range: { start: number; end: number }, size: number): string {
  return `bytes ${range.start}-${range.end}/${size}`;
}
