import { useId, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, CalendarDays, Check, CheckCircle2, MapPin, Music, TriangleAlert, Users, X } from "lucide-react";
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
import { D, FONT, L, type StatusMasa } from "../theme";
import { Btn, Modal, cx, stilInput } from "../ui";

/* ============================================================
   Pagina publică de rezervare (/r/trattoria-nord) — ce vede
   oaspetele care atinge linkul din bio sau widgetul de pe site.
   Cererea trimisă aici intră în panoul restaurantului, live.
   ============================================================ */

const ZILE = [
  { id: 0, scurt: "Azi", zi: "vin.", data: 25, lung: "vineri, 25 septembrie" },
  { id: 1, scurt: "Sâm", zi: "sâm.", data: 26, lung: "sâmbătă, 26 septembrie" },
  { id: 2, scurt: "Dum", zi: "dum.", data: 27, lung: "duminică, 27 septembrie" },
  { id: 3, scurt: "Lun", zi: "lun.", data: 28, lung: "luni, 28 septembrie" },
  { id: 4, scurt: "Mar", zi: "mar.", data: 29, lung: "marți, 29 septembrie" },
];
const ORE = [18, 18.5, 19, 19.5, 20, 20.5, 21, 21.5, 22];
const PERSOANE = [1, 2, 3, 4, 5, 6, 8];
const OCAZII = ["Fără ocazie anume", "Aniversare", "Întâlnire de afaceri", "Cină romantică", "Ieșire cu prietenii"];

