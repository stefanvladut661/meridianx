import type { Metadata } from "next";
import { claudeBrief } from "@/lib/ads/claude-brief";
import { knownAccounts } from "@/lib/ads/store";
import { currentWorkspaceId, listWorkspaces } from "@/lib/ads/workspaces.server";
import { ClaudeHelper } from "@/components/panou/ads/claude-helper";
import { chooseWorkspace, readClaudeContext } from "../actions";

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
    <div className="space-y-4">
      <ClaudeHelper
        brief={claudeBrief()}
        workspaces={workspaces}
        currentWorkspaceId={currentId}
        knownTikTok={knownTikTok}
        readContext={readClaudeContext}
        chooseWorkspace={chooseWorkspace}
      />
    </div>
  );
}
