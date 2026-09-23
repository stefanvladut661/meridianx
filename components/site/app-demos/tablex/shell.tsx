import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Bell,
  Building2,
  Globe,
  House,
  LayoutGrid,
  List,
  LogOut,
  Menu,
  Ticket,
  Users,
  X,
} from "lucide-react";
import { StatusBar } from "../kit";
import { useDemo, type Ecran } from "./ctx";
import { RESTAURANT, ZI_SCURTA, fmtOra } from "./data";
import { FONT, L } from "./theme";
import { cx } from "./ui";

/* ============================================================
   Shell-ul panoului restaurantului (LayoutApp în produs):
   sidebar navy fix pe desktop, sertar din hamburger pe telefon,
   antet alb cu numele restaurantului și clopoțelul de notificări.
   ============================================================ */

type ElementNav = { ecran: Ecran; text: string; Icon: typeof House };

const NAV: ElementNav[] = [
  { ecran: "acasa", text: "Acasă", Icon: House },
  { ecran: "rezervari", text: "Lista rezervări", Icon: List },
  { ecran: "harta", text: "Harta sălii", Icon: LayoutGrid },
  { ecran: "client", text: "Clienți", Icon: Users },
  { ecran: "evenimente", text: "Evenimente", Icon: Ticket },
];
const NAV_ALTE: ElementNav[] = [
  { ecran: "widget", text: "Pagina de rezervare", Icon: Globe },
  { ecran: "retea", text: "Panoul echipei TableX", Icon: Building2 },
];

export function Logo({ marime = 18 }: { marime?: number }) {
  return (
    <span
      className="font-semibold tracking-tight"
      style={{ fontSize: marime, color: L.sidebarFg, fontFamily: FONT.display, letterSpacing: "-0.02em" }}
    >
      Table<span style={{ color: L.sidebarPrimary }}>X</span>
    </span>
  );
}

function Meniu({ ecran, laNavigare }: { ecran: Ecran; laNavigare?: () => void }) {
  const c = useDemo();
  const pending = c.rez.filter((r) => r.status === "pending").length;
  const item = ({ ecran: e, text, Icon }: ElementNav) => {
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
          className={cx(
            "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[14px] transition-colors",
            activ ? "bg-[#334155] font-medium text-[#f8fafc]" : "text-[#e2e8f0]/80 hover:bg-[#334155]/60 hover:text-[#f8fafc]"
          )}
        >
          <Icon size={16} aria-hidden />
          <span className="min-w-0 flex-1 truncate">{text}</span>
          {e === "rezervari" && pending > 0 && (
            <span
              className="rounded-full px-1.5 text-[11px] font-semibold tabular-nums"
              style={{ background: L.expirare, color: L.expirareFg, lineHeight: "18px" }}
              aria-label={`${pending} cereri în așteptare`}
            >
              {pending}
            </span>
          )}
        </button>
      </li>
    );
  };
  return (
    <nav aria-label="Navigare panou" className="grid gap-4">
      <ul className="grid gap-1">{NAV.map(item)}</ul>
      <div>
        <p className="px-2.5 pb-1.5 text-[11px] font-medium uppercase tracking-[0.08em]" style={{ color: "rgba(226,232,240,.5)" }}>
          Dincolo de panou
        </p>
        <ul className="grid gap-1">{NAV_ALTE.map(item)}</ul>
      </div>
    </nav>
  );
}

function Cont() {
  const c = useDemo();
  return (
    <div className="grid gap-2 border-t pt-3" style={{ borderColor: L.sidebarBorder }}>
      <div className="px-2.5">
        <p className="truncate text-[14px] font-medium" style={{ color: L.sidebarFg }}>
          Andreea Stan
        </p>
        <p className="text-[12px]" style={{ color: "rgba(226,232,240,.6)" }}>
          Manager
        </p>
      </div>
      <button
        type="button"
        onClick={() =>
          c.notify("În demo rămâi în panou. În aplicația reală, sesiunea se închide doar pe dispozitivul acesta.")
        }
        className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13.5px] text-[#e2e8f0]/80 hover:bg-[#334155]/60 hover:text-[#f8fafc]"
      >
        <LogOut size={15} aria-hidden />
        Ieși din cont
      </button>
    </div>
  );
}

function LiveChip({ compact = false }: { compact?: boolean }) {
  const c = useDemo();
  return (
    <span
      className="inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[12.5px] font-medium tabular-nums"
      style={{ background: L.muted, color: L.mutedFg }}
      aria-label={`Ora curentă ${fmtOra(c.acum)}`}
    >
      <span
        aria-hidden
        className={cx("inline-block h-2 w-2 rounded-full", !c.reducedMotion && "tx-puls")}
        style={{ background: L.liber }}
      />
      {!compact && <span>{ZI_SCURTA} ·</span>}
      <span style={{ color: L.fg, fontFamily: FONT.mono, fontWeight: 500 }}>{fmtOra(c.acum)}</span>
    </span>
  );
}

