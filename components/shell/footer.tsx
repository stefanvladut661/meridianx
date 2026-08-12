import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Container } from "@/components/ui/container";
import type { Division } from "@/lib/division";
import { MeridianMark } from "./logo";
import { NAV_LINKS, DIVISION_HOME, LEGAL_LINKS } from "./nav-links";

/**
 * Footer unic, adaptiv cromatic (FAZA 1) — moștenește lumea din
 * data-world de pe layout, prin tokens semantici. Include obligatoriile
 * legale din România: ANPC SAL + SOL (UE).
 *
 * Contactele vin din env (NEXT_PUBLIC_*); fără env, href-ul cade pe "#"
 * — nu inventăm numere de telefon sau handle-uri.
 */

const ANPC_SAL_URL = "https://anpc.ro/ce-este-sal/";
const SOL_URL = "https://ec.europa.eu/consumers/odr";

function externalContact() {
  const phone = process.env.NEXT_PUBLIC_PHONE;
  const whatsapp = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER;
  const instagram = process.env.NEXT_PUBLIC_INSTAGRAM;

  return {
    phoneHref: phone ? `tel:${phone.replace(/\s/g, "")}` : "#",
    phoneLabel: phone ?? null,
    whatsappHref: whatsapp ? `https://wa.me/${whatsapp.replace(/\D/g, "")}` : "#",
    instagramHref: instagram
      ? instagram.startsWith("http")
        ? instagram
        : `https://instagram.com/${instagram.replace(/^@/, "")}`
      : "#",
  };
}

export function Footer({ division }: { division: Division }) {
  const t = useTranslations();
  const year = new Date().getFullYear();
  const contact = externalContact();

  // divizia curentă întâi — footerul e al lumii în care ești
  const divisionsOrdered: Division[] =
    division === "video" ? ["video", "software"] : ["software", "video"];

  return (
    <footer className="border-t border-line bg-bg text-fg">
      <Container size="wide" className="py-12 sm:py-16">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {/* brand */}
          <div className="flex flex-col gap-3">
            <span className="inline-flex items-center gap-2">
              <MeridianMark />
              <span className="font-display text-base font-semibold tracking-[0.18em]">
                MERIDIAN
              </span>
            </span>
            <p className="max-w-xs text-sm text-muted">{t("common.tagline")}</p>
            <Link
              href={{ pathname: "/", query: { stay: "1" } }}
              className="mt-1 w-fit text-sm text-muted underline-offset-4 transition-colors duration-150 hover:text-fg hover:underline"
            >
              {t("common.seeBothDivisions")}
            </Link>
          </div>

          {/* cele două divizii */}
          {divisionsOrdered.map((d) => (
            <nav key={d} aria-label={t(`nav.${d}.home`)} className="flex flex-col gap-2.5">
              <Link
                href={DIVISION_HOME[d]}
                className="font-mono text-[11px] uppercase tracking-[0.22em] text-accent transition-opacity duration-150 hover:opacity-80"
              >
                {t(`nav.${d}.home`)}
              </Link>
              <ul className="flex flex-col gap-2">
                {NAV_LINKS[d].map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted transition-colors duration-150 hover:text-fg"
                    >
                      {t(`nav.${d}.${link.key}`)}
                    </Link>
                  </li>
                ))}
                {d === "software" && (
                  <li>
                    <Link
                      href="/software/brief"
                      className="text-sm text-muted transition-colors duration-150 hover:text-fg"
                    >
                      {t("nav.software.brief")}
                    </Link>
                  </li>
                )}
              </ul>
            </nav>
          ))}

          {/* contact + social */}
          <div className="flex flex-col gap-2.5">
            <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-accent">
              {t("common.footer.contact")}
            </span>
            <ul className="flex flex-col gap-2">
              <li>
                <a
                  href={contact.phoneHref}
                  className="text-sm text-muted transition-colors duration-150 hover:text-fg"
                >
                  {t("common.footer.phone")}
                  {contact.phoneLabel ? (
                    <span className="ml-2 font-mono text-xs">{contact.phoneLabel}</span>
                  ) : null}
                </a>
              </li>
              <li>
                <a
                  href={contact.whatsappHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-muted transition-colors duration-150 hover:text-fg"
                >
                  {t("common.footer.whatsapp")}
                  <span className="sr-only"> ({t("common.footer.newWindow")})</span>
                </a>
              </li>
              <li>
                <a
                  href={contact.instagramHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-muted transition-colors duration-150 hover:text-fg"
                >
                  {t("common.footer.instagram")}
                  <span className="sr-only"> ({t("common.footer.newWindow")})</span>
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* legal + ANPC/SOL */}
        <div className="mt-12 flex flex-col gap-4 border-t border-line pt-6 lg:flex-row lg:items-center lg:justify-between">
          <ul className="flex flex-wrap items-center gap-x-5 gap-y-2">
            {LEGAL_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="text-xs text-muted transition-colors duration-150 hover:text-fg"
                >
                  {t(`nav.legal.${link.key}`)}
                </Link>
              </li>
            ))}
            <li>
              <a
                href={ANPC_SAL_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-muted transition-colors duration-150 hover:text-fg"
              >
                {t("common.footer.anpcSal")}
                <span className="sr-only"> ({t("common.footer.newWindow")})</span>
              </a>
            </li>
            <li>
              <a
                href={SOL_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-muted transition-colors duration-150 hover:text-fg"
              >
                {t("common.footer.sol")}
                <span className="sr-only"> ({t("common.footer.newWindow")})</span>
              </a>
            </li>
          </ul>
          <p className="text-xs text-muted">
            {t("common.footer.rights", { year })}
          </p>
        </div>
      </Container>
    </footer>
  );
}
