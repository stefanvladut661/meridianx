"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { ListChecks, Loader2, RefreshCw, ShieldCheck, Sparkles } from "lucide-react";
import { countOf } from "@/lib/ads/plan-derive";
import type { WorkspaceSummary } from "@/lib/ads/workspaces";
import { cn } from "@/lib/utils";
import { CopyButton } from "../ui/actions";
import { Info } from "../ui/info";
import { Btn, btnClass, Card, Pill, SectionTitle } from "../ui/primitives";
import { Field } from "../ui/states";
import { TextInput } from "../ui/select";
import { PAGE_TITLE } from "./tone";
import { WorkspacePicker } from "./workspace-picker";

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
  campaigns: number;
  negativeLists: number;
  notes: string[];
}

const TIKTOK_KEY = "meridian_ads_tiktok_accounts";

const plural = (count: number, one: string, many: string) => (count === 1 ? `1 ${one}` : countOf(count, many));

/** „1 cont · 2 pagini” — conturile și identitățile, doar ce are sens pe platforma spațiului. */
function accountsLine(item: Summary): string {
  const platform = item.workspaceId.split("-")[0];
  const parts = [plural(item.accounts, "cont", "conturi")];
  if (platform === "meta") parts.push(plural(item.identities, "pagină", "pagini"));
  if (platform === "tiktok") parts.push(plural(item.identities, "identitate", "identități"));
  return parts.join(" · ");
}

/** Pixelii (Meta, TikTok) sau conversiile (Google). */
function conversionsLine(item: Summary): string {
  return item.workspaceId.startsWith("google") ? plural(item.conversions, "conversie", "conversii") : plural(item.conversions, "pixel", "pixeli");
}

