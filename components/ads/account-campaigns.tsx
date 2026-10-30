"use client";

import Link from "next/link";
import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CAMPAIGN_STATUS_LABEL, CHANNEL_LABEL, BIDDING_STRATEGY_LABEL, accountMoney, label } from "@/lib/ads/google/account/labels";
import type { AccountCampaign, AccountHeader, PauseResponse } from "@/lib/ads/google/account/types";
import { countOf } from "@/lib/ads/plan-derive";
import { cn } from "@/lib/utils";
import { PauseGlyph } from "./pause-seal";
import { ERROR_TEXT, FIELD, LABEL, OK_TEXT, WARNING_TEXT } from "./tone";

/**
 * Campaniile contului, în toate stările, cu cifrele pe 30 de zile și pe tot
 * istoricul. Filtre pe tip și status, sortare, totalul celor din filtru.
 * Campaniile active se pot bifa și pune pe pauză — după o confirmare care
 * arată exact lista și cât au cheltuit în 30 de zile. Pauza e singurul lucru
 * pe care îl poate schimba portalul pe o campanie existentă.
 */

type Sort = "cost30" | "conversions30" | "costAll" | "name" | "start" | "budget";

const SORT_LABEL: Record<Sort, string> = {
  cost30: "Cost în 30 de zile",
  conversions30: "Conversii în 30 de zile",
  costAll: "Cost de la început",
  budget: "Buget pe zi",
  start: "Cele mai noi",
  name: "Nume",
};

function counted(count: number, one: string, many: string): string {
  return count === 1 ? `1 ${one}` : countOf(count, many);
}

const number = new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 2 });

