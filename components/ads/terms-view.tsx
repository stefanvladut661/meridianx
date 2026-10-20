"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { TermNegativesRequest } from "@/lib/ads/google/account/service";
import { accountMoney } from "@/lib/ads/google/account/labels";
import type { AccountHeader, NegativeListInfo, NegativesResponse, NegativesPreview } from "@/lib/ads/google/account/types";
import { MATCH_TYPE_LABEL, type MatchType } from "@/lib/ads/google/search/limits";
import { keywordNotation } from "@/lib/ads/google/search/negatives";
import { reasonLabel } from "@/lib/ads/google/terms/proposals";
import type { Proposal, TermRow } from "@/lib/ads/google/terms/types";
import { countOf } from "@/lib/ads/plan-derive";
import { cn } from "@/lib/utils";
import { PreviewPanel } from "./account-negatives";
import { ERROR_TEXT, FIELD, LABEL, OK_TEXT, WARNING_TEXT } from "./tone";

/**
 * /admin/ads/termeni, partea interactivă: propunerile de negative (bifezi →
 * previzualizezi → adaugi, pe campania termenului sau într-o listă comună),
 * regulile contului (cuvintele de exclus, pragul de cost), sincronizarea la
 * cerere și toți termenii perioadei.
 */

type Failure = { ok: false; message: string };
type AddResult = { ok: true; operations: number; journalWarning: string | null } | { ok: false; message: string; recheck?: boolean };

const STATUS_LABEL: Record<string, string> = { ADDED: "e cuvânt cheie", EXCLUDED: "exclus", ADDED_EXCLUDED: "cuvânt cheie și exclus", NONE: "—" };
const MATCH_SOURCE_LABEL: Record<string, string> = {
  EXACT: "exactă",
  NEAR_EXACT: "exactă (variantă)",
  PHRASE: "frază",
  NEAR_PHRASE: "frază (variantă)",
  BROAD: "amplă",
  AI_MAX: "AI Max",
  PERFORMANCE_MAX: "Performance Max",
};

