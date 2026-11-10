import { z } from "zod";
import { rpc } from "@/lib/prospectare/db";
import { methodNotAllowed, robotRoute } from "@/lib/prospectare/robot-api";

/**
 * POST /api/prospectare/robot/publicare — lacătul de publicare (migrarea 39): un singur calculator publică odată.
 *
 *   { "actiune": "ia" | "bate" | "elibereaza" | "stare", "sesiune": "stefan-1" }
 *      → 200 { "ok": true, "actiune": "ia", "mesaj": "…", "lacat": { liber, al_meu, robot, sesiune, din, batut_la, expira_la } }
 *      → 409 { "ok": false, "lacat": { … cine îl ține și de când … }, "eroare": { "cod": "conflict", "mesaj": "Lacătul de publicare e la …" } }
 *
 * Lacătul e al calculatorului (al tokenului): orice sesiune a lui îl poate bate sau elibera. Fără „bate” 30 de minute,
 * expiră singur și îl poate lua alt calculator.
 */

export const dynamic = "force-dynamic";

const schema = z.object({ actiune: z.enum(["ia", "bate", "elibereaza", "stare"], "actiune: „ia”, „bate”, „elibereaza” sau „stare”") });

type Lacat = { liber: boolean; al_meu: boolean; robot: string | null; sesiune: string | null; din: string | null; batut_la: string | null; expira_la: string | null };

export const POST = robotRoute(schema, async (robot, body) => {
  const result = await rpc<{ ok: boolean; actiune: string; mesaj: string; lacat: Lacat }>("prospectare_lacat_publicare", {
    p_dispozitiv: robot.id,
    p_actiune: body.actiune,
    p_sesiune: robot.sesiune,
  });
  if (!result.ok) return result;
  const r = result.data;
  if (!r.ok) return { ok: false, message: r.mesaj, status: 409, corp: { actiune: r.actiune, lacat: r.lacat } };
  return { ok: true, data: { actiune: r.actiune, mesaj: r.mesaj, lacat: r.lacat } };
});

export const GET = methodNotAllowed;
