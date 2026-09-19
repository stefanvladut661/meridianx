"use client";

import { useEffect, useRef, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

/**
 * Învelișul interactiv al panoului de detaliu (FAZA 6).
 *
 * Conținutul e randat pe server (`?lead=<id>` → panoul e deep-linkabil și
 * se reîncarcă corect). Componenta asta adaugă doar ce nu se poate face pe
 * server, dar e obligatoriu la un panou care acoperă pagina:
 * - Escape închide,
 * - clic pe vălul din spate închide,
 * - focusul intră în panou la deschidere,
 * - focusul e capturat înăuntru cât e deschis,
 * - la închidere focusul se întoarce unde era (quality floor §7).
 *
 * Pe ecrane mari panoul e o fișă desprinsă de margine, cu raza site-ului;
 * pe telefon acoperă tot, ca o pagină.
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
    <div className="fixed inset-0 z-50">
      {/* Vălul: un link real, ca închiderea prin clic în afară să meargă
          și fără JavaScript. Tastatura nu ajunge la el (tabIndex -1) —
          are Escape și butonul „Închide". */}
      <Link
        href={closeHref}
        scroll={false}
        tabIndex={-1}
        aria-hidden
        className="absolute inset-0 bg-ink/70"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className="absolute inset-y-0 right-0 flex w-full max-w-xl flex-col border-l border-hair bg-char shadow-[0_24px_80px_-20px_rgb(0_0_0/0.8)] sm:inset-y-3 sm:right-3 sm:rounded-panel-lg sm:border"
      >
        {children}
      </div>
    </div>
  );
}
