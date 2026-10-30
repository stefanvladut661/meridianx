"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldOff } from "lucide-react";
import { NEGATIVES_MODE_LABEL, type NegativesMode } from "@/lib/ads/google/account/negatives";
import type { NegativesRequest } from "@/lib/ads/google/account/service";
import { CAMPAIGN_STATUS_LABEL, accountMoney, label } from "@/lib/ads/google/account/labels";
import type { AccountCampaign, AccountHeader, NegativeListInfo, NegativesPreview, NegativesResponse } from "@/lib/ads/google/account/types";
import { Btn, Card, SectionTitle } from "@/components/panou/ui/primitives";
import { InlineNote } from "@/components/panou/ui/actions";
import { EmptyState } from "@/components/panou/ui/states";
import { SoftSelect } from "@/components/panou/ui/select";
import { useToast } from "@/components/panou/ui/toast";
import { cn } from "@/lib/utils";
import { NegativePreview } from "./cautari-cont-previzualizare";
import { RadioRow, checkClass, counted, legendClass, textareaClass } from "./cautari-cont-ui";

/**
 * Negative pe campanii existente — lipești o listă (un cuvânt pe rând, cu
 * tipul de potrivire în notația Google Ads Editor) sau alegi o listă comună,
 * alegi campaniile → „Previzualizează”: portalul citește cuvintele pozitive ale
 * campaniilor, caută conflictele și trimite totul cu `validateOnly` →
 * „Adaugă”: exact ce ai văzut, sau nimic. Doar campanii de căutare.
 */

type AddResult = { ok: true; operations: number; journalWarning: string | null } | { ok: false; message: string; recheck?: boolean };

