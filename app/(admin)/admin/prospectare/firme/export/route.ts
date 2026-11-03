import { NextResponse, type NextRequest } from "next/server";
import { getAdminUser } from "@/lib/supabase/clients";
import { citesteFirmeExport } from "@/lib/prospectare/citire";
import { filtreDinAdresa } from "@/lib/prospectare/filtre";
import { continutCsv } from "@/lib/prospectare/contact";
import { ETAPE } from "@/lib/prospectare/labels";

/**
 * GET /admin/prospectare/firme/export — firmele din filtrele curente, ca CSV
 * pentru Excel (BOM UTF-8, separator „;”). Doar pentru admin. Fiecare canal
 * are coloana lui (o firmă poate avea email și WhatsApp); gol = nefolosit.
 * Aceleași firme și aceeași ordine ca tabelul (numărul de site primul).
 */

export const dynamic = "force-dynamic";

/** Data și ora în România, ca text pentru Excel; gol când lipsește. */
const oraRo = (v: string | null): string => (v ? new Date(v).toLocaleString("ro-RO", { timeZone: "Europe/Bucharest" }) : "");

export async function GET(request: NextRequest) {
  if (!(await getAdminUser())) return NextResponse.json({ error: "Sesiunea a expirat. Intră din nou în admin." }, { status: 401 });
  const filtre = filtreDinAdresa(Object.fromEntries(request.nextUrl.searchParams));
  const result = await citesteFirmeExport(filtre);
  if (!result.ok) return NextResponse.json({ error: result.message }, { status: 503 });

  const antet = ["Nr site", "Nr cercetare", "Nume", "Domeniu", "Nișă", "Oraș", "Județ", "Scor", "Etapă", "Email trimis la", "WhatsApp trimis la", "Cont WhatsApp", "În apeluri din", "Telefon", "Email", "Persoană de contact", "Site demo", "Site vechi", "Lot", "De refăcut", "Notă", "Actualizat"];
  const randuri = result.data.map((f) => [
    f.nr_site,
    f.nr,
    f.nume,
    f.domeniu,
    f.nisa,
    f.oras,
    f.judet,
    f.scor,
    ETAPE[f.etapa]?.label ?? f.etapa,
    oraRo(f.email_la),
    oraRo(f.whatsapp_la),
    f.whatsapp_la ? f.whatsapp_cont : null,
    oraRo(f.telefon_la),
    f.telefon,
    f.email,
    f.persoana_contact,
    f.link_demo,
    f.site_vechi,
    f.lot,
    f.de_refacut ? "da" : "",
    f.nota,
    oraRo(f.actualizat_la),
  ]);
  const zi = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Bucharest" }).format(new Date());
  return new NextResponse(continutCsv(antet, randuri), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="firme-prospectare-${zi}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
