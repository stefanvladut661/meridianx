"use client";

import { Fragment, useState, useTransition, type MouseEvent } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ExternalLink, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { dateTimeRo, num, relativeRo } from "@/components/panou/ui/format";
import { ErrorState } from "@/components/panou/ui/states";
import { ETAPE } from "@/lib/prospectare/labels";
import type { FirmaRand } from "@/lib/prospectare/types";
import { CanaleBadge, StageBadge } from "./stage-badge";
import { linkWeb } from "./firme-format";

/**
 * Tabelul firmelor, ca în Excel (pe tema închisă a adminului): celule conturate, antet plin și fix
 * sus, rânduri alternante, derulare în tabel. Prima coloană e numărul de site; numărul de cercetare
 * stă mic, sub nume. Un clic pe rând (sau pe nume, de la tastatură) pune `?firma=<id>` în adresă,
 * iar pagina de server deschide fișa. Sub 1024 px, rândurile devin carduri.
 */

const etapaMeta = (f: FirmaRand) => ETAPE[f.etapa] ?? ETAPE.cercetat;

const clasaScor = (scor: number | null) => (scor === null || scor < 60 ? "text-muted-foreground" : scor >= 85 ? "text-mint" : "");

/** Grupele ordinii implicite (migrarea 37): eticheta rândului cu care începe fiecare grupă. */
const GRUPE: Record<number, string> = {
  1: "Cu site, încă necontactate",
  2: "Cu site, contactate (email și/sau WhatsApp) sau închise",
  3: "Fără site publicat",
};

const TH = "sticky top-0 z-10 whitespace-nowrap border-b border-r border-white/[0.12] bg-[#22242F] px-2.5 py-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-foreground/90";
const TD = "border-b border-r border-white/[0.08] px-2.5 py-2 align-middle";

