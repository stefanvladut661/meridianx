import { Link } from "@/i18n/navigation";
import { Mark } from "@/components/site/mark";
import { LEGAL_LINKS } from "@/components/site/legal-links";
import { CONTACT, NAV, VERTICALS } from "@/components/site/video-content";
import { ArrowUpRight, Icon } from "./ui";
import s from "./home2.module.css";

/* ============================================================
   Subsolul /home-2 — conținutul subsolului de pe /video (descrierea,
   WhatsApp și telefonul, navigarea, industriile, documentele legale,
   numele mare de la final), în stilul paginii noi. Componentă nouă;
   subsolul de pe /video rămâne neatins.
   ============================================================ */

export function Footer() {
  return (
    <footer className={s.foot}>
      <div className={`${s.container} ${s.footGrid}`}>
        <div>
          <span className="flex items-center gap-2.5 text-white">
            <Mark size={24} />
            <span className="text-[15px] font-semibold tracking-[0.16em]">MERIDIAN</span>
          </span>
          <p className="mt-4 max-w-xs text-[15px] leading-relaxed text-dim">
            Producție video și campanii plătite, sub același acoperiș. Partener pe termen
            lung, nu furnizor de proiect.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <a href={CONTACT.whatsapp} className={`${s.navBtn} ${s.navBtnDark} !h-10 !px-4`}>
              <Icon name="whatsapp" size={15} />
              WhatsApp
            </a>
            <a href={CONTACT.phoneHref} className={`${s.navBtn} ${s.navBtnDark} !h-10 !px-4`}>
              <Icon name="phone" size={14} />
              Sună
            </a>
          </div>
        </div>

        <nav aria-label="Navigare">
          <p className={s.footHead}>Navigare</p>
          <ul className="mt-4 space-y-2.5">
            {NAV.map((n) => (
              <li key={n.href}>
                {n.href.startsWith("#") ? (
                  <a href={n.href} className={s.footLink}>
                    {n.label}
                  </a>
                ) : (
                  <Link href={n.href} className={s.footLink}>
                    {n.label}
                  </Link>
                )}
              </li>
            ))}
            <li>
              <Link href="/software" className={`${s.footLink} inline-flex items-center gap-1`}>
                Software
                <ArrowUpRight size={14} />
              </Link>
            </li>
          </ul>
        </nav>

        <div>
          <p className={s.footHead}>Industrii</p>
          <ul className="mt-4 space-y-2.5">
            {VERTICALS.map((v) => (
              <li key={v.key} className="text-[14.5px] text-dim">
                {v.label}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className={s.container}>
        <div className={s.footBar}>
          <span>
            © 2026 MERIDIAN.
            {CONTACT.isPlaceholder && " Adresa de email de pe această pagină e încă provizorie."}
          </span>
          <nav aria-label="Documente legale">
            <ul className="flex flex-wrap gap-x-5 gap-y-1">
              {LEGAL_LINKS.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="transition-colors hover:text-white">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>

      <p aria-hidden className={s.footMark}>
        MERIDIAN
      </p>
    </footer>
  );
}
