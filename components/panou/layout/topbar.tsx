"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { Bell, ChevronRight, Command, Lock, LogOut, Search, ShieldCheck, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { Menu, MenuLabel, MenuSeparator, menuItemClass } from "../ui/menu";
import { Avatar } from "../ui/states";
import { activeModule, getScreenMeta, isItemActive } from "./nav";
import { useShownPath } from "./shell-context";

export interface TopbarAlert {
  id: string;
  title: string;
  text: string;
  to: string;
  tone: "rose" | "apricot" | "mint" | "lav";
}

const DOT_TONES: Record<TopbarAlert["tone"], string> = { rose: "bg-rose", apricot: "bg-apricot", mint: "bg-mint", lav: "bg-lav" };

/**
 * Bara de sus, ca în prototip: firimitura (modul › ecran), selectoarele
 * modulului, căutarea (Ctrl+K), alertele „De rezolvat azi” și meniul
 * utilizatorului. Pe ecrane mici, selectoarele coboară pe un rând al lor, iar
 * subpaginile modulului devin pastile derulante. Selectoarele le pune modulul,
 * prin portal, în cele două locuri (`wideSlot`, `narrowSlot`); rândul de jos
 * dispare cât e gol. `loading`: bara subțire de sus, cât se deschide o pagină.
 */
