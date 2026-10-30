"use client";

import { AlertTriangle, ArrowRight } from "lucide-react";
import type { PlanProblem } from "@/lib/ads/plan-validate";
import { cn } from "@/lib/utils";

/** Id-ul DOM al unui element din previzualizare, pentru o cale din plan — ținta rândurilor din listă. */
export function fieldId(path: string): string {
  return `camp-${path.replace(/\./g, "-")}`;
}

/** Primul element existent pe drumul căii în sus: elementul însuși, apoi părinții. */
export function jumpTo(path: string) {
  const parts = path.split(".");
  for (let length = parts.length; length >= 1; length -= 1) {
    const candidate = parts.slice(0, length).join(".");
    const element = document.getElementById(fieldId(candidate)) ?? document.getElementById(`${fieldId(candidate)}-msg`);
    if (element) {
      // Un grup strâns se deschide întâi, altfel n-ar avea unde derula.
      for (let node: HTMLElement | null = element; node; node = node.parentElement) {
        if (node instanceof HTMLDetailsElement && !node.open) node.open = true;
      }
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      element.scrollIntoView({ block: "center", behavior: reduced ? "auto" : "smooth" });
      if (!element.matches("input, select, textarea, button")) element.setAttribute("tabindex", "-1");
      element.focus({ preventScroll: true });
      return;
    }
  }
}

/**
 * Lista de probleme, cu aceleași note din redesign: erori (roz, blochează)
 * sau avertismente (caisă, de citit). Fiecare rând duce la locul lui din
 * previzualizare.
 */
export function PlanProbleme({
  title,
  problems,
  tone,
  linked = true,
}: {
  title: string;
  problems: PlanProblem[];
  tone: "error" | "warning";
  /** Rândurile duc la elementul lor. Fals acolo unde nu există previzualizare. */
  linked?: boolean;
}) {
  if (problems.length === 0) return null;
  const error = tone === "error";
  return (
    <section
      aria-label={title}
      className={cn(
        "rounded-xl border px-3.5 py-3",
        error ? "border-rose/25 bg-rose/[0.07] text-[#FFC2CE]" : "border-apricot/25 bg-apricot/[0.07] text-[#FFD0AC]"
      )}
    >
      <h3 className="flex items-center gap-2 text-[12.5px] font-semibold">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        {title}
      </h3>
      <ul className="mt-2 space-y-1">
        {problems.map((problem, index) => (
          <li key={index}>
            {linked ? (
              <button
                type="button"
                onClick={() => jumpTo(problem.path)}
                className="group flex w-full items-start gap-2 rounded-lg px-1 py-0.5 text-left text-[12px] leading-relaxed text-foreground/85 hover:text-foreground"
              >
                <ArrowRight className="mt-[3px] h-3 w-3 shrink-0 opacity-60 group-hover:opacity-100" aria-hidden="true" />
                <span>{problem.message}</span>
              </button>
            ) : (
              <p className="flex items-start gap-2 px-1 py-0.5 text-[12px] leading-relaxed text-foreground/85">
                <ArrowRight className="mt-[3px] h-3 w-3 shrink-0 opacity-60" aria-hidden="true" />
                <span>{problem.message}</span>
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
