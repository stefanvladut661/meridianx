"use client";

import { useEffect, useRef, useState } from "react";
import { Link } from "@/i18n/navigation";
import { Mark } from "@/components/site/mark";
import { LEGAL_LINKS } from "@/components/site/legal-links";
import { MeridianSoftware, MeridianVideo } from "@/components/site/meridian";
import { Reveal, useReducedMotion } from "@/components/site/motion";
import { ObfuscatedEmail } from "@/components/site/obfuscated-email";
import { Icon } from "@/components/site/ui";
import { CONTACT } from "@/components/site/video-content";
import { SCONTACT } from "@/components/site/software-content";
import { FEATURED } from "@/components/site/portfolio-content";
import { useWorldWipe } from "@/components/gateway/world-wipe";
import s from "./gateway.module.css";

/* ============================================================
   POARTA — pagina intermediară, rădăcina site-ului. „Ecranele”.

   Singura pagină în care cele două lumi apar împreună. Regula din
   CLAUDE.md §2 rămâne: nu se amestecă. Aici se ating, atât.

   Teza: poarta arată rezultatul pe care îl cumperi, la scara la care
   trăiește. Clientul de video cumpără ce apare pe telefonul clienților
   lui — deci stânga e o cameră întunecată cu trei reel-uri reale, din
   portofoliu. Clientul de software cumpără un instrument pe care echipa
   îl deschide dimineața — deci dreapta e o foaie de hârtie așezată pe
   masă, cu aplicația pe ea.

   Nu e un split 50/50 cu două jumătăți simetrice (asta era versiunea
   dinainte, și așa arată orice agenție cu două divizii): e un spațiu
   și un obiect în el. Lumile rămân distincte prin material — negru
   luminat vs. hârtie — și prin propriul [data-scope], deci propria
   paletă, propriile raze de colț și propriul temperament.

   Firul comun e arcul de meridian: un singur cerc, centrat exact pe
   cusătură — lumină care circulă în cameră, geodezică desenată pe
   foaie. Același obiect, două temperamente.

   Amândouă obiectele se mișcă singure, fiecare în ritmul lumii lui
   (CLAUDE.md §2): reel-urile își dau play pe rând, câte trei secunde,
   fără sunet — lumina se plimbă prin cameră; fereastra de aplicație își
   schimbă ecranul la fiecare 2,6s, cu treceri sub 400ms. Niciunul nu e
   un player: sunt teasere, nu se pot apăsa separat. Clicul aparține
   lumii, oriunde ai da în ea.

   Decizia trebuie luată în trei secunde, deci nu există nimic de citit
   înainte de alegere. Argumentele stau sub fold, pentru cine ezită.
   ============================================================ */

export function GatewayScreen() {
  const { go, overlay } = useWorldWipe();

  return (
    <div data-scope="gate" className="md-root min-h-dvh overflow-clip">
      <TopBar />

      <main id="continut">
        {/* Poarta n-are titlu vizibil, și e intenționat: un titlu deasupra
            celor două lumi ar întârzia exact decizia pe care pagina o
            cere în trei secunde. Titlul rămâne doar pentru cititoarele
            de ecran și pentru roboți — același text ca <title>-ul
            paginii (page.tsx). */}
        <h1 className="sr-only">MERIDIAN — Video &amp; Software</h1>

        <section className={s.gate} aria-label="Alege divizia">
          <VideoRoom go={go} />
          <SoftwareSheet go={go} />

          {/* Clientul de video decide repede și preferă vocea (CLAUDE.md
              §8): telefonul și WhatsApp-ul stau chiar pe primul ecran,
              nu sub „alte metode de contact”. */}
          <p className={s.foot}>
            Nu știi în ce parte s-o iei?{" "}
            <a href={CONTACT.phoneHref}>Sună · {CONTACT.phone}</a>
            <span aria-hidden> / </span>
            <a
              href={CONTACT.whatsapp}
              target="_blank"
              rel="noopener noreferrer"
            >
              WhatsApp
            </a>
          </p>
        </section>

        <Band />
      </main>

      <Foot />
      {overlay}
    </div>
  );
}

