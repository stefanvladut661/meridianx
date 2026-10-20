"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { NEGATIVES_MODE_LABEL, type NegativesMode } from "@/lib/ads/google/account/negatives";
import type { NegativesRequest } from "@/lib/ads/google/account/service";
import { CAMPAIGN_STATUS_LABEL, accountMoney, label } from "@/lib/ads/google/account/labels";
import type { AccountCampaign, AccountHeader, NegativeListInfo, NegativesPreview, NegativesResponse } from "@/lib/ads/google/account/types";
import { countOf } from "@/lib/ads/plan-derive";
import { cn } from "@/lib/utils";
import { ERROR_TEXT, FIELD, LABEL, OK_TEXT, WARNING_TEXT } from "./tone";

/**
 * Negative pe campanii existente — lipești o listă (un cuvânt pe rând, cu
 * tipul de potrivire în notația Google Ads Editor) sau alegi o listă comună,
 * alegi campaniile → „Previzualizează”: portalul citește cuvintele pozitive ale
 * campaniilor, caută conflictele și trimite totul cu `validateOnly` →
 * „Adaugă”: exact ce ai văzut, sau nimic. Doar campanii de căutare.
 */

type AddResult = { ok: true; operations: number; journalWarning: string | null } | { ok: false; message: string; recheck?: boolean };

function counted(count: number, one: string, many: string): string {
  return count === 1 ? `1 ${one}` : countOf(count, many);
}

