/**
 * Capturile din cardurile de proiect (/software, /software/proiecte).
 *
 *   node scripts/demo-posters.mjs [http://localhost:3100] [slug ...]
 *
 * Deschide fiecare demo în modul `?capture=1` (doar pânza, nescalată)
 * într-un Chrome headless, la mărimea exactă a pânzei, și salvează
 * public/software/proiecte/<slug>-{desktop,mobile}.webp.
 *
 * Capturile se fac sub prefers-reduced-motion: contoarele sunt deja la
 * valoarea finală și nimic nu e prins la jumătatea unei animații.
 * Cere un server (dev sau start) pornit la adresa dată.
 */
import { spawn } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "public", "software", "proiecte");
const args = process.argv.slice(2);
const BASE = args[0]?.startsWith("http") ? args.shift() : "http://localhost:3100";
const SLUGS = args.length ? args : ["prosperanta", "tablex", "zof", "elyssium", "art-install"];

/* Ecranul din care se face captura, dacă nu e primul din tur. */
const SCREEN = {
  // slug: { desktop: "id", mobile: "id" }
};

const CANVAS = { desktop: [1280, 800], mobile: [390, 844] };
const CHROME =
  process.env.CHROME ?? "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const profile = mkdtempSync(join(tmpdir(), "posters-"));
const port = 9600 + Math.floor(Math.random() * 300);
const chrome = spawn(
  CHROME,
  [
    "--headless=new",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    "--hide-scrollbars",
    "about:blank",
  ],
  { stdio: "ignore" }
);

let ws;
for (let i = 0; i < 60 && !ws; i++) {
  try {
    const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
    ws = new WebSocket(list.find((p) => p.type === "page").webSocketDebuggerUrl);
  } catch {
    await sleep(250);
  }
}
await new Promise((r) => (ws.onopen = r));
let id = 0;
const pending = new Map();
ws.onmessage = (m) => {
  const d = JSON.parse(m.data);
  if (d.id && pending.has(d.id)) {
    pending.get(d.id)(d);
    pending.delete(d.id);
  }
};
const send = (method, params = {}) =>
  new Promise((r) => {
    const i = ++id;
    pending.set(i, r);
    ws.send(JSON.stringify({ id: i, method, params }));
  });

const evaluate = async (expression) =>
  (await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true })).result
    ?.result?.value;

await send("Page.enable");
await send("Emulation.setEmulatedMedia", {
  features: [{ name: "prefers-reduced-motion", value: "reduce" }],
});

mkdirSync(OUT, { recursive: true });
for (const slug of SLUGS) {
  for (const device of ["desktop", "mobile"]) {
    const [w, h] = CANVAS[device];
    await send("Emulation.setDeviceMetricsOverride", {
      width: w,
      height: h,
      deviceScaleFactor: device === "mobile" ? 2 : 1.5,
      mobile: false,
    });
    const screen = SCREEN[slug]?.[device];
    const url = `${BASE}/software/proiecte/${slug}?capture=1&device=${device}${screen ? `&screen=${screen}` : ""}`;
    await send("Page.navigate", { url });
    /* Demo-ul se încarcă leneș (și, pe serverul de dev, se compilează la
       prima cerere): așteptăm până nu mai e ecranul de încărcare. */
    for (let t = 0; t < 60; t++) {
      await sleep(1000);
      const loading = await evaluate(
        `!document.getElementById("demo-capture") || document.body.innerText.includes("Se încarcă demo-ul")`
      );
      if (t >= 4 && !loading) break;
    }
    /* Bannerul de cookie-uri și indicatorul de dev al lui Next nu fac
       parte din demo: primul se închide cu „Doar necesare", al doilea
       se scoate din pagină. */
    await evaluate(`(() => {
      const b = [...document.querySelectorAll("button")].find((x) => /^Doar necesare$/i.test(x.textContent.trim()));
      b && b.click();
      document.querySelectorAll("nextjs-portal").forEach((e) => e.remove());
    })()`);
    await sleep(1500);
    const shot = await send("Page.captureScreenshot", {
      format: "png",
      clip: { x: 0, y: 0, width: w, height: h, scale: 1 },
    });
    const file = join(OUT, `${slug}-${device}.webp`);
    /* Afișate la cel mult ~700px (desktop) și ~170px (telefon) în card:
       ne oprim la 1280, respectiv 390 de pixeli lățime, x2 pe retina. */
    await sharp(Buffer.from(shot.result.data, "base64"))
      .resize({ width: device === "desktop" ? 1600 : 520 })
      .webp({ quality: 80 })
      .toFile(file);
    console.log(`${slug}-${device}.webp  ${(statSync(file).size / 1024).toFixed(0)} KB`);
  }
}

ws.close();
chrome.kill();
/* Profilul Chrome are sute de MB; nu-l lăsăm în %TEMP%. */
await sleep(800);
rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
process.exit(0);
