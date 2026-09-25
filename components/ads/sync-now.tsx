"use client";

import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { ERROR_TEXT, OK_TEXT, WARNING_TEXT } from "./tone";

/**
 * Starea sincronizării și „Sincronizează acum”.
 *
 * Cron-ul trage cifrele o dată pe zi; butonul face același lucru la cerere
 * (după o campanie nouă, sau ca să verifici că tokenul merge). Rezultatul
 * se anunță și cititorului de ecran.
 */

export type SyncResponse =
  | { ok: true; status: "ok" | "partial" | "failed"; message: string }
  | { ok: false; message: string };

export function SyncNow({
  lastRun,
  action,
}: {
  /** Propoziția despre ultima rulare, gata scrisă pe server. */
  lastRun: string;
  action: () => Promise<SyncResponse>;
}) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<SyncResponse | null>(null);

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <p className="font-md-mono text-[12px] leading-snug tracking-wide text-dim">{lastRun}</p>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            try {
              setResult(await action());
            } catch {
              setResult({ ok: false, message: "Serverul n-a răspuns. Încearcă din nou." });
            }
          })
        }
        className="btn btn-ghost !min-h-9 !px-4 !py-2 !text-[12.5px] disabled:cursor-wait disabled:opacity-60"
      >
        {pending ? "Se sincronizează…" : "Sincronizează acum"}
      </button>
      <p
        aria-live="polite"
        data-sync-result={result ? (result.ok ? result.status : "error") : undefined}
        className={cn(
          "text-[13px] leading-snug",
          !result
            ? "sr-only"
            : "w-full",
          !result
            ? ""
            : !result.ok || result.status === "failed"
              ? ERROR_TEXT
              : result.status === "partial"
                ? WARNING_TEXT
                : OK_TEXT
        )}
      >
        {result?.message ?? ""}
      </p>
    </div>
  );
}
