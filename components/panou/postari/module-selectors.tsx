"use client";

import { usePathname } from "next/navigation";
import { SoftSelect } from "../ui/select";
import { useQueryParams } from "../ui/use-query-params";

/**
 * Selectorul modulului Postări din bara de sus (ModuleSelectors din prototip):
 * platforma. Filtrează Coada (lista, calendarul, statisticile); pe celelalte
 * ecrane nu are ce filtra, așa că stă stins în loc să promită ceva ce nu face.
 */
export function PostariSelectors({ className }: { className?: string }) {
  const pathname = usePathname();
  const { get, setMany } = useQueryParams();
  const active = pathname === "/admin/postari";

  return (
    <div className={"flex items-center gap-2 " + (className ?? "")} title={active ? undefined : "Filtrul de platformă lucrează în Coadă."}>
      <SoftSelect
        ariaLabel="Platformă"
        value={active ? get("platforma", "toate") : "toate"}
        disabled={!active}
        onChange={(value) => setMany({ platforma: value === "toate" ? "" : value })}
        className="w-[122px]"
        options={[
          { value: "toate", label: "Ambele" },
          { value: "instagram", label: "Instagram" },
          { value: "tiktok", label: "TikTok" },
        ]}
      />
    </div>
  );
}
