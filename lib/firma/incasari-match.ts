import { norm } from "./csv";
import { daysBetween } from "./format";

/**
 * Potrivirea unui rând de extras cu o factură (încasare) sau o cheltuială
 * (plată). Fișier pur, fără bază — se testează direct.
 *
 * Încasare SIGURĂ = suma exactă (restul de încasat) ȘI numărul facturii sau
 * clientul (CUI ori numele) în detaliile plății, la o singură factură.
 * Orice altceva cu un indiciu (doar suma, doar numele, mai multe facturi) e
 * „de confirmat”: așteaptă omul.
 * Plată SIGURĂ = o singură cheltuială nelegată cu aceeași sumă, aceeași
 * monedă și data la cel mult 10 zile.
 */

export interface OpenInvoice {
  id: string;
  serie: string | null;
  numar: string;
  total: number;
  incasat: number;
  moneda: string;
  clientNume: string;
  clientCui: string | null;
}

export interface OpenExpense {
  id: string;
  suma: number;
  moneda: string;
  dataDoc: string;
  furnizor: string | null;
}

export interface LineToMatch {
  data: string;
  suma: number;
  moneda: string;
  detalii: string;
  contrapartida: string | null;
  referinta: string | null;
}

export type Potrivire = "sigura" | "de_confirmat" | "nepotrivita";

export interface MatchResult {
  potrivire: Potrivire;
  id: string | null;
  candidati: { id: string; motiv: string }[];
  motiv: string;
}

const CORPORATE = new Set(["srl", "s", "r", "l", "sa", "pfa", "ii", "if", "srl-d", "srld", "snc", "scs", "ong", "asociatia", "romania", "ro"]);

function nameTokens(name: string): string[] {
  return norm(name)
    .split(" ")
    .filter((token) => token.length >= 3 && !CORPORATE.has(token));
}

function textOf(line: LineToMatch): string {
  return ` ${norm(`${line.detalii} ${line.contrapartida ?? ""} ${line.referinta ?? ""}`)} `;
}

/** Numărul facturii în plată: „FCT 42”, „FCT42”, „factura 42”, „fact. nr 42”. */
export function mentionsInvoice(text: string, invoice: Pick<OpenInvoice, "serie" | "numar">): boolean {
  const number = invoice.numar.replace(/^0+/, "");
  if (!number) return false;
  const series = invoice.serie ? norm(invoice.serie).replace(/ /g, "") : null;
  const compact = text.replace(/ /g, "");
  // „FCT 42” cu spații sau „FCT42” lipit, dar nu „FCT 420”: după număr nu poate urma altă cifră.
  if (series && (new RegExp(` ${series} 0*${number} `).test(text) || new RegExp(`(^|[^a-z0-9])${series}0*${number}(?![0-9])`).test(compact) || new RegExp(`${series}0*${number}(?![0-9])`).test(compact.replace(/[^a-z0-9]/g, "")))) return true;
  return new RegExp(` (factura|fact|ff|fv|fct|inv|nr) (nr )?0*${number} `).test(text);
}

/** Clientul în plată: CUI-ul (doar cifrele) sau toate cuvintele importante din nume. */
export function mentionsClient(text: string, invoice: Pick<OpenInvoice, "clientNume" | "clientCui">): boolean {
  const cui = invoice.clientCui?.replace(/\D/g, "");
  if (cui && cui.length >= 4 && text.replace(/ /g, "").includes(cui)) return true;
  const tokens = nameTokens(invoice.clientNume);
  return tokens.length > 0 && tokens.every((token) => text.includes(` ${token} `));
}

const same = (a: number, b: number) => Math.abs(a - b) < 0.005;

export function matchIncoming(line: LineToMatch, invoices: OpenInvoice[]): MatchResult {
  const text = textOf(line);
  const scored = invoices
    .filter((invoice) => (invoice.moneda || "RON") === (line.moneda || "RON"))
    .map((invoice) => {
      const remaining = Math.round((invoice.total - invoice.incasat) * 100) / 100;
      const amount = same(line.suma, remaining);
      const id = mentionsInvoice(text, invoice);
      const client = mentionsClient(text, invoice);
      const name = `${invoice.serie ?? ""} ${invoice.numar}`.trim();
      const motiv = [amount ? "suma exactă" : null, id ? `numărul ${name} în plată` : null, client ? "clientul în plată" : null].filter(Boolean).join(", ");
      return { invoice, amount, id, client, motiv, remaining };
    })
    .filter((item) => item.remaining > 0.005);

  const sure = scored.filter((item) => item.amount && (item.id || item.client));
  if (sure.length === 1) {
    return { potrivire: "sigura", id: sure[0].invoice.id, candidati: [{ id: sure[0].invoice.id, motiv: sure[0].motiv }], motiv: sure[0].motiv };
  }
  const possible = scored
    .filter((item) => item.amount || item.id || (item.client && line.suma <= item.remaining + 0.005))
    .sort((a, b) => Number(b.amount) + Number(b.id) + Number(b.client) - (Number(a.amount) + Number(a.id) + Number(a.client)))
    .slice(0, 5);
  if (possible.length > 0) {
    return {
      potrivire: "de_confirmat",
      id: null,
      candidati: possible.map((item) => ({ id: item.invoice.id, motiv: item.motiv || "posibil" })),
      motiv: sure.length > 1 ? "mai multe facturi se potrivesc la fel" : "un singur indiciu — confirmă tu",
    };
  }
  return { potrivire: "nepotrivita", id: null, candidati: [], motiv: "nicio factură deschisă cu suma, numărul sau clientul ăsta" };
}

export function matchOutgoing(line: LineToMatch, expenses: OpenExpense[]): MatchResult {
  const amount = Math.abs(line.suma);
  const close = expenses.filter((expense) => (expense.moneda || "RON") === (line.moneda || "RON") && same(expense.suma, amount) && Math.abs(daysBetween(expense.dataDoc, line.data)) <= 10);
  if (close.length === 1) return { potrivire: "sigura", id: close[0].id, candidati: [{ id: close[0].id, motiv: "aceeași sumă, dată apropiată" }], motiv: "aceeași sumă, dată apropiată" };
  if (close.length > 1) return { potrivire: "de_confirmat", id: null, candidati: close.slice(0, 5).map((expense) => ({ id: expense.id, motiv: `${expense.furnizor ?? "cheltuială"}, ${expense.dataDoc}` })), motiv: "mai multe cheltuieli cu aceeași sumă" };
  return { potrivire: "nepotrivita", id: null, candidati: [], motiv: "nicio cheltuială urcată cu suma asta (în ±10 zile)" };
}
