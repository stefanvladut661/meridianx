"use client";

import { useState, useTransition } from "react";
import type { Setari } from "@/lib/firma/setari";
import { dateTimeLabel } from "@/lib/firma/format";
import { Field, inputClass } from "./ui";

type SettingsResult = { ok: true } | { ok: false; field?: string; message: string };

/** Formularul setărilor din admin: seria, emailul contabilului, folderul de pe Drive. */
export function SettingsForm({
  settings,
  series,
  seriesError,
  save,
}: {
  settings: Setari;
  series: string[];
  seriesError: string | null;
  save: (raw: unknown) => Promise<SettingsResult>;
}) {
  const [values, setValues] = useState({
    serieFactura: settings.serieFactura ?? "",
    emailContabil: settings.emailContabil ?? "",
    driveRadacina: settings.driveRadacina ?? "",
    driveModelLuna: settings.driveModelLuna,
    emailRezumat: settings.emailRezumat ?? "",
  });
  const [error, setError] = useState<{ field?: string; message: string } | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  const set = (field: keyof typeof values, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setSaved(false);
  };
  const fieldError = (field: string) => (error?.field === field ? error.message : null);

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        start(async () => {
          setError(null);
          const result = await save(values);
          if (!result.ok) {
            setError({ field: result.field, message: result.message });
            if (result.field) document.getElementById(`set-${result.field}`)?.focus();
            return;
          }
          setSaved(true);
        });
      }}
      className="mt-7 grid max-w-3xl gap-6"
    >
      <section aria-labelledby="facturi-set" className="grid gap-3">
        <h2 id="facturi-set" className="text-[15px] font-semibold text-bone">
          Facturi și contabil
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            id="set-serieFactura"
            label="Seria facturilor din Oblio"
            error={fieldError("serieFactura")}
            hint={series.length > 0 ? "Seriile de factură din contul Oblio." : seriesError ? `N-am putut citi seriile din Oblio (${seriesError}); scrie numele exact.` : "Numele seriei, exact ca în Oblio (Setări → Serii)."}
          >
            {series.length > 0 ? (
              <select id="set-serieFactura" value={values.serieFactura} onChange={(e) => set("serieFactura", e.currentTarget.value)} className={inputClass}>
                <option value="">Alege seria</option>
                {[...new Set([...series, ...(values.serieFactura ? [values.serieFactura] : [])])].map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            ) : (
              <input id="set-serieFactura" value={values.serieFactura} onChange={(e) => set("serieFactura", e.currentTarget.value)} className={inputClass} maxLength={20} />
            )}
          </Field>
          <Field id="set-emailContabil" label="Emailul contabilului" error={fieldError("emailContabil")} hint="Aici pleacă pachetul lunar, după „Trimite”.">
            <input id="set-emailContabil" type="email" value={values.emailContabil} onChange={(e) => set("emailContabil", e.currentTarget.value)} className={inputClass} maxLength={200} />
          </Field>
        </div>
        <Field id="set-emailRezumat" label="Emailul pentru rezumatul de dimineață" error={fieldError("emailRezumat")} hint="Pleacă doar în zilele cu alerte (facturi întârziate, contracte care se termină, pachetul contabilului, abonamente, ciorne). Gol = fără rezumat.">
          <input id="set-emailRezumat" value={values.emailRezumat} onChange={(e) => set("emailRezumat", e.currentTarget.value)} className={inputClass} placeholder="tu@exemplu.ro" />
        </Field>
      </section>

      <section aria-labelledby="drive-set" className="grid gap-3">
        <h2 id="drive-set" className="text-[15px] font-semibold text-bone">
          Folderul de pe Drive
        </h2>
        <Field id="set-driveRadacina" label="Folderul rădăcină (adresa sau id-ul)" error={fieldError("driveRadacina")} hint="Folderul cu câte un subfolder pe lună. Gol = adminul nu scrie nimic pe Drive.">
          <input id="set-driveRadacina" value={values.driveRadacina} onChange={(e) => set("driveRadacina", e.currentTarget.value)} className={inputClass} placeholder="https://drive.google.com/drive/folders/…" />
        </Field>
        <Field id="set-driveModelLuna" label="Numele folderului lunii" error={fieldError("driveModelLuna")} hint="{luna} = „aprilie”, {an} = „2026”, {ll} = „04”. Ex.: „{luna} {an}” → „aprilie 2026”.">
          <input id="set-driveModelLuna" value={values.driveModelLuna} onChange={(e) => set("driveModelLuna", e.currentTarget.value)} className={inputClass} maxLength={80} />
        </Field>
      </section>

      {error && !error.field ? (
        <p role="alert" className="text-[13.5px] text-[var(--ap-error)]">
          {error.message}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className="btn btn-light !min-h-10 !px-4 !py-2 !text-[14px]">
          {pending ? "Se salvează…" : "Salvează setările"}
        </button>
        <p role="status" className="text-[13px] text-dim">
          {saved ? <span className="text-[var(--ap-ok)]">Salvat.</span> : settings.updatedAt ? `Ultima schimbare: ${dateTimeLabel(settings.updatedAt)}${settings.updatedBy ? `, ${settings.updatedBy}` : ""}` : null}
        </p>
      </div>
    </form>
  );
}
