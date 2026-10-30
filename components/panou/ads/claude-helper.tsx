"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { ListChecks, Loader2, RefreshCw, ShieldCheck, Sparkles, Copy } from "lucide-react";
import { countOf } from "@/lib/ads/plan-derive";
import type { WorkspaceSummary } from "@/lib/ads/workspaces";
import { cn } from "@/lib/utils";
import { CopyButton } from "../ui/actions";
import { Btn, btnClass, Card, Pill, SectionTitle } from "../ui/primitives";
import { Field } from "../ui/states";
import { TextInput } from "../ui/select";
import { PAGE_LEAD, PAGE_TITLE } from "./tone";
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
        <div>
          <h1 className={PAGE_TITLE}>Pentru Claude</h1>
          <p className={PAGE_LEAD}>
            Lipește tot în conversație, înainte să ceri planurile. Așa primești JSON care trece verificarea din prima: formatul (și cel al
            campaniilor de căutare Google), regulile fiecărei platforme și id-urile reale din conturi.
          </p>
        </div>
        <div className="flex flex-col items-start gap-1.5 sm:items-end">
          <CopyButton value={all} label="Copiază tot" copiedLabel="Copiat" variant="primary" size="md" />
          <p className="text-[11px] text-muted-foreground">
            {context.status === "done" ? "Instrucțiuni + contextul conturilor." : "Fără context citit: se copiază doar instrucțiunile."}
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card id="claude-brief">
          <SectionTitle
            title="Formatul planului și regulile platformelor"
            hint="lipește-l ca atare · aceleași reguli ca validarea"
            action={<Pill tone="lav">{Math.max(1, Math.round(brief.length / 1000))} mii de caractere</Pill>}
          />
          <pre
            tabIndex={0}
            aria-label="Instrucțiunile pentru Claude"
            className="mt-3 max-h-[520px] overflow-auto whitespace-pre-wrap rounded-xl border border-white/[0.07] bg-[#0A0A0E] p-3.5 font-mono text-[11px] leading-relaxed text-foreground/80"
          >
            {brief}
          </pre>
          <div className="mt-3">
            <CopyButton value={brief} label="Copiază instrucțiunile" />
          </div>
        </Card>

        <div className="min-w-0 space-y-4">
          <Card>
            <SectionTitle
              title="Conturile conectate"
              hint="verificarea din portal citește aceste ID-uri"
              action={<ShieldCheck className="h-4 w-4 text-mint" role="img" aria-label="doar citire" />}
            />

            <WorkspacePicker workspaces={workspaces} current={current} action={chooseWorkspace} disabled={pending} className="mt-4" />

            <ul className="mt-3 flex flex-wrap gap-2 text-[11.5px]">
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
                    hint="TikTok nu lasă tokenul să-și listeze conturile — scrie-le o dată, rămân aici."
                  >
                    <TextInput
                      id={`tt-${workspace.id}`}
                      type="text"
                      inputMode="numeric"
                      value={tiktok[workspace.id] ?? ""}
                      onChange={(event) => setTiktok((previous) => ({ ...previous, [workspace.id]: event.target.value }))}
                      placeholder="7000000000000000001, …"
                      spellCheck={false}
                      className="font-mono text-[12px]"
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
                <p className="text-[12px] leading-relaxed text-muted-foreground">
                  Niciun spațiu al proprietarului ăstuia nu are token încă. Instrucțiunile merg oricum; id-urile i le dai tu lui Claude.
                </p>
              ) : null}
              {context.status === "failed" ? <p className="text-[12.5px] leading-snug text-rose">{context.message}</p> : null}
              {context.status === "done" ? (
                <p className="text-[12.5px] text-mint">
                  Citit la {new Intl.DateTimeFormat("ro-RO", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Bucharest" }).format(new Date(context.at))}.
                </p>
              ) : null}
            </div>

            {context.status === "done" ? (
              <ul className="mt-1 divide-y divide-white/[0.05]">
                {summary.map((item) => (
                  <li key={item.workspaceId} className="py-2.5">
                    <p className="text-[12.5px] font-medium">{item.name}</p>
                    <p className="font-mono text-[10.5px] text-muted-foreground/80">{accountsLine(item)}</p>
                    {item.notes.map((note) => (
                      <p key={note} className="mt-1 text-[11px] leading-snug text-muted-foreground">
                        {note}
                      </p>
                    ))}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground/80">
                Conturile, paginile și identitățile apar aici după „Citește conturile”. Claude folosește doar id-urile din context — nu le inventează.
              </p>
            )}
          </Card>

          <Card>
            <SectionTitle title="Acțiuni de conversie și video" hint="numele trebuie scrise exact" />
            {context.status === "done" ? (
              <>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="mb-1.5 flex items-center gap-1.5 text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">
                      <ListChecks className="h-3 w-3" aria-hidden="true" /> conversii
                    </p>
                    <ul className="space-y-1 font-mono text-[10.5px] text-foreground/75">
                      {summary.map((item) => (
                        <li key={item.workspaceId}>
                          {item.name}: {conversionsLine(item)}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="mb-1.5 flex items-center gap-1.5 text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">
                      <Sparkles className="h-3 w-3" aria-hidden="true" /> video
                    </p>
                    <ul className="space-y-1 font-mono text-[10.5px] text-foreground/75">
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
                    <p className="mb-1.5 text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">deja în conturile Google</p>
                    <ul className="space-y-1 font-mono text-[10.5px] text-foreground/75">
                      {googleItems.map((item) => (
                        <li key={item.workspaceId}>
                          {item.name}: {plural(item.campaigns, "campanie existentă", "campanii existente")} · {plural(item.negativeLists, "listă de negative", "liste de negative")}
                        </li>
                      ))}
                    </ul>
                    <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">Claude nu refolosește numele luate.</p>
                  </div>
                ) : null}
                <details className="group mt-3 rounded-xl border border-white/[0.07] bg-[#0A0A0E]">
                  <summary className="cursor-pointer list-none px-3.5 py-2.5 text-[12px] text-foreground/80 hover:text-foreground [&::-webkit-details-marker]:hidden">
                    <span aria-hidden="true" className="mr-2 inline-block transition-transform duration-150 group-open:rotate-90">
                      ›
                    </span>
                    Vezi contextul, cum ajunge la Claude
                  </summary>
                  <pre className="max-h-[320px] overflow-auto whitespace-pre-wrap border-t border-white/[0.06] px-3.5 py-3 font-mono text-[11px] leading-relaxed text-foreground/80">
                    {context.text}
                  </pre>
                </details>
              </>
            ) : (
              <p className="mt-3 text-[12px] leading-relaxed text-muted-foreground">
                Pixelii sau conversiile, video-urile din bibliotecă și, pe Google, campaniile care există deja apar după „Citește conturile”.
              </p>
            )}
          </Card>

          <Card className="border-lav/20 bg-lav/[0.05]">
            <p className="text-[12.5px] font-medium text-[#D8CCFF]">După ce primești planurile</p>
            <ol className="mt-2 space-y-1 text-[11.5px] leading-relaxed text-[#D8CCFF]/75">
              <li>
                <span className="pu-num mr-1.5 text-[#D8CCFF]/55">01</span>Copiază instrucțiunile și contextul, cu un clic, la începutul conversației.
              </li>
              <li>
                <span className="pu-num mr-1.5 text-[#D8CCFF]/55">02</span>Descrie clientul, oferta, publicul, bugetul și platformele. Claude răspunde cu planuri, în JSON.
              </li>
              <li>
                <span className="pu-num mr-1.5 text-[#D8CCFF]/55">03</span>Mai multe campanii (un JSON cu „plans”) se lipesc în „Lot”; una singură, în „Plan nou”. Verificarea îți spune pe rând ce lipsește, iar
                „Copiază problemele pentru Claude” pregătește răspunsul.
              </li>
            </ol>
            <div className="mt-3 flex gap-2">
              <Link href="/admin/ads/nou" className={btnClass({ variant: "outline", size: "xs" })}>
                Plan nou
              </Link>
              <Link href="/admin/ads/lot" className={btnClass({ variant: "ghost", size: "xs" })}>
                Lot
              </Link>
            </div>
          </Card>

          <p className="flex items-center gap-1.5 px-1 text-[11px] text-muted-foreground/60">
            <Copy className="h-3 w-3" aria-hidden="true" /> „Copiază tot” include instrucțiunile și contextul, într-un singur mesaj.
          </p>
        </div>
      </div>
    </div>
  );
}
