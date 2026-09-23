"use client";

import {
  ArrowRight,
  Award,
  BadgeCheck,
  Check,
  ChevronDown,
  ClipboardCheck,
  Phone,
  Shield,
  ShieldCheck,
  Sparkles,
  Wrench,
  Zap,
} from "lucide-react";
import type { ReactNode } from "react";
import { DEMO_PHONE, type PfCategory } from "../data";
import {
  BTN_OUTLINE_WHITE,
  BTN_PRIMARY,
  BTN_WIZARD,
  CARD,
  CARD_HOVER,
  FOCUS,
  IMG,
  MSG,
  Reveal,
  Sprite,
  anim,
  useAI,
  type SheetId,
} from "../ui";

/* ============================================================
   Prima pagină — Index.tsx de pe site, cu aceeași ordine:
   hero, încredere, servicii, lucrări, banda portocalie.
   ============================================================ */

export function Section({
  children,
  bg,
  className = "",
  border = false,
}: {
  children: ReactNode;
  bg?: string;
  className?: string;
  border?: boolean;
}) {
  const { mobile } = useAI();
  return (
    <section
      className={`${mobile ? "px-4 py-16" : "px-16 py-24"} ${border ? "border-y border-[#272C35]" : ""} ${className}`}
      style={bg ? { background: bg } : undefined}
    >
      <div className={mobile ? "" : "mx-auto max-w-[1152px]"}>{children}</div>
    </section>
  );
}

export function SectionTitle({ children, sub, center = true }: { children: ReactNode; sub?: string; center?: boolean }) {
  const { mobile } = useAI();
  return (
    <div className={center ? "text-center" : ""}>
      <h2 className={`ai-h font-bold text-[#EBE6E0] ${mobile ? "text-[30px] leading-tight" : "text-[48px] leading-[1.1]"}`}>
        {children}
      </h2>
      {sub && (
        <p className={`mt-4 max-w-2xl text-lg text-[#9096A2] ${center ? "mx-auto" : ""}`}>{sub}</p>
      )}
    </div>
  );
}

function fade(reduced: boolean, delay: number) {
  return anim(reduced, `aiFadeUp .7s ease-out ${delay}s both`);
}

export function Home() {
  const { mobile } = useAI();
  return (
    <>
      <Hero />
      {mobile && (
        <section className="px-4 pb-4 pt-12">
          <CalcTeaser />
        </section>
      )}
      <Trust />
      <Services />
      <Works />
      <CtaBanner />
    </>
  );
}

/* ---------------- Hero ---------------- */

function Hero() {
  const { mobile, nav, notify, reduced } = useAI();
  return (
    <section className="relative flex items-center" style={{ minHeight: mobile ? 760 : 800 }}>
      <div className="absolute inset-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`${IMG}/hero.webp`}
          alt="Tehnician care verifică unitatea exterioară a unei pompe de căldură"
          className="h-full w-full object-cover"
          style={mobile ? { objectPosition: "62% center" } : undefined}
        />
        <div className="absolute inset-0 bg-[#0A0C0F]" style={{ opacity: 0.75 }} />
      </div>

      <div
        className={`relative w-full ${
          mobile ? "px-4 pb-20 pt-28" : "mx-auto flex max-w-[1216px] items-center justify-between gap-12 pb-16 pt-28"
        }`}
      >
        <div className={mobile ? "" : "max-w-[780px]"}>
          <p
            className={`mb-6 font-semibold uppercase text-[#F97316] ${mobile ? "text-xs tracking-[3px]" : "text-sm tracking-[3px]"}`}
            style={fade(reduced, 0.2)}
          >
            ✦ Instalatori autorizați HVAC
          </p>
          <h1
            className={`ai-h mb-6 font-black leading-[1.1] text-[#F6F3EE] ${mobile ? "text-[36px]" : "text-[50px]"}`}
            style={fade(reduced, 0.4)}
          >
            Confort termic tot anul —{mobile ? " " : <br />}de la consultanță la service
          </h1>
          <p
            className={`mb-6 max-w-2xl font-light text-[#F6F3EE]/80 ${mobile ? "text-[17px]" : "text-xl"}`}
            style={fade(reduced, 0.6)}
          >
            Pompe de căldură, aer condiționat, centrale termice și panouri solare. Montaj profesional, garanție extinsă, suport real.
          </p>
          <div className="mb-8 flex items-center gap-2" style={fade(reduced, 0.7)}>
            <span className="inline-flex items-center gap-2 rounded-full border border-[#F6F3EE]/20 bg-[#F6F3EE]/10 px-4 py-2 text-sm text-[#F6F3EE]">
              <ShieldCheck size={16} className="text-[#F97316]" />
              Partener autorizat Daikin · ANRE + ISCIR
            </span>
          </div>
          <div className={`flex gap-4 ${mobile ? "flex-col" : "flex-wrap"}`} style={fade(reduced, 0.8)}>
            <button type="button" onClick={() => nav.contact()} className={`${BTN_PRIMARY} px-8 py-3.5`}>
              Solicită ofertă gratuită
            </button>
            <button type="button" onClick={() => notify(MSG.call)} className={`${BTN_OUTLINE_WHITE} px-8 py-3.5`}>
              <Phone size={18} /> Sună acum: {DEMO_PHONE}
            </button>
          </div>
        </div>

        {!mobile && (
          <div className="w-[372px] shrink-0" style={fade(reduced, 1)}>
            <CalcTeaser />
          </div>
        )}
      </div>

      <div
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
        style={anim(reduced, "aiFloat 2s ease-in-out infinite")}
        aria-hidden
      >
        <ChevronDown size={28} className="text-[#F6F3EE]/50" />
      </div>
    </section>
  );
}

