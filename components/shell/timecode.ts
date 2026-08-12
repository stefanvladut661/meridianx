/**
 * Timecode util (FAZA 1) — format SMPTE HH:MM:SS:FF la 24fps.
 * Folosit de HUD-ul de cameră (frames din poziția de scroll) și de
 * teaser-ul din gateway (frames din timp, doar la hover).
 */

export const FPS = 24;

export function formatTimecode(totalFrames: number): string {
  const frames = Math.max(0, Math.floor(totalFrames));
  const ff = frames % FPS;
  const totalSeconds = Math.floor(frames / FPS);
  const ss = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const mm = totalMinutes % 60;
  const hh = Math.floor(totalMinutes / 60) % 100;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(hh)}:${pad(mm)}:${pad(ss)}:${pad(ff)}`;
}
