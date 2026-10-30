"use client";

import { useRef, useState, useEffect } from "react";
import { Copy, Lock, Pencil, ShieldAlert, Trash2, X } from "lucide-react";
import { KIND_LABEL, type VaultEntry } from "@/lib/vault/entries";
import { Btn, Card, Pill } from "@/components/panou/ui/primitives";
import { ConfirmDialog } from "@/components/panou/ui/actions";
import { relativeRo } from "@/components/panou/ui/format";
import { describeError } from "./errors";
import { VaultField } from "./field";
import { EntryHistory, type HistoryApi } from "./entry-history";

/**
 * Fișa intrării, ca în prototip (EntryPanel): titlu și tip, client și când s-a
 * schimbat, etichete, câmpurile, notițele, istoricul și subsolul „Criptat local”.
 * O intrare ilizibilă se arată ca atare (nu se ascunde) și se poate doar muta în coș.
 */

type OkEntry = Extract<VaultEntry, { status: "ok" }>;

const ICON_BUTTON = "rounded-md p-1.5 text-muted-foreground hover:bg-white/[0.06] hover:text-foreground";

export function EntryPanel({
  entry,
  clientName,
  lastOfClient,
  emailOf,
  historyApi,
  focusOnMount,
  onClose,
  onEdit,
  onDuplicate,
  onDelete,
  onChanged,
  onLock,
}: {
  entry: VaultEntry;
  clientName: string;
  /** E ultima intrare vie a clientului: ștergerea o scoate și pe el din listă. */
  lastOfClient: boolean;
  emailOf: (id: string | null) => string;
  historyApi: HistoryApi;
  /** Pe telefon fișa înlocuiește lista: titlul ei primește focusul. */
  focusOnMount: boolean;
  onClose: () => void;
  onEdit: (entry: OkEntry) => void;
  onDuplicate: (entry: OkEntry) => void;
  onDelete: (entry: VaultEntry, lastOfClient: boolean) => Promise<void>;
  onChanged: () => Promise<void>;
  onLock: () => void;
}) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const ok = entry.status === "ok" ? entry : null;

  useEffect(() => {
    if (focusOnMount) headingRef.current?.focus();
  }, [focusOnMount, entry.id]);

  const title = ok ? ok.payload.title : "Intrare ilizibilă";

  return (
    <Card padded={false} className="overflow-hidden" aria-labelledby={`panel-${entry.id}`}>
      <div className="border-b border-white/[0.06] px-4 py-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 id={`panel-${entry.id}`} ref={headingRef} tabIndex={-1} className="break-words text-[16px] font-semibold outline-none">
                {title}
              </h2>
              {ok ? <Pill tone="neutral">{KIND_LABEL[ok.payload.kind]}</Pill> : <Pill tone="apricot">ilizibil</Pill>}
            </div>
            <p className="mt-1 text-[11.5px] text-muted-foreground">
              {clientName} · actualizat {relativeRo(entry.updatedAt)} · <span className="pu-num font-mono">v{entry.version}</span>
              {entry.updatedBy ? <> · de {emailOf(entry.updatedBy)}</> : null}
            </p>
            {ok && ok.payload.tags.length > 0 ? (
              <ul className="mt-2 flex flex-wrap gap-1" aria-label="Etichete">
                {ok.payload.tags.map((tag) => (
                  <li key={tag}>
                    <Pill tone="lav">#{tag}</Pill>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {ok ? (
              <button type="button" onClick={() => onEdit(ok)} className={ICON_BUTTON} aria-label="Editează intrarea">
                <Pencil className="h-4 w-4" aria-hidden="true" />
              </button>
            ) : null}
            {ok ? (
              <button type="button" onClick={() => onDuplicate(ok)} className={ICON_BUTTON} aria-label="Duplică intrarea">
                <Copy className="h-4 w-4" aria-hidden="true" />
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setDeleteOpen(true)}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-rose/10 hover:text-rose"
              aria-label="Mută în coș"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </button>
            <button type="button" onClick={onClose} className={`${ICON_BUTTON} hidden lg:block`} aria-label="Închide fișa">
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      {error ? (
        <p className="border-b border-rose/20 bg-rose/[0.07] px-4 py-2.5 text-[12px] text-[#FFC2CE]" role="alert">
          {error}
        </p>
      ) : null}

      {!ok && entry.status === "unreadable" ? (
        <div className="px-4 py-6">
          <div className="flex items-start gap-2.5 rounded-xl border border-apricot/25 bg-apricot/[0.06] px-3.5 py-3 text-[12px] leading-relaxed text-[#FFD0AC]">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <div>
              <p className="font-medium">Intrarea e ilizibilă</p>
              <p className="mt-1 text-[#FFD0AC]/80">
                {entry.reason} Rândul există pe server, dar nu se poate decripta cu cheia seifului: a fost alterat sau scris cu altă cheie. Nu se editează. Spune-i echipei înainte
                să o muți în coș.
              </p>
              <p className="mt-2 font-mono text-[10.5px] text-[#FFD0AC]/70">id {entry.id}</p>
            </div>
          </div>
        </div>
      ) : ok ? (
        <div className="px-4 py-2">
          {ok.payload.fields.length === 0 ? <p className="py-6 text-center text-[12px] text-muted-foreground">Intrarea nu are câmpuri. Adaugă unul din editare.</p> : null}
          {ok.payload.fields.map((field, index) => (
            <VaultField key={`${entry.id}:${entry.version}:${index}`} field={field} />
          ))}
          {ok.payload.notes.trim() ? (
            <div className="border-t border-white/[0.06] py-3">
              <p className="text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">Notițe</p>
              <p className="mt-1 whitespace-pre-wrap break-words text-[12px] leading-relaxed text-foreground/80">{ok.payload.notes}</p>
            </div>
          ) : null}
        </div>
      ) : null}

      {ok ? <EntryHistory entry={ok} api={historyApi} emailOf={emailOf} onRestored={onChanged} /> : null}

      <div className="flex items-center gap-2 border-t border-white/[0.06] bg-white/[0.015] px-4 py-2.5">
        <Lock className="h-3 w-3 text-mint" aria-hidden="true" />
        <p className="text-[10.5px] leading-tight text-muted-foreground">Criptat local. Serverul vede doar text cifrat.</p>
        <Btn size="xs" variant="ghost" className="ml-auto" icon={Lock} onClick={onLock}>
          Blochează
        </Btn>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Muți intrarea în coș?"
        description={`${title} · ${clientName}`}
        consequence={
          <>
            Intrarea dispare din listă, dar rămâne în coș. Nu există ștergere definitivă în interfață.
            {lastOfClient ? <> E ultima intrare a clientului {clientName}: dispare și el din listă, iar la restaurare revin împreună.</> : null}
          </>
        }
        confirmLabel="Mută în coș"
        onConfirm={async () => {
          setError(null);
          try {
            await onDelete(entry, lastOfClient);
          } catch (cause) {
            setError(describeError(cause, "Mutarea în coș a eșuat. Încearcă din nou."));
          }
        }}
      />
    </Card>
  );
}
