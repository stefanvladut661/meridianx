import { deriveMasterMaterial, ready, VaultCryptoError } from "./crypto";

/**
 * Web Worker pentru derivarea din parola master (feat/vault, faza 2).
 *
 * Argon2id la parametrii din contract (256 MiB, 4 pași) durează ~3 s
 * pe un laptop obișnuit și e SINCRON: pe firul principal ar îngheța
 * pagina — nici starea de încărcare nu s-ar mai picta. Aici rulează pe
 * firul lui, iar UI-ul rămâne viu. Parametrii NU se slăbesc pentru
 * asta (PLAN.md, observația din faza 1).
 *
 * Contract: un singur mesaj înăuntru, un singur mesaj afară. Worker-ul
 * e de unică folosință — apelantul îl termină după răspuns, ca memoria
 * wasm (256 MiB) să fie eliberată, nu ținută cât e fila deschisă.
 *
 * `kek` pleacă prin TRANSFER (nu copie): buffer-ul se mută în firul
 * principal, iar aici rămâne detașat — o singură copie a cheii în
 * memorie, oriunde. Parola vine ca string; string-urile JavaScript nu
 * se pot zeroiza (limitare de limbaj, notată și în crypto.ts).
 */

export interface KdfRequest {
  email: string;
  password: string;
}

export type KdfResponse =
  | { ok: true; authHash: string; kek: ArrayBuffer }
  | { ok: false; code: string; message: string };

/* Tipurile globale ale proiectului sunt cele de DOM (tsconfig `lib`),
   unde `postMessage` are semnătura ferestrei. Un worker dedicat are
   `postMessage(message, transfer)`. Nu putem încărca `lib.webworker`
   fără să intre în conflict cu DOM-ul pe restul proiectului, așa că
   declarăm strict cele două membre pe care le folosim. */
interface DedicatedScope {
  onmessage: ((event: MessageEvent<KdfRequest>) => void) | null;
  postMessage(message: KdfResponse, transfer?: Transferable[]): void;
}

const scope = self as unknown as DedicatedScope;

scope.onmessage = async (event) => {
  const { email, password } = event.data;
  try {
    await ready();
    const { authHash, kek } = deriveMasterMaterial(email, password);
    // `kek` e un Uint8Array proaspăt alocat de wrapper (nu o vedere în
    // memoria wasm), deci buffer-ul lui e transferabil ca atare.
    const buffer = kek.buffer as ArrayBuffer;
    scope.postMessage({ ok: true, authHash, kek: buffer }, [buffer]);
  } catch (error) {
    const code = error instanceof VaultCryptoError ? error.code : "worker_failed";
    const message =
      error instanceof VaultCryptoError
        ? error.message
        : "Derivarea cheii a eșuat în worker.";
    scope.postMessage({ ok: false, code, message });
  }
};
