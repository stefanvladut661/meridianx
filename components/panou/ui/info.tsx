"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Info as InfoIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Explicația pusă deoparte: un „i” mic lângă titlu sau câmp, iar textul apare
 * doar la cerere (trecerea cu mouse-ul, clic, Enter). Ecranul rămâne curat;
 * cine vrea detaliul îl are la un gest.
 *
 * Se închide cu Esc, cu clic în afară sau la plecarea mouse-ului (dacă a fost
 * deschis prin trecere, nu prin clic). Se aliniază spre stânga când nu încape
 * spre dreapta.
 *
 * Conținutul stă într-un <span>: doar text și elemente de rând (<strong>, <code>,
 * <br />), fără <p> sau liste — altfel HTML-ul e invalid și hidratarea se rupe.
 */
export function Info({ children, label = "Detalii", className }: { children: ReactNode; label?: string; className?: string }) {
  const id = useId();
  const root = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState<"hover" | "pinned" | null>(null);
  const [alignEnd, setAlignEnd] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(null);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(null);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !root.current) return;
    const rect = root.current.getBoundingClientRect();
    setAlignEnd(rect.left + 300 > window.innerWidth - 16);
  }, [open]);

  const canHover = () => typeof window !== "undefined" && window.matchMedia("(hover: hover)").matches;

  return (
    <span
      ref={root}
      className={cn("relative inline-flex align-middle", className)}
      onMouseEnter={() => {
        if (canHover() && !open) setOpen("hover");
      }}
      onMouseLeave={() => {
        if (open === "hover") setOpen(null);
      }}
    >
      <button
        type="button"
        aria-label={label}
        aria-expanded={open !== null}
        aria-controls={id}
        onClick={() => setOpen((value) => (value === "pinned" ? null : "pinned"))}
        className={cn(
          "inline-flex h-[18px] w-[18px] items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-lav focus-visible:text-lav",
          open && "text-lav"
        )}
      >
        <InfoIcon className="h-[15px] w-[15px]" aria-hidden="true" />
      </button>
      <span
        id={id}
        role="note"
        hidden={!open}
        className={cn(
          "absolute top-full z-50 mt-2 w-max max-w-[min(300px,calc(100vw-32px))] whitespace-normal rounded-xl border border-white/[0.1] bg-[#15151A] px-3.5 py-3 text-left text-[13.5px] font-normal normal-case leading-relaxed tracking-normal text-foreground/90 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.95)]",
          alignEnd ? "right-0" : "left-0"
        )}
      >
        {children}
      </span>
    </span>
  );
}
