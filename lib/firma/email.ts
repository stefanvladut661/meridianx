import { Resend } from "resend";

/**
 * Emailurile modulului (facturi către clienți, pachetul către contabil,
 * rezumatul de dimineață). `lib/email/send.ts` are doar emailurile
 * lead-urilor și ale sondei, fără un trimițător general cu atașamente, așa
 * că modulul folosește Resend direct, cu aceleași variabile:
 * RESEND_API_KEY și RESEND_FROM_EMAIL. Nimic nu pleacă decât din butonul
 * „Trimite” (sau rezumatul de dimineață, care merge doar la admini).
 */

const FROM = process.env.RESEND_FROM_EMAIL?.trim() || "MERIDIAN <notificari@meridianx.ro>";

export function isEmailReady(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export const EMAIL_MISSING = "Emailul nu e configurat: lipsește RESEND_API_KEY în Vercel.";

/** „Nume <adresa>” → doar adresa, cu numele schimbat (ex. „MERIDIAN · facturi”). */
function fromAs(name: string): string {
  const match = FROM.match(/<([^>]+)>/);
  const address = match ? match[1] : FROM;
  return `${name} <${address}>`;
}

export interface FirmaEmail {
  to: string[];
  subject: string;
  text: string;
  /** Numele expeditorului (ex. „MERIDIAN · facturi”). */
  senderName: string;
  replyTo?: string | null;
  attachments?: { filename: string; content: Buffer; contentType: string }[];
}

export type EmailOutcome = { ok: true; id: string | null } | { ok: false; message: string };

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Textul simplu ca HTML minimal (paragrafe, linkuri lăsate ca text). */
function toHtml(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((paragraph) => `<p style="margin:0 0 14px;font:15px/1.55 -apple-system,Segoe UI,Arial,sans-serif;color:#15181f">${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

export async function sendFirmaEmail(email: FirmaEmail): Promise<EmailOutcome> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, message: EMAIL_MISSING };
  if (email.to.length === 0) return { ok: false, message: "Emailul n-are destinatar." };
  try {
    const resend = new Resend(key);
    const { data, error } = await resend.emails.send({
      from: fromAs(email.senderName),
      to: email.to,
      subject: email.subject,
      text: email.text,
      html: toHtml(email.text),
      replyTo: email.replyTo ?? undefined,
      attachments: email.attachments?.map((file) => ({ filename: file.filename, content: file.content, contentType: file.contentType })),
    });
    if (error) return { ok: false, message: `Resend a refuzat emailul: ${error.message}` };
    return { ok: true, id: data?.id ?? null };
  } catch (error) {
    console.error("[firma] emailul a aruncat:", error instanceof Error ? error.message : error);
    return { ok: false, message: "Emailul n-a plecat (Resend n-a răspuns). Reîncearcă." };
  }
}
