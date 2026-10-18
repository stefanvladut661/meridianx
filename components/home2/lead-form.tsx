"use client";

import { useEffect, useId, useRef, useState } from "react";
import { submitLead, useUtmCapture } from "@/components/site/lead";
import { CONTACT } from "@/components/site/video-content";
import { Icon } from "./ui";
import s from "./home2.module.css";

/* ============================================================
   FORMULARUL /home-2 — aceeași logică exactă ca formularul de pe
   /video (components/site/video-form.tsx), alt aspect.

   Câmpurile, mesajele de validare, sursa și diviziile din payload sunt
   copiate unu la unu; trimiterea trece prin același `submitLead`, deci
   aceeași schemă Zod, același POST /api/leads și aceleași evenimente
   după confirmarea serverului: Meta `Lead` și TikTok `SubmitForm`.
   Se schimbă doar haina: pastilele de sticlă de pe panoul albastru.

   Formularul de pe /video rămâne neatins — orice schimbare de logică se
   face în ambele locuri până când pagina asta îl înlocuiește.
   ============================================================ */

/* Aceeași listă ca în video-form.tsx. */
const NEEDS = [
  { id: "film", label: "Film de prezentare" },
  { id: "continut", label: "Conținut lunar (Reels, TikTok)" },
  { id: "ugc", label: "Filmări UGC / cu actori" },
  { id: "campanii", label: "Campanii plătite" },
  { id: "foto", label: "Fotografie de produs sau spațiu" },
  { id: "outdoor", label: "Panouri și outdoor" },
  { id: "altceva", label: "Vreau altceva" },
] as const;

const OTHER = "altceva";

type Status = "idle" | "sending" | "sent";

export function LeadForm() {
  const uid = useId();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [need, setNeed] = useState<string>("");
  const [other, setOther] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const otherRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  useUtmCapture();

  useEffect(() => {
    if (need === OTHER) otherRef.current?.focus();
  }, [need]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (status === "sending") return;

    if (!need) {
      setError("Alege ce te interesează — sau „Vreau altceva”.");
      return;
    }
    const otherText = other.trim();
    if (need === OTHER && !otherText) {
      setError("Scrie în două vorbe ce ai nevoie.");
      otherRef.current?.focus();
      return;
    }

    setStatus("sending");
    setError(null);

    const chosen = need === OTHER ? otherText : NEEDS.find((n) => n.id === need)?.label;
    const result = await submitLead({
      division: "video",
      source: "video-apel",
      name: name.trim(),
      phone: phone.trim(),
      company: company.trim() || undefined,
      projectType: need === OTHER ? "Altceva" : chosen,
      message: `Cere apel pentru: ${chosen}`,
      isFunded: false,
      website: honeypot,
    });

    if (result.ok) {
      setStatus("sent");
    } else {
      setStatus("idle");
      setError(result.error);
    }
  }

  if (status === "sent") {
    return (
      <div role="status" aria-live="polite" className={`${s.glassCard} flex min-h-[19rem] flex-col justify-center`}>
        <span className="flex size-11 items-center justify-center rounded-full bg-white text-[#1d4ed8]">
          <Icon name="check" size={20} />
        </span>
        <h3 className={s.cardTitle}>Apel cerut.</h3>
        <p className="mt-3 text-[15px] leading-relaxed text-white">
          Te sunăm în următoarea zi lucrătoare la{" "}
          <span className="font-medium text-white">{phone}</span>. Dacă vrei mai repede,
          scrie-ne pe WhatsApp — acolo răspundem în minute.
        </p>
        <a href={CONTACT.whatsapp} className={`${s.btn} ${s.btnOnBlue} mt-6 self-start`}>
          <Icon name="whatsapp" size={17} />
          Deschide WhatsApp
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={s.glassCard} aria-labelledby={`${uid}-title`}>
      <p className={s.cardEyebrow}>Completează · 30 sec</p>
      <h3 id={`${uid}-title`} className={s.cardTitle}>
        Te sunăm noi
      </h3>

      <div className="mt-6 grid gap-4">
        <p className={s.field}>
          <label htmlFor={`${uid}-name`} className={s.label}>
            Nume <span className={s.req}>*</span>
          </label>
          <input
            id={`${uid}-name`}
            type="text"
            autoComplete="name"
            required
            minLength={2}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={s.input}
          />
        </p>

        <p className={s.field}>
          <label htmlFor={`${uid}-phone`} className={s.label}>
            Telefon <span className={s.req}>*</span>
          </label>
          <input
            id={`${uid}-phone`}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            required
            pattern="\+?[0-9\s\(\)\-.]{7,20}"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className={s.input}
          />
        </p>

        <p className={s.field}>
          <label htmlFor={`${uid}-company`} className={s.label}>
            Firmă <span className="text-white/90">(opțional)</span>
          </label>
          <input
            id={`${uid}-company`}
            type="text"
            autoComplete="organization"
            maxLength={160}
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            className={s.input}
          />
        </p>

        <fieldset className="grid gap-2">
          <legend className={`${s.label} mb-2`}>
            Ce te interesează <span className={s.req}>*</span>
          </legend>
          <div className={s.chips}>
            {NEEDS.map((n) => (
              <label key={n.id} className={s.chip} data-on={need === n.id ? "" : undefined}>
                <input
                  type="radio"
                  name={`${uid}-need`}
                  value={n.id}
                  checked={need === n.id}
                  onChange={() => setNeed(n.id)}
                  className="sr-only"
                />
                {n.label}
              </label>
            ))}
          </div>
          {need === OTHER && (
            <p className={`${s.field} mt-2`}>
              <label htmlFor={`${uid}-other`} className={s.label}>
                Ce anume? <span className={s.req}>*</span>
              </label>
              <input
                ref={otherRef}
                id={`${uid}-other`}
                type="text"
                maxLength={160}
                placeholder="ex. un video de produs, un clip de recrutare"
                value={other}
                onChange={(e) => setOther(e.target.value)}
                className={s.input}
              />
            </p>
          )}
        </fieldset>
      </div>

      {/* Honeypot — contractul FAZEI 0. Off-screen, nu display:none. */}
      <div className="hp-field" aria-hidden>
        <label htmlFor={`${uid}-website`}>Site web</label>
        <input
          id={`${uid}-website`}
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
        />
      </div>

      {error && (
        <p role="alert" className={s.formError}>
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={status === "sending"}
        aria-busy={status === "sending"}
        className={`${s.btn} ${s.btnOnBlue} mt-6 w-full disabled:cursor-progress disabled:opacity-70`}
      >
        {status === "sending" ? "Se trimite…" : "Sună-mă"}
        <Icon name="arrowRight" size={17} className={s.arw} />
      </button>
      <p className={s.panelNote}>În următoarea zi lucrătoare. Fără emailuri de prezentare.</p>

      <span aria-live="polite" className="sr-only">
        {status === "sending" ? "Se trimite cererea." : ""}
      </span>
    </form>
  );
}
