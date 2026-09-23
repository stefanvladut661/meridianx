"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Calculator as CalcIcon,
  Check,
  Fan,
  Heater,
  Info,
  LoaderCircle,
  Sparkles,
  Waves,
  Wand2,
} from "lucide-react";
import {
  AREA_MAX,
  AREA_MIN,
  CATALOG,
  COUNTIES,
  COUNTY_ZONE,
  EXAMPLE_FORM,
  HEAT_OPTIONS,
  INSUL_OPTIONS,
  LEVEL_FACTOR,
  LEVEL_OPTIONS,
  SYSTEM_FACTOR,
  THICKNESS,
  WIN_FACTOR,
  WIN_OPTIONS,
  ZONE_FACTOR,
  ZONE_TE,
  answered,
  calcQ,
  formInput,
  prag,
  qBase,
  recommend,
  thicknessOf,
  type CalcForm,
  type Heat,
} from "../data";
import { BTN_WIZARD, CARD, FOCUS, HouseGlyph, INPUT, anim, useAI } from "../ui";

/* ============================================================
   Calculatorul — CalculatorPage.tsx, împărțit în cele trei grupe
   de pe site („Informații de bază”, „Izolație și anvelopă”,
   „Sistem și funcții”), cu un panou care arată formula în lucru.
   ============================================================ */

export const kw = (n: number) =>
  `${n.toLocaleString("ro-RO", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kW`;
