// Proba API-ului pentru roboți, pe un server LOCAL legat de o bază de TEST.
// Nu rula pe producție: scenariul rezervă, termină și trimite emailuri de probă.
//
//   node scripts/prospectare-verifica-api.mjs http://localhost:3210
//
// Baza de test se pregătește cu supabase/tests/prospectare/api-seed.sql (roboții
// api-robot-1, api-robot-2, api-robot-oprit cu tokenurile de test de mai jos și
// firmele 7001 api-lucru.ro, 7002 api-telefon.ro pe telefon, 7003 api-gata.ro).

const BASE = (process.argv[2] ?? "").replace(/\/$/, "");
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE)) {
  console.error("Dă adresa serverului LOCAL, ex. http://localhost:3210 (proba nu rulează pe alt host).");
  process.exit(1);
}

// Tokenuri de test, doar pentru baza locală.
const T1 = "mrx_robot_test_api_unu_0000000001";
const T2 = "mrx_robot_test_api_doi_0000000002";
const TOPRIT = "mrx_robot_test_api_oprit_00000003";

let picate = 0;
async function call(path, body, token, method = "POST") {
  const headers = { "content-type": "application/json" };
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}/api/prospectare/robot/${path}`, { method, headers, body: method === "POST" ? JSON.stringify(body ?? {}) : undefined });
  let json = null;
  try {
    json = await res.json();
  } catch {}
  return { status: res.status, json };
}
function check(name, cond, info) {
  if (cond) console.log(`ok   ${name}`);
  else {
    picate++;
    console.log(`PICAT ${name}${info ? ` — ${JSON.stringify(info).slice(0, 300)}` : ""}`);
  }
}

let r = await call("rezerva", {}, null);
check("fără token → 401", r.status === 401, r);
r = await call("rezerva", {}, "mrx_robot_token_gresit_000000000000");
check("token greșit → 401", r.status === 401, r);
r = await call("rezerva", {}, TOPRIT);
check("robot dezactivat → 401", r.status === 401 && /dezactivat/.test(r.json?.eroare?.mesaj ?? ""), r);
r = await call("rezerva", {}, T1, "GET");
check("GET → 405", r.status === 405, r);

r = await call("firme", { firme: [{ domeniu: "https://www.api-nou.ro/", nume: "API Nou", nisa: "construcții", oras: "Cluj", scor: 77, telefon: "0745 700 010" }] }, T1);
check("firme: adaugă (200, adaugate 1)", r.status === 200 && r.json?.rezultat?.adaugate === 1, r);
r = await call("firme", { firme: [{ domeniu: "api-nou.ro", nume: "API Nou", nisa: "construcții", oras: "Cluj", scor: 77, telefon: "0745 700 010" }] }, T1);
check("firme: a doua oară nimic schimbat (idempotent)", r.status === 200 && r.json?.rezultat?.neschimbate === 1, r);
r = await call("firme", { firme: [{ nume: "fără domeniu" }] }, T1);
check("firme: fără domeniu → 422", r.status === 422, r);
r = await call("firme", "nu e json{", T1);
check("firme: corp invalid → 422", r.status === 422, r);

r = await call("rezerva", { tip_lucru: "construire" }, T1);
const firma = r.json?.firma;
check("rezerva: 200 cu firma de scor maxim (#7001)", r.status === 200 && firma?.nr === 7001, r);
r = await call("rezerva", {}, T1);
check("rezerva din nou: aceeași firmă, reluată", r.status === 200 && r.json?.firma?.nr === 7001 && r.json?.firma?.rezervare?.reluata === true, r);
r = await call("heartbeat", { firma_id: firma?.id }, T2);
check("heartbeat de la alt robot → 409", r.status === 409, r);
r = await call("heartbeat", { firma_id: firma?.id }, T1);
check("heartbeat de la robotul ei → 200 cu expira_la", r.status === 200 && Boolean(r.json?.expira_la), r);
r = await call("heartbeat", { firma_id: "nu-e-uuid" }, T1);
check("heartbeat cu id invalid → 422", r.status === 422, r);
r = await call("termina", { firma_id: firma?.id, link_demo: "http://nesigur.ro" }, T1);
check("termina cu link http → 422", r.status === 422, r);
r = await call("termina", { link_demo: "https://demo.test/api-lucru/" }, T1);
check("termina fără firma_id, domeniu sau nr → 404", r.status === 404, r);
r = await call("termina", { firma_id: firma?.id, link_demo: "https://demo.test/api-lucru/", captura_url: "https://drive.google.com/file/d/test/view" }, T1);
check("termina → 200, site gata", r.status === 200 && r.json?.firma?.etapa === "site_gata", r);
check("termina → linkul verificat (implicit), firma intră în distribuție", r.json?.firma?.demo_verificat === true, r);
const nrSite = r.json?.firma?.nr_site;
check("termina → întoarce numărul de site (37)", Number.isInteger(nrSite) && nrSite > 0, r);
// Migrarea 37: orice robot poate termina orice firmă publicată, și mai multe odată; numărul nu se schimbă.
r = await call("termina", { domeniu: firma?.domeniu, link_demo: "https://demo.test/api-lucru/" }, T2);
check("termina de la alt robot, după domeniu → 200, același nr_site", r.status === 200 && r.json?.firma?.nr_site === nrSite, r);
r = await call("termina", { firme: [{ nr: firma?.nr, link_demo: "https://demo.test/api-lucru/" }, { domeniu: "nu-exista-api.ro", link_demo: "https://demo.test/x/" }] }, T2);
check(
  "termina în lot → 200: 1 terminată, 1 eroare (PR404) pe poziția ei",
  r.status === 200 && r.json?.terminate === 1 && r.json?.erori === 1 && r.json?.firme?.[1]?.eroare?.cod === "PR404" && r.json?.firme?.[0]?.nr_site === nrSite,
  r
);
r = await call("termina", { firme: [] }, T2);
check("termina cu lot gol → 422", r.status === 422, r);

// Distribuția (migrarea 35): robotul trimite doar ce e programat azi, de pe căsuța primită în coadă.
r = await call("coada-email", {}, null);
check("coada-email fără token → 401", r.status === 401, r);
r = await call("coada-email", {}, T1, "GET");
check("coada-email GET → 405", r.status === 405, r);
r = await call("coada-email", {}, T1);
check("coada-email → 200: api-gata.ro e programată azi pe căsuța de test", r.status === 200 && (r.json?.firme ?? []).some((f) => f.domeniu === "api-gata.ro" && f.casuta === "stefan@casuta-test.ro"), r);
r = await call("coada-email", { casuta: "Alta@Casuta-Test.ro" }, T1);
check("coada-email pe altă căsuță → listă goală", r.status === 200 && Array.isArray(r.json?.firme) && r.json.firme.length === 0, r);
r = await call("coada-email", { casuta: "nu-e-email" }, T1);
check("coada-email cu căsuță invalidă → 422", r.status === 422, r);
r = await call("eveniment", { tip: "email_de_trimis", domeniu: "api-gata.ro", casuta: "alta@casuta-test.ro" }, T1);
check("email_de_trimis de pe altă căsuță decât cea programată → 409", r.status === 409 && /programată azi pe căsuța/.test(r.json?.eroare?.mesaj ?? ""), r);

r = await call("eveniment", { tip: "email_de_trimis", domeniu: "api-telefon.ro", casuta: "stefan@casuta-test.ro" }, T1);
check("email_de_trimis pentru o firmă de pe telefon → 409 (telefonul e separat)", r.status === 409 && r.json?.eroare?.cod === "conflict", r);
r = await call("eveniment", { tip: "email_trimis", domeniu: "api-gata.ro", casuta: "stefan@casuta-test.ro", message_id: "<test-0@local>" }, T1);
check("email_trimis fără cerere înainte → 409", r.status === 409, r);
r = await call("eveniment", { tip: "email_de_trimis", domeniu: "api-gata.ro", casuta: "stefan@casuta-test.ro", limita_azi: 40 }, T1);
check("email_de_trimis pentru o firmă fără email → 200, trimite", r.status === 200 && r.json?.trimite === true && r.json?.firma?.email === "office@api-gata.ro", r);
r = await call("eveniment", { tip: "email_de_trimis", domeniu: "api-gata.ro", casuta: "stefan@casuta-test.ro" }, T2);
check("email_de_trimis din nou pentru aceeași firmă → 409 (același canal nu de două ori)", r.status === 409 && /deja email/.test(r.json?.eroare?.mesaj ?? ""), r);
r = await call("coada-email", {}, T1);
check("după cererea canalului, firma nu mai e în coada de email", r.status === 200 && !(r.json?.firme ?? []).some((f) => f.domeniu === "api-gata.ro"), r);
r = await call("eveniment", { tip: "email_trimis", domeniu: "api-gata.ro", casuta: "stefan@casuta-test.ro", message_id: "<test-1@local>", subiect: "Site demo" }, T1);
check("email_trimis → 200, etapa email_trimis", r.status === 200 && r.json?.nou === true && r.json?.etapa === "email_trimis", r);
r = await call("eveniment", { tip: "email_trimis", domeniu: "api-gata.ro", casuta: "stefan@casuta-test.ro", message_id: "<test-1@local>" }, T1);
check("același message_id → 200, nou: false (nu se numără de două ori)", r.status === 200 && r.json?.nou === false, r);
r = await call("eveniment", { tip: "raspuns", nr: 7003, casuta: "stefan@casuta-test.ro", raspuns: "nu", extras: "Nu ne mai scrieți." }, T1);
check("răspuns NU → Nu contacta", r.status === 200 && r.json?.etapa === "nu_contacta", r);
r = await call("eveniment", { tip: "email_de_trimis", domeniu: "api-gata.ro", casuta: "stefan@casuta-test.ro" }, T1);
check("după NU: email_de_trimis → 409", r.status === 409, r);
r = await call("eveniment", { tip: "trimis_necunoscut", domeniu: "api-gata.ro", casuta: "x@y.ro" }, T1);
check("tip necunoscut → 422", r.status === 422, r);
r = await call("eveniment", { tip: "email_de_trimis", casuta: "stefan@casuta-test.ro" }, T1);
check("fără domeniu și fără nr → 422", r.status === 422, r);

// Nișele: tabla comună. Numele nișei e unic pe rulare, ca proba să meargă și pe o bază folosită.
const nisaTest = `api-nisa-${Date.now()}`;
r = await call("nisa", { actiune: "rezerva", nisa: nisaTest, zona: "Test" }, T1);
const nisaId = r.json?.nisa?.id;
check("nisa rezerva → 200, rezervată", r.status === 200 && r.json?.nisa?.status === "rezervata" && Number.isInteger(nisaId), r);
r = await call("nisa", { actiune: "rezerva", nisa: nisaTest.toUpperCase(), zona: "test" }, T2);
check("nisa rezervată de alt robot → 409 cu cine și de când", r.status === 409 && /api-robot-1/.test(r.json?.eroare?.mesaj ?? ""), r);
r = await call("nisa", { actiune: "progres", nisa_id: nisaId, gasite: 3 }, T2);
check("progres de la alt robot → 409", r.status === 409, r);
r = await call("nisa", { actiune: "progres", nisa_id: nisaId, gasite: 3, eligibile: 1, respinse: 2 }, T1);
check("progres → 200, în cercetare", r.status === 200 && r.json?.nisa?.status === "in_cercetare", r);

// Evaluările: deja evaluat → sărit; respinse cu motiv.
const domEval = `api-eval-${Date.now()}.ro`;
r = await call("evaluare", { actiune: "verifica", domenii: ["https://www.api-gata.ro/", domEval] }, T1);
check("verifica: domeniul existent e „deja evaluat”, cel nou nu", r.status === 200 && r.json?.deja_evaluate?.some((d) => d.domeniu === "api-gata.ro") && r.json?.noi?.includes(domEval), r);
r = await call("evaluare", { actiune: "noteaza", nisa_id: nisaId, firme: [{ domeniu: domEval, scor: 20, evaluare: "respinsa" }] }, T1);
check("noteaza: respinsă fără motiv → 422", r.status === 422, r);
r = await call("evaluare", { actiune: "noteaza", nisa_id: nisaId, firme: [{ domeniu: domEval, nume: "API Eval", scor: 20, evaluare: "respinsa", motiv: "site modern" }, { domeniu: "api-gata.ro", scor: 90, evaluare: "eligibila" }] }, T1);
check("noteaza: 1 adăugată, cea existentă sărită", r.status === 200 && r.json?.adaugate === 1 && r.json?.deja_evaluate?.includes("api-gata.ro"), r);
r = await call("nisa", { actiune: "termina", nisa_id: nisaId }, T1);
check("nisa termina → 200, terminată", r.status === 200 && r.json?.nisa?.status === "terminata", r);
r = await call("nisa", { actiune: "rezerva", nisa: nisaTest, zona: "Test" }, T2);
check("nișa terminată nu se mai rezervă → 409", r.status === 409, r);

// Sesiunile (migrarea 38): același token (robotul 1), mai multe terminale.
r = await call("rezerva", { sesiune: "a b" }, T1);
check("sesiune invalidă → 422", r.status === 422, r);
r = await call("rezerva", { sesiune: "2" }, T1);
const firmaS2 = r.json?.firma;
check("rezerva din sesiunea 2 → 200, altă firmă decât sesiunea 1, cu sesiunea în răspuns", r.status === 200 && firmaS2 && firmaS2.nr !== 7001 && firmaS2.rezervare?.sesiune === "2", r);
r = await call("rezerva", { sesiune: 2 }, T1);
check("sesiunea ca număr (2) = „2”: își reia firma", r.status === 200 && r.json?.firma?.id === firmaS2?.id && r.json?.firma?.rezervare?.reluata === true, r);
r = await call("heartbeat", { firma_id: firmaS2?.id, sesiune: "3" }, T1);
check("heartbeat din altă sesiune a aceluiași robot → 409", r.status === 409, r);
r = await call("heartbeat", { firma_id: firmaS2?.id, sesiune: "2" }, T1);
check("heartbeat din sesiunea ei → 200", r.status === 200 && Boolean(r.json?.expira_la), r);
const nisaSes = `sesiuni-api-${Date.now()}`;
r = await call("nisa", { actiune: "rezerva", nisa: nisaSes, zona: "Test", sesiune: "2" }, T1);
const nisaSesId = r.json?.nisa?.id;
check("nisa din sesiunea 2 → 200", r.status === 200 && r.json?.nisa?.sesiune === "2", r);
r = await call("nisa", { actiune: "rezerva", nisa: nisaSes, zona: "Test", sesiune: "3" }, T1);
check("aceeași nișă din sesiunea 3 → 409, cu sesiunea care o are", r.status === 409 && /sesiunea 2/.test(r.json?.eroare?.mesaj ?? ""), r);
r = await call("nisa", { actiune: "progres", nisa_id: nisaSesId, gasite: 1 }, T1);
check("progres fără sesiune (= „1”) pe nișa sesiunii 2 → 409", r.status === 409, r);
// Concurență: 3 sesiuni pe același token cer deodată câte o firmă (de 2 ori fiecare) și aceeași nișă.
const sesiuni = ["c1", "c2", "c3"];
const cereri = await Promise.all(sesiuni.flatMap((s) => [call("rezerva", { sesiune: s }, T1), call("rezerva", { sesiune: s }, T1)]));
const peSesiune = sesiuni.map((s, i) => [cereri[2 * i].json?.firma?.id, cereri[2 * i + 1].json?.firma?.id]);
check(
  "concurență: 3 sesiuni × 2 cereri /rezerva deodată → fiecare sesiune o singură firmă, toate diferite",
  cereri.every((x) => x.status === 200 && x.json?.firma) && peSesiune.every(([a, b]) => a && a === b) && new Set(peSesiune.map(([a]) => a)).size === 3,
  peSesiune
);
const nisaConc = `concurenta-api-${Date.now()}`;
const nise = await Promise.all(sesiuni.map((s) => call("nisa", { actiune: "rezerva", nisa: nisaConc, zona: "Test", sesiune: s }, T1)));
check(
  "concurență: 3 sesiuni cer aceeași nișă deodată → una o primește, două primesc 409",
  nise.filter((x) => x.status === 200).length === 1 && nise.filter((x) => x.status === 409).length === 2,
  nise.map((x) => x.status)
);

// Limita de cereri: robotul 2 face cereri până trece de limita pe minut din Setări.
let limit = null;
for (let i = 0; i < 200 && !limit; i++) {
  const x = await call("rezerva", { tip_lucru: "refacere" }, T2);
  if (x.status === 429) limit = { i, x };
}
check("peste limita de cereri pe minut → 429 cu Retry-After", Boolean(limit) && limit.x.json?.eroare?.cod === "prea_multe", limit ?? "fără 429 în 200 de cereri");

console.log(picate ? `\n${picate} PICATE` : "\nToate probele API au trecut.");
process.exit(picate ? 1 : 0);
