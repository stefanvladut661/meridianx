/**
 * Cititorul de MP4/MOV (ISO/IEC 14496-12, „ISO base media file format”), fără
 * pachete. Citește doar structura (cutiile `moov`), nu decodează imaginea:
 *
 *   - dimensiunile din `tkhd` (16.16, cu matricea de rotație) și din `stsd`;
 *   - durata din `mdhd` / `mvhd`, cadrele pe secundă din `stts`;
 *   - codecurile din `stsd` (avc1/avc3 = H.264, hvc1/hev1 = HEVC, mp4a = AAC…);
 *   - frecvența și canalele audio din intrarea `mp4a`;
 *   - debitul video din `stsz` (suma mostrelor pistei video / durata);
 *   - ordinea `moov` / `mdat` la primul nivel: Instagram cere „moov atom at the
 *     front of the file”;
 *   - listele de editare (`elst`), pe care Instagram le menționează („no edit
 *     lists”). ffmpeg le scrie aproape mereu (compensarea AAC), deci se notează,
 *     nu se refuză.
 */

export interface Mp4Info {
  /** Marca din `ftyp` („isom”, „mp42”, „qt  ” pentru MOV). */
  brand: string | null;
  /** Dimensiunile afișate (după rotație). */
  width: number;
  height: number;
  rotation: number;
  durationMs: number;
  fps: number | null;
  videoCodec: string | null;
  audioCodec: string | null;
  audioSampleRate: number | null;
  audioChannels: number | null;
  /** Debitul pistei video, în kbps (din mărimea mostrelor). */
  videoKbps: number | null;
  moovFirst: boolean;
  hasEditList: boolean;
}

export class Mp4Error extends Error {}

interface Box {
  type: string;
  start: number;
  /** Începutul conținutului (după antet). */
  body: number;
  end: number;
}

function* boxes(buf: Buffer, start: number, end: number): Generator<Box> {
  let pos = start;
  while (pos + 8 <= end) {
    let size = buf.readUInt32BE(pos);
    const type = buf.toString("latin1", pos + 4, pos + 8);
    let header = 8;
    if (size === 1) {
      if (pos + 16 > end) return;
      const large = buf.readBigUInt64BE(pos + 8);
      if (large > BigInt(Number.MAX_SAFE_INTEGER)) return;
      size = Number(large);
      header = 16;
    } else if (size === 0) {
      size = end - pos;
    }
    if (size < header) return;
    const boxEnd = Math.min(pos + size, end);
    yield { type, start: pos, body: pos + header, end: boxEnd };
    if (pos + size > end) return;
    pos += size;
  }
}

function child(buf: Buffer, parent: Box, type: string): Box | null {
  for (const box of boxes(buf, parent.body, parent.end)) if (box.type === type) return box;
  return null;
}

function path(buf: Buffer, parent: Box, ...types: string[]): Box | null {
  let current: Box | null = parent;
  for (const type of types) {
    if (!current) return null;
    current = child(buf, current, type);
  }
  return current;
}

const CODEC: Record<string, string> = {
  avc1: "h264",
  avc3: "h264",
  hvc1: "hevc",
  hev1: "hevc",
  vp08: "vp8",
  vp09: "vp9",
  av01: "av1",
  mp4v: "mpeg4",
  apcn: "prores",
  apch: "prores",
  ap4h: "prores",
  mp4a: "aac",
  Opus: "opus",
  "ac-3": "ac3",
  "ec-3": "eac3",
  lpcm: "pcm",
  sowt: "pcm",
  twos: "pcm",
};

interface Track {
  handler: string;
  timescale: number;
  duration: number;
  width: number;
  height: number;
  rotation: number;
  codec: string | null;
  sampleRate: number | null;
  channels: number | null;
  samples: number;
  sampleDurationTotal: number;
  bytes: number;
  editList: boolean;
}

function fixed16(buf: Buffer, offset: number): number {
  return buf.readUInt32BE(offset) / 65536;
}

