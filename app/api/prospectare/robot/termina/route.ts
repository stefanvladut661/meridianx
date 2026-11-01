import { z } from "zod";
import { rpc } from "@/lib/prospectare/db";
import { httpsUrl, methodNotAllowed, robotRoute, UUID } from "@/lib/prospectare/robot-api";

/**
 * POST /api/prospectare/robot/termina — site-ul demo e gata și publicat.
 * Firma trece pe „Site gata”, primește linkul demo și captura (link de
 * Drive), iar rezervarea se închide. Doar robotul care o are rezervată.
 * Corp: { "firma_id": "<uuid>", "link_demo": "https://…", "captura_url": "https://drive…", "detalii": {…} }.
 */

export const dynamic = "force-dynamic";

const schema = z.object({
  firma_id: UUID,
  link_demo: httpsUrl,
  captura_url: z.string().trim().max(1000).regex(/^https:\/\/\S+$/, "trebuie să fie o adresă https://").optional(),
  detalii: z
    .record(z.string(), z.unknown())
    .optional()
    .refine((d) => JSON.stringify(d ?? {}).length <= 5000, "detalii: cel mult 5000 de caractere"),
});

export const POST = robotRoute(schema, async (robot, body) => {
  const result = await rpc<Record<string, unknown>>("prospectare_termina", {
    p_dispozitiv: robot.id,
    p_firma: body.firma_id,
    p_link_demo: body.link_demo,
    p_captura_url: body.captura_url ?? null,
    p_detalii: body.detalii ?? {},
  });
  if (!result.ok) return result;
  return { ok: true, data: { firma: result.data } };
});

export const GET = methodNotAllowed;
