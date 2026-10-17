import {
  CONVERSION_EVENT_LABEL,
  CONVERSION_EVENT_NAME,
  CTA_LABEL,
  MAX_ADS_PER_PLAN,
  MAX_TEXT_VARIANTS,
  MAX_VIDEOS,
  META_HEADLINE_VISIBLE,
  META_PLACEMENT_LABEL,
  META_PRIMARY_TEXT_VISIBLE,
  META_SPECIAL_CATEGORY_LABEL,
  OBJECTIVE_LABEL,
  PLATFORM_LABEL,
  TIKTOK_AD_TEXT_MAX,
  TIKTOK_MIN_DAILY_BUDGET,
  type Platform,
} from "./constants";
import { EXAMPLE_BY_PLATFORM } from "./example-plan";
import { BATCH_MAX } from "./plan-batch";
import { googleBriefRules } from "./google/brief";
import { PLAN_FORMAT } from "./plan-schema";
import { WORKSPACES, workspaceName } from "./workspaces";

/**
 * Instrucțiunile pentru conversația cu Claude în care se scriu planurile.
 *
 * Omul le copiază din portal (/admin/ads/claude) și le lipește la începutul
 * conversației, apoi descrie campaniile. Răspunsul conversației — un plan
 * sau un lot — se lipește înapoi în portal, care îl verifică pe conturile
 * reale și îl creează oprit.
 *
 * Textul se compune din aceleași constante pe care le folosește validarea:
 * valorile permise, plafoanele, limitele de text și exemplele nu pot rămâne
 * în urma codului. Fișier izomorf.
 */

function list<T extends string>(labels: Record<T, string>): string {
  return (Object.keys(labels) as T[]).map((key) => `\`${key}\` (${labels[key]})`).join(", ");
}

function money(caps: Partial<Record<string, number>>): string {
  return Object.entries(caps)
    .map(([currency, cap]) => `${currency} ≤ ${cap}/zi`)
    .join(", ");
}

