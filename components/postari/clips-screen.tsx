"use client";

import { useRef, useState } from "react";
import type { ClipView } from "@/lib/postari/clip-view";
import { mb } from "@/lib/postari/limite";
import { cn } from "@/lib/utils";
import { ClipPreview } from "./clip-preview";
import { IssueList } from "./issue-list";
import { btnPrimary, Empty, Tag } from "./ui";

type ProbeResult = { ok: true; clip: ClipView } | { ok: false; message: string };

function Verdict({ label, issues, probed, blocked }: { label: string; issues: { nivel: string }[]; probed: boolean; blocked: boolean }) {
  if (!probed) return <Tag tone="muted">{label}: necitit</Tag>;
  if (blocked || issues.some((issue) => issue.nivel === "eroare")) return <Tag tone="error">{label}: nu</Tag>;
  return <Tag tone="ok">{label}: da</Tag>;
}

/**
 * Clipurile din subfolder, cu ce s-a citit din fiecare și dacă intră pe
 * Instagram și pe TikTok. „Citește clipurile” le ia pe rând (fiecare se
 * descarcă întreg o singură dată), cu progresul anunțat.
 */
export function ClipsScreen({ folder, clips: initial, probe }: { folder: string; clips: ClipView[]; probe: (input: { folder: string; fileId: string }) => Promise<ProbeResult> }) {
  const [clips, setClips] = useState(initial);
  const [running, setRunning] = useState<{ done: number; total: number } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const stop = useRef(false);
  const unread = clips.filter((clip) => !clip.probed);

  async function readAll() {
    const queue = clips.filter((clip) => !clip.probed);
    stop.current = false;
    setRunning({ done: 0, total: queue.length });
    for (let i = 0; i < queue.length; i += 1) {
      if (stop.current) break;
      const clip = queue[i];
      let result: ProbeResult;
      try {
        result = await probe({ folder, fileId: clip.id });
      } catch {
        result = { ok: false, message: "Serverul n-a răspuns (rețea, sesiune sau un fișier prea mare pentru un singur apel)." };
      }
      if (result.ok) {
        const next = result.clip;
        setClips((current) => current.map((item) => (item.id === next.id ? next : item)));
        setErrors((current) => {
          const copy = { ...current };
          delete copy[clip.id];
          return copy;
        });
      } else {
        setErrors((current) => ({ ...current, [clip.id]: result.message }));
      }
      setRunning({ done: i + 1, total: queue.length });
    }
    setRunning(null);
  }

  if (clips.length === 0) return <Empty className="mt-4">Folderul n-are clipuri MP4 sau MOV. Terminalul de reclame le pune aici, lângă manifest.json.</Empty>;

  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-center gap-3">
        {unread.length > 0 ? (
          <button type="button" onClick={() => void readAll()} disabled={running !== null} className={btnPrimary}>
            {running ? `Se citește ${Math.min(running.done + 1, running.total)} din ${running.total}…` : `Citește clipurile (${unread.length})`}
          </button>
        ) : null}
        {running ? (
          <button type="button" onClick={() => (stop.current = true)} className="text-[13.5px] text-dim underline underline-offset-2 hover:text-bone">
            Oprește după clipul ăsta
          </button>
        ) : null}
        <p role="status" aria-live="polite" className="text-[13px] text-dim">
          {running ? `${running.done} din ${running.total} citite.` : unread.length === 0 ? `Toate cele ${clips.length} clipuri sunt citite.` : `${clips.length - unread.length} din ${clips.length} citite. Fiecare clip se descarcă o singură dată.`}
        </p>
      </div>

      <ul className="mt-4 grid gap-3">
        {clips.map((clip) => {
          const blocked = clip.common.some((issue) => issue.nivel === "eroare");
          return (
            <li key={clip.id} className="rounded-xl border border-hair bg-white px-4 py-3">
              <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                <div className="min-w-0 basis-full sm:basis-0 sm:flex-1">
                  <p className="break-all font-[family-name:var(--font-jbmono),ui-monospace,monospace] text-[13.5px] font-medium text-bone">{clip.name}</p>
                  <p className={cn("mt-0.5 text-[13px]", clip.probed ? "text-dim" : "text-dim/80")}>{clip.summary ?? (clip.size !== null ? `${mb(clip.size)} · necitit` : "necitit")}</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Verdict label="Instagram" issues={clip.instagram} probed={clip.probed} blocked={blocked} />
                  <Verdict label="TikTok" issues={clip.tiktok} probed={clip.probed} blocked={blocked} />
                </div>
              </div>
              {errors[clip.id] ? (
                <p role="alert" className="mt-2 text-[13px] text-[var(--ap-error)]">
                  {errors[clip.id]}
                </p>
              ) : null}
              <IssueList issues={clip.common} className="mt-2" />
              <IssueList issues={clip.instagram} className="mt-1" />
              <IssueList issues={clip.tiktok} className="mt-1" />
              <div className="mt-2">
                <ClipPreview fileId={clip.id} name={clip.name} />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
