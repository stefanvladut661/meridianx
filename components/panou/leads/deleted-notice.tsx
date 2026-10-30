"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useToast } from "../ui/toast";

/**
 * Ștergerea te aduce înapoi la listă cu `?sters=1`. Semnul se arată o dată, ca notificare
 * („Lead șters definitiv.”), apoi se scoate din adresă: nu e un filtru și nu trebuie să
 * supraviețuiască următoarei navigări sau unui refresh.
 */
export function DeletedNotice() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { notify } = useToast();
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    notify("Lead șters definitiv.");
    const next = new URLSearchParams(searchParams.toString());
    next.delete("sters");
    const query = next.toString();
    router.replace(query ? `/admin?${query}` : "/admin", { scroll: false });
  }, [notify, router, searchParams]);

  return null;
}
