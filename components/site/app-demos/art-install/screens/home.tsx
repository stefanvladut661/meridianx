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
import type { MouseEvent } from "react";
import { PHONE } from "../data";
import {
  CountUp,
  IMG,
  MSG,
  Reveal,
  anim,
  btnOutline,
  btnOutlineWhite,
  btnPrimary,
  cardHover,
  container,
  sectionPad,
  sectionTitle,
  useAI,
} from "../ui";

/* ============================================================
   Prima pagină — Index.tsx de pe site, în aceeași ordine: hero,
   încredere, „De ce să ne alegi”, servicii, recenzii, lucrări,
   banda portocalie. Textele sunt cele de pe site, cuvânt cu cuvânt.
   ============================================================ */

export function Home() {
  return (
    <>
      <Hero />
      <Trust />
      <Why />
      <Services />
      <Reviews />
      <Works />
      <CtaBand />
    </>
  );
}

/** Linkurile site-ului spre pagini din afara demo-ului. */
function offLink(run: () => void) {
  return (e: MouseEvent) => {
    e.preventDefault();
    run();
  };
}

/* ---------------- Hero ---------------- */

function Hero() {
  const { mobile, nav, notify, reduced } = useAI();
  return (
    <section className="relative flex min-h-[800px] items-center">
      <div className="absolute inset-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`${IMG}/hero.webp`}
          alt="Tehnician care verifică unitatea exterioară a unei pompe de căldură"
          className="h-full w-full object-cover"
          fetchPriority="high"
        />
        <div className="absolute inset-0 bg-[#0A0C0F]" style={{ opacity: 0.75 }} />
      </div>
      {/* Element flex fără lățime: pe desktop se strânge pe conținut și
          stă centrat, ca pe site (textul începe la x≈264). */}
      <div className={`relative ${container(mobile)} pb-20 pt-32`}>
        <p className="mb-6 text-sm font-semibold uppercase tracking-[3px] text-[#F97015]">✦ Instalatori autorizați HVAC</p>
        <h1
          className={`mb-6 max-w-[768px] font-black text-[#F6F3EE] ${
            mobile ? "text-[36px] leading-[45px]" : "text-[60px] leading-[60px]"
          }`}
        >
          Confort termic tot anul —<br />
          de la consultanță la service
        </h1>
        <p
          className={`mb-6 max-w-[672px] font-light leading-[28px] text-[#F6F3EE]/80 ${mobile ? "text-[18px]" : "text-[20px]"}`}
        >
          Pompe de căldură, aer condiționat, centrale termice și panouri solare. Montaj profesional, garanție extinsă, suport real.
        </p>
        <div className="mb-8 flex items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full border border-[#F6F3EE]/20 bg-[#F6F3EE]/10 px-4 py-2 text-sm text-[#F6F3EE] backdrop-blur-xs">
            ⭐ 4.98 / 5 — Recenzii verificate Google
          </span>
        </div>
        <div className="flex flex-wrap gap-4">
          <button type="button" onClick={() => nav.go("contact")} className={`${btnPrimary(mobile)} px-8 py-3.5`}>
            Solicită ofertă gratuită
          </button>
          <button type="button" onClick={() => notify(MSG.call)} className={`${btnOutlineWhite(mobile)} px-8 py-3.5`}>
            <Phone size={18} className="mr-2" /> Sună acum: {PHONE}
          </button>
        </div>
      </div>
      {/* Ca pe site: animația de plutire înlocuiește translateX(-50%),
          așa că săgeata stă cu marginea stângă pe mijloc. */}
      <div className="absolute bottom-8 left-1/2" style={anim(reduced, "aiFloat 2s ease-in-out infinite")} aria-hidden>
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
    <section className={`${sectionPad(mobile)} border-y border-[#272C35] bg-[#15181E]/30`}>
      <div className={container(mobile)}>
        <Reveal>
          <div className="mx-auto mb-14 max-w-[672px] text-center">
            <span className="text-xs font-semibold uppercase tracking-[3px] text-[#F97015]">De ce ne aleg clienții</span>
            <h2 className={`${sectionTitle(mobile)} mt-3`}>Încrederea se construiește în ani</h2>
          </div>
        </Reveal>

        <div className={`mb-14 grid ${mobile ? "grid-cols-2 gap-4" : "grid-cols-4 gap-6"}`}>
          {STATS.map((s, i) => (
            <Reveal key={s.label} delay={i * 0.08}>
              <div
                className={`h-full rounded-[16px] border border-[#272C35] bg-[#15181E] text-center ${mobile ? "p-6" : "p-7"} ${cardHover(mobile)}`}
              >
                <div
                  className={`mx-auto mb-4 flex items-center justify-center rounded-[16px] bg-[#F97015]/10 text-[#F97015] ${
                    mobile ? "size-12" : "size-14"
                  }`}
                >
                  <s.icon size={26} />
                </div>
                <div className={`ai-h font-black leading-none text-[#EBE7E0] ${mobile ? "text-[30px]" : "text-[48px]"}`}>
                  {s.decimal ? (
                    <span>
                      {s.value.toFixed(2)}
                      <span className={`text-[#F97015] ${mobile ? "text-[24px] leading-[32px]" : "text-[30px] leading-[36px]"}`}>
                        {s.suffix}
                      </span>
                    </span>
                  ) : (
                    <>
                      <CountUp end={s.value} />
                      <span className="text-[#F97015]">{s.suffix}</span>
                    </>
                  )}
                </div>
                <p className={`mt-2 font-semibold text-[#EBE7E0] ${mobile ? "text-sm" : "text-base"}`}>{s.label}</p>
                <p className={`mt-1 text-[#9096A2] ${mobile ? "text-xs" : "text-sm"}`}>{s.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>

        <div className={`mb-12 grid gap-4 ${mobile ? "grid-cols-1" : "grid-cols-3"}`}>
          {CERTS.map((c, i) => (
            <Reveal key={c.title} delay={i * 0.08}>
              <div className="flex items-center gap-4 rounded-[12px] border border-[#272C35] bg-[#15181E] p-4">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-[12px] bg-[#F97015]/10 text-[#F97015]">
                  <c.icon size={22} />
                </div>
                <div>
                  <p className={`ai-h font-bold text-[#EBE7E0] ${mobile ? "text-sm" : "text-base"}`}>{c.title}</p>
                  <p className={`text-[#9096A2] ${mobile ? "text-xs" : "text-sm"}`}>{c.desc}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- De ce să ne alegi ---------------- */

const WHY = [
  { icon: Wrench, title: "Serviciu complet", desc: "Consultanță, livrare, montaj, garanție și service" },
  { icon: Star, title: "4.98 pe Google", desc: "Sute de clienți mulțumiți, recenzii verificate" },
  { icon: Shield, title: "Garanție extinsă", desc: "Produse și instalare cu garanție reală" },
  { icon: Zap, title: "Intervenție rapidă", desc: "Echipă mobilă disponibilă rapid" },
];

function Why() {
  const { mobile } = useAI();
  return (
    <section className={sectionPad(mobile)}>
      <div className={container(mobile)}>
        <Reveal>
          <h2 className={`${sectionTitle(mobile)} text-center`}>De ce să ne alegi</h2>
        </Reveal>
        <div className={`mt-12 grid gap-6 ${mobile ? "grid-cols-1" : "grid-cols-4"}`}>
          {WHY.map((w, i) => (
            <Reveal key={w.title} delay={i * 0.1}>
              <div className={`rounded-[16px] border border-[#272C35] bg-[#15181E] p-6 text-center ${cardHover(mobile)}`}>
                <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-[12px] bg-[#F97015]/10">
                  <w.icon className="text-[#F97015]" size={28} />
                </div>
                <h3 className="text-lg font-bold">{w.title}</h3>
                <p className="mt-2 text-sm text-[#9096A2]">{w.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- Serviciile noastre ---------------- */

const SERVICES = [
  {
    img: "svc-pompe.webp",
    cat: "Serviciu vedetă",
    title: "Pompe de căldură",
    desc: "Sisteme eficiente energetic pentru încălzire și răcire. Instalare completă, punere în funcțiune și garanție.",
    alt: "Tehnician care prezintă o pompă de căldură Daikin Altherma montată în grădină",
  },
  {
    img: "svc-ac.webp",
    cat: "Serviciu vedetă",
    title: "Aer condiționat",
    desc: "Vânzare și montaj AC pentru locuințe, birouri și spații comerciale. Toate mărcile principale.",
    alt: "Aer condiționat Daikin Comfora într-un dormitor luminos",
  },
  {
    img: "svc-centrale.webp",
    cat: "Instalare & Service",
    title: "Centrale termice",
    desc: "Montaj centrale termice pe gaz, în condensație sau clasice. Service și revizie periodică.",
    alt: "Centrală termică murală cu racorduri din cupru",
  },
  {
    img: "svc-solar.webp",
    cat: "Energie regenerabilă",
    title: "Panouri solare & Ventilație",
    desc: "Soluții regenerabile și sisteme de ventilație pentru confort și eficiență maximă.",
    alt: "Panouri fotovoltaice pe acoperișul unei case",
  },
];

function Services() {
  const { mobile, nav } = useAI();
  return (
    <section className={`${sectionPad(mobile)} bg-[#15181E]`}>
      <div className={container(mobile)}>
        <Reveal>
          <div className="mb-12 text-center">
            <h2 className={sectionTitle(mobile)}>Serviciile noastre</h2>
            <p className="mx-auto mt-4 max-w-[672px] text-lg text-[#9096A2]">Nu vindem doar produse. Oferim soluția completă.</p>
          </div>
        </Reveal>
        <div className={`grid gap-8 ${mobile ? "grid-cols-1" : "grid-cols-2"}`}>
          {SERVICES.map((s, i) => (
            <Reveal key={s.title} delay={i * 0.1}>
              <a
                href="#"
                onClick={offLink(() => nav.off(s.title))}
                className={`group block overflow-hidden rounded-[16px] border border-[#272C35] bg-[#15181E] ${cardHover(mobile)}`}
              >
                <div className="aspect-[16/10] overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`${IMG}/${s.img}`}
                    alt={s.alt}
                    loading="lazy"
                    decoding="async"
                    className={`h-full w-full object-cover transition-transform duration-500 ease-out ${mobile ? "" : "hover:scale-105"}`}
                  />
                </div>
                <div className="p-6">
                  <span className="text-xs font-semibold uppercase tracking-wider text-[#F97015]">{s.cat}</span>
                  <h3 className="mt-2 text-xl font-bold">{s.title}</h3>
                  <p className="mt-2 text-sm text-[#9096A2]">{s.desc}</p>
                  <span
                    className={`mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[#F97015] transition-all ${
                      mobile ? "" : "group-hover:gap-2"
                    }`}
                  >
                    Află mai mult <ArrowRight size={14} />
                  </span>
                </div>
              </a>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- Ce spun clienții noștri ---------------- */

/* Recenziile de pe site, cu tot cu diacriticele lipsă din prima. */
const REVIEWS = [
  {
    initials: "A.P.",
    name: "A. Popescu",
    title: "Lucrări executate cu profesionalism",
    text: "Lucrari executate cu profesionalism, punctualitate si calitate, intr-un cuvant: excelent!",
  },
  {
    initials: "M.I.",
    name: "M. Ionescu",
    title: "Foarte mulțumită de servicii",
    text: "Foarte mulțumită de serviciile acestei firme. Au montat 2 centrale +calorifere și instalații și totul a fost impecabil. Recomand cu încredere.",
  },
  {
    initials: "C.M.",
    name: "C. Mihai",
    title: "Cea mai plăcută experiență",
    text: "Colaborarea cu ART INSTAL SUPPLIERS a fost una dintre cele mai plăcute experiențe. Echipa organizată, punctuală, atentă la detalii. Recomand din toată inima.",
  },
];

const STAR_BARS = [
  { stars: 5, pct: 96 },
  { stars: 4, pct: 3 },
  { stars: 3, pct: 1 },
  { stars: 2, pct: 0 },
  { stars: 1, pct: 0 },
];

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

function Reviews() {
  const { mobile, nav, notify } = useAI();
  return (
    <section className={`${sectionPad(mobile)} bg-[#15181E]`}>
      <div className={container(mobile)}>
        <Reveal>
          <div className="mb-4 text-center">
            <h2 className={sectionTitle(mobile)}>Ce spun clienții noștri</h2>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <a
                href="#"
                onClick={offLink(() => notify(MSG.external))}
                aria-label="Vezi recenziile noastre pe Google"
                className={`inline-flex items-center gap-3 rounded-full border border-[#272C35] bg-[#15181E] py-2 pl-3 pr-4 shadow-xs transition-shadow ${
                  mobile ? "" : "hover:shadow-md"
                }`}
              >
                <GoogleG />
                <div className="flex flex-col items-start leading-tight">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[#9096A2]">Reviews on</span>
                  <span className="ai-h text-sm font-bold text-[#EBE7E0]">Google</span>
                </div>
                <div className="h-8 w-px bg-[#272C35]" />
                <div className="flex flex-col items-start leading-tight">
                  <div className="flex items-center gap-1">
                    <span className="ai-h text-base font-black text-[#EBE7E0]">4.98</span>
                    <span className="text-sm text-[#F97015]">★★★★★</span>
                  </div>
                  <span className="text-[10px] text-[#9096A2]">180+ recenzii verificate</span>
                </div>
              </a>
            </div>
          </div>
        </Reveal>

        <Reveal>
          <div className="mx-auto mb-10 mt-6 max-w-[448px] space-y-2">
            {STAR_BARS.map((r) => (
              <div key={r.stars} className="flex items-center gap-2 text-sm">
                <span className="w-8 text-right">{r.stars}★</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#272C35]">
                  <div className="h-full rounded-full bg-[#F97015]" style={{ width: `${r.pct}%` }} />
                </div>
                <span className="w-10 text-[#9096A2]">{r.pct}%</span>
              </div>
            ))}
          </div>
        </Reveal>

        <div className={`grid gap-6 ${mobile ? "grid-cols-1" : "grid-cols-3"}`}>
          {REVIEWS.map((r, i) => (
            <Reveal key={r.name} delay={i * 0.1}>
              <div className={`rounded-[16px] border border-[#272C35] bg-[#15181E] p-6 ${cardHover(mobile)}`}>
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-full bg-[#F97015]/10 text-sm font-bold text-[#F97015]">
                    {r.initials}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{r.name}</p>
                    <p className="text-xs text-[#F97015]" role="img" aria-label="5 stele">
                      ⭐⭐⭐⭐⭐
                    </p>
                  </div>
                </div>
                <h4 className="mb-2 text-base font-bold">{r.title}</h4>
                {/* Ghilimelele sunt ca pe site: „ la deschidere, " ASCII la închidere. */}
                <p className="text-sm leading-relaxed text-[#9096A2]">„{r.text}&quot;</p>
              </div>
            </Reveal>
          ))}
        </div>
        <div className="mt-8 text-center">
          <a
            href="#"
            onClick={offLink(() => nav.off("Recenzii"))}
            className={`inline-flex items-center gap-1 font-semibold text-[#F97015] transition-all ${mobile ? "" : "hover:gap-2"}`}
          >
            Vezi toate recenziile <ArrowRight size={14} />
          </a>
        </div>
      </div>
    </section>
  );
}

/* ---------------- Lucrările noastre ---------------- */

/* Pe site, dalele au doar cursor de link: click-ul nu face nimic. */
const WORKS = [
  { img: "pf-01.webp", label: "Centrală termică" },
  { img: "pf-04.webp", label: "Pompă de căldură" },
  { img: "pf-03.webp", label: "Podea încălzită" },
];

function Works() {
  const { mobile, nav } = useAI();
  return (
    <section className={sectionPad(mobile)}>
      <div className={container(mobile)}>
        <Reveal>
          <h2 className={`${sectionTitle(mobile)} text-center`}>Lucrările noastre</h2>
        </Reveal>
        <div className={`mt-12 grid gap-6 ${mobile ? "grid-cols-1" : "grid-cols-3"}`}>
          {WORKS.map((w, i) => (
            <Reveal key={w.label} delay={i * 0.1}>
              <div className="group relative aspect-[4/3] cursor-pointer overflow-hidden rounded-[16px]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`${IMG}/${w.img}`}
                  alt={w.label}
                  loading="lazy"
                  decoding="async"
                  className={`h-full w-full object-cover transition-transform duration-500 ${mobile ? "" : "group-hover:scale-105"}`}
                />
                {/* Eticheta apare doar la hover; pe telefon nu există. */}
                {!mobile && (
                  <div className="absolute inset-0 flex items-end bg-[#0A0C0F]/0 transition-all duration-300 group-hover:bg-[#0A0C0F]/50">
                    <span
                      aria-hidden
                      className="ai-h translate-y-4 p-4 text-lg font-bold text-[#F6F3EE] opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100"
                    >
                      {w.label}
                    </span>
                  </div>
                )}
              </div>
            </Reveal>
          ))}
        </div>
        <div className="mt-8 text-center">
          <button
            type="button"
            onClick={() => nav.go("portofoliu")}
            className={`${btnOutline(mobile)} border-[#F97015] px-8 py-3.5 text-[#F97015] ${mobile ? "" : "hover:bg-[#F97015]/5"}`}
          >
            Vezi portofoliul complet <ArrowRight size={14} className="ml-2" />
          </button>
        </div>
      </div>
    </section>
  );
}

/* ---------------- Banda portocalie ---------------- */

function CtaBand() {
  const { mobile, nav, notify } = useAI();
  return (
    <section className={`bg-[#F97015] ${mobile ? "py-16" : "py-20"}`}>
      <div className={`${container(mobile)} text-center`}>
        <Reveal>
          <h2 className={`font-black text-white ${mobile ? "text-[30px] leading-[36px]" : "text-[36px] leading-[40px]"}`}>
            Gata să îți transformi locuința?
          </h2>
          <p className="mb-8 mt-4 text-lg text-white/80">Solicită o ofertă gratuită astăzi. Răspundem în maxim 24 de ore.</p>
          <div className="flex flex-wrap justify-center gap-4">
            <button
              type="button"
              onClick={() => nav.go("contact")}
              className={`inline-flex items-center justify-center rounded-[12px] bg-[#0E1115] px-8 py-3.5 font-semibold text-[#EBE7E0] transition-all duration-200 ${
                mobile ? "" : "hover:scale-[1.03] hover:shadow-lg"
              }`}
            >
              Solicită ofertă
            </button>
            <button
              type="button"
              onClick={() => notify(MSG.call)}
              className={`${btnOutline(mobile)} border-white/60 px-8 py-3.5 text-white ${mobile ? "" : "hover:bg-white/10"}`}
            >
              <Phone size={18} className="mr-2" /> Sună acum: {PHONE}
            </button>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
