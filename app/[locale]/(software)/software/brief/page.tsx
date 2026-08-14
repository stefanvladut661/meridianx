import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { Reveal } from "@/components/ui/reveal";
import { BriefWizard } from "@/components/software/forms/brief-wizard";
import { DiscoveryCall } from "@/components/software/forms/discovery-call";
import { GatedGuide } from "@/components/software/forms/gated-guide";

// i18n: metadata hardcodată RO — F7 localizează
export const metadata: Metadata = {
  title: "Brief și estimare de preț",
  description:
    "Cinci pași, un interval de preț care se strânge cu fiecare răspuns. Estimare orientativă pentru site-uri, magazine online, aplicații web și mobile, automatizări și integrări.",
};

/**
 * /software/brief (FAZA 5).
 *
 * Signature: „fișa de calibrare” — estimatorul nu e un calculator care
 * scuipă o cifră, ci un instrument a cărui precizie crește pe măsură ce
 * afli mai multe. Lățimea benzii e informație, nu decor.
 *
 * Restul paginii stă cuminte în jurul instrumentului. Fără <main>
 * propriu: shell-ul F1 îl pune în layout-ul de grup.
 */
export default async function SoftwareBriefPage({
  params,
}: Readonly<{ params: Promise<{ locale: string }> }>) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <>
      <Section spacing="sm">
        <Container>
          <Reveal duration={320}>
            <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-accent">
              {/* i18n: (tot copy-ul din pagină) */}
              BRIEF · CALIBRARE · 5 PAȘI
            </p>
            <h1 className="mt-5 max-w-4xl font-display text-4xl tracking-tight sm:text-6xl">
              Estimarea nu începe precisă. Devine.
            </h1>
            <p className="mt-5 max-w-2xl text-pretty text-lg text-muted">
              Un calculator care îți dă „12.400 €” după trei click-uri te
              minte — n-are de unde să știe. Ăsta pornește de la o bandă lată
              și o strânge cu fiecare răspuns, ca să vezi exact cât știm și cât
              încă nu. Durează sub trei minute și îl poți lăsa la jumătate.
            </p>
          </Reveal>
        </Container>
      </Section>

      <Section id="brief" spacing="sm">
        <Container>
          <BriefWizard />
        </Container>
      </Section>

      <Section id="alternative">
        <Container>
          <Reveal duration={320}>
            <div className="max-w-3xl border-t border-line pt-12">
              <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-accent">
                ALTE CĂI
              </p>
              <h2 className="mt-4 text-balance font-display text-3xl tracking-tight sm:text-4xl">
                Nu toată lumea începe cu un formular.
              </h2>
              <p className="mt-4 text-pretty text-muted">
                Unii preferă să întrebe înainte să scrie, alții vor întâi să
                citească. Amândouă variantele duc în același loc: o discuție în
                care știm despre ce vorbim.
              </p>
            </div>
          </Reveal>

          <div className="mt-10 grid gap-6 lg:grid-cols-[1.6fr_1fr] lg:items-start">
            <Reveal duration={320}>
              <DiscoveryCall />
            </Reveal>
            <Reveal duration={320} delay={80}>
              <GatedGuide />
            </Reveal>
          </div>
        </Container>
      </Section>
    </>
  );
}
