"use client";

import dynamic from "next/dynamic";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentType,
} from "react";
import { Link } from "@/i18n/navigation";
import { Mark } from "@/components/site/mark";
import { Icon } from "@/components/site/ui";
import { DEMOS } from "./registry";
import css from "./viewer.module.css";
import {
  DEMO_CANVAS,
  type AppDemoMeta,
  type DemoDevice,
  type DemoProps,
} from "./types";

/* ============================================================
   Vizualizatorul de demo-uri (/software/proiecte/<slug>).

   Demo-ul se desenează pe o pânză fixă (1280×800 sau 390×844) și e
   scalat cu `transform` ca să încapă în scenă. Așa arată identic pe
   orice ecran: nu există breakpoint-uri în interiorul lui care să se
   poată strica. Rama — fereastra de browser sau telefonul — e a
   vizualizatorului, nu a demo-ului.

   Parametri în URL (pentru link direct și pentru capturi):
     ?device=desktop|mobile   dispozitivul de pornire
     ?screen=<id>             ecranul de pornire
     ?capture=1               doar pânza, nescalată, fără ramă
   ============================================================ */

function Loading() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-neutral-100 text-[13px] text-neutral-500">
      Se încarcă demo-ul…
    </div>
  );
}

/* next/dynamic cere opțiunile scrise literal la fiecare apel. */
const COMPONENTS: Record<string, ComponentType<DemoProps>> = {
  prosperanta: dynamic(() => import("./prosperanta/demo"), { ssr: false, loading: Loading }),
  tablex: dynamic(() => import("./tablex/demo"), { ssr: false, loading: Loading }),
  zof: dynamic(() => import("./zof/demo"), { ssr: false, loading: Loading }),
  elyssium: dynamic(() => import("./elyssium/demo"), { ssr: false, loading: Loading }),
  "art-install": dynamic(() => import("./art-install/demo"), { ssr: false, loading: Loading }),
};

/* Rama: înălțimea barei de browser și grosimea ramei telefonului. */
const BROWSER_BAR = 40;
const BEZEL = 12;

function frameSize(device: DemoDevice) {
  const c = DEMO_CANVAS[device];
  return device === "desktop"
    ? { w: c.w, h: c.h + BROWSER_BAR }
    : { w: c.w + BEZEL * 2, h: c.h + BEZEL * 2 };
}

