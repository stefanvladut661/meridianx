"use client";

import type { ReactNode } from "react";
import type { Currency } from "@/lib/ads/constants";
import { EXPLORER_DAILY_OPERATIONS, MATCH_TYPE_LABEL, MUTATE_OPERATIONS_MAX } from "@/lib/ads/google/search/limits";
import { keywordNotation } from "@/lib/ads/google/search/negatives";
import type { SearchSummary, SummaryCampaign, SummaryKeyword } from "@/lib/ads/google/search/summary";
import { keywordKey } from "@/lib/ads/google/search/text";
import type { KeywordVolume, SearchVolumes } from "@/lib/ads/google/search/types";
import { countOf, formatMoney } from "@/lib/ads/plan-derive";
import { joinRo } from "@/lib/ads/plan-summary";
import { Card, SectionTitle, Stat } from "@/components/panou/ui/primitives";
import { ProgressBar } from "@/components/panou/ui/states";
import { cn } from "@/lib/utils";
import { CautariSerpAd } from "./cautari-serp-ad";
import { fieldId } from "./cautari-plan-probleme";

/**
 * Planul de căutare citit în română: sus totalul (campanii, grupuri,
 * cuvinte, negative, anunțuri, operații) și bugetul față de plafon; apoi
 * listele comune și fiecare campanie, cu grupurile ei. Grupurile stau
 * strânse — un plan real are zeci —, iar o eroare deschide grupul ei.
 */

/** „1 grup”, „2 grupuri”, „20 de grupuri”. */
function counted(count: number, one: string, many: string): string {
  return count === 1 ? `1 ${one}` : countOf(count, many);
}

const MATCH_HINT = Object.fromEntries(Object.entries(MATCH_TYPE_LABEL).map(([key, label]) => [key, `potrivire ${label}`]));

function hasErrorUnder(errorPaths: ReadonlySet<string>, path: string): boolean {
  for (const errorPath of errorPaths) if (errorPath === path || errorPath.startsWith(`${path}.`)) return true;
  return false;
}

const COMPETITION_LABEL = { LOW: "mică", MEDIUM: "medie", HIGH: "mare" } as const;

/** Volumele din Keyword Planner, pentru o campanie, plus moneda licitațiilor. */
interface Volumes {
  byKey: Record<string, KeywordVolume>;
  currency: Currency | null;
}

/** „1.300 de căutări pe lună, concurență medie, 2,10–5,40 lei pentru sus” — tooltip și cititoare de ecran. */
function volumeSentence(volume: KeywordVolume, currency: Currency | null): string {
  const parts = [
    volume.searches === null ? "volum necunoscut" : `${volume.searches.toLocaleString("ro-RO")} căutări pe lună`,
    volume.competition ? `concurență ${COMPETITION_LABEL[volume.competition]}` : null,
    volume.lowBid !== null && volume.highBid !== null ? `${formatMoney(volume.lowBid, currency)}–${formatMoney(volume.highBid, currency)} pe clic pentru partea de sus a paginii` : null,
  ];
  return parts.filter(Boolean).join(", ");
}

function KeywordChips({
  keywords,
  limit = 60,
  negative = false,
  volumes = null,
}: {
  keywords: SummaryKeyword[];
  limit?: number;
  negative?: boolean;
  volumes?: Volumes | null;
}) {
  if (keywords.length === 0) return <p className="text-[12px] text-muted-foreground">niciunul</p>;
  const shown = keywords.slice(0, limit);
  const rest = keywords.slice(limit);
  const chip = (keyword: SummaryKeyword, index: number) => {
    const volume = volumes?.byKey[keywordKey(keyword.text)];
    return (
      <li
        key={`${keyword.match}-${keyword.text}-${index}`}
        title={volume ? `${MATCH_HINT[keyword.match]} · ${volumeSentence(volume, volumes?.currency ?? null)}` : MATCH_HINT[keyword.match]}
        className={cn(
          "rounded-md border px-2 py-0.5 font-mono text-[11.5px] leading-5",
          negative ? "border-white/[0.06] text-muted-foreground line-through decoration-foreground/25" : "border-white/[0.09] bg-white/[0.04] text-foreground/90"
        )}
      >
        {keywordNotation(keyword)}
        {volume ? (
          <>
            <span aria-hidden className={cn("pu-num ml-1.5", volume.searches ? "text-lav" : "text-muted-foreground")}>
              {volume.searches === null ? "—" : volume.searches.toLocaleString("ro-RO")}
            </span>
            <span className="sr-only">: {volumeSentence(volume, volumes?.currency ?? null)}</span>
          </>
        ) : null}
      </li>
    );
  };
  return (
    <div>
      <ul className="flex flex-wrap gap-1.5">{shown.map(chip)}</ul>
      {rest.length > 0 ? (
        <details className="mt-2">
          <summary className="cursor-pointer text-[11.5px] text-muted-foreground hover:text-foreground">încă {rest.length}</summary>
          <ul className="mt-2 flex flex-wrap gap-1.5">{rest.map((keyword, index) => chip(keyword, index + limit))}</ul>
        </details>
      ) : null}
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[104px_minmax(0,1fr)] items-start gap-3 py-2 sm:grid-cols-[120px_minmax(0,1fr)]">
      <dt className="pt-0.5 text-[11px] uppercase tracking-[0.1em] text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words text-[12.5px] leading-relaxed text-foreground/85">{children}</dd>
    </div>
  );
}

