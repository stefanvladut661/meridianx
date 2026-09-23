import type { PlanSummary } from "@/lib/ads/plan-summary";
import { cn } from "@/lib/utils";

/**
 * Reclamele care ies din plan, una sub alta, cu exact textele pe care le
 * primește fiecare. Nu imită interfața Meta sau TikTok — e o fișă, nu o
 * machetă: ce text, ce titlu, ce buton, în ce reclamă.
 */
export function AdsPreview({
  summary,
  rotating,
  className,
}: {
  summary: PlanSummary;
  rotating: boolean;
  className?: string;
}) {
  if (summary.ads.length === 0) {
    return (
      <p className={cn("text-[14px] text-dim", className)}>
        Nicio reclamă încă: planul nu are niciun text principal.
      </p>
    );
  }

  return (
    <ol className={cn("space-y-3", className)}>
      {summary.ads.map((ad, index) => (
        <li key={index} className="rounded-panel border border-hair bg-ink/40">
          <p className="border-b border-hair px-4 py-2.5 font-md-mono text-[11.5px] tracking-wide text-dim">
            <span className="text-bone/85">Reclama {index + 1}</span> · {ad.name}
          </p>
          <div className="space-y-3 px-4 py-4">
            {ad.primaryTexts.map((text, textIndex) => (
              <p key={textIndex} className="whitespace-pre-line text-[14.5px] leading-relaxed text-bone/90">
                {rotating && ad.primaryTexts.length > 1 ? (
                  <span className="mr-2 font-md-mono text-[11px] text-dim">T{textIndex + 1}</span>
                ) : null}
                {text}
              </p>
            ))}
            <div className="flex flex-wrap items-end justify-between gap-3 border-t border-hair pt-3">
              <div className="min-w-0">
                {ad.headlines.map((headline, headlineIndex) => (
                  <p key={headlineIndex} className="text-[14.5px] font-semibold text-bone">
                    {headline}
                  </p>
                ))}
                {ad.descriptions.map((description, descriptionIndex) => (
                  <p key={descriptionIndex} className="text-[13px] text-dim">
                    {description}
                  </p>
                ))}
                {ad.headlines.length === 0 && ad.descriptions.length === 0 ? (
                  <p className="text-[13px] text-dim">Fără titlu și descriere.</p>
                ) : null}
              </div>
              <span className="rounded-full border border-hair-strong px-3.5 py-1.5 text-[13px] font-semibold text-bone">
                {summary.cta ?? "buton neales"}
              </span>
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
