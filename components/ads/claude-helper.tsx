"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { countOf } from "@/lib/ads/plan-derive";
import type { WorkspaceSummary } from "@/lib/ads/workspaces";
import { cn } from "@/lib/utils";
import { ERROR_TEXT, FIELD, LABEL, OK_TEXT } from "./tone";

/**
 * /admin/ads/claude — puntea dintre portal și conversația în care se scriu
 * planurile.
 *
 * Trei lucruri de copiat: instrucțiunile (formatul, regulile, exemplele —
 * aceleași cu validarea), contextul conturilor (id-urile citite acum din
 * platforme) sau amândouă odată. Răspunsul conversației se lipește în
 * „Lot" (mai multe campanii) sau în „Plan nou" (una).
 */

type ContextState =
  | { status: "idle" }
  | { status: "done"; text: string; summary: Summary[]; at: string }
  | { status: "failed"; message: string };

interface Summary {
  workspaceId: string;
  name: string;
  accounts: number;
  identities: number;
  conversions: number;
  videos: number;
  notes: string[];
}

const TIKTOK_KEY = "meridian_ads_tiktok_accounts";

/** „1 cont · 2 pagini · 4 pixeli · 5 video-uri" — doar ce are sens pe platforma spațiului. */
function summaryLine(item: Summary): string {
  const plural = (count: number, one: string, many: string) => (count === 1 ? `1 ${one}` : countOf(count, many));
  const platform = item.workspaceId.split("-")[0];
  const parts = [plural(item.accounts, "cont", "conturi")];
  if (platform === "meta") parts.push(plural(item.identities, "pagină", "pagini"), plural(item.conversions, "pixel", "pixeli"));
  if (platform === "tiktok") parts.push(plural(item.identities, "identitate", "identități"), plural(item.conversions, "pixel", "pixeli"));
  if (platform === "google") parts.push(plural(item.conversions, "conversie", "conversii"));
  parts.push(plural(item.videos, "video", "video-uri"));
  return parts.join(" · ");
}

