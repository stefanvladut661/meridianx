import { redirect } from "next/navigation";

/**
 * /admin/firma — panoul vine în faza 8. Până atunci, intrarea duce la clienți,
 * primul ecran construit (un ecran gol cu „în curând” ar fi un drum înfundat).
 */
export default function FirmaHome() {
  redirect("/admin/firma/clienti");
}
