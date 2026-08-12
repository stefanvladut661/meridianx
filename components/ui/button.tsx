import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/**
 * FIȘIER ÎNGHEȚAT după FAZA 0 — cereri de modificare în PLAN.md.
 *
 * Butonul e neutru: nu știe în ce divizie trăiește. `bg-accent` devine
 * tungsten pe video și signal pe software prin data-world de pe layout.
 * Pentru link-uri stilizate ca butoane folosește `buttonClasses()` pe
 * <Link> din i18n/navigation.
 */

type Variant = "primary" | "secondary" | "ghost";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-md font-body font-medium " +
  "transition-colors duration-150 select-none " +
  "disabled:pointer-events-none disabled:opacity-50";

const variants: Record<Variant, string> = {
  primary: "bg-accent text-accent-contrast hover:brightness-110 active:brightness-95",
  secondary:
    "border border-line bg-surface text-fg hover:border-muted active:bg-bg",
  ghost: "text-fg hover:bg-surface active:bg-surface/70",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-5 text-base",
  lg: "h-13 px-7 text-lg",
};

export function buttonClasses({
  variant = "primary",
  size = "md",
  className,
}: {
  variant?: Variant;
  size?: Size;
  className?: string;
} = {}) {
  return cn(base, variants[variant], sizes[size], className);
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button({ variant = "primary", size = "md", className, type = "button", ...props }, ref) {
    return (
      <button
        ref={ref}
        type={type}
        className={buttonClasses({ variant, size, className })}
        {...props}
      />
    );
  }
);
