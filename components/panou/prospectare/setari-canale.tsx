"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Mail, MessageCircle, Phone, type LucideIcon } from "lucide-react";
import { seteazaCanal } from "@/app/(admin)/admin/prospectare/actions";
import { dateTimeRo } from "@/components/panou/ui/format";
import { Btn, Card, Pill, SectionTitle } from "@/components/panou/ui/primitives";
import { inputClass } from "@/components/panou/ui/states";
import { useToast } from "@/components/panou/ui/toast";
import type { Canal, CanalStare } from "@/lib/prospectare/types";
import { cn } from "@/lib/utils";
import { EroareCitire } from "./prezentare-eroare";

/**
 * „Canale” din Setări (migrarea 39): fiecare canal e Activ sau Suspendat, cu un motiv. Suspendat = nu se poate
 * distribui, /coada-email întoarce o listă goală, iar firmele programate pe el așteaptă (nu se pierd).
 */

const META: Record<Canal, { nume: string; icon: LucideIcon }> = {
  whatsapp: { nume: "WhatsApp", icon: MessageCircle },
  email: { nume: "Email", icon: Mail },
  telefon: { nume: "Apel", icon: Phone },
};

function RandCanal({ c }: { c: CanalStare }) {
  const router = useRouter();
  const { notify } = useToast();
  const [suspend, setSuspend] = useState(false);
  const [motiv, setMotiv] = useState("");
  const [eroare, setEroare] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const { nume, icon: Icon } = META[c.canal];

  const salveaza = (activ: boolean) =>
    startTransition(async () => {
      const r = await seteazaCanal({ canal: c.canal, activ, motiv: activ ? undefined : motiv.trim() || undefined }).catch(() => ({
        ok: false as const,
        message: "Conexiunea a căzut: nu știm dacă s-a salvat. Reîncarcă pagina.",
      }));
      if (!r.ok) {
        setEroare(r.message);
        notify(r.message, "error");
        return;
      }
      setEroare(null);
      setSuspend(false);
      setMotiv("");
      notify(r.message, activ ? undefined : "warn");
      router.refresh();
    });

  return (
    <li className="px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <p className="text-[15px] font-medium">{nume}</p>
        {c.activ ? (
          <Pill tone="mint" dot>
            Activ
          </Pill>
        ) : (
          <Pill tone="rose" dot>
            Suspendat
          </Pill>
        )}
        {!c.activ && c.motiv ? <span className="min-w-0 text-[14px] text-foreground/80">{c.motiv}</span> : null}
        {c.schimbat_de ? (
          <span className="text-[13px] text-muted-foreground" title={dateTimeRo(c.schimbat_la)}>
            · {c.schimbat_de}
          </span>
        ) : null}
        <div className="ml-auto">
          {c.activ ? (
            suspend ? null : (
              <Btn size="sm" variant="outline" onClick={() => setSuspend(true)} disabled={pending}>
                Suspendă
              </Btn>
            )
          ) : (
            <Btn size="sm" variant="mint" icon={pending ? Loader2 : undefined} onClick={() => salveaza(true)} disabled={pending}>
              Pornește
            </Btn>
          )}
        </div>
      </div>
      {suspend ? (
        <form
          className="mt-2.5 flex flex-wrap items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            salveaza(false);
          }}
        >
          <input
            value={motiv}
            onChange={(e) => setMotiv(e.target.value)}
            placeholder="motivul (opțional)"
            maxLength={300}
            aria-label={`Motivul suspendării: ${nume}`}
            autoFocus
            className={inputClass("h-8 min-w-0 flex-1 basis-56")}
          />
          <Btn type="submit" size="sm" variant="danger" icon={pending ? Loader2 : undefined} disabled={pending}>
            Suspendă
          </Btn>
          <Btn size="sm" variant="ghost" onClick={() => setSuspend(false)} disabled={pending}>
            Renunță
          </Btn>
        </form>
      ) : null}
      {eroare ? (
        <p role="alert" className={cn("mt-1.5 text-[13.5px] text-rose")}>
          {eroare}
        </p>
      ) : null}
    </li>
  );
}

export function SetariCanale({ canale, eroare }: { canale: CanalStare[] | null; eroare: string | null }) {
  const suspendate = canale?.filter((c) => !c.activ).length ?? 0;
  return (
    <Card id="canale" className="scroll-mt-24">
      <SectionTitle
        title="Canale"
        hint={canale ? (suspendate ? `${suspendate} ${suspendate === 1 ? "suspendat" : "suspendate"}` : "toate active") : undefined}
        info="Un canal suspendat nu se poate distribui, iar robotul de email primește o listă goală. Firmele programate pe el așteaptă: nu se pierd."
      />
      {canale === null ? (
        <EroareCitire title="Canalele nu s-au putut citi" message={eroare ?? "Citirea a căzut."} className="py-8" />
      ) : (
        <ul className="mt-3 divide-y divide-white/[0.06] rounded-xl border border-white/[0.07]">
          {canale.map((c) => (
            <RandCanal key={c.canal} c={c} />
          ))}
        </ul>
      )}
    </Card>
  );
}
