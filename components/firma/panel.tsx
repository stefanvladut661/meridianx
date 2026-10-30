"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { IconClose } from "./icons";

/**
 * Panoul din dreapta: un rând deschis fără să pleci din tabel. Acoperă
 * ecranul pe telefon, stă la 560 px pe desktop. Ține focusul înăuntru (Tab nu
 * iese), Escape îl închide, iar la închidere focusul se întoarce de unde a venit.
 */
export function SidePanel({
  title,
  subtitle,
  onClose,
  children,
  footer,
}: {
  title: string;
  subtitle?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const titleId = useId();
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    heading.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close.current();
        return;
      }
      if (event.key !== "Tab" || !panel.current) return;
      const focusable = Array.from(
        panel.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')
      ).filter((element) => element.offsetParent !== null);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === heading.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus?.();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50">
      <div aria-hidden className="absolute inset-0 bg-black/20" onClick={() => close.current()} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="ads-panel-enter absolute inset-y-0 right-0 flex w-full flex-col border-l border-hair bg-char shadow-[0_0_40px_rgb(18_23_27/0.12)] sm:w-[560px]"
      >
        <div className="flex items-start gap-3 border-b border-hair px-5 py-4">
          <div className="min-w-0 flex-1">
            <h2 ref={heading} id={titleId} tabIndex={-1} className="truncate text-[17px] font-semibold text-bone">
              {title}
            </h2>
            {subtitle ? <div className="mt-0.5 text-[13px] text-dim">{subtitle}</div> : null}
          </div>
          <button type="button" onClick={() => close.current()} className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-dim hover:bg-[var(--ap-hover)]">
            <IconClose />
            <span className="sr-only">Închide panoul</span>
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer ? <div className="border-t border-hair px-5 py-3">{footer}</div> : null}
      </div>
    </div>
  );
}
