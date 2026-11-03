import type { Metadata } from "next";
import Link from "next/link";
import { Building2, SearchX } from "lucide-react";
import { citesteFirme, citesteFisa, citesteOptiuni, citesteRezumat } from "@/lib/prospectare/citire";
import { filtreDinAdresa } from "@/lib/prospectare/filtre";
import { btnClass, Card, SectionTitle } from "@/components/panou/ui/primitives";
import { EmptyState } from "@/components/panou/ui/states";
import { PageHead } from "@/components/panou/prospectare/page-head";
import { FirmeExport, FirmeFiltre, FirmeOrdine } from "@/components/panou/prospectare/firme-filtre";
import { FirmeEroare, FirmeTabel } from "@/components/panou/prospectare/firme-tabel";
import { FirmeFisa, type StareFisa } from "@/components/panou/prospectare/firme-fisa";
import { FirmePaginare } from "@/components/panou/prospectare/firme-paginare";
import { firmeCuNumar } from "@/components/panou/prospectare/firme-format";

export const metadata: Metadata = { title: "Firme — MERIDIAN Prospectare", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const CALE = "/admin/prospectare/firme";
const PE_PAGINA = 500;
/** Cheile pe care le citește `filtreDinAdresa` (pagina și exportul CSV). */
const CHEI = ["q", "etapa", "canal", "nisa", "oras", "lot", "scor", "ordine"] as const;

type Params = Record<string, string | string[] | undefined>;

const unul = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v);

/** Filtrele din adresă, ca șir de interogare, plus ce mai trebuie (pagina). Fără `firma`. */
function interogare(params: Params, extra: Record<string, string | null> = {}): string {
  const out = new URLSearchParams();
  for (const k of CHEI) {
    const v = unul(params[k])?.trim();
    if (v) out.set(k, v);
  }
  for (const [k, v] of Object.entries(extra)) if (v) out.set(k, v);
  return out.toString();
}

const cu = (query: string, cale = CALE): string => (query ? `${cale}?${query}` : cale);

/**
 * /admin/prospectare/firme — firmele cu site (sus cele necontactate, dedesubt cele contactate, fiecare
 * grupă cu numărul de site descrescător), filtrate din adresă, cu fișa unei firme în `?firma=<id>`.
 * Firmele fără site apar doar la căutare sau pe etapă; cele respinse la evaluare, niciodată.
 */
export default async function FirmePage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const filtre = filtreDinAdresa(params);
  const ceruta = Number(unul(params.pagina));
  const pagina = Number.isInteger(ceruta) && ceruta >= 1 && ceruta <= 100000 ? ceruta : 1;
  const firmaParam = unul(params.firma);
  const firmaId = firmaParam && firmaParam.length <= 64 ? firmaParam : null;

  const [firme, rezumat, optiuni, fisa] = await Promise.all([
    citesteFirme(filtre, pagina, PE_PAGINA),
    citesteRezumat(),
    citesteOptiuni(),
    firmaId ? citesteFisa(firmaId) : Promise.resolve(null),
  ]);
  const acum = Date.now();

  const filtruQ = interogare(params);
  const areFiltre = CHEI.some((k) => k !== "ordine" && Boolean(unul(params[k])?.trim()));
  const ordineQ = interogare({ ordine: params.ordine });
  const total = firme.ok ? firme.data.total : null;
  const pagini = total ? Math.ceil(total / PE_PAGINA) : 1;
  const hrefPagina = (p: number) => cu(interogare(params, { pagina: p > 1 ? String(p) : null }));

  let stareFisa: StareFisa | null = null;
  if (firmaId && fisa) stareFisa = !fisa.ok ? { tip: "eroare", mesaj: fisa.message } : fisa.data ? { tip: "ok", fisa: fisa.data } : { tip: "lipsa" };

  return (
    <div className="space-y-4">
      <PageHead title="Firme" actions={<FirmeExport href={cu(filtruQ, `${CALE}/export`)} total={total} />} />

      <FirmeFiltre
        optiuni={optiuni.ok ? { nise: optiuni.data.nise ?? [], orase: optiuni.data.orase ?? [], loturi: optiuni.data.loturi ?? [] } : null}
        etape={rezumat.ok ? (rezumat.data.etape_vizibile ?? rezumat.data.etape ?? {}) : null}
        gasite={total}
      />

      <Card padded={false} className="overflow-hidden">
        <div className="border-b border-border px-4 py-3">
          <SectionTitle title={total === null ? "Firme" : firmeCuNumar(total)} action={<FirmeOrdine />} />
        </div>

        {!firme.ok ? (
          <FirmeEroare mesaj={firme.message} />
        ) : firme.data.randuri.length > 0 ? (
          <>
            <FirmePaginare pozitie="sus" pagina={pagina} pePagina={PE_PAGINA} total={firme.data.total} hrefPagina={hrefPagina} />
            <FirmeTabel firme={firme.data.randuri} acum={acum} selectatId={firmaId} grupe={filtre.ordine === "site"} />
            <FirmePaginare pozitie="jos" pagina={pagina} pePagina={PE_PAGINA} total={firme.data.total} hrefPagina={hrefPagina} />
          </>
        ) : firme.data.total > 0 ? (
          <EmptyState
            icon={SearchX}
            title={`Pagina ${pagina} e goală`}
            text={`Filtrele astea au ${firmeCuNumar(firme.data.total)}, pe ${pagini === 1 ? "o singură pagină" : `${pagini} pagini`}.`}
            action={
              <Link href={cu(filtruQ)} className={btnClass({ variant: "outline", size: "sm" })}>
                Mergi la prima pagină
              </Link>
            }
          />
        ) : areFiltre ? (
          <EmptyState
            icon={Building2}
            title="Nicio firmă pentru filtrele alese"
            text="Scoate un filtru sau caută după alt nume. Căutarea merge pe nume, domeniu, email, telefon și #nr."
            action={
              <Link href={cu(ordineQ)} className={btnClass({ variant: "outline", size: "sm" })}>
                Curăță filtrele
              </Link>
            }
          />
        ) : (
          <EmptyState
            icon={Building2}
            title="Încă nu e niciun site publicat"
            text="Aici apar firmele al căror site e terminat, publicat și verificat, fiecare cu numărul lui de site. Pe cele fără site le găsești căutând după nume sau alegând o etapă."
            action={
              <Link href="/admin/prospectare/roboti" className={btnClass({ variant: "outline", size: "sm" })}>
                Vezi roboții
              </Link>
            }
          />
        )}
      </Card>

      {firmaId && stareFisa ? <FirmeFisa key={firmaId} stare={stareFisa} inchideHref={cu(interogare(params, { pagina: pagina > 1 ? String(pagina) : null }))} acum={acum} /> : null}
    </div>
  );
}
