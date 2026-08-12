import { forwardRef, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/** FIȘIER ÎNGHEȚAT după FAZA 0 — cereri de modificare în PLAN.md. */

export interface TextareaProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea({ className, invalid, rows = 4, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        rows={rows}
        aria-invalid={invalid || undefined}
        className={cn(
          "w-full rounded-md border border-line bg-surface px-4 py-3 text-base text-fg",
          "placeholder:text-muted",
          "transition-colors duration-150 hover:border-muted",
          "focus:border-accent focus:outline-none",
          "resize-y",
          invalid && "border-red-400 focus:border-red-400",
          className
        )}
        {...props}
      />
    );
  }
);
