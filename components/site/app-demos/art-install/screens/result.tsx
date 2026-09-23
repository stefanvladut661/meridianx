"use client";

import { useMemo, useState } from "react";
import {
  ArrowRight,
  CircleCheck,
  Info,
  MessageCircle,
  Phone,
  RotateCcw,
  SolarPanel,
  Star,
} from "lucide-react";
import { lei, num, useCountUp } from "../../kit";
import {
  COUNTY_ZONE,
  HEAT_OPTIONS,
  INSUL_OPTIONS,
  LEVEL_OPTIONS,
  PRICE_RANGE,
  SCOP,
  WIN_OPTIONS,
  ZONE_TE,
  calcQ,
  estimate,
  goldenRuleOk,
  prag,
  productImg,
  recommend,
  type CalcForm,
  type CalcInput,
  type Model,
} from "../data";
import { BTN_OUTLINE_WHITE, BTN_WIZARD, CARD, FOCUS, MSG, Reveal, Sprite, anim, useAI } from "../ui";
import { kw, te } from "./calculator";

/* ============================================================
   Rezultatul — secțiunea #results din CalculatorPage.tsx:
   necesarul mare, cardul Daikin „Recomandat” și alternativa.
   Adăugat în demo: buget orientativ și costul anual estimat.
   ============================================================ */

const HEAT_LABEL = (id: string) => HEAT_OPTIONS.find((h) => h.id === id)?.label ?? "-";

