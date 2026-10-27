import { randomUUID } from "node:crypto";
import { raiseAlert } from "./alerte";
import { INTARZIERE_MAXIMA_MS, MAX_INCERCARI, PAUZE_REINCERCARE_MS } from "./coada-shared";
import { CRON_ACTOR, db, type Db } from "./db";
import { HANDLERS } from "./handlers";
import { logEvent } from "./istoric";
import { PLATFORMA_LABEL, PLATFORME } from "./limite";
import type { Patch, StepContext, StepOutcome } from "./platforme";
import { toPostRow, type PostRow } from "./postari";
import { readSettings, setQueueRunning, type Setari } from "./setari";
import { momentLabel } from "./timp";

/**
 * O rulare a cozii. O pornește Supabase Cron la 5 minute (`/admin/postari/cron`)
 * sau omul („Rulează acum”). Ordinea:
 *
 * 1. Întreținerea conturilor (tokenurile). Un token care nu se mai poate
 *    reînnoi oprește coada și trimite alertă.
 * 2. Curățenia: copiile temporare rămase după postările terminate.
 * 3. Postările rămase în urmă peste 6 ore nu mai pleacă singure: devin
 *    „eșuate”, cu motivul, și le repui tu cu „Reîncearcă”.
 * 4. Luarea din coadă (`postari_claim`): fără dubluri, cu termen de lucru.
 * 5. Pașii fiecărei postări, cât ține bugetul de timp. Ce nu încape se reia la
 *    rularea următoare, de la pasul la care a rămas.
 *
 * Fiecare scriere într-un rând luat e condiționată de `lucrata_de` = rularea
 * asta: dacă rândul a fost scos între timp, rezultatul nu se mai scrie peste.
 */

/** Cât lucrează o rulare (funcția Vercel are 60 s). */
export const RUN_BUDGET_MS = 45_000;
/** Termenul de lucru al unui rând luat: mai mult decât poate trăi o rulare. */
const LEASE_SECONDS = 90;
/** Un pas nou pornește doar dacă mai sunt cel puțin atâtea milisecunde. */
const STEP_MARGIN_MS = 8_000;
/** Cât se verifică, după trimiterea în ciorne, dacă ai publicat-o din aplicație. */
const DRAFT_WATCH_MS = 7 * 24 * 60 * 60_000;
const DRAFT_RECHECK_MS = 30 * 60_000;

export interface RunSummary {
  runId: string;
  coadaOprita: boolean;
  luate: number;
  publicate: number;
  ciorne: number;
  asteapta: number;
  esuate: number;
  reincercari: number;
  intarziate: number;
  curatate: number;
  amanate: number;
  note: string[];
}

function nowIso(): string {
  return new Date().toISOString();
}

/** Scrie în rândul luat; `false` = rândul nu mai e al rulării (scos, preluat). */
async function writeOwned(admin: Db, post: PostRow, runId: string, patch: Patch): Promise<PostRow | null> {
  const { data, error } = await admin
    .from("postari")
    .update({ ...patch, updated_at: nowIso() })
    .eq("id", post.id)
    .eq("lucrata_de", runId)
    .select("*");
  if (error) {
    console.error("[postari] rândul n-a putut fi scris:", error.code, error.message);
    return null;
  }
  return data && data.length > 0 ? toPostRow(data[0] as Record<string, unknown>) : null;
}

const RELEASE: Patch = { lucrata_de: null, termen_lucru: null };

function label(post: PostRow): string {
  return `„${post.fisier}” pe ${PLATFORMA_LABEL[post.platforma]} (${momentLabel(post.programataLa)})`;
}

