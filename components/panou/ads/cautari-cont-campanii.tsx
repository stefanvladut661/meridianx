"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PauseCircle, ShieldOff } from "lucide-react";
import { BIDDING_STRATEGY_LABEL, CAMPAIGN_STATUS_LABEL, CHANNEL_LABEL, accountMoney, label } from "@/lib/ads/google/account/labels";
import type { AccountCampaign, AccountHeader, PauseResponse } from "@/lib/ads/google/account/types";
import { Btn, Card, Pill, btnClass, type PillTone } from "@/components/panou/ui/primitives";
import { ConfirmDialog, InlineNote } from "@/components/panou/ui/actions";
import { EmptyState } from "@/components/panou/ui/states";
import { SoftSelect } from "@/components/panou/ui/select";
import { useToast } from "@/components/panou/ui/toast";
import { cn } from "@/lib/utils";
import { CanalMark } from "./canal-mark";
import { CardHead, checkClass, counted, theadClass, thClass } from "./cautari-cont-ui";

/**
 * Campaniile contului, în toate stările, cu cifrele pe 30 de zile și pe tot
 * istoricul. Filtre pe tip și status, sortare, totalul celor din filtru.
 * Campaniile active se pot bifa (sau apăsa „Pauză” pe rând) și pune pe pauză,
 * după o confirmare care arată exact lista și cât au cheltuit în 30 de zile.
 * Pauza e singurul lucru pe care îl poate schimba portalul pe o campanie
 * existentă: niciun buton de pornire, ștergere, buget sau licitare.
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

const number = new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 2 });

const STATUS_TONE: Record<string, PillTone> = { ENABLED: "mint", PAUSED: "dark", REMOVED: "neutral" };

export function CautariContCampanii({
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
  const { notify } = useToast();
  const [type, setType] = useState("all");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState<Sort>("cost30");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<PauseResponse | null>(null);
  const [confirming, setConfirming] = useState(false);
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

  const runPause = async () => {
    try {
      const response = await pause({ workspace, adAccount: account.id, campaignIds: [...selected] });
      setResult(response);
      if (response.ok) {
        setSelected(new Set());
        notify(response.paused.length === 0 ? "Nimic de pus pe pauză." : `${counted(response.paused.length, "campanie pusă", "campanii puse")} pe pauză.`);
        router.refresh();
      } else {
        notify(response.message, "error");
      }
    } catch {
      setResult({ ok: false, message: "Serverul n-a răspuns. Nu se știe dacă pauza a plecat: reîncarcă pagina și uită-te la status." });
    }
  };

  if (campaigns.length === 0) {
    return (
      <Card className="p-0">
        <EmptyState
          icon={PauseCircle}
          title="Contul n-are nicio campanie"
          text="Prima se face dintr-un plan de căutare — creat întreg, oprit, gata de verificat în Google Ads."
          action={
            <Link href="/admin/ads/cautare" className={btnClass({ variant: "primary", size: "sm" })}>
              Deschide planul de căutare
            </Link>
          }
        />
      </Card>
    );
  }

  return (
    <section aria-labelledby="campanii-cont" className="space-y-3">
      <Card className="p-4 sm:p-4">
        <h2 id="campanii-cont" className="sr-only">
          Campaniile contului
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <SoftSelect
            id="filtru-tip"
            label="Tipul"
            value={type}
            onChange={setType}
            options={[{ value: "all", label: "Toate tipurile" }, ...types.map((item) => ({ value: item, label: label(CHANNEL_LABEL, item) }))]}
          />
          <SoftSelect
            id="filtru-status"
            label="Statusul"
            value={status}
            onChange={setStatus}
            options={[
              { value: "all", label: "Toate (și cele șterse)" },
              { value: "ENABLED", label: "Active" },
              { value: "PAUSED", label: "Pe pauză" },
              { value: "REMOVED", label: "Șterse" },
            ]}
          />
          <SoftSelect
            id="sortare"
            label="Ordinea"
            value={sort}
            onChange={(value) => setSort(value as Sort)}
            options={(Object.keys(SORT_LABEL) as Sort[]).map((item) => ({ value: item, label: SORT_LABEL[item] }))}
          />
        </div>
        <p className="mt-3 text-[12px] leading-relaxed text-muted-foreground" aria-live="polite">
          <strong className="font-semibold text-foreground">{counted(shown.length, "campanie", "campanii")}</strong>
          {" — "}
          {totals.active} active, {totals.paused} pe pauză, {totals.removed} șterse. În 30 de zile: {money(totals.cost30)}, {number.format(totals.conversions30)} conversii. De la început:{" "}
          {money(totals.costAll)}.{totals.active > 0 ? ` Bugetul zilnic al celor active: ${money(totals.budget)}.` : ""}
        </p>
      </Card>

      {result ? (
        <div role={result.ok ? "status" : "alert"} className="space-y-2">
          {result.ok ? (
            <>
              <InlineNote tone="mint">
                <p className="flex items-center gap-2 font-medium">
                  <PauseCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {result.paused.length === 0 ? "Nimic de pus pe pauză." : `${counted(result.paused.length, "campanie pusă", "campanii puse")} pe pauză.`}
                </p>
                {result.paused.length > 0 ? <p className="mt-1.5 text-foreground/80">{result.paused.map((item) => `„${item.name}”`).join(", ")}.</p> : null}
              </InlineNote>
              {result.skipped.length > 0 ? <InlineNote tone="apricot">Sărite: {result.skipped.map((item) => `„${item.name}” (${item.why})`).join(", ")}.</InlineNote> : null}
              {result.journalWarning ? <InlineNote tone="apricot">{result.journalWarning}</InlineNote> : null}
            </>
          ) : (
            <InlineNote tone="rose">{result.message}</InlineNote>
          )}
        </div>
      ) : null}

      <Card className="overflow-hidden p-0 sm:p-0">
        <CardHead title="Campanii și acțiuni permise" hint="cont existent: doar pauză și negative" />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-left">
            <caption className="sr-only">Campaniile contului {account.name}, cu cifrele pe 30 de zile și de la început</caption>
            <thead>
              <tr className={theadClass}>
                <th scope="col" className="w-10 py-2.5 pl-4 pr-1">
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
                    className={checkClass}
                  />
                </th>
                <th scope="col" className={thClass}>Campania</th>
                <th scope="col" className={thClass}>Tipul</th>
                <th scope="col" className={thClass}>Statusul</th>
                <th scope="col" className={cn(thClass, "text-right")}>Buget / zi</th>
                <th scope="col" className={cn(thClass, "text-right")}>Cost · 30 z</th>
                <th scope="col" className={cn(thClass, "text-right")}>Clicuri · 30 z</th>
                <th scope="col" className={cn(thClass, "text-right")}>Conv. · 30 z</th>
                <th scope="col" className={cn(thClass, "text-right")}>Cost total</th>
                <th scope="col" className={cn(thClass, "text-right")}>Conv. total</th>
                <th scope="col" className={thClass}>Start</th>
                <th scope="col" className="sticky right-0 bg-card py-2.5 pl-3 pr-4 text-right font-medium">Acțiuni</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((item) => {
                const active = item.status === "ENABLED";
                return (
                  <tr key={item.id} className={cn("border-b border-white/[0.04] text-[12.5px] last:border-0", item.status === "REMOVED" && "text-foreground/45", selected.has(item.id) && "bg-lav/[0.05]")}>
                    <td className="py-2.5 pl-4 pr-1">
                      {active ? (
                        <input type="checkbox" aria-label={`Bifează „${item.name}” pentru pauză`} checked={selected.has(item.id)} onChange={() => toggle(item.id)} className={checkClass} />
                      ) : null}
                    </td>
                    <th scope="row" className="max-w-[22rem] px-3 py-2.5 font-normal">
                      <span className="flex items-center gap-2">
                        <CanalMark platform="google" size="sm" label={false} />
                        <span className="min-w-0">
                          <span className="block truncate" title={item.name}>
                            {item.name}
                          </span>
                          <span className="block truncate font-mono text-[10.5px] text-muted-foreground">
                            {item.id}
                            {item.bidding ? ` · ${label(BIDDING_STRATEGY_LABEL, item.bidding)}` : ""}
                            {item.portalRecordId ? (
                              <>
                                {" · "}
                                <Link href={`/admin/ads/${item.portalRecordId}`} className="text-foreground/80 underline underline-offset-2 hover:text-foreground">
                                  din portal
                                </Link>
                              </>
                            ) : null}
                          </span>
                        </span>
                      </span>
                    </th>
                    <td className="px-3 py-2.5">{label(CHANNEL_LABEL, item.type)}</td>
                    <td className="px-3 py-2.5">
                      <Pill tone={STATUS_TONE[item.status] ?? "neutral"} dot className="whitespace-nowrap">
                        {label(CAMPAIGN_STATUS_LABEL, item.status)}
                      </Pill>
                    </td>
                    <td className="pu-num px-3 py-2.5 text-right">{item.budget !== null ? money(item.budget) : "—"}</td>
                    <td className="pu-num px-3 py-2.5 text-right">{money(item.cost30)}</td>
                    <td className="pu-num px-3 py-2.5 text-right">{number.format(item.clicks30)}</td>
                    <td className={cn("pu-num px-3 py-2.5 text-right", active && item.cost30 > 0 && item.conversions30 === 0 && "text-apricot")}>{number.format(item.conversions30)}</td>
                    <td className="pu-num px-3 py-2.5 text-right">{money(item.costAll)}</td>
                    <td className="pu-num px-3 py-2.5 text-right">{number.format(item.conversionsAll)}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 font-mono text-[11px] text-muted-foreground">{item.startDate ?? "—"}</td>
                    <td className="sticky right-0 bg-card py-2.5 pl-3 pr-4 shadow-[-12px_0_12px_-12px_rgba(0,0,0,0.7)]">
                      <div className="flex items-center justify-end gap-1.5">
                        <Btn
                          size="xs"
                          variant="outline"
                          icon={PauseCircle}
                          disabled={!active}
                          aria-label={`Pune pe pauză „${item.name}”`}
                          onClick={() => {
                            setSelected(new Set([item.id]));
                            setConfirming(true);
                          }}
                        >
                          Pauză
                        </Btn>
                        {item.type === "SEARCH" && item.status !== "REMOVED" ? (
                          <Link
                            href={`/admin/ads/cont?cont=${account.id}&vedere=negative&campanie=${item.id}`}
                            className={btnClass({ variant: "ghost", size: "xs" })}
                            aria-label={`Adaugă negative pe „${item.name}”`}
                            title="Adaugă negative"
                          >
                            <ShieldOff className="h-3.5 w-3.5" aria-hidden="true" />
                            <span className="sr-only">Negative</span>
                          </Link>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="border-t border-white/[0.06] px-4 py-2.5 text-[11px] text-muted-foreground">
          Cifrele vin acum din Google Ads, în moneda contului; „de la început” = tot istoricul păstrat de Google. Alte modificări nu sunt permise din portal: bugetul, licitarea și pornirea se schimbă doar în Google Ads.
        </p>
      </Card>

      <div className="sticky bottom-[84px] z-10 flex flex-col gap-3 rounded-2xl border border-white/[0.09] bg-[#121216]/95 px-4 py-3 backdrop-blur-md sm:flex-row sm:items-center lg:bottom-4">
        <Btn variant="primary" size="sm" icon={PauseCircle} onClick={() => setConfirming(true)} disabled={selected.size === 0} className="shrink-0">
          {`Pune pe pauză${selected.size > 0 ? ` (${selected.size})` : ""}`}
        </Btn>
        <p className="text-[12px] leading-snug text-muted-foreground">
          {selected.size === 0
            ? "Bifează campaniile active pe care vrei să le oprești. Pauza oprește cheltuiala; repornirea se face din Google Ads."
            : `${counted(selected.size, "campanie aleasă", "campanii alese")} · ${money(chosenCost)} cheltuiți în ultimele 30 de zile.`}
        </p>
      </div>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        tone="primary"
        title={`Pui pe pauză ${counted(chosen.length, "campanie", "campanii")}?`}
        description={`Se opresc acum, în contul ${account.name}. Bugetele, licitările și anunțurile rămân cum sunt; le repornești din Google Ads.`}
        confirmLabel={`Pune pe pauză ${counted(chosen.length, "campanie", "campanii")}`}
        onConfirm={runPause}
      >
        <ul className="mt-4 max-h-[40vh] divide-y divide-white/[0.05] overflow-auto rounded-xl border border-white/[0.07]">
          {chosen.map((item) => (
            <li key={item.id} className="flex items-baseline justify-between gap-4 px-3 py-2 text-[12.5px]">
              <span className="min-w-0 truncate">{item.name}</span>
              <span className="pu-num shrink-0 text-muted-foreground">{money(item.cost30)} · 30 z</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[12.5px] text-foreground/80">În total, {money(chosenCost)} cheltuiți în ultimele 30 de zile.</p>
      </ConfirmDialog>
    </section>
  );
}
