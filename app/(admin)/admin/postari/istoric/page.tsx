import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, History as HistoryIcon, MinusCircle, XCircle } from "lucide-react";
import { readHistory } from "@/lib/postari/istoric";
import { isZona, ZONA_LABEL, ZONE } from "@/lib/postari/istoric-shared";
import { cn } from "@/lib/utils";
import { InlineNote } from "@/components/panou/ui/actions";
import { dateTimeRo } from "@/components/panou/ui/format";
import { Card, Pill, type PillTone } from "@/components/panou/ui/primitives";
import { EmptyState, ErrorState } from "@/components/panou/ui/states";
import { ScreenHead } from "@/components/panou/postari/shared";

export const metadata: Metadata = { title: "Istoric — MERIDIAN Postări", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const RESULT: Record<"ok" | "eroare" | "sarit", { tone: PillTone; label: string; box: string }> = {
  ok: { tone: "mint", label: "Reușit", box: "border-mint/25 bg-mint/10 text-mint" },
  eroare: { tone: "rose", label: "Eroare", box: "border-rose/25 bg-rose/10 text-rose" },
  sarit: { tone: "neutral", label: "Sărit", box: "border-white/[0.1] bg-white/[0.04] text-muted-foreground" },
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const chip = (active: boolean) =>
  cn("whitespace-nowrap rounded-full px-3 py-1.5 text-[12.5px] font-medium transition-colors", active ? "bg-white/[0.11] text-foreground shadow-[0_1px_0_rgba(255,255,255,0.07)_inset]" : "text-muted-foreground hover:text-foreground");

/** /admin/postari/istoric — fiecare acțiune a modulului: cine, ce, când, rezultatul. Ultimele 300. */
export default async function IstoricPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const zona = typeof params.zona === "string" && isZona(params.zona) ? params.zona : null;
  const tinta = typeof params.tinta === "string" && params.tinta.length <= 200 ? params.tinta : null;
  const history = await readHistory({ zona, tinta, limit: 300 });

  return (
    <div className="space-y-4">
      <ScreenHead title="Istoric" text="Fiecare aprobare, rulare și eșec, cu ora României. Aici se vede cine a făcut ce. Ultimele 300." />

      <nav aria-label="Zona" className="pu-no-scrollbar max-w-full overflow-x-auto">
        <div className="inline-flex items-center gap-1 rounded-full border border-white/[0.07] bg-white/[0.03] p-1">
          <Link href="/admin/postari/istoric" aria-current={zona === null && !tinta ? "page" : undefined} className={chip(zona === null && !tinta)}>
            Toate
          </Link>
          {ZONE.map((item) => (
            <Link key={item} href={`/admin/postari/istoric?zona=${item}`} aria-current={zona === item && !tinta ? "page" : undefined} className={chip(zona === item && !tinta)}>
              {ZONA_LABEL[item]}
            </Link>
          ))}
        </div>
      </nav>

      {tinta ? (
        <InlineNote tone="neutral">
          Doar pentru o postare.{" "}
          <Link href="/admin/postari/istoric" className="font-medium text-foreground underline underline-offset-2">
            Arată tot
          </Link>
        </InlineNote>
      ) : null}

      <Card className="overflow-hidden p-0">
        {!history.ok ? (
          <ErrorState title="Nu am putut citi istoricul" text={history.message} />
        ) : history.data.length === 0 ? (
          <EmptyState
            icon={HistoryIcon}
            title="Nicio rulare încă"
            text={`Nicio acțiune încă${zona ? ` în ${ZONA_LABEL[zona]}` : ""}. După primul plan aprobat, fiecare rulare apare aici cu rezultatul ei.`}
          />
        ) : (
          <ul className="divide-y divide-white/[0.05]">
            {history.data.map((row) => {
              const result = RESULT[row.rezultat];
              const Icon = row.rezultat === "ok" ? CheckCircle2 : row.rezultat === "eroare" ? XCircle : MinusCircle;
              return (
                <li key={row.id} className="flex flex-wrap items-start gap-3 px-4 py-3">
                  <span className={cn("mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border", result.box)}>
                    <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[12.5px]">
                      <span className="font-medium">{row.actiune}</span>
                      {row.mesaj ? <span className="text-foreground/75"> — {row.mesaj}</span> : null}
                    </p>
                    <p className="text-[10.5px] text-muted-foreground">
                      {ZONA_LABEL[row.zona]} · {row.actor} · {dateTimeRo(row.createdAt)}
                      {row.tinta && UUID.test(row.tinta) ? (
                        <>
                          {" · "}
                          <Link href={`/admin/postari/istoric?tinta=${row.tinta}`} className="underline underline-offset-2 hover:text-foreground">
                            doar această postare
                          </Link>
                        </>
                      ) : null}
                    </p>
                  </div>
                  <Pill tone={result.tone}>{result.label}</Pill>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
