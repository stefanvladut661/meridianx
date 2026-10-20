"use client";

import { EXPLORER_DAILY_OPERATIONS, MATCH_TYPE_LABEL, MUTATE_OPERATIONS_MAX } from "@/lib/ads/google/search/limits";
import { keywordNotation } from "@/lib/ads/google/search/negatives";
import type { SearchSummary, SummaryCampaign, SummaryKeyword } from "@/lib/ads/google/search/summary";
import { keywordKey } from "@/lib/ads/google/search/text";
import type { KeywordVolume, SearchVolumes } from "@/lib/ads/google/search/types";
import type { Currency } from "@/lib/ads/constants";
import { countOf, formatMoney } from "@/lib/ads/plan-derive";
import { joinRo } from "@/lib/ads/plan-summary";
import { cn } from "@/lib/utils";
import { fieldId } from "./fields";
import { SerpAd } from "./serp-ad";
import { ERROR_DOT, ERROR_TEXT, WARNING_TEXT } from "./tone";

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
  if (keywords.length === 0) return <p className="text-[13.5px] text-dim">niciunul</p>;
  const shown = keywords.slice(0, limit);
  const rest = keywords.slice(limit);
  const chip = (keyword: SummaryKeyword, index: number) => {
    const volume = volumes?.byKey[keywordKey(keyword.text)];
    return (
      <li
        key={`${keyword.match}-${keyword.text}-${index}`}
        title={volume ? `${MATCH_HINT[keyword.match]} · ${volumeSentence(volume, volumes?.currency ?? null)}` : MATCH_HINT[keyword.match]}
        className={cn(
          "rounded-panel-sm border px-2 py-0.5 font-md-mono text-[12px] leading-5",
          negative ? "border-hair text-bone/70 line-through decoration-bone/30" : "border-hair-strong text-bone/90"
        )}
      >
        {keywordNotation(keyword)}
        {volume ? (
          <>
            <span aria-hidden className={cn("ml-1.5", volume.searches ? "text-bone/55" : "text-dim")}>
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
          <summary className="cursor-pointer text-[13px] text-dim hover:text-bone">încă {rest.length}</summary>
          <ul className="mt-2 flex flex-wrap gap-1.5">{rest.map((keyword, index) => chip(keyword, index + limit))}</ul>
        </details>
      ) : null}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-x-6 gap-y-1 py-2.5 sm:grid-cols-[9.5rem_minmax(0,1fr)]">
      <dt className="font-md-mono text-[11.5px] uppercase tracking-[0.16em] text-dim">{label}</dt>
      <dd className="min-w-0 text-[14.5px] leading-snug text-bone/90 [overflow-wrap:anywhere]">{children}</dd>
    </div>
  );
}

const MISSING = <span className="text-dim">—</span>;