function Clopotel() {
  const c = useDemo();
  const [deschis, setDeschis] = useState(false);
  /** Ce era necitit când s-a deschis lista: punctul albastru rămâne vizibil până la închidere. */
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
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg text-[#0f172a] hover:bg-[#f1f5f9]"
      >
        <Bell size={18} aria-hidden />
        {necitite > 0 && (
          <span
            aria-hidden
            className="absolute right-1 top-1 min-w-[17px] rounded-full px-1 text-center text-[10.5px] font-bold tabular-nums"
            style={{ background: L.destructive, color: "#fff", lineHeight: "17px" }}
          >
            {necitite}
          </span>
        )}
      </button>
      {deschis && (
          <div
            role="dialog"
            aria-label="Notificări"
            className={cx("absolute right-0 top-11 z-40 overflow-hidden rounded-xl", !c.reducedMotion && "tx-anim-pop")}
            style={{
              width: c.mobil ? 330 : 360,
              background: L.card,
              boxShadow: "0 0 0 1px rgba(15,23,42,.08), 0 20px 48px -16px rgba(15,23,42,.35)",
            }}
            onKeyDown={(e) => e.key === "Escape" && setDeschis(false)}
          >
            <div className="flex items-center justify-between border-b px-4 py-2.5" style={{ borderColor: L.border }}>
              <p className="text-[14px] font-semibold">Notificări</p>
              <button
                type="button"
                aria-label="Închide notificările"
                onClick={() => setDeschis(false)}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[#475569] hover:bg-[#f1f5f9]"
              >
                <X size={15} aria-hidden />
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
                    className="flex w-full items-start gap-2.5 px-4 py-2.5 text-left hover:bg-[#f8fafc]"
                  >
                    <span
                      aria-hidden
                      className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                      style={{ background: proaspete.has(n.id) ? L.primary : "transparent" }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13.5px] font-medium leading-snug">{n.text}</span>
                      <span className="block text-[12.5px] leading-snug" style={{ color: L.mutedFg }}>
                        {n.desc}
                      </span>
                    </span>
                    <span className="shrink-0 text-[11.5px] tabular-nums" style={{ color: L.mutedFg }}>
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
            className="-ml-1.5 inline-flex h-9 w-9 items-center justify-center rounded-lg hover:bg-[#f1f5f9]"
          >
            <Menu size={20} aria-hidden />
          </button>
        )}
        <span className="truncate text-[16px] font-semibold tracking-tight" style={{ fontFamily: FONT.display }}>
          {RESTAURANT.nume}
        </span>
        <span
          className="rounded-md px-2 py-0.5 text-[11.5px] font-medium"
          style={{ background: L.secondary, color: L.secondaryFg }}
        >
          Pro
        </span>
      </div>
      <div className="flex items-center gap-2">
        <LiveChip compact={c.mobil} />
        <Clopotel />
      </div>
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
        style={{ background: "rgba(15,23,42,.5)" }}
        onClick={onClose}
      />
      <div
        ref={panou}
        role="dialog"
        aria-modal="true"
        aria-label="Navigare"
        className={cx(
          "absolute bottom-0 left-0 top-0 flex w-[280px] flex-col gap-4 p-3 pb-7 pt-[52px]",
          !c.reducedMotion && "tx-anim-dreapta"
        )}
        style={{ background: L.sidebar }}
      >
        <div className="flex items-center justify-between px-2.5">
          <Logo />
          <button
            ref={inchide}
            type="button"
            aria-label="Închide meniul"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[#e2e8f0] hover:bg-[#334155]"
          >
            <X size={18} aria-hidden />
          </button>
        </div>
        <div className="tx-scroll-dark min-h-0 flex-1 overflow-y-auto">
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
        <StatusBar tone="dark" bg={L.card} />
        <Antet laMeniu={() => setSertar(true)} />
        <div className="relative flex min-h-0 flex-1 flex-col">{children}</div>
        {josMobil}
        {sertar && <Sertar ecran={ecran} onClose={() => setSertar(false)} />}
      </div>
    );
  }

  return (
    <div className="grid h-full" style={{ gridTemplateColumns: "240px minmax(0,1fr)" }}>
      <aside className="flex min-h-0 flex-col gap-5 border-r p-3" style={{ background: L.sidebar, borderColor: L.sidebarBorder }}>
        <div className="px-2.5 pt-1">
          <Logo />
        </div>
        <div className="tx-scroll-dark min-h-0 flex-1 overflow-y-auto">
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

/** Titlul unei pagini din panou, cu acțiuni în dreapta. */
export function TitluPagina({
  titlu,
  sub,
  children,
}: {
  titlu: string;
  sub?: ReactNode;
  children?: ReactNode;
}) {
  const c = useDemo();
  return (
    <div className={cx("flex items-end justify-between gap-3", c.mobil && "flex-wrap")}>
      <div className="min-w-0">
        <h1 className="text-[18px] font-semibold tracking-tight" style={{ fontFamily: FONT.display, letterSpacing: "-0.02em" }}>
          {titlu}
        </h1>
        {sub && (
          <p className="text-[13.5px]" style={{ color: L.mutedFg }}>
            {sub}
          </p>
        )}
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
}
