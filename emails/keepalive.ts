import type { DatabaseProbe, ProbeStep } from "@/lib/supabase/leads";
import {
  button,
  esc,
  row,
  shell,
  siteUrl,
  textBlock,
  type EmailContent,
  type EmailTheme,
} from "./shell";

/**
 * Emailul sondei automate: raportul săptămânal și alerta.
 *
 * Trebuie să se deosebească de un lead ÎNAINTE de a fi deschis — omul
 * primește puține oferte și nu trebuie să tresară la fiecare mail de la
 * MERIDIAN. Trei semnale, în ordinea în care le vede inbox-ul:
 *   1. numele expeditorului: „MERIDIAN · test automat”, nu „MERIDIAN”
 *      (se pune în `lib/email/send.ts`, nu aici);
 *   2. subiectul începe cu 🧪 [TEST AUTOMAT] — lead-urile încep cu
 *      [VIDEO] / [SOFTWARE];
 *   3. corpul e pe fond DESCHIS, cu o bandă plină sus. Toate celelalte
 *      emailuri ale agenției sunt întunecate.
 *
 * Alerta folosește aceleași trei semnale, în roșu, fiindcă e tot un mail
 * de sistem — dar unul care cere o acțiune.
 */

export interface KeepaliveReport {
  /** `report` = totul a mers, e raportul săptămânal. `alert` = ceva a picat. */
  kind: "report" | "alert";
  probe: DatabaseProbe;
  at: Date;
  /** Când vine următorul raport (doar pentru `report`). */
  nextReportAt: Date | null;
  /** Pagina proiectului în Supabase, dacă știm ref-ul. */
  dashboardUrl: string | null;
}

/** Fond deschis: opusul tuturor celorlalte emailuri MERIDIAN. */
const TEST_THEME: EmailTheme = {
  bg: "#e8ecf1",
  panel: "#ffffff",
  line: "#d6dce5",
  fg: "#161c26",
  muted: "#5d6773",
  accent: "#0f8a5f",
  onAccent: "#ffffff",
};

const ALERT_THEME: EmailTheme = {
  ...TEST_THEME,
  accent: "#c2372b",
};

const DATE_LONG = new Intl.DateTimeFormat("ro-RO", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Bucharest",
});

const DATE_SHORT = new Intl.DateTimeFormat("ro-RO", {
  day: "numeric",
  month: "short",
  timeZone: "Europe/Bucharest",
});

const TIME = new Intl.DateTimeFormat("ro-RO", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Bucharest",
});

const STEP_LABEL: Record<ProbeStep, string> = {
  ok: "OK",
  failed: "A PICAT",
  skipped: "sărit — pasul dinainte a picat",
};

function paragraph(text: string, theme: EmailTheme): string {
  return `<p style="margin:0 0 16px;font:400 16px/1.7 -apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:${theme.fg}">${text}</p>`;
}

function note(text: string, theme: EmailTheme): string {
  return `<div style="margin:24px 0 0;padding:16px;border-left:2px solid ${theme.accent};background:#f3f5f8;font:400 14px/1.65 -apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:${theme.muted}">${text}</div>`;
}

function stepValue(step: ProbeStep, okText: string, detail?: string): string {
  if (step === "ok") return `${STEP_LABEL.ok} · ${okText}`;
  if (step === "failed" && detail) return `${STEP_LABEL.failed} · ${detail}`;
  return STEP_LABEL[step];
}

export function keepaliveEmail(report: KeepaliveReport): EmailContent {
  return report.kind === "report" ? weeklyReport(report) : alert(report);
}

// ---------------------------------------------------------------------------
// Raportul săptămânal — totul a mers
// ---------------------------------------------------------------------------