type Go = ReturnType<typeof useWorldWipe>["go"];

/* ============================================================
   Motorul comun al celor două teasere.

   Un singur index care se rotește, pornit doar cât timp obiectul e pe
   ecran și fila e în față. Ce înseamnă indexul — un clip care pleacă,
   un ecran de aplicație care se schimbă — e treaba fiecărei lumi.

   Sub prefers-reduced-motion nu pornește deloc: indexul rămâne −1, iar
   amândouă obiectele rămân în starea lor de repaus, care e completă și
   are sens singură (CLAUDE.md §7).
   ============================================================ */
function useCycle(count: number, ms: number, on: boolean) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [i, setI] = useState(-1);

  useEffect(() => {
    const el = ref.current;
    if (!on || count < 1 || !el) return;

    let timer: ReturnType<typeof setInterval> | undefined;
    let inView = false;

    const stop = () => {
      if (timer) clearInterval(timer);
      timer = undefined;
    };
    /* Ieșit din ecran se întoarce la repaus, nu rămâne înghețat pe
       cadrul la care a apucat. La revenire pornește curat, de la capăt. */
    const reset = () => {
      stop();
      setI(-1);
    };
    const start = () => {
      if (timer || !inView || document.hidden) return;
      setI((n) => (n < 0 ? 0 : n));
      timer = setInterval(() => setI((n) => (n + 1) % count), ms);
    };

    const io = new IntersectionObserver(
      (entries) => {
        inView = entries[0]?.isIntersecting ?? false;
        if (inView) start();
        else reset();
      },
      { threshold: 0.25 }
    );
    io.observe(el);

    const onVis = () => (document.hidden ? reset() : start());
    document.addEventListener("visibilitychange", onVis);

    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      stop();
    };
  }, [count, ms, on]);

  return [ref, i] as const;
}

/**
 * Armarea teaserului video. Trei fișiere .mp4 n-au ce căuta în
 * competiție cu LCP-ul rădăcinii, deci nu se atinge nimic din rețea
 * până când pagina nu s-a încărcat de tot (CLAUDE.md §7). Pe conexiuni
 * măsurate sau foarte lente nu se armează deloc: posterele spun deja
 * povestea, și o spun gratis.
 */
function useArmed() {
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;

    const arm = () => {
      const net = (
        navigator as Navigator & {
          connection?: { saveData?: boolean; effectiveType?: string };
        }
      ).connection;
      if (net?.saveData || (net?.effectiveType ?? "").includes("2g")) return;
      t = setTimeout(() => setArmed(true), 400);
    };

    if (document.readyState === "complete") arm();
    else window.addEventListener("load", arm, { once: true });

    return () => {
      if (t) clearTimeout(t);
      window.removeEventListener("load", arm);
    };
  }, []);

  return armed;
}

/* ---------------- Bara de sus ---------------- */
function TopBar() {
  return (
    <header className="absolute inset-x-0 top-0 z-30">
      <div className="mx-auto flex h-16 max-w-[1500px] items-center gap-4 px-5 sm:px-8">
        <Link href="/" className="flex items-center gap-2.5 text-bone">
          <Mark size={24} />
          <span className="font-md-display text-[15px] font-semibold tracking-[0.2em]">
            MERIDIAN
          </span>
        </Link>

        <span className="ml-auto hidden items-center gap-6 md:flex">
          <span className="font-md-mono text-[11px] uppercase tracking-[0.18em] text-dim">
            Video &amp; Software
          </span>
          <a
            href={CONTACT.phoneHref}
            className="flex items-center gap-2 text-[13.5px] text-dim transition-colors hover:text-bone"
          >
            <Icon name="phone" size={15} />
            {CONTACT.phone}
          </a>
        </span>

        <a
          href="#amandoua"
          className="btn btn-ghost ml-auto !min-h-9 !px-4 !py-2 !text-[12.5px] md:ml-0"
        >
          Nu știu ce îmi trebuie
        </a>
      </div>
    </header>
  );
}

