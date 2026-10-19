import { ArrowRight, Clock } from "lucide-react";
import { num } from "../../kit";
import { useDemo } from "../ctx";
import { MASA_DUPA_ID, MESE, ZI_AZI, activa, fmtOra, statusuriLa } from "../data";
import { ShellPanou, TitluPagina } from "../shell";
import { L } from "../theme";
import { BadgeStatus, Btn, Card, TitluCard, cx } from "../ui";

/* ============================================================
   Acasă (§24.4), ca AcasaPage din produs: ce întreabă cine tocmai
   a intrat în tură — câte rezervări, câți oameni, cât de plină e
   sala acum și, mai ales, dacă a rămas o cerere netratată.
   ============================================================ */

function Kpi({ eticheta, valoare, detaliu, accent }: { eticheta: string; valoare: string; detaliu?: string; accent?: boolean }) {
  return (
    <div className="rounded-[10px] border p-4" style={{ background: L.card, borderColor: L.border }}>
      <p className="text-[12px]" style={{ color: L.mutedFg }}>
        {eticheta}
      </p>
      <p className="mt-1 text-[24px] font-semibold leading-tight" style={{ color: accent ? L.ocupat : L.fg }}>
        {valoare}
      </p>
      {detaliu && (
        <p className="mt-0.5 text-[12px]" style={{ color: L.mutedFg }}>
          {detaliu}
        </p>
      )}
    </div>
  );
}

export function EcranAcasa() {
  const c = useDemo();

  const azi = c.rez.filter((r) => r.status !== "respinsa");
  const persoaneAzi = c.rez.filter(activa).reduce((s, r) => s + r.pers, 0);
  const pending = c.rez.filter((r) => r.status === "pending").length;
  const { status } = statusuriLa(c.acum, c.rez);
  const meseActive = MESE.filter((m) => !m.indisponibila);
  const ocupate = meseActive.filter((m) => status[m.id] && status[m.id] !== "liber").length;
  const ocupare = Math.round((ocupate / meseActive.length) * 100);

  const sosiri = c.rez
    .filter((r) => activa(r) && r.status !== "sosita" && r.start >= c.acum - 0.5)
    .sort((a, b) => a.start - b.start)
    .slice(0, 6);

  const kpiuri = (
    <div className={cx("grid gap-3", c.mobil ? "grid-cols-2" : "grid-cols-4")}>
      <Kpi eticheta="Rezervări azi" valoare={num(azi.length)} />
      <Kpi eticheta="Persoane așteptate" valoare={num(persoaneAzi)} />
      <Kpi eticheta="Ocupare acum" valoare={`${ocupare}%`} detaliu={`${ocupate} din ${meseActive.length} mese`} />
      <Kpi eticheta="Neprezentări (7 zile)" valoare="3" accent />
    </div>
  );

  // Cererile în așteptare nu expiră: una uitată rămâne uitată până o vede cineva.
  const alerta = pending > 0 && (
    <div
      className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] border p-4"
      style={{ borderColor: L.expirare, background: L.expirareSoft }}
    >
      <p className="text-[14px]">
        <span className="font-semibold">{pending}</span> {pending === 1 ? "cerere așteaptă" : "cereri așteaptă"} un răspuns.
      </p>
      <Btn m="sm" v="outline" onClick={() => c.go("rezervari")}>
        Vezi cererile
        <ArrowRight size={14} aria-hidden />
      </Btn>
    </div>
  );

  const listaSosiri = (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2 px-5 pb-3 pt-5">
        <Clock size={16} aria-hidden />
        <TitluCard>Următoarele sosiri</TitluCard>
      </div>
      {sosiri.length === 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 pb-5">
          <p className="text-[14px]" style={{ color: L.mutedFg }}>
            Nicio sosire programată
          </p>
          <Btn m="sm" v="outline" onClick={() => c.go("harta")}>
            Harta sălii
          </Btn>
        </div>
      ) : (
        <ul className="border-t" style={{ borderColor: L.border }}>
          {sosiri.map((r) => (
            <li key={r.id} className="border-b last:border-b-0" style={{ borderColor: L.border }}>
              <button
                type="button"
                onClick={() => {
                  c.evidentiaza(r.id);
                  c.go("rezervari");
                }}
                className="flex w-full flex-wrap items-center justify-between gap-x-3 gap-y-1 px-5 py-2.5 text-left text-[14px] transition-colors duration-150 hover:bg-[#efeeea]/50"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="w-11 shrink-0 font-semibold">{fmtOra(r.start)}</span>
                  <span className="truncate font-medium">{r.nume}</span>
                  <BadgeStatus s={r.status} />
                </span>
                <span className="text-[12px]" style={{ color: L.mutedFg }}>
                  {r.pers} pers.{r.masa ? ` · masa ${MASA_DUPA_ID[r.masa].grup ? "V1 + V2" : MASA_DUPA_ID[r.masa].numar}` : " · fără masă"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );

  return (
    <ShellPanou ecran="acasa">
      <div className="tx-scroll min-h-0 flex-1 overflow-y-auto">
        <div className={cx("grid gap-4", c.mobil ? "p-4 pb-10" : "p-6")}>
          <TitluPagina titlu={ZI_AZI} />
          {kpiuri}
          {alerta}
          {listaSosiri}
        </div>
      </div>
    </ShellPanou>
  );
}