/** Pentru zilele viitoare, disponibilitatea e inventată, dar stabilă. */
function ocupateInZiua(zi: number, ora: number) {
  const r = rng(zi * 131 + Math.round(ora * 10));
  return new Set(MESE.filter(() => r() < (ora >= 19.5 && ora <= 21 ? 0.72 : 0.45)).map((m) => m.id));
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
  const oraPlina = (h: number) =>
    !MESE.some((m) => (!m.grup || m.id === "V1") && disponibila(m.id, h, pers));

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

  const libere = MESE.filter(
    (m) => m.zona === zona && (!m.grup || m.id === "V1") && !statusuri[m.id]
  );
  const eligibile = new Set(libere.flatMap((m) => meseRezervare({ masa: m.id })));
  const masaValida = masa && !statusuri[masa] ? masa : null;
  const zonaObj = ZONE.find((z) => z.id === zona)!;

  const trimite = () => {
    const e: typeof erori = {};
    if (nume.trim().length < 2) e.nume = "Scrie-ne numele pe care îl dăm la intrare.";
    const cifre = tel.replace(/\D/g, "");
    if (!cifre) e.tel = "Telefonul e obligatoriu — pe el primești confirmarea.";
    else if (!/^07\d{8}$/.test(cifre)) e.tel = "Numărul are 10 cifre și începe cu 07.";
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) e.email = "Adresa de email nu arată bine.";
    if (!gdpr) e.gdpr = "Bifează acordul ca să putem păstra rezervarea.";
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
        nota: [ocazie !== OCAZII[0] ? ocazie : "", pref.trim()].filter(Boolean).join(" · ") || undefined,
        nou: true,
        clientId: idClient(nume.trim()),
      });
      rezId = r.id;
    }
    setTrimis({ rezId, masa: masaValida, zi, ora: oraEfectiva, pers });
    c.notify("În demo, mesajul de confirmare pe WhatsApp nu pleacă. În aplicația reală, oaspetele îl primește imediat ce trimite cererea.");
  };

  const shake = !c.reducedMotion && incercare > 0 ? "tx-anim-shake" : undefined;
  const eticheta = "text-[13px] font-semibold";
  const eticStil = { color: L.mutedFg };

  /* ---------- bucățile formularului ---------- */

  const alegeZi = (
    <div className="grid gap-1.5">
      <p className={eticheta} style={eticStil} id="w-zi">
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
              onClick={() => {
                setZi(z.id);
                setMasa(null);
              }}
              className="grid place-items-center rounded-lg py-1.5"
              style={{ background: on ? L.primary : L.muted, color: on ? "#fff" : L.fg }}
            >
              <span className="text-[11.5px]">{z.scurt}</span>
              <span className="text-[15px] font-bold tabular-nums">{z.data}</span>
            </button>
          );
        })}
      </div>
    </div>
  );

  const alegeOra = (
    <div className="grid gap-1.5">
      <p className={eticheta} style={eticStil} id="w-ora">
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
              className="h-9 rounded-lg text-[13.5px] font-semibold tabular-nums disabled:cursor-not-allowed"
              style={{
                background: on ? L.primary : L.muted,
                color: on ? "#fff" : trecuta || plina ? "rgba(71,85,105,.5)" : L.fg,
                textDecoration: plina ? "line-through" : undefined,
                opacity: trecuta ? 0.45 : 1,
              }}
            >
              {fmtOra(h)}
            </button>
          );
        })}
      </div>
    </div>
  );

  const alegePersoane = (
    <div className="grid gap-1.5">
      <p className={eticheta} style={eticStil} id="w-pers">
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
              className="flex h-9 items-center justify-center gap-1 rounded-lg text-[13.5px] font-semibold tabular-nums"
              style={{ background: on ? L.primary : L.muted, color: on ? "#fff" : L.fg }}
            >
              <Users size={12} aria-hidden />
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
    <div className="grid gap-1">
      <label htmlFor={id} className={eticheta} style={eticStil}>
        {label}
        {opts.optional && <span className="font-normal"> (opțional)</span>}
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
        style={{ ...stilInput, height: 42, borderColor: opts.err ? L.destructive : L.border, background: L.card }}
      />
      {opts.err && (
        <p id={`${id}-err`} className="flex items-center gap-1 text-[12.5px]" style={{ color: L.ocupatText }}>
          <TriangleAlert size={13} aria-hidden />
          {opts.err}
        </p>
      )}
    </div>
  );

  const contact = (
    <div className="grid gap-3">
      {camp("w-nume", "Nume", nume, setNume, { err: erori.nume, placeholder: "Ex.: Andrei Popescu" })}
      <div className={cx("grid gap-3", !c.mobil && "grid-cols-2")}>
        {camp("w-tel", "Telefon", tel, setTel, { err: erori.tel, placeholder: "07xx xxx xxx", mode: "tel" })}
        {camp("w-email", "Email", email, setEmail, { err: erori.email, placeholder: "nume@exemplu.ro", mode: "email", optional: true })}
      </div>
      <div className="grid gap-1">
        <label htmlFor="w-ocazie" className={eticheta} style={eticStil}>
          Ocazia
        </label>
        <select id="w-ocazie" value={ocazie} onChange={(e) => setOcazie(e.target.value)} style={{ ...stilInput, height: 42 }}>
          {OCAZII.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      </div>
      <div className="grid gap-1">
        <label htmlFor="w-pref" className={eticheta} style={eticStil}>
          Preferințe sau alergii <span className="font-normal">(opțional)</span>
        </label>
        <input
          id="w-pref"
          value={pref}
          onChange={(e) => setPref(e.target.value)}
          placeholder="Ex.: fără gluten, scaun pentru copil"
          style={{ ...stilInput, height: 42 }}
        />
      </div>
      <div>
        <label
          key={erori.gdpr ? `g${incercare}` : "g"}
          className={cx("flex cursor-pointer items-start gap-2.5 text-[12.5px] leading-snug", erori.gdpr && shake)}
          style={{ color: L.mutedFg }}
        >
          <input
            type="checkbox"
            checked={gdpr}
            onChange={(e) => setGdpr(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0"
            style={{ accentColor: L.primary }}
            aria-invalid={Boolean(erori.gdpr)}
          />
          <span>
            Sunt de acord cu prelucrarea datelor mele (nume, telefon) în scopul gestionării rezervării, conform Politicii de
            confidențialitate.
          </span>
        </label>
        {erori.gdpr && (
          <p className="mt-1 flex items-center gap-1 text-[12.5px]" style={{ color: L.ocupatText }}>
            <TriangleAlert size={13} aria-hidden />
            {erori.gdpr}
          </p>
        )}
      </div>
      {masaValida && (
        <div className="flex items-center justify-between gap-2 rounded-lg px-3 py-2" style={{ background: L.accent }}>
          <span className="text-[13.5px]">
            Ceri <strong className="font-semibold">masa {MASA_DUPA_ID[masaValida].grup ? "V1 + V2" : MASA_DUPA_ID[masaValida].numar}</strong> ·{" "}
            {capacitate(masaValida)} locuri
          </span>
          <Btn m="xs" v="ghost" onClick={() => setMasa(null)}>
            Renunță
          </Btn>
        </div>
      )}
      <Btn m="lg" className="h-12 w-full text-[15.5px]" onClick={trimite}>
        Trimite cererea
      </Btn>
      <p className="text-center text-[12px]" style={{ color: L.mutedFg }}>
        Restaurantul confirmă manual fiecare rezervare. Fără cont, fără plată.
      </p>
    </div>
  );

  const sala = (
    <div className="grid content-start gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[16px] font-semibold" style={{ fontFamily: FONT.display }}>
          {c.mobil ? "Alege masa (opțional)" : "Sala"}
        </h2>
        <div role="tablist" aria-label="Zona" className="flex rounded-lg p-[3px]" style={{ background: L.muted }}>
          {ZONE.map((z) => (
            <button
              key={z.id}
              type="button"
              role="tab"
              aria-selected={z.id === zona}
              onClick={() => setZona(z.id)}
              className="h-7 rounded-md px-3 text-[13px] font-medium"
              style={{
                background: z.id === zona ? L.card : "transparent",
                color: z.id === zona ? L.fg : L.mutedFg,
                boxShadow: z.id === zona ? "0 1px 2px rgba(15,23,42,.1)" : undefined,
              }}
            >
              {z.nume}
            </button>
          ))}
        </div>
      </div>
      <div className="tx-dark overflow-hidden rounded-lg" style={{ background: D.exterior, border: `1px solid ${D.border}` }}>
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
        <p className="rounded-lg p-3.5 text-[13.5px]" style={{ background: L.muted, color: L.mutedFg }}>
          Nicio masă liberă aici la ora aleasă. Încearcă altă oră sau trimite cererea fără să alegi masa — restaurantul îți
          găsește loc.
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
                className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3.5 text-[14px] font-medium transition-colors"
                style={{ background: on ? L.primary : L.muted, color: on ? "#fff" : L.fg }}
              >
                {on && <Check size={15} aria-hidden />}
                Masa {m.grup ? "V1 + V2" : m.numar}
                <span className="inline-flex items-center gap-1 text-[12px]" style={{ opacity: 0.8 }}>
                  <Users size={12} aria-hidden />
                  {capacitate(m.id)}
                </span>
              </button>
            );
          })}
        </div>
      )}
      <p className="text-[12px]" style={{ color: L.mutedFg }}>
        Masa aleasă e o cerere, nu o rezervare: restaurantul o confirmă sau îți propune alta.
      </p>
    </div>
  );

  const anunt = c.popupEveniment && (
    <div className="overflow-hidden rounded-xl" style={{ border: `1px solid ${L.primary}`, background: L.card }}>
      <div className="relative flex items-center gap-4 overflow-hidden px-4 py-3.5" style={{ background: "linear-gradient(120deg,#1e1b4b,#4c1d95 55%,#7c3aed)" }}>
        <PosterJazz mic />
        <div className="relative min-w-0 text-white">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: "#c4b5fd" }}>
            Eveniment · în seara asta
          </p>
          <p className="text-[17px] font-semibold leading-tight" style={{ fontFamily: FONT.display }}>
            Seară de jazz la Nord
          </p>
          <p className="text-[12.5px]" style={{ color: "#ddd6fe" }}>
            vineri, 25 septembrie · 20:00 · bilete de la 90 lei
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => setEveniment(true)}
        className="flex w-full items-center justify-between px-4 py-2.5 text-[13.5px] font-medium hover:bg-[#eff6ff]"
        style={{ color: L.primary }}
      >
        Descoperă evenimentul
        <ArrowRight size={15} aria-hidden />
      </button>
    </div>
  );

  const antet = (
    <header className="shrink-0 border-b" style={{ background: L.card, borderColor: L.border }}>
      <div className={cx("mx-auto flex items-center justify-between gap-2", c.mobil ? "px-4 py-3" : "max-w-5xl px-6 py-4")}>
        <div className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden
            className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-[14px] font-bold text-white"
            style={{ background: "#7c2d12", fontFamily: FONT.display }}
          >
            TN
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-[17px] font-semibold tracking-tight" style={{ fontFamily: FONT.display }}>
              {RESTAURANT.nume}
            </h1>
            <p className="flex items-center gap-1 text-[12px]" style={{ color: L.mutedFg }}>
              <MapPin size={12} aria-hidden />
              {RESTAURANT.oras} · {RESTAURANT.tip}
            </p>
          </div>
        </div>
        {!c.mobil && (
          <span className="shrink-0 text-[12px]" style={{ color: L.mutedFg }}>
            Rezervări prin Table<span style={{ color: L.primary }}>X</span>
          </span>
        )}
      </div>
    </header>
  );

  const confirmare = trimis && (
    <div className={cx("rounded-xl p-6", !c.reducedMotion && "tx-anim-pop")} style={{ background: L.card, boxShadow: "0 0 0 1px rgba(15,23,42,.07)" }}>
      <div className="grid h-14 w-14 place-items-center rounded-full" style={{ background: L.liber }}>
        <CheckCircle2 size={30} color={L.liberFg} aria-hidden />
      </div>
      <h2 className="mt-4 text-[22px] font-semibold tracking-tight" style={{ fontFamily: FONT.display }}>
        Cererea ta a fost trimisă
      </h2>
      <p className="mt-1 text-[14.5px]" style={{ color: L.mutedFg }}>
        {RESTAURANT.nume} confirmă manual rezervările. Primești răspuns în scurt timp, pe WhatsApp.
      </p>
      <dl className="mt-5 overflow-hidden rounded-lg text-[14px]" style={{ background: L.muted }}>
        {[
          ["Când", `${ZILE[trimis.zi].lung}, ${fmtOra(trimis.ora)}`],
          ["Persoane", String(trimis.pers)],
          ["Unde", RESTAURANT.nume],
          ...(trimis.masa ? [["Masa cerută", MASA_DUPA_ID[trimis.masa].grup ? "V1 + V2" : MASA_DUPA_ID[trimis.masa].numar]] : []),
        ].map(([k, v]) => (
          <div key={k} className="flex items-center justify-between gap-2 border-b px-3.5 py-2.5 last:border-0" style={{ borderColor: L.card }}>
            <dt style={{ color: L.mutedFg }}>{k}</dt>
            <dd className="font-semibold">{v}</dd>
          </div>
        ))}
      </dl>
      {trimis.masa && (
        <p className="mt-3 text-[13px]" style={{ color: L.mutedFg }}>
          Ai cerut masa {MASA_DUPA_ID[trimis.masa].numar}. Restaurantul confirmă alocarea.
        </p>
      )}
      <div className={cx("mt-5 grid gap-2", !c.mobil && "grid-cols-2")}>
        {trimis.rezId ? (
          <Btn
            m="lg"
            onClick={() => {
              c.evidentiaza(trimis.rezId!);
              c.go("rezervari");
            }}
          >
            Vezi cererea în panou
            <ArrowRight size={16} aria-hidden />
          </Btn>
        ) : (
          <p className="flex items-center gap-2 rounded-lg px-3 text-[13px]" style={{ background: L.accent, color: L.accentFg }}>
            <CalendarDays size={15} aria-hidden />
            A intrat în calendarul restaurantului.
          </p>
        )}
        <Btn
          m="lg"
          v="outline"
          onClick={() => {
            setTrimis(null);
            setMasa(null);
            setNume("");
            setTel("");
            setEmail("");
            setPref("");
            setGdpr(false);
            setErori({});
            setIncercare(0);
          }}
        >
          <ArrowLeft size={16} aria-hidden />
          Trimite altă rezervare
        </Btn>
      </div>
    </div>
  );

  const modalEveniment = eveniment && (
    <Modal onClose={() => setEveniment(false)} eticheta="Seară de jazz la Nord" latime={c.mobil ? 360 : 460} reducedMotion={c.reducedMotion}>
      <div className="relative overflow-hidden rounded-t-xl" style={{ background: "#1e1b4b" }}>
        <PosterJazz className="block h-[170px] w-full" />
        <div className="absolute right-2 top-2">
          <button
            type="button"
            aria-label="Închide"
            onClick={() => setEveniment(false)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/60"
          >
            <X size={16} aria-hidden />
          </button>
        </div>
      </div>
      <div className="grid gap-3 p-5">
        <div>
          <h2 className="text-[20px] font-semibold tracking-tight" style={{ fontFamily: FONT.display }}>
            Seară de jazz la Nord
          </h2>
          <p className="text-[13.5px]" style={{ color: L.mutedFg }}>
            vineri, 25 septembrie · 20:00 · trio live, repertoriu de standarde
          </p>
        </div>
        <ul className="grid gap-2">
          {[
            ["Zona VIP · mesele V1 și V2", "120 lei / loc", "complet"],
            ["Masa 12, lângă scenă", "90 lei / loc", "1 loc liber"],
          ].map(([z, p, d]) => (
            <li key={z} className="flex items-center justify-between gap-3 rounded-lg px-3 py-2.5" style={{ background: L.muted }}>
              <span className="min-w-0">
                <span className="block text-[14px] font-medium">{z}</span>
                <span className="block text-[12.5px]" style={{ color: L.mutedFg }}>
                  {d}
                </span>
              </span>
              <span className="shrink-0 text-[14px] font-semibold tabular-nums">{p}</span>
            </li>
          ))}
        </ul>
        <p className="text-[12.5px]" style={{ color: L.mutedFg }}>
          Locul se blochează doar după plată. Biletul cu cod QR vine pe email și WhatsApp și se scanează la intrare.
        </p>
        <Btn
          m="lg"
          className="w-full"
          onClick={() =>
            c.notify("În demo, plata e oprită. În aplicația reală, după plata cu cardul, biletul cu cod QR ajunge imediat pe email și WhatsApp.")
          }
        >
          Cumpără bilet · 90 lei
        </Btn>
      </div>
    </Modal>
  );

  if (c.mobil) {
    return (
      <div className="relative flex h-full flex-col" style={{ background: L.bg }}>
        <StatusBar tone="dark" bg={L.card} />
        {antet}
        <div className="tx-scroll min-h-0 flex-1 overflow-y-auto">
          <div className="grid gap-4 px-4 pb-10 pt-4">
            {trimis ? (
              confirmare
            ) : (
              <>
                {anunt}
                <section className="grid gap-4 rounded-xl p-4" style={{ background: L.card, boxShadow: "0 0 0 1px rgba(15,23,42,.07)" }}>
                  <div>
                    <h2 className="text-[17px] font-semibold" style={{ fontFamily: FONT.display }}>
                      Rezervă o masă
                    </h2>
                    <p className="text-[13px]" style={{ color: L.mutedFg }}>
                      Durează cam 30 de secunde.
                    </p>
                  </div>
                  {alegeZi}
                  {alegeOra}
                  {alegePersoane}
                </section>
                <section className="rounded-xl p-4" style={{ background: L.card, boxShadow: "0 0 0 1px rgba(15,23,42,.07)" }}>
                  {sala}
                </section>
                <section className="rounded-xl p-4" style={{ background: L.card, boxShadow: "0 0 0 1px rgba(15,23,42,.07)" }}>
                  {contact}
                </section>
                <p className="pb-2 text-center text-[12px]" style={{ color: L.mutedFg }}>
                  Rezervări prin Table<span style={{ color: L.primary }}>X</span>
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
    <div className="relative flex h-full flex-col" style={{ background: L.bg }}>
      {antet}
      <div className="tx-scroll min-h-0 flex-1 overflow-y-auto">
        <main className="mx-auto grid max-w-5xl items-start gap-6 px-6 py-7" style={{ gridTemplateColumns: trimis ? "1fr" : "1fr 1fr" }}>
          {trimis ? (
            <div className="mx-auto w-full max-w-xl">{confirmare}</div>
          ) : (
            <>
              <div className="grid gap-4">
                {anunt}
                <section className="grid gap-4 rounded-xl p-5" style={{ background: L.card, boxShadow: "0 0 0 1px rgba(15,23,42,.07)" }}>
                  <div>
                    <h2 className="text-[17px] font-semibold" style={{ fontFamily: FONT.display }}>
                      Rezervă o masă
                    </h2>
                    <p className="text-[13px]" style={{ color: L.mutedFg }}>
                      Restaurantul confirmă manual fiecare rezervare.
                    </p>
                  </div>
                  {alegeZi}
                  {alegeOra}
                  {alegePersoane}
                  <div className="border-t pt-4" style={{ borderColor: L.border }}>
                    {contact}
                  </div>
                </section>
              </div>
              <section className="sticky top-0 rounded-xl p-5" style={{ background: L.card, boxShadow: "0 0 0 1px rgba(15,23,42,.07)" }}>
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

/** Afișul serii de jazz, desenat (nu fotografie): contrabas stilizat pe violet. */
export function PosterJazz({ mic = false, className }: { mic?: boolean; className?: string }) {
  const w = mic ? 64 : 240;
  const h = mic ? 64 : 150;
  const idGrad = useId();
  return (
    <svg
      viewBox="0 0 240 150"
      width={w}
      height={h}
      className={className}
      aria-hidden
      style={{ flexShrink: 0, borderRadius: mic ? 10 : 0, background: "#1e1b4b" }}
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <radialGradient id={idGrad} cx="70%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.9" />
          <stop offset="60%" stopColor="#5b21b6" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#1e1b4b" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="240" height="150" fill={`url(#${idGrad})`} />
      {Array.from({ length: 7 }, (_, i) => (
        <circle key={i} cx={170} cy={48} r={14 + i * 16} fill="none" stroke="#c4b5fd" strokeOpacity={0.16 - i * 0.018} strokeWidth="1.5" />
      ))}
      <g transform="translate(92 14) rotate(14)">
        <path d="M28 8 C18 30 22 46 12 58 C0 72 4 96 22 108 C38 118 58 116 70 104 C84 90 80 70 68 58 C60 48 62 30 52 8 Z" fill="#f59e0b" opacity="0.95" />
        <path d="M40 -12 L40 110" stroke="#fde68a" strokeWidth="2" />
        <path d="M34 -12 L34 110 M46 -12 L46 110" stroke="#fde68a" strokeWidth="1" opacity="0.7" />
        <ellipse cx="40" cy="80" rx="7" ry="3.5" fill="#1e1b4b" opacity="0.6" />
        <path d="M30 60 q10 -6 20 0" stroke="#1e1b4b" strokeWidth="2" fill="none" opacity="0.5" />
      </g>
      <g fill="#e9d5ff" opacity="0.85">
        <circle cx="38" cy="112" r="4" />
        <rect x="41" y="88" width="2" height="24" />
        <circle cx="58" cy="104" r="4" />
        <rect x="61" y="80" width="2" height="24" />
        <rect x="41" y="86" width="22" height="3" />
      </g>
      <Music x={24} y={24} width={22} height={22} color="#ddd6fe" />
    </svg>
  );
}