function weeklyReport(report: KeepaliveReport): EmailContent {
  const theme = TEST_THEME;
  const { probe } = report;
  const when = `${DATE_LONG.format(report.at)}, ${TIME.format(report.at)}`;
  const leads =
    probe.leadCount === null
      ? "număr necunoscut de lead-uri"
      : probe.leadCount === 1
        ? "1 lead real în bază"
        : `${probe.leadCount} lead-uri reale în bază`;
  const next = report.nextReportAt ? DATE_LONG.format(report.nextReportAt) : null;

  const subject = `🧪 [TEST AUTOMAT] Supabase treaz · nu e ofertă · ${DATE_SHORT.format(report.at)}`;

  const checks = [
    row("Scriere", stepValue(probe.steps.insert, "rând de test scris"), theme),
    row("Citire", stepValue(probe.steps.read, "citit înapoi după id"), theme),
    row("Ștergere", stepValue(probe.steps.delete, "rândul de test nu mai există"), theme),
    row("Lead-uri", stepValue(probe.steps.count, leads), theme, { highlight: true }),
    row("Durată", `${probe.durationMs} ms, patru cereri`, theme),
    row("Email", "OK · îl citești", theme),
    next ? row("Următorul", next, theme) : "",
  ].join("");

  const html = shell({
    theme,
    banner: "Test automat · nu e ofertă",
    eyebrow: `Raport săptămânal · ${when}`,
    title: "Baza e trează. Lanțul merge.",
    preheader: `Sonda a scris, citit și șters un rând de test în ${probe.durationMs} ms. ${leads}.`,
    body: `
      ${paragraph(
        "Mailul ăsta îl trimite cron-ul de pe Vercel, nu un client. Dacă a ajuns, tot drumul unui lead real funcționează: Supabase răspunde, cheia de server e valabilă, Resend livrează.",
        theme
      )}
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%">${checks}</table>
      ${note(
        "<strong style=\"color:#161c26\">De ce există.</strong> Supabase pune pe pauză proiectele gratuite fără activitate suficientă în ultimele 7 zile — „câteva cereri pe zi” e pragul din documentație. Sonda atinge baza în fiecare zi, în liniște; raportul ăsta vine doar lunea. Dacă într-o zi baza nu răspunde, primești o alertă atunci, nu luni.",
        theme
      )}
    `,
    footer:
      "Rândul de test se șterge în aceeași rulare — nu apare în panou și nu intră în statistici. Dacă raportul lipsește două luni la rând, verifică Vercel → Settings → Cron Jobs.",
  });

  const text = textBlock([
    "TEST AUTOMAT — NU E OFERTĂ",
    `Raport săptămânal · ${when}`,
    "",
    "Baza e trează. Lanțul merge.",
    "",
    `Scriere:   ${stepValue(probe.steps.insert, "rând de test scris")}`,
    `Citire:    ${stepValue(probe.steps.read, "citit înapoi după id")}`,
    `Ștergere:  ${stepValue(probe.steps.delete, "rândul de test nu mai există")}`,
    `Lead-uri:  ${stepValue(probe.steps.count, leads)}`,
    `Durată:    ${probe.durationMs} ms, patru cereri`,
    next ? `Următorul: ${next}` : null,
    "",
    "Supabase pune pe pauză proiectele gratuite fără activitate suficientă în ultimele 7 zile.",
    "Sonda atinge baza zilnic, în liniște; raportul vine doar lunea. O bază care nu răspunde trimite alertă imediat.",
    "Rândul de test se șterge în aceeași rulare — nu apare în panou.",
  ]);

  return { subject, html, text };
}

// ---------------------------------------------------------------------------
// Alerta — ceva a picat
// ---------------------------------------------------------------------------

