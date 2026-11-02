"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, LogOut, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "../ui/states";
import { PanouMark } from "./mark";
import { activeModule, firmaModule, isItemActive, modules, type PanouModuleId } from "./nav";

/**
 * Contrastul meniului, măsurat pe fundalul lui (#09090C): textul inactiv
 * (foreground/80 = #C3C2C1) are 11,2:1; eticheta modulului (foreground/70 =
 * #ABABAB) 8,7:1; textul alb pe fundalul elementului activ (lav/13 ≈ #221F2C)
 * 16,1:1. Ecranul pe care ești: fundal lav, bară lav în stânga, text alb, semibold.
 */
const ACTIV = "bg-lav/[0.13] font-semibold text-white";
const INACTIV = "text-foreground/80 hover:bg-white/[0.05] hover:text-white";

/** Bara verticală din stânga elementului activ (doar vizuală: starea o spune `aria-current`). */
function BaraActiva() {
  return <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-lav" aria-hidden="true" />;
}

/**
 * Meniul din stânga (de la 1024 px): modulele, apoi subpaginile celui activ, jos
 * Firma și contul. `badges`: câte lead-uri noi, câte postări eșuate.
 */
export function PanouSidebar({
  email,
  badges,
  signOut,
}: {
  email: string | null;
  badges: Partial<Record<PanouModuleId, number>>;
  signOut?: () => Promise<void>;
}) {
  const pathname = usePathname();
  const active = activeModule(pathname);
  const firmaActive = active.id === "firma";

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[266px] flex-col border-r border-white/[0.06] bg-[#09090C] lg:flex">
      <Link href="/admin" className="flex items-center gap-3 px-5 pb-6 pt-6">
        <PanouMark />
        <div className="min-w-0">
          <p className="pu-display text-[19px] leading-none tracking-[0.16em] text-foreground">MERIDIAN</p>
          <p className="mt-1 text-[9.5px] uppercase tracking-[0.24em] text-muted-foreground">panou intern</p>
        </div>
      </Link>

      <nav aria-label="Module" className="space-y-1 px-3">
        {modules.map((module) => {
          const isActive = module.id === active.id;
          const count = badges[module.id] ?? 0;
          return (
            <Link
              key={module.id}
              href={module.to}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] transition-colors",
                isActive ? ACTIV : `font-medium ${INACTIV}`
              )}
            >
              {isActive ? <BaraActiva /> : null}
              <module.icon className={cn("h-[17px] w-[17px] shrink-0", isActive ? "text-lav" : "text-foreground/70 group-hover:text-white")} aria-hidden="true" />
              <span className="truncate">{module.label}</span>
              {count > 0 ? <span className="pu-num ml-auto rounded-full border border-lav/25 bg-lav/12 px-1.5 text-[10.5px] font-medium leading-[18px] text-[#D8CCFF]">{count}</span> : null}
            </Link>
          );
        })}
      </nav>

      <div className="mt-5 flex min-h-0 flex-1 flex-col">
        <div className="flex items-center justify-between px-5 pb-2">
          <p className="text-[10.5px] font-medium uppercase tracking-[0.18em] text-foreground/70">{active.label}</p>
          {active.id === "reclame" ? (
            <Link href="/admin/ads/nou" className="rounded-md p-1 text-foreground/80 transition-colors hover:bg-white/[0.07] hover:text-white" aria-label="Plan nou">
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          ) : null}
        </div>
        <nav aria-label={`Subpagini ${active.label}`} className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-3 pb-4">
          {active.items.map((item) => {
            const isActive = isItemActive(pathname, item, active);
            return (
              <Link
                key={item.to}
                href={item.to}
                aria-current={isActive ? "page" : undefined}
                className={cn("group relative flex items-center gap-2.5 rounded-lg py-2 pl-3 pr-2 text-[12.5px] transition-colors", isActive ? ACTIV : INACTIV)}
              >
                {isActive ? <BaraActiva /> : null}
                <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full transition-colors", isActive ? "bg-lav" : "bg-white/30 group-hover:bg-white/70")} aria-hidden="true" />
                <span className="truncate">{item.label}</span>
                {isActive ? <ChevronRight className="ml-auto h-3 w-3 shrink-0 text-lav" aria-hidden="true" /> : null}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="border-t border-white/[0.06] px-3 py-3">
        <Link
          href={firmaModule.to}
          aria-current={firmaActive ? "page" : undefined}
          className={cn(
            "relative mb-2 flex items-center gap-2 rounded-lg border px-3 py-2 transition-colors",
            firmaActive ? `border-lav/30 ${ACTIV}` : "border-dashed border-white/[0.12] text-foreground/80 hover:border-white/[0.2] hover:bg-white/[0.05] hover:text-white"
          )}
        >
          {firmaActive ? <BaraActiva /> : null}
          <firmaModule.icon className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="text-[12px]">{firmaModule.label}</span>
          <span className="ml-auto text-[9px] uppercase tracking-[0.14em]">{firmaActive ? "deschis" : "intră"}</span>
        </Link>
        <div className="flex items-center gap-2.5 rounded-xl px-1.5 py-1.5">
          <Avatar name={email ?? ""} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12.5px] font-medium">{email ?? "Cont fără email"}</p>
            <p className="truncate text-[11px] text-muted-foreground">administrator</p>
          </div>
          {signOut ? (
            <form action={signOut}>
              <button type="submit" className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-white/[0.07] hover:text-foreground" aria-label="Ieși din cont">
                <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </form>
          ) : null}
        </div>
      </div>
    </aside>
  );
}
