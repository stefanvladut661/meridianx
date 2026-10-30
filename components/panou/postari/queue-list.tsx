"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { AlertTriangle, CalendarDays, ExternalLink, Eye, EyeOff, Info, RotateCcw, X, Zap } from "lucide-react";
import type { RandIstoric } from "@/lib/postari/istoric";
import { stateDetail, STARE_LABEL, type PostView } from "@/lib/postari/coada-shared";
import { PLATFORMA_LABEL } from "@/lib/postari/limite";
import { momentLabel, zonedParts } from "@/lib/postari/timp";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "../ui/actions";
import { relativeRo, untilRo } from "../ui/format";
import { Modal } from "../ui/modal";
import { Btn, btnClass, Card, SectionTitle } from "../ui/primitives";
import { EmptyState } from "../ui/states";
import { useToast } from "../ui/toast";
import { ClipTile, PlatformPill, postKind, StatePill, UNREACHABLE, type ActionResult } from "./shared";

type HistoryResult = { ok: true; items: RandIstoric[] } | { ok: false; message: string };

export interface QueueGroup {
  key: string;
  /** Titlul zilei când lista arată mai multe zile (ex. „Azi”, „mâine”, „joi 5 noiembrie”). */
  label: string | null;
  hint: string | null;
  posts: PostView[];
}

const driveLink = (id: string) => `https://drive.google.com/file/d/${id}/view`;

/** O postare ajunsă la ora ei, dar neluată încă de nicio rulare. */
const isDue = (post: PostView, now: number) => post.stare === "planificata" && new Date(post.programataLa).getTime() <= now;

