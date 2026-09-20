"use client";

import { useEffect, useState } from "react";
import { listVersions, restoreVersion, type EntryVersion, type VaultEntry } from "@/lib/vault/entries";
import { diffPayloads } from "@/lib/vault/diff";
import { VaultDataError, type VaultMember } from "@/lib/vault/members";
import { VaultCryptoError } from "@/lib/vault/crypto";
import { useVault } from "./vault-provider";
import { BTN_SM, BTN_SM_LIGHT, Note, countNoun, formatDate } from "./ui";

/**
 * Istoricul unei intrări (feat/vault, faza 6), în fișă, sub câmpuri.
 *
 * Se încarcă la cerere — de regulă omul vrea parola de acum, nu pe cea
 * de acum trei luni. Fiecare versiune veche e arătată ca DIFERENȚĂ față
 * de acum („Parolă: •••• → ••••", „Titlu: „A" → „B""), nu ca o a doua
 * fișă întreagă: întrebarea e „ce s-a schimbat", nu „cum arăta".
 *
 * Secretele din istoric stau mascate; „Arată secretele" le descoperă
 * pentru o versiune, 30 de secunde, cu contorul la vedere — aceeași
 * regulă ca în fișă. Restaurarea nu șterge nimic: vechiul conținut
 * devine versiunea curentă, iar cea de acum intră în istoric.
 */

const REVEAL_MS = 30 * 1000;
const MASK = "••••••••";

function describe(error: unknown): string {
  if (error instanceof VaultDataError || error instanceof VaultCryptoError) return error.message;
  return "Istoricul nu s-a putut încărca. Încearcă din nou.";
}

