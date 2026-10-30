"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconFilm } from "@/components/postari/icons";
import { Mark } from "@/components/site/mark";
import { cn } from "@/lib/utils";
import { IconClients, IconLeads, IconLogout } from "./icons";
import { visibleNav } from "./nav-items";

/**
 * Meniul din stânga (de la 1024 px în sus): îngust, cu iconițe și nume. Jos,
 * ce nu ține de reclame în sine: clienții, panoul de lead-uri, ieșirea.
 */
export function Sidebar({
  email,
  googleTools,
  signOut,
}: {
  email: string | null;
  googleTools: boolean;
  signOut: () => Promise<void>;
}) {
  const pathname = usePathname();
  const items = visibleNav(googleTools);

  const linkClass = (active: boolean) =>
    cn(
      "flex min-h-10 items-center gap-3 rounded-lg px-3 text-[14px] font-medium transition-colors duration-150",
      active ? "bg-[var(--ap-accent-soft)] text-[var(--ap-accent-ink)]" : "text-bone/80 hover:bg-[var(--ap-hover)] hover:text-bone"
    );

  return (
    <aside className="sticky top-0 hidden h-dvh flex-col border-r border-hair bg-[var(--ap-side)] px-3 py-4 lg:flex">
      <Link href="/admin/ads" className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-bone">
        <Mark size={22} />
        <span className="font-md-display text-[14px] font-semibold tracking-[0.2em]">MERIDIAN</span>
      </Link>
      <p className="mt-1 px-3 text-[12px] text-dim">Reclame</p>

      <nav aria-label="Reclame" className="mt-5">
        <ul className="grid gap-0.5">
          {items.map((item) => {
            const active = item.match.test(pathname);
            return (
              <li key={item.key}>
                <Link href={item.href} prefetch={item.noPrefetch ? false : undefined} aria-current={active ? "page" : undefined} className={linkClass(active)}>
                  <span className={active ? "text-[var(--md-a1)]" : "text-dim"}>{item.icon}</span>
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="mt-auto grid gap-0.5 border-t border-hair pt-3">
        <Link href="/admin/ads/clienti" aria-current={pathname.startsWith("/admin/ads/clienti") ? "page" : undefined} className={linkClass(pathname.startsWith("/admin/ads/clienti"))}>
          <span className="text-dim">
            <IconClients />
          </span>
          Clienți
        </Link>
        <Link href="/admin/postari" className={linkClass(false)}>
          <span className="text-dim">
            <IconFilm />
          </span>
          Postări
        </Link>
        <Link href="/admin" className={linkClass(false)}>
          <span className="text-dim">
            <IconLeads />
          </span>
          Lead-uri
        </Link>
        <form action={signOut}>
          <button type="submit" className={cn(linkClass(false), "w-full")}>
            <span className="text-dim">
              <IconLogout />
            </span>
            Ieși
          </button>
        </form>
        {email ? <p className="truncate px-3 pt-2 font-md-mono text-[11px] text-dim">{email}</p> : null}
      </div>
    </aside>
  );
}
