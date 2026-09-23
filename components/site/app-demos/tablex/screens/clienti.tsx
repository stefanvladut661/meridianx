import { useMemo, useState } from "react";
import {
  ArrowLeft,
  CalendarPlus,
  ChevronRight,
  Download,
  Merge,
  Plus,
  Search,
  ShieldCheck,
  StickyNote,
  TriangleAlert,
  X,
} from "lucide-react";
import { BarChart, num, rng } from "../../kit";
import { useDemo } from "../ctx";
import {
  MASA_DUPA_ID,
  TOTAL_CLIENTI,
  activa,
  clienti,
  dataCuZile,
  fmtOra,
  istoric,
  telMascat,
  type Client,
  DIACRITICE,
  type Sursa,
} from "../data";
import { FormRezervare, SheetRezervare } from "../rez";
import { ShellPanou } from "../shell";
import { FONT, L } from "../theme";
import { Avatar, BadgeStatus, Btn, Card, ETICHETA_SURSA, cx, stilInput } from "../ui";

/* ============================================================
   Clienți (§11, §19) — fișele se completează singure din
   rezervări: cheia e telefonul. Vizite, neprezentări (semnal
   roșu de la 2 încolo, doar informativ), etichete și note.
   ============================================================ */

type Filtru = "toti" | "Fidel" | "VIP" | "rosu" | "Aniversare";
const FILTRE: { id: Filtru; text: string }[] = [
  { id: "toti", text: "Toți" },
  { id: "Fidel", text: "Fideli" },
  { id: "VIP", text: "VIP" },
  { id: "Aniversare", text: "Aniversări" },
  { id: "rosu", text: "Semnal roșu" },
];

const PAGINA = 60;

const SURSA_SCURT: Record<Sursa, string> = { widget: "Widget", telefon: "Telefon", walk_in: "Walk-in", manual: "Manual" };
const faraAnCurent = (d: string) => d.replace(" 2026", "");

function relativ(zile: number) {
  if (zile <= 0) return "azi";
  if (zile === 1) return "ieri";
  if (zile < 14) return `acum ${zile} zile`;
  if (zile < 60) return `acum ${Math.round(zile / 7)} săpt.`;
  if (zile < 365) return `acum ${Math.round(zile / 30)} luni`;
  return "de peste un an";
}

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(DIACRITICE, "");

