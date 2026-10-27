"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { parsePlanText } from "@/lib/postari/plan-schema";
import type { VerifyResult } from "@/lib/postari/plan-verify";
import { momentLabel } from "@/lib/postari/timp";
import { cn } from "@/lib/utils";
import { IconUpload } from "./icons";
import { PlanPreview } from "./plan-preview";
import { btnPrimary, Notice, textareaClass } from "./ui";

/** Unde stă ciorna planului în browser (și unde o lasă ecranul „Clipuri” după ce scrie Claude). */
export const PLAN_DRAFT_KEY = "meridian_postari_plan";
/** Semnul lăsat de „Scrie planul cu Claude”: editorul arată o dată de unde vine ciorna. */
export const PLAN_SOURCE_KEY = "meridian_postari_plan_sursa";

type ApproveResponse = { ok: true; rows: number; posts: number; instagram: number; tiktok: number; first: string | null; last: string | null } | { ok: false; message: string };

const UNREACHABLE = "Serverul n-a răspuns (rețea sau sesiune). Nu s-a aprobat nimic; încearcă din nou.";

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
 * Editorul planului: textul, verificarea (repetată cât timp mai sunt clipuri
 * de citit), previzualizarea și aprobarea. Orice schimbare de text după o
 * verificare o face veche: „Aprobă planul” se stinge până la verificarea nouă.
 */
