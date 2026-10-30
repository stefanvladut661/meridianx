"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ToastProvider } from "../ui/toast";
import { CommandPalette } from "./command-palette";
import { PanouMobileNav } from "./mobile-nav";
import type { PanouModuleId } from "./nav";
import { PanouSidebar } from "./sidebar";
import { PanouTopbar, type TopbarAlert } from "./topbar";

/**
 * Partea de client a cadrului (AppShell din prototip): meniul, bara de sus,
 * bara de jos de pe telefon, căutarea Ctrl+K și notificările. Rădăcina poartă și
 * `ads-portal`, ca ecranele care n-au fost încă refăcute să-și păstreze culorile.
 */
export function PanouFrame({
  email,
  alerts,
  badges,
  selectors,
  banner,
  signOut,
  children,
}: {
  email: string | null;
  alerts: TopbarAlert[];
  badges: Partial<Record<PanouModuleId, number>>;
  selectors?: ReactNode;
  banner?: ReactNode;
  signOut?: () => Promise<void>;
  children: ReactNode;
}) {
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <ToastProvider>
      <div className="panou-ui ads-portal min-h-screen bg-background text-foreground">
        <a href="#continut" className="skip-link">
          Sari la conținut
        </a>
        <PanouSidebar email={email} badges={badges} signOut={signOut} />
        <div className="lg:pl-[266px]">
          <PanouTopbar email={email} alerts={alerts} selectors={selectors} onOpenSearch={() => setPaletteOpen(true)} signOut={signOut} />
          <main id="continut" className="mx-auto w-full max-w-[1600px] px-4 pb-28 pt-5 sm:px-6 lg:px-8 lg:pb-14">
            {banner}
            {children}
          </main>
        </div>
        <PanouMobileNav email={email} signOut={signOut} />
        <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
      </div>
    </ToastProvider>
  );
}
