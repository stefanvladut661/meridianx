"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CATEGORIE_CONT, nextRenewal, renewsWithin, type ContFirma } from "@/lib/firma/accese-shared";
import { dayLabel, daysBetween, money, parseAmount } from "@/lib/firma/format";
import { cn } from "@/lib/utils";
import { SidePanel } from "./panel";
import { IconExternal, IconPlus } from "./icons";
import { Empty, Field, inputClass, Notice, Tag, tdClass, textareaClass, thClass } from "./ui";

type Result = { ok: true; id?: string; message?: string } | { ok: false; field?: string; message: string };

export interface AccountActions {
  save: (id: string | null, raw: unknown) => Promise<Result>;
  remove: (id: string, name: string) => Promise<Result>;
  starter: () => Promise<Result>;
}

export function AccountsScreen({ accounts, today, actions }: { accounts: ContFirma[]; today: string; actions: AccountActions }) {
  const router = useRouter();
  const [open, setOpen] = useState<string | "nou" | null>(null);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const soon = accounts.filter((account) => renewsWithin(account, today));
  const noTwoFa = accounts.filter((account) => account.doiFa === "nu");
  const monthly = new Map<string, number>();
  for (const account of accounts) {
    if (account.abonament === null || !account.ciclu) continue;
    monthly.set(account.moneda, (monthly.get(account.moneda) ?? 0) + (account.ciclu === "lunar" ? account.abonament : account.abonament / 12));
  }
  const openAccount = open && open !== "nou" ? (accounts.find((account) => account.id === open) ?? null) : null;

  return (
    <>
      {soon.length > 0 ? (
        <Notice tone="warn" className="mt-5">
          <span className="font-semibold">Se reînnoiesc în 7 zile:</span>{" "}
          {soon.map((account) => `${account.nume} (${dayLabel(nextRenewal(account, today))}${account.abonament !== null ? `, ${money(account.abonament, account.moneda)}` : ""})`).join(" · ")}
        </Notice>
      ) : null}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13.5px] text-dim">
          {accounts.length} conturi
          {monthly.size > 0 ? ` · abonamente ≈ ${[...monthly.entries()].map(([currency, sum]) => money(sum, currency)).join(" + ")} pe lună` : ""}
          {noTwoFa.length > 0 ? <span className="text-[var(--ap-warn)]"> · {noTwoFa.length} fără 2FA</span> : null}
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const done = await actions.starter();
                setNotice(done.ok ? { tone: "ok", text: done.message ?? "Gata." } : { tone: "error", text: done.message });
                router.refresh();
              })
            }
            className="btn btn-ghost !min-h-10 !px-4 !py-2 !text-[14px]"
          >
            Adaugă lista de bază
          </button>
          <button type="button" onClick={() => setOpen("nou")} className="btn btn-light !min-h-10 !px-4 !py-2 !text-[14px]">
            <IconPlus size={16} />
            Cont nou
          </button>
        </div>
      </div>
      {notice ? (
        <Notice tone={notice.tone} className="mt-3">
          <span role="status">{notice.text}</span>
        </Notice>
      ) : null}

      {accounts.length === 0 ? (
        <Empty className="mt-4">Niciun cont încă. „Adaugă lista de bază” pune conturile obișnuite (bancă, Oblio, Google, Meta, TikTok, Vercel, Supabase, GitHub, domeniu); apoi le completezi.</Empty>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-hair bg-white">
          <table className="ads-table min-w-full border-collapse">
            <thead>
              <tr className="border-b border-hair">
                <th className={cn(thClass, "ads-sticky-col")}>Cont</th>
                <th className={thClass}>Cine are acces</th>
                <th className={thClass}>2FA</th>
                <th className={thClass}>Unde e parola</th>
                <th className={cn(thClass, "text-right")}>Abonament</th>
                <th className={thClass}>Reînnoire</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hair">
              {accounts.map((account) => {
                const next = nextRenewal(account, today);
                const alert = renewsWithin(account, today);
                return (
                  <tr key={account.id} onClick={() => setOpen(account.id)} className={cn("cursor-pointer bg-white hover:bg-[var(--ap-hover)]", open === account.id && "bg-[var(--ap-accent-soft)]")}>
                    <td className={cn(tdClass, "ads-sticky-col min-w-[12rem]")}>
                      <button type="button" onClick={() => setOpen(account.id)} className="text-left font-semibold text-bone hover:text-[var(--md-a1)] hover:underline">
                        {account.nume}
                      </button>
                      <p className="mt-0.5 text-[12.5px] text-dim">
                        {CATEGORIE_CONT[account.categoria]}
                        {account.cont ? ` · ${account.cont}` : ""}
                      </p>
                    </td>
                    <td className={cn(tdClass, "text-[13px]")}>{account.cineAreAcces ?? <span className="text-dim">—</span>}</td>
                    <td className={tdClass}>{account.doiFa === "da" ? <Tag tone="ok">Da</Tag> : account.doiFa === "nu" ? <Tag tone="warn">Nu</Tag> : <Tag tone="muted">Nu știu</Tag>}</td>
                    <td className={cn(tdClass, "text-[13px]")}>{account.undeEParola ?? <span className="text-[var(--ap-warn)]">nescris</span>}</td>
                    <td className={cn(tdClass, "whitespace-nowrap text-right tabular-nums text-[13px]")}>
                      {account.abonament !== null ? `${money(account.abonament, account.moneda)}${account.ciclu ? ` / ${account.ciclu === "lunar" ? "lună" : "an"}` : ""}` : "—"}
                    </td>
                    <td className={cn(tdClass, "whitespace-nowrap text-[13px]")}>
                      {next ? (
                        <>
                          {dayLabel(next)}
                          {alert ? (
                            <Tag tone="warn" className="ml-1.5">
                              în {daysBetween(today, next)} {daysBetween(today, next) === 1 ? "zi" : "zile"}
                            </Tag>
                          ) : null}
                        </>
                      ) : (
                        <span className="text-dim">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {open ? (
        <AccountPanel
          key={open}
          account={openAccount}
          actions={actions}
          onSaved={(id) => {
            setOpen(id);
            router.refresh();
          }}
          onRemoved={() => {
            setOpen(null);
            router.refresh();
          }}
          onClose={() => setOpen(null)}
        />
      ) : null}
    </>
  );
}

function AccountPanel({
  account,
  actions,
  onSaved,
  onRemoved,
  onClose,
}: {
  account: ContFirma | null;
  actions: AccountActions;
  onSaved: (id: string) => void;
  onRemoved: () => void;
  onClose: () => void;
}) {
  const [fields, setFields] = useState({
    nume: account?.nume ?? "",
    categoria: account?.categoria ?? "platforma",
    adresa: account?.adresa ?? "",
    cont: account?.cont ?? "",
    cineAreAcces: account?.cineAreAcces ?? "",
    doiFa: account?.doiFa ?? "necunoscut",
    undeEParola: account?.undeEParola ?? "",
    abonament: account?.abonament !== null && account?.abonament !== undefined ? String(account.abonament) : "",
    moneda: account?.moneda ?? "RON",
    ciclu: account?.ciclu ?? "",
    reinnoire: account?.reinnoire ?? "",
    note: account?.note ?? "",
  });
  const [error, setError] = useState<{ field?: string; message: string } | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  const set = (field: keyof typeof fields, value: string) => {
    setFields((current) => ({ ...current, [field]: value }));
    setSaved(false);
  };
  const fieldError = (field: string) => (error?.field === field ? error.message : null);

  return (
    <SidePanel
      title={account ? account.nume : "Cont nou"}
      subtitle="Fără parole și fără chei: doar unde sunt."
      onClose={onClose}
      footer={
        account ? (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const done = await actions.remove(account.id, account.nume);
                if (!done.ok) setError({ message: done.message });
                else onRemoved();
              })
            }
            className="text-[13px] text-dim underline underline-offset-4 hover:text-[var(--ap-error)]"
          >
            Scoate contul din listă
          </button>
        ) : undefined
      }
    >
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          const amount = fields.abonament.trim() === "" ? null : parseAmount(fields.abonament);
          if (fields.abonament.trim() !== "" && amount === null) {
            setError({ field: "abonament", message: "Abonamentul nu e o sumă (ex. 49 sau 49,99)." });
            return;
          }
          start(async () => {
            setError(null);
            const done = await actions.save(account?.id ?? null, { ...fields, abonament: amount, ciclu: fields.ciclu === "" ? null : fields.ciclu });
            if (!done.ok) {
              setError({ field: done.field, message: done.message });
              if (done.field) document.getElementById(`ac-${done.field}`)?.focus();
              return;
            }
            setSaved(true);
            if (!account && done.id) onSaved(done.id);
          });
        }}
        className="grid gap-3"
      >
        <Field id="ac-nume" label="Numele" error={fieldError("nume")}>
          <input id="ac-nume" value={fields.nume} onChange={(e) => set("nume", e.currentTarget.value)} className={inputClass} maxLength={120} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field id="ac-categoria" label="Categoria">
            <select id="ac-categoria" value={fields.categoria} onChange={(e) => set("categoria", e.currentTarget.value)} className={inputClass}>
              {Object.entries(CATEGORIE_CONT).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field id="ac-adresa" label="Adresa (opțional)" error={fieldError("adresa")}>
            <input id="ac-adresa" type="url" value={fields.adresa} onChange={(e) => set("adresa", e.currentTarget.value)} className={inputClass} placeholder="https://" />
          </Field>
        </div>
        <Field id="ac-cont" label="Contul cu care se intră (opțional)" error={fieldError("cont")} hint="De obicei un email. Nu parola.">
          <input id="ac-cont" value={fields.cont} onChange={(e) => set("cont", e.currentTarget.value)} className={inputClass} maxLength={200} />
        </Field>
        <Field id="ac-cineAreAcces" label="Cine are acces" error={fieldError("cineAreAcces")} hint="Nume sau emailuri, despărțite prin virgulă.">
          <input id="ac-cineAreAcces" value={fields.cineAreAcces} onChange={(e) => set("cineAreAcces", e.currentTarget.value)} className={inputClass} maxLength={500} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field id="ac-doiFa" label="Are 2FA?">
            <select id="ac-doiFa" value={fields.doiFa} onChange={(e) => set("doiFa", e.currentTarget.value)} className={inputClass}>
              <option value="da">Da</option>
              <option value="nu">Nu</option>
              <option value="necunoscut">Nu știu</option>
            </select>
          </Field>
          <Field id="ac-undeEParola" label="Unde e parola" error={fieldError("undeEParola")} hint="Ex. „managerul de parole → seiful Firmă”.">
            <input id="ac-undeEParola" value={fields.undeEParola} onChange={(e) => set("undeEParola", e.currentTarget.value)} className={inputClass} maxLength={200} autoComplete="off" />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-[1fr_6rem_8rem]">
          <Field id="ac-abonament" label="Abonament (opțional)" error={fieldError("abonament")}>
            <input id="ac-abonament" inputMode="decimal" value={fields.abonament} onChange={(e) => set("abonament", e.currentTarget.value)} className={inputClass} />
          </Field>
          <Field id="ac-moneda" label="Moneda">
            <select id="ac-moneda" value={fields.moneda} onChange={(e) => set("moneda", e.currentTarget.value)} className={inputClass}>
              <option value="RON">RON</option>
              <option value="EUR">EUR</option>
              <option value="USD">USD</option>
            </select>
          </Field>
          <Field id="ac-ciclu" label="La fiecare">
            <select id="ac-ciclu" value={fields.ciclu} onChange={(e) => set("ciclu", e.currentTarget.value)} className={inputClass}>
              <option value="">—</option>
              <option value="lunar">lună</option>
              <option value="anual">an</option>
            </select>
          </Field>
        </div>
        <Field id="ac-reinnoire" label="Data reînnoirii (opțional)" error={fieldError("reinnoire")} hint="Cu ciclul ales, următoarea reînnoire se calculează singură. Alerta apare cu 7 zile înainte.">
          <input id="ac-reinnoire" type="date" value={fields.reinnoire} onChange={(e) => set("reinnoire", e.currentTarget.value)} className={inputClass} />
        </Field>
        <Field id="ac-note" label="Note (opțional)" error={fieldError("note")}>
          <textarea id="ac-note" rows={2} value={fields.note} onChange={(e) => set("note", e.currentTarget.value)} className={textareaClass} maxLength={1000} />
        </Field>
        {error && !error.field ? <Notice tone="error">{error.message}</Notice> : null}
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={pending} className="btn btn-light !min-h-10 !px-4 !py-2 !text-[14px]">
            {pending ? "Se salvează…" : account ? "Salvează" : "Adaugă contul"}
          </button>
          {saved ? (
            <p role="status" className="text-[13px] text-[var(--ap-ok)]">
              Salvat.
            </p>
          ) : null}
          {account?.adresa ? (
            <a href={account.adresa} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1 text-[13px] text-[var(--md-a1)] underline underline-offset-4">
              Deschide <IconExternal size={13} />
            </a>
          ) : null}
        </div>
      </form>
    </SidePanel>
  );
}