const fx = (n: number) => `×${n.toLocaleString("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const te = (n: number) => `${n < 0 ? "−" : ""}${Math.abs(n)}°C`;

const STEPS = ["Informații de bază", "Izolație și anvelopă", "Sistem și funcții"];

type Err = Partial<Record<"county" | "area" | "levels" | "insul" | "win" | "heat", string>>;

function errorsFor(f: CalcForm, step: number): Err {
  const e: Err = {};
  if (step === 0) {
    if (!f.county) e.county = "Alege județul — de el depinde temperatura de calcul.";
    const a = parseFloat(f.area);
    if (f.area === "" || !Number.isFinite(a)) e.area = `Scrie suprafața încălzită, între ${AREA_MIN} și ${AREA_MAX} mp.`;
    else if (a < AREA_MIN || a > AREA_MAX) e.area = "Pentru această suprafață vă rugăm să solicitați o ofertă personalizată.";
    if (!f.levels) e.levels = "Alege regimul de înălțime al casei.";
  }
  if (step === 1) {
    if (!f.insul) e.insul = "Alege izolația pereților; dacă nu e izolată, alege „Neizolat”.";
    if (!f.win) e.win = "Alege tipul ferestrelor.";
  }
  if (step === 2) {
    if (!f.heat) e.heat = "Alege sistemul de încălzire din casă.";
  }
  return e;
}

const FIELD_ID: Record<keyof Err, string> = {
  county: "ai-county",
  area: "ai-area",
  levels: "ai-levels",
  insul: "ai-insul",
  win: "ai-win",
  heat: "ai-heat",
};

export function Calculator({
  step,
  setStep,
  onComputed,
}: {
  step: number;
  setStep: (n: number) => void;
  onComputed: () => void;
}) {
  const { mobile, form, setForm, reduced, scroller } = useAI();
  const [tried, setTried] = useState<boolean[]>([false, false, false]);
  const [computing, setComputing] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const errs = errorsFor(form, step);
  const showErr = tried[step];
  const input = formInput(form);
  const q = input ? calcQ(input) : NaN;

  const set = <K extends keyof CalcForm>(k: K, v: CalcForm[K]) => setForm((f) => ({ ...f, [k]: v }));

  const scrollToCard = () => {
    const el = cardRef.current;
    if (!el || !scroller) return;
    const top = el.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop - (mobile ? 76 : 96);
    if (scroller.scrollTop > top) scroller.scrollTo({ top, behavior: reduced ? "auto" : "smooth" });
  };

  /** Primul pas (până la `upTo`, exclusiv) care are câmpuri necompletate. */
  const firstInvalid = (upTo: number) => {
    for (let s = 0; s < upTo; s++) if (Object.keys(errorsFor(form, s)).length) return s;
    return -1;
  };

  const failAt = (s: number) => {
    const keys = Object.keys(errorsFor(form, s)) as (keyof Err)[];
    setStep(s);
    setTried((t) => t.map((v, i) => (i === s ? true : v)));
    scrollToCard();
    window.setTimeout(() => document.getElementById(FIELD_ID[keys[0]])?.focus(), 40);
  };

  const tryGo = (to: number) => {
    const bad = to > step ? firstInvalid(to) : -1;
    if (bad >= 0) return failAt(bad);
    setStep(to);
    scrollToCard();
  };

  const submit = () => {
    const bad = firstInvalid(3);
    if (bad >= 0) return failAt(bad);
    if (!input) return;
    if (reduced) return onComputed();
    scrollToCard();
    setComputing(true);
  };

  const fillExample = () => {
    setForm(EXAMPLE_FORM);
    setTried([false, false, false]);
    setStep(2);
  };

  return (
    <>
      <section className="bg-[#0A0C0F]" style={{ paddingTop: mobile ? 100 : 118, paddingBottom: mobile ? 28 : 32 }}>
        <div className={mobile ? "px-4" : "mx-auto max-w-[1152px]"}>
          <div className={mobile ? "flex flex-col items-start gap-3" : "flex items-center gap-3"}>
            <div className={`flex shrink-0 items-center justify-center rounded-xl bg-[#A370EB]/20 ${mobile ? "size-11" : "size-12"}`}>
              <Sparkles className="text-[#A370EB]" size={22} />
            </div>
            <div>
              <h1 className={`ai-h font-black text-[#F6F3EE] ${mobile ? "text-[26px] leading-tight" : "text-[44px] leading-[1.1]"}`}>
                Ce pompă de căldură să aleg?
              </h1>
              <p className="mt-1 text-sm text-[#F6F3EE]/60">
                Calculator inteligent de dimensionare — răspunsurile tale determină necesarul termic al locuinței.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className={mobile ? "px-4 pb-24 pt-6" : "px-16 pb-24 pt-10"}>
        <div className={mobile ? "" : "mx-auto grid max-w-[1152px] grid-cols-[1fr_356px] items-start gap-8"}>
          <div ref={cardRef} className={`${CARD} relative shadow-xl shadow-black/30 ${mobile ? "p-5" : "p-8"}`}>
            <Stepper step={step} onPick={tryGo} mobile={mobile} />

            <div className="mt-6 flex items-center justify-between gap-3">
              <h2 className="ai-h text-xl font-bold text-[#EBE6E0]">{STEPS[step]}</h2>
              <button
                type="button"
                onClick={fillExample}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#272C35] px-3 py-1.5 text-xs font-semibold text-[#9096A2] transition-colors hover:border-[#A370EB]/60 hover:text-[#A370EB] ${FOCUS}`}
              >
                <Wand2 size={13} /> {mobile ? "Exemplu" : "Completează un exemplu"}
              </button>
            </div>
            <div className="mb-6 mt-1 h-px bg-[#272C35]" />

            <div key={step} style={anim(reduced, "aiFadeUp .35s ease-out both")}>
              {step === 0 && <StepBasics errs={showErr ? errs : {}} set={set} />}
              {step === 1 && <StepEnvelope errs={showErr ? errs : {}} set={set} />}
              {step === 2 && <StepSystem errs={showErr ? errs : {}} set={set} />}
            </div>

            {mobile && (
              <div className="mt-6 flex items-center justify-between rounded-xl border border-[#272C35] bg-[#0E1115] px-4 py-3">
                <span className="text-xs text-[#9096A2]">
                  {answered(form)}/7 răspunsuri
                </span>
                <span className="text-sm text-[#EBE6E0]">
                  Necesar: <b className="ai-h text-base text-[#A370EB]">{Number.isFinite(q) ? kw(q) : "—"}</b>
                </span>
              </div>
            )}

            <div className={`mt-8 flex items-center gap-3 ${step === 0 ? "justify-end" : "justify-between"}`}>
              {step > 0 && (
                <button
                  type="button"
                  onClick={() => tryGo(step - 1)}
                  className={`inline-flex items-center gap-2 rounded-lg border border-[#272C35] px-5 py-3 text-sm font-semibold text-[#EBE6E0] transition-colors hover:border-[#A370EB]/60 ${FOCUS}`}
                >
                  <ArrowLeft size={16} /> Înapoi
                </button>
              )}
              {step < 2 ? (
                <button type="button" onClick={() => tryGo(step + 1)} className={`${BTN_WIZARD} px-6 py-3 text-sm`}>
                  Continuă <ArrowRight size={16} />
                </button>
              ) : (
                <button type="button" onClick={submit} className={`${BTN_WIZARD} px-6 py-3 ${mobile ? "flex-1 text-sm" : ""}`}>
                  <CalcIcon size={16} /> Calculează recomandările
                </button>
              )}
            </div>

            {computing && input && (
              <Computing
                q={q}
                county={form.county}
                area={input.areaM2}
                qb={qBase(input.insulationCm)}
                fl={LEVEL_FACTOR[input.levels]}
                fw={WIN_FACTOR[input.windows]}
                fs={SYSTEM_FACTOR[input.system]}
                cooling={form.cooling}
                onDone={onComputed}
                top={mobile}
              />
            )}
          </div>

          <div className={mobile ? "mt-6" : "sticky top-24"}>
            <LivePanel />
          </div>
        </div>
      </section>
    </>
  );
}

