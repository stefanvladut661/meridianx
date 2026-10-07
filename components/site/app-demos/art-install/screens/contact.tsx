"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Clock, LoaderCircle, Mail, MapPin, MessageCircle, Phone, Send } from "lucide-react";
import { ADDRESS, EMAIL, HOURS, PHONE, SERVICES } from "../data";
import { BTN_PRIMARY, CARD, CARD_HOVER, FOCUS, INPUT, MSG, PageHero, Reveal, anim, useAI, type ContactPrefill } from "../ui";

/* ============================================================
   Contact — ContactPage.tsx de pe site: formularul „Trimite-ne un
   mesaj” în stânga, cardurile de contact în dreapta, harta jos.
   Validare pe fiecare câmp; trimiterea se oprește în demo (notify),
   cu starea de succes a site-ului.
   ============================================================ */

type Errs = Partial<Record<"name" | "phone" | "email" | "gdpr", string>>;

function validate(v: { name: string; phone: string; email: string; gdpr: boolean }): Errs {
  const e: Errs = {};
  if (v.name.trim().length < 3) e.name = "Scrie numele și prenumele, ca să știm cum să te căutăm.";
  const digits = v.phone.replace(/[\s.\-()]/g, "");
  if (!digits) e.phone = "Lasă un număr de telefon: te sunăm pentru detalii.";
  else if (!/^(\+?40|0)7\d{8}$/.test(digits)) e.phone = "Numărul nu pare de mobil. Scrie-l ca 07xx xxx xxx.";
  if (v.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.email.trim()))
    e.email = "Adresa de email nu e completă. Verifică partea de după @.";
  if (!v.gdpr) e.gdpr = "Bifează acordul, altfel nu putem păstra datele cererii.";
  return e;
}

