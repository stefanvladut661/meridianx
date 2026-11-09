"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { CheckCircle2, KeyRound, Lock, RefreshCw, RotateCcw, ShieldCheck } from "lucide-react";
import { KDF } from "@/lib/vault/crypto";
import type { KeyringStatus } from "@/lib/vault/keyring";
import type { VaultMember } from "@/lib/vault/members";
import { Btn, Card, Pill, SectionTitle } from "@/components/panou/ui/primitives";
import { ConfirmDialog, InlineNote } from "@/components/panou/ui/actions";
import { ProgressBar } from "@/components/panou/ui/states";
import { useToast } from "@/components/panou/ui/toast";
import { dateRo } from "@/components/panou/ui/format";
import type { BusyStep } from "../_components/vault-provider";
import { describeError } from "./errors";
import { countNoun } from "./format";
import { RecoveryCodeDialog } from "./recovery-code";
import { BusyBlock, LabeledInput, PageHead } from "./ui";

/**
 * Contul meu (VaultAccountPage din prototip): schimbarea parolei master și
 * inelul de chei. Cifrele de pe ecran sunt cele reale: cu ce cheie se scrie
 * acum, câte rânduri au rămas pe chei vechi, cui îi lipsește o cheie rotită.
 *
 * Rotația pune o cheie nouă, sigilată pentru membrii activi, și un COD DE
 * RECUPERARE NOU (afișat o singură dată), apoi re-criptează rândurile cu
 * contor. Cheile vechi nu se șterg niciodată: istoricul e scris cu ele.
 */

export const MIN_MASTER_LENGTH = 12;

export interface AccountApi {
  /** Parola actuală + cea nouă. Aruncă cu mesaj pentru om (inclusiv „Parola master actuală e greșită.”). */
  changePassword: (current: string, next: string, onStep: (step: BusyStep) => void) => Promise<void>;
  keyringStatus: () => Promise<{ status: KeyringStatus; stale: number }>;
  /** Cheie nouă + cod de recuperare nou. */
  rotate: () => Promise<string>;
  reencrypt: (onProgress: (done: number, total: number) => void) => Promise<{ done: number; skipped: number }>;
  grant: (member: VaultMember) => Promise<void>;
}

const STEP_LABEL: Partial<Record<BusyStep, string>> = {
  deriving: "Se derivă cheia din parolă",
  "signing-in": "Se verifică parola actuală",
  rekeying: "Se refac cheile",
  "updating-password": "Se schimbă parola Supabase",
};

type Reencrypt = { state: "idle" } | { state: "running"; done: number; total: number } | { state: "done"; done: number; skipped: number };

