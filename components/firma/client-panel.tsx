"use client";

import { useState, useTransition } from "react";
import { contractInMonth, priceForMonth, STARE_CONTRACT_LABEL, type Client, type Contract } from "@/lib/firma/contracte-shared";
import { currentMonth, dayLabel, money, monthLabel, parseAmount } from "@/lib/firma/format";
import type { OblioClient } from "@/lib/firma/oblio/api";
import { cn } from "@/lib/utils";
import { SidePanel } from "./panel";
import { IconPlus } from "./icons";
import { Field, inputClass, Notice, Tag, textareaClass } from "./ui";

type ActionResult = { ok: true; id?: string } | { ok: false; field?: string; message: string };

export interface ClientActions {
  saveClient: (id: string | null, raw: unknown, fromOblio: boolean) => Promise<ActionResult>;
  archiveClient: (id: string, archived: boolean) => Promise<ActionResult>;
  addContact: (clientId: string, raw: unknown) => Promise<ActionResult>;
  deleteContact: (clientId: string, contactId: string) => Promise<ActionResult>;
  saveContract: (clientId: string, contractId: string | null, raw: unknown) => Promise<ActionResult>;
  linkAds: (clientId: string, adsClientId: string | null) => Promise<ActionResult>;
  searchOblio: (query: string) => Promise<{ ok: true; clients: OblioClient[] } | { ok: false; message: string }>;
}

const sectionTitle = "text-[13px] font-semibold uppercase tracking-[0.08em] text-dim";

/**
 * Panoul unui client (sau al unui client nou): datele firmei (cu căutarea în
 * Oblio), persoanele de contact, contractele cu prețurile pe perioade,
 * legătura cu portalul de reclame și arhivarea.
 */
export function ClientPanel({
  client,
  loading,
  adsClients,
  month,
  oblio,
  actions,
  onSaved,
  onChanged,
  onClose,
}: {
  client: Client | null;
  loading: boolean;
  adsClients: { id: string; name: string }[];
  month: string;
  oblio: boolean;
  actions: ClientActions;
  onSaved: (id: string) => void;
  onChanged: () => void;
  onClose: () => void;
}) {
  const [archiving, startArchive] = useTransition();
  const [archiveError, setArchiveError] = useState<string | null>(null);

  if (loading) {
    return (
      <SidePanel title="Clientul" onClose={onClose}>
        <p className="text-[14px] text-dim">Se încarcă clientul…</p>
      </SidePanel>
    );
  }

  const footer = client ? (
    <div className="flex flex-wrap items-center justify-between gap-2">
      {archiveError ? <p className="text-[13px] text-[var(--ap-error)]">{archiveError}</p> : <span className="text-[12.5px] text-dim">Arhiva păstrează facturile și istoricul.</span>}
      <button
        type="button"
        disabled={archiving}
        onClick={() =>
          startArchive(async () => {
            setArchiveError(null);
            const result = await actions.archiveClient(client.id, !client.arhivatLa);
            if (!result.ok) setArchiveError(result.message);
            else onChanged();
          })
        }
        className="btn btn-ghost !min-h-9 !px-3.5 !py-1.5 !text-[13px]"
      >
        {client.arhivatLa ? "Scoate din arhivă" : "Arhivează clientul"}
      </button>
    </div>
  ) : null;

  return (
    <SidePanel title={client ? client.nume : "Client nou"} subtitle={client ? (client.cui ? `CUI ${client.cui}` : "fără CUI") : "Datele firmei — le poți lua din Oblio, după CUI."} onClose={onClose} footer={footer}>
      <section aria-labelledby="date-firma">
        <h3 id="date-firma" className={sectionTitle}>
          Datele firmei
        </h3>
        <ClientForm key={client?.id ?? "nou"} client={client} oblio={oblio} actions={actions} onSaved={onSaved} />
      </section>

      {client ? (
        <>
          <section aria-labelledby="contacte" className="mt-7 border-t border-hair pt-5">
            <h3 id="contacte" className={sectionTitle}>
              Persoane de contact
            </h3>
            <ContactsSection client={client} actions={actions} onChanged={onChanged} />
          </section>
          <section aria-labelledby="contracte" className="mt-7 border-t border-hair pt-5">
            <h3 id="contracte" className={sectionTitle}>
              Contracte
            </h3>
            <ContractsSection client={client} month={month} actions={actions} onChanged={onChanged} />
          </section>
          <section aria-labelledby="reclame" className="mt-7 border-t border-hair pt-5">
            <h3 id="reclame" className={sectionTitle}>
              Portalul de reclame
            </h3>
            <AdsSection client={client} adsClients={adsClients} actions={actions} onChanged={onChanged} />
          </section>
        </>
      ) : null}
    </SidePanel>
  );
}

