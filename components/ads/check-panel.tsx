"use client";

import { useEffect, useRef } from "react";
import type { PlatformCheck, ResolvedName } from "@/lib/ads/types";
import { PLATFORM_LABEL } from "@/lib/ads/constants";
import { countOf } from "@/lib/ads/plan-derive";
import { cn } from "@/lib/utils";
import { ProblemList, jumpTo } from "./problem-list";
import { ERROR_DOT, ERROR_TEXT, OK_DOT, OK_TEXT, WARNING_DOT, WARNING_TEXT } from "./tone";

/**
 * „Ce a găsit Meta / TikTok" — verificarea planului pe contul real, înainte de creare.
 *
 * Previzualizarea de deasupra spune ce SCRIE în plan. Panoul ăsta spune ce
 * ÎNȚELEGE platforma din el: contul și moneda lui, pagina sau identitatea, pixelul, video-ul, și
 * fiecare nume căutat („Cluj-Napoca" → „Cluj-Napoca, Cluj County, Romania").
 * Diferența dintre cele două e exact locul în care o campanie ajunge la alt
 * public decât credeai — de-aia crearea se deblochează abia după el.
 */

export function formatDuration(seconds: number | null): string | null {
  if (seconds === null || !Number.isFinite(seconds)) return null;
  const total = Math.round(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

function Row({
  label,
  tone,
  children,
}: {
  label: string;
  tone: "ok" | "error" | "warning" | "none";
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-x-6 gap-y-1 py-3 sm:grid-cols-[8.5rem_minmax(0,1fr)]">
      <dt className="flex items-center gap-2 font-md-mono text-[11.5px] uppercase tracking-[0.16em] text-dim">
        <span
          aria-hidden
          className={cn(
            "h-1.5 w-1.5 shrink-0 rounded-full",
            tone === "ok" ? OK_DOT : tone === "error" ? ERROR_DOT : tone === "warning" ? WARNING_DOT : "bg-hair-strong"
          )}
        />
        {label}
      </dt>
      <dd className="min-w-0 text-[14.5px] leading-snug text-bone/90 [overflow-wrap:anywhere]">{children}</dd>
    </div>
  );
}

function NameGroup({ title, items }: { title: string; items: ResolvedName[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <h4 className="font-md-mono text-[11.5px] uppercase tracking-[0.16em] text-dim">{title}</h4>
      <ul className="mt-2 space-y-1.5">
        {items.map((item) => (
          <li key={item.path} className="grid gap-x-3 text-[14px] leading-snug sm:grid-cols-[minmax(0,14rem)_auto_minmax(0,1fr)]">
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
                <span className="ml-2 font-md-mono text-[11px] text-dim">
                  {item.given ? "id din plan" : item.key}
                </span>
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

export function CheckPanel({ check, stale }: { check: PlatformCheck; stale: boolean }) {
  // O verificare nouă ia focusul: butonul apăsat tocmai s-a transformat în
  // „Creează pe pauză", iar tastatura și cititorul de ecran ar rămâne pe nimic.
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, [check.checkedAt]);

  const time = new Intl.DateTimeFormat("ro-RO", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(
    new Date(check.checkedAt)
  );
  const names = [...check.locations, ...check.languages, ...check.interests, ...check.behaviors];
  const duration = formatDuration(check.video?.lengthSeconds ?? null);
  const meta = check.platform === "meta";

  return (
    <section ref={ref} tabIndex={-1} aria-labelledby="platform-check" className="border-t border-hair py-7">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 id="platform-check" className="eyebrow !text-[11.5px] !text-bone">
          Ce a găsit {PLATFORM_LABEL[check.platform]}
        </h3>
        <p className={cn("font-md-mono text-[11.5px] tabular-nums", stale ? WARNING_TEXT : "text-dim")}>
          {stale ? `Verificat la ${time} · planul s-a schimbat de atunci` : `Verificat la ${time}`}
        </p>
      </div>

      <dl className="mt-3 divide-y divide-hair">
        <Row label="Contul" tone={check.account ? (check.account.usable ? "ok" : "error") : "error"}>
          {check.account ? (
            <>
              {check.account.name}
              <span className="ml-2 font-md-mono text-[12px] text-dim">
                {check.account.currency} · {check.account.state}
              </span>
            </>
          ) : (
            <span className={ERROR_TEXT}>tokenul nu vede contul din plan</span>
          )}
        </Row>
        <Row label={meta ? "Pagina" : "Identitatea"} tone={check.identity ? "ok" : "error"}>
          {check.identity ? (
            check.identity.name
          ) : (
            <span className={ERROR_TEXT}>tokenul nu vede {meta ? "pagina" : "identitatea"} din plan</span>
          )}
        </Row>
        {meta ? (
          <Row label="Instagram" tone={check.instagram ? "ok" : "none"}>
            {check.instagram ? (
              `@${check.instagram.username}`
            ) : (
              <span className="text-dim">fără cont de Instagram — pe Instagram apare pagina</span>
            )}
          </Row>
        ) : null}
        <Row label="Pixelul" tone={check.pixel ? "ok" : "none"}>
          {check.pixel ? (
            <>
              {check.pixel.name}
              <span className="ml-2 inline-block font-md-mono text-[12px] text-dim">{check.pixel.id}</span>
            </>
          ) : (
            <span className="text-dim">obiectivul nu folosește pixel</span>
          )}
        </Row>
        {check.conversionDomain ? (
          <Row label="Domeniul" tone="ok">
            {check.conversionDomain}
            <span className="ml-2 text-[13px] text-dim">conversiile se atribuie pe domeniul ăsta</span>
          </Row>
        ) : null}
        {check.dsa ? (
          <Row label="DSA" tone={check.dsa.beneficiary && check.dsa.payor ? "ok" : "error"}>
            <span className="block">
              Beneficiar:{" "}
              {check.dsa.beneficiary ?? <span className={ERROR_TEXT}>lipsește</span>}
            </span>
            <span className="block">
              Plătitor: {check.dsa.payor ?? <span className={ERROR_TEXT}>lipsește</span>}
            </span>
            <span className="mt-0.5 block font-md-mono text-[12px] text-dim">
              din {check.dsa.source} · apar pe reclamă, în „De ce văd reclama asta”
            </span>
          </Row>
        ) : null}
        <Row label="Video" tone={check.video ? (check.video.ready ? "ok" : "warning") : "error"}>
          {check.video ? (
            <div className="flex items-center gap-3">
              {check.video.thumbnailUrl ? (
                // Miniatura vine de pe CDN-ul platformei, cu URL semnat și temporar — next/image n-ar avea ce optimiza.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={check.video.thumbnailUrl}
                  alt={`Coperta video-ului ${check.video.title ? `„${check.video.title}”` : check.video.id}`}
                  referrerPolicy="no-referrer"
                  className="h-14 w-14 shrink-0 rounded-panel-sm border border-hair object-cover"
                />
              ) : null}
              <div className="min-w-0">
                <p className="truncate">{check.video.title ?? "Video fără titlu"}</p>
                <p className={cn("font-md-mono text-[12px]", check.video.ready ? "text-dim" : WARNING_TEXT)}>
                  {[duration, check.video.ready ? "gata de folosit" : `${PLATFORM_LABEL[check.platform]} încă îl procesează`, check.video.id]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
            </div>
          ) : (
            <span className={ERROR_TEXT}>video-ul din plan nu e în biblioteca contului</span>
          )}
        </Row>
      </dl>

      {names.length > 0 ? (
        <div className="mt-5 space-y-5 rounded-panel-lg border border-hair bg-ink/40 px-4 py-4 sm:px-5">
          <p className="text-[13.5px] leading-snug text-bone/70">
            {countOf(names.length, "nume")} din plan, cum le-a înțeles {PLATFORM_LABEL[check.platform]}. Asta intră în targetare, nu
            textul din plan.
          </p>
          <NameGroup title="Locații" items={check.locations} />
          <NameGroup title="Limbi" items={check.languages} />
          <NameGroup title="Interese" items={check.interests} />
          <NameGroup title="Comportamente" items={check.behaviors} />
        </div>
      ) : null}

      <div className="mt-5 space-y-3">
        <ProblemList
          title={check.errors.length === 1 ? `${PLATFORM_LABEL[check.platform]}: un lucru de corectat` : `${PLATFORM_LABEL[check.platform]}: ${countOf(check.errors.length, "lucruri")} de corectat`}
          problems={check.errors}
          tone="error"
        />
        <ProblemList
          title={check.warnings.length === 1 ? `${PLATFORM_LABEL[check.platform]}: un lucru de citit` : `${PLATFORM_LABEL[check.platform]}: ${countOf(check.warnings.length, "lucruri")} de citit`}
          problems={check.warnings}
          tone="warning"
        />
      </div>
      {check.errors.length === 0 && !stale ? (
        <p className={cn("mt-4 text-[14px]", OK_TEXT)}>
          Totul se potrivește. Campania se poate crea — oprită.
        </p>
      ) : null}
    </section>
  );
}
