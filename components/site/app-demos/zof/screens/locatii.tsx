"use client";

import { useState } from "react";
import {
  Activity,
  ArrowRight,
  CircleCheck,
  Clock,
  Cpu,
  Database,
  Eye,
  EyeOff,
  FileClock,
  Globe,
  HardDrive,
  Heart,
  LayoutDashboard,
  Monitor,
  RefreshCw,
  Server,
  ShoppingBag,
  Trash,
  TriangleAlert,
  Wifi,
  Zap,
} from "lucide-react";
import { num } from "../../kit";
import { LOCS, locById, type Loc } from "../data";
import { totals, useZof, type Ev, type LocLive } from "../store";
import { Badge, Btn, C, CARD, LiveDot, MONO, PageHeader, ago, clock } from "../ui";

/* ============================================================
   Locații și conectori: fiecare magazin are un agent care citește
   gestiunea locală (read-only) și o trimite semnat la server.
   ============================================================ */

export function syncSteps(l: Loc) {
  return [
    l.type === "online" ? "Citesc comenzile noi din Shopify…" : `Citesc ${l.source === "Access" ? "baza Access" : "exportul DorSoft"} (read-only)…`,
    l.type === "online" ? "Potrivesc SKU-urile cu stocul…" : "Aplic regulile: perechi de lentile, discount pe bon…",
    "Semnez HMAC și trimit prin HTTPS…",
    "Serverul confirmă, fără duplicate…",
  ];
}

/** Bara de progres a sincronizării manuale + rezultatul ei. */
export function SyncProgress({ l, x }: { l: Loc; x: LocLive }) {
  if (x.sync === null && !x.result) return null;
  if (x.sync === null)
    return (
      <p role="status" className="flex items-start gap-1.5 rounded-lg border border-[#10B981]/25 bg-[#10B981]/[0.07] px-2.5 py-2 text-[11px] text-[#34D399]">
        <CircleCheck size={13} className="mt-px shrink-0" aria-hidden />
        <span>Sincronizat · {x.result}</span>
      </p>
    );
  const steps = syncSteps(l);
  return (
    <div role="status" className="rounded-lg border border-[#2563EB]/30 bg-[#2563EB]/[0.07] px-2.5 py-2">
      <p className="flex items-center gap-1.5 text-[11px] font-medium text-[#93C5FD]">
        <RefreshCw size={12} className="zof-spin shrink-0" aria-hidden />
        {steps[x.sync]}
      </p>
      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-[#131C34]" aria-hidden>
        <div className="h-full rounded-full bg-[#3B82F6] transition-[width] duration-500 ease-out" style={{ width: `${((x.sync + 1) / 4) * 100}%` }} />
      </div>
    </div>
  );
}

export function StatusBadge({ x }: { x: LocLive }) {
  if (x.sync !== null)
    return (
      <Badge color="#93C5FD" bg="rgba(37,99,235,0.12)" border="rgba(37,99,235,0.3)">
        <RefreshCw size={11} className="zof-spin" aria-hidden /> Sincronizare
      </Badge>
    );
  if (x.status === "warning")
    return (
      <Badge color={C.amberText} bg="rgba(245,158,11,0.1)" border="rgba(245,158,11,0.25)">
        <TriangleAlert size={11} aria-hidden /> Avertisment
      </Badge>
    );
  return (
    <Badge color={C.greenText} bg="rgba(16,185,129,0.1)" border="rgba(16,185,129,0.22)">
      <Wifi size={11} aria-hidden /> Online
    </Badge>
  );
}

/* ---------- traseul datelor ---------- */

const PIPE = [
  { icon: Monitor, title: "Gestiunea din magazin", text: "DorSoft sau Access, pe PC-ul local, fără internet în aplicație" },
  { icon: Cpu, title: "Agentul Zof", text: "citește read-only, ține un buffer local și reîncearcă singur" },
  { icon: Server, title: "Serverul central", text: "o singură sursă de adevăr, fără dubluri la retrimitere" },
  { icon: LayoutDashboard, title: "Dashboard", text: "cifrele tuturor magazinelor, pe orice ecran" },
];
const LINKS = ["citire read-only", "HTTPS · semnat HMAC", "live"];

function Travel({ vertical, still }: { vertical?: boolean; still: boolean }) {
  if (still) return null;
  return (
    <>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={`absolute size-1.5 rounded-full bg-[#60A5FA] shadow-[0_0_8px_#3B82F6] ${vertical ? "left-1/2 -translate-x-1/2" : "top-1/2 -translate-y-1/2"}`}
          style={{
            animation: `${vertical ? "zofTravelY" : "zofTravelX"} 2.4s linear ${i * 0.8}s infinite`,
          }}
          aria-hidden
        />
      ))}
    </>
  );
}

