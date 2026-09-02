/**
 * Schelet HTML comun pentru emailurile tranzacționale (FAZA 6).
 *
 * DE CE HTML scris de mână și nu React Email: `resend` e instalat, dar
 * `@react-email/render` nu, iar CLAUDE.md §6.5 interzice adăugarea de
 * dependențe fără acord. Un email are oricum nevoie de tabele și stiluri
 * inline ca să arate la fel în Outlook — componentele n-ar fi scutit de
 * asta. Dacă se adaugă pachetul mai târziu, se schimbă doar fișierele din
 * `emails/`, nu și `lib/email/send.ts`.
 *
 * Paleta urmează divizia: emailul de la video e cald (tungsten), cel de
 * la software e rece (signal). Aceeași agenție, două voci — inclusiv în
 * inbox (CLAUDE.md §2).
 */

import type { Division } from "@/lib/division";

export interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

export const PALETTE: Record<
  Division | "admin",
  { bg: string; panel: string; line: string; fg: string; muted: string; accent: string; onAccent: string }
> = {
  video: {
    bg: "#08090c",
    panel: "#101319",
    line: "#232730",
    fg: "#ede8e0",
    muted: "#9aa0aa",
    accent: "#ff8c3b",
    onAccent: "#1a0e02",
  },
  software: {
    bg: "#060a12",
    panel: "#0d1421",
    line: "#1a2536",
    fg: "#dee5f0",
    muted: "#98a3b4",
    accent: "#4c7dff",
    onAccent: "#060a12",
  },
  admin: {
    bg: "#060a12",
    panel: "#0d1421",
    line: "#1a2536",
    fg: "#dee5f0",
    muted: "#98a3b4",
    accent: "#d9a441",
    onAccent: "#060a12",
  },
};

/** Escape obligatoriu: tot ce intră aici vine dintr-un formular public. */
export function esc(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function siteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
    "https://meridianx.ro"
  );
}

/** Un rând de date în tabelul de detalii. */
export function row(
  label: string,
  value: string | null | undefined,
  theme: (typeof PALETTE)[keyof typeof PALETTE],
  options: { highlight?: boolean } = {}
): string {
  if (!value) return "";
  return `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid ${theme.line};vertical-align:top;width:150px;font:600 11px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:1.4px;text-transform:uppercase;color:${theme.muted}">${esc(label)}</td>
        <td style="padding:10px 0;border-bottom:1px solid ${theme.line};vertical-align:top;font:400 15px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:${options.highlight ? theme.accent : theme.fg}">${esc(value)}</td>
      </tr>`;
}

export function button(
  label: string,
  href: string,
  theme: (typeof PALETTE)[keyof typeof PALETTE]
): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0 0">
      <tr><td style="border-radius:8px;background:${theme.accent}">
        <a href="${esc(href)}" style="display:inline-block;padding:13px 26px;font:600 15px/1 -apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:${theme.onAccent};text-decoration:none">${esc(label)}</a>
      </td></tr>
    </table>`;
}

/**
 * Învelișul complet. `preheader` e textul care apare în inbox lângă
 * subiect — dacă nu îl setezi, clientul de email ia primele cuvinte din
 * corp, ceea ce arată neîngrijit.
 */
export function shell({
  theme,
  eyebrow,
  title,
  preheader,
  body,
  footer,
}: {
  theme: (typeof PALETTE)[keyof typeof PALETTE];
  eyebrow: string;
  title: string;
  preheader: string;
  body: string;
  footer: string;
}): string {
  return `<!doctype html>
<html lang="ro">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark light">
<title>${esc(title)}</title>
</head>
<body style="margin:0;padding:0;background:${theme.bg};color:${theme.fg}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(preheader)}</div>
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:${theme.bg};padding:32px 16px">
  <tr><td align="center">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:560px;background:${theme.panel};border:1px solid ${theme.line};border-radius:12px">
      <tr><td style="padding:32px 32px 0">
        <p style="margin:0;font:600 11px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:2.4px;text-transform:uppercase;color:${theme.accent}">${esc(eyebrow)}</p>
        <h1 style="margin:14px 0 0;font:600 25px/1.25 -apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:${theme.fg}">${esc(title)}</h1>
      </td></tr>
      <tr><td style="padding:22px 32px 32px">${body}</td></tr>
    </table>
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:560px">
      <tr><td style="padding:20px 32px;font:400 12px/1.7 -apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:${theme.muted}">${footer}</td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

/** Varianta text. Nu e o formalitate: filtrele de spam o cer. */
export function textBlock(lines: Array<string | null | undefined>): string {
  return lines.filter((line) => line !== null && line !== undefined).join("\n");
}
