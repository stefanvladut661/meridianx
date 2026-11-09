import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/supabase/clients";

/**
 * Garda din PAGINĂ, prima linie din fiecare `page.tsx` al adminului.
 *
 * DE CE nu ajunge garda din layout: Next randează layout-ul și pagina în
 * paralel, iar pagina e un rând separat în fluxul RSC. Când layout-ul
 * redirecționează, pagina poate fi deja randată — și, la paginile care citesc
 * cu cheia de service, datele ajungeau în corpul răspunsului de redirect
 * (constatat pe producție, 9 nov 2026). Aici pagina se oprește ÎNAINTE de orice
 * citire. `getAdminUser` e memorat pe randare: nu costă o verificare în plus.
 */
export async function requireAdmin(): Promise<{ id: string; email: string | null }> {
  const user = await getAdminUser();
  if (!user) redirect("/admin/login");
  return user;
}
