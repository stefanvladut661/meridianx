"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Calculator as CalcIcon, CheckCircle2, Info, MessageCircle, Phone, Sparkles, Star } from "lucide-react";
import {
  AREA_MAX,
  AREA_MIN,
  COUNTIES,
  COUNTY_ZONE,
  EXAMPLE_FORM,
  HEAT_OPTIONS,
  INSUL_OPTIONS,
  LEVEL_OPTIONS,
  THICKNESS,
  WIN_OPTIONS,
  ZONE_TE,
  calcQ,
  formInput,
  goldenRuleOk,
  prag,
  productImg,
  recommend,
  type CalcForm,
  type Insul,
  type Levels,
  type Model,
  type Win,
} from "../data";
import { BTN_OUTLINE_WHITE, BTN_WIZARD, CARD, FOCUS, INPUT, MSG, Reveal, Sprite, useAI } from "../ui";

/* ============================================================
   Calculatorul — CalculatorPage.tsx de pe site: un singur formular
   cu trei grupe („Informații de bază”, „Izolație și anvelopă”,
   „Sistem și funcții”) și rezultatele dedesubt, în aceeași pagină,
   la care se derulează după „Calculează”. `example` e pasul
   „Recomandarea” din tur: formularul completat cu exemplul și
   rezultatele deja afișate, pentru cine nu vrea să scrie 7 câmpuri.
   ============================================================ */

export const kw = (n: number) =>
  `${n.toLocaleString("ro-RO", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kW`;

const HEAT_LABEL = (id: string) => HEAT_OPTIONS.find((h) => h.id === id)?.label ?? "-";
const SELECT = `${INPUT} cursor-pointer`;

const DEST: { k: "heating" | "cooling" | "acm"; label: string }[] = [
  { k: "heating", label: "Încălzire" },
  { k: "cooling", label: "Răcire" },
  { k: "acm", label: "Apă caldă menajeră (ACM)" },
];

