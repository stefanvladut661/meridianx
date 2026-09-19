/**
 * Clipboard-ul cu termen de expirare (feat/vault, faza 3).
 *
 * O parolă copiată nu trebuie să rămână în clipboard după ce omul a
 * lipit-o: se golește după `CLEAR_AFTER_MS`, necondiționat, dacă între
 * timp nu s-a copiat altceva DIN VAULT. Modelul Bitwarden — fără
 * `readText()`, care în Chrome deschide un dialog de permisiune și în
 * Firefox nu există pentru pagini.
 *
 * Golirea cere fila în prim-plan (`writeText` aruncă „document is not
 * focused"); dacă pică, se reîncearcă la următorul focus. Și la blocare:
 * shell-ul cheamă `clearClipboardNow()` când se demontează, ca un vault
 * blocat să nu lase o parolă în urmă.
 */

export const CLEAR_AFTER_MS = 45 * 1000;

let timer: number | null = null;
let pendingClear = false;
let listening = false;

function stopTimer() {
  if (timer !== null) {
    window.clearTimeout(timer);
    timer = null;
  }
}

async function tryClear(): Promise<void> {
  try {
    await navigator.clipboard.writeText("");
    pendingClear = false;
  } catch {
    // Fila nu e în prim-plan: rămâne de golit la următorul focus.
    pendingClear = true;
    listenForFocus();
  }
}

function listenForFocus() {
  if (listening) return;
  listening = true;
  const onFocus = () => {
    if (!pendingClear) return;
    void tryClear();
  };
  window.addEventListener("focus", onFocus);
  document.addEventListener("visibilitychange", onFocus);
}

/** Copiază și programează golirea. Aruncă dacă browserul refuză
    (fără HTTPS, fără permisiune, fără API) — apelantul spune omului. */
export async function copyWithExpiry(value: string): Promise<void> {
  await navigator.clipboard.writeText(value);
  stopTimer();
  pendingClear = false;
  timer = window.setTimeout(() => {
    timer = null;
    void tryClear();
  }, CLEAR_AFTER_MS);
}

/** Golește acum dacă e ceva de golit — la blocare, la demontare. */
export function clearClipboardNow(): void {
  if (timer === null && !pendingClear) return;
  stopTimer();
  void tryClear();
}

export function isClipboardSupported(): boolean {
  return typeof navigator !== "undefined" && Boolean(navigator.clipboard?.writeText);
}
