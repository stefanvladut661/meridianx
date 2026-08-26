import type { Metadata } from "next";
import Image from "next/image";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import {
  SOFTWARE_PROJECT_KINDS,
  softwareProjects,
  type SoftwareProjectKind,
} from "@/content/software/projects";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { Reveal } from "@/components/ui/reveal";
import { SoftwareMotionStyles } from "@/components/software/motion-styles";
import { MeridianRail } from "@/components/software/meridian-rail";
import { SectionHead, PlaceholderTag } from "@/components/software/section-head";
import { MetricSlot } from "@/components/software/metric-slot";
import { CtaPanel } from "@/components/software/cta";
import { cn } from "@/lib/utils";

// i18n: metadata hardcodată RO — F7 localizează
export const metadata: Metadata = {
  title: "Proiecte software",
  description:
    "Studii de caz structurate: context, provocare, soluție, rezultat măsurabil. Aplicații la comandă, magazine online, site-uri de prezentare și automatizări.",
};

/**
 * /software/proiecte (FAZA 4).
 *
 * Signature: SLOTURILE DE METRICĂ ÎN AȘTEPTARE. Nu avem încă proiecte
 * publicabile, deci pagina nu se preface că are. Structura studiului de
 * caz e completă și reală — context, provocare, soluție, rezultat — dar
 * cifrele apar ca sloturi rezervate, vizibil goale. Pagina arată ca un
 * instrument încă necalibrat, ceea ce e adevărul (CLAUDE.md §5).
 *
 * Filtrarea se face pe server, prin `?tip=` — deep-link real, funcționează
 * fără JavaScript și fără o singură linie de client bundle.
 */

const RAIL_SECTIONS = [
  { id: "registru", label: "Registru" },
  { id: "structura", label: "Structură" },
  { id: "brief", label: "Brief" },
];

function isKind(value: string | undefined): value is SoftwareProjectKind {
  return SOFTWARE_PROJECT_KINDS.some((kind) => kind.id === value);
}

