// Verificarea regulii care nu se negociază: portalul creează DOAR pe pauză.
//
//   node lib/ads/meta/verify-paused.mjs
//
// Fără dependențe: Node 24 citește direct fișierele .ts (tipurile se șterg),
// iar cârligul de mai jos rezolvă importurile fără extensie și aliasul `@/`.
// Nu vorbește cu Meta și nu citește niciun token.
//
// Ce verifică:
//   1. fiecare corp construit de `build.ts` (campanie, set, creative, reclame)
//      trece de `assertPaused`, iar campania, setul și reclamele au PAUSED;
//   2. garda refuză: status lipsă, alt status, status ascuns într-un JSON
//      serializat, o muchie care nu e de creare;
//   3. îmbunătățirile automate pleacă explicit OPT_OUT;
//   4. statusul de pornire nu apare scris nicăieri în codul portalului;
//   5. `graph.ts` nu are altă cale de scriere decât `metaCreate`.

import { registerHooks } from "node:module";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import assert from "node:assert/strict";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../../..");
const ADS = path.resolve(HERE, "..");

function resolveFile(base) {
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, path.join(base, "index.ts")]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "server-only") return { url: "data:text/javascript,export{}", shortCircuit: true };
    let base = null;
    if (specifier.startsWith("@/")) base = path.join(ROOT, specifier.slice(2));
    else if (/^\.\.?\//.test(specifier) && context.parentURL?.startsWith("file:")) {
      base = path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier);
    }
    const file = base ? resolveFile(base) : null;
    return file ? { url: pathToFileURL(file).href, shortCircuit: true } : next(specifier, context);
  },
});

const load = (relative) => import(pathToFileURL(path.join(ADS, relative)).href);

const { assertPaused, NotPausedError, PAUSED } = await load("meta/paused.ts");
const build = await load("meta/build.ts");
const { EXAMPLE_PLAN } = await load("example-plan.ts");
const { parsePlanText } = await load("plan-json.ts");
const { validatePlan } = await load("plan-validate.ts");

let checks = 0;
const ok = (label) => {
  checks += 1;
  console.log(`  ✓ ${label}`);
};

// ---------------------------------------------------------------------------
// 1. Corpurile construite din exemplu
// ---------------------------------------------------------------------------

const parsed = parsePlanText(EXAMPLE_PLAN);
assert.ok(parsed.ok, "exemplul se citește");
const validation = validatePlan(parsed.value, { currentWorkspace: "meta-meridian" });
assert.ok(validation.ok, "exemplul e valid");

// Planul cu cheile de targetare „rezolvate" (valori false, evidente).
const plan = structuredClone(validation.plan);
plan.audience.locations.forEach((location, index) => {
  if (location.type !== "country") location.key = `99900${index}`;
});
plan.audience.interests.forEach((item, index) => (item.id = `6000000000000${index}`));
plan.audience.behaviors.forEach((item, index) => (item.id = `6100000000000${index}`));

const dsa = { beneficiary: "MERIDIAN", payor: "MERIDIAN" };
const campaign = build.buildCampaign(plan);
const adset = build.buildAdSet(plan, { campaignId: "1", locales: [32], dsa });
const creatives = build.buildCreatives(plan, { videoId: "2", thumbnail: { hash: "abc123" } });
const ads = creatives.map((item, index) => build.buildAd(plan, { name: item.name, adSetId: "3", creativeId: `4${index}` }));

console.log("Corpurile construite din exemplu:");
assert.equal(campaign.status, PAUSED);
assertPaused("campaigns", campaign);
ok("campania: PAUSED, trece de gardă");
assert.equal(adset.status, PAUSED);
assertPaused("adsets", adset);
ok("setul: PAUSED, trece de gardă");
assert.ok(creatives.length > 0);
for (const item of creatives) assertPaused("adcreatives", item.creative);
ok(`creativele (${creatives.length}): trec de gardă`);
for (const ad of ads) {
  assert.equal(ad.status, PAUSED);
  assertPaused("ads", ad);
}
ok(`reclamele (${ads.length}): PAUSED, trec de gardă`);

// Varianta „platforma alternează textele".
const rotating = structuredClone(plan);
rotating.creative.variants = "platform_rotates";
const rotatingCreatives = build.buildCreatives(rotating, { videoId: "2", thumbnail: { hash: "abc123" } });
assert.equal(rotatingCreatives.length, 1);
for (const item of rotatingCreatives) assertPaused("adcreatives", item.creative);
ok("varianta cu alternare: o singură reclamă, trece de gardă");

// ---------------------------------------------------------------------------
// 2. Garda refuză
// ---------------------------------------------------------------------------

