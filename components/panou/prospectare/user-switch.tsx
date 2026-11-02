"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { alegeUtilizator } from "@/app/(admin)/admin/prospectare/actions";
import { SegmentedControl } from "@/components/panou/ui/primitives";
import { useToast } from "@/components/panou/ui/toast";
import { UTILIZATORI } from "@/lib/prospectare/labels";
import type { Utilizator } from "@/lib/prospectare/types";

/**
 * Comutatorul Ștefan / Vlăduț, ținut minte într-un cookie. La apeluri alege
 * lista cui se vede; pe WhatsApp (listă comună) alege doar cine trimite.
 */
export function UserSwitch({ value, className, ariaLabel = "Lista cui" }: { value: Utilizator; className?: string; ariaLabel?: string }) {
  const router = useRouter();
  const { notify } = useToast();
  const [pending, startTransition] = useTransition();

  return (
    <div aria-busy={pending} className={className}>
      <SegmentedControl<Utilizator>
        ariaLabel={ariaLabel}
        value={value}
        onChange={(next) => {
          if (next === value) return;
          startTransition(async () => {
            const result = await alegeUtilizator(next);
            if (!result.ok) notify(result.message, "error");
            const url = new URL(window.location.href);
            url.searchParams.delete("cine");
            router.replace(`${url.pathname}${url.search}`, { scroll: false });
            router.refresh();
          });
        }}
        options={[
          { value: "stefan", label: UTILIZATORI.stefan },
          { value: "vladut", label: UTILIZATORI.vladut },
        ]}
      />
    </div>
  );
}
