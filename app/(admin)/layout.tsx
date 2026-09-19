import type { Metadata } from "next";
import { fontVariables } from "@/app/fonts";
import "@/app/globals.css";

/**
 * Root layout pentru zona de admin (FAZA 0 a creat fișierul;
 * FAZA 6 îl deține și îl poate extinde).
 *
 * Admin e în afara i18n-ului (doar RO) și rulează pe sistemul de design
 * al site-ului, în scope-ul neutru al porții: aceeași gramatică de
 * suprafețe ca paginile publice (glass, hairline, Satoshi + JetBrains
 * Mono), dar fără accentul niciunei divizii — e o unealtă a agenției,
 * nu a unei lumi. Accentul e lumina, nu culoarea.
 */
export const metadata: Metadata = {
  title: "MERIDIAN — Admin",
  robots: { index: false, follow: false },
};

export default function AdminRootLayout({
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
