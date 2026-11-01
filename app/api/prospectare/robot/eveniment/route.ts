import { z } from "zod";
import { rpc } from "@/lib/prospectare/db";
import { firmaRef, hasFirmaRef, methodNotAllowed, robotRoute } from "@/lib/prospectare/robot-api";

/**
 * POST /api/prospectare/robot/eveniment — emailurile roboților.
 *
 * Ordinea pentru fiecare email:
 *   1. { "tip": "email_de_trimis", "domeniu", "casuta" } ÎNAINTE de trimitere.
 *      200 = trimite (firma are acum canalul email); 409 = are alt canal sau e
 *      „Nu contacta” / respinsă / client → emailul NU se trimite; 429 =
 *      căsuța și-a atins limita de azi → încearcă altă căsuță sau mâine.
 *   2. { "tip": "email_trimis", "domeniu", "casuta", "message_id" } după
 *      trimitere. Același message_id a doua oară nu se numără din nou.
 * Apoi, când apar: { "tip": "bounce", … } și
 * { "tip": "raspuns", "raspuns": "pozitiv" | "nu" | "automat" | "altul", "extras" }.
 * Un răspuns „nu” trece firma pe „Nu contacta”.
 */

export const dynamic = "force-dynamic";

const casuta = z.email("casuta: adresa de pe care pleacă emailul").max(320);
const limita = z.number().int().min(0).max(2000).optional();
const messageId = z.string().trim().min(3).max(300);

const schema = z
  .discriminatedUnion("tip", [
    z.object({ tip: z.literal("email_de_trimis"), ...firmaRef, casuta, limita_azi: limita }),
    z.object({ tip: z.literal("email_trimis"), ...firmaRef, casuta, message_id: messageId, subiect: z.string().trim().max(300).optional(), limita_azi: limita }),
    z.object({ tip: z.literal("bounce"), ...firmaRef, casuta, message_id: messageId.optional(), motiv: z.string().trim().max(500).optional() }),
    z.object({
      tip: z.literal("raspuns"),
      ...firmaRef,
      casuta,
      raspuns: z.enum(["pozitiv", "nu", "automat", "altul"]),
      extras: z.string().trim().max(1000).optional(),
      message_id: messageId.optional(),
    }),
  ])
  .refine(hasFirmaRef, { message: "firma: trimite domeniu sau nr" });

export const POST = robotRoute(schema, async (robot, body) => {
  const ref = { p_domeniu: body.domeniu ?? null, p_nr: body.nr ?? null, p_casuta: body.casuta };

  if (body.tip === "email_de_trimis") {
    const result = await rpc<Record<string, unknown>>("prospectare_email_cere_canal", {
      p_dispozitiv: robot.id,
      ...ref,
      p_limita: body.limita_azi ?? null,
    });
    if (!result.ok) return result;
    return { ok: true, data: result.data };
  }

  const detalii: Record<string, unknown> =
    body.tip === "email_trimis"
      ? { message_id: body.message_id, subiect: body.subiect }
      : body.tip === "bounce"
        ? { message_id: body.message_id, motiv: body.motiv }
        : { tip: body.raspuns, extras: body.extras, message_id: body.message_id };

  const result = await rpc<Record<string, unknown>>("prospectare_email_eveniment", {
    p_dispozitiv: robot.id,
    p_tip: body.tip === "email_trimis" ? "trimis" : body.tip,
    ...ref,
    p_detalii: JSON.parse(JSON.stringify(detalii)),
    p_cheie: body.message_id ?? null,
    p_limita: body.tip === "email_trimis" ? (body.limita_azi ?? null) : null,
  });
  if (!result.ok) return result;
  return { ok: true, data: result.data };
});

export const GET = methodNotAllowed;
