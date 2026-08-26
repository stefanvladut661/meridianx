"use client";

import { useId, useMemo, useState } from "react";
import { Icon } from "./ui";

/* ============================================================
   CONFIGURATOR DE PROIECT — lead magnetul diviziei software.

   Rolul lui în funnel: omul care are finanțare și un termen nu vrea
   să scrie un email vag. Vrea să vadă că înțelegem despre ce e vorba.
   Configuratorul îi dă, în două minute, conturul propriului proiect
   — module, etape, interval de timp — și îl lasă exact la un pas de
   „programează consultanța".

   E și dovada de produs: dacă un formular de pe site se simte bine,
   e credibil că și aplicația pe care o construim se va simți bine.

   Nu afișează prețuri (regula clientului). Estimarea de timp e
   orientativă și e marcată ca atare, vizibil, în interfață.
   NU e conectat la /api/leads — în lab se oprește la starea de
   succes locală. Conectarea se face când alegem direcția finală.
   ============================================================ */

type Choice = { id: string; label: string; hint?: string };

const MODULES: Choice[] = [
  { id: "business", label: "Aplicație de business", hint: "flux intern, comenzi, stoc" },
  { id: "dash", label: "Dashboard custom", hint: "date din mai multe surse" },
  { id: "sales", label: "Mecanism de vânzare", hint: "ofertare, pipeline, relansări" },
  { id: "loyalty", label: "Fidelizare clienți", hint: "puncte, campanii, card digital" },
  { id: "mobile", label: "Aplicație mobilă", hint: "iOS și Android" },
  { id: "saas", label: "Produs SaaS", hint: "abonamente, multi-tenant" },
  { id: "web", label: "Site de conversie", hint: "aduce cereri, nu doar vizite" },
  { id: "audit", label: "Nu știu încă", hint: "vreau să pornim de la proces" },
];

const SCALE: Choice[] = [
  { id: "s", label: "Sub 10 oameni" },
  { id: "m", label: "10 – 50 de oameni" },
  { id: "l", label: "50 – 200 de oameni" },
  { id: "xl", label: "Peste 200" },
  { id: "pub", label: "Clienții mei o folosesc", hint: "public, nu doar intern" },
];

const INTEGRATIONS: Choice[] = [
  { id: "fact", label: "Facturare" },
  { id: "efact", label: "e-Factura" },
  { id: "plati", label: "Plăți online" },
  { id: "curier", label: "Curieri" },
  { id: "shop", label: "Magazin online" },
  { id: "erp", label: "ERP existent" },
  { id: "casa", label: "Casă de marcat" },
  { id: "none", label: "Nimic deocamdată" },
];

const DEADLINE: Choice[] = [
  { id: "urgent", label: "Am termen de finanțare", hint: "data e fixă" },
  { id: "fast", label: "Cât mai repede" },
  { id: "quarter", label: "În următorul trimestru" },
  { id: "open", label: "Nu presez, vreau să fie bine" },
];

const FUNDING: Choice[] = [
  { id: "yes", label: "Aprobată" },
  { id: "wip", label: "În curs" },
  { id: "no", label: "Fonduri proprii" },
];

const STEPS = [
  { key: "module", title: "Ce construim?", note: "Poți alege mai multe." },
  { key: "scale", title: "Cine o folosește?", note: "Alege varianta cea mai apropiată." },
  { key: "integr", title: "Cu ce trebuie să vorbească?", note: "Poți alege mai multe." },
  { key: "when", title: "Când trebuie să fie live?", note: "Și de unde vin banii." },
  { key: "contact", title: "Unde îți trimitem fișa?", note: "Te sunăm doar ca să stabilim ora." },
] as const;

type State = {
  module: string[];
  scale: string;
  integr: string[];
  when: string;
  funding: string;
  nume: string;
  firma: string;
  email: string;
  telefon: string;
};

const EMPTY: State = {
  module: [],
  scale: "",
  integr: [],
  when: "",
  funding: "",
  nume: "",
  firma: "",
  email: "",
  telefon: "",
};

/* Estimarea de timp — orientativă, marcată ca atare în interfață.
   Nu e o promisiune contractuală, e ordinul de mărime pe care oricum
   îl spunem la telefon în primele două minute. */
function estimate(s: State) {
  const mods = s.module.filter((m) => m !== "audit");
  const ints = s.integr.filter((i) => i !== "none");
  const scaleWeeks: Record<string, number> = { s: 0, m: 1, l: 2, xl: 3, pub: 3 };

  let weeks = 4;
  weeks += Math.max(0, mods.length - 1) * 1.5;
  weeks += scaleWeeks[s.scale] ?? 0;
  weeks += ints.length * 0.8;
  if (s.module.includes("saas")) weeks += 2;
  if (s.module.includes("mobile")) weeks += 1.5;

  const low = Math.max(4, Math.round(weeks));
  const high = Math.max(low + 2, Math.round(weeks * 1.4));
  return { low, high, mods, ints };
}

