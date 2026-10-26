"use client";

import { useState } from "react";
import { IconExternal, IconPlay } from "./icons";

/**
 * Clipul, în playerul Drive-ului. Se încarcă doar la „Vezi clipul” (un plan
 * cu 30 de clipuri nu deschide 30 de playere). Merge cu contul Google din
 * browser, cel care are acces la folder. Sub el, „Deschide în Drive”.
 */
export function ClipPreview({ fileId, name, compact = false }: { fileId: string; name: string; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const view = `https://drive.google.com/file/d/${fileId}/view`;

  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <button type="button" onClick={() => setOpen(true)} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-hair-strong bg-white px-3 text-[13px] font-medium text-bone hover:bg-[var(--ap-hover)]">
          <IconPlay size={15} />
          Vezi clipul
        </button>
        {!compact ? (
          <a href={view} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[13px] text-dim underline-offset-2 hover:text-bone hover:underline">
            Deschide în Drive
            <IconExternal size={14} />
            <span className="sr-only">(filă nouă)</span>
          </a>
        ) : null}
      </div>
    );
  }

  return (
    <div className="grid gap-1.5">
      <div className="aspect-[9/16] w-[200px] max-w-full overflow-hidden rounded-lg border border-hair bg-[var(--ap-side)]">
        <iframe src={`https://drive.google.com/file/d/${fileId}/preview`} title={`Clipul ${name}`} allow="autoplay; fullscreen" className="h-full w-full" />
      </div>
      <div className="flex flex-wrap items-center gap-x-3">
        <button type="button" onClick={() => setOpen(false)} className="text-[13px] text-dim underline underline-offset-2 hover:text-bone">
          Ascunde
        </button>
        <a href={view} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[13px] text-dim underline-offset-2 hover:text-bone hover:underline">
          Deschide în Drive
          <IconExternal size={14} />
          <span className="sr-only">(filă nouă)</span>
        </a>
      </div>
    </div>
  );
}
