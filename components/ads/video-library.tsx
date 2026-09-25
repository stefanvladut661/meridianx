"use client";

import { useId, useState, useTransition } from "react";
import type { Platform } from "@/lib/ads/constants";
import type { LibraryResponse, LibraryVideo } from "@/lib/ads/types";
import { asString, getIn } from "@/lib/ads/plan-path";
import { cn } from "@/lib/utils";
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
}: {
  load: (adAccount: string) => Promise<LibraryResponse>;
  platform: Platform;
}) {
  const { draft, update } = usePlanForm();
  const adAccount = asString(getIn(draft, "ad_account"));
  const selected = asString(getIn(draft, "creative.video.video_id"));
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
        <button
          type="button"
          onClick={open}
          disabled={!adAccount || pending}
          aria-describedby={`${legendId}-hint`}
          className="btn btn-ghost !min-h-10 !px-4 !py-2 !text-[13px] disabled:cursor-not-allowed disabled:opacity-45"
        >
          {pending ? "Se încarcă biblioteca…" : "Alege din biblioteca contului"}
        </button>
        <p id={`${legendId}-hint`} className="mt-2 text-[12.5px] leading-snug text-dim">
          {adAccount
            ? `Video-urile din ${adAccount}, cele mai noi primele.`
            : "Scrie întâi contul de reclame — biblioteca e a contului."}
        </p>
        {state.status === "failed" ? (
          <p role="alert" className={cn("mt-2 text-[13.5px] leading-snug", ERROR_TEXT)}>
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
        <div className="flex gap-3 text-[13px]">
          <button type="button" onClick={open} disabled={pending} className="text-dim underline underline-offset-4 hover:text-bone">
            {pending ? "Se reîncarcă…" : "Reîncarcă"}
          </button>
          <button
            type="button"
            onClick={() => setState({ status: "closed" })}
            className="text-dim underline underline-offset-4 hover:text-bone"
          >
            Închide lista
          </button>
        </div>
      </div>

      {state.videos.length === 0 ? (
        <p className="mt-3 rounded-panel border border-dashed border-hair-strong px-4 py-5 text-[14px] leading-relaxed text-bone/75">
          Contul n-are încă niciun video. Urcă unul din portal („Fișier nou”) sau din{" "}
          {platform === "tiktok" ? "biblioteca de creative din TikTok Ads Manager" : "Ads Manager → Media library"}, apoi
          apasă Reîncarcă.
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
                  "flex min-w-0 items-center gap-3 rounded-panel-sm border px-2.5 py-2.5 transition-colors duration-150 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-bone",
                  checked ? "border-bone bg-glass" : "border-hair hover:border-hair-strong",
                  video.ready ? "cursor-pointer" : "cursor-not-allowed opacity-60"
                )}
              >
                <input
                  type="radio"
                  name="library-video"
                  value={video.id}
                  checked={checked}
                  disabled={!video.ready}
                  onChange={() => update("creative.video.video_id", video.id)}
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
                    className="h-12 w-12 shrink-0 rounded-[6px] border border-hair object-cover"
                  />
                ) : (
                  <span aria-hidden className="h-12 w-12 shrink-0 rounded-[6px] border border-dashed border-hair-strong" />
                )}
                <span className="min-w-0">
                  <span className="block truncate text-[14px] text-bone">{video.title ?? "Video fără titlu"}</span>
                  <span className={cn("block font-md-mono text-[11.5px]", video.ready ? "text-dim" : WARNING_TEXT)}>
                    {[
                      duration,
                      video.createdAt ? date.format(new Date(video.createdAt)) : null,
                      video.ready ? null : "se procesează",
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      )}
      {state.truncated ? (
        <p className="mt-2 text-[12.5px] text-dim">
          Se văd cele mai noi {state.videos.length}. Pentru unul mai vechi, scrie id-ul direct.
        </p>
      ) : null}
    </fieldset>
  );
}
