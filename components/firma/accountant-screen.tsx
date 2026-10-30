"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { MonthCheck, ZipOutcome } from "@/lib/firma/contabil";
import { dateTimeLabel, monthLabel } from "@/lib/firma/format";
import { cn } from "@/lib/utils";
import { IconExternal } from "./icons";
import { Field, inputClass, Notice, Tag, textareaClass } from "./ui";

type Simple = { ok: true; message?: string } | { ok: false; field?: string; message: string };

export interface AccountantActions {
  build: (month: string, force: boolean) => Promise<{ ok: true; outcome: ZipOutcome } | { ok: false; message: string }>;
  send: (month: string, raw: unknown) => Promise<{ ok: true; message: string } | { ok: false; field?: string; message: string }>;
  download: (month: string) => Promise<{ ok: true; url: string } | { ok: false; message: string }>;
  uploadMissing: (month: string) => Promise<Simple>;
}

const FIX_LINK: Record<string, { href: (month: string) => string; label: string } | null> = {
  factura: null,
  ciorna: { href: (m) => `/admin/firma/facturi?luna=${m}`, label: "Deschide facturile" },
  cheltuiala: { href: (m) => `/admin/firma/cheltuieli?luna=${m}`, label: "Deschide cheltuielile" },
  plata: { href: (m) => `/admin/firma/incasari?luna=${m}`, label: "Deschide încasările" },
  extras: { href: (m) => `/admin/firma/incasari?luna=${m}`, label: "Deschide încasările" },
};

