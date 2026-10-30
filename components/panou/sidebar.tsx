"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Search } from "lucide-react";
import { Mark } from "@/components/site/mark";
import { cn } from "@/lib/utils";
import { PANOU_MODULES, activeModule, isSubItemActive } from "./nav";
import { openCommandPalette } from "./command-palette";

/**
 * Meniul din stânga (de la 1024 px): cele cinci module, apoi subpaginile
 * modulului activ, jos căutarea (Ctrl+K), contul și ieșirea. Același meniu în
 * toate modulele: de aici se trece oriunde, fără ocolișuri.
 */
export function PanouSidebar({
  email,
  googleTools,
  signOut,
}: {
  email: string | null;
  googleTools: boolean;
  signOut: () => Promise<void>;
}) {
  const pathname = usePathname();
  const active = activeModule(pathname);
  const items = active.items(googleTools);

  return (
    <aside className="sticky top-0 hidden h-dvh flex-col border-r border-hair bg-[var(--ap-side)] lg:flex">
      <Link href="/admin" className="flex items-center gap-3 px-5 pb-6 pt-6 text-bone">
        <span className="grid h-9 w-9 place-items-center rounded-[11px] border border-[color-mix(in_srgb,var(--md-a1)_25%,transparent)] bg-[var(--ap-accent-soft)] text-[var(--md-a1)]">
          <Mark size={18} />
        </span>
        <span className="min-w-0">
          <span className="block font-md-display text-[19px] leading-none tracking-[0.16em]">MERIDIAN</span>
          <span className="mt-1 block text-[9.5px] uppercase tracking-[0.24em] text-dim">panou intern</span>
        </span>
      </Link>

      <nav aria-label="Module" className="space-y-1 px-3">
        {PANOU_MODULES.map((module) => {
          const isActive = module.id === active.id;
          return (
            <Link
              key={module.id}
              href={module.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-medium transition-colors",
                isActive ? "bg-white/[0.07] text-bone" : "text-bone/60 hover:bg-white/[0.04] hover:text-bone"
              )}
            >
              <module.icon
                className={cn("h-[17px] w-[17px] shrink-0", isActive ? "text-[var(--md-a1)]" : "text-bone/45 group-hover:text-bone/70")}
                aria-hidden="true"
              />
              <span className="truncate">{module.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-5 flex min-h-0 flex-1 flex-col">
        {items.length > 1 ? (
          <>
            <p className="px-5 pb-2 text-[10px] uppercase tracking-[0.18em] text-dim/80">{active.label}</p>
            <nav aria-label={`Subpagini ${active.label}`} className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-3 pb-4">
              {items.map((item) => {
                const itemActive = isSubItemActive(item, pathname);
                return (
                  <Link
                    key={item.key}
                    href={item.href}
                    aria-current={itemActive ? "page" : undefined}
                    className={cn(
                      "group flex items-center gap-2 rounded-lg py-2 pl-3 pr-2 text-[12.5px] transition-colors",
                      itemActive ? "bg-white/[0.05] text-bone" : "text-bone/50 hover:text-bone"
                    )}
                  >
                    <span
                      className={cn("h-1 w-1 shrink-0 rounded-full transition-colors", itemActive ? "bg-[var(--md-a1)]" : "bg-white/15 group-hover:bg-white/40")}
                      aria-hidden="true"
                    />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </>
        ) : null}
      </div>

      <div className="border-t border-hair px-3 py-3">
        <button
          type="button"
          onClick={openCommandPalette}
          className="mb-2 flex w-full items-center gap-2.5 rounded-lg border border-hair px-3 py-2 text-left text-[12.5px] text-dim transition-colors hover:border-hair-strong hover:text-bone"
        >
          <Search className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Caută un ecran</span>
          <kbd className="ml-auto rounded border border-hair-strong px-1.5 py-0.5 font-md-mono text-[10px]">Ctrl K</kbd>
        </button>
        <div className="flex items-center gap-2.5 px-1.5 py-1.5">
          <div className="min-w-0 flex-1">
            <p className="truncate font-md-mono text-[11px] text-dim">{email ?? "fără email"}</p>
          </div>
          <form action={signOut}>
            <button
              type="submit"
              className="rounded-md p-1.5 text-dim transition-colors hover:bg-white/[0.07] hover:text-bone"
              aria-label="Ieși din cont"
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
