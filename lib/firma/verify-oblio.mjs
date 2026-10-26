// Verifică regula modulului: adminul nu anulează, nu restaurează, nu șterge și
// nu stornează facturi, iar emiterea pleacă doar din aprobarea omului.
//   node lib/firma/verify-oblio.mjs   (iese cu 1 la prima regulă încălcată)
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const api = readFileSync(path.join(root, "lib/firma/oblio/api.ts"), "utf8");
let failures = 0;
let checks = 0;
const check = (ok, message) => {
  checks += 1;
  if (!ok) {
    failures += 1;
    console.error(`✗ ${message}`);
  }
};

// 1. Nicio cale sau metodă interzisă în clientul Oblio.
const code = api.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
for (const forbidden of ["/cancel", "/restore", "storno", "\"DELETE\"", "'DELETE'", "refund", "deleteCollect"]) {
  check(!code.includes(forbidden), `api.ts conține „${forbidden}”`);
}

// 2. Lista de cereri permise e exact cea știută.
const allowedBlock = code.match(/type Allowed =([\s\S]*?);\n/)?.[1] ?? "";
const pairs = [...allowedBlock.matchAll(/method: "(GET|POST|PUT)"; path: ([^}]+)}/g)].flatMap((match) => [...match[2].matchAll(/"([^"]+)"/g)].map((p) => `${match[1]} ${p[1]}`));
const expected = [
  "GET /nomenclature/companies",
  "GET /nomenclature/clients",
  "GET /nomenclature/series",
  "GET /nomenclature/vat_rates",
  "GET /docs/invoice",
  "GET /docs/invoice/list",
  "POST /docs/invoice",
  "POST /docs/proforma",
  "POST /docs/einvoice",
  "PUT /docs/invoice/collect",
].sort();
check(JSON.stringify(pairs.sort()) === JSON.stringify(expected), `cererile permise s-au schimbat: ${pairs.join(", ")}`);

// 3. Fiecare apel `call(...)` folosește o pereche permisă, scrisă literal.
for (const match of code.matchAll(/call<[^(]*>\(\s*\{\s*method: "(\w+)", path: "([^"]+)"\s*\}/g)) {
  check(expected.includes(`${match[1]} ${match[2]}`), `apel nepermis: ${match[1]} ${match[2]}`);
}
const calls = (code.match(/\bcall</g) ?? []).length;
const literal = [...code.matchAll(/call<[^(]*>\(\s*\{\s*method: "(\w+)", path: "([^"]+)"\s*\}/g)].length;
// Două nu sunt literale: definiția lui call() și reîncercarea ei după 401, cu aceeași cerere.
check(calls - literal <= 2, `${calls - literal - 2} apeluri call() fără metodă și cale literale`);

// 4. Doar api.ts vorbește cu Oblio; doar aprobarea emite; nimeni nu face proforme din aplicație.
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx|mjs)$/.test(name)) out.push(full);
  }
  return out;
}
const files = [...walk(path.join(root, "lib/firma")), ...walk(path.join(root, "components/firma")), ...walk(path.join(root, "app/(admin)/admin/firma"))];
for (const file of files) {
  const rel = path.relative(root, file).replace(/\\/g, "/");
  if (rel === "lib/firma/oblio/api.ts" || rel === "lib/firma/verify-oblio.mjs") continue;
  // Testul manual cu cheile reale: doar proformă marcată TEST, rulat de om, niciodată de aplicație.
  if (rel === "lib/firma/oblio/test-proforma.mjs") {
    const source = readFileSync(file, "utf8");
    check(/\/docs\/proforma/.test(source) && !/\/docs\/invoice/.test(source), "test-proforma.mjs trebuie să facă doar proforme");
    check(/TEST — NU SE PLĂTEȘTE/.test(source), "proforma de test nu mai e marcată „TEST — NU SE PLĂTEȘTE”");
    check(!/\/cancel|\/restore|DELETE/.test(source), "test-proforma.mjs conține o cale interzisă");
    continue;
  }
  const source = readFileSync(file, "utf8");
  check(!/oblio\.eu/.test(source), `${rel} vorbește direct cu Oblio`);
  if (rel !== "lib/firma/facturi.ts") check(!/\bcreateInvoice\(/.test(source), `${rel} emite facturi (doar aprobarea din facturi.ts are voie)`);
  check(!/\bcreateProforma\(/.test(source), `${rel} face proforme (doar testul manual cu cheile reale)`);
  if (rel !== "lib/firma/incasari.ts") check(!/\bcollectInvoice\(/.test(source), `${rel} marchează încasări (doar potrivirea sigură din incasari.ts)`);
}

// 5. Emiterea din facturi.ts e în aprobare, după verificarea stării.
const facturi = readFileSync(path.join(root, "lib/firma/facturi.ts"), "utf8");
const approve = facturi.indexOf("export async function approveInvoice");
const create = facturi.indexOf("createInvoice(", approve);
check(approve > 0 && create > approve, "createInvoice nu mai e în approveInvoice");
const claim = facturi.indexOf('.update({ starea: "in_lucru"', approve);
check(claim > approve && claim < create, "emiterea nu mai trece prin trecerea condiționată în „in_lucru”");
check(/idempotencyKey: String\(row\.cheie_idempotenta\)/.test(facturi), "emiterea nu mai trimite cheia de idempotență a facturii");

console.log(failures === 0 ? `✓ Oblio: ${checks} verificări, toate trec` : `${failures} din ${checks} verificări pică`);
process.exit(failures === 0 ? 0 : 1);
