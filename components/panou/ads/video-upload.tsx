"use client";

import { useEffect, useId, useRef, useState } from "react";
import { PLATFORM_LABEL, VIDEO_UPLOAD_MAX_BYTES, VIDEO_UPLOAD_TYPES, type Platform } from "@/lib/ads/constants";
import type { UploadActions, UploadStatus } from "@/lib/ads/types";
import { asString, getIn } from "@/lib/ads/plan-path";
import { cn } from "@/lib/utils";
import { Btn } from "../ui/primitives";
import { ProgressBar } from "../ui/states";
import { usePlanForm } from "./fields";
import { ERROR_TEXT, LABEL, OK_DOT, WARNING_TEXT } from "./tone";

/**
 * Video nou, din calculator, până în biblioteca contului de reclame.
 *
 * Drumul are patru pași reali, în ordine, și interfața îi arată pe toți —
 * altfel un fișier de 40 MB pare o pagină blocată:
 *   1. urcarea în stocarea temporară a portalului (progres real, în MB);
 *   2. platforma (Meta sau TikTok) copiază fișierul de acolo;
 *   3. platforma îl procesează;
 *   4. gata — planul trece singur pe video-ul din bibliotecă.
 *
 * Browserul nu vede niciun token de platformă: urcă printr-un URL semnat, valabil
 * pentru un singur fișier. Restul îl face serverul.
 */

type Phase =
  | { step: "idle" }
  | { step: "uploading"; loaded: number; total: number }
  | { step: "copying"; videoId: string | null; progress: number | null }
  | { step: "processing"; videoId: string; progress: number | null; startedAt: number }
  | { step: "failed"; message: string; retry: "upload" | "status"; videoId?: string; stagingName?: string };

function steps(label: string) {
  return [
    { key: "uploading", label: "Urcare în portal" },
    { key: "copying", label: `${label} copiază fișierul` },
    { key: "processing", label: `${label} procesează` },
    { key: "done", label: "Gata" },
  ] as const;
}

const POLL_MS = 3000;
const POLL_LIMIT_MS = 15 * 60 * 1000;

export function megabytes(bytes: number): string {
  return new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 1 }).format(bytes / 1024 / 1024);
}

function localCheck(file: File): string | null {
  if (!(VIDEO_UPLOAD_TYPES as readonly string[]).includes(file.type)) {
    return "Fișierul nu e MP4 sau MOV. Exportă-l în MP4 (H.264).";
  }
  if (file.size > VIDEO_UPLOAD_MAX_BYTES) {
    return `Are ${megabytes(file.size)} MB; limita e ${megabytes(VIDEO_UPLOAD_MAX_BYTES)} MB. Exportă-l mai mic sau urcă-l din Ads Manager și alege-l din bibliotecă.`;
  }
  return null;
}

/** PUT prin XHR: `fetch` nu raportează progresul unei urcări. */
export function putFile(
  url: string,
  file: File,
  onProgress: (loaded: number, total: number) => void,
  register: (xhr: XMLHttpRequest) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    register(xhr);
    xhr.open("PUT", url);
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (anon) xhr.setRequestHeader("apikey", anon);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.setRequestHeader("content-type", file.type);
    xhr.setRequestHeader("cache-control", "max-age=3600");
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded, event.total);
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(xhr.status === 413 ? "too_large" : `http_${xhr.status}`));
    xhr.onerror = () => reject(new Error("network"));
    xhr.onabort = () => reject(new Error("aborted"));
    xhr.send(file);
  });
}

