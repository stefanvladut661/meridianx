"use client";

import { useRef, useState, useTransition, type FormEvent, type RefObject } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { nisaAdmin } from "@/app/(admin)/admin/prospectare/actions";
import { Btn } from "@/components/panou/ui/primitives";
import { inputClass } from "@/components/panou/ui/states";
import { useToast } from "@/components/panou/ui/toast";

type Eroare = { camp: "nisa" | "zona"; text: string } | null;

const ETICHETA = "text-[13px] font-medium uppercase tracking-[0.12em] text-muted-foreground";

/**
 * „Adaugă nișă”: pune pe tablă o nișă liberă (nișă + zonă), pe care o ia primul
 * robot care o cere. Dublura (aceeași nișă și zonă) se arată sub câmp, nu doar în notificare.
 */
export function NiseAdauga({ nisaRef }: { nisaRef: RefObject<HTMLInputElement | null> }) {
  const router = useRouter();
  const { notify } = useToast();
  const [nisa, setNisa] = useState("");
  const [zona, setZona] = useState("");
  const [eroare, setEroare] = useState<Eroare>(null);
  const [pending, start] = useTransition();
  const zonaRef = useRef<HTMLInputElement>(null);

  const trimite = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const n = nisa.trim();
    const z = zona.trim();
    if (!n) {
      setEroare({ camp: "nisa", text: "Scrie nișa, de exemplu „instalatori”." });
      nisaRef.current?.focus();
      return;
    }
    if (!z) {
      setEroare({ camp: "zona", text: "Scrie zona, de exemplu „Muntenia” sau „Cluj”." });
      zonaRef.current?.focus();
      return;
    }
    setEroare(null);
    start(async () => {
      const result = await nisaAdmin({ actiune: "adauga", nisa: n, zona: z });
      if (!result.ok) {
        if (result.message.includes("deja pe tablă")) {
          setEroare({ camp: "nisa", text: `${result.message} Caut-o mai jos sau alege altă zonă.` });
          nisaRef.current?.focus();
        } else {
          notify(result.message, "error");
        }
        return;
      }
      notify(result.message);
      setNisa("");
      setZona("");
      router.refresh();
      nisaRef.current?.focus();
    });
  };

  const descriere = (camp: "nisa" | "zona") => (eroare?.camp === camp ? "nisa-adauga-eroare" : "nisa-adauga-ajutor");

  return (
    <form onSubmit={trimite} noValidate aria-labelledby="nisa-adauga-titlu" aria-busy={pending}>
      <h2 id="nisa-adauga-titlu" className="text-[16px] font-semibold tracking-[-0.01em]">
        Adaugă nișă
      </h2>
      <p id="nisa-adauga-ajutor" className="mt-1 text-[14px] text-muted-foreground">
        Apare liberă pe tablă. Primul robot care o cere o rezervă.
      </p>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="block sm:flex-1">
          <span className={ETICHETA}>Nișă</span>
          <input
            ref={nisaRef}
            value={nisa}
            onChange={(e) => {
              setNisa(e.target.value);
              if (eroare) setEroare(null);
            }}
            placeholder="ex. instalatori"
            maxLength={120}
            autoComplete="off"
            aria-invalid={eroare?.camp === "nisa" ? true : undefined}
            aria-describedby={descriere("nisa")}
            className={inputClass(`mt-1.5 ${eroare?.camp === "nisa" ? "border-rose/50" : ""}`)}
          />
        </label>
        <label className="block sm:flex-1">
          <span className={ETICHETA}>Zonă</span>
          <input
            ref={zonaRef}
            value={zona}
            onChange={(e) => {
              setZona(e.target.value);
              if (eroare) setEroare(null);
            }}
            placeholder="ex. Muntenia"
            maxLength={120}
            autoComplete="off"
            aria-invalid={eroare?.camp === "zona" ? true : undefined}
            aria-describedby={descriere("zona")}
            className={inputClass(`mt-1.5 ${eroare?.camp === "zona" ? "border-rose/50" : ""}`)}
          />
        </label>
        <Btn type="submit" variant="primary" size="sm" className="h-9 sm:w-auto" icon={pending ? Loader2 : Plus} disabled={pending}>
          {pending ? "Se adaugă…" : "Adaugă nișa"}
        </Btn>
      </div>
      {eroare ? (
        <p id="nisa-adauga-eroare" role="alert" className="mt-2 text-[13.5px] text-rose">
          {eroare.text}
        </p>
      ) : null}
      <p className="sr-only" aria-live="polite">
        {pending ? "Se adaugă nișa." : ""}
      </p>
    </form>
  );
}
