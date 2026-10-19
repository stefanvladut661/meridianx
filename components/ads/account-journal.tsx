import type { AccountChange } from "@/lib/ads/changes";
import { STORE_FAILURE_MESSAGE, type StoreResult } from "@/lib/ads/store";

/**
 * Jurnalul portalului pe contul ăsta (migrarea 10): ce a pus pe pauză, ce
 * negative a adăugat, ce liste a legat, ce acțiuni de conversie a creat — cine
 * și când. Doar portalul scrie aici; modificările din Google Ads sunt la Audit.
 */

const dateTime = new Intl.DateTimeFormat("ro-RO", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Bucharest" });

export function AccountJournal({ journal }: { journal: StoreResult<AccountChange[]> }) {
  return (
    <section aria-labelledby="jurnal" className="border-t border-hair pt-8">
      <h2 id="jurnal" className="eyebrow">
        Ce a făcut portalul în contul ăsta
      </h2>
      {!journal.ok ? (
        <p className="mt-3 text-[14px] text-bone/70">{STORE_FAILURE_MESSAGE[journal.reason]}</p>
      ) : journal.data.length === 0 ? (
        <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-bone/70">
          Nimic încă. Fiecare pauză, negativ sau acțiune de conversie trimisă din portal apare aici, cu cine și când.
        </p>
      ) : (
        <ol className="mt-3 divide-y divide-hair rounded-panel-lg border border-hair">
          {journal.data.map((entry) => (
            <li key={entry.id} className="grid gap-x-6 gap-y-1 px-4 py-3 text-[14px] sm:grid-cols-[minmax(0,1fr)_auto]">
              <span className="text-bone">{entry.summary}</span>
              <span className="font-md-mono text-[12px] text-dim">
                {dateTime.format(new Date(entry.createdAt))}
                {entry.createdByEmail ? ` · ${entry.createdByEmail}` : ""} · {entry.operations} op.
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
