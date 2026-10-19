import { useEffect, useRef, useState, type ReactNode } from "react";
import { Bell, House, LayoutGrid, List, LogOut, Menu, Ticket, Users, X } from "lucide-react";
import { StatusBar } from "../kit";
import { useDemo, type Ecran } from "./ctx";
import { RESTAURANT, fmtOra } from "./data";
import { FONT, L, TITLU, UMBRA } from "./theme";
import { cx } from "./ui";

/* ============================================================
   Shell-ul panoului restaurantului (LayoutApp în produs):
   sidebar pe hârtie, o treaptă de ton sub fundal, sertar din stânga
   pe telefon, antet alb cu numele restaurantului și clopoțelul.
   ============================================================ */

type ElementNav = { ecran: Ecran; text: string; Icon: typeof House };

const NAV: ElementNav[] = [
  { ecran: "acasa", text: "Acasă", Icon: House },
  { ecran: "rezervari", text: "Lista rezervări", Icon: List },
  { ecran: "harta", text: "Harta sălii", Icon: LayoutGrid },
  { ecran: "client", text: "Clienți", Icon: Users },
  { ecran: "evenimente", text: "Evenimente", Icon: Ticket },
];

/**
 * Marca TableX: o masă văzută de sus, cu patru scaune pe diagonale care
 * fac X-ul din nume. Desenată în `currentColor`, ca în src/components/marca.
 */
export function MarcaTableX({ marime = 18 }: { marime?: number }) {
  return (
    <svg viewBox="0 0 32 32" width={marime} height={marime} fill="currentColor" aria-hidden className="shrink-0">
      <rect x="10" y="10" width="12" height="12" rx="2.5" />
      <rect x="2.6" y="5.2" width="7.2" height="3.6" rx="1.8" transform="rotate(-45 6.2 7)" />
      <rect x="22.2" y="5.2" width="7.2" height="3.6" rx="1.8" transform="rotate(45 25.8 7)" />
      <rect x="2.6" y="23.2" width="7.2" height="3.6" rx="1.8" transform="rotate(45 6.2 25)" />
      <rect x="22.2" y="23.2" width="7.2" height="3.6" rx="1.8" transform="rotate(-45 25.8 25)" />
    </svg>
  );
}

/** Sigla: marca plus numele, ca text real în fontul de titlu. */
export function Sigla() {
  return (
    <span
      className="inline-flex items-center gap-1.5 font-bold"
      style={{ fontFamily: FONT.display, fontSize: 15, letterSpacing: "-0.03em", color: L.fg }}
    >
      <MarcaTableX marime={18} />
      TableX
    </span>
  );
}

const ITEM =
  "flex w-full items-center gap-2 rounded-[10px] px-2.5 py-2 text-left text-[14px] transition-colors duration-150";
const ITEM_ACTIV = "bg-[#e8e6e1] font-medium text-[#141413]";
const ITEM_INACTIV = "text-[#3d3c38]/80 hover:bg-[#e8e6e1]/60 hover:text-[#141413]";

