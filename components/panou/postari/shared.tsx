import type { ReactNode } from "react";
import { Play } from "lucide-react";
import type { PostView, Stare } from "@/lib/postari/coada-shared";
import { STARE_LABEL } from "@/lib/postari/coada-shared";
import type { Issue, Platforma } from "@/lib/postari/limite";
import { PLATFORMA_LABEL } from "@/lib/postari/limite";
import { cn } from "@/lib/utils";
import { Pill, type PillTone } from "../ui/primitives";

/**
 * Bucățile comune ale ecranelor Postări, în limbajul din prototip (Base44):
 * antetul ecranului, etichetele de stare și de platformă, tile-ul clipului,
 * lista de probleme. Fără stare de client: merg și din pagini de server.
 */

/** Antetul unui ecran: titlu, eticheta de stare, o frază, acțiunile din dreapta (ca la „Coada” din prototip). */
export function ScreenHead({ title, badge, text, actions, className }: { title: ReactNode; badge?: ReactNode; text?: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-3", className)}>
      <div className="min-w-0">
        <div className="flex items-center gap-2.5">
          <h1 className="text-[22px] font-semibold leading-none sm:text-[26px]">{title}</h1>
          {badge}
        </div>
        {text ? <p className="mt-2 max-w-2xl text-[12.5px] leading-relaxed text-muted-foreground">{text}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/** Aceleași culori ca `POST_TONE` din prototip; „în ciorne” e chihlimbar, „în lucru” albastru. */
export const STATE_TONE: Record<Stare, PillTone> = {
  planificata: "lav",
  in_lucru: "sky",
  publicata: "mint",
  in_ciorne: "apricot",
  esuata: "rose",
  scoasa: "neutral",
};

export function StatePill({ stare }: { stare: Stare }) {
  return (
    <Pill tone={STATE_TONE[stare]} dot>
      {STARE_LABEL[stare]}
    </Pill>
  );
}

export function PlatformPill({ platforma }: { platforma: Platforma }) {
  return <Pill tone={platforma === "instagram" ? "rose" : "sky"}>{PLATFORMA_LABEL[platforma]}</Pill>;
}

/** Ora României, ca text: pentru orice alt fus, numele lui. */
export const zoneLabel = (fus: string): string => (fus === "Europe/Bucharest" ? "ora României" : `ora din ${fus}`);

const TILE_GRADIENT: Record<Platforma, string> = {
  instagram: "from-[#2A2340] via-[#1B1728] to-[#101018]",
  tiktok: "from-[#2B2118] via-[#1D1712] to-[#100F0C]",
};

/** Tile-ul clipului din prototip: gradient, triunghi de play, durata în colț. Nu avem miniatură; culoarea spune platforma. */
export function ClipTile({ platform, durationMs, className }: { platform: Platforma | null; durationMs: number | null; className?: string }) {
  const gradient = platform ? TILE_GRADIENT[platform] : "from-[#22222A] to-[#111114]";
  return (
    <span aria-hidden="true" className={cn("relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/[0.08] bg-gradient-to-br", gradient, className)}>
      <Play className="h-4 w-4 text-white/40" />
      {durationMs ? <span className="absolute bottom-0.5 right-1 font-mono text-[8.5px] text-white/60">{Math.round(durationMs / 1000)}s</span> : null}
    </span>
  );
}

/** Ce fel de postare e și ce înseamnă pentru om: Reel, Trial Reel (cu absolvirea), ciornă TikTok. */
export function postKind(post: Pick<PostView, "platforma" | "optiuni">): { kind: string; notes: string[] } {
  if (post.platforma === "tiktok") return { kind: "Ciornă TikTok", notes: ["ajunge în ciorne; o publici din aplicație"] };
  const options = post.optiuni;
  const notes: string[] = [];
  if (options.tip === "trial_reel") {
    notes.push(options.absolvire === "automat" ? "trece singur la urmăritori dacă merge bine" : "îl treci tu la urmăritori, din aplicație");
    notes.push("întâi la cei care nu te urmăresc");
  } else {
    notes.push(options.in_feed === false ? "doar la Reels, fără feed" : "apare și în feed");
  }
  if (typeof options.coperta_ms === "number") notes.push(`copertă la ${(options.coperta_ms / 1000).toLocaleString("ro-RO", { maximumFractionDigits: 1 })} s`);
  return { kind: options.tip === "trial_reel" ? "Trial Reel" : "Reel", notes };
}

/** Problemele unei postări sau ale unui clip: roz = oprește aprobarea, chihlimbar = de știut. */
export function IssueList({ issues, prefix, className }: { issues: Issue[]; prefix?: string; className?: string }) {
  if (issues.length === 0) return null;
  return (
    <ul className={cn("space-y-1", className)}>
      {issues.map((issue, index) => (
        <li key={`${issue.mesaj}-${index}`} className={cn("flex gap-2 text-[11.5px] leading-snug", issue.nivel === "eroare" ? "text-[#FFC2CE]" : "text-[#FFD0AC]")}>
          <span aria-hidden="true" className={cn("mt-[0.45em] h-1.5 w-1.5 shrink-0 rounded-full", issue.nivel === "eroare" ? "bg-rose" : "bg-apricot")} />
          <span>
            <span className="sr-only">{issue.nivel === "eroare" ? "Eroare: " : "Atenție: "}</span>
            {prefix ? <span className="font-medium">{prefix} </span> : null}
            {issue.mesaj}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Text cu hashtag-urile în lavandă, ca în ecranul de TikTok din prototip. */
export function HashtagText({ text, className }: { text: string; className?: string }) {
  const parts = text.split(/(#[\p{L}\p{N}_]+)/u);
  return (
    <span className={cn("whitespace-pre-wrap break-words", className)}>
      {parts.map((part, index) =>
        part.startsWith("#") ? (
          <span key={index} className="text-lav/85">
            {part}
          </span>
        ) : (
          <span key={index}>{part}</span>
        )
      )}
    </span>
  );
}

/** Cheile ciornei planului în browser (aceleași ca în editorul vechi), partajate între „Clipuri” și „Plan nou”. */
export const PLAN_DRAFT_KEY = "meridian_postari_plan";
export const PLAN_SOURCE_KEY = "meridian_postari_plan_sursa";

export type ActionResult = { ok: true; message: string } | { ok: false; message: string };
export const UNREACHABLE = "Serverul n-a răspuns (rețea sau sesiune). Reîncarcă pagina și încearcă din nou.";
