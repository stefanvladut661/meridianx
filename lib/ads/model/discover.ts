import "server-only";

import type { AdAccountInfo } from "../types";
import type { AdsWorkspace } from "../workspaces";
import { workspaceToken } from "../workspaces.server";
import { adapterFor } from "../platform";
import { listAdAccounts } from "../meta/lookup";
import { listGoogleAccounts } from "../google/lookup";

/**
 * Conturile pe care le vede tokenul unui spațiu — ca omul să aleagă din listă
 * când adaugă un cont la un client, în loc să copieze id-uri. Doar citiri.
 *
 * Meta: `/me/adaccounts` al utilizatorului de sistem (conturile atribuite lui,
 * inclusiv cele primite de la clienți ca partener). Google: conturile cheii,
 * direct sau sub contul manager. TikTok: tokenul nu-și poate lista conturile
 * fără secretul aplicației (care nu stă în Vercel), deci id-ul se scrie de mână
 * și se verifică.
 */

export interface VisibleAccounts {
  accounts: AdAccountInfo[];
  /** De ce lista e goală sau incompletă, spus omului. */
  note: string | null;
}

export async function visibleAccounts(workspace: AdsWorkspace): Promise<VisibleAccounts> {
  if (!workspaceToken(workspace)) {
    return { accounts: [], note: `${workspace.tokenEnv} nu e setat pe server, deci portalul nu vede conturile. Poți scrie id-ul de mână.` };
  }
  try {
    if (workspace.platform === "meta") return { accounts: await listAdAccounts(workspace), note: null };
    if (workspace.platform === "google") {
      return {
        accounts: (await listGoogleAccounts(workspace)).map((account) => account.info),
        note: "Lista arată cel mult 10 conturi directe și câte 20 sub fiecare cont manager. Un cont care lipsește se scrie de mână.",
      };
    }
    return { accounts: [], note: "TikTok nu-și listează conturile cu tokenul. Scrie advertiser_id-ul (din TikTok Ads Manager, sus, sub numele contului)." };
  } catch (error) {
    return { accounts: [], note: adapterFor(workspace.platform).describeError(error, "citirea conturilor", workspace.tokenEnv) };
  }
}

/**
 * Un cont scris de mână: forma lui și, dacă tokenul e setat, dacă îl vede.
 * `info` null cu `checked: false` = n-am putut întreba (fără token).
 */
export async function checkAccount(
  workspace: AdsWorkspace,
  input: string
): Promise<{ ok: true; adAccount: string; info: AdAccountInfo | null; checked: boolean } | { ok: false; message: string }> {
  const adapter = adapterFor(workspace.platform);
  const adAccount = adapter.normalizeAccount(input);
  if (!adAccount) {
    return {
      ok: false,
      message:
        workspace.platform === "meta"
          ? `„${input}” nu e un cont de reclame Meta (act_ urmat de cifre).`
          : workspace.platform === "google"
            ? `„${input}” nu e un cont Google Ads (10 cifre, 123-456-7890).`
            : `„${input}” nu e un advertiser_id TikTok (doar cifre).`,
    };
  }
  if (!workspaceToken(workspace)) return { ok: true, adAccount, info: null, checked: false };
  try {
    const info = await adapter.findAccount(workspace, adAccount);
    if (!info) {
      return { ok: false, message: `Tokenul spațiului (${workspace.tokenEnv}) nu vede contul ${adAccount}. Verifică accesul (pașii din README → „De făcut de om (v2)”).` };
    }
    return { ok: true, adAccount, info, checked: true };
  } catch (error) {
    return { ok: false, message: adapter.describeError(error, "verificarea contului", workspace.tokenEnv) };
  }
}
