"use client";

import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import { useVaultData, type VaultData } from "../_components/use-vault-data";

/**
 * Datele seifului deblocat, încărcate O SINGURĂ DATĂ și date tuturor ecranelor
 * (Intrări, Import, Export, Membri, Contul meu). Providerul stă doar cât seiful e
 * deblocat: la blocare se demontează și snapshot-ul decriptat dispare din memorie.
 * Nicio rută nu mai reîncarcă și nu mai decriptează de la zero la navigare.
 */

const DataContext = createContext<VaultData | null>(null);

export function VaultDataProvider({ children, onPending }: { children: ReactNode; onPending: (count: number) => void }) {
  const data = useVaultData();
  const { snapshot, members, meta, error, loading, reload } = data;

  // Cererile în așteptare apar ca număr pe „Vault” în meniu, ca fondatorul să le vadă fără să deschidă Membri.
  const pending = members ? members.filter((row) => !row.wrappedDek).length : 0;
  useEffect(() => {
    onPending(pending);
    return () => onPending(0);
  }, [pending, onPending]);

  const value = useMemo<VaultData>(() => ({ snapshot, members, meta, error, loading, reload }), [snapshot, members, meta, error, loading, reload]);
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useVaultDataContext(): VaultData {
  const value = useContext(DataContext);
  if (!value) throw new Error("useVaultDataContext() se apelează doar în interiorul seifului deblocat.");
  return value;
}
