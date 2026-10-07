"use client";

import { ArrowRight, Award, Eye, Layers } from "lucide-react";
import { CARD, CARD_HOVER, Count, FOCUS, PageHero, Reveal, useAI } from "../ui";
import { Section, SectionTitle } from "./home";

/* ============================================================
   Despre noi — AboutPage.tsx de pe site: povestea, valorile,
   procesul în șase pași, cifrele pe bandă bleumarin, îndemnul.
   ============================================================ */

const VALUES = [
  { icon: Award, title: "Profesionalism", desc: "Echipă autorizată, cu experiență dovedită și atenție la fiecare detaliu." },
  { icon: Eye, title: "Transparență", desc: "Comunicare clară, prețuri corecte, fără surprize la finalul proiectului." },
  { icon: Layers, title: "Serviciu complet", desc: "De la consultanță la service post-garanție — totul sub un singur acoperiș." },
];

const STEPS = [
  { icon: "📞", title: "Consultanță", desc: "Analizăm nevoile tale" },
  { icon: "📋", title: "Ofertare", desc: "Primești ofertă personalizată" },
  { icon: "🚚", title: "Livrare", desc: "Echipamente la ușa ta" },
  { icon: "🔧", title: "Montaj", desc: "Instalare profesională" },
  { icon: "✅", title: "Garanție", desc: "Garanție extinsă reală" },
  { icon: "🛠️", title: "Service", desc: "Suport post-vânzare" },
];

type Stat = { label: string } & ({ to: number; suffix: string } | { fixed: string });
const STATS: Stat[] = [
  { to: 500, suffix: "+", label: "Proiecte finalizate" },
  { to: 8, suffix: "+", label: "Ani de experiență" },
  { fixed: "4.98", label: "Rating Google ⭐" },
  { to: 100, suffix: "%", label: "Clienți mulțumiți" },
];

export function About() {
  const { mobile, nav } = useAI();
  return (
    <>
      <PageHero title="Despre noi" crumb="Acasă / Despre noi" />

      <section className={mobile ? "px-4 py-16" : "px-16 py-24"}>
        <div className={mobile ? "" : "mx-auto max-w-[832px]"}>
          <Reveal>
            <SectionTitle center={false}>Povestea noastră</SectionTitle>
            <div className="mt-6 space-y-4 leading-relaxed text-[#9096A2]">
              <p>
                Cu peste 8 ani de experiență pe piața din România, Art Instal Suppliers SRL este o echipă de 5-10 profesioniști dedicați soluțiilor HVAC complete. Am început cu o viziune simplă: să oferim servicii de instalații termice la cel mai înalt standard, accesibile oricui.
              </p>
              <p>
                De-a lungul anilor, am realizat sute de proiecte — de la montaj de centrale termice și pompe de căldură, la sisteme complexe de ventilație și panouri solare. Fiecare proiect a fost tratat cu aceeași atenție la detaliu și respect pentru client.
              </p>
              <p>
                Oferim un serviciu complet de la A la Z: consultanță, proiectare, livrare, montaj, garanție și service post-vânzare. Suntem parteneri autorizați ai celor mai importante branduri din industrie.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      <Section bg="#15181E">
        <Reveal>
          <SectionTitle>Valorile noastre</SectionTitle>
        </Reveal>
        <div className={`mt-12 grid gap-8 ${mobile ? "grid-cols-1" : "grid-cols-3"}`}>
          {VALUES.map((v, i) => (
            <Reveal key={v.title} delay={i * 0.1}>
              <div className={`${CARD} ${CARD_HOVER} p-8 text-center`}>
                <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-xl bg-[#F97316]/10">
                  <v.icon className="text-[#F97316]" size={28} />
                </div>
                <h3 className="ai-h text-xl font-bold text-[#EBE6E0]">{v.title}</h3>
                <p className="mt-3 text-sm text-[#9096A2]">{v.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </Section>

      <Section>
        <Reveal>
          <SectionTitle>Procesul nostru</SectionTitle>
        </Reveal>
        <div className={`mt-12 grid gap-6 ${mobile ? "grid-cols-2" : "grid-cols-6"}`}>
          {STEPS.map((s, i) => (
            <Reveal key={s.title} delay={i * 0.15}>
              <div className="text-center">
                <div className="mx-auto mb-3 flex size-16 items-center justify-center rounded-full bg-[#F97316]/10 text-2xl" aria-hidden>
                  {s.icon}
                </div>
                <span className="text-xs font-semibold text-[#F97316]">Pas {i + 1}</span>
                <h3 className="ai-h mt-1 text-base font-bold text-[#EBE6E0]">{s.title}</h3>
                <p className="mt-1 text-sm text-[#9096A2]">{s.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </Section>

      <section className={`bg-[#0A0C0F] text-[#F6F3EE] ${mobile ? "px-4 py-16" : "px-16 py-16"}`}>
        <div className={`grid gap-8 text-center ${mobile ? "grid-cols-2" : "mx-auto max-w-[1152px] grid-cols-4"}`}>
          {STATS.map((s, i) => (
            <Reveal key={s.label} delay={i * 0.1}>
              <div>
                <div className={`ai-h font-black text-[#F97316] ${mobile ? "text-3xl" : "text-5xl"}`}>
                  {"fixed" in s ? (
                    s.fixed
                  ) : (
                    <>
                      <Count to={s.to} />
                      {s.suffix}
                    </>
                  )}
                </div>
                <p className={`mt-2 text-[#F6F3EE]/70 ${mobile ? "text-sm" : "text-base"}`}>{s.label}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className={`bg-[#F97316] text-center ${mobile ? "px-4 py-16" : "px-16 py-16"}`}>
        <h2 className="ai-h text-3xl font-black text-white">Hai să lucrăm împreună!</h2>
        <p className="mb-8 mt-4 text-white/80">Contactează-ne pentru o consultanță gratuită.</p>
        <button
          type="button"
          onClick={() => nav.contact()}
          className={`inline-flex items-center justify-center rounded-lg bg-[#0E1115] px-8 py-3.5 font-semibold text-[#EBE6E0] transition-all duration-200 hover:scale-[1.03] hover:shadow-lg ${FOCUS}`}
        >
          Contactează-ne <ArrowRight size={16} className="ml-2" />
        </button>
      </section>
    </>
  );
}
