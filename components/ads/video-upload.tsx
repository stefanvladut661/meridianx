"use client";

import { useEffect, useId, useRef, useState } from "react";
import { VIDEO_UPLOAD_MAX_BYTES, VIDEO_UPLOAD_TYPES } from "@/lib/ads/constants";
import type { UploadActions, UploadStatus } from "@/lib/ads/meta/types";
import { asString, getIn } from "@/lib/ads/plan-path";
import { cn } from "@/lib/utils";
import { usePlanForm } from "./fields";
import { ERROR_TEXT, LABEL, OK_DOT, WARNING_TEXT } from "./tone";

/**
 * Video nou, din calculator, până în biblioteca contului de reclame.
 *
 * Drumul are patru pași reali, în ordine, și interfața îi arată pe toți —
 * altfel un fișier de 40 MB pare o pagină blocată:
 *   1. urcarea în stocarea temporară a portalului (progres real, în MB);
 *   2. Meta copiază fișierul de acolo;
 *   3. Meta îl procesează;
 *   4. gata — planul trece singur pe video-ul din bibliotecă.
 *
 * Browserul nu vede niciun token Meta: urcă printr-un URL semnat, valabil
 * pentru un singur fișier. Restul îl face serverul.
 */

type Phase =
  | { step: "idle" }
  | { step: "uploading"; loaded: number; total: number }
  | { step: "copying"; videoId: string | null; progress: number | null }
  | { step: "processing"; videoId: string; progress: number | null; startedAt: number }
  | { step: "failed"; message: string; retry: "upload" | "status"; videoId?: string; stagingName?: string };

const STEPS = [
  { key: "uploading", label: "Urcare în portal" },
  { key: "copying", label: "Meta copiază fișierul" },
  { key: "processing", label: "Meta procesează" },
  { key: "done", label: "Gata" },
] as const;

const POLL_MS = 3000;
const POLL_LIMIT_MS = 15 * 60 * 1000;

function megabytes(bytes: number): string {
  return new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 1 }).format(bytes / 1024 / 1024);
}

function localCheck(file: File): string | null {
  if (!(VIDEO_UPLOAD_TYPES as readonly string[]).includes(file.type)) {
    return "Fișierul trebuie să fie video MP4 sau MOV. Exportă-l ca MP4 (H.264).";
  }
  if (file.size > VIDEO_UPLOAD_MAX_BYTES) {
    return `Are ${megabytes(file.size)} MB; portalul primește cel mult ${megabytes(VIDEO_UPLOAD_MAX_BYTES)} MB. Exportă-l mai mic sau urcă-l din Ads Manager și alege-l apoi din bibliotecă.`;
  }
  return null;
}

