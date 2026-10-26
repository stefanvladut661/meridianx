import { db, failure, NO_DB, type Result } from "./db";
import { download, type ClipFile } from "./drive";
import { Mp4Error, probeMp4 } from "./mp4";

/**
 * Ce s-a citit din fiecare clip (`postari_clipuri`). Clipul se descarcă întreg
 * de pe Drive o singură dată, se citește structura MP4, iar rezultatul rămâne
 * valabil cât timp fișierul are aceeași mărime. Un fișier necitibil se ține
 * și el, cu motivul, ca să nu se descarce iar la fiecare verificare.
 */

export interface ClipProbe {
  driveFileId: string;
  nume: string;
  marime: number;
  mime: string | null;
  latime: number | null;
  inaltime: number | null;
  rotatie: number | null;
  durataMs: number | null;
  fps: number | null;
  codecVideo: string | null;
  codecAudio: string | null;
  audioHz: number | null;
  audioCanale: number | null;
  debitKbps: number | null;
  moovLaInceput: boolean | null;
  listeEditare: boolean | null;
  eroare: string | null;
  cititLa: string;
}

const MIGRATION = "24 (00000000000024_postari_baza.sql)";
const num = (value: unknown): number | null => (value === null || value === undefined ? null : Number(value));

function toProbe(row: Record<string, unknown>): ClipProbe {
  return {
    driveFileId: String(row.drive_file_id),
    nume: String(row.nume),
    marime: Number(row.marime),
    mime: (row.mime as string | null) ?? null,
    latime: num(row.latime),
    inaltime: num(row.inaltime),
    rotatie: num(row.rotatie),
    durataMs: num(row.durata_ms),
    fps: num(row.fps),
    codecVideo: (row.codec_video as string | null) ?? null,
    codecAudio: (row.codec_audio as string | null) ?? null,
    audioHz: num(row.audio_hz),
    audioCanale: num(row.audio_canale),
    debitKbps: num(row.debit_kbps),
    moovLaInceput: (row.moov_la_inceput as boolean | null) ?? null,
    listeEditare: (row.liste_editare as boolean | null) ?? null,
    eroare: (row.eroare as string | null) ?? null,
    cititLa: String(row.citit_la),
  };
}

/** Citirile știute pentru fișierele date, valabile doar dacă mărimea e aceeași. */
export async function cachedProbes(files: { id: string; size: number | null }[]): Promise<Result<Map<string, ClipProbe>>> {
  const admin = db();
  if (!admin) return { ok: false, message: NO_DB };
  const out = new Map<string, ClipProbe>();
  if (files.length === 0) return { ok: true, data: out };
  const ids = [...new Set(files.map((file) => file.id))];
  for (let i = 0; i < ids.length; i += 100) {
    const { data, error } = await admin.from("postari_clipuri").select("*").in("drive_file_id", ids.slice(i, i + 100));
    if (error) return failure(error, MIGRATION);
    for (const row of data ?? []) {
      const probe = toProbe(row as Record<string, unknown>);
      const file = files.find((item) => item.id === probe.driveFileId);
      if (file && (file.size === null || file.size === probe.marime)) out.set(probe.driveFileId, probe);
    }
  }
  return { ok: true, data: out };
}

/**
 * Descarcă și citește un clip, apoi ține rezultatul. Întoarce eroare doar
 * când Drive sau baza nu răspund; un fișier necitibil e un rezultat (cu `eroare`).
 */
export async function probeClip(file: ClipFile, folderId: string | null): Promise<Result<ClipProbe>> {
  const admin = db();
  if (!admin) return { ok: false, message: NO_DB };
  const bytes = await download(file.id);
  if (!bytes.ok) return bytes;
  const buffer = bytes.data;
  const row: Record<string, unknown> = {
    drive_file_id: file.id,
    nume: file.name.slice(0, 300),
    folder_id: folderId,
    marime: buffer.length,
    mime: file.mimeType.slice(0, 100),
    citit_la: new Date().toISOString(),
    latime: null,
    inaltime: null,
    rotatie: null,
    durata_ms: null,
    fps: null,
    codec_video: null,
    codec_audio: null,
    audio_hz: null,
    audio_canale: null,
    debit_kbps: null,
    moov_la_inceput: null,
    liste_editare: null,
    eroare: null,
  };
  try {
    const info = probeMp4(buffer);
    Object.assign(row, {
      latime: info.width,
      inaltime: info.height,
      rotatie: info.rotation,
      durata_ms: info.durationMs,
      fps: info.fps,
      codec_video: info.videoCodec?.slice(0, 20) ?? null,
      codec_audio: info.audioCodec?.slice(0, 20) ?? null,
      audio_hz: info.audioSampleRate ? Math.round(info.audioSampleRate) : null,
      audio_canale: info.audioChannels,
      debit_kbps: info.videoKbps,
      moov_la_inceput: info.moovFirst,
      liste_editare: info.hasEditList,
    });
  } catch (error) {
    row.eroare = error instanceof Mp4Error ? error.message : "Fișierul nu se poate citi ca MP4 sau MOV.";
  }
  const { data, error } = await admin.from("postari_clipuri").upsert(row, { onConflict: "drive_file_id" }).select("*").single();
  if (error) return failure(error, MIGRATION);
  return { ok: true, data: toProbe(data as Record<string, unknown>) };
}