export default async function SoftwareProjectsPage({
  params,
  searchParams,
}: Readonly<{
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ tip?: string }>;
}>) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { tip } = await searchParams;
  const activeKind = isKind(tip) ? tip : null;

  const projects = activeKind
    ? softwareProjects.filter((project) => project.kind === activeKind)
    : softwareProjects;

  return (
    <>
      <SoftwareMotionStyles />
      <MeridianRail sections={RAIL_SECTIONS} />

      <Section spacing="md" className="border-b border-line">
        <Container>
          <SectionHead
            as="h1"
            // i18n:
            code="Proiecte"
            title="Studii de caz, cu structura completă și cifrele încă goale."
            lead="Suntem o agenție tânără și nu împrumutăm credibilitate din proiectele altcuiva. Mai jos e exact formatul în care publicăm un proiect: contextul, ce nu funcționa, ce am construit și ce s-a schimbat măsurabil. Sloturile de cifre sunt rezervate — se completează la prima publicare, cu acordul clientului."
          />
          <div className="mt-8">
            <PlaceholderTag />
          </div>
        </Container>
      </Section>

      {/* ---------- FILTRU + REGISTRU ---------- */}
      <Section id="registru" spacing="sm">
        <Container>
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4 border-b border-line pb-4">
            <nav aria-label="Filtrează după tip de proiect">
              <ul className="flex flex-wrap items-center gap-2">
                <li>
                  <Link
                    href="/software/proiecte"
                    aria-current={activeKind === null ? "true" : undefined}
                    className={cn(
                      "inline-block rounded-sm border px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.16em] transition-colors duration-150",
                      activeKind === null
                        ? "border-accent bg-s-signal text-s-ink"
                        : "border-line text-fg/70 hover:border-muted hover:text-fg"
                    )}
                  >
                    {/* i18n: */}
                    Toate
                  </Link>
                </li>
                {SOFTWARE_PROJECT_KINDS.map((kind) => {
                  const active = activeKind === kind.id;
                  return (
                    <li key={kind.id}>
                      <Link
                        href={`/software/proiecte?tip=${kind.id}`}
                        aria-current={active ? "true" : undefined}
                        className={cn(
                          "inline-block rounded-sm border px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.16em] transition-colors duration-150",
                          active
                            ? "border-accent bg-s-signal text-s-ink"
                            : "border-line text-fg/70 hover:border-muted hover:text-fg"
                        )}
                      >
                        {kind.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
            <p
              className="font-mono text-[11px] tabular-nums tracking-[0.18em] text-muted"
              aria-live="polite"
            >
              {String(projects.length).padStart(2, "0")}
              {/* i18n: */}
              &nbsp;din&nbsp;
              {String(softwareProjects.length).padStart(2, "0")}
            </p>
          </div>

          <ol className="mt-4">
            {projects.map((project, index) => {
              const kind = SOFTWARE_PROJECT_KINDS.find(
                (entry) => entry.id === project.kind
              );
              return (
                <li
                  key={project.id}
                  id={project.id}
                  className="scroll-mt-24 border-b border-line py-12 first:pt-8"
                >
                  <Reveal duration={320}>
                    {/* antetul înregistrării */}
                    <div className="flex flex-wrap items-baseline gap-x-5 gap-y-2">
                      <p className="font-mono text-[11px] tabular-nums tracking-[0.2em] text-accent">
                        {kind?.code}.{String(index + 1).padStart(2, "0")}
                      </p>
                      <h2 className="flex-1 text-balance font-display text-2xl font-semibold tracking-tight sm:text-3xl">
                        {project.title}
                      </h2>
                      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
                        {project.industry}
                        {project.year ? ` · ${project.year}` : null}
                      </p>
                    </div>

                    <div className="mt-8 grid gap-8 lg:grid-cols-[5fr_7fr] lg:gap-12">
                      <div>
                        <div className="overflow-hidden rounded-md border border-dashed border-line bg-surface">
                          <Image
                            src={project.media.src}
                            alt={project.media.alt}
                            width={1600}
                            height={900}
                            sizes="(min-width: 1024px) 40vw, 100vw"
                            className="h-auto w-full"
                            // Machetele sunt SVG statice, ușoare — fără lazy
                            // pentru primele două, ca să nu sară layout-ul.
                            loading={index < 2 ? "eager" : "lazy"}
                          />
                        </div>
                        <p className="mt-3 font-mono text-[10px] uppercase leading-relaxed tracking-[0.14em] text-muted">
                          {/* i18n: */}
                          Machetă de structură · client:{" "}
                          <span className="text-fg/70">{project.client}</span>
                        </p>
                      </div>

                      {/* narațiunea, pe cele patru axe ale studiului de caz */}
                      <dl className="grid gap-x-10 gap-y-6 sm:grid-cols-2">
                        {[
                          { label: "Context", body: project.context },
                          { label: "Provocare", body: project.challenge },
                          { label: "Soluție", body: project.solution },
                          { label: "Rezultat", body: project.result },
                        ]
                          .filter((entry) => Boolean(entry.body))
                          .map((entry) => (
                            <div
                              key={entry.label}
                              className="border-t border-line pt-4"
                            >
                              <dt className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent-2">
                                {entry.label}
                              </dt>
                              <dd className="mt-2.5 text-sm leading-relaxed text-fg/75">
                                {entry.body}
                              </dd>
                            </div>
                          ))}
                      </dl>
                    </div>

                    {/* sloturile de metrică — instrumentul necalibrat */}
                    {project.metrics && project.metrics.length > 0 ? (
                      <div className="mt-10">
                        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
                          {/* i18n: */}
                          Măsurători
                        </p>
                        <div className="mt-4 grid gap-6 sm:grid-cols-3">
                          {project.metrics.map((metric) => (
                            <MetricSlot
                              key={metric.label}
                              label={metric.label}
                              value={metric.value}
                            />
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </Reveal>
                </li>
              );
            })}
          </ol>

          {projects.length === 0 ? (
            <p className="py-16 text-center text-fg/70">
              {/* i18n: */}
              Nu avem încă un exemplu de structură pentru tipul ăsta.{" "}
              <Link
                href="/software/proiecte"
                className="text-accent underline underline-offset-4"
              >
                Vezi toate proiectele
              </Link>
              .
            </p>
          ) : null}
        </Container>
      </Section>

      {/* ---------- CE PUBLICĂM ȘI CE NU ---------- */}
      <Section id="structura" spacing="md" className="border-t border-line">
        <Container>
          <div className="grid gap-10 lg:grid-cols-[1fr_1.2fr] lg:gap-16">
            <SectionHead
              // i18n:
              code="Politica de publicare"
              title="De ce nu vezi nume de firme aici."
            />
            <div className="space-y-4 text-pretty leading-relaxed text-fg/75">
              <p>
                {/* i18n: */}
                Un studiu de caz apare pe site doar cu acord scris de la
                client, cu cifre pe care le poate confirma și fără date care
                l-ar pune într-o poziție incomodă față de concurență. Până
                atunci, preferăm un slot gol unui procent inventat.
              </p>
              <p>
                {/* i18n: */}
                Dacă vrei referințe înainte să semnezi, ți le dăm pe telefon,
                direct de la clienții care au acceptat să vorbească. E o
                verificare mai serioasă decât un logo pus într-un rând.
              </p>
              <p>
                {/* i18n: */}
                Iar dacă lucrezi cu noi și nu vrei să apari nicăieri, e în
                regulă — publicarea nu e o condiție a colaborării și nu e
                scrisă în contract.
              </p>
            </div>
          </div>
        </Container>
      </Section>

      <CtaPanel
        id="brief"
        // i18n:
        code="Pasul următor"
        title="Proiectul tău poate fi primul de pe pagina asta."
        lead="Descrie ce ai nevoie și de ce acum. Dacă seamănă cu una dintre structurile de mai sus, îți spunem din prima discuție cam cât durează și cam cât costă."
        primary={{ label: "Completează brief-ul", href: "/software/brief" }}
        secondary={{ label: "Vezi serviciile", href: "/software/servicii" }}
        aside="Cerem referințe? Le dăm. Întreabă la primul call și îți punem la dispoziție clienți cu care poți vorbi."
      />
    </>
  );
}