export function AccountView({
  email,
  members,
  api,
  reload,
  onLock,
}: {
  email: string | null;
  members: VaultMember[] | null;
  api: AccountApi;
  reload: () => Promise<void>;
  onLock: () => void;
}) {
  const { notify } = useToast();

  // --- Parola master -------------------------------------------------------
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [step, setStep] = useState<{ step: BusyStep; startedAt: number } | null>(null);
  const [passError, setPassError] = useState<string | null>(null);

  const canSave = current.length > 0 && next.length >= MIN_MASTER_LENGTH && next === confirm && next !== current;

  async function changePassword(event: FormEvent) {
    event.preventDefault();
    if (!canSave || step) return;
    setPassError(null);
    try {
      await api.changePassword(current, next, (s) => setStep({ step: s, startedAt: Date.now() }));
      setCurrent("");
      setNext("");
      setConfirm("");
      notify("Parola master schimbată. Codul de recuperare rămâne valabil.");
    } catch (cause) {
      // Erorile de autentificare (ex. „Parola master actuală e greșită.”) sunt deja scrise pentru om.
      setPassError(describeError(cause, cause instanceof Error && cause.message ? cause.message : "Schimbarea parolei a eșuat dintr-un motiv necunoscut."));
    } finally {
      setStep(null);
    }
  }

  // --- Inelul de chei ------------------------------------------------------
  const [ring, setRing] = useState<{ status: KeyringStatus; stale: number } | null>(null);
  const [ringError, setRingError] = useState<string | null>(null);
  const [rotateOpen, setRotateOpen] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [newCode, setNewCode] = useState<string | null>(null);
  const [reencrypt, setReencrypt] = useState<Reencrypt>({ state: "idle" });
  const [granting, setGranting] = useState(false);

  const refresh = useCallback(async () => {
    if (!members) return;
    try {
      setRing(await api.keyringStatus());
      setRingError(null);
    } catch (cause) {
      setRingError(describeError(cause, "Starea inelului de chei nu s-a putut citi. Încearcă din nou."));
    }
  }, [api, members]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const emailOf = (id: string | null) => (id ? (members?.find((row) => row.id === id)?.email ?? "membru eliminat") : "—");
  const status = ring?.status ?? null;
  const rotations = status?.deks.length ?? 0;
  const stale = ring?.stale ?? null;
  const running = reencrypt.state === "running";

  async function startReencrypt() {
    setRingError(null);
    setReencrypt({ state: "running", done: 0, total: stale ?? 0 });
    try {
      const result = await api.reencrypt((done, total) => setReencrypt({ state: "running", done, total }));
      setReencrypt({ state: "done", ...result });
      await Promise.all([refresh(), reload()]);
      if (result.skipped === 0) notify("Toate rândurile sunt pe cheia curentă.");
    } catch (cause) {
      setRingError(describeError(cause, "Re-criptarea s-a oprit dintr-un motiv necunoscut. O poți relua."));
      setReencrypt({ state: "idle" });
    }
  }

  async function rotate() {
    setRingError(null);
    setRotating(true);
    try {
      setNewCode(await api.rotate());
      void refresh();
    } catch (cause) {
      setRingError(describeError(cause, "Rotația a eșuat dintr-un motiv necunoscut. Încearcă din nou."));
    } finally {
      setRotating(false);
    }
  }

  async function grantAll() {
    if (!status) return;
    setGranting(true);
    setRingError(null);
    try {
      for (const { member } of status.missing) await api.grant(member);
      await refresh();
      notify("Chei acordate.");
    } catch (cause) {
      setRingError(describeError(cause, "Cheile nu s-au putut acorda. Încearcă din nou."));
    } finally {
      setGranting(false);
    }
  }

  return (
    <>
      <PageHead title="Contul meu" />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <SectionTitle
            title="Parola master"
            hint={email ?? undefined}
            info="Nu se resetează prin email: dacă o uiți, rămâne doar codul de recuperare. Datele și codul nu se schimbă."
          />
          <form onSubmit={changePassword} noValidate className="mt-3 space-y-3">
            <LabeledInput label="Parola master actuală" type="password" value={current} onChange={(event) => setCurrent(event.target.value)} autoComplete="current-password" disabled={step !== null} />
            <LabeledInput
              label="Parola nouă"
              type="password"
              value={next}
              onChange={(event) => setNext(event.target.value)}
              autoComplete="new-password"
              disabled={step !== null}
              hint={next.length >= MIN_MASTER_LENGTH ? (next === current ? "e identică cu cea actuală" : "lungime bună") : `${next.length} / ${MIN_MASTER_LENGTH} caractere`}
            />
            <LabeledInput
              label="Repetă parola nouă"
              type="password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              autoComplete="new-password"
              disabled={step !== null}
              error={confirm && next !== confirm ? "parolele nu se potrivesc" : null}
            />
            <div aria-live="polite">{passError ? <InlineNote tone="rose">{passError}</InlineNote> : null}</div>
            {step ? (
              <BusyBlock
                label={STEP_LABEL[step.step] ?? "Se lucrează"}
                detail={step.step === "deriving" ? `Argon2id · ${KDF.memlimit / (1024 * 1024)} MiB · ${KDF.opslimit} pași` : undefined}
                startedAt={step.startedAt}
              />
            ) : null}
            <Btn type="submit" size="sm" variant="primary" disabled={!canSave || step !== null} icon={KeyRound}>
              {step ? "Se schimbă…" : "Schimbă parola"}
            </Btn>
          </form>
        </Card>

        <Card>
          <SectionTitle
            title="Cheia de date"
            info="Rotația schimbă cheia, nu datele. Cheile vechi rămân în inel, pentru istoric. Rotește după ce elimini un membru activ."
            action={
              status ? (
                <Pill tone="mint" dot>
                  {countNoun(rotations + 1, "cheie", "chei")} în inel
                </Pill>
              ) : null
            }
          />
          <div className="mt-3 rounded-xl border border-white/[0.08] bg-white/[0.02] p-3" aria-busy={!status}>
            <div className="flex items-center justify-between text-[13.5px]">
              <span className="text-muted-foreground">Cheia activă</span>
              <span className="font-mono">{status ? (status.current ? `cheia ${rotations + 1}` : "cheia originală") : "…"}</span>
            </div>
            <div className="mt-1.5 flex items-center justify-between gap-3 text-[13.5px]">
              <span className="shrink-0 text-muted-foreground">Rotită</span>
              <span className="truncate font-mono">{status ? (status.current ? `${dateRo(status.current.createdAt)} · ${emailOf(status.current.createdBy)}` : "nicio rotație") : "…"}</span>
            </div>
            <div className="mt-1.5 flex items-center justify-between text-[13.5px]">
              <span className="text-muted-foreground">Rânduri pe chei vechi</span>
              <span className="pu-num">{stale === null ? "…" : stale}</span>
            </div>
          </div>

          {status?.ownMissing.length ? (
            <InlineNote tone="rose" className="mt-3">
              Îți {status.ownMissing.length === 1 ? "lipsește o cheie rotită" : `lipsesc ${status.ownMissing.length} chei rotite`}: rândurile lor apar ilizibile până le primești de la un membru activ.
            </InlineNote>
          ) : null}

          {status?.missing.length ? (
            <ul className="mt-3 divide-y divide-white/[0.05] rounded-xl border border-white/[0.07]">
              {status.missing.map(({ member, dekIds }) => (
                <li key={member.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                  <span className="min-w-0 truncate text-[13.5px]">{member.email}</span>
                  <span className="text-[13px] text-muted-foreground">{countNoun(dekIds.length, "cheie lipsă", "chei lipsă")}</span>
                </li>
              ))}
            </ul>
          ) : null}

          <div aria-live="polite">{ringError ? <InlineNote tone="rose" className="mt-3">{ringError}</InlineNote> : null}</div>

          <div className="mt-3 flex flex-wrap gap-2">
            <Btn size="sm" variant="outline" icon={RotateCcw} disabled={!status || !members || rotating || running} onClick={() => setRotateOpen(true)}>
              {rotating ? "Se rotește…" : "Rotește cheia"}
            </Btn>
            <Btn size="sm" variant="outline" icon={RefreshCw} onClick={() => void startReencrypt()} disabled={running || !stale}>
              {running ? "Se re-criptează…" : stale ? `Re-criptează (${stale})` : "Re-criptează"}
            </Btn>
            <Btn size="sm" variant="ghost" icon={ShieldCheck} onClick={() => void grantAll()} disabled={granting || !status?.missing.length}>
              {granting ? "Se acordă…" : "Acordă cheile lipsă"}
            </Btn>
          </div>

          {reencrypt.state === "running" ? (
            <div className="mt-3" role="status">
              <ProgressBar value={(reencrypt.done / (reencrypt.total || 1)) * 100} tone="mint" />
              <p className="pu-num mt-1.5 text-[13px] text-muted-foreground">
                {reencrypt.done} din {reencrypt.total} re-criptate
              </p>
            </div>
          ) : null}
          {reencrypt.state === "done" ? (
            <p className="mt-3 flex items-start gap-1.5 text-[13px] text-muted-foreground" role="status">
              <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-mint" aria-hidden="true" />
              {countNoun(reencrypt.done, "rând re-criptat", "rânduri re-criptate")}
              {reencrypt.skipped ? ` · ${countNoun(reencrypt.skipped, "rând sărit", "rânduri sărite")} (modificate sau ilizibile). Reia re-criptarea` : " · totul e pe cheia nouă"}.
            </p>
          ) : null}

        </Card>

        <Card className="lg:col-span-2">
          <SectionTitle title="Sesiune" />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-[13.5px] text-muted-foreground">Auto-blocare după 15 minute fără activitate.</p>
            <Btn size="sm" variant="danger" icon={Lock} onClick={onLock}>
              Blochează
            </Btn>
          </div>
        </Card>
      </div>

      <ConfirmDialog
        open={rotateOpen}
        onOpenChange={setRotateOpen}
        title="Rotești cheia de date?"
        consequence="Codul de recuperare vechi nu mai deschide seiful, iar cel nou se afișează o singură dată."
        confirmLabel="Rotește cheia"
        onConfirm={rotate}
      />

      <RecoveryCodeDialog
        code={newCode}
        title="Codul nou de recuperare"
        description="Codul vechi nu mai funcționează. Acesta se afișează o singură dată."
        confirmLabel="Re-criptează rândurile"
        onConfirm={() => {
          setNewCode(null);
          void startReencrypt();
        }}
      />
    </>
  );
}
