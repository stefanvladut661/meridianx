import { redirect } from "next/navigation";
import { getAdminUser, isAuthConfigured } from "@/lib/supabase/clients";
import { LeadsSetupScreen } from "@/components/panou/leads/setup-card";

/**
 * Garda lead-urilor (`/admin`). Grupul `(dash)` nu apare în URL; `/admin/login`
 * stă în afara lui, deci nu se autoredirectează.
 *
 * `getAdminUser()` validează tokenul la Supabase (nu are încredere în cookie-ul
 * local) și e memorat pe randare: layout-ul comun l-a cerut deja.
 *
 * Fără Supabase configurat, arătăm pașii de instalare, nu login-ul: un câmp de
 * login care n-are cum să reușească e un drum înfundat.
 *
 * Cadrul (meniul, bara de sus) e în `app/(admin)/admin/layout.tsx`.
 */
export default async function AdminDashLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  if (!isAuthConfigured()) return <LeadsSetupScreen />;
  const user = await getAdminUser();
  if (!user) redirect("/admin/login");
  return children;
}
