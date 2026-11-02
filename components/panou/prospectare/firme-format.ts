import { num } from "@/components/panou/ui/format";

/**
 * Mărunțișuri de text pentru ecranul Firme. Funcții pure, fără importuri de
 * server: merg și în pagină, și în componentele client.
 */

/** „1 firmă”, „12 firme”, „20 de firme”, „101 firme”: româna cere „de” de la 20 în sus, afară de 01–19 la final. */
export function firmeCuNumar(n: number): string {
  const rest = n % 100;
  const cuDe = n >= 20 && (rest === 0 || rest >= 20);
  return `${num(n)} ${n === 1 ? "firmă" : cuDe ? "de firme" : "firme"}`;
}

/** Doar linkuri web. Un domeniu fără protocol (din import) primește https://; orice altceva nu devine link. */
export function linkWeb(url: string | null | undefined): string | null {
  const v = (url ?? "").trim();
  if (!v) return null;
  if (/^https?:\/\/\S+$/i.test(v)) return v;
  if (/^[a-z0-9.-]+\.[a-z]{2,}(\/\S*)?$/i.test(v)) return `https://${v}`;
  return null;
}

export const faraProtocol = (url: string): string => url.replace(/^https?:\/\//i, "").replace(/\/$/, "");
