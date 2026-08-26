import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { pageSeo } from "@/lib/seo";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { Reveal } from "@/components/ui/reveal";
import { VideoMotionStyles } from "@/components/video/motion-styles";
import { VideoLenis } from "@/components/video/lenis-provider";
import { WordReveal } from "@/components/video/word-reveal";
import { SectionSlate } from "@/components/video/section-slate";
import { CtaBand } from "@/components/video/cta-band";
import { VoiceCta } from "@/components/video/cta/voice-cta";
import { ChannelPanel } from "@/components/video/cta/channel-panel";
import { CalEmbed } from "@/components/video/cta/cal-embed";
import { calHref } from "@/components/video/cta/channels";
import { ContactForm } from "@/components/video/forms/contact-form";
import { VIDEO_SEGMENTS } from "@/components/video/segments";
import type { VideoSegment } from "@/content/types";

// i18n: metadata hardcodată RO — F7 localizează
const TITLE = "Contact — producție video și campanii";
const DESCRIPTION =
  "WhatsApp, telefon, formular sau call de 20 de minute. Toate canalele MERIDIAN Video într-un singur loc, cu timpul de răspuns scris lângă fiecare.";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: TITLE,
    description: DESCRIPTION,
    ...pageSeo({
      route: "/video/contact",
      locale: locale as Locale,
      division: "video",
      title: TITLE,
      description: DESCRIPTION,
      ogTitle: "Alege canalul. Toate ajung la aceeași echipă.",
    }),
  };
}

/**
 * /video/contact (FAZA 3).
 *
 * Signature: „panoul de regie” — canalele ca linii de patch, fiecare cu
 * cod, latență reală și motivul pentru care ai alege-o. Vocea stă
 * prima și e la fel de mare ca formularul (CLAUDE.md §8), pentru că
 * omul care cumpără video sună; nu completează.
 *
 * Deep link: /video/contact?tip=imobiliare preselectează tipul de
 * proiect — link-ul vine din portofoliu, iar vizitatorul își regăsește
 * vocabularul cu care a intrat.
 */

// PLACEHOLDER — de confirmat cu omul înainte de lansare (CLAUDE.md §5)
const STUDIO = {
  isPlaceholder: true,
  base: "București",
  coverage:
    "Filmăm în toată țara. Pentru proiectele din afara orașului, deplasarea și cazarea intră în ofertă de la început — nu apar la final ca surpriză.",
  hours: [
    { day: "Luni – vineri", value: "09:00 – 19:00" },
    { day: "Sâmbătă", value: "Doar filmări programate" },
    { day: "Duminică", value: "Închis, dar WhatsApp-ul rămâne pornit" },
  ],
};

function readSegment(value: string | string[] | undefined): VideoSegment | undefined {
  const candidate = Array.isArray(value) ? value[0] : value;
  return VIDEO_SEGMENTS.find((segment) => segment === candidate);
}

