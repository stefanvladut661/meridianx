// Verificarea regulii care nu se negociază: portalul creează DOAR pe pauză
// (Meta: `status: PAUSED`; TikTok: `operation_status: DISABLE`).
//
//   node lib/ads/meta/verify-paused.mjs
//
// Fără dependențe: Node 24 citește direct fișierele .ts (tipurile se șterg),
// iar cârligul de mai jos rezolvă importurile fără extensie și aliasul `@/`.
// Nu vorbește cu Meta sau TikTok și nu citește niciun token.
//
// Ce verifică:
//   1. fiecare corp construit de `meta/build.ts` (campanie, set, creative,
//      reclame) trece de `assertPaused`, iar campania, setul și reclamele au PAUSED;
//   2. garda refuză: status lipsă, alt status, status ascuns într-un JSON
//      serializat, o muchie care nu e de creare;
//   3. îmbunătățirile automate Meta pleacă explicit OPT_OUT;
//   4. statusul de pornire Meta nu apare scris nicăieri în codul portalului;
//   5. `graph.ts` nu are altă cale de scriere decât `metaCreate`;
//   6–9. la fel pe TikTok: corpurile din `tiktok/build.ts` au DISABLE și trec
//      de `assertTikTokDisabled`, garda refuză statusul de pornire și căile de
//      actualizare, automatizările pleacă oprite, planurile pe care TikTok le-ar
//      refuza sunt prinse la validare, statusul de pornire TikTok nu apare în
//      cod, iar `tiktok/api.ts` are un singur POST, după gardă.
//   10. Google (Demand Gen): operațiile din exemplu trec de `assertGooglePaused`,
//      garda refuză pornirea, actualizarea, ștergerea; `google/api.ts` are o
//      singură cerere de mutate, chemată doar după gardă.
//   11. Căutarea (faza 8): exemplul e valid, validarea prinde ce ar refuza
//      Google (conflictele negativelor, limitele, plafonul pe suma bugetelor),
//      construcția are totul PAUSED, criteriile fără status, id-urile în ordine.
//   12. Garda nouă (faza 9): planul de căutare trece; pe resurse existente doar
//      negative (campanii) și liste de negative verificate; conversiile fără
//      status; pauza doar cu `status: PAUSED`, `updateMask: "status"`, pe campanii
//      și grupuri existente — orice altceva refuzat.
//   13–14. Contul existent și termenii (fazele 11–12): negativele construite
//      (pe campanii, în liste, din termenii bifați) trec de gardă.
//   15. Conversiile (faza 13): acțiunile standard trec de gardă fără status,
//      cu regulile Google pe tip; garda refuză alt tip, alte câmpuri, status,
//      ștergerea; formularul prinde ce ar refuza Google; fișierul GTM are
//      forma exportului (Conversion Linker pe toate paginile, conversiile cu
//      id-ul și eticheta, declanșatoarele cerute).
//   16. „Pentru Claude” (faza 14): instrucțiunile au formatul de căutare, cu
//      limitele din aceleași constante și exemplul întreg, fără id-uri reale;
//      Keyword Planner e o citire — `googleReadPost` nu lasă nicio cale de mutate.

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
const creatives = build.buildCreatives(plan, { videos: [{ videoId: "2", thumbnail: { hash: "abc123" } }] });
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
const rotatingCreatives = build.buildCreatives(rotating, { videos: [{ videoId: "2", thumbnail: { hash: "abc123" } }] });
assert.equal(rotatingCreatives.length, 1);
for (const item of rotatingCreatives) assertPaused("adcreatives", item.creative);
ok("varianta cu alternare: o singură reclamă, trece de gardă");

// Producția în masă: 3 video-uri × 2 texte = 6 reclame, fiecare cu video-ul și coperta ei.
const many = structuredClone(plan);
const threeVideos = ["21", "22", "23"].map((videoId, index) => ({ videoId, thumbnail: { hash: `h${index}` } }));
const manyCreatives = build.buildCreatives(many, { videos: threeVideos });
assert.equal(manyCreatives.length, threeVideos.length * plan.creative.primary_texts.length);
manyCreatives.forEach((item, index) => {
  const videoData = item.creative.object_story_spec.video_data;
  const expected = threeVideos[Math.floor(index / plan.creative.primary_texts.length)];
  assert.equal(videoData.video_id, expected.videoId);
  assert.equal(videoData.image_hash, expected.thumbnail.hash);
  assertPaused("adcreatives", item.creative);
});
assert.equal(new Set(manyCreatives.map((item) => item.name)).size, manyCreatives.length, "nume unice pe reclame");
ok(`mai multe video-uri: ${manyCreatives.length} reclame (video × text), fiecare cu video-ul și coperta ei`);
const manyRotating = build.buildCreatives({ ...many, creative: { ...many.creative, variants: "platform_rotates" } }, { videos: threeVideos });
assert.equal(manyRotating.length, 1);
assert.equal(manyRotating[0].creative.asset_feed_spec.videos.length, threeVideos.length);
ok("mai multe video-uri cu alternare: o reclamă cu toate video-urile în asset_feed_spec");

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
assertPaused("advideos", { file_url: "https://example.invalid/v.mp4", name: "testimonial" });
ok("video nou (advideos) trece: n-are status");
refuses("video nou cu status ascuns", "advideos", { file_url: "https://example.invalid/v.mp4", status: other });

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

// ---------------------------------------------------------------------------
// 6. TikTok: corpurile construite, toate DISABLE
// ---------------------------------------------------------------------------

const {
  assertTikTokDisabled,
  TIKTOK_DISABLED,
} = await load("meta/paused.ts");
const tiktokBuild = await load("tiktok/build.ts");

// Un plan TikTok cu date evident false.
const FAKE_ADVERTISER = "7000000000000000001";
const tiktokInput = {
  workspace: "tiktok-meridian",
  ad_account: FAKE_ADVERTISER,
  campaign: { name: "Test TikTok · lead-uri", objective: "leads", daily_budget: 50, currency: "RON" },
  audience: {
    locations: [{ type: "country", code: "RO" }],
    age_min: 25,
    age_max: 54,
    languages: ["ro"],
    interests: [{ name: "Real Estate", id: "10000" }],
  },
  conversion: { pixel_id: "DAN9FTJC77U07P78RH10", event: "lead" },
  destination: {
    type: "website",
    url: "https://www.meridianx.ro/video/contact",
    utm: { source: "tiktok", medium: "paid", campaign: "test" },
  },
  creative: {
    video: { source: "library", video_id: "v10033g50000fake00001" },
    primary_texts: ["Primul text de test.", "Al doilea text de test."],
    cta: "download",
  },
  tiktok: { identity_type: "TT_USER", identity_id: "7100000000000000009" },
};
const tiktokValidation = validatePlan(tiktokInput, { currentWorkspace: "tiktok-meridian" });
assert.ok(tiktokValidation.ok, `planul TikTok de test e valid: ${JSON.stringify(tiktokValidation.errors ?? [])}`);
const tiktokPlan = tiktokValidation.plan;

const tCampaign = tiktokBuild.buildCampaign(tiktokPlan, FAKE_ADVERTISER);
const tGroup = tiktokBuild.buildAdGroup(tiktokPlan, FAKE_ADVERTISER, {
  campaignId: "1",
  locationIds: ["798549"],
  languageCodes: ["ro"],
  interestIds: ["10000"],
  pixelId: "7200000000000000003",
  startTime: tiktokBuild.tiktokStartTime(new Date("2026-09-25T10:00:00Z")),
});
const tAds = tiktokBuild.buildAds(tiktokPlan, FAKE_ADVERTISER, {
  adGroupId: "2",
  videos: [{ videoId: "v10033g50000fake00001", coverImageId: "ad-site-i18n-sg/fake-cover" }],
  pixelId: "7200000000000000003",
});
const tManyAds = tiktokBuild.buildAds(tiktokPlan, FAKE_ADVERTISER, {
  adGroupId: "2",
  videos: [
    { videoId: "v10033g50000fake00001", coverImageId: "cover-1" },
    { videoId: "v10033g50000fake00002", coverImageId: "cover-2" },
  ],
  pixelId: "7200000000000000003",
});

const { examplePlanFor } = await load("example-plan.ts");
for (const workspace of [
  { id: "meta-meridian", platform: "meta" },
  { id: "meta-clienti", platform: "meta" },
  { id: "tiktok-meridian", platform: "tiktok" },
  { id: "tiktok-clienti", platform: "tiktok" },
]) {
  const example = parsePlanText(examplePlanFor(workspace));
  assert.ok(example.ok, `exemplul pentru ${workspace.id} se citește`);
  const result = validatePlan(example.value, { currentWorkspace: workspace.id });
  assert.ok(result.ok, `exemplul pentru ${workspace.id} e valid: ${JSON.stringify(result.errors ?? [])}`);
}
ok("„Încarcă exemplul” dă un plan valid în fiecare dintre cele patru spații");

