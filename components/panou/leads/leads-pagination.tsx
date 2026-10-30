"use client";

import { cn } from "@/lib/utils";
import { Btn, btnClass } from "../ui/primitives";
import { num } from "../ui/format";
import { NavLink } from "./nav-link";

/** Cel mult cinci numere de pagină, în jurul celei curente (prototipul le arăta mereu pe primele cinci). */
function windowOf(page: number, pageCount: number): number[] {
  const size = Math.min(5, pageCount);
  const start = Math.min(Math.max(1, page - 2), pageCount - size + 1);
  return Array.from({ length: size }, (_, index) => start + index);
}

/** Subsolul listei: „1-25 din 140”, Înapoi, numerele paginilor, Înainte. Paginarea e pe server, deci sunt linkuri adevărate. */
export function LeadsPagination({
  page,
  perPage,
  total,
  totalAll,
  pageCount,
  hrefFor,
}: {
  page: number;
  perPage: number;
  total: number;
  totalAll: number | null;
  pageCount: number;
  hrefFor: (page: number) => string;
}) {
  const pages = windowOf(page, pageCount);
  const first = (page - 1) * perPage + 1;
  const last = Math.min(page * perPage, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] px-4 py-3">
      <p className="pu-num text-[11.5px] text-muted-foreground">
        {total === 0 ? "0" : `${num(first)}-${num(last)}`} din {num(total)}
        {totalAll !== null && total !== totalAll ? <span className="text-muted-foreground/60"> (filtrat din {num(totalAll)})</span> : null}
      </p>
      <nav aria-label="Paginare" className="flex items-center gap-1.5">
          {page > 1 ? (
            <NavLink href={hrefFor(page - 1)} className={btnClass({ variant: "outline", size: "xs" })}>
              Înapoi
            </NavLink>
          ) : (
            <Btn size="xs" variant="outline" disabled>
              Înapoi
            </Btn>
          )}
          {pages[0] > 1 ? <span className="px-1 text-[11px] text-muted-foreground">1 …</span> : null}
          {pages.map((n) => (
            <NavLink
              key={n}
              href={hrefFor(n)}
              aria-current={n === page ? "page" : undefined}
              aria-label={`Pagina ${n}`}
              className={cn("pu-num flex h-7 min-w-7 items-center justify-center rounded-lg px-2 text-[11.5px]", n === page ? "bg-white/[0.11] text-foreground" : "text-muted-foreground hover:bg-white/[0.05]")}
            >
              {n}
            </NavLink>
          ))}
          {pages[pages.length - 1] < pageCount ? <span className="px-1 text-[11px] text-muted-foreground">… {pageCount}</span> : null}
          {page < pageCount ? (
            <NavLink href={hrefFor(page + 1)} className={btnClass({ variant: "outline", size: "xs" })}>
              Înainte
            </NavLink>
          ) : (
            <Btn size="xs" variant="outline" disabled>
              Înainte
            </Btn>
          )}
      </nav>
    </div>
  );
}
