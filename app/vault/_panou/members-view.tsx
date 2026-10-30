"use client";

import { useState } from "react";
import Link from "next/link";
import { KeyRound, RefreshCw, ShieldCheck, UserCheck, UserX } from "lucide-react";
import type { VaultMember, VaultMeta } from "@/lib/vault/members";
import { Btn, Card, Pill, SectionTitle } from "@/components/panou/ui/primitives";
import { ConfirmDialog, InlineNote } from "@/components/panou/ui/actions";
import { ErrorState, LoadingRows } from "@/components/panou/ui/states";
import { useToast } from "@/components/panou/ui/toast";
import { dateRo, relativeRo } from "@/components/panou/ui/format";
import { describeError } from "./errors";
import { emailInitials } from "./format";
import { RecoveryCodeDialog } from "./recovery-code";
import { PageHead } from "./ui";

/**
 * Membrii (VaultMembersPage din prototip): cine are cheia, aprobarea, eliminarea
 * și codul de recuperare. Aprobarea e manuală, mereu: browserul unui membru
 * activ sigilează cheia de date către cheia publică a solicitantului; la server
 * ajunge doar blob-ul.
 *
 * Ce spune prototipul și Vault-ul real nu face: eliminarea unui membru NU
 * rotește singură cheia. Textele de aici spun adevărul și trimit la „Contul meu”,
 * unde se rotește.
 */

export interface MembersApi {
  approve: (member: VaultMember) => Promise<void>;
  remove: (member: VaultMember) => Promise<void>;
  /** Cod de recuperare NOU; cel vechi încetează pe loc. */
  regenerateRecoveryCode: () => Promise<string>;
}

