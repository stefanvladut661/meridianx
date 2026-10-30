"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2, PauseCircle, PlayCircle, Plus, Square, Zap } from "lucide-react";
import { Btn, btnClass } from "../ui/primitives";
import { Modal } from "../ui/modal";
import { TextInput } from "../ui/select";
import { useToast, type ToastTone } from "../ui/toast";
import { UNREACHABLE, type ActionResult } from "./shared";

/**
 * Pornirea și oprirea cozii, cu motivul opririi, ca să le folosească și antetul
 * Cozii, și bannerul din layout. Rezultatul vine ca notificare; ecranul își
 * recitește datele după fiecare acțiune.
 */
export function useQueueControl(setQueue: (running: boolean, reason: string) => Promise<ActionResult>, runNow?: () => Promise<ActionResult>) {
  const router = useRouter();
  const { notify } = useToast();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<"queue" | "run" | null>(null);

  function call(kind: "queue" | "run", action: () => Promise<ActionResult>, tone: ToastTone = "default", onOk?: () => void) {
    setBusy(kind);
    startTransition(async () => {
      try {
        const result = await action();
        notify(result.message, result.ok ? tone : "error");
        if (result.ok) onOk?.();
        router.refresh();
      } catch {
        notify(UNREACHABLE, "error");
      } finally {
        setBusy(null);
      }
    });
  }

  return {
    pending,
    busy,
    start: () => call("queue", () => setQueue(true, ""), "default"),
    stop: (reason: string, onOk?: () => void) => call("queue", () => setQueue(false, reason), "warn", onOk),
    run: (onOk?: () => void) => (runNow ? call("run", runNow, "default", onOk) : undefined),
  };
}

/** „Oprești coada?”: motivul e opțional și apare în banner, pe toate ecranele modulului. */
function StopForm({ busy, onCancel, onConfirm }: { busy: boolean; onCancel: () => void; onConfirm: (reason: string) => void }) {
  const [reason, setReason] = useState("");
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onConfirm(reason);
      }}
    >
      <h2 className="text-[16px] font-semibold">Oprești coada?</h2>
      <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">Postările programate rămân pe loc, dar nu mai pleacă nicio rulare. Bannerul apare pe toate ecranele modulului.</p>
      <label className="mt-4 block">
        <span className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Motiv (opțional)</span>
        <TextInput className="mt-1.5" placeholder="ex. verificăm descrierile înainte de plecare" value={reason} maxLength={300} autoFocus onChange={(event) => setReason(event.target.value)} />
      </label>
      <div className="mt-5 flex justify-end gap-2">
        <Btn variant="ghost" onClick={onCancel}>
          Renunță
        </Btn>
        <Btn type="submit" variant="danger" icon={busy ? Loader2 : undefined} disabled={busy}>
          Oprește coada
        </Btn>
      </div>
    </form>
  );
}

/**
 * Acțiunile din antetul Cozii: „Oprește coada” / „Pornește coada”, „Rulează
 * acum” (o rulare a cozii fără să aștepți Supabase Cron: pleacă doar ce e
 * deja la timp) și „Plan nou”.
 */
export function QueueActions({ running, setQueue, runNow }: { running: boolean; setQueue: (running: boolean, reason: string) => Promise<ActionResult>; runNow: () => Promise<ActionResult> }) {
  const control = useQueueControl(setQueue, runNow);
  const [stopOpen, setStopOpen] = useState(false);

  return (
    <>
      <Btn
        size="sm"
        variant={running ? "danger" : "mint"}
        icon={running ? Square : PlayCircle}
        disabled={control.pending}
        onClick={() => (running ? setStopOpen(true) : control.start())}
      >
        {running ? "Oprește coada" : control.busy === "queue" ? "Se pornește…" : "Pornește coada"}
      </Btn>
      <Btn
        size="sm"
        variant="outline"
        icon={control.busy === "run" ? Loader2 : Zap}
        disabled={control.pending || !running}
        title={running ? "O rulare acum, fără să aștepți Supabase Cron. Pleacă doar ce e deja la timp." : "Coada e oprită: pornește-o întâi."}
        onClick={() => control.run()}
      >
        {control.busy === "run" ? "Rulează…" : "Rulează acum"}
      </Btn>
      <Link href="/admin/postari/plan" className={btnClass({ variant: "primary", size: "sm", className: "gap-1.5" })}>
        <Plus className="h-4 w-4" aria-hidden="true" /> Plan nou
      </Link>

      <Modal open={stopOpen} onOpenChange={setStopOpen} label="Oprești coada?">
        <StopForm
          busy={control.busy === "queue"}
          onCancel={() => setStopOpen(false)}
          onConfirm={(reason) => control.stop(reason, () => setStopOpen(false))}
        />
      </Modal>
    </>
  );
}

/**
 * Bannerul cozii oprite, în layout: se vede de pe orice ecran al modulului,
 * cu motivul, cine și când, și „Pornește coada”.
 */
export function QueueBanner({ reason, by, at, setQueue }: { reason: string | null; by: string | null; at: string | null; setQueue: (running: boolean, reason: string) => Promise<ActionResult> }) {
  const control = useQueueControl(setQueue);
  return (
    <div role="alert" className="mb-5 flex flex-col gap-3 rounded-2xl border border-rose/25 bg-rose/[0.08] px-4 py-3.5 sm:flex-row sm:items-center">
      <PauseCircle className="hidden h-4 w-4 shrink-0 text-rose sm:block" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium text-[#FFD6DE]">Coada de postări este oprită</p>
        <p className="text-[11.5px] text-[#FFC2CE]/80">
          {reason || "Fără motiv notat"}
          {by ? ` · oprită de ${by}` : ""}
          {at ? `, ${at}` : ""}. Nimic nu pleacă până nu o pornești.
        </p>
      </div>
      <Btn size="sm" variant="outline" icon={control.busy === "queue" ? Loader2 : PlayCircle} disabled={control.pending} onClick={control.start}>
        {control.busy === "queue" ? "Se pornește…" : "Pornește coada"}
      </Btn>
    </div>
  );
}
