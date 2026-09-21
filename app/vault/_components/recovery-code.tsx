"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Codul de recuperare, afișat o singură dată (feat/vault, faza 2).
 *
 * 8 grupuri de 5 simboluri Crockford, pe o grilă de 4×2 — se citește
 * ca o plăcuță de serie, nu ca o parolă. Mono, mare, cu spațiu între
 * grupuri: omul îl NOTEAZĂ PE HÂRTIE, iar textul de sub el spune de ce
 * nu în captură de ecran.
 *
 * `Copiază` există pentru cine îl pune într-un manager de parole;
 * confirmarea explicită („l-am notat") e ce deblochează continuarea —
 * fără ea, un clic reflex ar închide singura afișare.
 */
export function RecoveryCode({
  code,
  onConfirm,
  confirmLabel,
}: {
  code: string;
  onConfirm: () => void;
  confirmLabel: string;
}) {
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const groups = code.split("-");
  const timer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard-ul e blocat (permisiuni, HTTP): codul rămâne pe ecran,
      // omul îl transcrie.
      setCopied(false);
    }
  }

  return (
    <div>
      <ol
        aria-label="Codul de recuperare, opt grupuri"
        className="mt-7 grid grid-cols-2 gap-x-3 gap-y-2.5 rounded-panel border border-hair-strong bg-ink/70 p-4 font-md-mono text-[1.375rem] tracking-[0.14em] text-bone sm:grid-cols-4 sm:gap-x-2 sm:text-[1.25rem]"
      >
        {groups.map((group, index) => (
          <li key={index} className="text-center tabular-nums">
            {group}
          </li>
        ))}
      </ol>

      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="font-md-mono text-[11px] tracking-[0.08em] text-dim">
          200 biți · Crockford base32 · fără I, L, O, U
        </p>
        <button
          type="button"
          onClick={copy}
          className="btn btn-ghost !min-h-9 !px-4 !py-2 !text-[12.5px]"
        >
          {copied ? "Copiat" : "Copiază"}
        </button>
      </div>

      <label className="mt-6 flex cursor-pointer items-start gap-3 text-[14.5px] leading-relaxed text-bone">
        <input
          type="checkbox"
          checked={saved}
          onChange={(event) => setSaved(event.target.checked)}
          className="mt-1 h-4 w-4 shrink-0 accent-[#edeef2]"
        />
        <span>L-am notat într-un loc sigur. Știu că nu se mai afișează.</span>
      </label>

      <button
        type="button"
        onClick={onConfirm}
        disabled={!saved}
        className="btn btn-light mt-6 w-full !min-h-12 !text-[15.5px] disabled:pointer-events-none disabled:opacity-60"
      >
        {confirmLabel}
        <span className="arw" aria-hidden>
          →
        </span>
      </button>
    </div>
  );
}
