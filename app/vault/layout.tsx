import type { Metadata, Viewport } from "next";
import { fontVariables } from "@/app/fonts";
import "@/app/globals.css";

/**
 * Root layout pentru vault (feat/vault).
 *
 * În afara i18n-ului (doar RO), în afara shell-ului public: fără header,
 * fără footer, fără banner de cookie-uri, fără pixeli, fără structured
 * data — nimic din `app/[locale]/layout.tsx` nu ajunge aici. E un root
 * separat, ca admin-ul, exact ca să nu moștenească nimic din marketing.
 *
 * Rulează pe sistemul de design al site-ului, în scope-ul neutru al
 * porții (`data-scope="gate"`) — aceeași gramatică ca admin-ul: glass,
 * hairline, Satoshi + JetBrains Mono, lumina celor două lumi. Unealtă a
 * agenției, nu a unei divizii.
 *
 * `robots: noindex` aici + `/vault` în `disallow` din robots.ts + absent
 * din sitemap: trei straturi, ca ruta să nu apară nicăieri.
 */
export const metadata: Metadata = {
  title: "MERIDIAN — Vault",
  robots: { index: false, follow: false, nocache: true },
  // Fără OG, fără canonical: nu există context în care linkul să fie
  // „distribuit".
};

export const viewport: Viewport = {
  themeColor: "#060608",
  width: "device-width",
  initialScale: 1,
};

export default function VaultRootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ro">
      <body className={`${fontVariables} md-body min-h-dvh antialiased`}>
        <div data-scope="gate" className="md-root min-h-dvh">
          {children}
        </div>
      </body>
    </html>
  );
}