export default async function VideoContactPage({
  params,
  searchParams,
}: Readonly<{
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>) {
  const { locale } = await params;
  setRequestLocale(locale);
  const query = await searchParams;
  const segment = readSegment(query.tip);
  const hasCal = Boolean(calHref());

  return (
    <>
      <VideoMotionStyles />
      <VideoLenis />

      <Section spacing="sm" className="pt-28 sm:pt-36">
        <Container>
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-fg/60">
            {/* i18n: (tot copy-ul din pagină) */}
            CONTACT · CANALE DESCHISE
          </p>
          <h1 className="mt-6 max-w-4xl font-display text-5xl tracking-tight sm:text-7xl">
            <WordReveal text="Alege canalul. Toate ajung la aceeași echipă." />
          </h1>
          <p className="mt-6 max-w-2xl text-pretty text-lg text-fg/70">
            Nicio adresă generică pe care n-o citește nimeni. Lângă fiecare
            canal scrie cât durează până răspundem — și ne ținem de asta.
          </p>
        </Container>
      </Section>

      {/* SIGNATURE — panoul de canale, vocea prima */}
      <Section id="canale" spacing="sm">
        <Container>
          <Reveal>
            <VoiceCta context="contact" />
          </Reveal>
          <Reveal delay={100}>
            <ChannelPanel formHref="#formular" className="mt-4" />
          </Reveal>
        </Container>
      </Section>

      <Section id="formular">
        <Container>
          <div className="grid gap-10 lg:grid-cols-[1.15fr_1fr] lg:gap-14">
            <Reveal>
              <ContactForm defaultSegment={segment} />
            </Reveal>
            <Reveal delay={120} className="flex flex-col gap-8">
              <div>
                <p className="font-mono text-[11px] tracking-[0.28em] text-accent-2">
                  CE SE ÎNTÂMPLĂ DUPĂ CE TRIMIȚI
                </p>
                <ol className="mt-5 space-y-4">
                  {[
                    "Te sunăm în maximum 2 ore lucrătoare. Nu îți trimitem întâi un email de confirmare automat, ca să pară că s-a întâmplat ceva.",
                    "Punem trei–patru întrebări la telefon: ce vinzi, cui, și până când ai nevoie de material.",
                    "Primești oferta scrisă în 48 de ore: livrabile, termene și preț fix. Dacă proiectul nu e pentru noi, îți spunem asta în loc să-ți trimitem un preț umflat.",
                  ].map((step, index) => (
                    <li key={step} className="flex gap-4 text-fg/80">
                      <span
                        aria-hidden="true"
                        className="mt-1 font-mono text-xs tracking-[0.2em] text-accent"
                      >
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span className="text-pretty">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>

              <div className="rounded-md border border-line bg-surface/50 p-6">
                <div className="flex items-start justify-between gap-4">
                  <p className="font-mono text-[11px] tracking-[0.28em] text-fg/60">
                    BAZĂ ȘI PROGRAM
                  </p>
                  {STUDIO.isPlaceholder ? (
                    <span className="rounded-xs border border-accent-2/40 px-2 py-0.5 font-mono text-[10px] tracking-[0.2em] text-accent-2">
                      PLACEHOLDER
                    </span>
                  ) : null}
                </div>
                <p className="mt-4 font-display text-2xl tracking-tight">
                  {STUDIO.base}
                </p>
                <p className="mt-2 text-pretty text-sm text-fg/70">
                  {STUDIO.coverage}
                </p>
                <dl className="mt-5 divide-y divide-line border-t border-line">
                  {STUDIO.hours.map((row) => (
                    <div
                      key={row.day}
                      className="flex flex-wrap justify-between gap-2 py-2.5"
                    >
                      <dt className="text-sm text-fg/70">{row.day}</dt>
                      <dd className="font-mono text-xs tracking-wider text-fg/80">
                        {row.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            </Reveal>
          </div>
        </Container>
      </Section>

      {hasCal ? (
        <Section id="programare">
          <Container size="narrow">
            <Reveal>
              <SectionSlate
                code="CH.04 · PROGRAMARE"
                title="Douăzeci de minute, în calendarul tău."
                lead="Dacă preferi să vorbim la o oră stabilită, alege un interval liber. Venim pregătiți: până atunci ne uităm la site-ul și la paginile tale."
              />
            </Reveal>
            <Reveal delay={100} className="mt-10">
              <CalEmbed />
            </Reveal>
          </Container>
        </Section>
      ) : null}

      <CtaBand
        slate="ÎNCĂ TE GÂNDEȘTI?"
        title="Uită-te întâi la ce am filmat."
        lead="E cea mai rapidă cale să-ți dai seama dacă vorbim aceeași limbă vizuală. Dacă da, butonul de mai sus e tot acolo."
        cta={{ label: "Vezi portofoliul", href: "/video/portofoliu" }}
        secondary={{ label: "sau cum arată procesul", href: "/video/proces" }}
      />
    </>
  );
}
