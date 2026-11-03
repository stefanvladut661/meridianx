import { z } from "zod";
import { rpc } from "@/lib/prospectare/db";
import { methodNotAllowed, robotRoute, UUID } from "@/lib/prospectare/robot-api";

/**
 * POST /api/prospectare/robot/heartbeat — robotul lucrează încă la firmă:
 * rezervarea se prelungește cu încă 3 ore (Setări). Doar sesiunea care are
 * firma (migrarea 38). Dacă între timp a expirat și a luat-o alt robot sau
 * altă sesiune: 409, iar sesiunea trebuie să se oprească din lucrul la ea.
 * Corp: { "firma_id": "<uuid>", "sesiune": "2" }.
 */

export const dynamic = "force-dynamic";

const schema = z.object({ firma_id: UUID });

export const POST = robotRoute(schema, async (robot, body) => {
  const result = await rpc<string>("prospectare_heartbeat", { p_dispozitiv: robot.id, p_firma: body.firma_id, p_sesiune: robot.sesiune });
  if (!result.ok) return result;
  return { ok: true, data: { expira_la: result.data } };
});

export const GET = methodNotAllowed;
