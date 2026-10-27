import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import type { Platforma } from "./limite";

/**
 * Tokenurile conturilor, criptate pe server cu AES-256-GCM (`node:crypto`,
 * fără pachete). Cheia: POSTARI_TOKEN_KEY, 32 de octeți în base64, doar în
 * Vercel. Platforma intră în datele autentificate: un token criptat pentru
 * Instagram nu se poate decripta mutat pe rândul TikTok.
 *
 * Formatul: `v1.<iv>.<tag>.<text criptat>`, fiecare în base64url.
 */

export const KEY_MISSING = "POSTARI_TOKEN_KEY lipsește în Vercel: fără ea, tokenurile conturilor nu se pot cripta. Pașii sunt în README, la „Variabilele din Vercel”.";
export const KEY_INVALID = "POSTARI_TOKEN_KEY din Vercel nu e o cheie de 32 de octeți în base64. Fă una nouă (pașii din README) și conectează conturile din nou.";

function key(): Buffer | null {
  const raw = process.env.POSTARI_TOKEN_KEY?.trim();
  if (!raw) return null;
  const buffer = Buffer.from(raw, "base64");
  return buffer.length === 32 ? buffer : null;
}

export function keyStatus(): "ok" | "lipsa" | "invalida" {
  if (!process.env.POSTARI_TOKEN_KEY?.trim()) return "lipsa";
  return key() ? "ok" : "invalida";
}

export function keyProblem(): string | null {
  const status = keyStatus();
  return status === "ok" ? null : status === "lipsa" ? KEY_MISSING : KEY_INVALID;
}

const aad = (platform: Platforma, kind: "access" | "refresh") => Buffer.from(`meridian-postari:${platform}:${kind}`);

export function encryptToken(token: string, platform: Platforma, kind: "access" | "refresh" = "access"): string {
  const k = key();
  if (!k) throw new Error(keyProblem() ?? KEY_MISSING);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", k, iv);
  cipher.setAAD(aad(platform, kind));
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), encrypted.toString("base64url")].join(".");
}

/** `null` = nu se poate decripta (altă cheie, alt rând, text stricat). */
export function decryptToken(value: string, platform: Platforma, kind: "access" | "refresh" = "access"): string | null {
  const k = key();
  if (!k) return null;
  const [version, iv, tag, data] = value.split(".");
  if (version !== "v1" || !iv || !tag || !data) return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", k, Buffer.from(iv, "base64url"));
    decipher.setAAD(aad(platform, kind));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
