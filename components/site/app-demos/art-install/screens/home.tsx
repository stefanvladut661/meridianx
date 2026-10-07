"use client";

import {
  ArrowRight,
  Award,
  BadgeCheck,
  ChevronDown,
  Phone,
  Shield,
  ShieldCheck,
  Star,
  Users,
  Wrench,
  Zap,
} from "lucide-react";
import type { ReactNode } from "react";
import { PHONE, REVIEWS, STAR_DISTRIBUTION, type PfCategory } from "../data";
import {
  BTN_OUTLINE_WHITE,
  BTN_PRIMARY,
  CARD,
  CARD_HOVER,
  Count,
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
   Prima pagină — Index.tsx de pe site, secțiune cu secțiune, în
   aceeași ordine: hero, încredere (TrustSection), „De ce să ne
   alegi”, servicii, recenzii Google, lucrări, banda portocalie.
   Pe pânza de 1280 se aplică clasele `lg`/`xl` ale site-ului, pe
   cea de 390 valorile de bază.
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
      {sub && <p className={`mt-4 max-w-2xl text-lg text-[#9096A2] ${center ? "mx-auto" : ""}`}>{sub}</p>}
    </div>
  );
}

export function Home() {
  return (
    <>
      <Hero />
      <Trust />
      <WhyUs />
      <Services />
      <GoogleReviews />
      <Works />
      <CtaBanner />
    </>
  );
}

/* ---------------- Hero ---------------- */

