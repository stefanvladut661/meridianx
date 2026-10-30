"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { changeStatus, removeLead, saveNotes, type PanelState } from "@/app/(admin)/admin/(dash)/actions";
import type { LeadStatus } from "@/lib/validations/lead";
import { cn } from "@/lib/utils";
import { Btn, Pill } from "../ui/primitives";
import { ConfirmDialog } from "../ui/actions";
import { useToast } from "../ui/toast";
import { STATUS_ORDER, statusLabel } from "./labels";

/**
 * Controalele de lucru din fișă. Rămân formulare cu acțiune de server (cele existente,
 * cu garda de sesiune din ele): statusul și notele merg și fără JavaScript, iar cu
 * JavaScript primesc stare de „se salvează”, confirmare în notificări și, la eroare,
 * mesajul pe loc (`role="alert"`).
 */

const initial: PanelState = { error: null, ok: null };

function Feedback({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p role="alert" className="mt-2 text-[12px] leading-snug text-rose">
      {error}
    </p>
  );
}

export function StatusControl({ leadId, current }: { leadId: string; current: LeadStatus }) {
  const [state, formAction, pending] = useActionState(changeStatus, initial);
  const { notify } = useToast();
  const chosenRef = useRef<HTMLInputElement>(null);
  const [picked, setPicked] = useState<LeadStatus | null>(null);

  useEffect(() => {
    if (state.ok) notify("Status actualizat.");
  }, [state, notify]);

  // Cât așteaptă serverul, statusul ales se vede deja ales.
  const shown = pending && picked ? picked : current;

  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={leadId} />
      {/* Clicul scrie alegerea aici, înainte ca formularul să plece; acțiunea ia ultima valoare
          din „status”, deci și butonul apăsat (name + value) rămâne o cale validă fără JavaScript. */}
      <input ref={chosenRef} type="hidden" name="status" defaultValue={current} />
      <div className="grid grid-cols-3 gap-1.5">
        {STATUS_ORDER.map((status) => {
          const active = shown === status;
          return (
            <button
              key={status}
              // Statusul curent nu trimite nimic: o a doua alegere a lui n-are ce schimba.
              type={current === status ? "button" : "submit"}
              name="status"
              value={status}
              disabled={pending && !active}
              aria-pressed={active}
              onClick={() => {
                setPicked(status);
                if (chosenRef.current) chosenRef.current.value = status;
              }}
              className={cn(
                "rounded-lg border px-2 py-2 text-[11.5px] transition-colors disabled:opacity-50",
                active ? "border-lav/40 bg-lav/15 text-[#D8CCFF]" : "border-white/[0.09] text-foreground/60 hover:border-white/20 hover:text-foreground"
              )}
            >
              {statusLabel(status)}
            </button>
          );
        })}
      </div>
      <Feedback error={state.error} />
    </form>
  );
}

export const NOTES_MAX = 10_000;

export function NotesControl({ leadId, notes }: { leadId: string; notes: string | null }) {
  const [state, formAction, pending] = useActionState(saveNotes, initial);
  const { notify } = useToast();
  const saved = notes ?? "";
  const [draft, setDraft] = useState(saved);
  const lastSaved = useRef({ id: leadId, text: saved });

  // Datele noi de pe server intră în câmp doar dacă omul n-a început să scrie:
  // reîmprospătarea de la 20 s nu are voie să-i șteargă un rând început.
  useEffect(() => {
    const previous = lastSaved.current;
    if (previous.id !== leadId || draft === previous.text) setDraft(saved);
    lastSaved.current = { id: leadId, text: saved };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `draft` se compară doar în clipa în care vin date noi
  }, [leadId, saved]);

  useEffect(() => {
    if (state.ok) notify("Notițele au fost salvate.");
  }, [state, notify]);

  const dirty = draft !== saved;

  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={leadId} />
      <label htmlFor={`lead-notes-${leadId}`} className="sr-only">
        Note interne
      </label>
      <textarea
        id={`lead-notes-${leadId}`}
        name="notes"
        value={draft}
        maxLength={NOTES_MAX}
        onChange={(event) => setDraft(event.target.value)}
        rows={4}
        placeholder="Ce a spus la telefon, ce urmează, cine sună."
        className="w-full resize-y rounded-xl border border-white/[0.1] bg-white/[0.03] p-3 text-[12.5px] leading-relaxed outline-none placeholder:text-muted-foreground/60 focus:border-lav/50"
      />
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-[10.5px] text-muted-foreground">
          {draft.length.toLocaleString("ro-RO")} / 10.000 caractere
          {dirty ? (
            <Pill tone="apricot" className="ml-2">
              nesalvat
            </Pill>
          ) : null}
        </span>
        <div className="flex items-center gap-1.5">
          {dirty ? (
            <Btn size="xs" variant="ghost" onClick={() => setDraft(saved)}>
              Renunță
            </Btn>
          ) : null}
          <Btn type="submit" size="sm" variant="primary" disabled={!dirty || pending}>
            {pending ? "Se salvează…" : "Salvează notițele"}
          </Btn>
        </div>
      </div>
      <Feedback error={state.error} />
    </form>
  );
}

/**
 * Ștergerea definitivă, cu confirmarea din prototip (tastezi „șterge”). Acțiunea de server
 * cere în plus câmpul `confirm=da`, pe care îl pune abia confirmarea din dialog: un submit
 * rătăcit n-are cum să șteargă nimic. După ștergere, acțiunea te duce înapoi la listă.
 */
export function DeleteControl({
  leadId,
  leadName,
  leadMeta,
  returnTo,
  open,
  onOpenChange,
  className,
}: {
  leadId: string;
  leadName: string;
  /** „Firmă · id”, sub titlul dialogului. */
  leadMeta: string;
  /** Lista cu filtrele curente: acolo ajunge omul după ștergere. */
  returnTo: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  className?: string;
}) {
  const [state, formAction, pending] = useActionState(removeLead, initial);
  const formRef = useRef<HTMLFormElement>(null);
  const confirmRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <form ref={formRef} action={formAction} className={className}>
        <input type="hidden" name="id" value={leadId} />
        <input type="hidden" name="returnTo" value={returnTo} />
        <input ref={confirmRef} type="hidden" name="confirm" defaultValue="" />
        <Feedback error={state.error} />
        {pending ? (
          <p role="status" className="mt-2 text-[12px] text-muted-foreground">
            Se șterge…
          </p>
        ) : null}
      </form>
      <ConfirmDialog
        open={open}
        onOpenChange={onOpenChange}
        title={`Ștergi lead-ul ${leadName}?`}
        description={`${leadMeta}. Dispare din listă, din statistici și din export.`}
        consequence="Acțiunea e definitivă: datele de contact, notele interne și istoricul se pierd, iar clientul nu mai poate fi recuperat din panou."
        confirmLabel="Șterge definitiv"
        requirePhrase="șterge"
        onConfirm={() => {
          if (!confirmRef.current) return;
          confirmRef.current.value = "da";
          formRef.current?.requestSubmit();
          confirmRef.current.value = "";
        }}
      />
    </>
  );
}

/** Butonul „Șterge definitiv” din fișă; deschide dialogul de confirmare. */
export function DeleteButton({ onClick }: { onClick: () => void }) {
  return (
    <Btn size="sm" variant="danger" icon={Trash2} onClick={onClick}>
      Șterge definitiv
    </Btn>
  );
}
