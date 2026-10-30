"use client";

import { useEffect, useState } from "react";
import { History } from "lucide-react";
import { diffPayloads } from "@/lib/vault/diff";
import type { EntryVersion, VaultEntry } from "@/lib/vault/entries";
import { ConfirmDialog, InlineNote } from "@/components/panou/ui/actions";
import { Spinner } from "@/components/panou/ui/states";
import { useToast } from "@/components/panou/ui/toast";
import { dateTimeRo } from "@/components/panou/ui/format";
import { describeError } from "./errors";

/**
 * Istoricul unei intrări, în fișă (lista „Istoric versiuni” din prototip).
 *
 * Peste prototip: fiecare versiune veche e arătată ca DIFERENȚĂ față de acum
 * („atunci → acum”), nu ca o a doua fișă întreagă, iar secretele din diferențe
 * stau mascate; „Arată secretele” le descoperă 30 s, cu contor, ca în fișă.
 * Se încarcă doar la cerere. Restaurarea scrie o versiune NOUĂ: nimic nu se pierde.
 */

type OkEntry = Extract<VaultEntry, { status: "ok" }>;

export interface HistoryApi {
  listVersions: (entryId: string) => Promise<EntryVersion[]>;
  restoreVersion: (entry: OkEntry, version: EntryVersion) => Promise<void>;
}

const REVEAL_MS = 30 * 1000;
const MASK = "••••••••";

const LINK_BUTTON = "shrink-0 rounded border border-white/[0.1] px-1.5 py-0.5 text-[10px] text-muted-foreground hover:text-foreground";

export function EntryHistory({
  entry,
  api,
  emailOf,
  onRestored,
}: {
  entry: OkEntry;
  api: HistoryApi;
  emailOf: (id: string | null) => string;
  onRestored: () => Promise<void>;
}) {
  const { notify } = useToast();
  const [open, setOpen] = useState(false);
  const [versions, setVersions] = useState<EntryVersion[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<{ version: number; until: number } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [restoring, setRestoring] = useState<EntryVersion | null>(null);

  const previous = entry.version - 1;

  // La fiecare versiune nouă a intrării (editare, restaurare), istoricul deschis se reîncarcă.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .listVersions(entry.id)
      .then((rows) => {
        if (!cancelled) setVersions(rows);
      })
      .catch((cause) => {
        if (!cancelled) setError(describeError(cause, "Istoricul nu s-a putut încărca. Încearcă din nou."));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, api, entry.id, entry.version]);

  useEffect(() => {
    if (!revealed) return;
    const interval = window.setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= revealed.until) setRevealed(null);
    }, 250);
    return () => window.clearInterval(interval);
  }, [revealed]);

  async function restore(version: EntryVersion) {
    try {
      await api.restoreVersion(entry, version);
      await onRestored();
      notify("Versiune restaurată. S-a creat o versiune nouă, nimic nu s-a pierdut.");
    } catch (cause) {
      setError(describeError(cause, "Restaurarea a eșuat. Încearcă din nou."));
    }
  }

  return (
    <div className="border-t border-white/[0.06] px-4 py-2.5">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        disabled={previous === 0}
        className="inline-flex items-center gap-1.5 text-[11.5px] text-muted-foreground hover:text-foreground disabled:cursor-default disabled:hover:text-muted-foreground"
      >
        <History className="h-3.5 w-3.5" aria-hidden="true" /> Istoric versiuni ({previous})
        {previous === 0 ? <span className="text-muted-foreground/70">· prima versiune, nimic înainte</span> : null}
      </button>

      {open ? (
        <div className="mt-2">
          {error ? <InlineNote tone="rose" className="mb-2">{error}</InlineNote> : null}
          {loading && !versions ? <Spinner label="Se decriptează versiunile" /> : null}
          {versions ? (
            <>
              <p className="mb-2 text-[10.5px] text-muted-foreground">Fiecare versiune apare ca diferență față de cea de acum: „atunci → acum”.</p>
              <ol className="space-y-2">
                {versions.map((version) => {
                  const shown = revealed?.version === version.version;
                  const left = shown && revealed ? Math.max(0, Math.ceil((revealed.until - now) / 1000)) : 0;
                  const ok = version.content.status === "ok" ? version.content.payload : null;
                  const changes = ok ? diffPayloads(ok, entry.payload) : [];
                  const hasSecret = changes.some((change) => change.secret);
                  return (
                    <li key={version.id} className="border-b border-white/[0.04] pb-2 last:border-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-[11.5px]">
                            <span className="pu-num font-mono">v{version.version}</span>
                            <span className="text-muted-foreground">
                              {" "}
                              ·{" "}
                              {version.content.status === "unreadable"
                                ? "ilizibilă"
                                : changes.length === 0
                                  ? "identică cu cea de acum"
                                  : `${changes.length} ${changes.length === 1 ? "diferență" : "diferențe"}`}
                            </span>
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {emailOf(version.createdBy)} · {dateTimeRo(version.createdAt)}
                          </p>
                        </div>
                        {ok && changes.length > 0 ? (
                          <button type="button" onClick={() => setRestoring(version)} className={LINK_BUTTON}>
                            Restaurează
                          </button>
                        ) : null}
                      </div>

                      {version.content.status === "unreadable" ? (
                        <p className="mt-1.5 text-[11px] text-rose">Versiune ilizibilă: {version.content.reason}</p>
                      ) : changes.length > 0 ? (
                        <ul className="mt-1.5 space-y-1">
                          {changes.map((change, index) => (
                            <li key={index} className="text-[11px] leading-relaxed">
                              <span className="text-muted-foreground">{change.label}: </span>
                              <span className="break-all font-mono text-foreground/85">{change.secret && !shown ? MASK : (change.before ?? "—")}</span>
                              <span className="text-muted-foreground" role="img" aria-label="devine">
                                {" "}
                                →{" "}
                              </span>
                              <span className="break-all font-mono text-muted-foreground">{change.secret && !shown ? MASK : (change.after ?? "—")}</span>
                            </li>
                          ))}
                        </ul>
                      ) : null}

                      {hasSecret ? (
                        <div className="mt-1.5 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setRevealed(shown ? null : { version: version.version, until: Date.now() + REVEAL_MS })}
                            aria-pressed={shown}
                            className={LINK_BUTTON}
                          >
                            {shown ? "Ascunde secretele" : "Arată secretele"}
                          </button>
                          {shown ? <span className="text-[10px] text-apricot">se ascund singure în {left}s</span> : null}
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ol>
            </>
          ) : null}
        </div>
      ) : null}

      <ConfirmDialog
        open={restoring !== null}
        onOpenChange={(value) => !value && setRestoring(null)}
        tone="primary"
        title={`Restaurezi v${restoring?.version ?? ""}?`}
        description="Conținutul de acum rămâne în istoric. Versiunea aleasă devine versiunea curentă, ca una nouă."
        confirmLabel={`Restaurează v${restoring?.version ?? ""}`}
        onConfirm={async () => {
          if (restoring) await restore(restoring);
        }}
      />
    </div>
  );
}
