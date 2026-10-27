import { Resend } from "resend";
import { db } from "./db";
import { todayIn, RO_TZ } from "./timp";

/**
 * Alertele modulului: o postare eșuată definitiv, un token care nu se mai
 * poate reînnoi (coada oprită), un cont care expiră curând. Fiecare alertă se
 * ține în `postari_alerte`, cu o cheie: aceeași cheie pleacă cel mult o dată
 * pe zi. Ecranul cozii arată alertele zilei; emailul pleacă prin Resend
 * (aceleași variabile ca la lead-uri) la adresa din Setări sau, fără ea, la
 * adresele din ADMIN_EMAILS. RESEND_BASE_URL (citit de SDK) e doar pentru teste.
 */

export interface Alerta {
  /** Ce face alerta unică într-o zi, ex. „esuata:<id>”, „token:instagram”. */
  cheie: string;
  tip: "postare_esuata" | "token" | "cont_expira" | "coada_oprita";
  subiect: string;
  mesaj: string;
}

const FROM = () => process.env.RESEND_FROM_EMAIL?.trim() || "MERIDIAN <notificari@meridianx.ro>";

function recipients(emailAlerte: string | null): string[] {
  const list = (emailAlerte ?? process.env.ADMIN_EMAILS ?? "")
    .split(/[,;\s]+/)
    .map((address) => address.trim())
    .filter((address) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(address));
  return [...new Set(list)].slice(0, 5);
}

/** Ține alerta și trimite emailul, o dată pe zi pe cheie. Nu aruncă: o alertă ratată nu oprește coada. */
export async function raiseAlert(alerta: Alerta, emailAlerte: string | null): Promise<"trimisa" | "deja" | "fara_email" | "eroare"> {
  const admin = db();
  if (!admin) return "eroare";
  const zi = todayIn(RO_TZ);
  const { data, error } = await admin
    .from("postari_alerte")
    .upsert({ cheie: alerta.cheie.slice(0, 200), zi, tip: alerta.tip, mesaj: alerta.mesaj.slice(0, 2000) }, { onConflict: "cheie,zi", ignoreDuplicates: true })
    .select("id");
  if (error) {
    console.error("[postari] alerta n-a putut fi scrisă:", error.code, error.message);
    return "eroare";
  }
  // Rândul exista deja azi: alerta a plecat (sau a fost încercată) mai devreme.
  if (!data || data.length === 0) return "deja";
  const id = data[0].id;

  const key = process.env.RESEND_API_KEY;
  const to = recipients(emailAlerte);
  if (!key || to.length === 0) {
    await admin.from("postari_alerte").update({ eroare: !key ? "RESEND_API_KEY lipsește" : "nicio adresă pentru alerte" }).eq("id", id);
    return "fara_email";
  }
  try {
    const resend = new Resend(key);
    const { error: sendError } = await resend.emails.send({
      from: FROM(),
      to,
      subject: `Postări: ${alerta.subiect}`,
      text: `${alerta.mesaj}\n\nDeschide coada: ${(process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.meridianx.ro").replace(/\/$/, "")}/admin/postari\n\n— adminul MERIDIAN`,
    });
    if (sendError) {
      await admin.from("postari_alerte").update({ eroare: String(sendError.message ?? "Resend a refuzat").slice(0, 500) }).eq("id", id);
      return "eroare";
    }
    await admin.from("postari_alerte").update({ trimisa: true }).eq("id", id);
    return "trimisa";
  } catch (sendError) {
    await admin.from("postari_alerte").update({ eroare: (sendError instanceof Error ? sendError.message : "Resend n-a răspuns").slice(0, 500) }).eq("id", id);
    return "eroare";
  }
}

export interface AlertaZi {
  tip: string;
  mesaj: string;
  createdAt: string;
  trimisa: boolean;
  eroare: string | null;
}

/** Alertele din ultimele două zile, pentru ecranul cozii. */
export async function recentAlerts(): Promise<AlertaZi[]> {
  const admin = db();
  if (!admin) return [];
  const since = new Date(Date.now() - 2 * 24 * 60 * 60_000).toISOString();
  const { data } = await admin.from("postari_alerte").select("tip, mesaj, created_at, trimisa, eroare").gte("created_at", since).order("created_at", { ascending: false }).limit(20);
  return (data ?? []).map((row) => ({ tip: String(row.tip), mesaj: String(row.mesaj), createdAt: String(row.created_at), trimisa: Boolean(row.trimisa), eroare: (row.eroare as string | null) ?? null }));
}
