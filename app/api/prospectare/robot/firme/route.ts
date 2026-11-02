import { z } from "zod";
import { rpc } from "@/lib/prospectare/db";
import { firmaCercetata, methodNotAllowed, robotRoute } from "@/lib/prospectare/robot-api";

/**
 * POST /api/prospectare/robot/firme — firmele cercetate de robot, adăugate
 * sau actualizate, potrivite pe domeniu. Robotul trimite date de cercetare și,
 * cel mult, etapa „site_in_lucru” (aleasă pentru construit); canalele (email,
 * WhatsApp, telefon), linkul demo și etapele de contact nu se schimbă de aici.
 * Corp: { "firme": [ { "domeniu": "firma.ro", "nume": "…", … } ] } (1–500).
 */

export const dynamic = "force-dynamic";

const MAX_EXTRA = 20_000;

const schema = z.object({
  firme: z
    .array(firmaCercetata)
    .min(1, "lista e goală")
    .max(500, "cel mult 500 de firme într-o cerere")
    .refine((firme) => firme.every((f) => JSON.stringify(f.date_extra ?? {}).length <= MAX_EXTRA), `date_extra: cel mult ${MAX_EXTRA} de caractere pe firmă`),
});

export const POST = robotRoute(schema, async (robot, body) => {
  const result = await rpc<Record<string, unknown>>("prospectare_upsert_firme", {
    p_firme: body.firme,
    p_sursa: "robot",
    p_autor: robot.nume,
    p_proba: false,
  });
  if (!result.ok) return result;
  return { ok: true, data: { rezultat: result.data } };
});

export const GET = methodNotAllowed;
