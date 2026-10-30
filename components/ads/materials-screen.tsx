"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { PLATFORM_LABEL, VIDEO_UPLOAD_MAX_BYTES, VIDEO_UPLOAD_TYPES } from "@/lib/ads/constants";
import { MATERIAL_NAME_MAX, aspectLabel, durationLabel, sizeLabel, type MaterialRow, type MaterialUploadRow } from "@/lib/ads/materials-shared";
import { formatLeadDateTime } from "@/app/(admin)/admin/_components/format-date";
import { cn } from "@/lib/utils";
import { ChannelIcon } from "./channel-icon";
import { ERROR_TEXT, FIELD, OK_TEXT } from "./tone";
import { megabytes, putFile } from "./video-upload";

type Failure = { ok: false; message: string };

export interface MaterialsActions {
  prepare: (input: {
    name: string;
    clientId: string | null;
    file: { size: number; type: string };
    video: { duration: number | null; width: number | null; height: number | null };
  }) => Promise<{ ok: true; id: string; uploadUrl: string } | Failure>;
  finish: (input: { id: string }) => Promise<{ ok: true } | Failure>;
  rename: (input: { id: string; name: string }) => Promise<{ ok: true } | Failure>;
  archive: (input: { id: string }) => Promise<{ ok: true } | Failure>;
}

/** Durata și dimensiunile, citite din fișier în browser, înainte de urcare. */
function readVideoInfo(file: File): Promise<{ duration: number | null; width: number | null; height: number | null }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    const done = (info: { duration: number | null; width: number | null; height: number | null }) => {
      URL.revokeObjectURL(url);
      resolve(info);
    };
    const timer = window.setTimeout(() => done({ duration: null, width: null, height: null }), 8000);
    video.preload = "metadata";
    video.muted = true;
    video.onloadedmetadata = () => {
      window.clearTimeout(timer);
      done({
        duration: Number.isFinite(video.duration) ? Math.round(video.duration * 100) / 100 : null,
        width: video.videoWidth || null,
        height: video.videoHeight || null,
      });
    };
    video.onerror = () => {
      window.clearTimeout(timer);
      done({ duration: null, width: null, height: null });
    };
    video.src = url;
  });
}

type Phase =
  | { step: "idle" }
  | { step: "chosen"; file: File; info: { duration: number | null; width: number | null; height: number | null } }
  | { step: "uploading"; file: File; loaded: number; total: number }
  | { step: "done"; name: string }
  | { step: "failed"; message: string };

