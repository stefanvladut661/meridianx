import { Target } from "lucide-react";
import { CATEGORY_LABEL, CONVERSION_TYPE_LABEL, COUNTING_LABEL, sendToText } from "@/lib/ads/google/conversions/standard";
import type { ConversionActionInfo } from "@/lib/ads/google/conversions/types";
import { CopyButton } from "@/components/panou/ui/actions";
import { Card, Pill, type PillTone } from "@/components/panou/ui/primitives";
import { EmptyState } from "@/components/panou/ui/states";
import { cn } from "@/lib/utils";

/**
 * Acțiunile de conversie ale contului, ca în redesign (nume, sursă, Pill de
 * stare), cu ce adaugă contul real: tipul și categoria, ce numără, ferestrele
 * și eticheta AW-…/… (sau id-ul, la apelul din anunț) cu copiere. Doar citire.
 */

const days = (value: number | null) => (value === null ? null : `${value} ${value === 1 ? "zi" : "zile"}`);

function stateOf(status: string): { tone: PillTone; label: string } {
  if (status === "ENABLED") return { tone: "mint", label: "Activă" };
  if (status === "HIDDEN") return { tone: "neutral", label: "Ascunsă" };
  return { tone: "apricot", label: status.toLowerCase() };
}

export function ConversiiLista({ actions }: { actions: ConversionActionInfo[] }) {
  return (
    <Card className="overflow-hidden p-0">
      <div className="flex items-center justify-between gap-2 border-b border-white/[0.06] px-4 py-3">
        <h2 className="text-[13.5px] font-medium">Acțiuni de conversie</h2>
        <Pill tone="neutral">{actions.length}</Pill>
      </div>
      {actions.length === 0 ? (
        <EmptyState
          icon={Target}
          title="Contul n-are nicio acțiune de conversie"
          text="Campaniile n-au după ce să se optimizeze. Creează-le pe cele standard, în cardul de mai jos: apel din anunț, clic pe telefon, formular."
        />
      ) : (
        <ul className="divide-y divide-white/[0.05]">
          {actions.map((action) => {
            const state = stateOf(action.status);
            const sendTo = action.sendTo ? sendToText(action.sendTo) : null;
            return (
              <li key={action.id} className={cn("px-4 py-3", action.status !== "ENABLED" && "opacity-60")}>
                <div className="flex flex-wrap items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-[12.5px] [overflow-wrap:anywhere]">{action.name}</p>
                    <p className="text-[10.5px] text-muted-foreground">
                      {CONVERSION_TYPE_LABEL[action.type] ?? action.type} · {CATEGORY_LABEL[action.category] ?? action.category} · {action.primary ? "principală" : "secundară"}
                    </p>
                  </div>
                  <Pill tone={state.tone} dot>
                    {state.label}
                  </Pill>
                </div>
                <dl className="mt-2 grid gap-x-4 gap-y-1 text-[10.5px] sm:grid-cols-2">
                  <div className="flex gap-1.5">
                    <dt className="uppercase tracking-[0.12em] text-muted-foreground/70">Numără</dt>
                    <dd className="text-foreground/75">
                      {action.counting ? (COUNTING_LABEL[action.counting] ?? action.counting) : "—"}
                      {action.callSeconds !== null ? ` · apel ≥ ${action.callSeconds} s` : ""}
                    </dd>
                  </div>
                  <div className="flex gap-1.5">
                    <dt className="uppercase tracking-[0.12em] text-muted-foreground/70">Fereastra</dt>
                    <dd className="text-foreground/75">
                      {days(action.clickWindowDays) ?? "—"} după clic{action.viewWindowDays !== null ? ` · ${days(action.viewWindowDays)} după afișare` : ""}
                    </dd>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 sm:col-span-2">
                    <dt className="uppercase tracking-[0.12em] text-muted-foreground/70">{sendTo ? "Eticheta" : "Id"}</dt>
                    <dd className="flex flex-wrap items-center gap-1.5">
                      <code className="font-mono text-[11px] text-foreground/85 [overflow-wrap:anywhere]">{sendTo ?? action.id}</code>
                      {sendTo || action.type === "AD_CALL" ? <CopyButton value={sendTo ?? action.id} label="Copiază" size="xs" variant="ghost" /> : null}
                    </dd>
                  </div>
                </dl>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
