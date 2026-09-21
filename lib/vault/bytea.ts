/**
 * `bytea` ⇄ bytes pentru PostgREST (feat/vault, faza 2).
 *
 * Postgres serializează `bytea` în JSON ca text în formatul lui hex:
 * `\x48656c6c6f`. Același format e acceptat la intrare, deci trimitem
 * și primim exact acest șir. Fără libsodium aici — funcțiile sunt
 * sincrone și nu depind de `ready()`, ca să poată fi folosite oriunde.
 *
 * Nu există „bytea ca base64": dacă vreodată apare altceva decât `\x`,
 * e o schimbare de configurare pe server (`bytea_output`), nu un caz
 * de tratat în tăcere — aruncăm.
 */

const HEX = "0123456789abcdef";

export function toBytea(bytes: Uint8Array): string {
  let out = "\\x";
  for (const byte of bytes) {
    out += HEX[byte >> 4] + HEX[byte & 15];
  }
  return out;
}

export function fromBytea(value: unknown): Uint8Array {
  if (typeof value !== "string" || !value.startsWith("\\x") || value.length % 2 !== 0) {
    throw new Error("bytea: format neașteptat de la server (aștept hex cu prefix \\x).");
  }
  const hex = value.slice(2);
  if (!/^[0-9a-fA-F]*$/.test(hex)) {
    throw new Error("bytea: caractere non-hex în valoarea de la server.");
  }
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}
