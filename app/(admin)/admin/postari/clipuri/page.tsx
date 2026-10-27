import type { Metadata } from "next";
import Link from "next/link";
import { cachedProbes } from "@/lib/postari/clipuri";
import { clipView } from "@/lib/postari/clip-view";
import { download, listFolder, resolveFolder, rootFolder, sameName, type FolderListing } from "@/lib/postari/drive";
import { parseManifest, type ManifestResult } from "@/lib/postari/manifest";
import { readSettings } from "@/lib/postari/setari";
import { seconds } from "@/lib/postari/limite";
import { isClaudeConfigured } from "@/lib/postari/claude-plan";
import { addDays, todayIn } from "@/lib/postari/timp";
import { ClaudePlanPanel } from "@/components/postari/claude-plan-panel";
import { ClipsScreen } from "@/components/postari/clips-screen";
import { IconExternal, IconFolder } from "@/components/postari/icons";
import { Empty, Notice, PageHead, Tag, tdClass, thClass } from "@/components/postari/ui";
import { cn } from "@/lib/utils";
import { probeClipAction, writeCaptionsAction } from "./actions";

export const metadata: Metadata = { title: "Clipuri — MERIDIAN Postări", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
/** Un clip se descarcă întreg de pe Drive ca să fie citit; un apel poate dura. */
export const maxDuration = 60;

function partLabel(part: { cod: string | null; text: string | null } | null): string {
  if (!part) return "—";
  return [part.cod, part.text].filter(Boolean).join(" · ") || "—";
}

/**
 * /admin/postari/clipuri — ce e în folderul de pe Drive: subfolderele (loturile),
 * clipurile, cu ce s-a citit din ele, și manifest.json, pus lângă ele de
 * terminalul de reclame. Doar citire.
 */
export default async function ClipuriPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const path = typeof params.folder === "string" ? params.folder.slice(0, 500) : "";
  const root = await rootFolder();

  if (!root.ok) {
    return (
      <main className="px-4 pb-16 pt-6 sm:px-6">
        <PageHead title="Clipuri" subtitle="Clipurile terminate, din folderul de pe Drive." />
        <Notice tone="warn" className="mt-5 max-w-3xl">
          {root.message}{" "}
          <Link href="/admin/postari/setari" className="font-semibold underline underline-offset-2">
            Deschide Setările
          </Link>
        </Notice>
      </main>
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
  const clips = data ? data.clips.map((clip) => clipView(clip, probes?.ok ? (probes.data.get(clip.id) ?? null) : null, storageLimit)) : [];

  const crumbs = folder.ok ? folder.data.path.split("/") : [root.data.name];
  const crumbHref = (index: number) => `/admin/postari/clipuri${index === 0 ? "" : `?folder=${encodeURIComponent(crumbs.slice(1, index + 1).join("/"))}`}`;
  const childHref = (name: string) => `/admin/postari/clipuri?folder=${encodeURIComponent([...crumbs.slice(1), name].join("/"))}`;

  return (
    <main className="px-4 pb-16 pt-6 sm:px-6">
      <PageHead title="Clipuri" subtitle="Ce e pe Drive, citit din fișiere: formatul, durata, codecurile și dacă fiecare clip intră pe Instagram și pe TikTok." />

      <nav aria-label="Folderul" className="mt-5 flex flex-wrap items-center gap-1 text-[14px]">
        {crumbs.map((crumb, index) => (
          <span key={`${crumb}-${index}`} className="inline-flex items-center gap-1">
            {index > 0 ? <span aria-hidden className="text-dim">/</span> : null}
            {index === crumbs.length - 1 ? (
              <span aria-current="page" className="font-semibold text-bone">
                {crumb}
              </span>
            ) : (
              <Link href={crumbHref(index)} className="text-[var(--md-a1)] underline-offset-2 hover:underline">
                {crumb}
              </Link>
            )}
          </span>
        ))}
        {folder.ok ? (
          <a href={folder.data.link} target="_blank" rel="noreferrer" className="ml-2 inline-flex items-center gap-1 text-[13px] text-dim underline-offset-2 hover:text-bone hover:underline">
            pe Drive
            <IconExternal size={14} />
            <span className="sr-only">(filă nouă)</span>
          </a>
        ) : null}
      </nav>

      {!folder.ok ? (
        <Notice tone="error" className="mt-4 max-w-3xl">
          {folder.message}
        </Notice>
      ) : !listing?.ok ? (
        <Notice tone="error" className="mt-4 max-w-3xl">
          {listing?.message}
        </Notice>
      ) : data ? (
        <>
          {data.subfolders.length > 0 ? (
            <section aria-labelledby="subfoldere" className="mt-5">
              <h2 id="subfoldere" className="text-[15px] font-semibold text-bone">
                Subfoldere
              </h2>
              <ul className="mt-2 flex flex-wrap gap-2">
                {data.subfolders.map((sub) => (
                  <li key={sub.id}>
                    <Link href={childHref(sub.name)} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-hair-strong bg-white px-3 text-[14px] text-bone hover:bg-[var(--ap-hover)]">
                      <span className="text-dim">
                        <IconFolder />
                      </span>
                      {sub.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section aria-labelledby="manifest" className="mt-6">
            <div className="flex flex-wrap items-center gap-2">
              <h2 id="manifest" className="text-[15px] font-semibold text-bone">
                manifest.json
              </h2>
              {!data.manifest ? <Tag tone="muted">lipsește</Tag> : manifest?.ok ? <Tag tone="ok">{manifest.data.clipuri.length} clipuri</Tag> : <Tag tone="error">nu se poate citi</Tag>}
            </div>
            {!data.manifest ? (
              <p className="mt-1 max-w-3xl text-[13.5px] text-dim">Folderul n-are manifest.json. Planul se poate scrie și de mână; cu manifest, Claude scrie descrierile din hook, CTA și voce. Formatul e în README, la „Pentru terminalul de reclame”.</p>
            ) : manifest && !manifest.ok ? (
              <Notice tone="error" className="mt-2 max-w-3xl">
                {manifest.message}
              </Notice>
            ) : manifest?.ok ? (
              <>
                {manifest.warnings.length > 0 ? (
                  <ul className="mt-2 grid gap-1">
                    {manifest.warnings.map((warning) => (
                      <li key={warning} className="text-[13px] text-[var(--ap-warn)]">
                        {warning}
                      </li>
                    ))}
                  </ul>
                ) : null}
                <div className="mt-2 overflow-x-auto rounded-xl border border-hair bg-white">
                  <table className="ads-table min-w-full border-collapse">
                    <thead>
                      <tr className="border-b border-hair">
                        <th className={thClass}>Fișier</th>
                        <th className={thClass}>Pe Drive</th>
                        <th className={thClass}>Voce</th>
                        <th className={thClass}>Hook</th>
                        <th className={thClass}>CTA</th>
                        <th className={thClass}>Stil</th>
                        <th className={thClass}>Format</th>
                        <th className={thClass}>Durată</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-hair">
                      {manifest.data.clipuri.map((clip) => {
                        const onDrive = data.clips.some((file) => file.name === clip.fisier || sameName(file.name, clip.fisier));
                        return (
                          <tr key={clip.fisier}>
                            <td className={cn(tdClass, "whitespace-nowrap font-[family-name:var(--font-jbmono),ui-monospace,monospace] text-[13px]")}>{clip.fisier}</td>
                            <td className={tdClass}>{onDrive ? <Tag tone="ok">da</Tag> : <Tag tone="error">lipsește</Tag>}</td>
                            <td className={cn(tdClass, "text-[13px]")}>{clip.voce ?? "—"}</td>
                            <td className={cn(tdClass, "min-w-[12rem] text-[13px]")}>{partLabel(clip.hook)}</td>
                            <td className={cn(tdClass, "min-w-[10rem] text-[13px]")}>{partLabel(clip.cta)}</td>
                            <td className={cn(tdClass, "text-[13px]")}>{clip.stil ?? "—"}</td>
                            <td className={cn(tdClass, "text-[13px]")}>{clip.format ?? "—"}</td>
                            <td className={cn(tdClass, "whitespace-nowrap text-[13px]")}>{clip.durata ? seconds(clip.durata * 1000) : "—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {(() => {
                  const extra = data.clips.filter((file) => !manifest.data.clipuri.some((clip) => clip.fisier === file.name || sameName(clip.fisier, file.name)));
                  return extra.length > 0 ? <p className="mt-2 text-[13px] text-dim">În folder, dar nu în manifest: {extra.map((file) => `„${file.name}”`).join(", ")}.</p> : null;
                })()}
                {folder.ok ? (
                  <ClaudePlanPanel
                    folder={crumbs.slice(1).join("/")}
                    folderPath={folder.data.path}
                    lot={typeof manifest.data.context.lot === "string" ? manifest.data.context.lot.slice(0, 120) : null}
                    clips={manifest.data.clipuri.filter((clip) => data.clips.some((file) => file.name === clip.fisier || sameName(file.name, clip.fisier))).map((clip) => clip.fisier)}
                    defaults={{ ore: fusSettings.ore, fus: fusSettings.fus, start: addDays(todayIn(fusSettings.fus), 1) }}
                    configured={isClaudeConfigured()}
                    write={writeCaptionsAction}
                  />
                ) : null}
              </>
            ) : null}
          </section>

          <section aria-labelledby="clipuri" className="mt-6">
            <h2 id="clipuri" className="text-[15px] font-semibold text-bone">
              Clipurile ({data.clips.length})
            </h2>
            {data.others > 0 ? <p className="mt-0.5 text-[13px] text-dim">Plus {data.others} {data.others === 1 ? "alt fișier" : "alte fișiere"} (nu video), lăsate deoparte.</p> : null}
            {data.clips.length === 0 && data.subfolders.length > 0 ? (
              <Empty className="mt-3">Aici sunt doar subfoldere. Deschide unul ca să vezi clipurile lotului.</Empty>
            ) : (
              <ClipsScreen folder={crumbs.slice(1).join("/")} clips={clips} probe={probeClipAction} />
            )}
          </section>
        </>
      ) : null}
    </main>
  );
}
