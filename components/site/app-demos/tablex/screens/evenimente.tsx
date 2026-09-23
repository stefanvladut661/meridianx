import { useEffect, useState } from "react";
import {
  ArrowRight,
  BellRing,
  CircleCheckBig,
  Coffee,
  Copy,
  Hourglass,
  Mail,
  MessageCircle,
  PartyPopper,
  Plus,
  ScanLine,
  Wine,
  X,
} from "lucide-react";
import { BarChart, FakeQR, lei, num } from "../../kit";
import { useDemo } from "../ctx";
import { RESTAURANT, fmtOra } from "../data";
import { ShellPanou, TitluPagina } from "../shell";
import { FONT, L } from "../theme";
import { Btn, Card, Modal, Segmented, Switch, cx } from "../ui";
import { PosterJazz } from "./widget";

/* ============================================================
   Evenimente și mesaje (§8.5, §29, §10.3) — uneltele de marketing
   ale restaurantului: seri cu bilete și cod QR, anunțul care apare
   pe pagina de rezervare, confirmările și reminderele pe WhatsApp.
   ============================================================ */

type Bilet = { id: string; nume: string; locuri: number; masa: string; pret: number; scanat: boolean };

const BILETE_JAZZ: Bilet[] = [
  { id: "b1", nume: "Ioana Sima", locuri: 2, masa: "V1", pret: 240, scanat: true },
  { id: "b2", nume: "Cristian Pop", locuri: 4, masa: "V1", pret: 480, scanat: true },
  { id: "b3", nume: "Andreea Voicu", locuri: 2, masa: "V2", pret: 240, scanat: false },
  { id: "b4", nume: "Grupul Zamfir", locuri: 4, masa: "V2", pret: 480, scanat: true },
  { id: "b5", nume: "Emil Anghel", locuri: 2, masa: "12", pret: 180, scanat: true },
  { id: "b6", nume: "Diana Toma", locuri: 3, masa: "12", pret: 270, scanat: false },
  { id: "b7", nume: "Sergiu Manole", locuri: 2, masa: "12", pret: 180, scanat: false },
];

const CONSUM = [
  { luna: "apr.", v: 1482 },
  { luna: "mai", v: 1618 },
  { luna: "iun.", v: 1894 },
  { luna: "iul.", v: 2142 },
  { luna: "aug.", v: 2377 },
  { luna: "sept.", v: 2168 },
];

type TipEveniment = "jazz" | "vin" | "brunch" | "revelion";

const POSTERE = {
  vin: { bg: "linear-gradient(135deg,#4c0519,#9f1239)", Icon: Wine, fg: "#fecdd3" },
  brunch: { bg: "linear-gradient(135deg,#78350f,#d97706)", Icon: Coffee, fg: "#fef3c7" },
  revelion: { bg: "linear-gradient(135deg,#0c1e3a,#1d4ed8 70%,#60a5fa)", Icon: PartyPopper, fg: "#dbeafe" },
};

function Poster({ tip, marime = 56 }: { tip: TipEveniment; marime?: number }) {
  if (tip === "jazz") return <PosterJazz mic className="shrink-0" />;
  const cfg = POSTERE[tip];
  return (
    <span aria-hidden className="grid shrink-0 place-items-center rounded-[10px]" style={{ width: marime, height: marime, background: cfg.bg }}>
      <cfg.Icon size={marime * 0.44} color={cfg.fg} />
    </span>
  );
}

function Progres({ vandute, capacitate, culoare }: { vandute: number; capacitate: number; culoare: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ background: L.muted }}>
      <div
        className="h-full rounded-full transition-[width] duration-700"
        style={{ width: `${(vandute / capacitate) * 100}%`, background: culoare }}
      />
    </div>
  );
}

/* ---------- scanerul de bilete (§29.6) ---------- */

