"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, ClipboardCheck, FileUp, Loader2, ShieldCheck, Sparkles } from "lucide-react";
import { parsePlanText } from "@/lib/postari/plan-schema";
import type { VerifyResult } from "@/lib/postari/plan-verify";
import { momentLabel } from "@/lib/postari/timp";
import { cn } from "@/lib/utils";
import { InlineNote } from "../ui/actions";
import { Btn, btnClass, Card, SectionTitle, Stamp } from "../ui/primitives";
import { EmptyState, inputClass } from "../ui/states";
import { useToast } from "../ui/toast";
import { PlanPreview } from "./plan-preview";
import { PLAN_DRAFT_KEY, PLAN_SOURCE_KEY, ScreenHead, UNREACHABLE } from "./shared";

type ApproveResponse = { ok: true; rows: number; posts: number; instagram: number; tiktok: number; first: string | null; last: string | null } | { ok: false; message: string };
type VerifyResponse = VerifyResult | { ok: false; message: string; line: null; column: null; schema: [] };

function readDraft(): string {
  try {
    return window.localStorage.getItem(PLAN_DRAFT_KEY) ?? "";
  } catch {
    return "";
  }
}

function writeDraft(value: string) {
  try {
    if (value) window.localStorage.setItem(PLAN_DRAFT_KEY, value);
    else window.localStorage.removeItem(PLAN_DRAFT_KEY);
  } catch {
    // Fără stocare locală: ciorna nu se ține minte, restul merge.
  }
}

/**
 * Editorul planului, în limbajul din prototip: JSON-ul lipit sau încărcat în
 * stânga, verificarea și previzualizarea pe postare în dreapta. Verificarea se
 * repetă cât timp mai sunt clipuri de citit; orice schimbare de text după ea o
 * face veche, iar „Aprobă planul” se stinge până la verificarea nouă. Nimic nu
 * intră în coadă fără „Aprobă planul”.
 */