console.log("Garda refuză:");
const other = ["AR", "CHIVED"].join(""); // un status real, altul decât PAUSED
const refuses = (label, edge, payload) => {
  assert.throws(() => assertPaused(edge, payload), NotPausedError, label);
  ok(label);
};
refuses("campanie fără status", "campaigns", { ...campaign, status: undefined });
refuses("set cu alt status", "adsets", { ...adset, status: other });
refuses("reclamă cu status gol", "ads", { ...ads[0], status: "" });
refuses("status ascuns într-un obiect serializat", "ads", { ...ads[0], creative: JSON.stringify({ status: other }) });
refuses("configured_status diferit, adânc în corp", "adsets", { ...adset, targeting: { x: [{ configured_status: other }] } });
refuses("status pe creativ, altul decât PAUSED", "adcreatives", { ...creatives[0].creative, status: other });
refuses("muchie care nu e de creare", "insights", { status: PAUSED });
assertPaused("adimages", { bytes: "aGVsbG8=", name: "coperta.jpg" });
ok("coperta (adimages) trece: n-are status");

// ---------------------------------------------------------------------------
// 3. Îmbunătățirile automate
// ---------------------------------------------------------------------------

console.log("Îmbunătățirile automate:");
for (const item of [...creatives, ...rotatingCreatives]) {
  const features = item.creative.degrees_of_freedom_spec?.creative_features_spec ?? {};
  for (const feature of [...build.META_CREATIVE_FEATURES, ...build.AD_SOURCES_FEATURES]) {
    assert.deepEqual(features[feature], { enroll_status: "OPT_OUT" }, `${feature} OPT_OUT`);
  }
  assert.deepEqual(item.creative.contextual_multi_ads, { enroll_status: "OPT_OUT" });
}
ok(`${build.META_CREATIVE_FEATURES.length} funcții Advantage+ creative, ${build.AD_SOURCES_FEATURES.length} din „Ad sources” și multi-advertiser: OPT_OUT pe fiecare creativ`);
for (const item of [...creatives, ...rotatingCreatives]) {
  const keys = Object.keys(item.creative.degrees_of_freedom_spec.creative_features_spec);
  assert.ok(!keys.some((key) => key.startsWith("standard_enhancements")), "fără standard_enhancements (refuzat din v22)");
}
ok("fără standard_enhancements (Meta îl refuză din v22)");
assert.equal(ads[0].conversion_domain, "meridianx.ro");
ok("conversion_domain pe reclamele cu pixel: meridianx.ro");
assert.equal(adset.dsa_beneficiary, "MERIDIAN");
assert.equal(adset.dsa_payor, "MERIDIAN");
ok("DSA: beneficiarul și plătitorul pe set");
assert.equal(creatives[0].creative.object_story_spec.video_data.image_hash, "abc123");
assert.equal(creatives[0].creative.object_story_spec.instagram_user_id, "000000000000005");
ok("coperta ca image_hash, Instagram ca instagram_user_id");
assert.equal(adset.targeting.targeting_automation.advantage_audience, 0);
ok("Advantage+ audience: 0 (trimis explicit)");

// ---------------------------------------------------------------------------
// 4. Statusul de pornire nu e scris nicăieri în lib/ads
// ---------------------------------------------------------------------------

console.log("Codul:");
const forbidden = ["AC", "TIVE"].join("");
const pattern = new RegExp(`["'\`]${forbidden}["'\`]`);
const offenders = [];
const PORTAL_DIRS = [ADS, path.join(ROOT, "components/ads"), path.join(ROOT, "app/(admin)/admin/ads")];
function scan(directory) {
  for (const name of readdirSync(directory)) {
    const full = path.join(directory, name);
    if (statSync(full).isDirectory()) scan(full);
    else if (/\.(ts|tsx|mjs)$/.test(name) && pattern.test(readFileSync(full, "utf8"))) offenders.push(full);
  }
}
PORTAL_DIRS.forEach(scan);
assert.deepEqual(offenders, [], `statusul de pornire apare în: ${offenders.join(", ")}`);
ok("statusul de pornire nu apare ca text în lib/ads, components/ads, app/(admin)/admin/ads");

// ---------------------------------------------------------------------------
// 5. O singură cale de scriere spre Meta
// ---------------------------------------------------------------------------

const graph = readFileSync(path.join(ADS, "meta/graph.ts"), "utf8");
// Apelurile de rețea cu POST: `request<…>(workspace, "POST", …)`.
const posts = graph.match(/\(workspace, "POST",/g) ?? [];
assert.equal(posts.length, 1, "un singur apel POST în graph.ts");
assert.ok(/assertPaused\(edge, payload\);[\s\S]*\(workspace, "POST",/.test(graph), "assertPaused înainte de POST");
assert.ok(!/"DELETE"|method: "PUT"/.test(graph), "fără DELETE/PUT");
ok("graph.ts: un singur POST, după assertPaused; fără DELETE/PUT");

console.log(`\n${checks} verificări, toate trecute.`);
