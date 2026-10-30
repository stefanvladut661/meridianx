"use client";

import { useRef, useState } from "react";
import { CheckCircle2, ExternalLink, Film, Minus, Play, XCircle } from "lucide-react";
import type { ClipView } from "@/lib/postari/clip-view";
import { mb } from "@/lib/postari/limite";
import { cn } from "@/lib/utils";
import { Btn, Card, Pill, SectionTitle } from "../ui/primitives";
import { EmptyState } from "../ui/states";
import { ClipTile, IssueList } from "./shared";

type ProbeResult = { ok: true; clip: ClipView } | { ok: false; message: string };

/**
 * Clipul, în playerul Drive-ului. Se încarcă doar la „Vezi clipul” (un lot cu
 * 30 de clipuri nu deschide 30 de playere). Merge cu contul Google din
 * browser, cel care are acces la folder. Lângă el, „Deschide în Drive”.
 */
export function ClipPreview({ fileId, name }: { fileId: string; name: string }) {
  const [open, setOpen] = useState(false);
  const view = `https://drive.google.com/file/d/${fileId}/view`;

  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Btn size="xs" variant="outline" icon={Play} onClick={() => setOpen(true)} aria-label={`Vezi clipul ${name}`}>
          Vezi clipul
        </Btn>
        <a href={view} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
          Deschide în Drive <ExternalLink className="h-3 w-3" aria-hidden="true" />
          <span className="sr-only">(filă nouă)</span>
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="aspect-[9/16] w-[200px] max-w-full overflow-hidden rounded-xl border border-white/[0.08] bg-black">
        <iframe src={`https://drive.google.com/file/d/${fileId}/preview`} title={`Clipul ${name}`} allow="autoplay; fullscreen" className="h-full w-full" />
      </div>
      <div className="flex flex-wrap items-center gap-x-3">
        <button type="button" onClick={() => setOpen(false)} className="text-[11px] text-muted-foreground underline underline-offset-2 hover:text-foreground">
          Ascunde
        </button>
        <a href={view} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
          Deschide în Drive <ExternalLink className="h-3 w-3" aria-hidden="true" />
          <span className="sr-only">(filă nouă)</span>
        </a>
      </div>
    </div>
  );
}

/** Un rând din lot: clipul de pe Drive, ce spune manifestul despre el, sau doar unul din cele două. */
export interface ClipRowData {
  key: string;
  name: string;
  /** `null` = e în manifest, dar nu în folder. */
  clip: ClipView | null;
  /** `null` = e în folder, dar nu în manifest. */
  manifest: { voce: string | null; hook: string | null; cta: string | null; stil: string | null; format: string | null; durataS: number | null } | null;
}

function Verdict({ label, issues, probed, blocked }: { label: string; issues: { nivel: string }[]; probed: boolean; blocked: boolean }) {
  if (!probed) {
    return (
      <span title={`${label}: necitit încă. Apasă „Citește clipurile”.`}>
        <Pill tone="neutral">
          <Minus className="h-3 w-3" aria-hidden="true" /> {label}
          <span className="sr-only">: necitit</span>
        </Pill>
      </span>
    );
  }
  const bad = blocked || issues.some((issue) => issue.nivel === "eroare");
  return (
    <Pill tone={bad ? "rose" : "mint"}>
      {bad ? <XCircle className="h-3 w-3" aria-hidden="true" /> : <CheckCircle2 className="h-3 w-3" aria-hidden="true" />} {label}
      <span className="sr-only">{bad ? ": nu intră" : ": intră"}</span>
    </Pill>
  );
}

/**
 * Un lot de clipuri, ca în prototip: un card cu fiecare clip (hook, voce, CTA,
 * stil din manifest) și dacă intră pe Instagram și pe TikTok. Peste prototip:
 * „Citește clipurile” (fiecare clip se descarcă o singură dată de pe Drive,
 * cu progresul anunțat), problemele fiecărui clip și playerul din Drive.
 */