export function Contact({ prefill }: { prefill?: ContactPrefill }) {
  const { mobile, notify, reduced, scroller } = useAI();
  const cardRef = useRef<HTMLDivElement>(null);
  const doneRef = useRef<HTMLParagraphElement>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [service, setService] = useState(prefill?.service ?? "");
  const [message, setMessage] = useState(prefill?.message ?? "");
  const [gdpr, setGdpr] = useState(false);
  const [hp, setHp] = useState("");
  const [errs, setErrs] = useState<Errs>({});
  const [tried, setTried] = useState(false);
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [live, setLive] = useState("");
  const timer = useRef<number | null>(null);

  const values = { name, phone, email, gdpr };
  const shown = tried ? validate(values) : errs;

  /* După trimitere, cardul de succes e mai scurt decât formularul:
     îl aducem în vedere și mutăm focusul pe mesaj. */
  useEffect(() => {
    if (status !== "sent") return;
    const el = cardRef.current;
    if (el && scroller) {
      const top = el.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop - (mobile ? 80 : 100);
      if (scroller.scrollTop > top) scroller.scrollTo({ top, behavior: reduced ? "auto" : "smooth" });
    }
    doneRef.current?.focus({ preventScroll: true });
  }, [status, scroller, mobile, reduced]);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const v = validate(values);
    setTried(true);
    setErrs(v);
    const keys = Object.keys(v) as (keyof Errs)[];
    if (keys.length) {
      setLive(`Cererea nu e completă: ${keys.length === 1 ? "un câmp are nevoie" : `${keys.length} câmpuri au nevoie`} de atenție.`);
      document.getElementById(`ai-c-${keys[0]}`)?.focus();
      return;
    }
    setStatus("sending");
    setLive("Se trimite cererea…");
    timer.current = window.setTimeout(
      () => {
        setStatus("sent");
        setLive("Cererea a fost înregistrată în demo.");
        if (!hp) notify(MSG.send);
      },
      reduced ? 200 : 1000
    );
  };

  const reset = () => {
    if (timer.current) clearTimeout(timer.current);
    setName("");
    setPhone("");
    setEmail("");
    setService("");
    setMessage("");
    setGdpr(false);
    setErrs({});
    setTried(false);
    setStatus("idle");
    setLive("");
  };

  const label = "mb-1 block text-sm font-medium text-[#EBE6E0]";
  const err = (k: keyof Errs) =>
    shown[k] ? (
      <p id={`ai-c-${k}-err`} className="mt-1.5 text-xs font-medium text-[#F97316]">
        {shown[k]}
      </p>
    ) : null;
  const invalid = (k: keyof Errs) => (shown[k] ? "!border-[#F97316]/70" : "");

  return (
    <>
      <PageHero title="Contact" crumb="Acasă / Contact" />
      <section className={mobile ? "px-4 py-16" : "px-16 py-24"}>
        <div className={mobile ? "space-y-8" : "mx-auto grid max-w-[1152px] grid-cols-2 gap-12"}>
          <Reveal>
            <div ref={cardRef} className={`${CARD} shadow-xl shadow-black/30 ${mobile ? "p-6" : "p-8"}`}>
              <p className="sr-only" aria-live="polite">
                {live}
              </p>
              {status === "sent" ? (
                <div className="py-12 text-center" style={anim(reduced, "aiPop .3s ease-out both")}>
                  <p ref={doneRef} tabIndex={-1} className="text-lg font-semibold text-[#F97316] outline-none">
                    ✅ Cererea ta a fost trimisă!
                  </p>
                  <p className="mt-2 text-[#9096A2]">Te contactăm în maxim 24 de ore.</p>
                  <button
                    type="button"
                    onClick={reset}
                    className={`mt-8 rounded text-sm font-semibold text-[#F97316] hover:underline ${FOCUS}`}
                  >
                    Trimite altă cerere
                  </button>
                </div>
              ) : (
                <>
                  <h2 className="ai-h mb-6 text-2xl font-bold text-[#EBE6E0]">Trimite-ne un mesaj</h2>
                  <form onSubmit={onSubmit} noValidate className="space-y-4">
                    <div>
                      <label htmlFor="ai-c-name" className={label}>
                        Nume și prenume *
                      </label>
                      <input
                        id="ai-c-name"
                        type="text"
                        autoComplete="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        aria-invalid={!!shown.name}
                        aria-describedby={shown.name ? "ai-c-name-err" : undefined}
                        className={`${INPUT} ${invalid("name")}`}
                        placeholder="Ion Popescu"
                        maxLength={100}
                      />
                      {err("name")}
                    </div>
                    <div>
                      <label htmlFor="ai-c-phone" className={label}>
                        Telefon *{" "}
                        <button type="button" onClick={() => notify(MSG.call)} className={`rounded text-xs text-[#F97316] ${FOCUS}`}>
                          (sau sună-ne direct)
                        </button>
                      </label>
                      <input
                        id="ai-c-phone"
                        type="tel"
                        autoComplete="tel"
                        inputMode="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        aria-invalid={!!shown.phone}
                        aria-describedby={shown.phone ? "ai-c-phone-err" : undefined}
                        className={`${INPUT} ${invalid("phone")}`}
                        placeholder="07XX XXX XXX"
                        maxLength={20}
                      />
                      {err("phone")}
                    </div>
                    <div>
                      <label htmlFor="ai-c-email" className={label}>
                        Email
                      </label>
                      <input
                        id="ai-c-email"
                        type="email"
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        aria-invalid={!!shown.email}
                        aria-describedby={shown.email ? "ai-c-email-err" : undefined}
                        className={`${INPUT} ${invalid("email")}`}
                        placeholder="email@exemplu.com"
                        maxLength={255}
                      />
                      {err("email")}
                    </div>
                    <div>
                      <label htmlFor="ai-c-service" className={label}>
                        Serviciu dorit
                      </label>
                      <select id="ai-c-service" value={service} onChange={(e) => setService(e.target.value)} className={`${INPUT} cursor-pointer`}>
                        <option value="">Selectează...</option>
                        {SERVICES.map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="ai-c-message" className={label}>
                        Mesaj
                      </label>
                      <textarea
                        id="ai-c-message"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        className={`${INPUT} resize-none`}
                        rows={prefill?.message ? 7 : 4}
                        placeholder="Descrie-ne cum te putem ajuta..."
                        maxLength={2000}
                      />
                    </div>
                    {/* capcană pentru roboți: oamenii nu văd câmpul */}
                    <input
                      type="text"
                      name="website"
                      value={hp}
                      onChange={(e) => setHp(e.target.value)}
                      tabIndex={-1}
                      autoComplete="off"
                      aria-hidden
                      className="absolute -left-[9999px] h-0 w-0 opacity-0"
                    />
                    <div>
                      <label className="flex cursor-pointer select-none items-start gap-3">
                        <input
                          id="ai-c-gdpr"
                          type="checkbox"
                          checked={gdpr}
                          onChange={(e) => setGdpr(e.target.checked)}
                          aria-invalid={!!shown.gdpr}
                          aria-describedby={shown.gdpr ? "ai-c-gdpr-err" : undefined}
                          className={`mt-1 size-4 shrink-0 accent-[#F97316] ${FOCUS}`}
                        />
                        <span className="text-xs leading-relaxed text-[#9096A2]">
                          Sunt de acord cu prelucrarea datelor personale conform{" "}
                          <span className="text-[#F97316] underline">Politicii de Confidențialitate</span>. *
                        </span>
                      </label>
                      {err("gdpr")}
                    </div>
                    <button type="submit" disabled={status === "sending"} className={`${BTN_PRIMARY} w-full px-8 py-3.5 disabled:opacity-70`}>
                      {status === "sending" ? (
                        <>
                          <LoaderCircle size={16} style={anim(reduced, "aiSpin 1s linear infinite")} /> Se trimite...
                        </>
                      ) : (
                        <>
                          <Send size={16} /> Trimite mesajul
                        </>
                      )}
                    </button>
                  </form>
                </>
              )}
            </div>
          </Reveal>

          <Reveal delay={0.2}>
            <div className={mobile ? "space-y-4" : "space-y-6"}>
              <ContactCard icon={<Phone className="text-[#F97316]" size={24} />} label="Sună-ne" value={PHONE} big onClick={() => notify(MSG.call)} />
              <ContactCard icon={<Mail className="text-[#F97316]" size={24} />} label="Email" value={EMAIL} onClick={() => notify(MSG.email)} />
              <ContactCard
                icon={<MessageCircle className="text-[#25D466]" size={24} />}
                tint="bg-[#25D466]/10"
                label="WhatsApp"
                value="Scrie-ne pe WhatsApp"
                onClick={() => notify(MSG.whatsapp)}
              />
              <ContactCard icon={<MapPin className="text-[#F97316]" size={24} />} label="Adresă" value={ADDRESS} plain />
              <ContactCard icon={<Clock className="text-[#F97316]" size={24} />} label="Program" value={HOURS} plain />
            </div>
          </Reveal>
        </div>
      </section>

      <MapBlock />
    </>
  );
}

