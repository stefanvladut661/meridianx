import "server-only";

import { MetaApiError, MetaTokenMissingError } from "./graph";
import { NotPausedError } from "./paused";

/**
 * Erorile Meta spuse în română: ce s-a întâmplat și ce faci.
 *
 * Mesajul tehnic al Meta rămâne atașat (în engleză, între ghilimele): e
 * singurul lucru care se poate căuta pe Google sau trimite la suport, iar
 * o traducere a noastră l-ar pierde. `fbtrace_id` intră și el — suportul
 * Meta îl cere primul.
 */

const RATE_LIMIT_CODES = new Set([4, 17, 32, 613, 80000, 80003, 80004, 80014]);
const PERMISSION_CODES = new Set([10, 200, 294, 299]);

function metaSays(error: MetaApiError): string {
  const { userTitle, userMessage, message, fbtraceId } = error.info;
  const human = userMessage ?? message;
  const title = userTitle && userMessage ? `${userTitle}: ` : "";
  return `Meta: „${title}${human}”${fbtraceId ? ` (fbtrace ${fbtraceId})` : ""}`;
}

/** `what` = pasul, la infinitiv lung sau substantiv: „crearea setului de reclame". */
export function describeMetaError(error: unknown, what: string, tokenEnv: string): string {
  if (error instanceof MetaTokenMissingError) {
    return `Spațiul nu are token: ${error.tokenEnv} nu e setat pe server. Pune-l în Vercel → Settings → Environment Variables și fă redeploy.`;
  }
  if (error instanceof NotPausedError) {
    return `Garda de pauză a oprit ${what} înainte să plece spre Meta: ${error.message} Nu s-a trimis nimic. E o greșeală de cod — spune-i asistentului.`;
  }
  if (!(error instanceof MetaApiError)) {
    return `${capitalize(what)} a eșuat dintr-un motiv neașteptat: ${error instanceof Error ? error.message : String(error)}.`;
  }

  const { status, code, subcode, message } = error.info;

  if (status === 0) {
    return message === "timeout"
      ? `Meta n-a răspuns în 25 de secunde la ${what}. Încearcă din nou; dacă se repetă, verifică status.fb.com.`
      : `${capitalize(what)} n-a ajuns la Meta (eroare de rețea pe server). Încearcă din nou peste un minut.`;
  }
  if (code === 190) {
    return `Tokenul ${tokenEnv} nu mai e valid — a fost revocat, regenerat sau aplicația a pierdut accesul. Generează altul (pașii din lib/ads/README.md) și pune-l în Vercel. ${metaSays(error)}`;
  }
  if (code !== null && RATE_LIMIT_CODES.has(code)) {
    return `Meta limitează temporar cererile pentru contul ăsta. Așteaptă 5–10 minute și încearcă din nou. ${metaSays(error)}`;
  }
  if (code !== null && PERMISSION_CODES.has(code)) {
    return `Tokenul spațiului nu are voie să facă ${what}. De obicei lipsește un activ în Business Settings → System users → Assign assets (contul de reclame, pagina, pixelul) sau o permisiune a tokenului. ${metaSays(error)}`;
  }
  if (subcode === 3858079 || subcode === 3858081) {
    return `Meta cere pe reclamele din UE cine ${subcode === 3858081 ? "beneficiază de reclamă" : "o plătește"} (DSA). Scrie "dsa_beneficiary" și "dsa_payor" în secțiunea meta a planului sau setează-le în Ads Manager, la setările contului. ${metaSays(error)}`;
  }
  if (code === 368) {
    return `Meta a blocat temporar acțiunea pe motiv de politici (cont sau pagină restricționate). Verifică Account Quality în Business Suite. ${metaSays(error)}`;
  }
  if (code === 2635 || subcode === 2635) {
    return `Versiunea Graph API folosită de portal a fost retrasă. Trebuie actualizată în lib/ads/meta/graph.ts. ${metaSays(error)}`;
  }
  if (code === 1 || code === 2 || status >= 500) {
    return `Meta a avut o eroare de partea lor la ${what}. Încearcă din nou peste un minut. ${metaSays(error)}`;
  }
  if (code === 100) {
    return `Meta a refuzat un câmp la ${what}. ${metaSays(error)}`;
  }
  return `Meta a refuzat ${what}. ${metaSays(error)}`;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
