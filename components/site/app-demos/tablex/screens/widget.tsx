import { useMemo, useState, type CSSProperties } from "react";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, MapPin, TriangleAlert, Users, X } from "lucide-react";
import { StatusBar, rng } from "../../kit";
import { useDemo } from "../ctx";
import {
  MASA_DUPA_ID,
  MESE,
  RESTAURANT,
  ZONE,
  capacitate,
  conflict,
  fmtOra,
  idClient,
  meseRezervare,
  persoane,
  type ZonaId,
} from "../data";
import { HartaSala } from "../map";
import { D, FONT, type StatusMasa } from "../theme";
import { Modal, cx } from "../ui";

/* ============================================================
   Pagina publică de rezervare (/r/trattoria-nord) — ce vede
   oaspetele care atinge linkul din bio sau widgetul de pe site.

   Poartă identitatea RESTAURANTULUI, nu pe a TableX (principiul 4
   din PRODUCT.md): fontul stilului de formular ales de el (Inter) și
   culoarea lui de accent, cărămiziul din monograma „TN”. Harta rămâne
   pe fond de noapte, ca peste tot în produs.
   ============================================================ */

/** Paleta paginii Trattoriei Nord: hârtie neutră, accentul restaurantului pe acțiuni și selecție. */
export const G = {
  bg: "#faf9f7",
  card: "#ffffff",
  fg: "#1a1a17",
  muted: "#f0efeb",
  mutedHover: "#e7e5df",
  mutedFg: "#5a584f",
  border: "#e0ded7",
  input: "#c9c6bd",
  accent: "#7c2d12",
  accentHover: "#682510",
  accentFg: "#ffffff",
  accentSoft: "#f6ece7",
  eroare: "#b42318",
  succes: "#1f9d69",
} as const;

const UMBRA_FOAIE = "0 0 0 1px rgba(26,26,23,.07), 0 1px 1px rgba(26,26,23,.05)";

const ZILE = [
  { id: 0, scurt: "Azi", data: 25, lung: "vineri, 25 septembrie" },
  { id: 1, scurt: "Sâm", data: 26, lung: "sâmbătă, 26 septembrie" },
  { id: 2, scurt: "Dum", data: 27, lung: "duminică, 27 septembrie" },
  { id: 3, scurt: "Lun", data: 28, lung: "luni, 28 septembrie" },
  { id: 4, scurt: "Mar", data: 29, lung: "marți, 29 septembrie" },
];
const ORE = [18, 18.5, 19, 19.5, 20, 20.5, 21, 21.5, 22];
const PERSOANE = [1, 2, 3, 4, 5, 6, 8];
const OCAZII = ["Fără ocazie anume", "Aniversare", "Întâlnire de afaceri", "Cină romantică", "Ieșire cu prietenii"];

/** Pentru zilele viitoare, disponibilitatea e inventată, dar stabilă. */
function ocupateInZiua(zi: number, ora: number) {
  const r = rng(zi * 131 + Math.round(ora * 10));
  return new Set(MESE.filter(() => r() < (ora >= 19.5 && ora <= 21 ? 0.72 : 0.45)).map((m) => m.id));
}

/**
 * Anunțul de eveniment de pe pagina de rezervare (AnuntEveniment în produs).
 * O singură componentă pentru pagina publică și pentru previzualizarea din
 * Evenimente: o copie scrisă separat ar minți la prima schimbare a anunțului.
 */
