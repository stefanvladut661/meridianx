"use server";

import { actorEmail, SESSION_EXPIRED } from "@/lib/postari/db";
import { CLAUDE_BATCH, writeCaptions, type Caption } from "@/lib/postari/claude-plan";
import { cachedProbes, probeClip } from "@/lib/postari/clipuri";
import { clipView, type ClipView } from "@/lib/postari/clip-view";
import { download, listFolder, resolveFolder, sameName } from "@/lib/postari/drive";
import { logEvent } from "@/lib/postari/istoric";
import { parseManifest } from "@/lib/postari/manifest";
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

export type CaptionsResponse = { ok: true; captions: Caption[]; missing: string[] } | { ok: false; message: string };

/**
 * Un lot de descrieri scrise de Claude. Clipurile se iau din manifest.json-ul
 * folderului, citit acum de pe Drive: din browser vin doar numele (cel mult
 * un lot), indicațiile și descrierile deja scrise (ca Claude să nu se repete).
 */
export async function writeCaptionsAction(input: { folder: string; fisiere: string[]; indicatii: string; deja: string[]; ultimul: boolean }): Promise<CaptionsResponse> {
  const actor = await actorEmail();
  if (!actor) return { ok: false, message: SESSION_EXPIRED };
  const valid =
    typeof input?.folder === "string" &&
    Array.isArray(input.fisiere) &&
    input.fisiere.length > 0 &&
    input.fisiere.length <= CLAUDE_BATCH &&
    input.fisiere.every((name) => typeof name === "string" && name.length <= 300) &&
    typeof input.indicatii === "string" &&
    input.indicatii.length <= 2000 &&
    Array.isArray(input.deja) &&
    input.deja.length <= 200 &&
    input.deja.every((text) => typeof text === "string" && text.length <= 600);
  if (!valid) return { ok: false, message: "Cererea nu e completă." };

  const folder = await resolveFolder(input.folder);
  if (!folder.ok) return folder;
  const listing = await listFolder(folder.data);
  if (!listing.ok) return listing;
  if (!listing.data.manifest) return { ok: false, message: "Folderul n-are manifest.json." };
  const bytes = await download(listing.data.manifest.id);
  if (!bytes.ok) return bytes;
  const manifest = parseManifest(bytes.data.toString("utf8"));
  if (!manifest.ok) return manifest;
  const clips = input.fisiere.map((name) => manifest.data.clipuri.find((clip) => clip.fisier === name || sameName(clip.fisier, name)) ?? null);
  if (clips.some((clip) => clip === null)) return { ok: false, message: "Manifestul s-a schimbat între timp. Reîncarcă pagina." };

  const result = await writeCaptions({ manifest: manifest.data, clips: clips.filter((clip) => clip !== null), indicatii: input.indicatii, deja: input.deja });
  if (!result.ok || input.ultimul) {
    await logEvent({
      actor,
      zona: "plan",
      actiune: result.ok ? "plan scris de Claude" : "descrieri Claude eșuate",
      tinta: folder.data.path.slice(0, 200),
      rezultat: result.ok ? "ok" : "eroare",
      mesaj: result.ok ? `Ultimul lot din „${folder.data.path}”; planul e în editor, de corectat și verificat.` : result.message,
    });
  }
  if (!result.ok) return result;
  return { ok: true, captions: result.data, missing: result.missing };
}
