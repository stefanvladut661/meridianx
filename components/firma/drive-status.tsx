"use client";

import { useState, useTransition } from "react";
import { IconExternal } from "./icons";
import { Notice, Tag } from "./ui";

/**
 * Starea Drive-ului în Setări: cum e legat, cu ce cont (adresa contului de
 * serviciu, cu care se partajează folderul), dacă folderul rădăcină se vede și
 * se poate scrie în el, și butonul pentru folderul lunii curente.
 */
export function DriveStatusCard({
  mode,
  serviceEmail,
  rootName,
  ok,
  message,
  folderName,
  createMonthFolder,
}: {
  mode: "oauth" | "service" | null;
  serviceEmail: string | null;
  rootName: string | null;
  ok: boolean;
  message: string | null;
  folderName: string;
  createMonthFolder: () => Promise<{ ok: true; message: string; link: string | null } | { ok: false; message: string }>;
}) {
  const [result, setResult] = useState<{ tone: "ok" | "error"; text: string; link: string | null } | null>(null);
  const [pending, start] = useTransition();
  return (
    <section aria-labelledby="drive-stare" className="mt-7 max-w-3xl">
      <h2 id="drive-stare" className="text-[15px] font-semibold text-bone">
        Drive
      </h2>
      <div className="mt-2 rounded-xl border border-hair bg-char px-4 py-3 text-[14px]">
        <p className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-bone">Legătura:</span>
          {mode === "oauth" ? "OAuth, ca tine (fișierele sunt ale tale)" : mode === "service" ? "cont de serviciu" : "nelegat"}
          {ok ? <Tag tone="ok">Merge</Tag> : mode ? <Tag tone="warn">De verificat</Tag> : null}
        </p>
        {serviceEmail ? (
          <p className="mt-1.5 text-[13.5px] text-dim">
            Adresa contului de serviciu — dă-i acces de <strong className="text-bone">editor</strong> la folderul rădăcină: <span className="select-all font-md-mono text-[12.5px] text-bone">{serviceEmail}</span>
          </p>
        ) : null}
        {mode === "service" ? <p className="mt-1.5 text-[12.5px] text-dim">Un cont de serviciu poate urca fișiere doar într-un Shared Drive. Pentru un folder din „My Drive”, folosește OAuth (README → Drive).</p> : null}
        {rootName ? <p className="mt-1.5 text-[13.5px] text-dim">Folderul rădăcină: „{rootName}”. Folderul lunii curente se numește „{folderName}”.</p> : null}
        {message ? <p className="mt-1.5 text-[13.5px] text-[var(--ap-warn)]">{message}</p> : null}
        {ok ? (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const done = await createMonthFolder();
                setResult(done.ok ? { tone: "ok", text: done.message, link: done.link } : { tone: "error", text: done.message, link: null });
              })
            }
            className="btn btn-ghost mt-3 !min-h-9 !px-3.5 !py-1.5 !text-[13.5px]"
          >
            {pending ? "Se lucrează…" : `Fă acum folderul „${folderName}”`}
          </button>
        ) : null}
        {result ? (
          <Notice tone={result.tone} className="mt-3">
            <span role="status">{result.text}</span>{" "}
            {result.link ? (
              <a href={result.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline underline-offset-4">
                Deschide <IconExternal size={14} />
              </a>
            ) : null}
          </Notice>
        ) : null}
      </div>
    </section>
  );
}
