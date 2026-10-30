"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Meniul derulant al panoului (alerte, utilizator), fără Radix: se deschide din
 * buton, se închide cu Esc, cu clic în afară sau după alegerea unui element.
 * Clasele sunt cele din prototip.
 */
export function Menu({
  trigger,
  children,
  align = "end",
  className,
}: {
  trigger: (props: { onClick: () => void; "aria-expanded": boolean; "aria-haspopup": "menu" }) => ReactNode;
  children: ReactNode;
  align?: "start" | "end";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      {trigger({ onClick: () => setOpen((value) => !value), "aria-expanded": open, "aria-haspopup": "menu" })}
      {open ? (
        <div
          role="menu"
          onClick={(event) => {
            // Un link sau un buton din meniu îl închide; textul din el nu.
            if ((event.target as HTMLElement).closest("a, button")) setOpen(false);
          }}
          className={cn(
            "absolute top-full z-50 mt-2 rounded-2xl border border-white/[0.09] bg-[#121216] p-2 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.95)]",
            align === "end" ? "right-0" : "left-0",
            className
          )}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return <p className="px-2 py-1.5 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{children}</p>;
}

export function MenuSeparator() {
  return <div role="separator" className="my-1.5 h-px bg-white/[0.07]" />;
}

export const menuItemClass = "flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-left text-[12.5px] transition-colors hover:bg-white/[0.06] focus-visible:bg-white/[0.06]";
