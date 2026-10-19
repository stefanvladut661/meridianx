import { EXAMPLE_SEARCH_PLAN } from "./example";
import {
  AD_GROUPS_PER_CAMPAIGN_MAX,
  BIDDING_LABEL,
  CALLOUT_MAX,
  CAMPAIGN_NAME_MAX,
  CAMPAIGNS_PER_PLAN_MAX,
  CAMPAIGN_NEGATIVES_MAX,
  KEYWORD_FORBIDDEN_CHARS,
  KEYWORD_MAX_CHARS,
  KEYWORD_MAX_WORDS,
  KEYWORD_POSITIVE_ONLY_FORBIDDEN,
  LOCATION_MODE_LABEL,
  MATCH_TYPE_LABEL,
  MAX_CPC_SANE,
  MUTATE_OPERATIONS_MAX,
  RSA_DESCRIPTION_MAX,
  RSA_DESCRIPTIONS_MAX,
  RSA_DESCRIPTIONS_MIN,
  RSA_HEADLINE_MAX,
  RSA_HEADLINES_MAX,
  RSA_HEADLINES_MIN,
  RSA_HEADLINES_RECOMMENDED,
  RSA_PATH_MAX,
  RSA_PER_AD_GROUP_MAX,
  SCHEDULE_PER_DAY_MAX,
  SEARCH_PLAN_FORMAT,
  SHARED_NEGATIVE_KEYWORDS_MAX,
  SHARED_NEGATIVE_LISTS_MAX,
  SITELINK_DESCRIPTION_MAX,
  SITELINK_TEXT_MAX,
  SITELINKS_RECOMMENDED,
  SNIPPET_HEADER_LABEL,
  SNIPPET_VALUE_MAX,
  SNIPPET_VALUES_MAX,
  SNIPPET_VALUES_MIN,
} from "./limits";

/**
 * Planul de căutare în instrucțiunile pentru Claude (faza 14): formatul,
 * limitele, potrivirile, regulile negativelor și structura recomandată.
 * Se compune din aceleași constante ca validarea (`limits.ts`) și din același
 * exemplu ca butonul „Încarcă exemplul” — nu poate rămâne în urma codului.
 * Fișier izomorf.
 */

const codeList = (items: readonly string[]) => items.map((item) => `\`${item}\``).join(" ");
const labelled = (labels: Record<string, string>) =>
  Object.entries(labels)
    .map(([key, label]) => `\`${key}\` (${label})`)
    .join(", ");

