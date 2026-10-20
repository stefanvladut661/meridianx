import { asArray, asRecord, asString, getIn } from "../../plan-path";

/**
 * Cum se numesc locurile din planul de căutare în mesaje. Un plan real are
 * patru campanii și șaptesprezece grupuri: „campania 3 › grupul 11” nu spune
 * nimic, deci mesajul folosește NUMELE din plan („Campania „Auto” › grupul
 * „Montaj”” › titlul 5).
 */

const FIELD: Record<string, string> = {
  format: "câmpul format",
  workspace: "spațiul de lucru (workspace)",
  ad_account: "contul Google Ads (ad_account)",
  currency: "moneda",
  shared_negative_lists: "listele comune de negative",
  campaigns: "lista de campanii",
  key: "cheia",
  name: "numele",
  keywords: "lista de cuvinte",
  daily_budget: "bugetul zilnic",
  bidding: "licitarea",
  strategy: "strategia de licitare",
  max_cpc: "CPC-ul maxim",
  networks: "rețelele",
  search_partners: "partenerii de căutare",
  display: "rețeaua de display",
  locations: "lista de locații",
  excluded_locations: "lista de locații excluse",
  location_mode: "modul de locație",
  languages: "lista de limbi",
  schedule: "programul",
  negative_lists: "listele legate",
  negatives: "lista de negative",
  assets: "materialele",
  sitelinks: "linkurile suplimentare",
  callouts: "mesajele scurte",
  snippets: "fragmentele structurate",
  call: "butonul de apel",
  utm: "parametrii UTM",
  ad_groups: "lista de grupuri",
  final_url: "URL-ul final",
  ads: "lista de anunțuri",
  headlines: "lista de titluri",
  descriptions: "lista de descrieri",
  path1: "calea 1",
  path2: "calea 2",
  text: "textul",
  match: "tipul de potrivire",
  pin: "poziția fixată",
  description1: "descrierea 1",
  description2: "descrierea 2",
  url: "URL-ul",
  header: "antetul",
  values: "valorile",
  country: "țara",
  phone: "telefonul",
  conversion_action_id: "acțiunea de conversie",
  days: "zilele",
  from: "ora de început",
  to: "ora de sfârșit",
  type: "tipul",
  code: "codul de țară",
  radius_km: "raza",
  source: "utm_source",
  medium: "utm_medium",
  campaign: "utm_campaign",
  content: "utm_content",
  term: "utm_term",
};

/** Elementul de pe indexul `index` al unei liste, numit după lista din care face parte. */
function itemName(list: string, index: number, node: unknown): string {
  const record = asRecord(node);
  const name = asString(record?.name);
  const text = asString(record?.text) ?? asString(node);
  switch (list) {
    case "campaigns":
      return name ? `campania „${name}”` : `campania ${index + 1}`;
    case "ad_groups":
      return name ? `grupul „${name}”` : `grupul ${index + 1}`;
    case "shared_negative_lists":
      return name ? `lista comună „${name}”` : `lista comună ${index + 1}`;
    case "ads":
      return `anunțul ${index + 1}`;
    case "headlines":
      return `titlul ${index + 1}`;
    case "descriptions":
      return `descrierea ${index + 1}`;
    case "keywords":
      return text ? `cuvântul cheie „${text}”` : `cuvântul cheie ${index + 1}`;
    case "negatives":
      return text ? `negativul „${text}”` : `negativul ${index + 1}`;
    case "sitelinks":
      return text ? `linkul suplimentar „${text}”` : `linkul suplimentar ${index + 1}`;
    case "callouts":
      return text ? `mesajul scurt „${text}”` : `mesajul scurt ${index + 1}`;
    case "snippets":
      return `fragmentul structurat ${index + 1}`;
    case "schedule":
      return `intervalul ${index + 1} din program`;
    case "locations":
      return `locația ${index + 1}`;
    case "excluded_locations":
      return `locația exclusă ${index + 1}`;
    case "languages":
      return `limba ${index + 1}`;
    case "negative_lists":
      return `lista legată ${index + 1}`;
    case "values":
      return `valoarea ${index + 1}`;
    case "days":
      return `ziua ${index + 1}`;
    default:
      return `elementul ${index + 1}`;
  }
}

/**
 * Locul unei căi, spus în română: `campaigns.0.ad_groups.2.ads.0.headlines.4.text`
 * → „Campania „Auto” › grupul „Montaj” › anunțul 1 › titlul 5”.
 */
export function searchLabel(raw: unknown, path: ReadonlyArray<PropertyKey> | string): string {
  const parts =
    typeof path === "string"
      ? path === ""
        ? []
        : path.split(".").map((part) => (/^\d+$/.test(part) ? Number(part) : part))
      : [...path];
  if (parts.length === 0) return "Planul";

  const pieces: string[] = [];
  let node: unknown = raw;
  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index];
    const next = parts[index + 1];
    if (typeof part === "string" && typeof next === "number") {
      const list = asArray(asRecord(node)?.[part]);
      pieces.push(itemName(part, next, list[next]));
      node = list[next];
      index += 1;
      continue;
    }
    const key = String(part);
    // Textul unui titlu, al unui cuvânt: elementul spune deja tot.
    if (key === "text" && pieces.length > 0) {
      node = asRecord(node)?.[key];
      continue;
    }
    // „assets” e doar un dosar: copiii lui au nume proprii.
    if (key !== "assets" || index === parts.length - 1) pieces.push(FIELD[key] ?? `câmpul „${key}”`);
    node = asRecord(node)?.[key];
  }
  const text = pieces.join(" › ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Numele campaniei de pe un index, pentru mesaje scurte. */
export function campaignLabel(raw: unknown, index: number): string {
  const name = asString(getIn(raw, `campaigns.${index}.name`));
  return name ? `campania „${name}”` : `campania ${index + 1}`;
}
