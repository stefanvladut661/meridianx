import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

/**
 * Navigare conștientă de locale (FAZA 0, ÎNGHEȚAT).
 * În paginile publice folosește ACESTE exporturi, nu pe cele din
 * next/link și next/navigation — altfel se pierde prefixul de limbă.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
