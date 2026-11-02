import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db, failure, NO_DB } from "./db";
import { bearerToken, hashToken } from "./tokens";

/**
 * Cadrul comun al rutelor /api/prospectare/robot/*: tokenul de dispozitiv,
 * limita de cereri, validarea corpului și răspunsurile.
 *
 * Răspunsurile au mereu aceeași formă, ca robotul să le poată citi fără
 * cazuri speciale:
 *   200 { ok: true, ... }
 *   4xx/5xx { ok: false, eroare: { cod, mesaj } }
 * Coduri: 401 token greșit sau robot dezactivat · 409 canal deja folosit
 * (email trimis o dată), firmă pe telefon, „Nu contacta”, rezervare care nu
 * e a robotului · 422 date invalide · 429 peste
 * limita de cereri pe minut sau căsuța la limită · 503 baza neconfigurată.
 */

export interface Robot {
  id: string;
  nume: string;
}

const NO_STORE = { "Cache-Control": "no-store" };

export function ok(body: Record<string, unknown>): NextResponse {
  return NextResponse.json({ ok: true, ...body }, { headers: NO_STORE });
}

export function fail(status: number, cod: string, mesaj: string, extra?: Record<string, string>): NextResponse {
  return NextResponse.json({ ok: false, eroare: { cod, mesaj } }, { status, headers: { ...NO_STORE, ...extra } });
}

/** Statusul HTTP → codul scurt pe care îl citește robotul. */
function codFor(status: number): string {
  switch (status) {
    case 401:
      return "neautorizat";
    case 404:
      return "negasit";
    case 409:
      return "conflict";
    case 422:
      return "date_invalide";
    case 429:
      return "prea_multe";
    case 503:
      return "neconfigurat";
    default:
      return "eroare";
  }
}

async function authenticate(request: NextRequest): Promise<{ ok: true; robot: Robot } | { ok: false; response: NextResponse }> {
  const token = bearerToken(request.headers.get("authorization"));
  if (!token) return { ok: false, response: fail(401, "neautorizat", "Lipsește tokenul robotului: Authorization: Bearer <token>.") };
  const client = db();
  if (!client) return { ok: false, response: fail(503, "neconfigurat", NO_DB) };

  const { data, error } = await client.rpc("prospectare_autentifica", { p_token_hash: hashToken(token) });
  if (error) {
    const f = failure(error);
    return { ok: false, response: fail(f.status, codFor(f.status), f.message) };
  }
  const robot = data as { id: string; nume: string; activ: boolean; depasit?: boolean; limita?: number } | null;
  if (!robot) return { ok: false, response: fail(401, "neautorizat", "Token necunoscut.") };
  if (!robot.activ) return { ok: false, response: fail(401, "neautorizat", `Robotul ${robot.nume} e dezactivat din admin.`) };
  if (robot.depasit) {
    return {
      ok: false,
      response: fail(429, "prea_multe", `Peste ${robot.limita} cereri pe minut. Așteaptă până la minutul următor.`, { "Retry-After": "60" }),
    };
  }
  return { ok: true, robot: { id: robot.id, nume: robot.nume } };
}

/**
 * O rută de robot: autentificare, corp JSON validat cu schema, apoi
 * `handler`. Erorile funcțiilor din bază ajung la robot cu statusul lor.
 */
export function robotRoute<S extends z.ZodType>(
  schema: S,
  handler: (robot: Robot, body: z.infer<S>) => Promise<{ ok: true; data: Record<string, unknown> } | { ok: false; message: string; status?: number }>
) {
  return async function POST(request: NextRequest): Promise<NextResponse> {
    const auth = await authenticate(request);
    if (!auth.ok) return auth.response;

    // Corp gol = `{}` (ex. /rezerva fără tip de lucru).
    let raw: unknown;
    const text = await request.text();
    if (text.length > 4_000_000) return fail(422, "date_invalide", "Cererea e prea mare: trimite firmele în loturi mai mici.");
    try {
      raw = text.trim() ? JSON.parse(text) : {};
    } catch {
      return fail(422, "date_invalide", "Corpul cererii nu e JSON valid.");
    }
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      const where = first?.path.length ? `${first.path.join(".")}: ` : "";
      return fail(422, "date_invalide", `${where}${first?.message ?? "date invalide"}`);
    }

    const result = await handler(auth.robot, parsed.data);
    if (!result.ok) {
      const status = result.status ?? 500;
      return fail(status, codFor(status), result.message);
    }
    return ok(result.data);
  };
}

export function methodNotAllowed(): NextResponse {
  return NextResponse.json(
    { ok: false, eroare: { cod: "metoda", mesaj: "Rutele roboților primesc doar POST, cu JSON." } },
    { status: 405, headers: { ...NO_STORE, Allow: "POST" } }
  );
}

// ---------------------------------------------------------------------------
// Schemele comune
// ---------------------------------------------------------------------------

const text = (max: number) => z.string().trim().max(max);
const httpsUrl = z.string().trim().max(500).regex(/^https:\/\/\S+$/, "trebuie să fie o adresă https://");

/** Firma identificată pe domeniu (preferat) sau pe numărul ei. */
export const firmaRef = {
  domeniu: text(253).min(3).optional(),
  nr: z.number().int().positive().optional(),
};

export function hasFirmaRef(value: { domeniu?: string; nr?: number }): boolean {
  return Boolean(value.domeniu) || typeof value.nr === "number";
}

export const firmaCercetata = z.object({
  domeniu: text(253).min(3),
  nr: z.number().int().positive().optional(),
  nume: text(300).min(1).optional(),
  site_vechi: text(500).optional(),
  nisa: text(200).optional(),
  oras: text(120).optional(),
  judet: text(60).optional(),
  scor: z.number().int().min(0).max(1000).nullable().optional(),
  telefon: text(40).optional(),
  email: z.email().max(320).optional(),
  persoana_contact: text(200).optional(),
  lot: text(200).optional(),
  slug: text(200).optional(),
  de_refacut: z.boolean().optional(),
  /** „site_in_lucru” = aleasă pentru construit (coada roboților). */
  etapa: z.enum(["cercetat", "site_in_lucru"]).optional(),
  date_extra: z.record(z.string(), z.unknown()).optional(),
});

export const UUID = z.uuid();
export { httpsUrl };