function PostRow({
  post,
  fus,
  now,
  running,
  busy,
  onOpen,
  onRetry,
  onRemove,
  onRun,
}: {
  post: PostView;
  fus: string;
  now: number;
  running: boolean;
  busy: boolean;
  onOpen: (post: PostView) => void;
  onRetry: (post: PostView) => void;
  onRemove: (post: PostView) => void;
  onRun: () => void;
}) {
  const time = zonedParts(new Date(post.programataLa), fus).time;
  const timeOf = (iso: string) => zonedParts(new Date(iso), fus).time;
  const detail = stateDetail(post, timeOf);
  const { kind, notes } = postKind(post);
  const future = new Date(post.programataLa).getTime() > now;
  const text = post.descriere.trim() || post.caption.trim();

  return (
    <li className={cn("flex flex-wrap items-start gap-3 px-4 py-3.5", post.stare === "scoasa" && "opacity-60")}>
      <ClipTile platform={post.platforma} durationMs={post.durataMs} />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <PlatformPill platforma={post.platforma} />
          <StatePill stare={post.stare} />
          <span className="text-[11px] text-muted-foreground">{kind}</span>
        </div>
        {text ? <p className="mt-1 truncate text-[12.5px] text-foreground/85">{text}</p> : <p className="mt-1 text-[12.5px] italic text-muted-foreground">Fără descriere în plan</p>}
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10.5px] text-muted-foreground">
          <span className="pu-num">{time}</span>
          <span aria-hidden="true">·</span>
          <button
            type="button"
            onClick={() => onOpen(post)}
            className="break-all text-left font-mono underline decoration-white/20 underline-offset-4 hover:text-foreground hover:decoration-white/60"
            aria-label={`Detalii: ${post.fisier} pe ${PLATFORMA_LABEL[post.platforma]}`}
          >
            {post.fisier}
          </button>
          <span aria-hidden="true">·</span>
          <span>{future ? untilRo(post.programataLa, now) : relativeRo(post.programataLa, now)}</span>
          <span aria-hidden="true">·</span>
          <span>{post.sursaOra === "slot" ? "slot" : "oră fixă"}</span>
        </p>
        <p className="mt-1.5 flex flex-wrap gap-1.5">
          {notes.map((note) => (
            <span key={note} className="rounded-md border border-white/[0.08] bg-white/[0.03] px-1.5 py-0.5 text-[10.5px] text-muted-foreground">
              {note}
            </span>
          ))}
        </p>

        {detail ? <p className="mt-1.5 text-[11.5px] text-foreground/75">{detail}</p> : null}
        {post.stare === "esuata" && post.eroare ? (
          <p className="mt-1.5 rounded-lg border border-rose/20 bg-rose/[0.06] px-2 py-1 text-[10.5px] text-[#FFC2CE]">
            {post.eroare}
            {post.incercari > 1 ? <span className="opacity-75"> ({post.incercari} încercări)</span> : null}
          </p>
        ) : null}
        {post.stare !== "esuata" && post.stare !== "scoasa" && post.eroare && !detail?.includes(post.eroare) ? (
          <p className="mt-1.5 rounded-lg border border-apricot/20 bg-apricot/[0.06] px-2 py-1 text-[10.5px] text-[#FFD0AC]">Ultima încercare: {post.eroare}</p>
        ) : null}
        {post.avertisment ? <p className="mt-1.5 rounded-lg border border-apricot/20 bg-apricot/[0.06] px-2 py-1 text-[10.5px] text-[#FFD0AC]">{post.avertisment}</p> : null}
        {post.stare === "publicata" ? (
          <p className="mt-1 text-[10.5px] text-muted-foreground">
            {post.publicataLa ? `Publicată ${momentLabel(post.publicataLa, fus)}` : "Publicată"}
            {post.publicataDe ? ` · ${post.publicataDe}` : ""}
          </p>
        ) : null}
        {post.stare === "in_ciorne" && post.trimisaLa ? <p className="mt-1 text-[10.5px] text-muted-foreground">În ciornele TikTok din {momentLabel(post.trimisaLa, fus)}.</p> : null}
        {post.stare === "scoasa" && post.scoasaLa ? <p className="mt-1 text-[10.5px] text-muted-foreground">Scoasă {momentLabel(post.scoasaLa, fus)}.</p> : null}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {post.link ? (
          <a href={post.link} target="_blank" rel="noreferrer" className={btnClass({ variant: "outline", size: "xs" })}>
            Vezi postarea <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="sr-only">(filă nouă)</span>
          </a>
        ) : null}
        {post.stare === "esuata" ? (
          <Btn size="xs" variant="primary" icon={RotateCcw} disabled={busy} onClick={() => onRetry(post)} aria-label={`Reîncearcă ${post.fisier} pe ${PLATFORMA_LABEL[post.platforma]}`} title={running ? undefined : "Coada e oprită: pornește-o ca postarea să plece."}>
            Reîncearcă
          </Btn>
        ) : null}
        {running && isDue(post, now) ? (
          <Btn size="xs" variant="outline" icon={Zap} disabled={busy} onClick={onRun} title="Rulează coada acum: pleacă tot ce e deja la timp.">
            Rulează acum
          </Btn>
        ) : null}
        {post.sePoateScoate ? (
          <Btn size="xs" variant="ghost" icon={X} disabled={busy} onClick={() => onRemove(post)} aria-label={`Scoate din coadă ${post.fisier} pe ${PLATFORMA_LABEL[post.platforma]}`}>
            Scoate
          </Btn>
        ) : null}
        {post.stare === "in_ciorne" ? (
          <Link href="/admin/postari/tiktok" className={btnClass({ variant: "outline", size: "xs" })}>
            Publică din telefon
          </Link>
        ) : null}
        <Btn size="xs" variant="ghost" icon={Info} onClick={() => onOpen(post)} aria-label={`Detalii și istoric: ${post.fisier} pe ${PLATFORMA_LABEL[post.platforma]}`}>
          Detalii
        </Btn>
      </div>
    </li>
  );
}

