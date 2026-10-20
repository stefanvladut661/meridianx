import type { Metadata } from "next";
import { clientsForRequest } from "@/lib/ads/model/read";
import { readSelection } from "@/lib/ads/model/selection.server";
import { selectionQuery } from "@/lib/ads/model/selection";
import { MATERIALS_MIGRATION_MISSING, listMaterials } from "@/lib/ads/materials";
import { MaterialsScreen } from "@/components/ads/materials-screen";
import { archiveMaterial, finishMaterialUpload, prepareMaterialUpload, renameMaterial } from "./actions";

export const metadata: Metadata = {
  title: "Materiale — MERIDIAN Reclame",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * /admin/ads/materiale — video-urile agenției, urcate o dată și alese apoi în
 * „Creează”. Lista arată materialele clientului din bara de sus plus pe cele ale
 * agenției (fără client), și în ce conturi a ajuns deja fiecare.
 */
export default async function MaterialsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const selection = await readSelection(params);
  const [clients, materials] = await Promise.all([clientsForRequest(), listMaterials()]);
  const clientList = clients.ok ? clients.data.map((client) => ({ id: client.id, name: client.name })) : [];
  const selected = clientList.find((client) => client.id === selection.clientId) ?? clientList[0] ?? null;
  const query = selectionQuery({ ...selection, clientId: selected?.id ?? null });
  const missing = !materials.ok && materials.message === MATERIALS_MIGRATION_MISSING ? materials.message : null;

  return (
    <main className="px-4 pb-16 pt-6 sm:px-6">
      <h1 className="text-[1.5rem] font-semibold tracking-tight text-bone">Materiale</h1>
      <p className="mt-0.5 max-w-2xl text-[13.5px] text-dim">
        Video-urile pentru reclame, într-un singur loc. Le urci o dată și le folosești pe orice canal: portalul le trimite în contul de reclame abia când le alegi
        într-o campanie.
      </p>
      {!materials.ok && !missing ? (
        <p role="alert" className="mt-4 max-w-2xl text-[14px] text-[var(--ap-error)]">
          Materialele nu se pot citi. {materials.message}
        </p>
      ) : null}
      <MaterialsScreen
        materials={materials.ok ? materials.data : []}
        clients={clientList}
        selectedClient={selected}
        showAll={params.toate === "1"}
        allHref={`/admin/ads/materiale?${query}&toate=1`}
        clientHref={`/admin/ads/materiale?${query}`}
        missing={missing}
        actions={{ prepare: prepareMaterialUpload, finish: finishMaterialUpload, rename: renameMaterial, archive: archiveMaterial }}
      />
    </main>
  );
}
