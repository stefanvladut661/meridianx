"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { Mark } from "@/components/site/mark";
import { useScrolled } from "@/components/site/motion";
import { CONTACT, NAV } from "@/components/site/video-content";
import { ArrowUpRight, Icon } from "./ui";
import s from "./home2.module.css";

/* ============================================================
   Meniul de sus al paginii /home-2 — componentă nouă; meniul de pe
   /video rămâne neatins.

   Ca în poza cu hero-ul: logo în stânga, linkurile la mijloc, două
   butoane în dreapta. Linkurile sunt cele de acum de pe /video, plus
   trecerea spre software, care acolo stă în colțul din dreapta sus.
   În locul lui „Sign in” stă „Sună acum” — clientul de video preferă
   vocea (CLAUDE.md §8) —, iar în locul lui „Try now”, „Cere ofertă”.
   ============================================================ */

/* Ancorele merg cu <a>; rutele trec prin <Link>-ul de i18n. */
function NavLink({
  href,
  className,
  onClick,
  children,
}: {
  href: string;
  className: string;
  onClick?: () => void;
  children: ReactNode;
}) {
  if (href.startsWith("#")) {
    return (
      <a href={href} className={className} onClick={onClick}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={className} onClick={onClick}>
      {children}
    </Link>
  );
}

export function Nav() {
  const scrolled = useScrolled(12);
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  /* Meniul de telefon: Escape îl închide și întoarce focusul pe buton;
     clicul în afara lui la fel. Primul link primește focusul. */
  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector<HTMLElement>("a, button")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        btnRef.current?.focus();
      }
    };
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!menuRef.current?.contains(t) && !btnRef.current?.contains(t)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <header className={s.nav} data-scrolled={scrolled || open ? "" : undefined}>
      <nav aria-label="Principal" className={s.container}>
        <div className={s.navRow}>
          <Link href="/" className="flex shrink-0 items-center gap-2.5 text-white">
            <Mark size={24} />
            <span className="text-[15px] font-semibold tracking-[0.16em]">MERIDIAN</span>
          </Link>

          <ul className="hidden items-center lg:flex">
            {NAV.map((n) => (
              <li key={n.href}>
                <NavLink href={n.href} className={s.navLink}>
                  {n.label}
                </NavLink>
              </li>
            ))}
            <li>
              <Link href="/software" className={s.navLink}>
                Software
                <ArrowUpRight size={14} />
              </Link>
            </li>
          </ul>

          <div className="flex shrink-0 items-center gap-2">
            <a href={CONTACT.phoneHref} className={`${s.navBtn} ${s.navBtnDark} !hidden sm:!inline-flex`}>
              <Icon name="phone" size={14} />
              {/* Între 1024 și 1280 bara are toate linkurile pe un rând;
                  acolo butonul rămâne doar iconiță, cu numele pentru
                  cititoarele de ecran. */}
              <span className="lg:max-xl:sr-only">Sună acum</span>
            </a>
            <a href="#contact" className={`${s.navBtn} ${s.navBtnLight}`}>
              Cere ofertă
            </a>
            <button
              ref={btnRef}
              type="button"
              className={`${s.burger} lg:!hidden`}
              aria-expanded={open}
              aria-controls={menuId}
              onClick={() => setOpen((o) => !o)}
            >
              <span className="sr-only">{open ? "Închide meniul" : "Deschide meniul"}</span>
              <span aria-hidden className="relative block h-3 w-4">
                <span
                  className="absolute inset-x-0 top-0 h-px bg-current transition-transform duration-300"
                  style={{ transform: open ? "translateY(6px) rotate(45deg)" : undefined }}
                />
                <span
                  className="absolute inset-x-0 top-1.5 h-px bg-current transition-opacity duration-300"
                  style={{ opacity: open ? 0 : 1 }}
                />
                <span
                  className="absolute inset-x-0 top-3 h-px bg-current transition-transform duration-300"
                  style={{ transform: open ? "translateY(-6px) rotate(-45deg)" : undefined }}
                />
              </span>
            </button>
          </div>
        </div>

        {open && (
          <div ref={menuRef} id={menuId} className={`${s.menu} mb-3 lg:hidden`}>
            <ul>
              {NAV.map((n) => (
                <li key={n.href}>
                  <NavLink href={n.href} onClick={close} className={s.menuLink}>
                    {n.label}
                  </NavLink>
                </li>
              ))}
              <li>
                <Link href="/software" onClick={close} className={s.menuLink}>
                  Software
                  <ArrowUpRight size={15} />
                </Link>
              </li>
              <li className="mt-2 border-t border-hair pt-2">
                <a href={CONTACT.phoneHref} className={s.menuLink}>
                  <Icon name="phone" size={16} />
                  {CONTACT.phone}
                </a>
              </li>
              <li>
                <a href={CONTACT.whatsapp} className={s.menuLink}>
                  <Icon name="whatsapp" size={16} />
                  WhatsApp
                </a>
              </li>
            </ul>
          </div>
        )}
      </nav>
    </header>
  );
}
