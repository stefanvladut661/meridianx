// Verifică regula „postările publicate nu se șterg și nu se modifică”, în cod:
// clienții Instagram și TikTok din lib/postari folosesc doar endpoint-urile
// permise și nicio metodă de ștergere sau de editare.
//
//   node lib/postari/verify-api.mjs
//
// Pică (cod 1) dacă apare un endpoint nou sau o metodă nouă. Un endpoint nou
// se adaugă aici doar după ce s-a verificat în documentație că nu atinge
// postările publicate.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

const RULES = {
  "instagram.ts": {
    methods: ["GET", "POST"],
    paths: ["/me", "/refresh_access_token", "/${encodeURIComponent(igId)}/media", "/${encodeURIComponent(igId)}/media_publish", "/${encodeURIComponent(igId)}/content_publishing_limit", "/${encodeURIComponent(containerId)}", "/${encodeURIComponent(mediaId)}"],
    expected: 8,
  },
  "tiktok.ts": {
    methods: ["GET", "POST", "PUT"],
    paths: ["/v2/auth/authorize/", "/v2/oauth/token/", "/v2/oauth/revoke/", "/v2/user/info/", "/v2/post/publish/inbox/video/init/", "/v2/post/publish/status/fetch/"],
    expected: 7,
  },
};

// Ce ar modifica sau șterge o postare publicată, ori ar posta direct (în afara regulilor).
const FORBIDDEN = [/"DELETE"/, /"PATCH"/, /\/comments/, /\/hide/, /video\/edit/, /post\/publish\/video\/init/, /post\/publish\/content\/init/, /direct_post/, /\/delete/];

const CALL = /\b(?:call|api)\(\s*"([A-Z]+)",\s*[`"]([^`"]+)[`"]/g;
const OAUTH = /\boauth\(\s*"([^"]+)"/g;
const AUTH_URL = /new URL\(`\$\{(?:AUTH|API)\(\)\}([^`]+)`\)/g;
const FETCH_METHOD = /method:\s*"([A-Z]+)"/g;

let failed = 0;
for (const [file, rule] of Object.entries(RULES)) {
  const source = readFileSync(join(here, file), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  for (const pattern of FORBIDDEN) {
    if (pattern.test(source)) {
      console.error(`NU  ${file}: ${pattern} apare în cod.`);
      failed += 1;
    }
  }
  const calls = [...source.matchAll(CALL)].map((m) => ({ method: m[1], path: m[2] }));
  const paths = [...calls.map((c) => c.path), ...[...source.matchAll(OAUTH)].map((m) => m[1]), ...[...source.matchAll(AUTH_URL)].map((m) => m[1])];
  const methods = new Set([...calls.map((c) => c.method), ...[...source.matchAll(FETCH_METHOD)].map((m) => m[1])]);
  for (const method of methods) {
    if (!rule.methods.includes(method)) {
      console.error(`NU  ${file}: metoda ${method} nu e permisă.`);
      failed += 1;
    }
  }
  for (const path of paths) {
    const clean = path.replace(/\?.*$/, "");
    if (!rule.paths.includes(clean)) {
      console.error(`NU  ${file}: endpoint nepermis „${path}”.`);
      failed += 1;
    }
  }
  // Un număr mai mic de apeluri găsite decât cel știut = verificarea nu mai vede codul (s-a schimbat forma apelurilor).
  if (paths.length !== rule.expected) {
    console.error(`NU  ${file}: am găsit ${paths.length} apeluri, aștept ${rule.expected}. Actualizează lista după ce verifici apelurile noi.`);
    failed += 1;
  }
  console.log(`${file}: ${paths.length} apeluri, metode ${[...methods].join(", ")}.`);
}
if (failed) {
  console.error(`\n${failed} probleme.`);
  process.exit(1);
}
console.log("\nOK: doar endpoint-urile permise; nicio ștergere, editare sau postare directă.");
