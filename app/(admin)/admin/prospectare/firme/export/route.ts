import { NextResponse, type NextRequest } from "next/server";
import { getAdminUser } from "@/lib/supabase/clients";
import { citesteFirmeExport } from "@/lib/prospectare/citire";
import { filtreDinAdresa } from "@/lib/prospectare/filtre";
import { continutCsv } from "@/lib/prospectare/contact";
import { CANALE, ETAPE } from "@/lib/prospectare/labels";

/**
 * GET /admin/prospectare/firme/export — firmele din filtrele curente, ca CSV
 * pentru Excel (BOM UTF-8, separator „;”). Doar pentru admin.
 */

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!(await getAdminUser())) return NextResponse.json({ error: "Sesiunea a expirat. Intră din nou în admin." }, { status: 401 });
  const filtre = filtreDinAdresa(Object.fromEntries(request.nextUrl.searchParams));
  const result = await citesteFirmeExport(filtre);
  if (!result.ok) return NextResponse.json({ error: result.message }, { status: 503 });

  const antet = ["Nr", "Nume", "Domeniu", "Nișă", "Oraș", "Județ", "Scor", "Etapă", "Canal", "Canal setat la", "Telefon", "Email", "Persoană de contact", "Site demo", "Site vechi", "Lot", "De refăcut", "Notă", "Actualizat"];
  const randuri = result.data.map((f) => [
    f.nr,
    f.nume,
    f.domeniu,
    f.nisa,
    f.oras,
    f.judet,
    f.scor,
    ETAPE[f.etapa]?.label ?? f.etapa,
    f.canal ? CANALE[f.canal].label : "",
    f.canal_setat_la ? new Date(f.canal_setat_la).toLocaleString("ro-RO", { timeZone: "Europe/Bucharest" }) : "",
    f.telefon,
    f.email,
    f.persoana_contact,
    f.link_demo,
    f.site_vechi,
    f.lot,
    f.de_refacut ? "da" : "",
    f.nota,
    new Date(f.actualizat_la).toLocaleString("ro-RO", { timeZone: "Europe/Bucharest" }),
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