async function applyOutcome(admin: Db, post: PostRow, runId: string, outcome: StepOutcome, settings: Setari, summary: RunSummary): Promise<{ row: PostRow | null; again: boolean }> {
  const now = Date.now();
  switch (outcome.kind) {
    case "progress": {
      const row = await writeOwned(admin, post, runId, { ...outcome.patch, pas: outcome.pas });
      return { row, again: row !== null };
    }
    case "wait": {
      summary.asteapta += 1;
      const row = await writeOwned(admin, post, runId, { ...outcome.patch, ...(outcome.pas ? { pas: outcome.pas } : {}), urmatoarea_incercare: new Date(now + outcome.ms).toISOString(), ...RELEASE });
      return { row, again: false };
    }
    case "published": {
      summary.publicate += 1;
      const row = await writeOwned(admin, post, runId, { ...outcome.patch, stare: "publicata", publicata_la: nowIso(), pas: null, urmatoarea_incercare: null, verificare_pana_la: null, eroare: null, eroare_cod: null, ...RELEASE });
      if (row) await logEvent({ actor: CRON_ACTOR, zona: post.platforma, actiune: post.stare === "in_ciorne" ? "publicată din aplicație" : "publicată", tinta: post.id, rezultat: "ok", mesaj: `${label(post)}${row.link ? ` · ${row.link}` : ""}${row.avertisment ? ` · ${row.avertisment}` : ""}` });
      return { row, again: false };
    }
    case "drafted": {
      summary.ciorne += 1;
      const row = await writeOwned(admin, post, runId, {
        ...outcome.patch,
        stare: "in_ciorne",
        trimisa_la: nowIso(),
        pas: null,
        eroare: null,
        eroare_cod: null,
        verificare_pana_la: new Date(now + DRAFT_WATCH_MS).toISOString(),
        urmatoarea_incercare: new Date(now + DRAFT_RECHECK_MS).toISOString(),
        ...RELEASE,
      });
      if (row) await logEvent({ actor: CRON_ACTOR, zona: "tiktok", actiune: "trimisă în ciorne", tinta: post.id, rezultat: "ok", mesaj: `${label(post)}: o publici din aplicația TikTok, cu descrierea din „De publicat pe TikTok”.` });
      return { row, again: false };
    }
    case "blocked": {
      summary.asteapta += 1;
      // Neînceputa se întoarce la „planificată” (se poate scoate, iar regula celor 6 ore o prinde).
      const row = await writeOwned(admin, post, runId, { ...outcome.patch, stare: post.pas || post.stare === "in_ciorne" ? post.stare : "planificata", eroare: outcome.message, eroare_cod: outcome.code, urmatoarea_incercare: new Date(now + outcome.ms).toISOString(), ...RELEASE });
      if (outcome.stopQueue) await stopQueue(outcome.message, outcome.code, settings);
      return { row, again: false };
    }
    case "error": {
      // O ciornă deja trimisă nu „eșuează” la o verificare: se verifică din nou mai târziu.
      if (post.stare === "in_ciorne") {
        const row = await writeOwned(admin, post, runId, { urmatoarea_incercare: new Date(now + DRAFT_RECHECK_MS).toISOString(), ...RELEASE });
        return { row, again: false };
      }
      const attempts = post.incercari + 1;
      const final = outcome.permanent || attempts >= MAX_INCERCARI;
      const base: Patch = { ...outcome.patch, incercari: attempts, eroare: outcome.message.slice(0, 1000), eroare_cod: outcome.code.slice(0, 120), eroare_la: nowIso(), ...RELEASE };
      if (final) {
        summary.esuate += 1;
        const row = await writeOwned(admin, post, runId, { ...base, stare: "esuata", urmatoarea_incercare: null });
        if (row) {
          await logEvent({ actor: CRON_ACTOR, zona: post.platforma, actiune: "eșuată", tinta: post.id, rezultat: "eroare", mesaj: `${label(post)}, după ${attempts} ${attempts === 1 ? "încercare" : "încercări"}: ${outcome.message}` });
          await raiseAlert({ cheie: `esuata:${post.id}`, tip: "postare_esuata", subiect: `n-a plecat ${post.fisier}`, mesaj: `Postarea ${label(post)} a eșuat după ${attempts} ${attempts === 1 ? "încercare" : "încercări"}.\n\nMotivul: ${outcome.message}\n\nO repui din coadă, cu „Reîncearcă”.` }, settings.emailAlerte);
        }
        return { row, again: false };
      }
      summary.reincercari += 1;
      const pause = PAUZE_REINCERCARE_MS[Math.min(attempts - 1, PAUZE_REINCERCARE_MS.length - 1)];
      const row = await writeOwned(admin, post, runId, { ...base, urmatoarea_incercare: new Date(now + pause).toISOString() });
      if (row) await logEvent({ actor: CRON_ACTOR, zona: post.platforma, actiune: "încercare ratată", tinta: post.id, rezultat: "eroare", mesaj: `${label(post)}, încercarea ${attempts} din ${MAX_INCERCARI}: ${outcome.message}` });
      return { row, again: false };
    }
  }
}

async function stopQueue(message: string, code: string, settings: Setari): Promise<void> {
  const stopped = await setQueueRunning(false, message, CRON_ACTOR, true);
  if (stopped.ok && stopped.data.changed) {
    await logEvent({ actor: CRON_ACTOR, zona: "coada", actiune: "coadă oprită automat", rezultat: "eroare", mesaj: message, detalii: { cod: code } });
    await raiseAlert({ cheie: `coada_oprita:${code}`, tip: "coada_oprita", subiect: "coada s-a oprit", mesaj: `Coada de postări s-a oprit singură.\n\nMotivul: ${message}\n\nDupă ce rezolvi, pornește-o din nou din admin: „Pornește coada”.` }, settings.emailAlerte);
  }
}