export function PanouTopbar({
  email,
  alerts,
  loading,
  wideSlot,
  narrowSlot,
  onOpenSearch,
  signOut,
}: {
  email: string | null;
  alerts: TopbarAlert[];
  loading: boolean;
  wideSlot: (element: HTMLElement | null) => void;
  narrowSlot: (element: HTMLElement | null) => void;
  onOpenSearch: () => void;
  signOut?: () => Promise<void>;
}) {
  const pathname = useShownPath(usePathname());
  const meta = getScreenMeta(pathname);
  const active = activeModule(pathname);
  const subRef = useRef<HTMLElement>(null);

  // Pe telefon, pastila subpaginii curente se aduce în mijlocul benzii (fără animație), ca să se vadă unde ești.
  useEffect(() => {
    const bara = subRef.current;
    const curenta = bara?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!bara || !curenta || bara.scrollWidth <= bara.clientWidth) return;
    bara.scrollLeft = curenta.offsetLeft - bara.offsetLeft - (bara.clientWidth - curenta.offsetWidth) / 2;
  }, [pathname]);

  return (
    <header className="sticky top-0 z-30 border-b border-white/[0.06] pu-glass">
      {loading ? (
        <div className="absolute inset-x-0 top-0 h-0.5 overflow-hidden" aria-hidden="true">
          <div className="h-full w-full animate-sweep bg-gradient-to-r from-transparent via-lav to-transparent" />
        </div>
      ) : null}
      <div className="flex h-14 items-center gap-3 px-4 sm:px-6 lg:h-16 lg:px-8">
        <div className="flex min-w-0 items-center gap-2 text-[13.5px] text-muted-foreground">
          <span className="flex h-6 w-6 items-center justify-center rounded-md border border-lav/25 bg-lav/10 lg:hidden">
            <svg viewBox="0 0 24 24" className="h-3 w-3" aria-hidden="true">
              <path d="M5 18V7l7 7 7-7v11" fill="none" stroke="#C6B5FF" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <nav aria-label="Firimitură" className="flex min-w-0 items-center gap-1.5">
            <Link href={active.to} className="hidden hover:text-foreground sm:inline">
              {active.label}
            </Link>
            <ChevronRight className="hidden h-3 w-3 shrink-0 opacity-50 sm:inline" aria-hidden="true" />
            <span className="truncate font-medium text-foreground">{meta.title}</span>
          </nav>
        </div>

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <div ref={wideSlot} className="hidden xl:block" />

          <button
            type="button"
            onClick={onOpenSearch}
            className="flex h-8 items-center gap-2 rounded-lg border border-white/[0.1] bg-white/[0.03] px-2.5 text-[13.5px] text-muted-foreground transition-colors hover:bg-white/[0.07] hover:text-foreground"
            aria-label="Caută sau rulează o comandă (Ctrl+K)"
          >
            <Search className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden md:inline">Caută</span>
            <kbd className="hidden items-center gap-0.5 rounded border border-white/[0.1] bg-white/[0.05] px-1 py-0.5 font-mono text-[11px] md:inline-flex">
              <Command className="h-2.5 w-2.5" aria-hidden="true" />K
            </kbd>
          </button>

          <Menu
            className="w-[318px]"
            trigger={(props) => (
              <button
                type="button"
                {...props}
                className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.1] text-muted-foreground transition-colors hover:bg-white/[0.06] hover:text-foreground"
                aria-label={`Alerte: ${alerts.length} nerezolvate`}
              >
                <Bell className="h-4 w-4" aria-hidden="true" />
                {alerts.length > 0 ? (
                  <span className="pu-num absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-lav px-1 text-[11px] font-semibold text-[#171222]">{alerts.length}</span>
                ) : null}
              </button>
            )}
          >
            <MenuLabel>De rezolvat azi</MenuLabel>
            {alerts.length === 0 ? (
              <p className="px-2 py-4 text-[14px] text-muted-foreground">Nimic în așteptare. Bine lucrat.</p>
            ) : (
              alerts.map((alert) => (
                <Link key={alert.id} href={alert.to} role="menuitem" className="flex items-start gap-2.5 rounded-xl px-2 py-2 hover:bg-white/[0.06] focus-visible:bg-white/[0.06]">
                  <span className={cn("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", DOT_TONES[alert.tone])} aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block text-[14px] font-medium text-foreground">{alert.title}</span>
                    <span className="block truncate text-[12.5px] text-muted-foreground">{alert.text}</span>
                  </span>
                </Link>
              ))
            )}
          </Menu>

          <Menu
            className="w-64"
            trigger={(props) => (
              <button type="button" {...props} className="rounded-full ring-offset-2 ring-offset-background focus-visible:ring-2" aria-label="Meniul utilizatorului">
                <Avatar name={email ?? ""} className="h-8 w-8" />
              </button>
            )}
          >
            <div className="px-2 py-2">
              <p className="text-[14.5px] font-medium">Administrator</p>
              <p className="truncate text-[13px] text-muted-foreground">{email ?? "cont fără email"}</p>
            </div>
            <MenuSeparator />
            <Link href="/vault/cont" role="menuitem" className={menuItemClass}>
              <User className="h-3.5 w-3.5" aria-hidden="true" /> Contul meu
            </Link>
            <Link href="/vault" role="menuitem" className={menuItemClass}>
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" /> Deschide seiful
            </Link>
            {signOut ? (
              <>
                <MenuSeparator />
                <form action={signOut}>
                  <button type="submit" role="menuitem" className={cn(menuItemClass, "text-rose")}>
                    <LogOut className="mr-0 h-3.5 w-3.5" aria-hidden="true" /> Ieși din cont
                  </button>
                </form>
              </>
            ) : (
              <>
                <MenuSeparator />
                <p className="flex items-center gap-2 px-2 py-2 text-[13px] text-muted-foreground">
                  <Lock className="h-3.5 w-3.5" aria-hidden="true" /> Sesiunea seifului se închide din Vault.
                </p>
              </>
            )}
          </Menu>
        </div>
      </div>

      <div ref={narrowSlot} className="flex border-t border-white/[0.05] px-4 py-2 empty:hidden sm:px-6 xl:hidden" />

      <nav ref={subRef} aria-label={`Subpagini ${active.label}`} className="pu-no-scrollbar flex gap-1.5 overflow-x-auto border-t border-white/[0.05] px-4 py-2 sm:px-6 lg:hidden">
        {active.items.map((item) => {
          const isActive = isItemActive(pathname, item, active);
          return (
            <Link
              key={item.to}
              href={item.to}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "whitespace-nowrap rounded-full border px-3 py-1.5 text-[13.5px] transition-colors",
                // Contrast măsurat pe bara de sus (#0C0C0F): inactiv foreground/80 = 11:1; alb pe lav/16 = 14,6:1.
                isActive ? "border-lav/45 bg-lav/[0.16] font-semibold text-white" : "border-transparent text-foreground/80 hover:bg-white/[0.05] hover:text-white"
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
