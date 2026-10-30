import { countOf } from "@/lib/ads/plan-derive";
import type { NegativesPreview } from "@/lib/ads/google/account/types";
import { InlineNote } from "@/components/panou/ui/actions";
import { cn } from "@/lib/utils";

/**
 * Previzualizarea negativelor (comună filelor Cont și Termeni): ce se adaugă și
 * unde, ce era deja acolo, ce cuvinte active ar fi blocate și rezultatul
 * verificării `validateOnly` la Google. Nimic nu pleacă spre Google fără ea.
 */
export function NegativePreview({ preview }: { preview: NegativesPreview }) {
  const bad = preview.keywords.filter((item) => item.problem);
  return (
    <div className="space-y-4 rounded-xl border border-white/[0.07] bg-white/[0.025] p-4">
      <h3 className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Previzualizarea</h3>
      {preview.errors.length > 0 ? (
        <InlineNote tone="rose">
          <ul className="space-y-1.5">
            {preview.errors.map((error, index) => (
              <li key={index}>{error}</li>
            ))}
          </ul>
        </InlineNote>
      ) : null}
      {preview.conflicts.length > 0 ? (
        <div>
          <h4 className="text-[12.5px] font-medium">Cuvinte cheie active care ar fi blocate</h4>
          <ul className="mt-2 space-y-1 text-[12px] text-foreground/85">
            {preview.conflicts.slice(0, 60).map((conflict, index) => (
              <li key={index}>
                <span className="font-mono text-[11.5px]">{conflict.keyword}</span>
                {conflict.group ? <span className="text-muted-foreground"> · grupul „{conflict.group}”</span> : null}
                <span className="text-muted-foreground"> · „{conflict.campaign}” · blocat de </span>
                <span className="font-mono text-[11.5px] text-rose">{conflict.negative}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {preview.additions.map((addition) => (
        <div key={addition.where}>
          <h4 className="text-[12.5px] font-medium">
            {addition.where} · {addition.keywords.length}
          </h4>
          {addition.keywords.length > 0 ? (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {addition.keywords.slice(0, 120).map((item) => (
                <li key={item} className="rounded-md border border-white/[0.1] bg-white/[0.04] px-2 py-0.5 font-mono text-[11.5px] text-foreground/90">
                  {item}
                </li>
              ))}
            </ul>
          ) : null}
          {addition.skipped.length > 0 ? (
            <p className="mt-2 text-[11.5px] text-muted-foreground">
              Deja acolo, se sar: {addition.skipped.slice(0, 40).join(", ")}
              {addition.skipped.length > 40 ? ` și încă ${addition.skipped.length - 40}` : ""}.
            </p>
          ) : null}
        </div>
      ))}
      {bad.length > 0 ? (
        <div>
          <h4 className="text-[12.5px] font-medium text-[#FFC79C]">Rânduri care nu se adaugă</h4>
          <ul className="mt-2 space-y-1 text-[12px]">
            {bad.map((item) => (
              <li key={item.line} className="text-foreground/80">
                <span className="font-mono text-[11px] text-muted-foreground">rândul {item.line}</span> <span className="font-mono">{item.raw}</span> — {item.problem}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {preview.warnings.map((warning, index) => (
        <p key={index} className="text-[12px] text-[#FFC79C]">
          {warning}
        </p>
      ))}
      <p className={cn("text-[12px]", preview.ok ? "text-mint" : "text-muted-foreground")}>
        {preview.ok
          ? `${countOf(preview.operations, "operații")} verificate la Google cu validateOnly — le-ar accepta pe toate. Nu s-a schimbat nimic încă.`
          : "Nu se trimite nimic până nu e totul în regulă."}
      </p>
    </div>
  );
}
