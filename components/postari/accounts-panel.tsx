"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import type { ContView } from "@/lib/postari/conturi";
import { momentLabel } from "@/lib/postari/timp";
import { btnPrimary, btnSecondary, labelClass, Notice, Tag, textareaClass } from "./ui";

type AccountResult = { ok: true; message: string } | { ok: false; message: string };

function StateTag({ account }: { account: ContView | null }) {
  if (!account) return <Tag tone="muted">Neconectat</Tag>;
  if (account.stare === "expirat") return <Tag tone="error">Token expirat</Tag>;
  if (account.stare === "eroare") return <Tag tone="error">Eroare</Tag>;
  return <Tag tone="ok">Conectat</Tag>;
}

function AccountCard({ title, account, children, footer }: { title: string; account: ContView | null; children: ReactNode; footer?: ReactNode }) {
  return (
    <li className="px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[14.5px] font-semibold text-bone">
          {title}
          {account?.nume ? <span className="ml-2 font-normal text-bone/80">{account.nume}</span> : null}
        </p>
        <StateTag account={account} />
      </div>
      <div className="mt-2 grid gap-2 text-[13.5px] text-dim">{children}</div>
      {footer ? <div className="mt-3">{footer}</div> : null}
    </li>
  );
}

/**
 * Conturile pe care publică coada. Instagram: tokenul lipit din panoul Meta.
 * Tokenurile nu se mai văd după salvare și nu ajung niciodată în browser.
 */
