"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { EntryField } from "@/lib/vault/entries";
import { BTN_SM, BTN_SM_LIGHT } from "./ui";
import { CLEAR_AFTER_MS, copyWithExpiry, isClipboardSupported } from "./clipboard";
import { TotpCode } from "./totp-code";

/**
 * Un câmp din fișa intrării (feat/vault, fazele 3 și 8).
 *
 * Secretele stau MASCATE cu lungime fixă — douăsprezece puncte,
 * indiferent de parolă. Lungimea reală e informație (o parolă de 6 e
 * altceva decât una de 30), și nu se dă nici măcar peste umăr.
 *
 * „Arată" descoperă valoarea pentru 30 de secunde, cu contorul la
 * vedere: nu e decor, e exact cât timp mai stă pe ecran. „Copiază" nu
 * descoperă nimic — pune valoarea în clipboard, de unde dispare după
 * 45 s (`clipboard.ts`). Cele două sunt independente: de regulă omul
 * copiază fără să se uite.
 *
 * Așezare: eticheta și acțiunile pe același rând, valoarea pe rândul
 * de sub ele, pe toată lățimea — URL-urile și cheile API sunt lungi și
 * n-au ce împărți cu două butoane.
 *
 * Câmpul `totp` (faza 8): ce se vede e codul viu (`TotpCode`), cu
 * propriul „Copiază codul"; seed-ul stă mascat sub el și se descoperă
 * cu „Arată seed-ul", ca orice secret. Nu există „Copiază" pe seed —
 * nimeni nu-l lipește nicăieri, se scanează sau se tastează o dată.
 */

const REVEAL_MS = 30 * 1000;
const MASK = "••••••••••••";

export function EntryFieldRow({ field }: { field: EntryField }) {
  const id = useId();
  const [revealedUntil, setRevealedUntil] = useState<number | null>(null);
  const [copied, setCopied] = useState<"ok" | "failed" | null>(null);
  const copiedTimer = useRef<number | null>(null);
  const revealed = revealedUntil !== null;

  // Ascunderea automată + contorul.
  const [now, setNow] = useState(() => Date.now());
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

  useEffect(() => {
    return () => {
      if (copiedTimer.current !== null) window.clearTimeout(copiedTimer.current);
    };
  }, []);

  async function copy() {
    try {
      await copyWithExpiry(field.value);
      setCopied("ok");
    } catch {
      setCopied("failed");
    }
    if (copiedTimer.current !== null) window.clearTimeout(copiedTimer.current);
    copiedTimer.current = window.setTimeout(() => setCopied(null), 2500);
  }

  const secondsLeft = revealedUntil ? Math.max(0, Math.ceil((revealedUntil - now) / 1000)) : 0;
  const isEmpty = field.value.length === 0;

  return (
    <div className="border-t border-hair py-3.5 first:border-t-0 first:pt-0">
      <div className="flex items-center justify-between gap-3">
        <p id={id} className="eyebrow min-w-0 truncate !text-[11px]">
          {field.label}
        </p>
        {!isEmpty ? (
          <div className="flex shrink-0 items-center gap-1.5">
            {field.secret ? (
              <button
                type="button"
                onClick={() => setRevealedUntil(revealed ? null : Date.now() + REVEAL_MS)}
                aria-pressed={revealed}
                className={BTN_SM}
              >
                {revealed ? "Ascunde" : field.kind === "totp" ? "Arată seed-ul" : "Arată"}
              </button>
            ) : null}
            {isClipboardSupported() && field.kind !== "totp" ? (
              <button
                type="button"
                onClick={() => void copy()}
                className={field.secret ? BTN_SM_LIGHT : BTN_SM}
              >
                {copied === "ok" ? "Copiat" : copied === "failed" ? "Nu s-a copiat" : "Copiază"}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="mt-1.5">
        {isEmpty ? (
          <span className="text-[14px] text-dim">—</span>
        ) : field.kind === "totp" ? (
          <>
            <TotpCode value={field.value} />
            <span
              aria-labelledby={id}
              className="mt-2 block break-all font-md-mono text-[12.5px] leading-relaxed text-dim"
            >
              {revealed ? field.value : <span aria-label="seed ascuns">{MASK}</span>}
            </span>
          </>
        ) : field.secret ? (
          <span
            aria-labelledby={id}
            className="block break-all font-md-mono text-[14px] leading-relaxed text-bone"
          >
            {revealed ? field.value : <span aria-label="valoare ascunsă">{MASK}</span>}
          </span>
        ) : field.kind === "url" ? (
          <a
            href={safeHref(field.value)}
            target="_blank"
            rel="noopener noreferrer"
            className="break-all font-md-mono text-[14px] leading-relaxed text-bone underline decoration-hair-strong underline-offset-4 transition-colors hover:decoration-bone"
          >
            {field.value}
          </a>
        ) : field.kind === "multiline" ? (
          <p className="whitespace-pre-wrap break-words text-[14.5px] leading-relaxed text-bone">
            {field.value}
          </p>
        ) : (
          <span className="block break-all font-md-mono text-[14px] leading-relaxed text-bone">
            {field.value}
          </span>
        )}
      </div>

      {revealed ? (
        <p className="mt-1.5 font-md-mono text-[11px] tracking-[0.06em] text-[#f0b429] tabular-nums">
          se ascunde în {secondsLeft} s
        </p>
      ) : null}
      {copied === "ok" && field.secret ? (
        <p className="mt-1.5 font-md-mono text-[11px] tracking-[0.06em] text-dim" role="status">
          în clipboard · se golește după {CLEAR_AFTER_MS / 1000} s
        </p>
      ) : null}
      {copied === "failed" ? (
        <p className="mt-1.5 text-[13px] text-[#ff8a8a]" role="status">
          Browserul n-a lăsat copierea. Arată valoarea și copiaz-o cu mâna.
        </p>
      ) : null}
    </div>
  );
}

/** Doar http(s) pleacă într-un link; orice altceva rămâne text (un
    `javascript:` lipit într-un URL n-are ce căuta într-o ancoră). */
function safeHref(value: string): string | undefined {
  const trimmed = value.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^[\w.-]+\.[a-z]{2,}(\/|$)/i.test(trimmed)) return `https://${trimmed}`;
  return undefined;
}