console.log("TikTok — corpurile construite:");
assert.equal(tCampaign.operation_status, TIKTOK_DISABLED);
assertTikTokDisabled("/campaign/create/", tCampaign);
ok("campania: operation_status DISABLE, trece de gardă");
assert.equal(tGroup.operation_status, TIKTOK_DISABLED);
assertTikTokDisabled("/adgroup/create/", tGroup);
ok("grupul de reclame: DISABLE, trece de gardă");
assert.equal(tAds.operation_status, TIKTOK_DISABLED);
assert.equal(tAds.creatives.length, 2);
assertTikTokDisabled("/ad/create/", tAds);
ok(`reclamele (${tAds.creatives.length}, într-o cerere): DISABLE, trec de gardă`);
assert.equal(tManyAds.creatives.length, 2 * tiktokPlan.creative.primary_texts.length);
assert.deepEqual(
  tManyAds.creatives.map((creative) => creative.video_id),
  ["v10033g50000fake00001", "v10033g50000fake00001", "v10033g50000fake00002", "v10033g50000fake00002"]
);
assert.deepEqual(tManyAds.creatives.map((creative) => creative.image_ids[0]), ["cover-1", "cover-1", "cover-2", "cover-2"]);
assertTikTokDisabled("/ad/create/", tManyAds);
ok(`mai multe video-uri pe TikTok: ${tManyAds.creatives.length} reclame (video × text), fiecare cu coperta video-ului ei`);
assertTikTokDisabled("/file/image/ad/upload/", { advertiser_id: FAKE_ADVERTISER, upload_type: "UPLOAD_BY_URL", image_url: "https://example.invalid/c.jpg" });
assertTikTokDisabled("/file/video/ad/upload/", { advertiser_id: FAKE_ADVERTISER, upload_type: "UPLOAD_BY_URL", video_url: "https://example.invalid/v.mp4" });
ok("coperta și video-ul nou trec: n-au status");

// ---------------------------------------------------------------------------
// 7. TikTok: garda refuză
// ---------------------------------------------------------------------------

console.log("TikTok — garda refuză:");
const started = ["EN", "ABLE"].join(""); // statusul de pornire pe TikTok
const refusesTikTok = (label, where, payload) => {
  assert.throws(() => assertTikTokDisabled(where, payload), NotPausedError, label);
  ok(label);
};
refusesTikTok("campanie fără operation_status", "/campaign/create/", { ...tCampaign, operation_status: undefined });
refusesTikTok("campanie pornită", "/campaign/create/", { ...tCampaign, operation_status: started });
refusesTikTok("grup pornit", "/adgroup/create/", { ...tGroup, operation_status: started });
refusesTikTok("reclame fără operation_status", "/ad/create/", { ...tAds, operation_status: undefined });
refusesTikTok("status de pornire ascuns într-o reclamă", "/ad/create/", {
  ...tAds,
  creatives: [{ ...tAds.creatives[0], operation_status: started }],
});
refusesTikTok("status ascuns într-un JSON serializat", "/adgroup/create/", { ...tGroup, extra: JSON.stringify({ opt_status: started }) });
refusesTikTok("calea de schimbare a statusului", "/campaign/status/update/", { advertiser_id: FAKE_ADVERTISER, operation_status: TIKTOK_DISABLED });
refusesTikTok("calea de actualizare a campaniei", "/campaign/update/", { advertiser_id: FAKE_ADVERTISER, operation_status: TIKTOK_DISABLED });

// ---------------------------------------------------------------------------
// 8. TikTok: automatizările trimise explicit oprite
// ---------------------------------------------------------------------------

console.log("TikTok — automatizările:");
assert.equal(tGroup.search_result_enabled, false);
assert.equal(tGroup.smart_audience_enabled, false);
assert.equal(tGroup.smart_interest_behavior_enabled, false);
assert.equal(tGroup.creative_material_mode, "CUSTOM");
assert.equal(tGroup.deep_funnel_optimization_status, "OFF");
ok("grupul: fără căutare, fără public „smart”, material CUSTOM, fără deep funnel");
for (const creative of tAds.creatives) {
  assert.deepEqual(creative.creative_auto_enhancement_strategy_list, []);
  assert.equal(creative.dynamic_destination, "UNSET");
  assert.deepEqual(creative.tracking_offline_event_set_ids, []);
  assert.equal(creative.promotional_music_disabled, true);
  assert.equal(creative.creative_authorized, false);
  assert.equal(creative.dark_post_status, "ON");
}
ok("reclamele: fără îmbunătățiri automate, destinație fixă, fără muzică promoțională, doar ca reclamă");
assert.deepEqual(tGroup.placements, ["PLACEMENT_TIKTOK"]);
assert.deepEqual(tGroup.age_groups, ["AGE_25_34", "AGE_35_44", "AGE_45_54"]);
assert.equal(tGroup.optimization_goal, "CONVERT");
assert.equal(tGroup.optimization_event, "FORM");
assert.equal(tGroup.billing_event, "OCPM");
assert.equal(tGroup.budget_mode, "BUDGET_MODE_DAY");
assert.equal(tCampaign.budget_mode, "BUDGET_MODE_INFINITE");
assert.equal(tGroup.schedule_start_time, "2026-09-25 10:00:00");
ok("grupul: doar TikTok, 25–54 pe grupe, lead = FORM pe OCPM, bugetul pe grup, startul în UTC");
assert.equal(tAds.creatives[0].call_to_action, "DOWNLOAD_NOW");
assert.equal(tAds.creatives[0].identity_type, "TT_USER");
assert.equal(tAds.creatives[0].tracking_pixel_id, 7200000000000000003n);
assert.ok(tAds.creatives[0].landing_page_url.includes("utm_source=tiktok"));
assert.deepEqual(tAds.creatives[0].image_ids, ["ad-site-i18n-sg/fake-cover"]);
ok("reclama: DOWNLOAD_NOW, identitate Spark, pixelul grupului, UTM în link, o copertă");

// Planurile pe care TikTok le-ar refuza, prinse înainte.
const tiktokRefused = (label, change, pathExpected) => {
  const input = structuredClone(tiktokInput);
  change(input);
  const result = validatePlan(input, { currentWorkspace: "tiktok-meridian" });
  assert.ok(!result.ok && result.errors.some((error) => error.path === pathExpected), label);
  ok(label);
};
tiktokRefused("identitatea personalizată (CUSTOMIZED_USER)", (input) => (input.tiktok.identity_type = "CUSTOMIZED_USER"), "tiktok.identity_type");
tiktokRefused("BC_AUTH_TT fără identity_bc_id", (input) => (input.tiktok.identity_type = "BC_AUTH_TT"), "tiktok.identity_bc_id");
tiktokRefused("buget sub minimul TikTok (20)", (input) => (input.campaign.daily_budget = 15), "campaign.daily_budget");
tiktokRefused("comportamente (TikTok le targetează altfel)", (input) => (input.audience.behaviors = [{ name: "Frequent travelers" }]), "audience.behaviors");
tiktokRefused("Translate and dub (doar Smart+)", (input) => (input.tiktok.enhancements = { translate_and_dub: true }), "tiktok.enhancements.translate_and_dub");

// Producția în masă: regulile listei de video-uri, pe planul Meta din exemplu.
console.log("Producția în masă — validarea:");
const metaInput = parsePlanText(EXAMPLE_PLAN).value;
const massRefused = (label, change, pathExpected) => {
  const input = structuredClone(metaInput);
  change(input);
  const result = validatePlan(input, { currentWorkspace: "meta-meridian" });
  assert.ok(!result.ok && result.errors.some((error) => error.path === pathExpected), `${label}: ${JSON.stringify(result.errors)}`);
  ok(label);
};
const libraryVideo = (id) => ({ source: "library", video_id: id });
massRefused("și „video”, și „videos”", (input) => (input.creative.videos = [libraryVideo("111111"), libraryVideo("222222")]), "creative.videos");
massRefused(
  "niciun video",
  (input) => {
    delete input.creative.video;
  },
  "creative.video"
);
massRefused(
  "același video de două ori",
  (input) => {
    delete input.creative.video;
    input.creative.videos = [libraryVideo("111111"), libraryVideo("111111")];
  },
  "creative.videos"
);
massRefused(
  "peste 20 de reclame (5 video × 5 texte)",
  (input) => {
    delete input.creative.video;
    input.creative.videos = ["111111", "222222", "333333", "444444", "555555"].map(libraryVideo);
    input.creative.primary_texts = ["a", "b", "c", "d", "e"];
  },
  "creative.videos"
);
massRefused(
  "copertă dintr-un URL cu mai multe video-uri",
  (input) => {
    delete input.creative.video;
    input.creative.videos = [libraryVideo("111111"), libraryVideo("222222")];
    input.creative.thumbnail = { url: "https://example.invalid/c.jpg" };
  },
  "creative.thumbnail"
);
massRefused(
  "id Meta care nu e numeric, în listă",
  (input) => {
    delete input.creative.video;
    input.creative.videos = [libraryVideo("111111"), libraryVideo("abc")];
  },
  "creative.videos.1.video_id"
);
{
  const input = structuredClone(metaInput);
  delete input.creative.video;
  input.creative.videos = [libraryVideo("111111"), libraryVideo("222222"), libraryVideo("333333")];
  const result = validatePlan(input, { currentWorkspace: "meta-meridian" });
  assert.ok(result.ok, JSON.stringify(result.errors));
  ok("3 video-uri × 2 texte: plan valid");
}

