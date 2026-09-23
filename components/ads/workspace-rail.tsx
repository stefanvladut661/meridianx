import { PLATFORMS, PLATFORM_LABEL } from "@/lib/ads/constants";
import type { WorkspaceSummary } from "@/lib/ads/workspaces";
import { cn } from "@/lib/utils";

/**
 * Selectorul de spațiu de lucru — mereu sus, mereu vizibil.
 *
 * Nu e un dropdown: sunt patru spații, iar un meniu închis ascunde exact
 * informația de care ai nevoie înainte de orice clic — în ce portofoliu
 * ești. Aici le vezi pe toate, grupate pe platformă; cel curent e plin.
 *
 * Fiecare buton e un submit în același formular (`name="workspace"`), deci
 * merge și fără JavaScript. Punctul de lângă nume spune dacă tokenul
 * spațiului e setat pe server — fără el, spațiul se poate verifica, dar nu
 * se poate crea nimic în el.
 */
export function WorkspaceRail({
  workspaces,
  currentId,
  action,
}: {
  workspaces: WorkspaceSummary[];
  currentId: string;
  action: (formData: FormData) => Promise<void>;
}) {
  const current = workspaces.find((workspace) => workspace.id === currentId) ?? workspaces[0];

  return (
    <form
      action={action}
      aria-label="Spațiul de lucru"
      className="flex flex-wrap items-center gap-x-5 gap-y-3"
    >
      {PLATFORMS.map((platform) => {
        const group = workspaces.filter((workspace) => workspace.platform === platform);
        if (group.length === 0) return null;
        return (
          <div key={platform} role="group" aria-label={PLATFORM_LABEL[platform]} className="flex items-center gap-2">
            <span aria-hidden className="w-[3.25rem] font-md-mono text-[10.5px] uppercase tracking-[0.2em] text-dim">
              {PLATFORM_LABEL[platform]}
            </span>
            <div className="flex rounded-full border border-hair bg-ink/50 p-0.5">
              {group.map((workspace) => {
                const active = workspace.id === current.id;
                return (
                  <button
                    key={workspace.id}
                    type="submit"
                    name="workspace"
                    value={workspace.id}
                    aria-pressed={active}
                    aria-label={`${workspace.name}${workspace.tokenConfigured ? "" : " — token nesetat"}`}
                    className={cn(
                      "flex min-h-9 items-center gap-2 rounded-full px-3.5 text-[13px] font-semibold transition-colors duration-150",
                      active
                        ? workspace.owner === "clienti"
                          ? "bg-[#f0b429] text-[#2a1a00]"
                          : "bg-bone text-ink"
                        : "text-bone/70 hover:bg-glass hover:text-bone"
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "h-1.5 w-1.5 rounded-full",
                        workspace.tokenConfigured
                          ? active
                            ? "bg-current"
                            : "bg-[#1fb583]"
                          : "border border-current opacity-60"
                      )}
                    />
                    {workspace.label}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      <p className="font-md-mono text-[11.5px] leading-snug text-dim" aria-live="polite">
        {current.owner === "clienti" ? (
          <span className="font-semibold text-[#f5c451]">Banii clienților</span>
        ) : (
          <span className="text-bone/80">Reclamele agenției</span>
        )}
        {" · "}
        {current.tokenConfigured ? "token setat" : "fără token — doar verificare"}
      </p>
    </form>
  );
}
