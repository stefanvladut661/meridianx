import { z } from "zod";
import { rpc } from "@/lib/prospectare/db";
import { methodNotAllowed, robotRoute } from "@/lib/prospectare/robot-api";

/**
 * POST /api/prospectare/robot/rezerva — următoarea firmă de construit.
 * Întâi firma pe care robotul o lucra deja (după o repornire), apoi cele
 * rămase de la un robot oprit, apoi refacerile, apoi scorul cel mai mare.
 * Rezervarea ține 3 ore (Setări) și se prelungește cu /heartbeat.
 * Corp: { "tip_lucru": "construire" | "refacere" } (opțional: oricare).
 * Răspuns: { ok: true, firma: {…, rezervare: { tip_lucru, expira_la, reluata }} }
 * sau { ok: true, firma: null } când nu e nimic de construit.
 */

export const dynamic = "force-dynamic";

const schema = z.object({ tip_lucru: z.enum(["construire", "refacere"]).optional() }).default({});

export const POST = robotRoute(schema, async (robot, body) => {
  const result = await rpc<Record<string, unknown> | null>("prospectare_rezerva_urmatoarea", {
    p_dispozitiv: robot.id,
    p_tip_lucru: body.tip_lucru ?? null,
  });
  if (!result.ok) return result;
  return { ok: true, data: { firma: result.data } };
});

export const GET = methodNotAllowed;
