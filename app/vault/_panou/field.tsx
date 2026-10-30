"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Copy, Eye, EyeOff, Link2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EntryField } from "@/lib/vault/entries";
import { groupCode, parseTotp, totp } from "@/lib/vault/totp";
import { copyWithExpiry, CLEAR_AFTER_MS, isClipboardSupported } from "../_components/clipboard";
import { Ring } from "./ui";

/**
 * Un câmp din fișa intrării, cu markup-ul din prototip (VaultField + Totp) și
 * regulile Vault-ului real:
 * - secretele stau mascate cu lungime FIXĂ: lungimea parolei e informație;
 * - „Arată” descoperă valoarea 30 s, cu contorul la vedere, apoi o ascunde singur;
 * - „Copiază” nu descoperă nimic; clipboardul se golește după 45 s și la blocare;
 * - câmpul `totp` arată codul viu (RFC 6238, pe WebCrypto), nu seed-ul.
 */

const REVEAL_MS = 30 * 1000;
const MASK = "••••••••••••";

const BUTTON =
  "inline-flex h-6 items-center gap-1 rounded-md border border-white/[0.1] px-1.5 text-[10.5px] text-muted-foreground transition-colors hover:text-foreground";

/** Doar http(s) pleacă într-un link; orice altceva rămâne text (un `javascript:` lipit într-un URL n-are ce căuta într-o ancoră). */
export function safeHref(value: string): string | undefined {
  const trimmed = value.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^[\w.-]+\.[a-z]{2,}(\/|$)/i.test(trimmed)) return `https://${trimmed}`;
  return undefined;
}

/** Copiază cu golire după 45 s; întoarce starea butonului pentru 2,5 secunde. */
function useCopy(): { state: "ok" | "failed" | null; copy: (value: string) => Promise<void> } {
  const [state, setState] = useState<"ok" | "failed" | null>(null);
  const timer = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    []
  );
  async function copy(value: string) {
    try {
      await copyWithExpiry(value);
      setState("ok");
    } catch {
      setState("failed");
    }
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setState(null), 2500);
  }
  return { state, copy };
}