/* ---------------- Camera: VIDEO ---------------- */

/* Trei materiale de prima pagină, în ordinea din manifest — clipuri
   reale, livrate. Dacă se schimbă portofoliul, se schimbă și poarta:
   e intenționat, poarta e o dovadă, nu un decor. */
const REELS = FEATURED.slice(0, 3);
const TEASER_MS = 3000;

function VideoRoom({ go }: { go: Go }) {
  return (
    <Link
      href="/video"
      data-scope="video"
      className={s.room}
      onClick={(e) => go(e, "video", "/video")}
    >
      <span aria-hidden className={s.aurora} />
      <span aria-hidden className={`grain ${s.grain}`} />
      <span aria-hidden className={s.ringLeft}>
        <MeridianVideo className={s.ring} />
      </span>

      <div className={s.roomInner}>
        <div className={s.text}>
          <Reveal>
            <h2 className={`display ${s.title}`}>VIDEO</h2>
          </Reveal>
          <Reveal delay={70}>
            <p className={s.lead}>Clipuri care aduc clienți, nu vizualizări.</p>
          </Reveal>
          <Reveal delay={140}>
            <p className={s.body}>
              Filmăm, montăm, publicăm și urmărim ce aduce fiecare clip — pe
              Meta, TikTok și Google, lună după lună.
            </p>
          </Reveal>
          <Reveal delay={210}>
            <span className={`btn btn-primary ${s.btn}`}>
              Intră în video
              <Icon name="arrowRight" size={17} className="arw" />
            </span>
          </Reveal>
        </div>

        <ReelFan />
      </div>
    </Link>
  );
}

/**
 * Evantaiul de reel-uri. Cele trei clipuri pornesc pe rând, de la stânga
 * la dreapta, câte trei secunde, fără sunet. Cel care rulează crește
 * puțin și trece peste celelalte — nu se bat pe același plan, pentru că
 * primește și cel mai mare z-index cât ține tura lui.
 *
 * Nu sunt playere: n-au controale, nu primesc focus și nu se pot apăsa
 * separat. Clicul aparține camerei întregi, care duce în divizie. Cine
 * vrea un material cap-coadă îl găsește în portofoliu.
 *
 * Rețeaua: `preload="none"` peste tot, iar clipul următor trece pe
 * „auto” abia când pornește cel dinaintea lui — se descarcă doar ce
 * chiar se vede, cu trei secunde de avans.
 */
