import type { ButtonHTMLAttributes, ElementType, HTMLAttributes, ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, Minus, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Primitivele panoului, copiate din redesign (Base44) cu aceleași clase:
 * Card, Btn, Pill, Trend, Stat, SectionTitle, SegmentedControl, Stamp, LiveDot.
 * Numele de utilitare (bg-card, text-muted-foreground, bg-lav…) vin din
 * app/panou-theme.css și există doar sub `.panou-ui`.
 */

export function Card({
  className,
  children,
  padded = true,
  as: Tag = "div",
  ...rest
}: { className?: string; children?: ReactNode; padded?: boolean; as?: ElementType } & HTMLAttributes<HTMLElement>) {
  return (
    <Tag
      className={cn(
        "rounded-[22px] border border-white/[0.07] bg-card shadow-[0_1px_0_rgba(255,255,255,0.04)_inset,0_24px_60px_-40px_rgba(0,0,0,0.9)]",
        padded && "p-5 sm:p-6",
        className
      )}
      {...rest}
    >
      {children}
    </Tag>
  );
}

export type BtnVariant = "primary" | "solid" | "outline" | "ghost" | "danger" | "mint";
export type BtnSize = "xs" | "sm" | "md" | "lg";

const BTN_VARIANTS: Record<BtnVariant, string> = {
  primary: "bg-lav text-[#171222] hover:bg-[#D4C7FF] border border-transparent",
  solid: "bg-foreground text-[#0C0C10] hover:bg-white/90 border border-transparent",
  outline: "border border-white/[0.14] text-foreground hover:bg-white/[0.06]",
  ghost: "border border-transparent text-muted-foreground hover:bg-white/[0.07] hover:text-foreground",
  danger: "border border-rose/25 bg-rose/15 text-rose hover:bg-rose/25",
  mint: "border border-mint/25 bg-mint/15 text-mint hover:bg-mint/25",
};

const BTN_SIZES: Record<BtnSize, string> = {
  xs: "h-7 px-2.5 text-[12px] gap-1.5 rounded-lg",
  sm: "h-8 px-3 text-[12.5px] gap-1.5 rounded-lg",
  md: "h-10 px-4 text-[13.5px] gap-2 rounded-xl",
  lg: "h-11 px-5 text-sm gap-2 rounded-xl",
};

/** Clasele unui buton, ca un link (`<Link>`) să arate la fel fără un <button> în <a>. */
export function btnClass({ variant = "outline", size = "md", className }: { variant?: BtnVariant; size?: BtnSize; className?: string } = {}): string {
  return cn(
    "inline-flex select-none items-center justify-center whitespace-nowrap font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-45",
    BTN_VARIANTS[variant],
    BTN_SIZES[size],
    className
  );
}

export function Btn({
  variant = "outline",
  size = "md",
  className,
  icon: Icon,
  iconRight: Right,
  children,
  type = "button",
  ...rest
}: {
  variant?: BtnVariant;
  size?: BtnSize;
  icon?: LucideIcon;
  iconRight?: LucideIcon;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type={type} className={btnClass({ variant, size, className })} {...rest}>
      {Icon ? <Icon className={size === "xs" ? "h-3.5 w-3.5" : "h-4 w-4"} aria-hidden="true" /> : null}
      {children}
      {Right ? <Right className="h-4 w-4" aria-hidden="true" /> : null}
    </button>
  );
}

export type PillTone = "neutral" | "lav" | "mint" | "apricot" | "sky" | "rose" | "dark";

const PILL_TONES: Record<PillTone, string> = {
  neutral: "border-white/[0.09] bg-white/[0.05] text-foreground/75",
  lav: "border-lav/25 bg-lav/12 text-[#D8CCFF]",
  mint: "border-mint/25 bg-mint/12 text-[#A7EFC3]",
  apricot: "border-apricot/25 bg-apricot/12 text-[#FFC79C]",
  sky: "border-sky/25 bg-sky/12 text-[#AEE3FF]",
  rose: "border-rose/25 bg-rose/12 text-[#FFB0C0]",
  dark: "border-white/[0.08] bg-[#0C0C10] text-foreground/80",
};

export function Pill({ tone = "neutral", className, children, dot = false }: { tone?: PillTone; className?: string; children?: ReactNode; dot?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11.5px] font-medium leading-5", PILL_TONES[tone] ?? PILL_TONES.neutral, className)}>
      {dot ? <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" /> : null}
      {children}
    </span>
  );
}

/** Variația procentuală cu săgeată: verde = mai bine, roz = mai rău (`invert`: la costuri, mai puțin e mai bine). */
export function Trend({ value, invert = false, className }: { value: number | null | undefined; invert?: boolean; className?: string }) {
  if (value === null || value === undefined) return <span className="text-xs text-muted-foreground">—</span>;
  const up = value >= 0;
  const good = invert ? !up : up;
  const Icon = value === 0 ? Minus : up ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cn(
        "pu-num inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11.5px] font-medium",
        value === 0 ? "bg-white/[0.06] text-muted-foreground" : good ? "bg-mint/12 text-mint" : "bg-rose/12 text-rose",
        className
      )}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      {Math.abs(value).toLocaleString("ro-RO", { maximumFractionDigits: 1 })}%
    </span>
  );
}

export function Stat({
  label,
  value,
  unit,
  hint,
  delta,
  invertDelta,
  tone,
  className,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  hint?: ReactNode;
  delta?: number | null;
  invertDelta?: boolean;
  tone?: "dim";
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className={cn("pu-num text-[26px] font-medium leading-none sm:text-[30px]", tone === "dim" && "text-foreground/70")}>{value}</span>
        {unit ? <span className="text-xs text-muted-foreground">{unit}</span> : null}
        {delta !== undefined ? <Trend value={delta} invert={invertDelta} /> : null}
      </div>
      {hint ? <p className="mt-1.5 text-[12px] leading-snug text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function SectionTitle({ title, hint, action, className }: { title: ReactNode; hint?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-3", className)}>
      <div>
        <h2 className="text-[15px] font-semibold tracking-[-0.01em]">{title}</h2>
        {hint ? <p className="mt-1 text-[12.5px] text-muted-foreground">{hint}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className,
  size = "md",
}: {
  options: { value: T; label: ReactNode }[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel?: string;
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <div role="group" aria-label={ariaLabel} className={cn("inline-flex items-center gap-1 rounded-full border border-white/[0.07] bg-white/[0.03] p-1", className)}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "rounded-full font-medium transition-colors",
              size === "sm" ? "px-2.5 py-1 text-[11.5px]" : "px-3 py-1.5 text-[12.5px]",
              active ? "bg-white/[0.11] text-foreground shadow-[0_1px_0_rgba(255,255,255,0.07)_inset]" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/** Ștampila „Creată pe pauză”: regula reclamelor, vizibilă pe orice campanie. */
export function Stamp({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border border-dashed border-apricot/35 bg-apricot/[0.07] px-2 py-1 font-mono text-[10.5px] uppercase tracking-[0.1em] text-[#FFC79C]",
        className
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-apricot/80" aria-hidden="true" />
      {children || "Creată pe pauză"}
    </span>
  );
}

export function LiveDot({ active, label = "Live" }: { active: boolean; label?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
      <span className={cn("h-1.5 w-1.5 rounded-full", active ? "animate-dotpulse bg-mint" : "bg-white/25")} aria-hidden="true" />
      {label}
    </span>
  );
}
