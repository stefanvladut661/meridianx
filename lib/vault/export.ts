import { decryptJson, encryptJson, KDF, wipe } from "./crypto";
import { deriveMasterMaterialAsync } from "./kdf";
import type { EntryPayload, VaultSnapshot } from "./entries";

/**
 * Exportul criptat (feat/vault, faza 9). Pur, în afara derivării (care
 * merge prin worker-ul din `kdf.ts`).
 *
 * Nu există export în clar: `crypto.ts` îl interzice, iar un fișier cu
 * parolele agenției în clar pe un laptop e exact ce evită vault-ul.
 * Fișierul e JSON cu antet lizibil (format, versiune, parametri KDF, câte
 * intrări) și un singur blob: tot conținutul (clienți + intrări, cu
 * payload-urile DECRIPTATE) criptat cu o cheie derivată dintr-o
 * PAROLĂ DE EXPORT — alta decât parola master, cu Argon2id la aceiași
 * parametri (ops 4, 256 MiB) și XChaCha20-Poly1305.
 *
 * SALT-ul: aleator per fișier, ținut în antet. `crypto.ts` derivă salt-ul
 * din „email" (`BLAKE2b(prefix + email)`), deci îi dăm ca „email" un
 * șir `export:<hex aleator>` — salt unic per fișier, cu domeniul fix al
 * vault-ului, fără să atingem `crypto.ts`. (Funcția lower-case-uiește
 * intrarea; hex-ul e deja mic.)
 *
 * Fișierul se importă înapoi doar cu parola de export; nu are legătură
 * cu conturile Supabase — merge și într-un alt vault, și peste ani.
 */

export const EXPORT_FORMAT = "meridian-vault-export";
export const EXPORT_VERSION = 1;
const EXPORT_AD = "meridian-vault-export:v1";
export const EXPORT_MIN_PASSPHRASE = 12;

export interface ExportPlaintext {
  v: typeof EXPORT_VERSION;
  exportedAt: string;
  clients: Array<{ id: string; name: string }>;
  entries: Array<{
    id: string;
    clientId: string;
    payload: EntryPayload;
    version: number;
    createdAt: string;
    updatedAt: string;
  }>;
}

export interface ExportFile {
  format: typeof EXPORT_FORMAT;
  version: typeof EXPORT_VERSION;
  exportedAt: string;
  counts: { clients: number; entries: number };
  kdf: { alg: "argon2id"; ops: number; mem: number; saltInput: string };
  cipher: "xchacha20poly1305-ietf";
  nonce: string;
  ciphertext: string;
}

// base64 pe binar: `btoa` există în browser și în Node ≥ 16.
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function base64ToBytes(text: string): Uint8Array {
  const binary = atob(text);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

function randomHex(bytes: number): string {
  const buffer = new Uint8Array(bytes);
  crypto.getRandomValues(buffer);
  return Array.from(buffer, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Ce intră în fișier: doar rândurile vii și lizibile. */
export function buildPlaintext(snapshot: VaultSnapshot): ExportPlaintext {
  return {
    v: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    clients: snapshot.clients.map((client) => ({ id: client.id, name: client.name })),
    entries: snapshot.entries.flatMap((entry) =>
      entry.status === "ok"
        ? [
            {
              id: entry.id,
              clientId: entry.clientId,
              payload: entry.payload,
              version: entry.version,
              createdAt: entry.createdAt,
              updatedAt: entry.updatedAt,
            },
          ]
        : []
    ),
  };
}

export async function encryptExport(plain: ExportPlaintext, passphrase: string): Promise<ExportFile> {
  const saltInput = `export:${randomHex(16)}`;
  const material = await deriveMasterMaterialAsync(saltInput, passphrase);
  try {
    const box = encryptJson(material.kek, plain, EXPORT_AD);
    return {
      format: EXPORT_FORMAT,
      version: EXPORT_VERSION,
      exportedAt: plain.exportedAt,
      counts: { clients: plain.clients.length, entries: plain.entries.length },
      kdf: { alg: "argon2id", ops: KDF.opslimit, mem: KDF.memlimit, saltInput },
      cipher: "xchacha20poly1305-ietf",
      nonce: bytesToBase64(box.nonce),
      ciphertext: bytesToBase64(box.ciphertext),
    };
  } finally {
    wipe(material.kek);
  }
}

export function isExportFile(value: unknown): value is ExportFile {
  if (typeof value !== "object" || value === null) return false;
  const file = value as Partial<ExportFile>;
  return (
    file.format === EXPORT_FORMAT &&
    file.version === EXPORT_VERSION &&
    typeof file.kdf?.saltInput === "string" &&
    typeof file.nonce === "string" &&
    typeof file.ciphertext === "string"
  );
}

/** Aruncă `VaultCryptoError("decrypt_failed")` la parolă greșită sau
    fișier alterat — apelantul îi spune omului. */
export async function decryptExport(file: ExportFile, passphrase: string): Promise<ExportPlaintext> {
  const material = await deriveMasterMaterialAsync(file.kdf.saltInput, passphrase);
  try {
    return decryptJson<ExportPlaintext>(
      material.kek,
      { ciphertext: base64ToBytes(file.ciphertext), nonce: base64ToBytes(file.nonce) },
      EXPORT_AD
    );
  } finally {
    wipe(material.kek);
  }
}

/** Numele fișierului: data, ca backup-urile să se așeze singure în ordine. */
export function exportFileName(date = new Date()): string {
  return `meridian-vault-${date.toISOString().slice(0, 10)}.json`;
}
