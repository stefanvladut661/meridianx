#!/usr/bin/env node
/**
 * Verificarea contractului HTTP al backendului, pe un server care rulează.
 *
 *   npm run dev            (într-un terminal)
 *   npm run verify:backend (în altul)
 *
 * DE CE EXISTĂ: fără proiect Supabase și fără cheie Resend, singurul lucru
 * verificabil cu adevărat e contractul — coduri de status, forma
 * răspunsurilor, gărzile de autentificare, degradarea fără configurare.
 * Făcut cu mâna, se face o dată; făcut aici, se face după fiecare
 * modificare — inclusiv după ce baza chiar există.
 *
 * Fiecare test folosește alt `X-Forwarded-For`, ca plafoanele să nu se
 * scurgă între teste. Excepția e chiar testul care verifică plafonul.
 *
 * Zero dependențe: `fetch` e în Node de la 18.
 */

const BASE = (process.argv[2] ?? process.env.VERIFY_BASE_URL ?? "http://localhost:3000").replace(
  /\/$/,
  ""
);
const UUID = "00000000-0000-4000-8000-000000000000";

const GREEN = "\u001b[32m";
const RED = "\u001b[31m";
const DIM = "\u001b[2m";
const OFF = "\u001b[0m";

let passed = 0;
const failures = [];

function check(name, condition, detail) {
  if (condition) {
    passed += 1;
    console.log(`${GREEN}OK${OFF}    ${name}`);
  } else {
    failures.push(name);
    console.log(`${RED}PICAT${OFF} ${name}${detail ? `\n      ${DIM}${detail}${OFF}` : ""}`);
  }
}

let ipCounter = 0;
function nextIp() {
  ipCounter += 1;
  return `203.0.113.${ipCounter}`;
}

async function call(path, { method = "GET", body, ip = nextIp(), raw } = {}) {
  const response = await fetch(`${BASE}${path}`, {
    method,
    redirect: "manual",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": ip,
    },
    body: raw ?? (body === undefined ? undefined : JSON.stringify(body)),
  });

  let json = null;
  const text = await response.text();
  try {
    json = JSON.parse(text);
  } catch {
    /* CSV, HTML sau redirect — textul rămâne disponibil */
  }
  return { status: response.status, json, text, headers: response.headers };
}

/** Un lead valid, marcat clar ca test. */
function lead(overrides = {}) {
  return {
    division: "video",
    source: "verify-script",
    locale: "ro",
    name: "Test Verificare",
    email: "verificare@example.com",
    message: "Lead generat de scripts/verify-backend.mjs.",
    ...overrides,
  };
}