function CampaignBlock({ campaign, errorPaths, volumes }: { campaign: SummaryCampaign; errorPaths: ReadonlySet<string>; volumes: Volumes | null }) {
  const keywords = campaign.adGroups.reduce((sum, group) => sum + group.keywords.length, 0);
  const sitelinkTexts = campaign.sitelinks.map((sitelink) => sitelink.text);

  return (
    <section
      id={fieldId(campaign.path)}
      aria-labelledby={`${fieldId(campaign.path)}-titlu`}
      className="rounded-panel-lg border border-hair bg-char/50"
    >
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-hair px-5 py-4 sm:px-6">
        <h3 id={`${fieldId(campaign.path)}-titlu`} className="min-w-0 text-[16.5px] font-semibold leading-snug text-bone [overflow-wrap:anywhere]">
          {campaign.name}
          {hasErrorUnder(errorPaths, campaign.path) ? (
            <span className={cn("ml-2 text-[12.5px] font-normal", ERROR_TEXT)}>· de corectat</span>
          ) : null}
        </h3>
        <p className="font-md-mono text-[12px] text-dim">
          {campaign.budget ?? "fără buget"} · {counted(campaign.adGroups.length, "grup", "grupuri")} · {counted(keywords, "cuvânt cheie", "cuvinte cheie")}
        </p>
      </header>

      <dl className="divide-y divide-hair px-5 sm:px-6">
        <Row label="Buget">
          {campaign.budget ?? MISSING}
          {campaign.monthly ? <span className="ml-2 text-[13px] text-dim">{campaign.monthly}</span> : null}
        </Row>
        <Row label="Licitare">{campaign.bidding ?? MISSING}</Row>
        <Row label="Zone">
          {campaign.places.length > 0 ? joinRo(campaign.places) : MISSING}
          {campaign.excluded.length > 0 ? <span className="block text-[13.5px] text-bone/70">fără {joinRo(campaign.excluded)}</span> : null}
          {campaign.locationMode ? <span className="block text-[13px] text-dim">{campaign.locationMode}</span> : null}
        </Row>
        <Row label="Limbi">{campaign.languages ?? <span className={WARNING_TEXT}>toate limbile</span>}</Row>
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
                  {list.name ? `„${list.name}”` : <span className={ERROR_TEXT}>lista „{list.key}” nu există în plan</span>}
                  {list.name ? <span className="ml-2 font-md-mono text-[12px] text-dim">{counted(list.count, "cuvânt", "cuvinte")}</span> : null}
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
          <div className="space-y-2">
            <p>
              {campaign.sitelinks.length > 0 ? (
                <>
                  <span className="text-dim">Linkuri suplimentare:</span>{" "}
                  {campaign.sitelinks.map((sitelink) => sitelink.text).join(" · ")}
                </>
              ) : (
                <span className="text-dim">Niciun link suplimentar.</span>
              )}
            </p>
            {campaign.callouts.length > 0 ? (
              <p>
                <span className="text-dim">Mesaje scurte:</span> {campaign.callouts.join(" · ")}
              </p>
            ) : null}
            {campaign.snippets.map((snippet, snippetIndex) => (
              <p key={snippetIndex}>
                <span className="text-dim">{snippet.header}:</span> {snippet.values.join(", ")}
              </p>
            ))}
            {campaign.call ? (
              <p>
                <span className="text-dim">Apel:</span> {campaign.call.phone}
                {campaign.call.tracked ? null : <span className={cn("ml-2 text-[13px]", WARNING_TEXT)}>fără acțiune de conversie proprie</span>}
              </p>
            ) : null}
          </div>
        </Row>
      </dl>

      <div className="space-y-2 border-t border-hair px-3 py-3 sm:px-4">
        {campaign.adGroups.map((group, groupIndex) => {
          const broken = hasErrorUnder(errorPaths, group.path);
          const searches = volumes
            ? group.keywords.reduce((sum, keyword) => sum + (volumes.byKey[keywordKey(keyword.text)]?.searches ?? 0), 0)
            : null;
          return (
            <details
              key={group.path}
              id={fieldId(group.path)}
              open={campaign.adGroups.length === 1 || broken || undefined}
              className="group rounded-panel border border-hair bg-ink/40"
            >
              <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 px-3 py-3 sm:px-4 [&::-webkit-details-marker]:hidden">
                <span aria-hidden className="inline-block text-dim transition-transform duration-150 group-open:rotate-90">
                  ›
                </span>
                {broken ? <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", ERROR_DOT)} /> : null}
                <span className="min-w-0 flex-1 text-[14.5px] font-semibold text-bone [overflow-wrap:anywhere]">
                  {group.name}
                  {broken ? <span className="sr-only"> (de corectat)</span> : null}
                </span>
                <span className="font-md-mono text-[11.5px] text-dim">
                  {counted(group.keywords.length, "cuvânt", "cuvinte")} · {counted(group.ads.length, "anunț", "anunțuri")}
                  {group.maxCpc ? ` · ${group.maxCpc}` : ""}
                  {searches ? ` · ≈ ${searches.toLocaleString("ro-RO")} căutări/lună` : ""}
                </span>
              </summary>
              <div className="space-y-5 border-t border-hair px-3 py-4 sm:px-4">
                <div>
                  <h4 className="font-md-mono text-[11px] uppercase tracking-[0.16em] text-dim">
                    Cuvinte cheie · {group.keywords.length}
                  </h4>
                  <div className="mt-2">
                    <KeywordChips keywords={group.keywords} volumes={volumes} />
                  </div>
                  <p className="mt-2 font-md-mono text-[11px] text-dim">
                    [exactă] · &quot;frază&quot; · amplă{volumes ? " · cifra = căutări pe lună (Keyword Planner)" : ""}
                  </p>
                </div>
                {group.negatives.length > 0 ? (
                  <div>
                    <h4 className="font-md-mono text-[11px] uppercase tracking-[0.16em] text-dim">
                      Negative ale grupului · {group.negatives.length}
                    </h4>
                    <div className="mt-2">
                      <KeywordChips keywords={group.negatives} negative />
                    </div>
                  </div>
                ) : null}
                <p className="text-[13px] leading-snug text-dim [overflow-wrap:anywhere]">
                  Pagina: <span className="text-bone/80">{group.finalUrl ?? "lipsă"}</span>
                </p>
                <div className="space-y-5">
                  {group.ads.map((ad, adIndex) => (
                    <div key={adIndex} id={fieldId(`${group.path}.ads.${adIndex}`)}>
                      <SerpAd
                        ad={ad}
                        index={adIndex + groupIndex * 3}
                        extras={{ sitelinks: sitelinkTexts, callouts: campaign.callouts, phone: campaign.call?.phone ?? null }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </details>
          );
        })}
      </div>
    </section>
  );
}

export function SearchPreview({
  summary,
  operations,
  errorPaths = new Set<string>(),
  accountLabel,
  sent = false,
  volumes = null,
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
}) {
  const { totals } = summary;
  const ledger = [
    counted(totals.campaigns, "campanie", "campanii"),
    counted(totals.adGroups, "grup", "grupuri"),
    counted(totals.keywords, "cuvânt cheie", "cuvinte cheie"),
    counted(totals.negatives, "negativ", "negative"),
    counted(totals.ads, "anunț", "anunțuri"),
    ...(operations !== null ? [counted(operations, "operație", "operații")] : sent ? [] : ["operațiile: după corecturi"]),
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-panel-lg border border-hair bg-char/60 px-5 py-6 sm:px-7">
        <p className="font-md-display text-[1.375rem] font-semibold leading-snug tracking-tight text-bone sm:text-[1.625rem]">
          {totals.campaigns === 1 ? "O campanie de căutare" : `${countOf(totals.campaigns, "campanii")} de căutare`}
          {accountLabel ? ` în contul ${accountLabel}` : ""}, {summary.dailyBudget ? `cu ${summary.dailyBudget} în total` : "fără buget"}.
        </p>
        <p className="mt-3 font-md-mono text-[12.5px] leading-relaxed tracking-wide text-bone/75">{ledger.join(" · ")}</p>

        {summary.cap ? (
          <div className="mt-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2 text-[13.5px]">
              <span className={summary.overCap ? ERROR_TEXT : "text-bone/80"}>
                {summary.dailyBudget ?? "0"} din plafonul spațiului ({summary.cap})
              </span>
              {summary.monthly ? <span className="text-dim">{summary.monthly}, dacă pornești tot</span> : null}
            </div>
            <BudgetBar summary={summary} />
          </div>
        ) : null}

        {operations !== null ? (
          <p className={cn("mt-4 text-[13.5px] leading-relaxed", operations > MUTATE_OPERATIONS_MAX ? ERROR_TEXT : "text-bone/70")}>
            Totul pleacă într-o singură cerere: {countOf(operations, "operații")}, create împreună sau deloc
            {operations > MUTATE_OPERATIONS_MAX ? ` — peste limita Google de ${MUTATE_OPERATIONS_MAX.toLocaleString("ro-RO")} pe cerere` : ""}. Verificarea și
            crearea consumă fiecare {operations} din cele {EXPLORER_DAILY_OPERATIONS.toLocaleString("ro-RO")} de operații pe zi ale
            proiectului Google Cloud la nivelul Explorer.
          </p>
        ) : null}
      </div>

      {summary.lists.length > 0 ? (
        <section aria-labelledby="liste-comune" className="rounded-panel-lg border border-hair bg-char/50 px-5 py-5 sm:px-6">
          <h3 id="liste-comune" className="eyebrow !text-[11.5px] !text-bone">
            Liste comune de negative · {summary.lists.length}
          </h3>
          <ul className="mt-3 divide-y divide-hair">
            {summary.lists.map((list, index) => (
              <li key={list.key} id={fieldId(`shared_negative_lists.${index}`)} className="grid gap-x-6 gap-y-1 py-2.5 sm:grid-cols-[minmax(0,1fr)_auto]">
                <span className="min-w-0 text-[14.5px] text-bone [overflow-wrap:anywhere]">
                  „{list.name}” <span className="ml-1 font-md-mono text-[12px] text-dim">{counted(list.count, "cuvânt", "cuvinte")}</span>
                </span>
                <span className={cn("text-[13px]", list.usedBy.length === 0 ? WARNING_TEXT : "text-dim")}>
                  {list.usedBy.length === 0 ? "nelegată de nicio campanie" : `pe ${list.usedBy.length === 1 ? "o campanie" : countOf(list.usedBy.length, "campanii")}`}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {volumes && "error" in volumes ? <p className={cn("text-[13px]", WARNING_TEXT)}>{volumes.error} Volumele de căutare lipsesc din previzualizare; restul verificării e întreg.</p> : null}
      {volumes && "campaigns" in volumes && volumes.note ? <p className="text-[13px] text-dim">{volumes.note}</p> : null}

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

function BudgetBar({ summary }: { summary: SearchSummary }) {
  const cap = summary.capAmount ?? 0;
  const ratio = cap > 0 ? Math.min(1, summary.totals.dailyBudget / cap) : 0;
  return (
    <div aria-hidden className="mt-2 h-1.5 overflow-hidden rounded-full bg-hair">
      <div
        className={cn("h-full rounded-full", summary.overCap ? "bg-[#d93025]" : "bg-bone/70")}
        style={{ width: `${Math.max(ratio * 100, summary.totals.dailyBudget > 0 ? 1.5 : 0)}%` }}
      />
    </div>
  );
}