export function FirmeTabel({ firme, acum, selectatId, grupe = false }: { firme: FirmaRand[]; acum: number; selectatId: string | null; grupe?: boolean }) {
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
      {/* Derularea e în tabel, cu antetul fix; regiunea se poate focaliza ca să se deruleze și de la tastatură.
          `relative`: textele pentru cititoarele de ecran (absolute) rămân în regiune și nu lărgesc pagina. */}
      <div className="relative hidden max-h-[calc(100dvh-13rem)] min-h-[240px] overflow-auto lg:block" tabIndex={0} role="region" aria-label="Tabelul firmelor, cu derulare în interior">
        <table className="w-full min-w-[1180px] border-separate border-spacing-0 text-left text-[13.5px]">
          <caption className="sr-only">Firmele din filtrele curente. Numele firmei deschide fișa cu detalii și cronologie.</caption>
          <thead>
            <tr>
              <th scope="col" className={cn(TH, "w-[76px] border-l text-center")}>
                Nr site
              </th>
              <th scope="col" className={cn(TH, "text-left")}>
                Nume
              </th>
              <th scope="col" className={cn(TH, "text-left")}>
                Nișă
              </th>
              <th scope="col" className={cn(TH, "text-left")}>
                Oraș
              </th>
              <th scope="col" className={cn(TH, "w-[64px] text-center")}>
                Scor
              </th>
              <th scope="col" className={cn(TH, "text-center")}>
                Etapă
              </th>
              <th scope="col" className={cn(TH, "text-center")}>
                Canale
              </th>
              <th scope="col" className={cn(TH, "text-center")}>
                Telefon
              </th>
              <th scope="col" className={cn(TH, "text-left")}>
                Email
              </th>
              <th scope="col" className={cn(TH, "text-center")}>
                Site demo
              </th>
              <th scope="col" className={cn(TH, "text-center")}>
                Actualizată
              </th>
            </tr>
          </thead>
          <tbody>
            {firme.map((f, i) => {
              const demo = linkWeb(f.link_demo);
              const activ = selectatId === f.id;
              const grupaNoua = grupe && (i === 0 || firme[i - 1].grupa_tabel !== f.grupa_tabel) && Boolean(GRUPE[f.grupa_tabel]);
              return (
                <Fragment key={f.id}>
                  {grupaNoua ? (
                    <tr>
                      <th scope="colgroup" colSpan={11} className="border-b border-l border-r border-white/[0.12] bg-[#1A1C26] px-3 py-1.5 text-left text-[12.5px] font-semibold text-lav">
                        {GRUPE[f.grupa_tabel]}
                      </th>
                    </tr>
                  ) : null}
                  <tr
                    onClick={(event) => peRand(event, f.id)}
                    aria-busy={seDeschide(f.id) || undefined}
                    className={cn("cursor-pointer transition-colors hover:bg-lav/[0.09]", activ ? "bg-lav/[0.13]" : i % 2 === 0 ? "bg-white/[0.012]" : "bg-white/[0.045]")}
                  >
                    <td className={cn(TD, "border-l text-center")}>
                      {f.nr_site === null ? (
                        <span className="text-muted-foreground" title="Site-ul nu e încă publicat și verificat">
                          —
                        </span>
                      ) : (
                        <span className="pu-num text-[14px] font-semibold">{f.nr_site}</span>
                      )}
                    </td>
                    <td className={cn(TD, "max-w-[240px]")}>
                      <Link
                        href={hrefFirma(f.id)}
                        prefetch={false}
                        scroll={false}
                        onClick={(event) => peLink(event, f.id)}
                        aria-current={activ ? "true" : undefined}
                        className="flex min-w-0 items-center gap-1.5 rounded-sm text-[14px] font-medium hover:text-lav"
                      >
                        <span className="truncate">{f.nume}</span>
                        {seDeschide(f.id) ? (
                          <>
                            <Loader2 className="h-3 w-3 shrink-0 text-muted-foreground motion-safe:animate-spin" aria-hidden="true" />
                            <span className="sr-only">Se deschide fișa</span>
                          </>
                        ) : null}
                      </Link>
                      <p className="truncate text-[12px] text-muted-foreground">
                        <span className="pu-num" title="Numărul de cercetare">
                          #{f.nr}
                        </span>
                        <span aria-hidden="true"> · </span>
                        <span className="font-mono">{f.domeniu}</span>
                      </p>
                    </td>
                    <td className={cn(TD, "max-w-[150px] truncate")}>{f.nisa ?? <span className="text-muted-foreground">—</span>}</td>
                    <td className={cn(TD, "whitespace-nowrap")}>
                      {f.oras ?? <span className="text-muted-foreground">—</span>}
                      {f.judet ? <span className="text-muted-foreground"> · {f.judet}</span> : null}
                    </td>
                    <td className={cn(TD, "text-center")}>
                      <span className={cn("pu-num text-[14px] font-medium", clasaScor(f.scor))}>{f.scor === null ? "—" : num(f.scor)}</span>
                    </td>
                    <td className={cn(TD, "text-center")}>
                      <StageBadge etapa={f.etapa} />
                    </td>
                    <td className={cn(TD, "text-center")}>
                      <CanaleBadge firma={f} className="justify-center" />
                    </td>
                    <td className={cn(TD, "whitespace-nowrap text-center")}>
                      {/* Text, nu link de apel: se sună doar din „Apeluri azi”, unde firma intră pe telefon. */}
                      {f.telefon ?? <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className={cn(TD, "max-w-[190px] truncate text-muted-foreground")}>{f.email ?? "—"}</td>
                    <td className={cn(TD, "text-center")}>
                      {demo ? (
                        <a href={demo} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-sm text-lav hover:underline">
                          demo <ExternalLink className="h-3 w-3" aria-hidden="true" />
                          <span className="sr-only"> pentru {f.nume} (se deschide într-o filă nouă)</span>
                        </a>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className={cn(TD, "whitespace-nowrap text-center text-muted-foreground")}>
                      <time dateTime={f.actualizat_la} title={dateTimeRo(f.actualizat_la)}>
                        {relativeRo(f.actualizat_la, acum)}
                      </time>
                    </td>
                  </tr>
                </Fragment>
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
                    <p className="truncate text-[14.5px] font-medium">{f.nume}</p>
                    {loc ? <p className="truncate text-[12.5px] text-muted-foreground">{loc}</p> : null}
                  </div>
                  <span className="flex shrink-0 flex-col items-end gap-0.5 text-[12.5px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      {seDeschide(f.id) ? (
                        <>
                          <Loader2 className="h-3 w-3 motion-safe:animate-spin" aria-hidden="true" />
                          <span className="sr-only">Se deschide fișa</span>
                        </>
                      ) : null}
                      {f.nr_site === null ? null : (
                        <span className="pu-num rounded-md border border-white/[0.12] bg-white/[0.06] px-1.5 text-[13px] font-semibold text-foreground">Site {f.nr_site}</span>
                      )}
                    </span>
                    <span className="pu-num" title="Numărul de cercetare">
                      #{f.nr}
                    </span>
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <StageBadge etapa={f.etapa} />
                  <CanaleBadge firma={f} />
                </div>
                {contact.length ? (
                  <p className="mt-1.5 flex min-w-0 flex-wrap gap-x-2 text-[12.5px] text-muted-foreground">
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
