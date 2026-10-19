"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Calculator as CalcIcon, Info, Sparkles } from "lucide-react";
import {
  AREA_MAX,
  AREA_MIN,
  COUNTIES,
  COUNTY_ZONE,
  HEAT_OPTIONS,
  INSUL_OPTIONS,
  LEVEL_OPTIONS,
  THICKNESS,
  WIN_OPTIONS,
  ZONE_TE,
  calcQ,
  formInput,
  type CalcForm,
  type Heat,
  type Insul,
  type Levels,
  type Win,
} from "../data";
import { C, FORM_INPUT, Reveal, btnPrimary, container, offsetIn, pageTitle, useAI } from "../ui";
import { Results } from "./result";

/* ============================================================
   Calculatorul — CalculatorPage.tsx: un singur formular cu cele
   trei grupe, butonul activ abia când toate răspunsurile sunt date,
   rezultatele sub formular, pe aceeași pagină.
   ============================================================ */

/** Sub bara de navigare rămân 20px (desktop) / 16px (telefon) până la rezultate. */
const RESULTS_GAP = { desktop: 100, mobile: 80 };

export function Calculator({
  initialForm,
  initialShown,
  jump,
}: {
  initialForm: CalcForm;
  initialShown: boolean;
  /** Deschide pagina direct la rezultate (pasul „Recomandarea” din tur). */
  jump: boolean;
}) {
  const { mobile, scroller, reduced } = useAI();
  const [form, setForm] = useState<CalcForm>(initialForm);
  const [shown, setShown] = useState(initialShown);
  const resultsRef = useRef<HTMLDivElement>(null);
  const jumped = useRef(false);

  const input = formInput(form);
  const ready = input !== null;
  const hc = input ? calcQ(input) : NaN;
  const areaNum = parseFloat(form.area);
  const areaOut = form.area !== "" && Number.isFinite(areaNum) && !(areaNum >= AREA_MIN && areaNum <= AREA_MAX);

  const set = <K extends keyof CalcForm>(k: K, v: CalcForm[K]) => setForm((f) => ({ ...f, [k]: v }));

  const scrollToResults = (smooth: boolean) => {
    const el = resultsRef.current;
    if (!el || !scroller) return;
    const top = offsetIn(scroller, el) - (mobile ? RESULTS_GAP.mobile : RESULTS_GAP.desktop);
    scroller.scrollTo({ top, behavior: smooth && !reduced ? "smooth" : "auto" });
  };

  /* Intrarea direct la rezultate: după ce fonturile s-au încărcat,
     altfel rândurile se rearanjează și poziția iese greșită. */
  useEffect(() => {
    if (!jump || jumped.current || !scroller) return;
    jumped.current = true;
    let raf = 0;
    const go = () => {
      raf = requestAnimationFrame(() => scrollToResults(false));
    };
    if (document.fonts.status === "loaded") go();
    else void document.fonts.ready.then(go);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jump, scroller]);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!ready) return;
    setShown(true);
    window.setTimeout(() => scrollToResults(true), 50);
  };

  const twoCols = mobile ? "grid gap-5" : "grid grid-cols-2 gap-5";

  return (
    <>
      <section className="bg-[#0A0C0F] pb-8 pt-32">
        <div className={container(mobile)}>
          <div className="mb-3 flex items-center gap-3">
            {/* Fără shrink-0, ca pe site: pe telefon cutia se îngustează. */}
            <div className="flex size-12 items-center justify-center rounded-[12px] bg-[#A370EB]/20">
              <Sparkles className="text-[#A370EB]" size={22} />
            </div>
            <div>
              <h1 className={pageTitle(mobile)}>Ce pompă de căldură să aleg?</h1>
              <p className="mt-1 text-sm text-[#F6F3EE]/60">
                Calculator inteligent de dimensionare — răspunsurile tale determină necesarul termic al locuinței.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className={mobile ? "px-4 py-16" : "px-8 py-24"}>
        <div className={`mx-auto max-w-[896px] ${mobile ? "px-4" : "px-8"}`}>
          <Reveal>
            <form
              onSubmit={onSubmit}
              className={`space-y-10 rounded-[16px] border border-[#272C35] bg-[#15181E] shadow-xl ${mobile ? "p-6" : "p-8"}`}
            >
              <div>
                <GroupTitle>Informații de bază</GroupTitle>
                <div className={twoCols}>
                  <Field id="ai-county" label="1. Selectați județul dvs." hint="Determină temperatura exterioară de calcul (zona climatică).">
                    <select id="ai-county" value={form.county} onChange={(e) => set("county", e.target.value)} className={FORM_INPUT}>
                      <option value="">Selectați...</option>
                      {COUNTIES.map((name) => (
                        <option key={name} value={name}>
                          {name} ({ZONE_TE[COUNTY_ZONE[name]]}°C)
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
                      value={form.area}
                      onChange={(e) => set("area", e.target.value)}
                      className={FORM_INPUT}
                      placeholder="ex: 120"
                    />
                    {areaOut && (
                      <p className="mt-1.5 text-xs text-[#F97015]" role="status">
                        Pentru această suprafață vă rugăm să solicitați o ofertă personalizată.
                      </p>
                    )}
                  </Field>
                  <Field id="ai-levels" label="3. Regimul de înălțime al casei" hint="Influențează suprafața acoperișului și a pardoselii expuse.">
                    <select id="ai-levels" value={form.levels} onChange={(e) => set("levels", e.target.value as Levels)} className={FORM_INPUT}>
                      <option value="">Selectați...</option>
                      {LEVEL_OPTIONS.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
              </div>

              <div>
                <GroupTitle>Izolație și anvelopă</GroupTitle>
                <div className={twoCols}>
                  <Field
                    id="ai-insul"
                    label="4. Izolația pereților exteriori"
                    hint="Considerăm că acoperișul și pardoseala au un nivel de izolare similar cu al pereților."
                  >
                    <select id="ai-insul" value={form.insul} onChange={(e) => set("insul", e.target.value as Insul)} className={FORM_INPUT}>
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
                      className={FORM_INPUT}
                    >
                      {form.insul === "none" ? (
                        <option value="0">Fără termoizolație</option>
                      ) : (
                        THICKNESS.map((t) => (
                          <option key={t} value={t}>
                            {t} cm
                          </option>
                        ))
                      )}
                    </select>
                  </Field>
                  <Field id="ai-win" label="5. Tipul ferestrelor (geamurilor)">
                    <select id="ai-win" value={form.win} onChange={(e) => set("win", e.target.value as Win)} className={FORM_INPUT}>
                      <option value="">Selectați...</option>
                      {WIN_OPTIONS.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
              </div>

              <div>
                <GroupTitle>Sistem și funcții</GroupTitle>
                <div className="space-y-5">
                  <div role="group" aria-labelledby="ai-heat-l">
                    <p id="ai-heat-l" className="mb-2 block text-sm font-medium text-[#EBE7E0]">
                      6. Sistem de încălzire
                    </p>
                    <div className={mobile ? "grid gap-3" : "grid grid-cols-3 gap-3"}>
                      {HEAT_OPTIONS.map((o) => {
                        const on = form.heat === o.id;
                        return (
                          <button
                            key={o.id}
                            type="button"
                            aria-pressed={on}
                            onClick={() => set("heat", o.id as Heat)}
                            className={`rounded-[12px] border-2 p-3 text-left text-sm font-semibold transition-all ${
                              on
                                ? "border-[#A370EB] bg-[#A370EB]/10 text-[#EBE7E0]"
                                : `border-[#272C35] bg-[#15181E] ${mobile ? "" : "hover:border-[#A370EB]/50"}`
                            }`}
                          >
                            {o.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div role="group" aria-labelledby="ai-dest-l">
                    <p id="ai-dest-l" className="mb-2 block text-sm font-medium text-[#EBE7E0]">
                      7. Destinație sistem <span className="font-normal text-[#9096A2]">(opțional — alege tot ce dorești)</span>
                    </p>
                    <div className="flex flex-wrap gap-3">
                      {(
                        [
                          ["heating", "Încălzire"],
                          ["cooling", "Răcire"],
                          ["acm", "Apă caldă menajeră (ACM)"],
                        ] as const
                      ).map(([k, label]) => (
                        <label
                          key={k}
                          className={`flex cursor-pointer items-center gap-2 rounded-[12px] border-2 px-4 py-2.5 transition-all ${
                            form[k] ? "border-[#A370EB] bg-[#A370EB]/10" : "border-[#272C35] bg-[#15181E]"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={form[k]}
                            onChange={(e) => set(k, e.target.checked)}
                            className="accent-[#A370EB]"
                          />
                          <span className="text-sm font-semibold">{label}</span>
                        </label>
                      ))}
                    </div>
                    {form.cooling && form.heat === "pardoseala" && (
                      <Note>Pentru răcire eficientă recomandăm ventiloconvectoare; pardoseala oferă doar răcire limitată.</Note>
                    )}
                    {form.acm && (
                      <Note>
                        Pentru ACM este nevoie de boiler cu serpentină (sau rezervor integrat) — echipa noastră îl dimensionează în ofertă.
                      </Note>
                    )}
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={!ready}
                className={`${btnPrimary(mobile)} w-full px-8 py-3.5 disabled:cursor-not-allowed disabled:opacity-50`}
                style={{ backgroundColor: C.wizard }}
              >
                <CalcIcon size={16} className="mr-2 shrink-0" /> Calculează recomandările
              </button>
            </form>
          </Reveal>

          {shown && input && Number.isFinite(hc) && (
            <div id="ai-results" ref={resultsRef} className="mt-14">
              <Results input={input} form={form} hc={hc} />
            </div>
          )}
        </div>
      </section>
    </>
  );
}

function GroupTitle({ children }: { children: ReactNode }) {
  return (
    <>
      <h2 className="mb-1 text-xl font-bold">{children}</h2>
      <div className="mb-5 h-px bg-[#272C35]" />
    </>
  );
}

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-[#EBE7E0]">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1.5 text-xs text-[#9096A2]">{hint}</p>}
    </div>
  );
}

function Note({ children }: { children: ReactNode }) {
  return (
    <p className="mt-2 flex items-start gap-1.5 text-xs text-[#9096A2]">
      <Info size={13} className="mt-0.5 shrink-0" />
      {children}
    </p>
  );
}
