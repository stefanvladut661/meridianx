import { Suspense } from "react";
import { EntriesPage } from "./_panou/entries-page";

/**
 * /vault — Intrări. Poarta (încuiat / activare / recuperare) și providerul
 * stau în layout; pagina e doar ecranul intrărilor. Intrarea deschisă și
 * tab-ul Coș stau în adresă (`?intrare=`, `?tab=cos`), deci cer un Suspense.
 */
export default function VaultPage() {
  return (
    <Suspense fallback={null}>
      <EntriesPage />
    </Suspense>
  );
}
