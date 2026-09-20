"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { groupCode, parseTotp, totp, type TotpConfig } from "@/lib/vault/totp";
import { BTN_SM_LIGHT } from "./ui";
import { copyWithExpiry, isClipboardSupported } from "./clipboard";

/**
 * Codul 2FA viu (feat/vault, faza 8), în fișă, pentru un câmp de fel
 * `totp`. Seed-ul rămâne secret — mascat, cu „Arată" ca orice secret;
 * ce se vede e CODUL: șase cifre în mono, cu secundele rămase și un
 * arc care se consumă. Codul de acum e informație reală și perisabilă;
 * arcul nu e decor, e ceasul lui.
 *
 * La expirare se calculează următorul, singur. „Copiază" pune codul
 * curent în clipboard — el oricum moare în cel mult 30 s, dar
 * clipboard-ul se golește tot după 45 s, ca la orice secret.
 */

const RADIUS = 9;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function TotpCode({ value }: { value: string }) {
  const config = useMemo(() => parseTotp(value), [value]);
  const [state, setState] = useState<{ code: string; remaining: number; step: number } | null>(null);
  const [copied, setCopied] = useState<"ok" | "failed" | null>(null);
  const copiedTimer = useRef<number | null>(null);

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
        if (!cancelled) setState(next);
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

  useEffect(() => {
    return () => {
      if (copiedTimer.current !== null) window.clearTimeout(copiedTimer.current);
    };
  }, []);

  async function copy() {
    if (!state) return;
    try {
      await copyWithExpiry(state.code);
      setCopied("ok");
    } catch {
      setCopied("failed");
    }
    if (copiedTimer.current !== null) window.clearTimeout(copiedTimer.current);
    copiedTimer.current = window.setTimeout(() => setCopied(null), 2500);
  }

  if (!config) {
    return (
      <p className="text-[13px] text-[#ff8a8a]">
        Seed-ul nu e valid: aștept base32 (ex. <code className="font-md-mono">JBSW Y3DP …</code>) sau un
        link <code className="font-md-mono">otpauth://totp/…</code>.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <span className="flex items-center gap-3">
        <span
          className="font-md-mono text-[22px] font-medium tracking-[0.12em] text-bone tabular-nums"
          aria-label={state ? `Cod ${state.code}` : "Se calculează codul"}
        >
          {state ? groupCode(state.code) : "··· ···"}
        </span>
        <Countdown config={config} remaining={state?.remaining ?? config.period} />
      </span>
      {isClipboardSupported() ? (
        <button type="button" onClick={() => void copy()} disabled={!state} className={BTN_SM_LIGHT}>
          {copied === "ok" ? "Copiat" : copied === "failed" ? "Nu s-a copiat" : "Copiază codul"}
        </button>
      ) : null}
      {config.issuer || config.account ? (
        <span className="basis-full font-md-mono text-[11px] tracking-[0.04em] text-dim">
          {[config.issuer, config.account].filter(Boolean).join(" · ")}
          {config.algorithm !== "SHA-1" || config.digits !== 6 || config.period !== 30
            ? ` · ${config.algorithm} · ${config.digits} cifre · ${config.period} s`
            : ""}
        </span>
      ) : null}
    </div>
  );
}

/** Arcul care se consumă + secundele. Sub 5 s trece pe chihlimbar. */
function Countdown({ config, remaining }: { config: TotpConfig; remaining: number }) {
  const fraction = remaining / config.period;
  const urgent = remaining <= 5;
  return (
    <span
      className={`inline-flex items-center gap-1.5 font-md-mono text-[11px] tabular-nums ${urgent ? "text-[#f0b429]" : "text-dim"}`}
      aria-hidden
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5 -rotate-90">
        <circle cx="12" cy="12" r={RADIUS} fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="2" />
        <circle
          cx="12"
          cy="12"
          r={RADIUS}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - fraction)}
          style={{ transition: "stroke-dashoffset 900ms linear" }}
        />
      </svg>
      {remaining} s
    </span>
  );
}
