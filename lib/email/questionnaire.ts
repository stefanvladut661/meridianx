import { Resend } from "resend";
import type { QuestionnaireConfig } from "@/components/site/questionnaire/types";
import { questionnaireEmail } from "@/emails/questionnaire";

/**
 * Trimiterea răspunsurilor de chestionar.
 *
 * Aceleași variabile ca la lead-uri (RESEND_API_KEY, RESEND_FROM_EMAIL,
 * LEAD_NOTIFICATION_EMAIL) și aceeași cutie implicită, ca răspunsurile
 * să ajungă unde se citesc deja cererile. Ajutoarele din `send.ts` nu
 * sunt exportate, așa că logica de adresă e copiată aici în mic, nu
 * extrasă din fișierul fazei 6 (CLAUDE.md §6: duplicarea temporară e mai
 * ieftină decât un conflict).
 *
 * Nu aruncă niciodată: întoarce rezultatul, iar ruta decide ce îi spune
 * omului.
 */

const FROM =
  process.env.RESEND_FROM_EMAIL?.trim() || "MERIDIAN <notificari@meridianx.ro>";

/** Aceeași adresă implicită ca în `lib/email/send.ts`. */
const LEAD_INBOX = "buna.meridian@gmail.com";

function recipients(): string[] {
  return (process.env.LEAD_NOTIFICATION_EMAIL?.trim() || LEAD_INBOX)
    .split(",")
    .map((address) => address.trim())
    .filter(Boolean);
}

/** „MERIDIAN · chestionar" în lista din inbox, pe aceeași adresă verificată. */
function fromQuestionnaire(): string {
  const address = FROM.match(/<([^>]+)>/)?.[1]?.trim() || FROM;
  return `MERIDIAN · chestionar <${address}>`;
}

export type QuestionnaireSendStatus = "sent" | "skipped" | "failed";

export async function sendQuestionnaireEmail(input: {
  config: QuestionnaireConfig;
  name: string;
  email: string | null;
  answers: Record<string, string>;
  leadId: string | null;
}): Promise<QuestionnaireSendStatus> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.error("[chestionar] RESEND_API_KEY lipsește — răspunsurile nu au plecat pe email.");
    return "skipped";
  }

  const to = recipients();
  if (to.length === 0) return "skipped";

  try {
    const message = questionnaireEmail(input);
    const { error } = await new Resend(key).emails.send({
      from: fromQuestionnaire(),
      to,
      subject: message.subject,
      html: message.html,
      text: message.text,
      replyTo: input.email ?? undefined,
    });
    if (error) {
      console.error("[chestionar] emailul cu răspunsuri a eșuat:", error.message);
      return "failed";
    }
    return "sent";
  } catch (error) {
    console.error("[chestionar] emailul cu răspunsuri a aruncat:", error);
    return "failed";
  }
}
