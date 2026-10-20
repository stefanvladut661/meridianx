"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { AdAccountInfo } from "@/lib/ads/types";
import type { ClientSummary, AccountSummary } from "@/lib/ads/model/types";
import type { WorkspaceSummary } from "@/lib/ads/workspaces";
import { formatLeadDateTime } from "@/app/(admin)/admin/_components/format-date";
import { cn } from "@/lib/utils";
import { ERROR_TEXT, FIELD, LABEL, OK_TEXT, WARNING_TEXT } from "./tone";
import { ChannelIcon } from "./channel-icon";

type Failure = { ok: false; message: string };

export interface ClientsActions {
  create: (input: { name: string; owner: string }) => Promise<{ ok: true; id: string } | Failure>;
  rename: (input: { id: string; name: string }) => Promise<{ ok: true } | Failure>;
  archive: (input: { id: string }) => Promise<{ ok: true } | Failure>;
  visible: (input: { workspace: string }) => Promise<{ ok: true; accounts: AdAccountInfo[]; note: string | null } | Failure>;
  addAccount: (input: { clientId: string; workspace: string; adAccount: string }) => Promise<{ ok: true; note: string | null } | Failure>;
  setSync: (input: { accountId: string; enabled: boolean }) => Promise<{ ok: true } | Failure>;
  sync: (input: { clientId: string }) => Promise<{ ok: true; summary: string; problems: string[] } | Failure>;
}

type Note = { tone: "ok" | "warn" | "error"; text: string; list?: string[] } | null;

