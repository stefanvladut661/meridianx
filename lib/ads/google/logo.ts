import "server-only";

import { createHash } from "node:crypto";

/**
 * Sigla din plan (`google.logo_url`), descărcată de server: Google Ads nu
 * primește imagini prin link, ci bytes. E singurul loc unde portalul
 * descarcă o adresă scrisă în plan, deci adresa e verificată strict: doar
 * https, nume de domeniu (nu IP, nu localhost), doar PNG sau JPEG, cel mult
 * 5 MB, pătrată și de cel puțin 128×128.
 */

const MAX_BYTES = 5 * 1024 * 1024;

export class LogoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LogoError";
  }
}

function allowedUrl(raw: string): URL | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  const local = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(process.env.GOOGLE_ADS_API_URL?.trim() ?? "");
  if (local && url.protocol === "http:" && (url.hostname === "127.0.0.1" || url.hostname === "localhost")) return url;
  if (url.protocol !== "https:") return null;
  const host = url.hostname.toLowerCase();
  if (/^[\d.]+$/.test(host) || host.includes(":") || host === "localhost" || /\.(local|internal|localhost)$/.test(host)) return null;
  return url;
}

/** Lățimea și înălțimea unui PNG sau JPEG, din antet. */
function dimensions(bytes: Buffer): { width: number; height: number; type: "image/png" | "image/jpeg" } | null {
  if (bytes.length > 24 && bytes.readUInt32BE(0) === 0x89504e47) {
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), type: "image/png" };
  }
  if (bytes.length > 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < bytes.length) {
      if (bytes[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      const marker = bytes[offset + 1];
      const length = bytes.readUInt16BE(offset + 2);
      // SOF0–SOF15, fără DHT (C4), JPG (C8) și DAC (CC).
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { height: bytes.readUInt16BE(offset + 5), width: bytes.readUInt16BE(offset + 7), type: "image/jpeg" };
      }
      offset += 2 + length;
    }
  }
  return null;
}

export interface Logo {
  /** base64, gata de pus în `imageAsset.data`. */
  data: string;
  width: number;
  height: number;
  /** Primele caractere din SHA-256: același fișier = același material, nu unul nou la fiecare campanie. */
  hash: string;
}

export async function downloadLogo(raw: string): Promise<Logo> {
  const url = allowedUrl(raw);
  if (!url) throw new LogoError("adresa siglei trebuie să fie https, pe un nume de domeniu public");

  let response: Response;
  try {
    response = await fetch(url, { cache: "no-store", redirect: "follow", signal: AbortSignal.timeout(15_000) });
  } catch {
    throw new LogoError("sigla nu s-a putut descărca de la adresa din plan");
  }
  if (!response.ok) throw new LogoError(`adresa siglei răspunde ${response.status}`);
  if (response.url && !allowedUrl(response.url)) throw new LogoError("adresa siglei redirecționează spre o adresă nepermisă");

  const length = Number(response.headers.get("content-length") ?? 0);
  if (length > MAX_BYTES) throw new LogoError("sigla are peste 5 MB");
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_BYTES) throw new LogoError("sigla e goală sau are peste 5 MB");

  const size = dimensions(bytes);
  if (!size) throw new LogoError("sigla nu e PNG sau JPEG");
  if (size.width < 128 || size.height < 128) throw new LogoError(`sigla are ${size.width}×${size.height}; Google cere cel puțin 128×128`);
  if (Math.abs(size.width / size.height - 1) > 0.01) {
    throw new LogoError(`sigla are ${size.width}×${size.height}; Google cere o imagine pătrată (1:1)`);
  }
  return {
    data: bytes.toString("base64"),
    width: size.width,
    height: size.height,
    hash: createHash("sha256").update(bytes).digest("hex").slice(0, 12),
  };
}
