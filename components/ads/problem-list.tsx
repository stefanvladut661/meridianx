"use client";

import type { PlanProblem } from "@/lib/ads/plan-validate";
import { cn } from "@/lib/utils";
import { fieldId } from "./fields";
import { ERROR_DOT, ERROR_TEXT, WARNING_DOT, WARNING_TEXT } from "./tone";

/** Primul element existent pe drumul căii în sus: câmpul, mesajul lui, apoi părinții. */
export function jumpTo(path: string) {
  const parts = path.split(".");
  for (let length = parts.length; length >= 1; length -= 1) {
    const candidate = parts.slice(0, length).join(".");
    const element =
      document.getElementById(fieldId(candidate)) ??
      document.getElementById(`${fieldId(candidate)}-msg`);
    if (element) {
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      element.scrollIntoView({ block: "center", behavior: reduced ? "auto" : "smooth" });
      if (!element.matches("input, select, textarea, button")) element.setAttribute("tabindex", "-1");
      element.focus({ preventScroll: true });
      return;
    }
  }
}

/**
 * Lista de probleme — erori (roșu, blochează) sau avertismente (chihlimbar,
 * de citit). Fiecare rând duce la câmpul lui.
 */
export function ProblemList({
  title,
  problems,
  tone,
}: {
  title: string;
  problems: PlanProblem[];
  tone: "error" | "warning";
}) {
  if (problems.length === 0) return null;
  return (
    <section
      aria-label={title}
      className={cn(
        "rounded-panel-lg border px-5 py-4",
        tone === "error" ? "border-[#ff6b6b]/35 bg-[#ff6b6b]/[0.05]" : "border-[#f0b429]/30 bg-[#f0b429]/[0.04]"
      )}
    >
      <h3 className={cn("flex items-center gap-2 text-[14.5px] font-semibold", tone === "error" ? ERROR_TEXT : WARNING_TEXT)}>
        <span aria-hidden className={cn("h-2 w-2 rounded-full", tone === "error" ? ERROR_DOT : WARNING_DOT)} />
        {title}
      </h3>
      <ul className="mt-3 space-y-2">
        {problems.map((problem, index) => (
          <li key={index}>
            <button
              type="button"
              onClick={() => jumpTo(problem.path)}
              className="group flex w-full items-start gap-3 rounded-panel-sm px-1 py-0.5 text-left text-[14px] leading-snug text-bone/85 hover:text-bone"
            >
              <span aria-hidden className="mt-[3px] font-md-mono text-[11px] text-dim group-hover:text-bone">
                →
              </span>
              <span>{problem.message}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