function useReducedMotion() {
  const [r, setR] = useState(false);
  useEffect(() => {
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    setR(m.matches);
    const on = () => setR(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return r;
}

export function DemoViewer({ meta }: { meta: AppDemoMeta }) {
  const Demo = COMPONENTS[meta.slug];
  const reducedMotion = useReducedMotion();
  const [ready, setReady] = useState(false);
  const [capture, setCapture] = useState(false);
  const [device, setDevice] = useState<DemoDevice>(meta.defaultDevice);
  const [screen, setScreen] = useState(meta.tour[0]?.screen ?? "home");
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);

  /* Parametrii din URL și dispozitivul potrivit ecranului se citesc după
     montare: pe server nu există nici `location`, nici lățime. */
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const d = q.get("device");
    if (d === "desktop" || d === "mobile") setDevice(d);
    else if (window.innerWidth < 768 && meta.devices.includes("mobile"))
      setDevice("mobile");
    const s = q.get("screen");
    if (s) setScreen(s);
    setCapture(q.has("capture"));
    setReady(true);
  }, [meta.devices]);

  const notify = useCallback((text: string) => {
    setToast({ id: Date.now(), text });
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3600);
    return () => window.clearTimeout(t);
  }, [toast]);

  if (!ready) return <div className="min-h-dvh bg-ink" />;

  const props: DemoProps = { device, screen, go: setScreen, notify, reducedMotion };

  if (capture) {
    const c = DEMO_CANVAS[device];
    return (
      <div id="demo-capture" style={{ width: c.w, height: c.h, overflow: "hidden", position: "relative" }}>
        <Demo {...props} />
      </div>
    );
  }

  const idx = DEMOS.findIndex((d) => d.slug === meta.slug);
  const prev = DEMOS[(idx - 1 + DEMOS.length) % DEMOS.length];
  const next = DEMOS[(idx + 1) % DEMOS.length];
  const step = meta.tour.findIndex((t) => t.screen === screen);

  return (
    <div className="flex min-h-dvh flex-col lg:h-dvh">
      {/* ---------- bara de sus ---------- */}
      <header className="relative z-20 flex h-14 shrink-0 items-center gap-3 border-b border-hair bg-ink/90 px-4 backdrop-blur-xl sm:px-5">
        <Link href="/software" className="flex shrink-0 items-center gap-2 text-bone" aria-label="MERIDIAN Software">
          <Mark size={22} />
          <span className="hidden font-md-display text-[14px] font-bold tracking-tight sm:inline">
            MERIDIAN
          </span>
        </Link>
        <span className="hidden h-5 w-px bg-hair sm:block" aria-hidden />
        <Link
          href="/software/proiecte"
          className="flex min-w-0 items-center gap-1.5 text-[13.5px] text-dim transition-colors hover:text-bone"
        >
          <Icon name="arrowRight" size={14} className="shrink-0 rotate-180" />
          <span className="truncate">Proiecte</span>
        </Link>

        <DeviceToggle
          devices={meta.devices}
          device={device}
          onChange={setDevice}
          className="ml-auto lg:absolute lg:left-1/2 lg:ml-0 lg:-translate-x-1/2"
        />

        <nav aria-label="Alte proiecte" className="hidden items-center gap-1 lg:ml-auto lg:flex">
          <Link
            href={`/software/proiecte/${prev.slug}`}
            className="flex size-9 items-center justify-center rounded-panel-sm border border-hair text-dim transition-colors hover:text-bone"
            aria-label={`Proiectul anterior: ${prev.name}`}
          >
            <Icon name="arrowRight" size={15} className="rotate-180" />
          </Link>
          <Link
            href={`/software/proiecte/${next.slug}`}
            className="flex size-9 items-center justify-center rounded-panel-sm border border-hair text-dim transition-colors hover:text-bone"
            aria-label={`Proiectul următor: ${next.name}`}
          >
            <Icon name="arrowRight" size={15} />
          </Link>
          <Link
            href="/software#configurator"
            className="btn btn-primary ml-2 !min-h-9 !rounded-panel-sm !px-4 !py-1.5 !text-[13px]"
          >
            Vreau o aplicație ca asta
          </Link>
        </nav>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* ---------- scena ---------- */}
        <main
          id="continut"
          className="relative order-1 flex min-h-[72dvh] flex-1 flex-col lg:order-2 lg:min-h-0"
        >
          <h1 className="sr-only">
            {meta.name} — demo interactiv
          </h1>
          <Stage device={device} meta={meta}>
            <Demo {...props} />
          </Stage>

          <div
            aria-live="polite"
            className="pointer-events-none absolute inset-x-0 bottom-5 z-30 flex justify-center px-4"
          >
            {toast && (
              <p
                key={toast.id}
                className={`${css.toast} max-w-md rounded-panel border border-hair bg-char px-4 py-3 text-[13.5px] leading-snug text-bone shadow-[0_20px_60px_-20px_rgba(0,0,0,0.45)]`}
              >
                {toast.text}
              </p>
            )}
          </div>
        </main>

        {/* ---------- bara laterală: ce e, turul ghidat ---------- */}
        <aside className="order-2 flex shrink-0 flex-col border-hair bg-char/60 lg:order-1 lg:w-[360px] lg:overflow-y-auto lg:border-r xl:w-[380px]">
          <div className="px-5 pt-6 sm:px-6 lg:pt-7">
            <p className="font-md-mono text-[11px] uppercase tracking-[0.16em] text-dim">
              {meta.kind}
            </p>
            <p className="display mt-2 text-[clamp(1.6rem,3vw,2rem)] leading-tight">{meta.name}</p>
            <p className="mt-1 text-[13.5px] text-dim">{meta.client}</p>
            <p className="mt-4 text-[15.5px] leading-relaxed text-bone">{meta.headline}</p>
          </div>

          <section aria-labelledby="tur" className="px-5 pt-6 sm:px-6">
            <div className="flex items-baseline justify-between">
              <h2 id="tur" className="eyebrow">
                Tur ghidat
              </h2>
              <span className="font-md-mono text-[11px] text-dim">
                {step >= 0 ? step + 1 : "–"} / {meta.tour.length}
              </span>
            </div>
            <ol className="-mx-5 mt-3 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] sm:-mx-6 sm:px-6 lg:mx-0 lg:flex-col lg:gap-1 lg:overflow-visible lg:px-0">
              {meta.tour.map((t, i) => {
                const on = t.screen === screen;
                return (
                  <li key={`${t.screen}-${i}`} className="shrink-0 lg:shrink">
                    <button
                      type="button"
                      onClick={() => setScreen(t.screen)}
                      aria-current={on ? "step" : undefined}
                      className={`flex w-[230px] items-start gap-3 rounded-panel-sm border px-3 py-2.5 text-left transition-colors duration-200 lg:w-full ${
                        on
                          ? "border-a1/40 bg-a1/[0.07]"
                          : "border-hair hover:border-hair-strong lg:border-transparent"
                      }`}
                    >
                      <span
                        className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full font-md-mono text-[11px] ${
                          on ? "bg-a1 text-on-a1" : "border border-hair text-dim"
                        }`}
                      >
                        {i + 1}
                      </span>
                      <span className="min-w-0">
                        <span className={`block text-[14.5px] font-medium ${on ? "text-bone" : "text-bone/85"}`}>
                          {t.title}
                        </span>
                        <span className="mt-0.5 block text-[13px] leading-snug text-dim">{t.line}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                className="btn btn-ghost !min-h-9 flex-1 !rounded-panel-sm !py-1.5 !text-[13px]"
                onClick={() => {
                  const i = step <= 0 ? meta.tour.length - 1 : step - 1;
                  setScreen(meta.tour[i].screen);
                }}
              >
                <Icon name="arrowRight" size={14} className="rotate-180" />
                Înapoi
              </button>
              <button
                type="button"
                className="btn btn-primary !min-h-9 flex-1 !rounded-panel-sm !py-1.5 !text-[13px]"
                onClick={() => setScreen(meta.tour[(step + 1) % meta.tour.length].screen)}
              >
                Pasul următor
                <Icon name="arrowRight" size={14} />
              </button>
            </div>
          </section>

          <section aria-labelledby="despre" className="px-5 pt-8 sm:px-6">
            <h2 id="despre" className="eyebrow">
              Despre proiect
            </h2>
            <p className="mt-3 text-[14.5px] leading-relaxed text-dim">{meta.summary}</p>
            <ul className="mt-4 space-y-2">
              {meta.features.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-[14px] text-bone">
                  <Icon name="check" size={15} className="mt-0.5 shrink-0 text-a1" />
                  {f}
                </li>
              ))}
            </ul>
            {meta.integrations && meta.integrations.length > 0 && (
              <>
                <p className="mt-5 font-md-mono text-[11px] uppercase tracking-[0.16em] text-dim">
                  Conectată cu
                </p>
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {meta.integrations.map((n) => (
                    <li key={n} className="rounded-panel-sm border border-hair px-2.5 py-1 text-[12.5px] text-dim">
                      {n}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>

          <div className="mt-auto px-5 pb-6 pt-8 sm:px-6">
            <p className="rounded-panel-sm border border-dashed border-hair px-3 py-2.5 text-[12.5px] leading-snug text-dim">
              Date demonstrative: numele, cifrele și tranzacțiile din demo sunt inventate.
              Unele acțiuni sunt oprite intenționat.
            </p>
            <Link
              href="/software#configurator"
              className="btn btn-primary mt-4 w-full !rounded-panel-sm lg:hidden"
            >
              Vreau o aplicație ca asta
            </Link>
            <nav aria-label="Alte proiecte" className="mt-4 flex gap-2 lg:hidden">
              <Link
                href={`/software/proiecte/${prev.slug}`}
                className="btn btn-ghost min-w-0 flex-1 !rounded-panel-sm !px-3 !text-[13px]"
              >
                <Icon name="arrowRight" size={14} className="rotate-180" />
                <span className="truncate">{prev.name}</span>
              </Link>
              <Link
                href={`/software/proiecte/${next.slug}`}
                className="btn btn-ghost min-w-0 flex-1 !rounded-panel-sm !px-3 !text-[13px]"
              >
                <span className="truncate">{next.name}</span>
                <Icon name="arrowRight" size={14} />
              </Link>
            </nav>
          </div>
        </aside>
      </div>
    </div>
  );
}

/* ---------------- Comutatorul de dispozitiv ---------------- */
function DeviceToggle({
  devices,
  device,
  onChange,
  className = "",
}: {
  devices: DemoDevice[];
  device: DemoDevice;
  onChange: (d: DemoDevice) => void;
  className?: string;
}) {
  if (devices.length < 2) return null;
  const label: Record<DemoDevice, string> = { desktop: "Desktop", mobile: "Telefon" };
  return (
    <div
      role="group"
      aria-label="Dispozitiv"
      className={`flex shrink-0 rounded-full border border-hair bg-char p-1 ${className}`}
    >
      {devices.map((d) => {
        const on = d === device;
        return (
          <button
            key={d}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(d)}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors duration-200 sm:px-3.5 ${
              on ? "bg-bone text-ink" : "text-dim hover:text-bone"
            }`}
          >
            <DeviceGlyph device={d} />
            {label[d]}
          </button>
        );
      })}
    </div>
  );
}

