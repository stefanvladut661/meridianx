import { z } from "zod";
import { rpc } from "@/lib/prospectare/db";
import { methodNotAllowed, robotRoute } from "@/lib/prospectare/robot-api";

/**
 * POST /api/prospectare/robot/rezerva — următoarea firmă de construit.
 * Pe robot + sesiune (migrarea 38): întâi firma pe care o lucra deja această sesiune (după o
 * repornire), apoi cele rămase de la un robot sau o sesiune oprită, apoi refacerile, apoi scorul cel
 * mai mare. Două sesiuni nu primesc niciodată aceeași firmă; o sesiune are o singură firmă în lucru.
 * Rezervarea ține 3 ore (Setări) și se prelungește cu /heartbeat (din aceeași sesiune).
 * Corp: { "tip_lucru": "construire" | "refacere", "sesiune": "2" } (amândouă opționale).
 * Răspuns: { ok: true, firma: {…, rezervare: { tip_lucru, expira_la, reluata, sesiune }} }
 * sau { ok: true, firma: null } când nu e nimic de construit.
 */

export const dynamic = "force-dynamic";

const schema = z.object({ tip_lucru: z.enum(["construire", "refacere"]).optional() }).default({});

export const POST = robotRoute(schema, async (robot, body) => {
  const result = await rpc<Record<string, unknown> | null>("prospectare_rezerva_urmatoarea", {
    p_dispozitiv: robot.id,
    p_sesiune: robot.sesiune,
    p_tip_lucru: body.tip_lucru ?? null,
  });
  if (!result.ok) return result;
  return { ok: true, data: { firma: result.data } };
});

export const GET = methodNotAllowed;
