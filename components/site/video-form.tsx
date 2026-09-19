"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Icon } from "./ui";
import { submitLead, useUtmCapture } from "./lead";
import { CONTACT } from "./video-content";

/* ============================================================
   FORMULARUL SCURT DE PE /video.

   Clientul de video decide repede și preferă vocea (CLAUDE.md §8):
   WhatsApp și telefonul stau lângă formular, la aceeași greutate
   vizuală, nu ascunse sub „alte metode de contact". Formularul e
   pentru cine sună seara, când n-are cine răspunde.

   Patru câmpuri, trei obligatorii: cum îl cheamă, unde îl sunăm, ce
   vrea — și firma, dacă vrea să o spună (pe ea o căutăm înainte de
   apel). „Vreau altceva” deschide un rând de text în loc să-l trimită
   pe om să explice la telefon ce n-a găsit în listă. Restul aflăm în
   apelul de douăzeci de minute pe care oricum îl facem.
   ============================================================ */

const NEEDS = [
  { id: "film", label: "Film de brand" },
  { id: "ads", label: "Reclame care vând" },
  { id: "campanii", label: "Campanii plătite" },
  { id: "foto", label: "Fotografie" },
  { id: "altceva", label: "Vreau altceva" },
] as const;

const OTHER = "altceva";

type Status = "idle" | "sending" | "sent";

const FIELD =
  "rounded-panel border border-hair bg-glass px-3.5 py-3 text-[15px] text-bone outline-none transition-colors focus:border-a1";

export function VideoLeadForm() {
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

  // Rândul „ce anume?” apare abia după alegere; cursorul merge direct în
  // el, ca omul să nu mai facă un click pentru ceva ce tocmai a cerut.
  useEffect(() => {
    if (need === OTHER) otherRef.current?.focus();
  }, [need]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (status === "sending") return;

    // Chip-urile sunt radio-uri ascunse vizual, deci validarea nativă ar
    // arăta balonul de eroare în gol. O spunem noi, în cuvinte.
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
      <div
        role="status"
        aria-live="polite"
        className="glass edge-light flex min-h-[19rem] flex-col justify-center p-7 text-left"
      >
        <span className="flex size-11 items-center justify-center rounded-full border border-a1 text-a1">
          <Icon name="check" size={20} />
        </span>
        <h3 className="display mt-5 text-[clamp(1.3rem,3vw,1.7rem)]">
          Apel cerut.
        </h3>
        <p className="mt-3 text-[15px] leading-relaxed text-dim">
          Te sunăm în următoarea zi lucrătoare la{" "}
          <span className="text-bone">{phone}</span>. Dacă vrei mai repede,
          scrie-ne pe WhatsApp — acolo răspundem în minute.
        </p>
        <a
          href={CONTACT.whatsapp}
          className="btn btn-ghost mt-6 !min-h-10 !w-fit !px-4 !py-2 !text-[13px]"
        >
          <Icon name="whatsapp" size={15} />
          Deschide WhatsApp
        </a>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="glass edge-light p-7 text-left"
      aria-labelledby={`${uid}-title`}
    >
      <p className="eyebrow">Completează · 30 sec</p>
      <h3 id={`${uid}-title`} className="display mt-3 text-[clamp(1.2rem,2.6vw,1.5rem)]">
        Te sunăm noi
      </h3>

      <div className="mt-6 grid gap-4">
        <p className="grid gap-1.5">
          <label htmlFor={`${uid}-name`} className="text-[13px] text-dim">
            Nume <span className="text-a2">*</span>
          </label>
          <input
            id={`${uid}-name`}
            type="text"
            autoComplete="name"
            required
            minLength={2}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={FIELD}
          />
        </p>

        <p className="grid gap-1.5">
          <label htmlFor={`${uid}-phone`} className="text-[13px] text-dim">
            Telefon <span className="text-a2">*</span>
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
            className={FIELD}
          />
        </p>

        <p className="grid gap-1.5">
          <label htmlFor={`${uid}-company`} className="text-[13px] text-dim">
            Firmă <span className="text-dim/70">(opțional)</span>
          </label>
          <input
            id={`${uid}-company`}
            type="text"
            autoComplete="organization"
            maxLength={160}
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            className={FIELD}
          />
        </p>

        <fieldset className="grid gap-2">
          <legend className="mb-1 text-[13px] text-dim">
            Ce te interesează <span className="text-a2">*</span>
          </legend>
          <div className="flex flex-wrap gap-2">
            {NEEDS.map((n) => (
              <label
                key={n.id}
                className={`cursor-pointer rounded-panel-sm border px-3 py-1.5 text-[13.5px] transition-colors ${
                  need === n.id
                    ? "border-a1 bg-a1/10 text-bone"
                    : "border-hair text-dim hover:border-hair-strong hover:text-bone"
                }`}
              >
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
            <p className="mt-1 grid gap-1.5">
              <label htmlFor={`${uid}-other`} className="text-[13px] text-dim">
                Ce anume? <span className="text-a2">*</span>
              </label>
              <input
                ref={otherRef}
                id={`${uid}-other`}
                type="text"
                maxLength={160}
                placeholder="ex. un video de produs, un clip de recrutare"
                value={other}
                onChange={(e) => setOther(e.target.value)}
                className={`${FIELD} placeholder:text-dim/60`}
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
        <p
          role="alert"
          className="mt-5 rounded-panel-sm border border-a2/50 bg-glass px-3.5 py-3 text-[13.5px] leading-relaxed text-bone"
        >
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={status === "sending"}
        aria-busy={status === "sending"}
        className="btn btn-primary mt-6 !w-full disabled:cursor-progress disabled:opacity-60"
      >
        {status === "sending" ? "Se trimite…" : "Sună-mă"}
        <Icon name="arrowRight" size={17} className="arw" />
      </button>
      <p className="mt-3 text-center text-[12.5px] text-dim">
        În următoarea zi lucrătoare. Fără emailuri de prezentare.
      </p>

      <span aria-live="polite" className="sr-only">
        {status === "sending" ? "Se trimite cererea." : ""}
      </span>
    </form>
  );
}