function readTrack(buf: Buffer, trak: Box): Track | null {
  const tkhd = child(buf, trak, "tkhd");
  const mdia = child(buf, trak, "mdia");
  if (!tkhd || !mdia) return null;
  const tkVersion = buf.readUInt8(tkhd.body);
  // După version/flags: v0 = creation(4) modification(4) id(4) reserved(4) duration(4); v1 = 8 8 4 4 8.
  const afterDuration = tkhd.body + 4 + (tkVersion === 1 ? 32 : 20);
  // reserved(8) layer(2) alternate_group(2) volume(2) reserved(2) → matricea (9 × 4) → width, height.
  const matrix = afterDuration + 16;
  if (matrix + 36 + 8 > tkhd.end) return null;
  const a = buf.readInt32BE(matrix);
  const b = buf.readInt32BE(matrix + 4);
  let rotation = 0;
  if (a === 0 && b > 0) rotation = 90;
  else if (a === 0 && b < 0) rotation = 270;
  else if (a < 0 && b === 0) rotation = 180;
  const tkWidth = fixed16(buf, matrix + 36);
  const tkHeight = fixed16(buf, matrix + 40);

  const mdhd = child(buf, mdia, "mdhd");
  const hdlr = child(buf, mdia, "hdlr");
  if (!mdhd || !hdlr) return null;
  const mdVersion = buf.readUInt8(mdhd.body);
  const timescale = mdVersion === 1 ? buf.readUInt32BE(mdhd.body + 4 + 16) : buf.readUInt32BE(mdhd.body + 4 + 8);
  const duration = mdVersion === 1 ? Number(buf.readBigUInt64BE(mdhd.body + 4 + 20)) : buf.readUInt32BE(mdhd.body + 4 + 12);
  const handler = buf.toString("latin1", hdlr.body + 8, hdlr.body + 12);

  const stbl = path(buf, mdia, "minf", "stbl");
  let codec: string | null = null;
  let sampleRate: number | null = null;
  let channels: number | null = null;
  let entryWidth = 0;
  let entryHeight = 0;
  let samples = 0;
  let sampleDurationTotal = 0;
  let bytes = 0;
  if (stbl) {
    const stsd = child(buf, stbl, "stsd");
    if (stsd && stsd.body + 16 <= stsd.end) {
      const entry = stsd.body + 8;
      const fourcc = buf.toString("latin1", entry + 4, entry + 8);
      codec = CODEC[fourcc] ?? fourcc.trim();
      if (handler === "soun" && entry + 36 <= stsd.end) {
        channels = buf.readUInt16BE(entry + 8 + 16);
        sampleRate = buf.readUInt32BE(entry + 8 + 24) / 65536;
      }
      if (handler === "vide" && entry + 8 + 28 <= stsd.end) {
        entryWidth = buf.readUInt16BE(entry + 8 + 24);
        entryHeight = buf.readUInt16BE(entry + 8 + 26);
      }
    }
    const stts = child(buf, stbl, "stts");
    if (stts) {
      const count = buf.readUInt32BE(stts.body + 4);
      for (let i = 0; i < count; i += 1) {
        const at = stts.body + 8 + i * 8;
        if (at + 8 > stts.end) break;
        const n = buf.readUInt32BE(at);
        samples += n;
        sampleDurationTotal += n * buf.readUInt32BE(at + 4);
      }
    }
    const stsz = child(buf, stbl, "stsz");
    if (stsz) {
      const fixed = buf.readUInt32BE(stsz.body + 4);
      const count = buf.readUInt32BE(stsz.body + 8);
      if (fixed > 0) bytes = fixed * count;
      else for (let i = 0; i < count && stsz.body + 12 + i * 4 + 4 <= stsz.end; i += 1) bytes += buf.readUInt32BE(stsz.body + 12 + i * 4);
    }
  }
  const editList = Boolean(path(buf, trak, "edts", "elst"));

  const width = Math.round(tkWidth || entryWidth);
  const height = Math.round(tkHeight || entryHeight);
  return { handler, timescale, duration, width, height, rotation, codec, sampleRate, channels, samples, sampleDurationTotal, bytes, editList };
}

/** Citește structura unui MP4/MOV întreg (din memorie). Aruncă `Mp4Error` cu un mesaj pentru om. */
export function probeMp4(buf: Buffer): Mp4Info {
  let brand: string | null = null;
  let moov: Box | null = null;
  let moovIndex = -1;
  let mdatIndex = -1;
  let index = 0;
  for (const box of boxes(buf, 0, buf.length)) {
    if (box.type === "ftyp" && box.body + 4 <= box.end) brand = buf.toString("latin1", box.body, box.body + 4);
    if (box.type === "moov" && !moov) {
      moov = box;
      moovIndex = index;
    }
    if (box.type === "mdat" && mdatIndex < 0) mdatIndex = index;
    index += 1;
  }
  if (!brand && !moov) throw new Mp4Error("Fișierul nu e un MP4 sau MOV (nu are structura ISO).");
  if (!moov) throw new Mp4Error("Fișierul n-are indexul video (moov): e incomplet sau stricat. Exportă-l din nou.");

  const tracks: Track[] = [];
  for (const box of boxes(buf, moov.body, moov.end)) {
    if (box.type !== "trak") continue;
    try {
      const track = readTrack(buf, box);
      if (track) tracks.push(track);
    } catch {
      // O pistă necitibilă (ex. metadate) nu strică restul.
    }
  }
  const video = tracks.find((track) => track.handler === "vide");
  const audio = tracks.find((track) => track.handler === "soun");
  if (!video) throw new Mp4Error("Fișierul n-are pistă video.");

  let durationMs = video.timescale > 0 ? Math.round((video.duration / video.timescale) * 1000) : 0;
  const mvhd = child(buf, moov, "mvhd");
  if (mvhd) {
    const version = buf.readUInt8(mvhd.body);
    const timescale = version === 1 ? buf.readUInt32BE(mvhd.body + 4 + 16) : buf.readUInt32BE(mvhd.body + 4 + 8);
    const duration = version === 1 ? Number(buf.readBigUInt64BE(mvhd.body + 4 + 20)) : buf.readUInt32BE(mvhd.body + 4 + 12);
    if (timescale > 0 && duration > 0) durationMs = Math.max(durationMs, Math.round((duration / timescale) * 1000));
  }

  const fps = video.samples > 0 && video.sampleDurationTotal > 0 && video.timescale > 0 ? Math.round((video.samples / (video.sampleDurationTotal / video.timescale)) * 1000) / 1000 : null;
  const videoSeconds = video.timescale > 0 && video.duration > 0 ? video.duration / video.timescale : durationMs / 1000;
  const videoKbps = video.bytes > 0 && videoSeconds > 0 ? Math.round((video.bytes * 8) / videoSeconds / 1000) : null;
  const rotated = video.rotation === 90 || video.rotation === 270;

  return {
    brand,
    width: rotated ? video.height : video.width,
    height: rotated ? video.width : video.height,
    rotation: video.rotation,
    durationMs,
    fps,
    videoCodec: video.codec,
    audioCodec: audio?.codec ?? null,
    audioSampleRate: audio?.sampleRate ?? null,
    audioChannels: audio?.channels ?? null,
    videoKbps,
    moovFirst: mdatIndex < 0 || moovIndex < mdatIndex,
    hasEditList: tracks.some((track) => track.editList),
  };
}
