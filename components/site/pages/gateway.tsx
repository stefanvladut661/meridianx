"use client";

import { Link } from "@/i18n/navigation";
import { Mark } from "@/components/site/mark";
import { LEGAL_LINKS } from "@/components/site/legal-links";
import { MeridianSoftware, MeridianVideo } from "@/components/site/meridian";
import { Reveal } from "@/components/site/motion";
import { ObfuscatedEmail } from "@/components/site/obfuscated-email";
import { Icon } from "@/components/site/ui";
import { CONTACT } from "@/components/site/video-content";
import { SCONTACT } from "@/components/site/software-content";
import { FEATURED, VIDEOS } from "@/components/site/portfolio-content";
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

/* Trei materiale de prima pagină, în ordinea din manifest — postere
   reale, din clipuri livrate. Dacă se schimbă portofoliul, se schimbă
   și poarta: e intenționat, poarta e o dovadă, nu un decor. */
const REELS = FEATURED.slice(0, 3);
const KINDS = [...new Set(VIDEOS.map((v) => v.kind))];

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
              Filmăm, montăm și distribuim pe Meta, TikTok și Google. Pentru
              afaceri care trăiesc din clienți care revin.
            </p>
          </Reveal>
          <Reveal delay={210}>
            <span className={`btn btn-primary ${s.btn}`}>
              Intră în video
              <Icon name="arrowRight" size={17} className="arw" />
            </span>
          </Reveal>
          <Reveal delay={280}>
            <p className={s.meta}>
              {VIDEOS.length} materiale livrate · {KINDS.join(" · ")}
            </p>
          </Reveal>
        </div>

        <Reveal variant="scale" delay={120} className={s.fan}>
          {REELS.map((r, i) => (
            <figure key={r.slug} className={s.reel}>
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
              {i === 1 && (
                <span aria-hidden className={s.reelPlay}>
                  <Icon name="play" size={14} />
                </span>
              )}
              <figcaption className={s.reelCap}>
                <b>{r.client}</b>
                <span>{r.seconds}s</span>
              </figcaption>
            </figure>
          ))}
        </Reveal>
      </div>
    </Link>
  );
}

/* ---------------- Foaia: SOFTWARE ---------------- */

/* Rândurile din fereastră sunt ilustrative și marcate ca atare în bara
   ei. Numele sunt meserii din publicul diviziei, nu firme — nu inventăm
   clienți (CLAUDE.md §5). Când există un caz real de arătat, intră aici. */
const ORDERS = [
  {
    id: "1042",
    what: "Ferestre PVC · 12 buc.",
    who: "Atelier tâmplărie",
    stage: "În producție",
    tone: "green",
    due: "18 sep",
  },
  {
    id: "1041",
    what: "Revizie centrale · 6 locații",
    who: "Service HVAC",
    stage: "Programat",
    tone: "amber",
    due: "16 sep",
  },
  {
    id: "1039",
    what: "Piese frezate · lot 3",
    who: "Atelier CNC",
    stage: "Livrat",
    tone: "muted",
    due: "12 sep",
  },
  {
    id: "1038",
    what: "Ofertă apartament 3 cam.",
    who: "Agenție imobiliară",
    stage: "Ofertă trimisă",
    tone: "muted",
    due: "11 sep",
  },
] as const;

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
          <p className={s.lead}>Sisteme pe care echipa chiar le folosește.</p>
        </Reveal>
        <Reveal delay={200}>
          <p className={s.body}>
            Aplicații la comandă, dashboard-uri, fidelizare, SaaS și mobil.
            Pentru firme care digitalizează cu finanțare și cu termen.
          </p>
        </Reveal>

        <Reveal delay={260}>
          <div
            className={s.win}
            role="img"
            aria-label="Machetă ilustrativă de aplicație: lista de comenzi cu etape și termene"
          >
            <div className={s.winBar}>
              <span className={s.winTitle}>Comenzi · septembrie</span>
              <span className={s.winTag}>ilustrativ</span>
            </div>
            <div className={s.winBody}>
              <div className={s.winNav}>
                <span data-on="">Comenzi</span>
                <span>Producție</span>
                <span>Facturi</span>
                <span>Stoc</span>
                <span>Clienți</span>
              </div>
              <table className={s.tbl}>
                <thead>
                  <tr>
                    <th>Nr.</th>
                    <th>Comandă</th>
                    <th className={s.tdWho}>Client</th>
                    <th>Etapă</th>
                    <th className={s.tdDue}>Termen</th>
                  </tr>
                </thead>
                <tbody>
                  {ORDERS.map((o) => (
                    <tr key={o.id}>
                      <td className={s.num}>#{o.id}</td>
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

/* ---------------- Banda de sub fold ---------------- */
const POINTS = [
  {
    title: "Un singur punct de contact",
    body: "Vorbești cu aceiași oameni, indiferent de divizie. În spate lucrează două echipe diferite, pentru că un editor bun nu e și un arhitect de software bun.",
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
              Pentru că ar fi o minciună comodă. Sunt două feluri diferite de a
              cumpăra, două ritmuri și doi oameni diferiți care semnează.
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
