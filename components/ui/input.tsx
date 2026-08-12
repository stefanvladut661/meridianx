import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/** FIȘIER ÎNGHEȚAT după FAZA 0 — cereri de modificare în PLAN.md. */

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, invalid, ...props },
  ref
) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        "h-11 w-full rounded-md border border-line bg-surface px-4 text-base text-fg",
        "placeholder:text-muted",
        "transition-colors duration-150 hover:border-muted",
        "focus:border-accent focus:outline-none",
        invalid && "border-red-400 focus:border-red-400",
        className
      )}
      {...props}
    />
  );
});
