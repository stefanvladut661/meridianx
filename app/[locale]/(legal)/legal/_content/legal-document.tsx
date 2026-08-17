import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Container } from "@/components/ui/container";
import { MeridianMark } from "@/components/shell/logo";
import { COMPANY_PLACEHOLDER, type LegalDocument } from "./documents";

/**
 * Randarea unui document legal (FAZA 7).
 *
 * Text lung, deci: coloană îngustă, cuprins cu ancore, ierarhie clară.
 * Nota că textul nu e încă validat juridic stă SUS și vizibil — nu
 * într-un subsol pe care nu-l citește nimeni.
 */
export async function LegalDocumentView({
  document,
  title,
  lead,
}: {
  document: LegalDocument;
  title: string;
  lead: string;
}) {
  const t = await getTranslations("legal");
  const formatted = new Date(document.updated).toISOString().slice(0, 10);

  return (
    <Container size="narrow" className="py-12 sm:py-16">
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-sm text-muted transition-colors duration-150 hover:text-fg"
      >
        <MeridianMark />
        <span className="font-display font-semibold tracking-[0.18em]">
          MERIDIAN
        </span>
      </Link>

      <h1 className="mt-10 font-display text-4xl tracking-tight sm:text-5xl">
        {title}
      </h1>
      <p className="mt-4 text-pretty text-lg text-muted">{lead}</p>
      <p className="mt-4 font-mono text-[11px] tracking-[0.18em] text-muted">
        {t("lastUpdated", { date: formatted }).toUpperCase()}
      </p>

      <p className="mt-8 rounded-md border border-accent-2/40 bg-surface p-4 text-sm text-fg">
        <span className="font-mono text-[10px] tracking-[0.18em] text-accent-2">
          NEVALIDAT JURIDIC ·{" "}
        </span>
        {t("draftNotice")}
      </p>

      <section className="mt-10 rounded-md border border-line bg-surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-mono text-[11px] tracking-[0.22em] text-accent">
            {t("identityHeading").toUpperCase()}
          </h2>
          <span className="rounded-xs border border-accent-2/40 px-2 py-0.5 font-mono text-[10px] tracking-[0.18em] text-accent-2">
            PLACEHOLDER
          </span>
        </div>
        <dl className="mt-4 grid gap-x-6 gap-y-2 sm:grid-cols-2">
          {[
            ["Denumire", COMPANY_PLACEHOLDER.name],
            ["CUI", COMPANY_PLACEHOLDER.cui],
            ["Reg. com.", COMPANY_PLACEHOLDER.registry],
            ["Sediu", COMPANY_PLACEHOLDER.address],
            ["Email", COMPANY_PLACEHOLDER.email],
          ].map(([label, value]) => (
            <div key={label} className="flex gap-3">
              <dt className="w-24 shrink-0 font-mono text-[11px] tracking-[0.16em] text-muted">
                {label}
              </dt>
              <dd className="text-sm text-fg">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-xs text-muted">{t("identityPlaceholder")}</p>
      </section>

      <nav aria-label={t("contents")} className="mt-12">
        <h2 className="font-mono text-[11px] tracking-[0.22em] text-muted">
          {t("contents").toUpperCase()}
        </h2>
        <ol className="mt-4 space-y-1.5">
          {document.sections.map((section, index) => (
            <li key={section.id} className="flex gap-3">
              <span
                aria-hidden="true"
                className="font-mono text-[11px] text-muted"
              >
                {String(index + 1).padStart(2, "0")}
              </span>
              <a
                href={`#${section.id}`}
                className="text-sm text-fg underline-offset-4 transition-colors duration-150 hover:text-accent hover:underline"
              >
                {section.heading}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="mt-14 space-y-12">
        {document.sections.map((section, index) => (
          <section key={section.id} id={section.id} className="scroll-mt-8">
            <h2 className="font-display text-2xl tracking-tight">
              <span className="mr-3 font-mono text-sm text-muted">
                {String(index + 1).padStart(2, "0")}
              </span>
              {section.heading}
            </h2>

            {section.paragraphs?.map((paragraph) => (
              <p key={paragraph} className="mt-4 text-pretty text-fg/85">
                {paragraph}
              </p>
            ))}

            {section.list ? (
              <ul className="mt-5 space-y-2.5">
                {section.list.map((item) => (
                  <li key={item} className="flex gap-3 text-pretty text-fg/85">
                    <span aria-hidden="true" className="mt-2 size-1 shrink-0 rounded-full bg-accent" />
                    {item}
                  </li>
                ))}
              </ul>
            ) : null}

            {section.table ? (
              <div className="mt-5 overflow-x-auto rounded-md border border-line">
                <table className="w-full min-w-[34rem] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-line bg-surface">
                      {section.table.head.map((cell) => (
                        <th
                          key={cell}
                          scope="col"
                          className="px-4 py-3 font-mono text-[11px] font-normal tracking-[0.16em] text-accent"
                        >
                          {cell.toUpperCase()}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {section.table.rows.map((row) => (
                      <tr key={row.join("|")} className="border-b border-line last:border-0">
                        {row.map((cell, cellIndex) => (
                          <td
                            key={cell}
                            className={
                              cellIndex === 0
                                ? "px-4 py-3 align-top font-mono text-xs text-fg"
                                : "px-4 py-3 align-top text-fg/85"
                            }
                          >
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </section>
        ))}
      </div>
    </Container>
  );
}