function Pipeline() {
  const { mobile, reduced } = useZof();
  if (mobile)
    return (
      <section aria-label="Cum ajung datele aici" className={`${CARD} p-4`}>
        <h3 className="text-[14px] font-semibold">Cum ajung datele din magazin aici</h3>
        <ol className="relative mt-3 space-y-3.5">
          <span className="absolute bottom-4 left-[17px] top-4 w-px bg-gradient-to-b from-[#2563EB]/60 via-[#3B82F6]/40 to-[#7C3AED]/60" aria-hidden>
            <Travel vertical still={reduced} />
          </span>
          {PIPE.map((p, i) => (
            <li key={p.title} className="relative flex gap-3">
              <span className="relative z-10 flex size-[35px] shrink-0 items-center justify-center rounded-xl border border-[#283149] bg-[#0E1629]">
                <p.icon size={16} className={i === 3 ? "text-[#A78BFA]" : "text-[#60A5FA]"} aria-hidden />
              </span>
              <span className="min-w-0 pt-0.5">
                <span className="block text-[12.5px] font-semibold">{p.title}</span>
                <span className="block text-[11.5px] leading-snug text-[#808999]">{p.text}</span>
                {i < 3 && <span className="mt-1 block text-[10px] text-[#60A5FA]" style={{ fontFamily: MONO }}>↓ {LINKS[i]}</span>}
              </span>
            </li>
          ))}
        </ol>
      </section>
    );
  return (
    <section aria-label="Cum ajung datele aici" className={`${CARD} p-5`}>
      <div className="mb-4 flex items-baseline justify-between">
        <h3 className="text-[14px] font-semibold">Cum ajung datele din magazin aici</h3>
        <span className="text-[11px] text-[#808999]">Agentul inițiază mereu conexiunea: niciun port deschis în magazin.</span>
      </div>
      <ol className="flex items-start">
        {PIPE.map((p, i) => (
          <li key={p.title} className={`flex items-start ${i < 3 ? "flex-1" : ""}`}>
            <div className="w-[150px] shrink-0">
              <span className="flex size-10 items-center justify-center rounded-xl border border-[#283149] bg-[#0E1629]">
                <p.icon size={18} className={i === 3 ? "text-[#A78BFA]" : "text-[#60A5FA]"} aria-hidden />
              </span>
              <p className="mt-2 text-[12.5px] font-semibold">{p.title}</p>
              <p className="mt-0.5 text-[11px] leading-snug text-[#808999]">{p.text}</p>
            </div>
            {i < 3 && (
              <div className="relative mx-2 mt-5 flex-1" aria-hidden>
                <span className="absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] text-[#60A5FA]" style={{ fontFamily: MONO }}>
                  {LINKS[i]}
                </span>
                <span className="relative block h-px bg-gradient-to-r from-[#2563EB]/70 to-[#3B82F6]/30">
                  <Travel still={reduced} />
                </span>
                <ArrowRight size={12} className="absolute -right-1 -top-[6px] text-[#3B82F6]" />
              </div>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

/* ---------- cardul unui conector ---------- */

function ConnectorCard({ l }: { l: Loc }) {
  const { live, now, sync, openLoc, notify } = useZof();
  const x = live.locs[l.id];
  const warn = x.status === "warning";
  const buffered = live.buffered.filter((s) => s.loc === l.id).length;
  const beatFresh = now - x.lastBeat < 1400;
  return (
    <article
      aria-label={l.name}
      className={`${CARD} flex flex-col gap-3 p-4`}
      style={warn ? { borderColor: "rgba(245,158,11,0.4)" } : undefined}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className="size-2 shrink-0 rounded-full transition-transform duration-300"
            style={{ background: warn ? C.amber : C.green, transform: beatFresh ? "scale(1.6)" : undefined }}
            aria-hidden
          />
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 truncate text-[13.5px] font-semibold">
              {l.type === "online" && <Globe size={13} className="text-[#A78BFA]" aria-hidden />}
              {l.name}
            </p>
            <p className="text-[10.5px] text-[#808999]" style={{ fontFamily: MONO }}>
              {l.connector}
            </p>
          </div>
        </div>
        <StatusBadge x={x} />
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px] text-[#808999]">
        <span className="col-span-2 flex min-w-0 items-center gap-1.5">
          <Database size={12} className="shrink-0" aria-hidden />
          <span className="truncate">
            <span className="font-medium text-[#A3ACBB]">{l.source}</span> · {l.method}
          </span>
        </span>
        <span className="col-span-2 flex items-center gap-1.5">
          <RefreshCw size={12} className="shrink-0" aria-hidden />
          <span className="tabular-nums">
            <span className="font-medium text-[#A3ACBB]">{num(x.records)}</span> înregistrări sincronizate azi
          </span>
        </span>
        <span className="flex items-center gap-1.5">
          <Heart size={12} className="shrink-0" aria-hidden />
          Heartbeat: <span className={warn ? "text-[#FBBF24]" : "text-[#A3ACBB]"}>{ago(now - x.lastBeat)}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <Clock size={12} className="shrink-0" aria-hidden />
          Sync: <span className={warn ? "text-[#FBBF24]" : "text-[#A3ACBB]"}>{ago(now - x.lastSync)}</span>
        </span>
      </div>

      {warn && x.sync === null ? (
        <p className="flex items-start gap-1.5 rounded-lg border border-[#F59E0B]/25 bg-[#F59E0B]/[0.06] px-2.5 py-2 text-[11px] leading-snug text-[#FBBF24]">
          <HardDrive size={13} className="mt-px shrink-0" aria-hidden />
          <span>
            Rețeaua din magazin a căzut. {buffered} {buffered === 1 ? "vânzare așteaptă" : "vânzări așteaptă"} în bufferul local — nu se
            pierde nimic.
          </span>
        </p>
      ) : x.sync === null && !x.result ? (
        <p className="flex items-start gap-1.5 rounded-lg border border-[#1C2336] bg-[#0F1729] px-2.5 py-2 text-[11px] leading-snug text-[#808999]">
          <FileClock size={13} className="mt-px shrink-0 text-[#60A5FA]" aria-hidden />
          <span className="min-w-0">
            {l.type === "online" ? "Ultimul eveniment" : "Ultima citire"}:{" "}
            <span className="text-[#A3ACBB]" style={{ fontFamily: MONO }}>
              {l.file}
            </span>
            <span className="block">watermark {clock(x.lastSync)} · fără erori</span>
          </span>
        </p>
      ) : (
        <SyncProgress l={l} x={x} />
      )}

      <div className="mt-auto flex gap-2 pt-0.5">
        <Btn onClick={() => sync(l.id)} disabled={x.sync !== null} variant={warn ? "primary" : "outline"} className="flex-1">
          <RefreshCw size={13} className={x.sync !== null ? "zof-spin" : ""} aria-hidden />
          {x.sync !== null ? "Se sincronizează" : "Sincronizează acum"}
        </Btn>
        <Btn onClick={() => openLoc(l.id)} label={`Detalii ${l.name}`}>
          Detalii
        </Btn>
        <Btn
          variant="ghost"
          label={`Șterge conectorul ${l.connector}`}
          onClick={() =>
            notify("În demo, conectorii nu se pot șterge. În aplicația reală, ștergerea revocă și cheia API a agentului din magazin.")
          }
          className="!px-2 text-[#F87171] hover:!text-[#F87171]"
        >
          <Trash size={13} aria-hidden />
        </Btn>
      </div>
    </article>
  );
}

/* ---------- jurnalul de evenimente ---------- */

const EV: Record<Ev["type"], { label: string; icon: typeof Zap; color: string; bg: string }> = {
  sale: { label: "Vânzare", icon: ShoppingBag, color: C.greenText, bg: "rgba(16,185,129,0.1)" },
  beat: { label: "Heartbeat", icon: Heart, color: C.dim2, bg: "rgba(19,28,52,0.9)" },
  sync: { label: "Sincronizare", icon: RefreshCw, color: C.blueText, bg: "rgba(37,99,235,0.12)" },
  online: { label: "Conectat", icon: Zap, color: C.greenText, bg: "rgba(16,185,129,0.1)" },
  buffer: { label: "Buffer local", icon: HardDrive, color: C.amberText, bg: "rgba(245,158,11,0.1)" },
};

export function EventLog({ limit = 14, forLoc }: { limit?: number; forLoc?: string }) {
  const { live, now, mobile } = useZof();
  const [beats, setBeats] = useState(false);
  const list = live.events.filter((e) => (beats || e.type !== "beat") && (!forLoc || e.loc === forLoc)).slice(0, limit);
  return (
    <section aria-label="Jurnal evenimente" className={`${CARD} ${mobile ? "p-4" : "p-5"}`}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-[14px] font-semibold">Jurnal evenimente</h3>
        <Btn variant="ghost" size="xs" onClick={() => setBeats((b) => !b)}>
          {beats ? <EyeOff size={12} aria-hidden /> : <Eye size={12} aria-hidden />}
          {beats ? "Ascunde heartbeats" : "Arată heartbeats"}
        </Btn>
      </div>
      <ul className="-mx-2">
        {list.map((e) => {
          const cfg = EV[e.type];
          const l = locById(e.loc);
          const fresh = now - e.at < 2500;
          return (
            <li key={e.id} className={`flex items-center gap-3 rounded-lg px-2 py-2 ${fresh ? "zof-flash" : ""}`}>
              <span className="flex size-7 shrink-0 items-center justify-center rounded-lg" style={{ background: cfg.bg, color: cfg.color }}>
                <cfg.icon size={13} aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12px] font-medium">
                  {cfg.label}
                  <span className="font-normal text-[#808999]"> · {e.text}</span>
                </span>
                <span className="block truncate text-[10.5px] text-[#808999]">
                  <span style={{ fontFamily: MONO }}>{l.connector}</span> · {l.name}
                </span>
              </span>
              <span className="shrink-0 text-right">
                <Badge
                  color={e.status === "ok" ? C.greenText : C.amberText}
                  bg={e.status === "ok" ? "rgba(16,185,129,0.1)" : "rgba(245,158,11,0.1)"}
                  className="!px-1.5 !text-[9.5px]"
                >
                  {e.status}
                </Badge>
                <span className="mt-0.5 block text-[10px] tabular-nums text-[#808999]">{ago(now - e.at)}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* ---------- ecranul ---------- */

/* Ordinea e fixă: locația cu probleme la pornire stă prima, ca să se vadă. */
const ORDER = [...LOCS].sort((a, b) => (a.status === "warning" ? -1 : 0) - (b.status === "warning" ? -1 : 0));

export default function Locatii() {
  const { live, mobile, syncAll, reduced, now } = useZof();
  const t = totals(live);
  const buffered = live.buffered.length;
  const anySync = Object.values(live.locs).some((x) => x.sync !== null);
  const stats = [
    { label: "Conectori", value: "9", icon: Server, color: C.blueText },
    { label: "Online", value: `${t.online}`, icon: Activity, color: C.greenText },
    { label: "În buffer local", value: `${buffered}`, icon: HardDrive, color: buffered ? C.amberText : C.dim },
    { label: "Înregistrări azi", value: num(t.records), icon: Zap, color: C.violetText },
  ];
  return (
    <div className="zof-in space-y-4">
      <PageHeader
        mobile={mobile}
        title="Locații și conectori"
        subtitle="Fiecare magazin are un agent care aduce online gestiunea locală."
        meta={
          <span className="flex items-center gap-1.5 text-[12px] text-[#808999]">
            <LiveDot still={reduced} color={t.online === 9 ? C.green : C.amber} />
            {t.online}/9 conectate · ultima sincronizare {ago(now - t.lastSync)}
          </span>
        }
        actions={
          <Btn variant="primary" onClick={syncAll} disabled={anySync} size={mobile ? "md" : "sm"} className={mobile ? "w-full" : ""}>
            <RefreshCw size={14} className={anySync ? "zof-spin" : ""} aria-hidden />
            {anySync ? "Se sincronizează…" : "Sincronizează tot"}
          </Btn>
        }
      />

      <div className={`grid gap-3 ${mobile ? "grid-cols-2" : "grid-cols-4"}`}>
        {stats.map((s) => (
          <div key={s.label} className={`${CARD} flex items-center gap-3 p-4`}>
            <s.icon size={20} style={{ color: s.color }} aria-hidden />
            <div className="min-w-0">
              <p className="text-[18px] font-bold leading-tight tabular-nums">{s.value}</p>
              <p className="truncate text-[11px] text-[#808999]">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      <Pipeline />

      <div>
        <h2 className="mb-3 text-[14px] font-semibold">Conectori înregistrați ({LOCS.length})</h2>
        <div className={`grid gap-3 ${mobile ? "grid-cols-1" : "grid-cols-3"}`}>
          {ORDER.map((l) => (
            <ConnectorCard key={l.id} l={l} />
          ))}
        </div>
      </div>

      <EventLog limit={mobile ? 8 : 12} />
    </div>
  );
}