function ReelFan() {
  const reduced = useReducedMotion();
  const armed = useArmed();
  const [rolling, setRolling] = useState(false);
  const [fanRef, live] = useCycle(REELS.length, TEASER_MS, rolling);
  const vids = useRef<Array<HTMLVideoElement | null>>([]);

  /* Primul clip pornește cu o secundă după ce apar elementele <video>,
     nu odată cu ele: altfel tura lui s-ar duce pe încărcare, iar omul ar
     vedea trei secunde de poster. Cât se încarcă, restul dorm. */
  useEffect(() => {
    if (!armed || reduced) return;
    const first = vids.current[0];
    if (first) first.preload = "auto";
    const t = setTimeout(() => setRolling(true), 900);
    return () => clearTimeout(t);
  }, [armed, reduced]);

  useEffect(() => {
    if (live < 0) return;
    const cur = vids.current[live];
    const next = vids.current[(live + 1) % REELS.length];
    if (next && next.preload !== "auto") next.preload = "auto";
    if (!cur) return;
    // `muted` și din JS, nu doar din JSX: fără el, autoplay-ul e refuzat
    // pe iOS, iar CLAUDE.md §7 e categoric — niciun clip nu pornește cu sunet.
    cur.muted = true;
    cur.currentTime = 0;
    void cur.play().catch(() => {});
    return () => {
      cur.pause();
    };
  }, [live]);

  return (
    <Reveal variant="scale" delay={120} className={s.fanWrap}>
      <div
        ref={fanRef}
        className={s.fan}
        data-playing={live >= 0 ? "" : undefined}
      >
        {REELS.map((r, i) => (
          <figure
            key={r.slug}
            className={s.reel}
            data-live={i === live ? "" : undefined}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- poster deja
                dimensionat și convertit în WebP de scripts/portfolio-build.mjs,
                ca peste tot în site. */}
            <img
              src={r.poster}
              alt={`${r.title} — ${r.client}`}
              width={r.w}
              height={r.h}
              /* Reel-ul din mijloc e cel mai mare element pictat pe
                 poartă, deci candidatul LCP: pleacă primul. */
              loading={i === 1 ? "eager" : "lazy"}
              fetchPriority={i === 1 ? "high" : "auto"}
              decoding="async"
            />
            {armed && !reduced && (
              <video
                ref={(el) => {
                  vids.current[i] = el;
                }}
                className={s.reelVid}
                src={r.src}
                poster={r.poster}
                muted
                playsInline
                preload="none"
                disablePictureInPicture
                aria-hidden
                tabIndex={-1}
              />
            )}
            {/* Cât timp nu rulează nimic — primul cadru, reduced motion,
                conexiune măsurată — cardul din mijloc păstrează semnul de
                play, ca să se vadă că sunt clipuri, nu poze. */}
            {live < 0 && i === 1 && (
              <span aria-hidden className={s.reelPlay}>
                <Icon name="play" size={14} />
              </span>
            )}
            <figcaption className={s.reelCap}>
              <b>{r.client}</b>
              <span>{r.seconds}s</span>
            </figcaption>
            {/* Cele trei secunde, desenate. Pe lumea video timpul e mereu
                la vedere — asta e ruda mică a timecode-ului. */}
            <span aria-hidden className={s.reelBar} />
          </figure>
        ))}
      </div>
    </Reveal>
  );
}

/* ---------------- Foaia: SOFTWARE ---------------- */

/* Ecranele din fereastră sunt ilustrative și marcate ca atare în bara
   ei. Numele sunt meserii din publicul diviziei, nu firme — nu inventăm
   clienți (CLAUDE.md §5). Când există un caz real de arătat, intră aici.

   Patru ecrane, nu unul: cine cumpără software nu cumpără o listă, ci un
   instrument prin care circulă toată ziua. Plimbarea prin meniu e cea
   mai scurtă demonstrație a treburilor care se leagă între ele —
   comanda intrată devine lucrare în producție, apoi factură, apoi
   material scăzut din stoc. */
type Row = {
  id: string;
  what: string;
  who: string;
  stage: string;
  tone: "green" | "amber" | "muted";
  due: string;
};

type View = {
  tab: string;
  title: string;
  cols: [string, string, string, string, string];
  rows: Row[];
};