function alert(report: KeepaliveReport): EmailContent {
  const theme = ALERT_THEME;
  const { probe } = report;
  const when = `${DATE_LONG.format(report.at)}, ${TIME.format(report.at)}`;
  const detail = probe.detail ?? "fără detaliu";

  // Un proiect pus pe pauză nu mai are DNS: eroarea e de rețea, nu de SQL.
  const looksPaused = /fetch failed|ENOTFOUND|getaddrinfo|ECONNREFUSED/i.test(detail);

  const subject = `⛔ [ALERTĂ] Supabase nu răspunde · lead-urile nu se salvează · ${DATE_SHORT.format(report.at)}`;

  const checks = [
    row("Scriere", stepValue(probe.steps.insert, "rând de test scris", detail), theme, {
      highlight: probe.steps.insert === "failed",
    }),
    row("Citire", stepValue(probe.steps.read, "citit înapoi după id", detail), theme, {
      highlight: probe.steps.read === "failed",
    }),
    row("Ștergere", stepValue(probe.steps.delete, "rândul de test nu mai există", detail), theme, {
      highlight: probe.steps.delete === "failed",
    }),
    row("Numărătoare", stepValue(probe.steps.count, "lead-urile se citesc", detail), theme, {
      highlight: probe.steps.count === "failed",
    }),
    row("Durată", `${probe.durationMs} ms`, theme),
  ].join("");

  const steps = [
    report.dashboardUrl
      ? `Deschide proiectul în Supabase (butonul de mai jos). Dacă scrie <strong>Paused</strong>, apasă <strong>Restore project</strong> și așteaptă 2–5 minute.`
      : `Deschide proiectul în Supabase. Dacă scrie <strong>Paused</strong>, apasă <strong>Restore project</strong> și așteaptă 2–5 minute.`,
    `Confirmă: logat în <a href="${esc(siteUrl())}/admin" style="color:${theme.accent}">/admin</a>, deschide <a href="${esc(siteUrl())}/api/cron/keepalive/report" style="color:${theme.accent}">/api/cron/keepalive/report</a>. Primești raportul verde pe loc.`,
    `Dacă proiectul e activ și tot pică, verifică <strong>SUPABASE_SERVICE_ROLE_KEY</strong> și <strong>NEXT_PUBLIC_SUPABASE_URL</strong> în Vercel → Environment Variables.`,
  ]
    .map(
      (step) =>
        `<li style="margin:0 0 10px;padding-left:4px;font:400 15px/1.65 -apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:${theme.fg}">${step}</li>`
    )
    .join("");

  const leftover = probe.leftoverId
    ? note(
        `Rândul de test <strong style="color:#161c26">${esc(probe.leftoverId)}</strong> n-a putut fi șters și apare în panou ca „TEST AUTOMAT”. Nu e lead. Șterge-l din Supabase → Table Editor → leads.`,
        theme
      )
    : "";

  const html = shell({
    theme,
    banner: "Alertă automată · nu e ofertă",
    eyebrow: `Sonda zilnică · ${when}`,
    title: looksPaused ? "Supabase nu răspunde. Probabil e pe pauză." : "Sonda n-a putut scrie în bază.",
    preheader: `${detail}. Formularele de pe site răspund cu eroare până se rezolvă.`,
    body: `
      ${paragraph(
        "Cât timp e așa, formularele de pe site răspund „Nu putem prelua cererea chiar acum” și <strong>niciun lead nu se salvează</strong>. Telefonul și WhatsApp merg în continuare.",
        theme
      )}
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%">${checks}</table>
      <p style="margin:26px 0 8px;font:600 11px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:2px;text-transform:uppercase;color:${theme.muted}">Ce faci</p>
      <ol style="margin:0;padding:0 0 0 20px">${steps}</ol>
      ${report.dashboardUrl ? button("Deschide proiectul Supabase", report.dashboardUrl, theme) : ""}
      ${leftover}
    `,
    footer:
      "Alerta se repetă în fiecare zi cât timp sonda pică. Se oprește singură când baza răspunde din nou.",
  });

  const text = textBlock([
    "ALERTĂ AUTOMATĂ — NU E OFERTĂ",
    `Sonda zilnică · ${when}`,
    "",
    looksPaused ? "Supabase nu răspunde. Probabil e pe pauză." : "Sonda n-a putut scrie în bază.",
    "Cât timp e așa, formularele de pe site răspund cu eroare și niciun lead nu se salvează.",
    "",
    `Scriere:      ${stepValue(probe.steps.insert, "rând de test scris", detail)}`,
    `Citire:       ${stepValue(probe.steps.read, "citit înapoi după id", detail)}`,
    `Ștergere:     ${stepValue(probe.steps.delete, "rândul de test nu mai există", detail)}`,
    `Numărătoare:  ${stepValue(probe.steps.count, "lead-urile se citesc", detail)}`,
    "",
    "Ce faci:",
    "1. Deschide proiectul în Supabase. Dacă scrie Paused, apasă Restore project și așteaptă 2–5 minute.",
    `2. Confirmă: logat în /admin, deschide ${siteUrl()}/api/cron/keepalive/report.`,
    "3. Dacă proiectul e activ și tot pică, verifică cheile Supabase în Vercel → Environment Variables.",
    report.dashboardUrl ? `\nProiect: ${report.dashboardUrl}` : null,
    probe.leftoverId
      ? `\nRândul de test ${probe.leftoverId} n-a putut fi șters — șterge-l din Table Editor → leads.`
      : null,
  ]);

  return { subject, html, text };
}