async function main() {
  console.log(`\nVerific backendul MERIDIAN pe ${BASE}\n`);

  // --- Sănătate ------------------------------------------------------------
  const health = await call("/api/health");
  check("GET /api/health răspunde 200", health.status === 200, `primit ${health.status}`);
  check(
    "health raportează toate verificările de configurare",
    Boolean(health.json?.checks) &&
      [
        "siteUrl",
        "supabaseWrite",
        "supabaseAuth",
        "adminAllowlist",
        "email",
        "leadRecipients",
      ].every((key) => typeof health.json.checks[key] === "boolean"),
    JSON.stringify(health.json)
  );
  check(
    "health nu scurge diagnostic de bază fără sesiune de admin",
    health.json?.database === undefined,
    "cheia `database` nu are ce căuta într-un răspuns public"
  );

  const configured = health.json?.checks?.supabaseWrite === true;
  console.log(
    `${DIM}      Supabase ${
      configured ? "configurat" : "NEconfigurat"
    } — testele de mai jos se așteaptă la comportamentul potrivit.${OFF}\n`
  );

  // --- POST /api/leads -----------------------------------------------------
  const honeypot = await call("/api/leads", {
    method: "POST",
    body: lead({ website: "http://spam.example" }),
  });
  check(
    "honeypot → 200 cu id gol (botul vede succes, nimic nu se salvează)",
    honeypot.status === 200 && honeypot.json?.ok === true && honeypot.json?.id === "",
    `${honeypot.status} ${JSON.stringify(honeypot.json)}`
  );

  const badJson = await call("/api/leads", { method: "POST", raw: "{ nu e json" });
  check(
    "JSON invalid → 400",
    badJson.status === 400 && badJson.json?.ok === false,
    `${badJson.status}`
  );

  const noContact = await call("/api/leads", {
    method: "POST",
    body: { division: "video", source: "verify-script", name: "Fara contact" },
  });
  check(
    "lead fără email și fără telefon → 400",
    noContact.status === 400,
    `${noContact.status} — schema cere cel puțin un canal de contact`
  );

  const badDivision = await call("/api/leads", {
    method: "POST",
    body: lead({ division: "marketing" }),
  });
  check("divizie inexistentă → 400", badDivision.status === 400, `${badDivision.status}`);

  const created = await call("/api/leads", { method: "POST", body: lead() });
  if (configured) {
    check(
      "lead valid → 201 cu id",
      created.status === 201 && typeof created.json?.id === "string" && created.json.id.length > 0,
      `${created.status} ${JSON.stringify(created.json)}`
    );
  } else {
    check(
      "fără Supabase: 201 sintetic în dev, 503 în producție",
      (created.status === 201 && created.json?.ok === true) || created.status === 503,
      `${created.status} ${JSON.stringify(created.json)}`
    );
  }

  // --- Rate limit ----------------------------------------------------------
  const burstIp = "198.51.100.7";
  let limited = null;
  for (let i = 0; i < 8 && !limited; i += 1) {
    const attempt = await call("/api/leads", {
      method: "POST",
      ip: burstIp,
      body: lead({ email: `rafala${i}@example.com` }),
    });
    if (attempt.status === 429) limited = attempt;
  }
  check("rafală de trimiteri de pe același IP → 429", limited !== null, "plafonul nu s-a aplicat");
  check(
    "429 vine cu Retry-After în secunde",
    limited !== null && Number(limited.headers.get("retry-after")) > 0,
    `Retry-After: ${limited ? limited.headers.get("retry-after") : "lipsă"}`
  );

  // --- Evenimente ----------------------------------------------------------
  const badEvent = await call(`/api/leads/${UUID}/events`, {
    method: "POST",
    body: { type: "" },
  });
  check("eveniment cu type gol → 400", badEvent.status === 400, `${badEvent.status}`);

  const event = await call(`/api/leads/${UUID}/events`, {
    method: "POST",
    body: { type: "brief_step", payload: { step: 1 } },
  });
  check(
    configured
      ? "eveniment pe un lead inexistent → 404, nu 500"
      : "fără Supabase: eveniment 201 în dev, 503 în producție",
    configured ? event.status === 404 : event.status === 201 || event.status === 503,
    `${event.status} ${JSON.stringify(event.json)}`
  );

  // --- Gărzile de autentificare --------------------------------------------
  const guarded = [
    ["GET", "/api/leads"],
    ["GET", `/api/leads/${UUID}`],
    ["PATCH", `/api/leads/${UUID}`],
    ["GET", "/api/leads/export"],
  ];
  for (const [method, path] of guarded) {
    const response = await call(path, {
      method,
      body: method === "PATCH" ? { status: "contacted" } : undefined,
    });
    check(
      `${method} ${path} fără sesiune → 401`,
      response.status === 401,
      `${response.status} ${JSON.stringify(response.json)}`
    );
  }

  const session = await call("/api/admin/session", { method: "POST" });
  check(
    "POST /api/admin/session fără sesiune → 401 (sau 503 fără Supabase)",
    session.status === 401 || session.status === 503,
    `${session.status}`
  );

  // --- Panoul --------------------------------------------------------------
  const admin = await call("/admin");
  check(
    configured
      ? "/admin fără sesiune → redirect la login"
      : "/admin fără configurare → ecranul de instalare, nu o eroare",
    configured ? admin.status === 307 || admin.status === 302 : admin.status === 200,
    `${admin.status}`
  );

  // --- Verdict -------------------------------------------------------------
  console.log(`\n${passed} verificări trecute, ${failures.length} picate.`);
  if (failures.length > 0) {
    console.log(`\n${RED}Au picat:${OFF}`);
    for (const name of failures) console.log(`  · ${name}`);
    process.exit(1);
  }
  console.log(`${GREEN}Contractul HTTP e respectat.${OFF}\n`);
}

main().catch((error) => {
  console.error(`\n${RED}Verificarea nu a putut rula.${OFF}`);
  console.error("Pornește serverul întâi: npm run dev — apoi npm run verify:backend");
  console.error(error.message);
  process.exit(1);
});
