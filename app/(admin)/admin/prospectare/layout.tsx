import { redirect } from "next/navigation";
import { getAdminUser, isAuthConfigured } from "@/lib/supabase/clients";
import { SetupNotice } from "../_components/setup-notice";

/**
 * Garda modulului Prospectare: aceeași autentificare ca restul adminului
 * (`getAdminUser()`: Google + ADMIN_EMAILS), altfel /admin/login. Datele se citesc
 * pe server, cu cheia de service. Cadrul e în layout-ul comun al adminului.
 */
export default async function ProspectareLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  if (!isAuthConfigured()) return <SetupNotice />;
  const user = await getAdminUser();
  if (!user) redirect("/admin/login");
  return children;
}
