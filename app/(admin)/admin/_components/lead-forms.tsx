"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { LEAD_STATUSES, type LeadStatus } from "@/lib/validations/lead";
import { STATUS_LABELS } from "@/lib/supabase/types";
import { changeStatus, saveNotes, type PanelState } from "../(dash)/actions";
import { cn } from "@/lib/utils";

/**
 * Controalele de lucru din panou (FAZA 6): schimbarea statusului și notele.
 *
 * Amândouă sunt formulare cu server action — merg și fără JavaScript, iar
 * cu JavaScript primesc stare de „se salvează" și confirmare. Mesajele
 * intră într-un `aria-live`, ca schimbarea să fie anunțată, nu doar
 * colorată.
 */

const initialState: PanelState = { error: null, ok: null };

function Feedback({ state }: { state: PanelState }) {
  return (
    <p aria-live="polite" className="min-h-5 text-xs leading-5">
      {state.error ? <span className="text-accent-2">{state.error}</span> : null}
      {state.ok ? <span className="text-muted">{state.ok}</span> : null}
    </p>
  );
}

/** Butoanele stau într-un copil al formularului: `useFormStatus` citește
 *  contextul formularului părinte, deci în componenta care randează
 *  <form> ar raporta mereu `pending: false`. */
function StatusButtons({ current }: { current: LeadStatus }) {
  const { pending } = useFormStatus();

  return (
    <div className="mt-2.5 flex flex-wrap gap-1.5">
      {LEAD_STATUSES.map((status) => {
        const active = status === current;
        return (
          <button
            key={status}
            type="submit"
            name="status"
            value={status}
            disabled={pending || active}
            aria-current={active ? "true" : undefined}
            className={cn(
              "rounded-sm border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors duration-150",
              active
                ? "cursor-default border-accent bg-s-signal text-s-ink"
                : "border-line text-fg/70 hover:border-muted hover:text-fg",
              pending && !active && "opacity-60"
            )}
          >
            {STATUS_LABELS[status]}
          </button>
        );
      })}
    </div>
  );
}

export function StatusControl({
  leadId,
  current,
}: {
  leadId: string;
  current: LeadStatus;
}) {
  const [state, formAction] = useActionState(changeStatus, initialState);

  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={leadId} />
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
        Status
      </p>
      <StatusButtons current={current} />
      <Feedback state={state} />
    </form>
  );
}

function SaveNotesButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-2 h-9 rounded-sm bg-s-signal px-4 text-sm font-semibold text-s-ink transition-colors duration-150 hover:bg-[#6b93ff] disabled:pointer-events-none disabled:opacity-60"
    >
      {pending ? "Se salvează…" : "Salvează notele"}
    </button>
  );
}

export function NotesControl({
  leadId,
  notes,
}: {
  leadId: string;
  notes: string | null;
}) {
  const [state, formAction] = useActionState(saveNotes, initialState);

  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={leadId} />
      <label
        htmlFor={`notes-${leadId}`}
        className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted"
      >
        Note interne
      </label>
      <textarea
        id={`notes-${leadId}`}
        name="notes"
        rows={5}
        defaultValue={notes ?? ""}
        placeholder="Ce s-a discutat, ce urmează, cine preia."
        className="mt-2 block w-full resize-y rounded-md border border-line bg-surface p-3 text-sm leading-relaxed text-fg placeholder:text-muted focus:border-accent focus:outline-none"
      />
      <SaveNotesButton />
      <Feedback state={state} />
    </form>
  );
}
