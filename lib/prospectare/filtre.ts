import { isCanal, isEtapa } from "./labels";
import type { FiltreFirme } from "./citire";

/**
 * Filtrele tabelului de firme, din adresă (`?etapa=site_gata&nisa=…`). Aceleași
 * pentru pagină și pentru exportul CSV, ca exportul să fie exact ce vezi.
 */
export function filtreDinAdresa(params: Record<string, string | string[] | undefined>): FiltreFirme {
  const p = (k: string): string | null => {
    const v = params[k];
    const s = Array.isArray(v) ? v[0] : v;
    return typeof s === "string" && s.trim() && s.length <= 200 ? s.trim() : null;
  };
  const etapa = p("etapa");
  const canal = p("canal");
  const scor = p("scor");
  const ordine = p("ordine");
  return {
    q: p("q"),
    etapa: isEtapa(etapa) ? etapa : null,
    canal: canal === "fara" ? "fara" : isCanal(canal) ? canal : null,
    nisa: p("nisa"),
    oras: p("oras"),
    lot: p("lot"),
    scorMin: scor && /^\d{1,4}$/.test(scor) ? Number(scor) : null,
    ordine: ordine === "scor" || ordine === "nr" || ordine === "actualizat" || ordine === "nume" ? ordine : "site",
  };
}
