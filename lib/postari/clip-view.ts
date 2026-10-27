import type { ClipProbe } from "./clipuri";
import { commonIssues, instagramIssues, probeSummary, tiktokIssues, type Issue } from "./limite";

/**
 * Un clip, gata de arătat: ce s-a citit din el și dacă intră pe fiecare
 * platformă. Același obiect îl primesc ecranul „Clipuri” și verificarea planului.
 */
export interface ClipView {
  id: string;
  name: string;
  size: number | null;
  link: string | null;
  probed: boolean;
  summary: string | null;
  durationMs: number | null;
  common: Issue[];
  instagram: Issue[];
  tiktok: Issue[];
}

export function clipView(file: { id: string; name: string; size: number | null; link: string | null }, probe: ClipProbe | null, storageLimitMb: number): ClipView {
  if (!probe) return { id: file.id, name: file.name, size: file.size, link: file.link, probed: false, summary: null, durationMs: null, common: [], instagram: [], tiktok: [] };
  return {
    id: file.id,
    name: file.name,
    size: probe.marime,
    link: file.link,
    probed: true,
    summary: probeSummary(probe),
    durationMs: probe.durataMs,
    common: commonIssues(probe),
    instagram: instagramIssues(probe, storageLimitMb),
    tiktok: tiktokIssues(probe),
  };
}
