import "server-only";

import { NotPausedError } from "../meta/paused";
import { GoogleAdsApiError, GoogleCredentialsInvalidError, GoogleCredentialsMissingError, type GoogleAdsErrorItem } from "./api";

/**
 * Erorile Google Ads spuse în română: ce s-a întâmplat și ce faci. Mesajul
 * original și `requestId` rămân atașate — suportul Google îl cere primul.
 */

function googleSays(error: GoogleAdsApiError, items: GoogleAdsErrorItem[] = error.info.errors): string {
  const shown = items.slice(0, 3).map((item) => `${item.message || item.code}${item.field ? ` (${item.field})` : ""}`);
  const more = items.length > 3 ? ` și încă ${items.length - 3}` : "";
  const request = error.info.requestId ? ` (request ${error.info.requestId})` : "";
  return `Google: „${shown.length > 0 ? shown.join("; ") : error.info.message}”${more}${request}`;
}

export function describeGoogleError(error: unknown, what: string, tokenEnv: string): string {
  if (error instanceof GoogleCredentialsMissingError) {
    return `Spațiul nu are cheie: ${error.tokenEnv} nu e setat. Pune în Vercel → Settings → Environment Variables JSON-ul contului de serviciu Google Cloud și fă redeploy.`;
  }
  if (error instanceof GoogleCredentialsInvalidError) {
    return `Cheia ${error.tokenEnv} nu merge: ${error.message.replace(`${error.tokenEnv}: `, "")} Pașii: lib/ads/README.md → „Google — contul de serviciu”.`;
  }
  if (error instanceof NotPausedError) {
    return `Garda de pauză a oprit ${what} înainte să plece spre Google: ${error.message} Nu s-a trimis nimic. E o greșeală de cod — spune-i asistentului.`;
  }
  if (!(error instanceof GoogleAdsApiError)) {
    return `${capitalize(what)} a eșuat dintr-un motiv neașteptat: ${error instanceof Error ? error.message : String(error)}.`;
  }

  const { status } = error.info;
  if (status === 0) {
    return error.info.message === "timeout"
      ? `Google n-a răspuns în 30 de secunde la ${what}. Încearcă din nou.`
      : `${capitalize(what)} n-a ajuns la Google (eroare de rețea pe server). Încearcă din nou peste un minut.`;
  }
  if (status === 401 || error.info.reason === "UNAUTHENTICATED") {
    return `Google nu primește cheia ${tokenEnv} (contul de serviciu a fost șters sau cheia retrasă). Fă o cheie nouă în Google Cloud și pune-o în Vercel. ${googleSays(error)}`;
  }
  if (error.has("CLOUD_PROJECT_NOT_APPROVED_FOR_PRODUCTION")) {
    return `Proiectul Google Cloud al cheii are doar acces de test la Google Ads API. Cere accesul (Explorer e suficient): Google Cloud → „Google Ads API” → Overview → Apply. ${googleSays(error)}`;
  }
  if (error.has("MISSING_TOS")) {
    return `Termenii Google Ads API nu sunt acceptați pentru proiectul Google Cloud al cheii. Acceptă-i din Google Cloud → „Google Ads API” → Overview. ${googleSays(error)}`;
  }
  if (error.has("USER_PERMISSION_DENIED") || status === 403) {
    return `Contul de serviciu nu are acces la contul Google Ads pentru ${what}: adaugă-i adresa în Google Ads → Admin → Acces și securitate → Utilizatori, cu nivelul „Standard”. Dacă accesul vine printr-un cont manager (MCC), adaugă-l acolo. ${googleSays(error)}`;
  }
  if (error.has("EU_POLITICAL_ADVERTISING_DECLARATION_REQUIRED")) {
    return `Google blochează modificările în cont până când TOATE campaniile au declarația despre publicitatea politică din UE. Caută în Google Ads campaniile fără declarație și setează „Nu conține publicitate politică”. ${googleSays(error)}`;
  }
  if (error.has("RESOURCE_EXHAUSTED") || error.has("RESOURCE_TEMPORARILY_EXHAUSTED") || status === 429) {
    return `Google limitează cererile: proiectul Google Cloud și-a consumat operațiile pe ultimele 24 de ore (la nivelul Explorer, 2.880) sau a trimis prea multe pe minut. Încearcă mai târziu sau cere nivelul Basic. ${googleSays(error)}`;
  }
  if (status >= 500) {
    return `Google a avut o eroare de partea lor la ${what}. Încearcă din nou peste un minut. ${googleSays(error)}`;
  }
  return `Google a refuzat ${what}. ${googleSays(error)}`;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
