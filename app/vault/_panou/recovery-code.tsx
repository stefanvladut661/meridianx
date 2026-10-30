"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, Check, Copy, Printer } from "lucide-react";
import { Btn } from "@/components/panou/ui/primitives";
import { InlineNote } from "@/components/panou/ui/actions";
import { CLEAR_AFTER_MS, copyWithExpiry, isClipboardSupported } from "../_components/clipboard";

/**
 * Codul de recuperare, afișat O SINGURĂ DATĂ (caseta mint din prototip).
 *
 * 8 grupuri de 5 simboluri Crockford, pe o grilă 4×2: se citește ca o plăcuță
 * de serie, nu ca o parolă. Omul îl notează pe hârtie; „Tipărește” scoate pe
 * hârtie doar codul, nu și restul paginii. Un fișier .txt NU se oferă: un cod
 * care deschide tot seiful n-are ce căuta într-un fișier pe disc.
 *
 * Codul acesta deschide cheia de date fără nicio parolă, deci textul spune
 * limpede și asta: cine îl are, poate intra.
 */

const PRINT_ID = "cod-recuperare-tiparire";

/** Hârtia primește doar codul: restul paginii se ascunde la tipărire. */
const PRINT_CSS = `@media print {
  body * { visibility: hidden !important; }
  #${PRINT_ID}, #${PRINT_ID} * { visibility: visible !important; color: #000 !important; background: #fff !important; border-color: #000 !important; }
  #${PRINT_ID} { position: fixed; left: 0; top: 0; width: 100%; padding: 24px; }
}`;

export function RecoveryCodeBox({ code }: { code: string }) {
  const groups = code.split("-");
  const [copied, setCopied] = useState<"ok" | "failed" | null>(null);
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    []
  );

  async function copy() {
    try {
      await copyWithExpiry(code);
      setCopied("ok");
    } catch {
      setCopied("failed");
    }
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(null), 2500);
  }

  return (
    <div>
      <style>{PRINT_CSS}</style>
      <div id={PRINT_ID}>
        <p className="hidden text-[12px] print:block">MERIDIAN · Vault · cod de recuperare. Păstrează-l pe hârtie, într-un loc sigur. Cine îl are poate deschide seiful.</p>
        <ol
          aria-label="Codul de recuperare, opt grupuri"
          className="grid grid-cols-2 gap-x-3 gap-y-2 rounded-xl border border-mint/25 bg-mint/[0.07] px-3 py-4 text-center font-mono text-[15px] tracking-[0.16em] text-[#B4F2CD] sm:grid-cols-4 sm:text-[16px]"
        >
          {groups.map((group, index) => (
            <li key={index} className="pu-num">
              {group}
            </li>
          ))}
        </ol>
      </div>
      <p className="mt-2 text-[10.5px] text-muted-foreground">200 de biți · Crockford base32 · fără I, L, O, U · liniuțele și literele mici nu contează la introducere</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {isClipboardSupported() ? (
          <Btn size="sm" variant="outline" icon={copied === "ok" ? Check : Copy} onClick={() => void copy()}>
            {copied === "ok" ? `Copiat · se șterge în ${CLEAR_AFTER_MS / 1000} s` : copied === "failed" ? "Nu s-a copiat" : "Copiază"}
          </Btn>
        ) : null}
        <Btn size="sm" variant="outline" icon={Printer} onClick={() => window.print()}>
          Tipărește
        </Btn>
      </div>
      {copied === "failed" ? (
        <p className="mt-2 text-[11px] text-rose" role="status">
          Browserul n-a lăsat copierea. Notează codul de mână.
        </p>
      ) : null}
    </div>
  );
}

/** Avertismentul din prototip, cu adevărul Vault-ului real: codul deschide cheia singur. */
export function RecoveryWarning({ children }: { children?: ReactNode }) {
  return (
    <InlineNote tone="apricot" className="mt-3">
      <span className="flex items-start gap-1.5">
        <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
        <span>
          {children ?? "Ține codul pe hârtie, offline, nu în seif și nu într-o captură de ecran. Cine îl are poate deschide seiful fără parola master. Dacă îl pierzi, îl poți regenera doar cât timp seiful e deschis."}
        </span>
      </span>
    </InlineNote>
  );
}

/**
 * Codul nou într-un dialog care NU se închide singur (Esc, clic pe fundal): e
 * singura afișare. Se închide numai cu confirmarea că a fost notat.
 */
export function RecoveryCodeDialog({
  code,
  title = "Codul nou de recuperare",
  description = "Se afișează o singură dată. Notează-l acum.",
  confirmLabel = "L-am salvat",
  onConfirm,
}: {
  code: string | null;
  title?: string;
  description?: string;
  confirmLabel?: string;
  onConfirm: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (code && !dialog.open) dialog.showModal();
    if (!code && dialog.open) dialog.close();
    setSaved(false);
  }, [code]);

  return (
    <dialog
      ref={ref}
      aria-labelledby="cod-nou-titlu"
      onCancel={(event) => event.preventDefault()}
      className="m-auto w-[min(28rem,calc(100vw-2rem))] max-w-none rounded-[22px] border border-white/[0.09] bg-[#121216] p-6 text-foreground shadow-[0_30px_80px_-30px_rgba(0,0,0,0.95)] backdrop:bg-black/70"
    >
      {code ? (
        <>
          <h2 id="cod-nou-titlu" className="text-[16px] font-semibold">
            {title}
          </h2>
          <p className="text-[12px] text-muted-foreground">{description}</p>
          <div className="mt-4">
            <RecoveryCodeBox code={code} />
          </div>
          <RecoveryWarning />
          <label className="mt-3 flex items-start gap-2 text-[11.5px] text-muted-foreground">
            <input type="checkbox" checked={saved} onChange={(event) => setSaved(event.target.checked)} className="mt-0.5 accent-[#8FE3B0]" />
            L-am notat într-un loc sigur, în afara seifului. Știu că nu se mai afișează.
          </label>
          <div className="mt-4 flex justify-end">
            <Btn variant="primary" size="sm" disabled={!saved} onClick={onConfirm}>
              {confirmLabel}
            </Btn>
          </div>
        </>
      ) : null}
    </dialog>
  );
}
