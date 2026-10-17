import type { QuestionnaireConfig } from "@/components/site/questionnaire/types";
import { cleanAnswer } from "@/components/site/questionnaire/registry";
import { PALETTE, button, esc, shell, siteUrl, textBlock, type EmailContent } from "./shell";

/**
 * Răspunsurile unui chestionar de descoperire, către cutia de lead-uri.
 *
 * Spre deosebire de notificarea de lead, aici conținutul E mesajul:
 * fiecare întrebare cu răspunsul ei, complet, fără plafonul de 5.000 de
 * caractere al câmpului `message`. Subiectul se vede din listă:
 *   [SOFTWARE · CHESTIONAR] Diana Claudia Filip · dianafilip.com
 */

export function questionnaireEmail(input: {
  config: QuestionnaireConfig;
  name: string;
  email: string | null;
  answers: Record<string, string>;
  leadId: string | null;
}): EmailContent {
  const { config, name, email, answers, leadId } = input;
  const theme = PALETTE.admin;

  const items = config.questions
    .map((question, index) => ({
      number: index + 1,
      question,
      answer: cleanAnswer(answers[question.id] ?? ""),
    }))
    .filter((item) => item.answer !== "");

  const subject = `[SOFTWARE · CHESTIONAR] ${name} · ${config.subject}`;

  const blocks = items
    .map(
      (item) => `
      <p style="margin:26px 0 6px;font:600 11px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:1.6px;text-transform:uppercase;color:${theme.muted}">${esc(String(item.number).padStart(2, "0"))} · ${esc(item.question.section)}</p>
      <p style="margin:0 0 8px;font:600 16px/1.45 -apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:${theme.fg}">${esc(item.question.title)}</p>
      <div style="padding:14px 16px;border-left:2px solid ${theme.accent};background:rgba(255,255,255,0.02);font:400 15px/1.65 -apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:${theme.fg};white-space:pre-wrap">${esc(item.answer)}</div>`
    )
    .join("");

  const skipped = config.questions.length - items.length;
  const summary = `<p style="margin:0;font:400 14px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:${theme.muted}">${esc(
    `${items.length} din ${config.questions.length} întrebări au răspuns${skipped ? `, ${skipped} fără` : ""}.`
  )}${email ? ` Răspunde direct: <a href="mailto:${esc(email)}" style="color:${theme.accent}">${esc(email)}</a>.` : ""}</p>`;

  const dashboard = leadId
    ? button("Deschide lead-ul în dashboard", `${siteUrl()}/admin?lead=${encodeURIComponent(leadId)}`, theme)
    : "";

  const html = shell({
    theme,
    eyebrow: `Chestionar · ${config.subject}`,
    title: `${name} a trimis răspunsurile`,
    preheader: `${items.length} răspunsuri · ${config.clientCompany}`,
    body: `${summary}${blocks}${dashboard}`,
    footer: `Trimis din chestionarul de pe ${esc(siteUrl())}/chestionar/${esc(config.slug)}. Răspunsurile complete sunt și în istoricul lead-ului.`,
  });

  const text = textBlock([
    `CHESTIONAR — ${config.subject}`,
    `${name}${email ? ` · ${email}` : ""}`,
    `${items.length} din ${config.questions.length} întrebări au răspuns.`,
    "",
    ...items.flatMap((item) => [
      `${item.number}. ${item.question.title}`,
      item.answer,
      "",
    ]),
    leadId ? `Dashboard: ${siteUrl()}/admin?lead=${leadId}` : null,
  ]);

  return { subject, html, text };
}
