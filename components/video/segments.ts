import type { Project, VideoSegment } from "@/content/types";

/**
 * Vocabularul segmentelor video (FAZA 2) — etichete și coduri de slate
 * partajate între portofoliu, case study și lista de scene de pe home.
 */

// i18n: etichete hardcodate RO — F7 extrage în messages/ro.json
export const SEGMENT_LABELS: Record<VideoSegment, string> = {
  imobiliare: "Imobiliare",
  corporate: "Corporate",
  evenimente: "Evenimente",
  "personal-brand": "Personal brand",
  industrial: "Industrial",
};

export const SEGMENT_CODES: Record<VideoSegment, string> = {
  imobiliare: "IMB",
  corporate: "CRP",
  evenimente: "EVT",
  "personal-brand": "PBR",
  industrial: "IND",
};

export const VIDEO_SEGMENTS: VideoSegment[] = [
  "imobiliare",
  "corporate",
  "evenimente",
  "personal-brand",
  "industrial",
];

/** Cod de slate pentru un proiect: IMB.01, CRP.02... */
export function projectCode(project: Project): string {
  const prefix = project.segment ? SEGMENT_CODES[project.segment] : "PRJ";
  const suffix = /(\d+)$/.exec(project.id)?.[1] ?? "01";
  return `${prefix}.${suffix}`;
}
