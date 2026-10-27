"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { IconPause, IconPlay, IconRefresh } from "./icons";
import { btnPrimary, btnSecondary, inputClass, Notice } from "./ui";

type ActionResult = { ok: true; message: string } | { ok: false; message: string };

/**
 * „Oprește coada” / „Pornește coada” și „Rulează acum”. Oprirea cere un motiv
 * scurt (opțional), care apare pe orice ecran, în bara de sus.
 */
export function QueueControls({ running, setQueue, runNow }: { running: boolean; setQueue: (running: boolean, reason: string) => Promise<ActionResult>; runNow: () => Promise<ActionResult> }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<"queue" | "run" | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  function call(kind: "queue" | "run", action: () => Promise<ActionResult>) {
    setBusy(kind);
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await action();
        setMessage({ ok: result.ok, text: result.message });
        if (result.ok) {
          setAsking(false);
          setReason("");
        }
        router.refresh();
      } catch {
        setMessage({ ok: false, text: "Serverul n-a răspuns (rețea sau sesiune). Reîncarcă pagina și încearcă din nou." });
      } finally {
        setBusy(null);
      }
    });
  }

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {running ? (
          asking ? null : (
            <button type="button" onClick={() => setAsking(true)} disabled={pending} className={cn(btnSecondary, "inline-flex items-center gap-2")}>
              <IconPause size={16} />
              Oprește coada
            </button>
          )
        ) : (
          <button type="button" onClick={() => call("queue", () => setQueue(true, ""))} disabled={pending} className={cn(btnPrimary, "inline-flex items-center gap-2")}>
            <IconPlay size={16} />
            {busy === "queue" ? "Se pornește…" : "Pornește coada"}
          </button>
        )}
        <button type="button" onClick={() => call("run", runNow)} disabled={pending} className={cn(btnSecondary, "inline-flex items-center gap-2")} title="O rulare acum, fără să aștepți Supabase Cron. Pleacă doar ce e deja la timp.">
          <IconRefresh size={16} />
          {busy === "run" ? "Rulează…" : "Rulează acum"}
        </button>
      </div>

      {asking ? (
        <form
          className="flex max-w-xl flex-wrap items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            call("queue", () => setQueue(false, reason));
          }}
        >
          <div className="min-w-[14rem] flex-1">
            <label htmlFor="coada-motiv" className="block text-[13px] font-medium text-bone">
              De ce o oprești? (opțional)
            </label>
            <input id="coada-motiv" value={reason} onChange={(event) => setReason(event.currentTarget.value)} maxLength={300} placeholder="ex. schimb descrierile din lotul 2" className={cn(inputClass, "mt-1")} autoFocus />
          </div>
          <button type="submit" disabled={pending} className={btnPrimary}>
            {busy === "queue" ? "Se oprește…" : "Oprește coada"}
          </button>
          <button type="button" onClick={() => setAsking(false)} className={btnSecondary}>
            Renunță
          </button>
        </form>
      ) : null}

      <p role="status" aria-live="polite" className="sr-only">
        {message?.text}
      </p>
      {message ? (
        <Notice tone={message.ok ? "ok" : "error"} className="max-w-3xl">
          {message.text}
        </Notice>
      ) : null}
    </div>
  );
}
