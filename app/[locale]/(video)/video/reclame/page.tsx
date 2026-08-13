import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { buttonClasses } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { Reveal } from "@/components/ui/reveal";
import { VideoMotionStyles } from "@/components/video/motion-styles";
import { VideoLenis } from "@/components/video/lenis-provider";
import { WordReveal } from "@/components/video/word-reveal";
import { SectionSlate } from "@/components/video/section-slate";
import { CtaBand } from "@/components/video/cta-band";
import { VoiceCta } from "@/components/video/cta/voice-cta";
import { AuditForm } from "@/components/video/forms/audit-form";
import { AD_PLATFORMS, PACKAGE_INCLUDES, REPORTING } from "./ads-content";
import { FatigueCurve } from "./fatigue-curve";

// i18n: metadata hardcodată RO — F7 localizează
export const metadata: Metadata = {
  title: "Management campanii — reclame Meta, Google, TikTok, LinkedIn",
  description:
    "Producem creativul și îl difuzăm noi. Campanii pe Meta, Google, TikTok și LinkedIn, cu creativ nou înainte să crească costul per rezultat. Audit gratuit al campaniilor pe care le rulezi acum.",
};

/**
 * /video/reclame (FAZA 3).
 *
 * Signature: „curba de uzură” — argumentul paginii desenat ca grafic.
 * Restul paginii stă cuminte în jurul lui (regula Chanel din CLAUDE.md
 * §3): fișe de platformă în mono, ritm de raportare, un singur CTA.
 *
 * Poziționarea: nu suntem nici agenție de media care cumpără creativ de
 * la alții, nici studio care predă fișierele și pleacă.
 */

const DIPTYCH = [
  {
    code: "01",
    // i18n: (tot copy-ul din pagină)
    usual: "Creativul vine de la un furnizor, media de la altul. Când costul crește, cele două părți își dau vina reciproc.",
    ours: "Aceeași echipă filmează și difuzează. Când costul crește, creativul nou e deja montat — nu abia briefuit.",
  },
  {
    code: "02",
    usual: "Reclama se schimbă când clientul se plictisește de ea.",
    ours: "Se schimbă când o cer cifrele: la trei–patru săptămâni, din materialul filmat deja.",
  },
  {
    code: "03",
    usual: "Se filmează un film. Când se uzează, se filmează încă unul, de la zero.",
    ours: "Se filmează o zi care produce muniție pentru o lună: variante de cârlig, de durată și de format, din același shoot.",
  },
];

