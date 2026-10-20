import { PLATFORM_LABEL, type Platform } from "@/lib/ads/constants";
import { cn } from "@/lib/utils";

/**
 * Iconița canalului, mică, pe fiecare rând. Singurul loc unde apar culorile
 * platformelor — fără logo-uri mari sau alte elemente de brand (promptul v2).
 * Semne simplificate, nu siglele oficiale: un nod pentru Meta, un „G” în patru
 * culori pentru Google, o notă pentru TikTok.
 *
 * Implicit e decorativă (numele canalului e scris lângă ea sau în filtru);
 * cu `labelled`, cititorul de ecran aude numele canalului.
 */
export function ChannelIcon({
  platform,
  className,
  size = 16,
  labelled = false,
}: {
  platform: Platform;
  className?: string;
  size?: number;
  labelled?: boolean;
}) {
  const a11y = labelled ? { role: "img" as const, "aria-label": PLATFORM_LABEL[platform] } : { "aria-hidden": true as const };
  if (platform === "meta") {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} className={cn("inline-block", className)} {...a11y}>
        <path
          d="M4.5 15.6c0-3.7 1.9-7.6 4.3-7.6 1.6 0 2.7 1.4 4.6 4.6l.7 1.2c1.5 2.5 2.4 3.6 3.6 3.6 1.3 0 2-1.1 2-3 0-2.9-1.4-6.4-3.2-6.4-1.2 0-2.2 1.2-3.5 3.3M4.5 15.6c0 1.7.7 2.8 2 2.8 1.3 0 2.2-.9 4-3.9"
          fill="none"
          stroke="#0866ff"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (platform === "google") {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} className={cn("inline-block", className)} {...a11y}>
        <path d="M20.6 12.2c0-.6-.1-1.2-.2-1.8H12v3.5h4.8a4.2 4.2 0 0 1-1.8 2.7v2.2h2.9c1.7-1.6 2.7-3.9 2.7-6.6Z" fill="#4285f4" />
        <path d="M12 21c2.4 0 4.5-.8 5.9-2.2L15 16.6c-.8.5-1.8.9-3 .9-2.3 0-4.3-1.6-5-3.7H4v2.3A9 9 0 0 0 12 21Z" fill="#34a853" />
        <path d="M7 13.8a5.4 5.4 0 0 1 0-3.5V8H4a9 9 0 0 0 0 8.1l3-2.3Z" fill="#fbbc04" />
        <path d="M12 6.6c1.3 0 2.5.5 3.4 1.3l2.6-2.6A9 9 0 0 0 4 8l3 2.3c.7-2.1 2.7-3.7 5-3.7Z" fill="#ea4335" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={cn("inline-block", className)} {...a11y}>
      <path d="M14.6 3.5h-2.8v11.3a2.5 2.5 0 1 1-2.5-2.5l.6.1V9.5l-.6-.1a5.3 5.3 0 1 0 5.3 5.3V9.1a6.6 6.6 0 0 0 3.8 1.2V7.5a3.8 3.8 0 0 1-3.8-4Z" fill="#25f4ee" transform="translate(-0.7 -0.5)" />
      <path d="M14.6 3.5h-2.8v11.3a2.5 2.5 0 1 1-2.5-2.5l.6.1V9.5l-.6-.1a5.3 5.3 0 1 0 5.3 5.3V9.1a6.6 6.6 0 0 0 3.8 1.2V7.5a3.8 3.8 0 0 1-3.8-4Z" fill="#fe2c55" transform="translate(0.7 0.5)" />
      <path d="M14.6 3.5h-2.8v11.3a2.5 2.5 0 1 1-2.5-2.5l.6.1V9.5l-.6-.1a5.3 5.3 0 1 0 5.3 5.3V9.1a6.6 6.6 0 0 0 3.8 1.2V7.5a3.8 3.8 0 0 1-3.8-4Z" fill="#111111" />
    </svg>
  );
}