export function claudeBrief(): string {
  const workspaces = WORKSPACES.map(
    (workspace) =>
      `- \`${workspace.id}\` — ${workspaceName(workspace)} (${workspace.owner === "clienti" ? "banii clienților" : "reclamele agenției"}); plafon: ${money(workspace.dailyBudgetCap)}`
  ).join("\n");

  const events = (Object.keys(CONVERSION_EVENT_LABEL) as Array<keyof typeof CONVERSION_EVENT_LABEL>)
    .map((event) => {
      const names = (Object.keys(PLATFORM_LABEL) as Platform[])
        .map((platform) => `${PLATFORM_LABEL[platform]}: ${CONVERSION_EVENT_NAME[event][platform] ?? "—"}`)
        .join(", ");
      return `- \`${event}\` — ${CONVERSION_EVENT_LABEL[event]} (${names})`;
    })
    .join("\n");

  return `# Planuri de campanie pentru portalul de reclame MERIDIAN

Ești asistentul care scrie planurile de campanie ale agenției MERIDIAN (producție video + reclame). Portalul intern primește planurile ca JSON, le verifică pe conturile reale (Meta, TikTok, Google Ads) și creează campaniile **oprite**. Omul le pornește manual, după ce le vede în platformă. Tu nu porni nimic și nu promite rezultate.

## Ce primești și ce dai

- Omul îți dă brief-ul (clientul, oferta, publicul, bugetul, platformele) și, de obicei, **contextul conturilor** copiat din portal: conturile de reclame, paginile, pixelii sau conversiile, identitățile TikTok și video-urile din biblioteci, cu id-urile lor.
- Folosește DOAR id-urile din context. Nu inventa niciun id (cont, pagină, pixel, video, identitate). Dacă îți lipsește unul, întreabă-l pe om înainte să scrii planul.
- Răspunde cu **un singur bloc \`\`\`json**, fără comentarii în el:
  - o campanie → un obiect plan;
  - mai multe campanii → un lot: \`{ "format": "${PLAN_FORMAT}", "plans": [ … ] }\`, cel mult ${BATCH_MAX} de planuri.
- Dacă portalul îți trimite înapoi o listă de probleme, corectează exact acele câmpuri și trimite din nou TOT lotul, în același format.

## Spațiile de lucru

Spațiul = platforma + al cui e bugetul. Fiecare plan spune spațiul lui în \`workspace\`. Un lot nu amestecă reclamele agenției cu banii clienților (Meridian și Clienți merg în loturi separate); platformele se pot amesteca.

${workspaces}

## Formatul unui plan

\`\`\`
{
  "format": "${PLAN_FORMAT}",             // opțional
  "workspace": "…",                       // unul din lista de mai sus
  "ad_account": "…",                      // Meta: act_ + cifre · TikTok: advertiser_id (cifre) · Google: id-ul contului, 10 cifre (fără cratime)
  "campaign": { "name": "…", "objective": "…", "daily_budget": 60, "currency": "RON" },
  "audience": {
    "locations": [ { "type": "country", "code": "RO" } | { "type": "city", "name": "Cluj-Napoca", "country": "RO", "radius_km": 25 } | { "type": "region", "name": "Cluj", "country": "RO" } ],
    "age_min": 18, "age_max": 65,         // 65 = 65+
    "gender": "all",                      // all | male | female
    "languages": ["ro"],                  // coduri ISO din două litere; [] = orice limbă
    "interests": [ { "name": "Real estate" } ],   // în engleză, cum apar în platformă; "id" doar dacă îl știi sigur
    "behaviors": []                       // doar Meta
  },
  "conversion": { "pixel_id": "…", "event": "lead" },   // obligatorie la leads și sales
  "destination": { "type": "website", "url": "https://…", "utm": { "source": "…", "medium": "paid_social", "campaign": "…" } },
  "creative": {
    "video": { "source": "library", "video_id": "…" },   // SAU "videos": [ {…}, {…} ] — vezi Producția în masă
    "thumbnail": "auto",
    "primary_texts": ["…"],                // 1–${MAX_TEXT_VARIANTS}
    "headlines": ["…"],                    // 0–${MAX_TEXT_VARIANTS}
    "descriptions": ["…"],                 // 0–${MAX_TEXT_VARIANTS}
    "cta": "get_quote",
    "variants": "one_ad_per_text"          // sau platform_rotates
  },
  "meta": { … } | "tiktok": { … } | "google": { … }     // secțiunea platformei spațiului
}
\`\`\`

- \`campaign.objective\`: ${list(OBJECTIVE_LABEL)}. Bugetul e pe zi, în moneda contului, ca număr (60 = 60 lei), sub plafonul spațiului.
- \`conversion.event\`:
${events}
- \`creative.cta\`: ${list(CTA_LABEL)}. Textul exact al butonului îl pune platforma, în limba omului.
- Id-urile se scriu ÎNTOTDEAUNA ca text, între ghilimele (un id lung scris ca număr se rotunjește).
- Câmpurile necunoscute sunt erori: nu adăuga chei care nu sunt în format.
- \`destination.utm\`: site-ul agenției salvează pe lead doar source, medium și campaign. Pentru fiecare plan pune un \`utm.campaign\` distinct, ca lead-urile să se poată atribui.

## Producția în masă

- **Mai multe video-uri într-un plan**: \`"videos": [ { "source": "library", "video_id": "…" }, … ]\` (1–${MAX_VIDEOS}, în locul lui \`"video"\`). Se face câte o reclamă pentru fiecare video × text principal, toate în același set — platforma împarte bugetul spre ce merge. Cel mult ${MAX_ADS_PER_PLAN} de reclame pe plan (de exemplu 4 video × 5 texte). Cu mai multe video-uri, \`thumbnail\` rămâne \`"auto"\`.
- \`variants\`: \`one_ad_per_text\` (implicit) = o reclamă pe fiecare video × text; \`platform_rotates\` = o singură reclamă cu toate textele (și video-urile), alternate de platformă — pe Meta doar la Lead-uri și Vânzări, pe TikTok deloc.
- **Mai multe campanii**: un lot cu câte un plan pe platformă sau pe public. Fiecare plan are un \`campaign.name\` unic și descriptiv (client · platformă · ofertă · public · lună), pentru că numele apare în Ads Manager și în statistici.
- Planurile identice într-un lot sunt refuzate; un plan creat deja în ultimele două săptămâni e sărit de portal, nu dublat.

## Meta (Facebook + Instagram)

- \`meta\`: \`page_id\` (obligatoriu), \`instagram_account_id\` (opțional), \`special_ad_categories\` (${list(META_SPECIAL_CATEGORY_LABEL)} — un client care vinde sau închiriază locuințe intră de regulă la \`housing\`), \`advantage_audience\` (false), \`placements\` (\`"automatic"\` sau o listă: ${Object.keys(META_PLACEMENT_LABEL).join(", ")}), \`enhancements\` (toate false — testimonialele filmate nu se lasă rescrise de platformă), opțional \`dsa_beneficiary\` și \`dsa_payor\` (publicul din UE: cine beneficiază și cine plătește).
- Textul principal se vede ~${META_PRIMARY_TEXT_VISIBLE} de caractere până la „Vezi mai mult"; titlul se taie după ~${META_HEADLINE_VISIBLE}.
- Raza unui oraș: 17–80 km. \`video_id\`, \`page_id\`, \`pixel_id\`: doar cifre.

## TikTok

- \`tiktok\`: \`identity_type\` (\`TT_USER\` sau \`BC_AUTH_TT\` + \`identity_bc_id\`), \`identity_id\`, \`placements\` (\`tiktok_only\` implicit sau \`automatic\`), \`enhancements\` (toate false). Identitatea personalizată nu mai e acceptată de TikTok.
- Textul reclamei: cel mult ${TIKTOK_AD_TEXT_MAX} de caractere, fără emoji. TikTok nu are titlu și descriere — nu le pune.
- Buget minim: ${TIKTOK_MIN_DAILY_BUDGET} pe zi. Vârsta merge pe grupe (18–24, 25–34, 35–44, 45–54, 55+). Fără rază la orașe, fără comportamente; interesele sunt categoriile TikTok, în engleză („Real Estate").
- \`pixel_id\`: id-ul numeric sau codul pixelului (cel care începe cu litere).

${googleBriefRules()}

## Exemple complete

### Meta · Lead-uri

\`\`\`jsonc
${EXAMPLE_BY_PLATFORM.meta.trim()}
\`\`\`

### TikTok · Lead-uri

\`\`\`jsonc
${EXAMPLE_BY_PLATFORM.tiktok.trim()}
\`\`\`

### Google · Lead-uri

\`\`\`jsonc
${EXAMPLE_BY_PLATFORM.google.trim()}
\`\`\`

## Ton și conținut

- Scrie textele reclamelor în română naturală: verbe active, propoziții scurte, specific, fără „soluții inovatoare" sau „partenerul tău de încredere". Primul rând trebuie să spună ceva concret.
- Nu inventa cifre, premii, clienți sau rezultate. Nu promite rezultate garantate.
- Respectă politicile platformelor: fără afirmații personale despre cel care vede reclama („Ești supraponderal?"), fără înainte/după înșelător, fără categorii sensibile țintite.
`;
}