export default async function VideoAdsPage({
  params,
}: Readonly<{ params: Promise<{ locale: string }> }>) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <>
      <VideoMotionStyles />
      <VideoLenis />

      <Section spacing="sm" className="pt-28 sm:pt-36">
        <Container>
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-fg/60">
            CAMPANII · PRODUCȚIE + DISTRIBUȚIE
          </p>
          <h1 className="mt-6 max-w-4xl font-display text-5xl tracking-tight sm:text-7xl">
            <WordReveal text="Filmul și bugetul, în aceeași mână." />
          </h1>
          <p className="mt-6 max-w-2xl text-pretty text-lg text-fg/70">
            O agenție de media cumpără afișări cu creativul pe care i-l dai tu.
            Un studio video predă fișierele și pleacă. Noi facem amândouă
            lucrurile, pentru că problema care îți urcă factura stă exact între
            ele.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-4">
            <a href="#audit" className={buttonClasses({ size: "lg" })}>
              Cere auditul gratuit
            </a>
            <a
              href="#uzura"
              className="font-mono text-sm tracking-wider text-fg/70 underline-offset-4 transition-colors hover:text-fg hover:underline"
            >
              vezi de ce crește costul →
            </a>
          </div>
        </Container>
      </Section>

      {/* SIGNATURE — un singur gest îndrăzneț pe pagină */}
      <Section id="uzura" spacing="lg">
        {/* container standard, nu „wide”: peste ~1150px etichetele mono
            ale graficului s-ar scala prea mare față de restul paginii */}
        <Container>
          <Reveal>
            <SectionSlate
              code="PROBLEMA · UZURA CREATIVULUI"
              title="Reclama ta nu se strică. Publicul o învață pe de rost."
              lead="La a zecea vizionare, aceeași imagine costă de câteva ori mai mult ca la prima. Platforma nu te penalizează — pur și simplu nimeni nu se mai oprește. De aici pornește toată discuția despre buget."
            />
          </Reveal>
          <div className="mt-12">
            <FatigueCurve />
          </div>
        </Container>
      </Section>

      <Section id="cusatura">
        <Container>
          <Reveal>
            <SectionSlate
              code="CUSĂTURA · CE FACEM ALTFEL"
              title="Avantajul nu e prețul. E viteza cu care schimbăm creativul."
            />
          </Reveal>
          <ul className="mt-12 divide-y divide-line border-y border-line">
            {DIPTYCH.map((row, index) => (
              <li key={row.code}>
                <Reveal delay={index * 80}>
                  <div className="grid gap-6 py-8 lg:grid-cols-[3rem_1fr_1fr] lg:gap-10">
                    <p className="font-mono text-xs tracking-[0.25em] text-fg/60">
                      {row.code}
                    </p>
                    <div>
                      <p className="font-mono text-[11px] tracking-[0.28em] text-fg/60">
                        DE OBICEI
                      </p>
                      <p className="mt-3 text-pretty text-fg/60">{row.usual}</p>
                    </div>
                    <div>
                      <p className="font-mono text-[11px] tracking-[0.28em] text-accent">
                        LA NOI
                      </p>
                      <p className="mt-3 text-pretty text-lg text-fg">
                        {row.ours}
                      </p>
                    </div>
                  </div>
                </Reveal>
              </li>
            ))}
          </ul>
        </Container>
      </Section>

      <Section id="platforme">
        <Container>
          <Reveal>
            <SectionSlate
              code="PLATFORME · PL.01–04"
              title="Patru platforme, patru feluri de a fi văzut."
              lead="Nu difuzăm același film peste tot. Fiecare platformă are un tip de atenție și un format care i se potrivește — iar pe unele dintre ele filmăm diferit din start."
            />
          </Reveal>
          <div className="mt-12 space-y-px">
            {AD_PLATFORMS.map((platform, index) => (
              <Reveal key={platform.code} delay={index * 60}>
                <article className="grid gap-8 border-t border-line py-10 lg:grid-cols-[1.15fr_1fr] lg:gap-14">
                  <div>
                    <p className="font-mono text-xs tracking-[0.25em] text-fg/60">
                      {platform.code}
                    </p>
                    <h3 className="mt-4 font-display text-4xl tracking-tight sm:text-5xl">
                      {platform.name}
                    </h3>
                    <p className="mt-4 text-pretty text-lg text-fg/80">
                      {platform.strength}
                    </p>
                    <p className="mt-6 border-l-2 border-accent-2 pl-4 text-pretty text-sm text-fg/70">
                      <span className="font-mono text-[11px] tracking-[0.28em] text-accent-2">
                        DE ȘTIUT:{" "}
                      </span>
                      {platform.caveat}
                    </p>
                  </div>
                  <div className="overflow-hidden rounded-md border border-line bg-surface/50">
                    <p className="border-b border-line px-5 py-3 font-mono text-xs tracking-[0.3em] text-accent-2">
                      CE LIVRĂM
                    </p>
                    <ul className="divide-y divide-line">
                      {platform.formats.map((format) => (
                        <li
                          key={format}
                          className="flex gap-3 px-5 py-3.5 text-sm text-fg/80"
                        >
                          <span aria-hidden="true" className="text-accent">
                            —
                          </span>
                          {format}
                        </li>
                      ))}
                    </ul>
                  </div>
                </article>
              </Reveal>
            ))}
          </div>
        </Container>
      </Section>

      <Section id="raportare">
        <Container>
          <Reveal>
            <SectionSlate
              code="RAPORTARE · RITMUL"
              title="Afli cum merge fără să întrebi."
              lead="Raportul care vine doar când îl ceri e un raport care ascunde ceva. Al nostru vine singur, în același format, în aceeași zi."
            />
          </Reveal>
          <ul className="mt-12 divide-y divide-line border-y border-line">
            {REPORTING.map((item, index) => (
              <li key={item.cadence}>
                <Reveal delay={index * 70}>
                  <div className="flex flex-col gap-3 py-7 sm:flex-row sm:gap-10">
                    <p className="font-mono text-[11px] tracking-[0.28em] text-accent sm:w-56 sm:shrink-0">
                      {item.cadence}
                    </p>
                    <p className="text-pretty text-fg/80">{item.what}</p>
                  </div>
                </Reveal>
              </li>
            ))}
          </ul>
        </Container>
      </Section>

      <Section id="pachet">
        <Container>
          <div className="grid gap-12 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
            <Reveal>
              <SectionSlate
                code="PACHET · PRODUCȚIE + DISTRIBUȚIE"
                title="Un contract, o echipă, o factură."
                lead="Nu e nevoie să coordonezi tu un studio, un freelancer de reclame și un grafician care face bannere. Pachetul acoperă tot lanțul, de la ziua de filmare până la creativul de săptămâna a șaptea."
              />
              <div className="mt-8 rounded-md border border-line bg-surface/50 p-6">
                <p className="font-mono text-[11px] tracking-[0.28em] text-accent-2">
                  DESPRE BANI, DIRECT
                </p>
                <p className="mt-4 text-pretty text-fg/80">
                  Bugetul de media rămâne la tine, în contul tău — noi nu ți-l
                  facturăm și nu luăm comision din el. Facturăm producția și
                  managementul, iar cât înseamnă asta îl stabilim după audit,
                  când știm câte creative pe lună cere campania ta. Un preț dat
                  înainte de audit ar fi o cifră inventată.
                </p>
              </div>
            </Reveal>
            <Reveal delay={120}>
              <div className="overflow-hidden rounded-md border border-line bg-surface/50">
                <p className="border-b border-line px-5 py-3 font-mono text-xs tracking-[0.3em] text-accent-2">
                  CE INTRĂ ÎN PACHET
                </p>
                <ul className="divide-y divide-line">
                  {PACKAGE_INCLUDES.map((item) => (
                    <li
                      key={item}
                      className="flex gap-3 px-5 py-4 text-sm text-fg/80"
                    >
                      <span aria-hidden="true" className="text-accent">
                        —
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          </div>
        </Container>
      </Section>

      <Section id="audit" spacing="lg" className="border-t border-line">
        <Container>
          <Reveal>
            <SectionSlate
              code="AUDIT · GRATUIT, FĂRĂ OBLIGAȚII"
              title="Îți spunem unde pierzi bani. Chiar dacă apoi nu lucrăm împreună."
              lead="Deschidem conturile pe care le rulezi acum, ne uităm la cost per rezultat, la frecvență și la vechimea creativelor, și îți spunem în 20 de minute ce am schimba primul."
            />
          </Reveal>
          <div className="mt-12 grid gap-10 lg:grid-cols-[1.1fr_1fr] lg:gap-14">
            <Reveal>
              <AuditForm />
            </Reveal>
            <Reveal delay={120} className="flex flex-col gap-8">
              <div>
                <p className="font-mono text-[11px] tracking-[0.28em] text-fg/60">
                  SAU, DACĂ E MAI SIMPLU AȘA
                </p>
                <p className="mt-3 text-pretty text-fg/70">
                  Multe lucruri se lămuresc mai repede spuse decât scrise. Dacă
                  preferi să ne auzi întâi, alege una dintre variantele de mai
                  jos — ajungi la aceiași oameni.
                </p>
              </div>
              <VoiceCta context="reclame" className="sm:grid-cols-1" />
              <div className="rounded-md border border-line p-5">
                <p className="font-mono text-[11px] tracking-[0.28em] text-accent-2">
                  CE NU FACEM LA AUDIT
                </p>
                <ul className="mt-4 space-y-2 text-sm text-fg/70">
                  <li>Nu cerem parole. Ne dai acces din Business Manager.</li>
                  <li>
                    Nu trimitem o prezentare de 40 de slide-uri ca să pară multă
                    muncă.
                  </li>
                  <li>
                    Nu spunem că tot ce faci e greșit. De obicei nu e — și îți
                    spunem și asta.
                  </li>
                </ul>
              </div>
            </Reveal>
          </div>
        </Container>
      </Section>

      <CtaBand
        slate="NU RULEZI ÎNCĂ RECLAME?"
        title="Atunci începem cu filmul. Distribuția vine când ai ce distribui."
        lead="Nu are rost să plătești afișări pentru un material care nu oprește degetul. Prima cheltuială utilă e creativul, nu bugetul de media."
        cta={{ label: "Cere ofertă", href: "/video/contact" }}
        secondary={{ label: "sau vezi serviciile de producție", href: "/video/servicii" }}
      />
    </>
  );
}
