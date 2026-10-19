"use client";

import dynamic from "next/dynamic";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentType,
  type CSSProperties,
  type ReactNode,
} from "react";
import { Link } from "@/i18n/navigation";
import { Mark } from "@/components/site/mark";
import { Icon } from "@/components/site/ui";
import { DEMOS, demoPoster } from "./registry";
import css from "./viewer.module.css";
import {
  DEMO_CANVAS,
  type AppDemoMeta,
  type DemoDevice,
  type DemoProps,
  type DemoTourStep,
} from "./types";

/* ============================================================
   Vizualizatorul de demo-uri (/software/proiecte/<slug>).

   Demo-ul se desenează pe o pânză fixă (1280×800 sau 390×844) și e
   scalat cu `transform` ca să încapă în scenă. Așa arată identic pe
   orice ecran: nu există breakpoint-uri în interiorul lui care să se
   poată strica. Rama (marginea de desktop sau telefonul) e a
   vizualizatorului, nu a demo-ului.

   Pagina se randează pe server cu valorile implicite (primul pas al
   turului, dispozitivul lui), cu posterul demo-ului în ramă. Parametrii
   din URL se citesc după montare:
     ?device=desktop|mobile   dispozitivul de pornire (alegere fixă)
     ?screen=<id>             ecranul de pornire
     ?capture=1               doar pânza, nescalată, fără ramă; fără
                              ?screen deschide ecranul posterului
   ============================================================ */

/** Lățimea sub care vizualizatorul pornește pe telefon (aceeași în CSS). */
const NARROW = "(max-width: 767.98px)";

/** Pixel transparent: sursa posterului când telefonul n-are captură potrivită. */
const BLANK = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

const DISCLAIMER = "Nume și cifre inventate. Unele acțiuni sunt oprite în demo.";

/**
 * Ecranul surprins în posterul unui dispozitiv
 * (public/software/proiecte/<slug>-<device>.webp).
 * Telefonul arată fața de telefon a produsului: primul pas marcat
 * `device: "mobile"` (aplicația clientului, a membrului), altfel primul
 * pas. Desktopul arată primul pas, iar dacă acela e doar de telefon,
 * primul pas care nu e. Cu ?capture=1 și fără ?screen, vizualizatorul
 * deschide exact ecranul acesta, deci scripts/demo-posters.mjs îl
 * surprinde fără hartă de ecrane.
 */
function posterScreen(meta: AppDemoMeta, device: DemoDevice) {
  const t = meta.tour;
  const step =
    device === "mobile"
      ? t.find((s) => s.device === "mobile")
      : t[0]?.device === "mobile"
        ? t.find((s) => s.device !== "mobile")
        : t[0];
  return (step ?? t[0])?.screen ?? "home";
}

/** Dispozitivul cu care se deschide pagina pe server: al primului pas. */
function initialDevice(meta: AppDemoMeta): DemoDevice {
  const d = meta.tour[0]?.device;
  return d && meta.devices.includes(d) ? d : meta.defaultDevice;
}

/**
 * Dispozitivul unui pas, cât timp vizitatorul n-a ales singur. Pe un
 * ecran de telefon rămânem pe telefon: pânza de desktop ar ieși acolo
 * de patru ori mai mică decât e.
 */
function deviceFor(meta: AppDemoMeta, step: DemoTourStep | undefined, narrow: boolean) {
  if (narrow && meta.devices.includes("mobile")) return "mobile";
  const d = step?.device;
  return d && meta.devices.includes(d) ? d : meta.defaultDevice;
}

/** Pașii consecutivi cu același `group`, sub o singură etichetă. */
function groupsOf(tour: DemoTourStep[]) {
  const out: { label?: string; steps: { step: DemoTourStep; i: number }[] }[] = [];
  tour.forEach((step, i) => {
    const last = out[out.length - 1];
    if (last && last.label === step.group) last.steps.push({ step, i });
    else out.push({ label: step.group, steps: [{ step, i }] });
  });
  return out;
}

/** „a, b și c”, ca în română: fără virgulă înainte de „și”. */
function listRo(items: string[]) {
  return items.length < 2
    ? (items[0] ?? "")
    : `${items.slice(0, -1).join(", ")} și ${items[items.length - 1]}`;
}

