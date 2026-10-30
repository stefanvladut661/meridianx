"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { PauseCircle } from "lucide-react";
import { PLATFORM_LABEL } from "@/lib/ads/constants";
import { formatAmount } from "@/lib/ads/metrics";
import type { PauseRequestResult } from "@/lib/ads/model/pause";
import type { RowFigures } from "@/lib/ads/model/rows";
import type { EntityRow } from "@/lib/ads/model/types";
import { Btn } from "../ui/primitives";
import { ChannelMark } from "./channel-mark";

type Failure = { ok: false; message: string };

const LEVEL_WORD = { campaign: "campania", group: "grupul", ad: "reclama" } as const;

/**
 * Confirmarea pauzei, ca `ConfirmDialog` din prototip: lista exactă, cu
 * cheltuiala din perioadă, apoi rezultatul (ce s-a oprit, ce s-a sărit și de
 * ce). Dialog nativ: focusul rămâne înăuntru, Escape îl închide (nu și cât
 * trimite cererea). Pauza oprește cheltuiala; nimic nu se șterge, bugetele
 * rămân cum sunt, iar repornirea se face din platformă.
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
      className="m-auto w-[min(34rem,calc(100vw-2rem))] max-w-none rounded-[22px] border border-white/[0.09] bg-[#121216] p-6 text-foreground shadow-[0_30px_80px_-30px_rgba(0,0,0,0.95)] backdrop:bg-black/70"
    >
      <h2 id="pauza-titlu" className="text-[17px] font-semibold">
        {result ? "Pauza" : one ? `Pui pe pauză ${LEVEL_WORD[one.level]}?` : `Pui pe pauză ${entities.length} rânduri?`}
      </h2>

      {!result ? (
        <>
          <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
            Se oprește cheltuiala. Nimic nu se șterge, bugetele rămân cum sunt, iar repornirea o faci tu, din platformă.
          </p>
          <ul className="mt-4 max-h-64 divide-y divide-white/[0.05] overflow-y-auto rounded-xl border border-white/[0.07]">
            {entities.map((entity) => (
              <li key={entity.id} className="flex items-center justify-between gap-3 px-3 py-2 text-[12.5px]">
                <span className="flex min-w-0 items-center gap-2">
                  <ChannelMark platform={entity.platform} size="sm" label={false} />
                  <span className="sr-only">{PLATFORM_LABEL[entity.platform]}: </span>
                  <span className="truncate font-medium">{entity.name}</span>
                </span>
                <span className="pu-num shrink-0 text-muted-foreground">{formatAmount(figures.get(entity.id)?.spend ?? 0, entity.currency ?? "")} în perioadă</span>
              </li>
            ))}
          </ul>
        </>
      ) : result.ok ? (
        <div role="status" className="mt-3 grid gap-3 text-[13px] leading-relaxed">
          {result.paused.length > 0 ? (
            <p className="rounded-xl border border-mint/25 bg-mint/[0.07] px-3.5 py-3 text-[12.5px] text-[#B4F2CD]">
              {result.paused.length === 1 ? `„${result.paused[0].name}” e pe pauză.` : `${result.paused.length} rânduri sunt pe pauză.`} Se vede imediat în tabel; platforma o confirmă la
              următoarea actualizare.
            </p>
          ) : null}
          {result.skipped.length > 0 ? (
            <div className="rounded-xl border border-apricot/25 bg-apricot/[0.07] px-3.5 py-3 text-[12.5px] text-[#FFD0AC]">
              <p className="font-medium">Sărite:</p>
              <ul className="mt-1 list-disc pl-5">
                {result.skipped.map((item) => (
                  <li key={item.id}>
                    {item.name} — {item.why}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {result.problems.length > 0 ? (
            <ul className="list-disc rounded-xl border border-rose/25 bg-rose/[0.07] py-3 pl-8 pr-3.5 text-[12.5px] text-[#FFC2CE]">
              {result.problems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          ) : null}
          {result.paused.length === 0 && result.skipped.length === 0 && result.problems.length === 0 ? <p className="text-muted-foreground">Nimic de pus pe pauză.</p> : null}
        </div>
      ) : (
        <p role="alert" className="mt-3 rounded-xl border border-rose/25 bg-rose/[0.07] px-3.5 py-3 text-[12.5px] text-[#FFC2CE]">
          {result.message}
        </p>
      )}

      <div className="mt-5 flex flex-row justify-end gap-2">
        {result ? (
          <Btn variant="primary" onClick={close} autoFocus>
            Închide
          </Btn>
        ) : (
          <>
            <Btn variant="ghost" onClick={close} disabled={pending}>
              Renunță
            </Btn>
            <Btn
              variant="primary"
              icon={PauseCircle}
              disabled={pending}
              onClick={() =>
                start(async () => {
                  setResult(await pause({ entityIds: entities.map((entity) => entity.id) }));
                })
              }
            >
              {pending ? "Se trimite…" : entities.length === 1 ? "Pune pe pauză" : `Pune pe pauză (${entities.length})`}
            </Btn>
          </>
        )}
      </div>
    </dialog>
  );
}