function NoteLine({ note }: { note: Note }) {
  if (!note) return null;
  return (
    <div role={note.tone === "error" ? "alert" : "status"} className="mt-3 text-[13.5px] leading-relaxed">
      <p className={note.tone === "error" ? ERROR_TEXT : note.tone === "warn" ? WARNING_TEXT : OK_TEXT}>{note.text}</p>
      {note.list?.length ? (
        <ul className="mt-1.5 list-disc space-y-1 pl-5 text-bone/80">
          {note.list.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function syncLine(account: AccountSummary): { text: string; tone: "ok" | "warn" | "error" | "dim" } {
  if (!account.syncEnabled) return { text: "urmărirea e oprită", tone: "dim" };
  if (!account.lastSyncedAt) return { text: "încă nesincronizat", tone: "dim" };
  const when = formatLeadDateTime(account.lastSyncedAt);
  if (account.lastSyncStatus === "failed") return { text: `ultima actualizare a eșuat (${when})`, tone: "error" };
  return { text: `actualizat ${when}`, tone: "ok" };
}

function AccountLine({ account, actions }: { account: AccountSummary; actions: ClientsActions }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const line = syncLine(account);
  return (
    <li className="grid gap-x-4 gap-y-1 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <div className="flex min-w-0 items-start gap-2.5">
        <ChannelIcon platform={account.platform} className="mt-0.5 shrink-0" />
        <div className="min-w-0">
          <p className="truncate text-[14.5px] font-semibold text-bone">{account.name ?? account.adAccount}</p>
          <p className="mt-0.5 flex flex-wrap gap-x-2 font-md-mono text-[12px] text-dim">
            <span>{account.adAccount}</span>
            {account.currency ? <span>· {account.currency}</span> : null}
            <span className={line.tone === "error" ? ERROR_TEXT : undefined}>· {line.text}</span>
            {account.measured === false ? <span className={WARNING_TEXT}>· fără conversii — rezultatele vor fi „nemăsurat”</span> : null}
          </p>
          {account.lastSyncStatus === "failed" && account.lastSyncError ? (
            <p className={cn("mt-1 text-[13px] leading-snug", ERROR_TEXT)}>{account.lastSyncError}</p>
          ) : null}
          {error ? <p className={cn("mt-1 text-[13px]", ERROR_TEXT)}>{error}</p> : null}
        </div>
      </div>
      <label className="flex items-center gap-2 text-[13px] text-bone/85 sm:justify-end">
        <input
          type="checkbox"
          checked={account.syncEnabled}
          disabled={pending}
          onChange={(event) => {
            const enabled = event.currentTarget.checked;
            start(async () => {
              const result = await actions.setSync({ accountId: account.id, enabled });
              setError(result.ok ? null : result.message);
              router.refresh();
            });
          }}
          className="h-4 w-4 accent-[var(--md-a1)]"
        />
        Urmărește contul
      </label>
    </li>
  );
}

function AddAccount({ client, workspaces, actions }: { client: ClientSummary; workspaces: WorkspaceSummary[]; actions: ClientsActions }) {
  const router = useRouter();
  const own = workspaces.filter((workspace) => workspace.owner === client.owner);
  const [workspaceId, setWorkspaceId] = useState<string>(own[0]?.id ?? "");
  const [manual, setManual] = useState("");
  const [visible, setVisible] = useState<{ accounts: AdAccountInfo[]; note: string | null } | null>(null);
  const [note, setNote] = useState<Note>(null);
  const [pending, start] = useTransition();
  const tracked = new Set(client.accounts.map((account) => `${account.platform}|${account.adAccount}`));
  const workspace = own.find((item) => item.id === workspaceId) ?? null;

  const add = (adAccount: string) =>
    start(async () => {
      const result = await actions.addAccount({ clientId: client.id, workspace: workspaceId, adAccount });
      if (!result.ok) {
        setNote({ tone: "error", text: result.message });
        return;
      }
      setNote(result.note ? { tone: "warn", text: result.note } : { tone: "ok", text: "Contul e adăugat. Apasă „Actualizează acum” ca să-i aduci campaniile." });
      setManual("");
      router.refresh();
    });

  return (
    <div className="border-t border-hair px-4 py-4">
      <p className={LABEL}>Adaugă un cont</p>
      <div className="mt-2.5 flex flex-wrap items-end gap-3">
        <label className="min-w-[12rem]">
          <span className="sr-only">Spațiul de lucru</span>
          <select
            value={workspaceId}
            onChange={(event) => {
              setWorkspaceId(event.currentTarget.value);
              setVisible(null);
              setNote(null);
            }}
            className={cn(FIELD, "h-10")}
          >
            {own.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
                {item.tokenConfigured ? "" : " (fără token)"}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={pending || !workspace}
          onClick={() =>
            start(async () => {
              const result = await actions.visible({ workspace: workspaceId });
              if (!result.ok) setNote({ tone: "error", text: result.message });
              else setVisible({ accounts: result.accounts, note: result.note });
            })
          }
          className="btn btn-ghost !min-h-10 !px-4 !py-2 !text-[13px]"
        >
          Arată conturile pe care le vede tokenul
        </button>
      </div>

      {visible ? (
        <div className="mt-3">
          {visible.note ? <p className="text-[13px] leading-relaxed text-dim">{visible.note}</p> : null}
          {visible.accounts.length > 0 ? (
            <ul className="mt-2 divide-y divide-hair overflow-hidden rounded-panel-sm border border-hair">
              {visible.accounts.map((account) => {
                const already = tracked.has(`${workspace?.platform}|${account.id}`);
                return (
                  <li key={account.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5">
                    <span className="min-w-0 text-[13.5px] text-bone">
                      <span className="font-semibold">{account.name}</span>{" "}
                      <span className="font-md-mono text-[12px] text-dim">
                        {account.id} · {account.currency} · {account.state}
                      </span>
                    </span>
                    <button
                      type="button"
                      disabled={pending || already}
                      onClick={() => add(account.id)}
                      className="btn btn-light !min-h-9 !px-3.5 !py-1.5 !text-[12.5px]"
                    >
                      {already ? "Urmărit deja" : "Adaugă"}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      ) : null}

      <form
        className="mt-3 flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (manual.trim()) add(manual.trim());
        }}
      >
        <label className="min-w-[14rem] flex-1">
          <span className="text-[12.5px] text-dim">Sau scrie id-ul contului</span>
          <input
            value={manual}
            onChange={(event) => setManual(event.currentTarget.value)}
            placeholder={workspace?.platform === "meta" ? "act_000000000000000" : workspace?.platform === "google" ? "000-000-0000" : "7000000000000000000"}
            className={cn(FIELD, "mt-1 h-10 font-md-mono text-[14px]")}
          />
        </label>
        <button type="submit" disabled={pending || !manual.trim()} className="btn btn-light !min-h-10 !px-4 !py-2 !text-[13px]">
          {pending ? "Se verifică…" : "Adaugă contul"}
        </button>
      </form>
      <NoteLine note={note} />
    </div>
  );
}

function ClientCard({ client, workspaces, actions }: { client: ClientSummary; workspaces: WorkspaceSummary[]; actions: ClientsActions }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [note, setNote] = useState<Note>(null);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(client.name);

  return (
    <li className="overflow-hidden rounded-panel-lg border border-hair bg-char">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4">
        {editing ? (
          <form
            className="flex flex-wrap items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              start(async () => {
                const result = await actions.rename({ id: client.id, name });
                if (!result.ok) setNote({ tone: "error", text: result.message });
                else {
                  setEditing(false);
                  router.refresh();
                }
              });
            }}
          >
            <label>
              <span className="sr-only">Numele clientului</span>
              <input value={name} onChange={(event) => setName(event.currentTarget.value)} maxLength={80} className={cn(FIELD, "h-10 w-64")} />
            </label>
            <button type="submit" disabled={pending} className="btn btn-light !min-h-9 !px-3.5 !py-1.5 !text-[12.5px]">
              Salvează
            </button>
            <button type="button" onClick={() => setEditing(false)} className="text-[13px] text-dim underline underline-offset-4">
              Renunță
            </button>
          </form>
        ) : (
          <div>
            <h2 className="text-[17px] font-semibold text-bone">{client.name}</h2>
            <p className="mt-0.5 text-[13px] text-dim">
              {client.owner === "agentie" ? "Banii agenției" : "Banii clientului"} ·{" "}
              {client.accounts.length === 0 ? "niciun cont încă" : client.accounts.length === 1 ? "un cont" : `${client.accounts.length} conturi`}
            </p>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={pending || client.accounts.length === 0}
            onClick={() =>
              start(async () => {
                setNote({ tone: "ok", text: "Se actualizează: structura și cifrele fiecărui cont…" });
                const result = await actions.sync({ clientId: client.id });
                if (!result.ok) setNote({ tone: "error", text: result.message });
                else setNote({ tone: result.problems.length ? "warn" : "ok", text: result.summary, list: result.problems });
                router.refresh();
              })
            }
            className="btn btn-light !min-h-9 !px-3.5 !py-1.5 !text-[12.5px]"
          >
            {pending ? "Se lucrează…" : "Actualizează acum"}
          </button>
          {!editing ? (
            <button type="button" onClick={() => setEditing(true)} className="btn btn-ghost !min-h-9 !px-3.5 !py-1.5 !text-[12.5px]">
              Redenumește
            </button>
          ) : null}
          {confirmArchive ? (
            <span className="flex items-center gap-2 text-[13px] text-bone/85">
              Scoți clientul din listă? Conturile nu se mai actualizează; nimic nu se șterge.
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const result = await actions.archive({ id: client.id });
                    if (!result.ok) setNote({ tone: "error", text: result.message });
                    router.refresh();
                  })
                }
                className="btn btn-ghost !min-h-9 !px-3.5 !py-1.5 !text-[12.5px]"
              >
                Da, arhivează
              </button>
              <button type="button" onClick={() => setConfirmArchive(false)} className="text-dim underline underline-offset-4">
                Nu
              </button>
            </span>
          ) : (
            <button type="button" onClick={() => setConfirmArchive(true)} className="text-[13px] text-dim underline underline-offset-4 hover:text-bone">
              Arhivează
            </button>
          )}
        </div>
      </div>
      <div className="px-4">
        <NoteLine note={note} />
      </div>

      {client.accounts.length > 0 ? (
        <ul className="mt-2 divide-y divide-hair border-t border-hair">
          {client.accounts.map((account) => (
            <AccountLine key={account.id} account={account} actions={actions} />
          ))}
        </ul>
      ) : null}
      <AddAccount client={client} workspaces={workspaces} actions={actions} />
    </li>
  );
}

export function ClientsManager({
  clients,
  workspaces,
  actions,
}: {
  clients: ClientSummary[];
  workspaces: WorkspaceSummary[];
  actions: ClientsActions;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [owner, setOwner] = useState<"clienti" | "agentie">("clienti");
  const [note, setNote] = useState<Note>(null);
  const [pending, start] = useTransition();

  return (
    <div className="mt-8 grid gap-8">
      <form
        className="rounded-panel-lg border border-hair bg-char px-4 py-4"
        onSubmit={(event) => {
          event.preventDefault();
          start(async () => {
            const result = await actions.create({ name, owner });
            if (!result.ok) {
              setNote({ tone: "error", text: result.message });
              return;
            }
            setNote({ tone: "ok", text: `Clientul „${name.trim()}” e adăugat. Leagă-i acum conturile, mai jos.` });
            setName("");
            router.refresh();
          });
        }}
      >
        <p className={LABEL}>Client nou</p>
        <div className="mt-2.5 flex flex-wrap items-end gap-3">
          <label className="min-w-[14rem] flex-1">
            <span className="text-[12.5px] text-dim">Numele, cum îl spui în agenție</span>
            <input value={name} onChange={(event) => setName(event.currentTarget.value)} maxLength={80} required className={cn(FIELD, "mt-1 h-10")} />
          </label>
          <fieldset className="flex flex-wrap items-center gap-4 text-[13.5px] text-bone/85">
            <legend className="sr-only">Ai cui sunt banii</legend>
            <label className="flex items-center gap-2">
              <input type="radio" name="owner" checked={owner === "clienti"} onChange={() => setOwner("clienti")} className="accent-[var(--md-a1)]" />
              Banii clientului
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" name="owner" checked={owner === "agentie"} onChange={() => setOwner("agentie")} className="accent-[var(--md-a1)]" />
              Banii agenției (Meridian)
            </label>
          </fieldset>
          <button type="submit" disabled={pending || !name.trim()} className="btn btn-light !min-h-10 !px-4 !py-2 !text-[13px]">
            Adaugă clientul
          </button>
        </div>
        <NoteLine note={note} />
      </form>

      {clients.length === 0 ? (
        <p className="max-w-2xl text-[15px] leading-relaxed text-bone/75">
          Niciun client încă. Un client adună conturile lui de pe Meta, Google și TikTok: îl adaugi o dată, îi legi conturile, iar
          portalul îi aduce campaniile, grupurile și reclamele în fiecare dimineață.
        </p>
      ) : (
        <ul className="grid gap-5">
          {clients.map((client) => (
            <ClientCard key={client.id} client={client} workspaces={workspaces} actions={actions} />
          ))}
        </ul>
      )}
    </div>
  );
}

