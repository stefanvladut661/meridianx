"use client";

import { Contact } from "lucide-react";
import { continutVcf } from "@/lib/prospectare/contact";
import type { FirmaRand } from "@/lib/prospectare/types";
import { Btn } from "@/components/panou/ui/primitives";
import { useToast } from "@/components/panou/ui/toast";
import { cn } from "@/lib/utils";
import { TAP_SM } from "./apeluri-ui";

type FirmaVcf = Pick<FirmaRand, "nr" | "nume" | "telefon" | "email" | "nisa" | "oras" | "link_demo">;

/**
 * Contactele listei ca fișier .vcf, făcut în browser: deschis pe telefon, le
 * importă în agendă, iar în WhatsApp și la apel apar cu numele firmei.
 */
export function VcfButton({ firme, numeFisier, className }: { firme: FirmaVcf[]; numeFisier: string; className?: string }) {
  const { notify } = useToast();
  const cuTelefon = firme.filter((f) => f.telefon).length;

  const descarca = () => {
    const blob = new Blob([continutVcf(firme)], { type: "text/vcard;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = numeFisier;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Unele browsere încep descărcarea după click: eliberăm adresa puțin mai târziu.
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    notify(`${cuTelefon === 1 ? "Un contact descărcat" : `${cuTelefon} contacte descărcate`}. Deschide fișierul pe telefon ca să le imporți în agendă.`);
  };

  return (
    <Btn
      size="sm"
      variant="outline"
      icon={Contact}
      onClick={descarca}
      disabled={cuTelefon === 0}
      className={cn(TAP_SM, className)}
      title={cuTelefon === 0 ? "Lista nu are numere de telefon" : `${cuTelefon} contacte, fișier ${numeFisier}`}
    >
      Contacte .vcf
    </Btn>
  );
}