const VIEWS: View[] = [
  {
    tab: "Comenzi",
    title: "Comenzi · septembrie",
    cols: ["Nr.", "Comandă", "Client", "Etapă", "Termen"],
    rows: [
      {
        id: "#1042",
        what: "Ferestre PVC · 12 buc.",
        who: "Atelier tâmplărie",
        stage: "În producție",
        tone: "green",
        due: "18 sep",
      },
      {
        id: "#1041",
        what: "Revizie centrale · 6 loc.",
        who: "Service HVAC",
        stage: "Programat",
        tone: "amber",
        due: "16 sep",
      },
      {
        id: "#1039",
        what: "Piese frezate · lot 3",
        who: "Atelier CNC",
        stage: "Livrat",
        tone: "muted",
        due: "12 sep",
      },
      {
        id: "#1038",
        what: "Ofertă apartament 3 cam.",
        who: "Agenție imobiliară",
        stage: "Trimisă",
        tone: "muted",
        due: "11 sep",
      },
    ],
  },
  {
    tab: "Producție",
    title: "Producție · săptămâna 38",
    cols: ["Nr.", "Lucrare", "Post", "Stare", "Gata"],
    rows: [
      {
        id: "P-217",
        what: "Frezare capace · lot 3",
        who: "Freza CNC 2",
        stage: "În lucru",
        tone: "green",
        due: "azi",
      },
      {
        id: "P-216",
        what: "Debitare profile PVC",
        who: "Debitare",
        stage: "Așteaptă",
        tone: "amber",
        due: "mâine",
      },
      {
        id: "P-214",
        what: "Sudură rame · 12 buc.",
        who: "Sudură",
        stage: "Gata",
        tone: "muted",
        due: "ieri",
      },
      {
        id: "P-211",
        what: "Control dimensional",
        who: "Control final",
        stage: "Gata",
        tone: "muted",
        due: "ieri",
      },
    ],
  },
  {
    tab: "Facturi",
    title: "Facturi · septembrie",
    cols: ["Nr.", "Document", "Client", "Stare", "Termen"],
    rows: [
      {
        id: "F-3084",
        what: "Factură · ferestre PVC",
        who: "Atelier tâmplărie",
        stage: "Încasată",
        tone: "green",
        due: "14 sep",
      },
      {
        id: "F-3083",
        what: "Factură · revizie 6 loc.",
        who: "Service HVAC",
        stage: "Trimisă",
        tone: "amber",
        due: "22 sep",
      },
      {
        id: "F-3081",
        what: "Proformă · piese lot 3",
        who: "Atelier CNC",
        stage: "Acceptată",
        tone: "muted",
        due: "19 sep",
      },
      {
        id: "F-3078",
        what: "Factură · ofertă 1031",
        who: "Agenție imobiliară",
        stage: "Încasată",
        tone: "muted",
        due: "08 sep",
      },
    ],
  },
  {
    tab: "Stoc",
    title: "Stoc · depozit",
    cols: ["Cod", "Material", "Loc", "Stare", "Ora"],
    rows: [
      {
        id: "M-118",
        what: "Profil PVC alb · 6 m",
        who: "Raft A3",
        stage: "Sub prag",
        tone: "amber",
        due: "08:40",
      },
      {
        id: "M-104",
        what: "Garnitură EPDM · rolă",
        who: "Raft B1",
        stage: "În stoc",
        tone: "green",
        due: "08:40",
      },
      {
        id: "M-087",
        what: "Bare aluminiu 6082",
        who: "Hala 2",
        stage: "Comandat",
        tone: "muted",
        due: "ieri",
      },
      {
        id: "M-061",
        what: "Freze 6 mm · set",
        who: "Sculărie",
        stage: "În stoc",
        tone: "muted",
        due: "ieri",
      },
    ],
  },
];

const VIEW_MS = 2600;

function SoftwareSheet({ go }: { go: Go }) {
  return (
    <Link
      href="/software"
      data-scope="software"
      className={s.sheet}
      onClick={(e) => go(e, "software", "/software")}
    >
      <span aria-hidden className={`techgrid ${s.grid}`} />
      {/* Geodezica se desenează la intrarea în viewport (`draw-line` are
          nevoie de `.is-in` pe un strămoș — Reveal îl pune). */}
      <Reveal
        variant="scale"
        delay={200}
        className={s.ringRight}
        style={{ pointerEvents: "none" }}
      >
        <MeridianSoftware className={s.ring} />
      </Reveal>

      <div className={s.sheetInner}>
        <Reveal delay={60}>
          <h2 className={`display ${s.title}`}>SOFTWARE</h2>
        </Reveal>
        <Reveal delay={130}>
          <p className={s.lead}>
            Software croit pe felul în care lucrează echipa ta.
          </p>
        </Reveal>
        <Reveal delay={200}>
          <p className={s.body}>
            Aplicații la comandă, dashboard-uri, fidelizare, SaaS și mobil.
            Pentru firme care au depășit tabelele și fișierele partajate.
          </p>
        </Reveal>

        <Reveal delay={260}>
          <AppWindow />
        </Reveal>

        <Reveal delay={320}>
          <span className={`btn btn-primary !rounded-panel-sm ${s.btn}`}>
            Intră în software
            <Icon name="arrowRight" size={17} className="arw" />
          </span>
        </Reveal>
        <Reveal delay={380}>
          <p className={s.meta}>
            Ofertă fermă, pe etape · Cod și conturi pe firma ta
          </p>
        </Reveal>
      </div>
    </Link>
  );
}

