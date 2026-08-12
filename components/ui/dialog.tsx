"use client";

import {
  useEffect,
  useRef,
  useId,
  type ReactNode,
  type MouseEvent,
} from "react";
import { cn } from "@/lib/utils";

/**
 * FIȘIER ÎNGHEȚAT după FAZA 0 — cereri de modificare în PLAN.md.
 *
 * Modal pe <dialog> nativ: focus trap, Escape și restaurarea focusului
 * vin din browser. Închidere și la click pe backdrop.
 */

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Ascunde titlul vizual (rămâne pentru cititoare de ecran). */
  hideTitle?: boolean;
  className?: string;
}

export function Dialog({
  open,
  onClose,
  title,
  children,
  hideTitle,
  className,
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  function handleBackdropClick(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === ref.current) onClose();
  }

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={handleBackdropClick}
      className={cn(
        "m-auto w-[calc(100vw-2rem)] max-w-lg rounded-lg border border-line bg-surface p-6 text-fg shadow-overlay",
        "backdrop:bg-black/60 backdrop:backdrop-blur-sm",
        "open:animate-[dialog-in_200ms_ease-out]",
        className
      )}
    >
      <div className="mb-4 flex items-start justify-between gap-4">
        <h2
          id={titleId}
          className={cn(
            "font-display text-xl tracking-tight",
            hideTitle && "sr-only"
          )}
        >
          {title}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Închide"
          className="rounded-sm p-1 text-muted transition-colors hover:text-fg"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 16 16"
            className="size-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M3 3l10 10M13 3L3 13" />
          </svg>
        </button>
      </div>
      {children}
    </dialog>
  );
}
