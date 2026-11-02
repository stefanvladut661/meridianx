import { z } from "zod";
import { rpc } from "@/lib/prospectare/db";
import { methodNotAllowed, robotRoute } from "@/lib/prospectare/robot-api";

/**
 * POST /api/prospectare/robot/nisa — tabla comună de nișe (nișă + zonă).
 *
 *   { "actiune": "rezerva", "nisa": "instalatori", "zona": "Muntenia" }
 *      200 = nișa e a ta (o creează dacă nu există; `reluata: true` dacă era deja a ta).
 *      409 = rezervată de alt robot (mesajul spune de cine și de când) sau terminată.
 *      Rezervarea expiră după 24 h fără semn de viață: atunci o poate prelua alt robot.
 *   { "actiune": "progres", "nisa_id": 12, "gasite": 40, "eligibile": 18, "respinse": 22, "nota": "…" }
 *      semn de viață + cifrele (nu scad niciodată). 409 = nișa nu mai e a ta.
 *   { "actiune": "termina", "nisa_id": 12, "gasite": 61, "eligibile": 25, "respinse": 36 }
 *      nișa e terminată; nu se mai rezervă.
 */

export const dynamic = "force-dynamic";

const numar = z.number().int().min(0).max(1_000_000).optional();
const text = (max: number) => z.string().trim().min(1).max(max);
const nisaId = z.number().int().positive();

const schema = z.discriminatedUnion("actiune", [
  z.object({ actiune: z.literal("rezerva"), nisa: text(120), zona: text(120) }),
  z.object({ actiune: z.literal("progres"), nisa_id: nisaId, gasite: numar, eligibile: numar, respinse: numar, nota: z.string().trim().max(1000).optional() }),
  z.object({ actiune: z.literal("termina"), nisa_id: nisaId, gasite: numar, eligibile: numar, respinse: numar, nota: z.string().trim().max(1000).optional() }),
]);

export const POST = robotRoute(schema, async (robot, body) => {
  if (body.actiune === "rezerva") {
    const result = await rpc<Record<string, unknown>>("prospectare_nisa_rezerva", { p_dispozitiv: robot.id, p_nisa: body.nisa, p_zona: body.zona });
    if (!result.ok) return result;
    return { ok: true, data: { nisa: result.data } };
  }
  const result = await rpc<Record<string, unknown>>("prospectare_nisa_progres", {
    p_dispozitiv: robot.id,
    p_nisa_id: body.nisa_id,
    p_gasite: body.gasite ?? null,
    p_eligibile: body.eligibile ?? null,
    p_respinse: body.respinse ?? null,
    p_termina: body.actiune === "termina",
    p_nota: body.nota ?? null,
  });
  if (!result.ok) return result;
  return { ok: true, data: { nisa: result.data } };
});

export const GET = methodNotAllowed;
