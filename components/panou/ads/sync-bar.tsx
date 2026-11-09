"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Btn } from "../ui/primitives";
import { dateTimeRo } from "../ui/format";
import { useToast } from "../ui/toast";

type Failure = { ok: false; message: string };

/**
 * „Sincronizat …” și „Sincronizează” (prototip: antetul Campaniilor).
 * Citește conturile clientului ales din platforme; cifrele din ecrane vin doar
 * din bază, deci butonul e singura cale de a le aduce la zi între două rulări
 * ale cron-ului de dimineață. Rezultatul se anunță (toast cu `aria-live`), iar
 * conturile căzute rămân spuse în text, nu doar în culoare.
 */
export function SyncBar({
  clientId,
  lastSyncedAt,
  failedAccounts,
  hasAccounts,
  sync,
  className,
}: {
  clientId: string;
  lastSyncedAt: string | null;
  failedAccounts: number;
  hasAccounts: boolean;
  sync: (input: { clientId: string }) => Promise<{ ok: true; summary: string; problems: string[] } | Failure>;
  className?: string;
}) {
  const router = useRouter();
  const { notify } = useToast();
  const [pending, start] = useTransition();

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <p className="text-[13px] text-muted-foreground">
        {lastSyncedAt ? (
          <>
            Sincronizat <span className="text-foreground/80">{dateTimeRo(lastSyncedAt)}</span>
          </>
        ) : (
          "Nesincronizat"
        )}
        {failedAccounts > 0 ? (
          <span className="text-rose">
            {" "}
            · {failedAccounts === 1 ? "un cont n-a mers" : `${failedAccounts} conturi n-au mers`}
          </span>
        ) : null}
      </p>
      <Btn
        size="sm"
        variant="outline"
        icon={RefreshCw}
        disabled={pending || !hasAccounts}
        title={hasAccounts ? undefined : "Niciun cont legat."}
        onClick={() =>
          start(async () => {
            notify("Se citesc conturile…");
            try {
              const result = await sync({ clientId });
              if (!result.ok) notify(result.message, "error");
              else notify(result.problems.length ? `${result.summary} ${result.problems.join(" ")}` : result.summary, result.problems.length ? "warn" : "default");
            } catch {
              notify("Serverul n-a răspuns. Încearcă din nou.", "error");
            }
            router.refresh();
          })
        }
        className={pending ? "[&_svg]:animate-spin motion-reduce:[&_svg]:animate-none" : undefined}
      >
        {pending ? "Se sincronizează…" : "Sincronizează"}
      </Btn>
    </div>
  );
}