function Meniu({ ecran, laNavigare }: { ecran: Ecran; laNavigare?: () => void }) {
  const c = useDemo();
  return (
    <nav aria-label="Navigare panou">
      <ul className="grid gap-1">
        {NAV.map(({ ecran: e, text, Icon }) => {
          const activ = e === ecran;
          return (
            <li key={e}>
              <button
                type="button"
                aria-current={activ ? "page" : undefined}
                onClick={() => {
                  laNavigare?.();
                  c.go(e);
                }}
                className={cx(ITEM, activ ? ITEM_ACTIV : ITEM_INACTIV)}
              >
                <Icon size={16} aria-hidden />
                <span className="min-w-0 flex-1 truncate">{text}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function Cont() {
  const c = useDemo();
  return (
    <div className="mt-auto grid gap-2 border-t pt-3" style={{ borderColor: L.sidebarBorder }}>
      <div className="px-2.5">
        <p className="truncate text-[14px] font-medium" style={{ color: L.sidebarFg }}>
          Andreea Stan
        </p>
        <p className="text-[12px]" style={{ color: "rgba(61,60,56,.6)" }}>
          Manager
        </p>
      </div>
      <button type="button" onClick={() => c.notify("În demo nu poți ieși din cont.")} className={cx(ITEM, ITEM_INACTIV)}>
        <LogOut size={16} aria-hidden />
        Ieși din cont
      </button>
    </div>
  );
}

function Clopotel() {
  const c = useDemo();
  const [deschis, setDeschis] = useState(false);
  /** Ce era necitit când s-a deschis lista: punctul rămâne vizibil până la închidere. */
  const [proaspete, setProaspete] = useState<Set<number>>(new Set());
  const necitite = c.notificari.filter((n) => !n.citita).length;
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!deschis) return;
    const afara = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setDeschis(false);
    };
    document.addEventListener("pointerdown", afara);
    return () => document.removeEventListener("pointerdown", afara);
  }, [deschis]);
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label={necitite ? `Notificări, ${necitite} necitite` : "Notificări"}
        aria-expanded={deschis}
        onClick={() => {
          if (!deschis) {
            setProaspete(new Set(c.notificari.filter((n) => !n.citita).map((n) => n.id)));
            c.citesteNotificari();
          }
          setDeschis(!deschis);
        }}
        className="relative inline-flex h-8 w-8 items-center justify-center rounded-[8px] text-[#141413] transition-colors duration-150 hover:bg-[#f1f0ec]"
      >
        <Bell size={16} aria-hidden />
        {necitite > 0 && (
          <span
            aria-hidden
            className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold"
            style={{ background: L.ocupat, color: "#fff" }}
          >
            {necitite}
          </span>
        )}
      </button>
      {deschis && (
        <div
          role="dialog"
          aria-label="Notificări"
          className={cx("absolute right-0 top-10 z-40 overflow-hidden rounded-[10px]", !c.reducedMotion && "tx-anim-pop")}
          style={{ width: c.mobil ? 330 : 320, background: L.card, boxShadow: `0 0 0 1px rgba(20,20,19,.08), ${UMBRA.md}` }}
          onKeyDown={(e) => e.key === "Escape" && setDeschis(false)}
        >
          <div className="flex items-center justify-between border-b px-3 py-2" style={{ borderColor: L.border }}>
            <p className="text-[14px] font-medium">Notificări</p>
            <button
              type="button"
              aria-label="Închide notificările"
              onClick={() => setDeschis(false)}
              className="inline-flex h-7 w-7 items-center justify-center rounded-[8px] text-[#63615b] hover:bg-[#f1f0ec] hover:text-[#141413]"
            >
              <X size={14} aria-hidden />
            </button>
          </div>
          <ul className="tx-scroll max-h-[320px] overflow-y-auto">
            {c.notificari.map((n) => (
              <li key={n.id} className="border-b last:border-b-0" style={{ borderColor: L.border }}>
                <button
                  type="button"
                  onClick={() => {
                    setDeschis(false);
                    if (n.rezId) c.evidentiaza(n.rezId);
                    c.go(n.ecran);
                  }}
                  className="flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition-colors duration-150 hover:bg-[#efeeea]/50"
                >
                  <span
                    aria-hidden
                    className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                    style={{ background: proaspete.has(n.id) ? L.fg : "transparent" }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-medium leading-snug">{n.text}</span>
                    <span className="block truncate text-[12px] leading-snug" style={{ color: L.mutedFg }}>
                      {n.desc}
                    </span>
                  </span>
                  <span className="shrink-0 text-[12px]" style={{ color: L.mutedFg }}>
                    {n.cand}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Antet({ laMeniu }: { laMeniu?: () => void }) {
  const c = useDemo();
  return (
    <header
      className="relative z-20 flex shrink-0 items-center justify-between gap-3 border-b px-4"
      style={{ height: c.mobil ? 56 : 57, background: L.card, borderColor: L.border }}
    >
      <div className="flex min-w-0 items-center gap-2">
        {c.mobil && (
          <button
            type="button"
            aria-label="Meniu"
            onClick={laMeniu}
            className="-ml-1.5 inline-flex h-9 w-9 items-center justify-center rounded-[8px] transition-colors duration-150 hover:bg-[#f1f0ec]"
          >
            <Menu size={18} aria-hidden />
          </button>
        )}
        <span className="truncate text-[16px] font-semibold tracking-tight">{RESTAURANT.nume}</span>
        {!c.mobil && (
          <span
            className="inline-flex h-5 items-center rounded-[5px] px-1.5 text-[12px] font-[550]"
            style={{ background: L.secondary, color: L.secondaryFg }}
          >
            Pro
          </span>
        )}
      </div>
      <Clopotel />
    </header>
  );
}

function Sertar({ ecran, onClose }: { ecran: Ecran; onClose: () => void }) {
  const c = useDemo();
  const panou = useRef<HTMLDivElement>(null);
  const inchide = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const anterior = document.activeElement as HTMLElement | null;
    inchide.current?.focus({ preventScroll: true });
    return () => anterior?.focus?.({ preventScroll: true });
  }, []);
  const laTasta = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") return onClose();
    if (e.key !== "Tab" || !panou.current) return;
    const el = Array.from(panou.current.querySelectorAll<HTMLElement>("button"));
    if (!el.length) return;
    if (e.shiftKey && document.activeElement === el[0]) {
      e.preventDefault();
      el[el.length - 1].focus();
    } else if (!e.shiftKey && document.activeElement === el[el.length - 1]) {
      e.preventDefault();
      el[0].focus();
    }
  };
  return (
    <div className="absolute inset-0 z-40" onKeyDown={laTasta}>
      <div
        aria-hidden
        className={cx("absolute inset-0", !c.reducedMotion && "tx-anim-fade")}
        style={{ background: "rgba(20,20,19,.24)" }}
        onClick={onClose}
      />
      <div
        ref={panou}
        role="dialog"
        aria-modal="true"
        aria-label="Navigare"
        className={cx(
          "absolute bottom-0 left-0 top-0 flex w-64 flex-col gap-4 border-r p-3 pb-7 pt-[52px]",
          !c.reducedMotion && "tx-anim-stanga"
        )}
        style={{ background: L.sidebar, borderColor: L.sidebarBorder, boxShadow: UMBRA.xl }}
      >
        <div className="flex items-center justify-between pl-2.5">
          <Sigla />
          <button
            ref={inchide}
            type="button"
            aria-label="Închide meniul"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-[8px] text-[#3d3c38] transition-colors duration-150 hover:bg-[#e8e6e1]"
          >
            <X size={18} aria-hidden />
          </button>
        </div>
        <div className="tx-scroll min-h-0 flex-1 overflow-y-auto">
          <Meniu ecran={ecran} laNavigare={onClose} />
        </div>
        <Cont />
      </div>
    </div>
  );
}

export function ShellPanou({
  ecran,
  children,
  josMobil,
}: {
  ecran: Ecran;
  children: ReactNode;
  /** Bara de jos pe telefon (butonul mare de Walk-in, §32.2). */
  josMobil?: ReactNode;
}) {
  const c = useDemo();
  const [sertar, setSertar] = useState(false);

  if (c.mobil) {
    return (
      <div className="relative flex h-full flex-col">
        <StatusBar tone="dark" bg={L.card} time={fmtOra(c.acum)} />
        <Antet laMeniu={() => setSertar(true)} />
        <div className="relative flex min-h-0 flex-1 flex-col">{children}</div>
        {josMobil}
        {sertar && <Sertar ecran={ecran} onClose={() => setSertar(false)} />}
      </div>
    );
  }

  return (
    <div className="grid h-full" style={{ gridTemplateColumns: "240px minmax(0,1fr)" }}>
      <aside className="flex min-h-0 flex-col gap-4 border-r p-3" style={{ background: L.sidebar, borderColor: L.sidebarBorder }}>
        <div className="px-2.5 py-1.5">
          <Sigla />
        </div>
        <div className="tx-scroll min-h-0 flex-1 overflow-y-auto">
          <Meniu ecran={ecran} />
        </div>
        <Cont />
      </aside>
      <div className="flex min-h-0 min-w-0 flex-col">
        <Antet />
        <main className="relative flex min-h-0 flex-1 flex-col">{children}</main>
      </div>
    </div>
  );
}

/** Titlul unei pagini din panou, cu acțiunile în dreapta. Fără subtitlu: munca stă mare, numele paginii mic. */
export function TitluPagina({ titlu, children }: { titlu: string; children?: ReactNode }) {
  const c = useDemo();
  return (
    <div className={cx("flex items-center justify-between gap-3", c.mobil && "flex-wrap")}>
      <h1 className="min-w-0 text-[18px] font-semibold leading-tight" style={TITLU}>
        {titlu}
      </h1>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
}