export function AccountNegatives({
  workspace,
  account,
  campaigns,
  lists,
  preview: previewAction,
  add,
}: {
  workspace: string;
  account: AccountHeader;
  /** Doar campaniile de căutare nesterse. */
  campaigns: AccountCampaign[];
  lists: NegativeListInfo[];
  preview: (input: { workspace: string; adAccount: string; request: NegativesRequest }) => Promise<NegativesResponse>;
  add: (input: { workspace: string; adAccount: string; request: NegativesRequest; fingerprint: string }) => Promise<AddResult>;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<NegativesMode>("campaigns");
  const [text, setText] = useState("");
  const [listId, setListId] = useState(lists[0]?.id ?? "");
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [preview, setPreview] = useState<{ key: string; preview: NegativesPreview } | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [result, setResult] = useState<AddResult | null>(null);
  const [previewing, startPreview] = useTransition();
  const [adding, startAdd] = useTransition();

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

  const runPreview = () => {
    setFailure(null);
    setResult(null);
    startPreview(async () => {
      try {
        const response = await previewAction({ workspace, adAccount: account.id, request });
        if (response.ok) setPreview({ key, preview: response.preview });
        else setFailure(response.message);
      } catch {
        setFailure("Serverul n-a răspuns. Nu s-a trimis nimic spre Google.");
      }
    });
  };

  const runAdd = () => {
    if (!fresh) return;
    startAdd(async () => {
      try {
        const response = await add({ workspace, adAccount: account.id, request, fingerprint: fresh.fingerprint });
        setResult(response);
        if (response.ok) {
          setPreview(null);
          if (mode !== "link") setText("");
          router.refresh();
        } else if (response.recheck) {
          setPreview(null);
        }
      } catch {
        setResult({ ok: false, message: "Serverul n-a răspuns. Nu se știe dacă negativele au plecat: previzualizează din nou — cele adăugate apar „deja acolo”." });
      }
    });
  };

  const verb = mode === "link" ? "Leagă lista" : "Adaugă negativele";

  return (
    <section aria-labelledby="negative-cont" className="grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:items-start">
      <div className="min-w-0 space-y-6">
        <h2 id="negative-cont" className="sr-only">
          Negative pe campaniile existente
        </h2>

        <fieldset>
          <legend className={LABEL}>Ce faci</legend>
          <div className="mt-2 grid gap-2">
            {(Object.keys(NEGATIVES_MODE_LABEL) as NegativesMode[]).map((item) => (
              <label
                key={item}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-panel border px-3.5 py-2.5 text-[14px]",
                  mode === item ? "border-bone/50 bg-glass text-bone" : "border-hair text-bone/80 hover:text-bone",
                  item !== "campaigns" && lists.length === 0 && "pointer-events-none opacity-45"
                )}
              >
                <input
                  type="radio"
                  name="mod-negative"
                  value={item}
                  checked={mode === item}
                  disabled={item !== "campaigns" && lists.length === 0}
                  onChange={() => setMode(item)}
                  className="h-4 w-4 accent-[#2f5bff]"
                />
                {NEGATIVES_MODE_LABEL[item]}
              </label>
            ))}
          </div>
          {lists.length === 0 ? <p className="mt-2 text-[13px] text-dim">Contul n-are liste comune de negative active.</p> : null}
        </fieldset>

        {mode !== "campaigns" && lists.length > 0 ? (
          <div>
            <label htmlFor="lista-comuna" className={LABEL}>
              Lista comună
            </label>
            <select id="lista-comuna" value={listId} onChange={(event) => setListId(event.target.value)} className={cn(FIELD, "mt-2 h-11")}>
              {lists.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} · {counted(item.count, "cuvânt", "cuvinte")} · {counted(item.campaigns.length, "campanie", "campanii")}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {mode !== "link" ? (
          <div>
            <label htmlFor="negative-text" className={LABEL}>
              Negativele, câte unul pe rând
            </label>
            <textarea
              id="negative-text"
              value={text}
              onChange={(event) => setText(event.target.value)}
              spellCheck={false}
              aria-describedby="negative-notatie"
              placeholder={'angajari\n"locuri de munca"\n[pret gratuit]'}
              className={cn(FIELD, "mt-2 h-48 resize-y py-3 font-md-mono text-[13px] leading-[1.6]")}
            />
            <p id="negative-notatie" className="mt-2 text-[13px] leading-snug text-dim">
              Fără semne = potrivire amplă; între ghilimele = frază; între paranteze drepte = exactă. Rândurile goale se sar.
            </p>
          </div>
        ) : null}

        <fieldset>
          <legend className={LABEL}>
            {mode === "campaigns" ? "Pe campaniile" : mode === "list" ? "Și leagă lista de campaniile (opțional)" : "De campaniile"}
          </legend>
          {campaigns.length === 0 ? (
            <p className="mt-2 text-[14px] text-dim">Contul n-are campanii de căutare.</p>
          ) : (
            <ul className="mt-2 max-h-72 divide-y divide-hair overflow-auto rounded-panel border border-hair">
              {campaigns.map((item) => {
                const linked = list?.campaigns.includes(item.id) && mode !== "campaigns";
                return (
                  <li key={item.id}>
                    <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 text-[13.5px] hover:bg-glass">
                      <input type="checkbox" checked={chosen.has(item.id)} onChange={() => toggle(item.id)} className="h-4 w-4 shrink-0 accent-[#2f5bff]" />
                      <span className="min-w-0 flex-1 truncate text-bone/90">{item.name}</span>
                      <span className="shrink-0 font-md-mono text-[11px] text-dim">
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
          <button type="button" onClick={runPreview} disabled={previewing || adding} className="btn btn-light disabled:cursor-wait disabled:opacity-60">
            {previewing ? "Se verifică…" : fresh ? "Previzualizează din nou" : "Previzualizează"}
          </button>
          <button
            type="button"
            onClick={runAdd}
            disabled={!fresh?.ok || adding || previewing}
            className="btn btn-ghost disabled:cursor-not-allowed disabled:opacity-45"
          >
            {adding ? "Se adaugă…" : verb}
          </button>
        </div>
        <p className="text-[13px] leading-snug text-dim" aria-live="polite">
          {previewing
            ? "Portalul citește cuvintele cheie ale campaniilor, caută conflictele și trimite totul la Google fără să schimbe nimic…"
            : preview && !fresh
              ? "Ai schimbat ceva de la previzualizare: previzualizează din nou."
              : fresh?.ok
                ? `Gata de trimis: ${counted(fresh.operations, "operație", "operații")}, exact ce vezi în dreapta.`
                : "Întâi previzualizarea: nimic nu pleacă spre Google fără ea."}
        </p>
      </div>

      <div className="min-w-0 space-y-4">
        {failure ? (
          <p role="alert" className={cn("rounded-panel-lg border border-[#d93025]/35 bg-[#d93025]/[0.05] px-5 py-4 text-[14px]", ERROR_TEXT)}>
            {failure}
          </p>
        ) : null}
        {result ? (
          <div
            role={result.ok ? "status" : "alert"}
            className={cn("rounded-panel-lg border px-5 py-4 text-[14px] leading-relaxed", result.ok ? "border-bone/30 bg-char" : "border-[#d93025]/35 bg-[#d93025]/[0.05]")}
          >
            {result.ok ? (
              <>
                <p className={cn("font-semibold", OK_TEXT)}>
                  {mode === "link" ? "Lista e legată." : `${counted(result.operations, "negativ adăugat", "negative adăugate")}.`}
                </p>
                {result.journalWarning ? <p className={cn("mt-2", WARNING_TEXT)}>{result.journalWarning}</p> : null}
              </>
            ) : (
              <p className={ERROR_TEXT}>{result.message}</p>
            )}
          </div>
        ) : null}
        {fresh ? <PreviewPanel preview={fresh} /> : !result && !failure ? (
          <div className="rounded-panel-lg border border-dashed border-hair-strong px-6 py-8">
            <p className="font-md-display text-[1.25rem] font-semibold text-bone">Previzualizarea apare aici.</p>
            <p className="mt-2 text-[14.5px] leading-relaxed text-bone/70">
              Ce se adaugă și unde, ce era deja acolo, ce cuvinte cheie active ar bloca negativele noi — înainte să plece ceva spre Google.
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function PreviewPanel({ preview }: { preview: NegativesPreview }) {
  const bad = preview.keywords.filter((item) => item.problem);
  return (
    <div className="space-y-4 rounded-panel-lg border border-hair bg-char/60 px-5 py-5 sm:px-6">
      <h3 className="eyebrow !text-[11.5px] !text-bone">Previzualizarea</h3>
      {preview.errors.length > 0 ? (
        <ul className="space-y-1.5 rounded-panel border border-[#d93025]/35 bg-[#d93025]/[0.05] px-4 py-3 text-[14px]">
          {preview.errors.map((error, index) => (
            <li key={index} className={ERROR_TEXT}>
              {error}
            </li>
          ))}
        </ul>
      ) : null}
      {preview.conflicts.length > 0 ? (
        <div>
          <h4 className="text-[14px] font-semibold text-bone">Cuvinte cheie active care ar fi blocate</h4>
          <ul className="mt-2 space-y-1 text-[13.5px] text-bone/85">
            {preview.conflicts.slice(0, 60).map((conflict, index) => (
              <li key={index}>
                <span className="font-md-mono text-[12.5px]">{conflict.keyword}</span>
                {conflict.group ? <span className="text-dim"> · grupul „{conflict.group}”</span> : null}
                <span className="text-dim"> · „{conflict.campaign}” · blocat de </span>
                <span className={cn("font-md-mono text-[12.5px]", ERROR_TEXT)}>{conflict.negative}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {preview.additions.map((addition) => (
        <div key={addition.where}>
          <h4 className="text-[14px] font-semibold text-bone">
            {addition.where} · {addition.keywords.length}
          </h4>
          {addition.keywords.length > 0 ? (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {addition.keywords.slice(0, 120).map((item) => (
                <li key={item} className="rounded-panel-sm border border-hair-strong px-2 py-0.5 font-md-mono text-[12px] text-bone/90">
                  {item}
                </li>
              ))}
            </ul>
          ) : null}
          {addition.skipped.length > 0 ? (
            <p className="mt-2 text-[13px] text-dim">
              Deja acolo, se sar: {addition.skipped.slice(0, 40).join(", ")}
              {addition.skipped.length > 40 ? ` și încă ${addition.skipped.length - 40}` : ""}.
            </p>
          ) : null}
        </div>
      ))}
      {bad.length > 0 ? (
        <div>
          <h4 className={cn("text-[14px] font-semibold", WARNING_TEXT)}>Rânduri care nu se adaugă</h4>
          <ul className="mt-2 space-y-1 text-[13.5px]">
            {bad.map((item) => (
              <li key={item.line} className="text-bone/80">
                <span className="font-md-mono text-[12px] text-dim">rândul {item.line}</span> <span className="font-md-mono">{item.raw}</span> — {item.problem}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {preview.warnings.map((warning, index) => (
        <p key={index} className={cn("text-[13.5px]", WARNING_TEXT)}>
          {warning}
        </p>
      ))}
      <p className={cn("text-[13.5px]", preview.ok ? OK_TEXT : "text-dim")}>
        {preview.ok
          ? `${countOf(preview.operations, "operații")} verificate la Google cu validateOnly — le-ar accepta pe toate. Nu s-a schimbat nimic încă.`
          : "Nu se trimite nimic până nu e totul în regulă."}
      </p>
    </div>
  );
}
