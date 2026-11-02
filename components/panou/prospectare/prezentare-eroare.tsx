"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ErrorState } from "@/components/panou/ui/states";

/** O citire din bază a căzut: mesajul ei și „Încearcă din nou”, care recitește pagina pe server. */
export function EroareCitire({ title, message, className }: { title: string; message: string; className?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <div aria-busy={pending}>
      <ErrorState
        title={title}
        text={message}
        className={className}
        retryLabel={pending ? "Se recitește…" : "Încearcă din nou"}
        onRetry={() => startTransition(() => router.refresh())}
      />
    </div>
  );
}
