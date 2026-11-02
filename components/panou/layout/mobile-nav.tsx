"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { LogOut, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { Modal } from "../ui/modal";
import { activeModule, firmaModule, isItemActive, modules } from "./nav";

/**
 * Pe telefon: bară jos cu modulele și „Mai mult”, care deschide toate
 * ecranele, grupate pe module, cu Firma și ieșirea la sfârșit.
 *
 * Contrast (măsurat): textul inactiv, foreground/80 (#C3C2C2), are 11,1:1 pe bara
 * de jos (#0B0B0F) și 10,8:1 în foaia „Toate ecranele” (#101014); textul alb pe
 * fundalul elementului activ: 17:1 pe bară, 14,9:1 în foaie. Modulul activ: fundal, bară lav sus,
 * iconiță lav, text alb semibold.
 */
export function PanouMobileNav({ email, signOut }: { email: string | null; signOut?: () => Promise<void> }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const active = activeModule(pathname);

  return (
    <>
      <nav aria-label="Navigare principală" className="fixed inset-x-0 bottom-0 z-40 border-t border-white/[0.08] bg-[#0B0B0F]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
        <ul className="grid grid-cols-6">
          {modules.map((module) => {
            const isActive = module.id === active.id;
            return (
              <li key={module.id}>
                <Link
                  href={module.to}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "relative flex h-14 flex-col items-center justify-center gap-1 text-[10px] transition-colors",
                    isActive ? "bg-white/[0.07] font-semibold text-white" : "text-foreground/80 hover:text-white"
                  )}
                >
                  {isActive ? <span className="absolute inset-x-2.5 top-0 h-[3px] rounded-b-full bg-lav" aria-hidden="true" /> : null}
                  <module.icon className={cn("h-[18px] w-[18px]", isActive && "text-lav")} aria-hidden="true" />
                  <span className="max-w-full truncate px-1">{module.label}</span>
                </Link>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="flex h-14 w-full flex-col items-center justify-center gap-1 text-[10px] text-foreground/80 transition-colors hover:text-white"
              aria-haspopup="dialog"
            >
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
              <p className="px-2 py-1 text-[10.5px] font-medium uppercase tracking-[0.16em] text-foreground/70">{module.label}</p>
              {module.items.map((item) => {
                const isActive = module.id === active.id && isItemActive(pathname, item, module);
                return (
                  <Link
                    key={item.to}
                    href={item.to}
                    aria-current={isActive ? "page" : undefined}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "relative flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-[13px] transition-colors",
                      isActive ? "bg-lav/[0.13] pl-3 font-semibold text-white" : "text-foreground/80 hover:bg-white/[0.05] hover:text-white"
                    )}
                  >
                    {isActive ? <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-lav" aria-hidden="true" /> : null}
                    {item.label}
                  </Link>
                );
              })}
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
