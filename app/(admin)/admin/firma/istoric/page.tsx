import type { Metadata } from "next";
import Link from "next/link";
import { readHistory } from "@/lib/firma/istoric";
import { isZona, ZONA_LABEL, ZONE } from "@/lib/firma/istoric-shared";
import { dateTimeLabel } from "@/lib/firma/format";
import { cn } from "@/lib/utils";
import { Empty, Notice, PageHead, Tag, tdClass, thClass } from "@/components/firma/ui";

export const metadata: Metadata = { title: "Istoric — MERIDIAN Firmă", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const REZULTAT = { ok: { tone: "ok", label: "Reușit" }, eroare: { tone: "error", label: "Eroare" }, sarit: { tone: "muted", label: "Sărit" } } as const;

/** /admin/firma/istoric — fiecare acțiune a modulului: cine, ce, când, rezultatul. */
export default async function IstoricPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const zona = typeof params.zona === "string" && isZona(params.zona) ? params.zona : null;
  const history = await readHistory({ zona, limit: 300 });

  return (
    <main className="px-4 pb-16 pt-6 sm:px-6">
      <PageHead title="Istoric" subtitle="Tot ce a făcut adminul firmei — de tine sau de joburile programate — cu rezultatul fiecărei acțiuni. Ultimele 300." />
      <nav aria-label="Zona" className="mt-5 flex flex-wrap gap-1.5">
        <Link href="/admin/firma/istoric" aria-current={zona === null ? "page" : undefined} className={cn("rounded-lg border px-3 py-1.5 text-[13.5px]", zona === null ? "border-[var(--md-a1)] bg-[var(--ap-accent-soft)] text-[var(--ap-accent-ink)]" : "border-hair-strong text-bone/80 hover:bg-[var(--ap-hover)]")}>
          Toate
        </Link>
        {ZONE.map((item) => (
          <Link
            key={item}
            href={`/admin/firma/istoric?zona=${item}`}
            aria-current={zona === item ? "page" : undefined}
            className={cn("rounded-lg border px-3 py-1.5 text-[13.5px]", zona === item ? "border-[var(--md-a1)] bg-[var(--ap-accent-soft)] text-[var(--ap-accent-ink)]" : "border-hair-strong text-bone/80 hover:bg-[var(--ap-hover)]")}
          >
            {ZONA_LABEL[item]}
          </Link>
        ))}
      </nav>

      {!history.ok ? (
        <Notice tone="error" className="mt-5">
          {history.message}
        </Notice>
      ) : history.data.length === 0 ? (
        <Empty className="mt-5">Nicio acțiune încă{zona ? ` în ${ZONA_LABEL[zona]}` : ""}. Ce faci în modul apare aici, cu rezultatul.</Empty>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-hair bg-white">
          <table className="ads-table min-w-full border-collapse">
            <thead>
              <tr className="border-b border-hair">
                <th className={thClass}>Când</th>
                <th className={thClass}>Cine</th>
                <th className={thClass}>Zona</th>
                <th className={thClass}>Ce</th>
                <th className={thClass}>Rezultat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hair">
              {history.data.map((row) => (
                <tr key={row.id}>
                  <td className={cn(tdClass, "whitespace-nowrap text-[13px] text-dim")}>{dateTimeLabel(row.createdAt)}</td>
                  <td className={cn(tdClass, "text-[13px]")}>{row.actor === "cron" ? "job programat" : row.actor}</td>
                  <td className={cn(tdClass, "text-[13px]")}>{ZONA_LABEL[row.zona]}</td>
                  <td className={cn(tdClass, "min-w-[16rem]")}>
                    <p className="font-medium">{row.actiune}</p>
                    {row.mesaj ? <p className="mt-0.5 text-[13px] text-dim">{row.mesaj}</p> : null}
                  </td>
                  <td className={tdClass}>
                    <Tag tone={REZULTAT[row.rezultat].tone}>{REZULTAT[row.rezultat].label}</Tag>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
