"use client";

import { useActionState, useRef } from "react";
import { useFormStatus } from "react-dom";
import { LEAD_STATUSES, type LeadStatus } from "@/lib/validations/lead";
import { STATUS_LABELS } from "@/lib/supabase/types";
import { changeStatus, saveNotes, type PanelState } from "../(dash)/actions";
import { cn } from "@/lib/utils";
import { FIELD, STATUS_PILL, STATUS_TONE } from "./tone";

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
    <p aria-live="polite" className="mt-2 min-h-5 text-[12.5px] leading-5">
      {state.error ? <span className="text-[#ff8a8a]">{state.error}</span> : null}
      {state.ok ? <span className="text-dim">{state.ok}</span> : null}
    </p>
  );
}

/** Butoanele stau într-un copil al formularului: `useFormStatus` citește
 *  contextul formularului părinte, deci în componenta care randează
 *  <form> ar raporta mereu `pending: false`. */
function StatusButtons({
  current,
  onPick,
}: {
  current: LeadStatus;
  onPick: (status: LeadStatus) => void;
}) {
  const { pending } = useFormStatus();

  return (
    <div className="mt-3 flex flex-wrap gap-2">
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
            onClick={() => onPick(status)}
            className={cn(
              STATUS_PILL,
              "!py-1.5 transition-colors duration-150",
              /* Statusul curent poartă tonul lui din tabel; celelalte sunt
                 opțiuni: contur discret, se aprind la hover. */
              active
                ? cn("cursor-default", STATUS_TONE[status])
                : "border-hair text-dim hover:border-hair-strong hover:text-bone",
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
  const chosenRef = useRef<HTMLInputElement>(null);

  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={leadId} />
      {/* Clicul scrie alegerea aici, înainte ca formularul să plece —
          serverul nu mai depinde de submitter-ul din FormData. Fără
          JavaScript rămâne statusul curent, iar butonul apăsat (name +
          value) e cel care contează; acțiunea ia ultima valoare. */}
      <input
        ref={chosenRef}
        type="hidden"
        name="status"
        defaultValue={current}
      />
      <p className="eyebrow">Status</p>
      <StatusButtons
        current={current}
        onPick={(status) => {
          if (chosenRef.current) chosenRef.current.value = status;
        }}
      />
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
      className="btn btn-light mt-3 !min-h-10 !px-5 !py-2 !text-[13.5px] disabled:pointer-events-none disabled:opacity-60"
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
      <label htmlFor={`notes-${leadId}`} className="eyebrow">
        Note interne
      </label>
      <textarea
        id={`notes-${leadId}`}
        name="notes"
        rows={5}
        defaultValue={notes ?? ""}
        placeholder="Ce s-a discutat, ce urmează, cine preia."
        className={`${FIELD} mt-3 resize-y !rounded-[var(--md-r)] py-3 leading-relaxed`}
      />
      <SaveNotesButton />
      <Feedback state={state} />
    </form>
  );
}