/* ---------------- Posterul, cât se încarcă demo-ul ---------------- */

type FrameInfo = {
  /** posterul ecranului afișat, dacă există o captură a lui */
  poster: string | null;
  /** înainte de montare, pe ecran îngust: posterul de telefon (sau null) */
  narrowPoster?: string | null;
  /** scara pânzei; 0 până la prima măsurare */
  scale: number;
};

const FrameContext = createContext<FrameInfo>({ poster: null, scale: 0 });

function Loading() {
  const { poster, narrowPoster, scale } = useContext(FrameContext);
  if (poster === null && narrowPoster === undefined) {
    return (
      <div className={css.loading}>
        <p style={{ fontSize: 13 / (scale || 1) }}>Se încarcă demo-ul…</p>
      </div>
    );
  }
  return (
    <div className={css.loading}>
      <picture>
        {narrowPoster !== undefined && <source media={NARROW} srcSet={narrowPoster ?? BLANK} />}
        {/* eslint-disable-next-line @next/next/no-img-element -- captura e deja
            WebP la mărimea potrivită (scripts/demo-posters.mjs); e prima
            imagine a paginii, deci se cere cu prioritate */}
        <img src={poster ?? BLANK} alt="" fetchPriority="high" className={css.poster} />
      </picture>
      <span className="sr-only">Se încarcă demo-ul…</span>
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
  const uid = useId();
  const tour = meta.tour;
  const firstScreen = tour[0]?.screen ?? "home";

  const [mounted, setMounted] = useState(false);
  const [capture, setCapture] = useState(false);
  const [narrow, setNarrow] = useState(false);
  /* Dispozitivul ales de vizitator (sau fixat prin ?device=). Odată
     ales, turul nu-l mai schimbă. */
  const [manual, setManual] = useState(false);
  const [device, setDevice] = useState<DemoDevice>(() => initialDevice(meta));
  const [screen, setScreen] = useState(firstScreen);
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);

  /* Parametrii din URL și lățimea ecranului se citesc după montare: pe
     server nu există nici `location`, nici lățime. Layout effect, ca
     starea de dinainte de montare să nu ajungă niciodată pe ecran la o
     navigare din client (după hidratare, o arată doar HTML-ul de pe server). */
  useLayoutEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const isNarrow = window.matchMedia(NARROW).matches;
    const qd = q.get("device");
    const fixed = (qd === "desktop" || qd === "mobile") && meta.devices.includes(qd) ? qd : null;
    const isCapture = q.has("capture");
    const qs = q.get("screen");
    const d =
      fixed ?? deviceFor(meta, meta.tour.find((t) => t.screen === (qs ?? firstScreen)), isNarrow);
    setNarrow(isNarrow);
    setManual(fixed !== null);
    setDevice(d);
    setScreen(qs ?? (isCapture ? posterScreen(meta, d) : firstScreen));
    setCapture(isCapture);
    setMounted(true);
  }, [meta, firstScreen]);

  /* Pasul curent. Dacă demo-ul a deschis un ecran care nu e în tur (o
     fișă deschisă dintr-o listă), turul rămâne pe ultimul pas vizitat. */
  const idx = tour.findIndex((t) => t.screen === screen);
  const [lastIdx, setLastIdx] = useState(0);
  useEffect(() => {
    if (idx >= 0) setLastIdx(idx);
  }, [idx]);
  const step = idx >= 0 ? idx : lastIdx;
  const current = tour[step];

  const goStep = useCallback(
    (i: number) => {
      const t = meta.tour[i];
      if (!t) return;
      setScreen(t.screen);
      if (!manual) setDevice(deviceFor(meta, t, narrow));
    },
    [meta, manual, narrow]
  );

  const pickDevice = useCallback((d: DemoDevice) => {
    setManual(true);
    setDevice(d);
  }, []);

  const notify = useCallback((text: string) => {
    setToast({ id: Date.now(), text });
  }, []);
  const closeToast = useCallback(() => setToast(null), []);

  /* Pe telefon pașii sunt un șir orizontal: pasul activ se aduce în
     vedere. Prima dată fără animație (pagina abia s-a deschis). */
  const rail = useRef<HTMLDivElement>(null);
  const railMoved = useRef(false);
  useEffect(() => {
    const el = rail.current;
    if (!el || el.scrollWidth <= el.clientWidth + 1) return;
    const chip = el.querySelector<HTMLElement>('[aria-current="step"]');
    if (!chip) return;
    const r = el.getBoundingClientRect();
    const c = chip.getBoundingClientRect();
    const pad = 16;
    let left = el.scrollLeft;
    if (c.left < r.left + pad) left += c.left - r.left - pad;
    else if (c.right > r.right - pad) left += c.right - r.right + pad;
    else return;
    el.scrollTo({ left, behavior: reducedMotion || !railMoved.current ? "auto" : "smooth" });
    railMoved.current = true;
  }, [step, mounted, reducedMotion]);

  const props: DemoProps = { device, screen, go: setScreen, notify, reducedMotion };

  const posterOf = (d: DemoDevice) =>
    screen === posterScreen(meta, d) ? demoPoster(meta.slug, d) : null;

  if (capture) {
    const c = DEMO_CANVAS[device];
    return (
      <div id="demo-capture" style={{ width: c.w, height: c.h, overflow: "hidden", position: "relative" }}>
        {/* fără poster: o captură prinsă prea devreme ar copia posterul vechi */}
        <FrameContext.Provider value={{ poster: null, scale: 1 }}>
          <Demo {...props} />
        </FrameContext.Provider>
      </div>
    );
  }

  /* Înainte de montare, pe un ecran de telefon, rama ia din CSS forma
     de telefon (JS-ul o alege oricum acolo). */
  const auto = !mounted && device === "desktop" && meta.devices.includes("mobile");

  const i = DEMOS.findIndex((d) => d.slug === meta.slug);
  const prev = DEMOS[(i - 1 + DEMOS.length) % DEMOS.length];
  const next = DEMOS[(i + 1) % DEMOS.length];
  const last = step === tour.length - 1;
  const groups = groupsOf(tour);
  const hasLines = tour.some((t) => t.line);
  const systems = meta.integrations?.length ? listRo(meta.integrations) : null;

  return (
    <div
      className="flex min-h-dvh flex-col"
      style={{ "--rail": hasLines ? "6.25rem" : "5.5rem" } as CSSProperties}
    >
      {/* ---------- bara de sus ---------- */}
      <header className="relative z-30 flex h-14 shrink-0 items-center gap-3 border-b border-hair bg-char px-4 sm:px-5 lg:sticky lg:top-0">
        <Link href="/software" className="flex shrink-0 items-center gap-2 text-bone" aria-label="MERIDIAN Software">
          <Mark size={22} />
          <span className="hidden font-md-display text-[14px] font-bold tracking-tight sm:inline">
            MERIDIAN
          </span>
        </Link>
        <span className="hidden h-5 w-px bg-hair sm:block" aria-hidden />
        <Link
          href="/software/proiecte"
          className="flex min-w-0 items-center gap-1.5 text-[13.5px] text-dim transition-colors duration-150 hover:text-bone"
        >
          <Icon name="arrowRight" size={14} className="shrink-0 rotate-180" />
          <span className="truncate">Proiecte</span>
        </Link>

        <DeviceToggle
          devices={meta.devices}
          device={device}
          onChange={pickDevice}
          className="ml-auto lg:absolute lg:left-1/2 lg:ml-0 lg:-translate-x-1/2"
        />

        <nav aria-label="Alte proiecte" className="hidden items-center gap-1 lg:ml-auto lg:flex">
          <Link
            href={`/software/proiecte/${prev.slug}`}
            className="flex size-9 items-center justify-center rounded-panel-sm border border-hair text-dim transition-colors duration-150 hover:border-hair-strong hover:text-bone"
            aria-label={`Proiectul anterior: ${prev.name}`}
            title={prev.name}
          >
            <Icon name="arrowRight" size={15} className="rotate-180" />
          </Link>
          <Link
            href={`/software/proiecte/${next.slug}`}
            className="flex size-9 items-center justify-center rounded-panel-sm border border-hair text-dim transition-colors duration-150 hover:border-hair-strong hover:text-bone"
            aria-label={`Proiectul următor: ${next.name}`}
            title={next.name}
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

      {/* Ordinea din DOM e ordinea de citire: nume, tur, demo, despre.
          Pe telefon, turul și demo-ul urcă primele (ca un player), iar
          numele și descrierea coboară sub ramă. */}
      <main
        id="continut"
        className="flex flex-1 flex-col lg:grid lg:grid-cols-[360px_minmax(0,1fr)] lg:grid-rows-[auto_auto_1fr] xl:grid-cols-[380px_minmax(0,1fr)]"
      >
        {/* ---------- numele ---------- */}
        <div className="order-3 bg-char px-5 pt-7 sm:px-6 lg:order-none lg:col-start-1 lg:row-start-1 lg:border-r lg:border-hair">
          <h1 className="display text-[clamp(1.6rem,2.4vw,1.85rem)] !leading-[1.1]">{meta.name}</h1>
          <p className="mt-1.5 text-[13px] leading-snug text-dim">
            {meta.client}
            {meta.host && (
              <>
                {" · "}
                <a
                  href={`https://${meta.host}`}
                  target="_blank"
                  rel="noopener"
                  className="inline-flex items-center gap-0.5 text-dim underline decoration-hair-strong underline-offset-[3px] transition-colors duration-150 hover:text-bone hover:decoration-current"
                >
                  {meta.host}
                  <Icon name="arrow" size={12} />
                  <span className="sr-only"> (se deschide într-o filă nouă)</span>
                </a>
              </>
            )}
          </p>
          <p className="mt-3.5 text-[15px] leading-relaxed text-bone">{meta.headline}</p>
        </div>

        {/* ---------- turul ----------
            Desktop: listă de titluri; pasul activ își arată rândul de
            explicație, dacă are. Telefon: un șir de titluri deasupra
            ramei, cu explicația și „3 din 7” dedesubt. */}
        <section
          aria-label="Tur ghidat"
          className="order-1 bg-char max-lg:border-b max-lg:border-hair lg:order-none lg:col-start-1 lg:row-start-2 lg:border-r lg:border-hair lg:px-3 lg:pt-6"
        >
          <div
            ref={rail}
            className="flex h-14 items-center gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:px-5 lg:block lg:h-auto lg:overflow-visible lg:px-0 [&::-webkit-scrollbar]:hidden"
          >
            {groups.map((g, gi) => {
              const gid = `${uid}-g${gi}`;
              return (
                <div
                  key={gi}
                  role={g.label ? "group" : undefined}
                  aria-labelledby={g.label ? gid : undefined}
                  className={`flex shrink-0 items-center gap-2 lg:block ${gi > 0 ? "max-lg:ml-2 lg:mt-4" : ""}`}
                >
                  {g.label && (
                    <span id={gid} className="shrink-0 text-[12px] text-dim lg:block lg:px-3 lg:pb-1">
                      {g.label}
                    </span>
                  )}
                  <ol className="flex gap-2 lg:block lg:space-y-0.5">
                    {g.steps.map(({ step: t, i: n }) => {
                      const on = n === step;
                      return (
                        <li key={`${t.screen}-${n}`} className="shrink-0">
                          <div
                            className={
                              on ? "rounded-panel-sm lg:bg-[color-mix(in_oklab,var(--md-fg)_5%,transparent)]" : ""
                            }
                          >
                            <button
                              type="button"
                              onClick={() => goStep(n)}
                              aria-current={on ? "step" : undefined}
                              className={`${css.step} flex h-10 items-center gap-3 whitespace-nowrap border px-3.5 text-[14px] transition-colors duration-150 lg:h-auto lg:w-full lg:items-baseline lg:whitespace-normal lg:border-0 lg:px-3 lg:py-2 lg:text-left ${
                                on
                                  ? "border-bone bg-bone font-semibold text-char lg:bg-transparent lg:text-bone"
                                  : "border-hair bg-char font-medium text-bone/80 hover:border-hair-strong hover:text-bone lg:hover:bg-[color-mix(in_oklab,var(--md-fg)_3.5%,transparent)]"
                              }`}
                            >
                              <span className="hidden w-4 shrink-0 text-right text-[12.5px] font-normal tabular-nums text-dim lg:inline">
                                {n + 1}
                              </span>
                              <span>{t.title}</span>
                            </button>
                            {on && t.line && (
                              <p className="hidden pb-2.5 pl-10 pr-3 text-[13px] leading-snug text-dim lg:block">
                                {t.line}
                              </p>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              );
            })}
            {/* telefon: capătul șirului duce la proiectul următor */}
            <Link
              href={`/software/proiecte/${next.slug}`}
              className="ml-2 flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap px-1 text-[14px] font-medium text-a1 lg:hidden"
            >
              Proiectul următor: {next.name}
              <Icon name="arrowRight" size={14} />
            </Link>
          </div>

          <p
            className={`line-clamp-2 px-4 text-[13px] leading-[18px] sm:px-5 lg:hidden ${hasLines ? "h-11" : "h-8"}`}
          >
            <span className="tabular-nums text-bone/75">
              {step + 1} din {tour.length}
            </span>
            {current?.line && <span className="text-dim"> · {current.line}</span>}
          </p>

          <div className="mt-3 hidden gap-2 pb-1 lg:flex">
            <button
              type="button"
              disabled={step <= 0}
              onClick={() => goStep(step - 1)}
              aria-label="Pasul anterior"
              title="Pasul anterior"
              className="btn btn-ghost !min-h-9 !w-9 shrink-0 !rounded-panel-sm !p-0 disabled:pointer-events-none disabled:opacity-40"
            >
              <Icon name="arrowRight" size={15} className="rotate-180" />
            </button>
            {last ? (
              <Link
                href={`/software/proiecte/${next.slug}`}
                className="btn btn-primary !min-h-9 min-w-0 flex-1 !rounded-panel-sm !px-3.5 !py-1.5 !text-[13px]"
              >
                <span className="truncate">Proiectul următor: {next.name}</span>
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => goStep(step + 1)}
                className="btn btn-primary !min-h-9 flex-1 !rounded-panel-sm !py-1.5 !text-[13px]"
              >
                Pasul următor
                <Icon name="arrowRight" size={14} />
              </button>
            )}
          </div>
        </section>

        {/* ---------- scena ---------- */}
        <div className={`${css.stage} order-2 lg:order-none lg:col-start-2 lg:row-span-3 lg:row-start-1`}>
          <Stage
            device={device}
            auto={auto}
            poster={posterOf(device)}
            narrowPoster={
              auto ? (firstScreen === posterScreen(meta, "mobile") ? demoPoster(meta.slug, "mobile") : null) : undefined
            }
          >
            <Demo {...props} />
          </Stage>

          <div className="pointer-events-none absolute inset-x-0 bottom-5 z-30 flex justify-center px-4">
            <div aria-live="polite" aria-atomic="true" className="sr-only">
              {toast && <p key={toast.id}>{toast.text}</p>}
            </div>
            {toast && <Toast key={toast.id} text={toast.text} onClose={closeToast} />}
          </div>
        </div>

        {/* ---------- despre ---------- */}
        <section
          aria-labelledby={`${uid}-despre`}
          className="order-4 flex flex-col bg-char px-5 pb-8 pt-7 sm:px-6 lg:order-none lg:col-start-1 lg:row-start-3 lg:border-r lg:border-hair lg:pb-6 lg:pt-9"
        >
          <h2 id={`${uid}-despre`} className="text-[14px] font-semibold">
            Despre proiect
          </h2>
          <p className="mt-2 text-[14px] leading-relaxed text-bone/85">{meta.summary}</p>
          {systems && (
            <p className="mt-3 text-[14px] leading-relaxed text-bone/85">Conectată cu {systems}.</p>
          )}
          <p className="mt-auto pt-8 text-[12.5px] leading-snug text-dim">
            {meta.disclaimer ?? DISCLAIMER}
          </p>

          <div className="lg:hidden">
            <Link href="/software#configurator" className="btn btn-primary mt-5 w-full !rounded-panel-sm">
              Vreau o aplicație ca asta
            </Link>
            <nav aria-label="Alte proiecte" className="mt-3 flex gap-2">
              <Link
                href={`/software/proiecte/${prev.slug}`}
                className="btn btn-ghost min-w-0 flex-1 !rounded-panel-sm !px-3 !text-[13px]"
              >
                <Icon name="arrowRight" size={14} className="shrink-0 rotate-180" />
                <span className="truncate">{prev.name}</span>
              </Link>
              <Link
                href={`/software/proiecte/${next.slug}`}
                className="btn btn-ghost min-w-0 flex-1 !rounded-panel-sm !px-3 !text-[13px]"
              >
                <span className="truncate">{next.name}</span>
                <Icon name="arrowRight" size={14} className="shrink-0" />
              </Link>
            </nav>
          </div>
        </section>
      </main>
    </div>
  );
}

/* ---------------- Toast-ul ----------------
   Pentru acțiunile oprite în demo. Stă cât să poată fi citit (60ms pe
   caracter, minimum 4s), se oprește cât e sub mouse sau în focus și se
   poate închide. Textul vizibil e aria-hidden: îl anunță regiunea
   aria-live de alături, o singură dată. */
function Toast({ text, onClose }: { text: string; onClose: () => void }) {
  const [paused, setPaused] = useState(false);
  const left = useRef(Math.max(4000, text.length * 60));
  useEffect(() => {
    if (paused) return;
    const start = Date.now();
    const t = window.setTimeout(onClose, left.current);
    return () => {
      window.clearTimeout(t);
      left.current = Math.max(0, left.current - (Date.now() - start));
    };
  }, [paused, onClose]);

  return (
    <div
      className={`${css.toast} pointer-events-auto flex max-w-md items-start gap-2 rounded-panel bg-bone py-2 pl-4 pr-1.5 text-char shadow-[0_1px_2px_rgb(18_23_27/0.12),0_10px_28px_-14px_rgb(18_23_27/0.45)]`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setPaused(false);
      }}
    >
      <p aria-hidden className="py-1 text-[13.5px] leading-snug">
        {text}
      </p>
      <button
        type="button"
        onClick={onClose}
        aria-label="Închide mesajul"
        className="flex size-7 shrink-0 items-center justify-center rounded-panel-sm text-char/70 transition-colors duration-150 hover:bg-char/10 hover:text-char"
      >
        <Icon name="plus" size={16} className="rotate-45" />
      </button>
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
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors duration-150 sm:px-3.5 ${
              on ? "bg-bone text-char" : "text-dim hover:text-bone"
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

/* ---------------- Scena: rama + scalarea ----------------
   Rama își ia mărimea din CSS (vezi viewer.module.css), deci există
   din primul HTML. Aici se măsoară doar ecranul ramei, ca pânza fixă a
   demo-ului să fie scalată exact pe el. */
function Stage({
  device,
  auto,
  poster,
  narrowPoster,
  children,
}: {
  device: DemoDevice;
  auto: boolean;
  poster: string | null;
  narrowPoster?: string | null;
  children: ReactNode;
}) {
  const screenRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);

  useLayoutEffect(() => {
    const el = screenRef.current;
    if (!el) return;
    const w = DEMO_CANVAS[device].w;
    const measure = () => {
      const box = el.getBoundingClientRect().width;
      if (box > 0) setScale(box / w);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [device]);

  const c = DEMO_CANVAS[device];
  const canvas: CSSProperties =
    scale > 0
      ? { width: c.w, height: c.h, transform: `scale(${scale})`, transformOrigin: "0 0" }
      : { width: "100%", height: "100%" };

  return (
    <div className={css.fit}>
      <div className={css.frame} data-device={device} data-auto={auto ? "" : undefined}>
        <div ref={screenRef} className={css.screen}>
          <FrameContext.Provider value={{ poster, narrowPoster, scale }}>
            <div className={css.canvas} style={canvas}>
              {children}
            </div>
          </FrameContext.Provider>
          <span aria-hidden className={css.island} />
          <span aria-hidden className={css.home} />
        </div>
      </div>
    </div>
  );
}
