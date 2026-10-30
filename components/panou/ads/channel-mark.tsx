import { Music2, Search } from "lucide-react";
import { PLATFORM_LABEL, type Platform } from "@/lib/ads/constants";
import { cn } from "@/lib/utils";

/** „f”-ul Facebook (lucide-react din proiect nu mai are iconițele de brand), în același stil de contur ca restul. */
function Facebook({ className, "aria-hidden": ariaHidden }: { className?: string; "aria-hidden"?: "true" | boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden={ariaHidden}>
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </svg>
  );
}

/**
 * Canalul, ca în prototip (`ChannelMark`): pătrat cu iconiță colorată și numele.
 * Platformele sunt cele din cod (`meta`, `google`, `tiktok`).
 */
const CHANNELS = {
  meta: { icon: Facebook, tone: "text-sky", ring: "border-sky/25 bg-sky/10" },
  google: { icon: Search, tone: "text-apricot", ring: "border-apricot/25 bg-apricot/10" },
  tiktok: { icon: Music2, tone: "text-lav", ring: "border-lav/25 bg-lav/10" },
} as const;

export function ChannelMark({ platform, size = "md", label = true, className }: { platform: Platform; size?: "sm" | "md"; label?: boolean; className?: string }) {
  const channel = CHANNELS[platform] ?? CHANNELS.meta;
  const Icon = channel.icon;
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span className={cn("flex shrink-0 items-center justify-center rounded-lg border", size === "sm" ? "h-6 w-6" : "h-7 w-7", channel.ring)}>
        <Icon className={cn(size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5", channel.tone)} aria-hidden="true" />
      </span>
      {label ? <span className="text-[12.5px] text-foreground/80">{PLATFORM_LABEL[platform]}</span> : <span className="sr-only">{PLATFORM_LABEL[platform]}</span>}
    </span>
  );
}