function phases(s: State) {
  const { mods, ints } = estimate(s);
  const labelOf = (id: string) =>
    MODULES.find((m) => m.id === id)?.label ?? id;

  const out: { n: string; t: string }[] = [
    { n: "00", t: "Fișa de proiect și scopul, în scris" },
  ];
  if (mods.length === 0) {
    out.push({ n: "01", t: "Audit de proces și direcție tehnică" });
  } else {
    out.push({ n: "01", t: `Prima versiune utilizabilă — ${labelOf(mods[0])}` });
    if (mods.length > 1) {
      out.push({
        n: "02",
        t: `Extindere — ${mods.slice(1).map(labelOf).join(", ")}`,
      });
    }
  }
  if (ints.length > 0) {
    out.push({
      n: String(out.length).padStart(2, "0"),
      t: `Integrări — ${ints
        .map((i) => INTEGRATIONS.find((x) => x.id === i)?.label ?? i)
        .join(", ")}`,
    });
  }
  out.push({
    n: String(out.length).padStart(2, "0"),
    t: "Instruire, documentație, predare cod și conturi",
  });
  return out;
}

export function Configurator() {
  const [step, setStep] = useState(0);
  const [s, setS] = useState<State>(EMPTY);
  const [sent, setSent] = useState(false);
  const uid = useId();

  const est = useMemo(() => estimate(s), [s]);
  const plan = useMemo(() => phases(s), [s]);

  const toggle = (key: "module" | "integr", id: string) =>
    setS((p) => {
      // „Nu știu încă" și „Nimic deocamdată" sunt exclusive:
      // n-are sens să ceri integrări și în același timp să spui că n-ai.
      const exclusive = key === "module" ? "audit" : "none";
      if (id === exclusive) return { ...p, [key]: p[key].includes(id) ? [] : [id] };
      const next = p[key].filter((x) => x !== exclusive);
      return {
        ...p,
        [key]: next.includes(id) ? next.filter((x) => x !== id) : [...next, id],
      };
    });

  const canAdvance =
    (step === 0 && s.module.length > 0) ||
    (step === 1 && s.scale !== "") ||
    (step === 2 && s.integr.length > 0) ||
    (step === 3 && s.when !== "" && s.funding !== "") ||
    step === 4;

  const progress = ((step + (sent ? 1 : 0)) / STEPS.length) * 100;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_minmax(0,400px)]">
      {/* ---------- panoul de întrebări ---------- */}
      <div className="glass-2 edge-light relative overflow-hidden p-6 sm:p-8">
        <div className="mb-7">
          <div className="flex items-center justify-between gap-4">
            <p className="font-md-mono text-[11.5px] uppercase tracking-[0.18em] text-dim">
              Pasul {Math.min(step + 1, STEPS.length)} din {STEPS.length}
            </p>
            <p className="text-[12.5px] text-dim">≈ 2 minute</p>
          </div>
          <div
            className="mt-3 h-[3px] w-full overflow-hidden rounded-full bg-glass"
            role="progressbar"
            aria-valuenow={Math.round(progress)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Progresul configuratorului"
          >
            <span
              className="step-bar block h-full rounded-full bg-a1"
              style={{ width: `${Math.max(6, progress)}%` }}
            />
          </div>
        </div>

        {sent ? (
          <Success s={s} est={est} />
        ) : (
          <>
            <h3 className="display text-[clamp(1.4rem,3.2vw,1.9rem)]">
              {STEPS[step].title}
            </h3>
            <p className="mt-2 text-[14.5px] text-dim">{STEPS[step].note}</p>

            <div className="mt-7">
              {step === 0 && (
                <ChipGroup
                  legend="Ce construim"
                  name={`${uid}-mod`}
                  type="checkbox"
                  options={MODULES}
                  selected={s.module}
                  onToggle={(id) => toggle("module", id)}
                />
              )}
              {step === 1 && (
                <ChipGroup
                  legend="Câți oameni o folosesc"
                  name={`${uid}-scale`}
                  type="radio"
                  options={SCALE}
                  selected={s.scale ? [s.scale] : []}
                  onToggle={(id) => setS((p) => ({ ...p, scale: id }))}
                />
              )}
              {step === 2 && (
                <ChipGroup
                  legend="Sisteme cu care se integrează"
                  name={`${uid}-int`}
                  type="checkbox"
                  options={INTEGRATIONS}
                  selected={s.integr}
                  onToggle={(id) => toggle("integr", id)}
                />
              )}
              {step === 3 && (
                <div className="grid gap-7">
                  <ChipGroup
                    legend="Termenul"
                    name={`${uid}-when`}
                    type="radio"
                    options={DEADLINE}
                    selected={s.when ? [s.when] : []}
                    onToggle={(id) => setS((p) => ({ ...p, when: id }))}
                  />
                  <ChipGroup
                    legend="Finanțarea"
                    name={`${uid}-fund`}
                    type="radio"
                    options={FUNDING}
                    selected={s.funding ? [s.funding] : []}
                    onToggle={(id) => setS((p) => ({ ...p, funding: id }))}
                  />
                </div>
              )}
              {step === 4 && (
                <ContactStep
                  uid={uid}
                  s={s}
                  onChange={(k, v) => setS((p) => ({ ...p, [k]: v }))}
                  onSubmit={() => setSent(true)}
                />
              )}
            </div>

            {step < 4 && (
              <div className="mt-9 flex items-center gap-3">
                {step > 0 && (
                  <button
                    type="button"
                    onClick={() => setStep((v) => v - 1)}
                    className="btn btn-ghost !min-h-11 !px-5 !py-2.5 !text-[14px]"
                  >
                    Înapoi
                  </button>
                )}
                <button
                  type="button"
                  disabled={!canAdvance}
                  onClick={() => setStep((v) => v + 1)}
                  className="btn btn-primary !min-h-11 !px-6 !py-2.5 !text-[14px] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Continuă
                  <Icon name="arrowRight" size={16} className="arw" />
                </button>
                {!canAdvance && (
                  <span className="text-[13px] text-dim">
                    Alege cel puțin o opțiune.
                  </span>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* ---------- fișa care se completează în timp real ---------- */}
      <aside className="glass relative overflow-hidden p-6 sm:p-7 lg:sticky lg:top-24 lg:self-start">
        <p className="eyebrow mb-5 flex items-center gap-2">
          <span className="node-dot" aria-hidden />
          Fișa ta de proiect
        </p>

        {s.module.length === 0 ? (
          <p className="text-[14.5px] leading-relaxed text-dim">
            Se completează pe măsură ce răspunzi. La final o primești pe email,
            în scris, și o poți folosi ca să compari orice altă ofertă.
          </p>
        ) : (
          <div className="grid gap-6">
            <div>
              <p className="text-[12.5px] uppercase tracking-wider text-dim">
                Scop
              </p>
              <ul className="mt-2.5 flex flex-wrap gap-1.5">
                {s.module.map((id) => (
                  <li
                    key={id}
                    className="rounded-full border border-hair px-2.5 py-1 text-[12.5px] text-bone"
                  >
                    {MODULES.find((m) => m.id === id)?.label}
                  </li>
                ))}
              </ul>
            </div>

            {s.scale && (
              <div>
                <p className="text-[12.5px] uppercase tracking-wider text-dim">
                  Scară
                </p>
                <p className="mt-1.5 text-[14.5px] text-bone">
                  {SCALE.find((x) => x.id === s.scale)?.label}
                </p>
              </div>
            )}

            <div>
              <p className="text-[12.5px] uppercase tracking-wider text-dim">
                Etape propuse
              </p>
              <ol className="mt-3 grid gap-2.5">
                {plan.map((p) => (
                  <li key={p.n} className="flex gap-3">
                    <span className="font-md-mono text-[11.5px] leading-5 text-a2">
                      {p.n}
                    </span>
                    <span className="text-[13.5px] leading-5 text-dim">
                      {p.t}
                    </span>
                  </li>
                ))}
              </ol>
            </div>

            {s.scale && (
              <div className="border-t border-hair pt-5">
                <p className="text-[12.5px] uppercase tracking-wider text-dim">
                  Interval orientativ
                </p>
                <p className="display mt-1.5 text-[1.9rem] text-bone">
                  {est.low}–{est.high}{" "}
                  <span className="text-[1rem] font-normal text-dim">
                    săptămâni
                  </span>
                </p>
                <p className="mt-2 text-[12.5px] leading-relaxed text-dim">
                  Ordin de mărime, nu angajament. Se confirmă la consultanță,
                  după ce vedem procesul real.
                </p>
              </div>
            )}

            <p className="rounded-panel-sm border border-hair bg-glass px-3.5 py-3 text-[12.5px] leading-relaxed text-dim">
              Costul nu apare aici intenționat. Îl primești în ofertă fermă, pe
              etape, după consultanță — ca să știi exact ce cumperi.
            </p>
          </div>
        )}
      </aside>
    </div>
  );
}

/* ---------- grup de opțiuni ---------- */
function ChipGroup({
  legend,
  name,
  type,
  options,
  selected,
  onToggle,
}: {
  legend: string;
  name: string;
  type: "checkbox" | "radio";
  options: Choice[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <fieldset>
      <legend className="sr-only">{legend}</legend>
      <ul className="grid gap-2 sm:grid-cols-2">
        {options.map((o) => {
          const on = selected.includes(o.id);
          return (
            <li key={o.id}>
              <label
                className={`flex cursor-pointer items-start gap-3 rounded-panel border px-4 py-3.5 transition-colors duration-200 ${
                  on
                    ? "border-a1 bg-glass"
                    : "border-hair hover:border-hair-strong"
                }`}
              >
                <input
                  type={type}
                  name={name}
                  value={o.id}
                  checked={on}
                  onChange={() => onToggle(o.id)}
                  className="sr-only"
                />
                <span
                  aria-hidden
                  className={`mt-0.5 flex size-[18px] shrink-0 items-center justify-center border transition-colors duration-200 ${
                    type === "radio" ? "rounded-full" : "rounded-[5px]"
                  } ${on ? "border-a1 bg-a1 text-on-a1" : "border-hair-strong"}`}
                >
                  {on && <Icon name="check" size={12} />}
                </span>
                <span className="min-w-0">
                  <span className="block text-[14.5px] text-bone">
                    {o.label}
                  </span>
                  {o.hint && (
                    <span className="mt-0.5 block text-[12.5px] text-dim">
                      {o.hint}
                    </span>
                  )}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}

/* ---------- pasul de contact ---------- */
function ContactStep({
  uid,
  s,
  onChange,
  onSubmit,
}: {
  uid: string;
  s: State;
  onChange: (k: keyof State, v: string) => void;
  onSubmit: () => void;
}) {
  const fields: {
    k: keyof State;
    label: string;
    type: string;
    auto: string;
    req?: boolean;
  }[] = [
    { k: "nume", label: "Nume", type: "text", auto: "name", req: true },
    { k: "firma", label: "Firma", type: "text", auto: "organization", req: true },
    { k: "email", label: "Email", type: "email", auto: "email", req: true },
    { k: "telefon", label: "Telefon", type: "tel", auto: "tel" },
  ];

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="grid gap-4"
      noValidate={false}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map((f) => (
          <p key={f.k} className="grid gap-1.5">
            <label
              htmlFor={`${uid}-${f.k}`}
              className="text-[13px] text-dim"
            >
              {f.label}
              {f.req && <span className="text-a2"> *</span>}
            </label>
            <input
              id={`${uid}-${f.k}`}
              type={f.type}
              autoComplete={f.auto}
              required={f.req}
              value={s[f.k]}
              onChange={(e) => onChange(f.k, e.target.value)}
              className="rounded-panel border border-hair bg-glass px-3.5 py-3 text-[15px] text-bone outline-none transition-colors duration-200 placeholder:text-dim focus:border-a1"
            />
          </p>
        ))}
      </div>

      <p className="text-[12.5px] leading-relaxed text-dim">
        Te sunăm o singură dată, ca să stabilim ora consultanței. Fișa de
        proiect o primești pe email indiferent dacă mergem mai departe împreună
        sau nu.
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-3">
        <button type="submit" className="btn btn-primary !min-h-11 !px-6 !py-2.5 !text-[14px]">
          <Icon name="calendar" size={16} />
          Programează consultanța
        </button>
        <span className="text-[12.5px] text-dim">
          Fără obligații. Fără prezentare de agenție.
        </span>
      </div>
    </form>
  );
}

/* ---------- confirmare ---------- */
function Success({
  s,
  est,
}: {
  s: State;
  est: ReturnType<typeof estimate>;
}) {
  return (
    <div role="status" aria-live="polite">
      <span className="mb-6 flex size-12 items-center justify-center rounded-full border border-a1 text-a1">
        <Icon name="check" size={22} />
      </span>
      <h3 className="display text-[clamp(1.5rem,3.4vw,2rem)]">
        Consultanță cerută.
      </h3>
      <p className="mt-4 max-w-md text-[15px] leading-relaxed text-dim">
        Te sunăm în următoarea zi lucrătoare la numărul lăsat, ca să stabilim
        ora. Până atunci îți pregătim fișa pentru un proiect de{" "}
        <span className="text-bone">
          {est.low}–{est.high} săptămâni
        </span>
        {s.firma ? (
          <>
            {" "}
            pentru <span className="text-bone">{s.firma}</span>.
          </>
        ) : (
          "."
        )}
      </p>
      <p className="mt-6 rounded-panel-sm border border-hair bg-glass px-3.5 py-3 text-[12.5px] leading-relaxed text-dim">
        Demonstrație de lab: formularul nu trimite încă nimic. Se conectează la{" "}
        <code className="font-md-mono text-bone">/api/leads</code> când alegem
        direcția finală.
      </p>
    </div>
  );
}
