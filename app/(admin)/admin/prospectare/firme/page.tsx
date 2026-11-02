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
const PE_PAGINA = 50;
/** Cheile pe care le citește `filtreDinAdresa` (pagina și exportul CSV). */
const CHEI = ["q", "etapa", "canal", "nisa", "oras", "lot", "scor", "mobil", "refacere", "ordine"] as const;

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

/** /admin/prospectare/firme — toate firmele, filtrate din adresă, cu fișa unei firme în `?firma=<id>`. */
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

  let stareFisa: StareFisa | null = null;
  if (firmaId && fisa) stareFisa = !fisa.ok ? { tip: "eroare", mesaj: fisa.message } : fisa.data ? { tip: "ok", fisa: fisa.data } : { tip: "lipsa" };

  return (
    <div className="space-y-4">
      <PageHead
        title="Firme"
        pill="tabel complet"
        subtitle="Toate firmele cercetate, cu etapa, canalul blocat și site-ul demo. Click pe un rând pentru detalii și cronologie."
        actions={<FirmeExport href={cu(filtruQ, `${CALE}/export`)} total={total} />}
      />

      <FirmeFiltre
        optiuni={optiuni.ok ? { nise: optiuni.data.nise ?? [], orase: optiuni.data.orase ?? [], loturi: optiuni.data.loturi ?? [] } : null}
        etape={rezumat.ok ? (rezumat.data.etape ?? {}) : null}
        totalBaza={rezumat.ok ? rezumat.data.total : null}
        gasite={total}
      />

      <Card padded={false} className="overflow-hidden">
        <div className="border-b border-border px-4 py-3">
          <SectionTitle title={total === null ? "Firme" : firmeCuNumar(total)} hint="Bordură stângă = etapa firmei. Canalul, odată setat, rămâne blocat." action={<FirmeOrdine />} />
        </div>

        {!firme.ok ? (
          <FirmeEroare mesaj={firme.message} />
        ) : firme.data.randuri.length > 0 ? (
          <>
            <FirmeTabel firme={firme.data.randuri} acum={acum} selectatId={firmaId} />
            <FirmePaginare pagina={pagina} pePagina={PE_PAGINA} total={firme.data.total} hrefPagina={(p) => cu(interogare(params, { pagina: p > 1 ? String(p) : null }))} />
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
            title="Încă nu e nicio firmă"
            text="Firmele intră din importul auto-web-rebuilder sau de la roboți, cu etapa și site-ul demo. Pornește un robot și primele apar aici."
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
