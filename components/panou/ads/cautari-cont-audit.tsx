import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { BILLING_STATUS_LABEL, CHANGE_OPERATION_LABEL, CHANGE_RESOURCE_LABEL, ROLE_LABEL, accountMoney, label } from "@/lib/ads/google/account/labels";
import { bulkCreations, clientLabel } from "@/lib/ads/google/account/signals";
import { CATEGORY_LABEL, CONVERSION_TYPE_LABEL } from "@/lib/ads/google/conversions/standard";
import type { AccountAudit, AccountCampaign, AuditBlock } from "@/lib/ads/google/account/types";
import { countOf } from "@/lib/ads/plan-derive";
import { Card, Pill } from "@/components/panou/ui/primitives";
import { InlineNote } from "@/components/panou/ui/actions";
import { cn } from "@/lib/utils";
import { CardHead, theadClass, thClass } from "./cautari-cont-ui";

/**
 * Auditul unui cont preluat — doar citire. Sus, „Probleme găsite” (semnalele,
 * cu gravitate); dedesubt, fiecare bloc citit separat (un bloc pe care cheia nu-l
 * poate citi spune de ce, iar restul rămân): cine a schimbat ce în ultimele 30
 * de zile, cine are acces, facturarea, acțiunile de conversie.
 */

const ACCOUNT_BUDGET_STATUS_LABEL: Record<string, string> = { APPROVED: "aprobat", PENDING: "în așteptare", CANCELLED: "anulat" };

const dateTime = new Intl.DateTimeFormat("ro-RO", { dateStyle: "medium", timeStyle: "short" });
function when(value: string | null): string {
  if (!value) return "—";
  const parsed = new Date(value.replace(" ", "T"));
  return Number.isNaN(parsed.getTime()) ? value : dateTime.format(parsed);
}

/** Un bloc pe care cheia nu l-a putut citi: spune de ce, restul auditului rămâne. */
function Unreadable({ block }: { block: AuditBlock<unknown> }) {
  if (block.ok) return null;
  return (
    <div className="px-4 py-3">
      <InlineNote tone="neutral">{block.message}</InlineNote>
    </div>
  );
}

function Section({ id, title, hint, children }: { id: string; title: string; hint?: string; children: ReactNode }) {
  return (
    <Card as="section" className="overflow-hidden p-0" aria-labelledby={id}>
      <CardHead id={id} title={title} hint={hint} />
      {children}
    </Card>
  );
}