export function MembersView({
  members,
  meta,
  selfId,
  error,
  reload,
  api,
}: {
  members: VaultMember[] | null;
  meta: VaultMeta | null;
  selfId: string | null;
  error: string | null;
  reload: () => Promise<void>;
  api: MembersApi;
}) {
  const { notify } = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [removing, setRemoving] = useState<VaultMember | null>(null);
  const [rotateOpen, setRotateOpen] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [removedActive, setRemovedActive] = useState<string | null>(null);
  const [reloading, setReloading] = useState(false);

  const emailOf = (id: string | null) => (id ? (members?.find((row) => row.id === id)?.email ?? "membru eliminat") : null);
  const active = members?.filter((row) => row.wrappedDek) ?? [];
  const pending = members?.filter((row) => !row.wrappedDek) ?? [];

  async function approve(target: VaultMember) {
    setBusyId(target.id);
    setActionError(null);
    try {
      await api.approve(target);
      await reload();
      notify(`${target.email} are acum acces la seif.`);
    } catch (cause) {
      setActionError(describeError(cause, "Aprobarea a eșuat dintr-un motiv necunoscut. Reîncarcă lista și încearcă din nou."));
    } finally {
      setBusyId(null);
    }
  }

  async function remove(target: VaultMember) {
    setBusyId(target.id);
    setActionError(null);
    try {
      await api.remove(target);
      if (target.wrappedDek) setRemovedActive(target.email);
      await reload();
      notify(target.wrappedDek ? `${target.email} a fost eliminat. Rotește cheia din Contul meu.` : `Cererea lui ${target.email} a fost respinsă.`);
    } catch (cause) {
      setActionError(describeError(cause, "Eliminarea a eșuat dintr-un motiv necunoscut. Reîncarcă lista și încearcă din nou."));
    } finally {
      setBusyId(null);
    }
  }

  async function regenerate() {
    setBusyId("rotate");
    setActionError(null);
    try {
      setCode(await api.regenerateRecoveryCode());
      await reload();
    } catch (cause) {
      setActionError(describeError(cause, "Codul nu s-a putut regenera. Încearcă din nou."));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <PageHead
        title="Membri"
        text="Cine are cheia pentru acest seif. Aprobarea e manuală, mereu."
        action={
          <div className="flex flex-wrap items-center gap-2">
            {pending.length > 0 ? (
              <Pill tone="apricot" dot>
                {pending.length} în așteptare
              </Pill>
            ) : null}
            <Pill tone="mint" dot>
              {active.length} {active.length === 1 ? "membru activ" : "membri activi"}
            </Pill>
            <Btn
              size="xs"
              variant="ghost"
              icon={RefreshCw}
              disabled={reloading}
              onClick={async () => {
                setReloading(true);
                try {
                  await reload();
                } finally {
                  setReloading(false);
                }
              }}
            >
              Reîncarcă
            </Btn>
          </div>
        }
      />

      <div aria-live="polite" className="space-y-2">
        {actionError ? <InlineNote tone="rose">{actionError}</InlineNote> : null}
        {removedActive ? (
          <InlineNote tone="apricot">
            {removedActive} a avut cheia de date în memorie. Eliminarea nu rotește cheia singură: <Link href="/vault/cont" className="underline underline-offset-2">rotește-o din Contul meu</Link>, ca ce se scrie de acum să nu
            se mai deschidă cu ea.
          </InlineNote>
        ) : null}
      </div>

      <Card padded={false} className="overflow-hidden">
        {members === null ? (
          error ? (
            <ErrorState title="Membrii nu s-au încărcat" text={error} onRetry={() => void reload()} />
          ) : (
            <LoadingRows rows={3} cols={3} />
          )
        ) : (
          <ul className="divide-y divide-white/[0.05]">
            {members.map((row) => {
              const isActive = Boolean(row.wrappedDek);
              const isSelf = row.id === selfId;
              const working = busyId === row.id;
              return (
                <li key={row.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/[0.1] bg-white/[0.04] text-[10.5px] font-semibold text-foreground/70" aria-hidden="true">
                    {emailInitials(row.email)}
                  </span>
                  <div className="min-w-0 flex-1 basis-[12rem]">
                    <p className="truncate text-[12.5px]">
                      {row.email}
                      {isSelf ? <span className="ml-2 text-[11px] text-muted-foreground">(tu)</span> : null}
                    </p>
                    <p className="text-[10.5px] text-muted-foreground">
                      {isActive ? "activ" : "cerere"} din {dateRo(row.createdAt)}
                      {isActive && row.approvedBy === row.id ? " · fondator" : isActive && row.approvedBy ? ` · aprobat de ${emailOf(row.approvedBy)}` : ""}
                      {isActive ? ` · actualizat ${relativeRo(row.updatedAt)}` : ""}
                    </p>
                  </div>
                  <Pill tone={isActive ? "mint" : "apricot"} dot>
                    {isActive ? "activ" : "în așteptare"}
                  </Pill>
                  {!isActive ? (
                    <Btn size="xs" variant="primary" icon={UserCheck} disabled={working} onClick={() => void approve(row)}>
                      {working ? "Se sigilează…" : "Aprobă"}
                    </Btn>
                  ) : null}
                  {!isSelf ? (
                    <Btn size="xs" variant="ghost" icon={UserX} disabled={working} onClick={() => setRemoving(row)}>
                      {isActive ? "Elimină" : "Respinge"}
                    </Btn>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
        <p className="border-t border-white/[0.06] px-4 py-3 text-[11px] leading-relaxed text-muted-foreground">
          Un membru nou se adaugă din Supabase → Authentication → Users, cu o parolă temporară. Își activează contul la{" "}
          <Link href="/vault/activare" className="underline underline-offset-2 hover:text-foreground">
            Activează seiful
          </Link>
          , apoi apare aici în așteptare.
        </p>
      </Card>

      <Card>
        <SectionTitle
          title="Codul de recuperare"
          hint="se afișează o singură dată, la regenerare"
          action={
            <Btn size="sm" variant="outline" icon={KeyRound} disabled={!meta || busyId === "rotate"} onClick={() => setRotateOpen(true)}>
              {busyId === "rotate" ? "Se regenerează…" : "Regenerează"}
            </Btn>
          }
        />
        {meta ? (
          <p className="mt-2 text-[11px] text-muted-foreground">
            creat {dateRo(meta.createdAt)}
            {meta.createdBy ? ` de ${emailOf(meta.createdBy) ?? "un membru eliminat"}` : ""} ·{" "}
            {meta.recoveryRotations === 0
              ? "niciodată regenerat"
              : `regenerat de ${meta.recoveryRotations} ${meta.recoveryRotations === 1 ? "dată" : "ori"}, ultima dată ${dateRo(meta.updatedAt)}`}
          </p>
        ) : null}
        <InlineNote tone="apricot" className="mt-3">
          Codul vechi nu mai funcționează după regenerare. Ține-l offline, nu în seif. Codul deschide seiful fără parola master: dacă hârtia s-a pierdut sau a văzut-o cine nu trebuia, regenerează-l.
        </InlineNote>
      </Card>

      <InlineNote tone="neutral">
        <span className="flex items-start gap-1.5">
          <ShieldCheck className="mt-0.5 h-3 w-3 shrink-0 text-mint" aria-hidden="true" />
          Un membru aprobat primește cheia în browserul lui, nu pe server. Eliminarea nu rotește cheia singură: după ce scoți un membru activ, rotește cheia din Contul meu.
        </span>
      </InlineNote>

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(value) => !value && setRemoving(null)}
        title={removing?.wrappedDek ? `Elimini pe ${removing.email}?` : `Respingi cererea lui ${removing?.email ?? ""}?`}
        description={removing?.wrappedDek ? "Accesul dispare la următoarea deblocare. Rândurile rămân lizibile pentru ceilalți." : "Cererea dispare. Contul Supabase rămâne; poate cere din nou."}
        consequence={
          removing?.wrappedDek
            ? "Ce a văzut până acum a văzut: cheia de date nu se rotește singură. După eliminare, rotește cheia din Contul meu, ca ce se scrie de acum să nu se mai deschidă cu ea."
            : undefined
        }
        confirmLabel={removing?.wrappedDek ? "Elimină membrul" : "Respinge cererea"}
        onConfirm={async () => {
          if (removing) await remove(removing);
        }}
      />

      <ConfirmDialog
        open={rotateOpen}
        onOpenChange={setRotateOpen}
        tone="primary"
        title="Regenerezi codul de recuperare?"
        description="Se generează un cod nou, afișat o singură dată, imediat."
        consequence="Codul actual nu va mai deschide nimic. Notează-l pe cel nou înainte să închizi fereastra."
        confirmLabel="Regenerează"
        onConfirm={regenerate}
      />

      <RecoveryCodeDialog
        code={code}
        onConfirm={() => {
          setCode(null);
          notify("Cod salvat. Nu îl păstra în seif.");
        }}
      />
    </>
  );
}