export function EcranClienti() {
  const c = useDemo();
  const toti = clienti();
  const [q, setQ] = useState("");
  const [filtru, setFiltru] = useState<Filtru>("toti");
  const [limita, setLimita] = useState(PAGINA);
  const [alesId, setAlesId] = useState<string>(c.clientAles ?? "c-irina-pavel");
  const [profilMobil, setProfilMobil] = useState(Boolean(c.clientAles));

  const cuEditari = (x: Client): Client => ({ ...x, ...c.editari[x.id] });

  const filtrati = useMemo(() => {
    const n = norm(q.trim());
    const cifre = n.replace(/\D/g, "");
    return toti.filter((x) => {
      const taguri = c.editari[x.id]?.taguri ?? x.taguri;
      if (filtru === "rosu" && x.noShow < 2) return false;
      if (filtru !== "toti" && filtru !== "rosu" && !taguri.includes(filtru)) return false;
      if (!n) return true;
      return norm(x.nume).includes(n) || (cifre.length >= 3 && x.tel.includes(cifre));
    });
  }, [toti, q, filtru, c.editari]);

  const ales = cuEditari(toti.find((x) => x.id === alesId) ?? toti[0]);

  const lista = (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="grid gap-3 border-b p-4" style={{ borderColor: L.border }}>
        <div className="flex items-baseline justify-between gap-2">
          <h1 className="text-[18px] font-semibold tracking-tight" style={{ fontFamily: FONT.display }}>
            Clienți
          </h1>
          <span className="text-[12.5px] tabular-nums" style={{ color: L.mutedFg }}>
            {num(TOTAL_CLIENTI)} fișe · completate automat
          </span>
        </div>
        <div className="relative">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" color={L.mutedFg} aria-hidden />
          <input
            type="search"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setLimita(PAGINA);
            }}
            placeholder="Caută după nume sau telefon"
            aria-label="Caută după nume sau telefon"
            style={{ ...stilInput, height: 36, paddingLeft: 34, fontSize: 13.5 }}
          />
        </div>
        <div role="group" aria-label="Filtru" className="tx-fara-bara -mx-1 flex min-h-7 gap-1.5 overflow-x-auto px-1">
          {FILTRE.map((f) => {
            const on = f.id === filtru;
            return (
              <button
                key={f.id}
                type="button"
                aria-pressed={on}
                onClick={() => {
                  setFiltru(f.id);
                  setLimita(PAGINA);
                }}
                className="h-7 shrink-0 rounded-full px-3 text-[12.5px] font-medium"
                style={{
                  background: on ? (f.id === "rosu" ? L.ocupatSoft : L.fg) : L.muted,
                  color: on ? (f.id === "rosu" ? L.ocupatText : "#fff") : L.mutedFg,
                }}
              >
                {f.text}
              </button>
            );
          })}
        </div>
      </div>
      <p className="px-4 pb-1 pt-2 text-[12px]" style={{ color: L.mutedFg }}>
        {filtrati.length === toti.length ? "Cei mai recenți întâi" : `${num(filtrati.length)} rezultate`}
      </p>
      <ul className="tx-scroll min-h-0 flex-1 overflow-y-auto pb-3">
        {filtrati.length === 0 && (
          <li className="px-4 py-8 text-center text-[13.5px]" style={{ color: L.mutedFg }}>
            Niciun client pentru „{q}”. Fișele apar singure la prima rezervare cu un număr nou.
          </li>
        )}
        {filtrati.slice(0, limita).map((x) => {
          const on = x.id === ales.id;
          const taguri = c.editari[x.id]?.taguri ?? x.taguri;
          return (
            <li key={x.id}>
              <button
                type="button"
                onClick={() => {
                  setAlesId(x.id);
                  setProfilMobil(true);
                }}
                aria-current={on && !c.mobil ? "true" : undefined}
                className={cx("flex w-full items-center gap-3 px-4 py-2.5 text-left", on && !c.mobil ? "bg-[#eff6ff]" : "hover:bg-[#f8fafc]")}
              >
                <Avatar nume={x.nume} marime={36} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-[14px] font-medium">{x.nume}</span>
                    {x.noShow >= 2 && <TriangleAlert size={13} color={L.ocupat} aria-label="Semnal roșu" />}
                    {taguri.includes("VIP") && (
                      <span className="rounded px-1 text-[10.5px] font-bold" style={{ background: "#fef3c7", color: "#92400e" }}>
                        VIP
                      </span>
                    )}
                  </span>
                  <span className="block truncate text-[12px] tabular-nums" style={{ color: L.mutedFg }}>
                    {telMascat(x.tel)} · {x.vizite === 0 ? "client nou" : relativ(x.ultima)}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-[14px] font-semibold tabular-nums">{x.vizite}</span>
                  <span className="block text-[11px]" style={{ color: L.mutedFg }}>
                    vizite
                  </span>
                </span>
                {c.mobil && <ChevronRight size={16} color={L.mutedFg} aria-hidden />}
              </button>
            </li>
          );
        })}
        {filtrati.length > limita && (
          <li className="px-4 pt-2">
            <Btn v="outline" m="sm" className="w-full" onClick={() => setLimita((n) => n + PAGINA)}>
              Arată încă {Math.min(PAGINA, filtrati.length - limita)} din {num(filtrati.length - limita)}
            </Btn>
          </li>
        )}
      </ul>
    </div>
  );

  if (c.mobil) {
    return (
      <ShellPanou ecran="client">
        {profilMobil ? (
          <div className="tx-scroll min-h-0 flex-1 overflow-y-auto">
            <div className="sticky top-0 z-10 border-b px-2 py-1.5" style={{ background: L.bg, borderColor: L.border }}>
              <Btn v="ghost" m="sm" onClick={() => setProfilMobil(false)}>
                <ArrowLeft size={16} aria-hidden />
                Clienți
              </Btn>
            </div>
            <Profil key={ales.id} client={ales} />
          </div>
        ) : (
          lista
        )}
      </ShellPanou>
    );
  }

  return (
    <ShellPanou ecran="client">
      <div className="grid min-h-0 flex-1" style={{ gridTemplateColumns: "360px minmax(0,1fr)" }}>
        <div className="flex min-h-0 flex-col border-r" style={{ background: L.card, borderColor: L.border }}>
          {lista}
        </div>
        <div className="tx-scroll min-h-0 overflow-y-auto">
          <Profil key={ales.id} client={ales} />
        </div>
      </div>
    </ShellPanou>
  );
}

