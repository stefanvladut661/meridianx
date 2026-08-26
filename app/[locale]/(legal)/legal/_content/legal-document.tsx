import { getTranslations } from "next-intl/server";
import { COMPANY_PLACEHOLDER, type LegalDocument } from "./documents";

/**
 * Randarea unui document legal.
 *
 * Text lung, deci: coloană îngustă, cuprins cu ancore, ierarhie clară.
 * Nota că textul nu e încă validat juridic stă SUS și vizibil — nu
 * într-un subsol pe care nu-l citește nimeni.
 *
 * Marca și navigația între documente stau în shell-ul din
 * `(legal)/layout.tsx`; aici rămâne doar documentul.
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
    <article className="mx-auto max-w-3xl px-5 py-14 sm:px-6 sm:py-20">
      <h1 className="display text-[clamp(2rem,5vw,3rem)]">{title}</h1>
      <p className="mt-5 text-pretty text-[17px] leading-relaxed text-dim">
        {lead}
      </p>
      <p className="mt-4 font-md-mono text-[11px] tracking-[0.18em] text-dim">
        {t("lastUpdated", { date: formatted }).toUpperCase()}
      </p>

      <p className="mt-9 rounded-panel border border-a2/40 bg-glass p-4 text-[14.5px] leading-relaxed text-bone">
        <span className="font-md-mono text-[10px] tracking-[0.18em] text-a2">
          NEVALIDAT JURIDIC ·{" "}
        </span>
        {t("draftNotice")}
      </p>

      <section className="mt-10 rounded-panel border border-hair bg-glass p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-md-mono text-[11px] tracking-[0.22em] text-a1">
            {t("identityHeading").toUpperCase()}
          </h2>
          <span className="rounded-[4px] border border-a2/40 px-2 py-0.5 font-md-mono text-[10px] tracking-[0.18em] text-a2">
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
              <dt className="w-24 shrink-0 font-md-mono text-[11px] tracking-[0.16em] text-dim">
                {label}
              </dt>
              <dd className="text-[14px] text-bone">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-[12.5px] leading-relaxed text-dim">
          {t("identityPlaceholder")}
        </p>
      </section>

      <nav aria-label={t("contents")} className="mt-12">
        <h2 className="eyebrow">{t("contents").toUpperCase()}</h2>
        <ol className="mt-4 space-y-1.5">
          {document.sections.map((section, index) => (
            <li key={section.id} className="flex gap-3">
              <span aria-hidden className="font-md-mono text-[11px] text-dim">
                {String(index + 1).padStart(2, "0")}
              </span>
              <a
                href={`#${section.id}`}
                className="text-[14.5px] text-bone underline-offset-4 transition-colors hover:text-a1 hover:underline"
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
            <h2 className="display text-[clamp(1.3rem,3vw,1.7rem)]">
              <span className="mr-3 font-md-mono text-[0.75em] text-dim">
                {String(index + 1).padStart(2, "0")}
              </span>
              {section.heading}
            </h2>

            {section.paragraphs?.map((paragraph) => (
              <p
                key={paragraph}
                className="mt-4 text-pretty text-[15.5px] leading-relaxed text-bone/85"
              >
                {paragraph}
              </p>
            ))}

            {section.list ? (
              <ul className="mt-5 space-y-2.5">
                {section.list.map((item) => (
                  <li
                    key={item}
                    className="flex gap-3 text-pretty text-[15.5px] leading-relaxed text-bone/85"
                  >
                    <span
                      aria-hidden
                      className="mt-2.5 size-1 shrink-0 rounded-full bg-a1"
                    />
                    {item}
                  </li>
                ))}
              </ul>
            ) : null}

            {section.table ? (
              <div className="mt-5 overflow-x-auto rounded-panel border border-hair">
                <table className="w-full min-w-[34rem] border-collapse text-left text-[14px]">
                  <thead>
                    <tr className="border-b border-hair bg-glass">
                      {section.table.head.map((cell) => (
                        <th
                          key={cell}
                          scope="col"
                          className="px-4 py-3 font-md-mono text-[11px] font-normal tracking-[0.16em] text-a1"
                        >
                          {cell.toUpperCase()}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {section.table.rows.map((row) => (
                      <tr
                        key={row.join("|")}
                        className="border-b border-hair last:border-0"
                      >
                        {row.map((cell, cellIndex) => (
                          <td
                            key={cell}
                            className={
                              cellIndex === 0
                                ? "px-4 py-3 align-top font-md-mono text-[12.5px] text-bone"
                                : "px-4 py-3 align-top text-bone/85"
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
    </article>
  );
}