/* ---------------- Pașii ---------------- */

function Stepper({ step, onPick, mobile }: { step: number; onPick: (n: number) => void; mobile: boolean }) {
  return (
    <ol className="flex gap-2" aria-label="Pașii calculatorului">
      {STEPS.map((s, i) => {
        const done = i < step;
        const on = i === step;
        return (
          <li key={s} className="min-w-0 flex-1">
            <button
              type="button"
              onClick={() => onPick(i)}
              aria-current={on ? "step" : undefined}
              className={`w-full rounded-md text-left ${FOCUS}`}
            >
              <span className="block h-1.5 overflow-hidden rounded-full bg-[#272C35]">
                <span
                  className="block h-full rounded-full bg-[#A370EB] transition-all duration-500"
                  style={{ width: done || on ? "100%" : "0%", opacity: on ? 1 : done ? 0.55 : 0 }}
                />
              </span>
              <span className="mt-2 flex items-center gap-1.5">
                <span
                  className={`flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                    on ? "bg-[#A370EB] text-white" : done ? "bg-[#A370EB]/25 text-[#A370EB]" : "border border-[#272C35] text-[#9096A2]"
                  }`}
                >
                  {done ? <Check size={12} /> : i + 1}
                </span>
                <span className={`truncate text-xs font-semibold ${on ? "text-[#EBE6E0]" : "text-[#9096A2]"}`}>
                  {mobile && !on ? `Pasul ${i + 1}` : s}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function Field({
  label,
  hint,
  error,
  children,
  id,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
  id?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-[#EBE6E0]">
        {label}
      </label>
      {children}
      {error ? (
        <p role="alert" className="mt-1.5 text-xs font-medium text-[#F97316]">
          {error}
        </p>
      ) : (
        hint && <p className="mt-1.5 text-xs text-[#9096A2]">{hint}</p>
      )}
    </div>
  );
}

function GroupLabel({ children, id }: { children: ReactNode; id: string }) {
  return (
    <p id={id} className="mb-2 block text-sm font-medium text-[#EBE6E0]">
      {children}
    </p>
  );
}

function choice(active: boolean, invalid = false, center = false) {
  return `rounded-xl border-2 ${center ? "text-center" : "text-left"} transition-all ${FOCUS} ${
    active
      ? "border-[#A370EB] bg-[#A370EB]/10 text-[#EBE6E0]"
      : `${invalid ? "border-[#F97316]/50" : "border-[#272C35]"} bg-[#15181E] text-[#EBE6E0] hover:border-[#A370EB]/50`
  }`;
}

type SetFn = <K extends keyof CalcForm>(k: K, v: CalcForm[K]) => void;

function StepBasics({ errs, set }: { errs: Err; set: SetFn }) {
  const { form, mobile, nav } = useAI();
  const zone = form.county ? COUNTY_ZONE[form.county] : null;
  const a = parseFloat(form.area);
  const out = form.area !== "" && Number.isFinite(a) && (a < AREA_MIN || a > AREA_MAX);
  return (
    <div className="space-y-6">
      <div className={`grid gap-5 ${mobile ? "grid-cols-1" : "grid-cols-2"}`}>
        <Field
          id="ai-county"
          label="1. Selectați județul dvs."
          error={errs.county}
          hint={
            zone ? (
              <span className="inline-flex items-center gap-1.5 text-[#A370EB]">
                <Check size={12} /> Zona climatică {zone} · temperatura de calcul {te(ZONE_TE[zone])}
              </span>
            ) : (
              "Determină temperatura exterioară de calcul (zona climatică)."
            )
          }
        >
          <select
            id="ai-county"
            value={form.county}
            onChange={(e) => set("county", e.target.value)}
            aria-invalid={!!errs.county}
            className={`${INPUT} cursor-pointer appearance-none bg-[length:16px] bg-[right_14px_center] bg-no-repeat pr-10`}
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%239096A2' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
            }}
          >
            <option value="">Selectați...</option>
            {COUNTIES.map((name) => (
              <option key={name} value={name}>
                {name} ({te(ZONE_TE[COUNTY_ZONE[name]])})
              </option>
            ))}
          </select>
        </Field>

        <Field
          id="ai-area"
          label="2. Suprafața totală încălzită (mp)"
          error={out ? undefined : errs.area}
          hint={`Interval acceptat: ${AREA_MIN}–${AREA_MAX} mp.`}
        >
          <input
            id="ai-area"
            type="number"
            inputMode="numeric"
            min={AREA_MIN}
            max={AREA_MAX}
            value={form.area}
            onChange={(e) => set("area", e.target.value)}
            aria-invalid={!!errs.area || out}
            className={INPUT}
            placeholder="ex: 120"
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {[80, 100, 150, 200].map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => set("area", String(v))}
                className={`rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors ${FOCUS} ${
                  form.area === String(v)
                    ? "border-[#A370EB] bg-[#A370EB]/15 text-[#EBE6E0]"
                    : "border-[#272C35] text-[#9096A2] hover:border-[#A370EB]/50 hover:text-[#EBE6E0]"
                }`}
              >
                {v} mp
              </button>
            ))}
          </div>
          {out && (
            <p role="alert" className="mt-2 text-xs font-medium text-[#F97316]">
              Pentru această suprafață vă rugăm să solicitați o ofertă personalizată.{" "}
              <button
                type="button"
                onClick={() =>
                  nav.contact({
                    service: "Pompe de căldură",
                    context: `Casă de ${form.area} mp`,
                    message: `Bună ziua! Am o casă de ${form.area} mp și aș dori o ofertă personalizată pentru pompă de căldură.`,
                  })
                }
                className={`rounded underline ${FOCUS}`}
              >
                Cere ofertă
              </button>
            </p>
          )}
        </Field>
      </div>

      <div>
        <GroupLabel id="ai-levels-l">3. Regimul de înălțime al casei</GroupLabel>
        <div
          role="radiogroup"
          aria-labelledby="ai-levels-l"
          className={`grid gap-2.5 ${mobile ? "grid-cols-1" : "grid-cols-5"}`}
        >
          {LEVEL_OPTIONS.map((l, i) => {
            const on = form.levels === l.id;
            return (
              <button
                key={l.id}
                id={i === 0 ? "ai-levels" : undefined}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => set("levels", l.id)}
                className={`${choice(on, !!errs.levels, !mobile)} ${mobile ? "flex items-center gap-3 px-3 py-2" : "flex flex-col items-center px-2 pb-3 pt-2"}`}
              >
                <span className={on ? "text-[#A370EB]" : "text-[#9096A2]"}>
                  <HouseGlyph kind={l.id} size={mobile ? 34 : 44} />
                </span>
                <span className={mobile ? "min-w-0" : ""}>
                  <span className="block text-sm font-bold">{l.short}</span>
                  <span className={`block text-[11px] leading-snug text-[#9096A2] ${mobile ? "" : "mt-0.5"}`}>{l.label}</span>
                </span>
              </button>
            );
          })}
        </div>
        {errs.levels ? (
          <p role="alert" className="mt-1.5 text-xs font-medium text-[#F97316]">
            {errs.levels}
          </p>
        ) : (
          <p className="mt-1.5 text-xs text-[#9096A2]">Influențează suprafața acoperișului și a pardoselii expuse.</p>
        )}
      </div>
    </div>
  );
}

function StepEnvelope({ errs, set }: { errs: Err; set: SetFn }) {
  const { form, mobile } = useAI();
  const none = form.insul === "none";
  const q = form.insul ? qBase(thicknessOf(form)) : NaN;
  return (
    <div className="space-y-6">
      <div>
        <GroupLabel id="ai-insul-l">4. Izolația pereților exteriori</GroupLabel>
        <div role="radiogroup" aria-labelledby="ai-insul-l" className={`grid gap-2.5 ${mobile ? "grid-cols-2" : "grid-cols-3"}`}>
          {INSUL_OPTIONS.map((o, i) => {
            const on = form.insul === o.id;
            return (
              <button
                key={o.id}
                id={i === 0 ? "ai-insul" : undefined}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => set("insul", o.id)}
                className={`${choice(on, !!errs.insul)} px-3 py-2.5 text-[13px] font-semibold leading-snug`}
              >
                {o.label}
              </button>
            );
          })}
        </div>
        {errs.insul ? (
          <p role="alert" className="mt-1.5 text-xs font-medium text-[#F97316]">
            {errs.insul}
          </p>
        ) : (
          <p className="mt-1.5 text-xs text-[#9096A2]">
            Considerăm că acoperișul și pardoseala au un nivel de izolare similar cu al pereților.
          </p>
        )}
      </div>

      <div>
        <GroupLabel id="ai-thick-l">Grosimea termoizolației</GroupLabel>
        <div role="radiogroup" aria-labelledby="ai-thick-l" className="flex flex-wrap gap-2">
          {none ? (
            <span className="rounded-full border border-[#272C35] px-4 py-2 text-sm text-[#9096A2]">Fără termoizolație</span>
          ) : (
            THICKNESS.map((t) => {
              const on = form.thick === String(t);
              return (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => set("thick", String(t))}
                  className={`rounded-full border px-4 py-2 text-sm font-semibold transition-all ${FOCUS} ${
                    on ? "border-[#A370EB] bg-[#A370EB] text-white" : "border-[#272C35] text-[#EBE6E0] hover:border-[#A370EB]/60"
                  }`}
                >
                  {t} cm
                </button>
              );
            })
          )}
        </div>
        <p className="mt-2 text-xs text-[#9096A2]">
          {Number.isFinite(q) ? (
            <>
              Pierderi de bază pentru {none ? "zidărie neizolată" : `${form.thick} cm`}:{" "}
              <b className="text-[#EBE6E0]">{Math.round(q)} W/m²</b>
            </>
          ) : (
            "Alege întâi materialul; grosimea implicită este 10 cm."
          )}
        </p>
      </div>

      <div>
        <GroupLabel id="ai-win-l">5. Tipul ferestrelor (geamurilor)</GroupLabel>
        <div role="radiogroup" aria-labelledby="ai-win-l" className="grid grid-cols-2 gap-2.5">
          {WIN_OPTIONS.map((o, i) => {
            const on = form.win === o.id;
            return (
              <button
                key={o.id}
                id={i === 0 ? "ai-win" : undefined}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => set("win", o.id)}
                className={`${choice(on, !!errs.win)} px-3 py-2.5 text-[13px] font-semibold leading-snug`}
              >
                {o.label}
              </button>
            );
          })}
        </div>
        {errs.win && (
          <p role="alert" className="mt-1.5 text-xs font-medium text-[#F97316]">
            {errs.win}
          </p>
        )}
      </div>
    </div>
  );
}

