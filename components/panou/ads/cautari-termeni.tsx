"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, RefreshCw, ShieldOff, Sparkles, X } from "lucide-react";
import type { TermNegativesRequest } from "@/lib/ads/google/account/service";
import { accountMoney } from "@/lib/ads/google/account/labels";
import type { AccountHeader, NegativeListInfo, NegativesPreview, NegativesResponse } from "@/lib/ads/google/account/types";
import { MATCH_TYPE_LABEL, type MatchType } from "@/lib/ads/google/search/limits";
import { keywordNotation } from "@/lib/ads/google/search/negatives";
import { reasonLabel } from "@/lib/ads/google/terms/proposals";
import type { Proposal, TermRow } from "@/lib/ads/google/terms/types";
import { Btn, Card, Pill } from "@/components/panou/ui/primitives";
import { CopyButton, InlineNote } from "@/components/panou/ui/actions";
import { EmptyState, Field } from "@/components/panou/ui/states";
import { TextInput } from "@/components/panou/ui/select";
import { dateTimeRo, dayMonthRo } from "@/components/panou/ui/format";
import { useToast } from "@/components/panou/ui/toast";
import { cn } from "@/lib/utils";
import { NegativePreview } from "./cautari-cont-previzualizare";
import { CardHead, RadioRow, checkClass, counted, selectSmallClass, textareaClass, theadClass, thClass } from "./cautari-cont-ui";

/**
 * /admin/ads/termeni, partea interactivă. Tabelul „Termeni de căutare” e cel din
 * redesign (cu „Marchează negativ” pe rând); lângă el, ce are portalul în plus:
 * propunerile după reguli, previzualizarea cu conflicte și `validateOnly`,
 * adăugarea reală (pe campania termenului sau într-o listă comună), regulile
 * contului și sincronizarea la cerere. Niciun negativ nu pleacă fără bifă și
 * fără previzualizare.
 */

type Failure = { ok: false; message: string };
type AddResult = { ok: true; operations: number; journalWarning: string | null } | { ok: false; message: string; recheck?: boolean };

/** Un termen marcat de om în tabel; potrivirea implicită e exactă (blochează doar căutarea aceea). */
interface Marked {
  id: string;
  campaignId: string;
  campaignName: string;
  term: string;
  match: MatchType;
}

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

const markedId = (term: TermRow) => `m|${term.campaignId}|${term.term.toLowerCase()}`;

function MatchSelect({ id, value, onChange, term }: { id: string; value: MatchType; onChange: (value: MatchType) => void; term: string }) {
  return (
    <>
      <label className="sr-only" htmlFor={id}>
        Tipul de potrivire pentru {term}
      </label>
      <select id={id} value={value} onChange={(event) => onChange(event.target.value as MatchType)} className={selectSmallClass}>
        {(Object.keys(MATCH_TYPE_LABEL) as MatchType[]).map((option) => (
          <option key={option} value={option} className="bg-[#14141A] text-foreground">
            {MATCH_TYPE_LABEL[option]}
          </option>
        ))}
      </select>
    </>
  );
}

