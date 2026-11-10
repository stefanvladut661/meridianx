// Proba HTTP a rutelor din migrarea 39 (/lista-mea, /publicare, /termina cu câmpurile noi, /coada-email cu emailul
// suspendat), DOAR pe un server LOCAL legat de baza de TEST din Docker (containerul pgprospectare, după ruleaza.sh).
//
//   node scripts/prospectare-verifica-api-39.mjs http://localhost:3939
//
// Pregătește singur doi roboți de probă (tokenuri noi, aleatorii) și patru firme alocate pe două terminale.
import { createHash, randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";

const SERVER = (process.argv[2] ?? "").replace(/\/$/, "");
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(SERVER)) {
  console.error("Dă adresa serverului LOCAL, ex. http://localhost:3939 (proba nu rulează pe alt host).");
  process.exit(1);
}
const BAZA = `${SERVER}/api/prospectare/robot`;
const tok = () => "mrx_robot_" + randomBytes(24).toString("base64url");
const A = tok();
const B = tok();
// Fiecare rulare are firmele și terminalele ei (activitatea nu se șterge, deci nici firmele).
const R = randomBytes(3).toString("hex");
const sha = (t) => createHash("sha256").update(t).digest("hex");
const sql = (q) => execFileSync("docker", ["exec", "-i", "pgprospectare", "psql", "-U", "postgres", "-d", "test", "-X", "-q", "-tA", "-v", "ON_ERROR_STOP=1"], { input: q }).toString().trim();

sql(`select set_config('prospectare.autor', 'proba api', false);
delete from public.prospectare_dispozitive where nume like 'PC Proba %';
insert into public.prospectare_dispozitive (nume, proprietar, token_hash) values ('PC Proba A', 'test', '${sha(A)}'), ('PC Proba B', 'test', '${sha(B)}');
update public.prospectare_lacate set dispozitiv_id = null, sesiune = null, luat_la = null, batut_la = null where cheie = 'publicare';
update public.prospectare_setari set cereri_pe_minut = 1000 where id = 1;
insert into public.prospectare_firme (nume, domeniu, email, telefon, etapa, scor, evaluare) values
  ('API Liste 1', 'api${R}-1.ro', 'o@api${R}-1.ro', '021 400 0001', 'cercetat', 90, 'eligibila'),
  ('API Liste 2', 'api${R}-2.ro', 'o@api${R}-2.ro', null, 'cercetat', 80, 'eligibila'),
  ('API Liste 3', 'api${R}-3.ro', 'o@api${R}-3.ro', null, 'cercetat', 70, 'eligibila'),
  ('API Liste 4', 'api${R}-4.ro', 'o@api${R}-4.ro', null, 'cercetat', 60, 'eligibila');
select public.prospectare_aloca_constructie((select array_agg(id) from public.prospectare_firme where domeniu like 'api${R}-_.ro'), array['t${R}-1', 't${R}-2'], null, false, 'proba');`);

const cere = async (ruta, corp, token = A, metoda = "POST", query = "") => {
  const r = await fetch(`${BAZA}/${ruta}${query}`, {
    method: metoda,
    headers: { authorization: `Bearer ${token}`, ...(metoda === "POST" ? { "content-type": "application/json" } : {}) },
    body: metoda === "POST" ? JSON.stringify(corp) : undefined,
  });
  return { status: r.status, j: await r.json() };
};
let ok = 0;
let picate = 0;
const verifica = (cond, nume, extra = "") => {
  if (cond) ok++;
  else picate++;
  console.log(`${cond ? "ok  " : "PICAT"} ${nume}${extra ? ` (${extra})` : ""}`);
};
// Firma după cifra din domeniu (api<R>-1.ro → 1).
const nrs = (j) => (j.firme ?? []).map((f) => f.domeniu.replace(/^.*-(\d)\.ro$/, "$1")).sort().join(",");

// /lista-mea
const g1 = await cere("lista-mea", null, A, "GET", `?sesiune=t${R}-1`);
const p2 = await cere("lista-mea", { sesiune: `t${R}-2` });
verifica(g1.status === 200 && nrs(g1.j) === "1,3", "GET /lista-mea?sesiune=… → firmele primului terminal", `${g1.status} ${nrs(g1.j)}`);
verifica(p2.status === 200 && nrs(p2.j) === "2,4", "POST /lista-mea {sesiune} → lista celui de-al doilea", `${p2.status} ${nrs(p2.j)}`);
verifica(g1.j.firme?.[0]?.date_extra !== undefined && g1.j.firme?.[0]?.email === `o@api${R}-1.ro`, "/lista-mea: toate datele firmei");
const fara = await cere("lista-mea", {});
verifica(fara.status === 200 && fara.j.sesiune === "1" && fara.j.total === 0, "/lista-mea fără sesiune: sesiunea „1”, listă goală");
const rau = await cere("lista-mea", { sesiune: "a b" });
verifica(rau.status === 422, "/lista-mea cu sesiune invalidă → 422", String(rau.status));
const neaut = await cere("lista-mea", {}, "mrx_robot_necunoscut_000000000000000");
verifica(neaut.status === 401, "/lista-mea fără token bun → 401", String(neaut.status));
// Două sesiuni ale aceluiași token, deodată, de câte 5 ori: liste disjuncte.
const paralel = await Promise.all([...Array(10)].map((_, i) => cere("lista-mea", { sesiune: i % 2 ? `t${R}-2` : `t${R}-1` })));
const l1 = new Set(paralel.filter((_, i) => i % 2 === 0).map((r) => nrs(r.j)));
const l2 = new Set(paralel.filter((_, i) => i % 2 === 1).map((r) => nrs(r.j)));
const comune = [...l1].join(",").split(",").filter((x) => [...l2].join(",").split(",").includes(x));
verifica(l1.size === 1 && l2.size === 1 && comune.length === 0, "10 cereri /lista-mea deodată din 2 sesiuni: liste stabile, nicio firmă comună", `${[...l1]} / ${[...l2]}`);