// ------------------------------------------------------------ datele firmei

type ClientField = "nume" | "cui" | "regCom" | "adresa" | "oras" | "judet" | "tara" | "emailFacturare" | "note";

function ClientForm({ client, oblio, actions, onSaved }: { client: Client | null; oblio: boolean; actions: ClientActions; onSaved: (id: string) => void }) {
  const [values, setValues] = useState<Record<ClientField, string>>({
    nume: client?.nume ?? "",
    cui: client?.cui ?? "",
    regCom: client?.regCom ?? "",
    adresa: client?.adresa ?? "",
    oras: client?.oras ?? "",
    judet: client?.judet ?? "",
    tara: client?.tara ?? "România",
    emailFacturare: client?.emailFacturare ?? "",
    note: client?.note ?? "",
  });
  const [fromOblio, setFromOblio] = useState(false);
  const [error, setError] = useState<{ field?: string; message: string } | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  const set = (field: ClientField, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setSaved(false);
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    start(async () => {
      setError(null);
      const result = await actions.saveClient(client?.id ?? null, values, fromOblio);
      if (!result.ok) {
        setError({ field: result.field, message: result.message });
        if (result.field) document.getElementById(`client-${result.field}`)?.focus();
        return;
      }
      setSaved(true);
      setFromOblio(false);
      if (!client && result.id) onSaved(result.id);
    });
  };

  const input = (field: ClientField, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}, className?: string) => (
    <Field id={`client-${field}`} label={label} error={error?.field === field ? error.message : null} className={className}>
      <input
        id={`client-${field}`}
        value={values[field]}
        onChange={(event) => set(field, event.currentTarget.value)}
        aria-invalid={error?.field === field ? true : undefined}
        className={inputClass}
        {...props}
      />
    </Field>
  );

  return (
    <form onSubmit={submit} className="mt-3 grid gap-3" noValidate>
      <OblioLookup
        oblio={oblio}
        initial={client?.cui ?? ""}
        search={actions.searchOblio}
        onPick={(found) => {
          setValues((current) => ({
            ...current,
            nume: found.name || current.nume,
            cui: found.cif ?? current.cui,
            regCom: found.rc ?? current.regCom,
            adresa: found.address ?? current.adresa,
            oras: found.city ?? current.oras,
            judet: found.state ?? current.judet,
            tara: found.country ?? current.tara,
            emailFacturare: found.email ?? current.emailFacturare,
          }));
          setFromOblio(true);
          setSaved(false);
        }}
      />
      {input("nume", "Numele firmei", { autoComplete: "organization", maxLength: 200 })}
      <div className="grid gap-3 sm:grid-cols-2">
        {input("cui", "CUI", { inputMode: "text", maxLength: 20 })}
        {input("regCom", "Nr. Reg. Com.", { maxLength: 40 })}
      </div>
      {input("adresa", "Adresa", { autoComplete: "street-address", maxLength: 300 })}
      <div className="grid gap-3 sm:grid-cols-3">
        {input("oras", "Orașul", { maxLength: 100 })}
        {input("judet", "Județul", { maxLength: 100 })}
        {input("tara", "Țara", { maxLength: 60 })}
      </div>
      {input("emailFacturare", "Email de facturare", { type: "email", autoComplete: "email", maxLength: 200 })}
      <Field id="client-note" label="Note" error={error?.field === "note" ? error.message : null}>
        <textarea id="client-note" rows={2} value={values.note} onChange={(event) => set("note", event.currentTarget.value)} className={textareaClass} maxLength={2000} />
      </Field>
      {error && !error.field ? (
        <p role="alert" className="text-[13.5px] text-[var(--ap-error)]">
          {error.message}
        </p>
      ) : null}
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="btn btn-light !min-h-10 !px-4 !py-2 !text-[14px]">
          {pending ? "Se salvează…" : client ? "Salvează datele" : "Adaugă clientul"}
        </button>
        <p role="status" className="text-[13px] text-[var(--ap-ok)]">
          {saved ? "Salvat." : fromOblio ? <span className="text-dim">Date luate din Oblio — verifică-le și salvează.</span> : null}
        </p>
      </div>
    </form>
  );
}