export function AccountantScreen({ check, accountant, email, actions }: { check: MonthCheck; accountant: string | null; email: boolean; actions: AccountantActions }) {
  const router = useRouter();
  const [result, setResult] = useState<{ tone: "ok" | "warn" | "error"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const { month, items, complete, pachet, counts } = check;
  const blocking = items.filter((item) => item.blocheaza);
  const warnings = items.filter((item) => !item.blocheaza);
  const hasInvoiceGap = items.some((item) => item.fel === "factura");

  const build = (force: boolean) =>
    start(async () => {
      setResult(null);
      const done = await actions.build(month, force);
      if (!done.ok) {
        setResult({ tone: "error", text: done.message });
        return;
      }
      const o = done.outcome;
      setResult({
        tone: o.skipped.length || o.driveMessage ? "warn" : "ok",
        text: `Zip-ul e gata: ${o.files} fișiere, ${(o.size / 1024 / 1024).toLocaleString("ro-RO", { maximumFractionDigits: 1 })} MB, din ${o.source === "drive" ? "folderul de pe Drive" : "copiile din admin"}.${o.skipped.length ? ` Nu au intrat: ${o.skipped.join("; ")}.` : ""}${o.driveMessage ? ` ${o.driveMessage}` : ""} Emailul către contabil e pregătit mai jos.`,
      });
      router.refresh();
    });

  return (
    <div className="mt-5 grid max-w-4xl gap-6">
      <section aria-labelledby="verificare" className="rounded-xl border border-hair bg-char p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="verificare" className="text-[15px] font-semibold text-bone">
            {monthLabel(month)}: {complete ? "luna e completă" : `lipsesc ${blocking.length === 1 ? "un lucru" : `${blocking.length} lucruri`}`}
          </h2>
          <Tag tone={complete ? "ok" : "warn"}>{pachet?.stare === "trimis" ? "Trimis" : pachet?.stare === "zip_gata" ? "Zip gata" : complete ? "Complet" : "Incomplet"}</Tag>
        </div>
        <p className="mt-1 text-[13px] text-dim">
          {counts.facturi} facturi emise · {counts.cheltuieli} cheltuieli · {counts.plati} plăți din extras · {counts.extrase} {counts.extrase === 1 ? "extras importat" : "extrase importate"}
          {pachet?.verificatLa ? ` · verificat ${dateTimeLabel(pachet.verificatLa)}` : ""}
        </p>
        {items.length === 0 ? <p className="mt-3 text-[14px] text-[var(--ap-ok)]">Totul e la locul lui: facturile pe Drive, cheltuielile cu documente, plățile acoperite, extrasul importat.</p> : null}
        {blocking.length > 0 ? (
          <ul className="mt-3 grid gap-1.5">
            {blocking.map((item, index) => (
              <li key={index} className="flex flex-wrap items-start gap-2 text-[13.5px]">
                <Tag tone="warn" className="shrink-0">
                  lipsește
                </Tag>
                <span className="min-w-0 flex-1">{item.text}</span>
                {FIX_LINK[item.fel] ? (
                  <Link href={FIX_LINK[item.fel]!.href(month)} className="text-[13px] font-medium text-[var(--md-a1)] underline underline-offset-4">
                    {FIX_LINK[item.fel]!.label}
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
        {warnings.length > 0 ? (
          <ul className="mt-3 grid gap-1.5">
            {warnings.map((item, index) => (
              <li key={index} className="flex flex-wrap items-start gap-2 text-[13.5px] text-bone/85">
                <Tag tone="neutral" className="shrink-0">
                  de verificat
                </Tag>
                <span className="min-w-0 flex-1">{item.text}</span>
                {FIX_LINK[item.fel] ? (
                  <Link href={FIX_LINK[item.fel]!.href(month)} className="text-[13px] font-medium text-[var(--md-a1)] underline underline-offset-4">
                    {FIX_LINK[item.fel]!.label}
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-2">
          {hasInvoiceGap ? (
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const done = await actions.uploadMissing(month);
                  setResult(done.ok ? { tone: "ok", text: done.message ?? "Gata." } : { tone: "error", text: done.message });
                  router.refresh();
                })
              }
              className="btn btn-ghost !min-h-10 !px-4 !py-2 !text-[14px]"
            >
              Urcă pe Drive PDF-urile facturilor
            </button>
          ) : null}
          <button type="button" disabled={pending} onClick={() => router.refresh()} className="btn btn-ghost !min-h-10 !px-4 !py-2 !text-[14px]">
            Verifică din nou
          </button>
        </div>
      </section>

      <section aria-labelledby="zip" className="rounded-xl border border-hair bg-char p-4">
        <h2 id="zip" className="text-[15px] font-semibold text-bone">
          Zip-ul lunii
        </h2>
        <p className="mt-1 text-[13px] text-dim">Tot ce e în folderul lunii de pe Drive (facturile emise, cheltuielile, extrasul), într-o arhivă pusă și ea în folder.</p>
        {pachet?.zipFacutLa ? (
          <p className="mt-2 text-[13.5px] text-bone">
            Ultimul zip: {dateTimeLabel(pachet.zipFacutLa)} · {pachet.zipFisiere} fișiere · {((pachet.zipMarime ?? 0) / 1024 / 1024).toLocaleString("ro-RO", { maximumFractionDigits: 1 })} MB{" "}
            {pachet.zipLink ? (
              <a href={pachet.zipLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[var(--md-a1)] underline underline-offset-4">
                pe Drive <IconExternal size={13} />
              </a>
            ) : null}{" "}
            <button
              type="button"
              onClick={() =>
                start(async () => {
                  const link = await actions.download(month);
                  if (link.ok) window.location.assign(link.url);
                  else setResult({ tone: "error", text: link.message });
                })
              }
              className="text-[var(--md-a1)] underline underline-offset-4"
            >
              descarcă
            </button>
          </p>
        ) : null}
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" disabled={pending || !complete} onClick={() => build(false)} className="btn btn-light !min-h-10 !px-4 !py-2 !text-[14px]">
            {pending ? "Se lucrează…" : pachet?.zipFacutLa ? "Fă zip-ul din nou" : "Fă zip-ul"}
          </button>
          {!complete ? (
            <button type="button" disabled={pending} onClick={() => build(true)} className="btn btn-ghost !min-h-10 !px-4 !py-2 !text-[14px]">
              Fă zip-ul oricum
            </button>
          ) : null}
        </div>
        {result ? (
          <Notice tone={result.tone} className="mt-3">
            <span role="status">{result.text}</span>
          </Notice>
        ) : null}
      </section>

      {pachet && pachet.emailStare !== "nepregatit" ? <EmailToAccountant month={month} pachet={pachet} accountant={accountant} email={email} send={actions.send} onSent={() => router.refresh()} /> : null}
    </div>
  );
}

function EmailToAccountant({
  month,
  pachet,
  accountant,
  email,
  send,
  onSent,
}: {
  month: string;
  pachet: NonNullable<MonthCheck["pachet"]>;
  accountant: string | null;
  email: boolean;
  send: AccountantActions["send"];
  onSent: () => void;
}) {
  const [fields, setFields] = useState({ to: pachet.emailCatre ?? accountant ?? "", subject: pachet.emailSubiect ?? "", text: pachet.emailText ?? "" });
  const [error, setError] = useState<{ field?: string; message: string } | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const large = (pachet.zipMarime ?? 0) > 10 * 1024 * 1024;
  return (
    <section aria-labelledby="email-contabil" className="rounded-xl border border-hair bg-char p-4">
      <h2 id="email-contabil" className="text-[15px] font-semibold text-bone">
        Emailul către contabil — pleacă doar la „Trimite”
      </h2>
      {pachet.emailStare === "trimis" ? (
        <p className="mt-2 text-[13.5px] text-[var(--ap-ok)]">
          Trimis {dateTimeLabel(pachet.emailTrimisLa)} către {pachet.emailCatre}. Poți trimite din nou dacă ai refăcut zip-ul.
        </p>
      ) : null}
      {!accountant ? (
        <p className="mt-2 text-[13px] text-dim">
          Emailul contabilului nu e setat.{" "}
          <Link href="/admin/firma/setari" className="text-[var(--md-a1)] underline underline-offset-4">
            Pune-l în Setări
          </Link>{" "}
          sau scrie-l aici.
        </p>
      ) : null}
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          start(async () => {
            setError(null);
            const done = await send(month, fields);
            if (!done.ok) {
              setError({ field: done.field, message: done.message });
              return;
            }
            setSent(done.message);
            onSent();
          });
        }}
        className="mt-3 grid gap-3"
      >
        <Field id="ac-to" label="Către" error={error?.field === "to" ? error.message : null}>
          <input id="ac-to" value={fields.to} onChange={(e) => setFields({ ...fields, to: e.currentTarget.value })} className={inputClass} />
        </Field>
        <Field id="ac-subj" label="Subiectul" error={error?.field === "subject" ? error.message : null}>
          <input id="ac-subj" value={fields.subject} onChange={(e) => setFields({ ...fields, subject: e.currentTarget.value })} className={inputClass} maxLength={300} />
        </Field>
        <Field id="ac-text" label="Textul" error={error?.field === "text" ? error.message : null} hint={large ? "Zip-ul are peste 10 MB: nu se atașează, emailul are linkul de pe Drive." : "Atașat: zip-ul lunii."}>
          <textarea id="ac-text" rows={8} value={fields.text} onChange={(e) => setFields({ ...fields, text: e.currentTarget.value })} className={textareaClass} maxLength={5000} />
        </Field>
        {error && !error.field ? <Notice tone="error">{error.message}</Notice> : null}
        {sent ? (
          <Notice tone="ok">
            <span role="status">{sent}</span>
          </Notice>
        ) : null}
        <button type="submit" disabled={pending || !email} className={cn("btn btn-light justify-self-start !min-h-10 !px-4 !py-2 !text-[14px]")}>
          {pending ? "Se trimite…" : "Trimite"}
        </button>
        {!email ? <p className="text-[12.5px] text-dim">Emailul nu e configurat (RESEND_API_KEY lipsește în Vercel).</p> : null}
      </form>
    </section>
  );
}
