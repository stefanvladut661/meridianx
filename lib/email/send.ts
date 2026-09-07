import { Resend } from "resend";
import type { Lead } from "@/lib/supabase/types";
import { recordEmailEvent } from "@/lib/supabase/leads";
import { leadNotificationEmail } from "@/emails/lead-notification";
import { leadConfirmationEmail } from "@/emails/lead-confirmation";

/**
 * Trimiterea emailurilor tranzacționale (FAZA 6).
 *
 * REGULA CARE GUVERNEAZĂ FIȘIERUL: un email eșuat NU are voie să strice
 * un lead. Lead-ul e deja în bază când se ajunge aici; dacă Resend cade,
 * expiră cheia sau domeniul nu e verificat, funcția loghează și merge mai
 * departe. Clientul vede confirmarea, iar lead-ul rămâne în dashboard.
 * Ce se pierde e notificarea, nu vânzarea.
 *
 * De aceea nimic de aici nu aruncă și nimic nu se `await`-ează blocant pe
 * calea critică a răspunsului HTTP.
 */

const FROM =
  process.env.RESEND_FROM_EMAIL ?? "MERIDIAN <notificari@meridianx.ro>";

/** Unde ajung cererile din formulare dacă nu e setat nimic în env. */
const LEAD_INBOX = "buna.meridian@gmail.com";

/**
 * Poate fi o listă separată prin virgulă. Adresa din cod e cea reală, ca
 * la numerele de telefon: dacă cineva uită variabila în Vercel, cererile
 * tot ajung unde trebuie, nu în gol.
 */
function notificationRecipients(): string[] {
  return (process.env.LEAD_NOTIFICATION_EMAIL ?? LEAD_INBOX)
    .split(",")
    .map((address) => address.trim())
    .filter(Boolean);
}

function client(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

interface SendOutcome {
  notification: "sent" | "skipped" | "failed";
  confirmation: "sent" | "skipped" | "failed";
}

/**
 * Notificare către admin + confirmare către client.
 * Se apelează fără `await` din ruta de POST (fire-and-forget), dar tot
 * scrie un `lead_event` cu rezultatul, ca să se vadă în istoric dacă un
 * email n-a plecat.
 */
export async function sendLeadEmails(lead: Lead): Promise<SendOutcome> {
  const outcome: SendOutcome = { notification: "skipped", confirmation: "skipped" };

  const resend = client();
  if (!resend) {
    if (process.env.NODE_ENV !== "production") {
      console.info(
        `[email] RESEND_API_KEY lipsește — nu s-a trimis nimic pentru lead ${lead.id} (${lead.name}).`
      );
    } else {
      console.error("[email] RESEND_API_KEY lipsește în producție. Lead-uri fără notificare.");
    }
    return outcome;
  }

  const recipients = notificationRecipients();
  if (recipients.length > 0) {
    try {
      const message = leadNotificationEmail(lead);
      const { error } = await resend.emails.send({
        from: FROM,
        to: recipients,
        subject: message.subject,
        html: message.html,
        text: message.text,
        replyTo: lead.email ?? undefined,
      });
      outcome.notification = error ? "failed" : "sent";
      if (error) console.error("[email] notificarea către admin a eșuat:", error.message);
    } catch (error) {
      outcome.notification = "failed";
      console.error("[email] notificarea către admin a aruncat:", error);
    }
  } else {
    console.error("[email] LEAD_NOTIFICATION_EMAIL nu e setat — nimeni nu află de lead-uri noi.");
  }

  if (lead.email) {
    try {
      const message = leadConfirmationEmail(lead);
      const { error } = await resend.emails.send({
        from: FROM,
        to: [lead.email],
        subject: message.subject,
        html: message.html,
        text: message.text,
      });
      outcome.confirmation = error ? "failed" : "sent";
      if (error) console.error("[email] confirmarea către client a eșuat:", error.message);
    } catch (error) {
      outcome.confirmation = "failed";
      console.error("[email] confirmarea către client a aruncat:", error);
    }
  }

  await recordEmailEvent(lead.id, {
    notification: outcome.notification,
    confirmation: outcome.confirmation,
    recipients: recipients.length,
  });

  return outcome;
}