function OblioLookup({
  oblio,
  initial,
  search,
  onPick,
}: {
  oblio: boolean;
  initial: string;
  search: ClientActions["searchOblio"];
  onPick: (client: OblioClient) => void;
}) {
  const [query, setQuery] = useState(initial);
  const [results, setResults] = useState<OblioClient[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!oblio) {
    return <p className="rounded-lg bg-[var(--ap-side)] px-3 py-2 text-[13px] text-dim">Oblio nu e legat încă: completează datele de mână. Pașii pentru legare sunt în README, la „Oblio”.</p>;
  }

  const run = () =>
    start(async () => {
      setMessage(null);
      const result = await search(query);
      if (!result.ok) {
        setResults(null);
        setMessage(result.message);
        return;
      }
      setResults(result.clients);
      if (result.clients.length === 0) setMessage("Oblio n-are niciun client cu datele astea. Completează de mână sau caută altfel.");
    });

  return (
    <div className="rounded-lg border border-hair bg-[var(--ap-side)] p-3">
      <label htmlFor="oblio-cauta" className="text-[13px] font-medium text-bone">
        Caută în Oblio (CUI sau nume)
      </label>
      <div className="mt-1 flex gap-2">
        <input
          id="oblio-cauta"
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              run();
            }
          }}
          className={inputClass}
        />
        <button type="button" disabled={pending} onClick={run} className="btn btn-ghost !min-h-10 shrink-0 !px-3.5 !py-2 !text-[13.5px]">
          {pending ? "Caut…" : "Caută"}
        </button>
      </div>
      {message ? <p className="mt-2 text-[13px] text-dim">{message}</p> : null}
      {results && results.length > 0 ? (
        <ul className="mt-2 grid gap-1">
          {results.map((found, index) => (
            <li key={`${found.cif ?? ""}-${index}`}>
              <button
                type="button"
                onClick={() => {
                  onPick(found);
                  setResults(null);
                  setMessage(null);
                }}
                className="w-full rounded-md bg-char px-3 py-2 text-left text-[13.5px] hover:bg-[var(--ap-accent-soft)]"
              >
                <span className="font-semibold text-bone">{found.name}</span>
                <span className="block text-[12.5px] text-dim">
                  {[found.cif ? `CUI ${found.cif}` : null, found.city, found.email].filter(Boolean).join(" · ")}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

// ------------------------------------------------------------ persoanele de contact

function ContactsSection({ client, actions, onChanged }: { client: Client; actions: ClientActions; onChanged: () => void }) {
  const empty = { nume: "", rol: "", telefon: "", email: "" };
  const [form, setForm] = useState(empty);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<{ field?: string; message: string } | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="mt-3">
      {client.contacte.length === 0 && !adding ? <p className="text-[13.5px] text-dim">Nicio persoană de contact.</p> : null}
      <ul className="grid gap-2">
        {client.contacte.map((contact) => (
          <li key={contact.id} className="flex items-start justify-between gap-3 rounded-lg border border-hair px-3 py-2">
            <div className="min-w-0 text-[13.5px]">
              <p className="font-semibold text-bone">
                {contact.nume}
                {contact.rol ? <span className="font-normal text-dim"> · {contact.rol}</span> : null}
              </p>
              <p className="text-dim">
                {contact.telefon ? (
                  <a href={`tel:${contact.telefon.replace(/\s/g, "")}`} className="hover:underline">
                    {contact.telefon}
                  </a>
                ) : null}
                {contact.telefon && contact.email ? " · " : null}
                {contact.email ? (
                  <a href={`mailto:${contact.email}`} className="hover:underline">
                    {contact.email}
                  </a>
                ) : null}
              </p>
            </div>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const result = await actions.deleteContact(client.id, contact.id);
                  if (!result.ok) setError({ message: result.message });
                  else onChanged();
                })
              }
              className="shrink-0 text-[13px] text-dim underline underline-offset-4 hover:text-[var(--ap-error)]"
            >
              Scoate
            </button>
          </li>
        ))}
      </ul>
      {adding ? (
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            start(async () => {
              setError(null);
              const result = await actions.addContact(client.id, form);
              if (!result.ok) {
                setError({ field: result.field, message: result.message });
                return;
              }
              setForm(empty);
              setAdding(false);
              onChanged();
            });
          }}
          className="mt-3 grid gap-3 rounded-lg border border-hair p-3"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field id="contact-nume" label="Numele" error={error?.field === "nume" ? error.message : null}>
              <input id="contact-nume" value={form.nume} onChange={(e) => setForm({ ...form, nume: e.currentTarget.value })} className={inputClass} maxLength={120} />
            </Field>
            <Field id="contact-rol" label="Rolul (opțional)">
              <input id="contact-rol" value={form.rol} onChange={(e) => setForm({ ...form, rol: e.currentTarget.value })} className={inputClass} maxLength={80} placeholder="ex. administrator" />
            </Field>
            <Field id="contact-telefon" label="Telefon" error={error?.field === "telefon" ? error.message : null}>
              <input id="contact-telefon" type="tel" value={form.telefon} onChange={(e) => setForm({ ...form, telefon: e.currentTarget.value })} className={inputClass} maxLength={40} />
            </Field>
            <Field id="contact-email" label="Email" error={error?.field === "email" ? error.message : null}>
              <input id="contact-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.currentTarget.value })} className={inputClass} maxLength={200} />
            </Field>
          </div>
          {error && !error.field ? <p className="text-[13px] text-[var(--ap-error)]">{error.message}</p> : null}
          <div className="flex gap-2">
            <button type="submit" disabled={pending} className="btn btn-light !min-h-9 !px-3.5 !py-1.5 !text-[13.5px]">
              Adaugă persoana
            </button>
            <button type="button" onClick={() => setAdding(false)} className="btn btn-ghost !min-h-9 !px-3.5 !py-1.5 !text-[13.5px]">
              Renunță
            </button>
          </div>
        </form>
      ) : (
        <button type="button" onClick={() => setAdding(true)} className="mt-3 inline-flex items-center gap-1.5 text-[13.5px] font-medium text-[var(--md-a1)]">
          <IconPlus size={15} />
          Adaugă o persoană
        </button>
      )}
      {error && !adding ? <p className="mt-2 text-[13px] text-[var(--ap-error)]">{error.message}</p> : null}
    </div>
  );
}