export function AccountCampaigns({
  workspace,
  account,
  campaigns,
  pause,
}: {
  workspace: string;
  account: AccountHeader;
  campaigns: AccountCampaign[];
  pause: (input: { workspace: string; adAccount: string; campaignIds: string[] }) => Promise<PauseResponse>;
}) {
  const router = useRouter();
  const [type, setType] = useState("all");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState<Sort>("cost30");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<PauseResponse | null>(null);
  const [pending, startPause] = useTransition();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const money = (amount: number) => accountMoney(amount, account.currency);

  const types = useMemo(() => [...new Set(campaigns.map((item) => item.type))].sort(), [campaigns]);
  const shown = useMemo(() => {
    const list = campaigns.filter((item) => (type === "all" || item.type === type) && (status === "all" || item.status === status));
    const by: Record<Sort, (a: AccountCampaign, b: AccountCampaign) => number> = {
      cost30: (a, b) => b.cost30 - a.cost30,
      conversions30: (a, b) => b.conversions30 - a.conversions30,
      costAll: (a, b) => b.costAll - a.costAll,
      budget: (a, b) => (b.budget ?? 0) - (a.budget ?? 0),
      start: (a, b) => (b.startDate ?? "").localeCompare(a.startDate ?? ""),
      name: (a, b) => a.name.localeCompare(b.name, "ro"),
    };
    return [...list].sort((a, b) => (a.status === "REMOVED" ? 1 : 0) - (b.status === "REMOVED" ? 1 : 0) || by[sort](a, b));
  }, [campaigns, type, status, sort]);

  const totals = useMemo(
    () => ({
      active: shown.filter((item) => item.status === "ENABLED").length,
      paused: shown.filter((item) => item.status === "PAUSED").length,
      removed: shown.filter((item) => item.status === "REMOVED").length,
      cost30: shown.reduce((sum, item) => sum + item.cost30, 0),
      conversions30: shown.reduce((sum, item) => sum + item.conversions30, 0),
      costAll: shown.reduce((sum, item) => sum + item.costAll, 0),
      budget: shown.filter((item) => item.status === "ENABLED").reduce((sum, item) => sum + (item.budget ?? 0), 0),
    }),
    [shown]
  );

  const selectable = shown.filter((item) => item.status === "ENABLED");
  const chosen = campaigns.filter((item) => selected.has(item.id));
  const chosenCost = chosen.reduce((sum, item) => sum + item.cost30, 0);
  const allChosen = selectable.length > 0 && selectable.every((item) => selected.has(item.id));

  const toggle = (id: string) =>
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const confirm = () => {
    startPause(async () => {
      try {
        const response = await pause({ workspace, adAccount: account.id, campaignIds: [...selected] });
        setResult(response);
        if (response.ok) {
          setSelected(new Set());
          router.refresh();
        }
      } catch {
        setResult({ ok: false, message: "Serverul n-a răspuns. Nu se știe dacă pauza a plecat: reîncarcă pagina și uită-te la status." });
      }
      dialogRef.current?.close();
    });
  };

  if (campaigns.length === 0) {
    return (
      <div className="rounded-panel-lg border border-dashed border-hair-strong px-6 py-10">
        <p className="font-md-display text-[1.25rem] font-semibold text-bone">Contul n-are nicio campanie.</p>
        <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-bone/70">
          Prima se face din{" "}
          <Link href="/admin/ads/cautare" className="text-bone underline underline-offset-4">
            Căutare
          </Link>{" "}
          — un plan întreg, creat oprit.
        </p>
      </div>
    );
  }

  return (
    <section aria-labelledby="campanii-cont">
      <h2 id="campanii-cont" className="sr-only">
        Campaniile contului
      </h2>

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor="filtru-tip" className={LABEL}>
            Tipul
          </label>
          <select id="filtru-tip" value={type} onChange={(event) => setType(event.target.value)} className={cn(FIELD, "mt-2 h-11")}>
            <option value="all">Toate tipurile</option>
            {types.map((item) => (
              <option key={item} value={item}>
                {label(CHANNEL_LABEL, item)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="filtru-status" className={LABEL}>
            Statusul
          </label>
          <select id="filtru-status" value={status} onChange={(event) => setStatus(event.target.value)} className={cn(FIELD, "mt-2 h-11")}>
            <option value="all">Toate (și cele șterse)</option>
            <option value="ENABLED">Active</option>
            <option value="PAUSED">Pe pauză</option>
            <option value="REMOVED">Șterse</option>
          </select>
        </div>
        <div>
          <label htmlFor="sortare" className={LABEL}>
            Ordinea
          </label>
          <select id="sortare" value={sort} onChange={(event) => setSort(event.target.value as Sort)} className={cn(FIELD, "mt-2 h-11")}>
            {(Object.keys(SORT_LABEL) as Sort[]).map((item) => (
              <option key={item} value={item}>
                {SORT_LABEL[item]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <p className="mt-5 text-[14.5px] leading-relaxed text-bone/85" aria-live="polite">
        <strong className="font-semibold text-bone">{counted(shown.length, "campanie", "campanii")}</strong>
        {" — "}
        {totals.active} active, {totals.paused} pe pauză, {totals.removed} șterse. În 30 de zile: {money(totals.cost30)},{" "}
        {number.format(totals.conversions30)} conversii. De la început: {money(totals.costAll)}.
        {totals.active > 0 ? ` Bugetul zilnic al celor active: ${money(totals.budget)}.` : ""}
      </p>

      {result ? (
        <div
          role={result.ok ? "status" : "alert"}
          className={cn(
            "mt-5 rounded-panel-lg border px-5 py-4 text-[14px] leading-relaxed",
            result.ok ? "border-bone/30 bg-char" : "border-[#d93025]/35 bg-[#d93025]/[0.05]"
          )}
        >
          {result.ok ? (
            <>
              <p className={cn("flex items-center gap-3 font-semibold", OK_TEXT)}>
                <PauseGlyph className="h-7 w-7 shrink-0 text-bone" />
                {result.paused.length === 0 ? "Nimic de pus pe pauză." : `${counted(result.paused.length, "campanie pusă", "campanii puse")} pe pauză.`}
              </p>
              {result.paused.length > 0 ? <p className="mt-2 text-bone/80">{result.paused.map((item) => `„${item.name}”`).join(", ")}.</p> : null}
              {result.skipped.length > 0 ? (
                <p className={cn("mt-2", WARNING_TEXT)}>Sărite: {result.skipped.map((item) => `„${item.name}” (${item.why})`).join(", ")}.</p>
              ) : null}
              {result.journalWarning ? <p className={cn("mt-2", WARNING_TEXT)}>{result.journalWarning}</p> : null}
            </>
          ) : (
            <p className={ERROR_TEXT}>{result.message}</p>
          )}
        </div>
      ) : null}

      <div className="mt-5 overflow-x-auto rounded-panel-lg border border-hair">
        <table className="w-full min-w-[960px] border-collapse text-left text-[13.5px]">
          <caption className="sr-only">Campaniile contului {account.name}, cu cifrele pe 30 de zile și de la început</caption>
          <thead className="bg-char/80 font-md-mono text-[11px] uppercase tracking-[0.12em] text-dim">
            <tr>
              <th scope="col" className="w-10 px-3 py-3">
                <input
                  type="checkbox"
                  aria-label="Bifează toate campaniile active din filtru"
                  checked={allChosen}
                  disabled={selectable.length === 0}
                  onChange={() =>
                    setSelected((previous) => {
                      const next = new Set(previous);
                      for (const item of selectable) {
                        if (allChosen) next.delete(item.id);
                        else next.add(item.id);
                      }
                      return next;
                    })
                  }
                  className="h-4 w-4 accent-[var(--md-a1)]"
                />
              </th>
              <th scope="col" className="px-3 py-3 font-normal">Campania</th>
              <th scope="col" className="px-3 py-3 font-normal">Tipul</th>
              <th scope="col" className="px-3 py-3 font-normal">Statusul</th>
              <th scope="col" className="px-3 py-3 text-right font-normal">Buget / zi</th>
              <th scope="col" className="px-3 py-3 text-right font-normal">Cost · 30 z</th>
              <th scope="col" className="px-3 py-3 text-right font-normal">Clicuri · 30 z</th>
              <th scope="col" className="px-3 py-3 text-right font-normal">Conv. · 30 z</th>
              <th scope="col" className="px-3 py-3 text-right font-normal">Cost total</th>
              <th scope="col" className="px-3 py-3 text-right font-normal">Conv. total</th>
              <th scope="col" className="px-3 py-3 font-normal">Start</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hair">
            {shown.map((item) => {
              const active = item.status === "ENABLED";
              return (
                <tr key={item.id} className={cn(item.status === "REMOVED" && "text-bone/45", selected.has(item.id) && "bg-glass")}>
                  <td className="px-3 py-2.5">
                    {active ? (
                      <input
                        type="checkbox"
                        aria-label={`Bifează „${item.name}” pentru pauză`}
                        checked={selected.has(item.id)}
                        onChange={() => toggle(item.id)}
                        className="h-4 w-4 accent-[var(--md-a1)]"
                      />
                    ) : null}
                  </td>
                  <th scope="row" className="max-w-[22rem] px-3 py-2.5 font-normal">
                    <span className="block truncate text-bone" title={item.name}>
                      {item.name}
                    </span>
                    <span className="block font-md-mono text-[11px] text-dim">
                      {item.id}
                      {item.bidding ? ` · ${label(BIDDING_STRATEGY_LABEL, item.bidding)}` : ""}
                      {item.portalRecordId ? (
                        <>
                          {" · "}
                          <Link href={`/admin/ads/${item.portalRecordId}`} className="text-bone/85 underline underline-offset-2">
                            din portal
                          </Link>
                        </>
                      ) : null}
                    </span>
                  </th>
                  <td className="px-3 py-2.5">{label(CHANNEL_LABEL, item.type)}</td>
                  <td className={cn("px-3 py-2.5", active ? "text-bone" : "text-dim")}>{label(CAMPAIGN_STATUS_LABEL, item.status)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{item.budget !== null ? money(item.budget) : "—"}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{money(item.cost30)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{number.format(item.clicks30)}</td>
                  <td className={cn("px-3 py-2.5 text-right tabular-nums", active && item.cost30 > 0 && item.conversions30 === 0 && WARNING_TEXT)}>
                    {number.format(item.conversions30)}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{money(item.costAll)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{number.format(item.conversionsAll)}</td>
                  <td className="px-3 py-2.5 font-md-mono text-[12px] text-dim">{item.startDate ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[12.5px] text-dim">
        Cifrele vin acum din Google Ads, în moneda contului. „De la început” = tot istoricul păstrat de Google.
      </p>

      <div className="sticky bottom-0 z-10 mt-4 flex flex-col gap-3 rounded-panel-lg border border-hair bg-ink/92 px-4 py-4 backdrop-blur-md sm:flex-row sm:items-center sm:px-6">
        <button
          type="button"
          onClick={() => dialogRef.current?.showModal()}
          disabled={selected.size === 0 || pending}
          className="btn btn-light shrink-0 disabled:cursor-not-allowed disabled:opacity-45"
        >
          {pending ? "Se pun pe pauză…" : `Pune pe pauză${selected.size > 0 ? ` (${selected.size})` : ""}`}
        </button>
        <p className="text-[13.5px] leading-snug text-bone/75">
          {selected.size === 0
            ? "Bifează campaniile active pe care vrei să le oprești. Pauza oprește cheltuiala; repornirea se face din Google Ads."
            : `${counted(selected.size, "campanie aleasă", "campanii alese")} · ${money(chosenCost)} cheltuiți în ultimele 30 de zile.`}
        </p>
      </div>

      <dialog
        ref={dialogRef}
        aria-labelledby="pauza-titlu"
        className="m-auto w-[min(36rem,calc(100vw-2rem))] rounded-panel-lg border border-hair-strong bg-char p-0 text-bone backdrop:bg-black/70"
      >
        <div className="px-5 py-5 sm:px-6">
          <div className="flex items-center gap-3">
            <PauseGlyph className="h-10 w-10 shrink-0 text-bone" />
            <h2 id="pauza-titlu" className="font-md-display text-[1.375rem] font-semibold leading-tight">
              Pui pe pauză {counted(chosen.length, "campanie", "campanii")}?
            </h2>
          </div>
          <p className="mt-3 text-[14px] leading-relaxed text-bone/80">
            Se opresc acum, în contul {account.name}. Bugetele, licitările și anunțurile rămân cum sunt; le repornești din Google Ads.
          </p>
          <ul className="mt-4 max-h-[40vh] divide-y divide-hair overflow-auto rounded-panel border border-hair">
            {chosen.map((item) => (
              <li key={item.id} className="flex items-baseline justify-between gap-4 px-3 py-2 text-[13.5px]">
                <span className="min-w-0 truncate">{item.name}</span>
                <span className="shrink-0 tabular-nums text-dim">{money(item.cost30)} · 30 z</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[13.5px] text-bone/80">În total, {money(chosenCost)} cheltuiți în ultimele 30 de zile.</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <button type="button" onClick={confirm} disabled={pending} className="btn btn-light disabled:cursor-wait disabled:opacity-60">
              {pending ? "Se pun pe pauză…" : `Pune pe pauză ${counted(chosen.length, "campanie", "campanii")}`}
            </button>
            <button type="button" onClick={() => dialogRef.current?.close()} className="btn btn-ghost">
              Renunță
            </button>
          </div>
        </div>
      </dialog>
    </section>
  );
}
