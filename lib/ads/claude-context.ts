import "server-only";

import type { AccountContext } from "./claude-brief";
import { adapterFor } from "./platform";
import type { AdsWorkspace } from "./workspaces";
import { workspaceName } from "./workspaces";
import { listAdAccounts, listInstagramAccounts, listLibrary as listMetaLibrary, listPages, listPixels } from "./meta/lookup";
import { listIdentities, listLibrary as listTikTokLibrary, listTikTokPixels, readAdvertiser } from "./tiktok/lookup";
import { googleSearch } from "./google/api";
import { readNegativeLists } from "./google/account/read";
import { CHANNEL_LABEL, CAMPAIGN_STATUS_LABEL, label } from "./google/account/labels";
import { CONVERSION_TYPE_LABEL } from "./google/conversions/standard";
import { listConversionActions, listGoogleAccounts, listGoogleLibrary } from "./google/lookup";

/**
 * Contextul conturilor pentru conversația cu Claude: ce id-uri poate folosi
 * un plan (conturi, pagini, pixeli sau conversii, identități, video-uri),
 * citite acum din platforme cu tokenul fiecărui spațiu. Doar citiri.
 *
 * Câte un spațiu odată, fiecare cu tokenul lui. O eroare pe un cont devine o
 * notă în context, nu oprește restul.
 */

const ACCOUNTS_PER_WORKSPACE = 3;
const VIDEOS_PER_ACCOUNT = 25;
/** Google: campaniile existente arătate pe cont (cele active și pe pauză, după nume). */
const CAMPAIGNS_PER_ACCOUNT = 60;

