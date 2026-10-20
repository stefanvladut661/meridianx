"use client";

import { useEffect, useRef } from "react";
import type { SearchCheck } from "@/lib/ads/google/search/types";
import type { ResolvedName } from "@/lib/ads/types";
import { countOf } from "@/lib/ads/plan-derive";
import { cn } from "@/lib/utils";
import { ProblemList, jumpTo } from "./problem-list";
import { ERROR_DOT, ERROR_TEXT, OK_DOT, OK_TEXT, WARNING_DOT, WARNING_TEXT } from "./tone";

/**
 * „Ce a găsit Google” pentru un plan de căutare: contul (și managerul prin
 * care îl vede cheia), cum a înțeles Google fiecare locație și limbă, ce
 * acțiuni de conversie au butoanele de apel, cum răspund adresele finale —
 * și ce a refuzat Google când a primit toată crearea cu `validateOnly`.
 */

function Names({ title, items }: { title: string; items: ResolvedName[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <h5 className="font-md-mono text-[11px] uppercase tracking-[0.16em] text-dim">{title}</h5>
      <ul className="mt-1.5 space-y-1">
        {items.map((item) => (
          <li key={item.path} className="grid gap-x-3 text-[14px] leading-snug sm:grid-cols-[minmax(0,12rem)_auto_minmax(0,1fr)]">
            <button
              type="button"
              onClick={() => jumpTo(item.path)}
              className="min-w-0 truncate text-left text-bone/75 underline-offset-4 hover:text-bone hover:underline"
            >
              {item.asked}
            </button>
            <span aria-hidden className="hidden text-dim sm:inline">
              →
            </span>
            {item.found ? (
              <span className="min-w-0 text-bone">
                <span className="sr-only">găsit: </span>
                {item.found}
                <span className="ml-2 font-md-mono text-[11px] text-dim">{item.given ? "id din plan" : item.key}</span>
              </span>
            ) : (
              <span className={ERROR_TEXT}>negăsit</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SearchCheckPanel({ check, stale }: { check: SearchCheck; stale: boolean }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, [check.checkedAt]);

  const time = new Intl.DateTimeFormat("ro-RO", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(check.checkedAt));
  const badUrls = check.urls.filter((url) => url.verdict === "error").length;
  const redirects = check.urls.filter((url) => url.verdict === "redirect").length;

  return (
    <section ref={ref} tabIndex={-1} aria-labelledby="search-check" className="rounded-panel-lg border border-hair bg-char/50 px-5 py-6 sm:px-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 id="search-check" className="eyebrow !text-[11.5px] !text-bone">
          Ce a găsit Google
        </h3>
        <p className={cn("font-md-mono text-[11.5px] tabular-nums", stale ? WARNING_TEXT : "text-dim")}>
          {stale ? `Verificat la ${time} · planul s-a schimbat de atunci` : `Verificat la ${time}`}
        </p>
      </div>

      <dl className="mt-3 divide-y divide-hair">
        <div className="grid gap-x-6 gap-y-1 py-3 sm:grid-cols-[8.5rem_minmax(0,1fr)]">
          <dt className="flex items-center gap-2 font-md-mono text-[11.5px] uppercase tracking-[0.16em] text-dim">
            <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", check.account?.usable ? OK_DOT : ERROR_DOT)} />
            Contul
          </dt>
          <dd className="min-w-0 text-[14.5px] text-bone/90">
            {check.account ? (
              <>
                {check.account.name}
                <span className="ml-2 font-md-mono text-[12px] text-dim">
                  {check.account.currency} · {check.account.state}
                  {check.manager ? ` · prin managerul ${check.manager}` : " · văzut direct"}
                </span>
              </>
            ) : (
              <span className={ERROR_TEXT}>cheia nu vede contul din plan</span>
            )}
          </dd>
        </div>
        <div className="grid gap-x-6 gap-y-1 py-3 sm:grid-cols-[8.5rem_minmax(0,1fr)]">
          <dt className="flex items-center gap-2 font-md-mono text-[11.5px] uppercase tracking-[0.16em] text-dim">
            <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", check.ok ? OK_DOT : ERROR_DOT)} />
            Crearea
          </dt>
          <dd className="min-w-0 text-[14.5px] text-bone/90">
            {check.operations === 0 ? (
              "Nimic trimis la Google încă: întâi corecturile de mai jos, apoi „Verifică din nou” trimite tot planul cu validateOnly."
            ) : (
              <>
                {countOf(check.operations, "operații")} trimise la Google cu <span className="font-md-mono text-[13px]">validateOnly</span>
                {check.ok ? " — Google le-ar accepta pe toate. Nu s-a creat nimic." : " — nu s-a creat nimic."}
              </>
            )}
          </dd>
        </div>
        {check.callConversions.length > 0 ? (
          <div className="grid gap-x-6 gap-y-1 py-3 sm:grid-cols-[8.5rem_minmax(0,1fr)]">
            <dt className="flex items-center gap-2 font-md-mono text-[11.5px] uppercase tracking-[0.16em] text-dim">
              <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", check.callConversions.every((item) => item.ok) ? OK_DOT : WARNING_DOT)} />
              Apelurile
            </dt>
            <dd className="min-w-0 space-y-0.5 text-[14.5px] text-bone/90">
              {check.callConversions.map((item) => (
                <p key={item.id}>
                  {item.name} <span className="font-md-mono text-[12px] text-dim">{item.type} · {item.id}</span>
                </p>
              ))}
            </dd>
          </div>
        ) : null}
        <div className="grid gap-x-6 gap-y-1 py-3 sm:grid-cols-[8.5rem_minmax(0,1fr)]">
          <dt className="flex items-center gap-2 font-md-mono text-[11.5px] uppercase tracking-[0.16em] text-dim">
            <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", badUrls > 0 ? ERROR_DOT : redirects > 0 ? WARNING_DOT : OK_DOT)} />
            Adresele
          </dt>
          <dd className="min-w-0 text-[14.5px] text-bone/90">
            {check.urls.length === 0 ? (
              <span className="text-dim">nicio adresă de verificat</span>
            ) : (
              <>
                <p>
                  {countOf(check.urls.length, "adrese")}: {check.urls.length - badUrls - redirects} răspund direct
                  {redirects > 0 ? `, ${redirects} redirecționează` : ""}
                  {badUrls > 0 ? <span className={ERROR_TEXT}>, {badUrls} nu merg</span> : null}.
                </p>
                {badUrls + redirects > 0 ? (
                  <ul className="mt-1.5 space-y-1 text-[13.5px]">
                    {check.urls
                      .filter((url) => url.verdict !== "ok")
                      .map((url) => (
                        <li key={url.url} className="[overflow-wrap:anywhere]">
                          <span className={url.verdict === "error" ? ERROR_TEXT : WARNING_TEXT}>{url.status ?? "fără răspuns"}</span>{" "}
                          <span className="text-bone/80">{url.url}</span>
                          {url.note ? <span className="block text-dim">{url.note}</span> : null}
                        </li>
                      ))}
                  </ul>
                ) : null}
              </>
            )}
          </dd>
        </div>
      </dl>

      <div className="mt-5 space-y-5 rounded-panel-lg border border-hair bg-ink/40 px-4 py-4 sm:px-5">
        <p className="text-[13.5px] leading-snug text-bone/70">Locațiile și limbile, cum le-a înțeles Google. Asta intră în campanie, nu textul din plan.</p>
        {check.campaigns.map((campaign) => (
          <div key={campaign.key} className="space-y-3">
            <h4 className="text-[14px] font-semibold text-bone">{campaign.name}</h4>
            <Names title="Locații" items={campaign.locations} />
            <Names title="Excluse" items={campaign.excluded} />
            <Names title="Limbi" items={campaign.languages} />
          </div>
        ))}
      </div>

      <div className="mt-5 space-y-3">
        <ProblemList
          title={check.errors.length === 1 ? "Google: un lucru de corectat" : `Google: ${countOf(check.errors.length, "lucruri")} de corectat`}
          problems={check.errors}
          tone="error"
        />
        <ProblemList
          title={check.warnings.length === 1 ? "Google: un lucru de citit" : `Google: ${countOf(check.warnings.length, "lucruri")} de citit`}
          problems={check.warnings}
          tone="warning"
        />
      </div>
      {check.ok && !stale ? <p className={cn("mt-4 text-[14px]", OK_TEXT)}>Totul se potrivește. Planul se poate crea — oprit.</p> : null}
    </section>
  );
}