/** Detaliile unei postări: tot ce se știe despre ea și ce s-a întâmplat, pas cu pas (din istoric). */
function PostDetails({
  post,
  fus,
  history,
  busy,
  onClose,
  onRetry,
  onRemove,
}: {
  post: PostView;
  fus: string;
  history: (id: string) => Promise<HistoryResult>;
  busy: boolean;
  onClose: () => void;
  onRetry: (post: PostView) => void;
  onRemove: (post: PostView) => void;
}) {
  const [events, setEvents] = useState<HistoryResult | null>(null);
  const { kind, notes } = postKind(post);
  const detail = stateDetail(post, (iso) => momentLabel(iso, fus));

  useEffect(() => {
    let alive = true;
    history(post.id)
      .then((result) => alive && setEvents(result))
      .catch(() => alive && setEvents({ ok: false, message: "Istoricul nu s-a putut încărca." }));
    return () => {
      alive = false;
    };
  }, [history, post.id]);

  const facts: [string, string | null][] = [
    ["Ora din plan", `${momentLabel(post.programataLa, fus, true)} (${post.sursaOra === "slot" ? "slot" : "oră fixă"})`],
    ["Planul", post.planNume],
    ["Platforma", `${PLATFORMA_LABEL[post.platforma]} · ${kind}`],
    ["Starea", `${STARE_LABEL[post.stare]}${detail ? ` — ${detail}` : ""}`],
    ["Încercări", post.incercari ? String(post.incercari) : null],
    ["Trimisă în ciorne", post.trimisaLa ? momentLabel(post.trimisaLa, fus) : null],
    ["Publicată", post.publicataLa ? `${momentLabel(post.publicataLa, fus)}${post.publicataDe ? ` · ${post.publicataDe}` : ""}` : null],
    ["Repusă în coadă", post.reluataLa ? momentLabel(post.reluataLa, fus) : null],
    ["Scoasă din coadă", post.scoasaLa ? momentLabel(post.scoasaLa, fus) : null],
  ];

  return (
    <div>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="break-all font-mono text-[15px] font-semibold">{post.fisier}</h2>
          <p className="mt-1 text-[12px] text-muted-foreground">
            {PLATFORMA_LABEL[post.platforma]} · {momentLabel(post.programataLa, fus)}
          </p>
        </div>
        <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-white/[0.07] hover:text-foreground" aria-label="Închide detaliile">
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <StatePill stare={post.stare} />
        {notes.map((note) => (
          <span key={note} className="rounded-md border border-white/[0.08] bg-white/[0.03] px-1.5 py-0.5 text-[10.5px] text-muted-foreground">
            {note}
          </span>
        ))}
      </div>

      <dl className="mt-4 grid gap-x-4 gap-y-2 text-[12.5px] sm:grid-cols-[9rem_minmax(0,1fr)]">
        {facts
          .filter((fact): fact is [string, string] => Boolean(fact[1]))
          .map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-muted-foreground">{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
      </dl>

      {post.eroare ? (
        <p className={cn("mt-4 rounded-xl border px-3.5 py-3 text-[12.5px] leading-relaxed", post.stare === "esuata" ? "border-rose/25 bg-rose/[0.07] text-[#FFC2CE]" : "border-apricot/25 bg-apricot/[0.07] text-[#FFD0AC]")}>
          {post.eroare}
        </p>
      ) : null}
      {post.avertisment ? <p className="mt-3 rounded-xl border border-apricot/25 bg-apricot/[0.07] px-3.5 py-3 text-[12.5px] leading-relaxed text-[#FFD0AC]">{post.avertisment}</p> : null}

      <h3 className="mt-5 text-[13px] font-semibold">Descrierea</h3>
      {post.caption ? (
        <p className="mt-1.5 whitespace-pre-wrap break-words rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-[13px] leading-relaxed">{post.caption}</p>
      ) : (
        <p className="mt-1.5 text-[12.5px] text-muted-foreground">Fără descriere în plan.</p>
      )}
      <p className="mt-2 text-[12px]">
        <a href={driveLink(post.driveFileId)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-lav underline-offset-2 hover:underline">
          Clipul pe Drive <ExternalLink className="h-3 w-3" aria-hidden="true" />
          <span className="sr-only">(filă nouă)</span>
        </a>
      </p>

      <h3 className="mt-5 text-[13px] font-semibold">Ce s-a întâmplat</h3>
      {!events ? (
        <p className="mt-1.5 text-[12.5px] text-muted-foreground">Se încarcă istoricul…</p>
      ) : !events.ok ? (
        <p className="mt-1.5 text-[12.5px] text-[#FFC2CE]">{events.message}</p>
      ) : events.items.length === 0 ? (
        <p className="mt-1.5 text-[12.5px] text-muted-foreground">Nimic încă: postarea n-a pornit.</p>
      ) : (
        <ol className="mt-2 space-y-2.5 border-l border-white/[0.08] pl-3">
          {events.items.map((item) => (
            <li key={item.id} className="text-[12.5px]">
              <p className="text-[10.5px] text-muted-foreground">
                {momentLabel(item.createdAt, fus)} · {item.actor}
              </p>
              <p className={cn(item.rezultat === "eroare" && "text-[#FFC2CE]")}>
                <span className="font-medium">{item.actiune}</span>
                {item.mesaj ? ` — ${item.mesaj}` : ""}
              </p>
            </li>
          ))}
        </ol>
      )}

      <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-white/[0.06] pt-4">
        {post.link ? (
          <a href={post.link} target="_blank" rel="noreferrer" className={btnClass({ variant: "outline", size: "sm" })}>
            Vezi postarea <ExternalLink className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only">(filă nouă)</span>
          </a>
        ) : null}
        {post.stare === "esuata" ? (
          <Btn size="sm" variant="primary" icon={RotateCcw} disabled={busy} onClick={() => onRetry(post)}>
            Reîncearcă
          </Btn>
        ) : null}
        {post.sePoateScoate ? (
          <Btn size="sm" variant="ghost" icon={X} disabled={busy} onClick={() => onRemove(post)}>
            Scoate din coadă
          </Btn>
        ) : null}
        <Btn size="sm" variant="outline" onClick={onClose}>
          Închide
        </Btn>
      </div>
    </div>
  );
}

/**
 * Lista Cozii, ca în prototip: un card cu postările zilei alese, fiecare cu
 * platforma, starea, ora, motivul eșecului și acțiunile ei. Peste prototip:
 * „De văzut” (eșuatele, oricând ar fi fost ora lor), detaliile Reel / Trial
 * Reel, panoul cu istoricul postării și „Arată și cele scoase din coadă”.
 */
export function QueueList({
  title,
  hint,
  attention,
  groups,
  fus,
  now,
  running,
  remove,
  retry,
  runNow,
  history,
}: {
  title: string;
  hint: string;
  attention: PostView[];
  groups: QueueGroup[];
  fus: string;
  /** Momentul randării pe server: textele „în 12 min” ies la fel pe client, fără erori de hidratare. */
  now: number;
  running: boolean;
  remove: (id: string) => Promise<ActionResult>;
  retry: (id: string) => Promise<ActionResult>;
  runNow: () => Promise<ActionResult>;
  history: (id: string) => Promise<HistoryResult>;
}) {
  const router = useRouter();
  const { notify } = useToast();
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [removing, setRemoving] = useState<PostView | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [showRemoved, setShowRemoved] = useState(false);

  const all = [...attention, ...groups.flatMap((group) => group.posts)];
  const open = openId ? (all.find((post) => post.id === openId) ?? null) : null;
  const removedCount = groups.reduce((sum, group) => sum + group.posts.filter((post) => post.stare === "scoasa").length, 0);
  const visibleGroups = groups
    .map((group) => ({ ...group, posts: group.posts.filter((post) => showRemoved || post.stare !== "scoasa") }))
    .filter((group) => group.posts.length > 0);
  const shown = visibleGroups.reduce((sum, group) => sum + group.posts.length, 0);

  function act(kind: "retry" | "run", post: PostView | null, action: () => Promise<ActionResult>) {
    setBusyId(post?.id ?? "run");
    startTransition(async () => {
      try {
        const result = await action();
        notify(result.message, result.ok ? "default" : "error");
        if (result.ok && kind === "retry") setOpenId(null);
        router.refresh();
      } catch {
        notify(UNREACHABLE, "error");
      } finally {
        setBusyId(null);
      }
    });
  }

  const retryPost = (post: PostView) => act("retry", post, () => retry(post.id));
  const row = (post: PostView) => (
    <PostRow
      key={post.id}
      post={post}
      fus={fus}
      now={now}
      running={running}
      busy={pending && (busyId === post.id || busyId === "run")}
      onOpen={(item) => setOpenId(item.id)}
      onRetry={retryPost}
      onRemove={setRemoving}
      onRun={() => act("run", null, runNow)}
    />
  );

  return (
    <div className="space-y-4">
      {attention.length > 0 ? (
        <Card className="overflow-hidden border-rose/25 p-0">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rose/15 bg-rose/[0.05] px-4 py-3">
            <SectionTitle
              title={
                <span className="inline-flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-rose" aria-hidden="true" /> De văzut ({attention.length})
                </span>
              }
              hint="Eșuate sau blocate, oricând ar fi fost ora lor. Fiecare are motivul și „Reîncearcă”."
            />
          </div>
          <ul className="divide-y divide-white/[0.05]">{attention.map(row)}</ul>
        </Card>
      ) : null}

      <Card className="overflow-hidden p-0">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] px-4 py-3">
          <SectionTitle title={title} hint={hint} />
          <div className="flex flex-wrap items-center gap-3">
            {removedCount > 0 ? (
              <button type="button" onClick={() => setShowRemoved((value) => !value)} aria-pressed={showRemoved} className="inline-flex items-center gap-1.5 text-[11.5px] text-muted-foreground hover:text-foreground">
                {showRemoved ? <EyeOff className="h-3.5 w-3.5" aria-hidden="true" /> : <Eye className="h-3.5 w-3.5" aria-hidden="true" />}
                {showRemoved ? "Ascunde cele scoase" : `Arată și cele scoase (${removedCount})`}
              </button>
            ) : null}
            <Link href="/admin/postari/tiktok" className="text-[11.5px] text-muted-foreground hover:text-foreground">
              De publicat pe TikTok →
            </Link>
          </div>
        </div>

        {shown === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title="Nicio postare în ziua asta"
            text="Alege altă zi din calendar sau aprobă un plan nou. Postările apar aici imediat după aprobare."
            action={
              <Link href="/admin/postari/plan" className={btnClass({ variant: "primary", size: "sm" })}>
                Aprobă un plan
              </Link>
            }
          />
        ) : (
          <ul className="divide-y divide-white/[0.05]">
            {visibleGroups.map((group) => (
              <li key={group.key} className="list-none">
                {group.label ? (
                  <p className="flex flex-wrap items-baseline gap-x-2 border-b border-white/[0.05] bg-white/[0.02] px-4 py-2 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                    <span className="font-medium text-foreground/80">{group.label}</span>
                    {group.hint ? <span className="normal-case tracking-normal">{group.hint}</span> : null}
                  </p>
                ) : null}
                <ul className="divide-y divide-white/[0.05]">{group.posts.map(row)}</ul>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Modal open={Boolean(open)} onOpenChange={(next) => !next && setOpenId(null)} label={open ? `Detalii: ${open.fisier}` : undefined} className="max-h-[88vh] w-[min(40rem,calc(100vw-2rem))] overflow-y-auto">
        {open ? <PostDetails post={open} fus={fus} history={history} busy={pending} onClose={() => setOpenId(null)} onRetry={retryPost} onRemove={(post) => { setOpenId(null); setRemoving(post); }} /> : null}
      </Modal>

      <ConfirmDialog
        open={Boolean(removing)}
        onOpenChange={(next) => !next && setRemoving(null)}
        title="Scoți postarea din coadă?"
        description={removing ? `${PLATFORMA_LABEL[removing.platforma]} · ${zonedParts(new Date(removing.programataLa), fus).time} · ${removing.fisier}` : ""}
        consequence="Postarea nu mai pleacă la ora programată. O poți readăuga doar aprobând un plan nou."
        confirmLabel="Scoate din coadă"
        onConfirm={async () => {
          if (!removing) return;
          try {
            const result = await remove(removing.id);
            notify(result.message, result.ok ? "default" : "error");
          } catch {
            notify(UNREACHABLE, "error");
          }
          router.refresh();
        }}
      />
    </div>
  );
}
