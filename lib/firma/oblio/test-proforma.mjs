// Testul emiterii cu cheile reale, fără o factură: o PROFORMĂ marcată
// „TEST — NU SE PLĂTEȘTE”, de 1 leu, emisă pe firma ta (CUI-ul din OBLIO_CIF),
// nu pe un client. Verifică token-ul, seria de proformă și formatul cererii.
// După test, ștergi proforma din Oblio, de mână (adminul nu șterge nimic).
//
//   node --env-file=.env.local lib/firma/oblio/test-proforma.mjs <seria-de-proforma>
//
// Singurul fișier, în afară de api.ts, care vorbește cu Oblio (excepție scrisă în verify-oblio.mjs).

const [series] = process.argv.slice(2);
const { OBLIO_EMAIL: email, OBLIO_API_SECRET: secret, OBLIO_CIF: cif } = process.env;
if (!email || !secret || !cif || !series) {
  console.error("Folosire: node --env-file=.env.local lib/firma/oblio/test-proforma.mjs <seria-de-proforma>\n(cu OBLIO_EMAIL, OBLIO_API_SECRET și OBLIO_CIF în .env.local)");
  process.exit(1);
}
const BASE = "https://www.oblio.eu/api";

const tokenResponse = await fetch(`${BASE}/authorize/token`, { method: "POST", body: new URLSearchParams({ client_id: email, client_secret: secret }) });
const token = await tokenResponse.json();
if (!token.access_token) {
  console.error("Oblio a refuzat cheia:", tokenResponse.status, token.statusMessage ?? "");
  process.exit(1);
}

const today = new Date().toISOString().slice(0, 10);
const response = await fetch(`${BASE}/docs/proforma`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token.access_token}`, "Content-Type": "application/json" },
  body: JSON.stringify({
    cif,
    seriesName: series,
    issueDate: today,
    dueDate: today,
    language: "RO",
    currency: "RON",
    idempotencyKey: `test-proforma:${today}`,
    mentions: "TEST — NU SE PLĂTEȘTE. Proformă de verificare a legăturii adminului cu Oblio. Se șterge.",
    client: { name: "TEST — NU SE PLĂTEȘTE", cif, save: 0 },
    products: [{ name: "TEST — NU SE PLĂTEȘTE", price: 1, quantity: 1, measuringUnit: "buc", productType: "Serviciu", vatIncluded: 1, save: 0 }],
  }),
});
const body = await response.json().catch(() => null);
console.log(response.status, JSON.stringify(body, null, 2));
if (response.ok && body?.data?.number) {
  console.log(`\nProforma ${body.data.seriesName} ${body.data.number} e emisă. Deschide: ${body.data.link}\nAcum ȘTERGE-O din Oblio (Proforme → ultima → Șterge).`);
}
