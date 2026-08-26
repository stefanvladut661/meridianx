"use client";

import { useEffect } from "react";
import { captureUTM, getStoredUTM } from "@/lib/utm";
import { leadInputSchema, type LeadInput } from "@/lib/validations/lead";

/**
 * Trimiterea lead-urilor din paginile noi.
 *
 * O singură cale spre `/api/leads`, folosită de ambele divizii:
 * configuratorul de pe /software și formularul scurt de pe /video.
 * Contractul e cel din FAZA 0 (`lib/validations/lead.ts`) — validăm cu
 * ACEEAȘI schemă pe care o rulează serverul, ca un payload care trece
 * aici să nu poată fi respins acolo.
 *
 * UTM-urile se citesc din sessionStorage (first-touch), nu din URL-ul
 * de la momentul trimiterii: omul poate veni dintr-o reclamă, citi
 * toată pagina și trimite după ce query-ul a dispărut din bară.
 */

/** Câmpurile pe care le compune formularul; restul le punem noi. */
export type LeadFields = Omit<LeadInput, "locale" | "utm" | "referrer">;

export type LeadResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

/** Mesaje pentru om, nu pentru log: ce s-a întâmplat și ce să facă. */
const MESSAGES = {
  invalid:
    "Ceva din date nu e în regulă — verifică emailul și telefonul și încearcă din nou.",
  rateLimited:
    "Ai trimis deja câteva cereri. Mai încearcă peste un minut sau sună-ne direct.",
  unavailable:
    "Nu am putut înregistra cererea. Sună-ne sau scrie-ne pe WhatsApp — răspundem la fel de repede.",
  network:
    "Conexiunea a căzut înainte să ajungă cererea. Încearcă din nou sau sună-ne.",
} as const;

/**
 * Capturează UTM-urile o dată, la montarea paginii.
 *
 * După redesign layout-urile de divizie sunt goale, deci apelul nu mai
 * are unde să stea decât în pagina care poartă formularul.
 */
export function useUtmCapture(): void {
  useEffect(() => {
    captureUTM();
  }, []);
}

export async function submitLead(fields: LeadFields): Promise<LeadResult> {
  const { referrer, ...utm } = getStoredUTM();

  const parsed = leadInputSchema.safeParse({
    ...fields,
    locale: "ro",
    ...(utm.source || utm.medium || utm.campaign ? { utm } : {}),
    ...(referrer ? { referrer } : {}),
  });

  if (!parsed.success) return { ok: false, error: MESSAGES.invalid };

  let response: Response;
  try {
    response = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data),
    });
  } catch {
    return { ok: false, error: MESSAGES.network };
  }

  if (response.status === 429) {
    return { ok: false, error: MESSAGES.rateLimited };
  }

  if (!response.ok) {
    return {
      ok: false,
      error: response.status === 400 ? MESSAGES.invalid : MESSAGES.unavailable,
    };
  }

  const body = (await response.json().catch(() => null)) as {
    ok?: boolean;
    id?: string;
  } | null;

  // Honeypot declanșat: serverul răspunde 200 cu id gol, ca botul să
  // creadă că a reușit. Pentru un om real e imposibil să ajungă aici.
  return { ok: true, id: body?.id ?? "" };
}
