import { db } from "./db";
import { addMonths, currentMonth, dayLabel, todayIso } from "./format";
import { logEvent } from "./istoric";
import { readSettings } from "./setari";
import { prepareMonth, refreshFromOblio } from "./facturi";
import { checkMonth } from "./contabil";
import { computeDashboard } from "./panou";
import { ensureMonthFolder } from "./drive";
import { driveMode } from "./drive/google";
import { isOblioConfigured } from "./oblio/api";
import { isEmailReady, sendFirmaEmail } from "./email";
import { SITE_URL } from "@/lib/site-url";

/**
 * Jobul de dimineață (cron, o dată pe zi). Nu emite, nu trimite nimic fiscal
 * și nu scrie la clienți: face folderul lunii, pregătește ciornele (rămân
 * ciorne), citește starea din Oblio, verifică pachetul lunii trecute și, doar
 * în zilele cu alerte, trimite un rezumat scurt adminului (o dată pe zi).
 */

export interface DailyOutcome {
  steps: Record<string, string>;
  alerts: number;
  digest: "trimis" | "fara-alerte" | "deja-trimis" | "fara-adresa" | "fara-email" | "esuat";
}

async function step(name: string, steps: Record<string, string>, run: () => Promise<string>): Promise<void> {
  try {
    steps[name] = await run();
  } catch (error) {
    steps[name] = `eroare: ${error instanceof Error ? error.message.slice(0, 200) : "necunoscută"}`;
    await logEvent({ actor: "cron", zona: "sistem", actiune: `jobul de dimineață: ${name}`, rezultat: "eroare", mesaj: steps[name] });
  }
}

export async function runDaily(now = new Date()): Promise<DailyOutcome> {
  const steps: Record<string, string> = {};
  const month = currentMonth(now);
  const today = todayIso(now);
  const settings = await readSettings();

  await step("folderul lunii", steps, async () => {
    if (!driveMode() || !settings.ok || !settings.data.driveRadacina) return "sărit (Drive nelegat)";
    const folder = await ensureMonthFolder(month, "cron");
    return folder.ok ? folder.data.name : folder.message;
  });
  await step("ciornele lunii", steps, async () => {
    const result = await prepareMonth(month, "cron");
    return result.ok ? `${result.data.created} noi, ${result.data.existing} existau` : result.message;
  });
  await step("starea din Oblio", steps, async () => {
    if (!isOblioConfigured()) return "sărit (Oblio nelegat)";
    const result = await refreshFromOblio("cron");
    return result.ok ? `${result.data.checked} verificate, ${result.data.updated} schimbate` : result.message;
  });
  await step("pachetul lunii trecute", steps, async () => {
    // În prima jumătate a lunii, cât se strâng documentele lunii trecute.
    if (Number(today.slice(8, 10)) > 15) return "sărit (după 15)";
    const result = await checkMonth(addMonths(month, -1), "cron");
    return result.ok ? (result.data.complete ? "complet" : `${result.data.items.filter((item) => item.blocheaza).length} lipsuri`) : result.message;
  });

  const dashboard = await computeDashboard(month, today, { withAds: false });
  const alerts = dashboard.ok ? dashboard.data.alerte : [];
  let digest: DailyOutcome["digest"] = "fara-alerte";
  if (alerts.length > 0) {
    const admin = db();
    const recipients = settings.ok && settings.data.emailRezumat ? settings.data.emailRezumat.split(",").map((item) => item.trim()).filter(Boolean) : [];
    const { data: sentToday } = admin ? await admin.from("firma_rezumate").select("trimis").eq("zi", today).maybeSingle() : { data: null };
    if (sentToday?.trimis) digest = "deja-trimis";
    else if (recipients.length === 0) digest = "fara-adresa";
    else if (!isEmailReady()) digest = "fara-email";
    else {
      const text = [
        "Bună dimineața,",
        `${alerts.length === 1 ? "O alertă" : `${alerts.length} alerte`} în adminul firmei:`,
        alerts.map((alert) => `• ${alert.text}`).join("\n"),
        `Deschide panoul: ${SITE_URL}/admin/firma`,
      ].join("\n\n");
      const sent = await sendFirmaEmail({ to: recipients, subject: `MERIDIAN · ${alerts.length === 1 ? "o alertă" : `${alerts.length} alerte`} — ${dayLabel(today)}`, text, senderName: "MERIDIAN · firmă" });
      digest = sent.ok ? "trimis" : "esuat";
      await admin?.from("firma_rezumate").upsert({ zi: today, alerte: alerts.length, trimis: sent.ok, catre: recipients.join(", "), mesaj: sent.ok ? null : sent.message }, { onConflict: "zi" });
    }
  }
  await logEvent({
    actor: "cron",
    zona: "panou",
    actiune: "jobul de dimineață",
    rezultat: Object.values(steps).some((value) => value.startsWith("eroare")) || digest === "esuat" ? "eroare" : "ok",
    mesaj: `${Object.entries(steps).map(([name, value]) => `${name}: ${value}`).join("; ")}; alerte: ${alerts.length}; rezumat: ${digest}`,
  });
  return { steps, alerts: alerts.length, digest };
}
