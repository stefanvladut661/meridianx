"use client";

import { SoftSelect } from "../ui/select";
import { useQueryParams } from "../ui/use-query-params";

/**
 * Filtrele din antetul Statisticilor, ca în prototip. Perioada, clientul și
 * canalul stau în bara de sus; aici e doar moneda graficelor și a tabelului pe
 * zile, fiindcă lei și euro nu se adună. Apare doar când campaniile au mai multe monede.
 */
export function StatsFilters({ currencies, current }: { currencies: string[]; current: string }) {
  const { setMany } = useQueryParams();
  if (currencies.length < 2) return null;
  return (
    <SoftSelect
      label="Monedă"
      ariaLabel="Moneda graficelor și a tabelului pe zile"
      value={current}
      onChange={(value) => setMany({ moneda: value === currencies[0] ? "" : value })}
      options={currencies.map((currency) => ({ value: currency, label: currency }))}
      className="w-[96px]"
    />
  );
}