/**
 * Fereastra de aplicație. Se plimbă singură prin meniu — comenzi,
 * producție, facturi, stoc — la fiecare 2,6 secunde, iar trecerea dintre
 * ecrane stă sub 400ms (CLAUDE.md §2: pe software mișcarea e scurtă și
 * funcțională, nu coregrafie).
 *
 * Rămâne o machetă, nu un produs: `role="img"` o ține un singur obiect
 * pentru cititoarele de ecran, așa că schimbarea ecranelor nu le aruncă
 * un tabel nou la fiecare trei secunde.
 */
function AppWindow() {
  const reduced = useReducedMotion();
  const [winRef, step] = useCycle(VIEWS.length, VIEW_MS, !reduced);
  const at = step < 0 ? 0 : step;
  const v = VIEWS[at];

  return (
    <div
      ref={winRef}
      className={s.win}
      role="img"
      aria-label="Machetă ilustrativă de aplicație: comenzi, producție, facturi și stoc, cu etape și termene"
    >
      <div className={s.winBar}>
        {/* `key`, ca titlul să reintre odată cu ecranul lui — altfel s-ar
            schimba textul sub ochii omului, fără nicio trecere. */}
        <span key={at} className={s.winTitle}>
          {v.title}
        </span>
        <span className={s.winTag}>ilustrativ</span>
      </div>
      <div className={s.winBody}>
        <div className={s.winNav}>
          {VIEWS.map((x, i) => (
            <span key={x.tab} data-on={i === at ? "" : undefined}>
              {x.tab}
            </span>
          ))}
        </div>
        {/* `key` pe tabel: ecranul nou intră cu cascada lui de rânduri, în
            loc să se schimbe celulă cu celulă sub ochii omului. */}
        <table key={at} className={s.tbl}>
          <thead>
            <tr>
              <th className={s.tdNr}>{v.cols[0]}</th>
              <th>{v.cols[1]}</th>
              <th className={s.tdWho}>{v.cols[2]}</th>
              <th>{v.cols[3]}</th>
              <th className={s.tdDue}>{v.cols[4]}</th>
            </tr>
          </thead>
          <tbody>
            {v.rows.map((o, ri) => (
              <tr key={o.id} style={{ ["--r" as string]: ri }}>
                <td className={`${s.num} ${s.tdNr}`}>{o.id}</td>
                <td>{o.what}</td>
                <td className={s.tdWho}>{o.who}</td>
                <td>
                  <span className={s.tag} data-tone={o.tone}>
                    {o.stage}
                  </span>
                </td>
                <td className={`${s.num} ${s.tdDue}`}>{o.due}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------------- Banda de sub fold ---------------- */
const POINTS = [
  {
    title: "Un singur punct de contact",
    body: "Un număr și un om care răspunde de proiect de la brief până la livrare. Nu te plimbăm între departamente ca să afli unde a rămas treaba.",
  },
  {
    title: "Nu amestecăm",
    body: "Video optimizează pentru impact, software pentru încredere. Sunt două meserii cu reguli opuse, iar noi refuzăm să le tratăm la fel doar ca să pară consecvent.",
  },
  {
    title: "Se ajută reciproc",
    body: "O campanie video are nevoie de o pagină care nu pierde omul la final. Un magazin nou are nevoie de material care să-l pornească. De obicei al doilea proiect vine din primul.",
  },
];

function Band() {
  return (
    <section
      id="amandoua"
      className="relative border-t border-hair px-5 py-20 sm:px-8 lg:py-28"
    >
      <div className="mx-auto max-w-[1500px]">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,380px)_1fr] lg:gap-20">
          <Reveal>
            <p className="eyebrow mb-5">O agenție, două echipe</p>
            <h2 className="display text-[clamp(1.9rem,4.4vw,2.9rem)]">
              De ce nu suntem
              <br />
              o singură divizie
            </h2>
            <p className="mt-5 text-[16px] leading-relaxed text-dim">
              Pentru că un clip și un sistem nu se cumpără la fel. Unul se
              decide într-o după-amiază, pe telefon. Celălalt trece prin trei
              discuții, un buget și un om care semnează.
            </p>
          </Reveal>

          <ul className="grid gap-3 sm:grid-cols-3">
            {POINTS.map((p, i) => (
              <Reveal as="li" key={p.title} delay={i * 70}>
                <article className="glass lift h-full p-6">
                  <span className="font-md-mono text-[12px] text-dim">
                    0{i + 1}
                  </span>
                  <h3 className="mt-4 text-[16.5px] font-medium leading-snug text-bone">
                    {p.title}
                  </h3>
                  <p className="mt-3 text-[14.5px] leading-relaxed text-dim">
                    {p.body}
                  </p>
                </article>
              </Reveal>
            ))}
          </ul>
        </div>

        <Reveal delay={120} className="mt-4">
          <div className="glass-2 edge-light relative overflow-hidden p-7 sm:p-9">
            <div className="relative z-10 flex flex-wrap items-center gap-x-10 gap-y-6">
              <div className="min-w-[260px] flex-1">
                <h3 className="display text-[clamp(1.4rem,3vw,1.9rem)]">
                  Tot nu știi în ce parte să mergi?
                </h3>
                <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-dim">
                  Sună și spune-ne ce încerci să rezolvi. În cinci minute îți
                  spunem dacă e o problemă de vizibilitate sau una de proces —
                  și dacă răspunsul e „niciuna dintre ele”, îți spunem și asta.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <a href={CONTACT.phoneHref} className="btn btn-primary">
                  <Icon name="phone" size={16} />
                  {CONTACT.phone}
                </a>
                <a href={CONTACT.whatsapp} className="btn btn-ghost">
                  <Icon name="whatsapp" size={16} />
                  WhatsApp
                </a>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ---------------- Footer ---------------- */
function Foot() {
  return (
    <footer className="relative overflow-hidden border-t border-hair">
      <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-x-10 gap-y-5 px-5 py-8 sm:px-8">
        <span className="flex items-center gap-2.5 text-bone">
          <Mark size={22} />
          <span className="font-md-display text-[14px] font-semibold tracking-[0.2em]">
            MERIDIAN
          </span>
        </span>

        <nav aria-label="Divizii" className="flex gap-5">
          <Link
            href="/video"
            className="text-[14px] text-dim transition-colors hover:text-bone"
          >
            Video
          </Link>
          <Link
            href="/software"
            className="text-[14px] text-dim transition-colors hover:text-bone"
          >
            Software
          </Link>
        </nav>

        <span className="ml-auto flex flex-wrap gap-x-6 gap-y-2">
          <ObfuscatedEmail
            address={CONTACT.email}
            fallbackHref="#amandoua"
            className="text-[13.5px] text-dim transition-colors hover:text-bone"
          />
          {/* Diviziile pot avea adrese diferite (env); azi e una singură,
              și n-are rost s-o tipărim de două ori. */}
          {SCONTACT.email !== CONTACT.email && (
            <ObfuscatedEmail
              address={SCONTACT.email}
              fallbackHref="#amandoua"
              className="text-[13.5px] text-dim transition-colors hover:text-bone"
            />
          )}
        </span>
      </div>

      <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-x-8 gap-y-3 border-t border-hair px-5 py-5 text-[12.5px] text-dim sm:px-8">
        <span>
          © 2026 MERIDIAN.
          {(CONTACT.isPlaceholder || SCONTACT.isPlaceholder) && " Adresa de email de pe această pagină e încă provizorie."}
        </span>
        <nav aria-label="Documente legale">
          <ul className="flex flex-wrap gap-x-5 gap-y-1">
            {LEGAL_LINKS.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className="transition-colors hover:text-bone"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  );
}
