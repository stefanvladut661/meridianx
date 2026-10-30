"use client";

import { useRouter } from "next/navigation";
import { SegmentedControl } from "@/components/panou/ui/primitives";
import { SoftSelect } from "@/components/panou/ui/select";

/**
 * Filtrele paginii de termeni: perioada (7 sau 30 de zile) și campania. Trăiesc în
 * adresă (`?perioada=30&campanie=…`), ca linkul și Înapoi să păstreze alegerea;
 * pagina de server își recitește termenii la fiecare schimbare.
 */
export function CautariTermeniFiltre({
  base,
  days,
  campaignId,
  campaigns,
}: {
  /** `/admin/ads/termeni?cont=…` — fără perioadă și campanie. */
  base: string;
  days: 7 | 30;
  campaignId: string | null;
  campaigns: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const go = (nextDays: number, nextCampaign: string | null) =>
    router.replace(`${base}&perioada=${nextDays}${nextCampaign ? `&campanie=${nextCampaign}` : ""}`, { scroll: false });

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div>
        <span className="mb-1 block text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">Perioada</span>
        <SegmentedControl
          size="sm"
          ariaLabel="Perioada termenilor"
          value={String(days)}
          onChange={(value) => go(Number(value), campaignId)}
          options={[
            { value: "7", label: "Ultimele 7 zile" },
            { value: "30", label: "Ultimele 30 de zile" },
          ]}
        />
      </div>
      <SoftSelect
        className="w-64 max-w-full"
        label="Campania"
        value={campaignId ?? "all"}
        onChange={(value) => go(days, value === "all" ? null : value)}
        options={[{ value: "all", label: "Toate campaniile" }, ...campaigns.map((item) => ({ value: item.id, label: item.name }))]}
      />
    </div>
  );
}
