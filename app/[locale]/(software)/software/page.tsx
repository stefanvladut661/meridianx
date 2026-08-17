import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { softwareServices } from "@/content/software/services";
import { softwareProcess } from "@/content/software/process";
import { softwareTestimonials } from "@/content/software/testimonials";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { Reveal } from "@/components/ui/reveal";
import { SoftwareMotionStyles } from "@/components/software/motion-styles";
import { MeridianRail } from "@/components/software/meridian-rail";
import { BlueprintPlate, TitleBlock } from "@/components/software/hero-plate";
import { SectionHead, PlaceholderTag } from "@/components/software/section-head";
import { CtaPanel, softwareCtaClasses } from "@/components/software/cta";

// i18n: metadata hardcodată RO — F7 localizează
export const metadata: Metadata = {
  title: "Software la comandă pentru firme din România",
  description:
    "Aplicații web și mobile la comandă, magazine online, automatizări și integrări AI. Specificație aprobată înainte de dezvoltare, preț fix pe etape, cod sursă predat integral.",
};

/**
 * /software — home (FAZA 4).
 *
 * Signature: planșa de desen tehnic cu CARTUȘ — parametrii comerciali
 * după care clientul decide, puși în hero, nu ascunși la pagina 3.
 *
 * Publicul de aici decide lent și compară. Fiecare secțiune scoate un risc
 * din calea lui: ce scrie în contract, ce construim, pentru cine, ce să ne
 * întrebe înainte să semneze, cum lucrăm, ce facem dacă ai finanțare.
 */

const RAIL_SECTIONS = [
  { id: "contract", label: "Contract" },
  { id: "constructii", label: "Ce construim" },
  { id: "pentru-cine", label: "Pentru cine" },
  { id: "verificare", label: "Verificare" },
  { id: "cum-lucram", label: "Cum lucrăm" },
  { id: "fonduri", label: "Fonduri" },
  { id: "brief", label: "Brief" },
];

/** Parametrii din cartuș. Angajamente reale, nu date de umplutură. */
const TITLE_BLOCK_ROWS = [
  {
    label: "Interval proiecte",
    value: "5.000 – 60.000 €, în funcție de obiect",
  },
  { label: "Livrare", value: "3 – 20 săptămâni de la semnare" },
  { label: "Preț", value: "Fix pe etape, stabilit înainte de start" },
  { label: "Cod sursă", value: "În repository-ul tău, din prima zi" },
  { label: "Garanție", value: "12 luni, scrisă în contract" },
];

/** Cele trei clauze care scot riscul din decizie. Sunt clauze reale. */
const CONTRACT_CLAUSES = [
  {
    article: "Art. 1",
    title: "Specificația se aprobă înainte de dezvoltare",
    body: "Primești un document pe capitole, în limbaj de om, cu ce construim și ce NU construim. Îl semnezi tu. Ce nu e acolo nu apare pe factură.",
  },
  {
    article: "Art. 2",
    title: "Codul e al tău din prima zi",
    body: "Lucrăm în repository-ul tău, nu în al nostru. La recepție primești și accesele la găzduire, domeniu și servicii externe. Poți continua cu oricine.",
  },
  {
    article: "Art. 3",
    title: "Termenul are penalități, nu intenții",
    body: "Datele de livrare intră în contract cu consecințe. Dacă termenul tău nu e realist, îți spunem la ofertă și restrângem obiectul — nu semnăm ca să vedem pe parcurs.",
  },
];

const AUDIENCES = [
  {
    id: "imm",
    code: "A",
    title: "IMM-uri care se modernizează",
    situation:
      "Firma merge pe fișiere de calcul, email și memoria a doi oameni. Funcționează, dar nu mai scalează și nu poate fi predată nimănui.",
    weDo: "Începem cu fluxul care doare cel mai tare, nu cu tot deodată. Prima versiune intră în producție în câteva luni, nu într-un an.",
  },
  {
    id: "fonduri",
    code: "B",
    title: "Firme cu fonduri de modernizare",
    situation:
      "Ai buget alocat, un termen de decontare și nevoie de documente în forma cerută de finanțator. Nu îți permiți un furnizor care întârzie.",
    weDo: "Ofertă defalcată pe capitole de cheltuieli, livrare pe etape cu procese-verbale și un calendar citit invers, de la termenul tău.",
    href: "/software/fonduri",
    hrefLabel: "Pagina dedicată finanțărilor",
  },
  {
    id: "corporate",
    code: "C",
    title: "Corporate cu sisteme interne",
    situation:
      "Ai deja ERP și IT propriu, dar între sisteme rămân goluri pe care le acoperă oameni cu copy-paste.",
    weDo: "Construim piesa care lipsește și o integrăm cu ce ai. Lucrăm cu echipa ta de IT, respectăm procedurile ei de securitate și predăm documentat.",
  },
];

