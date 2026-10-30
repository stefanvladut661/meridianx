"use client";

import { AlertTriangle } from "lucide-react";
import type { PlanProblem } from "@/lib/ads/plan-validate";
import { cn } from "@/lib/utils";
import { fieldId } from "./fields";

/** Primul element existent pe drumul căii în sus: câmpul, mesajul lui, apoi părinții. */
export function jumpTo(path: string) {
  const parts = path.split(".");
  for (let length = parts.length; length >= 1; length -= 1) {
    const candidate = parts.slice(0, length).join(".");
    const element =
      document.getElementById(fieldId(candidate)) ??
      document.getElementById(`${fieldId(candidate)}-msg`);
    if (element) {
      // Un câmp dintr-un grup strâns (planul de căutare) se deschide întâi, altfel n-ar avea unde derula.
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
 * Lista de probleme — erori (roz, blochează) sau avertismente (caisă, de
 * citit), în stilul rândurilor de verificare din prototip. Fiecare rând duce
 * la câmpul lui.
 */
export function ProblemList({
  title,
  problems,
  tone,
  linked = true,
}: {
  title: string;
  problems: PlanProblem[];
  tone: "error" | "warning";
  /** Rândurile duc la câmpul lor. Fals acolo unde nu există formular (lotul). */
  linked?: boolean;
}) {
  if (problems.length === 0) return null;
  const error = tone === "error";
  return (
    <section
      aria-label={title}
      className={cn(
        "rounded-xl border px-3.5 py-3",
        error ? "border-rose/25 bg-rose/[0.07]" : "border-apricot/25 bg-apricot/[0.07]"
      )}
    >
      <h3 className={cn("flex items-center gap-2 text-[12.5px] font-medium", error ? "text-[#FFC2CE]" : "text-[#FFD0AC]")}>
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        {title}
      </h3>
      <ul className="mt-2.5 space-y-1.5">
        {problems.map((problem, index) =>
          !linked ? (
            <li key={index} className={cn("flex items-start gap-2.5 px-1 py-0.5 text-[12px] leading-relaxed", error ? "text-[#FFC2CE]" : "text-[#FFD0AC]")}>
              <span aria-hidden="true" className="mt-px font-mono text-[10.5px] opacity-60">
                →
              </span>
              <span>
                {problem.path ? <span className="mr-1.5 font-mono text-[11px] opacity-70">{problem.path}</span> : null}
                {problem.message}
              </span>
            </li>
          ) : (
            <li key={index}>
              <button
                type="button"
                onClick={() => jumpTo(problem.path)}
                className={cn(
                  "group flex w-full items-start gap-2.5 rounded-lg px-1 py-0.5 text-left text-[12px] leading-relaxed hover:bg-white/[0.05]",
                  error ? "text-[#FFC2CE]" : "text-[#FFD0AC]"
                )}
              >
                <span aria-hidden="true" className="mt-px font-mono text-[10.5px] opacity-60 group-hover:opacity-100">
                  →
                </span>
                <span>{problem.message}</span>
              </button>
            </li>
          )
        )}
      </ul>
    </section>
  );
}
