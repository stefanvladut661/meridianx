import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, ChevronRight, ExternalLink, FolderOpen, Sparkles } from "lucide-react";
import { cachedProbes } from "@/lib/postari/clipuri";
import { clipView } from "@/lib/postari/clip-view";
import { download, listFolder, resolveFolder, rootFolder, sameName, type FolderListing } from "@/lib/postari/drive";
import { parseManifest, type ManifestPart, type ManifestResult } from "@/lib/postari/manifest";
import { readSettings } from "@/lib/postari/setari";
import { isClaudeConfigured } from "@/lib/postari/claude-plan";
import { addDays, todayIn } from "@/lib/postari/timp";
import { InlineNote } from "@/components/panou/ui/actions";
import { btnClass, Card, Pill, SectionTitle } from "@/components/panou/ui/primitives";
import { ClaudePlan } from "@/components/panou/postari/claude-plan";
import { ClipsLot, type ClipRowData } from "@/components/panou/postari/clips";
import { ScreenHead } from "@/components/panou/postari/shared";
import { probeClipAction, writeCaptionsAction } from "./actions";

export const metadata: Metadata = { title: "Clipuri — MERIDIAN Postări", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
/** Un clip se descarcă întreg de pe Drive ca să fie citit; un apel poate dura. */
export const maxDuration = 60;

function partLabel(part: ManifestPart | null): string | null {
  if (!part) return null;
  return [part.cod, part.text].filter(Boolean).join(" · ") || null;
}

/**
 * /admin/postari/clipuri — ce e în folderul de pe Drive: loturile
 * (subfolderele), clipurile cu ce s-a citit din fișier, manifest.json pus
 * lângă ele de terminalul de reclame și „Scrie planul cu Claude”. Doar citire.
 */
export default async function ClipuriPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const path = typeof params.folder === "string" ? params.folder.slice(0, 500) : "";
  const root = await rootFolder();
  const intro = "Loturile din folderul Drive, citite din manifest. Vezi exact ce lipsește înainte să planifici.";

  if (!root.ok) {
    return (
      <div className="space-y-4">
        <ScreenHead title="Clipuri" text={intro} />
        <InlineNote tone="apricot">
          {root.message}{" "}
          <Link href="/admin/postari/setari" className="font-medium underline underline-offset-2">
            Deschide Setările
          </Link>
        </InlineNote>
      </div>
    );
  }

  const settings = await readSettings();
  const storageLimit = settings.ok ? settings.data.stocareLimitaMb : 50;
  const fusSettings = { ore: settings.ok ? settings.data.sloturiOre : ["12:30", "19:00"], fus: settings.ok ? settings.data.sloturiFus : "Europe/Bucharest" };
  const folder = await resolveFolder(path);
  const listing = folder.ok ? await listFolder(folder.data) : null;
  const data: FolderListing | null = listing?.ok ? listing.data : null;

  let manifest: ManifestResult | null = null;
  if (data?.manifest) {
    const bytes = await download(data.manifest.id);
    manifest = bytes.ok ? parseManifest(bytes.data.toString("utf8")) : { ok: false, message: bytes.message };
  }
  const probes = data ? await cachedProbes(data.clips.map((clip) => ({ id: clip.id, size: clip.size }))) : null;
  const viewOf = (file: FolderListing["clips"][number]) => clipView(file, probes?.ok ? (probes.data.get(file.id) ?? null) : null, storageLimit);

  // Rândurile lotului: întâi cele din manifest (cu clipul de pe Drive, dacă există), apoi clipurile fără manifest.
  const rows: ClipRowData[] = [];
  if (data) {
    const used = new Set<string>();
    if (manifest?.ok) {
      for (const entry of manifest.data.clipuri) {
        const file = data.clips.find((item) => item.name === entry.fisier || sameName(item.name, entry.fisier));
        if (file) used.add(file.id);
        rows.push({
          key: `m-${entry.fisier}`,
          name: file?.name ?? entry.fisier,
          clip: file ? viewOf(file) : null,
          manifest: { voce: entry.voce, hook: partLabel(entry.hook), cta: partLabel(entry.cta), stil: entry.stil, format: entry.format, durataS: entry.durata },
        });
      }
    }
    for (const file of data.clips) if (!used.has(file.id)) rows.push({ key: `d-${file.id}`, name: file.name, clip: viewOf(file), manifest: null });
  }
  const hasManifest = Boolean(manifest?.ok);
  const missing = rows.filter((row) => !row.clip).map((row) => row.name);
  const extra = hasManifest ? rows.filter((row) => row.clip && !row.manifest).map((row) => row.name) : [];

  const crumbs = folder.ok ? folder.data.path.split("/") : [root.data.name];
  const crumbHref = (index: number) => `/admin/postari/clipuri${index === 0 ? "" : `?folder=${encodeURIComponent(crumbs.slice(1, index + 1).join("/"))}`}`;
  const childHref = (name: string) => `/admin/postari/clipuri?folder=${encodeURIComponent([...crumbs.slice(1), name].join("/"))}`;
  const subPath = crumbs.slice(1).join("/");
  const lotName = crumbs[crumbs.length - 1];
  const claudeClips = manifest?.ok && data ? manifest.data.clipuri.filter((entry) => data.clips.some((file) => file.name === entry.fisier || sameName(file.name, entry.fisier))).map((entry) => entry.fisier) : [];
  const canWrite = Boolean(folder.ok && manifest?.ok && claudeClips.length > 0);

  return (
    <div className="space-y-4">
      <ScreenHead
        title="Clipuri"
        text={intro}
        actions={
          canWrite ? (
            <a href="#scrie-plan" className={btnClass({ variant: "primary", size: "sm", className: "gap-1.5" })}>
              <Sparkles className="h-4 w-4" aria-hidden="true" /> Scrie planul cu Claude
            </a>
          ) : null
        }
      />

      <Card className="flex flex-wrap items-center gap-3 py-3">
        <FolderOpen className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <nav aria-label="Folderul" className="flex min-w-0 flex-wrap items-center gap-x-1 font-mono text-[11.5px] text-foreground/75">
          {crumbs.map((crumb, index) => (
            <span key={`${crumb}-${index}`} className="inline-flex items-center gap-1">
              {index > 0 ? (
                <span aria-hidden="true" className="text-muted-foreground">
                  /
                </span>
              ) : null}
              {index === crumbs.length - 1 ? (
                <span aria-current="page" className="font-medium text-foreground">
                  {crumb}
                </span>
              ) : (
                <Link href={crumbHref(index)} className="text-lav underline-offset-2 hover:underline">
                  {crumb}
                </Link>
              )}
            </span>
          ))}
          <span aria-hidden="true" className="text-muted-foreground">
            /
          </span>
        </nav>
        {folder.ok ? (
          <>
            <Pill tone="mint" dot>
              conectat
            </Pill>
            <a href={folder.data.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
              pe Drive <ExternalLink className="h-3 w-3" aria-hidden="true" />
              <span className="sr-only">(filă nouă)</span>
            </a>
          </>
        ) : (
          <Pill tone="rose" dot>
            nu se vede
          </Pill>
        )}
        {data ? (
          <span className="ml-auto text-[11px] text-muted-foreground">
            {data.clips.length} {data.clips.length === 1 ? "clip" : "clipuri"}
            {data.subfolders.length > 0 ? ` · ${data.subfolders.length} ${data.subfolders.length === 1 ? "lot" : "loturi"}` : ""}
            {" · "}
            {!data.manifest ? "manifest.json lipsește" : manifest?.ok ? `manifest.json: ${manifest.data.clipuri.length} clipuri` : "manifest.json nu se poate citi"}
          </span>
        ) : null}
      </Card>

      {!folder.ok ? <InlineNote tone="rose">{folder.message}</InlineNote> : null}
      {folder.ok && !listing?.ok ? <InlineNote tone="rose">{listing?.message}</InlineNote> : null}

      {data ? (
        <>
          {data.manifest && manifest && !manifest.ok ? <InlineNote tone="rose">manifest.json: {manifest.message}</InlineNote> : null}
          {!data.manifest && (data.clips.length > 0 || data.subfolders.length === 0) ? (
            <InlineNote tone="neutral">Folderul n-are manifest.json. Planul se poate scrie și de mână; cu manifest, Claude scrie descrierile din hook, CTA și voce. Formatul e în README, la „Pentru terminalul de reclame”.</InlineNote>
          ) : null}
          {manifest?.ok && manifest.warnings.length > 0 ? (
            <InlineNote tone="apricot">
              <span className="flex flex-col gap-1">
                {manifest.warnings.map((warning) => (
                  <span key={warning} className="flex items-start gap-1.5">
                    <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" /> {warning}
                  </span>
                ))}
              </span>
            </InlineNote>
          ) : null}
          {missing.length > 0 || extra.length > 0 ? (
            <InlineNote tone="apricot">
              <span className="flex flex-col gap-1">
                {missing.map((name) => (
                  <span key={`l-${name}`} className="flex items-start gap-1.5">
                    <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" /> În manifest, dar lipsă din folder: <span className="break-all font-mono">{name}</span>
                  </span>
                ))}
                {extra.map((name) => (
                  <span key={`e-${name}`} className="flex items-start gap-1.5">
                    <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" /> În folder, dar nu în manifest: <span className="break-all font-mono">{name}</span>
                  </span>
                ))}
              </span>
            </InlineNote>
          ) : null}

          {data.subfolders.length > 0 ? (
            <Card className="overflow-hidden p-0">
              <div className="border-b border-white/[0.06] px-4 py-3">
                <SectionTitle title="Loturi" hint="Câte un subfolder pe lot. Deschide unul ca să vezi clipurile și manifestul lui." />
              </div>
              <ul className="grid gap-2 p-3 sm:grid-cols-2 xl:grid-cols-3">
                {data.subfolders.map((sub) => (
                  <li key={sub.id}>
                    <Link href={childHref(sub.name)} className="flex items-center gap-3 rounded-xl border border-white/[0.07] px-3 py-3 transition-colors hover:border-white/20 hover:bg-white/[0.03]">
                      <FolderOpen className="h-4 w-4 shrink-0 text-lav" aria-hidden="true" />
                      <span className="min-w-0 flex-1 truncate font-mono text-[12px]">{sub.name}</span>
                      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {rows.length > 0 || data.subfolders.length === 0 ? (
            <ClipsLot
              key={subPath || "radacina"}
              folder={subPath}
              title={lotName}
              hint={`${rows.length} ${rows.length === 1 ? "clip" : "clipuri"} · ${hasManifest ? "manifest.json citit" : "fără manifest.json"}${data.others > 0 ? ` · plus ${data.others} ${data.others === 1 ? "alt fișier" : "alte fișiere"} (nu video), lăsate deoparte` : ""}`}
              pathLabel={`${subPath || root.data.name}/`}
              rows={rows}
              hasManifest={hasManifest}
              probe={probeClipAction}
              storageLimitMb={storageLimit}
            />
          ) : null}

          {canWrite && folder.ok && manifest?.ok ? (
            <ClaudePlan
              key={subPath || "radacina"}
              folder={subPath}
              folderPath={folder.data.path}
              lot={typeof manifest.data.context.lot === "string" ? manifest.data.context.lot.slice(0, 120) : null}
              clips={claudeClips}
              defaults={{ ore: fusSettings.ore, fus: fusSettings.fus, start: addDays(todayIn(fusSettings.fus), 1) }}
              configured={isClaudeConfigured()}
              write={writeCaptionsAction}
            />
          ) : null}
        </>
      ) : null}
    </div>
  );
}