export async function readAccountContext(workspace: AdsWorkspace, hints: string[]): Promise<AccountContext> {
  const context: AccountContext = {
    workspaceId: workspace.id,
    workspaceName: workspaceName(workspace),
    accounts: [],
    identities: [],
    instagram: [],
    conversions: [],
    videos: [],
    notes: [],
  };
  const describe = (error: unknown, what: string) => adapterFor(workspace.platform).describeError(error, what, workspace.tokenEnv);

  try {
    if (workspace.platform === "meta") {
      const accounts = await listAdAccounts(workspace);
      context.accounts = accounts.slice(0, 10).map(({ id, name, currency, state }) => ({ id, name, currency, state }));
      context.identities = (await listPages(workspace).catch(() => [])).slice(0, 20);
      for (const account of accounts.filter((item) => item.usable).slice(0, ACCOUNTS_PER_WORKSPACE)) {
        const [pixels, instagram, library] = await Promise.all([
          listPixels(workspace, account.id).catch(() => []),
          listInstagramAccounts(workspace, account.id).catch(() => []),
          listMetaLibrary(workspace, account.id).catch(() => ({ videos: [], truncated: false })),
        ]);
        context.conversions.push(...pixels.map((pixel) => ({ ...pixel, note: `contul ${account.id}` })));
        context.instagram.push(...instagram.map((item) => ({ id: item.id, name: item.username })));
        context.videos.push(
          ...library.videos
            .filter((video) => video.ready)
            .slice(0, VIDEOS_PER_ACCOUNT)
            .map((video) => ({ id: video.id, title: video.title, seconds: video.lengthSeconds, account: account.id }))
        );
      }
      if (accounts.length === 0) context.notes.push("Tokenul nu vede niciun cont de reclame — atribuie conturile System User-ului.");
    } else if (workspace.platform === "tiktok") {
      if (hints.length === 0) {
        context.notes.push(
          "TikTok nu lasă tokenul să-și listeze conturile: scrie advertiser_id-ul în portal (Pentru Claude → TikTok) ca să apară aici identitățile, pixelii și video-urile."
        );
      }
      for (const advertiserId of hints.slice(0, ACCOUNTS_PER_WORKSPACE)) {
        const account = await readAdvertiser(workspace, advertiserId);
        if (!account) {
          context.notes.push(`Tokenul nu vede contul TikTok ${advertiserId}.`);
          continue;
        }
        context.accounts.push({ id: account.id, name: account.name, currency: account.currency, state: account.state });
        const [identities, pixels, library] = await Promise.all([
          listIdentities(workspace, advertiserId, "TT_USER", undefined).catch(() => []),
          listTikTokPixels(workspace, advertiserId).catch(() => []),
          listTikTokLibrary(workspace, advertiserId).catch(() => ({ videos: [], truncated: false })),
        ]);
        context.identities.push(
          ...identities.map((identity) => ({
            id: identity.id,
            name: identity.name,
            note: `TT_USER, contul ${advertiserId}${identity.canPushVideo ? "" : ", fără push — nu merge pentru video-urile agenției"}`,
          }))
        );
        context.conversions.push(
          ...pixels.map((pixel) => ({ id: pixel.code ?? pixel.id, name: pixel.name, note: `id ${pixel.id}, contul ${advertiserId}` }))
        );
        context.videos.push(
          ...library.videos
            .filter((video) => video.ready)
            .slice(0, VIDEOS_PER_ACCOUNT)
            .map((video) => ({ id: video.id, title: video.title, seconds: video.lengthSeconds, account: advertiserId }))
        );
      }
    } else {
      const accounts = await listGoogleAccounts(workspace);
      context.accounts = accounts.map((account) => ({
        id: account.info.id,
        name: account.info.name,
        currency: account.info.currency,
        state: account.info.state,
      }));
      for (const account of accounts.filter((item) => item.info.usable).slice(0, ACCOUNTS_PER_WORKSPACE)) {
        const [conversions, library, campaigns, lists] = await Promise.all([
          listConversionActions(workspace, account).catch(() => []),
          listGoogleLibrary(workspace, account).catch(() => ({ videos: [], truncated: false })),
          googleSearch<{ campaign?: { name?: string; status?: string; advertisingChannelType?: string } }>(
            workspace,
            account.info.id,
            "SELECT campaign.name, campaign.status, campaign.advertising_channel_type FROM campaign WHERE campaign.status != 'REMOVED' LIMIT 1000",
            { loginCustomerId: account.loginCustomerId }
          ).catch(() => null),
          readNegativeLists(workspace, account).catch(() => null),
        ]);
        context.conversions.push(
          ...conversions.map((action) => ({
            id: action.id,
            name: action.name,
            note: `${label(CONVERSION_TYPE_LABEL, action.type)} (${action.type}), ${action.category}${action.primary ? ", principală" : ", secundară — Google nu optimizează pe ea"}, contul ${account.info.id}`,
          }))
        );
        if (campaigns) {
          context.campaigns = [
            ...(context.campaigns ?? []),
            // Întâi cele active, apoi după nume.
            ...[...campaigns]
              .sort(
                (a, b) =>
                  Number(b.campaign?.status === "ENABLED") - Number(a.campaign?.status === "ENABLED") ||
                  (a.campaign?.name ?? "").localeCompare(b.campaign?.name ?? "", "ro")
              )
              .slice(0, CAMPAIGNS_PER_ACCOUNT)
              .map((row) => ({
                name: row.campaign?.name ?? "—",
                type: label(CHANNEL_LABEL, row.campaign?.advertisingChannelType),
                status: label(CAMPAIGN_STATUS_LABEL, row.campaign?.status),
                account: account.info.id,
              })),
          ];
          if (campaigns.length > CAMPAIGNS_PER_ACCOUNT) context.notes.push(`Contul ${account.info.id} are ${campaigns.length} de campanii; aici sunt ${CAMPAIGNS_PER_ACCOUNT} (întâi cele active).`);
        } else {
          context.notes.push(`Campaniile contului ${account.info.id} nu s-au putut citi — cere-i omului numele celor care există, ca să nu le dublezi.`);
        }
        if (lists) {
          context.negativeLists = [
            ...(context.negativeLists ?? []),
            ...lists.map((list) => ({ name: list.name, keywords: list.count, campaigns: list.campaigns.length, account: account.info.id })),
          ];
        }
        context.videos.push(
          ...library.videos
            .filter((video) => video.ready)
            .slice(0, VIDEOS_PER_ACCOUNT)
            .map((video) => ({ id: video.id, title: video.title, seconds: video.lengthSeconds, account: account.info.id }))
        );
      }
      if (accounts.length === 0) context.notes.push("Cheia nu vede niciun cont Google Ads — adaugă contul de serviciu ca utilizator în cont.");
    }
  } catch (error) {
    context.notes.push(describe(error, "citirea conturilor"));
  }
  return context;
}
