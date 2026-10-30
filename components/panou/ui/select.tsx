import type { InputHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function SoftSelect({
  value,
  onChange,
  options,
  label,
  ariaLabel,
  className,
  id,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  label?: string;
  ariaLabel?: string;
  className?: string;
  id?: string;
  disabled?: boolean;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      {label ? <span className="mb-1 block text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">{label}</span> : null}
      <div className="relative">
        <select
          id={id}
          aria-label={ariaLabel || label}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          className="h-8 w-full appearance-none truncate rounded-lg border border-white/[0.1] bg-white/[0.04] pl-2.5 pr-7 text-[12.5px] text-foreground outline-none transition-colors hover:bg-white/[0.07] focus:border-lav/50 disabled:opacity-50"
        >
          {options.map((option) => (
            <option key={option.value} value={option.value} className="bg-[#14141A] text-foreground">
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
      </div>
    </div>
  );
}

export function TextInput({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-9 w-full rounded-lg border border-white/[0.12] bg-white/[0.03] px-3 text-[13px] outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-lav/50 focus:bg-white/[0.05]",
        className
      )}
      {...rest}
    />
  );
}
