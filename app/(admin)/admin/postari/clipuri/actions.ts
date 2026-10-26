"use server";

import { actorEmail, SESSION_EXPIRED } from "@/lib/postari/db";
import { cachedProbes, probeClip } from "@/lib/postari/clipuri";
import { clipView, type ClipView } from "@/lib/postari/clip-view";
import { listFolder, resolveFolder } from "@/lib/postari/drive";
import { logEvent } from "@/lib/postari/istoric";
import { readSettings } from "@/lib/postari/setari";

export type ProbeResult = { ok: true; clip: ClipView } | { ok: false; message: string };

/**
 * Citește un clip din subfolder (descărcat întreg de pe Drive, o singură dată).
 * Fișierul se caută în folderul cerut, nu se primește din browser: un id
 * străin nu poate fi descărcat prin acțiunea asta.
 */
export async function probeClipAction(input: { folder: string; fileId: string }): Promise<ProbeResult> {
  const actor = await actorEmail();
  if (!actor) return { ok: false, message: SESSION_EXPIRED };
  if (typeof input?.folder !== "string" || typeof input?.fileId !== "string") return { ok: false, message: "Cererea nu e completă." };
  const folder = await resolveFolder(input.folder);
  if (!folder.ok) return folder;
  const listing = await listFolder(folder.data);
  if (!listing.ok) return listing;
  const file = listing.data.clips.find((clip) => clip.id === input.fileId);
  if (!file) return { ok: false, message: "Clipul nu mai e în folder. Reîncarcă pagina." };
  const settings = await readSettings();
  const limit = settings.ok ? settings.data.stocareLimitaMb : 50;

  const known = await cachedProbes([{ id: file.id, size: file.size }]);
  const cached = known.ok ? known.data.get(file.id) : undefined;
  if (cached) return { ok: true, clip: clipView(file, cached, limit) };

  const probe = await probeClip(file, folder.data.id);
  await logEvent({ actor, zona: "drive", actiune: "clip citit", tinta: file.id, rezultat: probe.ok ? (probe.data.eroare ? "eroare" : "ok") : "eroare", mesaj: probe.ok ? `${file.name}: ${probe.data.eroare ?? "citit"}` : `${file.name}: ${probe.message}` });
  if (!probe.ok) return probe;
  return { ok: true, clip: clipView(file, probe.data, limit) };
}
