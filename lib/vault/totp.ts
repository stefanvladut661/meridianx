/**
 * Coduri TOTP (feat/vault, faza 8). Pur, fără DOM; HMAC-ul prin WebCrypto.
 *
 * RFC 6238 peste RFC 4226: cod = trunchierea dinamică a HMAC(secret,
 * contor), contor = floor(timp / perioadă). SHA-1 e algoritmul implicit
 * al standardului (și singurul pe care îl acceptă majoritatea
 * serviciilor) — e folosit ca HMAC, nu ca hash de integritate, și NU
 * trece prin `crypto.ts` (care, intenționat, n-are SHA-1). WebCrypto
 * are HMAC-SHA1 exact pentru cazuri ca ăsta.
 *
 * Secretul se acceptă în cele două forme în care îl dau serviciile:
 * base32 (RFC 4648, cu sau fără spații / `=`, orice majuscule) sau
 * un URI `otpauth://totp/...?secret=...&digits=&period=&algorithm=`.
 * Se stochează cum a fost tastat; se interpretează la afișare.
 */

export type TotpAlgorithm = "SHA-1" | "SHA-256" | "SHA-512";

export interface TotpConfig {
  secret: Uint8Array;
  digits: 6 | 7 | 8;
  period: number;
  algorithm: TotpAlgorithm;
  /** Din URI: `issuer` sau partea de dinaintea `:` din etichetă. */
  issuer: string | null;
  account: string | null;
}

export interface TotpCode {
  code: string;
  /** Secunde până expiră codul curent. */
  remaining: number;
  /** Contorul (pasul de timp) pentru care s-a calculat. */
  step: number;
}

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/** RFC 4648, tolerant: spații, liniuțe, `=`, litere mici. `null` dacă
    rămâne ceva din afara alfabetului sau nu iese niciun byte. */
export function base32Decode(input: string): Uint8Array | null {
  const clean = input.toUpperCase().replace(/[\s=-]/g, "");
  if (!clean) return null;
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const symbol of clean) {
    const index = BASE32.indexOf(symbol);
    if (index < 0) return null;
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
      value &= (1 << bits) - 1;
    }
  }
  return out.length ? Uint8Array.from(out) : null;
}

function parseAlgorithm(raw: string | null): TotpAlgorithm | null {
  if (!raw) return "SHA-1";
  const key = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (key === "SHA1") return "SHA-1";
  if (key === "SHA256") return "SHA-256";
  if (key === "SHA512") return "SHA-512";
  return null;
}

/**
 * Din ce a tastat/lipit omul → configurația TOTP, sau `null` dacă nu
 * are nicio formă cunoscută. Nu verifică dacă secretul e „corect" —
 * asta se vede abia când codul se potrivește cu serviciul.
 */
export function parseTotp(input: string): TotpConfig | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  if (/^otpauth:\/\//i.test(trimmed)) {
    let url: URL;
    try {
      url = new URL(trimmed);
    } catch {
      return null;
    }
    if (url.host.toLowerCase() !== "totp") return null;
    const secret = base32Decode(url.searchParams.get("secret") ?? "");
    if (!secret) return null;
    const digitsRaw = Number(url.searchParams.get("digits") ?? 6);
    const digits = digitsRaw === 7 || digitsRaw === 8 ? digitsRaw : 6;
    const periodRaw = Number(url.searchParams.get("period") ?? 30);
    const period = Number.isFinite(periodRaw) && periodRaw >= 5 && periodRaw <= 300 ? periodRaw : 30;
    const algorithm = parseAlgorithm(url.searchParams.get("algorithm"));
    if (!algorithm) return null;
    const label = decodeURIComponent(url.pathname.replace(/^\/+/, ""));
    const colon = label.indexOf(":");
    const issuer = url.searchParams.get("issuer") ?? (colon > 0 ? label.slice(0, colon).trim() : null);
    const account = colon >= 0 ? label.slice(colon + 1).trim() || null : label || null;
    return { secret, digits, period, algorithm, issuer: issuer || null, account };
  }

  const secret = base32Decode(trimmed);
  if (!secret) return null;
  return { secret, digits: 6, period: 30, algorithm: "SHA-1", issuer: null, account: null };
}

/** HOTP (RFC 4226) pentru un contor dat, cu WebCrypto. */
export async function hotp(config: TotpConfig, counter: number): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    config.secret as BufferSource,
    { name: "HMAC", hash: { name: config.algorithm } },
    false,
    ["sign"]
  );
  const message = new Uint8Array(8);
  // Contorul pe 64 de biți, big-endian; JS n-are întregi de 64 de biți
  // fără BigInt, dar pentru timpul Unix/30 încap în 32 fără probleme.
  let value = counter;
  for (let i = 7; i >= 0; i--) {
    message[i] = value & 255;
    value = Math.floor(value / 256);
  }
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, message));
  const offset = mac[mac.length - 1] & 0x0f;
  const binary =
    ((mac[offset] & 0x7f) << 24) |
    ((mac[offset + 1] & 0xff) << 16) |
    ((mac[offset + 2] & 0xff) << 8) |
    (mac[offset + 3] & 0xff);
  const code = binary % 10 ** config.digits;
  return String(code).padStart(config.digits, "0");
}

/** Codul valabil ACUM (sau la `nowMs`), cu secundele rămase. */
export async function totp(config: TotpConfig, nowMs = Date.now()): Promise<TotpCode> {
  const seconds = Math.floor(nowMs / 1000);
  const step = Math.floor(seconds / config.period);
  const code = await hotp(config, step);
  return { code, remaining: config.period - (seconds % config.period), step };
}

/** `123456` → `123 456`; `12345678` → `1234 5678`. Doar pentru ochi. */
export function groupCode(code: string): string {
  const half = Math.ceil(code.length / 2);
  return `${code.slice(0, half)} ${code.slice(half)}`;
}