export function ClaudeHelper({
  brief,
  workspaces,
  currentWorkspaceId,
  knownTikTok,
  readContext,
}: {
  brief: string;
  workspaces: WorkspaceSummary[];
  currentWorkspaceId: string;
  /** Conturile TikTok folosite deja, pe spațiu — tokenul TikTok nu le poate lista singur. */
  knownTikTok: Record<string, string[]>;
  readContext: (input: {
    screenWorkspace: string;
    tiktokAccounts: Record<string, string[]>;
  }) => Promise<{ ok: true; text: string; summary: Summary[] } | { ok: false; message: string }>;
}) {
  const current = workspaces.find((workspace) => workspace.id === currentWorkspaceId) ?? workspaces[0];
  const own = workspaces.filter((workspace) => workspace.owner === current.owner);
  const tiktokSpaces = own.filter((workspace) => workspace.platform === "tiktok");

  const [tiktok, setTiktok] = useState<Record<string, string>>(() =>
    Object.fromEntries(tiktokSpaces.map((workspace) => [workspace.id, (knownTikTok[workspace.id] ?? []).join(", ")]))
  );
  const [context, setContext] = useState<ContextState>({ status: "idle" });
  const [copied, setCopied] = useState<"brief" | "context" | "all" | null>(null);
  const [pending, start] = useTransition();

  // Conturile TikTok scrise o dată rămân în browserul ăsta (nu sunt secrete, doar comode).
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(TIKTOK_KEY) ?? "{}") as Record<string, string>;
      setTiktok((previous) => {
        const next = { ...previous };
        for (const [id, value] of Object.entries(saved)) if (id in next && value && !next[id]) next[id] = value;
        return next;
      });
    } catch {
      /* fără stocare */
    }
  }, []);

  const read = () => {
    try {
      localStorage.setItem(TIKTOK_KEY, JSON.stringify(tiktok));
    } catch {
      /* fără stocare */
    }
    start(async () => {
      try {
        const result = await readContext({
          screenWorkspace: current.id,
          tiktokAccounts: Object.fromEntries(
            Object.entries(tiktok).map(([id, value]) => [id, value.split(/[\s,]+/).filter(Boolean)])
          ),
        });
        setContext(
          result.ok
            ? { status: "done", text: result.text, summary: result.summary, at: new Date().toISOString() }
            : { status: "failed", message: result.message }
        );
      } catch {
        setContext({ status: "failed", message: "Serverul n-a răspuns. Încearcă din nou." });
      }
    });
  };

  const copy = async (what: "brief" | "context" | "all") => {
    const contextText = context.status === "done" ? context.text : "";
    const value = what === "brief" ? brief : what === "context" ? contextText : [brief, contextText].filter(Boolean).join("\n\n");
    try {
      await navigator.clipboard.writeText(value);
      setCopied(what);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      setCopied(null);
    }
  };

  const configured = own.filter((workspace) => workspace.tokenConfigured);

  return (
    <div className="space-y-10">
      <ol className="grid gap-4 md:grid-cols-3">
        {[
          ["Copiază", "Instrucțiunile și contextul conturilor, cu un clic. Le lipești la începutul conversației cu Claude."],
          ["Descrie", "Clientul, oferta, publicul, bugetul și platformele. Claude răspunde cu un lot de planuri, în JSON."],
          ["Lipește", "Lotul în „Lot”: portalul îl verifică pe conturile reale și creează campaniile oprite. Problemele se copiază înapoi la Claude."],
        ].map(([title, body], index) => (
          <li key={title} className="rounded-panel-lg border border-hair bg-char/50 px-5 py-4">
            <p className="font-md-mono text-[11.5px] tabular-nums text-dim">{String(index + 1).padStart(2, "0")}</p>
            <p className="mt-1 font-md-display text-[1.125rem] font-semibold text-bone">{title}</p>
            <p className="mt-1.5 text-[14px] leading-relaxed text-bone/75">{body}</p>
          </li>
        ))}
      </ol>

      <section aria-labelledby="claude-brief" className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 id="claude-brief" className="eyebrow">
            Instrucțiunile pentru Claude
          </h2>
          <p className="font-md-mono text-[11px] text-dim">{Math.round(brief.length / 1000)} mii de caractere · aceleași reguli ca validarea</p>
        </div>
        <details className="group rounded-panel-lg border border-hair bg-ink/40">
          <summary className="cursor-pointer list-none px-5 py-3 text-[14px] text-bone/85 hover:text-bone [&::-webkit-details-marker]:hidden">
            <span aria-hidden className="mr-2 inline-block transition-transform duration-150 group-open:rotate-90">
              ›
            </span>
            Citește instrucțiunile
          </summary>
          <pre className="max-h-[32rem] overflow-auto whitespace-pre-wrap border-t border-hair px-5 py-4 font-md-mono text-[12px] leading-relaxed text-bone/80">
            {brief}
          </pre>
        </details>
        <button type="button" onClick={() => copy("brief")} className="btn btn-ghost !min-h-10 !px-4 !py-2 !text-[13px]">
          {copied === "brief" ? "Copiat" : "Copiază instrucțiunile"}
        </button>
      </section>

      <section aria-labelledby="claude-context" className="space-y-4">
        <h2 id="claude-context" className="eyebrow">
          Contextul conturilor · {current.owner === "clienti" ? "Clienți" : "Meridian"}
        </h2>
        <p className="max-w-2xl text-[14.5px] leading-relaxed text-bone/75">
          Conturile, paginile, pixelii sau conversiile, identitățile și video-urile pe care le poate folosi un plan, citite acum
          din platforme. Claude folosește doar id-urile de aici — nu le inventează.
        </p>
        <ul className="flex flex-wrap gap-2 text-[13px]">
          {own.map((workspace) => (
            <li
              key={workspace.id}
              className={cn(
                "rounded-full border px-3 py-1",
                workspace.tokenConfigured ? "border-hair-strong text-bone/85" : "border-dashed border-hair text-dim"
              )}
            >
              {workspace.name}
              {workspace.tokenConfigured ? "" : " · fără token"}
            </li>
          ))}
        </ul>
        {tiktokSpaces.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {tiktokSpaces.map((workspace) => (
              <div key={workspace.id}>
                <label htmlFor={`tt-${workspace.id}`} className={LABEL}>
                  {workspace.name} · advertiser_id
                </label>
                <input
                  id={`tt-${workspace.id}`}
                  type="text"
                  inputMode="numeric"
                  value={tiktok[workspace.id] ?? ""}
                  onChange={(event) => setTiktok((previous) => ({ ...previous, [workspace.id]: event.target.value }))}
                  placeholder="7000000000000000001, …"
                  spellCheck={false}
                  className={cn(FIELD, "mt-1.5 h-11 font-md-mono text-[13.5px]")}
                />
                <p className="mt-1.5 text-[12.5px] leading-snug text-dim">TikTok nu lasă tokenul să-și listeze conturile — scrie-le o dată, rămân aici.</p>
              </div>
            ))}
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={read}
            disabled={pending || configured.length === 0}
            className="btn btn-light disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? "Se citesc conturile…" : context.status === "done" ? "Citește din nou" : "Citește conturile"}
          </button>
          <button
            type="button"
            onClick={() => copy("context")}
            disabled={context.status !== "done"}
            className="btn btn-ghost disabled:cursor-not-allowed disabled:opacity-45"
          >
            {copied === "context" ? "Copiat" : "Copiază contextul"}
          </button>
          {context.status === "done" ? (
            <button type="button" onClick={() => copy("all")} className="btn btn-light">
              {copied === "all" ? "Copiat" : "Copiază tot: instrucțiuni + context"}
            </button>
          ) : null}
        </div>
        <div aria-live="polite" className="space-y-3">
          {configured.length === 0 ? (
            <p className="text-[14px] text-dim">
              Niciun spațiu al proprietarului ăstuia nu are token încă. Instrucțiunile merg oricum; id-urile i le dai tu lui Claude.
            </p>
          ) : null}
          {context.status === "failed" ? <p className={cn("text-[14px]", ERROR_TEXT)}>{context.message}</p> : null}
          {context.status === "done" ? (
            <>
              <p className={cn("text-[14px]", OK_TEXT)}>
                Citit la {new Intl.DateTimeFormat("ro-RO", { hour: "2-digit", minute: "2-digit" }).format(new Date(context.at))}.
              </p>
              <ul className="grid gap-3 sm:grid-cols-2">
                {context.summary.map((item) => (
                  <li key={item.workspaceId} className="rounded-panel border border-hair bg-ink/40 px-4 py-3 text-[13.5px] leading-snug">
                    <p className="font-semibold text-bone">{item.name}</p>
                    <p className="mt-1 text-bone/75">{summaryLine(item)}</p>
                    {item.notes.map((note) => (
                      <p key={note} className="mt-1.5 text-dim">
                        {note}
                      </p>
                    ))}
                  </li>
                ))}
              </ul>
              <details className="group rounded-panel-lg border border-hair bg-ink/40">
                <summary className="cursor-pointer list-none px-5 py-3 text-[14px] text-bone/85 hover:text-bone [&::-webkit-details-marker]:hidden">
                  <span aria-hidden className="mr-2 inline-block transition-transform duration-150 group-open:rotate-90">
                    ›
                  </span>
                  Vezi contextul
                </summary>
                <pre className="max-h-[28rem] overflow-auto whitespace-pre-wrap border-t border-hair px-5 py-4 font-md-mono text-[12px] leading-relaxed text-bone/80">
                  {context.text}
                </pre>
              </details>
            </>
          ) : null}
        </div>
      </section>

      <section aria-labelledby="claude-back" className="rounded-panel-lg border border-hair bg-char/50 px-5 py-5 sm:px-6">
        <h2 id="claude-back" className="font-md-display text-[1.125rem] font-semibold text-bone">
          Când răspunde Claude
        </h2>
        <p className="mt-2 max-w-2xl text-[14.5px] leading-relaxed text-bone/75">
          Mai multe campanii (un JSON cu „plans”) se lipesc în{" "}
          <Link href="/admin/ads/lot" className="text-bone underline underline-offset-4">
            Lot
          </Link>
          ; o singură campanie, în{" "}
          <Link href="/admin/ads/nou" className="text-bone underline underline-offset-4">
            Plan nou
          </Link>
          . Ce nu trece verificarea se copiază înapoi cu „Copiază problemele pentru Claude”.
        </p>
      </section>
    </div>
  );
}
