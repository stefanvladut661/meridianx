import { Heart, MessageCircle, Play, Repeat2 } from "lucide-react";
import type { Platform } from "@/lib/ads/constants";
import { cn } from "@/lib/utils";

export type Placement = "Feed" | "Stories" | "Reels";

export interface PreviewCreative {
  /** Numele video-ului sau al materialului, cum îl vede omul. */
  video?: string | null;
  headline?: string | null;
  body?: string | null;
  cta?: string | null;
  /** Domeniul destinației (doar la Google). */
  site?: string | null;
}

/**
 * Reclama exact cum a plecat, în amplasamentul în care rulează (prototip:
 * `CreativePreview`). Textele vin din plan, nu sunt completate de interfață:
 * ce lipsește rămâne gol, nu inventat.
 */
export function CreativePreview({
  creative,
  platform = "meta",
  placement = "Feed",
  brand = "Meridian Studio",
  className,
}: {
  creative: PreviewCreative;
  platform?: Platform;
  placement?: Placement;
  /** Numele paginii care apare în antet. */
  brand?: string;
  className?: string;
}) {
  if (platform === "google") {
    return (
      <div className={cn("rounded-xl border border-white/[0.08] bg-white p-4 text-[#1a1a1a]", className)}>
        <div className="flex items-center gap-1.5 text-[11px]">
          <span className="rounded bg-[#f1f3f4] px-1 py-0.5 font-semibold">Ad</span>
          <span className="text-[#202124]">{brand}</span>
          {creative.site ? <span className="text-[#5f6368]">· {creative.site}</span> : null}
        </div>
        <p className="mt-1.5 text-[17px] leading-snug text-[#1a0dab]">{creative.headline || "Titlul reclamei"}</p>
        <p className="mt-1 text-[12.5px] leading-relaxed text-[#4d5156]">{creative.body}</p>
        {creative.cta ? <p className="mt-2 inline-block rounded border border-[#dadce0] px-2 py-1 text-[11.5px] text-[#1a73e8]">{creative.cta}</p> : null}
      </div>
    );
  }

  const ratio = placement === "Stories" || placement === "Reels" ? "aspect-[9/16] max-w-[220px]" : "aspect-[4/5] max-w-[300px]";

  return (
    <div className={cn("overflow-hidden rounded-xl border border-white/[0.09] bg-[#0A0A0E]", className)}>
      <div className="flex items-center gap-2 px-3 py-2">
        <span className="h-6 w-6 rounded-full bg-lav/25" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11.5px] font-medium">{brand}</p>
          <p className="text-[9.5px] text-muted-foreground">Promovat · {placement}</p>
        </div>
      </div>
      <div className={cn("relative mx-auto w-full overflow-hidden bg-gradient-to-br from-[#2A2340] via-[#1A1826] to-[#101018]", ratio)}>
        <div className="pu-gridlines absolute inset-0 opacity-20" aria-hidden="true" />
        <div className="absolute inset-0 flex flex-col justify-between p-4">
          <span className="self-start rounded-md border border-white/[0.12] bg-black/30 px-1.5 py-0.5 font-mono text-[9px] text-foreground/70">{creative.video || "fără video"}</span>
          <div>
            <p className="pu-display text-[19px] leading-tight text-foreground">{creative.headline}</p>
            <p className="mt-1.5 line-clamp-3 text-[11px] leading-relaxed text-foreground/65">{creative.body}</p>
          </div>
          <div className="flex items-center justify-between">
            {creative.cta ? <span className="rounded-md bg-lav px-2 py-1 text-[10px] font-semibold text-[#171222]">{creative.cta}</span> : <span />}
            <Play className="h-4 w-4 text-white/40" aria-hidden="true" />
          </div>
        </div>
      </div>
      {/* Fără cifre de reacții: reclama nu a rulat, iar o cifră inventată ar minți. */}
      <div className="flex items-center gap-3 border-t border-white/[0.06] px-3 py-2 text-muted-foreground" aria-hidden="true">
        <Heart className="h-3 w-3" />
        <MessageCircle className="h-3 w-3" />
        <Repeat2 className="h-3 w-3" />
      </div>
    </div>
  );
}