function Profil({ client }: { client: Client }) {
  const c = useDemo();
  const [note, setNote] = useState(client.note ?? "");
  const [tagNou, setTagNou] = useState<string | null>(null);
  const [rezDeschisa, setRezDeschisa] = useState<string | null>(null);
  const [form, setForm] = useState(false);
  const vizite = useMemo(() => istoric(client), [client]);
  const azi = c.rez.filter((r) => r.clientId === client.id && activa(r));
  const steag = client.noShow >= 2;

  const frecventa = useMemo(() => {
    const r = rng(client.vizite * 17 + client.nume.length);
    return Array.from({ length: 12 }, (_, i) => Math.max(0, Math.round((client.vizite / 12) * (0.4 + r() * 1.2) * (0.7 + i * 0.05))));
  }, [client]);

  const salveazaTaguri = (t: string[]) => c.editeazaClient(client.id, { taguri: t });

  return (
    <div className={cx("grid gap-4", c.mobil ? "p-4" : "p-6")}>
      <div className={cx("flex gap-4", c.mobil ? "flex-col" : "items-start justify-between")}>
        <div className="flex min-w-0 items-center gap-4">
          <Avatar nume={client.nume} marime={c.mobil ? 52 : 60} />
          <div className="min-w-0">
            <h2 className="truncate text-[22px] font-semibold tracking-tight" style={{ fontFamily: FONT.display }}>
              {client.nume}
            </h2>
            <p className="text-[13px] tabular-nums" style={{ color: L.mutedFg }}>
              {telMascat(client.tel)}
            </p>
            {client.email && (
              <p className="truncate text-[13px]" style={{ color: L.mutedFg }}>
                {client.email.replace(/^(.{2}).*(@.*)$/, "$1•••$2")}
              </p>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {client.taguri.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1 rounded-md py-0.5 pl-2 pr-1 text-[12px] font-medium"
                  style={{ background: t === "VIP" ? "#fef3c7" : L.accent, color: t === "VIP" ? "#92400e" : L.accentFg }}
                >
                  {t}
                  <button
                    type="button"
                    aria-label={`Scoate eticheta ${t}`}
                    onClick={() => salveazaTaguri(client.taguri.filter((x) => x !== t))}
                    className="inline-flex h-4 w-4 items-center justify-center rounded hover:bg-black/10"
                  >
                    <X size={11} aria-hidden />
                  </button>
                </span>
              ))}
              {tagNou === null ? (
                <button
                  type="button"
                  onClick={() => setTagNou("")}
                  className="inline-flex h-6 items-center gap-1 rounded-md border border-dashed px-2 text-[12px]"
                  style={{ borderColor: "#cbd5e1", color: L.mutedFg }}
                >
                  <Plus size={12} aria-hidden />
                  Etichetă
                </button>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const t = tagNou.trim();
                    if (t && !client.taguri.includes(t)) salveazaTaguri([...client.taguri, t]);
                    setTagNou(null);
                  }}
                  className="flex items-center gap-1"
                >
                  <input
                    autoFocus
                    value={tagNou}
                    onChange={(e) => setTagNou(e.target.value)}
                    onBlur={() => !tagNou.trim() && setTagNou(null)}
                    onKeyDown={(e) => e.key === "Escape" && setTagNou(null)}
                    placeholder="Ex.: Terasă"
                    aria-label="Etichetă nouă"
                    maxLength={20}
                    style={{ ...stilInput, height: 26, width: 110, fontSize: 12.5, padding: "0 8px" }}
                  />
                  <Btn m="xs" type="submit" className="h-[26px]">
                    Adaugă
                  </Btn>
                </form>
              )}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Btn m="sm" onClick={() => setForm(true)}>
            <CalendarPlus size={15} aria-hidden />
            Rezervare nouă
          </Btn>
          <Btn
            m="sm"
            v="outline"
            onClick={() =>
              c.notify("În demo, unirea fișelor e oprită. În aplicația reală, vizitele, etichetele și neprezentările se adună în profilul principal.")
            }
          >
            <Merge size={15} aria-hidden />
            Unește cu alt profil
          </Btn>
          <Btn
            m="sm"
            v="ghost"
            onClick={() => c.notify("În demo, exportul e oprit. În aplicația reală se descarcă un CSV cu fișa și istoricul clientului.")}
          >
            <Download size={15} aria-hidden />
            CSV
          </Btn>
        </div>
      </div>

      {steag && (
        <div className="flex items-start gap-2.5 rounded-lg px-3.5 py-3 text-[13.5px]" style={{ background: L.ocupatSoft, color: L.ocupatText }}>
          <TriangleAlert size={17} className="mt-px shrink-0" aria-hidden />
          <p>
            <strong className="font-semibold">Semnal roșu: {client.noShow} neprezentări.</strong> Apare și când numărul face o rezervare
            nouă. Decizia rămâne a ta — rezervările online nu se blochează automat.
          </p>
        </div>
      )}

      {azi.map((r) => (
        <button
          key={r.id}
          type="button"
          onClick={() => setRezDeschisa(r.id)}
          className="flex items-center gap-3 rounded-lg border px-3.5 py-2.5 text-left hover:bg-[#eff6ff]"
          style={{ borderColor: "#bfdbfe", background: L.accent }}
        >
          <CalendarPlus size={17} color={L.primary} aria-hidden />
          <span className="min-w-0 flex-1 text-[13.5px]">
            <strong className="font-semibold">Azi, {fmtOra(r.start)}</strong> · {r.pers} persoane ·{" "}
            {r.masa ? `masa ${MASA_DUPA_ID[r.masa].numar}` : "masă nealocată"}
          </span>
          <BadgeStatus s={r.status} />
          <ChevronRight size={16} color={L.mutedFg} aria-hidden />
        </button>
      ))}

      <div className={cx("grid gap-3", c.mobil ? "grid-cols-2" : "grid-cols-4")}>
        {[
          ["Vizite", String(client.vizite), `client din ${client.clientDin}`],
          ["Neprezentări", String(client.noShow), client.noShow >= 2 ? "semnal roșu" : "în tot istoricul"],
          ["Persoane pe masă", client.persMedii.toLocaleString("ro-RO", { maximumFractionDigits: 1 }), "în medie"],
          ["Ultima vizită", client.vizite === 0 ? "—" : client.ultima === 0 ? "azi" : dataCuZile(client.ultima), client.vizite === 0 ? "prima rezervare, azi" : client.ultima === 0 ? "la prânz" : relativ(client.ultima)],
        ].map(([k, v, d]) => (
          <Card key={k} className="px-3.5 py-3">
            <p className="text-[12px]" style={{ color: L.mutedFg }}>
              {k}
            </p>
            <p
              className="mt-0.5 truncate text-[20px] font-semibold tabular-nums"
              style={{ color: k === "Neprezentări" && client.noShow >= 2 ? L.ocupatText : L.fg }}
            >
              {v}
            </p>
            <p className="truncate text-[11.5px]" style={{ color: L.mutedFg }}>
              {d}
            </p>
          </Card>
        ))}
      </div>

      <div className={cx("grid gap-4", !c.mobil && "grid-cols-[minmax(0,1fr)_264px]")}>
        <Card className="overflow-hidden">
          <div className="flex items-baseline justify-between border-b px-4 py-3" style={{ borderColor: L.border }}>
            <h3 className="text-[15px] font-semibold" style={{ fontFamily: FONT.display }}>
              Istoric vizite
            </h3>
            <span className="text-[12px]" style={{ color: L.mutedFg }}>
              ultimele {vizite.length}
            </span>
          </div>
          {c.mobil ? (
            <ul>
              {vizite.map((v, i) => (
                <li key={i} className="flex items-center gap-3 border-b px-4 py-2.5 last:border-0" style={{ borderColor: L.border }}>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13.5px] font-medium tabular-nums">
                      {faraAnCurent(v.data)} · {v.ora}
                    </span>
                    <span className="block text-[12px]" style={{ color: L.mutedFg }}>
                      {v.pers} pers. · masa {v.masa} · {ETICHETA_SURSA[v.sursa]}
                    </span>
                  </span>
                  <BadgeStatus s={v.status} />
                </li>
              ))}
            </ul>
          ) : (
            <table className="w-full text-[13px]">
              <thead>
                <tr style={{ color: L.mutedFg }}>
                  {["Când", "Pers.", "Masa", "Status"].map((h, i) => (
                    <th key={h} className={cx("py-2 text-left text-[12px] font-medium", i === 0 ? "pl-4 pr-2" : i === 3 ? "pl-2 pr-4" : "px-2")}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {vizite.map((v, i) => (
                  <tr key={i} className="border-t" style={{ borderColor: L.border }}>
                    <td className="whitespace-nowrap py-2 pl-4 pr-2 tabular-nums">
                      {faraAnCurent(v.data)}
                      <span style={{ color: L.mutedFg }}> · {v.ora}</span>
                    </td>
                    <td className="px-2 py-2 tabular-nums">{v.pers}</td>
                    <td className="px-2 py-2 tabular-nums" title={SURSA_SCURT[v.sursa]}>{v.masa}</td>
                    <td className="py-2 pl-2 pr-4">
                      <BadgeStatus s={v.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {client.vizite > vizite.length && (
            <p className="border-t px-4 py-2.5 text-[12.5px]" style={{ borderColor: L.border, color: L.mutedFg }}>
              și încă {client.vizite - vizite.length} vizite mai vechi
            </p>
          )}
        </Card>

        <div className="grid content-start gap-4">
          <Card className="p-4">
            <h3 className="flex items-center gap-1.5 text-[14px] font-semibold">
              <StickyNote size={15} aria-hidden />
              Note interne
            </h3>
            <p className="mt-0.5 text-[12px]" style={{ color: L.mutedFg }}>
              Le vede doar personalul, la fiecare rezervare a clientului.
            </p>
            <textarea
              rows={4}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ex.: preferă masa de la geam, alergic la nuci."
              aria-label="Note interne despre client"
              className="mt-2.5 w-full resize-none rounded-lg border px-2.5 py-2 text-[13.5px]"
              style={{ borderColor: L.border }}
            />
            {note !== (client.note ?? "") && (
              <div className="mt-2 flex justify-end gap-2">
                <Btn m="xs" v="ghost" onClick={() => setNote(client.note ?? "")}>
                  Renunță
                </Btn>
                <Btn
                  m="xs"
                  onClick={() => {
                    c.editeazaClient(client.id, { note: note.trim() || undefined });
                    c.toast({ tip: "succes", text: "Nota a fost salvată în fișă." });
                  }}
                >
                  Salvează nota
                </Btn>
              </div>
            )}
          </Card>
          <Card className="p-4">
            <p className="text-[12px]" style={{ color: L.mutedFg }}>
              Vizite pe lună, ultimele 12 luni
            </p>
            <div className="mt-2">
              <BarChart values={frecventa.map((v) => Math.max(v, 0.08))} color={L.primary} muted="#bfdbfe" highlight={11} height={52} radius={2} />
            </div>
          </Card>
          <Card className="flex items-start gap-2.5 p-4">
            <ShieldCheck size={17} color={L.liber} className="mt-px shrink-0" aria-hidden />
            <p className="text-[12.5px] leading-snug" style={{ color: L.mutedFg }}>
              <strong className="font-semibold" style={{ color: L.fg }}>
                Acord GDPR din {client.gdpr}.
              </strong>{" "}
              Fișa se anonimizează singură după 3 ani fără vizite.
            </p>
          </Card>
        </div>
      </div>

      {rezDeschisa && <SheetRezervare rezId={rezDeschisa} onClose={() => setRezDeschisa(null)} />}
      {form && <FormRezervare numeInitial={client.nume} telInitial={client.tel} onClose={() => setForm(false)} />}
    </div>
  );
}
