"use client";

import { useState } from "react";
import type { Platform } from "@/lib/ads/constants";
import { Card, Pill, SectionTitle, SegmentedControl } from "../ui/primitives";
import { CopyButton } from "../ui/actions";
import { CreativePreview, type Placement, type PreviewCreative } from "./creative-preview";

const PLACEMENTS: Array<{ value: Placement; label: string }> = [
  { value: "Feed", label: "Feed" },
  { value: "Stories", label: "Stories" },
  { value: "Reels", label: "Reels" },
];

/**
 * „Materialul trimis” din prototip: reclama exact cum a plecat la creare, în
 * amplasamentele în care rulează, cu detaliile din plan (video, buton,
 * destinație, public) și linkul destinației de copiat. Totul din planul salvat
 * la creare — nu din ce e azi în Ads Manager.
 */
export function SentMaterial({
  platform,
  creative,
  videos,
  details,
  destination,
}: {
  platform: Platform;
  creative: PreviewCreative;
  videos: string[];
  details: Array<[string, string]>;
  destination: string | null;
}) {
  const [placement, setPlacement] = useState<Placement>("Feed");
  const video = videos.length > 1 ? `${videos.length} video-uri` : (videos[0] ?? null);

  return (
    <Card>
      <SectionTitle title="Materialul trimis" action={<SegmentedControl options={PLACEMENTS} value={placement} onChange={setPlacement} size="sm" ariaLabel="Amplasare" />} />
      <div className="mt-4 flex justify-center">
        <CreativePreview creative={{ ...creative, video }} platform={platform === "google" ? "meta" : platform} placement={placement} className="w-full" />
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">Exact ce a plecat la creare. Plasamentele sunt cele din plan; textele sunt ale primei reclame.</p>
      <dl className="mt-4 divide-y divide-white/[0.05] rounded-xl border border-white/[0.07] text-[12.5px]">
        {details.map(([label, value]) => (
          <div key={label} className="grid gap-1 px-3 py-2 sm:grid-cols-[6.5rem_minmax(0,1fr)]">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="min-w-0 break-words">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {destination ? <CopyButton value={destination} label="Copiază linkul destinație" size="xs" /> : null}
        {videos.slice(0, 3).map((name) => (
          <Pill key={name} tone="neutral" className="font-mono text-[10px]">
            {name}
          </Pill>
        ))}
      </div>
    </Card>
  );
}