const HEAT_ICON: Record<Heat, typeof Heater> = { radiatoare: Heater, pardoseala: Waves, fan: Fan };

function StepSystem({ errs, set }: { errs: Err; set: SetFn }) {
  const { form, mobile } = useAI();
  const coolingNote = form.cooling && form.heat === "pardoseala";
  const box = (on: boolean) =>
    `flex cursor-pointer items-center gap-2 rounded-xl border-2 px-4 py-2.5 transition-all ${
      on ? "border-[#A370EB] bg-[#A370EB]/10" : "border-[#272C35] bg-[#15181E] hover:border-[#A370EB]/50"
    }`;
  return (
    <div className="space-y-6">
      <div>
        <GroupLabel id="ai-heat-l">6. Sistem de încălzire</GroupLabel>
        <div role="radiogroup" aria-labelledby="ai-heat-l" className={`grid gap-3 ${mobile ? "grid-cols-1" : "grid-cols-3"}`}>
          {HEAT_OPTIONS.map((o, i) => {
            const on = form.heat === o.id;
            const Icon = HEAT_ICON[o.id];
            return (
              <button
                key={o.id}
                id={i === 0 ? "ai-heat" : undefined}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => set("heat", o.id)}
                className={`${choice(on, !!errs.heat)} flex items-center gap-3 p-3`}
              >
                <span
                  className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${
                    on ? "bg-[#A370EB] text-white" : "bg-[#1E2229] text-[#9096A2]"
                  }`}
                >
                  <Icon size={20} />
                </span>
                <span>
                  <span className="block text-sm font-semibold">{o.label}</span>
                  <span className="block text-xs text-[#9096A2]">{o.line}</span>
                </span>
              </button>
            );
          })}
        </div>
        {errs.heat && (
          <p role="alert" className="mt-1.5 text-xs font-medium text-[#F97316]">
            {errs.heat}
          </p>
        )}
      </div>

      <div>
        <p className="mb-2 block text-sm font-medium text-[#EBE6E0]">
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
            <label key={k} className={`${box(form[k])} has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[#F97316]`}>
              <input
                type="checkbox"
                checked={form[k]}
                onChange={(e) => set(k, e.target.checked)}
                className="size-4 accent-[#A370EB]"
              />
              <span className="text-sm font-semibold text-[#EBE6E0]">{label}</span>
            </label>
          ))}
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
  );
}

/* ---------------- Panoul „formula în lucru” ---------------- */

const DAIKIN_KW = [...new Set(CATALOG.filter((m) => m.brand === "Daikin").map((m) => m.kW))];

function LivePanel() {
  const { form, mobile } = useAI();
  const zone = form.county ? COUNTY_ZONE[form.county] : null;
  const a = parseFloat(form.area);
  const areaOk = Number.isFinite(a) && a >= AREA_MIN && a <= AREA_MAX;
  const qb = form.insul ? qBase(thicknessOf(form)) : NaN;
  const input = formInput(form);
  const q = input ? calcQ(input) : NaN;
  const rec = useMemo(() => (Number.isFinite(q) ? recommend(prag(q), form.cooling) : null), [q, form.cooling]);
  const left = 7 - answered(form);

  const rows: { k: string; label: string; val: string | null; sub?: string }[] = [
    { k: "A", label: "Suprafață", val: areaOk ? `${a} m²` : null },
    {
      k: "q",
      label: "Pierderi de bază",
      val: Number.isFinite(qb) ? `${Math.round(qb)} W/m²` : null,
      sub: form.insul ? (form.insul === "none" ? "neizolat" : `${INSUL_OPTIONS.find((o) => o.id === form.insul)?.short}, ${form.thick} cm`) : undefined,
    },
    { k: "Fz", label: "Zonă climatică", val: zone ? fx(ZONE_FACTOR[zone]) : null, sub: zone ? `${zone} · ${te(ZONE_TE[zone])}` : undefined },
    {
      k: "Fn",
      label: "Regim de înălțime",
      val: form.levels ? fx(LEVEL_FACTOR[form.levels]) : null,
      sub: LEVEL_OPTIONS.find((l) => l.id === form.levels)?.short,
    },
    { k: "Ff", label: "Ferestre", val: form.win ? fx(WIN_FACTOR[form.win]) : null, sub: WIN_OPTIONS.find((w) => w.id === form.win)?.short },
    {
      k: "Fs",
      label: "Sistem",
      val: form.heat ? fx(SYSTEM_FACTOR[form.heat]) : null,
      sub: HEAT_OPTIONS.find((h) => h.id === form.heat)?.label,
    },
  ];

  const max = 18;
  return (
    <div className={`${CARD} p-6`} aria-live="polite">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-[#A370EB]">Formula de dimensionare</p>
      <p className="ai-h mt-1 text-lg font-bold text-[#EBE6E0]">Necesarul termic, pas cu pas</p>
      <p className="mt-3 rounded-lg bg-[#0E1115] px-3 py-2 font-[family-name:var(--font-plexmono)] text-[12px] text-[#9096A2]">
        Q = A × q × F<sub>z</sub> × F<sub>n</sub> × F<sub>f</sub> × F<sub>s</sub>
      </p>
      <ul className="mt-4 space-y-2.5">
        {rows.map((r) => (
          <li key={r.k} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              <span
                className={`flex size-4 shrink-0 items-center justify-center rounded-full ${
                  r.val ? "bg-[#A370EB] text-white" : "border border-[#272C35]"
                }`}
              >
                {r.val && <Check size={10} strokeWidth={3} />}
              </span>
              <span className="min-w-0">
                <span className={r.val ? "text-[#EBE6E0]" : "text-[#9096A2]"}>{r.label}</span>
                {r.sub && <span className="block truncate text-[11px] text-[#9096A2]">{r.sub}</span>}
              </span>
            </span>
            <span className={`shrink-0 font-[family-name:var(--font-plexmono)] text-[13px] ${r.val ? "text-[#EBE6E0]" : "text-[#9096A2]/50"}`}>
              {r.val ?? "—"}
            </span>
          </li>
        ))}
      </ul>
      <div className="my-4 h-px bg-[#272C35]" />
      <div className="flex items-end justify-between">
        <span className="text-sm text-[#9096A2]">Necesar termic</span>
        <span className={`ai-h font-black leading-none ${Number.isFinite(q) ? "text-[#A370EB]" : "text-[#9096A2]/40"} ${mobile ? "text-3xl" : "text-4xl"}`}>
          {Number.isFinite(q) ? kw(q) : "— kW"}
        </span>
      </div>
      <p className="mt-1 text-right text-[11px] text-[#9096A2]">
        {Number.isFinite(q)
          ? rec?.premium
            ? `Cel mai mic model Daikin suficient: ${rec.premium.kW} kW`
            : "Peste 16 kW: configurație personalizată"
          : `Mai ${left === 1 ? "e o întrebare" : `sunt ${left} întrebări`}`}
      </p>

      <div className="mt-5">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#9096A2]">Regula de aur: model ≥ necesar</p>
        <div className="relative h-9">
          <div className="absolute inset-x-0 top-4 h-1 rounded-full bg-[#272C35]" />
          {Number.isFinite(q) && (
            <div
              className="absolute top-4 h-1 rounded-full bg-[#A370EB]/60 transition-all duration-500"
              style={{ left: 0, width: `${(Math.min(q, max) / max) * 100}%` }}
            />
          )}
          {DAIKIN_KW.map((k) => {
            const pick = rec?.premium?.kW === k;
            return (
              <span
                key={k}
                className="absolute top-0 -translate-x-1/2 text-center"
                style={{ left: `${(k / max) * 100}%` }}
              >
                <span
                  className={`mx-auto mt-[13px] block size-2.5 rounded-full border-2 transition-all duration-300 ${
                    pick ? "scale-150 border-[#A370EB] bg-[#A370EB]" : "border-[#9096A2]/60 bg-[#15181E]"
                  }`}
                />
                <span className={`mt-0.5 block text-[10px] ${pick ? "font-bold text-[#A370EB]" : "text-[#9096A2]"}`}>{k}</span>
              </span>
            );
          })}
        </div>
        <p className="mt-2 text-[11px] leading-snug text-[#9096A2]">
          Puterile Daikin din catalog (kW). Rotunjim doar în sus: un model sub necesar nu apare niciodată.
        </p>
      </div>
    </div>
  );
}

/* ---------------- Animația de calcul ---------------- */

function Computing({
  q,
  county,
  area,
  qb,
  fl,
  fw,
  fs,
  cooling,
  onDone,
  top,
}: {
  q: number;
  county: string;
  area: number;
  qb: number;
  fl: number;
  fw: number;
  fs: number;
  cooling: boolean;
  onDone: () => void;
  /** Pe telefon cardul e înalt: textul stă sus, nu la mijloc. */
  top: boolean;
}) {
  const [n, setN] = useState(0);
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  }, [onDone]);
  useEffect(() => {
    const ts = [380, 760, 1140, 1520].map((t, i) => window.setTimeout(() => setN(i + 1), t));
    const end = window.setTimeout(() => done.current(), 2000);
    return () => {
      ts.forEach(clearTimeout);
      clearTimeout(end);
    };
  }, []);
  const zone = COUNTY_ZONE[county];
  const rec = recommend(prag(q), cooling);
  const lines = [
    `Zona climatică ${zone} (${county}) · ${te(ZONE_TE[zone])}`,
    `Pierderi prin anvelopă: ${Math.round(qb)} W/m² × ${area} m²`,
    `Corecții: niveluri ${fx(fl)} · ferestre ${fx(fw)} · sistem ${fx(fs)}`,
    rec.premium ? `Cel mai mic model ≥ ${kw(q)}: ${rec.premium.gama}, ${rec.premium.kW} kW` : `Necesar ${kw(q)}: peste gama standard`,
  ];
  return (
    <div
      className={`absolute inset-0 z-10 flex flex-col items-center rounded-2xl bg-[#15181E]/97 p-6 ${top ? "justify-start pt-16" : "justify-center"}`}
      role="status"
      aria-live="polite"
      style={{ animation: "aiFadeIn .2s ease-out both" }}
    >
      <LoaderCircle size={34} className="text-[#A370EB]" style={{ animation: "aiSpin 1s linear infinite" }} />
      <p className="ai-h mt-4 text-xl font-bold text-[#EBE6E0]">Calculăm necesarul termic…</p>
      <ul className="mt-5 w-full max-w-md space-y-2.5">
        {lines.map((l, i) => (
          <li
            key={l}
            className="flex items-start gap-2.5 text-sm transition-all duration-300"
            style={{ opacity: i < n ? 1 : 0.18, transform: i < n ? "none" : "translateY(4px)" }}
          >
            <span
              className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full ${
                i < n ? "bg-[#A370EB] text-white" : "border border-[#272C35]"
              }`}
            >
              {i < n && <Check size={10} strokeWidth={3} />}
            </span>
            <span className="text-[#EBE6E0]">{l}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
