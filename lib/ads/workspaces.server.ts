import "server-only";

import { cookies } from "next/headers";
import {
  WORKSPACES,
  findWorkspace,
  workspaceName,
  type AdsWorkspace,
  type WorkspaceId,
  type WorkspaceSummary,
} from "./workspaces";

/**
 * Partea de server a spațiilor de lucru: tokenurile și spațiul ales.
 *
 * `server-only` face importul din client o eroare de build — tokenurile au
 * putere să cheltuie bani reali, deci garda e explicită, nu o convenție.
 */

function readToken(workspace: AdsWorkspace): string | null {
  const value = process.env[workspace.tokenEnv]?.trim();
  return value ? value : null;
}

/**
 * Tokenul UNUI spațiu. Îl cheamă doar clienții de platformă
 * (`lib/ads/meta/graph.ts`), în funcția care face apelul — nu se ține în
 * variabile de modul, nu se loghează, nu se întoarce spre browser.
 */
export function workspaceToken(workspace: AdsWorkspace): string | null {
  return readToken(workspace);
}

/** Lista pentru interfață: configurație publică + dacă tokenul e setat. */
export function listWorkspaces(): WorkspaceSummary[] {
  return WORKSPACES.map((workspace) => ({
    id: workspace.id,
    label: workspace.label,
    owner: workspace.owner,
    platform: workspace.platform,
    name: workspaceName(workspace),
    tokenEnv: workspace.tokenEnv,
    tokenConfigured: readToken(workspace) !== null,
    dailyBudgetCap: workspace.dailyBudgetCap,
  }));
}

// ---------------------------------------------------------------------------
// Spațiul ales
// ---------------------------------------------------------------------------

/**
 * Cookie-ul cu spațiul curent. Nu e o autorizare — doar ce ai ales ultima
 * dată. Orice creare verifică separat că planul și spațiul afișat pe ecran
 * sunt același lucru, ca un al doilea tab deschis pe alt portofoliu să nu
 * poată muta o campanie dintr-o parte în alta.
 */
export const WORKSPACE_COOKIE = "meridian_ads_spatiu";

export async function currentWorkspaceId(): Promise<WorkspaceId> {
  const store = await cookies();
  const chosen = findWorkspace(store.get(WORKSPACE_COOKIE)?.value);
  return (chosen ?? WORKSPACES[0]).id as WorkspaceId;
}
