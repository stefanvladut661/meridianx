"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { scoateDinCoada } from "@/app/(admin)/admin/prospectare/actions";
import { ConfirmDialog } from "@/components/panou/ui/actions";
import { num } from "@/components/panou/ui/format";
import { btnClass } from "@/components/panou/ui/primitives";
import { useToast } from "@/components/panou/ui/toast";

/** „de o zi”, „de 3 zile”, „de 20 de zile”. */
function deZile(n: number): string {
  if (n <= 1) return "de o zi";
  const rest = n % 100;
  return rest >= 20 || rest === 0 ? `de ${n} de zile` : `de ${n} zile`;
}

/**
 * Banda roșie a restanțelor (migrarea 39): programările netrimise din zilele dinainte nu se mai eliberează la 00:00,
 * rămân pe contul lor. „Scoate din coadă” le anulează pe toate; firmele se pot distribui din nou.
 */
export function RestanteBanda({ restante, azi, ce }: { restante: { id: number; zi: string }[]; azi: string; ce: string }) {
  const router = useRouter();
  const { notify } = useToast();
  const [deschis, setDeschis] = useState(false);
  // Scoase: banda dispare imediat, fără să aștepte recitirea paginii.
  const [scoase, setScoase] = useState(false);
  if (!restante.length || scoase) return null;
  const veche = restante.reduce((m, r) => (r.zi < m ? r.zi : m), restante[0].zi);
  const zile = Math.round((Date.parse(`${azi}T12:00:00Z`) - Date.parse(`${veche}T12:00:00Z`)) / 86400000);
  return (
    <>
      <div role="alert" className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-rose/40 bg-rose/[0.14] px-3.5 py-3 text-[14.5px] text-[#FFC2CE]">
        <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
        <p className="min-w-0 flex-1 font-medium">
          {restante.length === 1 ? `O firmă programată ${ce} și netrimisă` : `${num(restante.length)} firme programate ${ce} și netrimise`} {deZile(zile)}
        </p>
        <button type="button" onClick={() => setDeschis(true)} className={btnClass({ variant: "danger", size: "sm" })}>
          Scoate din coadă
        </button>
      </div>
      <ConfirmDialog
        open={deschis}
        onOpenChange={setDeschis}
        title={restante.length === 1 ? "Scoți firma din coadă?" : `Scoți ${num(restante.length)} firme din coadă?`}
        description="Nu mai sunt programate; le distribui din nou din Firme."
        confirmLabel="Scoate din coadă"
        tone="primary"
        onConfirm={async () => {
          const r = await scoateDinCoada(restante.map((x) => x.id)).catch(() => ({ ok: false as const, message: "Conexiunea a căzut: nu știm dacă s-au scos." }));
          notify(r.message, r.ok ? undefined : "error");
          if (r.ok) setScoase(true);
          router.refresh();
        }}
      />
    </>
  );
}