export function AccountsPanel({
  instagram,
  keyProblem,
  fus,
  connectInstagram,
  disconnect,
  tiktok,
  tiktokMissing,
  redirectUri,
}: {
  instagram: ContView | null;
  keyProblem: string | null;
  fus: string;
  connectInstagram: (token: string) => Promise<AccountResult>;
  disconnect: (platform: "instagram" | "tiktok") => Promise<AccountResult>;
  tiktok: ContView | null;
  /** Mesajul când TIKTOK_CLIENT_KEY / TIKTOK_CLIENT_SECRET lipsesc; `null` = configurat. */
  tiktokMissing: string | null;
  redirectUri: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [token, setToken] = useState("");
  const [replacing, setReplacing] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  function run(action: () => Promise<AccountResult>, after?: () => void) {
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await action();
        setMessage({ ok: result.ok, text: result.message });
        if (result.ok) {
          after?.();
          router.refresh();
        }
      } catch {
        setMessage({ ok: false, text: "Serverul n-a răspuns (rețea sau sesiune). Încearcă din nou." });
      }
    });
  }

  const showForm = !instagram || replacing || instagram.stare !== "activ";

  return (
    <section aria-labelledby="conturi" className="mt-8 max-w-3xl">
      <h2 id="conturi" className="text-[15px] font-semibold text-bone">
        Conturi
      </h2>
      <p className="mt-0.5 text-[13.5px] text-dim">Conturile Meridian pe care publică coada. Tokenurile stau criptate în Supabase și se reînnoiesc singure.</p>
      {keyProblem ? (
        <Notice tone="warn" className="mt-3">
          {keyProblem}
        </Notice>
      ) : null}
      <ul className="mt-3 divide-y divide-hair rounded-xl border border-hair bg-char">
        <AccountCard title="Instagram" account={instagram}>
          {instagram ? (
            <>
              <p>
                Cont profesional {instagram.contId}. Conectat {momentLabel(instagram.conectatLa, fus)} de {instagram.conectatDe}.
              </p>
              <p>
                {instagram.tokenExpiraLa ? `Tokenul e valabil până ${momentLabel(instagram.tokenExpiraLa, fus)}` : "Tokenul nu are o dată de expirare știută"}
                {instagram.reinnoitLa ? `; ultima reînnoire ${momentLabel(instagram.reinnoitLa, fus)}` : ""}. Se reînnoiește singur, săptămânal.
              </p>
              {instagram.eroare ? <p className="text-[var(--ap-error)]">{instagram.eroare}</p> : null}
            </>
          ) : (
            <p>Neconectat: postările Instagram așteaptă în coadă.</p>
          )}
          {showForm ? (
            <form
              className="mt-1 grid gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                run(() => connectInstagram(token), () => {
                  setToken("");
                  setReplacing(false);
                });
              }}
            >
              <label htmlFor="ig-token" className={labelClass}>
                Tokenul din panoul Meta
              </label>
              <textarea id="ig-token" value={token} onChange={(event) => setToken(event.currentTarget.value)} rows={3} autoComplete="off" spellCheck={false} className={`${textareaClass} font-[family-name:var(--font-jbmono),ui-monospace,monospace] text-[12.5px]`} aria-describedby="ig-token-ajutor" />
              <p id="ig-token-ajutor" className="text-[12.5px] text-dim">
                developers.facebook.com → aplicația → Instagram → <em>API setup with Instagram business login</em> → <em>Generate token</em> lângă contul Meridian. Pașii întregi sunt în README, la „Instagram”.
              </p>
              <div className="flex flex-wrap gap-2">
                <button type="submit" disabled={pending || token.trim().length < 20 || Boolean(keyProblem)} className={btnPrimary}>
                  {pending ? "Se verifică la Instagram…" : instagram ? "Înlocuiește tokenul" : "Conectează Instagram"}
                </button>
                {replacing ? (
                  <button type="button" onClick={() => setReplacing(false)} className={btnSecondary}>
                    Renunță
                  </button>
                ) : null}
              </div>
            </form>
          ) : (
            <div className="mt-1 flex flex-wrap gap-2">
              <button type="button" onClick={() => setReplacing(true)} className={btnSecondary}>
                Lipește alt token
              </button>
              <button type="button" disabled={pending} onClick={() => run(() => disconnect("instagram"))} className={btnSecondary}>
                Deconectează
              </button>
            </div>
          )}
        </AccountCard>
        <AccountCard
          title="TikTok"
          account={tiktok}
          footer={
            tiktokMissing ? null : (
              <div className="flex flex-wrap gap-2">
                {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- rută de server care redirecționează spre TikTok: are nevoie de încărcare completă, nu de navigarea din client. */}
                <a href="/admin/postari/conturi/tiktok" className={btnPrimary} aria-disabled={Boolean(keyProblem) || undefined} onClick={(event) => keyProblem && event.preventDefault()}>
                  {tiktok ? "Conectează din nou" : "Conectează TikTok"}
                </a>
                {tiktok ? (
                  <button type="button" disabled={pending} onClick={() => run(() => disconnect("tiktok"))} className={btnSecondary}>
                    Deconectează
                  </button>
                ) : null}
              </div>
            )
          }
        >
          {tiktok ? (
            <>
              <p>
                Conectat {momentLabel(tiktok.conectatLa, fus)} de {tiktok.conectatDe}. Clipurile ajung în ciornele din aplicație; le publici tu, cu descrierea din „De publicat pe TikTok”.
              </p>
              <p>
                Accesul se reînnoiește singur, zilnic.
                {tiktok.refreshExpiraLa ? ` Conectarea ține până ${momentLabel(tiktok.refreshExpiraLa, fus)}; cu 14 zile înainte primești alertă să o refaci.` : ""}
              </p>
              {tiktok.eroare ? <p className="text-[var(--ap-error)]">{tiktok.eroare}</p> : null}
            </>
          ) : tiktokMissing ? (
            <p>{tiktokMissing}</p>
          ) : (
            <p>Neconectat: postările TikTok așteaptă în coadă. „Conectează TikTok” te duce la TikTok, unde intri cu contul Meridian și dai voie la urcarea clipurilor în ciorne.</p>
          )}
          <p className="text-[12.5px]">
            Adresa de întoarcere, de pus în aplicația TikTok (Login Kit → Redirect URI): <span className="select-all break-all font-[family-name:var(--font-jbmono),ui-monospace,monospace] text-bone">{redirectUri}</span>
          </p>
        </AccountCard>
      </ul>
      <p role="status" aria-live="polite" className="sr-only">
        {message?.text}
      </p>
      {message ? (
        <Notice tone={message.ok ? "ok" : "error"} className="mt-3">
          {message.text}
        </Notice>
      ) : null}
    </section>
  );
}