export function VideoUpload({
  actions,
  platform,
  onReady,
  path = "creative.video",
}: {
  actions: UploadActions;
  platform: Platform;
  /** Video-ul e gata în bibliotecă: planul trece pe el. */
  onReady: (video: { id: string; fileName: string }) => void;
  /** Video-ul din plan pe care îl înlocuiește urcarea: `creative.video` sau `creative.videos.2`. */
  path?: string;
}) {
  const { draft } = usePlanForm();
  const label = PLATFORM_LABEL[platform];
  const adAccount = asString(getIn(draft, "ad_account"));
  const expectedName = asString(getIn(draft, `${path}.file_name`));

  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<Phase>({ step: "idle" });
  const [announcement, setAnnouncement] = useState("");
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const cancelled = useRef(false);
  const inputId = useId();

  const problem = file ? localCheck(file) : null;
  const busy = phase.step === "uploading" || phase.step === "copying" || phase.step === "processing";

  // Închiderea paginii în mijlocul drumului pierde urcarea: întrebăm.
  useEffect(() => {
    if (!busy) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [busy]);

  // Oprirea la demontare: nicio cerere nu mai scrie în starea unei componente plecate.
  useEffect(
    () => () => {
      cancelled.current = true;
      xhrRef.current?.abort();
    },
    []
  );

  const poll = async (videoId: string, fileName: string, stagingName: string, startedAt: number) => {
    while (!cancelled.current) {
      if (Date.now() - startedAt > POLL_LIMIT_MS) {
        setPhase({
          step: "failed",
          retry: "status",
          videoId,
          stagingName,
          message: `${label} procesează de peste 15 minute. Video-ul e în bibliotecă (id ${videoId}): verifică mai târziu sau alege-l de acolo.`,
        });
        return;
      }
      let status: UploadStatus;
      try {
        const response = await actions.status({ videoId, stagingName });
        if (!response.ok) {
          setPhase({ step: "failed", retry: "status", videoId, stagingName, message: response.message });
          return;
        }
        status = response.status;
      } catch {
        setPhase({ step: "failed", retry: "status", videoId, stagingName, message: "Serverul n-a răspuns. Verifică din nou." });
        return;
      }
      if (cancelled.current) return;
      if (status.state === "ready") {
        setAnnouncement("Gata: video-ul e în biblioteca contului și a intrat în plan.");
        // Pe Google, id-ul definitiv e cel de YouTube, nu cel al urcării.
        onReady({ id: status.finalId ?? videoId, fileName });
        return;
      }
      if (status.state === "error") {
        setPhase({
          step: "failed",
          retry: "upload",
          message: `${label} n-a putut procesa video-ul: ${status.message ?? "fără detalii"}. Verifică fișierul (MP4, H.264, sunet AAC) și urcă-l din nou.`,
        });
        return;
      }
      setPhase(
        status.state === "copying"
          ? { step: "copying", videoId, progress: status.progress }
          : { step: "processing", videoId, progress: status.progress, startedAt }
      );
      await new Promise((resolve) => setTimeout(resolve, POLL_MS));
    }
  };

  const start = async () => {
    if (!file || problem || !adAccount) return;
    cancelled.current = false;
    setAnnouncement("Se urcă fișierul.");
    setPhase({ step: "uploading", loaded: 0, total: file.size });

    const prepared = await actions.prepare({ name: file.name, size: file.size, type: file.type }).catch(() => null);
    if (!prepared || !prepared.ok) {
      setPhase({
        step: "failed",
        retry: "upload",
        message: prepared?.message ?? "Serverul n-a răspuns. Nu s-a urcat nimic.",
      });
      return;
    }

    try {
      await putFile(
        prepared.uploadUrl,
        file,
        (loaded, total) => setPhase({ step: "uploading", loaded, total }),
        (xhr) => (xhrRef.current = xhr)
      );
    } catch (error) {
      const reason = error instanceof Error ? error.message : "";
      if (reason === "aborted") {
        setPhase({ step: "idle" });
        setAnnouncement("Urcarea s-a oprit.");
        return;
      }
      setPhase({
        step: "failed",
        retry: "upload",
        message:
          reason === "too_large"
            ? "Stocarea temporară a refuzat fișierul: e peste limita ei. Exportă-l mai mic."
            : reason === "network"
              ? "Conexiunea s-a întrerupt. Încearcă din nou."
              : `Stocarea temporară a refuzat fișierul (${reason}). Încearcă din nou.`,
      });
      return;
    } finally {
      xhrRef.current = null;
    }

    setAnnouncement(`Fișierul e urcat. ${label} îl copiază.`);
    setPhase({ step: "copying", videoId: null, progress: null });
    const sent = await actions.send({ stagingName: prepared.name, fileName: file.name }).catch(() => null);
    if (cancelled.current) return;
    if (!sent || !sent.ok) {
      setPhase({
        step: "failed",
        retry: "upload",
        message: sent?.message ?? `Serverul n-a răspuns cât ${label} copia fișierul. Încearcă din nou.`,
      });
      return;
    }

    setAnnouncement(`${label} a primit linkul. Urmează copierea și procesarea.`);
    setPhase({ step: "copying", videoId: sent.videoId, progress: null });
    await poll(sent.videoId, file.name, prepared.name, Date.now());
  };

  const activeIndex =
    phase.step === "uploading" ? 0 : phase.step === "copying" ? 1 : phase.step === "processing" ? 2 : -1;

  return (
    <div className="min-w-0 space-y-4">
      <div>
        <p id={`${inputId}-label`} className={LABEL}>
          Fișierul video
        </p>
        {/* Butonul nativ vorbește în limba browserului și repetă numele
            fișierului; câmpul real rămâne în etichetă, ascuns vizual, deci
            tastatura și cititorul de ecran îl folosesc la fel. */}
        <label
          className={cn(
            "mt-2 inline-flex h-8 cursor-pointer items-center rounded-lg border border-white/[0.14] px-3 text-[14px] font-medium text-foreground transition-colors hover:bg-white/[0.06] has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-lav",
            busy && "pointer-events-none opacity-45"
          )}
        >
          <input
            id={inputId}
            type="file"
            accept={VIDEO_UPLOAD_TYPES.join(",")}
            disabled={busy}
            aria-labelledby={`${inputId}-label ${inputId}-button`}
            aria-describedby={`${inputId}-hint`}
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
              setPhase({ step: "idle" });
            }}
            className="sr-only"
          />
          <span id={`${inputId}-button`}>{file ? "Alege alt fișier" : "Alege fișierul"}</span>
        </label>
        <p id={`${inputId}-hint`} className="mt-2 text-[13px] leading-snug text-muted-foreground">
          MP4 sau MOV, cel mult {megabytes(VIDEO_UPLOAD_MAX_BYTES)} MB
        </p>
        {file ? (
          <p className="mt-2 text-[14px] text-foreground/85">
            {file.name} <span className="font-mono text-[12.5px] text-muted-foreground">· {megabytes(file.size)} MB</span>
          </p>
        ) : null}
        {problem ? <p className={cn("mt-1.5 text-[14px] leading-snug", ERROR_TEXT)}>{problem}</p> : null}
        {file && !problem && expectedName && expectedName !== file.name ? (
          <p className={cn("mt-1.5 text-[14px] leading-snug", WARNING_TEXT)}>
            Planul cere „{expectedName}”; ai ales „{file.name}”.
          </p>
        ) : null}
        {!adAccount ? (
          <p className="mt-1.5 text-[14px] text-muted-foreground">Scrie întâi contul de reclame.</p>
        ) : null}
      </div>

      {phase.step === "idle" || phase.step === "failed" ? (
        <Btn variant="outline" size="sm" onClick={start} disabled={!file || Boolean(problem) || !adAccount}>
          {phase.step === "failed" ? "Urcă din nou" : `Urcă în contul ${adAccount ?? ""}`.trim()}
        </Btn>
      ) : null}

      {activeIndex >= 0 ? (
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-4">
          <ol className="grid grid-cols-2 gap-x-4 gap-y-2">
            {steps(label).map((step, index) => (
              <li
                key={step.key}
                aria-current={index === activeIndex ? "step" : undefined}
                className={cn(
                  "flex items-center gap-2 text-[13.5px]",
                  index < activeIndex ? "text-foreground/70" : index === activeIndex ? "font-semibold text-foreground" : "text-muted-foreground"
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "h-1.5 w-1.5 shrink-0 rounded-full",
                    index < activeIndex ? OK_DOT : index === activeIndex ? "bg-lav" : "border border-white/[0.2]"
                  )}
                />
                {step.label}
              </li>
            ))}
          </ol>

          {phase.step === "uploading" ? (
            <div className="mt-4">
              <ProgressBar value={(phase.loaded / Math.max(1, phase.total)) * 100} tone="lav" />
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <p className="pu-num font-mono text-[12.5px] text-foreground/80">
                  {Math.floor((phase.loaded / Math.max(1, phase.total)) * 100)}% · {megabytes(phase.loaded)} din{" "}
                  {megabytes(phase.total)} MB
                </p>
                <button
                  type="button"
                  onClick={() => xhrRef.current?.abort()}
                  className="text-[13.5px] text-muted-foreground underline underline-offset-4 hover:text-foreground"
                >
                  Oprește urcarea
                </button>
              </div>
            </div>
          ) : phase.step === "copying" ? (
            <p className="mt-4 text-[14px] leading-snug text-foreground/80">
              {phase.progress !== null ? <span className="pu-num font-mono text-[12.5px]">{phase.progress}% · </span> : null}
              Nu închide pagina.
            </p>
          ) : phase.step === "processing" ? (
            <p className="mt-4 text-[14px] leading-snug text-foreground/80">
              {phase.progress !== null ? <span className="pu-num font-mono text-[12.5px]">{phase.progress}% · </span> : null}
              Id în bibliotecă: <span className="font-mono text-[12.5px]">{phase.videoId}</span>
            </p>
          ) : null}
        </div>
      ) : null}

      {phase.step === "failed" ? (
        <div role="alert" className={cn("text-[14px] leading-snug", ERROR_TEXT)}>
          <p>{phase.message}</p>
          {phase.retry === "status" && phase.videoId && phase.stagingName ? (
            <button
              type="button"
              onClick={() => {
                cancelled.current = false;
                const startedAt = Date.now();
                setPhase({ step: "processing", videoId: phase.videoId as string, progress: null, startedAt });
                void poll(phase.videoId as string, file?.name ?? "video", phase.stagingName as string, startedAt);
              }}
              className="mt-2 text-foreground underline underline-offset-4"
            >
              Verifică din nou
            </button>
          ) : null}
        </div>
      ) : null}

      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
    </div>
  );
}
