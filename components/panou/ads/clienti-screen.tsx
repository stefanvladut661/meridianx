"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Building2, Check, KeyRound, Plug, Plus, RefreshCw, type LucideIcon } from "lucide-react";
import { PLATFORM_LABEL, type Platform } from "@/lib/ads/constants";
import type { AdAccountInfo } from "@/lib/ads/types";
import type { AccountSummary, ClientSummary } from "@/lib/ads/model/types";
import type { WorkspaceSummary } from "@/lib/ads/workspaces";
import { Btn, Card, Pill, SectionTitle, type PillTone } from "@/components/panou/ui/primitives";
import { EmptyState, ErrorState, inputClass } from "@/components/panou/ui/states";
import { ConfirmDialog, InlineNote } from "@/components/panou/ui/actions";
import { Modal } from "@/components/panou/ui/modal";
import { SoftSelect, TextInput } from "@/components/panou/ui/select";
import { useToast } from "@/components/panou/ui/toast";
import { num, relativeRo } from "@/components/panou/ui/format";
import { cn } from "@/lib/utils";
import { CanalMark } from "./canal-mark";

/**
 * Clienți (ClientsPage din redesign): carduri cu conexiunile pe Meta / Google /
 * TikTok, plafonul de buget și fereastra de editare. Datele sunt cele reale:
 * un client e un nume în Supabase care adună conturile lui; tokenul și plafonul
 * vin din spațiul de lucru al fiecărui cont (cheia stă în Vercel, nu în pagină).
 * „Reconectează” înseamnă aici „citește din nou contul”: dacă eroarea cere un
 * token nou, îl pui în Vercel și apeși din nou.
 */

type Failure = { ok: false; message: string };

export interface ClientiActions {
  create: (input: { name: string; owner: string }) => Promise<{ ok: true; id: string } | Failure>;
  rename: (input: { id: string; name: string }) => Promise<{ ok: true } | Failure>;
  archive: (input: { id: string }) => Promise<{ ok: true } | Failure>;
  visible: (input: { workspace: string }) => Promise<{ ok: true; accounts: AdAccountInfo[]; note: string | null } | Failure>;
  addAccount: (input: { clientId: string; workspace: string; adAccount: string }) => Promise<{ ok: true; note: string | null } | Failure>;
  setSync: (input: { accountId: string; enabled: boolean }) => Promise<{ ok: true } | Failure>;
  sync: (input: { clientId: string }) => Promise<{ ok: true; summary: string; problems: string[] } | Failure>;
}

const UNREACHABLE = "Serverul n-a răspuns. Încearcă din nou.";
const LABEL = "text-[11px] uppercase tracking-[0.12em] text-muted-foreground";
const PLATFORM_ORDER: Platform[] = ["meta", "google", "tiktok"];

// ---------------------------------------------------------------------------
// Starea conexiunii pe un canal
// ---------------------------------------------------------------------------

type Conn = "ok" | "partial" | "failed" | "nokey" | "off" | "new" | "none";

const STATE_UI: Record<Conn, { tone: PillTone; label: string; icon: LucideIcon; text: string }> = {
  ok: { tone: "mint", label: "conectat", icon: Check, text: "text-mint" },
  partial: { tone: "apricot", label: "parțial", icon: AlertCircle, text: "text-apricot" },
  failed: { tone: "rose", label: "eroare", icon: AlertCircle, text: "text-rose" },
  nokey: { tone: "apricot", label: "fără cheie", icon: KeyRound, text: "text-apricot" },
  off: { tone: "neutral", label: "oprit", icon: Plug, text: "text-muted-foreground" },
  new: { tone: "neutral", label: "nesincronizat", icon: Plug, text: "text-muted-foreground" },
  none: { tone: "neutral", label: "neconectat", icon: Plug, text: "text-muted-foreground" },
};

function connectionOf(accounts: AccountSummary[], workspaces: WorkspaceSummary[]): Conn {
  if (accounts.length === 0) return "none";
  if (accounts.some((account) => workspaces.find((workspace) => workspace.id === account.workspace)?.tokenConfigured === false)) return "nokey";
  const tracked = accounts.filter((account) => account.syncEnabled);
  if (tracked.length === 0) return "off";
  if (tracked.some((account) => account.lastSyncStatus === "failed")) return "failed";
  if (tracked.some((account) => account.lastSyncStatus === "partial")) return "partial";
  if (tracked.every((account) => !account.lastSyncedAt)) return "new";
  return "ok";
}

