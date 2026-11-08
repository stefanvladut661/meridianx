"use client";

import { usePathname } from "next/navigation";
import { PanouPageSkeleton } from "@/components/panou/layout/page-skeleton";

/**
 * Ce se vede, în cadru, cât serverul pregătește alt modul: Next îl arată imediat
 * la trecerea dintr-un modul în altul și la prima încărcare. Pagina de login n-are
 * cadru, deci n-are nici schelet.
 */
export default function AdminLoading() {
  const pathname = usePathname();
  if (pathname === "/admin/login") return null;
  return <PanouPageSkeleton />;
}
