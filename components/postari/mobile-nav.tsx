"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { IconAds, IconClose, IconFirma, IconLeads, IconLogout, IconMore } from "./icons";
import { visiblePostariNav } from "./nav";

/**
 * Pe telefon: o bară jos cu ecranele de zi cu zi (coada, „De publicat pe
 * TikTok”, planul nou, clipurile) și „Mai mult” (restul, celelalte unelte,
 * ieșirea), ca la firmă și la reclame.
 */
export function PostariMobileNav({ signOut }: { signOut: () => Promise<void> }) {
  const pathname = usePathname();
  const items = visiblePostariNav();
  const first = items.filter((item) => item.mobile !== null).sort((a, b) => (a.mobile ?? 0) - (b.mobile ?? 0)).slice(0, 4);
  const rest = items.filter((item) => !first.includes(item));
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    dialog.current?.close();
  }, [pathname]);

  const rowClass = "flex min-h-12 items-center gap-3 rounded-lg px-3 text-[15px] text-bone hover:bg-[var(--ap-hover)]";

  return (
    <>
      <nav aria-label="Postări" className="fixed inset-x-0 bottom-0 z-40 border-t border-hair bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        <ul className="grid" style={{ gridTemplateColumns: `repeat(${first.length + 1}, minmax(0, 1fr))` }}>
          {first.map((item) => {
            const active = item.match.test(pathname);
            return (
              <li key={item.key}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn("flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium", active ? "text-[var(--md-a1)]" : "text-dim")}
                >
                  {item.icon}
                  {item.short}
                </Link>
              </li>
            );
          })}
          <li>
            <button type="button" onClick={() => dialog.current?.showModal()} className="flex min-h-14 w-full flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-dim">
              <IconMore />
              Mai mult
            </button>
          </li>
        </ul>
      </nav>

      <dialog
        ref={dialog}
        aria-label="Mai mult"
        className="m-0 mt-auto w-full max-w-none rounded-t-2xl border border-hair bg-white p-0 text-bone backdrop:bg-black/30"
        onClick={(event) => {
          if (event.target === dialog.current) dialog.current?.close();
        }}
      >
        <div className="flex items-center justify-between border-b border-hair px-4 py-3">
          <p className="text-[15px] font-semibold">Mai mult</p>
          <button type="button" onClick={() => dialog.current?.close()} className="grid h-10 w-10 place-items-center rounded-lg text-dim hover:bg-[var(--ap-hover)]">
            <IconClose />
            <span className="sr-only">Închide</span>
          </button>
        </div>
        <ul className="grid gap-0.5 p-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
          {rest.map((item) => (
            <li key={item.key}>
              <Link href={item.href} className={rowClass}>
                <span className="text-dim">{item.icon}</span>
                {item.label}
              </Link>
            </li>
          ))}
          <li>
            <Link href="/admin/ads" className={rowClass}>
              <span className="text-dim">
                <IconAds />
              </span>
              Reclame
            </Link>
          </li>
          <li>
            <Link href="/admin/firma" className={rowClass}>
              <span className="text-dim">
                <IconFirma />
              </span>
              Firmă
            </Link>
          </li>
          <li>
            <Link href="/admin" className={rowClass}>
              <span className="text-dim">
                <IconLeads />
              </span>
              Lead-uri
            </Link>
          </li>
          <li>
            <form action={signOut}>
              <button type="submit" className={cn(rowClass, "w-full")}>
                <span className="text-dim">
                  <IconLogout />
                </span>
                Ieși
              </button>
            </form>
          </li>
        </ul>
      </dialog>
    </>
  );
}