function UploadPanel({ clients, defaultClientId, actions }: { clients: Array<{ id: string; name: string }>; defaultClientId: string | null; actions: MaterialsActions }) {
  const router = useRouter();
  const id = useId();
  const [phase, setPhase] = useState<Phase>({ step: "idle" });
  const [name, setName] = useState("");
  const [clientId, setClientId] = useState<string>(defaultClientId ?? "");
  const [problem, setProblem] = useState<string | null>(null);
  const xhr = useRef<XMLHttpRequest | null>(null);
  const input = useRef<HTMLInputElement>(null);

  // Închiderea paginii în mijlocul urcării cere confirmare.
  useEffect(() => {
    if (phase.step !== "uploading") return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [phase.step]);

  const choose = async (file: File | undefined) => {
    setProblem(null);
    if (!file) return;
    if (!(VIDEO_UPLOAD_TYPES as readonly string[]).includes(file.type)) {
      setProblem("Fișierul trebuie să fie video MP4 sau MOV. Exportă-l ca MP4 (H.264).");
      return;
    }
    if (file.size > VIDEO_UPLOAD_MAX_BYTES) {
      setProblem(`Are ${megabytes(file.size)} MB; portalul primește cel mult ${megabytes(VIDEO_UPLOAD_MAX_BYTES)} MB. Exportă-l la 4–6 Mbps (tot 1080p).`);
      return;
    }
    setName(file.name.replace(/\.(mp4|mov)$/i, "").slice(0, MATERIAL_NAME_MAX));
    setPhase({ step: "chosen", file, info: await readVideoInfo(file) });
  };

  const upload = async () => {
    if (phase.step !== "chosen") return;
    if (!name.trim()) {
      setProblem("Dă-i materialului un nume — cel după care îl recunoști în listă.");
      return;
    }
    const file = phase.file;
    setProblem(null);
    const prepared = await actions.prepare({ name, clientId: clientId || null, file: { size: file.size, type: file.type }, video: phase.info }).catch(() => null);
    if (!prepared || !prepared.ok) {
      setPhase({ step: "failed", message: prepared ? prepared.message : "Serverul n-a răspuns. Încearcă din nou." });
      return;
    }
    setPhase({ step: "uploading", file, loaded: 0, total: file.size });
    try {
      await putFile(prepared.uploadUrl, file, (loaded, total) => setPhase({ step: "uploading", file, loaded, total }), (request) => (xhr.current = request));
    } catch (error) {
      const reason = error instanceof Error ? error.message : "";
      setPhase({
        step: "failed",
        message: reason === "aborted" ? "Urcarea e oprită. Fișierul nu e în Materiale." : reason === "too_large" ? "Stocarea a refuzat fișierul: e prea mare." : "Urcarea s-a întrerupt (rețea). Încearcă din nou.",
      });
      return;
    }
    const finished = await actions.finish({ id: prepared.id }).catch(() => null);
    if (!finished || !finished.ok) {
      setPhase({ step: "failed", message: finished ? finished.message : "Serverul n-a confirmat urcarea. Reîncarcă pagina: dacă materialul nu apare, urcă-l din nou." });
      return;
    }
    setPhase({ step: "done", name });
    if (input.current) input.current.value = "";
    router.refresh();
  };

  const info = phase.step === "chosen" ? phase.info : null;

  return (
    <section aria-labelledby={`${id}-titlu`} className="rounded-xl border border-hair bg-char p-4 sm:p-5">
      <h2 id={`${id}-titlu`} className="text-[16px] font-semibold text-bone">
        Urcă un video
      </h2>
      <p className="mt-0.5 text-[13px] text-dim">MP4 sau MOV, cel mult {megabytes(VIDEO_UPLOAD_MAX_BYTES)} MB. Îl urci o dată; ajunge în contul de reclame abia când îl alegi într-o campanie.</p>

      <label className="mt-4 block">
        <span className="text-[13px] font-medium text-bone">Fișierul</span>
        <input
          ref={input}
          type="file"
          accept="video/mp4,video/quicktime"
          disabled={phase.step === "uploading"}
          onChange={(event) => void choose(event.currentTarget.files?.[0])}
          className="mt-1 block w-full text-[14px] text-bone file:mr-3 file:rounded-lg file:border file:border-hair-strong file:bg-char file:px-3 file:py-2 file:text-[13.5px] file:font-medium file:text-bone hover:file:bg-[var(--ap-hover)]"
        />
      </label>

      {phase.step === "chosen" || phase.step === "uploading" ? (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-[13px] font-medium text-bone">Numele din listă</span>
            <input value={name} maxLength={MATERIAL_NAME_MAX} onChange={(event) => setName(event.currentTarget.value)} disabled={phase.step === "uploading"} className={cn(FIELD, "mt-1 h-10")} />
          </label>
          <label className="block">
            <span className="text-[13px] font-medium text-bone">Pentru clientul</span>
            <select value={clientId} onChange={(event) => setClientId(event.currentTarget.value)} disabled={phase.step === "uploading"} className={cn(FIELD, "mt-1 h-10")}>
              <option value="">Oricare (al agenției)</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}

      {info ? (
        <p className="mt-2 text-[13px] text-dim">
          {[durationLabel(info.duration), aspectLabel(info.width, info.height), phase.step === "chosen" ? `${megabytes(phase.file.size)} MB` : null].filter(Boolean).join(" · ") || "Browserul n-a putut citi durata și formatul; se urcă oricum."}
        </p>
      ) : null}

      {phase.step === "uploading" ? (
        <div className="mt-4">
          <div className="h-2 overflow-hidden rounded-full bg-[var(--ap-neutral-soft)]" role="progressbar" aria-label="Urcarea" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round((phase.loaded / phase.total) * 100)}>
            <span className="block h-full bg-[var(--md-a1)] transition-[width] duration-200" style={{ width: `${(phase.loaded / phase.total) * 100}%` }} />
          </div>
          <p className="mt-1.5 text-[13px] text-bone/85">
            {megabytes(phase.loaded)} din {megabytes(phase.total)} MB
          </p>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {phase.step === "uploading" ? (
          <button type="button" onClick={() => xhr.current?.abort()} className="btn btn-ghost !min-h-10 !px-4 !text-[14px]">
            Oprește urcarea
          </button>
        ) : (
          <button type="button" disabled={phase.step !== "chosen"} onClick={() => void upload()} className="btn btn-light !min-h-10 !px-4 !text-[14px]">
            Urcă în Materiale
          </button>
        )}
        <p role="status" aria-live="polite" className={cn("text-[14px]", phase.step === "failed" || problem ? ERROR_TEXT : OK_TEXT)}>
          {problem ?? (phase.step === "failed" ? phase.message : phase.step === "done" ? `„${phase.name}” e în Materiale.` : "")}
        </p>
      </div>
    </section>
  );
}

function uploadLine(upload: MaterialUploadRow): { text: string; tone: string } {
  if (upload.status === "ready") return { text: "în biblioteca contului", tone: OK_TEXT };
  if (upload.status === "failed") return { text: `n-a mers${upload.message ? `: ${upload.message}` : ""}`, tone: ERROR_TEXT };
  return { text: "platforma îl procesează", tone: "text-dim" };
}

function MaterialCard({ material, clientName, actions }: { material: MaterialRow; clientName: string | null; actions: MaterialsActions }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(material.name);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const facts = [durationLabel(material.durationSeconds), aspectLabel(material.width, material.height), sizeLabel(material.sizeBytes)].filter(Boolean);
  const unfinished = material.status === "uploading";

  const run = (action: () => Promise<{ ok: true } | Failure>, after: () => void) =>
    start(async () => {
      const result = await action().catch(() => ({ ok: false as const, message: "Serverul n-a răspuns. Încearcă din nou." }));
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setError(null);
      after();
      router.refresh();
    });

  return (
    <li className="flex flex-col overflow-hidden rounded-xl border border-hair bg-char">
      <div className="relative aspect-video min-h-0 overflow-hidden bg-[#0f1115]">
        {material.previewUrl ? (
          // Previzualizare fără sunet, fără pornire singură: primul cadru, cu controale.
          <video src={`${material.previewUrl}#t=0.1`} preload="metadata" muted playsInline controls className="absolute inset-0 h-full w-full object-contain" aria-label={`Previzualizare: ${material.name}`} />
        ) : (
          <div className="grid h-full place-items-center px-4 text-center text-[13px] text-white/70">{unfinished ? "Urcare neterminată" : "Previzualizare indisponibilă"}</div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3.5">
        {renaming ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              run(() => actions.rename({ id: material.id, name }), () => setRenaming(false));
            }}
            className="flex gap-2"
          >
            <label className="sr-only" htmlFor={`nume-${material.id}`}>
              Numele materialului
            </label>
            <input id={`nume-${material.id}`} value={name} maxLength={MATERIAL_NAME_MAX} onChange={(event) => setName(event.currentTarget.value)} className={cn(FIELD, "h-9 text-[14px]")} autoFocus />
            <button type="submit" disabled={pending} className="btn btn-light !min-h-9 !px-3 !text-[13px]">
              Salvează
            </button>
          </form>
        ) : (
          <p className="text-[14.5px] font-semibold leading-snug text-bone">{material.name}</p>
        )}
        <p className="text-[12.5px] text-dim">
          {facts.length ? facts.join(" · ") : "—"}
          <br />
          {clientName ?? "al agenției"} · {formatLeadDateTime(material.createdAt)}
        </p>
        {material.uploads.length > 0 ? (
          <ul className="space-y-1 border-t border-hair pt-2 text-[12.5px]" aria-label="Conturile în care a fost trimis">
            {material.uploads.map((upload) => {
              const line = uploadLine(upload);
              return (
                <li key={`${upload.platform}|${upload.adAccount}`} className="flex items-start gap-1.5">
                  <ChannelIcon platform={upload.platform} labelled className="mt-0.5 shrink-0" size={14} />
                  <span className="min-w-0">
                    <span className="font-md-mono text-bone/80">{upload.adAccount}</span> <span className={line.tone}>{line.text}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        ) : unfinished ? null : (
          <p className="border-t border-hair pt-2 text-[12.5px] text-dim">Încă în niciun cont. Alege-l în „Creează”.</p>
        )}
        {error ? (
          <p role="alert" className={cn("text-[13px]", ERROR_TEXT)}>
            {error}
          </p>
        ) : null}
        <div className="mt-auto flex flex-wrap gap-2 pt-1">
          {confirming ? (
            <>
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => actions.archive({ id: material.id }), () => setConfirming(false))}
                className="btn btn-ghost !min-h-9 !border-[var(--ap-error)]/40 !px-3 !text-[13px] !text-[var(--ap-error)]"
              >
                Da, scoate-l
              </button>
              <button type="button" onClick={() => setConfirming(false)} className="btn btn-ghost !min-h-9 !px-3 !text-[13px]">
                Renunță
              </button>
            </>
          ) : (
            <>
              {!unfinished && !renaming ? (
                <button type="button" onClick={() => setRenaming(true)} className="btn btn-ghost !min-h-9 !px-3 !text-[13px]">
                  Redenumește
                </button>
              ) : null}
              <button type="button" onClick={() => setConfirming(true)} className="btn btn-ghost !min-h-9 !px-3 !text-[13px] text-dim">
                Scoate din listă
              </button>
            </>
          )}
        </div>
        {confirming ? <p className="text-[12px] text-dim">Campaniile făcute cu el nu se ating; video-ul rămâne în conturile în care a fost trimis.</p> : null}
      </div>
    </li>
  );
}

export function MaterialsScreen({
  materials,
  clients,
  selectedClient,
  showAll,
  allHref,
  clientHref,
  missing,
  actions,
}: {
  materials: MaterialRow[];
  clients: Array<{ id: string; name: string }>;
  selectedClient: { id: string; name: string } | null;
  showAll: boolean;
  allHref: string;
  clientHref: string;
  missing: string | null;
  actions: MaterialsActions;
}) {
  const names = new Map(clients.map((client) => [client.id, client.name]));
  const visible = showAll || !selectedClient ? materials : materials.filter((material) => material.clientId === null || material.clientId === selectedClient.id);
  const platforms = new Set(visible.flatMap((material) => material.uploads.map((upload) => upload.platform)));

  return (
    <div className="mt-5 grid gap-6">
      {missing ? (
        <div role="alert" className="max-w-2xl rounded-xl border border-[var(--ap-error)]/30 bg-[var(--ap-error-soft)] px-5 py-4 text-[14px] text-bone/85">
          <p className="font-semibold text-[var(--ap-error)]">Materialele nu se pot citi încă.</p>
          <p className="mt-1">{missing}</p>
        </div>
      ) : (
        <div className="max-w-3xl">
          <UploadPanel clients={clients} defaultClientId={selectedClient?.id ?? null} actions={actions} />
        </div>
      )}

      {!missing ? (
        <section aria-labelledby="materiale-lista">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="materiale-lista" className="text-[16px] font-semibold text-bone">
              {visible.length === 0 ? "Niciun material" : visible.length === 1 ? "Un material" : `${visible.length} materiale`}
              <span className="font-normal text-dim"> · {showAll || !selectedClient ? "toți clienții" : `${selectedClient.name} și ale agenției`}</span>
            </h2>
            {selectedClient ? (
              <Link href={showAll ? clientHref : allHref} className="text-[13.5px] text-[var(--md-a1)] hover:underline">
                {showAll ? `Doar ${selectedClient.name}` : "Arată-le pe toate"}
              </Link>
            ) : null}
          </div>
          {platforms.size > 0 ? <p className="mt-1 text-[12.5px] text-dim">Trimise până acum pe {[...platforms].map((platform) => PLATFORM_LABEL[platform]).join(", ")}.</p> : null}
          {visible.length === 0 ? (
            <p className="mt-2 max-w-xl text-[14.5px] leading-relaxed text-dim">
              Urcă aici video-urile filmate pentru reclame. În „Creează”, la pasul Reclame, le alegi din listă, iar portalul le trimite singur în contul de reclame ales.
            </p>
          ) : (
            <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
              {visible.map((material) => (
                <MaterialCard key={material.id} material={material} clientName={material.clientId ? (names.get(material.clientId) ?? null) : null} actions={actions} />
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  );
}
