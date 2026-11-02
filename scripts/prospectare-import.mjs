// Importul firmelor din auto-web-rebuilder în modulul Prospectare.
//
//   node scripts/prospectare-import.mjs --env <fișier> [--proba] [opțiuni]
//
// Citește:
//   --stare     stare/stare.json din auto-web-rebuilder (implicit: C:\Users\PC\MeridianX\auto-web-rebuilder\stare\stare.json)
//   --trimise   outreach/trimise.json, copia vie de pe Drive (implicit: G:\My Drive\MeridianX Prospectare\outreach\trimise.json)
//   --whatsapp  folderul listelor WhatsApp (asignari-AAAA-LL-ZZ.json; implicit: G:\My Drive\MeridianX Prospectare\whatsapp)
//   --nu-contacta  nu-contacta.txt (implicit: lângă stare.json, dacă există)
// Scrie prin funcțiile din migrările 28–33 (cheia de service), potrivind firmele pe domeniu.
// Se poate rula oricând din nou: avansează doar etapele robotului, nu schimbă
// etapele puse de om și nici data unui canal deja pus (email_la, whatsapp_la).
// O firmă poate avea email și WhatsApp; fiecare canal o singură dată.
//
// --env: fișier în AFARA repo-ului, cu
//   PROSPECTARE_SUPABASE_URL=https://<proiect>.supabase.co
//   PROSPECTARE_SUPABASE_SERVICE_ROLE_KEY=<cheia service_role>
// Scriptul nu afișează niciodată cheia.
//
// --proba: nu scrie nimic. Cheamă aceleași funcții cu p_proba = true și spune
// câte firme ar adăuga, câte ar actualiza, ce conflicte ar fi.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : def;
};
const PROBA = args.includes("--proba");
const ENV = opt("--env", null);
const STARE = resolve(opt("--stare", "C:\\Users\\PC\\MeridianX\\auto-web-rebuilder\\stare\\stare.json"));
const TRIMISE = resolve(opt("--trimise", "G:\\My Drive\\MeridianX Prospectare\\outreach\\trimise.json"));
const WHATSAPP = resolve(opt("--whatsapp", "G:\\My Drive\\MeridianX Prospectare\\whatsapp"));
const NU_CONTACTA = resolve(opt("--nu-contacta", join(dirname(STARE), "nu-contacta.txt")));
const LOT = 500;

