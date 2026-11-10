import { z } from "zod";
import { rpc } from "@/lib/prospectare/db";
import { methodNotAllowed, robotRoute } from "@/lib/prospectare/robot-api";

/**
 * POST /api/prospectare/robot/coada-email — firmele programate azi pe email, în ordinea în
 * care pleacă (manualele întâi), fiecare cu căsuța de pe care se trimite (a domeniului din
 * linkul demo). Robotul trimite DOAR ce primește de aici și cere canalul înainte de fiecare
 * mesaj (`/eveniment` → `email_de_trimis`; la 409 nu trimite).
 * Corp: {} sau { "casuta": "stefan@meridianxweb.com" } (doar programările acelei căsuțe).
 * Din migrarea 39: azi și restanțele (netrimisele din zilele dinainte rămân programate); listă goală
 * cât emailul e suspendat din admin (`suspendat: true`, `motiv`).
 */

export const dynamic = "force-dynamic";

const schema = z.object({
  casuta: z.string().trim().toLowerCase().max(320).regex(/^[^@\s]+@[^@\s]+\.[^@\s]+$/, "trebuie să fie o adresă de email").optional(),
});

export const POST = robotRoute(schema, async (robot, body) => {
  const result = await rpc<{ zi: string; suspendat?: boolean; motiv?: string | null; firme: unknown[]; casute: unknown[] }>("prospectare_coada_email", {
    p_dispozitiv: robot.id,
    p_sesiune: robot.sesiune,
    p_casuta: body.casuta ?? null,
  });
  if (!result.ok) return result;
  // Migrarea 39: cât emailul e suspendat din admin, lista e goală (`suspendat: true`, cu motivul).
  return {
    ok: true,
    data: { zi: result.data.zi, suspendat: result.data.suspendat ?? false, motiv: result.data.motiv ?? null, firme: result.data.firme, casute: result.data.casute },
  };
});

export const GET = methodNotAllowed;
