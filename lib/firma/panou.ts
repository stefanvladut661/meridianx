import { db, NO_DB, type Result } from "./db";
import { addMonths, currentMonth, daysBetween, monthEnd, monthLabel, monthStart, todayIso } from "./format";
import { listClients } from "./clienti";
import { endsWithin } from "./contracte-shared";
import { listAccounts } from "./accese";
import { nextRenewal, renewsWithin } from "./accese-shared";
import { isOblioConfigured } from "./oblio/api";
import { driveMode } from "./drive/google";
import { clientsForRequest, readClientView } from "@/lib/ads/model/read";

/**
 * Panoul (/admin/firma) și alertele (tot ele intră în rezumatul de dimineață).
 * Nicio cifră inventată: o cifră fără date în spate e `null`, iar ecranul spune
 * ce trebuie făcut ca să apară.
 */

export interface Alerta {
  fel: "intarziata" | "contract" | "pachet" | "abonament" | "ciorne" | "email";
  text: string;
  href: string;
  tone: "error" | "warn";
}

export interface SumaPeMoneda {
  [moneda: string]: number;
}

export interface Panou {
  month: string;
  facturat: SumaPeMoneda | null;
  incasat: { sume: SumaPeMoneda; sursa: "extras" | "oblio" } | null;
  deIncasat: SumaPeMoneda | null;
  intarziat: SumaPeMoneda | null;
  cheltuieli: SumaPeMoneda | null;
  reclame: { client: string; sume: SumaPeMoneda | null; nota: string | null }[] | null;
  reclameNota: string | null;
  alerte: Alerta[];
  deFacut: string[];
}

type Row = Record<string, unknown>;
const add = (target: SumaPeMoneda, currency: string, amount: number) => {
  target[currency] = Math.round(((target[currency] ?? 0) + amount) * 100) / 100;
};
const orNull = (sums: SumaPeMoneda) => (Object.keys(sums).length ? sums : null);

/**
 * `withAds: false` pentru jobul de dimineață: portalul de reclame citește cu
 * sesiunea omului (RLS), pe care un cron n-o are — și alertele nu depind de reclame.
 */
