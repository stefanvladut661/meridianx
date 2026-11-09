import { getAdminUser, isAuthConfigured } from "@/lib/supabase/clients";
import { PanouShell } from "@/components/panou/layout/shell";
import { signOut } from "./login/actions";
import { SessionKeeper } from "./_components/session-keeper";
// Tema panoului (dark, lavandă), din portalul de reclame.
import "./ads/portal.css";

/**
 * Cadrul comun al adminului: meniul și bara de sus, o singură dată pentru toate
 * modulele. Când treci de la Lead-uri la Prospectare, cadrul rămâne pe loc și se
 * schimbă doar conținutul (înainte, fiecare modul își reconstruia tot cadrul pe
 * server la fiecare clic: autentificare + alerte + meniu).
 *
 * Garda NU e aici: fără sesiune, layout-ul doar nu desenează cadrul (așa
 * rămâne curată pagina de login). Fiecare modul își face garda în layout-ul lui
 * (`getAdminUser()` → altfel /admin/login), iar `getAdminUser` e memorat pe
 * randare, deci verificarea se face o singură dată.
 *
 * ⚠️ NU pune `loading.tsx` aici și niciun `<Suspense>` în jurul lui `children`.
 * Un Suspense deasupra gărzilor face ca răspunsul să plece (200) înainte de
 * verificare, iar pagina — randată în paralel, rând separat în fluxul RSC —
 * ajunge în HTML chiar dacă layout-ul modulului redirecționează. S-a întâmplat
 * pe 9 nov 2026 (d2762f4). Scheletul la clic vine din cadru, pe client.
 */
export default async function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  if (!isAuthConfigured()) return children;
  const user = await getAdminUser();
  if (!user) return children;

  return (
    <>
      <SessionKeeper />
      <PanouShell email={user.email} signOut={signOut}>
        {children}
      </PanouShell>
    </>
  );
}
