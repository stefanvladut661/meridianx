"use client";

import { useState, useTransition } from "react";
import type { Setari } from "@/lib/postari/setari";
import { momentLabel } from "@/lib/postari/timp";
import { btnPrimary, Field, inputClass } from "./ui";

type SettingsResult = { ok: true; message: string } | { ok: false; field?: string; message: string };

/** Setările modulului: folderul de pe Drive, sloturile implicite, plafoanele, alertele. */
export function SettingsForm({ settings, save }: { settings: Setari; save: (raw: unknown) => Promise<SettingsResult> }) {
  const [values, setValues] = useState({
    driveFolder: settings.driveFolderId ?? "",
    sloturiOre: settings.sloturiOre.join(", "),
    sloturiFus: settings.sloturiFus,
    plafonInstagram: String(settings.plafonInstagram),
    plafonTiktok: String(settings.plafonTiktok),
    distantaMinimaMin: String(settings.distantaMinimaMin),
    stocareLimitaMb: String(settings.stocareLimitaMb),
    emailAlerte: settings.emailAlerte ?? "",
  });
  const [error, setError] = useState<{ field?: string; message: string } | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = (field: keyof typeof values, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setSaved(null);
  };
  const fieldError = (field: string) => (error?.field === field ? error.message : null);
  const invalid = (field: string) => (error?.field === field ? true : undefined);
  const describedBy = (field: string) => (error?.field === field ? `set-${field}-eroare` : `set-${field}-ajutor`);

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        start(async () => {
          setError(null);
          try {
            const result = await save(values);
            if (!result.ok) {
              setError({ field: result.field, message: result.message });
              if (result.field) document.getElementById(`set-${result.field}`)?.focus();
              return;
            }
            setSaved(result.message);
          } catch {
            setError({ message: "Serverul n-a răspuns (rețea sau sesiune). Nu s-a salvat nimic; încearcă din nou." });
          }
        });
      }}
      className="mt-7 grid max-w-3xl gap-7"
    >
      <section aria-labelledby="drive-set" className="grid gap-3">
        <h2 id="drive-set" className="text-[15px] font-semibold text-bone">
          Folderul de pe Drive
        </h2>
        <Field
          id="set-driveFolder"
          label="Folderul principal (adresa sau id-ul)"
          error={fieldError("driveFolder")}
          hint={settings.driveFolderNume ? `Acum: „${settings.driveFolderNume}”. Planurile scriu subfolderul, ex. „${settings.driveFolderNume}/lot-1”.` : "Folderul „meridian reclame”, cu câte un subfolder pe lot. Gol = nu se citește nimic de pe Drive."}
        >
          <input
            id="set-driveFolder"
            value={values.driveFolder}
            onChange={(e) => set("driveFolder", e.currentTarget.value)}
            className={inputClass}
            placeholder="https://drive.google.com/drive/folders/…"
            aria-invalid={invalid("driveFolder")}
            aria-describedby={describedBy("driveFolder")}
          />
        </Field>
      </section>

      <section aria-labelledby="sloturi-set" className="grid gap-3">
        <h2 id="sloturi-set" className="text-[15px] font-semibold text-bone">
          Sloturile implicite
        </h2>
        <p className="-mt-1 text-[13px] text-dim">Un plan fără „sloturi” proprii folosește orele de aici, începând de mâine. O postare fără oră ia următorul slot liber.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field id="set-sloturiOre" label="Orele zilei" error={fieldError("sloturiOre")} hint="Despărțite prin virgulă, ex. „12:30, 19:00”.">
            <input id="set-sloturiOre" value={values.sloturiOre} onChange={(e) => set("sloturiOre", e.currentTarget.value)} className={inputClass} inputMode="numeric" aria-invalid={invalid("sloturiOre")} aria-describedby={describedBy("sloturiOre")} />
          </Field>
          <Field id="set-sloturiFus" label="Fusul orar" error={fieldError("sloturiFus")} hint="Orele din plan se citesc în fusul ăsta.">
            <input id="set-sloturiFus" value={values.sloturiFus} onChange={(e) => set("sloturiFus", e.currentTarget.value)} className={inputClass} aria-invalid={invalid("sloturiFus")} aria-describedby={describedBy("sloturiFus")} />
          </Field>
          <Field id="set-distantaMinimaMin" label="Distanța minimă între postări (minute)" error={fieldError("distantaMinimaMin")} hint="Pe aceeași platformă. Două postări mai apropiate sunt suprapuse.">
            <input id="set-distantaMinimaMin" value={values.distantaMinimaMin} onChange={(e) => set("distantaMinimaMin", e.currentTarget.value)} className={inputClass} inputMode="numeric" aria-invalid={invalid("distantaMinimaMin")} aria-describedby={describedBy("distantaMinimaMin")} />
          </Field>
        </div>
      </section>

      <section aria-labelledby="plafon-set" className="grid gap-3">
        <h2 id="plafon-set" className="text-[15px] font-semibold text-bone">
          Plafoanele pe 24 de ore
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field id="set-plafonInstagram" label="Instagram: postări prin API" error={fieldError("plafonInstagram")} hint="Documentația Meta dă și 100, și 50; cota citită din API e 50. Pornește de la 50.">
            <input id="set-plafonInstagram" value={values.plafonInstagram} onChange={(e) => set("plafonInstagram", e.currentTarget.value)} className={inputClass} inputMode="numeric" aria-invalid={invalid("plafonInstagram")} aria-describedby={describedBy("plafonInstagram")} />
          </Field>
          <Field id="set-plafonTiktok" label="TikTok: ciorne trimise" error={fieldError("plafonTiktok")} hint="TikTok refuză a șasea ciornă nepublicată în 24 de ore.">
            <input id="set-plafonTiktok" value={values.plafonTiktok} onChange={(e) => set("plafonTiktok", e.currentTarget.value)} className={inputClass} inputMode="numeric" aria-invalid={invalid("plafonTiktok")} aria-describedby={describedBy("plafonTiktok")} />
          </Field>
          <Field id="set-stocareLimitaMb" label="Stocarea temporară: MB pe fișier" error={fieldError("stocareLimitaMb")} hint="Planul gratuit Supabase primește cel mult 50 MB pe fișier. Crește doar cu un plan plătit.">
            <input id="set-stocareLimitaMb" value={values.stocareLimitaMb} onChange={(e) => set("stocareLimitaMb", e.currentTarget.value)} className={inputClass} inputMode="numeric" aria-invalid={invalid("stocareLimitaMb")} aria-describedby={describedBy("stocareLimitaMb")} />
          </Field>
        </div>
      </section>

      <section aria-labelledby="alerte-set" className="grid gap-3">
        <h2 id="alerte-set" className="text-[15px] font-semibold text-bone">
          Alertele
        </h2>
        <Field id="set-emailAlerte" label="Emailul pentru alerte" error={fieldError("emailAlerte")} hint="Token care nu se mai reînnoiește, postare eșuată definitiv. Gol = adresele din ADMIN_EMAILS.">
          <input id="set-emailAlerte" value={values.emailAlerte} onChange={(e) => set("emailAlerte", e.currentTarget.value)} className={inputClass} placeholder="tu@exemplu.ro" aria-invalid={invalid("emailAlerte")} aria-describedby={describedBy("emailAlerte")} />
        </Field>
      </section>

      {error && !error.field ? (
        <p role="alert" className="text-[13.5px] text-[var(--ap-error)]">
          {error.message}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={btnPrimary}>
          {pending ? "Se salvează…" : "Salvează setările"}
        </button>
        <p role="status" className="text-[13px] text-dim">
          {saved ? <span className="text-[var(--ap-ok)]">{saved}</span> : settings.updatedAt ? `Ultima schimbare: ${momentLabel(settings.updatedAt)}${settings.updatedBy ? `, ${settings.updatedBy}` : ""}` : null}
        </p>
      </div>
    </form>
  );
}