/** Copiile temporare rămase după postările terminate (o publicare reușită le șterge pe loc; aici se prind restul). */
async function sweep(admin: Db, ctx: StepContext, summary: RunSummary): Promise<void> {
  const { data } = await admin.from("postari").select("*").in("stare", ["publicata", "esuata", "scoasa"]).not("stocare_cale", "is", null).limit(10);
  for (const raw of data ?? []) {
    if (Date.now() > ctx.deadline - STEP_MARGIN_MS) return;
    const post = toPostRow(raw as Record<string, unknown>);
    const handler = HANDLERS[post.platforma];
    if (!handler.cleanup) continue;
    const patch = await handler.cleanup(post, ctx).catch(() => null);
    if (patch) {
      await admin.from("postari").update({ ...patch, updated_at: nowIso() }).eq("id", post.id).eq("stare", post.stare);
      summary.curatate += 1;
    }
  }
}

/** Postările care n-au pornit la peste 6 ore după ora lor (coada oprită, cron neconfigurat). */
async function markLate(admin: Db, summary: RunSummary): Promise<void> {
  const cutoff = new Date(Date.now() - INTARZIERE_MAXIMA_MS).toISOString();
  const { data, error } = await admin
    .from("postari")
    .update({ stare: "esuata", eroare: "N-a pornit la timp: au trecut peste 6 ore de la ora din plan (coada a fost oprită sau n-a rulat). Nu pleacă singură la o oră pe care n-ai ales-o: apasă „Reîncearcă” ca să plece acum.", eroare_cod: "intarziata", eroare_la: nowIso(), urmatoarea_incercare: null, updated_at: nowIso() })
    .eq("stare", "planificata")
    .lt("programata_la", cutoff)
    .or(`reluata_la.is.null,reluata_la.lt.${cutoff}`)
    .or(`termen_lucru.is.null,termen_lucru.lt.${nowIso()}`)
    // PostgREST aplică filtrele `or` și pe rândurile întoarse de UPDATE: coloanele lor trebuie să fie în select.
    .select("id, fisier, platforma, programata_la, reluata_la, termen_lucru");
  if (error) {
    console.error("[postari] întârziatele n-au putut fi marcate:", error.code, error.message);
    return;
  }
  for (const row of data ?? []) {
    summary.intarziate += 1;
    await logEvent({ actor: CRON_ACTOR, zona: "coada", actiune: "rămasă în urmă", tinta: String(row.id), rezultat: "eroare", mesaj: `„${row.fisier}” pe ${PLATFORMA_LABEL[row.platforma as "instagram" | "tiktok"]} (${momentLabel(String(row.programata_la))}) n-a pornit în 6 ore; așteaptă „Reîncearcă”.` });
  }
}