export function ClaudeHelper({
  brief,
  workspaces,
  currentWorkspaceId,
  knownTikTok,
  readContext,
  chooseWorkspace,
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
  /** Schimbă spațiul de lucru (cookie); spațiul nu mai are bară sus, deci îl alege ecranul. */
  chooseWorkspace?: (formData: FormData) => Promise<void>;
}) {
  const current = workspaces.find((workspace) => workspace.id === currentWorkspaceId) ?? workspaces[0];
  const own = workspaces.filter((workspace) => workspace.owner === current.owner);
  const tiktokSpaces = own.filter((workspace) => workspace.platform === "tiktok");

  const [tiktok, setTiktok] = useState<Record<string, string>>(() =>
    Object.fromEntries(tiktokSpaces.map((workspace) => [workspace.id, (knownTikTok[workspace.id] ?? []).join(", ")]))
  );
  const [context, setContext] = useState<ContextState>({ status: "idle" });
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

  const contextText = context.status === "done" ? context.text : "";
  const all = [brief, contextText].filter(Boolean).join("\n\n");
  const configured = own.filter((workspace) => workspace.tokenConfigured);
  const summary = context.status === "done" ? context.summary : [];
  const googleItems = summary.filter((item) => item.workspaceId.startsWith("google"));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-2">
          <h1 className={PAGE_TITLE}>Pentru Claude</h1>
          <Info>Lipește tot în conversație înainte să ceri planurile: formatul (și cel de căutare Google), regulile platformelor și id-urile reale.</Info>
        </div>
        <div className="flex flex-col items-start gap-1.5 sm:items-end">
          <CopyButton value={all} label="Copiază tot" copiedLabel="Copiat" variant="primary" size="md" />
          <p className="text-[13px] text-muted-foreground">
            {context.status === "done" ? "Instrucțiuni + context" : "Doar instrucțiunile · context necitit"}
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card id="claude-brief">
          <SectionTitle
            title="Instrucțiunile"
            info="Lipește-le ca atare. Aceleași reguli ca validarea din portal."
            action={<Pill tone="lav">{Math.max(1, Math.round(brief.length / 1000))} mii de caractere</Pill>}
          />
          <pre
            tabIndex={0}
            aria-label="Instrucțiunile pentru Claude"
            className="mt-3 max-h-[520px] overflow-auto whitespace-pre-wrap rounded-xl border border-white/[0.07] bg-[#0A0A0E] p-3.5 font-mono text-[12.5px] leading-relaxed text-foreground/80"
          >
            {brief}
          </pre>
          <div className="mt-3">
            <CopyButton value={brief} label="Copiază instrucțiunile" />
          </div>
        </Card>

        <div className="min-w-0 space-y-4">
          <Card>
            <SectionTitle title="Conturile conectate" action={<ShieldCheck className="h-4 w-4 text-mint" role="img" aria-label="doar citire" />} />

            <WorkspacePicker workspaces={workspaces} current={current} action={chooseWorkspace} disabled={pending} className="mt-4" />

            <ul className="mt-3 flex flex-wrap gap-2 text-[13px]">
              {own.map((workspace) => (
                <li
                  key={workspace.id}
                  className={cn(
                    "rounded-full border px-2.5 py-0.5",
                    workspace.tokenConfigured ? "border-white/[0.12] text-foreground/85" : "border-dashed border-white/[0.1] text-muted-foreground"
                  )}
                >
                  {workspace.name}
                  {workspace.tokenConfigured ? "" : " · fără token"}
                </li>
              ))}
            </ul>

            {tiktokSpaces.length > 0 ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {tiktokSpaces.map((workspace) => (
                  <Field
                    key={workspace.id}
                    label={`${workspace.name} · advertiser_id`}
                    info="Tokenul TikTok nu-și poate lista conturile. Scrie-le o dată; rămân în browser."
                  >
                    <TextInput
                      id={`tt-${workspace.id}`}
                      type="text"
                      inputMode="numeric"
                      value={tiktok[workspace.id] ?? ""}
                      onChange={(event) => setTiktok((previous) => ({ ...previous, [workspace.id]: event.target.value }))}
                      placeholder="7000000000000000001, …"
                      spellCheck={false}
                      className="font-mono text-[13.5px]"
                    />
                  </Field>
                ))}
              </div>
            ) : null}

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Btn variant="primary" size="sm" icon={pending ? Loader2 : RefreshCw} onClick={read} disabled={pending || configured.length === 0}>
                {pending ? "Se citesc conturile…" : context.status === "done" ? "Citește din nou" : "Citește conturile"}
              </Btn>
              {context.status === "done" ? <CopyButton value={context.text} label="Copiază contextul" /> : null}
            </div>

            <div aria-live="polite" className="mt-3 space-y-3">
              {configured.length === 0 ? (
                <p className="text-[14px] leading-relaxed text-muted-foreground">Niciun spațiu cu token. Id-urile i le dai tu lui Claude.</p>
              ) : null}
              {context.status === "failed" ? <p className="text-[14px] leading-snug text-rose">{context.message}</p> : null}
              {context.status === "done" ? (
                <p className="text-[14px] text-mint">
                  Citit la {new Intl.DateTimeFormat("ro-RO", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Bucharest" }).format(new Date(context.at))}.
                </p>
              ) : null}
            </div>

            {context.status === "done" ? (
              <ul className="mt-1 divide-y divide-white/[0.05]">
                {summary.map((item) => (
                  <li key={item.workspaceId} className="py-2.5">
                    <p className="text-[14px] font-medium">{item.name}</p>
                    <p className="font-mono text-[13px] text-muted-foreground/80">{accountsLine(item)}</p>
                    {item.notes.map((note) => (
                      <p key={note} className="mt-1 text-[13px] leading-snug text-muted-foreground">
                        {note}
                      </p>
                    ))}
                  </li>
                ))}
              </ul>
            ) : null}
          </Card>

          <Card>
            <SectionTitle title="Conversii și video" />
            {context.status === "done" ? (
              <>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="mb-1.5 flex items-center gap-1.5 text-[12px] uppercase tracking-[0.12em] text-muted-foreground">
                      <ListChecks className="h-3 w-3" aria-hidden="true" /> conversii
                    </p>
                    <ul className="space-y-1 font-mono text-[13px] text-foreground/75">
                      {summary.map((item) => (
                        <li key={item.workspaceId}>
                          {item.name}: {conversionsLine(item)}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="mb-1.5 flex items-center gap-1.5 text-[12px] uppercase tracking-[0.12em] text-muted-foreground">
                      <Sparkles className="h-3 w-3" aria-hidden="true" /> video
                    </p>
                    <ul className="space-y-1 font-mono text-[13px] text-foreground/75">
                      {summary.map((item) => (
                        <li key={item.workspaceId}>
                          {item.name}: {plural(item.videos, "video", "video-uri")}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
                {googleItems.length > 0 ? (
                  <div className="mt-3 border-t border-white/[0.06] pt-3">
                    <p className="mb-1.5 flex items-center gap-1.5 text-[12px] uppercase tracking-[0.12em] text-muted-foreground">
                      deja în conturile Google
                      <Info>Claude nu refolosește numele luate.</Info>
                    </p>
                    <ul className="space-y-1 font-mono text-[13px] text-foreground/75">
                      {googleItems.map((item) => (
                        <li key={item.workspaceId}>
                          {item.name}: {plural(item.campaigns, "campanie existentă", "campanii existente")} · {plural(item.negativeLists, "listă de negative", "liste de negative")}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                <details className="group mt-3 rounded-xl border border-white/[0.07] bg-[#0A0A0E]">
                  <summary className="cursor-pointer list-none px-3.5 py-2.5 text-[13.5px] text-foreground/80 hover:text-foreground [&::-webkit-details-marker]:hidden">
                    <span aria-hidden="true" className="mr-2 inline-block transition-transform duration-150 group-open:rotate-90">
                      ›
                    </span>
                    Contextul, ca text
                  </summary>
                  <pre className="max-h-[320px] overflow-auto whitespace-pre-wrap border-t border-white/[0.06] px-3.5 py-3 font-mono text-[12.5px] leading-relaxed text-foreground/80">
                    {context.text}
                  </pre>
                </details>
              </>
            ) : (
              <p className="mt-3 text-[14px] text-muted-foreground">Apar după „Citește conturile”.</p>
            )}
          </Card>

          <Card className="flex flex-wrap items-center justify-between gap-3 border-lav/20 bg-lav/[0.05]">
            <p className="flex items-center gap-1.5 text-[14.5px] font-medium text-[#D8CCFF]">
              Răspunsul lui Claude
              <Info>Un plan merge în „Plan nou”; un JSON cu „plans”, în „Lot”.</Info>
            </p>
            <div className="flex gap-2">
              <Link href="/admin/ads/nou" className={btnClass({ variant: "outline", size: "xs" })}>
                Plan nou
              </Link>
              <Link href="/admin/ads/lot" className={btnClass({ variant: "ghost", size: "xs" })}>
                Lot
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