// /publicare: două calculatoare deodată.
const lac = await Promise.all([cere("publicare", { actiune: "ia", sesiune: `t${R}-1` }, A), cere("publicare", { actiune: "ia", sesiune: "b-1" }, B)]);
const castig = lac.filter((r) => r.status === 200);
const refuz = lac.filter((r) => r.status === 409);
verifica(castig.length === 1 && refuz.length === 1, "/publicare „ia” din 2 calculatoare deodată: unul 200, celălalt 409", lac.map((r) => r.status).join(","));
const cine = castig[0]?.j.lacat.robot;
verifica(refuz[0]?.j.lacat?.robot === cine && /^Lacătul de publicare e la PC Proba [AB] \(sesiunea /.test(refuz[0]?.j.eroare?.mesaj ?? ""), "409: răspunsul spune cine ține lacătul și de când", refuz[0]?.j.eroare?.mesaj);
const tA = cine === "PC Proba A" ? A : B;
const tB = cine === "PC Proba A" ? B : A;
verifica((await cere("publicare", { actiune: "bate" }, tA)).status === 200, "„bate” de la deținător → 200");
verifica((await cere("publicare", { actiune: "bate" }, tB)).status === 409, "„bate” de la celălalt → 409");
const st = await cere("publicare", { actiune: "stare" }, tB);
verifica(st.status === 200 && st.j.lacat.robot === cine && !st.j.lacat.liber && st.j.lacat.expira_la, "„stare” → cine, din, expiră");
verifica((await cere("publicare", { actiune: "elibereaza" }, tA)).status === 200, "„elibereaza” → 200");
verifica((await cere("publicare", { actiune: "ia" }, tB)).status === 200, "după eliberare, celălalt îl ia");
verifica((await cere("publicare", { actiune: "fura" }, tB)).status === 422, "acțiune necunoscută → 422");
await cere("publicare", { actiune: "elibereaza" }, tB);

// /termina cu câmpurile noi.
const t = await cere("termina", {
  domeniu: `api${R}-1.ro`,
  link_demo: "https://demo.alfa.test/api${R}-1/",
  telefon_mobil: "0744 222 333",
  doar_whatsapp: true,
  problema: "formularul de contact nu trimite nimic.",
  puncte: ["* clienții vă scriu direct", "prețurile se văd din prima"],
  sesiune: `t${R}-1`,
});
verifica(t.status === 200 && t.j.firma?.nr_site > 0, "/termina cu mobil, „doar WhatsApp”, problemă, puncte → 200 și nr_site", `${t.status} ${t.j.firma?.nr_site}`);
const f = JSON.parse(sql(`select row_to_json(x) from (select telefon, este_mobil, date_extra from public.prospectare_firme where domeniu = 'api${R}-1.ro') x`));
verifica(f.telefon === "0744 222 333" && f.este_mobil && f.date_extra.doar_whatsapp === true && f.date_extra.problema === "formularul de contact nu trimite nimic." && f.date_extra.puncte.length === 2 && f.date_extra.telefon_fix === "021 400 0001",
  "firma are mobilul, „doar WhatsApp”, problema, punctele, fixul vechi");
const dupa = await cere("lista-mea", { sesiune: `t${R}-1` });
verifica(nrs(dupa.j) === "3", "după /termina, firma iese din /lista-mea", nrs(dupa.j));
const tr = await cere("termina", { domeniu: `api${R}-2.ro`, link_demo: "https://demo.alfa.test/api${R}-2/", puncte: "x".repeat(2500) });
verifica(tr.status === 422, "/termina: puncte prea lungi → 422", String(tr.status));

// /coada-email cât emailul e suspendat.
const ce = await cere("coada-email", {});
verifica(ce.status === 200 && ce.j.firme.length === 0 && ce.j.suspendat === true && ce.j.motiv === "livrabilitate, reparăm", "/coada-email: listă goală (emailul e suspendat)", `${ce.status} ${ce.j.firme?.length}`);
console.log(`\nProba API (39): ${ok} ok, ${picate} picate.`);
process.exit(picate ? 1 : 0);
