import { z } from "zod";
import { rpc } from "@/lib/prospectare/db";
import { methodNotAllowed, robotRoute } from "@/lib/prospectare/robot-api";

/**
 * POST /api/prospectare/robot/coada-email — firmele programate azi pe email, în ordinea în
 * care pleacă (manualele întâi), fiecare cu căsuța de pe care se trimite (a domeniului din
 * linkul demo). Robotul trimite DOAR ce primește de aici și cere canalul înainte de fiecare
 * mesaj (`/eveniment` → `email_de_trimis`; la 409 nu trimite).
 * Corp: {} sau { "casuta": "stefan@meridianxweb.com" } (doar programările acelei căsuțe).
 * Ciclul zilei (00:00, ora României) se pornește singur dacă n-a rulat încă.
 */

export const dynamic = "force-dynamic";

const schema = z.object({
  casuta: z.string().trim().toLowerCase().max(320).regex(/^[^@\s]+@[^@\s]+\.[^@\s]+$/, "trebuie să fie o adresă de email").optional(),
});

export const POST = robotRoute(schema, async (robot, body) => {
  const result = await rpc<{ zi: string; firme: unknown[]; casute: unknown[] }>("prospectare_coada_email", {
    p_dispozitiv: robot.id,
    p_sesiune: robot.sesiune,
    p_casuta: body.casuta ?? null,
  });
  if (!result.ok) return result;
  return { ok: true, data: { zi: result.data.zi, firme: result.data.firme, casute: result.data.casute } };
});

export const GET = methodNotAllowed;