function DeviceGlyph({ device }: { device: DemoDevice }) {
  return device === "desktop" ? (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <rect x="1.5" y="2.5" width="13" height="9" rx="1.5" />
      <path d="M5.5 14h5M8 11.5V14" strokeLinecap="round" />
    </svg>
  ) : (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <rect x="4" y="1.5" width="8" height="13" rx="2" />
      <path d="M7 12.5h2" strokeLinecap="round" />
    </svg>
  );
}

/* ---------------- Scena: rama + scalarea ---------------- */
function Stage({
  device,
  meta,
  children,
}: {
  device: DemoDevice;
  meta: AppDemoMeta;
  children: React.ReactNode;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [avail, setAvail] = useState({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => setAvail({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const f = frameSize(device);
  /* Pe telefon (lățime mică) contează lățimea; pe desktop, amândouă.
     Nu mărim peste 1: pânza de 1280 e deja la mărimea ei reală. */
  const s = avail.w ? Math.min(avail.w / f.w, avail.h / f.h, 1) : 0;

  return (
    <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-bone/[0.035] p-4 sm:p-6 lg:p-8">
      {/* grila are mască proprie; pe un strat separat, ca să nu estompeze și rama */}
      <div className="techgrid pointer-events-none absolute inset-0" aria-hidden />
      <div ref={box} className="absolute inset-4 sm:inset-6 lg:inset-8" aria-hidden />
      {s > 0 && (
        <div style={{ width: f.w * s, height: f.h * s }} className="relative">
          <div
            style={{
              width: f.w,
              height: f.h,
              transform: `scale(${s})`,
              transformOrigin: "top left",
            }}
            className="absolute left-0 top-0"
          >
            {device === "desktop" ? (
              <BrowserFrame host={meta.host}>{children}</BrowserFrame>
            ) : (
              <PhoneFrame>{children}</PhoneFrame>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function BrowserFrame({ host, children }: { host: string; children: React.ReactNode }) {
  const c = DEMO_CANVAS.desktop;
  return (
    <div className="overflow-hidden rounded-[14px] border border-black/10 bg-white shadow-[0_50px_140px_-40px_rgba(15,20,25,0.55),0_0_0_1px_rgba(0,0,0,0.04)]">
      <div
        className="flex items-center gap-3 border-b border-black/[0.07] bg-[#f3f4f4] px-4"
        style={{ height: BROWSER_BAR }}
      >
        <span className="flex gap-1.5" aria-hidden>
          <span className="size-3 rounded-full bg-[#ff5f57]" />
          <span className="size-3 rounded-full bg-[#febc2e]" />
          <span className="size-3 rounded-full bg-[#28c840]" />
        </span>
        <span className="mx-auto flex h-7 w-[440px] items-center justify-center gap-1.5 rounded-lg bg-white text-[13px] text-neutral-500 ring-1 ring-black/[0.06]">
          <svg width="11" height="11" viewBox="0 0 12 12" fill="currentColor" aria-hidden>
            <path d="M3.5 5V3.8a2.5 2.5 0 0 1 5 0V5h.5a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h.5Zm1 0h3V3.8a1.5 1.5 0 0 0-3 0V5Z" />
          </svg>
          {host}
        </span>
        <span className="w-[54px]" aria-hidden />
      </div>
      <div style={{ width: c.w, height: c.h, position: "relative", overflow: "hidden" }}>{children}</div>
    </div>
  );
}

function PhoneFrame({ children }: { children: React.ReactNode }) {
  const c = DEMO_CANVAS.mobile;
  return (
    <div
      className="relative rounded-[60px] bg-[#0c0d0f] shadow-[0_50px_120px_-30px_rgba(15,20,25,0.6),inset_0_0_0_2px_#2a2c30]"
      style={{ padding: BEZEL }}
    >
      <div
        style={{ width: c.w, height: c.h, position: "relative", overflow: "hidden" }}
        className="rounded-[48px] bg-white"
      >
        {children}
        {/* insula dinamică și indicatorul home: ale ramei, peste demo */}
        <span
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-[11px] z-50 h-[34px] w-[122px] -translate-x-1/2 rounded-full bg-black"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute bottom-[8px] left-1/2 z-50 h-[5px] w-[134px] -translate-x-1/2 rounded-full bg-neutral-500/60"
        />
      </div>
    </div>
  );
}