export function ClipsLot({
  folder,
  title,
  hint,
  pathLabel,
  rows: initial,
  hasManifest,
  probe,
  storageLimitMb,
}: {
  folder: string;
  title: string;
  hint: string;
  pathLabel: string;
  rows: ClipRowData[];
  /** Folderul are manifest.json: doar atunci „nu e în manifest” spune ceva. */
  hasManifest: boolean;
  probe: (input: { folder: string; fileId: string }) => Promise<ProbeResult>;
  storageLimitMb: number;
}) {
  const [rows, setRows] = useState(initial);
  const [running, setRunning] = useState<{ done: number; total: number } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const stop = useRef(false);
  const unread = rows.filter((row) => row.clip && !row.clip.probed);
  const onDrive = rows.filter((row) => row.clip).length;

  async function readAll() {
    const queue = rows.filter((row) => row.clip && !row.clip.probed);
    stop.current = false;
    setRunning({ done: 0, total: queue.length });
    for (let i = 0; i < queue.length; i += 1) {
      if (stop.current) break;
      const target = queue[i];
      const id = target.clip?.id ?? "";
      let result: ProbeResult;
      try {
        result = await probe({ folder, fileId: id });
      } catch {
        result = { ok: false, message: "Serverul n-a răspuns (rețea, sesiune sau un fișier prea mare pentru un singur apel)." };
      }
      if (result.ok) {
        const next = result.clip;
        setRows((current) => current.map((row) => (row.clip?.id === next.id ? { ...row, clip: next } : row)));
        setErrors((current) => {
          const copy = { ...current };
          delete copy[id];
          return copy;
        });
      } else {
        setErrors((current) => ({ ...current, [id]: result.message }));
      }
      setRunning({ done: i + 1, total: queue.length });
    }
    setRunning(null);
  }

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] px-4 py-3">
        <SectionTitle title={title} hint={hint} />
        <div className="flex flex-wrap items-center gap-2">
          {running ? (
            <button type="button" onClick={() => (stop.current = true)} className="text-[11.5px] text-muted-foreground underline underline-offset-2 hover:text-foreground">
              Oprește după clipul ăsta
            </button>
          ) : null}
          {unread.length > 0 ? (
            <Btn size="sm" variant="primary" disabled={running !== null} onClick={() => void readAll()}>
              {running ? `Se citește ${Math.min(running.done + 1, running.total)} din ${running.total}…` : `Citește clipurile (${unread.length})`}
            </Btn>
          ) : null}
          <Pill tone="neutral" className="font-mono">
            {pathLabel}
          </Pill>
        </div>
      </div>
      <p role="status" aria-live="polite" className="border-b border-white/[0.05] px-4 py-2 text-[11px] text-muted-foreground">
        {running
          ? `${running.done} din ${running.total} citite.`
          : onDrive === 0
            ? "Niciun clip din manifest nu e în folder."
            : unread.length === 0
              ? `Toate cele ${onDrive} clipuri sunt citite din fișier.`
              : `${onDrive - unread.length} din ${onDrive} citite din fișier. Fiecare clip se descarcă o singură dată.`}
      </p>

      {rows.length === 0 ? (
        <EmptyState icon={Film} title="Niciun clip în lot" text="Folderul n-are clipuri MP4 sau MOV. Terminalul de reclame le pune aici, lângă manifest.json." />
      ) : (
        <ul className="divide-y divide-white/[0.05]">
          {rows.map((row) => {
            const clip = row.clip;
            const blocked = clip?.common.some((issue) => issue.nivel === "eroare") ?? false;
            const manifest = row.manifest;
            const durationMs = clip?.durationMs ?? (manifest?.durataS ? manifest.durataS * 1000 : null);
            const igOk = Boolean(clip?.probed) && !blocked && !clip?.instagram.some((issue) => issue.nivel === "eroare");
            const ttOk = Boolean(clip?.probed) && !blocked && !clip?.tiktok.some((issue) => issue.nivel === "eroare");
            const error = clip ? errors[clip.id] : undefined;
            return (
              <li key={row.key} className="flex flex-wrap items-start gap-3 px-4 py-3">
                <ClipTile platform={igOk ? "instagram" : ttOk ? "tiktok" : null} durationMs={durationMs} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="break-all font-mono text-[12px]">{row.name}</p>
                    <span className={cn("text-[10.5px]", clip?.probed ? "text-muted-foreground" : "text-muted-foreground/70")}>
                      {clip ? (clip.summary ?? (clip.size !== null ? `${mb(clip.size)} · necitit` : "necitit")) : manifest?.durataS ? `${manifest.durataS} s în manifest` : ""}
                    </span>
                    {!clip ? <Pill tone="rose">lipsește din folder</Pill> : null}
                    {hasManifest && clip && !manifest ? <Pill tone="apricot">nu e în manifest</Pill> : null}
                  </div>
                  {manifest?.hook ? <p className="mt-1 text-[11.5px] text-foreground/75">Hook: {manifest.hook}</p> : null}
                  {manifest && (manifest.voce || manifest.cta || manifest.stil || manifest.format) ? (
                    <p className="text-[11px] text-muted-foreground">
                      {[manifest.voce ? `Voce: ${manifest.voce}` : null, manifest.cta ? `CTA: ${manifest.cta}` : null, manifest.stil ? `Stil: ${manifest.stil}` : null, manifest.format ? `Format: ${manifest.format}` : null].filter(Boolean).join(" · ")}
                    </p>
                  ) : null}
                  {error ? (
                    <p role="alert" className="mt-1.5 text-[11.5px] text-[#FFC2CE]">
                      {error}
                    </p>
                  ) : null}
                  {clip ? (
                    <>
                      <IssueList issues={clip.common} className="mt-1.5" />
                      <IssueList issues={clip.instagram} prefix="Instagram:" className="mt-1" />
                      <IssueList issues={clip.tiktok} prefix="TikTok:" className="mt-1" />
                      <div className="mt-2">
                        <ClipPreview fileId={clip.id} name={clip.name} />
                      </div>
                    </>
                  ) : null}
                </div>
                {clip ? (
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Verdict label="Instagram" issues={clip.instagram} probed={clip.probed} blocked={blocked} />
                    <Verdict label="TikTok" issues={clip.tiktok} probed={clip.probed} blocked={blocked} />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex items-center gap-2 border-t border-white/[0.06] px-4 py-2.5 text-[11px] text-muted-foreground">
        <Film className="h-3 w-3 shrink-0" aria-hidden="true" />
        Fiecare clip vertical 9:16, sub {storageLimitMb} MB pentru Instagram. Ce nu e compatibil e marcat — nu se strecoară în plan.
      </div>
    </Card>
  );
}
