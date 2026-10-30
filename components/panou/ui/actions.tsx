"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, Copy, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Btn, type BtnSize, type BtnVariant } from "./primitives";
import { Modal } from "./modal";

/**
 * „Copiază”: pune valoarea în clipboard, arată „Copiat” două secunde și, cu
 * `clearAfter` (secunde), golește clipboardul după timp — pentru secrete.
 */
export function CopyButton({
  value,
  label = "Copiază",
  copiedLabel = "Copiat",
  clearAfter,
  className,
  size = "sm",
  variant = "outline",
  icon = true,
}: {
  value: string | null | undefined;
  label?: string;
  copiedLabel?: string;
  clearAfter?: number;
  className?: string;
  size?: BtnSize;
  variant?: BtnVariant;
  icon?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [left, setLeft] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      if (tick.current) clearInterval(tick.current);
    },
    []
  );

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value ?? "");
    } catch {
      /* clipboardul poate fi blocat într-un iframe; arătăm totuși confirmarea */
    }
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 2200);
    if (clearAfter) {
      setLeft(clearAfter);
      if (tick.current) clearInterval(tick.current);
      tick.current = setInterval(() => {
        setLeft((current) => {
          if (current <= 1) {
            if (tick.current) clearInterval(tick.current);
            navigator.clipboard.writeText("").catch(() => undefined);
            setCopied(false);
            return 0;
          }
          return current - 1;
        });
      }, 1000);
    }
  };

  return (
    <Btn size={size} variant={variant} onClick={copy} className={className} icon={icon ? (copied ? Check : Copy) : undefined} aria-label={`${label}: ${value ? "copiază valoarea" : "gol"}`}>
      {copied ? (clearAfter ? `${copiedLabel} · se șterge în ${left}s` : copiedLabel) : label}
    </Btn>
  );
}

/**
 * Confirmare pentru acțiuni care nu se pot anula: spune consecința, cere opțional o
 * frază de tastat și nu se închide până nu s-a terminat acțiunea.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  consequence,
  confirmLabel = "Confirmă",
  cancelLabel = "Renunță",
  tone = "danger",
  onConfirm,
  requirePhrase,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  consequence?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "primary";
  onConfirm?: () => void | Promise<void>;
  requirePhrase?: string;
  children?: ReactNode;
}) {
  const [phrase, setPhrase] = useState("");
  const [busy, setBusy] = useState(false);
  const blocked = requirePhrase ? phrase.trim() !== requirePhrase : false;

  useEffect(() => {
    if (open) {
      setPhrase("");
      setBusy(false);
    }
  }, [open]);

  return (
    <Modal open={open} onOpenChange={onOpenChange} label={typeof title === "string" ? title : undefined}>
      <div className="space-y-2 text-left">
        <h2 className="text-[17px] font-semibold">{title}</h2>
        {description ? <p className="text-[13px] leading-relaxed text-muted-foreground">{description}</p> : null}
      </div>

      {consequence ? (
        <p className="mt-3 rounded-xl border border-rose/20 bg-rose/[0.07] px-3.5 py-3 text-[12.5px] leading-relaxed text-[#FFC2CE]">{consequence}</p>
      ) : null}

      {children}

      {requirePhrase ? (
        <div className="mt-4">
          <label htmlFor="confirm-phrase" className="text-[12px] text-muted-foreground">
            Scrie <span className="font-mono text-foreground">{requirePhrase}</span> ca să confirmi
          </label>
          <input
            id="confirm-phrase"
            value={phrase}
            onChange={(event) => setPhrase(event.target.value)}
            className="mt-1.5 h-9 w-full rounded-lg border border-white/[0.12] bg-white/[0.03] px-3 text-[13px] outline-none focus:border-lav/50"
            autoComplete="off"
          />
        </div>
      ) : null}

      <div className="mt-5 flex flex-row justify-end gap-2">
        <Btn variant="ghost" onClick={() => onOpenChange(false)}>
          {cancelLabel}
        </Btn>
        <Btn
          variant={tone === "danger" ? "danger" : "primary"}
          disabled={blocked || busy}
          icon={busy ? Loader2 : undefined}
          onClick={async () => {
            setBusy(true);
            try {
              await onConfirm?.();
            } finally {
              setBusy(false);
            }
            onOpenChange(false);
          }}
        >
          {confirmLabel}
        </Btn>
      </div>
    </Modal>
  );
}

const NOTE_TONES = {
  apricot: "border-apricot/25 bg-apricot/[0.07] text-[#FFD0AC]",
  rose: "border-rose/25 bg-rose/[0.07] text-[#FFC2CE]",
  mint: "border-mint/25 bg-mint/[0.07] text-[#B4F2CD]",
  neutral: "border-white/[0.09] bg-white/[0.04] text-muted-foreground",
} as const;

export function InlineNote({ tone = "apricot", children, className }: { tone?: keyof typeof NOTE_TONES; children: ReactNode; className?: string }) {
  return <div className={cn("rounded-xl border px-3.5 py-3 text-[12.5px] leading-relaxed", NOTE_TONES[tone], className)}>{children}</div>;
}