/** Întrebările de calificare a oricărui furnizor de software. */
const VETTING = [
  {
    question: "Îmi arătați specificația înainte să plătesc ceva?",
    answer:
      "Da. Iese din descoperire și o citești înainte de contract. Dacă un furnizor nu poate scrie ce construiește, nu știe încă ce construiește.",
  },
  {
    question: "În al cui repository stă codul în timpul dezvoltării?",
    answer:
      "În al tău, de la primul commit. „Vi-l predăm la final” e felul politicos de a spune că până atunci nu ai nimic.",
  },
  {
    question: "Cine lucrează efectiv și pot să vorbesc cu el?",
    answer:
      "Aceiași oameni de la descoperire. Întreabă asta oriunde mergi — răspunsul separă echipele de intermediari.",
  },
  {
    question: "Ce se întâmplă cu prețul dacă apare ceva neprevăzut?",
    answer:
      "Primești o estimare separată și o aprobi înainte să lucrăm. Un „vedem pe parcurs” la ofertă devine o discuție neplăcută la factură.",
  },
];

export default async function SoftwareHomePage({
  params,
}: Readonly<{ params: Promise<{ locale: string }> }>) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [flagship, ...rest] = softwareServices;

  return (
    <>
      <SoftwareMotionStyles />
      <MeridianRail sections={RAIL_SECTIONS} />

      {/* ---------- HERO: planșa de desen tehnic ---------- */}
      <section className="relative isolate overflow-hidden border-b border-line">
        <BlueprintPlate className="pointer-events-none absolute inset-0 -z-10 opacity-70" />

        <Container className="py-16 sm:py-24 lg:py-28">
          <div className="grid gap-12 lg:grid-cols-[1.35fr_1fr] lg:items-end lg:gap-16">
            <div>
              <p className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] uppercase tracking-[0.24em] text-accent-2">
                <span aria-hidden="true" className="h-px w-6 bg-accent-2/60" />
                {/* i18n: */}
                Divizia software
                <span aria-hidden="true" className="text-muted">
                  ·
                </span>
                <span className="text-muted">Web și aplicații la comandă</span>
              </p>

              <h1 className="mt-6 text-balance font-display text-4xl font-semibold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
                {/* i18n: */}
                Construim software care intră în producție și rămâne al tău.
              </h1>

              <p className="mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-fg/75">
                {/* i18n: */}
                Aplicații la comandă, magazine online și automatizări pentru
                firme din România care se modernizează. Specificația se aprobă
                înainte de prima linie de cod, prețul e fix pe etape, iar codul
                stă în repository-ul tău din prima zi.
              </p>

              <div className="mt-9 flex flex-wrap items-center gap-3">
                <Link
                  href="/software/brief"
                  className={softwareCtaClasses({ size: "lg" })}
                >
                  {/* i18n: */}
                  Cere ofertă
                </Link>
                <Link
                  href="/software/proces"
                  className={softwareCtaClasses({
                    variant: "secondary",
                    size: "lg",
                  })}
                >
                  {/* i18n: */}
                  Vezi cum lucrăm
                </Link>
              </div>
            </div>

            {/* cartușul planșei */}
            <Reveal duration={320} distance={12}>
              <TitleBlock
                rows={TITLE_BLOCK_ROWS}
                // i18n:
                caption="Intervalele sunt orientative și se fixează la ofertă. Nu publicăm prețuri pe servicii, pentru că un proiect se estimează după obiect, nu după listă."
              />
            </Reveal>
          </div>
        </Container>
      </section>

      {/* ---------- CE SCRIE ÎN CONTRACT ---------- */}
      <Section id="contract" spacing="md">
        <Container>
          <SectionHead
            // i18n:
            code="Propunerea de valoare"
            title="Trei lucruri pe care le scriem în contract, nu pe site."
            lead="Un site poate promite orice. Astea trei sunt clauze pe care le semnăm și după care poți să ne ții."
          />

          <ol className="mt-12 border-t border-line">
            {CONTRACT_CLAUSES.map((clause, index) => (
              <li key={clause.article}>
                <Reveal duration={320} delay={index * 70}>
                  <div className="grid gap-3 border-b border-line py-8 lg:grid-cols-[7rem_1fr_1.2fr] lg:gap-10">
                    <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent">
                      {clause.article}
                    </p>
                    <h3 className="text-balance font-display text-xl font-semibold tracking-tight sm:text-2xl">
                      {clause.title}
                    </h3>
                    <p className="text-pretty leading-relaxed text-fg/75">
                      {clause.body}
                    </p>
                  </div>
                </Reveal>
              </li>
            ))}
          </ol>
        </Container>
      </Section>

      {/* ---------- CE CONSTRUIM ---------- */}
      <Section id="constructii" spacing="md" className="border-t border-line">
        <Container>
          <SectionHead
            // i18n:
            code="Ce construim"
            title="Opt servicii. Unul e motorul, restul îl susțin."
            lead="Ordinea de mai jos nu e alfabetică. Aplicațiile la comandă sunt partea unde se schimbă cu adevărat cum funcționează o firmă — și partea în care ne pricepem cel mai bine."
          />

          {/* motorul — rând promovat, structura codifică prioritatea */}
          {flagship ? (
            <Reveal duration={320} className="mt-12">
              <Link
                href={`/software/servicii#${flagship.id}`}
                className="group block rounded-lg border border-line bg-surface p-6 transition-colors duration-150 hover:border-accent/60 sm:p-10"
              >
                <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr] lg:gap-12">
                  <div>
                    <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent">
                      {/* i18n: */}
                      Serviciul principal
                    </p>
                    <h3 className="mt-3 text-balance font-display text-2xl font-semibold tracking-tight sm:text-4xl">
                      {flagship.title}
                    </h3>
                    <p className="mt-4 max-w-xl text-pretty text-lg text-fg/80">
                      {flagship.promise}
                    </p>
                    <p className="mt-6 inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-accent">
                      {/* i18n: */}
                      Vezi fișa completă
                      <span
                        aria-hidden="true"
                        className="transition-transform duration-150 group-hover:translate-x-1"
                      >
                        →
                      </span>
                    </p>
                  </div>
                  <dl className="grid gap-4 self-start border-t border-line pt-6 sm:grid-cols-2 lg:border-l lg:border-t-0 lg:pl-10 lg:pt-0">
                    <div>
                      <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
                        {/* i18n: */}
                        Durată
                      </dt>
                      <dd className="mt-1.5 text-sm text-fg">
                        {flagship.duration}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
                        {/* i18n: */}
                        Pentru cine
                      </dt>
                      <dd className="mt-1.5 text-sm text-fg/80">
                        {flagship.audience}
                      </dd>
                    </div>
                  </dl>
                </div>
              </Link>
            </Reveal>
          ) : null}

          {/* restul — index dens, nu carduri */}
          <ul className="mt-10 grid border-t border-line md:grid-cols-2">
            {rest.map((service, index) => (
              <li
                key={service.id}
                className="border-b border-line md:odd:border-r md:odd:pr-8 md:even:pl-8"
              >
                <Reveal duration={280} delay={Math.min(index, 4) * 50}>
                  <Link
                    href={`/software/servicii#${service.id}`}
                    className="group flex h-full flex-col gap-2 py-6 transition-colors duration-150"
                  >
                    <p className="flex items-baseline gap-3">
                      <span className="font-mono text-[11px] tabular-nums tracking-[0.18em] text-muted">
                        {String(index + 2).padStart(2, "0")}
                      </span>
                      <span className="font-display text-lg font-semibold tracking-tight transition-colors duration-150 group-hover:text-accent">
                        {service.title}
                      </span>
                    </p>
                    <p className="text-pretty text-sm leading-relaxed text-fg/70">
                      {service.promise}
                    </p>
                    <p className="mt-auto pt-3 font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
                      {service.duration}
                    </p>
                  </Link>
                </Reveal>
              </li>
            ))}
          </ul>
        </Container>
      </Section>

      {/* ---------- PENTRU CINE ---------- */}
      <Section id="pentru-cine" spacing="md" className="border-t border-line">
        <Container>
          <SectionHead
            // i18n:
            code="Pentru cine"
            title="Trei situații în care se sună o agenție de software."
            lead="Dacă nu te regăsești în niciuna, spune-ne oricum situația ta — jumătate din proiectele bune încep cu o descriere care nu încape într-o categorie."
          />

          <div className="mt-12 grid gap-px overflow-hidden rounded-lg border border-line bg-line lg:grid-cols-3">
            {AUDIENCES.map((audience, index) => (
              <div key={audience.id} className="bg-bg p-6 sm:p-8">
                <Reveal duration={300} delay={index * 70}>
                  <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent">
                    {/* i18n: */}
                    Profil {audience.code}
                  </p>
                  <h3 className="mt-3 text-balance font-display text-xl font-semibold tracking-tight">
                    {audience.title}
                  </h3>
                  <p className="mt-4 text-sm leading-relaxed text-fg/70">
                    {audience.situation}
                  </p>
                  <p className="mt-4 border-t border-line pt-4 text-sm leading-relaxed text-fg">
                    <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent-2">
                      {/* i18n: */}
                      Ce facem:{" "}
                    </span>
                    {audience.weDo}
                  </p>
                  {audience.href ? (
                    <Link
                      href={audience.href}
                      className="mt-5 inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-accent hover:underline"
                    >
                      {audience.hrefLabel}
                      <span aria-hidden="true">→</span>
                    </Link>
                  ) : null}
                </Reveal>
              </div>
            ))}
          </div>
        </Container>
      </Section>

      {/* ---------- CUM NE VERIFICI ---------- */}
      <Section id="verificare" spacing="md" className="border-t border-line">
        <Container>
          <SectionHead
            // i18n:
            code="Semnale de încredere"
            title="Întrebările pe care să ni le pui. Și oricui altcuiva."
            lead="Nu avem logo-uri de clienți de pus aici și nu împrumutăm încrederea nimănui. În schimb, îți dăm grila după care se verifică orice furnizor de software — inclusiv noi."
          />

          <dl className="mt-12 grid gap-x-12 gap-y-8 sm:grid-cols-2">
            {VETTING.map((item, index) => (
              <div key={item.question} className="border-t border-line pt-5">
                <Reveal duration={300} delay={Math.min(index, 3) * 60}>
                  <dt className="text-pretty font-display text-lg font-semibold tracking-tight">
                    „{item.question}”
                  </dt>
                  <dd className="mt-3 text-sm leading-relaxed text-fg/70">
                    {item.answer}
                  </dd>
                </Reveal>
              </div>
            ))}
          </dl>

          {/* testimoniale — integral placeholder, marcate vizibil */}
          <div className="mt-16">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">
                {/* i18n: */}
                Ce spun clienții
              </p>
              <PlaceholderTag />
            </div>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted">
              {/* i18n: */}
              Citatele de mai jos sunt exemple de structură, nu declarații
              reale. Le înlocuim cu testimoniale semnate, cu acord scris, pe
              măsură ce proiectele se închid.
            </p>
            <ul className="mt-8 grid gap-6 lg:grid-cols-3">
              {softwareTestimonials.map((testimonial, index) => (
                <li key={testimonial.id}>
                  <Reveal duration={300} delay={index * 60}>
                    <figure className="flex h-full flex-col justify-between rounded-md border border-dashed border-line bg-surface/40 p-6">
                      <blockquote className="text-pretty leading-relaxed text-fg/60">
                        „{testimonial.quote}”
                      </blockquote>
                      <figcaption className="mt-6 border-t border-line pt-4 font-mono text-[11px] uppercase leading-relaxed tracking-[0.14em] text-muted">
                        {testimonial.role}
                        <span className="block text-muted">
                          {testimonial.company}
                        </span>
                      </figcaption>
                    </figure>
                  </Reveal>
                </li>
              ))}
            </ul>
          </div>
        </Container>
      </Section>

      {/* ---------- CUM LUCRĂM ---------- */}
      <Section id="cum-lucram" spacing="md" className="border-t border-line">
        <Container>
          <div className="flex flex-wrap items-end justify-between gap-6">
            <SectionHead
              // i18n:
              code="Cum lucrăm"
              title="Șase etape. Știi la fiecare ce ți se cere."
              lead="Cea mai frecventă cauză de întârziere nu e tehnică: e o aprobare care stă două săptămâni. De aceea scriem și ce facem noi, și ce faci tu."
            />
            <Link
              href="/software/proces"
              className={softwareCtaClasses({
                variant: "secondary",
                size: "md",
              })}
            >
              {/* i18n: */}
              Procesul în detaliu
            </Link>
          </div>

          <ol className="mt-12 grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
            {softwareProcess.map((step, index) => (
              <li key={step.id} className="bg-bg p-6">
                <Reveal duration={280} delay={Math.min(index, 5) * 45}>
                  <p className="font-mono text-[11px] tabular-nums tracking-[0.2em] text-accent">
                    {String(step.order).padStart(2, "0")}
                  </p>
                  <h3 className="mt-3 font-display text-lg font-semibold tracking-tight">
                    {step.title}
                  </h3>
                  <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
                    {step.duration}
                  </p>
                  <p className="mt-3 text-sm leading-relaxed text-fg/70">
                    {step.description}
                  </p>
                </Reveal>
              </li>
            ))}
          </ol>
        </Container>
      </Section>

      {/* ---------- PUNTE SPRE FONDURI ---------- */}
      <Section id="fonduri" spacing="md" className="border-t border-line">
        <Container>
          <Reveal duration={320}>
            <div className="relative overflow-hidden rounded-lg border border-accent/40 bg-surface p-8 sm:p-12">
              <span
                aria-hidden="true"
                className="absolute inset-y-0 left-0 w-1 bg-accent"
              />
              <div className="grid gap-8 lg:grid-cols-[1.3fr_1fr] lg:items-center lg:gap-12">
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-accent-2">
                    {/* i18n: */}
                    Ai fonduri de modernizare?
                  </p>
                  <p className="mt-4 text-balance font-display text-2xl font-semibold tracking-tight sm:text-4xl">
                    {/* i18n: */}
                    Atunci nu bugetul e problema ta. Termenul de decontare e.
                  </p>
                  <p className="mt-4 max-w-xl text-pretty leading-relaxed text-fg/75">
                    {/* i18n: */}
                    Am scris o pagină separată pentru firmele cu finanțare:
                    calendarul citit invers, de la termenul tău spre ziua în
                    care trebuie să semnăm, ce documente emitem pentru dosar și
                    un test de încadrare care îți spune sincer și când nu e
                    cazul.
                  </p>
                </div>
                <div className="flex flex-col gap-3">
                  <Link
                    href="/software/fonduri"
                    className={softwareCtaClasses({ size: "lg" })}
                  >
                    {/* i18n: */}
                    Vezi pagina pentru finanțări
                  </Link>
                  <p className="font-mono text-[11px] leading-relaxed tracking-wide text-muted">
                    {/* i18n: */}
                    Nu scriem dosarul de finanțare. Livrăm software-ul și
                    documentele cu care se decontează.
                  </p>
                </div>
              </div>
            </div>
          </Reveal>
        </Container>
      </Section>

      {/* ---------- CTA ---------- */}
      <CtaPanel
        id="brief"
        // i18n:
        code="Pasul următor"
        title="Descrie proiectul în zece minute. Primești un răspuns, nu un formular de mulțumire."
        lead="Brief-ul te întreabă doar ce ne trebuie ca să știm dacă putem ajuta și cât ar costa aproximativ. Dacă nu suntem potriviți, îți spunem asta și îți zicem cu cine să vorbești."
        primary={{ label: "Completează brief-ul", href: "/software/brief" }}
        secondary={{ label: "Vezi serviciile", href: "/software/servicii" }}
        aside="Răspundem în maximum o zi lucrătoare. Descoperirea inițială e gratuită și fără angajament."
      />
    </>
  );
}