function latestSync(accounts: AccountSummary[]): string | null {
  return accounts.map((account) => account.lastSyncedAt).filter((value): value is string => Boolean(value)).sort().at(-1) ?? null;
}

/** Plafonul de buget zilnic la creare, din spațiile de lucru ale proprietarului: „2.500 RON · 500 EUR”. */
function capText(owner: ClientSummary["owner"], workspaces: WorkspaceSummary[]): string {
  const cap = workspaces.find((workspace) => workspace.owner === owner)?.dailyBudgetCap ?? {};
  return Object.entries(cap)
    .map(([currency, value]) => `${num(value)} ${currency}`)
    .join(" · ");
}

const OWNER_LABEL: Record<ClientSummary["owner"], string> = { agentie: "Banii agenției", clienti: "Banii clientului" };

type Note = { tone: "mint" | "apricot" | "rose"; text: string; list?: string[] } | null;

function NoteBox({ note, className }: { note: Note; className?: string }) {
  if (!note) return null;
  return (
    <InlineNote tone={note.tone} className={cn("text-[12px]", className)}>
      <div role={note.tone === "rose" ? "alert" : "status"}>
        <p>{note.text}</p>
        {note.list?.length ? (
          <ul className="mt-1.5 list-disc space-y-1 pl-5">
            {note.list.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : null}
      </div>
    </InlineNote>
  );
}

// ---------------------------------------------------------------------------
// Cardul clientului
// ---------------------------------------------------------------------------

function ClientCard({
  client,
  workspaces,
  actions,
  onEdit,
}: {
  client: ClientSummary;
  workspaces: WorkspaceSummary[];
  actions: ClientiActions;
  onEdit: (client: ClientSummary, platform?: Platform) => void;
}) {
  const router = useRouter();
  const { notify } = useToast();
  const [pending, start] = useTransition();
  const [note, setNote] = useState<Note>(null);

  const rows = PLATFORM_ORDER.map((platform) => {
    const accounts = client.accounts.filter((account) => account.platform === platform);
    return { platform, accounts, conn: connectionOf(accounts, workspaces) };
  });
  const broken = rows.filter((row) => row.conn === "failed" || row.conn === "partial");
  const noKey = rows.find((row) => row.conn === "nokey");
  const noKeyWorkspace = noKey ? workspaces.find((workspace) => workspace.id === noKey.accounts.find((account) => workspaces.find((item) => item.id === account.workspace)?.tokenConfigured === false)?.workspace) : null;
  const synced = latestSync(client.accounts);

  const refresh = () =>
    start(async () => {
      setNote({ tone: "apricot", text: "Se citesc din nou conturile: structura și cifrele fiecăruia…" });
      const result = await actions.sync({ clientId: client.id }).catch(() => ({ ok: false as const, message: UNREACHABLE }) as Failure);
      if (!result.ok) {
        setNote({ tone: "rose", text: result.message });
        return;
      }
      setNote({ tone: result.problems.length ? "apricot" : "mint", text: result.summary, list: result.problems });
      if (!result.problems.length) notify(`${client.name}: ${result.summary}`);
      router.refresh();
    });

  return (
    <Card className="flex flex-col">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[13.5px] font-medium">{client.name}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {OWNER_LABEL[client.owner]} · plafon {capText(client.owner, workspaces)}/zi
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Btn size="xs" variant="ghost" onClick={() => onEdit(client)}>
            Editează
          </Btn>
        </div>
      </div>

      <ul className="mt-3 space-y-1.5">
        {rows.map(({ platform, accounts, conn }) => {
          const ui = STATE_UI[conn];
          const Icon = ui.icon;
          const retry = conn === "failed" || conn === "partial";
          const failing = accounts.find((account) => account.lastSyncStatus === "failed" && account.syncEnabled);
          return (
            <li key={platform} className="rounded-lg border border-white/[0.06] px-2.5 py-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-[12px]">
                  <Icon className={cn("h-3 w-3", ui.text)} aria-hidden="true" />
                  {PLATFORM_LABEL[platform]}
                  {accounts.length > 1 ? <span className="text-[10.5px] text-muted-foreground">· {accounts.length} conturi</span> : null}
                </span>
                <span className="flex items-center gap-1.5">
                  <Pill tone={ui.tone}>{ui.label}</Pill>
                  {conn !== "ok" ? (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => (retry ? refresh() : onEdit(client, platform))}
                      className="rounded p-1 text-muted-foreground hover:text-foreground disabled:opacity-45"
                      aria-label={
                        retry
                          ? `Reconectează ${PLATFORM_LABEL[platform]} pentru ${client.name}: citește din nou contul`
                          : conn === "none"
                            ? `Adaugă un cont ${PLATFORM_LABEL[platform]} pentru ${client.name}`
                            : `Deschide conturile ${PLATFORM_LABEL[platform]} ale ${client.name}`
                      }
                    >
                      {retry ? <RefreshCw className={cn("h-3 w-3", pending && "animate-spin")} aria-hidden="true" /> : <Plus className="h-3 w-3" aria-hidden="true" />}
                    </button>
                  ) : null}
                </span>
              </div>
              {accounts.length > 0 ? (
                <p className="mt-1 truncate font-mono text-[10px] text-muted-foreground" title={accounts.map((account) => account.adAccount).join(", ")}>
                  {accounts.map((account) => account.name ?? account.adAccount).join(" · ")}
                </p>
              ) : null}
              {failing?.lastSyncError ? <p className="mt-1 line-clamp-2 text-[10.5px] leading-snug text-rose">{failing.lastSyncError}</p> : null}
            </li>
          );
        })}
      </ul>

      {broken.length > 0 ? (
        <div className="mt-3 flex items-center justify-between gap-2 rounded-lg border border-rose/20 bg-rose/[0.06] px-2.5 py-2">
          <p className="text-[10.5px] leading-tight text-[#FFC2CE]">
            Ultima citire a eșuat pe {broken.map((row) => PLATFORM_LABEL[row.platform]).join(" și ")}. Cifrele rămân cele de la ultima actualizare.
          </p>
          <Btn size="xs" variant="danger" onClick={refresh} disabled={pending}>
            {pending ? "Se citește…" : "Reconectează"}
          </Btn>
        </div>
      ) : noKey && noKeyWorkspace ? (
        <p className="mt-3 rounded-lg border border-apricot/20 bg-apricot/[0.06] px-2.5 py-2 text-[10.5px] leading-tight text-[#FFD0AC]">
          Spațiul {noKeyWorkspace.name} nu are cheie: setează <span className="font-mono">{noKeyWorkspace.tokenEnv}</span> în Vercel și fă redeploy.
        </p>
      ) : (
        <p className="mt-3 text-[10.5px] text-muted-foreground">
          {client.accounts.length === 0
            ? "Niciun cont încă. Adaugă conturile ca să-i vezi campaniile."
            : `Toate conexiunile răspund. Portalul le citește în fiecare dimineață${synced ? ` · ultima citire ${relativeRo(synced)}` : ""}.`}
        </p>
      )}

      <NoteBox note={note} className="mt-3" />

      <div className="mt-3 flex justify-end">
        <Btn size="xs" variant="outline" icon={RefreshCw} disabled={pending || client.accounts.length === 0} onClick={refresh}>
          {pending ? "Se actualizează…" : "Actualizează acum"}
        </Btn>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Fereastra „Editează”
// ---------------------------------------------------------------------------

function syncLine(account: AccountSummary): { text: string; tone: string } {
  if (!account.syncEnabled) return { text: "urmărirea e oprită", tone: "text-muted-foreground" };
  if (!account.lastSyncedAt) return { text: "încă nesincronizat", tone: "text-muted-foreground" };
  if (account.lastSyncStatus === "failed") return { text: `ultima citire a eșuat · ${relativeRo(account.lastSyncedAt)}`, tone: "text-rose" };
  return { text: `actualizat ${relativeRo(account.lastSyncedAt)}`, tone: "text-muted-foreground" };
}

function AccountRow({ account, actions }: { account: AccountSummary; actions: ClientiActions }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const line = syncLine(account);
  const id = useId();
  return (
    <li className="flex flex-wrap items-center gap-3 rounded-lg border border-white/[0.06] px-3 py-2.5">
      <CanalMark platform={account.platform} size="sm" label={false} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12.5px] font-medium">{account.name ?? account.adAccount}</p>
        <p className="mt-0.5 flex flex-wrap gap-x-2 font-mono text-[10.5px] text-muted-foreground">
          <span>{account.adAccount}</span>
          {account.currency ? <span>· {account.currency}</span> : null}
          <span className={line.tone}>· {line.text}</span>
          {account.measured === false ? <span className="text-apricot">· fără conversii — rezultatele vor fi „nemăsurat”</span> : null}
        </p>
        {account.lastSyncStatus === "failed" && account.lastSyncError ? <p className="mt-1 text-[11px] leading-snug text-rose">{account.lastSyncError}</p> : null}
        {error ? <p className="mt-1 text-[11px] text-rose">{error}</p> : null}
      </div>
      <label htmlFor={id} className="flex items-center gap-2 text-[12px] text-foreground/80">
        <input
          id={id}
          type="checkbox"
          checked={account.syncEnabled}
          disabled={pending}
          onChange={(event) => {
            const enabled = event.currentTarget.checked;
            start(async () => {
              const result = await actions.setSync({ accountId: account.id, enabled }).catch(() => ({ ok: false as const, message: UNREACHABLE }) as Failure);
              setError(result.ok ? null : result.message);
              router.refresh();
            });
          }}
          className="h-4 w-4 accent-lav"
        />
        Urmărește contul
      </label>
    </li>
  );
}

function AddAccount({ client, workspaces, actions, startPlatform }: { client: ClientSummary; workspaces: WorkspaceSummary[]; actions: ClientiActions; startPlatform: Platform | null }) {
  const router = useRouter();
  const { notify } = useToast();
  const own = workspaces.filter((workspace) => workspace.owner === client.owner);
  const first = (startPlatform ? own.find((workspace) => workspace.platform === startPlatform) : null) ?? own[0];
  const [workspaceId, setWorkspaceId] = useState<string>(first?.id ?? "");
  const [manual, setManual] = useState("");
  const [visible, setVisible] = useState<{ accounts: AdAccountInfo[]; note: string | null } | null>(null);
  const [note, setNote] = useState<Note>(null);
  const [pending, start] = useTransition();
  const tracked = new Set(client.accounts.map((account) => `${account.platform}|${account.adAccount}`));
  const workspace = own.find((item) => item.id === workspaceId) ?? null;

  const add = (adAccount: string) =>
    start(async () => {
      const result = await actions.addAccount({ clientId: client.id, workspace: workspaceId, adAccount }).catch(() => ({ ok: false as const, message: UNREACHABLE }) as Failure);
      if (!result.ok) {
        setNote({ tone: "rose", text: result.message });
        return;
      }
      setNote(result.note ? { tone: "apricot", text: result.note } : { tone: "mint", text: "Contul e adăugat. Apasă „Actualizează acum” ca să-i aduci campaniile." });
      if (!result.note) notify("Cont adăugat. Apasă „Actualizează acum” ca să-i aduci campaniile.");
      setManual("");
      router.refresh();
    });

  return (
    <div className="space-y-3">
      <p className={LABEL}>Adaugă un cont</p>
      <div className="flex flex-wrap items-end gap-2">
        <SoftSelect
          label="Spațiul de lucru"
          className="min-w-[12rem] flex-1"
          value={workspaceId}
          onChange={(value) => {
            setWorkspaceId(value);
            setVisible(null);
            setNote(null);
          }}
          options={own.map((item) => ({ value: item.id, label: `${item.name}${item.tokenConfigured ? "" : " (fără cheie)"}` }))}
        />
        <Btn
          size="sm"
          variant="outline"
          disabled={pending || !workspace}
          onClick={() =>
            start(async () => {
              const result = await actions.visible({ workspace: workspaceId }).catch(() => ({ ok: false as const, message: UNREACHABLE }) as Failure);
              if (!result.ok) setNote({ tone: "rose", text: result.message });
              else setVisible({ accounts: result.accounts, note: result.note });
            })
          }
        >
          Arată conturile pe care le vede tokenul
        </Btn>
      </div>

      {visible ? (
        <div>
          {visible.note ? <p className="text-[11.5px] leading-relaxed text-muted-foreground">{visible.note}</p> : null}
          {visible.accounts.length > 0 ? (
            <ul className="mt-2 divide-y divide-white/[0.05] overflow-hidden rounded-lg border border-white/[0.06]">
              {visible.accounts.map((account) => {
                const already = tracked.has(`${workspace?.platform}|${account.id}`);
                return (
                  <li key={account.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2">
                    <span className="min-w-0 text-[12.5px]">
                      <span className="font-medium">{account.name}</span>{" "}
                      <span className="font-mono text-[10.5px] text-muted-foreground">
                        {account.id} · {account.currency} · {account.state}
                      </span>
                    </span>
                    <Btn size="xs" variant={already ? "ghost" : "outline"} disabled={pending || already} onClick={() => add(account.id)}>
                      {already ? "Urmărit deja" : "Adaugă"}
                    </Btn>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      ) : null}

      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (manual.trim()) add(manual.trim());
        }}
      >
        <label className="min-w-[14rem] flex-1">
          <span className="mb-1 block text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">Sau scrie id-ul contului</span>
          <input
            value={manual}
            onChange={(event) => setManual(event.currentTarget.value)}
            placeholder={workspace?.platform === "meta" ? "act_000000000000000" : workspace?.platform === "google" ? "000-000-0000" : "7000000000000000000"}
            className={inputClass("font-mono text-[12.5px]")}
          />
        </label>
        <Btn type="submit" size="sm" variant="primary" disabled={pending || !manual.trim()}>
          {pending ? "Se verifică…" : "Adaugă contul"}
        </Btn>
      </form>
      <NoteBox note={note} />
    </div>
  );
}

function EditClient({
  client,
  workspaces,
  actions,
  startPlatform,
  onClose,
  onArchive,
}: {
  client: ClientSummary;
  workspaces: WorkspaceSummary[];
  actions: ClientiActions;
  startPlatform: Platform | null;
  onClose: () => void;
  onArchive: (client: ClientSummary) => void;
}) {
  const router = useRouter();
  const { notify } = useToast();
  const [name, setName] = useState(client.name);
  const [pending, start] = useTransition();
  const [problem, setProblem] = useState<string | null>(null);
  const changed = name.trim() !== client.name && name.trim().length > 0;

  return (
    <div>
      <h2 className="text-[16px] font-semibold">Editează {client.name}</h2>
      <p className="text-[12px] text-muted-foreground">Numele apare în selectoarele din bara de sus și în fișele campaniilor.</p>

      <div className="mt-4 space-y-4">
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (!changed) return;
            start(async () => {
              const result = await actions.rename({ id: client.id, name }).catch(() => ({ ok: false as const, message: UNREACHABLE }) as Failure);
              if (!result.ok) {
                setProblem(result.message);
                return;
              }
              setProblem(null);
              notify("Client actualizat.");
              router.refresh();
            });
          }}
        >
          <label className="min-w-[12rem] flex-1">
            <span className={LABEL}>Nume</span>
            <TextInput className="mt-1.5" value={name} maxLength={80} onChange={(event) => setName(event.currentTarget.value)} />
          </label>
          <Btn type="submit" variant="primary" size="md" disabled={pending || !changed}>
            Salvează
          </Btn>
        </form>
        {problem ? <InlineNote tone="rose">{problem}</InlineNote> : null}

        <div className="rounded-lg border border-white/[0.06] bg-white/[0.025] px-3 py-2.5 text-[11.5px] text-muted-foreground">
          <p>
            <span className="text-foreground/80">{OWNER_LABEL[client.owner]}</span> · plafon la creare <span className="pu-num text-foreground/80">{capText(client.owner, workspaces)}</span> pe zi.
          </p>
          <p className="mt-0.5">Plafonul prinde un zero în plus la creare; se setează în configurația spațiului de lucru, nu aici.</p>
        </div>

        <div className="space-y-2">
          <p className={LABEL}>Conturi</p>
          {client.accounts.length > 0 ? (
            <ul className="space-y-2">
              {client.accounts.map((account) => (
                <AccountRow key={account.id} account={account} actions={actions} />
              ))}
            </ul>
          ) : (
            <p className="text-[12px] text-muted-foreground">Niciun cont încă. Adaugă-l mai jos; portalul îi aduce campaniile în fiecare dimineață.</p>
          )}
        </div>

        <AddAccount client={client} workspaces={workspaces} actions={actions} startPlatform={startPlatform} />
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] pt-4">
        <Btn variant="danger" size="sm" onClick={() => onArchive(client)}>
          Arhivează clientul
        </Btn>
        <Btn variant="primary" onClick={onClose}>
          Gata
        </Btn>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Fereastra „Adaugă client”
// ---------------------------------------------------------------------------

function NewClient({ actions, onClose, onCreated }: { actions: ClientiActions; onClose: () => void; onCreated: (id: string) => void }) {
  const router = useRouter();
  const { notify } = useToast();
  const [name, setName] = useState("");
  const [owner, setOwner] = useState<"clienti" | "agentie">("clienti");
  const [problem, setProblem] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const groupId = useId();

  const OWNERS: Array<{ value: "clienti" | "agentie"; label: string; hint: string }> = [
    { value: "clienti", label: "Banii clientului", hint: "conturile din spațiile Clienți" },
    { value: "agentie", label: "Banii agenției (Meridian)", hint: "conturile proprii ale agenției" },
  ];

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        start(async () => {
          const result = await actions.create({ name, owner }).catch(() => ({ ok: false as const, message: UNREACHABLE }) as Failure);
          if (!result.ok) {
            setProblem(result.message);
            return;
          }
          notify(`${name.trim()} adăugat. Leagă-i conturile ca să-i vezi campaniile.`);
          router.refresh();
          onCreated(result.id);
        });
      }}
    >
      <h2 className="text-[16px] font-semibold">Adaugă client</h2>
      <p className="text-[12px] text-muted-foreground">Numele apare în selectoarele din bara de sus și în fișele campaniilor.</p>
      <div className="mt-4 space-y-3">
        <label className="block">
          <span className={LABEL}>Nume</span>
          <TextInput className="mt-1.5" placeholder="Restaurant Exemplu SRL" value={name} maxLength={80} required autoFocus onChange={(event) => setName(event.currentTarget.value)} />
        </label>
        <fieldset>
          <legend className={LABEL}>Ai cui sunt banii</legend>
          <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
            {OWNERS.map((option) => (
              <label
                key={option.value}
                className={cn(
                  "flex cursor-pointer flex-col rounded-lg border px-3 py-2 text-[12.5px] font-medium transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-lav",
                  owner === option.value ? "border-lav/40 bg-lav/12 text-[#D8CCFF]" : "border-white/[0.12] bg-white/[0.03] text-foreground/80 hover:bg-white/[0.06]"
                )}
              >
                <input type="radio" name={groupId} value={option.value} checked={owner === option.value} onChange={() => setOwner(option.value)} className="sr-only" />
                {option.label}
                <span className="text-[11px] font-normal text-muted-foreground">{option.hint}</span>
              </label>
            ))}
          </div>
        </fieldset>
        {problem ? <InlineNote tone="rose">{problem}</InlineNote> : null}
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Btn variant="ghost" onClick={onClose}>
          Renunță
        </Btn>
        <Btn type="submit" variant="primary" disabled={pending || !name.trim()}>
          {pending ? "Se adaugă…" : "Adaugă"}
        </Btn>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Ecranul
// ---------------------------------------------------------------------------

export function ClientiScreen({
  clients,
  failure,
  workspaces,
  actions,
}: {
  clients: ClientSummary[];
  /** Clienții n-au putut fi citiți. */
  failure: string | null;
  workspaces: WorkspaceSummary[];
  actions: ClientiActions;
}) {
  const router = useRouter();
  const { notify } = useToast();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<{ id: string; platform: Platform | null } | null>(null);
  const [archiving, setArchiving] = useState<ClientSummary | null>(null);
  const editingClient = editing ? (clients.find((client) => client.id === editing.id) ?? null) : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold leading-none sm:text-[26px]">Clienți</h1>
          <p className="mt-2 max-w-2xl text-[12.5px] text-muted-foreground">
            Spații de lucru și conturile conectate. Plafonul de buget zilnic se verifică la fiecare creare. Portalul citește conturile în fiecare dimineață și nu schimbă nimic în ele.
          </p>
        </div>
        <Btn size="sm" variant="primary" icon={Plus} onClick={() => setAdding(true)} disabled={Boolean(failure)}>
          Adaugă client
        </Btn>
      </div>

      {failure ? (
        <Card className="p-0">
          <ErrorState title="Clienții nu se pot citi" text={failure} onRetry={() => router.refresh()} />
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {clients.map((client) => (
            <ClientCard key={client.id} client={client} workspaces={workspaces} actions={actions} onEdit={(item, platform) => setEditing({ id: item.id, platform: platform ?? null })} />
          ))}

          {clients.length === 0 ? (
            <Card className="p-0 md:col-span-2 xl:col-span-2">
              <EmptyState
                icon={Building2}
                title="Niciun client încă"
                text="Un client adună conturile lui de pe Meta, Google și TikTok: îl adaugi o dată, îi legi conturile, iar portalul îi aduce campaniile, grupurile și reclamele în fiecare dimineață."
                action={
                  <Btn size="sm" variant="primary" icon={Plus} onClick={() => setAdding(true)}>
                    Adaugă primul client
                  </Btn>
                }
              />
            </Card>
          ) : null}

          <button
            type="button"
            onClick={() => setAdding(true)}
            className="flex min-h-[180px] flex-col items-center justify-center gap-2 rounded-[22px] border border-dashed border-white/[0.12] text-muted-foreground transition-colors hover:border-white/25 hover:text-foreground"
          >
            <Building2 className="h-5 w-5" aria-hidden="true" />
            <span className="text-[12px]">Adaugă un client</span>
          </button>
        </div>
      )}

      <Card>
        <SectionTitle title="Spații de lucru" hint="Un spațiu = un token și un plafon. Cheia stă în Vercel; aici vezi doar dacă e setată." />
        <ul className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {workspaces.map((workspace) => (
            <li key={workspace.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/[0.06] px-3 py-2">
              <div className="min-w-0">
                <CanalMark platform={workspace.platform} size="sm" label={false} className="mr-1" />
                <span className="text-[12.5px]">{workspace.name}</span>
                <p className="mt-1 text-[10.5px] text-muted-foreground">
                  {OWNER_LABEL[workspace.owner]} · plafon{" "}
                  <span className="pu-num">{Object.entries(workspace.dailyBudgetCap).map(([currency, value]) => `${num(value)} ${currency}`).join(" · ")}</span>/zi
                </p>
              </div>
              {workspace.tokenConfigured ? (
                <Pill tone="mint" dot>
                  cheie setată
                </Pill>
              ) : (
                <Pill tone="apricot">
                  <span className="font-mono text-[10.5px]">{workspace.tokenEnv}</span> lipsește
                </Pill>
              )}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[11px] text-muted-foreground">
          Cheia unui spațiu se schimbă în Vercel (Settings → Environment Variables), apoi redeploy. După ce ai pus-o, apasă „Reconectează” pe cardul clientului.
        </p>
      </Card>

      <Modal open={adding} onOpenChange={setAdding} label="Adaugă client">
        <NewClient
          actions={actions}
          onClose={() => setAdding(false)}
          onCreated={(id) => {
            setAdding(false);
            setEditing({ id, platform: null });
          }}
        />
      </Modal>

      <Modal
        open={Boolean(editingClient)}
        onOpenChange={(open) => !open && setEditing(null)}
        label={editingClient ? `Editează ${editingClient.name}` : undefined}
        className="max-h-[calc(100dvh-2rem)] w-[min(40rem,calc(100vw-2rem))] overflow-y-auto"
      >
        {editingClient && editing ? (
          <EditClient
            key={editingClient.id}
            client={editingClient}
            workspaces={workspaces}
            actions={actions}
            startPlatform={editing.platform}
            onClose={() => setEditing(null)}
            onArchive={(client) => {
              setEditing(null);
              setArchiving(client);
            }}
          />
        ) : null}
      </Modal>

      <ConfirmDialog
        open={Boolean(archiving)}
        onOpenChange={(open) => !open && setArchiving(null)}
        title={archiving ? `Arhivezi ${archiving.name}?` : "Arhivezi clientul?"}
        description="Clientul iese din selectoare și din liste."
        consequence="Conturile lui nu se mai actualizează. Nimic nu se șterge: campaniile rămân în platforme, iar istoricul și cifrele rămân în portal."
        confirmLabel="Arhivează clientul"
        onConfirm={async () => {
          if (!archiving) return;
          const result = await actions.archive({ id: archiving.id }).catch(() => ({ ok: false as const, message: UNREACHABLE }) as Failure);
          if (!result.ok) {
            notify(`Clientul nu e arhivat. ${result.message}`, "error");
            return;
          }
          notify(`${archiving.name} a fost arhivat.`);
          router.refresh();
        }}
      />
    </div>
  );
}

