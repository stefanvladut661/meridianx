import { Card } from "../ui/primitives";
import { LoadingRows, Skeleton } from "../ui/states";

/**
 * Scheletul unei pagini a panoului: ce se vede din clipa clicului până vin
 * datele de la server. Același la orice modul (titlul real e deja în bara de sus).
 */
export function PanouPageSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-9 w-32" />
      </div>
      <Card className="overflow-hidden" padded={false}>
        <div className="grid grid-cols-2 divide-x divide-y divide-white/[0.06] sm:grid-cols-4 sm:divide-y-0">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="space-y-3 p-4 sm:p-5">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-7 w-16" />
            </div>
          ))}
        </div>
      </Card>
      <Card className="overflow-hidden" padded={false}>
        <LoadingRows rows={7} cols={5} />
      </Card>
    </div>
  );
}