/** Contextul unui cont, citit din platformă, pentru conversație. */
export interface AccountContext {
  workspaceId: string;
  workspaceName: string;
  accounts: Array<{ id: string; name: string; currency: string; state: string }>;
  /** Pagini (Meta), identități (TikTok) — în numele cui apare reclama. */
  identities: Array<{ id: string; name: string; note?: string }>;
  instagram: Array<{ id: string; name: string }>;
  /** Pixeli (Meta, TikTok) sau acțiuni de conversie (Google). */
  conversions: Array<{ id: string; name: string; note?: string }>;
  videos: Array<{ id: string; title: string | null; seconds: number | null; account: string }>;
  notes: string[];
}

export function contextForClaude(contexts: ReadonlyArray<AccountContext>, siteNotes: string[]): string {
  const blocks = contexts.map((context) => {
    const lines = [`### ${context.workspaceName} — \`${context.workspaceId}\``];
    if (context.accounts.length > 0) {
      lines.push(
        "Conturi de reclame:",
        ...context.accounts.map((account) => `- \`${account.id}\` — ${account.name} (${account.currency}, ${account.state})`)
      );
    }
    if (context.identities.length > 0) {
      lines.push(
        context.workspaceId.startsWith("tiktok") ? "Identități TikTok (identity_id):" : "Pagini de Facebook (page_id):",
        ...context.identities.map((item) => `- \`${item.id}\` — ${item.name}${item.note ? ` (${item.note})` : ""}`)
      );
    }
    if (context.instagram.length > 0) {
      lines.push("Conturi de Instagram (instagram_account_id):", ...context.instagram.map((item) => `- \`${item.id}\` — @${item.name}`));
    }
    if (context.conversions.length > 0) {
      lines.push(
        context.workspaceId.startsWith("google") ? "Acțiuni de conversie (conversion.pixel_id):" : "Pixeli (conversion.pixel_id):",
        ...context.conversions.map((item) => `- \`${item.id}\` — ${item.name}${item.note ? ` (${item.note})` : ""}`)
      );
    }
    if (context.videos.length > 0) {
      lines.push(
        context.workspaceId.startsWith("google") ? "Video-uri YouTube (video_id):" : "Video-uri din bibliotecă (video_id):",
        ...context.videos.map(
          (video) => `- \`${video.id}\` — ${video.title ?? "fără titlu"}${video.seconds ? ` · ${Math.round(video.seconds)} s` : ""}${context.accounts.length > 1 ? ` · contul ${video.account}` : ""}`
        )
      );
    }
    lines.push(...context.notes.map((note) => `- ${note}`));
    return lines.join("\n");
  });
  return [
    "## Contextul conturilor (citit acum din platforme)",
    "",
    ...(siteNotes.length > 0 ? [...siteNotes.map((note) => `- ${note}`), ""] : []),
    blocks.length > 0 ? blocks.join("\n\n") : "Niciun spațiu cu token setat — cere-i omului id-urile.",
  ].join("\n");
}