/** PUT prin XHR: `fetch` nu raportează progresul unei urcări. */
function putFile(
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
  onReady,
}: {
  actions: UploadActions;
  /** Video-ul e gata în bibliotecă: planul trece pe el. */
  onReady: (video: { id: string; fileName: string }) => void;
}) {
  const { draft } = usePlanForm();
  const adAccount = asString(getIn(draft, "ad_account"));
  const expectedName = asString(getIn(draft, "creative.video.file_name"));

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
          message: `Meta procesează de peste 15 minute. Video-ul e în bibliotecă (id ${videoId}); verifică din nou peste câteva minute sau alege-l din bibliotecă.`,
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
        onReady({ id: videoId, fileName });
        return;
      }
      if (status.state === "error") {
        setPhase({
          step: "failed",
          retry: "upload",
          message: `Meta n-a putut procesa video-ul: ${status.message ?? "fără detalii"}. Verifică fișierul (MP4, H.264, sunet AAC) și urcă-l din nou.`,
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
        message: prepared?.message ?? "Serverul n-a răspuns. Nu s-a urcat nimic. Încearcă din nou.",
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
              ? "Conexiunea s-a întrerupt în timpul urcării. Încearcă din nou."
              : `Stocarea temporară a refuzat fișierul (${reason}). Încearcă din nou.`,
      });
      return;
    } finally {
      xhrRef.current = null;
    }

    setAnnouncement("Fișierul e urcat. Meta îl copiază.");
    setPhase({ step: "copying", videoId: null, progress: null });
    const sent = await actions.send({ stagingName: prepared.name, fileName: file.name }).catch(() => null);
    if (cancelled.current) return;
    if (!sent || !sent.ok) {
      setPhase({
        step: "failed",
        retry: "upload",
        message: sent?.message ?? "Serverul n-a răspuns în timp ce Meta copia fișierul. Încearcă din nou.",
      });
      return;
    }

    setAnnouncement("Meta a primit linkul. Urmează copierea și procesarea.");
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
            "mt-2 inline-flex min-h-10 cursor-pointer items-center rounded-full border border-hair-strong px-4 text-[13px] font-medium text-bone transition-colors duration-150 hover:bg-glass has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-bone",
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
        <p id={`${inputId}-hint`} className="mt-2 text-[12.5px] leading-snug text-dim">
          MP4 sau MOV, cel mult {megabytes(VIDEO_UPLOAD_MAX_BYTES)} MB. Fișierul trece printr-o stocare temporară a
          portalului și se șterge imediat ce Meta îl are.
        </p>
        {file ? (
          <p className="mt-2 text-[13.5px] text-bone/85">
            {file.name} <span className="font-md-mono text-[12px] text-dim">· {megabytes(file.size)} MB</span>
          </p>
        ) : null}
        {problem ? <p className={cn("mt-1.5 text-[13.5px] leading-snug", ERROR_TEXT)}>{problem}</p> : null}
        {file && !problem && expectedName && expectedName !== file.name ? (
          <p className={cn("mt-1.5 text-[13.5px] leading-snug", WARNING_TEXT)}>
            Planul pomenește „{expectedName}”, iar tu ai ales „{file.name}”. Verifică să fie video-ul potrivit.
          </p>
        ) : null}
        {!adAccount ? (
          <p className="mt-1.5 text-[13.5px] text-dim">Scrie întâi contul de reclame — video-ul intră în biblioteca lui.</p>
        ) : null}
      </div>

      {phase.step === "idle" || phase.step === "failed" ? (
        <button
          type="button"
          onClick={start}
          disabled={!file || Boolean(problem) || !adAccount}
          className="btn btn-ghost !min-h-10 !px-4 !py-2 !text-[13px] disabled:cursor-not-allowed disabled:opacity-45"
        >
          {phase.step === "failed" ? "Urcă din nou" : `Urcă în contul ${adAccount ?? ""}`.trim()}
        </button>
      ) : null}

      {activeIndex >= 0 ? (
        <div className="rounded-panel border border-hair bg-ink/40 px-4 py-4">
          <ol className="grid grid-cols-2 gap-x-4 gap-y-2">
            {STEPS.map((step, index) => (
              <li
                key={step.key}
                aria-current={index === activeIndex ? "step" : undefined}
                className={cn(
                  "flex items-center gap-2 text-[12.5px]",
                  index < activeIndex ? "text-bone/70" : index === activeIndex ? "font-semibold text-bone" : "text-dim"
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "h-1.5 w-1.5 shrink-0 rounded-full",
                    index < activeIndex ? OK_DOT : index === activeIndex ? "bg-bone" : "border border-hair-strong"
                  )}
                />
                {step.label}
              </li>
            ))}
          </ol>

          {phase.step === "uploading" ? (
            <div className="mt-4">
              <progress
                max={phase.total}
                value={phase.loaded}
                aria-label="Urcarea fișierului"
                className="h-1.5 w-full overflow-hidden rounded-full [&::-moz-progress-bar]:bg-bone [&::-webkit-progress-bar]:bg-hair [&::-webkit-progress-value]:bg-bone"
              />
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <p className="font-md-mono text-[12px] tabular-nums text-bone/80">
                  {Math.floor((phase.loaded / Math.max(1, phase.total)) * 100)}% · {megabytes(phase.loaded)} din{" "}
                  {megabytes(phase.total)} MB
                </p>
                <button
                  type="button"
                  onClick={() => xhrRef.current?.abort()}
                  className="text-[13px] text-dim underline underline-offset-4 hover:text-bone"
                >
                  Oprește urcarea
                </button>
              </div>
            </div>
          ) : phase.step === "copying" ? (
            <p className="mt-4 text-[13.5px] leading-snug text-bone/80">
              Meta descarcă fișierul din stocarea portalului
              {phase.progress !== null ? (
                <span className="font-md-mono text-[12px] tabular-nums"> · {phase.progress}%</span>
              ) : null}
              . Durează cât o descărcare obișnuită — nu închide pagina.
            </p>
          ) : phase.step === "processing" ? (
            <p className="mt-4 text-[13.5px] leading-snug text-bone/80">
              Meta pregătește video-ul pentru reclame
              {phase.progress !== null ? (
                <span className="font-md-mono text-[12px] tabular-nums"> · {phase.progress}%</span>
              ) : null}
              . De obicei, un minut sau două. Id-ul din bibliotecă:{" "}
              <span className="font-md-mono text-[12px]">{phase.videoId}</span>.
            </p>
          ) : null}
        </div>
      ) : null}

      {phase.step === "failed" ? (
        <div role="alert" className={cn("text-[13.5px] leading-snug", ERROR_TEXT)}>
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
              className="mt-2 text-bone underline underline-offset-4"
            >
              Verifică din nou starea
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
