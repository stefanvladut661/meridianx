"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Film, MoreHorizontal, Pencil, Play, RefreshCw, Trash2, Upload } from "lucide-react";
import { PLATFORM_LABEL, VIDEO_UPLOAD_MAX_BYTES, VIDEO_UPLOAD_TYPES } from "@/lib/ads/constants";
import { MATERIAL_NAME_MAX, aspectLabel, durationLabel, sizeLabel, type MaterialRow, type MaterialUploadRow } from "@/lib/ads/materials-shared";
import { Btn, Card, Pill, SectionTitle, SegmentedControl } from "@/components/panou/ui/primitives";
import { ProgressBar, inputClass } from "@/components/panou/ui/states";
import { ConfirmDialog, InlineNote } from "@/components/panou/ui/actions";
import { Menu, MenuLabel, menuItemClass } from "@/components/panou/ui/menu";
import { Modal } from "@/components/panou/ui/modal";
import { SoftSelect, TextInput } from "@/components/panou/ui/select";
import { useToast } from "@/components/panou/ui/toast";
import { useQueryParams } from "@/components/panou/ui/use-query-params";
import { dateTimeRo } from "@/components/panou/ui/format";
import { cn } from "@/lib/utils";

/**
 * Materiale (CreativesPage din redesign): biblioteca de video a agenției, cu
 * urcarea și progresul ei. Aspectul e al prototipului; datele sunt cele reale:
 * browserul urcă fișierul direct în stocarea privată, printr-un URL semnat pentru
 * UN fișier, iar portalul îl trimite într-un cont de reclame abia când îl alegi
 * într-o campanie. „Reia urcarea” refolosește același URL semnat (dacă fișierul
 * a ajuns deja, doar confirmă); o urcare rămasă neterminată din altă sesiune se
 * reia alegând din nou fișierul și înlocuiește rândul vechi.
 */

type Failure = { ok: false; message: string };
type Info = { duration: number | null; width: number | null; height: number | null };

export interface MaterialeActions {
  prepare: (input: { name: string; clientId: string | null; file: { size: number; type: string }; video: Info }) => Promise<{ ok: true; id: string; uploadUrl: string } | Failure>;
  finish: (input: { id: string }) => Promise<{ ok: true } | Failure>;
  rename: (input: { id: string; name: string }) => Promise<{ ok: true } | Failure>;
  archive: (input: { id: string }) => Promise<{ ok: true } | Failure>;
}

const UNREACHABLE = "Serverul n-a răspuns. Încearcă din nou.";
const LABEL = "text-[11px] uppercase tracking-[0.12em] text-muted-foreground";
const ACCOUNT_PILL = "border-white/[0.09] bg-white/[0.04] text-foreground/60";

export const megabytes = (bytes: number): string => new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 1 }).format(bytes / 1024 / 1024);

/** PUT prin XHR: `fetch` nu raportează progresul unei urcări. */
function putFile(url: string, file: File, onProgress: (loaded: number, total: number) => void, register: (xhr: XMLHttpRequest) => void): Promise<void> {
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
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(xhr.status === 413 ? "too_large" : `http_${xhr.status}`)));
    xhr.onerror = () => reject(new Error("network"));
    xhr.onabort = () => reject(new Error("aborted"));
    xhr.send(file);
  });
}

