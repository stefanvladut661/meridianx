import { forwardRef, type SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/** FIȘIER ÎNGHEȚAT după FAZA 0 — cereri de modificare în PLAN.md. */

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
}

/** Select nativ stilizat — opțiunile vin ca <option> copii. */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  function Select({ className, invalid, children, ...props }, ref) {
    return (
      <div className="relative">
        <select
          ref={ref}
          aria-invalid={invalid || undefined}
          className={cn(
            "h-11 w-full appearance-none rounded-md border border-line bg-surface pl-4 pr-10 text-base text-fg",
            "transition-colors duration-150 hover:border-muted",
            "focus:border-accent focus:outline-none",
            invalid && "border-red-400 focus:border-red-400",
            className
          )}
          {...props}
        >
          {children}
        </select>
        <svg
          aria-hidden="true"
          viewBox="0 0 16 16"
          className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-muted"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M4 6l4 4 4-4" />
        </svg>
      </div>
    );
  }
);
