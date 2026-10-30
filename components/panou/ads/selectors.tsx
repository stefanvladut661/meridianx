"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { ChevronDown } from "lucide-react";
import type { Platform } from "@/lib/ads/constants";
import { CHANNELS, CHANNEL_LABEL, PERIODS, parseChannel, parseClientId, parsePeriod, selectionQuery, type PeriodKey, type Selection } from "@/lib/ads/model/selection";
import { cn } from "@/lib/utils";
import { SoftSelect } from "../ui/select";

type Failure = { ok: false; message: string };

export interface AdsSelectorClient {
  id: string;
  name: string;
  owner: "agentie" | "clienti";
  platforms: Platform[];
}

/** Perioadele, scurte ca în prototip („7 zile”); cele două luni există doar în codul real. */
const PERIOD_SHORT: Record<PeriodKey, string> = {
  "7": "7 zile",
  "30": "30 zile",
  "90": "90 zile",
  luna: "Luna aceasta",
  "luna-trecuta": "Luna trecută",
};

/** Ecranele care citesc alegerea din adresă; pe restul, alegerea doar se ține minte și pagina se reîncarcă. */
const SELECTION_PAGES = /^\/admin\/ads(\/(statistici|apeluri|istoric|planuri|materiale))?\/?$/;

/**
 * Selectoarele din bara de sus a modulului Reclame, ca în prototip
 * (`ModuleSelectors`): spațiul de lucru (aici: clientul), canalul și perioada.
 * Alegerea stă în adresă și în cookie (`remember`); tot ce e dedesubt se schimbă
 * după ea. Clientul are două grupuri (banii clienților / ai agenției), ca în
 * bara veche, ca să nu confunzi niciodată cui sunt banii.
 */
export function AdsSelectors({
  clients,
  saved,
  remember,
}: {
  clients: AdsSelectorClient[];
  saved: Selection;
  remember: (input: { clientId: string | null; channel: string; period: string }) => Promise<{ ok: true } | Failure>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const [failure, setFailure] = useState<string | null>(null);

  const selection: Selection = {
    clientId: parseClientId(params.get("client")) ?? saved.clientId ?? clients[0]?.id ?? null,
    channel: parseChannel(params.get("canal")) ?? saved.channel,
    period: parsePeriod(params.get("perioada")) ?? saved.period,
  };
  const client = clients.find((item) => item.id === selection.clientId) ?? clients[0] ?? null;

  const choose = (change: Partial<Selection>) => {
    const next = { ...selection, ...change };
    setFailure(null);
    start(async () => {
      const saved = await remember({ clientId: next.clientId, channel: next.channel, period: next.period });
      if (!saved.ok) {
        setFailure(saved.message);
        return;
      }
      if (SELECTION_PAGES.test(pathname)) {
        // Ce ține de un rând anume (bifele, panoul) nu mai are sens la alt client sau canal.
        const keep = new URLSearchParams(params);
        if (change.clientId !== undefined || change.channel !== undefined) for (const key of ["campanii", "grupuri", "rand"]) keep.delete(key);
        router.push(`${pathname}?${selectionQuery(next, keep)}`, { scroll: false });
      } else {
        router.refresh();
      }
    });
  };

  return (
    <div className="flex items-center gap-2" aria-busy={pending || undefined}>
      {clients.length > 0 ? (
        <div className="min-w-0 w-[148px]">
          <div className="relative">
            <select
              aria-label="Spațiu de lucru: clientul"
              value={client?.id ?? ""}
              disabled={pending}
              onChange={(event) => choose({ clientId: event.target.value })}
              className="h-8 w-full appearance-none truncate rounded-lg border border-white/[0.1] bg-white/[0.04] pl-2.5 pr-7 text-[12.5px] text-foreground outline-none transition-colors hover:bg-white/[0.07] focus:border-lav/50 disabled:opacity-50"
            >
              {(["clienti", "agentie"] as const).map((owner) => {
                const group = clients.filter((item) => item.owner === owner);
                if (group.length === 0) return null;
                return (
                  <optgroup key={owner} label={owner === "clienti" ? "Clienți" : "Agenția"} className="bg-[#14141A] text-foreground">
                    {group.map((item) => (
                      <option key={item.id} value={item.id} className="bg-[#14141A] text-foreground">
                        {item.name}
                      </option>
                    ))}
                  </optgroup>
                );
              })}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          </div>
        </div>
      ) : (
        <Link href="/admin/ads/clienti" className="whitespace-nowrap text-[12.5px] font-medium text-lav underline underline-offset-4">
          Adaugă primul client
        </Link>
      )}

      <SoftSelect
        ariaLabel="Canal"
        value={selection.channel}
        disabled={pending}
        onChange={(value) => choose({ channel: parseChannel(value) ?? selection.channel })}
        className="w-[104px]"
        options={CHANNELS.map((channel) => ({
          value: channel,
          // Un canal fără cont la clientul ales rămâne alegere (ecranul spune ce lipsește), dar se vede.
          label: channel !== "toate" && client !== null && !client.platforms.includes(channel) ? `${CHANNEL_LABEL[channel]} · fără cont` : channel === "toate" ? "Toate" : CHANNEL_LABEL[channel],
        }))}
      />
      <SoftSelect
        ariaLabel="Perioadă"
        value={selection.period}
        disabled={pending}
        onChange={(value) => choose({ period: parsePeriod(value) ?? selection.period })}
        className="w-[116px]"
        options={PERIODS.map((period) => ({ value: period, label: PERIOD_SHORT[period] }))}
      />
      {failure ? (
        <span role="alert" className={cn("max-w-[14rem] truncate text-[11.5px] text-rose")} title={failure}>
          {failure}
        </span>
      ) : null}
    </div>
  );
}
