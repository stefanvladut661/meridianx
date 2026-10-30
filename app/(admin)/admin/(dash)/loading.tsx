import { Card } from "@/components/panou/ui/primitives";
import { LoadingRows, Skeleton } from "@/components/panou/ui/states";

/** Cât citește serverul lista (la intrarea pe ecran din alt modul): scheletul antetului, al indicatorilor și al listei, ca în prototip. */
export default function LeadsLoading() {
  return (
    <div className="space-y-4" aria-busy="true">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold leading-none sm:text-[26px]">Lead-uri</h1>
          <p className="mt-2 text-[12.5px] text-muted-foreground">Se încarcă lead-urile…</p>
        </div>
        <Skeleton className="h-8 w-44" />
      </div>
      <Card className="overflow-hidden p-0">
        <div className="grid grid-cols-2 divide-x divide-y divide-white/[0.06] sm:grid-cols-3 sm:divide-y-0 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="space-y-3 p-4 sm:p-5">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-7 w-16" />
              <Skeleton className="h-3 w-28" />
            </div>
          ))}
        </div>
      </Card>
      <Card className="overflow-hidden p-0">
        <LoadingRows rows={8} cols={6} />
      </Card>
    </div>
  );
}
