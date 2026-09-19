import type { KdfRequest, KdfResponse } from "./kdf.worker";
import {
  deriveMasterMaterial,
  ready,
  VaultCryptoError,
  type MasterMaterial,
} from "./crypto";

/**
 * Derivarea din parola master, văzută din UI (feat/vault, faza 2).
 *
 * Calea normală: un Web Worker de unică folosință (`kdf.worker.ts`).
 * Rezerva: firul principal, după ce lăsăm un cadru să se picteze —
 * pentru browserele în care worker-ul nu poate porni (CSP prea strâns
 * pe un proxy, extensii care blochează worker-ele). Rezerva e la fel
 * de sigură criptografic; doar UI-ul îngheață cât durează.
 *
 * Erorile care ies de aici sunt `VaultCryptoError`, cu mesaj afișabil.
 */

/** URL-ul relativ literal e obligatoriu: bundler-ul recunoaște static
    `new URL("./x", import.meta.url)` și scoate worker-ul într-un chunk. */
function spawnWorker(): Worker | null {
  if (typeof Worker === "undefined") return null;
  try {
    return new Worker(new URL("./kdf.worker.ts", import.meta.url), { type: "module" });
  } catch {
    return null;
  }
}

class WorkerFailure extends Error {
  readonly code: "kdf_failed" | "worker_failed";
  constructor(code: "kdf_failed" | "worker_failed", message: string) {
    super(message);
    this.code = code;
  }
}

function deriveInWorker(worker: Worker, request: KdfRequest): Promise<MasterMaterial> {
  return new Promise((resolve, reject) => {
    worker.onmessage = (event: MessageEvent<KdfResponse>) => {
      const response = event.data;
      if (response.ok) {
        resolve({ authHash: response.authHash, kek: new Uint8Array(response.kek) });
      } else {
        reject(
          new WorkerFailure(
            response.code === "kdf_failed" ? "kdf_failed" : "worker_failed",
            response.message
          )
        );
      }
    };
    // `onerror` prinde și eșecul de încărcare a script-ului (404, CSP) —
    // exact cazul în care rezerva contează.
    worker.onerror = (event) => {
      event.preventDefault();
      reject(new WorkerFailure("worker_failed", event.message || "Worker-ul nu a pornit."));
    };
    worker.postMessage(request);
  });
}

async function deriveOnMainThread(request: KdfRequest): Promise<MasterMaterial> {
  await ready();
  // Un cadru pictat + un tick: starea „se derivă" ajunge pe ecran
  // înainte ca firul să se blocheze.
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => setTimeout(resolve, 0));
  });
  return deriveMasterMaterial(request.email, request.password);
}

export async function deriveMasterMaterialAsync(
  email: string,
  password: string
): Promise<MasterMaterial> {
  const request: KdfRequest = { email, password };
  const worker = spawnWorker();

  if (worker) {
    try {
      return await deriveInWorker(worker, request);
    } catch (error) {
      // Memorie insuficientă e o limită a mașinii, nu a worker-ului:
      // pe firul principal ar pica la fel, deci nu mai încercăm.
      if (error instanceof WorkerFailure && error.code === "kdf_failed") {
        throw new VaultCryptoError("kdf_failed", error.message);
      }
      // Orice altceva: worker-ul n-a pornit → rezerva.
    } finally {
      worker.terminate();
    }
  }

  return deriveOnMainThread(request);
}