/** Codul 2FA viu: șase cifre în mono, inel care se consumă, copiere. La expirare calculează singur următorul cod. */
export function Totp({ value }: { value: string }) {
  const config = useMemo(() => parseTotp(value), [value]);
  const [state, setState] = useState<{ code: string; remaining: number } | null>(null);
  const { state: copied, copy } = useCopy();

  useEffect(() => {
    if (!config) return;
    let cancelled = false;
    let lastStep = -1;
    const tick = async () => {
      const seconds = Math.floor(Date.now() / 1000);
      const step = Math.floor(seconds / config.period);
      const remaining = config.period - (seconds % config.period);
      if (step !== lastStep) {
        lastStep = step;
        const next = await totp(config, seconds * 1000);
        if (!cancelled) setState({ code: next.code, remaining });
      } else {
        setState((current) => (current ? { ...current, remaining } : current));
      }
    };
    void tick();
    const interval = window.setInterval(() => void tick(), 1000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [config]);

  if (!config) {
    return (
      <p className="text-[12px] text-rose">
        Seed-ul nu e valid: aștept base32 (ex. <code className="font-mono">JBSW Y3DP …</code>) sau un link{" "}
        <code className="font-mono">otpauth://totp/…</code>.
      </p>
    );
  }

  const progress = state ? state.remaining / config.period : 1;
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span
        className="rounded-lg border border-mint/25 bg-mint/[0.08] px-2.5 py-1 font-mono text-[15px] tracking-[0.22em] text-[#B4F2CD]"
        aria-label={state ? `Cod ${state.code}` : "Se calculează codul"}
      >
        {state ? groupCode(state.code) : "··· ···"}
      </span>
      <Ring progress={progress} color={state && state.remaining <= 5 ? "#FFB27A" : "#8FE3B0"} size={22} stroke={2.5} />
      <span className="pu-num text-[10.5px] text-muted-foreground" aria-hidden="true">
        {state?.remaining ?? config.period} s
      </span>
      {isClipboardSupported() ? (
        <button
          type="button"
          disabled={!state}
          className="rounded p-1 text-muted-foreground hover:text-foreground disabled:opacity-50"
          aria-label="Copiază codul 2FA"
          onClick={() => state && void copy(state.code)}
        >
          {copied === "ok" ? <Check className="h-3.5 w-3.5 text-mint" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
        </button>
      ) : null}
      {config.issuer || config.account ? (
        <span className="basis-full text-[10.5px] text-muted-foreground">
          {[config.issuer, config.account].filter(Boolean).join(" · ")}
          {config.algorithm !== "SHA-1" || config.digits !== 6 || config.period !== 30
            ? ` · ${config.algorithm} · ${config.digits} cifre · ${config.period} s`
            : ""}
        </span>
      ) : null}
    </span>
  );
}

export function VaultField({ field }: { field: EntryField }) {
  const [revealedUntil, setRevealedUntil] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const { state: copied, copy } = useCopy();
  const revealed = revealedUntil !== null;
  const isEmpty = field.value.length === 0;
  const isTotp = field.kind === "totp";

  // Ascunderea automată + contorul.
  useEffect(() => {
    if (revealedUntil === null) return;
    setNow(Date.now());
    const interval = window.setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= revealedUntil) setRevealedUntil(null);
    }, 250);
    return () => window.clearInterval(interval);
  }, [revealedUntil]);

  const left = revealedUntil ? Math.max(0, Math.ceil((revealedUntil - now) / 1000)) : 0;
  const href = field.kind === "url" && !field.secret ? safeHref(field.value) : undefined;
  const longText = field.kind === "multiline";

  return (
    <div className="flex flex-wrap items-start justify-between gap-2 border-b border-white/[0.05] py-2.5 last:border-0">
      <div className="min-w-0 flex-1">
        <p className="text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">{field.label || "Fără etichetă"}</p>
        {isEmpty ? (
          <p className="mt-1 text-[12.5px] text-muted-foreground">—</p>
        ) : isTotp ? (
          <div className="mt-1">
            <Totp value={field.value} />
            {revealed ? <p className="mt-2 break-all font-mono text-[11.5px] text-foreground/70">{field.value}</p> : null}
          </div>
        ) : href ? (
          <a href={href} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1.5 break-all text-[12.5px] text-sky hover:underline">
            <Link2 className="h-3 w-3 shrink-0" aria-hidden="true" />
            {field.value}
          </a>
        ) : field.secret ? (
          <p className={cn("mt-1 break-all font-mono text-[12.5px] tracking-[0.06em]", revealed ? "text-foreground" : "text-foreground/50")}>
            {revealed ? <span className={longText ? "whitespace-pre-wrap" : ""}>{field.value}</span> : <span aria-label="valoare ascunsă">{MASK}</span>}
          </p>
        ) : (
          <p className={cn("mt-1 break-all text-[12.5px]", longText ? "whitespace-pre-wrap text-muted-foreground" : "font-mono text-foreground/85")}>{field.value}</p>
        )}
        {revealed ? <p className="mt-1 text-[10px] text-apricot">se ascunde singur în {left}s</p> : null}
        {copied === "failed" ? (
          <p className="mt-1 text-[10px] text-rose" role="status">
            Browserul n-a lăsat copierea. Arată valoarea și copiaz-o cu mâna.
          </p>
        ) : null}
      </div>

      {!isEmpty ? (
        <div className="flex shrink-0 items-center gap-1">
          {field.secret ? (
            <button
              type="button"
              onClick={() => setRevealedUntil(revealed ? null : Date.now() + REVEAL_MS)}
              aria-pressed={revealed}
              className={BUTTON}
              aria-label={revealed ? `Ascunde ${field.label}` : `Arată ${field.label}`}
            >
              {revealed ? <EyeOff className="h-3 w-3" aria-hidden="true" /> : <Eye className="h-3 w-3" aria-hidden="true" />}
              {revealed ? "Ascunde" : isTotp ? "Arată seed-ul" : "Arată"}
            </button>
          ) : null}
          {!isTotp && isClipboardSupported() ? (
            <button type="button" onClick={() => void copy(field.value)} className={BUTTON} aria-label={`Copiază ${field.label}`}>
              {copied === "ok" ? <Check className="h-3 w-3 text-mint" aria-hidden="true" /> : <Copy className="h-3 w-3" aria-hidden="true" />}
              {copied === "ok" ? `${CLEAR_AFTER_MS / 1000}s apoi șters` : copied === "failed" ? "Nu s-a copiat" : "Copiază"}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