export function PlanEditor({ example, verify, approve }: { example: string; verify: (text: string) => Promise<VerifyResult>; approve: (text: string, expected: (string | null)[]) => Promise<ApproveResponse> }) {
  const [text, setText] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [result, setResult] = useState<{ text: string; value: VerifyResult } | null>(null);
  const [checking, setChecking] = useState<{ pending: number; total: number } | null>(null);
  const [approving, setApproving] = useState(false);
  const [approved, setApproved] = useState<Extract<ApproveResponse, { ok: true }> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const resultHeading = useRef<HTMLHeadingElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const [fromClaude, setFromClaude] = useState(false);

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
    let last: VerifyResult | null = null;
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
      if (!response.ok) setError(response.message);
      else {
        setApproved(response);
        setResult(null);
        setText("");
        requestAnimationFrame(() => resultHeading.current?.focus());
      }
    } catch {
      setError(UNREACHABLE);
    } finally {
      setApproving(false);
    }
  }

  return (
    <div className="mt-6 grid gap-6">
      {fromClaude ? (
        <Notice tone="ok" role="status">
          Planul scris de Claude e mai jos. Citește descrierile și corectează ce nu-ți place direct în JSON, apoi apasă „Verifică planul”.
        </Notice>
      ) : null}
      <section aria-labelledby="plan-text" className="grid gap-2">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <label id="plan-text" htmlFor="plan-json" className="text-[15px] font-semibold text-bone">
            Planul (JSON)
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileInput}
              type="file"
              accept=".json,application/json,text/plain"
              className="sr-only"
              id="plan-fisier"
              onChange={async (event) => {
                const file = event.currentTarget.files?.[0];
                event.currentTarget.value = "";
                if (!file) return;
                if (file.size > 400_000) return setError("Fișierul e prea mare (cel mult 400 KB).");
                setText(await file.text());
              }}
            />
            <button type="button" onClick={() => fileInput.current?.click()} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-hair-strong bg-white px-3 text-[13px] font-medium text-bone hover:bg-[var(--ap-hover)]">
              <IconUpload size={15} />
              Încarcă .json
            </button>
            {text.trim() === "" ? (
              <button type="button" onClick={() => setText(example)} className="min-h-9 rounded-lg border border-hair-strong bg-white px-3 text-[13px] font-medium text-bone hover:bg-[var(--ap-hover)]">
                Pune un exemplu
              </button>
            ) : (
              <button type="button" onClick={() => { setText(""); setResult(null); }} className="min-h-9 rounded-lg px-3 text-[13px] text-dim underline underline-offset-2 hover:text-bone">
                Golește
              </button>
            )}
          </div>
        </div>
        <textarea
          id="plan-json"
          value={text}
          onChange={(event) => setText(event.currentTarget.value)}
          spellCheck={false}
          rows={16}
          aria-describedby="plan-sintaxa"
          aria-invalid={syntax && !syntax.ok ? true : undefined}
          className={cn(textareaClass, "min-h-[16rem] font-[family-name:var(--font-jbmono),ui-monospace,monospace] text-[13px] leading-[1.55]")}
          placeholder={'{\n  "folder": "meridian reclame/lot-1",\n  "postari": [ … ]\n}'}
        />
        <p id="plan-sintaxa" className={cn("text-[13px]", syntax && !syntax.ok ? "text-[var(--ap-error)]" : "text-dim")}>
          {!syntax ? "Formatul e în README, la „Planul JSON”. Blocurile ```json, comentariile și virgulele de la final sunt iertate." : syntax.ok ? "JSON valid. Verificarea citește folderul de pe Drive, clipurile și coada." : syntax.message}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => void runVerify()} disabled={!syntax?.ok || checking !== null || approving} className={btnPrimary}>
            {checking ? "Se verifică…" : "Verifică planul"}
          </button>
          <p role="status" aria-live="polite" className="text-[13px] text-dim">
            {checking && checking.total > 0 ? `Se citesc clipurile de pe Drive: ${checking.total - checking.pending} din ${checking.total}.` : checking ? "Se citește folderul de pe Drive…" : stale ? "Planul s-a schimbat după verificare: verifică din nou." : null}
          </p>
        </div>
      </section>

      {error ? (
        <Notice tone="error" role="alert">
          {error}
        </Notice>
      ) : null}

      {approved ? (
        <section aria-labelledby="plan-aprobat">
          <h2 ref={resultHeading} id="plan-aprobat" tabIndex={-1} className="text-[17px] font-semibold text-bone">
            Plan aprobat
          </h2>
          <Notice tone="ok" className="mt-2" role="status">
            {approved.posts} {approved.posts === 1 ? "postare a intrat" : "postări au intrat"} în coadă: {approved.instagram} pe Instagram, {approved.tiktok} pe TikTok
            {approved.first ? `, de ${momentLabel(approved.first)}${approved.last && approved.last !== approved.first ? ` până ${momentLabel(approved.last)}` : ""}` : ""}. De aici pleacă singure.{" "}
            <Link href="/admin/postari" className="font-semibold underline underline-offset-2">
              Vezi coada
            </Link>
          </Notice>
        </section>
      ) : null}

      {result ? (
        <section aria-labelledby="plan-rezultat" className={cn(stale && "opacity-60")}>
          <h2 ref={resultHeading} id="plan-rezultat" tabIndex={-1} className="text-[17px] font-semibold text-bone">
            {!result.value.ok ? "Planul nu se poate citi" : result.value.ready ? "Planul e gata de aprobat" : result.value.pending > 0 ? "Verificarea nu e gata" : "Planul are probleme"}
          </h2>
          {!result.value.ok ? (
            <div className="mt-2 grid gap-2">
              <Notice tone="error">{result.value.message}</Notice>
              {result.value.schema.length > 0 ? (
                <ul className="grid gap-1 rounded-xl border border-hair bg-white px-4 py-3">
                  {result.value.schema.map((issue, index) => (
                    <li key={`${issue.path}-${index}`} className="text-[13.5px] text-[var(--ap-error)]">
                      <span className="font-semibold">{issue.path}:</span> {issue.message}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : (
            <PlanPreview
              plan={result.value}
              action={
                <div className="flex flex-wrap items-center gap-3">
                  <button type="button" onClick={() => void runApprove()} disabled={!canApprove} className={btnPrimary}>
                    {approving ? "Se aprobă…" : "Aprobă planul"}
                  </button>
                  {!canApprove && !approving ? (
                    <p className="text-[13px] text-dim">
                      {stale ? "Verifică din nou după schimbare." : result.value.pending > 0 ? `Mai sunt ${result.value.pending} clipuri de citit: apasă „Verifică planul”.` : result.value.summary.errors > 0 ? "Corectează erorile și verifică din nou." : null}
                    </p>
                  ) : null}
                </div>
              }
            />
          )}
          {stale ? <p className="mt-3 text-[13px] text-dim">Previzualizarea e a textului de dinainte.</p> : null}
        </section>
      ) : null}
    </div>
  );
}
