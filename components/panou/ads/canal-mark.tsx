import { Infinity as InfinityIcon, Music2, Search } from "lucide-react";
import { PLATFORM_LABEL, type Platform } from "@/lib/ads/constants";
import { cn } from "@/lib/utils";

/**
 * Semnul canalului, ca în redesign (ChannelMark): un pătrat rotunjit cu
 * iconița canalului în culoarea lui de accent (Meta sky, Google apricot, TikTok lav).
 * Fără `label`, numele rămâne pentru cititorul de ecran.
 */
const CHANNELS: Record<Platform, { icon: typeof InfinityIcon; tone: string; ring: string }> = {
  meta: { icon: InfinityIcon, tone: "text-sky", ring: "border-sky/25 bg-sky/10" },
  google: { icon: Search, tone: "text-apricot", ring: "border-apricot/25 bg-apricot/10" },
  tiktok: { icon: Music2, tone: "text-lav", ring: "border-lav/25 bg-lav/10" },
};

export function CanalMark({ platform, size = "md", label = true, className }: { platform: Platform; size?: "sm" | "md"; label?: boolean; className?: string }) {
  const channel = CHANNELS[platform];
  const Icon = channel.icon;
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span className={cn("flex items-center justify-center rounded-lg border", size === "sm" ? "h-6 w-6" : "h-7 w-7", channel.ring)}>
        <Icon className={cn(size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5", channel.tone)} aria-hidden="true" />
      </span>
      {label ? <span className="text-[12.5px] text-foreground/80">{PLATFORM_LABEL[platform]}</span> : <span className="sr-only">{PLATFORM_LABEL[platform]}</span>}
    </span>
  );
}
