import "server-only";

/**
 * Coperta propusă de Meta pentru un video, descărcată ca s-o urcăm înapoi
 * în contul de reclame (`/adimages`). Meta cere explicit să nu i se dea
 * linkuri spre propriul CDN în `image_url` — linkurile sunt semnate și expiră.
 *
 * Adresa vine din răspunsul Graph API (`/{video}/thumbnails`), nu din plan:
 * serverul nu descarcă ce îi scrie cineva într-un câmp. Totuși o verificăm —
 * doar https (sau serverul local de test, cu `META_GRAPH_URL`), doar
 * imagini, cel mult 8 MB.
 */

const MAX_BYTES = 8 * 1024 * 1024;

function allowed(uri: string): boolean {
  let url: URL;
  try {
    url = new URL(uri);
  } catch {
    return false;
  }
  if (url.protocol === "https:") return true;
  const testing = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(process.env.META_GRAPH_URL?.trim() ?? "");
  return testing && url.protocol === "http:" && (url.hostname === "127.0.0.1" || url.hostname === "localhost");
}

export class ThumbnailError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ThumbnailError";
  }
}

export async function downloadThumbnail(uri: string, videoId: string): Promise<{ bytes: string; name: string }> {
  if (!allowed(uri)) throw new ThumbnailError("adresa copertei nu e https");

  let response: Response;
  try {
    response = await fetch(uri, { cache: "no-store", signal: AbortSignal.timeout(20_000) });
  } catch {
    throw new ThumbnailError("coperta nu s-a putut descărca de la Meta");
  }
  if (!response.ok) throw new ThumbnailError(`Meta a răspuns ${response.status} la descărcarea copertei`);

  const type = response.headers.get("content-type") ?? "";
  if (!type.startsWith("image/")) throw new ThumbnailError("coperta nu e o imagine");

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.byteLength === 0 || buffer.byteLength > MAX_BYTES) {
    throw new ThumbnailError("coperta e goală sau mai mare de 8 MB");
  }
  const extension = type.includes("png") ? "png" : type.includes("svg") ? "svg" : "jpg";
  return { bytes: buffer.toString("base64"), name: `coperta-${videoId}.${extension}` };
}