const dateTime = new Intl.DateTimeFormat("ro-RO", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Bucharest" });

function counted(count: number, one: string, many: string): string {
  return count === 1 ? `1 ${one}` : countOf(count, many);
}

export function TermsView({
  workspace,
  account,
  period,
  terms,
  proposals,
  lists,
  rules,
  actions,
}: {
  workspace: string;
  account: AccountHeader;
  period: { from: string; to: string; days: number };
  terms: TermRow[];
  proposals: Proposal[];
  lists: NegativeListInfo[];
  rules: {
    excludeWords: string[];
    costThreshold: number;
    syncEnabled: boolean;
    lastSyncedAt: string | null;
    lastSyncError: string | null;
    updatedByEmail: string | null;
    exists: boolean;
  };
  actions: {
    sync: (input: { workspace: string; adAccount: string }) => Promise<{ ok: true; message: string } | Failure>;
    saveRules: (input: { workspace: string; adAccount: string; words: string; costThreshold: number; syncEnabled: boolean }) => Promise<{ ok: true; words: number } | Failure>;
    preview: (input: { workspace: string; adAccount: string; request: TermNegativesRequest }) => Promise<NegativesResponse>;
    add: (input: { workspace: string; adAccount: string; request: TermNegativesRequest; fingerprint: string }) => Promise<AddResult>;
  };
}) {
  const router = useRouter();
  const money = (amount: number) => accountMoney(amount, account.currency);

  // --- Propunerile -----------------------------------------------------------------------
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [matches, setMatches] = useState<Record<string, MatchType>>({});
  const [destination, setDestination] = useState<string>("campaign");
  const [preview, setPreview] = useState<{ key: string; preview: NegativesPreview } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [added, setAdded] = useState<AddResult | null>(null);
  const [previewing, startPreview] = useTransition();
  const [adding, startAdd] = useTransition();

  const request: TermNegativesRequest = useMemo(
    () => ({
      items: proposals
        .filter((item) => checked.has(item.id))
        .map((item) => ({ campaignId: item.campaignId, text: item.text, match: matches[item.id] ?? item.match })),
      listId: destination === "campaign" ? null : destination,
    }),
    [proposals, checked, matches, destination]
  );
  const key = JSON.stringify(request);
  const fresh = preview && preview.key === key ? preview.preview : null;

  const runPreview = () => {
    setProblem(null);
    setAdded(null);
    startPreview(async () => {
      try {
        const response = await actions.preview({ workspace, adAccount: account.id, request });
        if (response.ok) setPreview({ key, preview: response.preview });
        else setProblem(response.message);
      } catch {
        setProblem("Serverul n-a răspuns. Nu s-a trimis nimic spre Google.");
      }
    });
  };
  const runAdd = () => {
    if (!fresh) return;
    startAdd(async () => {
      try {
        const response = await actions.add({ workspace, adAccount: account.id, request, fingerprint: fresh.fingerprint });
        setAdded(response);
        if (response.ok) {
          setChecked(new Set());
          setPreview(null);
          router.refresh();
        } else if (response.recheck) setPreview(null);
      } catch {
        setAdded({ ok: false, message: "Serverul n-a răspuns. Nu se știe dacă negativele au plecat: previzualizează din nou." });
      }
    });
  };

  // --- Sincronizarea și regulile --------------------------------------------------------------
  const [syncMessage, setSyncMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [syncing, startSync] = useTransition();
  const [words, setWords] = useState(rules.excludeWords.join("\n"));
  const [threshold, setThreshold] = useState(String(rules.costThreshold));
  const [syncEnabled, setSyncEnabled] = useState(rules.syncEnabled);
  const [rulesMessage, setRulesMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, startSave] = useTransition();

  const runSync = () =>
    startSync(async () => {
      try {
        const response = await actions.sync({ workspace, adAccount: account.id });
        setSyncMessage({ ok: response.ok, text: response.message });
        if (response.ok) router.refresh();
      } catch {
        setSyncMessage({ ok: false, text: "Serverul n-a răspuns." });
      }
    });
  const runSave = () =>
    startSave(async () => {
      try {
        const response = await actions.saveRules({ workspace, adAccount: account.id, words, costThreshold: Number(threshold.replace(",", ".")), syncEnabled });
        setRulesMessage(response.ok ? { ok: true, text: `Salvat: ${counted(response.words, "cuvânt", "cuvinte")} de exclus, pragul ${money(Number(threshold.replace(",", ".")))}.` } : { ok: false, text: response.message });
        if (response.ok) router.refresh();
      } catch {
        setRulesMessage({ ok: false, text: "Serverul n-a răspuns. Regulile n-au fost salvate." });
      }
    });

  const totals = terms.reduce((sum, item) => ({ cost: sum.cost + item.cost, clicks: sum.clicks + item.clicks, conversions: sum.conversions + item.conversions }), { cost: 0, clicks: 0, conversions: 0 });

  return (
    <div className="space-y-12">
      {/* Starea sincronizării */}
      <section aria-labelledby="sincronizare-termeni" className="flex flex-col gap-3 rounded-panel-lg border border-hair bg-char/60 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <h2 id="sincronizare-termeni" className="text-[14.5px] font-semibold text-bone">
            {terms.length === 0 ? "Niciun termen în perioada asta" : `${counted(terms.length, "termen", "termeni")} în ultimele ${period.days} zile`}
          </h2>
          <p className="mt-1 text-[13.5px] text-dim">
            {terms.length > 0 ? `${money(totals.cost)} · ${totals.clicks} clicuri · ${Math.round(totals.conversions * 100) / 100} conversii · ` : ""}
            {rules.lastSyncedAt ? `sincronizat ${dateTime.format(new Date(rules.lastSyncedAt))}` : "nesincronizat încă"}
            {rules.lastSyncError ? <span className={cn("block", ERROR_TEXT)}>Ultima sincronizare: {rules.lastSyncError}</span> : null}
          </p>
          {syncMessage ? (
            <p role={syncMessage.ok ? "status" : "alert"} className={cn("mt-1 text-[13.5px]", syncMessage.ok ? OK_TEXT : ERROR_TEXT)}>
              {syncMessage.text}
            </p>
          ) : null}
        </div>
        <button type="button" onClick={runSync} disabled={syncing} className="btn btn-ghost shrink-0 disabled:cursor-wait disabled:opacity-60">
          {syncing ? "Se sincronizează…" : "Sincronizează termenii acum"}
        </button>
      </section>

      {/* Propunerile */}
      <section aria-labelledby="propuneri" className="grid gap-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 id="propuneri" className="eyebrow">
              Propuneri de negative · {proposals.length}
            </h2>
            {proposals.length > 0 ? (
              <button
                type="button"
                onClick={() => setChecked(checked.size === proposals.length ? new Set() : new Set(proposals.map((item) => item.id)))}
                className="text-[13px] text-dim underline underline-offset-4 hover:text-bone"
              >
                {checked.size === proposals.length ? "Debifează tot" : "Bifează tot"}
              </button>
            ) : null}
          </div>
          {proposals.length === 0 ? (
            <div className="mt-4 rounded-panel-lg border border-dashed border-hair-strong px-6 py-8">
              <p className="font-md-display text-[1.25rem] font-semibold text-bone">Nimic de propus.</p>
              <p className="mt-2 text-[14.5px] leading-relaxed text-bone/70">
                {terms.length === 0
                  ? "Termenii apar după prima sincronizare (zilnic, sau acum, cu butonul de sus) și după ce campaniile rulează."
                  : "Niciun termen nu se potrivește regulilor contului. Adaugă cuvinte de exclus mai jos sau coboară pragul de cost."}
              </p>
            </div>
          ) : (
            <ul className="mt-4 divide-y divide-hair rounded-panel-lg border border-hair">
              {proposals.map((item) => {
                const match = matches[item.id] ?? item.match;
                return (
                  <li key={item.id} className={cn("px-4 py-3", checked.has(item.id) && "bg-glass")}>
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        id={`p-${item.id}`}
                        checked={checked.has(item.id)}
                        onChange={() =>
                          setChecked((previous) => {
                            const next = new Set(previous);
                            if (next.has(item.id)) next.delete(item.id);
                            else next.add(item.id);
                            return next;
                          })
                        }
                        className="mt-1 h-4 w-4 shrink-0 accent-[#2f5bff]"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <label htmlFor={`p-${item.id}`} className="cursor-pointer font-md-mono text-[13.5px] text-bone [overflow-wrap:anywhere]">
                            {keywordNotation({ text: item.text, match })}
                          </label>
                          <label className="sr-only" htmlFor={`m-${item.id}`}>
                            Tipul de potrivire pentru {item.text}
                          </label>
                          <select
                            id={`m-${item.id}`}
                            value={match}
                            onChange={(event) => setMatches((previous) => ({ ...previous, [item.id]: event.target.value as MatchType }))}
                            className="rounded-panel-sm border border-hair bg-ink/60 px-2 py-0.5 text-[12px] text-bone/85"
                          >
                            {(Object.keys(MATCH_TYPE_LABEL) as MatchType[]).map((value) => (
                              <option key={value} value={value}>
                                {MATCH_TYPE_LABEL[value]}
                              </option>
                            ))}
                          </select>
                          <span className="text-[12.5px] text-dim">pe „{item.campaignName}”</span>
                        </div>
                        <p className="mt-1 text-[13px] leading-snug text-bone/75">
                          {item.reasons.map((reason) => reasonLabel(reason, money)).join(" · ")}
                        </p>
                        <p className="mt-0.5 text-[12.5px] leading-snug text-dim [overflow-wrap:anywhere]">
                          {item.terms.length === 1 ? "Termenul" : `${item.terms.length} termeni`}: {item.terms.slice(0, 4).map((term) => `„${term}”`).join(", ")}
                          {item.terms.length > 4 ? ` și încă ${item.terms.length - 4}` : ""} · {money(item.cost)} · {item.clicks} clicuri
                        </p>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="min-w-0 space-y-4 lg:sticky lg:top-[8rem]">
          <fieldset>
            <legend className={LABEL}>Unde merg negativele bifate</legend>
            <div className="mt-2 grid gap-2">
              <label className={cn("flex cursor-pointer items-center gap-3 rounded-panel border px-3.5 py-2.5 text-[14px]", destination === "campaign" ? "border-bone/50 bg-glass" : "border-hair text-bone/80")}>
                <input type="radio" name="destinatie" checked={destination === "campaign"} onChange={() => setDestination("campaign")} className="h-4 w-4 accent-[#2f5bff]" />
                Pe campania fiecărui termen
              </label>
              {lists.map((list) => (
                <label key={list.id} className={cn("flex cursor-pointer items-center gap-3 rounded-panel border px-3.5 py-2.5 text-[14px]", destination === list.id ? "border-bone/50 bg-glass" : "border-hair text-bone/80")}>
                  <input type="radio" name="destinatie" checked={destination === list.id} onChange={() => setDestination(list.id)} className="h-4 w-4 accent-[#2f5bff]" />
                  <span className="min-w-0 truncate">În lista „{list.name}”</span>
                  <span className="ml-auto shrink-0 font-md-mono text-[11px] text-dim">{counted(list.campaigns.length, "campanie", "campanii")}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={runPreview} disabled={checked.size === 0 || previewing || adding} className="btn btn-light disabled:cursor-not-allowed disabled:opacity-45">
              {previewing ? "Se verifică…" : `Previzualizează${checked.size > 0 ? ` (${checked.size})` : ""}`}
            </button>
            <button type="button" onClick={runAdd} disabled={!fresh?.ok || adding || previewing} className="btn btn-ghost disabled:cursor-not-allowed disabled:opacity-45">
              {adding ? "Se adaugă…" : "Adaugă negativele"}
            </button>
          </div>
          <p className="text-[13px] leading-snug text-dim" aria-live="polite">
            {checked.size === 0
              ? "Bifează propunerile pe care le vrei. Nimic nu se adaugă fără bifă."
              : preview && !fresh
                ? "Ai schimbat bifele sau destinația: previzualizează din nou."
                : fresh?.ok
                  ? `Gata de trimis: ${counted(fresh.operations, "operație", "operații")}.`
                  : "Întâi previzualizarea: conflictele cu cuvintele active și verificarea la Google."}
          </p>
          {problem ? <p role="alert" className={cn("text-[14px]", ERROR_TEXT)}>{problem}</p> : null}
          {added ? (
            <p role={added.ok ? "status" : "alert"} className={cn("text-[14px]", added.ok ? OK_TEXT : ERROR_TEXT)}>
              {added.ok ? `${counted(added.operations, "operație trimisă", "operații trimise")}: negativele sunt în cont.${added.journalWarning ? ` ${added.journalWarning}` : ""}` : added.message}
            </p>
          ) : null}
          {fresh ? <PreviewPanel preview={fresh} /> : null}
        </div>
      </section>

      {/* Regulile */}
      <section aria-labelledby="reguli" className="rounded-panel-lg border border-hair bg-char/50 px-5 py-5 sm:px-6">
        <h2 id="reguli" className="eyebrow !text-bone">
          Regulile propunerilor, pentru contul ăsta
        </h2>
        <p className="mt-2 max-w-2xl text-[13.5px] leading-relaxed text-dim">
          Se țin în baza portalului, nu în cod.{rules.updatedByEmail ? ` Ultima modificare: ${rules.updatedByEmail}.` : ""}
          {!rules.exists ? " Contul n-are încă reguli: se folosesc valorile implicite." : ""}
        </p>
        <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,18rem)]">
          <div>
            <label htmlFor="cuvinte-excluse" className={LABEL}>
              Cuvinte de exclus — câte unul pe rând
            </label>
            <textarea
              id="cuvinte-excluse"
              value={words}
              onChange={(event) => setWords(event.target.value)}
              placeholder={"angajari\ngratis\nsecond hand"}
              spellCheck={false}
              className={cn(FIELD, "mt-2 h-40 resize-y py-3 font-md-mono text-[13px] leading-[1.6]")}
            />
            <p className="mt-2 text-[12.5px] text-dim">Un termen care conține cuvântul (cu sau fără diacritice) devine propunere: negativ amplu (sau de frază, la mai multe cuvinte).</p>
          </div>
          <div className="space-y-4">
            <div>
              <label htmlFor="prag-cost" className={LABEL}>
                Pragul de cost fără conversii ({account.currency})
              </label>
              <input id="prag-cost" inputMode="decimal" value={threshold} onChange={(event) => setThreshold(event.target.value)} className={cn(FIELD, "mt-2 h-11 font-md-mono")} />
              <p className="mt-2 text-[12.5px] text-dim">0 = fără propuneri după cost.</p>
            </div>
            <label className="flex items-center gap-3 text-[14px] text-bone/85">
              <input type="checkbox" checked={syncEnabled} onChange={(event) => setSyncEnabled(event.target.checked)} className="h-4 w-4 accent-[#2f5bff]" />
              Sincronizează termenii zilnic
            </label>
            <button type="button" onClick={runSave} disabled={saving} className="btn btn-light disabled:cursor-wait disabled:opacity-60">
              {saving ? "Se salvează…" : "Salvează regulile"}
            </button>
            {rulesMessage ? (
              <p role={rulesMessage.ok ? "status" : "alert"} className={cn("text-[13.5px]", rulesMessage.ok ? OK_TEXT : ERROR_TEXT)}>
                {rulesMessage.text}
              </p>
            ) : null}
          </div>
        </div>
      </section>

      {/* Toți termenii */}
      <section aria-labelledby="toti-termenii">
        <h2 id="toti-termenii" className="eyebrow">
          Toți termenii · {period.from} – {period.to}
        </h2>
        {terms.length === 0 ? (
          <p className="mt-3 text-[14px] text-dim">Niciun termen sincronizat în perioada asta.</p>
        ) : (
          <div className="mt-3 max-h-[40rem] overflow-auto rounded-panel-lg border border-hair">
            <table className="w-full min-w-[920px] border-collapse text-left text-[13px]">
              <caption className="sr-only">Termenii de căutare din ultimele {period.days} zile, cei mai scumpi primii</caption>
              <thead className="sticky top-0 bg-char font-md-mono text-[11px] uppercase tracking-[0.12em] text-dim">
                <tr>
                  <th scope="col" className="px-3 py-2.5 font-normal">Termenul</th>
                  <th scope="col" className="px-3 py-2.5 font-normal">Campania › grupul</th>
                  <th scope="col" className="px-3 py-2.5 font-normal">Cuvântul cheie · potrivirea</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-normal">Afișări</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-normal">Clicuri</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-normal">Cost</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-normal">Conv.</th>
                  <th scope="col" className="px-3 py-2.5 font-normal">Starea</th>
                  <th scope="col" className="px-3 py-2.5 font-normal">Văzut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hair">
                {terms.slice(0, 500).map((term) => (
                  <tr key={`${term.campaignId}-${term.adGroupId}-${term.term}`}>
                    <th scope="row" className="px-3 py-2 font-normal text-bone [overflow-wrap:anywhere]">
                      {term.term}
                    </th>
                    <td className="px-3 py-2 text-bone/80">
                      {term.campaignName} <span className="text-dim">› {term.adGroupName}</span>
                    </td>
                    <td className="px-3 py-2 text-bone/80">
                      {term.keyword || "—"} <span className="text-dim">· {MATCH_SOURCE_LABEL[term.matchType] ?? (term.matchType || "—")}</span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{term.impressions}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{term.clicks}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{money(term.cost)}</td>
                    <td className={cn("px-3 py-2 text-right tabular-nums", term.cost > 0 && term.conversions === 0 && WARNING_TEXT)}>{term.conversions}</td>
                    <td className="px-3 py-2 text-dim">{STATUS_LABEL[term.status] ?? term.status}</td>
                    <td className="whitespace-nowrap px-3 py-2 font-md-mono text-[11.5px] text-dim">
                      {term.firstSeen ?? "—"} → {term.lastSeen ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {terms.length > 500 ? <p className="mt-2 text-[12.5px] text-dim">Primii 500 de termeni după cost, din {terms.length}.</p> : null}
      </section>
    </div>
  );
}