/** Cardul care duce în calculator — pe desktop stă în hero. */
function CalcTeaser() {
  const { nav, mobile } = useAI();
  return (
    <div className="rounded-2xl border border-[#A370EB]/35 bg-[#15181E]/95 p-6 shadow-2xl shadow-black/50">
      <div className="flex items-center gap-3">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-[#A370EB]/20">
          <Sparkles className="text-[#A370EB]" size={22} />
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#A370EB]">Calculator inteligent</p>
          <p className="ai-h text-[22px] font-bold leading-tight text-[#EBE6E0]">Ce pompă de căldură să aleg?</p>
        </div>
      </div>
      <p className="mt-4 text-sm leading-relaxed text-[#9096A2]">
        Șapte întrebări despre casă. Afli necesarul termic și modelul potrivit, fără să lași un număr de telefon.
      </p>
      <div className="mt-4 rounded-xl border border-[#272C35] bg-[#0E1115] p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[#9096A2]">Exemplu · Argeș, 100 m², P+1</p>
        <div className="mt-2 flex items-baseline justify-between">
          <span className="text-sm text-[#EBE6E0]">Necesar termic</span>
          <span className="ai-h text-2xl font-black text-[#A370EB]">6,6 kW</span>
        </div>
        <div className="mt-2 flex items-center gap-2 text-[13px] text-[#EBE6E0]">
          <Check size={14} className="shrink-0 text-[#A370EB]" />
          Daikin Altherma 3 R F · 8 kW
        </div>
        <div className="mt-1 flex items-center gap-2 text-[13px] text-[#9096A2]">
          <Check size={14} className="shrink-0 text-[#9096A2]" />
          Alternativă: Hyundai Monobloc · 8 kW
        </div>
      </div>
      <button type="button" onClick={() => nav.go("calculator")} className={`${BTN_WIZARD} mt-5 w-full px-6 ${mobile ? "py-3.5" : "py-3"}`}>
        <Sparkles size={16} /> Pornește calculatorul
      </button>
    </div>
  );
}

/* ---------------- Încredere (TrustSection + „De ce să ne alegi”) ---------------- */

const WHY = [
  { icon: Wrench, title: "Serviciu complet", desc: "Consultanță, livrare, montaj, garanție și service" },
  { icon: ClipboardCheck, title: "Consultanță gratuită", desc: "Evaluăm nevoile tale și recomandăm soluția optimă" },
  { icon: Shield, title: "Garanție extinsă", desc: "Produse și instalare cu garanție reală" },
  { icon: Zap, title: "Intervenție rapidă", desc: "Echipă mobilă disponibilă rapid" },
];

const CERTS = [
  { icon: Award, title: "Partener Daikin", desc: "Autorizație Dealer 2026" },
  { icon: ShieldCheck, title: "Instalatori autorizați", desc: "ANRE + ISCIR" },
  { icon: BadgeCheck, title: "Garanție extinsă", desc: "Pe echipamente și manoperă" },
];

function Trust() {
  const { mobile } = useAI();
  return (
    <Section bg="rgba(21,24,30,0.3)" border>
      <Reveal>
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <span className="text-xs font-semibold uppercase tracking-[3px] text-[#F97316]">De ce ne aleg clienții</span>
          <div className="mt-3">
            <SectionTitle>De ce să ne alegi</SectionTitle>
          </div>
        </div>
      </Reveal>
      <div className={`grid gap-6 ${mobile ? "grid-cols-1" : "grid-cols-4"}`}>
        {WHY.map((w, i) => (
          <Reveal key={w.title} delay={i * 0.1}>
            <div className={`${CARD} ${CARD_HOVER} h-full p-6 text-center`}>
              <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-xl bg-[#F97316]/10">
                <w.icon className="text-[#F97316]" size={28} />
              </div>
              <h3 className="ai-h text-lg font-bold text-[#EBE6E0]">{w.title}</h3>
              <p className="mt-2 text-sm text-[#9096A2]">{w.desc}</p>
            </div>
          </Reveal>
        ))}
      </div>
      <div className={`mt-10 grid gap-4 ${mobile ? "grid-cols-1" : "grid-cols-3"}`}>
        {CERTS.map((c, i) => (
          <Reveal key={c.title} delay={i * 0.08}>
            <div className="flex items-center gap-4 rounded-xl border border-[#272C35] bg-[#15181E] p-4">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#F97316]/10 text-[#F97316]">
                <c.icon size={22} />
              </div>
              <div>
                <p className="ai-h text-base font-bold text-[#EBE6E0]">{c.title}</p>
                <p className="text-sm text-[#9096A2]">{c.desc}</p>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

/* ---------------- Servicii ---------------- */

type Svc = {
  sheet: SheetId;
  i: number;
  cat: string;
  title: string;
  desc: string;
  alt: string;
  go: "pompe" | "ac" | PfCategory;
};

const SERVICES: Svc[] = [
  { sheet: "a", i: 0, cat: "Serviciu vedetă", title: "Pompe de căldură", desc: "Sisteme eficiente energetic pentru încălzire și răcire. Instalare completă, punere în funcțiune și garanție.", alt: "Unitate exterioară Daikin Altherma în grădina unei case", go: "pompe" },
  { sheet: "a", i: 4, cat: "Serviciu vedetă", title: "Aer condiționat", desc: "Vânzare și montaj AC pentru locuințe, birouri și spații comerciale. Toate mărcile principale.", alt: "Aer condiționat Daikin montat într-un dormitor", go: "ac" },
  { sheet: "b", i: 0, cat: "Instalare & Service", title: "Centrale termice", desc: "Montaj centrale termice pe gaz, în condensație sau clasice. Service și revizie periodică.", alt: "Centrală termică murală cu racorduri din cupru", go: "Centrale termice" },
  { sheet: "b", i: 3, cat: "Energie regenerabilă", title: "Panouri solare & Ventilație", desc: "Soluții regenerabile și sisteme de ventilație pentru confort și eficiență maximă.", alt: "Panouri fotovoltaice pe acoperișul unei case", go: "Panouri solare" },
];

function Services() {
  const { mobile, nav } = useAI();
  const open = (s: Svc) =>
    s.go === "pompe" ? nav.shop("pompe-caldura") : s.go === "ac" ? nav.shop("aer-conditionat") : nav.portfolio(s.go);
  return (
    <Section bg="#15181E">
      <Reveal>
        <div className="mb-12">
          <SectionTitle sub="Nu vindem doar produse. Oferim soluția completă.">Serviciile noastre</SectionTitle>
        </div>
      </Reveal>
      <div className={`grid gap-8 ${mobile ? "grid-cols-1" : "grid-cols-2"}`}>
        {SERVICES.map((s, i) => (
          <Reveal key={s.title} delay={(i % 2) * 0.1}>
            <button
              type="button"
              onClick={() => open(s)}
              className={`group block w-full overflow-hidden rounded-2xl border border-[#272C35] bg-[#0E1115] text-left ${CARD_HOVER} ${FOCUS}`}
            >
              <Sprite
                sheet={s.sheet}
                i={s.i}
                box={16 / 10}
                alt={s.alt}
                innerClassName="transition-transform duration-500 ease-out group-hover:scale-105"
              />
              <div className="p-6">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#F97316]">{s.cat}</span>
                <h3 className="ai-h mt-2 text-xl font-bold text-[#EBE6E0]">{s.title}</h3>
                <p className="mt-2 text-sm text-[#9096A2]">{s.desc}</p>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[#F97316] transition-all group-hover:gap-2">
                  Află mai mult <ArrowRight size={14} />
                </span>
              </div>
            </button>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

/* ---------------- Lucrări ---------------- */

const WORKS: { sheet: SheetId; i: number; label: string; cat: PfCategory; alt: string }[] = [
  { sheet: "b", i: 0, label: "Centrală termică", cat: "Centrale termice", alt: "Centrală termică montată pe perete" },
  { sheet: "a", i: 1, label: "Pompă de căldură", cat: "Pompe de căldură", alt: "Unitate interioară de pompă de căldură cu boiler și vase de expansiune" },
  { sheet: "b", i: 1, label: "Podea încălzită", cat: "Pardoseală radiantă", alt: "Țevi de încălzire în pardoseală într-o cameră la apus" },
];

function Works() {
  const { mobile, nav } = useAI();
  return (
    <Section>
      <Reveal>
        <SectionTitle>Lucrările noastre</SectionTitle>
      </Reveal>
      <div className={`mt-12 grid gap-6 ${mobile ? "grid-cols-1" : "grid-cols-3"}`}>
        {WORKS.map((w, i) => (
          <Reveal key={w.label} delay={i * 0.1}>
            <button
              type="button"
              onClick={() => nav.portfolio(w.cat)}
              className={`group relative block w-full overflow-hidden rounded-2xl text-left ${FOCUS}`}
            >
              <Sprite sheet={w.sheet} i={w.i} box={4 / 3} alt={w.alt} innerClassName="transition-transform duration-500 group-hover:scale-105" />
              <span
                className={`absolute inset-0 flex items-end transition-all duration-300 ${
                  mobile ? "bg-gradient-to-t from-[#0A0C0F]/80 via-transparent to-transparent" : "bg-[#0A0C0F]/0 group-hover:bg-[#0A0C0F]/50"
                }`}
              >
                <span
                  className={`ai-h p-4 text-lg font-bold text-[#F6F3EE] transition-all duration-300 ${
                    mobile ? "" : "translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100"
                  }`}
                >
                  {w.label}
                </span>
              </span>
            </button>
          </Reveal>
        ))}
      </div>
      <div className="mt-8 text-center">
        <button
          type="button"
          onClick={() => nav.portfolio()}
          className={`inline-flex items-center justify-center rounded-lg border-2 border-[#F97316] px-8 py-3.5 font-semibold text-[#F97316] transition-all duration-200 hover:scale-[1.03] hover:bg-[#F97316]/5 active:scale-[0.98] ${FOCUS}`}
        >
          Vezi portofoliul complet <ArrowRight size={14} className="ml-2" />
        </button>
      </div>
    </Section>
  );
}

/* ---------------- Banda portocalie ---------------- */

export function CtaBanner() {
  const { mobile, nav, notify } = useAI();
  return (
    <section className={`bg-[#F97316] text-center ${mobile ? "px-4 py-16" : "px-16 py-20"}`}>
      <Reveal>
        <h2 className={`ai-h font-black text-white ${mobile ? "text-[30px] leading-tight" : "text-[36px]"}`}>
          Gata să îți transformi locuința?
        </h2>
        <p className="mb-8 mt-4 text-lg text-white/80">Solicită o ofertă gratuită astăzi. Răspundem în maxim 24 de ore.</p>
        <div className={`flex justify-center gap-4 ${mobile ? "flex-col" : "flex-wrap"}`}>
          <button
            type="button"
            onClick={() => nav.contact()}
            className={`inline-flex items-center justify-center rounded-lg bg-[#0E1115] px-8 py-3.5 font-semibold text-[#EBE6E0] transition-all duration-200 hover:scale-[1.03] hover:shadow-lg ${FOCUS}`}
          >
            Solicită ofertă
          </button>
          <button
            type="button"
            onClick={() => notify(MSG.call)}
            className={`inline-flex items-center justify-center rounded-lg border-2 border-white/60 px-8 py-3.5 font-semibold text-white transition-all duration-200 hover:scale-[1.03] hover:bg-white/10 ${FOCUS}`}
          >
            <Phone size={18} className="mr-2" /> Sună acum: {DEMO_PHONE}
          </button>
        </div>
      </Reveal>
    </section>
  );
}