function Hero() {
  const { mobile, nav, notify, reduced } = useAI();
  const fade = (d: number) => anim(reduced, `aiFadeUp .7s ease-out ${d}s both`);
  return (
    <section className="relative flex items-center" style={{ minHeight: 800 }}>
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

      <div className={`relative w-full ${mobile ? "px-4 pb-20 pt-32" : "mx-auto max-w-[1216px] pb-20 pt-32"}`}>
        <p
          className={`mb-6 font-semibold uppercase tracking-[3px] text-[#F97316] ${mobile ? "text-xs" : "text-sm"}`}
          style={fade(0.2)}
        >
          ✦ Instalatori autorizați HVAC
        </p>
        <h1
          className={`ai-h mb-6 max-w-3xl font-black leading-tight text-[#F6F3EE] ${mobile ? "text-[36px]" : "text-[60px]"}`}
          style={fade(0.4)}
        >
          Confort termic tot anul —{mobile ? " " : <br />}de la consultanță la service
        </h1>
        <p className={`mb-6 max-w-2xl font-light text-[#F6F3EE]/80 ${mobile ? "text-lg" : "text-xl"}`} style={fade(0.6)}>
          Pompe de căldură, aer condiționat, centrale termice și panouri solare. Montaj profesional, garanție extinsă, suport real.
        </p>
        <div className="mb-8 flex items-center gap-2" style={fade(0.7)}>
          <span className="inline-flex items-center gap-2 rounded-full border border-[#F6F3EE]/20 bg-[#F6F3EE]/10 px-4 py-2 text-sm text-[#F6F3EE] backdrop-blur-sm">
            ⭐ 4.98 / 5 — Recenzii verificate Google
          </span>
        </div>
        <div className={`flex gap-4 ${mobile ? "flex-col" : "flex-wrap"}`} style={fade(0.8)}>
          <button type="button" onClick={() => nav.contact()} className={`${BTN_PRIMARY} px-8 py-3.5`}>
            Solicită ofertă gratuită
          </button>
          <button type="button" onClick={() => notify(MSG.call)} className={`${BTN_OUTLINE_WHITE} px-8 py-3.5`}>
            <Phone size={18} /> Sună acum: {PHONE}
          </button>
        </div>
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

/* ---------------- Încredere (TrustSection.tsx) ---------------- */

const STATS = [
  { icon: Award, value: 9, suffix: "+", label: "ani experiență", desc: "Pe piața HVAC din România" },
  { icon: Users, value: 1200, suffix: "+", label: "clienți mulțumiți", desc: "Rezidențial și comercial" },
  { icon: Star, value: 4.98, suffix: "/5", label: "rating Google", desc: "180+ recenzii verificate", decimal: true },
  { icon: BadgeCheck, value: 100, suffix: "%", label: "lucrări garantate", desc: "Garanție extinsă reală" },
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
        <div className="mx-auto mb-14 max-w-2xl text-center">
          <span className="text-xs font-semibold uppercase tracking-[3px] text-[#F97316]">De ce ne aleg clienții</span>
          <div className="mt-3">
            <SectionTitle>Încrederea se construiește în ani</SectionTitle>
          </div>
        </div>
      </Reveal>
      <div className={`mb-14 grid ${mobile ? "grid-cols-2 gap-4" : "grid-cols-4 gap-6"}`}>
        {STATS.map((s, i) => (
          <Reveal key={s.label} delay={i * 0.08}>
            <div className={`${CARD} ${CARD_HOVER} h-full text-center ${mobile ? "p-6" : "p-7"}`}>
              <div
                className={`mx-auto mb-4 flex items-center justify-center rounded-2xl bg-[#F97316]/10 text-[#F97316] ${
                  mobile ? "size-12" : "size-14"
                }`}
              >
                <s.icon size={26} />
              </div>
              <div className={`ai-h font-black leading-none text-[#EBE6E0] ${mobile ? "text-3xl" : "text-5xl"}`}>
                {s.decimal ? (
                  <span>
                    {s.value.toFixed(2)}
                    <span className={`text-[#F97316] ${mobile ? "text-2xl" : "text-3xl"}`}>{s.suffix}</span>
                  </span>
                ) : (
                  <>
                    <Count to={s.value} />
                    <span className="text-[#F97316]">{s.suffix}</span>
                  </>
                )}
              </div>
              <p className={`mt-2 font-semibold text-[#EBE6E0] ${mobile ? "text-sm" : "text-base"}`}>{s.label}</p>
              <p className={`mt-1 text-[#9096A2] ${mobile ? "text-xs" : "text-sm"}`}>{s.desc}</p>
            </div>
          </Reveal>
        ))}
      </div>
      <div className={`mb-12 grid gap-4 ${mobile ? "grid-cols-1" : "grid-cols-3"}`}>
        {CERTS.map((c, i) => (
          <Reveal key={c.title} delay={i * 0.08}>
            <div className="flex items-center gap-4 rounded-xl border border-[#272C35] bg-[#15181E] p-4">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#F97316]/10 text-[#F97316]">
                <c.icon size={22} />
              </div>
              <div>
                <p className={`ai-h font-bold text-[#EBE6E0] ${mobile ? "text-sm" : "text-base"}`}>{c.title}</p>
                <p className={`text-[#9096A2] ${mobile ? "text-xs" : "text-sm"}`}>{c.desc}</p>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

/* ---------------- De ce să ne alegi ---------------- */

const WHY = [
  { icon: Wrench, title: "Serviciu complet", desc: "Consultanță, livrare, montaj, garanție și service" },
  { icon: Star, title: "4.98 pe Google", desc: "Sute de clienți mulțumiți, recenzii verificate" },
  { icon: Shield, title: "Garanție extinsă", desc: "Produse și instalare cu garanție reală" },
  { icon: Zap, title: "Intervenție rapidă", desc: "Echipă mobilă disponibilă rapid" },
];

function WhyUs() {
  const { mobile } = useAI();
  return (
    <Section>
      <Reveal>
        <SectionTitle>De ce să ne alegi</SectionTitle>
      </Reveal>
      <div className={`mt-12 grid gap-6 ${mobile ? "grid-cols-1" : "grid-cols-4"}`}>
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
  /* Pe site, cardurile duc la paginile de serviciu; în demo, la magazin sau la lucrările din categorie. */
  const open = (s: Svc) => (s.go === "pompe" || s.go === "ac" ? nav.shop() : nav.portfolio(s.go));
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
              className={`group block w-full overflow-hidden rounded-2xl border border-[#272C35] bg-[#15181E] text-left ${CARD_HOVER} ${FOCUS}`}
            >
              <Sprite sheet={s.sheet} i={s.i} box={16 / 10} alt={s.alt} innerClassName="transition-transform duration-500 ease-out group-hover:scale-105" />
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

/* ---------------- Recenzii Google ---------------- */

function GoogleG() {
  return (
    <svg width="22" height="22" viewBox="0 0 48 48" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

function GoogleReviews() {
  const { mobile, nav, notify } = useAI();
  return (
    <Section bg="#15181E">
      <Reveal>
        <div className="mb-4 text-center">
          <SectionTitle>Ce spun clienții noștri</SectionTitle>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => notify(MSG.external)}
              aria-label="Vezi recenziile noastre pe Google"
              className={`inline-flex items-center gap-3 rounded-full border border-[#272C35] bg-[#15181E] py-2 pl-3 pr-4 shadow-sm transition-shadow hover:shadow-md ${FOCUS}`}
            >
              <GoogleG />
              <span className="flex flex-col items-start leading-tight">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[#9096A2]">Reviews on</span>
                <span className="ai-h text-sm font-bold text-[#EBE6E0]">Google</span>
              </span>
              <span className="h-8 w-px bg-[#272C35]" aria-hidden />
              <span className="flex flex-col items-start leading-tight">
                <span className="flex items-center gap-1">
                  <span className="ai-h text-base font-black text-[#EBE6E0]">4.98</span>
                  <span className="text-sm text-[#F97316]">★★★★★</span>
                </span>
                <span className="text-[10px] text-[#9096A2]">180+ recenzii verificate</span>
              </span>
            </button>
          </div>
        </div>
      </Reveal>

      <Reveal>
        <div className="mx-auto mb-10 mt-6 max-w-md space-y-2" aria-label="Distribuția notelor">
          {STAR_DISTRIBUTION.map((r) => (
            <div key={r.stars} className="flex items-center gap-2 text-sm text-[#EBE6E0]">
              <span className="w-8 text-right">{r.stars}★</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#272C35]">
                <div className="h-full rounded-full bg-[#F97316]" style={{ width: `${r.pct}%` }} />
              </div>
              <span className="w-10 text-[#9096A2]">{r.pct}%</span>
            </div>
          ))}
        </div>
      </Reveal>

      <div className={`grid gap-6 ${mobile ? "grid-cols-1" : "grid-cols-3"}`}>
        {REVIEWS.slice(0, 3).map((r, i) => (
          <Reveal key={r.name} delay={i * 0.1}>
            <div className={`${CARD} ${CARD_HOVER} h-full p-6`}>
              <div className="mb-4 flex items-center gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#F97316]/10 text-sm font-bold text-[#F97316]">
                  {r.initials}
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#EBE6E0]">{r.name}</p>
                  <p className="text-xs text-[#F97316]" aria-label="5 stele din 5">
                    ⭐⭐⭐⭐⭐
                  </p>
                </div>
              </div>
              <h4 className="ai-h mb-2 text-base font-bold text-[#EBE6E0]">{r.title}</h4>
              <p className="text-sm leading-relaxed text-[#9096A2]">„{r.short ?? r.text}”</p>
            </div>
          </Reveal>
        ))}
      </div>
      <div className="mt-8 text-center">
        <button
          type="button"
          onClick={() => nav.go("recenzii")}
          className={`inline-flex items-center gap-1 rounded text-sm font-semibold text-[#F97316] transition-all hover:gap-2 ${FOCUS}`}
        >
          Vezi toate recenziile <ArrowRight size={14} />
        </button>
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
            <Phone size={18} className="mr-2" /> Sună acum: {PHONE}
          </button>
        </div>
      </Reveal>
    </section>
  );
}
