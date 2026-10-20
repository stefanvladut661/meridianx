import "server-only";

import { createHash } from "node:crypto";

/**
 * Amprenta a ce s-a verificat pe platformă: spațiul, contul, planul cu
 * cheile rezolvate și orice altceva care schimbă ce se creează. Crearea o
 * recalculează și refuză dacă diferă — omul creează exact ce a văzut.
 * Stă și în `ads_campaigns.fingerprint`, pentru prinderea dublurilor.
 */
export function planFingerprint(input: Record<string, unknown>): string {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}
