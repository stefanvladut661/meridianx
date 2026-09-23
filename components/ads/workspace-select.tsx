"use client";

import { PLATFORMS, PLATFORM_LABEL } from "@/lib/ads/constants";
import type { WorkspaceSummary } from "@/lib/ads/workspaces";
import { cn } from "@/lib/utils";
import { FIELD } from "./tone";

/**
 * Selectorul de spațiu pe telefon: o listă nativă, pe un singur rând.
 * Cele patru butoane din `WorkspaceRail` ar lua două rânduri din capul
 * lipit al paginii, adică un sfert de ecran la 360px. Schimbarea pleacă
 * imediat (același formular, aceeași acțiune).
 */
export function WorkspaceSelect({
  workspaces,
  current,
}: {
  workspaces: WorkspaceSummary[];
  current: WorkspaceSummary;
}) {
  return (
    <div className="flex items-center gap-3">
      <label htmlFor="spatiu-mobil" className="shrink-0 font-md-mono text-[10.5px] uppercase tracking-[0.18em] text-dim">
        Spațiu
      </label>
      <select
        id="spatiu-mobil"
        name="workspace"
        defaultValue={current.id}
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
        className={cn(
          FIELD,
          "h-10 min-w-0 flex-1 font-semibold",
          current.owner === "clienti" && "!border-[#f0b429]/60 text-[#f5c451]"
        )}
      >
        {PLATFORMS.map((platform) => (
          <optgroup key={platform} label={PLATFORM_LABEL[platform]}>
            {workspaces
              .filter((workspace) => workspace.platform === platform)
              .map((workspace) => (
                <option key={workspace.id} value={workspace.id}>
                  {workspace.name}
                  {workspace.owner === "clienti" ? " — banii clienților" : ""}
                  {workspace.tokenConfigured ? "" : " (fără token)"}
                </option>
              ))}
          </optgroup>
        ))}
      </select>
    </div>
  );
}