export async function runQueue(options: { source: "cron" | "manual"; actor: string; budgetMs?: number }): Promise<{ ok: true; summary: RunSummary } | { ok: false; message: string }> {
  const admin = db();
  if (!admin) return { ok: false, message: "Supabase nu e configurat." };
  const started = Date.now();
  const deadline = started + (options.budgetMs ?? RUN_BUDGET_MS);
  const runId = randomUUID();
  const summary: RunSummary = { runId, coadaOprita: false, luate: 0, publicate: 0, ciorne: 0, asteapta: 0, esuate: 0, reincercari: 0, intarziate: 0, curatate: 0, amanate: 0, note: [] };

  const { error: runError } = await admin.from("postari_rulari").insert({ id: runId, sursa: options.source, actor: options.actor.slice(0, 200) });
  if (runError) return { ok: false, message: runError.code === "42P01" || runError.code === "PGRST205" ? "Tabelele cozii lipsesc: rulează migrarea 26 în Supabase → SQL Editor." : `Rularea n-a putut porni: ${runError.message}` };

  let fatal: string | null = null;
  try {
    const settingsResult = await readSettings();
    if (!settingsResult.ok) throw new Error(settingsResult.message);
    let settings = settingsResult.data;
    const ctx: StepContext = { runId, deadline, settings, admin, save: (post, patch) => writeOwned(admin, post, runId, patch) };

    // 1. Conturile: tokenurile se reînnoiesc chiar și când coada e oprită (altfel expiră).
    for (const platform of PLATFORME) {
      const handler = HANDLERS[platform];
      if (!handler.maintain) continue;
      const outcome = await handler.maintain(ctx).catch((error: unknown) => ({ notes: [`${PLATFORMA_LABEL[platform]}: întreținerea a aruncat (${error instanceof Error ? error.message : "necunoscut"})`] }) as Awaited<ReturnType<NonNullable<typeof handler.maintain>>>);
      summary.note.push(...outcome.notes);
      if (outcome.stopQueue) await stopQueue(outcome.stopQueue.message, outcome.stopQueue.code, settings);
    }

    // 2. Curățenia.
    await sweep(admin, ctx, summary);

    const fresh = await readSettings();
    if (fresh.ok) settings = fresh.data;
    ctx.settings = settings;
    if (!settings.coadaPornita) {
      summary.coadaOprita = true;
    } else {
      // 3. Rămase în urmă.
      await markLate(admin, summary);

      // 4. Luarea din coadă.
      const { data: claimed, error: claimError } = await admin.rpc("postari_claim", { p_run: runId, p_lease_seconds: LEASE_SECONDS, p_limit: 6 });
      if (claimError) throw new Error(claimError.code === "PGRST202" || claimError.code === "42883" ? "Funcția postari_claim lipsește: rulează migrarea 26 în Supabase → SQL Editor." : claimError.message);
      const queue = ((claimed ?? []) as Record<string, unknown>[]).map(toPostRow);
      summary.luate = queue.length;

      // 5. Pașii.
      for (let index = 0; index < queue.length; index += 1) {
        let post: PostRow | null = queue[index];
        let guard = 0;
        while (post && guard < 12) {
          guard += 1;
          if (Date.now() > deadline - STEP_MARGIN_MS) break;
          const handler = HANDLERS[post.platforma];
          let outcome: StepOutcome;
          try {
            outcome = await handler.step(post, ctx);
          } catch (error) {
            console.error("[postari] pasul a aruncat:", error instanceof Error ? error.message : error);
            outcome = { kind: "error", message: "Eroare neașteptată în admin. Se reîncearcă singur; dacă se repetă, vezi Vercel → Logs.", code: "exceptie", permanent: false };
          }
          const result = await applyOutcome(admin, post, runId, outcome, settings, summary);
          if (outcome.kind === "blocked" && outcome.stopQueue) {
            // Coada tocmai s-a oprit: restul rândurilor luate se eliberează mai jos.
            post = null;
            index = queue.length;
            break;
          }
          if (result.row && ["published", "error"].includes(outcome.kind) && result.row.stare !== "in_lucru" && handler.cleanup && result.row.stocareCale) {
            const patch = await handler.cleanup(result.row, ctx).catch(() => null);
            if (patch) await admin.from("postari").update({ ...patch, updated_at: nowIso() }).eq("id", result.row.id);
          }
          post = result.again ? result.row : null;
        }
      }

      // Ce n-a încăput în timp: rândurile se eliberează, rularea următoare le reia de unde au rămas.
      const { data: left } = await admin.from("postari").update({ ...RELEASE, updated_at: nowIso() }).eq("lucrata_de", runId).select("id");
      summary.amanate = (left ?? []).length;
    }
  } catch (error) {
    fatal = error instanceof Error ? error.message : "Rularea a aruncat.";
    console.error("[postari] rularea cozii:", fatal);
    await admin.from("postari").update({ ...RELEASE, updated_at: nowIso() }).eq("lucrata_de", runId);
  }

  const durata = Date.now() - started;
  await admin.from("postari_rulari").update({ terminat_la: nowIso(), durata_ms: durata, rezultat: summary, eroare: fatal?.slice(0, 1000) ?? null }).eq("id", runId);
  const busy = summary.luate + summary.intarziate + summary.curatate > 0 || fatal || options.source === "manual";
  if (busy) {
    await logEvent({
      actor: options.actor,
      zona: "coada",
      actiune: options.source === "manual" ? "rulare manuală" : "rulare",
      tinta: runId,
      rezultat: fatal ? "eroare" : "ok",
      mesaj: fatal ?? (summary.coadaOprita ? "Coada e oprită: nicio postare luată." : `${summary.luate} luate · ${summary.publicate} publicate · ${summary.ciorne} în ciorne · ${summary.asteapta} în așteptare · ${summary.reincercari} de reîncercat · ${summary.esuate} eșuate${summary.intarziate ? ` · ${summary.intarziate} rămase în urmă` : ""}${summary.amanate ? ` · ${summary.amanate} amânate la rularea următoare` : ""}`),
      detalii: { durata_ms: durata, note: summary.note.slice(0, 10) },
    });
  }
  if (fatal) return { ok: false, message: fatal };
  return { ok: true, summary };
}
