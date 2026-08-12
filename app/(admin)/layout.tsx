import type { Metadata } from "next";
import { fontVariables } from "@/app/fonts";
import "@/app/globals.css";

/**
 * Root layout pentru zona de admin (FAZA 0 a creat fișierul;
 * FAZA 6 îl deține și îl poate extinde).
 * Admin e în afara i18n-ului (doar RO) și folosește paleta software —
 * e o unealtă de lucru, nu o pagină de marketing.
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
      <body
        data-world="software"
        className={`${fontVariables} min-h-dvh bg-bg text-fg antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
