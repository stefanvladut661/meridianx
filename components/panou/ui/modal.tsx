"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Dialogul panoului, pe `<dialog>` nativ: focusul rămâne înăuntru, Esc îl închide,
 * clic pe fundal la fel. Înlocuiește Dialog-ul Radix din prototip, cu aceleași clase.
 * Conținutul se montează doar cât e deschis, deci starea formularelor se resetează.
 */
export function Modal({
  open,
  onOpenChange,
  label,
  className,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Numele accesibil al dialogului (titlul, dacă nu are unul vizibil). */
  label?: string;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-label={label}
      onClose={() => onOpenChange(false)}
      onClick={(event) => {
        if (event.target === ref.current) onOpenChange(false);
      }}
      className={cn(
        "m-auto w-[min(28rem,calc(100vw-2rem))] max-w-none rounded-[22px] border border-white/[0.09] bg-[#121216] p-6 text-foreground shadow-[0_30px_80px_-30px_rgba(0,0,0,0.95)] backdrop:bg-black/70",
        className
      )}
    >
      {open ? children : null}
    </dialog>
  );
}