function stop(msg) {
  console.error(`\nOPRIT: ${msg}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Cheile: doar din fișierul dat, niciodată afișate
// ---------------------------------------------------------------------------

if (!ENV) stop("lipsește --env <fișier> (în afara repo-ului) cu PROSPECTARE_SUPABASE_URL și PROSPECTARE_SUPABASE_SERVICE_ROLE_KEY.");
if (!existsSync(ENV)) stop(`fișierul ${ENV} nu există.`);
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
if (resolve(ENV).toLowerCase().startsWith(REPO.toLowerCase() + "\\") || resolve(ENV).toLowerCase().startsWith(REPO.toLowerCase() + "/")) {
  stop("fișierul cu chei e în repo. Mută-l în afara lui (ex. C:\\Users\\PC\\meridian-prospectare-import.env).");
}
const env = Object.fromEntries(
  readFileSync(ENV, "utf8")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "")])
);
// Adresa proiectului; dacă e copiată cu „/rest/v1/” la final, o scoatem (biblioteca o adaugă singură).
const URL_DB = (env.PROSPECTARE_SUPABASE_URL ?? "").trim().replace(/\/rest\/v1\/?$/, "").replace(/\/+$/, "");
const KEY = env.PROSPECTARE_SUPABASE_SERVICE_ROLE_KEY;
const lipsa = [!URL_DB && "PROSPECTARE_SUPABASE_URL", !KEY && "PROSPECTARE_SUPABASE_SERVICE_ROLE_KEY"].filter(Boolean);
if (lipsa.length) stop(`în ${ENV} lipsesc: ${lipsa.join(", ")}.`);
if (!/^https?:\/\/[^\s/]+/.test(URL_DB)) stop("PROSPECTARE_SUPABASE_URL nu arată ca o adresă (https://<proiect>.supabase.co).");
const gazda = new URL(URL_DB).host;

// ---------------------------------------------------------------------------
// Datele robotului
// ---------------------------------------------------------------------------

const citesteJson = (p, ce) => {
  if (!existsSync(p)) stop(`nu găsesc ${ce}: ${p}`);
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch (e) {
    stop(`${ce} nu e JSON valid (${p}): ${e.message}`);
  }
};

const stare = citesteJson(STARE, "stare.json");
const prospecti = Array.isArray(stare.prospecti) ? stare.prospecti : Object.values(stare.prospecti ?? {});
const trimise = citesteJson(TRIMISE, "trimise.json");
if (!Array.isArray(trimise)) stop("trimise.json nu e o listă.");

// Ora României → moment ISO (cu decalajul corect vară/iarnă).
function laBucuresti(data, ora = "12:00:00") {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data ?? "")) return null;
  const [h, m, s] = (ora || "12:00:00").split(":").map((x) => Number(x) || 0);
  const ghicit = Date.UTC(+data.slice(0, 4), +data.slice(5, 7) - 1, +data.slice(8, 10), h, m, s);
  const parti = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Bucharest", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(new Date(ghicit));
  const v = Object.fromEntries(parti.map((p) => [p.type, p.value]));
  const vazut = Date.UTC(+v.year, +v.month - 1, +v.day, +v.hour, +v.minute, +v.second);
  return new Date(ghicit - (vazut - ghicit)).toISOString();
}
const dinTimestampRobot = (t) => (typeof t === "string" && /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(t) ? laBucuresti(t.slice(0, 10), t.slice(11, 19).padEnd(8, ":00").slice(0, 8)) : null);

const normDom = (d) =>
  String(d ?? "")
    .trim()
    .toLowerCase()
    .replace(/^[a-z][a-z0-9+.-]*:\/\//, "")
    .replace(/[/?#:].*$/, "")
    .replace(/^www\./, "")
    .replace(/\.$/, "");

// nu-contacta.txt: emailuri sau domenii.
const nuContacta = new Set(
  existsSync(NU_CONTACTA)
    ? readFileSync(NU_CONTACTA, "utf8")
        .split(/\r?\n/)
        .map((l) => l.trim().replace(/^<|>$/g, "").toLowerCase().replace(/^mailto:/, ""))
        .filter((l) => l && !l.startsWith("#"))
        .map((l) => (l.includes("@") ? l : normDom(l)))
    : []
);

const ETAPA = {
  candidat: "cercetat",
  ales: "site_in_lucru",
  in_lucru: "site_in_lucru",
  refacere: "site_in_lucru",
  gata: "site_gata",
  de_verificat: "site_gata",
  aprobat: "site_gata",
  trimis: "email_trimis",
  respins: "respins",
  nu_contacta: "nu_contacta",
  eroare: "cercetat",
};

// WhatsApp: firmele marcate cu „stare.py whatsapp” (whatsapp.trimis_la) și cele
// din „trimise” ale fișierelor zilnice asignari-*.json (cu contul).
const waTrimise = new Map();
if (existsSync(WHATSAPP)) {
  for (const f of readdirSync(WHATSAPP).filter((n) => /^asignari-\d{4}-\d{2}-\d{2}\.json$/.test(n)).sort()) {
    const zi = f.slice(9, 19);
    const a = citesteJson(join(WHATSAPP, f), f);
    for (const nr of a.trimise ?? []) {
      if (!waTrimise.has(Number(nr))) waTrimise.set(Number(nr), { zi, cont: a.cont?.[String(nr)] ?? null, sursa: f });
    }
  }
}
for (const x of prospecti) {
  const t = x.whatsapp?.trimis_la;
  if (t && !waTrimise.has(Number(x.nr))) waTrimise.set(Number(x.nr), { zi: String(t).slice(0, 10), ora: String(t).slice(11, 16), cont: x.whatsapp?.cont ?? null, sursa: "stare.json (stare.py whatsapp)" });
}

const trimisePeNr = new Map();
for (const r of trimise) if (!trimisePeNr.has(Number(r.nr))) trimisePeNr.set(Number(r.nr), r);

const raport = { etape: {}, statusNecunoscut: {}, faraDomeniu: 0, nuContacta: 0, emailFaraDetalii: [], waCuEmail: [], waSingur: [], waFaraFirma: [], waFaraCont: [], emailDoarInTrimise: [] };
const firme = [];
const activitate = [];

const textScurt = (v, max) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined);
const mobil = (t) => /^07\d{8}$/.test(String(t ?? "").replace(/\D/g, "").replace(/^(00)?40/, "0"));

for (const x of prospecti) {
  const dom = normDom(x.domeniu || x.url);
  if (!dom) {
    raport.faraDomeniu++;
    continue;
  }
  const status = String(x.status ?? "candidat");
  let etapa = ETAPA[status];
  if (!etapa) {
    raport.statusNecunoscut[status] = (raport.statusNecunoscut[status] ?? 0) + 1;
    etapa = "cercetat";
  }
  const email = textScurt(x.email, 320)?.toLowerCase();
  if (nuContacta.has(dom) || (email && (nuContacta.has(email) || nuContacta.has(email.split("@")[1])))) {
    etapa = "nu_contacta";
    raport.nuContacta++;
  }

  // Fiecare canal are data lui: emailul din trimise.json, WhatsApp-ul din listele zilnice / stare.json.
  // Emailul a plecat dacă starea zice „trimis” SAU dacă e în trimise.json (copia vie, mai nouă decât starea).
  let emailLa;
  const t = trimisePeNr.get(Number(x.nr));
  const inTrimise = Boolean(t) && String(t.status ?? "trimis") === "trimis";
  if ((status === "trimis" || inTrimise) && etapa !== "nu_contacta") {
    emailLa = (t && laBucuresti(t.data, t.ora)) || dinTimestampRobot(x.trimis_la) || undefined;
    if (!t) raport.emailFaraDetalii.push(x.nr);
    if (status !== "trimis") {
      raport.emailDoarInTrimise.push(`${x.nr} (${status})`);
      if (["cercetat", "site_in_lucru", "site_gata"].includes(etapa)) etapa = "email_trimis";
    }
  }

  let whatsappLa;
  let whatsappCont;
  const wa = waTrimise.get(Number(x.nr));
  if (wa && etapa !== "nu_contacta") {
    (emailLa ? raport.waCuEmail : raport.waSingur).push(x.nr);
    // Ultimul contact: WhatsApp-ul a plecat după email (lista din 1 nov).
    etapa = "whatsapp_trimis";
    whatsappLa = laBucuresti(wa.zi, wa.ora ? `${wa.ora}:00` : "12:00:00") ?? undefined;
    const cont = Number(wa.cont);
    whatsappCont = Number.isInteger(cont) && cont >= 1 && cont <= 9 ? cont : undefined;
    if (whatsappLa && whatsappCont === undefined) raport.waFaraCont.push(x.nr);
  }
  raport.etape[etapa] = (raport.etape[etapa] ?? 0) + 1;

  const telefoane = Array.isArray(x.telefoane) ? x.telefoane.filter((t) => typeof t === "string") : [];
  const telefon = textScurt(x.telefon, 40) ?? telefoane[0];
  const df = x.date_firma && typeof x.date_firma === "object" ? x.date_firma : {};
  const extra = Object.fromEntries(
    Object.entries({
      status_robot: status,
      din_status: x.din_status,
      motiv_refacere: x.motiv_refacere,
      categorie: x.categorie,
      prescor: x.prescor,
      treapta: x.treapta,
      excludere: x.excludere,
      trimitere_oprita: x.trimitere_oprita,
      doar_whatsapp: x.doar_whatsapp,
      card_local: x.card,
      platforma: x.platforma,
      constructor: x.constructor,
      legal_lipsa: x.legal_lipsa,
      telefoane_toate: telefoane.length > 1 ? telefoane.slice(0, 6) : undefined,
      telefon_mobil: !mobil(telefon) ? telefoane.find(mobil) : undefined,
      emailuri: Array.isArray(x.emailuri) && x.emailuri.length > 1 ? x.emailuri.slice(0, 6) : undefined,
      firma: Object.keys(df).length
        ? Object.fromEntries(Object.entries({ cui: df.cui, denumire: df.denumire, adresa: df.adresa, caen: df.caen, an_infiintare: df.an_infiintare, stare: df.stare }).filter(([, v]) => v !== undefined && v !== null && v !== ""))
        : undefined,
      adaugat_de: x.adaugat_de,
      sursa: "import auto-web-rebuilder",
    }).filter(([, v]) => v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && v.length === 0))
  );

  firme.push(
    Object.fromEntries(
      Object.entries({
        domeniu: dom,
        nr: Number.isInteger(x.nr) && x.nr > 0 ? x.nr : undefined,
        nume: textScurt(x.nume, 300) ?? textScurt(x.titlu, 300) ?? dom,
        site_vechi: textScurt(x.url, 500),
        nisa: textScurt(x.nisa, 200),
        oras: textScurt(x.oras, 120),
        scor: Number.isInteger(x.scor) ? x.scor : undefined,
        telefon,
        email: email && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? email : undefined,
        persoana_contact: textScurt(typeof x.persoana_contact === "string" ? x.persoana_contact : undefined, 200),
        lot: textScurt(x.lot, 200),
        slug: textScurt(x.slug, 200),
        link_demo: typeof x.link_demo === "string" && x.link_demo.startsWith("https://") ? x.link_demo.slice(0, 500) : undefined,
        de_refacut: status === "refacere",
        etapa,
        email_la: emailLa,
        whatsapp_la: whatsappLa,
        whatsapp_cont: whatsappLa ? whatsappCont : undefined,
        date_extra: extra,
      }).filter(([, v]) => v !== undefined)
    )
  );
}

// Activitatea dinainte de modul: emailurile din trimise.json și WhatsApp-urile.
const nrInStare = new Set(prospecti.map((x) => Number(x.nr)));
for (const r of trimise) {
  activitate.push({
    nr: Number(r.nr),
    tip: "email",
    canal: "email",
    la: laBucuresti(r.data, r.ora),
    cheie: `import:email:${r.message_id || `${r.nr}:${r.data}:${r.ora}`}`,
    detalii: Object.fromEntries(
      Object.entries({ casuta: r.expeditor, domeniu_trimitere: r.domeniu, message_id: r.message_id, categorie: r.categorie, scor: r.scor, link: r.link, motiv: r.motiv || undefined, sursa: "trimise.json (înainte de modul)" }).filter(([, v]) => v !== undefined && v !== "")
    ),
  });
}
for (const [nr, wa] of waTrimise) {
  if (!nrInStare.has(nr)) {
    raport.waFaraFirma.push(nr);
    continue;
  }
  const cuEmail = raport.waCuEmail.includes(nr);
  activitate.push({
    nr,
    tip: "whatsapp",
    canal: "whatsapp",
    la: laBucuresti(wa.zi, wa.ora ? `${wa.ora}:00` : "12:00:00"),
    cheie: `import:whatsapp:${nr}:${wa.zi}`,
    detalii: Object.fromEntries(
      Object.entries({
        cont: wa.cont ?? undefined,
        zi: wa.zi,
        sursa: wa.sursa,
        nota: cuEmail ? "WhatsApp trimis înainte de modul, după email." : "WhatsApp trimis înainte de modul.",
      }).filter(([, v]) => v !== undefined)
    ),
  });
}

// Statisticile căsuțelor, pe zi, din trimise.json.
const casute = new Map();
for (const r of trimise) {
  if (!r.expeditor || !r.data) continue;
  const k = `${String(r.expeditor).toLowerCase()}|${r.data}`;
  casute.set(k, (casute.get(k) ?? 0) + 1);
}
const randuriCasute = [...casute].map(([k, n]) => ({ adresa: k.split("|")[0], zi: k.split("|")[1], trimise: n }));

// ---------------------------------------------------------------------------
// Raportul din fișiere (înainte de bază)
// ---------------------------------------------------------------------------

console.log(`Import Prospectare ${PROBA ? "— PROBĂ (nu scrie nimic)" : "— SCRIE în bază"}`);
console.log(`Baza: ${gazda}`);
console.log(`Surse: ${STARE}\n        ${TRIMISE} (${trimise.length} emailuri)\n        ${existsSync(WHATSAPP) ? WHATSAPP : "(fără folder WhatsApp)"}\n        ${existsSync(NU_CONTACTA) ? NU_CONTACTA : "(fără nu-contacta.txt)"}`);
console.log(`\nFirme în stare: ${prospecti.length}${raport.faraDomeniu ? ` (${raport.faraDomeniu} fără domeniu, sărite)` : ""}`);
console.log("Etape după mapare:", Object.entries(raport.etape).sort((a, b) => b[1] - a[1]).map(([e, n]) => `${e} ${n}`).join(", "));
if (Object.keys(raport.statusNecunoscut).length) console.log("Statusuri necunoscute (→ cercetat):", JSON.stringify(raport.statusNecunoscut));
console.log(`Din nu-contacta.txt: ${raport.nuContacta}`);
console.log(`Emailuri trimise (status trimis) fără rând în trimise.json: ${raport.emailFaraDetalii.length}${raport.emailFaraDetalii.length ? ` (#${raport.emailFaraDetalii.join(", #")})` : ""}`);
if (raport.emailDoarInTrimise.length) console.log(`În trimise.json, dar starea nu zice încă „trimis” (intră cu email trimis): #${raport.emailDoarInTrimise.join(", #")}`);
const cuEmailLa = firme.filter((f) => f.email_la).length;
const cuWhatsappLa = firme.filter((f) => f.whatsapp_la).length;
console.log(`Canale: email ${cuEmailLa} firme · WhatsApp ${cuWhatsappLa} firme (${raport.waCuEmail.length} după email, ${raport.waSingur.length} doar WhatsApp)${raport.waFaraFirma.length ? ` · ${raport.waFaraFirma.length} WhatsApp fără firmă în stare` : ""}`);
if (raport.waCuEmail.length) console.log(`  Email + WhatsApp: #${raport.waCuEmail.join(", #")}`);
if (raport.waFaraCont.length) console.log(`  WhatsApp fără cont cunoscut (1–9): #${raport.waFaraCont.join(", #")}`);
console.log(`Activitate de importat: ${activitate.length} rânduri · statistici căsuțe: ${randuriCasute.length} zile × căsuță`);

// ---------------------------------------------------------------------------
// Baza
// ---------------------------------------------------------------------------

const db = createClient(URL_DB, KEY, { auth: { persistSession: false, autoRefreshToken: false } });

async function rpc(name, params) {
  const { data, error } = await db.rpc(name, params);
  if (error) {
    if (error.code === "PGRST202" || /schema cache|does not exist/i.test(error.message ?? "")) {
      stop(`funcția ${name} lipsește în bază: rulează întâi migrările 28–33 în Supabase → SQL Editor.`);
    }
    stop(`${name}: ${error.message} (${error.code ?? "fără cod"})`);
  }
  return data;
}

const total = { adaugate: 0, actualizate: 0, neschimbate: 0, etape_pastrate: 0, canale_noi: 0, conflicte: [] };
for (let i = 0; i < firme.length; i += LOT) {
  const r = await rpc("prospectare_upsert_firme", { p_firme: firme.slice(i, i + LOT), p_sursa: "import", p_autor: "import", p_proba: PROBA });
  total.adaugate += r.adaugate;
  total.actualizate += r.actualizate;
  total.neschimbate += r.neschimbate;
  total.etape_pastrate += r.etape_pastrate;
  total.canale_noi += r.canale_noi ?? 0;
  total.conflicte.push(...r.conflicte);
  process.stdout.write(`\rFirme: ${Math.min(i + LOT, firme.length)}/${firme.length}`);
}
console.log("");

// Activitatea și căsuțele au nevoie de firmele scrise; la probă, firmele noi încă nu există.
const act = PROBA
  ? { noi: 0, existente: 0, fara_firma: [], nota: "la probă se numără doar după ce firmele există" }
  : await rpc("prospectare_import_activitate", { p_randuri: activitate, p_autor: "import", p_proba: false });
const cas = await rpc("prospectare_import_casute", { p_randuri: randuriCasute, p_proba: PROBA });

console.log(`\n${PROBA ? "AR FI" : "S-AU"}: adăugate ${total.adaugate} · actualizate ${total.actualizate} · neschimbate ${total.neschimbate} · etape păstrate (puse de om sau mai avansate) ${total.etape_pastrate}`);
console.log(`Firme care ${PROBA ? "ar primi" : "au primit"} date de canal (email_la / whatsapp_la): ${total.canale_noi}`);
console.log(`Conflicte: ${total.conflicte.length}`);
for (const c of total.conflicte.slice(0, 40)) console.log(`  #${c.nr ?? "?"} ${c.domeniu ?? ""}: ${c.motiv}`);
if (total.conflicte.length > 40) console.log(`  … încă ${total.conflicte.length - 40}`);
if (!PROBA) console.log(`Activitate: ${act.noi} noi, ${act.existente} existente${act.fara_firma?.length ? `, ${act.fara_firma.length} fără firmă` : ""}`);
console.log(`Căsuțe: ${cas.randuri} rânduri ${PROBA ? "(nescrise)" : "(valoarea mai mare se păstrează)"}`);
console.log(PROBA ? "\nProbă terminată. Nimic scris. Rulează fără --proba ca să scrii." : "\nImport terminat.");
