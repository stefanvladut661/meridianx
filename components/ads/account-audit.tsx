import { BILLING_STATUS_LABEL, CHANGE_OPERATION_LABEL, CHANGE_RESOURCE_LABEL, ROLE_LABEL, accountMoney, label } from "@/lib/ads/google/account/labels";
import { bulkCreations, clientLabel } from "@/lib/ads/google/account/signals";
import type { AccountAudit as Audit, AccountCampaign, AuditBlock } from "@/lib/ads/google/account/types";
import { countOf } from "@/lib/ads/plan-derive";
import { cn } from "@/lib/utils";
import { ERROR_DOT, ERROR_TEXT, OK_TEXT, WARNING_DOT, WARNING_TEXT } from "./tone";

/**
 * Auditul unui cont preluat — doar citire. Sus, semnalele; dedesubt, fiecare
 * bloc citit separat (un bloc pe care cheia nu-l poate citi spune de ce, iar
 * restul rămân): cine a schimbat ce în ultimele 30 de zile, cine are acces,
 * facturarea, acțiunile de conversie.
 */

const ACCOUNT_BUDGET_STATUS_LABEL: Record<string, string> = { APPROVED: "aprobat", PENDING: "în așteptare", CANCELLED: "anulat" };

const dateTime = new Intl.DateTimeFormat("ro-RO", { dateStyle: "medium", timeStyle: "short" });
function when(value: string | null): string {
  if (!value) return "—";
  const parsed = new Date(value.replace(" ", "T"));
  return Number.isNaN(parsed.getTime()) ? value : dateTime.format(parsed);
}

function Unreadable({ block }: { block: AuditBlock<unknown> }) {
  if (block.ok) return null;
  return <p className="mt-3 rounded-panel border border-hair px-4 py-3 text-[14px] leading-relaxed text-bone/75">{block.message}</p>;
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="border-t border-hair pt-8">
      <h3 id={id} className="eyebrow !text-[11.5px] !text-bone">
        {title}
      </h3>
      {children}
    </section>
  );
}

