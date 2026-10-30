import type { Metadata } from "next";
import Link from "next/link";
import { Users } from "lucide-react";
import { clientsForRequest } from "@/lib/ads/model/read";
import { readSelection } from "@/lib/ads/model/selection.server";
import { listMaterials } from "@/lib/ads/materials";
import { listWorkspaces } from "@/lib/ads/workspaces.server";
import { PIXEL_ID as SITE_META_PIXEL_ID } from "@/lib/meta-pixel";
import { TIKTOK_PIXEL_ID as SITE_TIKTOK_PIXEL_CODE } from "@/lib/tiktok-pixel";
import { CreateWizard } from "@/components/panou/ads/create-wizard";
import { PAGE_LEAD, PAGE_TITLE } from "@/components/panou/ads/tone";
import { Card, btnClass } from "@/components/panou/ui/primitives";
import { EmptyState } from "@/components/panou/ui/states";
import { checkPlan, chooseWorkspace, createPausedCampaign, materialUploadStatus, sendMaterialToAccount } from "../actions";
import { continueJobAction } from "../v2-actions";

export const metadata: Metadata = {
  title: "Creează ghidat — MERIDIAN Reclame",
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
        <Link href="/admin/ads/planuri" className="text-[11.5px] text-muted-foreground hover:text-foreground">
          ← Planuri
        </Link>
        <h1 className={`mt-2 ${PAGE_TITLE}`}>Creează ghidat</h1>
        <p className={PAGE_LEAD}>Același plan, în pași scurți, cu reclama vizibilă în timp ce o compui. Portalul nu pornește nimic: campania o pornești tu, din platformă.</p>
      </div>
      <Link href="/admin/ads/nou" className={btnClass({ variant: "outline", size: "sm" })}>
        Importă JSON
      </Link>
    </div>
  );

  if (!clients.ok || clients.data.length === 0) {
    return (
      <div className="space-y-4">
        {header}
        <Card className="p-0">
          {clients.ok ? (
            <EmptyState
              icon={Users}
              title="Niciun client încă"
              text="O campanie se creează în contul unui client. Adaugă-l întâi, cu conturile lui."
              action={
                <Link href="/admin/ads/clienti" className={btnClass({ variant: "primary", size: "sm" })}>
                  Adaugă primul client
                </Link>
              }
            />
          ) : (
            <p role="alert" className="px-6 py-10 text-center text-[13px] text-rose">
              {clients.message}
            </p>
          )}
        </Card>
      </div>
    );
  }

  const client = clients.data.find((item) => item.id === selection.clientId) ?? clients.data[0];

  return (
    <div className="space-y-4">
      {header}
      {!materials.ok ? (
        <p role="alert" className="rounded-xl border border-rose/25 bg-rose/[0.07] px-3.5 py-3 text-[12.5px] leading-relaxed text-[#FFC2CE]">
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
    </div>
  );
}
