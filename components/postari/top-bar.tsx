"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { navItemFor } from "./nav";

/**
 * Bara de sus: numele ecranului și, pe orice ecran, starea cozii. O coadă
 * oprită se vede de oriunde, nu doar din ecranul cozii.
 */
export function PostariTopBar({ queue }: { queue: { running: boolean; reason: string | null } | null }) {
  const pathname = usePathname();
  const item = navItemFor(pathname);

  return (
    <div className="sticky top-0 z-30 border-b border-hair bg-char/95 backdrop-blur">
      <div className="flex min-h-[52px] flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 sm:px-6">
        <p className="text-[14px] font-semibold text-bone">{item?.label ?? "Postări"}</p>
        {queue ? (
          <Link
            href="/admin/postari"
            title={queue.running ? "Coada publică singură, la orele din plan." : (queue.reason ?? "Coada e oprită.")}
            className={cn(
              "ml-auto inline-flex min-h-9 items-center gap-2 rounded-lg px-2.5 text-[13px] font-semibold",
              queue.running ? "bg-[var(--ap-ok-soft)] text-[var(--ap-ok)]" : "bg-[var(--ap-warn-soft)] text-[var(--ap-warn)]"
            )}
          >
            <span aria-hidden className={cn("h-2 w-2 rounded-full", queue.running ? "bg-[var(--ap-ok)]" : "bg-[var(--ap-warn)]")} />
            {queue.running ? "Coada merge" : "Coada e oprită"}
          </Link>
        ) : null}
      </div>
    </div>
  );
}