export function AccountAudit({ audit, currency, campaigns }: { audit: Audit; currency: string; campaigns: AccountCampaign[] }) {
  const names = new Map(campaigns.map((item) => [item.id, item.name]));
  const waves = audit.changes.ok ? bulkCreations(audit.changes.data.items).slice(0, 8) : [];

  return (
    <div className="space-y-10">
      <section aria-labelledby="semnale" className="rounded-panel-lg border border-hair bg-char/60 px-5 py-5 sm:px-6">
        <h3 id="semnale" className="eyebrow !text-[11.5px] !text-bone">
          Semnale · {audit.signals.length}
        </h3>
        {audit.signals.length === 0 ? (
          <p className={cn("mt-3 text-[14.5px]", OK_TEXT)}>Nimic ieșit din comun în ce se poate citi.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {audit.signals.map((signal, index) => (
              <li key={index} className="flex gap-3 text-[14.5px] leading-snug text-bone/90">
                <span aria-hidden className={cn("mt-[7px] h-2 w-2 shrink-0 rounded-full", signal.tone === "error" ? ERROR_DOT : WARNING_DOT)} />
                <span>
                  <span className="sr-only">{signal.tone === "error" ? "Problemă: " : "De verificat: "}</span>
                  {signal.message}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Section id="modificari" title="Cine a schimbat ce — ultimele 30 de zile">
        <Unreadable block={audit.changes} />
        {audit.changes.ok ? (
          <>
            <p className="mt-3 text-[14px] text-bone/80">
              {countOf(audit.changes.data.items.length, "modificări")} între {audit.changes.data.from} și {audit.changes.data.to}
              {audit.changes.data.truncated ? " — doar cele mai noi 10.000, limita Google pe o citire" : ""}. Google păstrează istoricul
              detaliat 30 de zile; modificările din Google Ads Editor nu apar aici.
            </p>
            {waves.length > 0 ? (
              <ul className="mt-4 space-y-1.5 text-[14.5px]">
                {waves.map((wave) => (
                  <li key={`${wave.user}-${wave.day}-${wave.client}`} className={wave.count >= 5 ? WARNING_TEXT : "text-bone/85"}>
                    {wave.count === 1 ? "O campanie creată" : `${countOf(wave.count, "campanii")} create`} de {wave.user} pe {wave.day}, din {clientLabel(wave.client)}
                  </li>
                ))}
              </ul>
            ) : null}
            {audit.changes.data.items.length > 0 ? (
              <details className="group mt-4">
                <summary className="cursor-pointer list-none text-[14px] font-semibold text-bone underline-offset-4 hover:underline">
                  <span aria-hidden className="mr-2 inline-block transition-transform duration-150 group-open:rotate-90">
                    ›
                  </span>
                  Toate modificările, cele mai noi primele
                </summary>
                <div className="mt-3 max-h-[32rem] overflow-auto rounded-panel-lg border border-hair">
                  <table className="w-full min-w-[720px] border-collapse text-left text-[13px]">
                    <caption className="sr-only">Modificările din cont în ultimele 30 de zile</caption>
                    <thead className="sticky top-0 bg-char font-md-mono text-[11px] uppercase tracking-[0.12em] text-dim">
                      <tr>
                        <th scope="col" className="px-3 py-2.5 font-normal">Când</th>
                        <th scope="col" className="px-3 py-2.5 font-normal">Cine</th>
                        <th scope="col" className="px-3 py-2.5 font-normal">Ce</th>
                        <th scope="col" className="px-3 py-2.5 font-normal">Campania</th>
                        <th scope="col" className="px-3 py-2.5 font-normal">De unde</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-hair">
                      {audit.changes.data.items.slice(0, 500).map((change, index) => (
                        <tr key={index}>
                          <td className="whitespace-nowrap px-3 py-2 font-md-mono text-[12px] text-dim">{when(change.at)}</td>
                          <td className="px-3 py-2 text-bone/85">{change.user ?? "—"}</td>
                          <td className="px-3 py-2 text-bone/85">
                            {label(CHANGE_OPERATION_LABEL, change.operation)} {label(CHANGE_RESOURCE_LABEL, change.resource)}
                            {change.fields ? <span className="block font-md-mono text-[11px] text-dim">{change.fields}</span> : null}
                          </td>
                          <td className="px-3 py-2 text-bone/85">{change.campaign ? (names.get(change.campaign) ?? change.campaign) : "—"}</td>
                          <td className="px-3 py-2 text-dim">{clientLabel(change.client)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            ) : null}
          </>
        ) : null}
      </Section>

      <Section id="utilizatori" title="Cine are acces">
        <Unreadable block={audit.users} />
        {audit.users.ok ? (
          <ul className="mt-3 divide-y divide-hair rounded-panel-lg border border-hair">
            {audit.users.data.map((user) => (
              <li key={`${user.email}-${user.pending}`} className="grid gap-x-6 gap-y-1 px-4 py-3 text-[14px] sm:grid-cols-[minmax(0,1fr)_auto]">
                <span className="min-w-0 break-all text-bone">{user.email}</span>
                <span className={cn("text-[13px]", user.role === "ADMIN" ? "text-bone" : "text-dim")}>
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
            <p className="mt-3 text-[14px] text-bone/75">
              Google nu întoarce nicio configurare de facturare prin API — de obicei la conturile plătite automat cu cardul. Verifică în Google Ads
              → Facturare.
            </p>
          ) : (
            <ul className="mt-3 space-y-2 text-[14px] text-bone/85">
              {audit.billing.data.setups.map((setup) => (
                <li key={setup.id}>
                  Configurarea {setup.id}:{" "}
                  <span className={setup.status === "APPROVED" ? OK_TEXT : WARNING_TEXT}>{label(BILLING_STATUS_LABEL, setup.status)}</span>
                  {setup.account ? ` · ${setup.account}` : ""}
                  {setup.profile ? ` · ${setup.profile}` : ""} · {when(setup.start)} → {setup.end ? when(setup.end) : "fără sfârșit"}
                </li>
              ))}
              {audit.billing.data.budgets.map((budget, index) => (
                <li key={index}>
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
            <p className={cn("mt-3 text-[14px]", WARNING_TEXT)}>Nicio acțiune de conversie: campaniile nu văd lead-urile.</p>
          ) : (
            <div className="mt-3 overflow-x-auto rounded-panel-lg border border-hair">
              <table className="w-full min-w-[640px] border-collapse text-left text-[13.5px]">
                <caption className="sr-only">Acțiunile de conversie ale contului</caption>
                <thead className="bg-char/80 font-md-mono text-[11px] uppercase tracking-[0.12em] text-dim">
                  <tr>
                    <th scope="col" className="px-3 py-2.5 font-normal">Acțiunea</th>
                    <th scope="col" className="px-3 py-2.5 font-normal">Tipul · categoria</th>
                    <th scope="col" className="px-3 py-2.5 font-normal">Rolul</th>
                    <th scope="col" className="px-3 py-2.5 font-normal">Starea</th>
                    <th scope="col" className="px-3 py-2.5 text-right font-normal">Conversii · 30 z</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hair">
                  {audit.conversions.data.map((action) => (
                    <tr key={action.id}>
                      <th scope="row" className="px-3 py-2 font-normal text-bone">
                        {action.name}
                        <span className="block font-md-mono text-[11px] text-dim">{action.id}</span>
                      </th>
                      <td className="px-3 py-2 text-bone/80">
                        {action.type} · {action.category}
                      </td>
                      <td className="px-3 py-2 text-bone/80">{action.primary ? "principală" : "secundară"}</td>
                      <td className="px-3 py-2 text-bone/80">{action.status === "ENABLED" ? "activă" : action.status === "HIDDEN" ? "ascunsă" : action.status}</td>
                      <td className={cn("px-3 py-2 text-right tabular-nums", action.primary && action.conversions30 === 0 ? ERROR_TEXT : "text-bone/90")}>
                        {action.conversions30}
                      </td>
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