export function Calculator({ example = false }: { example?: boolean }) {
  const { mobile, scroller, reduced, form, setForm, nav, notify } = useAI();
  const [show, setShow] = useState(example);
  const results = useRef<HTMLDivElement>(null);
  const booted = useRef(false);

  /* Pasul din tur: exemplul în formular, dacă omul n-a completat deja al lui. */
  useEffect(() => {
    if (!example || booted.current) return;
    booted.current = true;
    setForm((f) => (formInput(f) ? f : EXAMPLE_FORM));
    setShow(true);
  }, [example, setForm]);

  const set = <K extends keyof CalcForm>(k: K, v: CalcForm[K]) => setForm((f) => ({ ...f, [k]: v }));

  const input = formInput(form);
  const q = input ? calcQ(input) : NaN;
  const threshold = prag(q);
  const rec = useMemo(
    () => (Number.isFinite(threshold) ? recommend(threshold, form.cooling) : null),
    [threshold, form.cooling]
  );
  /* Garda de la randare: un model subdimensionat nu apare niciodată. */
  const cards = rec ? [rec.premium, rec.alternative].filter((m): m is Model => !!m && goldenRuleOk(m, threshold)) : [];
  const visible = show && input !== null && Number.isFinite(q);

  /* Ca pe site: după „Calculează”, pagina derulează la rezultate. */
  useEffect(() => {
    if (!visible || !scroller) return;
    const t = window.setTimeout(() => {
      const el = results.current;
      if (!el) return;
      /* sub bara fixă de meniu (80px pe desktop, 64 pe telefon), cu puțin aer */
      const top = el.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop - (mobile ? 80 : 96);
      scroller.scrollTo({ top, behavior: reduced ? "auto" : "smooth" });
    }, 80);
    return () => window.clearTimeout(t);
  }, [visible, scroller, reduced, mobile]);

  const areaNum = parseFloat(form.area);
  const areaOut = form.area !== "" && Number.isFinite(areaNum) && (areaNum < AREA_MIN || areaNum > AREA_MAX);
  const coolingNote = form.cooling && form.heat === "pardoseala";

  /* Pe site, „Cerere ofertă” deschide WhatsApp cu datele casei. În demo
     WhatsApp e oprit, așa că același mesaj ajunge în formularul de contact. */
  const quote = (m?: Model) => {
    const dest =
      [form.heating && "Încălzire", form.cooling && "Răcire", form.acm && "Apă caldă menajeră (ACM)"].filter(Boolean).join(", ") || "-";
    const message = [
      "Bună ziua! Cerere din calculatorul de dimensionare.",
      m ? `Model: ${m.brand} ${m.gama} — ${m.model} (${m.kW} kW)` : null,
      `Necesar termic calculat: ${kw(q)}`,
      `Suprafață: ${form.area} mp`,
      `Județ: ${form.county}`,
      `Sistem de încălzire: ${HEAT_LABEL(form.heat)}`,
      `Destinație: ${dest}`,
    ]
      .filter(Boolean)
      .join("\n");
    nav.contact({ service: "Pompe de căldură", message });
  };

  return (
    <>
      <section className="bg-[#0A0C0F]" style={{ paddingTop: mobile ? 100 : 128, paddingBottom: 32 }}>
        <div className={mobile ? "px-4" : "mx-auto max-w-[1216px] px-8"}>
          <div className="mb-3 flex items-center gap-3">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-[#A370EB]/20">
              <Sparkles className="text-[#A370EB]" size={22} />
            </div>
            <div>
              <h1 className={`ai-h font-black text-[#F6F3EE] ${mobile ? "text-[30px] leading-tight" : "text-[48px] leading-[1.1]"}`}>
                Ce pompă de căldură să aleg?
              </h1>
              <p className="mt-1 text-sm text-[#F6F3EE]/60">
                Calculator inteligent de dimensionare — răspunsurile tale determină necesarul termic al locuinței.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className={mobile ? "px-4 py-16" : "px-16 py-24"}>
        <div className={mobile ? "" : "mx-auto max-w-[832px]"}>
          <Reveal>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (input) setShow(true);
              }}
              className={`${CARD} space-y-10 shadow-xl shadow-black/30 ${mobile ? "p-6" : "p-8"}`}
            >
              <Group title="Informații de bază">
                <div className={mobile ? "space-y-5" : "grid grid-cols-2 gap-5"}>
                  <Field id="ai-county" label="1. Selectați județul dvs." hint="Determină temperatura exterioară de calcul (zona climatică).">
                    <select id="ai-county" value={form.county} onChange={(e) => set("county", e.target.value)} className={SELECT}>
                      <option value="">Selectați...</option>
                      {COUNTIES.map((c) => (
                        <option key={c} value={c}>
                          {c} ({ZONE_TE[COUNTY_ZONE[c]]}°C)
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field id="ai-area" label="2. Suprafața totală încălzită (mp)" hint={`Interval acceptat: ${AREA_MIN}–${AREA_MAX} mp.`}>
                    <input
                      id="ai-area"
                      type="number"
                      min={AREA_MIN}
                      max={AREA_MAX}
                      inputMode="numeric"
                      value={form.area}
                      onChange={(e) => set("area", e.target.value)}
                      className={INPUT}
                      placeholder="ex: 120"
                    />
                    {areaOut && (
                      <p className="mt-1.5 text-xs text-[#F97316]">Pentru această suprafață vă rugăm să solicitați o ofertă personalizată.</p>
                    )}
                  </Field>
                  <Field id="ai-levels" label="3. Regimul de înălțime al casei" hint="Influențează suprafața acoperișului și a pardoselii expuse.">
                    <select id="ai-levels" value={form.levels} onChange={(e) => set("levels", e.target.value as Levels | "")} className={SELECT}>
                      <option value="">Selectați...</option>
                      {LEVEL_OPTIONS.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
              </Group>

              <Group title="Izolație și anvelopă">
                <div className={mobile ? "space-y-5" : "grid grid-cols-2 gap-5"}>
                  <Field
                    id="ai-insul"
                    label="4. Izolația pereților exteriori"
                    hint="Considerăm că acoperișul și pardoseala au un nivel de izolare similar cu al pereților."
                  >
                    <select id="ai-insul" value={form.insul} onChange={(e) => set("insul", e.target.value as Insul | "")} className={SELECT}>
                      <option value="">Selectați...</option>
                      {INSUL_OPTIONS.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field id="ai-thick" label="Grosimea termoizolației">
                    <select
                      id="ai-thick"
                      value={form.insul === "none" ? "0" : form.thick}
                      onChange={(e) => set("thick", e.target.value)}
                      className={SELECT}
                    >
                      {form.insul === "none" ? (
                        <option value="0">Fără termoizolație</option>
                      ) : (
                        THICKNESS.map((t) => (
                          <option key={t} value={String(t)}>
                            {t} cm
                          </option>
                        ))
                      )}
                    </select>
                  </Field>
                  <Field id="ai-win" label="5. Tipul ferestrelor (geamurilor)">
                    <select id="ai-win" value={form.win} onChange={(e) => set("win", e.target.value as Win | "")} className={SELECT}>
                      <option value="">Selectați...</option>
                      {WIN_OPTIONS.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
              </Group>

              <Group title="Sistem și funcții">
                <div className="space-y-5">
                  <div role="group" aria-labelledby="ai-heat-l">
                    <p id="ai-heat-l" className="mb-2 block text-sm font-medium text-[#EBE6E0]">
                      6. Sistem de încălzire
                    </p>
                    <div className={`grid gap-3 ${mobile ? "grid-cols-1" : "grid-cols-3"}`}>
                      {HEAT_OPTIONS.map((o) => {
                        const on = form.heat === o.id;
                        return (
                          <button
                            key={o.id}
                            type="button"
                            aria-pressed={on}
                            onClick={() => set("heat", o.id)}
                            className={`rounded-xl border-2 p-3 text-left text-sm font-semibold transition-all ${FOCUS} ${
                              on ? "border-[#A370EB] bg-[#A370EB]/10 text-[#EBE6E0]" : "border-[#272C35] bg-[#15181E] text-[#EBE6E0] hover:border-[#A370EB]/50"
                            }`}
                          >
                            {o.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div role="group" aria-labelledby="ai-dest-l">
                    <p id="ai-dest-l" className="mb-2 block text-sm font-medium text-[#EBE6E0]">
                      7. Destinație sistem <span className="font-normal text-[#9096A2]">(opțional — alege tot ce dorești)</span>
                    </p>
                    <div className="flex flex-wrap gap-3">
                      {DEST.map((d) => {
                        const on = form[d.k];
                        return (
                          <label
                            key={d.k}
                            className={`flex cursor-pointer items-center gap-2 rounded-xl border-2 px-4 py-2.5 transition-all ${
                              on ? "border-[#A370EB] bg-[#A370EB]/10" : "border-[#272C35] bg-[#15181E]"
                            }`}
                          >
                            <input type="checkbox" checked={on} onChange={(e) => set(d.k, e.target.checked)} className="accent-[#A370EB]" />
                            <span className="text-sm font-semibold text-[#EBE6E0]">{d.label}</span>
                          </label>
                        );
                      })}
                    </div>
                    {coolingNote && (
                      <p className="mt-2 flex items-start gap-1.5 text-xs text-[#9096A2]">
                        <Info size={13} className="mt-0.5 shrink-0" />
                        Pentru răcire eficientă recomandăm ventiloconvectoare; pardoseala oferă doar răcire limitată.
                      </p>
                    )}
                    {form.acm && (
                      <p className="mt-2 flex items-start gap-1.5 text-xs text-[#9096A2]">
                        <Info size={13} className="mt-0.5 shrink-0" />
                        Pentru ACM este nevoie de boiler cu serpentină (sau rezervor integrat) — echipa noastră îl dimensionează în ofertă.
                      </p>
                    )}
                  </div>
                </div>
              </Group>

              <button type="submit" disabled={!input} className={`${BTN_WIZARD} w-full px-8 py-3.5`}>
                <CalcIcon size={16} /> Calculează recomandările
              </button>
            </form>
          </Reveal>

          {visible && (
            <div ref={results} className="mt-14">
              <Reveal>
                <div className="mb-8 text-center">
                  <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#A370EB]/30 bg-[#A370EB]/10 px-4 py-2">
                    <CheckCircle2 className="text-[#A370EB]" size={16} />
                    <span className="text-xs font-semibold uppercase tracking-wider text-[#A370EB]">Recomandări personalizate</span>
                  </div>
                  <h2 className={`ai-h mb-2 font-black text-[#EBE6E0] ${mobile ? "text-2xl" : "text-4xl"}`}>
                    Necesarul termic calculat pentru casa dvs:
                  </h2>
                  <p className={`ai-h font-black text-[#A370EB] ${mobile ? "text-5xl" : "text-6xl"}`}>{kw(q)}</p>
                </div>

                {cards.length === 0 ? (
                  <div className={`${CARD} mx-auto max-w-xl p-8 text-center`}>
                    <h3 className="ai-h mb-2 text-xl font-bold text-[#EBE6E0]">Soluție personalizată</h3>
                    <p className="mb-5 text-sm text-[#9096A2]">
                      Necesar estimat: {kw(q)}. Pentru această putere recomandăm o configurație personalizată (ex. montaj în cascadă).
                    </p>
                    <button type="button" onClick={() => quote()} className={`${BTN_WIZARD} px-8 py-3.5`}>
                      <MessageCircle size={16} /> Solicită ofertă personalizată
                    </button>
                  </div>
                ) : (
                  <div className={`mx-auto grid max-w-3xl gap-6 ${mobile ? "grid-cols-1" : "grid-cols-2"}`}>
                    {cards.map((m) => (
                      <ModelCard key={m.model} m={m} onQuote={() => quote(m)} />
                    ))}
                  </div>
                )}

                <p className="mx-auto mt-6 max-w-2xl text-center text-xs text-[#9096A2]">
                  Estimare orientativă. Dimensionarea finală se confirmă de echipa noastră în funcție de izolație, suprafața vitrată și temperatura de proiect.
                </p>

                <div className={`mt-8 flex gap-3 ${mobile ? "flex-col" : ""}`}>
                  <button type="button" onClick={() => notify(MSG.call)} className={`${BTN_WIZARD} flex-1 px-8 py-3.5`}>
                    <Phone size={16} /> Sună un consultant
                  </button>
                  <button type="button" onClick={() => notify(MSG.whatsapp)} className={`${BTN_OUTLINE_WHITE} flex-1 px-8 py-3.5`}>
                    <MessageCircle size={16} /> WhatsApp
                  </button>
                </div>
              </Reveal>
            </div>
          )}
        </div>
      </section>
    </>
  );
}

/* ---------------- Grupele și câmpurile formularului ---------------- */

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h2 className="ai-h mb-1 text-xl font-bold text-[#EBE6E0]">{title}</h2>
      <div className="mb-5 h-px bg-[#272C35]" />
      {children}
    </div>
  );
}

function Field({ id, label, hint, children }: { id: string; label: ReactNode; hint?: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-[#EBE6E0]">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1.5 text-xs text-[#9096A2]">{hint}</p>}
    </div>
  );
}

/* ---------------- Cardul de model (ca pe site) ---------------- */

function ModelCard({ m, onQuote }: { m: Model; onQuote: () => void }) {
  const best = m.tier === "premium";
  return (
    <article
      className={`relative flex flex-col overflow-hidden rounded-2xl bg-[#15181E] ${
        best ? "border-2 border-[#A370EB] shadow-xl shadow-[#A370EB]/20" : "border border-[#272C35]"
      }`}
    >
      {best && (
        <div className="absolute right-3 top-3 z-10 inline-flex items-center gap-1 rounded-full bg-[#A370EB] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
          <Star size={11} className="fill-current" /> Recomandat
        </div>
      )}
      <div className={`border-b p-4 ${best ? "border-[#A370EB]/30 bg-[#A370EB]/10" : "border-[#272C35] bg-[#1E2229]"}`}>
        <p className={`text-xs font-semibold uppercase tracking-wider ${best ? "text-[#A370EB]" : "text-[#9096A2]"}`}>{m.brand}</p>
        <h3 className="ai-h mt-1 text-lg font-bold leading-snug text-[#EBE6E0]">{m.gama}</h3>
        <p className="text-sm text-[#9096A2]">Pompă de căldură</p>
      </div>
      <div className="flex aspect-video items-center justify-center overflow-hidden bg-[#1E2229] p-3">
        <Sprite sheet="prod" i={productImg(m.productId)} box={4 / 3} alt={`${m.brand} ${m.gama}`} className="h-full rounded" />
      </div>
      <div className="flex flex-1 flex-col p-5">
        <p className="text-xs text-[#9096A2]">Model recomandat</p>
        <p className="ai-h mt-1 text-base font-bold text-[#EBE6E0]">{m.model}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="rounded-md bg-[#1E2229] px-2 py-1 text-xs font-semibold text-[#EBE6E0]">{m.kW} kW</span>
          <span className="rounded-md bg-[#1E2229] px-2 py-1 text-xs font-semibold text-[#EBE6E0]">{m.agent}</span>
        </div>
        <p className="mt-4 flex-1 text-sm text-[#9096A2]">{m.descriere}</p>
        <button
          type="button"
          onClick={onQuote}
          className={`mt-4 inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors ${FOCUS} ${
            best ? "bg-[#A370EB] text-white hover:opacity-90" : "bg-[#F97316] text-white hover:bg-[#E55F06]"
          }`}
        >
          <MessageCircle size={15} /> Cerere ofertă
        </button>
      </div>
    </article>
  );
}