export function EntryHistory({
  entry,
  members,
  onRestored,
}: {
  entry: Extract<VaultEntry, { status: "ok" }>;
  members: VaultMember[] | null;
  onRestored: () => Promise<void>;
}) {
  const { supabase, keys } = useVault();
  const [open, setOpen] = useState(false);
  const [versions, setVersions] = useState<EntryVersion[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revealedUntil, setRevealedUntil] = useState<{ version: number; until: number } | null>(null);
  const [confirming, setConfirming] = useState<number | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const previous = entry.version - 1;

  // La fiecare versiune nouă a intrării (editare, restaurare), istoricul
  // deschis se reîncarcă — altfel ar arăta o listă veche.
  useEffect(() => {
    if (!open || !supabase || !keys) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    listVersions(supabase, keys, entry.id)
      .then((rows) => {
        if (!cancelled) setVersions(rows);
      })
      .catch((cause) => {
        if (!cancelled) setError(describe(cause));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, supabase, keys, entry.id, entry.version]);

  useEffect(() => {
    if (!revealedUntil) return;
    const interval = window.setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= revealedUntil.until) setRevealedUntil(null);
    }, 250);
    return () => window.clearInterval(interval);
  }, [revealedUntil]);

  const emailOf = (id: string | null) =>
    id ? (members?.find((row) => row.id === id)?.email ?? "membru eliminat") : "—";

  async function restore(version: EntryVersion) {
    if (!supabase || !keys || version.content.status !== "ok") return;
    setRestoring(true);
    setError(null);
    try {
      await restoreVersion(
        supabase,
        keys,
        { id: entry.id, version: entry.version, clientId: entry.clientId, dekId: entry.dekId },
        version.content.payload
      );
      setConfirming(null);
      await onRestored();
    } catch (cause) {
      setError(describe(cause));
    } finally {
      setRestoring(false);
    }
  }

  return (
    <div className="mt-6 border-t border-hair pt-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="eyebrow !text-[11px]">
          Istoric <span className="ml-1 normal-case tracking-normal">· v{entry.version}</span>
        </p>
        {previous === 0 ? (
          <span className="text-[12.5px] text-dim">prima versiune — nimic înainte</span>
        ) : (
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            className="text-[13px] text-dim underline-offset-4 transition-colors hover:text-bone hover:underline"
          >
            {open ? "Ascunde istoricul" : `Vezi ${countNoun(previous, "versiunea anterioară", "versiuni anterioare")}`}
          </button>
        )}
      </div>

      {open ? (
        <div className="mt-3">
          <div aria-live="polite">{error ? <Note tone="error">{error}</Note> : null}</div>
          {loading && !versions ? (
            <p className="text-[13.5px] text-dim" aria-busy="true">
              Se decriptează versiunile…
            </p>
          ) : null}
          {versions ? (
            <ol className="space-y-3">
              {versions.map((version) => {
                const revealed = revealedUntil?.version === version.version;
                const secondsLeft = revealed ? Math.max(0, Math.ceil((revealedUntil!.until - now) / 1000)) : 0;
                const changes = version.content.status === "ok" ? diffPayloads(version.content.payload, entry.payload) : [];
                const hasSecret = changes.some((change) => change.secret);
                return (
                  <li key={version.id} className="rounded-panel-sm border border-hair bg-ink/40 p-3">
                    <p className="font-md-mono text-[11px] tracking-[0.06em] text-dim">
                      <span className="text-bone">v{version.version}</span> · {formatDate(version.createdAt)} · {emailOf(version.createdBy)}
                    </p>

                    {version.content.status === "unreadable" ? (
                      <p className="mt-2 text-[13px] text-[#ff8a8a]">Versiune ilizibilă: {version.content.reason}</p>
                    ) : changes.length === 0 ? (
                      <p className="mt-2 text-[13px] text-dim">Conținut identic cu cel de acum.</p>
                    ) : (
                      <ul className="mt-2 space-y-1.5">
                        {changes.map((change, index) => (
                          <li key={index} className="text-[13px] leading-relaxed">
                            <span className="text-dim">{change.label}: </span>
                            <span className="break-all font-md-mono text-[12.5px] text-bone">
                              {change.secret && !revealed ? MASK : (change.before ?? "—")}
                            </span>
                            <span className="text-dim" role="img" aria-label="devine">
                              {" "}
                              →{" "}
                            </span>
                            <span className="break-all font-md-mono text-[12.5px] text-dim">
                              {change.secret && !revealed ? MASK : (change.after ?? "—")}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}

                    {revealed ? (
                      <p className="mt-2 font-md-mono text-[11px] tracking-[0.06em] text-[#f0b429] tabular-nums">
                        se ascund în {secondsLeft} s
                      </p>
                    ) : null}

                    {version.content.status === "ok" ? (
                      confirming === version.version ? (
                        <div className="mt-3 rounded-panel-sm border-l-[3px] border-bone/70 bg-bone/[0.06] px-3 py-2.5 text-[13px] leading-relaxed text-bone">
                          Conținutul de acum (v{entry.version}) rămâne în istoric; v{version.version} devine
                          versiunea curentă, ca v{entry.version + 1}.
                          <div className="mt-2.5 flex gap-2">
                            <button
                              type="button"
                              disabled={restoring}
                              onClick={() => void restore(version)}
                              className={BTN_SM_LIGHT}
                            >
                              {restoring ? "Se restaurează…" : `Restaurează v${version.version}`}
                            </button>
                            <button type="button" disabled={restoring} onClick={() => setConfirming(null)} className={BTN_SM}>
                              Anulează
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 font-md-mono text-[12px]">
                          {hasSecret ? (
                            <button
                              type="button"
                              onClick={() =>
                                setRevealedUntil(revealed ? null : { version: version.version, until: Date.now() + REVEAL_MS })
                              }
                              aria-pressed={revealed}
                              className="text-dim underline-offset-4 hover:text-bone hover:underline"
                            >
                              {revealed ? "Ascunde secretele" : "Arată secretele"}
                            </button>
                          ) : null}
                          {changes.length > 0 ? (
                            <button
                              type="button"
                              onClick={() => setConfirming(version.version)}
                              className="text-dim underline-offset-4 hover:text-bone hover:underline"
                            >
                              Restaurează v{version.version}
                            </button>
                          ) : null}
                        </div>
                      )
                    ) : null}
                  </li>
                );
              })}
            </ol>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