// ------------------------------------------------------------ contractele

function ContractsSection({ client, month, actions, onChanged }: { client: Client; month: string; actions: ClientActions; onChanged: () => void }) {
  const [editing, setEditing] = useState<Contract | "nou" | null>(null);

  if (editing) {
    return (
      <ContractForm
        clientId={client.id}
        contract={editing === "nou" ? null : editing}
        saveContract={actions.saveContract}
        onDone={(changed) => {
          setEditing(null);
          if (changed) onChanged();
        }}
      />
    );
  }

  return (
    <div className="mt-3">
      {client.contracte.length === 0 ? <p className="text-[13.5px] text-dim">Niciun contract. Fără contract activ nu se pregătesc facturi lunare pentru client.</p> : null}
      <ul className="grid gap-2">
        {client.contracte.map((contract) => {
          const active = contractInMonth(contract, month);
          const price = priceForMonth(contract.preturi, month);
          return (
            <li key={contract.id} className="rounded-lg border border-hair px-3 py-2.5 text-[13.5px]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold text-bone">
                  {contract.numar ? `Contract ${contract.numar}` : "Contract"}{" "}
                  <Tag tone={contract.starea === "activ" ? "ok" : "muted"} className="ml-1">
                    {STARE_CONTRACT_LABEL[contract.starea]}
                  </Tag>
                </p>
                <button type="button" onClick={() => setEditing(contract)} className="text-[13px] font-medium text-[var(--md-a1)] underline underline-offset-4">
                  Modifică
                </button>
              </div>
              <p className="mt-1 text-dim">
                din {dayLabel(contract.incepe)}
                {contract.seTermina ? ` până la ${dayLabel(contract.seTermina)}` : ", fără sfârșit"} · {contract.servicii}
              </p>
              <p className="mt-1 text-bone">
                {active ? (price ? `Abonament în ${monthLabel(month)}: ${money(price.suma, contract.moneda)}` : `În ${monthLabel(month)} nu e niciun preț — factura nu se poate pregăti.`) : `Nu acoperă ${monthLabel(month)}.`}
              </p>
              <p className="mt-0.5 text-dim">
                Factura: ziua {contract.ziEmitere}, scadentă în {contract.zileScadenta} {contract.zileScadenta === 1 ? "zi" : "zile"}
                {contract.bugetReclame !== null ? ` · buget reclame recomandat ${money(contract.bugetReclame, contract.moneda)}/lună (nu se facturează)` : ""}
              </p>
              {contract.preturi.length > 1 ? (
                <ul className="mt-1.5 grid gap-0.5 text-[12.5px] text-dim">
                  {contract.preturi.map((item) => (
                    <li key={item.id}>
                      {monthLabel(item.deLa.slice(0, 7))} – {item.panaLa ? monthLabel(item.panaLa.slice(0, 7)) : "fără sfârșit"}: {money(item.suma, contract.moneda)}
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>
      <button type="button" onClick={() => setEditing("nou")} className="mt-3 inline-flex items-center gap-1.5 text-[13.5px] font-medium text-[var(--md-a1)]">
        <IconPlus size={15} />
        Contract nou
      </button>
    </div>
  );
}

interface PriceRow {
  key: number;
  deLa: string;
  panaLa: string;
  suma: string;
  descriere: string;
}

function ContractForm({
  clientId,
  contract,
  saveContract,
  onDone,
}: {
  clientId: string;
  contract: Contract | null;
  saveContract: ClientActions["saveContract"];
  onDone: (changed: boolean) => void;
}) {
  const [fields, setFields] = useState({
    numar: contract?.numar ?? "",
    incepe: contract?.incepe ?? `${currentMonth()}-01`,
    seTermina: contract?.seTermina ?? "",
    servicii: contract?.servicii ?? "",
    moneda: contract?.moneda ?? "RON",
    bugetReclame: contract?.bugetReclame !== null && contract?.bugetReclame !== undefined ? String(contract.bugetReclame) : "",
    ziEmitere: String(contract?.ziEmitere ?? 1),
    zileScadenta: String(contract?.zileScadenta ?? 5),
    starea: contract?.starea ?? "activ",
    note: contract?.note ?? "",
  });
  const [prices, setPrices] = useState<PriceRow[]>(
    contract && contract.preturi.length > 0
      ? contract.preturi.map((price, index) => ({ key: index, deLa: price.deLa.slice(0, 7), panaLa: price.panaLa ? price.panaLa.slice(0, 7) : "", suma: String(price.suma), descriere: price.descriere }))
      : [{ key: 0, deLa: currentMonth(), panaLa: "", suma: "", descriere: "Abonament lunar" }]
  );
  const [error, setError] = useState<{ field?: string; message: string } | null>(null);
  const [pending, start] = useTransition();
  const set = (field: keyof typeof fields, value: string) => setFields((current) => ({ ...current, [field]: value }));
  const setPrice = (key: number, change: Partial<PriceRow>) => setPrices((rows) => rows.map((row) => (row.key === key ? { ...row, ...change } : row)));

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const parsedPrices = prices.map((row) => ({ deLa: row.deLa, panaLa: row.panaLa, suma: parseAmount(row.suma), descriere: row.descriere }));
    const badPrice = parsedPrices.findIndex((row) => row.suma === null);
    if (badPrice >= 0) {
      setError({ field: `preturi.${badPrice}.suma`, message: "Scrie suma lunară (ex. 1500 sau 1.500,00)." });
      return;
    }
    const budget = fields.bugetReclame.trim() === "" ? null : parseAmount(fields.bugetReclame);
    if (fields.bugetReclame.trim() !== "" && budget === null) {
      setError({ field: "bugetReclame", message: "Bugetul de reclame nu e o sumă. Scrie-l ca 3000 sau 3.000,00, ori lasă-l gol." });
      return;
    }
    start(async () => {
      setError(null);
      const result = await saveContract(clientId, contract?.id ?? null, {
        ...fields,
        bugetReclame: budget,
        ziEmitere: Number(fields.ziEmitere),
        zileScadenta: Number(fields.zileScadenta),
        preturi: parsedPrices,
      });
      if (!result.ok) {
        setError({ field: result.field, message: result.message });
        return;
      }
      onDone(true);
    });
  };

  const fieldError = (field: string) => (error?.field === field ? error.message : null);

  return (
    <form onSubmit={submit} noValidate className="mt-3 grid gap-3 rounded-lg border border-hair p-3">
      <p className="text-[14px] font-semibold text-bone">{contract ? "Modifică contractul" : "Contract nou"}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field id="ct-numar" label="Numărul (opțional)" error={fieldError("numar")}>
          <input id="ct-numar" value={fields.numar} onChange={(e) => set("numar", e.currentTarget.value)} className={inputClass} maxLength={60} />
        </Field>
        <Field id="ct-starea" label="Starea">
          <select id="ct-starea" value={fields.starea} onChange={(e) => set("starea", e.currentTarget.value)} className={inputClass}>
            <option value="activ">Activ</option>
            <option value="suspendat">Suspendat (fără facturi)</option>
            <option value="incheiat">Încheiat</option>
          </select>
        </Field>
        <Field id="ct-incepe" label="Începe" error={fieldError("incepe")}>
          <input id="ct-incepe" type="date" value={fields.incepe} onChange={(e) => set("incepe", e.currentTarget.value)} className={inputClass} />
        </Field>
        <Field id="ct-termina" label="Se termină (opțional)" error={fieldError("seTermina")} hint="Gol = pe durată nedeterminată.">
          <input id="ct-termina" type="date" value={fields.seTermina} onChange={(e) => set("seTermina", e.currentTarget.value)} className={inputClass} />
        </Field>
      </div>
      <Field id="ct-servicii" label="Serviciile" error={fieldError("servicii")}>
        <textarea id="ct-servicii" rows={2} value={fields.servicii} onChange={(e) => set("servicii", e.currentTarget.value)} className={textareaClass} maxLength={1000} placeholder="ex. administrare campanii, conținut lunar" />
      </Field>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field id="ct-zi" label="Ziua emiterii" error={fieldError("ziEmitere")} hint="1–28">
          <input id="ct-zi" type="number" min={1} max={28} value={fields.ziEmitere} onChange={(e) => set("ziEmitere", e.currentTarget.value)} className={inputClass} />
        </Field>
        <Field id="ct-scadenta" label="Scadentă în (zile)" error={fieldError("zileScadenta")}>
          <input id="ct-scadenta" type="number" min={0} max={120} value={fields.zileScadenta} onChange={(e) => set("zileScadenta", e.currentTarget.value)} className={inputClass} />
        </Field>
        <Field id="ct-moneda" label="Moneda">
          <select id="ct-moneda" value={fields.moneda} onChange={(e) => set("moneda", e.currentTarget.value)} className={inputClass}>
            <option value="RON">RON</option>
            <option value="EUR">EUR</option>
          </select>
        </Field>
      </div>
      <Field id="ct-buget" label="Buget de reclame recomandat, pe lună (opțional)" error={fieldError("bugetReclame")} hint="Îl plătește clientul direct platformelor: nu apare pe factură.">
        <input id="ct-buget" inputMode="decimal" value={fields.bugetReclame} onChange={(e) => set("bugetReclame", e.currentTarget.value)} className={inputClass} />
      </Field>

      <fieldset className="grid gap-2">
        <legend className="text-[13px] font-medium text-bone">Abonamentul, pe perioade</legend>
        <p className="text-[12.5px] text-dim">Pe luni întregi. Ex.: martie–mai o sumă, din iunie alta. Ultima perioadă poate rămâne fără sfârșit.</p>
        {fieldError("preturi") ? <p className="text-[13px] text-[var(--ap-error)]">{fieldError("preturi")}</p> : null}
        {prices.map((row, index) => (
          <div key={row.key} className="grid gap-2 rounded-lg bg-[var(--ap-side)] p-2.5 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
            <Field id={`pr-${row.key}-de`} label="Din luna" error={fieldError(`preturi.${index}.deLa`)}>
              <input id={`pr-${row.key}-de`} type="month" value={row.deLa} onChange={(e) => setPrice(row.key, { deLa: e.currentTarget.value })} className={inputClass} placeholder="AAAA-LL" />
            </Field>
            <Field id={`pr-${row.key}-pana`} label="Până în luna" error={fieldError(`preturi.${index}.panaLa`)}>
              <input id={`pr-${row.key}-pana`} type="month" value={row.panaLa} onChange={(e) => setPrice(row.key, { panaLa: e.currentTarget.value })} className={inputClass} placeholder="gol = fără sfârșit" />
            </Field>
            <Field id={`pr-${row.key}-suma`} label="Suma lunară" error={fieldError(`preturi.${index}.suma`)}>
              <input id={`pr-${row.key}-suma`} inputMode="decimal" value={row.suma} onChange={(e) => setPrice(row.key, { suma: e.currentTarget.value })} className={inputClass} />
            </Field>
            <button
              type="button"
              disabled={prices.length === 1}
              onClick={() => setPrices((rows) => rows.filter((item) => item.key !== row.key))}
              className="h-10 rounded-lg px-2 text-[13px] text-dim underline underline-offset-4 hover:text-[var(--ap-error)] disabled:opacity-40"
            >
              Scoate
            </button>
            <Field id={`pr-${row.key}-text`} label="Rândul de pe factură" error={fieldError(`preturi.${index}.descriere`)} className="sm:col-span-4" hint="Luna se adaugă singură la emitere.">
              <input id={`pr-${row.key}-text`} value={row.descriere} onChange={(e) => setPrice(row.key, { descriere: e.currentTarget.value })} className={inputClass} maxLength={300} />
            </Field>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setPrices((rows) => [...rows, { key: Math.max(...rows.map((item) => item.key)) + 1, deLa: "", panaLa: "", suma: "", descriere: rows.at(-1)?.descriere ?? "Abonament lunar" }])}
          className="inline-flex items-center gap-1.5 justify-self-start text-[13.5px] font-medium text-[var(--md-a1)]"
        >
          <IconPlus size={15} />
          Adaugă o perioadă
        </button>
      </fieldset>

      <Field id="ct-note" label="Note (opțional)">
        <textarea id="ct-note" rows={2} value={fields.note} onChange={(e) => set("note", e.currentTarget.value)} className={textareaClass} maxLength={2000} />
      </Field>
      {error && !error.field?.startsWith("preturi.") && !["numar", "incepe", "seTermina", "servicii", "ziEmitere", "zileScadenta", "bugetReclame", "preturi"].includes(error.field ?? "") ? (
        <Notice tone="error">{error.message}</Notice>
      ) : null}
      <div className={cn("flex gap-2")}>
        <button type="submit" disabled={pending} className="btn btn-light !min-h-10 !px-4 !py-2 !text-[14px]">
          {pending ? "Se salvează…" : "Salvează contractul"}
        </button>
        <button type="button" onClick={() => onDone(false)} className="btn btn-ghost !min-h-10 !px-4 !py-2 !text-[14px]">
          Renunță
        </button>
      </div>
    </form>
  );
}

// ------------------------------------------------------------ reclamele

function AdsSection({ client, adsClients, actions, onChanged }: { client: Client; adsClients: { id: string; name: string }[]; actions: ClientActions; onChanged: () => void }) {
  const [value, setValue] = useState(client.adsClientId ?? "");
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, start] = useTransition();

  if (adsClients.length === 0) {
    return <p className="mt-3 text-[13.5px] text-dim">Portalul de reclame n-are încă niciun client (sau migrarea lui nu e rulată). Adaugă clientul acolo, în Reclame → Clienți, apoi leagă-l aici.</p>;
  }

  return (
    <div className="mt-3 grid gap-2">
      <Field id="ads-client" label="Clientul din portalul de reclame" hint="Panoul arată banii cheltuiți pe reclame pentru clientul ales.">
        <select id="ads-client" value={value} onChange={(e) => setValue(e.currentTarget.value)} className={inputClass}>
          <option value="">Nelegat</option>
          {adsClients.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </Field>
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={pending || value === (client.adsClientId ?? "")}
          onClick={() =>
            start(async () => {
              const result = await actions.linkAds(client.id, value || null);
              setMessage(result.ok ? { tone: "ok", text: value ? "Legat." : "Legătura a fost scoasă." } : { tone: "error", text: result.message });
              if (result.ok) onChanged();
            })
          }
          className="btn btn-ghost !min-h-9 !px-3.5 !py-1.5 !text-[13.5px]"
        >
          Salvează legătura
        </button>
        {message ? <p className={cn("text-[13px]", message.tone === "ok" ? "text-[var(--ap-ok)]" : "text-[var(--ap-error)]")}>{message.text}</p> : null}
      </div>
    </div>
  );
}
