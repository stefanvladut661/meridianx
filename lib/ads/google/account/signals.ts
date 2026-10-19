import { formatMoney } from "../../plan-derive";
import type { Currency } from "../../constants";
import type { AccountCampaign, AuditBilling, AuditBlock, AuditChange, AuditConversion, AuditSignal, AuditUser } from "./types";

/**
 * Semnalele auditului — ce merită o privire într-un cont preluat: multe
 * campanii create de cineva într-o singură zi, administratori necunoscuți,
 * conversii principale care nu primesc nimic, facturare inactivă, campanii
 * active care cheltuie fără nicio conversie. Doar citire; portalul nu repară
 * nimic singur. Pur, izomorf.
 */

/** Atâtea campanii create de același om în aceeași zi = un val, nu o muncă obișnuită. */
export const BULK_CAMPAIGNS_PER_DAY = 5;
/** Cost pe 30 de zile peste care o campanie activă fără conversii e semnalată. */
export const COST_WITHOUT_CONVERSIONS: Record<string, number> = { RON: 150, EUR: 30, USD: 30 };

const CLIENT_LABEL: Record<string, string> = {
  GOOGLE_ADS_WEB_CLIENT: "interfața Google Ads",
  GOOGLE_ADS_API: "API",
  GOOGLE_ADS_EDITOR: "Google Ads Editor",
  GOOGLE_ADS_BULK_UPLOAD: "încărcare în masă",
  GOOGLE_ADS_SCRIPTS: "scripturi Google Ads",
  GOOGLE_ADS_AUTOMATED_RULE: "o regulă automată",
  GOOGLE_ADS_MOBILE_APP: "aplicația mobilă",
  GOOGLE_ADS_RECOMMENDATIONS: "recomandările Google",
  GOOGLE_ADS_RECOMMENDATIONS_SUBSCRIPTION: "recomandările aplicate automat",
  SEARCH_ADS_360_SYNC: "Search Ads 360",
  SEARCH_ADS_360_POST: "Search Ads 360",
  INTERNAL_TOOL: "un instrument intern Google",
  OTHER: "altceva",
};

export function clientLabel(client: string): string {
  return CLIENT_LABEL[client] ?? client;
}

/** Valurile de campanii create: (cine, ziua, de unde) → câte. */
export function bulkCreations(changes: AuditChange[]): Array<{ user: string; day: string; client: string; count: number }> {
  const groups = new Map<string, { user: string; day: string; client: string; count: number }>();
  for (const change of changes) {
    if (change.resource !== "CAMPAIGN" || change.operation !== "CREATE") continue;
    const user = change.user ?? "necunoscut";
    const day = change.at.slice(0, 10);
    const key = `${user}|${day}|${change.client}`;
    const entry = groups.get(key) ?? { user, day, client: change.client, count: 0 };
    entry.count += 1;
    groups.set(key, entry);
  }
  return [...groups.values()].sort((a, b) => b.count - a.count || b.day.localeCompare(a.day));
}

export function buildSignals(input: {
  changes: AuditBlock<{ items: AuditChange[] }>;
  users: AuditBlock<AuditUser[]>;
  billing: AuditBlock<AuditBilling>;
  conversions: AuditBlock<AuditConversion[]>;
  campaigns: AccountCampaign[];
  knownAdmins: string[];
  currency: string;
}): AuditSignal[] {
  const signals: AuditSignal[] = [];
  const known = new Set(input.knownAdmins.map((email) => email.trim().toLowerCase()).filter(Boolean));
  const money = (amount: number) => formatMoney(amount, (["RON", "EUR", "USD"].includes(input.currency) ? input.currency : null) as Currency | null);

  if (input.changes.ok) {
    for (const wave of bulkCreations(input.changes.data.items).filter((item) => item.count >= BULK_CAMPAIGNS_PER_DAY)) {
      signals.push({
        tone: "warning",
        message: `${wave.count} campanii create de ${wave.user} pe ${wave.day}, din ${clientLabel(wave.client)}. Verifică dacă le știi și dacă cheltuie.`,
      });
    }
  }

  if (input.users.ok) {
    for (const user of input.users.data.filter((item) => item.role === "ADMIN" && !known.has(item.email.toLowerCase()))) {
      signals.push({
        tone: "warning",
        message: `${user.email} are acces de administrator${user.pending ? " (invitație în așteptare)" : ""} și nu e printre adminii portalului. Poate fi clientul — sau cineva care n-ar mai trebui să aibă acces.`,
      });
    }
  }

  if (input.conversions.ok) {
    for (const action of input.conversions.data.filter((item) => item.primary && item.status === "ENABLED" && item.conversions30 === 0)) {
      signals.push({
        tone: "warning",
        message: `Conversia principală „${action.name}” (${action.type}) n-a primit nimic în 30 de zile. Campaniile optimizează pe ea: verifică eticheta sau fă-o secundară.`,
      });
    }
    if (input.conversions.data.length === 0) {
      signals.push({ tone: "warning", message: "Contul nu are nicio acțiune de conversie: campaniile nu văd lead-urile. Creează-le din „Conversii”." });
    }
  }

  if (input.billing.ok) {
    const approved = input.billing.data.setups.some((setup) => setup.status === "APPROVED");
    if (input.billing.data.setups.length > 0 && !approved) {
      signals.push({ tone: "error", message: "Nicio configurare de facturare aprobată: Google nu livrează anunțuri până nu e una activă." });
    }
  }

  const threshold = COST_WITHOUT_CONVERSIONS[input.currency];
  if (threshold !== undefined) {
    for (const campaign of input.campaigns.filter((item) => item.status === "ENABLED" && item.conversions30 === 0 && item.cost30 >= threshold)) {
      signals.push({
        tone: "warning",
        message: `„${campaign.name}” e activă și a cheltuit ${money(campaign.cost30)} în 30 de zile fără nicio conversie.`,
      });
    }
  }

  return signals;
}
