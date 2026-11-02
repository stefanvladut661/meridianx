import Link from "next/link";
import { cn } from "@/lib/utils";
import { btnClass } from "@/components/panou/ui/primitives";
import { num } from "@/components/panou/ui/format";

/** Cel mult cinci numere de pagină, în jurul celei curente. */
function fereastra(pagina: number, pagini: number): number[] {
  const marime = Math.min(5, pagini);
  const start = Math.min(Math.max(1, pagina - 2), pagini - marime + 1);
  return Array.from({ length: marime }, (_, i) => start + i);
}

/**
 * Subsolul tabelului de firme: „51–100 din 1.240”, Înapoi, paginile, Înainte.
 * Paginarea e pe server (`?pagina=N`), deci sunt linkuri adevărate.
 */
export function FirmePaginare({ pagina, pePagina, total, hrefPagina }: { pagina: number; pePagina: number; total: number; hrefPagina: (pagina: number) => string }) {
  const pagini = Math.max(1, Math.ceil(total / pePagina));
  const prima = (pagina - 1) * pePagina + 1;
  const ultima = Math.min(pagina * pePagina, total);
  const numere = fereastra(Math.min(pagina, pagini), pagini);
  const oprit = btnClass({ variant: "outline", size: "xs", className: "pointer-events-none opacity-45" });

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] px-4 py-3">
      <p className="pu-num text-[11.5px] text-muted-foreground">
        {total === 0 ? "0" : `${num(prima)}–${num(ultima)}`} din {num(total)}
      </p>
      {pagini > 1 ? (
        <nav aria-label="Paginare" className="flex flex-wrap items-center gap-1.5">
          {pagina > 1 ? (
            <Link href={hrefPagina(pagina - 1)} prefetch={false} className={btnClass({ variant: "outline", size: "xs" })}>
              Înapoi
            </Link>
          ) : (
            <span aria-disabled="true" className={oprit}>
              Înapoi
            </span>
          )}
          {numere[0] > 1 ? <span className="px-1 text-[11px] text-muted-foreground">1 …</span> : null}
          {numere.map((n) => (
            <Link
              key={n}
              href={hrefPagina(n)}
              prefetch={false}
              aria-current={n === pagina ? "page" : undefined}
              aria-label={`Pagina ${n}`}
              className={cn("pu-num flex h-7 min-w-7 items-center justify-center rounded-lg px-2 text-[11.5px]", n === pagina ? "bg-white/[0.11] text-foreground" : "text-muted-foreground hover:bg-white/[0.05]")}
            >
              {n}
            </Link>
          ))}
          {numere[numere.length - 1] < pagini ? <span className="px-1 text-[11px] text-muted-foreground">… {pagini}</span> : null}
          {pagina < pagini ? (
            <Link href={hrefPagina(pagina + 1)} prefetch={false} className={btnClass({ variant: "outline", size: "xs" })}>
              Înainte
            </Link>
          ) : (
            <span aria-disabled="true" className={oprit}>
              Înainte
            </span>
          )}
        </nav>
      ) : null}
    </div>
  );
}
