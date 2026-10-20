import {
  GOOGLE_ASSETS_PER_AD,
  GOOGLE_BUSINESS_NAME_MAX,
  GOOGLE_CHANNEL_LABEL,
  GOOGLE_DESCRIPTION_MAX,
  GOOGLE_HEADLINE_MAX,
  GOOGLE_LONG_HEADLINE_MAX,
} from "../constants";

/**
 * Regulile Google din instrucțiunile pentru conversația cu Claude
 * (`lib/ads/claude-brief.ts`). Aceleași limite ca validarea — se compun
 * din aceleași constante. Fișier izomorf.
 */
export function googleBriefRules(): string {
  return `## Google Ads (Demand Gen — reclame video pe YouTube, Discover, Gmail)

- \`ad_account\`: id-ul contului Google Ads, 10 cifre (\`123-456-7890\` sau \`1234567890\`).
- \`campaign.objective\`: \`leads\`, \`sales\` sau \`traffic\`. Vizualizările și notorietatea pe YouTube nu se fac din portal.
- \`google\`: \`business_name\` (numele firmei de pe reclamă, cel mult ${GOOGLE_BUSINESS_NAME_MAX} de caractere), \`logo_url\` (sigla: imagine pătrată, minim 128×128, PNG sau JPEG, la o adresă https), \`channels\` (\`"all"\` sau o listă: ${Object.keys(GOOGLE_CHANNEL_LABEL).join(", ")} — pentru video-uri filmate, de obicei doar canalele YouTube), \`optimized_targeting\` (false), \`enhancements\` (\`video_enhancements\` și \`text_assets\`, ambele false).
- Video-urile sunt pe YouTube: \`video_id\` = id-ul de 11 caractere din link (\`youtube.com/watch?v=…\`), video public sau nelistat. Un video nou se poate da ca \`{ "source": "upload" }\`: omul îl urcă din portal, iar portalul îl pune pe YouTube, nelistat.
- Textele: \`primary_texts\` devin **titluri lungi** (cel mult ${GOOGLE_LONG_HEADLINE_MAX} de caractere); \`headlines\` = titluri scurte (cel puțin unul, cel mult ${GOOGLE_HEADLINE_MAX}); \`descriptions\` = descrieri (cel puțin una, cel mult ${GOOGLE_DESCRIPTION_MAX}).
- \`variants\`: pe Google e de preferat \`platform_rotates\` — o singură reclamă cu până la ${GOOGLE_ASSETS_PER_AD} video-uri, ${GOOGLE_ASSETS_PER_AD} titluri lungi, ${GOOGLE_ASSETS_PER_AD} titluri și ${GOOGLE_ASSETS_PER_AD} descrieri, pe care Google le combină singur.
- \`conversion.pixel_id\` = id-ul numeric al **acțiunii de conversie** din Google Ads (Obiective → Conversii), nu un pixel. Contextul conturilor o arată.
- Publicul: țări, regiuni sau orașe întregi (fără rază); vârsta pe grupe (18–24, 25–34, 35–44, 45–54, 55–64, 65+); interesele sunt segmentele Google „în piață" și „afinitate", în engleză („Real Estate"). Fără comportamente.
- \`destination.utm\`: \`source: "google"\`, de obicei \`medium: "paid_video"\`. Macro-urile ValueTrack (\`{campaignid}\`, \`{creative}\`) se înlocuiesc la clic.`;
}
