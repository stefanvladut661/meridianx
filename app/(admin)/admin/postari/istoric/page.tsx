import type { Metadata } from "next";
import Link from "next/link";
import { readHistory } from "@/lib/postari/istoric";
import { isZona, ZONA_LABEL, ZONE } from "@/lib/postari/istoric-shared";
import { momentLabel } from "@/lib/postari/timp";
import { cn } from "@/lib/utils";
import { Empty, Notice, PageHead, Tag, tdClass, thClass } from "@/components/postari/ui";

export const metadata: Metadata = { title: "Istoric — MERIDIAN Postări", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const REZULTAT = { ok: { tone: "ok", label: "Reușit" }, eroare: { tone: "error", label: "Eroare" }, sarit: { tone: "muted", label: "Sărit" } } as const;

const chip = (active: boolean) =>
  cn("rounded-lg border px-3 py-1.5 text-[13.5px]", active ? "border-[var(--md-a1)] bg-[var(--ap-accent-soft)] text-[var(--ap-accent-ink)]" : "border-hair-strong text-bone/80 hover:bg-[var(--ap-hover)]");

/** /admin/postari/istoric — fiecare acțiune a modulului: cine, ce, când, rezultatul. */
export default async function IstoricPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const zona = typeof params.zona === "string" && isZona(params.zona) ? params.zona : null;
  const tinta = typeof params.tinta === "string" && params.tinta.length <= 200 ? params.tinta : null;
  const history = await readHistory({ zona, tinta, limit: 300 });

  return (
    <main className="px-4 pb-16 pt-6 sm:px-6">
      <PageHead title="Istoric" subtitle="Tot ce a făcut modulul — de tine sau de coadă — cu rezultatul fiecărei acțiuni. Ultimele 300." />
      <nav aria-label="Zona" className="mt-5 flex flex-wrap gap-1.5">
        <Link href="/admin/postari/istoric" aria-current={zona === null && !tinta ? "page" : undefined} className={chip(zona === null && !tinta)}>
          Toate
        </Link>
        {ZONE.map((item) => (
          <Link key={item} href={`/admin/postari/istoric?zona=${item}`} aria-current={zona === item ? "page" : undefined} className={chip(zona === item)}>
            {ZONA_LABEL[item]}
          </Link>
        ))}
      </nav>
      {tinta ? (
        <p className="mt-3 text-[13.5px] text-dim">
          Doar pentru o postare. <Link href="/admin/postari/istoric" className="font-medium text-[var(--md-a1)] underline underline-offset-2">Arată tot</Link>
        </p>
      ) : null}

      {!history.ok ? (
        <Notice tone="error" className="mt-5">
          {history.message}
        </Notice>
      ) : history.data.length === 0 ? (
        <Empty className="mt-5">Nicio acțiune încă{zona ? ` în ${ZONA_LABEL[zona]}` : ""}. Ce faci în modul și ce face coada apar aici, cu rezultatul.</Empty>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-hair bg-char">
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
                  <td className={cn(tdClass, "whitespace-nowrap text-[13px] text-dim")}>{momentLabel(row.createdAt)}</td>
                  <td className={cn(tdClass, "text-[13px]")}>{row.actor}</td>
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
