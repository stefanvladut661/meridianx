"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * Starea ecranului în adresă (filtre, pagină, element deschis): refresh-ul și
 * linkul păstrează contextul, iar Înapoi face ce te aștepți. Echivalentul
 * `useQueryParams` din prototip, pe router-ul Next. Paginile de server își
 * recitesc datele la fiecare schimbare de adresă.
 */
export function useQueryParams() {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const get = (key: string, fallback = ""): string => params.get(key) ?? fallback;

  const setMany = (patch: Record<string, string | number | null | undefined>, { replace = true }: { replace?: boolean } = {}) => {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value === "" || value === null || value === undefined) next.delete(key);
      else next.set(key, String(value));
    }
    const query = next.toString();
    const href = query ? `${pathname}?${query}` : pathname;
    if (replace) router.replace(href, { scroll: false });
    else router.push(href, { scroll: false });
  };

  const clear = (keys: string[] = []) => setMany(Object.fromEntries(keys.map((key) => [key, ""])));

  return { get, setMany, clear, params };
}
