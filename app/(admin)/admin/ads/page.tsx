import type { Metadata } from "next";
import Link from "next/link";
import { listWorkspaces, currentWorkspaceId } from "@/lib/ads/workspaces.server";
import { PauseGlyph } from "@/components/ads/pause-seal";
import { CampaignList } from "@/components/ads/campaign-list";
import { STORE_FAILURE_MESSAGE, listCampaigns } from "@/lib/ads/store";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Reclame — MERIDIAN Admin",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * /admin/ads — campaniile create din portal, din toate spațiile de lucru.
 *
 * Citite din `ads_campaigns` (migrarea 6), prin sesiune — deci prin RLS.
 * Fără campanii, ecranul gol e o invitație (CLAUDE.md §4): spune ce va
 * apărea aici și unde se face prima campanie. Dedesubt, starea tokenurilor
 * — singurul lucru de configurat pe server înainte de prima creare.
 */
export default async function AdsCampaignsPage() {
  const workspaces = listWorkspaces();
  const currentId = await currentWorkspaceId();
  const campaigns = await listCampaigns();
  const hasCampaigns = campaigns.ok && campaigns.data.length > 0;

  return (
    <main className="mx-auto max-w-[1400px] px-4 pb-24 pt-8 sm:px-8 sm:pt-10">
      <p className="eyebrow">Reclame</p>
      <h1 className="display mt-2 text-[2.5rem] text-bone sm:text-[3rem]">Campanii</h1>

      {!campaigns.ok ? (
        <div role="alert" className="mt-8 rounded-panel-lg border border-[#ff6b6b]/35 bg-[#ff6b6b]/[0.05] px-5 py-4">
          <p className="text-[15px] font-semibold text-[#ff8a8a]">Lista de campanii nu se poate citi.</p>
          <p className="mt-1.5 text-[14px] leading-relaxed text-bone/80">{STORE_FAILURE_MESSAGE[campaigns.reason]}</p>
        </div>
      ) : null}

      {hasCampaigns ? (
        <section aria-labelledby="lista" className="mt-8">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 id="lista" className="eyebrow">
              {campaigns.data.length === 1 ? "O campanie creată" : `${campaigns.data.length} campanii create`} din
              portal
            </h2>
            <Link href="/admin/ads/nou" className="btn btn-light !min-h-10 !px-4 !py-2 !text-[13px]">
              Plan nou <span className="arw" aria-hidden>→</span>
            </Link>
          </div>
          <div className="mt-4">
            <CampaignList campaigns={campaigns.data} workspaces={workspaces} currentId={currentId} />
          </div>
          <p className="mt-3 max-w-2xl text-[13.5px] leading-relaxed text-dim">
            Statusul e cel de la creare. Cheltuiala și rezultatele apar aici după ce pornește
            sincronizarea zilnică a cifrelor.
          </p>
        </section>
      ) : (
        <section
          aria-labelledby="gol"
          className="glass-2 edge-light mt-8 grid gap-8 p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"
        >
          <div className="max-w-2xl">
            <h2 id="gol" className="font-md-display text-[1.5rem] font-semibold leading-tight text-bone">
              Portalul n-a creat încă nicio campanie.
            </h2>
            <p className="mt-3 text-[15.5px] leading-relaxed text-bone/75">
              Aici apar campaniile create din portal, din toate spațiile de lucru, cu status, buget,
              cheltuială și rezultate. Prima se face din <strong className="text-bone">Plan nou</strong>:
              lipești planul JSON, îl citești în română, corectezi ce e greșit și o creezi — oprită.
            </p>
            <Link href="/admin/ads/nou" className="btn btn-light mt-6">
              Scrie primul plan <span className="arw" aria-hidden>→</span>
            </Link>
          </div>
          <div className="flex items-center gap-4 text-bone lg:pr-4">
            <PauseGlyph className="h-16 w-16 shrink-0 text-bone/90" />
            <p className="max-w-[16rem] font-md-mono text-[12px] leading-relaxed tracking-wide text-dim">
              Orice campanie pleacă de aici oprită. O pornești tu, în Ads Manager.
            </p>
          </div>
        </section>
      )}

      <section aria-labelledby="tokenuri" className="mt-12">
        <h2 id="tokenuri" className="eyebrow">
          Tokenurile spațiilor de lucru
        </h2>
        <ul className="mt-4 grid gap-px overflow-hidden rounded-panel-lg border border-hair bg-hair sm:grid-cols-2 xl:grid-cols-4">
          {workspaces.map((workspace) => (
            <li
              key={workspace.id}
              className={cn(
                "bg-char px-5 py-5",
                workspace.id === currentId && "bg-[radial-gradient(120%_140%_at_0%_0%,rgb(255_255_255/0.1),transparent_60%)]"
              )}
            >
              <p className="flex items-center gap-2 text-[15px] font-semibold text-bone">
                {workspace.name}
                {workspace.id === currentId ? (
                  <span className="font-md-mono text-[10.5px] font-normal uppercase tracking-[0.18em] text-dim">
                    · aici ești
                  </span>
                ) : null}
              </p>
              <p className="mt-1 text-[13.5px] text-dim">
                {workspace.owner === "clienti" ? "Conturile clienților" : "Reclamele agenției"}
              </p>
              <p className="mt-4 flex items-center gap-2 text-[13.5px]">
                <span
                  aria-hidden
                  className={cn(
                    "h-2 w-2 rounded-full",
                    workspace.tokenConfigured ? "bg-[#1fb583]" : "border border-bone/50"
                  )}
                />
                <span className={workspace.tokenConfigured ? "text-[#4fd6a5]" : "text-bone/80"}>
                  {workspace.tokenConfigured ? "Token setat" : "Token nesetat"}
                </span>
              </p>
              <p className="mt-1 break-all font-md-mono text-[11.5px] text-dim">{workspace.tokenEnv}</p>
            </li>
          ))}
        </ul>
        <p className="mt-3 max-w-2xl text-[13.5px] leading-relaxed text-dim">
          Fără token, un spațiu se poate folosi doar pentru verificarea planurilor. Tokenul se pune în
          Vercel → Settings → Environment Variables și nu ajunge niciodată în browser.
        </p>
      </section>
    </main>
  );
}
