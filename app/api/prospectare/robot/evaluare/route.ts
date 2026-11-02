import { z } from "zod";
import { rpc } from "@/lib/prospectare/db";
import { methodNotAllowed, robotRoute } from "@/lib/prospectare/robot-api";

/**
 * POST /api/prospectare/robot/evaluare — firmele evaluate de roboți.
 *
 *   { "actiune": "verifica", "domenii": ["firma.ro", "https://www.alta.ro/"] }
 *      → { "deja_evaluate": [{ domeniu, nr, evaluare, scor, motiv, evaluat_la }], "noi": ["alta.ro"] }
 *      Un domeniu deja evaluat (de oricine) se sare: nu se mai cercetează.
 *   { "actiune": "noteaza", "nisa_id": 12, "firme": [{ "domeniu", "nume", "scor", "evaluare": "eligibila" | "respinsa", "motiv", … }] }
 *      Se notează TOATE firmele evaluate, și cele respinse (cu motivul și scorul).
 *      Răspunsul: adaugate, eligibile, respinse, deja_evaluate (sărite), invalide.
 *      Cifrele nișei cresc singure. Firmele eligibile cu scor ≥ prag (Setări), cu email
 *      sau mobil, intră în coada comună de construcție (/rezerva).
 */

export const dynamic = "force-dynamic";

const text = (max: number) => z.string().trim().max(max);

const firma = z
  .object({
    domeniu: text(253).min(3),
    nume: text(300).optional(),
    site_vechi: text(500).optional(),
    nisa: text(200).optional(),
    oras: text(120).optional(),
    judet: text(60).optional(),
    scor: z.number().int().min(0).max(1000),
    evaluare: z.enum(["eligibila", "respinsa"]),
    motiv: text(500).optional(),
    telefon: text(40).optional(),
    email: z.email().max(320).optional(),
    persoana_contact: text(200).optional(),
    date_extra: z.record(z.string(), z.unknown()).optional(),
  })
  .refine((f) => f.evaluare !== "respinsa" || Boolean(f.motiv), { message: "la firmele respinse, motivul e obligatoriu", path: ["motiv"] });

const schema = z.discriminatedUnion("actiune", [
  z.object({ actiune: z.literal("verifica"), domenii: z.array(text(253).min(3)).min(1).max(1000) }),
  z.object({ actiune: z.literal("noteaza"), nisa_id: z.number().int().positive().optional(), firme: z.array(firma).min(1).max(500) }),
]);

export const POST = robotRoute(schema, async (robot, body) => {
  if (body.actiune === "verifica") {
    const result = await rpc<Record<string, unknown>>("prospectare_evaluare_verifica", { p_domenii: body.domenii });
    if (!result.ok) return result;
    return { ok: true, data: result.data };
  }
  const result = await rpc<Record<string, unknown>>("prospectare_evaluare_noteaza", {
    p_dispozitiv: robot.id,
    p_nisa_id: body.nisa_id ?? null,
    p_firme: body.firme,
  });
  if (!result.ok) return result;
  return { ok: true, data: result.data };
});

export const GET = methodNotAllowed;
