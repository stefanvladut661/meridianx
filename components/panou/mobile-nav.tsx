"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { LogOut, MoreHorizontal, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { PANOU_MODULES, activeModule } from "./nav";

/**
 * Pe telefon: bară jos cu cele cinci module și „Mai mult”, care deschide toate
 * ecranele, grupate pe module, plus ieșirea.
 */
export function PanouMobileNav({ email, googleTools, signOut }: { email: string | null; googleTools: boolean; signOut: () => Promise<void> }) {
  const pathname = usePathname();
  const active = activeModule(pathname);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    dialog.current?.close();
  }, [pathname]);

  return (
    <>
      <nav
        aria-label="Navigare principală"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-hair bg-[var(--ap-side)]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
      >
        <ul className="grid grid-cols-6">
          {PANOU_MODULES.map((module) => {
            const isActive = module.id === active.id;
            return (
              <li key={module.id}>
                <Link
                  href={module.href}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "flex min-h-14 flex-col items-center justify-center gap-1 text-[10px] transition-colors",
                    isActive ? "text-[var(--md-a1)]" : "text-dim"
                  )}
                >
                  <module.icon className="h-[18px] w-[18px]" aria-hidden="true" />
                  <span className="truncate px-0.5">{module.label}</span>
                </Link>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              onClick={() => dialog.current?.showModal()}
              aria-haspopup="dialog"
              className="flex min-h-14 w-full flex-col items-center justify-center gap-1 text-[10px] text-dim"
            >
              <MoreHorizontal className="h-[18px] w-[18px]" aria-hidden="true" />
              <span>Mai mult</span>
            </button>
          </li>
        </ul>
      </nav>

      <dialog
        ref={dialog}
        aria-label="Toate ecranele"
        className="m-0 mt-auto max-h-[86dvh] w-full max-w-none overflow-y-auto rounded-t-[22px] border border-hair-strong bg-char p-0 text-bone backdrop:bg-black/60"
        onClick={(event) => {
          if (event.target === dialog.current) dialog.current?.close();
        }}
      >
        <div className="flex items-center justify-between border-b border-hair px-5 py-4">
          <p className="text-[15px] font-semibold">Toate ecranele</p>
          <button
            type="button"
            onClick={() => dialog.current?.close()}
            className="grid h-10 w-10 place-items-center rounded-lg text-dim hover:bg-white/[0.07]"
          >
            <X className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only">Închide</span>
          </button>
        </div>
        <div className="px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-2">
          {PANOU_MODULES.map((module) => {
            const items = module.items(googleTools);
            return (
              <div key={module.id} className="mb-2">
                <Link
                  href={module.href}
                  className="flex min-h-11 items-center gap-2.5 rounded-lg px-2 text-[10.5px] uppercase tracking-[0.16em] text-dim hover:text-bone"
                >
                  <module.icon className="h-3.5 w-3.5" aria-hidden="true" />
                  {module.label}
                </Link>
                {items.map((item) => (
                  <Link
                    key={item.key}
                    href={item.href}
                    aria-current={item.match.test(pathname) ? "page" : undefined}
                    className={cn(
                      "flex min-h-11 items-center rounded-lg px-3 text-[14px]",
                      item.match.test(pathname) ? "bg-white/[0.08] text-bone" : "text-bone/70"
                    )}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            );
          })}
          <div className="mt-2 border-t border-hair pt-3">
            <p className="truncate px-2 font-md-mono text-[11px] text-dim">{email ?? "fără email"}</p>
            <form action={signOut}>
              <button type="submit" className="mt-1 flex min-h-11 w-full items-center gap-2 rounded-lg px-2 text-left text-[14px] text-[var(--ap-error)]">
                <LogOut className="h-4 w-4" aria-hidden="true" />
                Ieși din cont
              </button>
            </form>
          </div>
        </div>
      </dialog>
    </>
  );
}
