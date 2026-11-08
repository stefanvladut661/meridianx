"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState, type MouseEvent, type ReactNode } from "react";
import type { ShellState } from "@/lib/panou/alerts";
import { ToastProvider } from "../ui/toast";
import { CommandPalette } from "./command-palette";
import { PanouMobileNav } from "./mobile-nav";
import type { PanouModuleId } from "./nav";
import { PanouPageSkeleton } from "./page-skeleton";
import { ShellContextProvider } from "./shell-context";
import { PanouSidebar } from "./sidebar";
import { PanouTopbar, type TopbarAlert } from "./topbar";

/** Cât arată scheletul dacă pagina nu mai vine (rețea căzută): apoi revine pagina veche. */
const PENDING_TIMEOUT_MS = 15_000;

/**
 * Partea de client a cadrului: meniul, bara de sus, bara de jos de pe telefon,
 * căutarea Ctrl+K și notificările. Rădăcina poartă și `ads-portal`, ca ecranele
 * care n-au fost încă refăcute să-și păstreze culorile.
 *
 * Alertele și numerele din meniu vin fie gata (`alerts`/`badges`, Vault-ul),
 * fie ca promisiune (`state`, adminul): cadrul nu le așteaptă, apar când sosesc.
 *
 * La clic pe un link spre altă pagină, meniul se mută imediat pe ea și
 * conținutul arată scheletul până răspunde serverul.
 */
export function PanouFrame({
  email,
  alerts: givenAlerts,
  badges: givenBadges,
  state,
  signOut,
  children,
}: {
  email: string | null;
  alerts?: TopbarAlert[];
  badges?: Partial<Record<PanouModuleId, number>>;
  state?: Promise<ShellState>;
  signOut?: () => Promise<void>;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [loaded, setLoaded] = useState<ShellState | null>(null);
  const [pending, setPending] = useState<{ to: string; from: string } | null>(null);
  const [wide, setWide] = useState<HTMLElement | null>(null);
  const [narrow, setNarrow] = useState<HTMLElement | null>(null);

  // Scheletul ține doar cât suntem încă pe pagina de pe care s-a apăsat.
  const pendingPath = pending && pending.from === pathname ? pending.to : null;

  useEffect(() => {
    if (!state) return;
    let live = true;
    void state.then((value) => {
      if (live) setLoaded(value);
    });
    return () => {
      live = false;
    };
  }, [state]);

  useEffect(() => {
    if (!pendingPath) return;
    const timer = window.setTimeout(() => setPending(null), PENDING_TIMEOUT_MS);
    const cancel = () => setPending(null);
    window.addEventListener("popstate", cancel);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("popstate", cancel);
    };
  }, [pendingPath]);

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

  /**
   * Doar navigările făcute de Next (linkul a oprit deja navigarea clasică),
   * fără taste de modificare, spre altă cale: filtrele din aceeași pagină
   * (doar `?…` schimbat) nu golesc ecranul.
   */
  const onClick = (event: MouseEvent<HTMLDivElement>) => {
    if (!event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const anchor = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
    if (!anchor || anchor.hasAttribute("download") || (anchor.target && anchor.target !== "_self")) return;
    const url = new URL(anchor.href, window.location.href);
    if (url.origin !== window.location.origin || url.pathname === pathname) return;
    setPending({ to: url.pathname, from: pathname });
  };

  const alerts = givenAlerts ?? loaded?.alerts ?? [];
  const badges = givenBadges ?? loaded?.badges ?? {};

  return (
    <ToastProvider>
      <ShellContextProvider value={{ pendingPath, slots: { wide, narrow } }}>
        <div className="panou-ui ads-portal min-h-screen bg-background text-foreground" onClick={onClick}>
          <a href="#continut" className="skip-link">
            Sari la conținut
          </a>
          <PanouSidebar email={email} badges={badges} signOut={signOut} />
          <div className="lg:pl-[266px]">
            <PanouTopbar
              email={email}
              alerts={alerts}
              loading={pendingPath !== null}
              wideSlot={setWide}
              narrowSlot={setNarrow}
              onOpenSearch={() => setPaletteOpen(true)}
              signOut={signOut}
            />
            <main id="continut" className="mx-auto w-full max-w-[1600px] px-4 pb-28 pt-5 sm:px-6 lg:px-8 lg:pb-14">
              {pendingPath ? <PanouPageSkeleton /> : null}
              <div className={pendingPath ? "hidden" : "contents"}>{children}</div>
            </main>
          </div>
          <PanouMobileNav email={email} signOut={signOut} />
          <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
        </div>
      </ShellContextProvider>
    </ToastProvider>
  );
}
