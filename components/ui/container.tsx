import { type ElementType, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** FIȘIER ÎNGHEȚAT după FAZA 0 — cereri de modificare în PLAN.md. */

export interface ContainerProps {
  children: ReactNode;
  as?: ElementType;
  /** wide = layout-uri cu reel/diagrame; narrow = text lung. */
  size?: "narrow" | "default" | "wide";
  className?: string;
}

const sizes = {
  narrow: "max-w-3xl",
  default: "max-w-6xl",
  wide: "max-w-[88rem]",
} as const;

export function Container({
  children,
  as: Tag = "div",
  size = "default",
  className,
}: ContainerProps) {
  return (
    <Tag className={cn("mx-auto w-full px-4 sm:px-6 lg:px-8", sizes[size], className)}>
      {children}
    </Tag>
  );
}
