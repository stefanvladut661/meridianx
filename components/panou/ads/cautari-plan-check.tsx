"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { ShieldCheck } from "lucide-react";
import type { SearchCheck } from "@/lib/ads/google/search/types";
import type { ResolvedName } from "@/lib/ads/types";
import { countOf } from "@/lib/ads/plan-derive";
import { Card, SectionTitle } from "@/components/panou/ui/primitives";
import { InlineNote } from "@/components/panou/ui/actions";
import { cn } from "@/lib/utils";
import { PlanProbleme, jumpTo } from "./cautari-plan-probleme";

/**
 * „Ce a găsit Google” pentru un plan de căutare: contul (și managerul prin
 * care îl vede cheia), cum a înțeles Google fiecare locație și limbă, ce
 * acțiuni de conversie au butoanele de apel, cum răspund adresele finale —
 * și ce a refuzat Google când a primit toată crearea cu `validateOnly`.
 */

type Tone = "ok" | "warn" | "error";
const DOT: Record<Tone, string> = { ok: "bg-mint", warn: "bg-apricot", error: "bg-rose" };

function Row({ label, tone, children }: { label: string; tone: Tone; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[104px_minmax(0,1fr)] items-start gap-3 py-2.5 sm:grid-cols-[120px_minmax(0,1fr)]">
      <dt className="flex items-center gap-2 pt-0.5 text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
        <span aria-hidden="true" className={cn("h-1.5 w-1.5 shrink-0 rounded-full", DOT[tone])} />
        {label}
      </dt>
      <dd className="min-w-0 text-[12.5px] leading-relaxed text-foreground/85">{children}</dd>
    </div>
  );
}

function Names({ title, items }: { title: string; items: ResolvedName[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <h5 className="text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">{title}</h5>
      <ul className="mt-1.5 space-y-1">
        {items.map((item) => (
          <li key={item.path} className="grid gap-x-3 text-[12px] leading-snug sm:grid-cols-[minmax(0,11rem)_auto_minmax(0,1fr)]">
            <button type="button" onClick={() => jumpTo(item.path)} className="min-w-0 truncate text-left text-foreground/70 underline-offset-4 hover:text-foreground hover:underline">
              {item.asked}
            </button>
            <span aria-hidden="true" className="hidden text-muted-foreground sm:inline">
              →
            </span>
            {item.found ? (
              <span className="min-w-0">
                <span className="sr-only">găsit: </span>
                {item.found}
                <span className="ml-2 font-mono text-[10.5px] text-muted-foreground">{item.given ? "id din plan" : item.key}</span>
              </span>
            ) : (
              <span className="text-rose">negăsit</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CautariPlanCheck({ check, stale }: { check: SearchCheck; stale: boolean }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, [check.checkedAt]);

  const time = new Intl.DateTimeFormat("ro-RO", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Europe/Bucharest" }).format(new Date(check.checkedAt));
  const badUrls = check.urls.filter((url) => url.verdict === "error").length;
  const redirects = check.urls.filter((url) => url.verdict === "redirect").length;

  return (
    <Card>
      <section ref={ref} tabIndex={-1} aria-labelledby="search-check" className="outline-none">
      <SectionTitle
        title={<span id="search-check">Ce a găsit Google</span>}
        hint={
          <span className={stale ? "text-apricot" : undefined}>
            {stale ? `Verificat la ${time} · planul s-a schimbat de atunci` : `Verificat la ${time} · nu s-a creat nimic`}
          </span>
        }
      />

      <dl className="mt-3 divide-y divide-white/[0.05]">
        <Row label="Contul" tone={check.account?.usable ? "ok" : "error"}>
          {check.account ? (
            <>
              {check.account.name}
              <span className="ml-2 font-mono text-[11px] text-muted-foreground">
                {check.account.currency} · {check.account.state}
                {check.manager ? ` · prin managerul ${check.manager}` : " · văzut direct"}
              </span>
            </>
          ) : (
            <span className="text-rose">cheia nu vede contul din plan</span>
          )}
        </Row>
        <Row label="Crearea" tone={check.ok ? "ok" : "error"}>
          {check.operations === 0 ? (
            "Nimic trimis la Google încă: întâi corecturile de mai jos, apoi „Verifică din nou” trimite tot planul cu validateOnly."
          ) : (
            <>
              {countOf(check.operations, "operații")} trimise la Google cu <span className="font-mono text-[11.5px]">validateOnly</span>
              {check.ok ? " — Google le-ar accepta pe toate. Nu s-a creat nimic." : " — nu s-a creat nimic."}
            </>
          )}
        </Row>
        {check.callConversions.length > 0 ? (
          <Row label="Apelurile" tone={check.callConversions.every((item) => item.ok) ? "ok" : "warn"}>
            <div className="space-y-0.5">
              {check.callConversions.map((item) => (
                <p key={item.id}>
                  {item.name}{" "}
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {item.type} · {item.id}
                  </span>
                </p>
              ))}
            </div>
          </Row>
        ) : null}
        <Row label="Adresele" tone={badUrls > 0 ? "error" : redirects > 0 ? "warn" : "ok"}>
          {check.urls.length === 0 ? (
            <span className="text-muted-foreground">nicio adresă de verificat</span>
          ) : (
            <>
              <p>
                {countOf(check.urls.length, "adrese")}: {check.urls.length - badUrls - redirects} răspund direct
                {redirects > 0 ? `, ${redirects} redirecționează` : ""}
                {badUrls > 0 ? <span className="text-rose">, {badUrls} nu merg</span> : null}.
              </p>
              {badUrls + redirects > 0 ? (
                <ul className="mt-1.5 space-y-1 text-[12px]">
                  {check.urls
                    .filter((url) => url.verdict !== "ok")
                    .map((url) => (
                      <li key={url.url} className="[overflow-wrap:anywhere]">
                        <span className={url.verdict === "error" ? "text-rose" : "text-apricot"}>{url.status ?? "fără răspuns"}</span>{" "}
                        <span className="text-foreground/80">{url.url}</span>
                        {url.note ? <span className="block text-muted-foreground">{url.note}</span> : null}
                      </li>
                    ))}
                </ul>
              ) : null}
            </>
          )}
        </Row>
      </dl>

      <div className="mt-4 space-y-4 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3.5">
        <p className="text-[11.5px] leading-snug text-muted-foreground">Locațiile și limbile, cum le-a înțeles Google. Asta intră în campanie, nu textul din plan.</p>
        {check.campaigns.map((campaign) => (
          <div key={campaign.key} className="space-y-2.5">
            <h4 className="text-[12.5px] font-medium">{campaign.name}</h4>
            <Names title="Locații" items={campaign.locations} />
            <Names title="Excluse" items={campaign.excluded} />
            <Names title="Limbi" items={campaign.languages} />
          </div>
        ))}
      </div>

      <div className="mt-4 space-y-2">
        <PlanProbleme
          title={check.errors.length === 1 ? "Google: un lucru de corectat" : `Google: ${countOf(check.errors.length, "lucruri")} de corectat`}
          problems={check.errors}
          tone="error"
        />
        <PlanProbleme
          title={check.warnings.length === 1 ? "Google: un lucru de citit" : `Google: ${countOf(check.warnings.length, "lucruri")} de citit`}
          problems={check.warnings}
          tone="warning"
        />
        {check.ok && !stale ? (
          <InlineNote tone="mint">
            <span className="flex items-center gap-2">
              <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              Totul se potrivește. Planul se poate crea — oprit.
            </span>
          </InlineNote>
        ) : null}
      </div>
      </section>
    </Card>
  );
}
