"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useRouter } from "next/navigation";

/**
 * Învelișul interactiv al panoului de detaliu (FAZA 6).
 *
 * Conținutul e randat pe server (`?lead=<id>` → panoul e deep-linkabil și
 * se reîncarcă corect). Componenta asta adaugă doar ce nu se poate face pe
 * server, dar e obligatoriu la un panou care acoperă pagina:
 * - Escape închide,
 * - focusul intră în panou la deschidere,
 * - focusul e capturat înăuntru cât e deschis,
 * - la închidere focusul se întoarce unde era (quality floor §7).
 */

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function PanelShell({
  children,
  closeHref,
  labelledBy,
}: {
  children: ReactNode;
  /** URL-ul listei, fără `?lead=` — păstrează filtrele. */
  closeHref: string;
  labelledBy: string;
}) {
  const router = useRouter();
  const panelRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    returnFocusRef.current = document.activeElement as HTMLElement | null;

    const panel = panelRef.current;
    panel?.querySelector<HTMLElement>(FOCUSABLE)?.focus();

    const close = () => router.push(closeHref, { scroll: false });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }

      if (event.key !== "Tab" || !panel) return;

      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      // Întoarcem focusul doar dacă a rămas în panoul care dispare.
      const active = document.activeElement;
      if (!active || active === document.body || panel?.contains(active)) {
        returnFocusRef.current?.focus?.();
      }
    };
  }, [router, closeHref]);

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
      className="fixed inset-y-0 right-0 z-(--z-modal) flex w-full max-w-xl flex-col border-l border-line bg-bg shadow-overlay"
    >
      {children}
    </div>
  );
}
