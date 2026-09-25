"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import type { Platform } from "@/lib/ads/constants";
import { managerName } from "@/lib/ads/links";
import type { CreateResponse, CreatedObject } from "@/lib/ads/types";
import { countOf } from "@/lib/ads/plan-derive";
import { cn } from "@/lib/utils";
import { PauseGlyph } from "./pause-seal";
import { ProblemList } from "./problem-list";
import { ERROR_TEXT, WARNING_TEXT } from "./tone";

/**
 * Rezultatul creării: ce există acum în Meta, oprit, cu link direct.
 *
 * Patru ieșiri, fiecare cu instrucțiunea ei:
 *   creată       — linkul spre Ads Manager, unde omul o verifică și o pornește;
 *   dublură      — același plan a fost creat de curând: încă o dată doar intenționat;
 *   la jumătate  — ce apucase să se creeze (tot pe pauză) și ce a refuzat Meta;
 *   refuzată     — nimic creat, ce să corectezi.
 *
 * Panoul primește focus când apare: după un clic de câteva secunde, omul
 * (și cititorul de ecran) trebuie să afle rezultatul fără să-l caute.
 */

const KIND_LABEL: Record<CreatedObject["kind"], string> = {
  image: "Imaginea",
  campaign: "Campania",
  adset: "Setul de reclame",
  creative: "Materialul",
  ad: "Reclama",
};

function CreatedList({ created, platform }: { created: CreatedObject[]; platform: Platform }) {
  return (
    <ul className="mt-4 space-y-1 font-md-mono text-[12px] leading-relaxed text-bone/75">
      {created.map((object) => (
        <li key={`${object.kind}-${object.id}`} className="flex min-w-0 flex-wrap gap-x-2">
          <span className="text-dim">
            {object.kind === "adset" && platform === "tiktok" ? "Grupul de reclame" : KIND_LABEL[object.kind]}
          </span>
          <span className="min-w-0 truncate text-bone/90">{object.name}</span>
          <span className="text-dim">{object.id}</span>
        </li>
      ))}
    </ul>
  );
}

function ExternalLink({ href, children, light }: { href: string; children: React.ReactNode; light?: boolean }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn("btn !min-h-11", light ? "btn-light" : "btn-ghost")}
    >
      {children}
      <span aria-hidden> ↗</span>
      <span className="sr-only"> (se deschide într-o filă nouă)</span>
    </a>
  );
}

export function CreateResult({
  result,
  platform,
  onCreateAnyway,
  pending,
}: {
  result: CreateResponse;
  platform: Platform;
  onCreateAnyway: () => void;
  pending: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const manager = managerName(platform);
  useEffect(() => {
    ref.current?.focus({ preventScroll: false });
  }, [result]);

  if (result.ok) {
    const ads = result.created.filter((object) => object.kind === "ad").length;
    return (
      <div
        ref={ref}
        tabIndex={-1}
        role="status"
        className="rounded-panel-lg border border-bone/40 bg-char px-5 py-6 sm:px-7"
      >
        <div className="flex items-center gap-4">
          <PauseGlyph className="h-12 w-12 shrink-0 text-bone" />
          <div>
            <p className="font-md-display text-[1.625rem] font-semibold leading-none tracking-tight text-bone">
              Creată. Oprită.
            </p>
            <p className="mt-2 text-[14.5px] leading-snug text-bone/75">
              {ads === 1 ? "O reclamă" : countOf(ads, "reclame")} pe pauză. Verific-o în {manager} și pornește-o de
              acolo, când e gata.
            </p>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <ExternalLink href={result.adsManagerUrl} light>
            Deschide în {manager}
          </ExternalLink>
          <Link href="/admin/ads" className="btn btn-ghost !min-h-11">
            Lista de campanii
          </Link>
        </div>
        {result.storeWarning ? (
          <p className={cn("mt-4 text-[13.5px] leading-snug", WARNING_TEXT)}>{result.storeWarning}</p>
        ) : null}
        <CreatedList created={result.created} platform={platform} />
      </div>
    );
  }

  if (result.duplicate) {
    return (
      <div
        ref={ref}
        tabIndex={-1}
        role="alert"
        className="rounded-panel-lg border border-[#f0b429]/40 bg-[#f0b429]/[0.05] px-5 py-5 sm:px-6"
      >
        <p className={cn("text-[15.5px] font-semibold", WARNING_TEXT)}>Planul ăsta a fost deja creat.</p>
        <p className="mt-2 text-[14px] leading-relaxed text-bone/80">{result.message}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <ExternalLink href={result.duplicate.adsManagerUrl}>Deschide campania existentă</ExternalLink>
          <button
            type="button"
            onClick={onCreateAnyway}
            disabled={pending}
            className="btn btn-ghost !min-h-11 disabled:cursor-not-allowed disabled:opacity-45"
          >
            {pending ? "Se creează…" : "Creează încă una, intenționat"}
          </button>
        </div>
      </div>
    );
  }

  if (result.partial) {
    return (
      <div
        ref={ref}
        tabIndex={-1}
        role="alert"
        className="rounded-panel-lg border border-[#f0b429]/40 bg-[#f0b429]/[0.05] px-5 py-5 sm:px-6"
      >
        <p className={cn("text-[15.5px] font-semibold", WARNING_TEXT)}>
          Crearea s-a oprit la jumătate. Ce există e pe pauză.
        </p>
        <p className="mt-2 text-[14px] leading-relaxed text-bone/80">{result.message}</p>
        <p className="mt-2 text-[14px] leading-relaxed text-bone/80">
          Completează ce lipsește din {manager} sau șterge campania de acolo și creeaz-o din nou după corectură.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <ExternalLink href={result.partial.adsManagerUrl}>Deschide în {manager}</ExternalLink>
        </div>
        <CreatedList created={result.partial.created} platform={platform} />
      </div>
    );
  }

  return (
    <div ref={ref} tabIndex={-1} role="alert" className="space-y-3">
      <div className="rounded-panel-lg border border-[#ff6b6b]/35 bg-[#ff6b6b]/[0.05] px-5 py-4">
        <p className={cn("text-[15px] font-semibold", ERROR_TEXT)}>Nu s-a creat nimic.</p>
        <p className="mt-1.5 text-[14px] leading-relaxed text-bone/80">{result.message}</p>
      </div>
      {result.problems && result.problems.length > 0 ? (
        <ProblemList title="De corectat" problems={result.problems} tone="error" />
      ) : null}
    </div>
  );
}
