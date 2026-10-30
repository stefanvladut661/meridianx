import type { Metadata } from "next";
import { clientsForRequest } from "@/lib/ads/model/read";
import { readSelection } from "@/lib/ads/model/selection.server";
import { MATERIALS_MIGRATION_MISSING, listMaterials } from "@/lib/ads/materials";
import { MaterialeScreen } from "@/components/panou/ads/materiale-screen";
import { InlineNote } from "@/components/panou/ui/actions";
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
  const missing = !materials.ok && materials.message === MATERIALS_MIGRATION_MISSING ? materials.message : null;

  return (
    <>
      {!materials.ok && !missing ? (
        <InlineNote tone="rose" className="mb-4">
          Materialele nu se pot citi. {materials.message}
        </InlineNote>
      ) : null}
      <MaterialeScreen materials={materials.ok ? materials.data : []} clients={clientList} selectedClient={selected} missing={missing} actions={{ prepare: prepareMaterialUpload, finish: finishMaterialUpload, rename: renameMaterial, archive: archiveMaterial }} />
    </>
  );
}
