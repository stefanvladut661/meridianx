"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { PLATFORM_LABEL } from "@/lib/ads/constants";
import { formatAmount } from "@/lib/ads/metrics";
import type { PauseRequestResult } from "@/lib/ads/model/pause";
import type { RowFigures } from "@/lib/ads/model/rows";
import type { EntityRow } from "@/lib/ads/model/types";
import { ChannelIcon } from "./channel-icon";
import { IconPause } from "./icons";

type Failure = { ok: false; message: string };

const LEVEL_WORD = { campaign: "campania", group: "grupul", ad: "reclama" } as const;

/**
 * Confirmarea pauzei: lista exactă, cu cheltuiala din perioadă, apoi rezultatul
 * (ce s-a oprit, ce s-a sărit și de ce). Dialog nativ: focusul rămâne înăuntru,
 * Escape îl închide. Pauza oprește cheltuiala; repornirea se face din platformă.
 */
export function PauseDialog({
  entities,
  figures,
  pause,
  onDone,
}: {
  entities: EntityRow[];
  figures: Map<string, RowFigures>;
  pause: (input: { entityIds: string[] }) => Promise<({ ok: true } & PauseRequestResult) | Failure>;
  onDone: (changed: boolean) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [pending, start] = useTransition();
  const [result, setResult] = useState<(({ ok: true } & PauseRequestResult) | Failure) | null>(null);

  useEffect(() => {
    const element = dialog.current;
    if (element && !element.open) element.showModal();
  }, []);

  const changed = Boolean(result && result.ok && result.paused.length > 0);
  const close = () => {
    dialog.current?.close();
    onDone(changed);
  };
  const one = entities.length === 1 ? entities[0] : null;

  return (
    <dialog
      ref={dialog}
      aria-labelledby="pauza-titlu"
      onCancel={(event) => {
        event.preventDefault();
        if (!pending) close();
      }}
      className="w-[min(92vw,34rem)] rounded-xl border border-hair bg-char p-0 text-bone shadow-2xl backdrop:bg-black/30"
    >
      <div className="px-5 py-4">
        <h2 id="pauza-titlu" className="text-[17px] font-semibold">
          {result ? "Pauza" : one ? `Pui pe pauză ${LEVEL_WORD[one.level]}?` : `Pui pe pauză ${entities.length} rânduri?`}
        </h2>

        {!result ? (
          <>
            <p className="mt-1.5 text-[14px] leading-relaxed text-dim">
              Se oprește cheltuiala. Nimic nu se șterge, bugetele rămân cum sunt, iar repornirea o faci tu, din platformă.
            </p>
            <ul className="mt-3 max-h-64 divide-y divide-hair overflow-y-auto rounded-lg border border-hair">
              {entities.map((entity) => (
                <li key={entity.id} className="flex items-center justify-between gap-3 px-3 py-2 text-[13.5px]">
                  <span className="flex min-w-0 items-center gap-2">
                    <ChannelIcon platform={entity.platform} />
                    <span className="sr-only">{PLATFORM_LABEL[entity.platform]}: </span>
                    <span className="truncate font-medium">{entity.name}</span>
                  </span>
                  <span className="shrink-0 tabular-nums text-dim">{formatAmount(figures.get(entity.id)?.spend ?? 0, entity.currency ?? "")} în perioadă</span>
                </li>
              ))}
            </ul>
          </>
        ) : result.ok ? (
          <div role="status" className="mt-2 grid gap-3 text-[14px] leading-relaxed">
            {result.paused.length > 0 ? (
              <p className="text-[var(--ap-ok)]">
                {result.paused.length === 1 ? `„${result.paused[0].name}” e pe pauză.` : `${result.paused.length} rânduri sunt pe pauză.`} Se vede imediat în
                tabel; platforma o confirmă la următoarea actualizare.
              </p>
            ) : null}
            {result.skipped.length > 0 ? (
              <div>
                <p className="font-semibold">Sărite:</p>
                <ul className="mt-1 list-disc pl-5 text-dim">
                  {result.skipped.map((item) => (
                    <li key={item.id}>
                      {item.name} — {item.why}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {result.problems.length > 0 ? (
              <ul className="list-disc pl-5 text-[var(--ap-error)]">
                {result.problems.map((problem) => (
                  <li key={problem}>{problem}</li>
                ))}
              </ul>
            ) : null}
            {result.paused.length === 0 && result.skipped.length === 0 && result.problems.length === 0 ? <p className="text-dim">Nimic de pus pe pauză.</p> : null}
          </div>
        ) : (
          <p role="alert" className="mt-2 text-[14px] text-[var(--ap-error)]">
            {result.message}
          </p>
        )}
      </div>

      <div className="flex justify-end gap-2 border-t border-hair bg-char px-5 py-3">
        {result ? (
          <button type="button" onClick={close} autoFocus className="btn btn-light !min-h-10 !px-4 !py-2 !text-[13.5px]">
            Închide
          </button>
        ) : (
          <>
            <button type="button" onClick={close} disabled={pending} className="btn btn-ghost !min-h-10 !px-4 !py-2 !text-[13.5px]">
              Renunță
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  setResult(await pause({ entityIds: entities.map((entity) => entity.id) }));
                })
              }
              className="btn btn-light !min-h-10 !gap-1.5 !px-4 !py-2 !text-[13.5px]"
            >
              <IconPause size={15} />
              {pending ? "Se trimite…" : entities.length === 1 ? "Pune pe pauză" : `Pune pe pauză (${entities.length})`}
            </button>
          </>
        )}
      </div>
    </dialog>
  );
}
