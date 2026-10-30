"use client";

import { useState, type FormEvent } from "react";
import { AlertTriangle, Download, Lock, ShieldCheck } from "lucide-react";
import { KDF } from "@/lib/vault/crypto";
import type { VaultSnapshot } from "@/lib/vault/entries";
import { EXPORT_MIN_PASSPHRASE, buildPlaintext, encryptExport, exportFileName } from "@/lib/vault/export";
import { Btn, Card, Pill, SectionTitle } from "@/components/panou/ui/primitives";
import { InlineNote } from "@/components/panou/ui/actions";
import { ErrorState, LoadingRows } from "@/components/panou/ui/states";
import { useToast } from "@/components/panou/ui/toast";
import { describeError } from "./errors";
import { countNoun } from "./format";
import { BusyBlock, LabeledInput, PageHead } from "./ui";

/**
 * Exportul (VaultExportPage din prototip): doar criptat, cu o parolă de export
 * ALTA decât cea master; fără istoric și fără coș. Fișierul se construiește și
 * se criptează în browser (Argon2id → XChaCha20-Poly1305, sare aleatoare per
 * fișier) și se descarcă de acolo: nimic nu trece prin server. Export în clar
 * nu există.
 */
export function ExportView({ snapshot, error, reload }: { snapshot: VaultSnapshot | null; error: string | null; reload: () => Promise<void> }) {
  const { notify } = useToast();
  const [pass, setPass] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busySince, setBusySince] = useState<number | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [done, setDone] = useState<{ name: string; entries: number; clients: number } | null>(null);

  if (!snapshot) {
    return (
      <>
        <PageHead title="Export" text="Doar criptat, cu o parolă separată de parola master. Fișierul nu conține istoric și nu conține coșul." />
        <Card className="overflow-hidden p-0">
          {error ? <ErrorState title="Seiful nu s-a încărcat" text={error} onRetry={() => void reload()} /> : <LoadingRows rows={3} cols={3} />}
        </Card>
      </>
    );
  }

  const readable = snapshot.entries.filter((entry) => entry.status === "ok").length;
  const unreadable = snapshot.entries.length - readable;
  const strong = pass.length >= EXPORT_MIN_PASSPHRASE;
  const match = pass.length > 0 && pass === confirm;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!snapshot || !strong || !match || busySince !== null) return;
    setFailure(null);
    setDone(null);
    setBusySince(Date.now());
    try {
      const plain = buildPlaintext(snapshot);
      const file = await encryptExport(plain, pass);
      const name = exportFileName();
      const blob = new Blob([JSON.stringify(file, null, 1)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = name;
      anchor.rel = "noopener";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setDone({ name, entries: plain.entries.length, clients: plain.clients.length });
      setPass("");
      setConfirm("");
      notify("Export criptat descărcat. Ține parola separat.");
    } catch (cause) {
      setFailure(describeError(cause, "Exportul a eșuat dintr-un motiv necunoscut. Încearcă din nou."));
    } finally {
      setBusySince(null);
    }
  }

  return (
    <>
      <PageHead title="Export" text="Doar criptat, cu o parolă separată de parola master. Fișierul nu conține istoric și nu conține coșul." />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card>
          <SectionTitle title="Parola de export" hint="alta decât parola master" action={<Pill tone="mint">XChaCha20-Poly1305</Pill>} />
          <form onSubmit={onSubmit} noValidate>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <LabeledInput
                label="Parolă de export"
                type="password"
                value={pass}
                onChange={(event) => {
                  setPass(event.target.value);
                  setDone(null);
                }}
                autoComplete="new-password"
                disabled={busySince !== null}
                hint={strong ? "lungime bună" : `cel puțin ${EXPORT_MIN_PASSPHRASE} caractere`}
              />
              <LabeledInput
                label="Repetă parola"
                type="password"
                value={confirm}
                onChange={(event) => {
                  setConfirm(event.target.value);
                  setDone(null);
                }}
                autoComplete="new-password"
                disabled={busySince !== null}
                error={confirm && !match ? "parolele nu se potrivesc" : null}
              />
            </div>

            <InlineNote tone="apricot" className="mt-4">
              <span className="flex items-start gap-1.5">
                <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
                Fără parola de export, fișierul nu se mai poate deschide, nici cu codul de recuperare. Nu o trimite pe același canal cu fișierul.
              </span>
            </InlineNote>

            <div aria-live="polite">
              {failure ? <InlineNote tone="rose" className="mt-3">{failure}</InlineNote> : null}
            </div>

            {busySince !== null ? (
              <div className="mt-4">
                <BusyBlock label="Se derivă cheia de export" detail={`Argon2id · ${KDF.memlimit / (1024 * 1024)} MiB · ${KDF.opslimit} pași`} startedAt={busySince} />
              </div>
            ) : null}

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] pt-4">
              <p className="text-[11px] text-muted-foreground">
                {countNoun(readable, "intrare", "intrări")}, {countNoun(snapshot.clients.length, "client", "clienți")}, fără istoric, fără coș.
                {unreadable > 0 ? ` ${countNoun(unreadable, "intrare ilizibilă rămâne", "intrări ilizibile rămân")} pe dinafară.` : ""}
              </p>
              <Btn type="submit" size="sm" variant="primary" icon={Download} disabled={!strong || !match || busySince !== null || readable === 0}>
                {busySince !== null ? "Se criptează…" : "Descarcă exportul"}
              </Btn>
            </div>

            {done ? (
              <InlineNote tone="mint" className="mt-3">
                <strong className="font-semibold">{done.name}</strong> e descărcat: {countNoun(done.entries, "intrare", "intrări")}, {countNoun(done.clients, "client", "clienți")}. Conține doar date criptate, niciun secret în clar. Pune-l
                undeva unde nu e laptopul (un disc, un cloud) și ține parola separat de el.
              </InlineNote>
            ) : null}
          </form>
        </Card>

        <Card className="pu-sealed">
          <SectionTitle title="Ce intră în fișier" />
          <ul className="mt-3 space-y-2 text-[12px] text-muted-foreground">
            <li className="flex items-center gap-2">
              <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-mint" aria-hidden="true" /> {countNoun(readable, "intrare activă", "intrări active")}, cu toate câmpurile
            </li>
            <li className="flex items-center gap-2">
              <Lock className="h-3.5 w-3.5 shrink-0 text-mint" aria-hidden="true" /> criptare XChaCha20-Poly1305, cheie din parola de export (Argon2id)
            </li>
            <li className="flex items-center gap-2 text-muted-foreground/60">— fără istoric de versiuni</li>
            <li className="flex items-center gap-2 text-muted-foreground/60">— fără coșul de ștergeri</li>
            <li className="flex items-center gap-2 text-muted-foreground/60">— fără membri sau chei</li>
          </ul>
          <p className="mt-4 border-t border-white/[0.07] pt-3 text-[10.5px] leading-relaxed text-muted-foreground/70">
            Fișierul se importă înapoi din Import, cu parola lui, în acest seif sau în altul, oricând.
          </p>
        </Card>
      </div>
    </>
  );
}
