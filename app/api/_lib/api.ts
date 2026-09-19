import { NextResponse, type NextRequest } from "next/server";
import type { ApiError } from "@/lib/validations/lead";

/**
 * Utilitare comune pentru rutele API (FAZA 6).
 *
 * Fișierul stă sub `app/api/_lib/` — prefixul `_` îl ține în afara
 * rutării, iar folderul rămâne în zona FAZEI 6 (CLAUDE.md §6). Nu punem
 * nimic în `lib/` la rădăcină: acolo e zona contractelor înghețate.
 */

// ---------------------------------------------------------------------------
// Răspunsuri
// ---------------------------------------------------------------------------

/**
 * Erorile către client sunt intenționat sărace: spun ce s-a întâmplat și
 * ce să faci, dar niciodată de ce a picat baza de date. Detaliile interne
 * merg în logurile serverului (CLAUDE.md §4 + cerința din brief).
 */
export function apiError(message: string, status: number) {
  const body: ApiError = { ok: false, error: message };
  return NextResponse.json(body, { status });
}

export const ERRORS = {
  badJson: "Corpul cererii nu e JSON valid.",
  invalid: "Datele trimise nu sunt valide.",
  invalidQuery: "Parametrii de filtrare nu sunt valizi.",
  notFound: "Lead-ul nu există sau a fost șters.",
  unauthorized: "Trebuie să fii autentificat.",
  // Nu promitem „un minut”: fereastra e de 10 minute, iar timpul real
  // rămas pleacă în antetul `Retry-After`. O eroare care minte despre
  // durată e o eroare vagă (CLAUDE.md §4).
  rateLimited:
    "Ai trimis prea multe cereri într-un timp scurt. Mai încearcă peste câteva minute — sau sună-ne, e mai rapid.",
  unavailable:
    "Nu putem prelua cererea chiar acum. Sună-ne sau încearcă din nou în câteva minute.",
} as const;

/** Citește body-ul o singură dată, fără să arunce. */
export async function readJson(
  request: NextRequest
): Promise<{ ok: true; body: unknown } | { ok: false }> {
  try {
    return { ok: true, body: await request.json() };
  } catch {
    return { ok: false };
  }
}

// ---------------------------------------------------------------------------
// IP-ul clientului
// ---------------------------------------------------------------------------

/**
 * Pe Vercel, IP-ul real e primul din `x-forwarded-for`. Restul lanțului e
 * adăugat de proxy-uri și nu e de încredere.
 */
export function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip") ?? "necunoscut";
}

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------

/**
 * Fereastră glisantă în memoria procesului.
 *
 * LIMITARE ONESTĂ: pe serverless, memoria e per instanță. Un atacator care
 * nimerește instanțe diferite obține un plafon mai mare decât cel afișat,
 * iar la scale-down contorul se pierde. E suficient împotriva spam-ului de
 * formular obișnuit și nu costă nicio dependență; pentru protecție reală
 * la scară trebuie Upstash/Redis. Notat în PLAN.md ca decizie, nu ca scăpare.
 */
interface Window {
  hits: number[];
}

const buckets = new Map<string, Window>();
let lastSweep = Date.now();

/** Curățenie amortizată: fără timer, fără scurgere de memorie. */
function sweep(now: number, windowMs: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, window] of buckets) {
    window.hits = window.hits.filter((time) => now - time < windowMs);
    if (window.hits.length === 0) buckets.delete(key);
  }
}

export interface RateLimitVerdict {
  allowed: boolean;
  /** Secunde până când mai poate încerca. */
  retryAfter: number;
}

export function rateLimit(
  key: string,
  { limit, windowMs }: { limit: number; windowMs: number }
): RateLimitVerdict {
  const now = Date.now();
  sweep(now, windowMs);

  const window = buckets.get(key) ?? { hits: [] };
  window.hits = window.hits.filter((time) => now - time < windowMs);

  if (window.hits.length >= limit) {
    const oldest = window.hits[0] ?? now;
    buckets.set(key, window);
    return {
      allowed: false,
      retryAfter: Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000)),
    };
  }

  window.hits.push(now);
  buckets.set(key, window);
  return { allowed: true, retryAfter: 0 };
}

/** 429 cu `Retry-After` — clientul poate afișa un timp real. */
export function rateLimitedResponse(verdict: RateLimitVerdict) {
  const response = apiError(ERRORS.rateLimited, 429);
  response.headers.set("Retry-After", String(verdict.retryAfter));
  return response;
}

/** Praguri, într-un singur loc ca să se poată ajusta fără vânătoare. */
export const LIMITS = {
  /** Trimiteri de formular per IP. Generos pentru un om, strâmt pentru un bot. */
  leadCreate: { limit: 5, windowMs: 10 * 60 * 1000 },
  /** Evenimente (pași de brief) — ruta e publică, deci merită plafon. */
  leadEvent: { limit: 60, windowMs: 10 * 60 * 1000 },
  /** Încercări de autentificare per IP. */
  login: { limit: 10, windowMs: 15 * 60 * 1000 },
  /** Verificarea de sănătate — generoasă pentru un uptime check la minut. */
  health: { limit: 60, windowMs: 60 * 1000 },
} as const;

// ---------------------------------------------------------------------------
// Honeypot
// ---------------------------------------------------------------------------

/**
 * Se verifică pe body-ul BRUT, înainte de `safeParse`.
 *
 * De ce: schema FAZEI 0 declară `website: z.string().max(0)`, deci o
 * valoare non-goală face parse-ul să pice și ruta ar răspunde 400 — exact
 * invers față de contract, care cere 200 `{ ok: true, id: "" }` ca botul
 * să creadă că a reușit. Schema e fișier înghețat, așa că verificarea se
 * mută înaintea ei, în rută. (Cererea F3 din PLAN.md — rezolvată aici.)
 */
export function isHoneypotTripped(body: unknown): boolean {
  if (typeof body !== "object" || body === null) return false;
  const value = (body as Record<string, unknown>).website;
  return typeof value === "string" && value.trim() !== "";
}

// ---------------------------------------------------------------------------
// Cron
// ---------------------------------------------------------------------------

/**
 * Cererea vine de la cron-ul Vercel?
 *
 * Vercel trimite `Authorization: Bearer <CRON_SECRET>` la fiecare
 * invocare, dacă variabila există în proiect. Fără ea, în producție
 * refuzăm tot: o rută de cron deschisă e un buton public de „trimite-mi
 * un email" și de „scrie în bază”. În dezvoltare, unde nu există cron,
 * lipsa secretului lasă ruta apelabilă din browser ca să se poată testa.
 */
export function isCronRequest(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      console.error("[cron] CRON_SECRET lipsește în producție — invocarea a fost refuzată.");
    }
    return process.env.NODE_ENV !== "production";
  }
  return request.headers.get("authorization") === `Bearer ${secret}`;
}
