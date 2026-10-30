import { cn } from "@/lib/utils";
import { Pill } from "../ui/primitives";
import { Spinner } from "../ui/states";
import { dateTimeRo } from "../ui/format";
import type { HistoryEntry } from "./labels";

/**
 * Istoricul din prototip (punct, ce s-a întâmplat, cine și când), cu evenimentele reale ale
 * lead-ului. Peste prototip: emailurile trimise la creare (notificarea către tine și confirmarea
 * către client), cu rezultatul fiecăruia: dacă unul a eșuat, punctul se face roșu.
 * `entries === null` înseamnă „încă vine de pe server”, nu „gol”.
 */
export function LeadHistory({ entries }: { entries: HistoryEntry[] | null }) {
  if (entries === null) {
    return <Spinner label="Se încarcă istoricul…" />;
  }
  if (entries.length === 0) {
    return <p className="text-[12.5px] text-muted-foreground">Încă nu s-a întâmplat nimic în afară de sosirea lead-ului.</p>;
  }

  return (
    <ol className="space-y-3">
      {entries.map((entry, index) => (
        <li key={entry.id} className="flex gap-2.5">
          <span className={cn("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", entry.alert ? "bg-rose" : index === 0 ? "bg-lav" : "bg-white/20")} aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-[12.5px] text-foreground/85">{entry.what}</p>
            {entry.mails && entry.mails.length > 0 ? (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {entry.mails.map((mail) => (
                  <Pill key={mail.label} tone={mail.tone} className="text-[10.5px]">
                    {mail.label}: {mail.outcome}
                  </Pill>
                ))}
              </div>
            ) : null}
            {entry.detail ? <p className="mt-0.5 break-words font-mono text-[10.5px] text-muted-foreground">{entry.detail}</p> : null}
            <p className="text-[10.5px] text-muted-foreground">
              {entry.who} · {dateTimeRo(entry.at)}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
