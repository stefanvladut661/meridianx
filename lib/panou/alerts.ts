import { createAdminClient } from "@/lib/supabase/clients";
import { clientsForRequest } from "@/lib/ads/model/read";
import { readSettings } from "@/lib/postari/setari";

/**
 * „De rezolvat azi”, clopoțelul din bara de sus: ce așteaptă o decizie a omului,
 * citit din bază la fiecare încărcare de ecran. În prototip era o listă fictivă;
 * aici sunt patru surse reale, fiecare izolată: dacă una nu răspunde (tabela
 * lipsește, baza nu e configurată), lipsește doar ea, nu bara de sus.
 */

export interface ShellState {
  alerts: ShellAlert[];
  /** Numerele din meniu: câte lead-uri noi, câte postări eșuate. */
  badges: { leaduri?: number; postari?: number };
}

export interface ShellAlert {
  id: string;
  title: string;
  text: string;
  to: string;
  tone: "rose" | "apricot" | "mint" | "lav";
}

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

async function count(table: string, column: string, value: string): Promise<number> {
  const admin = createAdminClient();
  if (!admin) return 0;
  const { count: total, error } = await admin.from(table).select("id", { count: "exact", head: true }).eq(column, value);
  return error ? 0 : (total ?? 0);
}

async function newLeads(): Promise<{ n: number; alerts: ShellAlert[] }> {
  const n = await count("leads", "status", "new");
  if (n === 0) return { n, alerts: [] };
  return { n, alerts: [{ id: "lead-uri-noi", title: plural(n, "lead nou", "lead-uri noi"), text: "Încă neatinse. Primul răspuns rapid contează.", to: "/admin?status=new", tone: "lav" }] };
}

async function failedPosts(): Promise<{ n: number; alerts: ShellAlert[] }> {
  const n = await count("postari", "stare", "esuata");
  if (n === 0) return { n, alerts: [] };
  return { n, alerts: [{ id: "postari-esuate", title: plural(n, "postare eșuată", "postări eșuate"), text: "Deschide coada: are motivul și „Reîncearcă”.", to: "/admin/postari", tone: "rose" }] };
}

async function stoppedQueue(): Promise<ShellAlert[]> {
  const settings = await readSettings();
  if (!settings.ok || settings.data.coadaPornita) return [];
  return [
    {
      id: "coada-oprita",
      title: "Coada de postări e oprită",
      text: settings.data.coadaMotiv || "Fără motiv notat. Nimic nu pleacă până nu o pornești.",
      to: "/admin/postari",
      tone: "apricot",
    },
  ];
}

async function brokenAdConnections(): Promise<ShellAlert[]> {
  const clients = await clientsForRequest();
  if (!clients.ok) return [];
  const failing = clients.data.filter((client) => client.accounts.some((account) => account.syncEnabled && account.lastSyncStatus === "failed"));
  if (failing.length === 0) return [];
  return [
    {
      id: "conexiuni-reclame",
      title: plural(failing.length, "conexiune de reclame căzută", "conexiuni de reclame căzute"),
      text: failing.map((client) => client.name).join(", "),
      to: "/admin/ads/clienti",
      tone: "apricot",
    },
  ];
}

/** Alertele (cele mai grave întâi) și numerele din meniu. Nu aruncă niciodată. */
export async function getShellState(): Promise<ShellState> {
  const empty = { n: 0, alerts: [] as ShellAlert[] };
  const [posts, queue, ads, leads] = await Promise.all([
    failedPosts().catch(() => empty),
    stoppedQueue().catch(() => [] as ShellAlert[]),
    brokenAdConnections().catch(() => [] as ShellAlert[]),
    newLeads().catch(() => empty),
  ]);
  return {
    alerts: [...posts.alerts, ...queue, ...ads, ...leads.alerts],
    badges: { leaduri: leads.n || undefined, postari: posts.n || undefined },
  };
}