export function AnuntEveniment({ onDeschide, previzualizare = false }: { onDeschide?: () => void; previzualizare?: boolean }) {
  return (
    <div
      className="flex items-center justify-between gap-3 rounded-[12px] p-4"
      style={{ background: G.card, boxShadow: UMBRA_FOAIE, fontFamily: FONT.oaspete, color: G.fg }}
    >
      <div className="min-w-0">
        <p className="text-[16px] font-semibold leading-snug">Seară de jazz la Nord</p>
        <p className="mt-0.5 text-[14px]" style={{ color: G.mutedFg }}>
          azi, 20:00 · bilete de la 90 lei
        </p>
      </div>
      {previzualizare ? (
        <span aria-hidden className="shrink-0 rounded-[8px] px-2.5 py-1.5 text-[14px] font-medium" style={{ color: G.accent }}>
          Vezi biletele
        </span>
      ) : (
        <button
          type="button"
          onClick={onDeschide}
          className="shrink-0 rounded-[8px] px-2.5 py-1.5 text-[14px] font-medium transition-colors duration-150 hover:bg-[#f6ece7]"
          style={{ color: G.accent }}
        >
          Vezi biletele
        </button>
      )}
    </div>
  );
}

export function EcranWidget() {
  const c = useDemo();
  const primaOraAzi = ORE.find((h) => h > c.acum + 0.2) ?? 22;
  const [zi, setZi] = useState(0);
  const [ora, setOra] = useState<number>(21.5);
  const [pers, setPers] = useState(2);
  const [zona, setZona] = useState<ZonaId>("salon");
  const [masa, setMasa] = useState<string | null>(null);
  const [nume, setNume] = useState("");
  const [tel, setTel] = useState("");
  const [email, setEmail] = useState("");
  const [ocazie, setOcazie] = useState(OCAZII[0]);
  const [pref, setPref] = useState("");
  const [gdpr, setGdpr] = useState(false);
  const [erori, setErori] = useState<{ nume?: string; tel?: string; email?: string; gdpr?: string }>({});
  const [incercare, setIncercare] = useState(0);
  const [eveniment, setEveniment] = useState(false);
  const [trimis, setTrimis] = useState<null | { rezId?: string; masa: string | null; zi: number; ora: number; pers: number }>(null);

  const oraEfectiva = zi === 0 && ora < primaOraAzi ? primaOraAzi : ora;

  const disponibila = (id: string, h: number, p: number) => {
    if (MASA_DUPA_ID[id].indisponibila || capacitate(id) < p) return false;
    if (zi === 0) return !conflict(c.rez, id, h, 2);
    return !ocupateInZiua(zi, h).has(id);
  };
  const oraPlina = (h: number) => !MESE.some((m) => (!m.grup || m.id === "V1") && disponibila(m.id, h, pers));

  const statusuri = useMemo(() => {
    const s: Record<string, StatusMasa> = {};
    for (const m of MESE) {
      if (m.indisponibila) s[m.id] = "inactiv";
      else if (capacitate(m.id) < pers) s[m.id] = "inactiv";
      else if (!disponibila(m.id, oraEfectiva, pers)) s[m.id] = "ocupat";
    }
    return s;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c.rez, zi, oraEfectiva, pers]);

  const libere = MESE.filter((m) => m.zona === zona && (!m.grup || m.id === "V1") && !statusuri[m.id]);
  const eligibile = new Set(libere.flatMap((m) => meseRezervare({ masa: m.id })));
  const masaValida = masa && !statusuri[masa] ? masa : null;
  const zonaObj = ZONE.find((z) => z.id === zona)!;
  const numarMasa = (id: string) => (MASA_DUPA_ID[id].grup ? "V1 + V2" : MASA_DUPA_ID[id].numar);

  const trimite = () => {
    const e: typeof erori = {};
    if (nume.trim().length < 2) e.nume = "Scrie numele pentru rezervare.";
    const cifre = tel.replace(/\D/g, "");
    if (!cifre) e.tel = "Scrie un număr de telefon. Pe el primești confirmarea.";
    else if (!/^07\d{8}$/.test(cifre)) e.tel = "Numărul are 10 cifre și începe cu 07.";
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) e.email = "Adresa de email nu e validă.";
    if (!gdpr) e.gdpr = "Bifează acordul pentru prelucrarea datelor.";
    setErori(e);
    setIncercare((n) => n + 1);
    if (Object.keys(e).length) return;
    let rezId: string | undefined;
    if (zi === 0) {
      const r = c.adaugaRez({
        nume: nume.trim(),
        tel: cifre,
        pers,
        start: oraEfectiva,
        dur: 2,
        masa: null,
        masaDorita: masaValida,
        status: "pending",
        sursa: "widget",
        nota: [ocazie !== OCAZII[0] ? ocazie : "", pref.trim()].filter(Boolean).join(". ") || undefined,
        nou: true,
        clientId: idClient(nume.trim()),
      });
      rezId = r.id;
    }
    setTrimis({ rezId, masa: masaValida, zi, ora: oraEfectiva, pers });
    c.notify("În demo, confirmarea pe WhatsApp nu pleacă.");
  };

  const shake = !c.reducedMotion && incercare > 0 ? "tx-anim-shake" : undefined;
  const eticheta = "text-[14px] font-medium";
  const foaie: CSSProperties = { background: G.card, boxShadow: UMBRA_FOAIE };
  const stilCamp: CSSProperties = {
    height: 44,
    width: "100%",
    borderRadius: 8,
    border: `1px solid ${G.input}`,
    background: G.card,
    padding: "0 12px",
    fontSize: 16,
    color: G.fg,
  };
  const chip = (on: boolean) =>
    cx(
      "transition-colors duration-150 disabled:cursor-not-allowed",
      on ? "bg-[#7c2d12] text-white" : "bg-[#f0efeb] text-[#1a1a17] hover:bg-[#e7e5df] disabled:hover:bg-[#f0efeb]"
    );

  /* ---------- bucățile formularului ---------- */

  const alegeZi = (
    <div className="grid gap-2">
      <p className={eticheta} id="w-zi">
        Ziua
      </p>
      <div role="group" aria-labelledby="w-zi" className="grid grid-cols-5 gap-1.5">
        {ZILE.map((z) => {
          const on = z.id === zi;
          return (
            <button
              key={z.id}
              type="button"
              aria-pressed={on}
              aria-label={z.lung}
              onClick={() => {
                setZi(z.id);
                setMasa(null);
              }}
              className={cx("grid place-items-center rounded-[8px] py-1.5", chip(on))}
            >
              <span className="text-[12px]" style={{ opacity: on ? 0.85 : 0.75 }}>
                {z.scurt}
              </span>
              <span className="text-[16px] font-semibold">{z.data}</span>
            </button>
          );
        })}
      </div>
    </div>
  );

  const alegeOra = (
    <div className="grid gap-2">
      <p className={eticheta} id="w-ora">
        Ora
      </p>
      <div role="group" aria-labelledby="w-ora" className="grid grid-cols-5 gap-1.5">
        {ORE.map((h) => {
          const trecuta = zi === 0 && h < primaOraAzi;
          const plina = !trecuta && oraPlina(h);
          const on = h === oraEfectiva && !trecuta;
          return (
            <button
              key={h}
              type="button"
              aria-pressed={on}
              disabled={trecuta || plina}
              aria-label={`${fmtOra(h)}${plina ? ", ocupat" : trecuta ? ", a trecut" : ""}`}
              onClick={() => {
                setOra(h);
                setMasa(null);
              }}
              className={cx("h-10 rounded-[8px] text-[14px] font-medium", chip(on), (trecuta || plina) && "opacity-45")}
              style={{ textDecoration: plina ? "line-through" : undefined }}
            >
              {fmtOra(h)}
            </button>
          );
        })}
      </div>
    </div>
  );

  const alegePersoane = (
    <div className="grid gap-2">
      <p className={eticheta} id="w-pers">
        Persoane
      </p>
      <div role="group" aria-labelledby="w-pers" className="grid grid-cols-7 gap-1.5">
        {PERSOANE.map((n) => {
          const on = n === pers;
          return (
            <button
              key={n}
              type="button"
              aria-pressed={on}
              aria-label={persoane(n)}
              onClick={() => {
                setPers(n);
                setMasa(null);
              }}
              className={cx("h-10 rounded-[8px] text-[14px] font-medium", chip(on))}
            >
              {n}
            </button>
          );
        })}
      </div>
    </div>
  );

  const camp = (
    id: string,
    label: string,
    value: string,
    set: (v: string) => void,
    opts: { err?: string; placeholder?: string; mode?: "tel" | "email" | "text"; optional?: boolean } = {}
  ) => (
    <div className="grid gap-1.5">
      <label htmlFor={id} className={eticheta}>
        {label}
        {opts.optional && (
          <span className="font-normal" style={{ color: G.mutedFg }}>
            {" "}
            (opțional)
          </span>
        )}
      </label>
      <input
        id={id}
        key={opts.err ? `${id}${incercare}` : id}
        value={value}
        onChange={(e) => set(e.target.value)}
        inputMode={opts.mode === "tel" ? "tel" : opts.mode === "email" ? "email" : undefined}
        placeholder={opts.placeholder}
        aria-invalid={Boolean(opts.err)}
        aria-describedby={opts.err ? `${id}-err` : undefined}
        className={opts.err ? shake : undefined}
        style={{ ...stilCamp, borderColor: opts.err ? G.eroare : G.input }}
      />
      {opts.err && (
        <p id={`${id}-err`} className="flex items-center gap-1.5 text-[13px]" style={{ color: G.eroare }}>
          <TriangleAlert size={14} aria-hidden />
          {opts.err}
        </p>
      )}
    </div>
  );

  const contact = (
    <div className="grid gap-3.5">
      {camp("w-nume", "Nume", nume, setNume, { err: erori.nume, placeholder: "Ex.: Andrei Popescu" })}
      <div className={cx("grid gap-3.5", !c.mobil && "grid-cols-2")}>
        {camp("w-tel", "Telefon", tel, setTel, { err: erori.tel, placeholder: "0722 123 456", mode: "tel" })}
        {camp("w-email", "Email", email, setEmail, { err: erori.email, placeholder: "nume@exemplu.ro", mode: "email", optional: true })}
      </div>
      <div className="grid gap-1.5">
        <label htmlFor="w-ocazie" className={eticheta}>
          Ocazia
        </label>
        <select id="w-ocazie" value={ocazie} onChange={(e) => setOcazie(e.target.value)} style={stilCamp}>
          {OCAZII.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      </div>
      <div className="grid gap-1.5">
        <label htmlFor="w-pref" className={eticheta}>
          Preferințe sau alergii{" "}
          <span className="font-normal" style={{ color: G.mutedFg }}>
            (opțional)
          </span>
        </label>
        <input
          id="w-pref"
          value={pref}
          onChange={(e) => setPref(e.target.value)}
          placeholder="Ex.: fără gluten, scaun pentru copil"
          style={stilCamp}
        />
      </div>
      <div>
        <label
          key={erori.gdpr ? `g${incercare}` : "g"}
          className={cx("flex cursor-pointer items-start gap-2.5 text-[13px] leading-snug", erori.gdpr && shake)}
          style={{ color: G.mutedFg }}
        >
          <input
            type="checkbox"
            checked={gdpr}
            onChange={(e) => setGdpr(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0"
            style={{ accentColor: G.accent }}
            aria-invalid={Boolean(erori.gdpr)}
          />
          <span>
            Sunt de acord cu prelucrarea datelor mele (nume, telefon) în scopul gestionării rezervării, conform Politicii de
            confidențialitate.
          </span>
        </label>
        {erori.gdpr && (
          <p className="mt-1.5 flex items-center gap-1.5 text-[13px]" style={{ color: G.eroare }}>
            <TriangleAlert size={14} aria-hidden />
            {erori.gdpr}
          </p>
        )}
      </div>
      {masaValida && (
        <div className="flex items-center justify-between gap-2 rounded-[8px] px-3 py-2" style={{ background: G.accentSoft }}>
          <span className="text-[14px]">
            Ceri <strong className="font-semibold">masa {numarMasa(masaValida)}</strong> · {capacitate(masaValida)} locuri
          </span>
          <button
            type="button"
            onClick={() => setMasa(null)}
            className="rounded-[8px] px-2 py-1 text-[13px] font-medium transition-colors duration-150 hover:bg-white/70"
          >
            Renunță
          </button>
        </div>
      )}
      <button
        type="button"
        onClick={trimite}
        className="h-12 w-full rounded-[8px] text-[16px] font-semibold transition-colors duration-150 hover:bg-[#682510] active:translate-y-px"
        style={{ background: G.accent, color: G.accentFg }}
      >
        Trimite cererea
      </button>
      <p className="text-center text-[13px]" style={{ color: G.mutedFg }}>
        Restaurantul îți confirmă cererea pe WhatsApp.
      </p>
    </div>
  );

  const sala = (
    <div className="grid content-start gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[16px] font-semibold">{c.mobil ? "Masa (opțional)" : "Sala"}</h2>
        <div role="tablist" aria-label="Zona" className="flex h-8 rounded-[8px] p-[3px]" style={{ background: G.muted }}>
          {ZONE.map((z) => {
            const on = z.id === zona;
            return (
              <button
                key={z.id}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setZona(z.id)}
                className={cx(
                  "rounded-[6px] px-3 text-[13px] font-medium transition-colors duration-150",
                  on ? "text-[#1a1a17]" : "text-[#5a584f] hover:text-[#1a1a17]"
                )}
                style={{ background: on ? G.card : "transparent", boxShadow: on ? "0 1px 1px rgba(26,26,23,.08)" : undefined }}
              >
                {z.nume}
              </button>
            );
          })}
        </div>
      </div>
      <div className="tx-dark overflow-hidden rounded-[10px]" style={{ background: D.exterior, border: `1px solid ${D.border}` }}>
        <HartaSala
          zona={zonaObj}
          statusuri={statusuri}
          selectata={masaValida}
          onMasa={c.mobil ? undefined : (id) => setMasa((m) => (m === id ? null : MASA_DUPA_ID[id].grup ? "V1" : id))}
          eligibile={c.mobil ? null : eligibile}
          reducedMotion={c.reducedMotion}
          style={{ width: "100%", height: "auto", aspectRatio: `${zonaObj.w} / ${zonaObj.h}` }}
        />
      </div>
      {libere.length === 0 ? (
        <p className="rounded-[8px] p-3.5 text-[14px]" style={{ background: G.muted, color: G.mutedFg }}>
          Nicio masă liberă la ora aleasă. Alege altă oră sau trimite cererea fără masă.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {libere.map((m) => {
            const on = masaValida === m.id;
            return (
              <button
                key={m.id}
                type="button"
                aria-pressed={on}
                onClick={() => setMasa(on ? null : m.id)}
                className={cx("inline-flex min-h-11 items-center gap-2 rounded-[8px] px-3.5 text-[14px] font-medium", chip(on))}
              >
                {on && <Check size={15} aria-hidden />}
                Masa {numarMasa(m.id)}
                <span className="inline-flex items-center gap-1 text-[13px] font-normal" style={{ opacity: 0.8 }}>
                  <Users size={13} aria-hidden />
                  {capacitate(m.id)}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );

  const anunt = c.popupEveniment && <AnuntEveniment onDeschide={() => setEveniment(true)} />;

  const antet = (
    <header className="shrink-0 border-b" style={{ background: G.card, borderColor: G.border }}>
      <div className={cx("mx-auto flex items-center justify-between gap-2", c.mobil ? "px-4 py-3" : "max-w-5xl px-6 py-4")}>
        <div className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden
            className="grid h-10 w-10 shrink-0 place-items-center rounded-[8px] text-[14px] font-semibold"
            style={{ background: G.accent, color: G.accentFg }}
          >
            TN
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-[18px] font-semibold leading-tight">{RESTAURANT.nume}</h1>
            <p className="mt-0.5 flex items-center gap-1 text-[13px]" style={{ color: G.mutedFg }}>
              <MapPin size={13} aria-hidden />
              {RESTAURANT.oras} · {RESTAURANT.tip}
            </p>
          </div>
        </div>
        {!c.mobil && (
          <span className="shrink-0 text-[12px]" style={{ color: G.mutedFg }}>
            Rezervări prin TableX
          </span>
        )}
      </div>
    </header>
  );

  const reia = () => {
    setTrimis(null);
    setMasa(null);
    setNume("");
    setTel("");
    setEmail("");
    setPref("");
    setGdpr(false);
    setErori({});
    setIncercare(0);
  };

  const confirmare = trimis && (
    <div className={cx("rounded-[12px] p-6", !c.reducedMotion && "tx-anim-pop")} style={foaie}>
      <h2 className="flex items-center gap-2 text-[20px] font-semibold leading-tight">
        <CheckCircle2 size={20} color={G.succes} aria-hidden />
        Cerere trimisă
      </h2>
      <p className="mt-1.5 text-[15px]" style={{ color: G.mutedFg }}>
        Răspunsul vine pe WhatsApp.
      </p>
      <dl className="mt-5 overflow-hidden rounded-[8px] border text-[14px]" style={{ borderColor: G.border }}>
        {[
          ["Când", `${ZILE[trimis.zi].lung}, ${fmtOra(trimis.ora)}`],
          ["Persoane", String(trimis.pers)],
          ...(trimis.masa ? [["Masa cerută", numarMasa(trimis.masa)]] : []),
        ].map(([k, v]) => (
          <div key={k} className="flex items-center justify-between gap-2 border-b px-3.5 py-2.5 last:border-0" style={{ borderColor: G.border }}>
            <dt style={{ color: G.mutedFg }}>{k}</dt>
            <dd className="font-medium">{v}</dd>
          </div>
        ))}
      </dl>
      <div className={cx("mt-5 grid gap-2", trimis.rezId && !c.mobil && "grid-cols-2")}>
        {trimis.rezId && (
          <button
            type="button"
            onClick={() => {
              c.evidentiaza(trimis.rezId!);
              c.go("rezervari");
            }}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-[8px] text-[15px] font-semibold transition-colors duration-150 hover:bg-[#682510]"
            style={{ background: G.accent, color: G.accentFg }}
          >
            Vezi cererea în panou
            <ArrowRight size={16} aria-hidden />
          </button>
        )}
        <button
          type="button"
          onClick={reia}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-[8px] border text-[15px] font-medium transition-colors duration-150 hover:bg-[#f0efeb]"
          style={{ borderColor: G.input, background: G.card }}
        >
          <ArrowLeft size={16} aria-hidden />
          Trimite altă rezervare
        </button>
      </div>
    </div>
  );

  const modalEveniment = eveniment && (
    <Modal onClose={() => setEveniment(false)} eticheta="Seară de jazz la Nord" latime={c.mobil ? 360 : 440} reducedMotion={c.reducedMotion}>
      <div className="grid gap-4 p-5" style={{ fontFamily: FONT.oaspete, color: G.fg }}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[18px] font-semibold leading-tight">Seară de jazz la Nord</h2>
            <p className="mt-1 text-[14px]" style={{ color: G.mutedFg }}>
              Vineri, 25 septembrie · 20:00–23:00
            </p>
          </div>
          <button
            type="button"
            aria-label="Închide"
            onClick={() => setEveniment(false)}
            className="-mr-1 -mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] transition-colors duration-150 hover:bg-[#f0efeb]"
            style={{ color: G.mutedFg }}
          >
            <X size={16} aria-hidden />
          </button>
        </div>
        <ul className="overflow-hidden rounded-[8px] border" style={{ borderColor: G.border }}>
          {[
            ["Zona VIP, mesele V1 și V2", "120 lei / loc", "Complet"],
            ["Masa 12, lângă scenă", "90 lei / loc", "1 loc liber"],
          ].map(([z, p, d]) => (
            <li key={z} className="flex items-center justify-between gap-3 border-b px-3.5 py-2.5 last:border-0" style={{ borderColor: G.border }}>
              <span className="min-w-0">
                <span className="block text-[14px] font-medium">{z}</span>
                <span className="block text-[13px]" style={{ color: G.mutedFg }}>
                  {d}
                </span>
              </span>
              <span className="shrink-0 text-[14px] font-semibold">{p}</span>
            </li>
          ))}
        </ul>
        <p className="text-[13px]" style={{ color: G.mutedFg }}>
          Biletul cu cod QR vine pe email și pe WhatsApp.
        </p>
        <button
          type="button"
          onClick={() => c.notify("În demo, plata cu cardul e oprită.")}
          className="h-11 w-full rounded-[8px] text-[15px] font-semibold transition-colors duration-150 hover:bg-[#682510]"
          style={{ background: G.accent, color: G.accentFg }}
        >
          Cumpără bilet · 90 lei
        </button>
      </div>
    </Modal>
  );

  const radacina: CSSProperties = { background: G.bg, color: G.fg, fontFamily: FONT.oaspete };

  if (c.mobil) {
    return (
      <div className="relative flex h-full flex-col" style={radacina}>
        <StatusBar tone="dark" bg={G.card} time={fmtOra(c.acum)} />
        {antet}
        <div className="tx-scroll min-h-0 flex-1 overflow-y-auto">
          <div className="grid gap-4 px-4 pb-10 pt-4">
            {trimis ? (
              confirmare
            ) : (
              <>
                {anunt}
                <section className="grid gap-4 rounded-[12px] p-4" style={foaie}>
                  <h2 className="text-[18px] font-semibold">Rezervă o masă</h2>
                  {alegeZi}
                  {alegeOra}
                  {alegePersoane}
                </section>
                <section className="rounded-[12px] p-4" style={foaie}>
                  {sala}
                </section>
                <section className="rounded-[12px] p-4" style={foaie}>
                  {contact}
                </section>
                <p className="pb-2 text-center text-[12px]" style={{ color: G.mutedFg }}>
                  Rezervări prin TableX
                </p>
              </>
            )}
          </div>
        </div>
        {modalEveniment}
      </div>
    );
  }

  return (
    <div className="relative flex h-full flex-col" style={radacina}>
      {antet}
      <div className="tx-scroll min-h-0 flex-1 overflow-y-auto">
        <main className="mx-auto grid max-w-5xl items-start gap-6 px-6 py-7" style={{ gridTemplateColumns: trimis ? "1fr" : "1fr 1fr" }}>
          {trimis ? (
            <div className="mx-auto w-full max-w-xl">{confirmare}</div>
          ) : (
            <>
              <div className="grid gap-4">
                {anunt}
                <section className="grid gap-4 rounded-[12px] p-5" style={foaie}>
                  <h2 className="text-[18px] font-semibold">Rezervă o masă</h2>
                  {alegeZi}
                  {alegeOra}
                  {alegePersoane}
                  <div className="border-t pt-4" style={{ borderColor: G.border }}>
                    {contact}
                  </div>
                </section>
              </div>
              <section className="sticky top-0 rounded-[12px] p-5" style={foaie}>
                {sala}
              </section>
            </>
          )}
        </main>
      </div>
      {modalEveniment}
    </div>
  );
}
