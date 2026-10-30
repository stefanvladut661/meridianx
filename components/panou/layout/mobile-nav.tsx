"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { LogOut, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { Modal } from "../ui/modal";
import { firmaModule, modules } from "./nav";

const underPath = (pathname: string, path: string): boolean => pathname === path || pathname.startsWith(`${path}/`);

/**
 * Pe telefon: bară jos cu cele patru module și „Mai mult”, care deschide toate
 * ecranele, grupate pe module, cu Firma și ieșirea la sfârșit.
 */
export function PanouMobileNav({ email, signOut }: { email: string | null; signOut?: () => Promise<void> }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      <nav aria-label="Navigare principală" className="fixed inset-x-0 bottom-0 z-40 border-t border-white/[0.08] bg-[#0B0B0F]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
        <ul className="grid grid-cols-5">
          {modules.map((module) => {
            const isActive = module.to === "/admin" ? pathname === "/admin" : underPath(pathname, module.to);
            return (
              <li key={module.id}>
                <Link
                  href={module.to}
                  aria-current={isActive ? "page" : undefined}
                  className={cn("flex h-14 flex-col items-center justify-center gap-1 text-[10px] transition-colors", isActive ? "text-lav" : "text-muted-foreground")}
                >
                  <module.icon className="h-[18px] w-[18px]" aria-hidden="true" />
                  <span className="truncate px-1">{module.label}</span>
                </Link>
              </li>
            );
          })}
          <li>
            <button type="button" onClick={() => setOpen(true)} className="flex h-14 w-full flex-col items-center justify-center gap-1 text-[10px] text-muted-foreground" aria-haspopup="dialog">
              <MoreHorizontal className="h-[18px] w-[18px]" aria-hidden="true" />
              <span>Mai mult</span>
            </button>
          </li>
        </ul>
      </nav>

      <Modal open={open} onOpenChange={setOpen} label="Toate ecranele" className="m-0 mt-auto max-h-[86dvh] w-full overflow-y-auto rounded-b-none rounded-t-[22px] border-white/[0.1] bg-[#101014] p-0 sm:m-auto sm:max-w-md sm:rounded-[22px]">
        <h2 className="px-5 pb-2 pt-5 text-[15px] font-semibold">Toate ecranele</h2>
        <div className="px-3 pb-3">
          {[...modules, firmaModule].map((module) => (
            <div key={module.id} className="mb-2">
              <p className="px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{module.label}</p>
              {module.items.map((item) => (
                <Link
                  key={item.to}
                  href={item.to}
                  onClick={() => setOpen(false)}
                  className={cn("flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-[13px]", pathname === item.to ? "bg-white/[0.08] text-foreground" : "text-foreground/70")}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          ))}
          <div className="mt-2 border-t border-white/[0.07] pt-3">
            <p className="truncate px-2 text-[12px] text-muted-foreground">{email ?? "cont fără email"}</p>
            {signOut ? (
              <form action={signOut}>
                <button type="submit" className="mt-1 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-[13px] text-rose">
                  <LogOut className="h-3.5 w-3.5" aria-hidden="true" /> Ieși din cont
                </button>
              </form>
            ) : null}
          </div>
        </div>
      </Modal>
    </>
  );
}
