"use client";

import { useId, useState, useTransition } from "react";
import { Film } from "lucide-react";
import type { Platform } from "@/lib/ads/constants";
import type { LibraryResponse, LibraryVideo } from "@/lib/ads/types";
import { asString, getIn } from "@/lib/ads/plan-path";
import { cn } from "@/lib/utils";
import { Btn, Pill } from "../ui/primitives";
import { usePlanForm } from "./fields";
import { formatDuration } from "./check-panel";
import { ERROR_TEXT, LABEL, WARNING_TEXT } from "./tone";

/**
 * „Alege un video deja urcat" — biblioteca contului de reclame din plan.
 *
 * Lista se cere la server doar când omul o deschide (un apel la platformă, cu
 * tokenul spațiului, pentru contul scris în plan). Alegerea scrie id-ul în
 * plan, ca orice altă corectură: JSON-ul din stânga se rescrie singur.
 *
 * Grupul e un set de butoane radio native: săgețile se mișcă între
 * video-uri, Tab iese din listă. Un video pe care platforma încă îl procesează
 * se vede, dar nu se poate alege — o reclamă cu el ar pica la creare.
 */

const date = new Intl.DateTimeFormat("ro-RO", { day: "2-digit", month: "2-digit", year: "2-digit" });

export function VideoLibrary({
  load,
  platform,
  path = "creative.video",
}: {
  load: (adAccount: string) => Promise<LibraryResponse>;
  platform: Platform;
  /** Video-ul din plan pe care îl schimbă alegerea: `creative.video` sau `creative.videos.2`. */
  path?: string;
}) {
  const { draft, update } = usePlanForm();
  const adAccount = asString(getIn(draft, "ad_account"));
  const selected = asString(getIn(draft, `${path}.video_id`));
  const [state, setState] = useState<
    | { status: "closed" }
    | { status: "open"; account: string; videos: LibraryVideo[]; truncated: boolean }
    | { status: "failed"; message: string }
  >({ status: "closed" });
  const [pending, startTransition] = useTransition();
  const legendId = useId();

  const open = () => {
    if (!adAccount) return;
    startTransition(async () => {
      try {
        const result = await load(adAccount);
        setState(
          result.ok
            ? { status: "open", account: adAccount, videos: result.videos, truncated: result.truncated }
            : { status: "failed", message: result.message }
        );
      } catch {
        setState({ status: "failed", message: "Biblioteca nu s-a putut încărca: serverul n-a răspuns. Încearcă din nou." });
      }
    });
  };

  if (state.status !== "open" || state.account !== adAccount) {
    return (
      <div>
        <Btn variant="outline" size="sm" icon={Film} onClick={open} disabled={!adAccount || pending} aria-describedby={`${legendId}-hint`}>
          {pending ? "Se încarcă biblioteca…" : "Alege din biblioteca contului"}
        </Btn>
        <p id={`${legendId}-hint`} className="mt-2 text-[11.5px] leading-snug text-muted-foreground">
          {adAccount
            ? `Video-urile din ${adAccount}, cele mai noi primele.`
            : "Scrie întâi contul de reclame — biblioteca e a contului."}
        </p>
        {state.status === "failed" ? (
          <p role="alert" className={cn("mt-2 text-[12.5px] leading-snug", ERROR_TEXT)}>
            {state.message}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <fieldset aria-labelledby={legendId} className="min-w-0">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p id={legendId} className={LABEL}>
          Biblioteca {state.account} · {state.videos.length === 1 ? "un video" : `${state.videos.length} video-uri`}
        </p>
        <div className="flex gap-3 text-[12px]">
          <button type="button" onClick={open} disabled={pending} className="text-muted-foreground underline underline-offset-4 hover:text-foreground">
            {pending ? "Se reîncarcă…" : "Reîncarcă"}
          </button>
          <button
            type="button"
            onClick={() => setState({ status: "closed" })}
            className="text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            Închide lista
          </button>
        </div>
      </div>

      {state.videos.length === 0 ? (
        <p className="mt-3 rounded-xl border border-dashed border-white/[0.12] px-4 py-5 text-[12.5px] leading-relaxed text-foreground/75">
          Contul n-are încă niciun video. Urcă unul din portal („Fișier nou”) sau din{" "}
          {platform === "tiktok"
            ? "biblioteca de creative din TikTok Ads Manager"
            : platform === "google"
              ? "YouTube Studio (public sau nelistat) ori Google Ads → Materiale"
              : "Ads Manager → Media library"}
          , apoi apasă Reîncarcă.
        </p>
      ) : (
        <div className="mt-3 grid max-h-[26rem] gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
          {state.videos.map((video) => {
            const checked = video.id === selected;
            const duration = formatDuration(video.lengthSeconds);
            return (
              <label
                key={video.id}
                className={cn(
                  "flex min-w-0 items-center gap-3 rounded-xl border p-2.5 transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-lav",
                  checked ? "border-lav/40 bg-lav/[0.08]" : "border-white/[0.09] hover:border-white/20",
                  video.ready ? "cursor-pointer" : "cursor-not-allowed opacity-60"
                )}
              >
                <input
                  type="radio"
                  name={`library-video-${path}`}
                  value={video.id}
                  checked={checked}
                  disabled={!video.ready}
                  onChange={() => update(`${path}.video_id`, video.id)}
                  className="sr-only"
                />
                {video.thumbnailUrl ? (
                  // Miniatură de pe CDN-ul platformei, URL semnat și temporar.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={video.thumbnailUrl}
                    alt=""
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    className="h-12 w-12 shrink-0 rounded-lg border border-white/[0.09] object-cover"
                  />
                ) : (
                  <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/[0.1] bg-white/[0.04]">
                    <Film className="h-4 w-4 text-foreground/50" />
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px]">{video.title ?? "Video fără titlu"}</span>
                  <span className={cn("block font-mono text-[10.5px]", video.ready ? "text-muted-foreground" : WARNING_TEXT)}>
                    {[
                      duration,
                      video.createdAt ? date.format(new Date(video.createdAt)) : null,
                      video.ready ? null : "se procesează",
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
                {!video.ready ? <Pill tone="apricot">nu e gata</Pill> : null}
              </label>
            );
          })}
        </div>
      )}
      {state.truncated ? (
        <p className="mt-2 text-[11.5px] text-muted-foreground">
          Se văd cele mai noi {state.videos.length}. Pentru unul mai vechi, scrie id-ul direct.
        </p>
      ) : null}
    </fieldset>
  );
}
