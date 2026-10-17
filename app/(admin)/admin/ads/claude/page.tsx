import type { Metadata } from "next";
import { claudeBrief } from "@/lib/ads/claude-brief";
import { knownAccounts } from "@/lib/ads/store";
import { currentWorkspaceId, listWorkspaces } from "@/lib/ads/workspaces.server";
import { ClaudeHelper } from "@/components/ads/claude-helper";
import { readClaudeContext } from "../actions";

export const metadata: Metadata = {
  title: "Pentru Claude — MERIDIAN Reclame",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/** Citirea conturilor trece prin toate spațiile proprietarului, pe rând. */
export const maxDuration = 60;

/**
 * /admin/ads/claude — instrucțiunile și contextul conturilor pentru
 * conversația în care se scriu planurile.
 */
export default async function ClaudePage() {
  const workspaces = listWorkspaces();
  const currentId = await currentWorkspaceId();
  const tiktok = workspaces.filter((workspace) => workspace.platform === "tiktok");
  const knownTikTok = Object.fromEntries(
    await Promise.all(tiktok.map(async (workspace) => [workspace.id, await knownAccounts(workspace.id)] as const))
  );

  return (
    <main className="mx-auto max-w-[1100px] px-4 pb-14 pt-8 sm:px-8 sm:pt-10">
      <p className="eyebrow">Reclame</p>
      <h1 className="display mt-2 text-[2.25rem] text-bone sm:text-[2.75rem]">Pentru Claude</h1>
      <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-bone/70">
        Planurile se scriu într-o conversație cu Claude. De aici îi dai tot ce îi trebuie ca să scrie planuri pe care portalul
        le primește din prima: formatul, regulile fiecărei platforme și id-urile reale din conturi.
      </p>
      <div className="mt-10">
        <ClaudeHelper
          brief={claudeBrief()}
          workspaces={workspaces}
          currentWorkspaceId={currentId}
          knownTikTok={knownTikTok}
          readContext={readClaudeContext}
        />
      </div>
    </main>
  );
}
