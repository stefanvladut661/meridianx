import type { ReactNode } from "react";
import { AlertTriangle, Inbox, Loader2, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Btn } from "./primitives";

export function EmptyState({
  icon: Icon = Inbox,
  title,
  text,
  action,
  hint,
  className,
}: {
  icon?: LucideIcon;
  title: ReactNode;
  text?: ReactNode;
  action?: ReactNode;
  hint?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-14 text-center", className)}>
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.04]">
        <Icon className="h-5 w-5 text-lav" aria-hidden="true" />
      </div>
      <h3 className="text-[15px] font-semibold">{title}</h3>
      {text ? <p className="mt-2 max-w-sm text-[13px] leading-relaxed text-muted-foreground">{text}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
      {hint ? <p className="mt-4 max-w-sm text-[11.5px] leading-relaxed text-muted-foreground/70">{hint}</p> : null}
    </div>
  );
}

export function ErrorState({
  title = "Conexiunea a căzut",
  text,
  onRetry,
  retryLabel = "Încearcă din nou",
  className,
  hint,
}: {
  title?: ReactNode;
  text?: ReactNode;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
  hint?: ReactNode;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-14 text-center", className)}>
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-rose/25 bg-rose/10">
        <AlertTriangle className="h-5 w-5 text-rose" aria-hidden="true" />
      </div>
      <h3 className="text-[15px] font-semibold">{title}</h3>
      <p className="mt-2 max-w-md text-[13px] leading-relaxed text-muted-foreground">
        {text || "Nu am putut citi datele. Verifică dacă ești conectat la internet și reîncearcă."}
      </p>
      {hint ? <p className="mt-2 text-[11.5px] text-muted-foreground/70">{hint}</p> : null}
      {onRetry ? (
        <Btn variant="outline" size="sm" className="mt-5" onClick={onRetry}>
          {retryLabel}
        </Btn>
      ) : null}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn("relative overflow-hidden rounded-xl bg-white/[0.055]", className)}>
      <div className="absolute inset-0 -translate-x-full animate-sweep bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
    </div>
  );
}

export function LoadingRows({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="divide-y divide-white/[0.05]" aria-busy="true" aria-live="polite">
      <span className="sr-only">Se încarcă datele</span>
      {Array.from({ length: rows }).map((_, row) => (
        <div key={row} className="flex items-center gap-4 px-4 py-4">
          {Array.from({ length: cols }).map((__, col) => (
            <Skeleton key={col} className={cn("h-3.5", col === 0 ? "w-40" : col === cols - 1 ? "w-16" : "w-24")} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function Spinner({ className, label = "Se încarcă" }: { className?: string; label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-[12.5px] text-muted-foreground" role="status">
      <Loader2 className={cn("h-3.5 w-3.5 animate-spin", className)} aria-hidden="true" />
      {label}
    </span>
  );
}

const AVATAR_TONES = {
  lav: "bg-lav/15 text-[#D8CCFF] border-lav/25",
  apricot: "bg-apricot/15 text-[#FFC79C] border-apricot/25",
  mint: "bg-mint/15 text-[#A7EFC3] border-mint/25",
  sky: "bg-sky/15 text-[#AEE3FF] border-sky/25",
} as const;

export function Avatar({ name = "", className, tone = "lav" }: { name?: string; className?: string; tone?: keyof typeof AVATAR_TONES }) {
  const letters = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
  return (
    <span
      className={cn("inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold", AVATAR_TONES[tone], className)}
      aria-hidden="true"
    >
      {letters || "—"}
    </span>
  );
}

const BAR_TONES = { lav: "bg-lav", mint: "bg-mint", apricot: "bg-apricot", rose: "bg-rose", sky: "bg-sky" } as const;

export function ProgressBar({ value, tone = "lav", className }: { value: number; tone?: keyof typeof BAR_TONES; className?: string }) {
  return (
    <div
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-white/[0.07]", className)}
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className={cn("h-full rounded-full transition-[width] duration-500", BAR_TONES[tone])} style={{ width: Math.min(100, Math.max(0, value)) + "%" }} />
    </div>
  );
}

export function Field({ label, children, hint, className }: { label: ReactNode; children: ReactNode; hint?: ReactNode; className?: string }) {
  return (
    <label className={cn("block", className)}>
      <span className="text-[11.5px] font-medium uppercase tracking-[0.12em] text-muted-foreground">{label}</span>
      <div className="mt-1.5">{children}</div>
      {hint ? <span className="mt-1 block text-[11.5px] text-muted-foreground/80">{hint}</span> : null}
    </label>
  );
}

export function inputClass(extra?: string): string {
  return cn(
    "h-9 w-full rounded-lg border border-white/[0.12] bg-white/[0.03] px-3 text-[13px] text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-lav/50 focus:bg-white/[0.05]",
    extra
  );
}
