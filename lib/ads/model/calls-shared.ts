import { z } from "zod";
import type { Platform } from "../constants";

/**
 * Apelurile notate de mână (migrarea 14) — ce văd și ecranul, și serverul.
 * Fișier izomorf: fără acces la bază. Schema formularului e aceeași în browser
 * și în acțiunea de pe server.
 */

/** Ce a ieșit din apel, în ordinea în care crește valoarea lui. */
export const CALL_RESULTS = ["intrebare", "programat", "semnat"] as const;
export type CallResult = (typeof CALL_RESULTS)[number];

export const CALL_RESULT_LABEL: Record<CallResult, string> = {
  intrebare: "Doar întrebare",
  programat: "Programat",
  semnat: "Semnat",
};

/** Pentru numărători: „3 programate”, „1 semnat”. */
export const CALL_RESULT_PLURAL: Record<CallResult, [string, string]> = {
  intrebare: ["doar întrebare", "doar întrebări"],
  programat: ["programat", "programate"],
  semnat: ["semnat", "semnate"],
};

export const NOTE_MAX = 1000;

/** „Nu știu” la canal: omul n-a spus de unde a aflat. */
export const UNKNOWN_CHANNEL = "necunoscut";

/** Cel mai vechi apel care se poate nota: cât ține istoricul cifrelor. */
export const OLDEST_CALL_DAYS = 400;

export const callFormSchema = z.object({
  clientId: z.uuid({ message: "Alege clientul." }),
  channel: z.enum(["meta", "google", "tiktok", UNKNOWN_CHANNEL], { message: "Alege canalul — sau „Nu știu”." }),
  entityId: z.union([z.uuid(), z.literal("")]).transform((value) => value || null),
  calledOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Ziua apelului nu e o dată." }),
  result: z.enum(CALL_RESULTS, { message: "Alege ce a ieșit din apel." }),
  note: z
    .string()
    .trim()
    .max(NOTE_MAX, { message: `Nota are cel mult ${NOTE_MAX} de caractere.` })
    .transform((value) => value || null),
});
export type CallFormInput = z.input<typeof callFormSchema>;

/** Ziua: nu în viitor, nu mai veche decât istoricul. `today` vine de la server sau din browser, în ora României. */
export function callDayProblem(day: string, today: string): string | null {
  if (day > today) return "Ziua apelului e în viitor. Apelurile se notează după ce au avut loc.";
  const oldest = new Date(Date.parse(`${today}T00:00:00Z`) - OLDEST_CALL_DAYS * 86_400_000).toISOString().slice(0, 10);
  if (day < oldest) return "Ziua e mai veche decât istoricul portalului (peste un an).";
  return null;
}

export interface CallRow {
  id: string;
  clientId: string;
  /** null = omul n-a spus de unde a aflat. */
  platform: Platform | null;
  /** Campania din modelul comun, dacă se știe. */
  entityId: string | null;
  campaignName: string | null;
  calledOn: string;
  result: CallResult;
  note: string | null;
  createdAt: string;
  createdByEmail: string | null;
}

/** Numărătoarea pe o campanie: câte apeluri și câte din fiecare fel. */
export interface CallCount {
  total: number;
  byResult: Record<CallResult, number>;
}

export function emptyCallCount(): CallCount {
  return { total: 0, byResult: { intrebare: 0, programat: 0, semnat: 0 } };
}

export function countCalls(calls: ReadonlyArray<Pick<CallRow, "result">>): CallCount {
  const count = emptyCallCount();
  for (const call of calls) {
    count.total += 1;
    count.byResult[call.result] += 1;
  }
  return count;
}

/** „2 programate · 1 semnat” — doar felurile care au apeluri, de la cel mai valoros. */
export function callBreakdown(count: CallCount): string {
  return [...CALL_RESULTS]
    .reverse()
    .filter((result) => count.byResult[result] > 0)
    .map((result) => {
      const value = count.byResult[result];
      const [one, many] = CALL_RESULT_PLURAL[result];
      if (value === 1) return `1 ${one}`;
      // „20 de programate”: de la 20 în sus, cu „de” (aceeași regulă ca la rezultate).
      const rest = value % 100;
      return `${value} ${value >= 20 && (rest === 0 || rest >= 20) ? "de " : ""}${many}`;
    })
    .join(" · ");
}