export function PlanEditor({
  example,
  verify,
  approve,
  driveMissing,
}: {
  example: string;
  verify: (text: string) => Promise<VerifyResponse>;
  approve: (text: string, expected: (string | null)[]) => Promise<ApproveResponse>;
  /** Folderul principal de pe Drive nu e ales: planul nu se poate verifica. */
  driveMissing: boolean;
}) {
  const { notify } = useToast();
  const [text, setText] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [result, setResult] = useState<{ text: string; value: VerifyResponse } | null>(null);
  const [checking, setChecking] = useState<{ pending: number; total: number } | null>(null);
  const [approving, setApproving] = useState(false);
  const [approved, setApproved] = useState<Extract<ApproveResponse, { ok: true }> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fromClaude, setFromClaude] = useState(false);
  const resultHeading = useRef<HTMLHeadingElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const area = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setText(readDraft());
    setLoaded(true);
    try {
      if (window.sessionStorage.getItem(PLAN_SOURCE_KEY) === "claude") {
        window.sessionStorage.removeItem(PLAN_SOURCE_KEY);
        setFromClaude(true);
      }
    } catch {
      // Fără stocare: anunțul nu apare, planul e oricum în editor.
    }
  }, []);
  useEffect(() => {
    if (loaded) writeDraft(text);
  }, [text, loaded]);

  const syntax = useMemo(() => (text.trim() ? parsePlanText(text) : null), [text]);
  const stale = result !== null && result.text !== text;
  const verified = result?.value.ok ? result.value : null;
  const canApprove = Boolean(verified?.ready) && !stale && !checking && !approving;

  async function runVerify() {
    setError(null);
    setApproved(null);
    const snapshot = text;
    setChecking({ pending: 0, total: 0 });
    let last: VerifyResponse | null = null;
    let previousPending = Infinity;
    try {
      for (let round = 0; round < 40; round += 1) {
        const value = await verify(snapshot);
        last = value;
        setResult({ text: snapshot, value });
        if (!value.ok || value.pending === 0) break;
        setChecking({ pending: value.pending, total: value.clipsTotal });
        // Niciun clip citit într-o rundă întreagă: Drive nu răspunde; nu mai insistăm.
        if (value.pending >= previousPending) break;
        previousPending = value.pending;
      }
    } catch {
      setError("Serverul n-a răspuns (rețea, sesiune sau un clip prea mare pentru un singur apel). Verifică din nou.");
    } finally {
      setChecking(null);
    }
    if (last) requestAnimationFrame(() => resultHeading.current?.focus());
  }

  async function runApprove() {
    if (!verified) return;
    setError(null);
    setApproving(true);
    try {
      // Orele pe care le-ai văzut: serverul aprobă doar dacă ies la fel și acum.
      const response = await approve(text, verified.posts.map((post) => post.ora));
      if (!response.ok) {
        setError(response.message);
        notify(response.message, "error");
      } else {
        setApproved(response);
        setResult(null);
        setText("");
        notify("Plan aprobat. Postările au intrat în coadă.");
        requestAnimationFrame(() => resultHeading.current?.focus());
      }
    } catch {
      setError(UNREACHABLE);
      notify(UNREACHABLE, "error");
    } finally {
      setApproving(false);
    }
  }

  /** Mută cursorul în textarea la rândul și coloana unei erori de sintaxă. */
  function jumpTo(line: number, column: number) {
    const el = area.current;
    if (!el) return;
    const lines = el.value.split("\n");
    let index = 0;
    for (let i = 0; i < Math.min(line - 1, lines.length); i += 1) index += lines[i].length + 1;
    index = Math.min(el.value.length, index + Math.max(0, column - 1));
    el.focus();
    el.setSelectionRange(index, Math.min(el.value.length, index + 1));
  }

  const approveBar = (
    <div className="flex flex-wrap items-center gap-3">
      <Btn variant="primary" icon={approving ? Loader2 : ShieldCheck} disabled={!canApprove} onClick={() => void runApprove()}>
        {approving ? "Se aprobă…" : "Aprobă planul"}
      </Btn>
      {!canApprove && !approving && result ? (
        <p className="text-[11.5px] text-muted-foreground">
          {stale
            ? "Verifică din nou după schimbare."
            : verified && verified.pending > 0
              ? `Mai sunt ${verified.pending} clipuri de citit: apasă „Verifică planul”.`
              : verified && verified.summary.errors > 0
                ? "Corectează erorile și verifică din nou."
                : null}
        </p>
      ) : null}
      {canApprove ? <p className="text-[11.5px] text-muted-foreground">După aprobare, postările intră în coadă și pleacă singure la ora lor.</p> : null}
    </div>
  );

  return (
    <div className="space-y-4">
      <ScreenHead
        title="Plan nou"
        text={
          <>
            Lipește planul JSON sau încarcă-l din fișier. Îl poate scrie și Claude, din manifest.json, la Clipuri. Verifici, vezi fiecare postare și abia apoi aprobi.
          </>
        }
        actions={
          <>
            <Stamp>Nimic nu pleacă fără aprobare</Stamp>
            <Link href="/admin/postari/clipuri" className={btnClass({ variant: "outline", size: "sm", className: "gap-1.5" })}>
              <Sparkles className="h-4 w-4" aria-hidden="true" /> Scrie planul cu Claude
            </Link>
          </>
        }
      />

      {driveMissing ? (
        <InlineNote tone="apricot">
          Folderul principal de pe Drive nu e ales, deci planul nu se poate verifica.{" "}
          <Link href="/admin/postari/setari" className="font-medium underline underline-offset-2">
            Alege-l în Setări
          </Link>
        </InlineNote>
      ) : null}
      {fromClaude ? (
        <InlineNote tone="mint" >
          <span role="status">Planul scris de Claude e în editor. Citește descrierile și corectează ce nu-ți place direct în JSON, apoi apasă „Verifică planul”.</span>
        </InlineNote>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] xl:items-start">
        <Card className="space-y-3">
          <SectionTitle
            title="Planul (JSON)"
            hint="Blocurile ```json, comentariile și virgulele de la final sunt iertate."
            action={
              <div className="flex flex-wrap items-center gap-1.5">
                <input
                  ref={fileInput}
                  type="file"
                  accept=".json,application/json,text/plain"
                  className="sr-only"
                  tabIndex={-1}
                  aria-label="Încarcă un plan .json"
                  onChange={async (event) => {
                    const file = event.currentTarget.files?.[0];
                    event.currentTarget.value = "";
                    if (!file) return;
                    if (file.size > 400_000) return setError("Fișierul e prea mare (cel mult 400 KB).");
                    setError(null);
                    setText(await file.text());
                  }}
                />
                <Btn size="xs" variant="outline" icon={FileUp} onClick={() => fileInput.current?.click()}>
                  Încarcă .json
                </Btn>
                {text.trim() === "" ? (
                  <Btn size="xs" variant="outline" onClick={() => setText(example)}>
                    Pune un exemplu
                  </Btn>
                ) : (
                  <Btn
                    size="xs"
                    variant="ghost"
                    onClick={() => {
                      setText("");
                      setResult(null);
                    }}
                  >
                    Golește
                  </Btn>
                )}
              </div>
            }
          />
          <textarea
            ref={area}
            id="plan-json"
            aria-label="Planul în format JSON"
            value={text}
            onChange={(event) => setText(event.target.value)}
            spellCheck={false}
            rows={16}
            aria-describedby="plan-sintaxa"
            aria-invalid={syntax && !syntax.ok ? true : undefined}
            className={inputClass(cn("h-auto min-h-[18rem] resize-y py-2.5 font-mono text-[12px] leading-[1.55]", syntax && !syntax.ok && "border-rose/50"))}
            placeholder={'{\n  "folder": "meridian reclame/lot-1",\n  "postari": [ … ]\n}'}
          />
          <p id="plan-sintaxa" className={cn("text-[11.5px] leading-relaxed", syntax && !syntax.ok ? "text-[#FFC2CE]" : syntax?.ok ? "text-[#B4F2CD]" : "text-muted-foreground")}>
            {!syntax ? "Formatul e în README, la „Planul JSON”. Sau pornește de la „Pune un exemplu”." : syntax.ok ? "JSON valid. Verificarea citește folderul de pe Drive, clipurile și coada." : syntax.message}
            {syntax && !syntax.ok && syntax.line !== null && syntax.column !== null ? (
              <>
                {" "}
                <button type="button" onClick={() => jumpTo(syntax.line ?? 1, syntax.column ?? 1)} className="font-mono underline underline-offset-2 hover:text-foreground">
                  Du-mă la rândul {syntax.line}, coloana {syntax.column}
                </button>
              </>
            ) : null}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Btn variant="primary" size="sm" icon={checking ? Loader2 : ClipboardCheck} disabled={!syntax?.ok || checking !== null || approving} onClick={() => void runVerify()}>
              {checking ? "Se verifică…" : "Verifică planul"}
            </Btn>
            <p role="status" aria-live="polite" className="text-[11.5px] text-muted-foreground">
              {checking && checking.total > 0
                ? `Se citesc clipurile de pe Drive: ${checking.total - checking.pending} din ${checking.total}.`
                : checking
                  ? "Se citește folderul de pe Drive…"
                  : stale
                    ? "Planul s-a schimbat după verificare: verifică din nou."
                    : null}
            </p>
          </div>
        </Card>

        <div className="space-y-4">
          {error ? (
            <InlineNote tone="rose">
              <span role="alert">{error}</span>
            </InlineNote>
          ) : null}

          {approved ? (
            <Card className="border-mint/25">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-mint" aria-hidden="true" />
                <div className="min-w-0">
                  <h2 ref={resultHeading} tabIndex={-1} className="text-[15px] font-semibold outline-none">
                    Plan aprobat
                  </h2>
                  <p className="mt-1.5 text-[12.5px] leading-relaxed text-foreground/85" role="status">
                    {approved.posts} {approved.posts === 1 ? "postare a intrat" : "postări au intrat"} în coadă: {approved.instagram} pe Instagram, {approved.tiktok} pe TikTok
                    {approved.first ? `, de ${momentLabel(approved.first)}${approved.last && approved.last !== approved.first ? ` până ${momentLabel(approved.last)}` : ""}` : ""}. De aici pleacă singure.
                  </p>
                  <Link href="/admin/postari" className={btnClass({ variant: "outline", size: "sm", className: "mt-3" })}>
                    Vezi coada
                  </Link>
                </div>
              </div>
            </Card>
          ) : null}

          {!result && !approved ? (
            <Card className="p-0">
              <EmptyState
                icon={ClipboardCheck}
                title="Previzualizarea apare după verificare"
                text="Verificarea citește folderul de pe Drive și fiecare clip, apoi arată postarea cu postarea: clipul, descrierea cu hashtag-uri, platformele și ora."
              />
            </Card>
          ) : null}

          {result ? (
            <section aria-labelledby="plan-rezultat" className={cn("space-y-3", stale && "opacity-60")}>
              <h2 ref={resultHeading} id="plan-rezultat" tabIndex={-1} className="text-[15px] font-semibold outline-none">
                {!result.value.ok ? "Planul nu se poate citi" : result.value.ready ? "Planul e gata de aprobat" : result.value.pending > 0 ? "Verificarea nu e gata" : "Planul are probleme"}
              </h2>
              {!result.value.ok ? (
                <div className="space-y-2">
                  <InlineNote tone="rose">{result.value.message}</InlineNote>
                  {result.value.schema.length > 0 ? (
                    <Card className="p-0">
                      <ul className="divide-y divide-white/[0.05]">
                        {result.value.schema.map((issue, index) => (
                          <li key={`${issue.path}-${index}`} className="flex flex-wrap items-baseline gap-2 px-4 py-2.5 text-[12px]">
                            <span className="rounded-md border border-white/[0.1] bg-white/[0.04] px-1.5 py-0.5 font-mono text-[10.5px]">{issue.path}</span>
                            <span className="text-[#FFC2CE]">{issue.message}</span>
                          </li>
                        ))}
                      </ul>
                    </Card>
                  ) : null}
                </div>
              ) : (
                <PlanPreview plan={result.value} action={approveBar} />
              )}
              {stale ? <p className="text-[11.5px] text-muted-foreground">Previzualizarea e a textului de dinainte.</p> : null}
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
