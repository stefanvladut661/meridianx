import { checkFolder, downloadFile, DriveError, driveMode, DRIVE_MISSING, listChildren, type DriveListed } from "@/lib/firma/drive/google";
import type { Result } from "./db";
import { readSettings } from "./setari";

/**
 * Folderul de clipuri de pe Drive, prin conexiunea adminului firmei
 * (`lib/firma/drive/google.ts`: OAuth ca tine sau cont de serviciu, din
 * aceleași variabile din Vercel). Modulul doar citește: nu creează, nu mută,
 * nu șterge nimic pe Drive.
 *
 * Folderul principal („meridian reclame”) se alege în Setări; planul scrie
 * subfolderul („meridian reclame/lot-1” sau doar „lot-1”), iar fișierele se dau
 * cu numele lor din subfolder.
 */

export const NO_ROOT = "Folderul principal de pe Drive nu e ales: pune-l în Postări → Setări.";
export const FOLDER_MIME = "application/vnd.google-apps.folder";
export const MANIFEST_NAME = "manifest.json";

export { DRIVE_MISSING, driveMode };

export interface FolderRef {
  id: string;
  name: string;
  /** Calea de la folderul principal, ex. „meridian reclame/lot-1”. */
  path: string;
  link: string;
}

export interface ClipFile {
  id: string;
  name: string;
  mimeType: string;
  size: number | null;
  link: string | null;
}

export interface FolderListing {
  folder: FolderRef;
  subfolders: { id: string; name: string }[];
  clips: ClipFile[];
  manifest: { id: string; size: number | null } | null;
  /** Alte fișiere (nu video, nu manifest): doar numărate. */
  others: number;
}

export const folderLink = (id: string) => `https://drive.google.com/drive/folders/${id}`;
export const fileLink = (id: string) => `https://drive.google.com/file/d/${id}/view`;
export const previewLink = (id: string) => `https://drive.google.com/file/d/${id}/preview`;

/** Numele comparate fără diferențe de litere mari, diacritice sau spații. */
export function sameName(a: string, b: string): boolean {
  const norm = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
  return norm(a) === norm(b);
}

function driveMessage(error: unknown): string {
  return error instanceof DriveError ? error.message : "Google Drive n-a răspuns. Reîncearcă peste un minut.";
}

export const isVideo = (file: { name: string; mimeType: string }) => file.mimeType.startsWith("video/") || /\.(mp4|mov)$/i.test(file.name);

/** Folderul principal din Setări: id-ul și numele (citit la salvare). */
export async function rootFolder(): Promise<Result<{ id: string; name: string }>> {
  if (!driveMode()) return { ok: false, message: DRIVE_MISSING };
  const settings = await readSettings();
  if (!settings.ok) return settings;
  if (!settings.data.driveFolderId) return { ok: false, message: NO_ROOT };
  return { ok: true, data: { id: settings.data.driveFolderId, name: settings.data.driveFolderNume ?? "folderul principal" } };
}

/** Folderul principal se vede? (o citire la Google, la salvarea setărilor). */
export async function checkRoot(id: string): Promise<Result<{ name: string }>> {
  if (!driveMode()) return { ok: false, message: DRIVE_MISSING };
  try {
    const folder = await checkFolder(id);
    return { ok: true, data: { name: folder.name } };
  } catch (error) {
    return { ok: false, message: driveMessage(error) };
  }
}

/** Calea din plan → segmentele de sub folderul principal (primul segment poate fi chiar numele lui). */
export function pathSegments(path: string, rootName: string): string[] {
  const segments = path
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean);
  if (segments.length > 0 && sameName(segments[0], rootName)) segments.shift();
  return segments;
}

/**
 * Găsește subfolderul planului, segment cu segment, după nume (fără diferențe
 * de litere mari sau diacritice). O cale goală = chiar folderul principal.
 */
export async function resolveFolder(path: string): Promise<Result<FolderRef>> {
  const root = await rootFolder();
  if (!root.ok) return root;
  const segments = pathSegments(path, root.data.name);
  let current = { id: root.data.id, name: root.data.name };
  const walked = [root.data.name];
  try {
    for (const segment of segments) {
      const children = await listChildren(current.id);
      const folders = children.filter((item) => item.mimeType === FOLDER_MIME);
      const found = folders.find((item) => item.name === segment) ?? folders.find((item) => sameName(item.name, segment));
      if (!found) {
        const names = folders.map((item) => `„${item.name}”`).slice(0, 8).join(", ");
        return { ok: false, message: `Nu găsesc subfolderul „${segment}” în „${walked.join("/")}”.${names ? ` Acolo sunt: ${names}.` : " Acolo nu e niciun subfolder."}` };
      }
      current = { id: found.id, name: found.name };
      walked.push(found.name);
    }
  } catch (error) {
    return { ok: false, message: driveMessage(error) };
  }
  return { ok: true, data: { id: current.id, name: current.name, path: walked.join("/"), link: folderLink(current.id) } };
}

function toClip(item: DriveListed): ClipFile {
  return { id: item.id, name: item.name, mimeType: item.mimeType, size: item.size, link: item.link };
}

/** Ce e în subfolder: subfoldere, clipuri, manifestul. */
export async function listFolder(folder: FolderRef): Promise<Result<FolderListing>> {
  try {
    const children = await listChildren(folder.id);
    const subfolders = children.filter((item) => item.mimeType === FOLDER_MIME).map((item) => ({ id: item.id, name: item.name }));
    const clips = children.filter((item) => item.mimeType !== FOLDER_MIME && isVideo(item)).map(toClip);
    const manifestFile = children.find((item) => item.mimeType !== FOLDER_MIME && sameName(item.name, MANIFEST_NAME));
    const others = children.length - subfolders.length - clips.length - (manifestFile ? 1 : 0);
    clips.sort((a, b) => a.name.localeCompare(b.name, "ro"));
    subfolders.sort((a, b) => a.name.localeCompare(b.name, "ro"));
    return { ok: true, data: { folder, subfolders, clips, manifest: manifestFile ? { id: manifestFile.id, size: manifestFile.size } : null, others } };
  } catch (error) {
    return { ok: false, message: driveMessage(error) };
  }
}

/** Un fișier întreg de pe Drive (clipul sau manifestul). */
export async function download(fileId: string): Promise<Result<Buffer>> {
  try {
    return { ok: true, data: await downloadFile(fileId) };
  } catch (error) {
    return { ok: false, message: driveMessage(error) };
  }
}