export function CautariTermeni({
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
  const { notify } = useToast();
  const money = (amount: number) => accountMoney(amount, account.currency);

  // --- Negativele alese: propuneri bifate + termeni marcați în tabel ---------------------
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [matches, setMatches] = useState<Record<string, MatchType>>({});
  const [marked, setMarked] = useState<Marked[]>([]);
  const [destination, setDestination] = useState<string>("campaign");
  const [preview, setPreview] = useState<{ key: string; preview: NegativesPreview } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [added, setAdded] = useState<AddResult | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [adding, setAdding] = useState(false);

  const items = useMemo(() => {
    const fromProposals = proposals
      .filter((item) => checked.has(item.id))
      .map((item) => ({ campaignId: item.campaignId, campaignName: item.campaignName, text: item.text, match: matches[item.id] ?? item.match }));
    const fromTable = marked.map((item) => ({ campaignId: item.campaignId, campaignName: item.campaignName, text: item.term, match: item.match }));
    // Aceeași campanie + același text + aceeași potrivire se trimite o singură dată.
    const seen = new Set<string>();
    return [...fromProposals, ...fromTable].filter((item) => {
      const key = `${item.campaignId}|${item.match}|${item.text.toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [proposals, checked, matches, marked]);

  const request: TermNegativesRequest = useMemo(
    () => ({ items: items.map((item) => ({ campaignId: item.campaignId, text: item.text, match: item.match })), listId: destination === "campaign" ? null : destination }),
    [items, destination]
  );
  const key = JSON.stringify(request);
  const fresh = preview && preview.key === key ? preview.preview : null;

  const markedIds = new Set(marked.map((item) => item.id));
  const toggleMarked = (term: TermRow) => {
    const id = markedId(term);
    setMarked((previous) =>
      previous.some((item) => item.id === id)
        ? previous.filter((item) => item.id !== id)
        : [...previous, { id, campaignId: term.campaignId, campaignName: term.campaignName, term: term.term, match: "exact" }]
    );
  };

  const runPreview = async () => {
    setProblem(null);
    setAdded(null);
    setPreviewing(true);
    try {
      const response = await actions.preview({ workspace, adAccount: account.id, request });
      if (response.ok) setPreview({ key, preview: response.preview });
      else setProblem(response.message);
    } catch {
      setProblem("Serverul n-a răspuns. Nu s-a trimis nimic spre Google.");
    } finally {
      setPreviewing(false);
    }
  };
  const runAdd = async () => {
    if (!fresh) return;
    setAdding(true);
    try {
      const response = await actions.add({ workspace, adAccount: account.id, request, fingerprint: fresh.fingerprint });
      setAdded(response);
      if (response.ok) {
        setChecked(new Set());
        setMarked([]);
        setPreview(null);
        notify(`${counted(response.operations, "operație trimisă", "operații trimise")}: negativele sunt în cont.`);
        router.refresh();
      } else if (response.recheck) setPreview(null);
    } catch {
      setAdded({ ok: false, message: "Serverul n-a răspuns. Nu se știe dacă negativele au plecat: previzualizează din nou." });
    } finally {
      setAdding(false);
    }
  };

  // --- Sincronizarea și regulile --------------------------------------------------------------
  const [syncMessage, setSyncMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [words, setWords] = useState(rules.excludeWords.join("\n"));
  const [threshold, setThreshold] = useState(String(rules.costThreshold));
  const [syncEnabled, setSyncEnabled] = useState(rules.syncEnabled);
  const [rulesMessage, setRulesMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const runSync = async () => {
    setSyncing(true);
    try {
      const response = await actions.sync({ workspace, adAccount: account.id });
      setSyncMessage({ ok: response.ok, text: response.message });
      if (response.ok) {
        notify("Termenii sunt sincronizați.");
        router.refresh();
      }
    } catch {
      setSyncMessage({ ok: false, text: "Serverul n-a răspuns." });
    } finally {
      setSyncing(false);
    }
  };
  const runSave = async () => {
    setSaving(true);
    try {
      const value = Number(threshold.replace(",", "."));
      const response = await actions.saveRules({ workspace, adAccount: account.id, words, costThreshold: value, syncEnabled });
      setRulesMessage(response.ok ? { ok: true, text: `Salvat: ${counted(response.words, "cuvânt", "cuvinte")} de exclus, pragul ${money(value)}.` } : { ok: false, text: response.message });
      if (response.ok) {
        notify("Regulile contului sunt salvate.");
        router.refresh();
      }
    } catch {
      setRulesMessage({ ok: false, text: "Serverul n-a răspuns. Regulile n-au fost salvate." });
    } finally {
      setSaving(false);
    }
  };

  const totals = terms.reduce((sum, item) => ({ cost: sum.cost + item.cost, clicks: sum.clicks + item.clicks, conversions: sum.conversions + item.conversions }), { cost: 0, clicks: 0, conversions: 0 });
  const copyValue = items.map((item) => keywordNotation({ text: item.text, match: item.match })).join("\n");

  return (
    <div className="space-y-4">
      {/* Starea sincronizării */}
      <Card as="section" aria-labelledby="sincronizare-termeni" className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-4">
        <div className="min-w-0">
          <h2 id="sincronizare-termeni" className="text-[13.5px] font-medium">
            {terms.length === 0 ? "Niciun termen în perioada asta" : `${counted(terms.length, "termen", "termeni")} în ultimele ${period.days} zile`}
          </h2>
          <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">
            {terms.length > 0 ? `${money(totals.cost)} · ${totals.clicks} clicuri · ${Math.round(totals.conversions * 100) / 100} conversii · ` : ""}
            {rules.lastSyncedAt ? `sincronizat ${dateTimeRo(rules.lastSyncedAt)}` : "nesincronizat încă"}
          </p>
          {rules.lastSyncError ? <p className="mt-1 text-[11.5px] text-rose">Ultima sincronizare: {rules.lastSyncError}</p> : null}
          {syncMessage ? (
            <p role={syncMessage.ok ? "status" : "alert"} className={cn("mt-1 text-[11.5px]", syncMessage.ok ? "text-mint" : "text-rose")}>
              {syncMessage.text}
            </p>
          ) : null}
        </div>
        <Btn variant="outline" size="sm" icon={syncing ? Loader2 : RefreshCw} onClick={runSync} disabled={syncing} className="shrink-0">
          {syncing ? "Se sincronizează…" : "Sincronizează termenii acum"}
        </Btn>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start">
        <div className="min-w-0 space-y-4">
          {/* Propunerile după reguli */}
          <Card as="section" aria-labelledby="propuneri" className="overflow-hidden p-0">
            <CardHead
              id="propuneri"
              title={`Propuneri de negative · ${proposals.length}`}
              hint="După regulile contului: cuvinte de exclus, cost fără conversii, căutări ale altei campanii."
              action={
                proposals.length > 0 ? (
                  <Btn
                    size="xs"
                    variant="ghost"
                    onClick={() => setChecked(checked.size === proposals.length ? new Set() : new Set(proposals.map((item) => item.id)))}
                  >
                    {checked.size === proposals.length ? "Debifează tot" : "Bifează tot"}
                  </Btn>
                ) : undefined
              }
            />
            {proposals.length === 0 ? (
              <EmptyState
                icon={Sparkles}
                title="Nimic de propus"
                text={
                  terms.length === 0
                    ? "Termenii apar după prima sincronizare (zilnic, sau acum, cu butonul de sus) și după ce campaniile rulează."
                    : "Niciun termen nu se potrivește regulilor contului. Adaugă cuvinte de exclus mai jos sau coboară pragul de cost."
                }
                className="py-10"
              />
            ) : (
              <ul className="divide-y divide-white/[0.05]">
                {proposals.map((item) => {
                  const match = matches[item.id] ?? item.match;
                  return (
                    <li key={item.id} className={cn("px-4 py-3", checked.has(item.id) && "bg-lav/[0.05]")}>
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
                          className={cn(checkClass, "mt-0.5")}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            <label htmlFor={`p-${item.id}`} className="cursor-pointer font-mono text-[12.5px] [overflow-wrap:anywhere]">
                              {keywordNotation({ text: item.text, match })}
                            </label>
                            <MatchSelect id={`m-${item.id}`} value={match} term={item.text} onChange={(value) => setMatches((previous) => ({ ...previous, [item.id]: value }))} />
                            <span className="text-[11.5px] text-muted-foreground">pe „{item.campaignName}”</span>
                          </div>
                          <p className="mt-1 text-[12px] leading-snug text-foreground/75">{item.reasons.map((reason) => reasonLabel(reason, money)).join(" · ")}</p>
                          <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground [overflow-wrap:anywhere]">
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
          </Card>

          {/* Termenii de căutare — tabelul din redesign */}
          <Card as="section" aria-labelledby="toti-termenii" className="overflow-hidden p-0 sm:p-0">
            <CardHead
              id="toti-termenii"
              title="Termeni de căutare"
              hint="Ce au scris oamenii înainte să dea clic. Marchează ca negativ ce nu are sens."
              action={<Pill tone="apricot">{items.length} negative alese</Pill>}
            />
            {terms.length === 0 ? (
              <p className="px-4 py-6 text-[12.5px] text-muted-foreground">Niciun termen sincronizat în perioada asta ({period.from} – {period.to}).</p>
            ) : (
              <div className="max-h-[40rem] overflow-auto">
                <table className="w-full min-w-[980px] text-left">
                  <caption className="sr-only">Termenii de căutare din ultimele {period.days} zile, cei mai scumpi primii</caption>
                  <thead className="sticky top-0 z-[1] bg-card">
                    <tr className={theadClass}>
                      <th scope="col" className="min-w-[10rem] py-2.5 pl-4 pr-3 font-medium">Termen</th>
                      <th scope="col" className={cn(thClass, "min-w-[7rem]")}>Cuvântul cheie · potrivirea</th>
                      <th scope="col" className={cn(thClass, "text-right")}>Afișări</th>
                      <th scope="col" className={cn(thClass, "text-right")}>Clicuri</th>
                      <th scope="col" className={cn(thClass, "text-right")}>Cheltuială</th>
                      <th scope="col" className={cn(thClass, "text-right")}>Conversii</th>
                      <th scope="col" className={thClass}>Starea</th>
                      <th scope="col" className={thClass}>Văzut</th>
                      <th scope="col" className="py-2.5 pl-3 pr-4 text-right font-medium">Acțiune</th>
                    </tr>
                  </thead>
                  <tbody>
                    {terms.slice(0, 500).map((term) => {
                      const id = markedId(term);
                      const isMarked = markedIds.has(id);
                      const excluded = term.status === "EXCLUDED" || term.status === "ADDED_EXCLUDED";
                      return (
                        <tr key={`${term.campaignId}-${term.adGroupId}-${term.term}`} className={cn("border-b border-white/[0.04] align-top text-[12.5px] last:border-0", isMarked && "bg-rose/[0.04]")}>
                          <th scope="row" className="py-2.5 pl-4 pr-3 font-normal">
                            <span className={cn("font-mono text-[11.5px] [overflow-wrap:break-word]", isMarked && "line-through opacity-60")}>{term.term}</span>
                            <span className="block text-[10.5px] text-muted-foreground">
                              {term.campaignName} › {term.adGroupName}
                            </span>
                          </th>
                          <td className="px-3 py-2.5 text-foreground/80">
                            {term.keyword || "—"} <span className="text-muted-foreground">· {MATCH_SOURCE_LABEL[term.matchType] ?? (term.matchType || "—")}</span>
                          </td>
                          <td className="pu-num px-3 py-2.5 text-right">{term.impressions}</td>
                          <td className="pu-num px-3 py-2.5 text-right">{term.clicks}</td>
                          <td className="pu-num px-3 py-2.5 text-right">{money(term.cost)}</td>
                          <td className={cn("pu-num px-3 py-2.5 text-right", term.cost > 0 && term.conversions === 0 && "text-apricot")}>{term.conversions}</td>
                          <td className="px-3 py-2.5 text-muted-foreground">{STATUS_LABEL[term.status] ?? term.status}</td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-[11px] text-muted-foreground" title={`${term.firstSeen ?? "—"} → ${term.lastSeen ?? "—"}`}>
                            {term.firstSeen ? dayMonthRo(term.firstSeen) : "—"} → {term.lastSeen ? dayMonthRo(term.lastSeen) : "—"}
                          </td>
                          <td className="py-2.5 pl-3 pr-4 text-right">
                            <Btn
                              size="xs"
                              variant={isMarked ? "danger" : "outline"}
                              icon={isMarked ? CheckCircle2 : ShieldOff}
                              disabled={excluded}
                              aria-pressed={isMarked}
                              aria-label={isMarked ? `Scoate „${term.term}” din negative` : `Marchează „${term.term}” ca negativ`}
                              onClick={() => toggleMarked(term)}
                            >
                              {excluded ? "Exclus" : isMarked ? "Negativ" : "Marchează negativ"}
                            </Btn>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] px-4 py-3">
              <p className="text-[11px] text-muted-foreground">
                Negativele se aplică pe campanie sau într-o listă comună, după previzualizare. Nu afectează bugetul.
                {terms.length > 500 ? ` Primii 500 de termeni după cost, din ${terms.length}.` : ""}
              </p>
              {items.length > 0 ? <CopyButton value={copyValue} label="Copiază lista de negative" size="xs" /> : null}
            </div>
          </Card>

          {/* Regulile */}
          <Card as="section" aria-labelledby="reguli" className="p-4 sm:p-5">
            <h2 id="reguli" className="text-[15px] font-semibold tracking-[-0.01em]">
              Regulile propunerilor, pentru contul ăsta
            </h2>
            <p className="mt-1 max-w-2xl text-[12.5px] leading-relaxed text-muted-foreground">
              Se țin în baza portalului, nu în cod.{rules.updatedByEmail ? ` Ultima modificare: ${rules.updatedByEmail}.` : ""}
              {!rules.exists ? " Contul n-are încă reguli: se folosesc valorile implicite." : ""}
            </p>
            <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,18rem)]">
              <Field label="Cuvinte de exclus — câte unul pe rând" hint="Un termen care conține cuvântul (cu sau fără diacritice) devine propunere: negativ amplu (sau de frază, la mai multe cuvinte).">
                <textarea
                  id="cuvinte-excluse"
                  value={words}
                  onChange={(event) => setWords(event.target.value)}
                  placeholder={"angajari\ngratis\nsecond hand"}
                  spellCheck={false}
                  className={cn(textareaClass, "h-36 font-mono text-[12px] leading-[1.6]")}
                />
              </Field>
              <div className="space-y-4">
                <Field label={`Pragul de cost fără conversii (${account.currency})`} hint="0 = fără propuneri după cost.">
                  <TextInput id="prag-cost" inputMode="decimal" value={threshold} onChange={(event) => setThreshold(event.target.value)} className="font-mono" />
                </Field>
                <label className="flex items-center gap-3 text-[12.5px] text-foreground/85">
                  <input type="checkbox" checked={syncEnabled} onChange={(event) => setSyncEnabled(event.target.checked)} className={checkClass} />
                  Sincronizează termenii zilnic
                </label>
                <Btn variant="primary" size="sm" onClick={runSave} disabled={saving}>
                  {saving ? "Se salvează…" : "Salvează regulile"}
                </Btn>
                {rulesMessage ? (
                  <p role={rulesMessage.ok ? "status" : "alert"} className={cn("text-[12px]", rulesMessage.ok ? "text-mint" : "text-rose")}>
                    {rulesMessage.text}
                  </p>
                ) : null}
              </div>
            </div>
          </Card>
        </div>

        {/* Negativele alese: destinația, previzualizarea, adăugarea */}
        <div className="min-w-0 space-y-3 xl:sticky xl:top-20">
          <Card as="section" aria-labelledby="alese" className="space-y-4 p-4 sm:p-4">
            <div>
              <h2 id="alese" className="text-[13.5px] font-medium">
                Negative de trimis · {items.length}
              </h2>
              <p className="text-[11px] text-muted-foreground">Propunerile bifate și termenii marcați. Nimic nu se adaugă fără bifă.</p>
            </div>

            {marked.length > 0 ? (
              <ul className="max-h-56 divide-y divide-white/[0.05] overflow-auto rounded-xl border border-white/[0.07]">
                {marked.map((item) => (
                  <li key={item.id} className="flex items-center gap-2 px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-mono text-[11.5px]">{keywordNotation({ text: item.term, match: item.match })}</p>
                      <p className="truncate text-[10.5px] text-muted-foreground">pe „{item.campaignName}”</p>
                    </div>
                    <MatchSelect
                      id={`mm-${item.id}`}
                      value={item.match}
                      term={item.term}
                      onChange={(value) => setMarked((previous) => previous.map((entry) => (entry.id === item.id ? { ...entry, match: value } : entry)))}
                    />
                    <button
                      type="button"
                      onClick={() => setMarked((previous) => previous.filter((entry) => entry.id !== item.id))}
                      className="rounded p-1 text-muted-foreground hover:text-foreground"
                      aria-label={`Scoate „${item.term}” din negative`}
                    >
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}

            <fieldset>
              <legend className="text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">Unde merg negativele</legend>
              <div className="mt-2 grid gap-2">
                <RadioRow name="destinatie" value="campaign" checked={destination === "campaign"} onChange={() => setDestination("campaign")}>
                  Pe campania fiecărui termen
                </RadioRow>
                {lists.map((list) => (
                  <RadioRow
                    key={list.id}
                    name="destinatie"
                    value={list.id}
                    checked={destination === list.id}
                    onChange={() => setDestination(list.id)}
                    aside={counted(list.campaigns.length, "campanie", "campanii")}
                  >
                    În lista „{list.name}”
                  </RadioRow>
                ))}
              </div>
            </fieldset>

            <div className="flex flex-wrap gap-2">
              <Btn variant="primary" size="sm" onClick={runPreview} disabled={items.length === 0 || previewing || adding}>
                {previewing ? "Se verifică…" : `Previzualizează${items.length > 0 ? ` (${items.length})` : ""}`}
              </Btn>
              <Btn variant="outline" size="sm" onClick={runAdd} disabled={!fresh?.ok || adding || previewing}>
                {adding ? "Se adaugă…" : "Adaugă negativele"}
              </Btn>
            </div>
            <p className="text-[11.5px] leading-snug text-muted-foreground" aria-live="polite">
              {items.length === 0
                ? "Bifează propunerile sau marchează termeni în tabel."
                : preview && !fresh
                  ? "Ai schimbat bifele, potrivirile sau destinația: previzualizează din nou."
                  : fresh?.ok
                    ? `Gata de trimis: ${counted(fresh.operations, "operație", "operații")}.`
                    : "Întâi previzualizarea: conflictele cu cuvintele active și verificarea la Google."}
            </p>
            {problem ? (
              <div role="alert">
                <InlineNote tone="rose">{problem}</InlineNote>
              </div>
            ) : null}
            {added ? (
              <div role={added.ok ? "status" : "alert"} className="space-y-2">
                <InlineNote tone={added.ok ? "mint" : "rose"}>
                  {added.ok ? `${counted(added.operations, "operație trimisă", "operații trimise")}: negativele sunt în cont.` : added.message}
                </InlineNote>
                {added.ok && added.journalWarning ? <InlineNote tone="apricot">{added.journalWarning}</InlineNote> : null}
              </div>
            ) : null}
          </Card>
          {fresh ? <NegativePreview preview={fresh} /> : null}
        </div>
      </div>
    </div>
  );
}