function Scaner({ bilete, onScanat, onClose }: { bilete: Bilet[]; onScanat: (id: string) => void; onClose: () => void }) {
  const c = useDemo();
  const [pas, setPas] = useState<"scanez" | "rezultat">("scanez");
  const [runda, setRunda] = useState(0);
  const [rezultat, setRezultat] = useState<{ bilet: Bilet; valid: boolean } | null>(null);

  useEffect(() => {
    if (pas !== "scanez") return;
    // A treia scanare arată și cazul „deja folosit”: un bilet trimis mai departe.
    const deScanat = bilete.find((b) => !b.scanat);
    const deja = runda % 3 === 2 || !deScanat ? bilete.find((b) => b.scanat) : null;
    const t = window.setTimeout(() => {
      const valid = !deja && Boolean(deScanat);
      setRezultat({ bilet: deja ?? deScanat ?? bilete[0], valid });
      setPas("rezultat");
      if (valid && deScanat) onScanat(deScanat.id);
    }, c.reducedMotion ? 400 : 1700);
    return () => window.clearTimeout(t);
    // un singur rezultat pe rundă
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pas, runda]);

  const valid = rezultat?.valid ?? false;
  const tinta = rezultat?.bilet ?? bilete[0];

  return (
    <Modal
      onClose={onClose}
      eticheta="Scanează bilet"
      latime={c.mobil ? 360 : 380}
      reducedMotion={c.reducedMotion}
      style={{ background: "#0b1120", color: "#f8fafc" }}
      className="tx-dark"
    >
      <div className="flex items-center justify-between px-4 pt-3">
        <p className="text-[15px] font-semibold">Scanează bilet</p>
        <button
          type="button"
          aria-label="Închide camera"
          onClick={onClose}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[#cbd5e1] hover:bg-white/10"
        >
          <X size={17} aria-hidden />
        </button>
      </div>
      <div className="p-4">
        <div
          className="relative mx-auto grid h-[240px] w-full place-items-center overflow-hidden rounded-xl"
          style={{ background: "radial-gradient(circle at 50% 40%,#1e293b,#020617)" }}
        >
          <div className={cx("rounded-lg bg-white p-2 transition-opacity", pas === "rezultat" && "opacity-30")}>
            <FakeQR size={150} seed={runda + 11} />
          </div>
          {pas === "scanez" && (
            <span
              aria-hidden
              className={cx("absolute left-6 right-6 top-5 h-0.5", !c.reducedMotion && "tx-scan")}
              style={{ background: "#34d399", boxShadow: "0 0 14px 2px rgba(52,211,153,.7)" }}
            />
          )}
          <span aria-hidden className="absolute left-4 top-4 h-6 w-6 border-l-2 border-t-2" style={{ borderColor: "#f8fafc" }} />
          <span aria-hidden className="absolute right-4 top-4 h-6 w-6 border-r-2 border-t-2" style={{ borderColor: "#f8fafc" }} />
          <span aria-hidden className="absolute bottom-4 left-4 h-6 w-6 border-b-2 border-l-2" style={{ borderColor: "#f8fafc" }} />
          <span aria-hidden className="absolute bottom-4 right-4 h-6 w-6 border-b-2 border-r-2" style={{ borderColor: "#f8fafc" }} />
          {pas === "rezultat" && rezultat && (
            <div
              role="status"
              className={cx("absolute inset-x-5 grid place-items-center gap-1 rounded-xl px-4 py-4 text-center", !c.reducedMotion && "tx-anim-pop")}
              style={{ background: valid ? "#10b981" : "#f59e0b", color: valid ? "#052e1f" : "#451a03" }}
            >
              {valid ? <CircleCheckBig size={30} aria-hidden /> : <Hourglass size={28} aria-hidden />}
              <p className="text-[18px] font-bold">{valid ? "Bilet valid" : "Bilet deja folosit"}</p>
              <p className="text-[13px]">
                {tinta.nume} · {tinta.locuri} locuri · masa{" "}
                {tinta.masa === "V1" || tinta.masa === "V2" ? `${tinta.masa} (VIP)` : tinta.masa}
              </p>
              {!valid && <p className="text-[12px]">A intrat mai devreme. Verifică numele cu oaspetele.</p>}
            </div>
          )}
        </div>
        <p className="mt-3 text-center text-[12.5px]" style={{ color: "#94a3b8" }}>
          {pas === "scanez" ? "Ține codul QR în cadru…" : "Camera se oprește după fiecare bilet."}
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-11 rounded-lg text-[14px] font-medium hover:bg-white/10"
            style={{ border: "1px solid #334155" }}
          >
            Gata
          </button>
          <button
            type="button"
            disabled={pas === "scanez"}
            onClick={() => {
              setRunda((n) => n + 1);
              setPas("scanez");
            }}
            className="h-11 rounded-lg text-[14px] font-semibold disabled:opacity-40"
            style={{ background: "#60a5fa", color: "#0c1e3a" }}
          >
            Scanează următorul
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ---------- ecranul ---------- */

export function EcranEvenimente() {
  const c = useDemo();
  const [bilete, setBilete] = useState(BILETE_JAZZ);
  const [scaner, setScaner] = useState(false);
  const [confirmare, setConfirmare] = useState(true);
  const [reminder, setReminder] = useState(true);
  const [tab, setTab] = useState<"evenimente" | "bilete" | "mesaje">("evenimente");

  const locuriJazz = bilete.reduce((s, b) => s + b.locuri, 0);
  const incasariJazz = bilete.reduce((s, b) => s + b.pret, 0);
  const scanate = bilete.filter((b) => b.scanat).reduce((s, b) => s + b.locuri, 0);

  const EVENIMENTE: { id: string; tip: TipEveniment; nume: string; cand: string; vandute: number; cap: number; incasari: number; pret: string }[] = [
    { id: "jazz", tip: "jazz", nume: "Seară de jazz la Nord", cand: "azi, 20:00", vandute: locuriJazz, cap: 20, incasari: incasariJazz, pret: "de la 90 lei" },
    { id: "vin", tip: "vin", nume: "Degustare de vinuri toscane", cand: "joi, 8 oct. · 19:30", vandute: 26, cap: 32, incasari: 26 * 180, pret: "180 lei" },
    { id: "brunch", tip: "brunch", nume: "Brunch cu muzică live", cand: "dum., 18 oct. · 11:00", vandute: 14, cap: 40, incasari: 14 * 95, pret: "95 lei" },
    { id: "revelion", tip: "revelion", nume: "Revelion la Nord", cand: "joi, 31 dec. · 20:00", vandute: c.bilete, cap: 120, incasari: c.bilete * 450, pret: "450 lei" },
  ];

  const kpi = (
    <div className={cx("grid gap-3", c.mobil ? "grid-cols-2" : "grid-cols-4")}>
      {[
        ["Evenimente în 2026", "14", "4 programate"],
        ["Bilete vândute", num(1222 + c.bilete), "din pagina de rezervare"],
        ["Încasări din bilete", lei(89660 + c.bilete * 450), "plătite online, pe masă"],
        ["Scanate la intrare", "97%", "restul, verificate pe nume"],
      ].map(([k, v, d]) => (
        <Card key={k} className="p-3.5">
          <p className="text-[12px]" style={{ color: L.mutedFg }}>
            {k}
          </p>
          <p className="mt-0.5 text-[21px] font-semibold tabular-nums" style={{ fontFamily: FONT.display }}>
            {v}
          </p>
          <p className="text-[11.5px]" style={{ color: L.mutedFg }}>
            {d}
          </p>
        </Card>
      ))}
    </div>
  );

  const lista = (
    <Card className="overflow-hidden">
      <div className="flex items-baseline justify-between border-b px-4 py-3" style={{ borderColor: L.border }}>
        <h2 className="text-[15px] font-semibold" style={{ fontFamily: FONT.display }}>
          Evenimente programate
        </h2>
        <span className="text-[12px]" style={{ color: L.mutedFg }}>
          locuri pe mesele de pe hartă
        </span>
      </div>
      <ul>
        {EVENIMENTE.map((e) => (
          <li key={e.id} className="flex items-center gap-3.5 border-b px-4 py-3 last:border-0" style={{ borderColor: L.border }}>
            <Poster tip={e.tip} />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <p className="truncate text-[14.5px] font-semibold">{e.nume}</p>
                <p className="shrink-0 text-[13.5px] font-semibold tabular-nums">{lei(e.incasari)}</p>
              </div>
              <div className="flex items-baseline justify-between gap-2 text-[12.5px]" style={{ color: L.mutedFg }}>
                <span className="truncate">
                  {e.cand} · {e.pret}
                </span>
                <span className="shrink-0 tabular-nums">
                  {e.vandute}/{e.cap} locuri
                </span>
              </div>
              <div className="mt-1.5">
                <Progres vandute={e.vandute} capacitate={e.cap} culoare={e.id === "jazz" ? L.eveniment : L.primary} />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );

  const anunt = (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold" style={{ fontFamily: FONT.display }}>
            Anunț pe pagina de rezervare
          </h2>
          <p className="text-[12.5px]" style={{ color: L.mutedFg }}>
            Apare cu 7 zile înainte, deasupra formularului.
          </p>
        </div>
        <Switch
          on={c.popupEveniment}
          onChange={(v) => {
            c.setPopupEveniment(v);
            c.toast({
              tip: v ? "succes" : "info",
              text: v ? "Anunțul e pornit." : "Anunțul e oprit.",
              desc: v ? "Oaspeții îl văd pe pagina de rezervare." : "Pagina de rezervare arată doar formularul.",
            });
          }}
          eticheta="Afișează anunțul pe pagina de rezervare"
        />
      </div>
      <div
        className={cx("mt-3 overflow-hidden rounded-xl transition-opacity", !c.popupEveniment && "opacity-40")}
        style={{ border: `1px solid ${L.primary}` }}
      >
        <div className="flex items-center gap-3.5 px-3.5 py-3" style={{ background: "linear-gradient(120deg,#1e1b4b,#4c1d95 55%,#7c3aed)" }}>
          <PosterJazz mic />
          <div className="min-w-0 text-white">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em]" style={{ color: "#c4b5fd" }}>
              Eveniment · în seara asta
            </p>
            <p className="text-[15.5px] font-semibold leading-tight">Seară de jazz la Nord</p>
            <p className="text-[12px]" style={{ color: "#ddd6fe" }}>
              vineri, 25 sept. · 20:00 · de la 90 lei
            </p>
          </div>
        </div>
        <p className="flex items-center justify-between px-3.5 py-2 text-[13px] font-medium" style={{ color: L.primary }}>
          Descoperă evenimentul
          <ArrowRight size={14} aria-hidden />
        </p>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Btn m="sm" v="outline" onClick={() => c.go("widget")}>
          Vezi pagina publică
          <ArrowRight size={14} aria-hidden />
        </Btn>
        <Btn
          m="sm"
          v="ghost"
          onClick={() => {
            try {
              void navigator.clipboard?.writeText(`https://tablex.ro/r/${RESTAURANT.slug}`).catch(() => undefined);
            } catch {
              /* fără clipboard: linkul rămâne afișat în notificare */
            }
            c.toast({ tip: "succes", text: "Link copiat.", desc: `tablex.ro/r/${RESTAURANT.slug} — bun pentru bio și WhatsApp.` });
          }}
        >
          <Copy size={14} aria-hidden />
          Copiază linkul
        </Btn>
      </div>
    </Card>
  );

  const tabelBilete = (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3" style={{ borderColor: L.border }}>
        <div>
          <h2 className="text-[15px] font-semibold" style={{ fontFamily: FONT.display }}>
            Bilete vândute · Seară de jazz
          </h2>
          <p className="text-[12.5px] tabular-nums" style={{ color: L.mutedFg }}>
            {scanate} din {locuriJazz} locuri au intrat · {fmtOra(c.acum)}
          </p>
        </div>
        <Btn m="sm" onClick={() => setScaner(true)}>
          <ScanLine size={15} aria-hidden />
          Scanează
        </Btn>
      </div>
      <ul>
        {bilete.map((b) => (
          <li key={b.id} className="flex items-center gap-3 border-b px-4 py-2.5 last:border-0" style={{ borderColor: L.border }}>
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-white p-0.5" style={{ border: `1px solid ${L.border}` }}>
              <FakeQR size={30} seed={b.id.charCodeAt(1) * 7} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14px] font-medium">{b.nume}</span>
              <span className="block truncate text-[12px]" style={{ color: L.mutedFg }}>
                {b.locuri} locuri · masa {b.masa === "V1" || b.masa === "V2" ? `${b.masa}, zona VIP` : b.masa} · {lei(b.pret)} · plătit
              </span>
            </span>
            <span
              className="shrink-0 rounded-md px-2 py-0.5 text-[12px] font-medium"
              style={b.scanat ? { background: L.liber, color: L.liberFg } : { background: L.muted, color: L.mutedFg }}
            >
              {b.scanat ? "A intrat" : "Nescanat"}
            </span>
          </li>
        ))}
      </ul>
      <p className="border-t px-4 py-2.5 text-[12px]" style={{ borderColor: L.border, color: L.mutedFg }}>
        Plata online e pregătită în produs; în demo, biletele sunt marcate plătite.
      </p>
    </Card>
  );

  const mesaje = (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-[15px] font-semibold" style={{ fontFamily: FONT.display }}>
            <MessageCircle size={16} color={L.liber} aria-hidden />
            Mesaje automate
          </h2>
          <p className="text-[12.5px]" style={{ color: L.mutedFg }}>
            Pe WhatsApp, fără să scrie nimeni nimic.
          </p>
        </div>
        <div className="text-right">
          <p className="text-[20px] font-semibold leading-tight tabular-nums" style={{ fontFamily: FONT.display }}>
            {num(c.credite)}
          </p>
          <p className="text-[11.5px]" style={{ color: L.mutedFg }}>
            credite rămase
          </p>
        </div>
      </div>

      <ul className="mt-3 grid gap-2">
        {[
          { id: "conf", titlu: "Confirmare la rezervare", sub: "1.126 trimise luna asta", on: confirmare, set: setConfirmare, Icon: CircleCheckBig },
          { id: "rem", titlu: "Reminder cu 2 ore înainte", sub: "1.042 trimise · 31 de mese eliberate la timp", on: reminder, set: setReminder, Icon: BellRing },
        ].map((a) => (
          <li key={a.id} className="flex items-center gap-3 rounded-lg border px-3 py-2.5" style={{ borderColor: L.border }}>
            <a.Icon size={17} color={L.mutedFg} aria-hidden className="shrink-0" />
            <span className="min-w-0 flex-1">
              <span className="block text-[13.5px] font-medium">{a.titlu}</span>
              <span className="block text-[12px]" style={{ color: L.mutedFg }}>
                {a.sub}
              </span>
            </span>
            <Switch
              on={a.on}
              onChange={(v) => {
                a.set(v);
                c.toast({ tip: "info", text: `${a.titlu}: ${v ? "pornit" : "oprit"}.` });
              }}
              eticheta={a.titlu}
            />
          </li>
        ))}
        <li className="flex items-center gap-3 rounded-lg px-3 py-2" style={{ background: L.muted }}>
          <Mail size={16} color={L.mutedFg} aria-hidden className="shrink-0" />
          <span className="text-[12.5px]" style={{ color: L.mutedFg }}>
            Emailul și notificările din aplicație sunt gratuite și nelimitate.
          </span>
        </li>
      </ul>

      <div className="mt-3 rounded-xl p-3" style={{ background: L.sidebar, color: L.sidebarFg }}>
        <p className="text-[10.5px]" style={{ color: "rgba(226,232,240,.6)" }}>
          Automat · cu 2 ore înainte
        </p>
        <p className="mt-1 rounded-lg px-2.5 py-2 text-[12.5px] leading-snug" style={{ background: L.sidebarAccent }}>
          Te așteptăm azi la 20:30 la {RESTAURANT.nume}. Dacă nu mai poți ajunge, spune-ne aici și eliberăm masa.
        </p>
        <div className="mt-1.5 flex justify-end">
          <p className="rounded-lg px-2.5 py-1.5 text-[12.5px]" style={{ background: L.liber, color: L.liberFg }}>
            Confirmăm, venim!
          </p>
        </div>
      </div>

      <div className="mt-4">
        <p className="text-[12px]" style={{ color: L.mutedFg }}>
          Consum lunar
        </p>
        <BarChart
          values={CONSUM.map((x) => x.v)}
          labels={CONSUM.map((x) => x.luna)}
          color={L.liber}
          muted="#a7f3d0"
          highlight={5}
          height={96}
          labelColor={L.mutedFg}
          radius={3}
        />
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {[
          ["200", "20 €"],
          ["500", "50 €"],
          ["1.000", "100 €"],
        ].map(([cr, pret]) => (
          <button
            key={cr}
            type="button"
            onClick={() => c.notify("În demo, plata e oprită. În aplicația reală, creditele se adaugă imediat după plata cu cardul.")}
            className="rounded-lg border px-2 py-2 text-center hover:bg-[#f8fafc]"
            style={{ borderColor: L.border }}
          >
            <span className="block text-[13.5px] font-semibold tabular-nums">{cr}</span>
            <span className="block text-[11.5px]" style={{ color: L.mutedFg }}>
              credite · {pret}
            </span>
          </button>
        ))}
      </div>
    </Card>
  );

  const scanerModal = scaner && (
    <Scaner
      bilete={bilete}
      onScanat={(id) => setBilete((xs) => xs.map((b) => (b.id === id ? { ...b, scanat: true } : b)))}
      onClose={() => setScaner(false)}
    />
  );

  const butonNou = (
    <Btn
      v="outline"
      m={c.mobil ? "sm" : "md"}
      onClick={() =>
        c.notify("În demo, crearea e oprită. În aplicația reală, un asistent în trei pași: detaliile, mesele de pe hartă și prețurile pe zone.")
      }
    >
      <Plus size={16} aria-hidden />
      Eveniment nou
    </Btn>
  );

  if (c.mobil) {
    return (
      <ShellPanou ecran="evenimente">
        <div className="tx-scroll min-h-0 flex-1 overflow-y-auto">
          <div className="grid gap-3 p-4 pb-10">
            <TitluPagina titlu="Evenimente și mesaje" sub="Bilete cu cod QR, anunțuri, remindere." />
            <Segmented
              eticheta="Secțiune"
              value={tab}
              onChange={setTab}
              optiuni={[
                { id: "evenimente", text: "Evenimente" },
                { id: "bilete", text: "Bilete" },
                { id: "mesaje", text: "Mesaje" },
              ]}
              className="w-full"
            />
            {tab === "evenimente" && (
              <>
                {kpi}
                {lista}
                {anunt}
                {butonNou}
              </>
            )}
            {tab === "bilete" && tabelBilete}
            {tab === "mesaje" && mesaje}
          </div>
        </div>
        {scanerModal}
      </ShellPanou>
    );
  }

  return (
    <ShellPanou ecran="evenimente">
      <div className="tx-scroll min-h-0 flex-1 overflow-y-auto">
        <div className="grid gap-4 p-6">
          <TitluPagina titlu="Evenimente și mesaje" sub="Seri cu bilete și cod QR, anunțul de pe pagina de rezervare, mesajele automate.">
            <Btn onClick={() => setScaner(true)}>
              <ScanLine size={16} aria-hidden />
              Scanează bilet
            </Btn>
            {butonNou}
          </TitluPagina>
          {kpi}
          <div className="grid items-start gap-4" style={{ gridTemplateColumns: "minmax(0,1fr) 340px" }}>
            <div className="grid gap-4">
              {lista}
              {tabelBilete}
            </div>
            <div className="grid gap-4">
              {anunt}
              {mesaje}
            </div>
          </div>
        </div>
      </div>
      {scanerModal}
    </ShellPanou>
  );
}
