import Link from "next/link";
import type { ReactNode } from "react";
import { PLATFORM_LABEL } from "@/lib/ads/constants";
import type { WorkspaceSummary } from "@/lib/ads/workspaces";
import { chooseWorkspace } from "@/app/(admin)/admin/ads/actions";
import { Btn, Card, Pill } from "@/components/panou/ui/primitives";
import { inputClass } from "@/components/panou/ui/states";
import { cn } from "@/lib/utils";

/**
 * Cadrul ecranului „Căutări” (SearchPage din redesign): titlul, filele și
 * alegerea contului. În prototip, filele sunt secțiuni ale aceluiași ecran;
 * aici fiecare filă e o rută reală (citirea din Google e grea și nu se
 * face pe patru file deodată), cu același aspect de SegmentedControl.
 * Fișier fără stare: merge în pagini de server.
 */

export type CautariTab = "campanii" | "termeni" | "cont" | "conversii";

const TABS: Array<{ value: CautariTab; label: string; href: string }> = [
  { value: "campanii", label: "Campanii de căutare", href: "/admin/ads/cautare" },
  { value: "termeni", label: "Termeni", href: "/admin/ads/termeni" },
  { value: "cont", label: "Cont Google", href: "/admin/ads/cont" },
  { value: "conversii", label: "Conversii", href: "/admin/ads/conversii" },
];

/** „1234567890” → „123-456-7890”. */
export function formatCustomerId(id: string): string {
  return id.replace(/(\d{3})(\d{3})(\d{4})/, "$1-$2-$3");
}

/** Spațiile Google (Meridian / Clienți): aici se alege tokenul în care lucrează toate filele. */
function WorkspaceSwitch({ workspaces, currentId }: { workspaces: WorkspaceSummary[]; currentId: string }) {
  const google = workspaces.filter((workspace) => workspace.platform === "google");
  if (google.length < 2) return null;
  return (
    <form action={chooseWorkspace} aria-label="Spațiul de lucru Google" className="flex items-center gap-2">
      <span className="text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">Spațiu</span>
      <div role="group" aria-label="Spațiul Google" className="inline-flex items-center gap-1 rounded-full border border-white/[0.07] bg-white/[0.03] p-1">
        {google.map((workspace) => {
          const active = workspace.id === currentId;
          return (
            <button
              key={workspace.id}
              type="submit"
              name="workspace"
              value={workspace.id}
              aria-pressed={active}
              title={workspace.tokenConfigured ? undefined : `Fără cheie: setează ${workspace.tokenEnv} în Vercel`}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-medium transition-colors",
                active ? "bg-white/[0.11] text-foreground shadow-[0_1px_0_rgba(255,255,255,0.07)_inset]" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <span className={cn("h-1.5 w-1.5 rounded-full", workspace.tokenConfigured ? "bg-mint" : "bg-white/25")} aria-hidden="true" />
              {workspace.label}
              <span className="sr-only"> · {PLATFORM_LABEL[workspace.platform]}{workspace.tokenConfigured ? "" : ", fără cheie"}</span>
            </button>
          );
        })}
      </div>
    </form>
  );
}

export function CautariHeader({
  active,
  cont,
  workspaces,
  currentWorkspaceId,
}: {
  active: CautariTab;
  /** Contul Google ales, ca să rămână ales când treci de pe o filă pe alta. */
  cont?: string | null;
  workspaces: WorkspaceSummary[];
  currentWorkspaceId: string;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold leading-none sm:text-[26px]">Căutări</h1>
          <p className="mt-2 max-w-2xl text-[12.5px] text-muted-foreground">
            Doar Google. Planuri de căutare, termenii reali, auditul unui cont existent și acțiunile de conversie.
          </p>
        </div>
        <WorkspaceSwitch workspaces={workspaces} currentId={currentWorkspaceId} />
      </div>
      <nav
        aria-label="Secțiunea Căutări"
        className="pu-no-scrollbar inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-full border border-white/[0.07] bg-white/[0.03] p-1"
      >
        {TABS.map((tab) => {
          const isActive = tab.value === active;
          const href = cont && tab.value !== "campanii" ? `${tab.href}?cont=${cont}` : tab.href;
          return (
            <Link
              key={tab.value}
              href={href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-[12.5px] font-medium transition-colors",
                isActive ? "bg-white/[0.11] text-foreground shadow-[0_1px_0_rgba(255,255,255,0.07)_inset]" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

/** Alegerea contului Google (formular GET, fără JavaScript): id-ul scris sau ales dintre conturile pe care le vede cheia. */
export function ContPicker({
  action,
  value,
  accounts,
  hidden = {},
}: {
  action: string;
  value: string;
  accounts: Array<{ id: string; name: string; currency: string }>;
  /** Parametrii care se păstrează la schimbarea contului (vederea, perioada). */
  hidden?: Record<string, string>;
}) {
  return (
    <Card className="p-4 sm:p-4">
      <form method="get" action={action} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <label htmlFor="cont-ales" className="text-[11.5px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
            Contul Google Ads
          </label>
          <input
            id="cont-ales"
            name="cont"
            list="conturi"
            defaultValue={value}
            inputMode="numeric"
            autoComplete="off"
            placeholder="123-456-7890"
            className={inputClass("mt-1.5 font-mono text-[12.5px]")}
          />
          <datalist id="conturi">
            {accounts.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} · {item.currency}
              </option>
            ))}
          </datalist>
        </div>
        {Object.entries(hidden).map(([name, hiddenValue]) => (
          <input key={name} type="hidden" name={name} value={hiddenValue} />
        ))}
        <Btn type="submit" variant="primary" size="md" className="shrink-0">
          Deschide contul
        </Btn>
      </form>
    </Card>
  );
}

/** Capul contului ales: numele, id-ul în mono și, la dreapta, ce mai vrei să faci cu el. */
export function ContHeadline({ info, hint, aside, children }: { info: { id: string; name: string; currency: string }; hint?: ReactNode; aside?: ReactNode; children?: ReactNode }) {
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold tracking-[-0.01em]">{info.name}</h2>
          <p className="mt-1 text-[12.5px] text-muted-foreground">{hint}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Pill tone="sky">
            <span className="font-mono text-[11px]">Google Ads {formatCustomerId(info.id)}</span>
          </Pill>
          <Pill tone="neutral">{info.currency}</Pill>
          {aside}
        </div>
      </div>
      {children ? <div className="mt-4">{children}</div> : null}
    </Card>
  );
}
