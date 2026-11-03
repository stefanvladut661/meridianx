import { z } from "zod";
import { rpc } from "@/lib/prospectare/db";
import { httpsUrl, methodNotAllowed, robotRoute, UUID } from "@/lib/prospectare/robot-api";

/**
 * POST /api/prospectare/robot/termina — site-ul demo e gata și publicat.
 *
 * Orice firmă publicată de robot, nu doar cea rezervată de el (migrarea 37); una sau mai multe odată.
 * Firma se dă după `firma_id`, `domeniu` sau `nr` (numărul de cercetare). Trece pe „Site gata”,
 * primește linkul demo și captura (link de Drive), iar rezervarea ei (a oricui) se închide.
 *
 *   { "firma_id" | "domeniu" | "nr": …, "link_demo": "https://…", "captura_url": "https://drive…", "link_verificat": true, "detalii": {…} }
 *      → { "ok": true, "firma": { firma_id, nr, nr_site, etapa, link_demo, demo_verificat } }
 *   { "firme": [ { … ca mai sus … }, … ] }            (cel mult 100)
 *      → { "ok": true, "terminate": 2, "erori": 1, "firme": [ { index, firma_id, nr, nr_site, … } | { index, …, eroare: { cod, mesaj } } ] }
 *
 * `nr_site` = numărul site-ului: crescător, fără goluri, dat de bază o singură dată, când linkul e
 * verificat. Aceeași firmă raportată din nou își păstrează numărul. Firma intră în distribuție doar cu
 * linkul verificat (implicit da: ruta se cheamă după publicare și verificarea linkului).
 */

export const dynamic = "force-dynamic";

const detalii = z
  .record(z.string(), z.unknown())
  .optional()
  .refine((d) => JSON.stringify(d ?? {}).length <= 5000, "detalii: cel mult 5000 de caractere");

// Fără firma_id, domeniu sau nr, baza răspunde pe poziția firmei: 404, „Firma nu există”.
const firma = z.object({
  firma_id: UUID.optional(),
  domeniu: z.string().trim().min(3).max(253).optional(),
  nr: z.number().int().positive().optional(),
  link_demo: httpsUrl,
  captura_url: z.string().trim().max(1000).regex(/^https:\/\/\S+$/, "trebuie să fie o adresă https://").optional(),
  link_verificat: z.boolean().optional(),
  detalii,
});

// O firmă sau `{ firme: [...] }`: forma se alege după cheia `firme`, ca erorile să arate câmpul exact.
const schema = z.preprocess(
  (v) => (v && typeof v === "object" && !Array.isArray(v) ? { ...v, forma: "firme" in v ? "lot" : "una" } : v),
  z.discriminatedUnion("forma", [z.object({ forma: z.literal("lot"), firme: z.array(firma).min(1).max(100) }), firma.extend({ forma: z.literal("una") })])
);

type Rezultat = { firma_id?: string; nr?: number; nr_site?: number | null; eroare?: { cod: string; mesaj: string } };

/** Codul de eroare al bazei (PR404, PR422…) → statusul HTTP, ca la celelalte rute. */
function status(cod: string | undefined): number {
  const m = /^PR(\d{3})$/.exec(cod ?? "");
  return m ? (m[1] === "410" ? 409 : Number(m[1])) : 500;
}

export const POST = robotRoute(schema, async (robot, body) => {
  const lot = body.forma === "lot";
  // Cheia `forma` (pusă de schemă) nu contează pentru bază: firma se caută după firma_id, domeniu sau nr.
  const firme = body.forma === "lot" ? body.firme : [body];
  const result = await rpc<{ terminate: number; erori: number; firme: Rezultat[] }>("prospectare_termina_lot", {
    p_dispozitiv: robot.id,
    p_firme: firme.map((f) => ({ ...f, detalii: f.detalii ?? {}, link_verificat: f.link_verificat ?? true })),
  });
  if (!result.ok) return result;

  const ok = result.data.firme.filter((f) => !f.eroare);
  if (ok.length) {
    // Pagina Roboți: ce a făcut robotul ultima dată.
    const ce = ok.length === 1 ? `a publicat #${String(ok[0].nr ?? "")} (site ${String(ok[0].nr_site ?? "")})` : `a publicat ${ok.length} site-uri`;
    await rpc("prospectare_robot_ce_face", { p_dispozitiv: robot.id, p_tip: "constructie", p_detaliu: ce });
  }

  if (!lot) {
    const f = result.data.firme[0];
    if (f?.eroare) return { ok: false, message: f.eroare.mesaj, status: status(f.eroare.cod) };
    return { ok: true, data: { firma: f } };
  }
  return { ok: true, data: { terminate: result.data.terminate, erori: result.data.erori, firme: result.data.firme } };
});

export const GET = methodNotAllowed;
