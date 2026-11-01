import { createHash, randomBytes } from "node:crypto";

/**
 * Tokenurile roboților: 32 de octeți aleatori, cu prefix ca să se
 * recunoască într-un fișier de configurare. În bază stă doar hash-ul
 * SHA-256 (hex); tokenul în clar se arată o singură dată, la creare.
 * Un token de 256 de biți nu se poate ghici, deci hash-ul simplu ajunge
 * (nu e o parolă aleasă de om, care ar cere un hash lent).
 */

export const TOKEN_PREFIX = "mrx_robot_";

export function newRobotToken(): string {
  return TOKEN_PREFIX + randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** Tokenul din `Authorization: Bearer <token>`, sau `null`. */
export function bearerToken(header: string | null): string | null {
  const match = /^Bearer\s+(\S+)\s*$/i.exec(header ?? "");
  if (!match) return null;
  const token = match[1];
  return token.length >= 20 && token.length <= 200 ? token : null;
}