/** Durata și dimensiunile, citite din fișier în browser, înainte de urcare. */
function readVideoInfo(file: File): Promise<Info> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    const done = (info: Info) => {
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

function checkFile(file: File): string | null {
  if (!(VIDEO_UPLOAD_TYPES as readonly string[]).includes(file.type)) return "Fișierul nu e MP4 sau MOV. Exportă clipul în MP4 (H.264) și încearcă din nou.";
  if (file.size > VIDEO_UPLOAD_MAX_BYTES) {
    return `${file.name} are ${megabytes(file.size)} MB, peste limita de ${megabytes(VIDEO_UPLOAD_MAX_BYTES)} MB. Exportă-l la 4–6 Mbps (tot 1080p) sau taie din durată.`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Urcarea
// ---------------------------------------------------------------------------

interface Job {
  file: File;
  name: string;
  clientId: string | null;
  info: Info;
  /** Rândul creat și URL-ul semnat; rămân pe job ca „Reia urcarea” să nu creeze dubluri. */
  prepared: { id: string; uploadUrl: string } | null;
  /** Fișierul a ajuns în stocare; mai lipsește doar confirmarea. */
  uploaded: boolean;
  /** Rândul „Urcare neterminată” pe care îl înlocuiește urcarea asta. */
  replaces: string | null;
}

type Phase = { step: "idle" } | { step: "uploading"; job: Job; loaded: number; total: number } | { step: "failed"; job: Job; message: string };

function UploadModalBody({
  draft,
  clients,
  defaultClientId,
  onStart,
  onClose,
}: {
  draft: { file: File; info: Info | null; name: string; clientId: string | null; replaces: string | null };
  clients: Array<{ id: string; name: string }>;
  defaultClientId: string | null;
  onStart: (job: Job) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(draft.name);
  const [clientId, setClientId] = useState(draft.clientId ?? defaultClientId ?? "");
  const [problem, setProblem] = useState<string | null>(null);
  const info = draft.info;
  const facts = info ? [durationLabel(info.duration), aspectLabel(info.width, info.height), `${megabytes(draft.file.size)} MB`].filter(Boolean) : null;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (!name.trim()) {
          setProblem("Dă-i materialului un nume — cel după care îl recunoști în listă.");
          return;
        }
        onStart({ file: draft.file, name: name.trim(), clientId: clientId || null, info: info ?? { duration: null, width: null, height: null }, prepared: null, uploaded: false, replaces: draft.replaces });
      }}
    >
      <h2 className="text-[16px] font-semibold">{draft.replaces ? "Reia urcarea" : "Urcă un video"}</h2>
      <p className="text-[12px] text-muted-foreground">
        MP4 sau MOV, cel mult {megabytes(VIDEO_UPLOAD_MAX_BYTES)} MB. Îl urci o dată; ajunge în contul de reclame abia când îl alegi într-o campanie.
      </p>

      <div className="mt-4 space-y-3">
        <div className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.025] px-3 py-2.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-lav/25 bg-lav/10">
            <Film className="h-4 w-4 text-lav" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-medium">{draft.file.name}</p>
            <p className="text-[11px] text-muted-foreground">{facts ? facts.join(" · ") || "Browserul n-a putut citi durata și formatul; se urcă oricum." : "Se citește durata și formatul…"}</p>
          </div>
        </div>
        <label className="block">
          <span className={LABEL}>Numele din listă</span>
          <TextInput className="mt-1.5" value={name} maxLength={MATERIAL_NAME_MAX} onChange={(event) => setName(event.currentTarget.value)} autoFocus />
        </label>
        <SoftSelect
          label="Pentru clientul"
          value={clientId || "none"}
          onChange={(value) => setClientId(value === "none" ? "" : value)}
          options={[{ value: "none", label: "Oricare (al agenției)" }, ...clients.map((client) => ({ value: client.id, label: client.name }))]}
        />
        {problem ? <InlineNote tone="rose">{problem}</InlineNote> : null}
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <Btn variant="ghost" onClick={onClose}>
          Renunță
        </Btn>
        <Btn type="submit" variant="primary" icon={Upload}>
          Urcă în Materiale
        </Btn>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Rândul din bibliotecă
// ---------------------------------------------------------------------------

function uploadPill(upload: MaterialUploadRow) {
  const tone = upload.status === "failed" ? "border-rose/25 bg-rose/10 text-[#FFB0C0]" : upload.status === "sent" ? "border-sky/25 bg-sky/10 text-[#AEE3FF]" : ACCOUNT_PILL;
  const state = upload.status === "ready" ? "în bibliotecă" : upload.status === "failed" ? `n-a mers${upload.message ? `: ${upload.message}` : ""}` : "se procesează";
  return { tone, state };
}

function MaterialRowItem({
  material,
  clientName,
  onPreview,
  onRename,
  onArchive,
  onResume,
}: {
  material: MaterialRow;
  clientName: string | null;
  onPreview: (material: MaterialRow) => void;
  onRename: (material: MaterialRow) => void;
  onArchive: (material: MaterialRow) => void;
  onResume: (material: MaterialRow) => void;
}) {
  const unfinished = material.status === "uploading";
  const facts = [aspectLabel(material.width, material.height), sizeLabel(material.sizeBytes), durationLabel(material.durationSeconds)].filter(Boolean);
  const thumb = (
    <>
      <Play className="h-3.5 w-3.5 text-white/40" aria-hidden="true" />
      {material.durationSeconds ? <span className="absolute bottom-0.5 right-1 font-mono text-[8.5px] text-white/60">{durationLabel(material.durationSeconds)}</span> : null}
    </>
  );
  const thumbClass = cn(
    "relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/[0.08] bg-gradient-to-br",
    unfinished ? "from-[#241A16] to-[#12100F]" : "from-[#2A2340] to-[#121018]"
  );

  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-3">
      {material.previewUrl ? (
        <button type="button" onClick={() => onPreview(material)} className={cn(thumbClass, "transition-colors hover:border-white/20")} aria-label={`Previzualizează ${material.name}`}>
          {thumb}
        </button>
      ) : (
        <span className={thumbClass} aria-hidden="true">
          {thumb}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px]">{material.name}</p>
        <p className="text-[11px] text-muted-foreground">
          {facts.length ? `${facts.join(" · ")} · ` : ""}
          {clientName ?? "al agenției"} · {dateTimeRo(material.createdAt)}
        </p>
        <div className="mt-1.5 flex flex-wrap gap-1">
          {material.uploads.length ? (
            material.uploads.map((upload) => {
              const pill = uploadPill(upload);
              return (
                <Pill key={`${upload.platform}|${upload.adAccount}`} tone="neutral" className={pill.tone}>
                  {PLATFORM_LABEL[upload.platform]} · <span className="font-mono text-[10.5px]">{upload.adAccount}</span> · {pill.state}
                </Pill>
              );
            })
          ) : unfinished ? null : (
            <span className="text-[10.5px] text-muted-foreground/70">netrimis încă în niciun cont</span>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {unfinished ? (
          <div className="flex items-center gap-1.5">
            <Pill tone="apricot" dot>
              Urcare neterminată
            </Pill>
            <Btn size="xs" variant="outline" onClick={() => onResume(material)}>
              Reia
            </Btn>
          </div>
        ) : (
          <Pill tone="mint" dot>
            gata
          </Pill>
        )}
        <Menu
          trigger={(props) => (
            <button type="button" {...props} className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-white/[0.07] hover:text-foreground" aria-label={`Acțiuni pentru ${material.name}`}>
              <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
          className="w-52"
        >
          <MenuLabel>Material</MenuLabel>
          {material.previewUrl ? (
            <button type="button" role="menuitem" className={menuItemClass} onClick={() => onPreview(material)}>
              <Play className="h-3.5 w-3.5" aria-hidden="true" /> Previzualizează
            </button>
          ) : null}
          {!unfinished ? (
            <button type="button" role="menuitem" className={menuItemClass} onClick={() => onRename(material)}>
              <Pencil className="h-3.5 w-3.5" aria-hidden="true" /> Redenumește
            </button>
          ) : null}
          <button type="button" role="menuitem" className={cn(menuItemClass, "text-rose")} onClick={() => onArchive(material)}>
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> Scoate din listă
          </button>
        </Menu>
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Ecranul
// ---------------------------------------------------------------------------

export function MaterialeScreen({
  materials,
  clients,
  selectedClient,
  missing,
  actions,
}: {
  materials: MaterialRow[];
  clients: Array<{ id: string; name: string }>;
  selectedClient: { id: string; name: string } | null;
  missing: string | null;
  actions: MaterialeActions;
}) {
  const router = useRouter();
  const { notify } = useToast();
  const { get, setMany } = useQueryParams();
  const fileRef = useRef<HTMLInputElement>(null);
  const xhr = useRef<XMLHttpRequest | null>(null);
  const cancelled = useRef(false);
  const replacing = useRef<MaterialRow | null>(null);
  const fileId = useId();

  const [phase, setPhase] = useState<Phase>({ step: "idle" });
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ file: File; info: Info | null; name: string; clientId: string | null; replaces: string | null } | null>(null);
  const [preview, setPreview] = useState<MaterialRow | null>(null);
  const [renaming, setRenaming] = useState<MaterialRow | null>(null);
  const [archiving, setArchiving] = useState<MaterialRow | null>(null);

  const names = new Map(clients.map((client) => [client.id, client.name]));
  const showAll = get("toate") === "1" || !selectedClient;
  const visible = showAll ? materials : materials.filter((material) => material.clientId === null || material.clientId === selectedClient.id);
  const platforms = new Set(visible.flatMap((material) => material.uploads.map((upload) => upload.platform)));
  const uploading = phase.step === "uploading";

  // Închiderea paginii în mijlocul urcării cere confirmare.
  useEffect(() => {
    if (!uploading) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [uploading]);

  useEffect(() => () => xhr.current?.abort(), []);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    const stale = replacing.current;
    replacing.current = null;
    const problem = checkFile(file);
    if (problem) {
      setError(problem);
      return;
    }
    const base = { file, info: null, name: stale?.name ?? file.name.replace(/\.(mp4|mov)$/i, "").slice(0, MATERIAL_NAME_MAX), clientId: stale?.clientId ?? null, replaces: stale?.id ?? null };
    setDraft(base);
    const info = await readVideoInfo(file);
    setDraft((current) => (current && current.file === file ? { ...current, info } : current));
  };

  const run = async (initial: Job) => {
    let job = initial;
    cancelled.current = false;
    setError(null);
    setPhase({ step: "uploading", job, loaded: 0, total: job.file.size });

    let prepared = job.prepared;
    if (!prepared) {
      const response = await actions.prepare({ name: job.name, clientId: job.clientId, file: { size: job.file.size, type: job.file.type }, video: job.info }).catch(() => null);
      if (!response || !response.ok) {
        setPhase({ step: "failed", job, message: response ? response.message : "Serverul n-a răspuns. Nu s-a urcat nimic. Încearcă din nou." });
        return;
      }
      prepared = { id: response.id, uploadUrl: response.uploadUrl };
      job = { ...job, prepared };
    }

    if (!job.uploaded) {
      try {
        await putFile(prepared.uploadUrl, job.file, (loaded, total) => setPhase({ step: "uploading", job, loaded, total }), (request) => (xhr.current = request));
      } catch (caught) {
        const reason = caught instanceof Error ? caught.message : "";
        if (reason === "aborted" && cancelled.current) {
          setPhase({ step: "idle" });
          notify("Urcarea a fost anulată. Fișierul nu e în Materiale.", "warn");
          return;
        }
        // Un URL refuzat (expirat, deja folosit) nu mai e bun: următoarea încercare cere altul.
        const reusable = reason === "network" || reason === "aborted";
        setPhase({
          step: "failed",
          job: reusable ? job : { ...job, prepared: null },
          message:
            reason === "too_large"
              ? "Stocarea a refuzat fișierul: e prea mare."
              : reason === "network"
                ? "Rețeaua s-a întrerupt în timpul urcării. Poți relua urcarea."
                : reason === "aborted"
                  ? "Urcarea e oprită. Poți relua urcarea."
                  : `Stocarea a refuzat fișierul (${reason}). Poți relua urcarea.`,
        });
        return;
      } finally {
        xhr.current = null;
      }
      job = { ...job, uploaded: true };
    }

    const finished = await actions.finish({ id: prepared.id }).catch(() => null);
    if (!finished || !finished.ok) {
      setPhase({ step: "failed", job, message: finished ? finished.message : "Serverul n-a confirmat urcarea. Apasă „Reia urcarea”: fișierul nu se urcă a doua oară." });
      return;
    }
    if (job.replaces) await actions.archive({ id: job.replaces }).catch(() => null);
    setPhase({ step: "idle" });
    notify(`„${job.name}” e în Materiale. Îl alegi într-o campanie, în „Creează”.`);
    router.refresh();
  };

  const current = phase.step === "idle" ? null : phase.job;
  const percent = phase.step === "uploading" ? Math.min(100, (phase.loaded / Math.max(1, phase.total)) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold leading-none sm:text-[26px]">Materiale</h1>
          <p className="mt-2 max-w-2xl text-[12.5px] text-muted-foreground">
            Biblioteca de video a conturilor. Ce urci aici e ce poți trimite în campanii: le urci o dată și le folosești pe orice canal.
          </p>
        </div>
        <Btn
          size="sm"
          variant="primary"
          icon={Upload}
          disabled={Boolean(missing) || uploading}
          onClick={() => {
            replacing.current = null;
            fileRef.current?.click();
          }}
        >
          Încarcă video nou
        </Btn>
        <input
          id={fileId}
          ref={fileRef}
          type="file"
          accept="video/mp4,video/quicktime"
          className="sr-only"
          tabIndex={-1}
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = "";
            void pick(file);
          }}
          aria-label="Alege un video MP4 sau MOV"
        />
      </div>

      {missing ? (
        <InlineNote tone="rose">
          <p className="font-medium">Materialele nu se pot citi încă.</p>
          <p className="mt-1">{missing}</p>
        </InlineNote>
      ) : null}
      {error ? <InlineNote tone="rose">{error}</InlineNote> : null}

      {phase.step !== "idle" && current ? (
        <Card>
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-lav/25 bg-lav/10">
              <Film className="h-4 w-4 text-lav" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium">{current.name}</p>
              <p className="text-[11px] text-muted-foreground">
                {phase.step === "uploading"
                  ? `${megabytes(phase.loaded)} din ${megabytes(phase.total)} MB · ${Math.round(percent)}% urcat`
                  : `${megabytes(current.file.size)} MB · urcare întreruptă`}
              </p>
            </div>
            {phase.step === "uploading" ? (
              <span className="inline-flex items-center gap-1.5 text-[11.5px] text-muted-foreground" role="status">
                <RefreshCw className="h-3 w-3 animate-spin" aria-hidden="true" /> se urcă
              </span>
            ) : null}
          </div>
          <ProgressBar value={phase.step === "uploading" ? percent : 0} tone={phase.step === "failed" ? "rose" : "lav"} className="mt-3" />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] text-muted-foreground">Nu închide fila. Dacă urcarea se întrerupe, o poți relua cu același fișier.</p>
            <div className="flex gap-1.5">
              {phase.step === "uploading" ? (
                <Btn
                  size="xs"
                  variant="ghost"
                  onClick={() => {
                    cancelled.current = true;
                    xhr.current?.abort();
                  }}
                >
                  Oprește urcarea
                </Btn>
              ) : (
                <Btn size="xs" variant="ghost" onClick={() => setPhase({ step: "idle" })}>
                  Renunță
                </Btn>
              )}
            </div>
          </div>
          {phase.step === "failed" ? (
            <InlineNote tone="rose" className="mt-3">
              {phase.message}{" "}
              <button type="button" className="underline underline-offset-2" onClick={() => void run(phase.job)}>
                Reia urcarea
              </button>
            </InlineNote>
          ) : null}
        </Card>
      ) : null}

      {!missing ? (
        <Card className="overflow-hidden p-0">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] px-4 py-3">
            <SectionTitle title="Biblioteca de video" hint={`${visible.length} ${visible.length === 1 ? "fișier" : "fișiere"} · ${megabytes(VIDEO_UPLOAD_MAX_BYTES)} MB per fișier${platforms.size ? ` · trimise pe ${[...platforms].map((platform) => PLATFORM_LABEL[platform]).join(", ")}` : ""}`} />
            {selectedClient ? (
              <SegmentedControl
                size="sm"
                ariaLabel="Ce materiale se văd"
                value={showAll ? "toate" : "client"}
                onChange={(value) => setMany({ toate: value === "toate" ? "1" : "" })}
                options={[
                  { value: "client", label: `${selectedClient.name} și ale agenției` },
                  { value: "toate", label: "Toți clienții" },
                ]}
                className="max-w-full overflow-x-auto pu-no-scrollbar"
              />
            ) : null}
          </div>
          {visible.length > 0 ? (
            <ul className="divide-y divide-white/[0.05]">
              {visible.map((material) => (
                <MaterialRowItem
                  key={material.id}
                  material={material}
                  clientName={material.clientId ? (names.get(material.clientId) ?? null) : null}
                  onPreview={setPreview}
                  onRename={setRenaming}
                  onArchive={setArchiving}
                  onResume={(item) => {
                    replacing.current = item;
                    fileRef.current?.click();
                  }}
                />
              ))}
            </ul>
          ) : null}
          <div className="flex items-center gap-2 border-t border-white/[0.06] px-4 py-2.5 text-[11px] text-muted-foreground">
            <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden="true" />
            Un video poate fi folosit în oricâte campanii. „Scoate din listă” îl ascunde de aici; din conturile de reclame se șterge doar în platformă.
          </div>
        </Card>
      ) : null}

      {!missing && visible.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-white/[0.12] px-6 py-10 text-center">
          <CheckCircle2 className="mb-3 h-5 w-5 text-mint" aria-hidden="true" />
          <p className="text-[13px] font-medium">Biblioteca e goală</p>
          <p className="mt-1 max-w-sm text-[12px] text-muted-foreground">Încarcă primul MP4 vertical. După urcare, îl alegi într-o campanie, în „Creează”, la pasul Reclame.</p>
        </div>
      ) : null}

      <Modal open={Boolean(draft)} onOpenChange={(open) => !open && setDraft(null)} label="Urcă un video">
        {draft ? (
          <UploadModalBody
            key={draft.file.name + draft.file.size}
            draft={draft}
            clients={clients}
            defaultClientId={selectedClient?.id ?? null}
            onClose={() => setDraft(null)}
            onStart={(job) => {
              setDraft(null);
              void run(job);
            }}
          />
        ) : null}
      </Modal>

      <Modal open={Boolean(preview)} onOpenChange={(open) => !open && setPreview(null)} label={preview ? `Previzualizare: ${preview.name}` : undefined} className="w-[min(44rem,calc(100vw-2rem))]">
        {preview?.previewUrl ? (
          <div>
            <h2 className="truncate text-[16px] font-semibold">{preview.name}</h2>
            <p className="text-[12px] text-muted-foreground">Fără sunet și fără pornire singură; primul cadru, cu controale.</p>
            {/* Previzualizare fără sunet, fără pornire singură: primul cadru, cu controale. */}
            <video src={`${preview.previewUrl}#t=0.1`} preload="metadata" muted playsInline controls className="mt-4 max-h-[65dvh] w-full rounded-xl bg-black object-contain" aria-label={`Previzualizare: ${preview.name}`} />
            <div className="mt-4 flex justify-end">
              <Btn variant="ghost" onClick={() => setPreview(null)}>
                Închide
              </Btn>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal open={Boolean(renaming)} onOpenChange={(open) => !open && setRenaming(null)} label="Redenumește materialul">
        {renaming ? (
          <RenameBody
            material={renaming}
            rename={actions.rename}
            onClose={() => setRenaming(null)}
            onDone={() => {
              setRenaming(null);
              notify("Material redenumit.");
              router.refresh();
            }}
          />
        ) : null}
      </Modal>

      <ConfirmDialog
        open={Boolean(archiving)}
        onOpenChange={(open) => !open && setArchiving(null)}
        title={archiving ? `Scoți „${archiving.name}” din listă?` : "Scoți materialul din listă?"}
        description="Materialul dispare din bibliotecă și nu mai poate fi ales în campanii noi."
        consequence="Campaniile făcute cu el nu se ating; video-ul rămâne în conturile în care a fost trimis."
        confirmLabel="Scoate din listă"
        onConfirm={async () => {
          if (!archiving) return;
          const result = await actions.archive({ id: archiving.id }).catch(() => ({ ok: false as const, message: UNREACHABLE }) as Failure);
          if (!result.ok) {
            notify(`Materialul nu e scos. ${result.message}`, "error");
            return;
          }
          notify("Materialul a fost scos din listă.");
          router.refresh();
        }}
      />
    </div>
  );
}

function RenameBody({ material, rename, onClose, onDone }: { material: MaterialRow; rename: MaterialeActions["rename"]; onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState(material.name);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        const result = await rename({ id: material.id, name }).catch(() => ({ ok: false as const, message: UNREACHABLE }) as Failure);
        setBusy(false);
        if (!result.ok) {
          setProblem(result.message);
          return;
        }
        onDone();
      }}
    >
      <h2 className="text-[16px] font-semibold">Redenumește materialul</h2>
      <p className="text-[12px] text-muted-foreground">Numele după care îl recunoști în listă. Fișierul din platforme nu se schimbă.</p>
      <label className="mt-4 block">
        <span className={LABEL}>Nume</span>
        <input value={name} maxLength={MATERIAL_NAME_MAX} onChange={(event) => setName(event.currentTarget.value)} className={inputClass("mt-1.5")} autoFocus />
      </label>
      {problem ? <InlineNote tone="rose" className="mt-3">{problem}</InlineNote> : null}
      <div className="mt-5 flex justify-end gap-2">
        <Btn variant="ghost" onClick={onClose}>
          Renunță
        </Btn>
        <Btn type="submit" variant="primary" disabled={busy || !name.trim() || name.trim() === material.name}>
          {busy ? "Se salvează…" : "Salvează"}
        </Btn>
      </div>
    </form>
  );
}