export function CautariContAudit({ audit, currency, campaigns }: { audit: AccountAudit; currency: string; campaigns: AccountCampaign[] }) {
  const names = new Map(campaigns.map((item) => [item.id, item.name]));
  const waves = audit.changes.ok ? bulkCreations(audit.changes.data.items).slice(0, 8) : [];

  return (
    <div className="space-y-3">
      <Card as="section" className="overflow-hidden p-0 sm:p-0" aria-labelledby="semnale">
        <CardHead id="semnale" title="Probleme găsite" hint={audit.signals.length === 0 ? undefined : `${audit.signals.length} de citit, după gravitate`} />
        {audit.signals.length === 0 ? (
          <p className="flex items-center gap-2 px-4 py-4 text-[12.5px] text-mint">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            Nimic ieșit din comun în ce se poate citi.
          </p>
        ) : (
          <ul className="divide-y divide-white/[0.05]">
            {audit.signals.map((signal, index) => (
              <li key={index} className="flex items-start gap-3 px-4 py-3">
                <AlertTriangle className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", signal.tone === "error" ? "text-rose" : "text-apricot")} aria-hidden="true" />
                <p className="min-w-0 flex-1 text-[12.5px] leading-relaxed">{signal.message}</p>
                <Pill tone={signal.tone === "error" ? "rose" : "apricot"}>{signal.tone === "error" ? "mare" : "medie"}</Pill>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Section id="modificari" title="Cine a schimbat ce — ultimele 30 de zile" hint="Google păstrează istoricul detaliat 30 de zile; modificările din Google Ads Editor nu apar aici.">
        <Unreadable block={audit.changes} />
        {audit.changes.ok ? (
          <div className="px-4 py-3">
            <p className="text-[12.5px] text-foreground/80">
              {countOf(audit.changes.data.items.length, "modificări")} între {audit.changes.data.from} și {audit.changes.data.to}
              {audit.changes.data.truncated ? " — doar cele mai noi 10.000, limita Google pe o citire" : ""}.
            </p>
            {waves.length > 0 ? (
              <ul className="mt-3 space-y-1.5 text-[12.5px]">
                {waves.map((wave) => (
                  <li key={`${wave.user}-${wave.day}-${wave.client}`} className={wave.count >= 5 ? "text-apricot" : "text-foreground/85"}>
                    {wave.count === 1 ? "O campanie creată" : `${countOf(wave.count, "campanii")} create`} de {wave.user} pe {wave.day}, din {clientLabel(wave.client)}
                  </li>
                ))}
              </ul>
            ) : null}
            {audit.changes.data.items.length > 0 ? (
              <details className="group mt-3">
                <summary className="cursor-pointer list-none text-[12.5px] font-medium underline-offset-4 hover:underline">
                  <span aria-hidden="true" className="mr-2 inline-block transition-transform duration-150 group-open:rotate-90">
                    ›
                  </span>
                  Toate modificările, cele mai noi primele
                </summary>
                <div className="mt-3 max-h-[32rem] overflow-auto rounded-xl border border-white/[0.07]">
                  <table className="w-full min-w-[720px] text-left">
                    <caption className="sr-only">Modificările din cont în ultimele 30 de zile</caption>
                    <thead className="sticky top-0 bg-card">
                      <tr className={theadClass}>
                        <th scope="col" className={thClass}>Când</th>
                        <th scope="col" className={thClass}>Cine</th>
                        <th scope="col" className={thClass}>Ce</th>
                        <th scope="col" className={thClass}>Campania</th>
                        <th scope="col" className={thClass}>De unde</th>
                      </tr>
                    </thead>
                    <tbody>
                      {audit.changes.data.items.slice(0, 500).map((change, index) => (
                        <tr key={index} className="border-b border-white/[0.04] align-top text-[12.5px] last:border-0">
                          <td className="whitespace-nowrap px-3 py-2 font-mono text-[11px] text-muted-foreground">{when(change.at)}</td>
                          <td className="px-3 py-2 text-foreground/85">{change.user ?? "—"}</td>
                          <td className="px-3 py-2 text-foreground/85">
                            {label(CHANGE_OPERATION_LABEL, change.operation)} {label(CHANGE_RESOURCE_LABEL, change.resource)}
                            {change.fields ? <span className="block font-mono text-[10.5px] text-muted-foreground">{change.fields}</span> : null}
                          </td>
                          <td className="px-3 py-2 text-foreground/85">{change.campaign ? (names.get(change.campaign) ?? change.campaign) : "—"}</td>
                          <td className="px-3 py-2 text-muted-foreground">{clientLabel(change.client)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            ) : null}
          </div>
        ) : null}
      </Section>

      <Section id="utilizatori" title="Cine are acces">
        <Unreadable block={audit.users} />
        {audit.users.ok ? (
          <ul className="divide-y divide-white/[0.05]">
            {audit.users.data.map((user) => (
              <li key={`${user.email}-${user.pending}`} className="grid gap-x-6 gap-y-1 px-4 py-3 text-[12.5px] sm:grid-cols-[minmax(0,1fr)_auto]">
                <span className="min-w-0 break-all">{user.email}</span>
                <span className={cn("text-[11.5px]", user.role === "ADMIN" ? "text-foreground" : "text-muted-foreground")}>
                  {label(ROLE_LABEL, user.role)}
                  {user.pending ? " · invitație în așteptare" : ""} · din {when(user.since)}
                  {user.inviter ? ` · invitat de ${user.inviter}` : ""}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </Section>

      <Section id="facturare" title="Facturarea">
        <Unreadable block={audit.billing} />
        {audit.billing.ok ? (
          audit.billing.data.setups.length === 0 && audit.billing.data.budgets.length === 0 ? (
            <p className="px-4 py-3 text-[12.5px] leading-relaxed text-muted-foreground">
              Google nu întoarce nicio configurare de facturare prin API — de obicei la conturile plătite automat cu cardul. Verifică în Google Ads → Facturare.
            </p>
          ) : (
            <ul className="divide-y divide-white/[0.05] text-[12.5px] text-foreground/85">
              {audit.billing.data.setups.map((setup) => (
                <li key={setup.id} className="px-4 py-3">
                  Configurarea {setup.id}:{" "}
                  <span className={setup.status === "APPROVED" ? "text-mint" : "text-apricot"}>{label(BILLING_STATUS_LABEL, setup.status)}</span>
                  {setup.account ? ` · ${setup.account}` : ""}
                  {setup.profile ? ` · ${setup.profile}` : ""} · {when(setup.start)} → {setup.end ? when(setup.end) : "fără sfârșit"}
                </li>
              ))}
              {audit.billing.data.budgets.map((budget, index) => (
                <li key={index} className="px-4 py-3">
                  Bugetul de cont: {label(ACCOUNT_BUDGET_STATUS_LABEL, budget.status)} ·{" "}
                  {budget.limit === "fără limită" ? "fără limită de cheltuieli" : budget.limit === "—" ? "limită necunoscută" : `limita ${accountMoney(Number(budget.limit), currency)}`}
                  {budget.served !== null ? ` · consumat ${accountMoney(budget.served, currency)}` : ""}
                </li>
              ))}
            </ul>
          )
        ) : null}
      </Section>

      <Section id="conversii-audit" title="Acțiunile de conversie">
        <Unreadable block={audit.conversions} />
        {audit.conversions.ok ? (
          audit.conversions.data.length === 0 ? (
            <p className="px-4 py-3 text-[12.5px] text-apricot">Nicio acțiune de conversie: campaniile nu văd lead-urile.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left">
                <caption className="sr-only">Acțiunile de conversie ale contului</caption>
                <thead>
                  <tr className={theadClass}>
                    <th scope="col" className="py-2.5 pl-4 pr-3 font-medium">Acțiunea</th>
                    <th scope="col" className={thClass}>Tipul · categoria</th>
                    <th scope="col" className={thClass}>Rolul</th>
                    <th scope="col" className={thClass}>Starea</th>
                    <th scope="col" className="py-2.5 pl-3 pr-4 text-right font-medium">Conversii · 30 z</th>
                  </tr>
                </thead>
                <tbody>
                  {audit.conversions.data.map((action) => (
                    <tr key={action.id} className="border-b border-white/[0.04] text-[12.5px] last:border-0">
                      <th scope="row" className="py-2.5 pl-4 pr-3 font-normal">
                        {action.name}
                        <span className="block font-mono text-[10.5px] text-muted-foreground">{action.id}</span>
                      </th>
                      <td className="px-3 py-2.5 text-foreground/80">
                        {label(CONVERSION_TYPE_LABEL, action.type)} · {label(CATEGORY_LABEL, action.category)}
                      </td>
                      <td className="px-3 py-2.5 text-foreground/80">{action.primary ? "principală" : "secundară"}</td>
                      <td className="px-3 py-2.5">
                        <Pill tone={action.status === "ENABLED" ? "mint" : "neutral"} dot>
                          {action.status === "ENABLED" ? "activă" : action.status === "HIDDEN" ? "ascunsă" : action.status}
                        </Pill>
                      </td>
                      <td className={cn("pu-num py-2.5 pl-3 pr-4 text-right", action.primary && action.conversions30 === 0 ? "text-rose" : "text-foreground/90")}>{action.conversions30}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : null}
      </Section>
    </div>
  );
}