// ---------------------------------------------------------------------------
// 9. TikTok: codul
// ---------------------------------------------------------------------------

console.log("TikTok — codul:");
const startedPattern = new RegExp(`["'\`]${started}["'\`]`);
const startedOffenders = [];
function scanStarted(directory) {
  for (const name of readdirSync(directory)) {
    const full = path.join(directory, name);
    if (statSync(full).isDirectory()) scanStarted(full);
    else if (/\.(ts|tsx|mjs)$/.test(name) && startedPattern.test(readFileSync(full, "utf8"))) startedOffenders.push(full);
  }
}
PORTAL_DIRS.forEach(scanStarted);
assert.deepEqual(startedOffenders, [], `statusul de pornire TikTok apare în: ${startedOffenders.join(", ")}`);
ok("statusul de pornire TikTok nu apare ca text în codul portalului");

const api = readFileSync(path.join(ADS, "tiktok/api.ts"), "utf8");
const tiktokPosts = api.match(/\(workspace, "POST",/g) ?? [];
assert.equal(tiktokPosts.length, 1, "un singur apel POST în tiktok/api.ts");
assert.ok(/assertTikTokDisabled\(path, payload\);[\s\S]*\(workspace, "POST",/.test(api), "assertTikTokDisabled înainte de POST");
ok("tiktok/api.ts: un singur POST, după assertTikTokDisabled");
const tiktokDir = path.join(ADS, "tiktok");
for (const name of readdirSync(tiktokDir)) {
  const source = readFileSync(path.join(tiktokDir, name), "utf8");
  assert.ok(!/["'`]\/[a-z_/]*\/(update|delete)\/["'`]/.test(source), `${name}: fără căi de actualizare/ștergere`);
}
ok("lib/ads/tiktok: nicio cale /update/ sau /delete/");

// ---------------------------------------------------------------------------
// 10. Google: corpurile construite din exemplu
// ---------------------------------------------------------------------------

const { assertGooglePaused, GOOGLE_PAUSED } = await load("meta/paused.ts");
const googleBuild = await load("google/build.ts");
const { EXAMPLE_PLAN_GOOGLE } = await load("example-plan.ts");
const FAKE_CUSTOMER = "1234567890";

console.log("Google — corpurile construite:");
const googleInput = parsePlanText(EXAMPLE_PLAN_GOOGLE).value;
const googleValidation = validatePlan(googleInput, { currentWorkspace: "google-meridian" });
assert.ok(googleValidation.ok, `exemplul Google e valid: ${JSON.stringify(googleValidation.errors)}`);
for (const workspace of ["google-meridian", "google-clienti"]) {
  const example = parsePlanText(examplePlanFor({ id: workspace, platform: "google" }));
  assert.ok(validatePlan(example.value, { currentWorkspace: workspace }).ok, `exemplul pentru ${workspace} e valid`);
}
ok("„Încarcă exemplul” dă un plan valid în ambele spații Google");

const googlePlan = structuredClone(googleValidation.plan);
googlePlan.audience.interests.forEach((item, index) => (item.id = `8043${index}`));
const built = googleBuild.buildGoogleOperations(googlePlan, {
  customerId: FAKE_CUSTOMER,
  geoTargets: ["geoTargetConstants/1011795", "geoTargetConstants/1011808"],
  languageConstants: ["languageConstants/1032"],
  interestIds: ["80432"],
  videos: [{ youtubeId: "aqz-KE-bpKQ", asset: null }],
  logo: { data: "aGVsbG8=", hash: "abc123def456" },
  uniqueSuffix: "test",
});
assertGooglePaused(FAKE_CUSTOMER, built.operations);
ok(`toate cele ${built.operations.length} operații trec de assertGooglePaused`);
const ofKind = (kind) => built.operations.filter((operation) => Object.keys(operation)[0] === kind).map((operation) => operation[kind].create);
const [gCampaign] = ofKind("campaignOperation");
const [gAdGroup] = ofKind("adGroupOperation");
const gAds = ofKind("adGroupAdOperation");
const gCriteria = ofKind("adGroupCriterionOperation");
const [gBudget] = ofKind("campaignBudgetOperation");
const [gAudience] = ofKind("audienceOperation");
assert.equal(gCampaign.status, GOOGLE_PAUSED);
assert.equal(gAdGroup.status, GOOGLE_PAUSED);
assert.ok(gAds.length > 0 && gAds.every((ad) => ad.status === GOOGLE_PAUSED));
ok("campania, grupul și reclamele: PAUSED");
assert.ok(gCriteria.length > 0 && gCriteria.every((criterion) => criterion.status === undefined));
ok(`criteriile (${gCriteria.length}): fără status — active, publicul rămâne cel din plan`);
assert.equal(gCampaign.advertisingChannelType, "DEMAND_GEN");
assert.equal(gCampaign.containsEuPoliticalAdvertising, "DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING");
assert.deepEqual(gCampaign.maximizeConversions, {});
assert.equal(gBudget.explicitlyShared, false);
assert.equal(gBudget.amountMicros, "60000000");
ok("Demand Gen, declarația UE, Maximize conversions, buget propriu de 60.000.000 micro");
assert.equal(gAdGroup.optimizedTargetingEnabled, false);
assert.equal(gAdGroup.audienceSetting.useAudienceGrouped, true);
assert.deepEqual(gAdGroup.demandGenAdGroupSettings.channelControls.selectedChannels, {
  youtubeInStream: true,
  youtubeInFeed: true,
  youtubeShorts: true,
  discover: false,
  gmail: false,
  display: false,
  maps: false,
});
ok("grupul: fără lărgirea publicului, doar canalele YouTube din plan");
assert.ok(gAudience, "publicul există");
assert.deepEqual(gAudience.dimensions.find((dimension) => dimension.age).age, { ageRanges: [{ minAge: 25, maxAge: 64 }], includeUndetermined: false });
assert.ok(gAudience.dimensions.some((dimension) => dimension.audienceSegments?.segments[0].userInterest.userInterestCategory === `customers/${FAKE_CUSTOMER}/userInterests/80432`));
ok("publicul: interesul și vârsta 25–64 (fără vârstă necunoscută)");
for (const ad of gAds) {
  const types = ad.adGroupAdAssetAutomationSettings.map((setting) => `${setting.assetAutomationType}:${setting.assetAutomationStatus}`);
  assert.deepEqual(types.sort(), [
    "GENERATE_LANDING_PAGE_PREVIEW:OPTED_OUT",
    "GENERATE_LANDING_PAGE_TEXT:OPTED_OUT",
    "GENERATE_SHORTER_YOUTUBE_VIDEOS:OPTED_OUT",
    "GENERATE_VERTICAL_YOUTUBE_VIDEOS:OPTED_OUT",
  ]);
  const info = ad.ad.demandGenVideoResponsiveAd;
  assert.ok(info.videos.length >= 1 && info.logoImages.length === 1 && info.businessName.text === "MERIDIAN");
  assert.ok(ad.ad.finalUrlSuffix.includes("utm_source=google"));
}
ok("reclamele: automatizările video și de text oprite, siglă, nume, UTM în finalUrlSuffix");

console.log("Google — garda refuză:");
const refusesGoogle = (label, operations) => {
  assert.throws(() => assertGooglePaused(FAKE_CUSTOMER, operations), NotPausedError, label);
  ok(label);
};
const replace = (kind, change) =>
  built.operations.map((operation) => {
    if (Object.keys(operation)[0] !== kind) return operation;
    return { [kind]: { create: change(structuredClone(operation[kind].create)) } };
  });
const googleStarted = ["EN", "ABLED"].join("");
refusesGoogle("campanie fără status", replace("campaignOperation", (campaign) => ({ ...campaign, status: undefined })));
refusesGoogle("campanie pornită", replace("campaignOperation", (campaign) => ({ ...campaign, status: googleStarted })));
refusesGoogle("grup pornit", replace("adGroupOperation", (group) => ({ ...group, status: googleStarted })));
refusesGoogle("reclamă pornită", replace("adGroupAdOperation", (ad) => ({ ...ad, status: googleStarted })));
refusesGoogle("criteriu cu status (ar lărgi publicul)", replace("adGroupCriterionOperation", (criterion) => ({ ...criterion, status: GOOGLE_PAUSED })));
refusesGoogle("o operație de actualizare", [...built.operations, { campaignOperation: { update: { resourceName: `customers/${FAKE_CUSTOMER}/campaigns/1`, status: GOOGLE_PAUSED } } }]);
refusesGoogle("o operație de ștergere", [...built.operations, { adGroupAdOperation: { remove: `customers/${FAKE_CUSTOMER}/adGroupAds/1~2` } }]);
refusesGoogle("un tip de operație necunoscut", [...built.operations, { campaignConversionGoalOperation: { create: {} } }]);
refusesGoogle("o resursă din alt cont", replace("campaignOperation", (campaign) => ({ ...campaign, resourceName: "customers/9999999999/campaigns/-2" })));

console.log("Google — planurile pe care Google le-ar refuza, prinse înainte:");
const googleRefused = (label, change, pathExpected) => {
  const input = structuredClone(googleInput);
  change(input);
  const result = validatePlan(input, { currentWorkspace: "google-meridian" });
  assert.ok(!result.ok && result.errors.some((error) => error.path === pathExpected), `${label}: ${JSON.stringify(result.errors)}`);
  ok(label);
};
googleRefused("obiectivul vizualizări video (campaniile Video nu se creează din API)", (input) => (input.campaign.objective = "video_views"), "campaign.objective");
googleRefused("conversia scrisă ca etichetă, nu ca id", (input) => (input.conversion.pixel_id = "AW-123/abc"), "conversion.pixel_id");
googleRefused("titlu lung peste 90 de caractere", (input) => (input.creative.primary_texts = ["x".repeat(91)]), "creative.primary_texts.0");
googleRefused("titlu peste 40 de caractere", (input) => (input.creative.headlines = ["x".repeat(41)]), "creative.headlines.0");
googleRefused("fără descriere", (input) => (input.creative.descriptions = []), "creative.descriptions");
googleRefused("link YouTube în loc de id", (input) => (input.creative.videos = [{ source: "library", video_id: "https://youtu.be/aqz-KE-bpKQ" }]), "creative.videos.0.video_id");
googleRefused("comportamente (nu există pe Google)", (input) => (input.audience.behaviors = [{ name: "Small business owners" }]), "audience.behaviors");
googleRefused("contul cu alt număr de cifre", (input) => (input.ad_account = "12345"), "ad_account");
googleRefused(
  "secțiunea google lipsă",
  (input) => {
    delete input.google;
  },
  "google"
);

console.log("Google — codul:");
const googleApi = readFileSync(path.join(ADS, "google/api.ts"), "utf8");
// Căile reale de cerere sunt șabloane `…/googleAds:mutate` + backtick; comentariile nu contează.
assert.equal((googleApi.match(/\/googleAds:mutate`/g) ?? []).length, 1, "o singură cerere de mutate");
assert.ok(/async function sendMutate\([\s\S]*?\/googleAds:mutate`/.test(googleApi), "cererea de mutate stă în sendMutate");
assert.ok(!/export\s+(async\s+)?function\s+sendMutate/.test(googleApi), "sendMutate nu se exportă");
assert.equal((googleApi.match(/\bsendMutate\(/g) ?? []).length, 3, "sendMutate: definiția + exact două apeluri");
const mutateBody = /export async function googleMutate\([\s\S]*?\r?\n}\r?\n/.exec(googleApi)?.[0] ?? "";
const pauseBody = /export async function googlePause\([\s\S]*?\r?\n}\r?\n/.exec(googleApi)?.[0] ?? "";
assert.ok(/assertGooglePaused\(customer, operations[^)]*\);[\s\S]*return sendMutate\(/.test(mutateBody), "googleMutate: garda creării, apoi cererea");
assert.ok(/assertGooglePauseOnly\(customer, operations\);[\s\S]*return sendMutate\(/.test(pauseBody), "googlePause: garda pauzei, apoi cererea");
assert.ok(!/partialFailure: true/.test(googleApi), "fără partialFailure");
ok("google/api.ts: o singură cerere de mutate, atomică, chemată doar de googleMutate (după garda creării) și googlePause (după garda pauzei)");
const googleStatusWrite = new RegExp(`status["']?\\s*:\\s*["'\`]${googleStarted}["'\`]`);
const googleOffenders = [];
function scanGoogle(directory) {
  for (const name of readdirSync(directory)) {
    const full = path.join(directory, name);
    if (statSync(full).isDirectory()) scanGoogle(full);
    else if (/\.(ts|tsx|mjs)$/.test(name) && googleStatusWrite.test(readFileSync(full, "utf8"))) googleOffenders.push(full);
  }
}
PORTAL_DIRS.forEach(scanGoogle);
assert.deepEqual(googleOffenders, [], `statusul de pornire Google apare scris în: ${googleOffenders.join(", ")}`);
ok("statusul de pornire Google nu apare scris în codul portalului");

// ---------------------------------------------------------------------------
// 11. Căutare — formatul, validarea, construcția (faza 8)
// ---------------------------------------------------------------------------

const { EXAMPLE_SEARCH_PLAN } = await load("google/search/example.ts");
const { validateSearchPlan } = await load("google/search/validate.ts");
const { buildSearchOperations, countSearchOperations } = await load("google/search/build.ts");
const { parseSearchPlanText, planFormatOf } = await load("plan-json.ts");
const { findConflicts } = await load("google/search/negatives.ts");

console.log("Căutare — formatul:");
const searchInput = parseSearchPlanText(EXAMPLE_SEARCH_PLAN).value;
assert.equal(planFormatOf(searchInput), "search");
for (const workspace of ["google-meridian", "google-clienti"]) {
  const example = { ...structuredClone(searchInput), workspace };
  const result = validateSearchPlan(example, { currentWorkspace: workspace });
  assert.ok(result.ok, `exemplul de căutare e valid în ${workspace}: ${JSON.stringify(result.errors)}`);
}
ok("exemplul de căutare e valid în ambele spații Google");
assert.equal(parsePlanText(EXAMPLE_SEARCH_PLAN).fix, "search");
assert.equal(parseSearchPlanText(EXAMPLE_PLAN).fix, "video");
ok("„Plan nou” trimite planul de căutare pe pagina lui, și invers");
assert.ok(!validateSearchPlan({ ...structuredClone(searchInput), workspace: "meta-meridian" }, { currentWorkspace: "meta-meridian" }).ok);
ok("planul de căutare e refuzat într-un spațiu Meta");
assert.ok(/example\.com/.test(EXAMPLE_SEARCH_PLAN) && /"ad_account": "000-000-0000"/.test(EXAMPLE_SEARCH_PLAN) && /"0700 000 000"/.test(EXAMPLE_SEARCH_PLAN));
ok("exemplul: firmă inventată, domeniul example.com, cont și telefon din zerouri");

const searchRefused = (label, change, pathExpected) => {
  const input = structuredClone(searchInput);
  change(input);
  const result = validateSearchPlan(input, { currentWorkspace: "google-clienti" });
  assert.ok(!result.ok && result.errors.some((error) => error.path === pathExpected), `${label}: ${JSON.stringify(result.errors.slice(0, 3))}`);
  ok(label);
};
searchRefused(
  "un cuvânt cheie blocat de o listă comună legată",
  (input) => input.shared_negative_lists[0].keywords.push({ text: "revizie", match: "broad" }),
  "campaigns.0.ad_groups.1.keywords.0"
);
searchRefused(
  "un cuvânt cheie blocat de negativul de frază al campaniei",
  (input) => input.campaigns[0].negatives.push({ text: "centrala termica", match: "phrase" }),
  "campaigns.0.ad_groups.0.keywords.0"
);
searchRefused(
  "suma bugetelor peste plafonul spațiului (nu fiecare campanie)",
  (input) => {
    input.campaigns[0].daily_budget = 1500;
    input.campaigns[1].daily_budget = 1500;
  },
  "campaigns"
);
searchRefused(
  "titlu peste 30 de caractere",
  (input) => (input.campaigns[0].ad_groups[0].ads[0].headlines[1].text = "x".repeat(31)),
  "campaigns.0.ad_groups.0.ads.0.headlines.1.text"
);
searchRefused(
  "titluri duplicate",
  (input) => (input.campaigns[0].ad_groups[0].ads[0].headlines[2].text = input.campaigns[0].ad_groups[0].ads[0].headlines[1].text),
  "campaigns.0.ad_groups.0.ads.0.headlines.2.text"
);
searchRefused("o singură descriere", (input) => (input.campaigns[1].ad_groups[0].ads[0].descriptions = ["Doar una."]), "campaigns.1.ad_groups.0.ads.0.descriptions");
searchRefused("calea 2 fără calea 1", (input) => delete input.campaigns[0].ad_groups[0].ads[0].path1, "campaigns.0.ad_groups.0.ads.0.path2");
searchRefused(
  "cuvânt cheie cu 11 cuvinte",
  (input) => (input.campaigns[0].ad_groups[0].keywords[0].text = "a b c d e f g h i j k"),
  "campaigns.0.ad_groups.0.keywords.0.text"
);
searchRefused("steluța într-un cuvânt pozitiv", (input) => (input.campaigns[0].ad_groups[0].keywords[0].text = "montaj*"), "campaigns.0.ad_groups.0.keywords.0.text");
{
  const input = structuredClone(searchInput);
  input.campaigns[0].negatives.push({ text: "piese*", match: "broad" });
  assert.ok(validateSearchPlan(input, { currentWorkspace: "google-clienti" }).ok);
  ok("steluța e permisă într-un negativ");
}
searchRefused(
  "program suprapus în aceeași zi",
  (input) => input.campaigns[0].schedule.push({ days: ["mon"], from: "18:00", to: "21:00" }),
  "campaigns.0.schedule.2"
);
searchRefused("minute în afara pașilor de 15", (input) => (input.campaigns[0].schedule[0].from = "08:10"), "campaigns.0.schedule.0.from");
searchRefused("o listă legată care nu există", (input) => (input.campaigns[1].negative_lists = ["irelevant"]), "campaigns.1.negative_lists.0");
searchRefused("două campanii cu același nume", (input) => (input.campaigns[1].name = input.campaigns[0].name), "campaigns.1.name");
searchRefused("plafon pe grup la „Maximizează clicurile”", (input) => (input.campaigns[0].ad_groups[0].max_cpc = 3), "campaigns.0.ad_groups.0.max_cpc");
searchRefused("telefon cu tarif special", (input) => (input.campaigns[0].assets.call.phone = "0900 000 000"), "campaigns.0.assets.call.phone");
searchRefused("fragment structurat cu 2 valori", (input) => (input.campaigns[0].assets.snippets[0].values = ["a", "b"]), "campaigns.0.assets.snippets.0.values");
searchRefused("rază pe o locație de căutare", (input) => (input.campaigns[1].locations[0].radius_km = 20), "campaigns.1.locations.0.radius_km");

assert.deepEqual(
  findConflicts([{ text: "pret montaj", match: "phrase", meta: 1 }], [{ text: "preț", match: "broad", meta: "n" }]),
  [],
  "negativele nu se extind la diacritice"
);
assert.equal(findConflicts([{ text: "montaj centrala termica", match: "phrase", meta: 1 }], [{ text: "termica montaj", match: "phrase", meta: "n" }]).length, 0);
assert.equal(findConflicts([{ text: "montaj centrala termica", match: "phrase", meta: 1 }], [{ text: "termica montaj", match: "broad", meta: "n" }]).length, 1);
assert.equal(findConflicts([{ text: "montaj centrala", match: "exact", meta: 1 }], [{ text: "montaj", match: "exact", meta: "n" }]).length, 0);
ok("potrivirea negativelor: amplă = toate cuvintele, frază = în ordine, exactă = identic, fără diacritice echivalente");

console.log("Căutare — construcția:");
const searchPlan = validateSearchPlan(searchInput, { currentWorkspace: "google-clienti" }).plan;
const searchBuilt = buildSearchOperations(searchPlan, {
  customerId: FAKE_CUSTOMER,
  campaigns: searchPlan.campaigns.map((campaign) => ({
    geoTargets: campaign.locations.map((_, index) => `geoTargetConstants/9000${index}`),
    excludedGeoTargets: campaign.excluded_locations.map((_, index) => `geoTargetConstants/9100${index}`),
    languageConstants: campaign.languages.map(() => "languageConstants/1032"),
  })),
  uniqueSuffix: "test",
});
assert.equal(searchBuilt.operations.length, countSearchOperations(searchPlan));
assert.equal(searchBuilt.operations.length, searchBuilt.roles.length);
ok(`${searchBuilt.operations.length} de operații, fiecare cu rolul ei; numărătoarea din previzualizare e aceeași`);
const searchOf = (kind) => searchBuilt.operations.filter((operation) => Object.keys(operation)[0] === kind).map((operation) => operation[kind].create);
for (const campaign of searchOf("campaignOperation")) {
  assert.equal(campaign.status, GOOGLE_PAUSED);
  assert.equal(campaign.advertisingChannelType, "SEARCH");
  assert.equal(campaign.containsEuPoliticalAdvertising, "DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING");
  assert.deepEqual(campaign.networkSettings, { targetGoogleSearch: true, targetSearchNetwork: false, targetContentNetwork: false, targetPartnerSearchNetwork: false });
  assert.equal(campaign.geoTargetTypeSetting.positiveGeoTargetType, "PRESENCE");
  assert.ok(campaign.targetSpend.cpcBidCeilingMicros);
}
for (const group of searchOf("adGroupOperation")) assert.equal(group.status, GOOGLE_PAUSED);
for (const ad of searchOf("adGroupAdOperation")) assert.equal(ad.status, GOOGLE_PAUSED);
ok("campaniile (SEARCH, doar căutarea Google, prezență, declarația UE), grupurile și anunțurile: PAUSED");
const statusless = ["campaignCriterionOperation", "adGroupCriterionOperation", "sharedSetOperation", "sharedCriterionOperation", "campaignSharedSetOperation", "assetOperation", "campaignAssetOperation", "campaignBudgetOperation"];
for (const kind of statusless) for (const created of searchOf(kind)) assert.equal(created.status, undefined, `${kind} fără status`);
ok("criteriile, listele, legăturile, materialele și bugetele: fără status");
for (const sharedSet of searchOf("sharedSetOperation")) assert.equal(sharedSet.type, "NEGATIVE_KEYWORDS");
ok("listele comune create: doar de negative");
const ordered = new Set();
searchBuilt.operations.forEach((operation) => {
  const created = Object.values(operation)[0].create;
  for (const [key, value] of Object.entries(created)) {
    if (key === "resourceName") continue;
    if (typeof value === "string" && /^customers\/\d+\/[a-zA-Z]+\/-\d+$/.test(value)) assert.ok(ordered.has(value), `${value} folosit înainte să fie creat`);
  }
  if (created.resourceName) ordered.add(created.resourceName);
});
ok("fiecare id temporar e creat înainte să fie folosit");
const snippetHeader = searchOf("assetOperation").find((asset) => asset.structuredSnippetAsset)?.structuredSnippetAsset.header;
assert.equal(snippetHeader, "Servicii");
ok("antetul fragmentului structurat, în limba campaniei (română: „Servicii”)");

// ---------------------------------------------------------------------------
// 12. Garda nouă (faza 9): pauza, negativele pe resurse existente, conversiile
// ---------------------------------------------------------------------------

const { assertGooglePauseOnly } = await load("meta/paused.ts");
const C = FAKE_CUSTOMER;
const existingCampaign = `customers/${C}/campaigns/111`;
const existingAdGroup = `customers/${C}/adGroups/222`;
const existingList = `customers/${C}/sharedSets/333`;
const keyword = { text: "angajari", matchType: "BROAD" };

console.log("Garda — planul de căutare:");
assertGooglePaused(C, searchBuilt.operations);
ok(`toate cele ${searchBuilt.operations.length} de operații ale planului de căutare trec de assertGooglePaused`);
const replaceSearch = (kind, change, which = 0) => {
  let seen = -1;
  return searchBuilt.operations.map((operation) => {
    if (Object.keys(operation)[0] !== kind) return operation;
    seen += 1;
    return seen === which ? { [kind]: { create: change(structuredClone(operation[kind].create)) } } : operation;
  });
};
refusesGoogle("căutare: campanie pornită", replaceSearch("campaignOperation", (item) => ({ ...item, status: googleStarted })));
refusesGoogle("căutare: grup pornit", replaceSearch("adGroupOperation", (item) => ({ ...item, status: googleStarted })));
refusesGoogle("căutare: anunț pornit", replaceSearch("adGroupAdOperation", (item) => ({ ...item, status: googleStarted })));
refusesGoogle("căutare: anunț fără status", replaceSearch("adGroupAdOperation", (item) => ({ ...item, status: undefined })));
refusesGoogle("căutare: status pe un cuvânt cheie", replaceSearch("adGroupCriterionOperation", (item) => ({ ...item, status: GOOGLE_PAUSED })));
refusesGoogle("căutare: status pe o locație a campaniei", replaceSearch("campaignCriterionOperation", (item) => ({ ...item, status: googleStarted })));
refusesGoogle("căutare: status pe legarea unui material", replaceSearch("campaignAssetOperation", (item) => ({ ...item, status: googleStarted })));
refusesGoogle("o listă comună de alt tip (BRANDS)", replaceSearch("sharedSetOperation", (item) => ({ ...item, type: "BRANDS" })));
refusesGoogle("o listă comună de alt tip (NEGATIVE_PLACEMENTS)", replaceSearch("sharedSetOperation", (item) => ({ ...item, type: "NEGATIVE_PLACEMENTS" })));

console.log("Garda — pe resurse existente:");
const accepts = (label, operations, context) => {
  assertGooglePaused(C, operations, context);
  ok(label);
};
accepts("negativ pe o campanie existentă: permis", [{ campaignCriterionOperation: { create: { campaign: existingCampaign, negative: true, keyword } } }]);
refusesGoogle("cuvânt cheie POZITIV pe o campanie existentă", [{ campaignCriterionOperation: { create: { campaign: existingCampaign, keyword } } }]);
refusesGoogle("negative: false pe o campanie existentă", [{ campaignCriterionOperation: { create: { campaign: existingCampaign, negative: false, keyword } } }]);
refusesGoogle("locație pe o campanie existentă (chiar negativă)", [{ campaignCriterionOperation: { create: { campaign: existingCampaign, negative: true, location: { geoTargetConstant: "geoTargetConstants/2642" } } } }]);
refusesGoogle("program pe o campanie existentă", [{ campaignCriterionOperation: { create: { campaign: existingCampaign, adSchedule: { dayOfWeek: "MONDAY", startHour: 0, startMinute: "ZERO", endHour: 24, endMinute: "ZERO" } } } }]);
refusesGoogle("negativ cu încă un criteriu ascuns", [{ campaignCriterionOperation: { create: { campaign: existingCampaign, negative: true, keyword, language: { languageConstant: "languageConstants/1032" } } } }]);
refusesGoogle("cuvânt cheie într-un grup existent (pozitiv)", [{ adGroupCriterionOperation: { create: { adGroup: existingAdGroup, keyword } } }]);
refusesGoogle("negativ într-un grup existent (nu e în listă)", [{ adGroupCriterionOperation: { create: { adGroup: existingAdGroup, negative: true, keyword } } }]);
refusesGoogle("anunț într-un grup existent", [{ adGroupAdOperation: { create: { adGroup: existingAdGroup, status: GOOGLE_PAUSED, ad: { finalUrls: ["https://example.com"] } } } }]);
refusesGoogle("grup nou într-o campanie existentă", [{ adGroupOperation: { create: { campaign: existingCampaign, name: "x", status: GOOGLE_PAUSED } } }]);
refusesGoogle("material legat de o campanie existentă", [
  { assetOperation: { create: { resourceName: `customers/${C}/assets/-1`, calloutAsset: { calloutText: "x" } } } },
  { campaignAssetOperation: { create: { campaign: existingCampaign, asset: `customers/${C}/assets/-1`, fieldType: "CALLOUT" } } },
]);
accepts(
  "listă de negative existentă (citită din cont) legată de o campanie existentă: permis",
  [{ campaignSharedSetOperation: { create: { campaign: existingCampaign, sharedSet: existingList } } }],
  { negativeSharedSets: [existingList] }
);
refusesGoogle("listă existentă necitită ca listă de negative, legată de o campanie", [{ campaignSharedSetOperation: { create: { campaign: existingCampaign, sharedSet: existingList } } }]);
accepts("cuvinte adăugate într-o listă de negative existentă: permis", [{ sharedCriterionOperation: { create: { sharedSet: existingList, keyword } } }], { negativeSharedSets: [existingList] });
refusesGoogle("cuvinte într-o listă existentă neverificată", [{ sharedCriterionOperation: { create: { sharedSet: existingList, keyword } } }]);
refusesGoogle("altceva decât un cuvânt într-o listă de negative", [{ sharedCriterionOperation: { create: { sharedSet: existingList, placement: { url: "example.com" } } } }]);
assert.throws(
  () => assertGooglePaused(C, [{ sharedCriterionOperation: { create: { sharedSet: existingList, keyword } } }], { negativeSharedSets: [`customers/9999999999/sharedSets/333`] }),
  NotPausedError
);
ok("o listă din alt cont nu ține loc de listă verificată");
refusesGoogle("listă de alt tip creată și legată în aceeași cerere", [
  { sharedSetOperation: { create: { resourceName: `customers/${C}/sharedSets/-1`, name: "x", type: "BRANDS" } } },
  { campaignSharedSetOperation: { create: { campaign: existingCampaign, sharedSet: `customers/${C}/sharedSets/-1` } } },
]);

console.log("Garda — acțiunile de conversie:");
const conversionAction = { name: "Apel din anunț", type: "AD_CALL", category: "PHONE_CALL_LEAD", countingType: "ONE_PER_CLICK", primaryForGoal: true, phoneCallDurationSeconds: "60", valueSettings: { alwaysUseDefaultValue: true } };
accepts("acțiune de conversie fără status: permisă", [{ conversionActionOperation: { create: conversionAction } }]);
refusesGoogle("acțiune de conversie cu status", [{ conversionActionOperation: { create: { ...conversionAction, status: googleStarted } } }]);
refusesGoogle("acțiune de conversie actualizată", [{ conversionActionOperation: { update: { resourceName: `customers/${C}/conversionActions/1`, primaryForGoal: false }, updateMask: "primary_for_goal" } }]);

console.log("Garda — nimic altceva:");
refusesGoogle("actualizare pe buget", [{ campaignBudgetOperation: { update: { resourceName: `customers/${C}/campaignBudgets/1`, amountMicros: "1000000000" }, updateMask: "amount_micros" } }]);
refusesGoogle("ștergere de campanie", [{ campaignOperation: { remove: existingCampaign } }]);
refusesGoogle("ștergere de criteriu", [{ campaignCriterionOperation: { remove: `customers/${C}/campaignCriteria/111~1` } }]);
refusesGoogle("pauza trimisă prin calea creării", [{ campaignOperation: { update: { resourceName: existingCampaign, status: GOOGLE_PAUSED }, updateMask: "status" } }]);

console.log("Garda pauzei:");
const pause = (resourceName, extra = {}) => ({ campaignOperation: { update: { resourceName, status: GOOGLE_PAUSED }, updateMask: "status", ...extra } });
assertGooglePauseOnly(C, [pause(existingCampaign), pause(`customers/${C}/campaigns/112`)]);
assertGooglePauseOnly(C, [{ adGroupOperation: { update: { resourceName: existingAdGroup, status: GOOGLE_PAUSED }, updateMask: "status" } }]);
ok("pauza pe campanii și pe grupuri existente: permisă");
const refusesPause = (label, operations) => {
  assert.throws(() => assertGooglePauseOnly(C, operations), NotPausedError, label);
  ok(label);
};
refusesPause("pauză cu ENABLED", [{ campaignOperation: { update: { resourceName: existingCampaign, status: googleStarted }, updateMask: "status" } }]);
refusesPause("pauză cu REMOVED", [{ campaignOperation: { update: { resourceName: existingCampaign, status: "REMOVED" }, updateMask: "status" } }]);
refusesPause("pauză cu alt câmp în mască", [{ campaignOperation: { update: { resourceName: existingCampaign, status: GOOGLE_PAUSED }, updateMask: "status,name" } }]);
refusesPause("pauză cu alt câmp în obiect", [{ campaignOperation: { update: { resourceName: existingCampaign, status: GOOGLE_PAUSED, name: "x" }, updateMask: "status" } }]);
refusesPause("pauză care schimbă bugetul", [{ campaignBudgetOperation: { update: { resourceName: `customers/${C}/campaignBudgets/1`, status: GOOGLE_PAUSED }, updateMask: "status" } }]);
refusesPause("pauză pe un anunț (altă resursă)", [{ adGroupAdOperation: { update: { resourceName: `customers/${C}/adGroupAds/1~2`, status: GOOGLE_PAUSED }, updateMask: "status" } }]);
refusesPause("pauză cu o creare amestecată", [pause(existingCampaign), { campaignOperation: { create: { name: "x", status: GOOGLE_PAUSED } } }]);
refusesPause("pauză cu o ștergere", [{ campaignOperation: { remove: existingCampaign } }]);
refusesPause("pauză pe o campanie din alt cont", [pause("customers/9999999999/campaigns/1")]);
refusesPause("pauză pe un id temporar", [pause(`customers/${C}/campaigns/-1`)]);
refusesPause("pauză pe o resursă de tip greșit", [pause(existingAdGroup)]);
refusesPause("pauză fără updateMask", [{ campaignOperation: { update: { resourceName: existingCampaign, status: GOOGLE_PAUSED } } }]);
refusesPause("pauză goală", []);

// ---------------------------------------------------------------------------
// 13. Contul existent (faza 11): negativele construite trec de gardă
// ---------------------------------------------------------------------------

const { planNegatives, parseNegativeInput, usableNegatives } = await load("google/account/negatives.ts");
console.log("Contul existent — negativele:");
const parsedNegatives = parseNegativeInput('angajari\n"locuri de munca"\n[pret]\nrau(caracter\n\npiese*');
assert.equal(parsedNegatives.length, 5);
assert.ok(parsedNegatives[3].problem && !parsedNegatives[4].problem);
assert.deepEqual(parsedNegatives.slice(0, 3).map((item) => item.match), ["broad", "phrase", "exact"]);
ok("lista lipită: amplă, „frază”, [exactă]; rândurile greșite marcate; steluța acceptată în negative");
const negativeKeywords = usableNegatives(parsedNegatives);
const target = (id, positives = []) => ({ id, name: `Campania ${id}`, existing: [{ text: "angajari", match: "broad" }], positives });
const onCampaigns = planNegatives({ customerId: C, mode: "campaigns", keywords: negativeKeywords, targets: [target("111"), target("112")], list: null });
assert.ok(onCampaigns.operations.every((operation) => operation.campaignCriterionOperation?.create.negative === true));
assertGooglePaused(C, onCampaigns.operations);
assert.equal(onCampaigns.operations.length, 2 * (negativeKeywords.length - 1));
ok(`negative pe campanii existente: ${onCampaigns.operations.length} operații, doar negative, cele deja existente sărite, trec de gardă`);
const negativeList = { resourceName: existingList, name: "NEG", keywords: [{ text: "gratis", match: "broad" }], linked: [target("111")] };
const intoList = planNegatives({ customerId: C, mode: "list", keywords: negativeKeywords, targets: [target("112")], list: negativeList });
assertGooglePaused(C, intoList.operations, { negativeSharedSets: [existingList] });
assert.throws(() => assertGooglePaused(C, intoList.operations), NotPausedError);
ok("cuvinte într-o listă existentă + legarea ei: trec doar cu lista citită ca listă de negative");
const blocked = planNegatives({
  customerId: C,
  mode: "campaigns",
  keywords: [{ text: "centrala termica", match: "phrase" }],
  targets: [target("111", [{ text: "montaj centrala termica", match: "broad", group: "Montaj" }, { text: "centrala", match: "exact", group: "Montaj" }])],
  list: null,
});
assert.equal(blocked.conflicts.length, 1);
assert.equal(blocked.conflicts[0].keyword, "montaj centrala termica");
ok("un negativ de frază care ar bloca un cuvânt activ e prins înainte");

// ---------------------------------------------------------------------------
// 14. Termenii de căutare (faza 12): propunerile și negativele bifate
// ---------------------------------------------------------------------------

const { buildProposals } = await load("google/terms/proposals.ts");
const { planTermNegatives } = await load("google/account/negatives.ts");
console.log("Termenii de căutare:");
const termRow = (term, extra = {}) => ({
  campaignId: "111",
  campaignName: "Centrale",
  adGroupId: "1",
  adGroupName: "Montaj",
  term,
  matchType: "BROAD",
  keyword: "centrala",
  impressions: 10,
  clicks: 2,
  cost: 3,
  conversions: 0,
  status: "NONE",
  firstSeen: null,
  lastSeen: null,
  ...extra,
});
const proposals = buildProposals({
  terms: [
    termRow("angajări instalator centrale"),
    termRow("centrala second hand", { cost: 40 }),
    termRow("montaj aer conditionat"),
    termRow("centrala gratuit", { status: "EXCLUDED", cost: 90 }),
    termRow("montaj centrala pret", { cost: 50, conversions: 1 }),
  ],
  excludeWords: ["angajari", "montaj"],
  costThreshold: 20,
  positives: { 111: [{ text: "montaj centrala", match: "phrase" }], 222: [{ text: "aer conditionat", match: "broad" }] },
  campaignNames: { 111: "Centrale", 222: "Clima" },
});
const proposal = (text, match) => proposals.find((item) => item.text === text && item.match === match);
assert.ok(proposal("angajari", "broad")?.reasons.some((reason) => reason.kind === "rule"), "regula prinde și varianta cu diacritice");
assert.ok(proposal("centrala second hand", "exact")?.reasons.some((reason) => reason.kind === "cost"));
assert.ok(proposal("montaj aer conditionat", "exact")?.reasons.some((reason) => reason.kind === "other_campaign"));
assert.ok(!proposals.some((item) => item.text === "centrala gratuit"), "termenii deja excluși nu se propun");
assert.ok(!proposals.some((item) => item.text === "montaj centrala pret"), "un termen cu conversii nu e propus după cost");
assert.ok(!proposals.some((item) => item.text === "montaj"), "o regulă care ar bloca chiar cuvintele campaniei nu se propune");
ok("propunerile: regulă (cu sau fără diacritice), cost fără conversii, altă campanie; excluși și conversiile sărite; regulile care ar bloca campania sărite");
const termTargets = [{ id: "111", name: "Centrale", existing: [], positives: [{ text: "montaj centrala", match: "phrase", group: "Montaj" }] }];
const termOps = planTermNegatives({
  customerId: C,
  items: [
    { campaignId: "111", text: "angajari", match: "broad" },
    { campaignId: "111", text: "angajari", match: "broad" },
  ],
  targets: termTargets,
  list: null,
});
assert.equal(termOps.operations.length, 1, "dublura bifată de două ori pleacă o dată");
assertGooglePaused(C, termOps.operations);
const termIntoList = planTermNegatives({
  customerId: C,
  items: [{ campaignId: "111", text: "angajari", match: "broad" }],
  targets: termTargets,
  list: { resourceName: existingList, name: "NEG", keywords: [], linked: [] },
});
assert.ok(termIntoList.operations.some((operation) => operation.campaignSharedSetOperation), "lista se leagă de campania termenului");
assertGooglePaused(C, termIntoList.operations, { negativeSharedSets: [existingList] });
const termConflict = planTermNegatives({ customerId: C, items: [{ campaignId: "111", text: "montaj", match: "broad" }], targets: termTargets, list: null });
assert.equal(termConflict.conflicts.length, 1);
ok("negativele bifate: o singură dată fiecare, în listă cu legarea campaniei, conflictele prinse, totul trece de gardă");


// ---------------------------------------------------------------------------
// 15. Conversiile (faza 13): acțiunile standard și importul GTM
// ---------------------------------------------------------------------------

console.log("Conversiile:");
const { GOOGLE_CONVERSION_TYPES } = await load("meta/paused.ts");
const conversions = await load("google/conversions/standard.ts");
const gtm = await load("google/conversions/gtm.ts");
for (const spec of Object.values(conversions.LEAD_ACTIONS)) assert.ok(GOOGLE_CONVERSION_TYPES.includes(spec.type), `${spec.type} e un tip permis de gardă`);
const standardRequest = { actions: conversions.LEAD_KINDS.map((kind) => conversions.defaultLeadAction(kind)) };
const standardCheck = conversions.validateConversionsRequest(standardRequest);
assert.ok(standardCheck.ok, `valorile propuse trec de validare: ${JSON.stringify(standardCheck.errors ?? [])}`);
const conversionOps = conversions.buildConversionOperations(standardCheck.request, "RON");
assertGooglePaused(C, conversionOps);
const conversionOf = (type) => conversionOps.map((operation) => operation.conversionActionOperation.create).find((item) => item.type === type);
const adCall = conversionOf("AD_CALL");
assert.equal(adCall.phoneCallDurationSeconds, "60", "apelul: durata minimă 60 s");
assert.equal(adCall.valueSettings?.alwaysUseDefaultValue, true, "apelul: valoarea fixă, cum cere Google");
assert.equal(adCall.viewThroughLookbackWindowDays, undefined, "apelul: fără fereastră după afișare");
for (const type of ["CLICK_TO_CALL", "WEBPAGE"]) {
  const web = conversionOf(type);
  assert.equal(web.phoneCallDurationSeconds, undefined, `${type}: fără durată de apel`);
  assert.equal(web.countingType, "ONE_PER_CLICK", `${type}: o conversie pe clic`);
  assert.equal(web.viewThroughLookbackWindowDays, "1", `${type}: o zi după afișare`);
}
assert.ok(conversionOps.every((operation) => !("status" in operation.conversionActionOperation.create)), "nicio acțiune nu trimite status");
ok("cele trei acțiuni standard trec de gardă: fără status, apelul cu durată și valoare fixă, site-ul cu fereastră după afișare");
const withValue = conversions.buildConversionOperations({ actions: [{ ...conversions.defaultLeadAction("form"), value: 150 }] }, "RON")[0].conversionActionOperation.create;
assert.deepEqual(withValue.valueSettings, { defaultValue: 150, defaultCurrencyCode: "RON", alwaysUseDefaultValue: true });
ok("o valoare aleasă pleacă fixă, în moneda contului");
const conversionCreate = (change) => [{ conversionActionOperation: { create: change(structuredClone(conversionOf("WEBPAGE"))) } }];
refusesGoogle("conversie de alt tip (UPLOAD_CLICKS)", conversionCreate((item) => ({ ...item, type: "UPLOAD_CLICKS" })));
refusesGoogle("conversie de aplicație (appId)", conversionCreate((item) => ({ ...item, appId: "com.exemplu.app" })));
refusesGoogle("conversie cu model de atribuire trimis", conversionCreate((item) => ({ ...item, attributionModelSettings: { attributionModel: "GOOGLE_ADS_LAST_CLICK" } })));
refusesGoogle("conversie cu include_in_conversions_metric", conversionCreate((item) => ({ ...item, includeInConversionsMetric: false })));
refusesGoogle("conversie pornită explicit", conversionCreate((item) => ({ ...item, status: googleStarted })));
refusesGoogle("conversie ascunsă (HIDDEN)", conversionCreate((item) => ({ ...item, status: "HIDDEN" })));
refusesGoogle("conversie ștearsă", [{ conversionActionOperation: { remove: `customers/${C}/conversionActions/1` } }]);
refusesGoogle("conversie cu o resursă din alt cont", conversionCreate((item) => ({ ...item, name: "customers/9999999999/conversionActions/1" })));
const invalid = (label, change) => {
  const result = conversions.validateConversionsRequest({ actions: [change(conversions.defaultLeadAction("call"))] });
  assert.ok(!result.ok, label);
  ok(`formularul prinde: ${label}`);
};
invalid("fereastra după clic de 61 de zile la apel", (item) => ({ ...item, clickWindowDays: 61 }));
invalid("fereastra după afișare la apel", (item) => ({ ...item, viewWindowDays: 1 }));
invalid("durata minimă peste 10.000 s", (item) => ({ ...item, callSeconds: 10_001 }));
invalid("durata minimă la clicul pe telefon", (item) => ({ ...item, kind: "phone_click", viewWindowDays: 1 }));
invalid("fereastra după clic de 91 de zile", (item) => ({ ...item, kind: "form", viewWindowDays: 1, callSeconds: null, clickWindowDays: 91 }));
invalid("numele gol", (item) => ({ ...item, name: "   " }));
invalid("o valoare negativă", (item) => ({ ...item, value: -1 }));
invalid("un număr care nu e număr", (item) => ({ ...item, clickWindowDays: Number.NaN }));
assert.ok(!conversions.validateConversionsRequest({ actions: [] }).ok, "nicio acțiune");
const formName = conversions.defaultLeadAction("form").name;
assert.ok(!conversions.validateConversionsRequest({ actions: [conversions.defaultLeadAction("form"), { ...conversions.defaultLeadAction("phone_click"), name: formName }] }).ok, "două nume la fel");
ok("formularul prinde: nicio acțiune bifată, două acțiuni cu același nume");
assert.deepEqual(conversions.sendToOf([{ eventSnippet: "gtag('event', 'conversion', {'send_to': 'AW-123456789/AbC-d_9'});" }]), { conversionId: "123456789", label: "AbC-d_9" });
assert.equal(conversions.sendToOf([{ eventSnippet: "<!-- fără etichetă -->" }]), null);
ok("eticheta AW-…/… se citește din fragmentul de cod");

const gtmInput = {
  conversionId: "123456789",
  includeGoogleTag: true,
  phone: { conversionId: "123456789", label: "Tel01" },
  form: { conversionId: "123456789", label: "Form01", trigger: { kind: "thank_you", path: "/multumim/" } },
};
assert.deepEqual(gtm.checkGtmInput(gtmInput).errors, []);
const gtmVersion = gtm.buildGtmImport(gtmInput, new Date(0)).file;
assert.equal(gtmVersion.exportFormatVersion, 2);
const version = gtmVersion.containerVersion;
const tagOf = (type) => version.tag.filter((tag) => tag.type === type);
assert.deepEqual(tagOf("gclidw")[0].firingTriggerId, [gtm.GTM_ALL_PAGES_TRIGGER], "Conversion Linker pe toate paginile");
assert.equal(tagOf("googtag")[0].parameter.find((item) => item.key === "tagId").value, "AW-123456789");
const conversionTags = tagOf("awct");
assert.equal(conversionTags.length, 2);
for (const tag of conversionTags) {
  const param = (key) => tag.parameter.find((item) => item.key === key)?.value;
  assert.equal(param("conversionId"), "123456789", "conversionId fără AW-");
  assert.ok(["Tel01", "Form01"].includes(param("conversionLabel")));
  assert.equal(param("enableConversionLinker"), "true");
  assert.ok(version.trigger.some((item) => item.triggerId === tag.firingTriggerId[0]), "declanșatorul etichetei e în fișier");
}
const telTrigger = version.trigger.find((item) => item.type === "LINK_CLICK");
assert.equal(telTrigger.filter[0].type, "STARTS_WITH");
assert.deepEqual(telTrigger.filter[0].parameter.map((item) => item.value), ["{{Click URL}}", "tel:"]);
const thanks = version.trigger.find((item) => item.type === "PAGEVIEW");
assert.equal(thanks.filter[0].parameter[1].value, "^/multumim/?$", "pagina de mulțumire, cu sau fără / la final");
assert.ok(version.builtInVariable.some((item) => item.type === "CLICK_URL"), "Click URL pornit");
assert.ok([...version.tag.map((tag) => Number(tag.tagId)), ...version.trigger.map((trigger) => Number(trigger.triggerId))].every((id) => id >= 900), "id-uri de la 900");
assert.ok([...version.tag, ...version.trigger].every((item) => item.name.startsWith("Google Ads ·")), "numele încep cu Google Ads ·");
ok("fișierul GTM: Conversion Linker și tag-ul Google pe toate paginile, conversiile cu id-ul și eticheta, tel: și pagina de mulțumire, id-uri ≥ 900");
const eventVersion = gtm.buildGtmImport({ ...gtmInput, includeGoogleTag: false, phone: null, form: { ...gtmInput.form, trigger: { kind: "event", event: "generate_lead" } } }, new Date(0)).file.containerVersion;
assert.equal(eventVersion.tag.some((tag) => tag.type === "googtag"), false, "fără tag-ul Google când site-ul îl are");
assert.deepEqual(eventVersion.trigger[0].customEventFilter[0].parameter.map((item) => item.value), ["{{_event}}", "generate_lead"]);
const submitVersion = gtm.buildGtmImport({ ...gtmInput, phone: null, form: { ...gtmInput.form, trigger: { kind: "form_submit", formId: "contact" } } }, new Date(0)).file.containerVersion;
assert.equal(submitVersion.trigger[0].checkValidation.value, "true");
assert.ok(submitVersion.builtInVariable.some((item) => item.type === "FORM_ID"));
ok("fișierul GTM: evenimentul dataLayer, formularul cu Form ID și validare, fără tag Google dublat");
const gtmErrors = (change) => gtm.checkGtmInput(change(structuredClone(gtmInput))).errors.map((error) => error.field);
assert.deepEqual(gtmErrors((input) => ({ ...input, form: { ...input.form, trigger: { kind: "thank_you", path: "/" } } })), ["path"]);
assert.deepEqual(gtmErrors((input) => ({ ...input, phone: { conversionId: "999999", label: "X" } })), ["phone"]);
assert.deepEqual(gtmErrors((input) => ({ ...input, phone: null, form: null })), ["form"]);
assert.deepEqual(gtmErrors((input) => ({ ...input, form: { ...input.form, trigger: { kind: "event", event: "lead trimis" } } })), ["event"]);
ok("importul GTM refuză: prima pagină ca pagină de mulțumire, eticheta din alt cont, nicio conversie, un eveniment cu spații");


// ---------------------------------------------------------------------------
// 16. „Pentru Claude” și Keyword Planner (faza 14)
// ---------------------------------------------------------------------------

console.log("Pentru Claude și Keyword Planner:");
const { claudeBrief } = await load("claude-brief.ts");
const searchLimits = await load("google/search/limits.ts");
const { EXAMPLE_SEARCH_PLAN: searchExample } = await load("google/search/example.ts");
const brief = claudeBrief();
assert.ok(brief.includes(`"format": "${searchLimits.SEARCH_PLAN_FORMAT}"`), "instrucțiunile au formatul de căutare");
assert.ok(brief.includes(searchExample.trim()), "instrucțiunile au exemplul de căutare, întreg");
for (const [what, value] of [
  ["titlul", searchLimits.RSA_HEADLINE_MAX],
  ["descrierea", searchLimits.RSA_DESCRIPTION_MAX],
  ["calea", searchLimits.RSA_PATH_MAX],
  ["cuvântul cheie", searchLimits.KEYWORD_MAX_CHARS],
  ["linkul suplimentar", searchLimits.SITELINK_TEXT_MAX],
]) {
  assert.ok(new RegExp(`cel mult ${value}(?!\\d)`, "i").test(brief), `limita pentru ${what} (${value}) vine din constante`);
}
assert.ok(/ar bloca un cuvânt cheie pozitiv[^\n]*e eroare/.test(brief), "regula conflictelor negativelor");
const accountIds = [...brief.matchAll(/\b\d{3}-\d{3}-\d{4}\b|\b\d{10}\b/g)].map((match) => match[0]);
assert.deepEqual([...new Set(accountIds)].filter((id) => !/^0{3}-?0{3}-?0{4}$/.test(id) && !/^123-?456-?7890$/.test(id)), [], "niciun id de cont real în instrucțiuni (doar zerourile și forma 123-456-7890)");
ok("instrucțiunile pentru Claude: formatul de căutare, limitele din constante, regula conflictelor, exemplul întreg, fără id-uri reale");
const readOnlyLine = /const READ_ONLY_POSTS = (\[.*\]);/.exec(googleApi)?.[1];
assert.ok(readOnlyLine, "lista POST-urilor de citire");
const readOnlyPosts = Function(`return ${readOnlyLine}`)();
const allowed = (route) => readOnlyPosts.some((pattern) => pattern.test(route));
assert.ok(allowed(`/customers/${C}:generateKeywordHistoricalMetrics`), "volumele din Keyword Planner: o citire permisă");
for (const route of [`/customers/${C}/googleAds:mutate`, `/customers/${C}:generateKeywordIdeas/../googleAds:mutate`, `/customers/${C}/campaigns:mutate`, `/customers/${C}/conversionActions:mutate`, `/customers/${C}/customers:mutate`]) {
  assert.ok(!allowed(route), `${route} nu trece drept citire`);
}
ok("googleReadPost: doar sugestiile de locații și volumele din Keyword Planner; nicio cale de mutate");

console.log(`\n${checks} verificări, toate trecute.`);
