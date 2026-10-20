"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createAdminClient, getAdminUser } from "@/lib/supabase/clients";
import { WORKSPACES, findWorkspace } from "@/lib/ads/workspaces";
import { WORKSPACE_COOKIE, currentWorkspaceId } from "@/lib/ads/workspaces.server";
import { SELECTION_COOKIE, parseChannel, parseClientId, parsePeriod } from "@/lib/ads/model/selection";
import { clientById, setResultChoiceRecord } from "@/lib/ads/model/store";
import { readEntityDays, type EntityDay } from "@/lib/ads/model/read";
import { pauseEntities, type PauseRequestResult } from "@/lib/ads/model/pause";
import { NO_RESULT } from "@/lib/ads/model/results";
import type { ConversionType } from "@/lib/ads/model/types";

/**
 * Acțiunile ecranului v2: alegerea din bara de sus, zilele unui rând (graficul
 * din panou), rezultatul numărat pe o campanie și „Pune pe pauză”.
 *
 * Fiecare își reverifică sesiunea. Singura acțiune care ajunge la o platformă e
 * pauza, prin funcțiile de pauză ale platformelor (cu garda lor).
 */

const SESSION_EXPIRED = "Sesiunea a expirat. Reîncarcă pagina și intră din nou în panou.";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

type Failure = { ok: false; message: string };

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/admin",
  maxAge: 60 * 60 * 24 * 365,
};

/**
 * Ține minte alegerea din bara de sus. Spațiul de lucru al ecranelor vechi
 * (Plan nou, Lot, Căutare) o urmează: proprietarul clientului + canalul ales
 * (la „Toate”, platforma spațiului de până acum).
 */
export async function rememberSelectionAction(input: { clientId: string | null; channel: string; period: string }): Promise<{ ok: true } | Failure> {
  const user = await getAdminUser();
  if (!user) return { ok: false, message: SESSION_EXPIRED };
  const channel = parseChannel(input.channel) ?? "toate";
  const period = parsePeriod(input.period) ?? "7";
  const clientId = parseClientId(input.clientId);
  const store = await cookies();
  store.set(SELECTION_COOKIE, JSON.stringify({ client: clientId, canal: channel, perioada: period }), COOKIE_OPTIONS);

  const admin = createAdminClient();
  const client = admin && clientId ? await clientById(admin, clientId) : null;
  if (client) {
    const current = findWorkspace(await currentWorkspaceId());
    const platform = channel === "toate" ? (current?.platform ?? "meta") : channel;
    const workspace = WORKSPACES.find((item) => item.owner === client.owner && item.platform === platform);
    if (workspace) store.set(WORKSPACE_COOKIE, workspace.id, COOKIE_OPTIONS);
  }
  revalidatePath("/admin/ads", "layout");
  return { ok: true };
}

export async function entityDaysAction(input: { entityIds: string[]; from: string; to: string }): Promise<{ ok: true; days: EntityDay[] } | Failure> {
  const user = await getAdminUser();
  if (!user) return { ok: false, message: SESSION_EXPIRED };
  const ids = input.entityIds.filter((id) => UUID.test(id)).slice(0, 50);
  if (!DATE.test(input.from) || !DATE.test(input.to)) return { ok: false, message: "Perioada nu e validă." };
  const days = await readEntityDays(ids, input.from, input.to);
  if (!days.ok) return days;
  return { ok: true, days: days.data };
}

/** Ce conversie se numără ca rezultat pe o campanie. `key` null = înapoi la implicit. */
export async function setResultAction(input: { entityId: string; key: string | null }): Promise<{ ok: true } | Failure> {
  const user = await getAdminUser();
  if (!user) return { ok: false, message: SESSION_EXPIRED };
  if (!UUID.test(input.entityId)) return { ok: false, message: "Campania nu există." };
  const admin = createAdminClient();
  if (!admin) return { ok: false, message: "Supabase nu e configurat pe server." };
  const { data: entity } = await admin.from("ads_entities").select("id, level, account_id").eq("id", input.entityId).maybeSingle();
  const row = entity as { id: string; level: string; account_id: string } | null;
  if (!row || row.level !== "campaign") return { ok: false, message: "Rezultatul se alege pe campanie." };
  if (input.key !== null && input.key !== NO_RESULT) {
    const { data: account } = await admin.from("ads_accounts").select("conversions").eq("id", row.account_id).maybeSingle();
    const catalog = ((account as { conversions: ConversionType[] } | null)?.conversions ?? []) as ConversionType[];
    if (!catalog.some((entry) => entry.key === input.key)) return { ok: false, message: "Conversia nu e în catalogul contului. Actualizează contul și încearcă din nou." };
  }
  const saved = await setResultChoiceRecord(row.id, input.key, user);
  if (!saved.ok) return saved;
  revalidatePath("/admin/ads", "layout");
  return { ok: true };
}

export async function pauseAction(input: { entityIds: string[] }): Promise<({ ok: true } & PauseRequestResult) | Failure> {
  const user = await getAdminUser();
  if (!user) return { ok: false, message: SESSION_EXPIRED };
  const ids = input.entityIds.filter((id) => UUID.test(id));
  if (ids.length === 0) return { ok: false, message: "Alege ce pui pe pauză." };
  if (ids.length > 200) return { ok: false, message: "Cel mult 200 de rânduri odată." };
  try {
    const result = await pauseEntities(ids, user);
    revalidatePath("/admin/ads", "layout");
    return { ok: true, ...result };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Pauza n-a pornit." };
  }
}
