"use client";

import { useVaultDataContext } from "../_panou/data";
import { ExportView } from "../_panou/export-view";

/** /vault/export — doar criptat, cu parolă de export separată de cea master. */
export default function VaultExportRoute() {
  const { snapshot, error, reload } = useVaultDataContext();
  return <ExportView snapshot={snapshot} error={error} reload={reload} />;
}
