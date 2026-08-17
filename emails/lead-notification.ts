import type { Lead } from "@/lib/supabase/types";
import { STATUS_LABELS } from "@/lib/supabase/types";
import {
  PALETTE,
  button,
  esc,
  row,
  shell,
  siteUrl,
  textBlock,
  type EmailContent,
} from "./shell";

/**
 * Notificarea către admin la fiecare lead nou (FAZA 6).
 *
 * Subiectul e proiectat pentru TRIAJ DIN INBOX, fără să deschizi mailul:
 *   [SOFTWARE · FONDURI] Ion Popescu · 15.000–30.000 € · software-brief
 * divizie, marcaj de fonduri, nume, buget, formular sursă. Lead-urile din
 * segmentul „fonduri" sunt cele mai valoroase (brief-ul o spune explicit),
 * deci se văd primele în listă, nu după ce deschizi zece mailuri.
 */

const DIVISION_LABEL = { video: "VIDEO", software: "SOFTWARE" } as const;

export function leadNotificationEmail(lead: Lead): EmailContent {
  const theme = PALETTE.admin;
  const marker = lead.isFunded
    ? `[${DIVISION_LABEL[lead.division]} · FONDURI]`
    : `[${DIVISION_LABEL[lead.division]}]`;

  const subjectParts = [
    marker,
    lead.company ? `${lead.name} (${lead.company})` : lead.name,
    lead.budgetRange ?? "buget nespecificat",
    lead.source,
  ];
  const subject = subjectParts.join(" · ");

  const dashboardUrl = `${siteUrl()}/admin?lead=${encodeURIComponent(lead.id)}`;

  const contactRows = [
    row("Nume", lead.name, theme),
    row("Companie", lead.company, theme),
    row("Telefon", lead.phone, theme),
    row("Email", lead.email, theme),
  ].join("");

  const projectRows = [
    row("Tip proiect", lead.projectType, theme),
    row("Buget", lead.budgetRange, theme, { highlight: true }),
    row("Termen", lead.timeline, theme),
    row("Fonduri", lead.isFunded ? "DA — prioritate" : null, theme, {
      highlight: true,
    }),
  ].join("");

  const originRows = [
    row("Formular", lead.source, theme),
    row("Limbă", lead.locale.toUpperCase(), theme),
    row("Campanie", lead.utm.campaign, theme),
    row("Sursă UTM", lead.utm.source, theme),
    row("Mediu UTM", lead.utm.medium, theme),
    row("Referrer", lead.referrer, theme),
  ].join("");

  const section = (label: string, rows: string) =>
    rows
      ? `<p style="margin:26px 0 4px;font:600 11px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:2px;text-transform:uppercase;color:${theme.muted}">${esc(label)}</p>
         <table role="presentation" cellpadding="0" cellspacing="0" width="100%">${rows}</table>`
      : "";

  const message = lead.message
    ? `<p style="margin:26px 0 4px;font:600 11px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:2px;text-transform:uppercase;color:${theme.muted}">Mesaj</p>
       <div style="padding:16px;border-left:2px solid ${theme.accent};background:rgba(255,255,255,0.02);font:400 15px/1.65 -apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:${theme.fg};white-space:pre-wrap">${esc(lead.message)}</div>`
    : "";

  // Acțiunea principală e deschiderea lead-ului; canalul de contact e un
  // link secundar, ales după ce a lăsat clientul. Două butoane pline unul
  // sub altul într-un email nu ajută pe nimeni să decidă.
  const contact = lead.phone
    ? `<a href="tel:${esc(lead.phone.replace(/[^\d+]/g, ""))}" style="color:${theme.accent};text-decoration:underline">Sună ${esc(lead.phone)}</a>`
    : lead.email
      ? `<a href="mailto:${esc(lead.email)}" style="color:${theme.accent};text-decoration:underline">Răspunde pe email</a>`
      : "";

  const reply = contact
    ? `<p style="margin:20px 0 0;font:400 14px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:${theme.muted}">Răspuns rapid: ${contact}</p>`
    : "";

  const html = shell({
    theme,
    eyebrow: `Lead nou · ${DIVISION_LABEL[lead.division]}${lead.isFunded ? " · FONDURI" : ""}`,
    title: lead.company ? `${lead.name} — ${lead.company}` : lead.name,
    preheader: `${lead.budgetRange ?? "Buget nespecificat"} · ${lead.source} · ${lead.phone ?? lead.email ?? ""}`,
    body: `
      ${section("Contact", contactRows)}
      ${section("Proiect", projectRows)}
      ${message}
      ${section("Proveniență", originRows)}
      ${button("Deschide în dashboard", dashboardUrl, theme)}
      ${reply}
    `,
    footer: `Status curent: ${esc(STATUS_LABELS[lead.status])}. Notificare automată MERIDIAN — nu răspunde la acest email, mergi în dashboard.`,
  });

  const text = textBlock([
    `LEAD NOU — ${DIVISION_LABEL[lead.division]}${lead.isFunded ? " (FONDURI)" : ""}`,
    "",
    `Nume:      ${lead.name}`,
    lead.company ? `Companie:  ${lead.company}` : null,
    lead.phone ? `Telefon:   ${lead.phone}` : null,
    lead.email ? `Email:     ${lead.email}` : null,
    "",
    lead.projectType ? `Tip:       ${lead.projectType}` : null,
    lead.budgetRange ? `Buget:     ${lead.budgetRange}` : null,
    lead.timeline ? `Termen:    ${lead.timeline}` : null,
    lead.isFunded ? "Fonduri:   DA — prioritate" : null,
    "",
    lead.message ? `Mesaj:\n${lead.message}\n` : null,
    `Formular:  ${lead.source}`,
    lead.utm.campaign ? `Campanie:  ${lead.utm.campaign}` : null,
    "",
    `Dashboard: ${dashboardUrl}`,
  ]);

  return { subject, html, text };
}
