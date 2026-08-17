/**
 * Emiterea de structured data (FAZA 7).
 *
 * Un singur loc care serializează JSON-LD, ca să nu apară `<script>`
 * cu `dangerouslySetInnerHTML` împrăștiat prin pagini.
 *
 * Regula de conținut: nu emitem niciodată date pe care nu le avem.
 * Fără adresă reală nu punem LocalBusiness; fără recenzii reale nu
 * punem AggregateRating. Structured data inventată e minciună citită
 * de mașini — și e și penalizată.
 */
export function JsonLd({
  schema,
}: {
  schema: Record<string, unknown> | Record<string, unknown>[];
}) {
  return (
    <script
      type="application/ld+json"
      // conținutul e construit de noi din `lib/seo.ts`, nu vine de la utilizator
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