export function searchBriefRules(): string {
  const caps = Object.entries(MAX_CPC_SANE)
    .map(([currency, cap]) => `${cap} ${currency}`)
    .join(" / ");
  return `## Google Search — planul de căutare (\`${SEARCH_PLAN_FORMAT}\`)

Campaniile de căutare au formatul lor: **un plan = un cont Google Ads, cu una sau mai multe campanii**, lipit în portal la „Căutare” (sau în lot, lângă celelalte planuri). Totul se creează **pe pauză** — campaniile, grupurile, anunțurile — și pornește doar din Google Ads, de mână.

### Structura

\`\`\`
{
  "format": "${SEARCH_PLAN_FORMAT}",
  "workspace": "google-meridian" | "google-clienti",
  "ad_account": "123-456-7890",          // din contextul conturilor
  "currency": "RON",                     // moneda contului
  "shared_negative_lists": [ { "key", "name", "keywords": [ { "text", "match" } ] } ],
  "campaigns": [ {
    "key", "name", "daily_budget",
    "bidding": { "strategy", "max_cpc" },
    "networks": { "search_partners": false, "display": false },
    "locations": [ … ], "excluded_locations": [ … ], "location_mode": "presence",
    "languages": ["ro"],
    "schedule": [ { "days": ["mon", …], "from": "08:00", "to": "18:00" } ],
    "negative_lists": ["<key din shared_negative_lists>"],
    "negatives": [ { "text", "match" } ],
    "assets": { "sitelinks": [ … ], "callouts": [ … ], "snippets": [ … ], "call": { "country": "RO", "phone": "…", "conversion_action_id": "…" } },
    "utm": { "source": "google", "medium": "cpc", "campaign": "…" },
    "ad_groups": [ { "name", "final_url", "max_cpc", "keywords": [ … ], "negatives": [ … ], "ads": [ { "headlines": [ { "text", "pin" } ], "descriptions": [ … ], "path1", "path2", "final_url" } ] } ]
  } ]
}
\`\`\`

- Cel mult ${CAMPAIGNS_PER_PLAN_MAX} de campanii pe plan, ${AD_GROUPS_PER_CAMPAIGN_MAX} de grupuri pe campanie, ${RSA_PER_AD_GROUP_MAX} anunțuri pe grup. Tot planul pleacă într-o singură cerere: peste ${MUTATE_OPERATIONS_MAX.toLocaleString("ro-RO")} de operații e eroare — împarte-l în planuri mai mici.
- \`key\`-urile (campanii, liste) sunt nume în plan: litere mici, cifre, \`_\` și \`-\`, cel mult 40, unice. \`name\`: numele din Google Ads (cel mult ${CAMPAIGN_NAME_MAX} de caractere), unic în cont — **nu folosi numele campaniilor sau listelor care există deja** (le vezi în context).
- **Bugetul**: \`daily_budget\` pe zi, pe campanie; **suma** bugetelor din plan trebuie să încapă sub plafonul spațiului.
- **Licitarea**: ${labelled(BIDDING_LABEL)}. La \`maximize_clicks\`, \`max_cpc\` e plafonul de CPC (recomandat la început); la \`manual_cpc\`, licitarea implicită (grupurile o pot înlocui cu \`max_cpc\`). Peste ${caps} pe clic primești avertisment. Licitările automate pe conversii nu se fac din portal.
- **Rețele**: \`display\` rămâne \`false\`; \`search_partners\` doar dacă omul o cere.
- **Locațiile**: același format ca la celelalte planuri — țară, regiune sau oraș întreg, **fără \`radius_km\`** (pe căutare, raza e eroare); \`excluded_locations\` la fel. \`location_mode\`: ${labelled(LOCATION_MODE_LABEL)}. Pentru un serviciu local, \`presence\`.
- **Programul**: zilele (${codeList(["mon", "tue", "wed", "thu", "fri", "sat", "sun"])}) cu ore din 15 în 15 minute, cel mult ${SCHEDULE_PER_DAY_MAX} intervale pe zi. Gol = oricând. Pentru clienții care vor apeluri, programul de lucru.

### Cuvintele cheie

- Potrivirile: ${labelled(MATCH_TYPE_LABEL)}. Scrie-le ca \`{ "text": "montaj centrala", "match": "phrase" }\`, fără paranteze sau ghilimele în text.
- Cel mult ${KEYWORD_MAX_CHARS} de caractere și ${KEYWORD_MAX_WORDS} cuvinte. Caractere interzise: ${codeList(KEYWORD_FORBIDDEN_CHARS)}; ${codeList(KEYWORD_POSITIVE_ONLY_FORBIDDEN)} doar în negative.
- Fără dubluri în aceeași listă (aceeași formă, aceeași potrivire) — portalul le refuză. Evită și același cuvânt în două grupuri ale aceleiași campanii: grupurile ar concura între ele (portalul nu-l oprește).

### Negativele — și conflictele, pe care portalul le refuză

- Trei niveluri: lista comună (\`shared_negative_lists\`, legată prin \`negative_lists\`; cel mult ${SHARED_NEGATIVE_LISTS_MAX} de liste, ${SHARED_NEGATIVE_KEYWORDS_MAX.toLocaleString("ro-RO")} de cuvinte pe listă), campania (\`negatives\`, cel mult ${CAMPAIGN_NEGATIVES_MAX.toLocaleString("ro-RO")}) și grupul (\`ad_groups[].negatives\`).
- Cum blochează un negativ: **amplu** — termenul conține toate cuvintele lui, în orice ordine; **frază** — conține cuvintele lui, în ordine, unul după altul; **exact** — termenul e identic. Negativele nu prind sinonime, plurale sau greșeli de scriere: scrie formele importante.
- **Un negativ care ar bloca un cuvânt cheie pozitiv din aceeași campanie (din lista legată, din campanie sau din grup) e eroare** — portalul arată perechea. De exemplu, negativul amplu \`pret\` blochează cuvântul \`pret montaj centrala\`.
- Ca să separi campaniile între ele (centrale vs. aer condiționat), pune în fiecare negativ de frază pe tema celeilalte — doar dacă nu se suprapune cu propriile cuvinte.

### Anunțurile (responsive search ads)

- ${RSA_HEADLINES_MIN}–${RSA_HEADLINES_MAX} titluri de cel mult ${RSA_HEADLINE_MAX} de caractere (recomandat cel puțin ${RSA_HEADLINES_RECOMMENDED}), ${RSA_DESCRIPTIONS_MIN}–${RSA_DESCRIPTIONS_MAX} descrieri de cel mult ${RSA_DESCRIPTION_MAX}; \`path1\` / \`path2\` de cel mult ${RSA_PATH_MAX}. Diacriticele contează ca un caracter.
- Titlurile se combină între ele în orice ordine: fiecare trebuie să stea singur, fără să repete altul. Cel puțin două-trei titluri cu tema grupului, unul cu un beneficiu concret, unul cu un îndemn.
- \`pin\` (1–3 la titluri, 1–2 la descrieri) doar când chiar trebuie (o mențiune obligatorie); fiecare fixare scade combinațiile.
- \`final_url\` al anunțului lipsește de obicei — se ia al grupului. Fiecare grup duce pe pagina cea mai potrivită temei lui.

### Materialele campaniei (\`assets\`)

- **Linkuri suplimentare**: cel puțin ${SITELINKS_RECOMMENDED}; textul de cel mult ${SITELINK_TEXT_MAX}, descrierile (amândouă sau niciuna) de cel mult ${SITELINK_DESCRIPTION_MAX}.
- **Extensii de tip text** (\`callouts\`): de cel mult ${CALLOUT_MAX} de caractere, fapte scurte („Montaj în 48 de ore”).
- **Fragmente structurate** (\`snippets\`): \`header\` dintre ${labelled(SNIPPET_HEADER_LABEL)}, cu ${SNIPPET_VALUES_MIN}–${SNIPPET_VALUES_MAX} valori de cel mult ${SNIPPET_VALUE_MAX}.
- **Apelul** (\`call\`): țara și telefonul firmei; \`conversion_action_id\` = id-ul unei acțiuni de conversie de tip **apel din anunț** (\`AD_CALL\`) din contextul contului. Fără ea, apelurile se numără pe setarea contului.

### Structura recomandată

1. O campanie pe serviciu (și pe zonă, dacă bugetele diferă). Nume: \`Client - Serviciu - Zona - Search\`.
2. Grupuri strânse: o singură intenție și o singură pagină pe grup, 5–20 cuvinte, mai ales frază și exactă. Ampla doar cu o listă bună de negative.
3. Una sau două reclame pe grup, cu cel puțin ${RSA_HEADLINES_RECOMMENDED} titluri; cuvântul principal al grupului în două-trei titluri.
4. O listă comună „NEG - …” pentru ce nu vinde nimeni (locuri de muncă, gratis, piese, tutoriale, second hand), legată de toate campaniile.
5. \`utm\` pe campanie: \`source: "google"\`, \`medium: "cpc"\`, \`campaign\` distinct.

### Exemplul complet (firmă inventată)

\`\`\`jsonc
${EXAMPLE_SEARCH_PLAN.trim()}
\`\`\`

Campaniile existente din context arată ce rulează deja: nu dubla o campanie de căutare activă pe aceleași cuvinte — două campanii ale aceluiași cont concurează la aceleași căutări.`;
}