export function Result({
  input,
  form,
  isExample,
}: {
  input: CalcInput;
  form: CalcForm;
  isExample: boolean;
}) {
  const { mobile, nav, notify, reduced } = useAI();
  const q = calcQ(input);
  const threshold = prag(q);
  const { premium, alternative } = useMemo(() => recommend(threshold, form.cooling), [threshold, form.cooling]);
  /* Garda de la randare: un card subdimensionat nu apare niciodată. */
  const cards = [premium, alternative].filter((m): m is Model => !!m && goldenRuleOk(m, threshold));
  const needsConsult = cards.length === 0;
  const coolingNote = form.cooling && input.system === "pardoseala";
  const shown = useCountUp(q, 1100, !reduced);
  const zone = COUNTY_ZONE[input.county];

  const destinatie =
    [form.heating && "Încălzire", form.cooling && "Răcire", form.acm && "Apă caldă menajeră (ACM)"].filter(Boolean).join(", ") || "-";

  const quote = (m?: Model) => {
    const message = [
      "Bună ziua! Cerere din calculatorul de dimensionare.",
      m ? `Model: ${m.brand} ${m.gama} — ${m.model} (${m.kW} kW)` : null,
      `Necesar termic calculat: ${kw(q)}`,
      `Suprafață: ${input.areaM2} mp`,
      `Județ: ${input.county}`,
      `Sistem de încălzire: ${HEAT_LABEL(input.system)}`,
      `Destinație: ${destinatie}`,
    ]
      .filter(Boolean)
      .join("\n");
    nav.contact({
      service: "Pompe de căldură",
      message,
      context: m ? `${m.brand} ${m.gama} · ${m.kW} kW` : `Necesar ${kw(q)} · configurație personalizată`,
    });
  };

  const chips = [
    `${input.county} · zona ${zone} · ${te(ZONE_TE[zone])}`,
    `${input.areaM2} m²`,
    LEVEL_OPTIONS.find((l) => l.id === input.levels)?.short,
    form.insul === "none" ? "Neizolat" : `${INSUL_OPTIONS.find((o) => o.id === form.insul)?.short} ${input.insulationCm} cm`,
    WIN_OPTIONS.find((w) => w.id === input.windows)?.short,
    HEAT_LABEL(input.system),
    destinatie,
  ].filter(Boolean) as string[];

  return (
    <>
      <section className="bg-[#0A0C0F]" style={{ paddingTop: mobile ? 96 : 112, paddingBottom: mobile ? 28 : 36 }}>
        <div className={mobile ? "px-4" : "mx-auto max-w-[1152px]"}>
          {isExample && (
            <div
              className={`mb-5 flex gap-x-3 gap-y-1.5 rounded-xl border border-[#A370EB]/30 bg-[#A370EB]/10 px-4 py-2.5 text-sm text-[#EBE6E0] ${
                mobile ? "flex-col items-start" : "items-center"
              }`}
            >
              <span className="flex min-w-0 flex-1 items-start gap-2">
                <Info size={15} className="mt-0.5 shrink-0 text-[#A370EB]" />
                Exemplu calculat: casă P+1 de 100 m² în Argeș, izolată cu 10 cm.
              </span>
              <button
                type="button"
                onClick={() => nav.go("calculator")}
                className={`inline-flex shrink-0 items-center gap-1 rounded font-semibold text-[#A370EB] ${FOCUS} ${mobile ? "ml-6" : ""}`}
              >
                Calculează pentru casa ta <ArrowRight size={14} />
              </button>
            </div>
          )}
          <div className={mobile ? "" : "flex items-end justify-between gap-10"}>
            <div className="min-w-0">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#A370EB]/30 bg-[#A370EB]/10 px-4 py-2">
                <CircleCheck className="text-[#A370EB]" size={16} />
                <span className="text-xs font-semibold uppercase tracking-wider text-[#A370EB]">Recomandări personalizate</span>
              </div>
              <h1 className={`ai-h font-black text-[#F6F3EE] ${mobile ? "text-[24px] leading-tight" : "text-[36px] leading-tight"}`}>
                Necesarul termic calculat pentru casa dvs:
              </h1>
              {mobile && (
                <p className="ai-h mt-2 text-[60px] font-black leading-none text-[#A370EB]" aria-label={kw(q)}>
                  {kw(shown)}
                </p>
              )}
              <ul className="mt-4 flex flex-wrap gap-1.5" aria-label="Datele casei">
                {chips.map((c) => (
                  <li key={c} className="rounded-md bg-[#F6F3EE]/[0.07] px-2.5 py-1 text-xs font-medium text-[#F6F3EE]/80">
                    {c}
                  </li>
                ))}
                <li>
                  <button
                    type="button"
                    onClick={() => nav.go("calculator")}
                    className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-[#A370EB] hover:bg-[#A370EB]/10 ${FOCUS}`}
                  >
                    <RotateCcw size={12} /> Modifică datele
                  </button>
                </li>
              </ul>
            </div>
            {!mobile && (
              <p className="ai-h shrink-0 text-[96px] font-black leading-[0.9] text-[#A370EB]" aria-label={kw(q)}>
                {kw(shown)}
              </p>
            )}
          </div>
        </div>
      </section>

      <section className={mobile ? "px-4 pb-16 pt-8" : "px-16 pb-20 pt-10"}>
        <div className={mobile ? "space-y-6" : "mx-auto grid max-w-[1152px] grid-cols-[1fr_1fr_372px] items-start gap-6"}>
          {needsConsult ? (
            <div className={`${CARD} p-8 text-center ${mobile ? "" : "col-span-2"}`}>
              <h3 className="ai-h mb-2 text-xl font-bold text-[#EBE6E0]">Soluție personalizată</h3>
              <p className="mx-auto mb-5 max-w-md text-sm text-[#9096A2]">
                Necesar estimat: {kw(q)}. Pentru această putere recomandăm o configurație personalizată (ex. montaj în cascadă).
              </p>
              <button type="button" onClick={() => quote()} className={`${BTN_WIZARD} px-6 py-3`}>
                <MessageCircle size={16} /> Solicită ofertă personalizată
              </button>
            </div>
          ) : (
            cards.map((m, i) => (
              <Reveal key={m.model} delay={i * 0.1}>
                <ModelCard m={m} q={q} onQuote={() => quote(m)} />
              </Reveal>
            ))
          )}
          {!needsConsult && cards.length === 1 && !mobile && <div />}

          <Reveal delay={0.15}>
            <CostPanel input={input} q={q} />
          </Reveal>
        </div>

        <div className={mobile ? "mt-8" : "mx-auto mt-8 max-w-[1152px]"}>
          {(coolingNote || form.acm) && (
            <div className="mb-5 space-y-2">
              {coolingNote && (
                <p className="flex items-start gap-1.5 text-xs text-[#9096A2]">
                  <Info size={13} className="mt-0.5 shrink-0" />
                  Pentru răcire eficientă recomandăm ventiloconvectoare; pardoseala oferă doar răcire limitată.
                </p>
              )}
              {form.acm && (
                <p className="flex items-start gap-1.5 text-xs text-[#9096A2]">
                  <Info size={13} className="mt-0.5 shrink-0" />
                  Pentru ACM este nevoie de boiler cu serpentină (sau rezervor integrat) — echipa noastră îl dimensionează în ofertă.
                </p>
              )}
            </div>
          )}
          <p className="mx-auto max-w-2xl text-center text-xs text-[#9096A2]">
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
        </div>
      </section>
    </>
  );
}

/* ---------------- Cardul de model ---------------- */

function ModelCard({ m, q, onQuote }: { m: Model; q: number; onQuote: () => void }) {
  const best = m.tier === "premium";
  const price = PRICE_RANGE[m.model];
  const reserve = Math.round(((m.kW - q) / q) * 100);
  return (
    <article
      className={`relative flex h-full flex-col overflow-hidden rounded-2xl bg-[#15181E] ${
        best ? "border-2 border-[#A370EB] shadow-xl shadow-[#A370EB]/20" : "border border-[#272C35]"
      }`}
    >
      {best && (
        <div className="absolute right-3 top-3 z-10 inline-flex items-center gap-1 rounded-full bg-[#A370EB] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
          <Star size={11} className="fill-current" /> Recomandat
        </div>
      )}
      <div className={`border-b p-4 ${best ? "border-[#A370EB]/30 bg-[#A370EB]/10" : "border-[#272C35] bg-[#1E2229]"}`}>
        <p className={`text-xs font-semibold uppercase tracking-wider ${best ? "text-[#A370EB]" : "text-[#9096A2]"}`}>
          {best ? m.brand : `Alternativă accesibilă · ${m.brand}`}
        </p>
        <h3 className="ai-h mt-1 text-lg font-bold leading-snug text-[#EBE6E0]">{m.gama}</h3>
        <p className="text-sm text-[#9096A2]">
          Pompă de căldură{m.tip !== m.gama ? ` · ${m.tip}` : ""}
        </p>
      </div>
      <div className="flex aspect-video justify-center bg-white">
        <Sprite sheet="prod" i={productImg(m.productId)} box={4 / 3} alt={`${m.brand} ${m.gama}`} className="h-full" />
      </div>
      <div className="flex flex-1 flex-col p-5">
        <p className="text-xs text-[#9096A2]">Model recomandat</p>
        <p className="ai-h mt-1 text-base font-bold text-[#EBE6E0]">{m.model}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="rounded-md bg-[#1E2229] px-2 py-1 text-xs font-semibold text-[#EBE6E0]">{m.kW} kW</span>
          <span className="rounded-md bg-[#1E2229] px-2 py-1 text-xs font-semibold text-[#EBE6E0]">{m.agent}</span>
          <span className="rounded-md bg-[#1E2229] px-2 py-1 text-xs font-semibold text-[#EBE6E0]">{m.tip}</span>
        </div>

        <div className="mt-4">
          <div className="flex justify-between text-[11px] text-[#9096A2]">
            <span>Necesar {kw(q)}</span>
            <span className={best ? "font-semibold text-[#A370EB]" : "font-semibold text-[#EBE6E0]"}>
              {m.kW} kW · +{reserve}% rezervă
            </span>
          </div>
          <div
            className={`relative mt-1.5 h-2 overflow-hidden rounded-full ${best ? "bg-[#A370EB]/25" : "bg-[#F97316]/25"}`}
            role="img"
            aria-label={`Necesarul de ${kw(q)} ocupă ${Math.round((q / m.kW) * 100)}% din puterea modelului`}
          >
            <div
              className={`absolute inset-y-0 left-0 rounded-full ${best ? "bg-[#A370EB]" : "bg-[#F97316]"}`}
              style={{ width: `${(q / m.kW) * 100}%` }}
            />
          </div>
        </div>

        <p className="mt-4 flex-1 text-sm text-[#9096A2]">{m.descriere}</p>

        {price && (
          <div className="mt-4 rounded-lg border border-[#272C35] bg-[#0E1115] px-3 py-2.5">
            <p className="text-[11px] text-[#9096A2]">Buget orientativ</p>
            <p className="ai-h text-base font-bold text-[#EBE6E0]">
              {num(price[0])} – {num(price[1])} lei
            </p>
            <p className="text-[11px] text-[#9096A2]">echipament + montaj standard, TVA inclus</p>
          </div>
        )}

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

/* ---------------- Costul anual estimat ---------------- */

function CostPanel({ input, q }: { input: CalcInput; q: number }) {
  const { reduced } = useAI();
  const [pv, setPv] = useState(false);
  const e = estimate(input, q, pv);
  const max = Math.max(...e.rows.map((r) => r.lei));
  const pump = e.rows[0].lei;
  /* Spunem cinstit ce iese mai ieftin decât pompa la tarifele alese. */
  const below = e.rows.filter((r) => !r.pump && r.lei < pump).map((r) => r.label.toLowerCase());
  const verdict = !below.length
    ? "Cu acest necesar, pompa e cea mai ieftină sursă de căldură din listă."
    : `${below.join(below.length > 1 ? " și " : "").replace(/^./, (c) => c.toUpperCase())} ${
        below.length > 1 ? "ies" : "iese"
      } mai ieftin la aceste tarife${pv ? "." : "; cu panouri fotovoltaice, calculul se schimbă."}`;
  const flow = HEAT_OPTIONS.find((h) => h.id === input.system)?.line.replace("Agent termic ", "") ?? "";
  return (
    <div className={`${CARD} p-6`}>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-[#A370EB]">Estimare de consum</p>
      <h3 className="ai-h mt-1 text-lg font-bold text-[#EBE6E0]">Cât costă încălzirea pe an</h3>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-[#0E1115] p-3">
          <p className="text-[11px] text-[#9096A2]">Curent consumat</p>
          <p className="ai-h text-lg font-bold text-[#EBE6E0]">{num(e.elKwh)} kWh</p>
        </div>
        <div className="rounded-lg bg-[#0E1115] p-3">
          <p className="text-[11px] text-[#9096A2]">SCOP estimat ({flow})</p>
          <p className="ai-h text-lg font-bold text-[#EBE6E0]">{SCOP[input.system].toLocaleString("ro-RO")}</p>
        </div>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={pv}
        onClick={() => setPv((v) => !v)}
        className={`mt-4 flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors ${FOCUS} ${
          pv ? "border-[#A370EB]/60 bg-[#A370EB]/10" : "border-[#272C35] hover:border-[#A370EB]/40"
        }`}
      >
        <SolarPanel size={18} className={pv ? "text-[#A370EB]" : "text-[#9096A2]"} />
        <span className="min-w-0 flex-1 text-sm text-[#EBE6E0]">Am panouri fotovoltaice</span>
        <span className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${pv ? "bg-[#A370EB]" : "bg-[#272C35]"}`}>
          <span
            className="absolute top-0.5 size-4 rounded-full bg-white transition-all duration-200"
            style={{ left: pv ? 18 : 2 }}
          />
        </span>
      </button>

      <ul className="mt-5 space-y-3" aria-label="Cost anual estimat, pe sursă de căldură">
        {e.rows.map((r) => (
          <li key={r.id}>
            <div className="flex items-baseline justify-between text-sm">
              <span className={r.pump ? "font-semibold text-[#EBE6E0]" : "text-[#9096A2]"}>{r.label}</span>
              <span className={r.pump ? "ai-h font-bold text-[#A370EB]" : "text-[#EBE6E0]"}>{lei(r.lei)}</span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-[#0E1115]">
              <div
                className={`h-full rounded-full ${r.pump ? "bg-[#A370EB]" : "bg-[#9096A2]/45"}`}
                style={{
                  width: `${Math.max(2, (r.lei / max) * 100)}%`,
                  transformOrigin: "left",
                  transition: reduced ? undefined : "width .5s ease-out",
                  ...anim(reduced, "aiGrow .9s ease-out both"),
                }}
              />
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-xs leading-relaxed text-[#9096A2]">
        {verdict} Calcul pentru {num(e.heatKwh)} kWh căldură pe an, la {pv ? "0,70 lei/kWh (cu autoconsum din fotovoltaice)" : "1,35 lei/kWh curent"} și 0,33 lei/kWh gaz. Apa caldă nu e inclusă.
      </p>
    </div>
  );
}
