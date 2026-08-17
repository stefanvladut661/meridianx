import type { Lead } from "@/lib/supabase/types";
import {
  PALETTE,
  button,
  esc,
  shell,
  siteUrl,
  textBlock,
  type EmailContent,
} from "./shell";

/**
 * Confirmarea către client (FAZA 6).
 *
 * Două voci, aceeași agenție (CLAUDE.md §4):
 * - VIDEO: direct, sigur pe el, puțin obraznic. Clientul decide rapid și
 *   preferă vocea, deci emailul îl împinge spre telefon, nu spre așteptare.
 * - SOFTWARE: competent, calm, precis. Clientul compară și decide lent,
 *   deci emailul îi dă exact ce urmează, în ordine, cu termene.
 *
 * Nici una dintre variante nu se scuză și nu e vagă. Vocabularul e cel din
 * butonul pe care l-a apăsat: dacă a cerut un audit, scrie „audit”, nu
 * „solicitare”.
 */

/** Ce a apăsat clientul → cum numim lucrul, peste tot, la fel. */
function requestNoun(lead: Lead): string {
  if (lead.source === "video-audit") return "auditul de campanii";
  if (lead.source === "software-brief") return "brief-ul";
  if (lead.source === "software-fonduri") return "cererea pentru proiectul finanțat";
  return "cererea de ofertă";
}

function paragraph(text: string, color: string): string {
  return `<p style="margin:0 0 16px;font:400 16px/1.7 -apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:${color}">${text}</p>`;
}

function stepList(
  steps: string[],
  theme: (typeof PALETTE)[keyof typeof PALETTE]
): string {
  const items = steps
    .map(
      (step, index) => `
      <tr>
        <td style="padding:0 14px 14px 0;vertical-align:top;font:600 12px/1.7 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:1.4px;color:${theme.accent}">${String(index + 1).padStart(2, "0")}</td>
        <td style="padding:0 0 14px;vertical-align:top;font:400 15px/1.65 -apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:${theme.fg}">${step}</td>
      </tr>`
    )
    .join("");
  return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:24px 0 0">${items}</table>`;
}

export function leadConfirmationEmail(lead: Lead): EmailContent {
  const firstName = lead.name.trim().split(/\s+/)[0] ?? lead.name;
  const noun = requestNoun(lead);
  const phone = process.env.NEXT_PUBLIC_PHONE;

  if (lead.division === "video") {
    const theme = PALETTE.video;
    const subject = `Am primit ${noun}. Te sunăm.`;

    const html = shell({
      theme,
      eyebrow: "MERIDIAN · Video",
      title: `Am primit, ${esc(firstName)}.`,
      preheader: "Te sunăm în maximum o zi lucrătoare. Dacă e urgent, sună tu — răspundem.",
      body: `
        ${paragraph(`${esc(noun.charAt(0).toUpperCase() + noun.slice(1))} a ajuns la noi și e deja pe listă. Te sunăm în maximum o zi lucrătoare.`, theme.fg)}
        ${paragraph("Nu-ți trimitem între timp un chestionar de zece pagini. La telefon aflăm în cinci minute ce ai de filmat și îți spunem pe loc dacă e ceva ce facem bine.", theme.muted)}
        ${
          phone
            ? paragraph(`Dacă nu ai chef să aștepți — și nu te-am condamna — sună tu.`, theme.muted) +
              button(`Sună ${phone}`, `tel:${phone.replace(/[^\d+]/g, "")}`, theme)
            : button("Vezi portofoliul", `${siteUrl()}/video/portofoliu`, theme)
        }
      `,
      footer: `MERIDIAN — producție video și campanii. Ai primit acest email pentru că ai completat un formular pe ${esc(siteUrl().replace(/^https?:\/\//, ""))}.`,
    });

    const text = textBlock([
      `Am primit, ${firstName}.`,
      "",
      `${noun.charAt(0).toUpperCase() + noun.slice(1)} a ajuns la noi. Te sunăm în maximum o zi lucrătoare.`,
      "",
      "La telefon aflăm în cinci minute ce ai de filmat și îți spunem pe loc dacă e ceva ce facem bine.",
      phone ? `\nDacă nu ai chef să aștepți, sună tu: ${phone}` : null,
      "",
      "— MERIDIAN, divizia video",
    ]);

    return { subject, html, text };
  }

  // ---- SOFTWARE: competent, calm, precis ----
  const theme = PALETTE.software;
  const subject = `Am primit ${noun}. Iată ce urmează.`;

  const steps = lead.isFunded
    ? [
        "<strong>Astăzi sau mâine</strong> — citim ce ai scris și verificăm dacă termenul tău de decontare încape în calendarul nostru.",
        "<strong>În maximum o zi lucrătoare</strong> — primești un răspuns scris: dacă putem, cu ce obiect, și o primă estimare de interval.",
        "<strong>Apoi</strong> — o discuție de descoperire, gratuită, la tine sau online, după care primești oferta defalcată pe capitole de cheltuieli.",
      ]
    : [
        "<strong>În maximum o zi lucrătoare</strong> — primești un răspuns scris de la un om, nu o confirmare automată.",
        "<strong>Descoperire</strong> — un call de o oră, gratuit și fără angajament, în care ne spui cum lucrezi acum.",
        "<strong>Propunere</strong> — specificație pe capitole, preț fix pe etape, calendar cu date. O citești înainte să plătești ceva.",
      ];

  const fundedNote = lead.isFunded
    ? paragraph(
        `Ai marcat că proiectul e finanțat. Am notat asta cu prioritate — la finanțări, termenul contează mai mult decât orice altceva.`,
        theme.accent
      )
    : "";

  const html = shell({
    theme,
    eyebrow: "MERIDIAN · Software",
    title: `Am primit ${esc(noun)}, ${esc(firstName)}.`,
    preheader: "Răspuns scris în maximum o zi lucrătoare. Mai jos, ce urmează pas cu pas.",
    body: `
      ${paragraph("Nu e nevoie să faci nimic acum. Mai jos e exact ce urmează și în cât timp.", theme.fg)}
      ${fundedNote}
      ${stepList(steps, theme)}
      ${paragraph("Dacă între timp îți amintești ceva important, răspunde direct la acest email — ajunge la aceeași persoană care îți citește cererea.", theme.muted)}
      ${button("Vezi cum lucrăm", `${siteUrl()}/software/proces`, theme)}
    `,
    footer: `MERIDIAN — web și aplicații la comandă. Ai primit acest email pentru că ai completat un formular pe ${esc(siteUrl().replace(/^https?:\/\//, ""))}.`,
  });

  const text = textBlock([
    `Am primit ${noun}, ${firstName}.`,
    "",
    "Nu e nevoie să faci nimic acum. Iată ce urmează:",
    "",
    ...steps.map((step, index) => `${String(index + 1).padStart(2, "0")}. ${step.replace(/<[^>]+>/g, "")}`),
    "",
    lead.isFunded
      ? "Ai marcat că proiectul e finanțat — l-am notat cu prioritate.\n"
      : null,
    "Dacă îți amintești ceva important, răspunde direct la acest email.",
    "",
    "— MERIDIAN, divizia software",
  ]);

  return { subject, html, text };
}
