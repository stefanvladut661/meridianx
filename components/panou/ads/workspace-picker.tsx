"use client";

import { useTransition } from "react";
import { PLATFORMS } from "@/lib/ads/constants";
import type { Currency } from "@/lib/ads/constants";
import { formatMoney } from "@/lib/ads/plan-derive";
import type { WorkspaceSummary } from "@/lib/ads/workspaces";
import { cn } from "@/lib/utils";
import { SoftSelect } from "../ui/select";

/**
 * Spațiul de lucru, în ecran (prototip: „Spațiu de lucru” + „Plafon zilnic”).
 * Spațiul = tokenul și plafonul în care se verifică și se creează; nu mai are
 * bară sus, deci ecranele care depind de el îl poartă cu ele. Schimbarea pleacă
 * imediat prin aceeași acțiune ca înainte (`chooseWorkspace`, formData
 * `workspace`, cookie), iar pagina se randează din nou cu spațiul nou.
 *
 * Spune și al cui e: banii clienților (caisă, ca să nu treacă neobservat) sau
 * reclamele agenției, și dacă tokenul e setat pe server.
 */
export function WorkspacePicker({
  workspaces,
  current,
  action,
  disabled = false,
  className,
}: {
  workspaces: WorkspaceSummary[];
  current: WorkspaceSummary;
  /** Fără acțiune, spațiul se arată dar nu se poate schimba. */
  action?: (formData: FormData) => Promise<void>;
  disabled?: boolean;
  className?: string;
}) {
  const [pending, start] = useTransition();
  const ordered = [...workspaces].sort((a, b) => PLATFORMS.indexOf(a.platform) - PLATFORMS.indexOf(b.platform));
  const caps = Object.entries(current.dailyBudgetCap)
    .map(([currency, amount]) => formatMoney(amount, currency as Currency))
    .join(" · ");

  return (
    <div className={className}>
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[190px] flex-1">
          <SoftSelect
            label="Spațiu de lucru"
            value={current.id}
            disabled={disabled || pending || !action}
            onChange={(id) => {
              if (!action) return;
              const formData = new FormData();
              formData.set("workspace", id);
              start(() => action(formData));
            }}
            options={ordered.map((workspace) => ({
              value: workspace.id,
              label: `${workspace.name}${workspace.owner === "clienti" ? " — banii clienților" : ""}${workspace.tokenConfigured ? "" : " (fără token)"}`,
            }))}
          />
        </div>
        <div className="text-right">
          <p className="text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">Plafon zilnic</p>
          <p className="pu-num text-[13px]">{caps || "—"}</p>
        </div>
      </div>
      <p className="mt-2 text-[11.5px] leading-snug text-muted-foreground" aria-live="polite">
        <span className={cn("font-medium", current.owner === "clienti" ? "text-apricot" : "text-foreground/80")}>
          {current.owner === "clienti" ? "Banii clienților" : "Reclamele agenției"}
        </span>
        {" · "}
        {current.tokenConfigured ? "token setat" : "fără token — doar verificare"}
      </p>
    </div>
  );
}
