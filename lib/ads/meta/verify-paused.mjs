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
assert.ok(/assertGooglePaused\(customer, operations\);[\s\S]*googleAds:mutate/.test(googleApi), "assertGooglePaused înainte de mutate");
// Căile reale de cerere sunt șabloane `…/googleAds:mutate` + backtick; comentariile nu contează.
assert.equal((googleApi.match(/\/googleAds:mutate`/g) ?? []).length, 1, "o singură cerere de mutate");
assert.ok(!/partialFailure: true/.test(googleApi), "fără partialFailure");
ok("google/api.ts: un singur mutate, atomic, după assertGooglePaused");
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

console.log(`\n${checks} verificări, toate trecute.`);
