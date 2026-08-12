import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** FIȘIER ÎNGHEȚAT după FAZA 0 — cereri de modificare în PLAN.md. */

export interface SectionProps {
  children: ReactNode;
  /** id pentru ancore și pentru gradațiile signature-urilor (HUD / meridian). */
  id?: string;
  spacing?: "sm" | "md" | "lg";
  className?: string;
}

const spacings = {
  sm: "py-12 sm:py-16",
  md: "py-16 sm:py-24",
  lg: "py-24 sm:py-32",
} as const;

export function Section({
  children,
  id,
  spacing = "md",
  className,
}: SectionProps) {
  return (
    <section id={id} className={cn(spacings[spacing], className)}>
      {children}
    </section>
  );
}
