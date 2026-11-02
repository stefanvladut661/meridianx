"use client";

import { useState, useTransition, type MouseEvent } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ExternalLink, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { dateTimeRo, num, relativeRo } from "@/components/panou/ui/format";
import { ErrorState } from "@/components/panou/ui/states";
import { ETAPE } from "@/lib/prospectare/labels";
import type { FirmaRand } from "@/lib/prospectare/types";
import { CanalBadge, StageBadge } from "./stage-badge";
import { linkWeb } from "./firme-format";

/**
 * Tabelul firmelor (prototip: FirmsTable.jsx): bara din stânga = etapa. Un
 * clic pe rând (sau pe nume, de la tastatură) pune `?firma=<id>` în adresă,
 * iar pagina de server deschide fișa. Sub 1024 px, rândurile devin carduri.
 */

const etapaMeta = (f: FirmaRand) => ETAPE[f.etapa] ?? ETAPE.cercetat;

const clasaScor = (scor: number | null) => (scor === null || scor < 60 ? "text-muted-foreground" : scor >= 85 ? "text-mint" : "");

export function FirmeTabel({ firme, acum, selectatId }: { firme: FirmaRand[]; acum: number; selectatId: string | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [deschid, setDeschid] = useState<string | null>(null);

  const hrefFirma = (id: string) => {
    const next = new URLSearchParams(params.toString());
    next.set("firma", id);
    return `${pathname}?${next.toString()}`;
  };

  const deschide = (id: string) => {
    setDeschid(id);
    startTransition(() => router.push(hrefFirma(id), { scroll: false }));
  };

  // Ctrl/Cmd/Shift + clic sau clic de mijloc: lasă browserul să deschidă fișa în altă filă.
  const peLink = (event: MouseEvent<HTMLAnchorElement>, id: string) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    deschide(id);
  };

  // Clicul pe linkul demo își face treaba lui, nu deschide fișa.
  const peRand = (event: MouseEvent<HTMLTableRowElement>, id: string) => {
    if ((event.target as HTMLElement).closest("a, button")) return;
    deschide(id);
  };

  const seDeschide = (id: string) => pending && deschid === id;

  return (
    <>
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">Firmele din filtrele curente. Numele firmei deschide fișa cu detalii și cronologie.</caption>
          <thead>
            <tr className="border-b border-border text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
              <th scope="col" className="py-2 pl-3 pr-2 font-medium">Nr</th>
              <th scope="col" className="py-2 pr-2 font-medium">Nume</th>
              <th scope="col" className="py-2 pr-2 font-medium">Nișă</th>
              <th scope="col" className="py-2 pr-2 font-medium">Oraș</th>
              <th scope="col" className="py-2 pr-2 font-medium">Scor</th>
              <th scope="col" className="py-2 pr-2 font-medium">Etapă</th>
              <th scope="col" className="py-2 pr-2 font-medium">Canal</th>
              <th scope="col" className="py-2 pr-2 font-medium">Telefon</th>
              <th scope="col" className="py-2 pr-2 font-medium">Email</th>
              <th scope="col" className="py-2 pr-2 font-medium">Site demo</th>
              <th scope="col" className="py-2 pr-3 font-medium">Actualizată</th>
            </tr>
          </thead>
          <tbody>
            {firme.map((f) => {
              const demo = linkWeb(f.link_demo);
              const activ = selectatId === f.id;
              return (
                <tr
                  key={f.id}
                  onClick={(event) => peRand(event, f.id)}
                  aria-busy={seDeschide(f.id) || undefined}
                  className={cn("cursor-pointer border-b border-border/70 transition-colors last:border-0 hover:bg-white/[0.04]", activ && "bg-white/[0.05]")}
                >
                  <td className={cn("border-l-2 py-2.5 pl-2.5 pr-2 text-[11.5px] text-muted-foreground", etapaMeta(f).bara)}>
                    <span className="pu-num">{f.nr}</span>
                  </td>
                  <td className="max-w-[190px] py-2.5 pr-2">
                    <Link
                      href={hrefFirma(f.id)}
                      prefetch={false}
                      scroll={false}
                      onClick={(event) => peLink(event, f.id)}
                      aria-current={activ ? "true" : undefined}
                      className="flex min-w-0 items-center gap-1.5 rounded-sm text-[12.5px] font-medium hover:text-lav"
                    >
                      <span className="truncate">{f.nume}</span>
                      {seDeschide(f.id) ? (
                        <>
                          <Loader2 className="h-3 w-3 shrink-0 text-muted-foreground motion-safe:animate-spin" aria-hidden="true" />
                          <span className="sr-only">Se deschide fișa</span>
                        </>
                      ) : null}
                    </Link>
                    <p className="truncate font-mono text-[10.5px] text-muted-foreground">{f.domeniu}</p>
                  </td>
                  <td className="max-w-[130px] truncate py-2.5 pr-2 text-[11.5px]">{f.nisa ?? <span className="text-muted-foreground">—</span>}</td>
                  <td className="whitespace-nowrap py-2.5 pr-2 text-[11.5px]">
                    {f.oras ?? <span className="text-muted-foreground">—</span>}
                    {f.judet ? <span className="text-muted-foreground"> · {f.judet}</span> : null}
                  </td>
                  <td className="py-2.5 pr-2">
                    <span className={cn("pu-num text-[12.5px] font-medium", clasaScor(f.scor))}>{f.scor === null ? "—" : num(f.scor)}</span>
                  </td>
                  <td className="py-2.5 pr-2">
                    <StageBadge etapa={f.etapa} />
                  </td>
                  <td className="py-2.5 pr-2">
                    <CanalBadge canal={f.canal} />
                  </td>
                  <td className="whitespace-nowrap py-2.5 pr-2 text-[11.5px]">
                    {/* Text, nu link de apel: se sună doar din „Apeluri azi”, unde firma primește canalul. */}
                    {f.telefon ?? <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="max-w-[170px] truncate py-2.5 pr-2 text-[11.5px] text-muted-foreground">{f.email ?? "—"}</td>
                  <td className="py-2.5 pr-2">
                    {demo ? (
                      <a href={demo} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-sm text-[11.5px] text-lav hover:underline">
                        demo <ExternalLink className="h-3 w-3" aria-hidden="true" />
                        <span className="sr-only"> pentru {f.nume} (se deschide într-o filă nouă)</span>
                      </a>
                    ) : (
                      <span className="text-[11.5px] text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap py-2.5 pr-3 text-[11.5px] text-muted-foreground">
                    <time dateTime={f.actualizat_la} title={dateTimeRo(f.actualizat_la)}>
                      {relativeRo(f.actualizat_la, acum)}
                    </time>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ul className="space-y-2 p-3 lg:hidden">
        {firme.map((f) => {
          const activ = selectatId === f.id;
          const loc = [f.nisa, f.oras, f.scor === null ? null : `scor ${num(f.scor)}`].filter(Boolean).join(" · ");
          const contact = [f.telefon, f.email].filter((c): c is string => Boolean(c));
          return (
            <li key={f.id}>
              <Link
                href={hrefFirma(f.id)}
                prefetch={false}
                scroll={false}
                onClick={(event) => peLink(event, f.id)}
                aria-current={activ ? "true" : undefined}
                aria-busy={seDeschide(f.id) || undefined}
                className={cn("block w-full rounded-xl border border-l-2 border-border p-3 text-left transition-colors hover:bg-white/[0.04]", etapaMeta(f).bara, activ && "bg-white/[0.05]")}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium">{f.nume}</p>
                    {loc ? <p className="truncate text-[11px] text-muted-foreground">{loc}</p> : null}
                  </div>
                  <span className="pu-num flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
                    {seDeschide(f.id) ? (
                      <>
                        <Loader2 className="h-3 w-3 motion-safe:animate-spin" aria-hidden="true" />
                        <span className="sr-only">Se deschide fișa</span>
                      </>
                    ) : null}
                    #{f.nr}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <StageBadge etapa={f.etapa} />
                  <CanalBadge canal={f.canal} />
                </div>
                {contact.length ? (
                  <p className="mt-1.5 flex min-w-0 flex-wrap gap-x-2 text-[11px] text-muted-foreground">
                    {contact.map((c, i) => (
                      <span key={c} className="flex min-w-0 gap-x-2">
                        {i > 0 ? <span aria-hidden="true">·</span> : null}
                        <span className="truncate">{c}</span>
                      </span>
                    ))}
                  </p>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}

/** Tabelul n-a venit din bază: mesajul exact și „Încearcă din nou”, care recitește pagina. */
export function FirmeEroare({ mesaj }: { mesaj: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <ErrorState
      title="Tabelul nu s-a încărcat"
      text={mesaj}
      onRetry={() => startTransition(() => router.refresh())}
      retryLabel={pending ? "Se reîncearcă…" : "Încearcă din nou"}
    />
  );
}