const MISSING = <span className="text-muted-foreground">—</span>;

function CampaignBlock({ campaign, errorPaths, volumes }: { campaign: SummaryCampaign; errorPaths: ReadonlySet<string>; volumes: Volumes | null }) {
  const keywords = campaign.adGroups.reduce((sum, group) => sum + group.keywords.length, 0);
  const sitelinkTexts = campaign.sitelinks.map((sitelink) => sitelink.text);

  return (
    <Card as="section" padded={false} id={fieldId(campaign.path)} aria-labelledby={`${fieldId(campaign.path)}-titlu`}>
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-white/[0.06] px-4 py-3">
        <h3 id={`${fieldId(campaign.path)}-titlu`} className="min-w-0 text-[14px] font-medium [overflow-wrap:anywhere]">
          {campaign.name}
          {hasErrorUnder(errorPaths, campaign.path) ? <span className="ml-2 text-[11.5px] font-normal text-rose">· de corectat</span> : null}
        </h3>
        <p className="font-mono text-[11px] text-muted-foreground">
          {campaign.budget ?? "fără buget"} · {counted(campaign.adGroups.length, "grup", "grupuri")} · {counted(keywords, "cuvânt cheie", "cuvinte cheie")}
        </p>
      </header>

      <dl className="divide-y divide-white/[0.05] px-4">
        <Row label="Buget">
          {campaign.budget ?? MISSING}
          {campaign.monthly ? <span className="ml-2 text-[11.5px] text-muted-foreground">{campaign.monthly}</span> : null}
        </Row>
        <Row label="Licitare">{campaign.bidding ?? MISSING}</Row>
        <Row label="Zone">
          {campaign.places.length > 0 ? joinRo(campaign.places) : MISSING}
          {campaign.excluded.length > 0 ? <span className="block text-foreground/70">fără {joinRo(campaign.excluded)}</span> : null}
          {campaign.locationMode ? <span className="block text-[11.5px] text-muted-foreground">{campaign.locationMode}</span> : null}
        </Row>
        <Row label="Limbi">{campaign.languages ?? <span className="text-apricot">toate limbile</span>}</Row>
        <Row label="Program">
          {campaign.schedule.length > 0 ? (
            <ul>
              {campaign.schedule.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : (
            "oricând"
          )}
        </Row>
        <Row label="Rețele">{joinRo(campaign.networks)}</Row>
        <Row label="Liste negative">
          {campaign.lists.length > 0 ? (
            <ul>
              {campaign.lists.map((list) => (
                <li key={list.key}>
                  {list.name ? `„${list.name}”` : <span className="text-rose">lista „{list.key}” nu există în plan</span>}
                  {list.name ? <span className="ml-2 font-mono text-[11px] text-muted-foreground">{counted(list.count, "cuvânt", "cuvinte")}</span> : null}
                </li>
              ))}
            </ul>
          ) : (
            "niciuna"
          )}
        </Row>
        <Row label={`Negative · ${campaign.negatives.length}`}>
          <KeywordChips keywords={campaign.negatives} negative limit={30} />
        </Row>
        <Row label="Materiale">
          <div className="space-y-1.5">
            <p>
              {campaign.sitelinks.length > 0 ? (
                <>
                  <span className="text-muted-foreground">Linkuri suplimentare:</span> {campaign.sitelinks.map((sitelink) => sitelink.text).join(" · ")}
                </>
              ) : (
                <span className="text-muted-foreground">Niciun link suplimentar.</span>
              )}
            </p>
            {campaign.callouts.length > 0 ? (
              <p>
                <span className="text-muted-foreground">Mesaje scurte:</span> {campaign.callouts.join(" · ")}
              </p>
            ) : null}
            {campaign.snippets.map((snippet, snippetIndex) => (
              <p key={snippetIndex}>
                <span className="text-muted-foreground">{snippet.header}:</span> {snippet.values.join(", ")}
              </p>
            ))}
            {campaign.call ? (
              <p>
                <span className="text-muted-foreground">Apel:</span> {campaign.call.phone}
                {campaign.call.tracked ? null : <span className="ml-2 text-[11.5px] text-apricot">fără acțiune de conversie proprie</span>}
              </p>
            ) : null}
          </div>
        </Row>
      </dl>

      <div className="space-y-2 border-t border-white/[0.06] p-3">
        {campaign.adGroups.map((group, groupIndex) => {
          const broken = hasErrorUnder(errorPaths, group.path);
          const searches = volumes ? group.keywords.reduce((sum, keyword) => sum + (volumes.byKey[keywordKey(keyword.text)]?.searches ?? 0), 0) : null;
          return (
            <details
              key={group.path}
              id={fieldId(group.path)}
              open={campaign.adGroups.length === 1 || broken || undefined}
              className="group rounded-xl border border-white/[0.06] bg-white/[0.02]"
            >
              <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 rounded-xl px-3 py-2.5 hover:bg-white/[0.03] [&::-webkit-details-marker]:hidden">
                <span aria-hidden className="inline-block text-muted-foreground transition-transform duration-150 group-open:rotate-90">
                  ›
                </span>
                {broken ? <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-rose" /> : null}
                <span className="min-w-0 flex-1 text-[13px] font-medium [overflow-wrap:anywhere]">
                  {group.name}
                  {broken ? <span className="sr-only"> (de corectat)</span> : null}
                </span>
                <span className="font-mono text-[10.5px] text-muted-foreground">
                  {counted(group.keywords.length, "cuvânt", "cuvinte")} · {counted(group.ads.length, "anunț", "anunțuri")}
                  {group.maxCpc ? ` · ${group.maxCpc}` : ""}
                  {searches ? ` · ≈ ${searches.toLocaleString("ro-RO")} căutări/lună` : ""}
                </span>
              </summary>
              <div className="space-y-5 border-t border-white/[0.06] px-3 py-4">
                <div>
                  <h4 className="text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">Cuvinte cheie · {group.keywords.length}</h4>
                  <div className="mt-2">
                    <KeywordChips keywords={group.keywords} volumes={volumes} />
                  </div>
                  <p className="mt-2 font-mono text-[10.5px] text-muted-foreground">
                    [exactă] · &quot;frază&quot; · amplă{volumes ? " · cifra = căutări pe lună (Keyword Planner)" : ""}
                  </p>
                </div>
                {group.negatives.length > 0 ? (
                  <div>
                    <h4 className="text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">Negative ale grupului · {group.negatives.length}</h4>
                    <div className="mt-2">
                      <KeywordChips keywords={group.negatives} negative />
                    </div>
                  </div>
                ) : null}
                <p className="text-[11.5px] leading-snug text-muted-foreground [overflow-wrap:anywhere]">
                  Pagina: <span className="text-foreground/80">{group.finalUrl ?? "lipsă"}</span>
                </p>
                <div className="space-y-5">
                  {group.ads.map((ad, adIndex) => (
                    <div key={adIndex} id={fieldId(`${group.path}.ads.${adIndex}`)}>
                      <CautariSerpAd ad={ad} index={adIndex + groupIndex * 3} extras={{ sitelinks: sitelinkTexts, callouts: campaign.callouts, phone: campaign.call?.phone ?? null }} />
                    </div>
                  ))}
                </div>
              </div>
            </details>
          );
        })}
      </div>
    </Card>
  );
}

export function CautariPlanPreview({
  summary,
  operations,
  errorPaths = new Set<string>(),
  accountLabel,
  sent = false,
  volumes = null,
  title = "Citit în română",
}: {
  summary: SearchSummary;
  operations: number | null;
  /** Căile cu erori — grupul lor se deschide și se marchează. Lipsă pe fișa unei campanii create. */
  errorPaths?: ReadonlySet<string>;
  accountLabel: string | null;
  /** Fișa unei campanii deja create: fără numărătoarea de operații. */
  sent?: boolean;
  /** Volumele din Keyword Planner, din ultima verificare (null = fără acces sau neverificat). */
  volumes?: SearchVolumes | null;
  title?: string;
}) {
  const { totals } = summary;
  const headline = `${totals.campaigns === 1 ? "O campanie de căutare" : `${countOf(totals.campaigns, "campanii")} de căutare`}${accountLabel ? ` în contul ${accountLabel}` : ""}, ${
    summary.dailyBudget ? `cu ${summary.dailyBudget} în total` : "fără buget"
  }.`;
  const cap = summary.capAmount ?? 0;
  const ratio = cap > 0 ? Math.min(1, totals.dailyBudget / cap) : 0;

  return (
    <div className="space-y-4">
      <Card>
        <SectionTitle title={title} hint={headline} />
        <div className="mt-4 grid grid-cols-3 gap-x-4 gap-y-4">
          <Stat label="Campanii" value={totals.campaigns} />
          <Stat label="Grupuri" value={totals.adGroups} />
          <Stat label="Cuvinte" value={totals.keywords} />
          <Stat label="Negative" value={totals.negatives} tone="dim" />
          <Stat label="Anunțuri" value={totals.ads} tone="dim" />
          <Stat
            label="Operații"
            value={operations !== null ? operations : "—"}
            tone="dim"
            hint={operations === null && !sent ? "după corecturi" : undefined}
          />
        </div>

        {summary.cap ? (
          <div className="mt-5 border-t border-white/[0.06] pt-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2 text-[12px]">
              <span className={summary.overCap ? "text-rose" : "text-foreground/80"}>
                {summary.dailyBudget ?? "0"} din plafonul spațiului ({summary.cap})
              </span>
              {summary.monthly ? <span className="text-muted-foreground">{summary.monthly}, dacă pornești tot</span> : null}
            </div>
            <ProgressBar className="mt-2" tone={summary.overCap ? "rose" : "lav"} value={Math.max(ratio * 100, totals.dailyBudget > 0 ? 1.5 : 0)} />
          </div>
        ) : null}

        {operations !== null ? (
          <p className={cn("mt-4 text-[11.5px] leading-relaxed", operations > MUTATE_OPERATIONS_MAX ? "text-rose" : "text-muted-foreground")}>
            Totul pleacă într-o singură cerere: {countOf(operations, "operații")}, create împreună sau deloc
            {operations > MUTATE_OPERATIONS_MAX ? ` — peste limita Google de ${MUTATE_OPERATIONS_MAX.toLocaleString("ro-RO")} pe cerere` : ""}. Verificarea și crearea consumă fiecare{" "}
            {operations} din cele {EXPLORER_DAILY_OPERATIONS.toLocaleString("ro-RO")} de operații pe zi ale proiectului Google Cloud la nivelul Explorer.
          </p>
        ) : null}
      </Card>

      {summary.lists.length > 0 ? (
        <Card as="section" aria-labelledby="liste-comune">
          <h3 id="liste-comune" className="text-[15px] font-semibold tracking-[-0.01em]">
            Liste comune de negative · {summary.lists.length}
          </h3>
          <ul className="mt-2 divide-y divide-white/[0.05]">
            {summary.lists.map((list, index) => (
              <li key={list.key} id={fieldId(`shared_negative_lists.${index}`)} className="grid gap-x-6 gap-y-1 py-2.5 sm:grid-cols-[minmax(0,1fr)_auto]">
                <span className="min-w-0 text-[12.5px] [overflow-wrap:anywhere]">
                  „{list.name}” <span className="ml-1 font-mono text-[11px] text-muted-foreground">{counted(list.count, "cuvânt", "cuvinte")}</span>
                </span>
                <span className={cn("text-[11.5px]", list.usedBy.length === 0 ? "text-apricot" : "text-muted-foreground")}>
                  {list.usedBy.length === 0 ? "nelegată de nicio campanie" : `pe ${list.usedBy.length === 1 ? "o campanie" : countOf(list.usedBy.length, "campanii")}`}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {volumes && "error" in volumes ? <p className="text-[12px] text-apricot">{volumes.error} Volumele de căutare lipsesc din previzualizare; restul verificării e întreg.</p> : null}
      {volumes && "campaigns" in volumes && volumes.note ? <p className="text-[12px] text-muted-foreground">{volumes.note}</p> : null}

      {summary.campaigns.map((campaign, index) => (
        <CampaignBlock
          key={campaign.path}
          campaign={campaign}
          errorPaths={errorPaths}
          volumes={volumes && "campaigns" in volumes && volumes.campaigns[index] ? { byKey: volumes.campaigns[index], currency: summary.currency } : null}
        />
      ))}
    </div>
  );
}