function ContactCard({
  icon,
  label,
  value,
  onClick,
  big,
  plain,
  tint = "bg-[#F97316]/10",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  onClick?: () => void;
  big?: boolean;
  plain?: boolean;
  tint?: string;
}) {
  const { mobile } = useAI();
  const inner = (
    <>
      <span className={`flex shrink-0 items-center justify-center rounded-xl ${tint} ${mobile ? "size-12" : "size-14"}`}>{icon}</span>
      <span className="min-w-0">
        <span className="block text-sm text-[#9096A2]">{label}</span>
        <span className={plain ? "block font-medium text-[#EBE6E0]" : `ai-h block break-all font-bold text-[#EBE6E0] ${big ? "text-xl" : "text-lg"}`}>
          {value}
        </span>
      </span>
    </>
  );
  const cls = `flex w-full items-center gap-4 ${CARD} text-left ${mobile ? "p-4" : "p-6"}`;
  return plain ? (
    <div className={cls}>{inner}</div>
  ) : (
    <button type="button" onClick={onClick} className={`${cls} ${CARD_HOVER} ${FOCUS}`}>
      {inner}
    </button>
  );
}

/** Harta: un desen static în locul iframe-ului Google Maps de pe site. */
function MapBlock() {
  const { mobile, notify } = useAI();
  const h = mobile ? 240 : 400;
  return (
    <section className="relative overflow-hidden border-t border-[#272C35] bg-[#12151A]" style={{ height: h }}>
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1280 400" preserveAspectRatio="xMidYMid slice" aria-hidden>
        <defs>
          <pattern id="ai-blocks" width="64" height="64" patternUnits="userSpaceOnUse">
            <rect width="64" height="64" fill="#12151A" />
            <rect x="6" y="6" width="52" height="52" rx="4" fill="#171B21" />
          </pattern>
        </defs>
        <rect width="1280" height="400" fill="url(#ai-blocks)" />
        <path d="M-20 330 C 200 280, 380 360, 560 300 S 900 170, 1300 230" stroke="#1B3A52" strokeWidth="26" fill="none" />
        <path d="M-20 100 L 1300 160" stroke="#2A2F38" strokeWidth="14" fill="none" />
        <path d="M420 -20 L 700 420" stroke="#2A2F38" strokeWidth="12" fill="none" />
        <path d="M900 -20 C 860 130, 980 240, 940 420" stroke="#2A2F38" strokeWidth="9" fill="none" />
        <path d="M-20 220 L 1300 50" stroke="#22272F" strokeWidth="6" fill="none" />
        <text x="1010" y="262" fill="#3E6A8C" fontSize="14" fontStyle="italic" fontFamily="Georgia, serif">râul Argeș</text>
      </svg>
      <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-full flex-col items-center">
        <div className="mb-2 rounded-lg border border-[#272C35] bg-[#15181E] px-3 py-2 text-center shadow-xl shadow-black/50">
          <p className="ai-h text-sm font-bold text-[#EBE6E0]">ART INSTAL SUPPLIERS S.R.L</p>
          <p className="text-xs text-[#9096A2]">Bd. Nicolae Bălcescu S5, Pitești</p>
        </div>
        <MapPin size={36} className="fill-[#F97316] text-[#0A0C0F]" />
      </div>
      <button
        type="button"
        onClick={() => notify(MSG.map)}
        className={`absolute rounded-lg bg-[#F6F3EE] px-4 py-2 text-sm font-semibold text-[#0E1115] shadow-lg transition-transform hover:scale-[1.03] ${FOCUS}`}
        style={mobile ? { left: 16, bottom: 16 } : { left: 64, bottom: 24 }}
      >
        Deschide în Google Maps
      </button>
    </section>
  );
}