export function CautariContNegative({
  workspace,
  account,
  campaigns,
  lists,
  initialCampaign,
  preview: previewAction,
  add,
}: {
  workspace: string;
  account: AccountHeader;
  /** Doar campaniile de căutare nesterse. */
  campaigns: AccountCampaign[];
  lists: NegativeListInfo[];
  /** Campania de pe rândul din „Campanii” de unde s-a apăsat „Negative”. */
  initialCampaign?: string | null;
  preview: (input: { workspace: string; adAccount: string; request: NegativesRequest }) => Promise<NegativesResponse>;
  add: (input: { workspace: string; adAccount: string; request: NegativesRequest; fingerprint: string }) => Promise<AddResult>;
}) {
  const router = useRouter();
  const { notify } = useToast();
  const [mode, setMode] = useState<NegativesMode>("campaigns");
  const [text, setText] = useState("");
  const [listId, setListId] = useState(lists[0]?.id ?? "");
  const [chosen, setChosen] = useState<Set<string>>(() => new Set(initialCampaign && campaigns.some((item) => item.id === initialCampaign) ? [initialCampaign] : []));
  const [preview, setPreview] = useState<{ key: string; preview: NegativesPreview } | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [result, setResult] = useState<AddResult | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [adding, setAdding] = useState(false);

  const request: NegativesRequest = useMemo(
    () => ({ mode, text: mode === "link" ? "" : text, campaignIds: [...chosen].sort(), listId: mode === "campaigns" ? null : listId || null }),
    [mode, text, chosen, listId]
  );
  const key = JSON.stringify(request);
  const fresh = preview && preview.key === key ? preview.preview : null;
  const list = lists.find((item) => item.id === listId) ?? null;

  const toggle = (id: string) =>
    setChosen((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const runPreview = async () => {
    setFailure(null);
    setResult(null);
    setPreviewing(true);
    try {
      const response = await previewAction({ workspace, adAccount: account.id, request });
      if (response.ok) setPreview({ key, preview: response.preview });
      else setFailure(response.message);
    } catch {
      setFailure("Serverul n-a răspuns. Nu s-a trimis nimic spre Google.");
    } finally {
      setPreviewing(false);
    }
  };

  const runAdd = async () => {
    if (!fresh) return;
    setAdding(true);
    try {
      const response = await add({ workspace, adAccount: account.id, request, fingerprint: fresh.fingerprint });
      setResult(response);
      if (response.ok) {
        setPreview(null);
        if (mode !== "link") setText("");
        notify(mode === "link" ? "Lista e legată." : `${counted(response.operations, "negativ adăugat", "negative adăugate")}.`);
        router.refresh();
      } else if (response.recheck) {
        setPreview(null);
      }
    } catch {
      setResult({ ok: false, message: "Serverul n-a răspuns. Nu se știe dacă negativele au plecat: previzualizează din nou — cele adăugate apar „deja acolo”." });
    } finally {
      setAdding(false);
    }
  };

  const verb = mode === "link" ? "Leagă lista" : "Adaugă negativele";

  return (
    <section aria-labelledby="negative-cont" className="grid gap-4 2xl:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] 2xl:items-start">
      <Card className="min-w-0 space-y-5 p-4 sm:p-5">
        <SectionTitle title={<span id="negative-cont">Negative pe campaniile existente</span>} hint="Doar campanii de căutare. Nimic nu pleacă spre Google fără previzualizare." />

        <fieldset>
          <legend className={legendClass}>Ce faci</legend>
          <div className="mt-2 grid gap-2">
            {(Object.keys(NEGATIVES_MODE_LABEL) as NegativesMode[]).map((item) => (
              <RadioRow key={item} name="mod-negative" value={item} checked={mode === item} disabled={item !== "campaigns" && lists.length === 0} onChange={() => setMode(item)}>
                {NEGATIVES_MODE_LABEL[item]}
              </RadioRow>
            ))}
          </div>
          {lists.length === 0 ? <p className="mt-2 text-[11.5px] text-muted-foreground">Contul n-are liste comune de negative active.</p> : null}
        </fieldset>

        {mode !== "campaigns" && lists.length > 0 ? (
          <SoftSelect
            id="lista-comuna"
            label="Lista comună"
            value={listId}
            onChange={setListId}
            options={lists.map((item) => ({
              value: item.id,
              label: `${item.name} · ${counted(item.count, "cuvânt", "cuvinte")} · ${counted(item.campaigns.length, "campanie", "campanii")}`,
            }))}
          />
        ) : null}

        {mode !== "link" ? (
          <div>
            <label htmlFor="negative-text" className={legendClass}>
              Negativele, câte unul pe rând
            </label>
            <textarea
              id="negative-text"
              value={text}
              onChange={(event) => setText(event.target.value)}
              spellCheck={false}
              aria-describedby="negative-notatie"
              placeholder={'angajari\n"locuri de munca"\n[pret gratuit]'}
              className={cn(textareaClass, "mt-1.5 h-44 font-mono text-[12px] leading-[1.6]")}
            />
            <p id="negative-notatie" className="mt-1.5 text-[11.5px] leading-snug text-muted-foreground">
              Fără semne = potrivire amplă; între ghilimele = frază; între paranteze drepte = exactă. Rândurile goale se sar.
            </p>
          </div>
        ) : null}

        <fieldset>
          <legend className={legendClass}>{mode === "campaigns" ? "Pe campaniile" : mode === "list" ? "Și leagă lista de campaniile (opțional)" : "De campaniile"}</legend>
          {campaigns.length === 0 ? (
            <p className="mt-2 text-[12.5px] text-muted-foreground">Contul n-are campanii de căutare.</p>
          ) : (
            <ul className="mt-2 max-h-72 divide-y divide-white/[0.05] overflow-auto rounded-xl border border-white/[0.07]">
              {campaigns.map((item) => {
                const linked = list?.campaigns.includes(item.id) && mode !== "campaigns";
                return (
                  <li key={item.id}>
                    <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 text-[12.5px] hover:bg-white/[0.04]">
                      <input type="checkbox" checked={chosen.has(item.id)} onChange={() => toggle(item.id)} className={checkClass} />
                      <span className="min-w-0 flex-1 truncate text-foreground/90">{item.name}</span>
                      <span className="shrink-0 font-mono text-[10.5px] text-muted-foreground">
                        {linked ? "legată · " : ""}
                        {label(CAMPAIGN_STATUS_LABEL, item.status)} · {accountMoney(item.cost30, account.currency)}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </fieldset>

        <div className="flex flex-wrap gap-2">
          <Btn variant="primary" size="sm" icon={ShieldOff} onClick={runPreview} disabled={previewing || adding}>
            {previewing ? "Se verifică…" : fresh ? "Previzualizează din nou" : "Previzualizează"}
          </Btn>
          <Btn variant="outline" size="sm" onClick={runAdd} disabled={!fresh?.ok || adding || previewing}>
            {adding ? "Se adaugă…" : verb}
          </Btn>
        </div>
        <p className="text-[11.5px] leading-snug text-muted-foreground" aria-live="polite">
          {previewing
            ? "Portalul citește cuvintele cheie ale campaniilor, caută conflictele și trimite totul la Google fără să schimbe nimic…"
            : preview && !fresh
              ? "Ai schimbat ceva de la previzualizare: previzualizează din nou."
              : fresh?.ok
                ? `Gata de trimis: ${counted(fresh.operations, "operație", "operații")}, exact ce vezi alături.`
                : "Întâi previzualizarea: nimic nu pleacă spre Google fără ea."}
        </p>
      </Card>

      <div className="min-w-0 space-y-3">
        {failure ? (
          <div role="alert">
            <InlineNote tone="rose">{failure}</InlineNote>
          </div>
        ) : null}
        {result ? (
          <div role={result.ok ? "status" : "alert"} className="space-y-2">
            {result.ok ? (
              <>
                <InlineNote tone="mint">{mode === "link" ? "Lista e legată." : `${counted(result.operations, "negativ adăugat", "negative adăugate")}.`}</InlineNote>
                {result.journalWarning ? <InlineNote tone="apricot">{result.journalWarning}</InlineNote> : null}
              </>
            ) : (
              <InlineNote tone="rose">{result.message}</InlineNote>
            )}
          </div>
        ) : null}
        {fresh ? (
          <NegativePreview preview={fresh} />
        ) : !result && !failure ? (
          <Card className="p-0">
            <EmptyState
              icon={ShieldOff}
              title="Previzualizarea apare aici"
              text="Ce se adaugă și unde, ce era deja acolo, ce cuvinte cheie active ar bloca negativele noi — înainte să plece ceva spre Google."
            />
          </Card>
        ) : null}
      </div>
    </section>
  );
}
