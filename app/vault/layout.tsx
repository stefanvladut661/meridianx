import type { Metadata, Viewport } from "next";
import { isVaultConfigured } from "@/lib/vault/supabase";
import { vaultFontVariables } from "./fonts";
import { VaultRoot } from "./_panou/root";
import "@/app/globals.css";

/**
 * Root layout pentru Vault (redesign: cadrul comun al panoului).
 *
 * Rămâne un root separat, cu `<html>` propriu: nimic din `app/[locale]/layout.tsx`
 * (header, footer, banner de cookie-uri, pixeli, structured data) nu ajunge aici,
 * iar profilul CSP al Vault-ului (`'wasm-unsafe-eval'`, fără pixeli) se aplică
 * doar pe `/vault`. Aspectul e al panoului — meniul din stânga, bara de sus,
 * aceleași teme și kit —, dar sesiunea e SEPARATĂ de cea de admin: Supabase în
 * memorie, `persistSession: false`, și nicio importare din `app/(admin)/`.
 *
 * Providerul seifului și poarta stau AICI, nu în pagini: starea deblocată
 * supraviețuiește navigării între /vault, /vault/import, /vault/export,
 * /vault/membri și /vault/cont. Cheile rămân în `useRef`, în memoria filei.
 *
 * `robots: noindex` aici + `/vault` în `disallow` din robots.ts + absent din
 * sitemap: trei straturi, ca ruta să nu apară nicăieri.
 */
export const metadata: Metadata = {
  title: "MERIDIAN — Vault",
  robots: { index: false, follow: false, nocache: true },
  // Fără OG, fără canonical: nu există context în care linkul să fie „distribuit”.
};

export const viewport: Viewport = {
  themeColor: "#0C0B0E",
  width: "device-width",
  initialScale: 1,
};

export default function VaultRootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ro">
      <body className={`${vaultFontVariables} md-body min-h-dvh antialiased`}>
        <div data-scope="gate" className="md-root min-h-dvh">
          <VaultRoot configured={isVaultConfigured()}>{children}</VaultRoot>
        </div>
      </body>
    </html>
  );
}
