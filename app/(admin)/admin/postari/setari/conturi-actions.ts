"use server";

import { revalidatePath } from "next/cache";
import { deleteAccount, readAccount, saveAccount } from "@/lib/postari/conturi";
import { keyProblem } from "@/lib/postari/cripto";
import { actorEmail, SESSION_EXPIRED } from "@/lib/postari/db";
import { getMe, IgError, publishingLimit, verdict } from "@/lib/postari/instagram";
import { DASHBOARD_TOKEN_MS } from "@/lib/postari/instagram-handler";
import { logEvent } from "@/lib/postari/istoric";
import { revokeToken, tiktokConfigured } from "@/lib/postari/tiktok";

export type AccountResult = { ok: true; message: string } | { ok: false; message: string };

/**
 * Conectarea contului Instagram: tokenul generat în panoul Meta (Instagram →
 * API setup with Instagram business login → Generate token). Se verifică la
 * Instagram (contul și permisiunea de publicare), apoi se salvează criptat.
 * Tokenul nu se întoarce niciodată în browser și nu intră în istoric.
 */
export async function connectInstagramAction(raw: unknown): Promise<AccountResult> {
  const actor = await actorEmail();
  if (!actor) return { ok: false, message: SESSION_EXPIRED };
  const problem = keyProblem();
  if (problem) return { ok: false, message: problem };
  const token = typeof raw === "string" ? raw.trim() : "";
  if (!/^[A-Za-z0-9_.|-]{20,2000}$/.test(token)) return { ok: false, message: "Asta nu arată a token Instagram. Copiază-l întreg din panoul Meta (Generate token), fără spații." };

  let me: { userId: string; username: string | null };
  try {
    me = await getMe(token);
  } catch (error) {
    if (error instanceof IgError && (error.code === 190 || error.status === 400 || error.status === 401)) return { ok: false, message: "Instagram nu primește tokenul (expirat, revocat sau copiat pe jumătate). Generează altul în panoul Meta și lipește-l din nou." };
    return { ok: false, message: verdict(error).message };
  }
  try {
    // Cere permisiunea de publicare: un token fără ea pică aici, nu la prima postare.
    await publishingLimit(me.userId, token);
  } catch (error) {
    const v = verdict(error);
    return { ok: false, message: v.kind === "token" ? "Tokenul e bun, dar nu are permisiunea de publicare (instagram_business_content_publish). Bifează-o în panoul Meta, generează tokenul din nou și lipește-l aici." : v.message };
  }

  const saved = await saveAccount({ platforma: "instagram", contId: me.userId, nume: me.username ? `@${me.username}` : null, token, tokenExpiraLa: new Date(Date.now() + DASHBOARD_TOKEN_MS).toISOString(), actor });
  if (!saved.ok) return saved;
  await logEvent({ actor, zona: "conturi", actiune: "Instagram conectat", tinta: "instagram", rezultat: "ok", mesaj: `${me.username ? `@${me.username}` : "Contul"} (id ${me.userId}). Tokenul e salvat criptat și se reînnoiește singur.` });
  revalidatePath("/admin/postari", "layout");
  return { ok: true, message: `Instagram e conectat${me.username ? ` ca @${me.username}` : ""}. Tokenul se reînnoiește singur, săptămânal.` };
}

export async function disconnectAction(platform: unknown): Promise<AccountResult> {
  const actor = await actorEmail();
  if (!actor) return { ok: false, message: SESSION_EXPIRED };
  if (platform !== "instagram" && platform !== "tiktok") return { ok: false, message: "Platforma nu e validă." };
  // TikTok: accesul se revocă și la TikTok (dacă nu merge, tokenul expiră oricum în 24 de ore).
  if (platform === "tiktok" && tiktokConfigured()) {
    const current = await readAccount("tiktok");
    if (current.ok && current.data?.token) await revokeToken(current.data.token).catch(() => undefined);
  }
  const result = await deleteAccount(platform);
  if (!result.ok) return result;
  const label = platform === "instagram" ? "Instagram" : "TikTok";
  await logEvent({ actor, zona: "conturi", actiune: `${label} deconectat`, tinta: platform, rezultat: "ok", mesaj: `Tokenul ${label} a fost șters din admin. Postările ${label} așteaptă până la reconectare.` });
  revalidatePath("/admin/postari", "layout");
  return { ok: true, message: `${label} e deconectat. Postările ${label} așteaptă până îl conectezi din nou.` };
}