export async function computeDashboard(month: string, today = todayIso(), options: { withAds?: boolean } = {}): Promise<Result<Panou>> {
  const admin = db();
  if (!admin) return { ok: false, message: NO_DB };
  const from = monthStart(month);
  const to = monthEnd(month);
  const previous = addMonths(currentMonth(), -1);

  const [invoices, expenses, bankIn, bankImports, pkg, clients, accounts] = await Promise.all([
    admin.from("firma_facturi").select("id, serie, numar, total, incasat, moneda, data_emiterii, scadenta, incasata_la, starea, email_stare, client_id, luna").limit(5000),
    admin.from("firma_cheltuieli").select("suma, moneda").eq("luna", from).is("scoasa_la", null).not("suma", "is", null).limit(5000),
    admin.from("firma_tranzactii").select("suma, moneda, factura_id").eq("directie", "in").gte("data", from).lte("data", to).limit(5000),
    admin.from("firma_importuri_banca").select("id").lte("de_la", to).gte("pana_la", from).limit(5),
    admin.from("firma_pachete").select("stare, lipsuri").eq("luna", monthStart(previous)).maybeSingle(),
    listClients(),
    listAccounts(),
  ]);
  const clientName = new Map(clients.ok ? clients.data.map((client) => [client.id, client.nume]) : []);
  const deFacut: string[] = [];

  // Facturile.
  let facturat: SumaPeMoneda | null = null;
  let deIncasat: SumaPeMoneda | null = null;
  let intarziat: SumaPeMoneda | null = null;
  let incasat: Panou["incasat"] = null;
  const alerte: Alerta[] = [];
  if (invoices.error) deFacut.push("Rulează migrarea 17 ca facturile să apară în panou.");
  else {
    const rows = (invoices.data ?? []) as Row[];
    const issued = rows.filter((row) => row.numar);
    const billed: SumaPeMoneda = {};
    const open: SumaPeMoneda = {};
    const late: SumaPeMoneda = {};
    const collectedOblio: SumaPeMoneda = {};
    for (const row of issued) {
      const currency = String(row.moneda ?? "RON");
      const total = Number(row.total ?? 0);
      const paid = Number(row.incasat ?? 0);
      if (row.data_emiterii && String(row.data_emiterii) >= from && String(row.data_emiterii) <= to) add(billed, currency, total);
      if (row.incasata_la && String(row.incasata_la) >= from && String(row.incasata_la) <= to) add(collectedOblio, currency, paid);
      const remaining = total - paid;
      if (remaining <= 0.005) continue;
      const overdue = row.scadenta && String(row.scadenta) < today;
      add(overdue ? late : open, currency, remaining);
      if (overdue) {
        const days = daysBetween(String(row.scadenta), today);
        alerte.push({
          fel: "intarziata",
          tone: "error",
          href: `/admin/firma/facturi?luna=${String(row.luna ?? row.data_emiterii).slice(0, 7)}&rand=${row.id}`,
          text: `Factura ${row.serie ?? ""} ${row.numar} (${clientName.get(String(row.client_id)) ?? "client"}) e întârziată cu ${days} ${days === 1 ? "zi" : "zile"}: ${remaining.toLocaleString("ro-RO", { minimumFractionDigits: 2 })} ${currency === "RON" ? "lei" : currency} de încasat.`,
        });
      }
    }
    facturat = orNull(billed);
    deIncasat = orNull(open);
    intarziat = orNull(late);
    // Încasat: din extras, dacă luna are extras importat (exact); altfel din Oblio (ultima încasare a facturii în lună).
    if (!bankIn.error && (bankImports.data ?? []).length > 0) {
      const fromBank: SumaPeMoneda = {};
      for (const row of (bankIn.data ?? []) as Row[]) if (row.factura_id) add(fromBank, String(row.moneda ?? "RON"), Number(row.suma));
      incasat = { sume: fromBank, sursa: "extras" };
    } else if (Object.keys(collectedOblio).length) incasat = { sume: collectedOblio, sursa: "oblio" };
    if (issued.length === 0) deFacut.push(`Nicio factură emisă încă. Contractele din Clienți dau ciornele lunii, în Facturi.`);

    const drafts = rows.filter((row) => row.starea === "ciorna" && (!row.luna || String(row.luna) <= monthStart(currentMonth())));
    if (drafts.length > 0) alerte.push({ fel: "ciorne", tone: "warn", href: "/admin/firma/facturi", text: `${drafts.length === 1 ? "O ciornă de factură așteaptă" : `${drafts.length} ciorne de facturi așteaptă`} aprobarea.` });
    const emails = issued.filter((row) => row.email_stare === "pregatit" || row.email_stare === "esuat");
    if (emails.length > 0) alerte.push({ fel: "email", tone: "warn", href: "/admin/firma/facturi", text: `${emails.length === 1 ? "Emailul unei facturi n-a plecat" : `Emailurile a ${emails.length} facturi n-au plecat`} către client.` });
  }

  // Cheltuielile.
  let cheltuieli: SumaPeMoneda | null = null;
  if (expenses.error) deFacut.push("Rulează migrarea 19 ca cheltuielile să apară în panou.");
  else {
    const sums: SumaPeMoneda = {};
    for (const row of (expenses.data ?? []) as Row[]) add(sums, String(row.moneda ?? "RON"), Number(row.suma));
    cheltuieli = orNull(sums);
    if (!cheltuieli) deFacut.push(`Nicio cheltuială în ${monthLabel(month)}. Urcă bonurile în Cheltuieli.`);
  }
  if (!incasat && (bankImports.data ?? []).length === 0) deFacut.push(`Importă extrasul din ${monthLabel(month)} (Încasări) ca încasările să se vadă exact.`);

  // Contractele care se termină în 30 de zile.
  if (clients.ok) {
    for (const client of clients.data) {
      for (const contract of client.contracte) {
        if (!endsWithin(contract, today, 30)) continue;
        const days = daysBetween(today, contract.seTermina as string);
        alerte.push({ fel: "contract", tone: "warn", href: `/admin/firma/clienti?rand=${client.id}`, text: `Contractul cu ${client.nume} se termină în ${days} ${days === 1 ? "zi" : "zile"} (${contract.seTermina}).` });
      }
    }
    if (clients.data.length === 0) deFacut.push("Adaugă clienții și contractele în Clienți: din ele vin facturile lunare.");
  }

  // Pachetul pentru contabil (luna trecută), cât timp nu e trimis.
  if (!pkg.error) {
    const state = (pkg.data as Row | null)?.stare;
    if (state !== "trimis") {
      const missing = Array.isArray((pkg.data as Row | null)?.lipsuri) ? ((pkg.data as Row).lipsuri as { blocheaza?: boolean }[]).filter((item) => item.blocheaza).length : null;
      alerte.push({
        fel: "pachet",
        tone: "warn",
        href: `/admin/firma/contabil?luna=${previous}`,
        text: `Pachetul pentru contabil pe ${monthLabel(previous)} nu e trimis${missing ? ` — lipsesc ${missing === 1 ? "un lucru" : `${missing} lucruri`}` : state === "complet" || state === "zip_gata" ? " — e gata de trimis" : ""}.`,
      });
    }
  }

  // Abonamentele care se reînnoiesc în 7 zile.
  if (accounts.ok) {
    for (const account of accounts.data) {
      if (!renewsWithin(account, today)) continue;
      const next = nextRenewal(account, today) as string;
      const days = daysBetween(today, next);
      alerte.push({ fel: "abonament", tone: "warn", href: "/admin/firma/accese", text: `${account.nume} se reînnoiește ${days === 0 ? "azi" : `în ${days} ${days === 1 ? "zi" : "zile"}`}${account.abonament !== null ? ` (${account.abonament.toLocaleString("ro-RO", { minimumFractionDigits: 2 })} ${account.moneda === "RON" ? "lei" : account.moneda})` : ""}.` });
    }
  }

  // Banii pe reclame, pe client (din portalul de reclame), doar pentru clienții legați.
  let reclame: Panou["reclame"] = null;
  let reclameNota: string | null = null;
  const linked = clients.ok ? clients.data.filter((client) => client.adsClientId) : [];
  if (options.withAds === false) reclameNota = null;
  else if (linked.length === 0) reclameNota = "Leagă clienții de portalul de reclame (Clienți → panoul clientului) ca banii pe reclame să apară aici.";
  else {
    const ads = await clientsForRequest();
    if (!ads.ok) reclameNota = `Portalul de reclame nu răspunde: ${ads.message}`;
    else {
      const until = to < today ? to : today;
      reclame = [];
      for (const client of linked) {
        const summary = ads.data.find((item) => item.id === client.adsClientId);
        if (!summary) {
          reclame.push({ client: client.nume, sume: null, nota: "clientul legat nu mai e în portal" });
          continue;
        }
        const view = await readClientView({ client: summary, channel: "toate", range: { from, to: until, previousFrom: from, previousTo: from } });
        if (!view.ok) {
          reclame.push({ client: client.nume, sume: null, nota: view.message });
          continue;
        }
        const sums: SumaPeMoneda = {};
        // Doar campaniile: grupurile și reclamele sunt aceiași bani, încă o dată.
        for (const entity of view.data.entities) {
          if (entity.level !== "campaign") continue;
          const spend = view.data.totals[entity.id]?.spend ?? 0;
          if (spend > 0) add(sums, entity.currency ?? "RON", spend);
        }
        reclame.push({ client: client.nume, sume: orNull(sums), nota: Object.keys(sums).length ? null : "nicio cheltuială sincronizată în lună" });
      }
    }
  }

  if (!isOblioConfigured()) deFacut.push("Leagă Oblio (Setări) ca facturile să se poată emite și starea lor să se citească.");
  if (!driveMode()) deFacut.push("Leagă Drive-ul (Setări → Drive) ca documentele lunii să ajungă singure în folder.");

  const order = { intarziata: 0, pachet: 1, contract: 2, abonament: 3, ciorne: 4, email: 5 } as const;
  alerte.sort((a, b) => order[a.fel] - order[b.fel]);
  return { ok: true, data: { month, facturat, incasat, deIncasat, intarziat, cheltuieli, reclame, reclameNota, alerte, deFacut } };
}
