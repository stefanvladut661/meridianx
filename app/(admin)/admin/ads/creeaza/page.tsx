import type { Metadata } from "next";
import Link from "next/link";
import { clientsForRequest } from "@/lib/ads/model/read";
import { readSelection } from "@/lib/ads/model/selection.server";
import { listMaterials } from "@/lib/ads/materials";
import { listWorkspaces } from "@/lib/ads/workspaces.server";
import { PIXEL_ID as SITE_META_PIXEL_ID } from "@/lib/meta-pixel";
import { TIKTOK_PIXEL_ID as SITE_TIKTOK_PIXEL_CODE } from "@/lib/tiktok-pixel";
import { CreateWizard } from "@/components/ads/create-wizard";
import { checkPlan, chooseWorkspace, createPausedCampaign, materialUploadStatus, sendMaterialToAccount } from "../actions";
import { continueJobAction } from "../v2-actions";

export const metadata: Metadata = {
  title: "Creează — MERIDIAN Reclame",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";
// Trimiterea unui video în cont și crearea pe pași rulează în funcția paginii.
export const maxDuration = 60;

/**
 * /admin/ads/creeaza — o campanie nouă, pe pași, pentru clientul din bara de sus.
 * Scrie același plan JSON ca „Importă JSON” și trece prin aceeași verificare și
 * creare pe pauză. Reclamele se aleg din Materiale.
 */
export default async function CreatePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const selection = await readSelection(params);
  const [clients, materials] = await Promise.all([clientsForRequest(), listMaterials()]);

  const header = (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-[1.5rem] font-semibold tracking-tight text-bone">Creează o campanie</h1>
        <p className="mt-0.5 max-w-2xl text-[13.5px] text-dim">Pas cu pas, pe pauză. Portalul nu pornește nimic: campania o pornești tu, din platformă.</p>
      </div>
      <Link href="/admin/ads/nou" className="btn btn-ghost !min-h-10 !px-4 !text-[14px]">
        Importă JSON
      </Link>
    </div>
  );

  if (!clients.ok || clients.data.length === 0) {
    return (
      <main className="px-4 pb-16 pt-6 sm:px-6">
        {header}
        <div className="mt-6 max-w-2xl rounded-xl border border-hair bg-[var(--ap-side)] px-5 py-4 text-[14px] text-bone/85">
          {clients.ok ? (
            <>
              <p className="text-[15px] font-semibold text-bone">Niciun client încă.</p>
              <p className="mt-1">O campanie se creează în contul unui client. Adaugă-l întâi, cu conturile lui.</p>
              <Link href="/admin/ads/clienti" className="btn btn-light mt-4 !min-h-10 !px-4 !text-[14px]">
                Adaugă primul client
              </Link>
            </>
          ) : (
            <p role="alert" className="text-[var(--ap-error)]">
              {clients.message}
            </p>
          )}
        </div>
      </main>
    );
  }

  const client = clients.data.find((item) => item.id === selection.clientId) ?? clients.data[0];

  return (
    <main className="px-4 pb-16 pt-6 sm:px-6">
      {header}
      {!materials.ok ? (
        <p role="alert" className="mt-4 max-w-2xl text-[14px] text-[var(--ap-error)]">
          Materialele nu se pot citi: {materials.message}
        </p>
      ) : null}
      <CreateWizard
        key={client.id}
        client={{ id: client.id, name: client.name, owner: client.owner }}
        accounts={client.accounts}
        materials={materials.ok ? materials.data : []}
        workspaces={listWorkspaces()}
        sitePixel={{ meta: SITE_META_PIXEL_ID, tiktok: SITE_TIKTOK_PIXEL_CODE }}
        actions={{
          chooseWorkspace,
          checkPlan,
          createPaused: createPausedCampaign,
          continueJob: continueJobAction,
          sendMaterial: sendMaterialToAccount,
          materialStatus: materialUploadStatus,
        }}
      />
    </main>
  );
}
