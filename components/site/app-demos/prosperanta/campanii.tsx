"use client";

import { useState, type ReactNode } from "react";
import { CircleCheck, Menu, Minus, Plus, TriangleAlert } from "lucide-react";
import { StatusBar, compact, dec, num } from "../kit";
import { AUDIENCES, C, FUELS, KIND_LABEL, clockLabel, type Campaign, type CampaignKind } from "./data";
import { CampaignBanner, Hero, HomeLinks, RewardsPill, Tile, nextReward } from "./client";
import { useDemo } from "./store";
import { PageTitle, StaffShell } from "./staff";
import { Badge, Btn, Card, CardHead, Label, Logo, Mark, Meta, Pills, SW, Switch, inputCls, nr, unit } from "./ui";

/* ============================================================
   Unelte de marketing: campanii afișate în aplicația clientului
   (bannerul „Campania săptămânii”), publicul țintă, canalele și
   regulile de punctare pe tip de combustibil.
   ============================================================ */

type MTab = "lista" | "creeaza" | "reguli";

const PERIODS = [
  { id: "weekend", label: "Weekendul acesta" },
  { id: "7", label: "7 zile" },
  { id: "oct", label: "Tot octombrie" },
] as const;
type PeriodId = (typeof PERIODS)[number]["id"];
/** Perioada, cum apare în rândul campaniei, după public. */
const PERIOD_TEXT: Record<PeriodId, string> = { weekend: "weekendul acesta", "7": "7 zile", oct: "octombrie" };

type Draft = {
  title: string;
  description: string;
  kind: CampaignKind;
  audience: string;
  period: PeriodId;
  push: boolean;
  sms: boolean;
};
const EMPTY: Draft = {
  title: "Spălare gratuită la 200 L",
  description: "Strânge 200 de litri în octombrie și primești o spălare standard.",
  kind: "produs",
  audience: "activi",
  period: "oct",
  push: true,
  sms: false,
};

const line = `1px solid ${C.border}`;

export function Campanii() {
  const { s, mobile, notify, addCampaign } = useDemo();
  const [tab, setTab] = useState<MTab>("lista");
  const [d, setD] = useState<Draft>(EMPTY);
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const aud = AUDIENCES.find((a) => a.id === d.audience)!;

  const check = () => {
    if (!d.title.trim()) {
      setErr("Scrie un titlu.");
      return false;
    }
    if (!d.description.trim()) {
      setErr("Scrie o descriere.");
      return false;
    }
    setErr(null);
    return true;
  };

  const saveDraft = () => {
    if (!check()) return;
    const c: Omit<Campaign, "id"> = {
      title: d.title.trim(),
      description: d.description.trim(),
      kind: d.kind,
      audience: aud.label,
      reach: aud.reach,
      period: PERIOD_TEXT[d.period],
      active: false,
      draft: true,
      push: d.push,
      sms: d.sms,
      joined: 0,
      litres: 0,
    };
    addCampaign(c);
    setSaved(d.title.trim());
    setD({ ...EMPTY, title: "", description: "" });
    if (mobile) setTab("lista");
  };

  const launch = () => {
    if (!check()) return;
    notify(`Trimiterea e oprită în demo. Campania ar pleca la ${nr(aud.reach, "client", "clienți")}.`);
  };

  const form = (
    <CampaignForm
      d={d}
      setD={(p) => {
        setD({ ...d, ...p });
        setErr(null);
        setSaved(null);
      }}
      err={err}
      onSave={saveDraft}
      onLaunch={launch}
    />
  );

  if (mobile)
    return (
      <StaffShell face="admin" screen="campanii">
        <div className="prs-scroll absolute inset-0">
          <main className="space-y-3 px-3 pb-10 pt-4">
            <PageTitle title="Campanii" />
            <Pills<MTab>
              label="Secțiuni campanii"
              value={tab}
              onChange={setTab}
              stretch="auto"
              items={[
                { id: "lista", label: "Toate", count: s.campaigns.length },
                { id: "creeaza", label: "Campanie nouă" },
                { id: "reguli", label: "Puncte pe litru" },
              ]}
            />
            {tab === "lista" && (
              <>
                {saved && <SavedNote title={saved} />}
                <CampaignList />
              </>
            )}
            {tab === "creeaza" && (
              <>
                <section>
                  <p className="mb-1.5 text-[13px] font-medium" style={{ color: C.mutedFg }}>
                    Previzualizare
                  </p>
                  <div inert aria-hidden>
                    <CampaignBanner title={d.title || "Titlul campaniei"} description={d.description || "Descrierea apare aici."} />
                  </div>
                </section>
                {form}
              </>
            )}
            {tab === "reguli" && <Rules />}
          </main>
        </div>
      </StaffShell>
    );

  return (
    <StaffShell face="admin" screen="campanii">
      <div className="absolute inset-0 flex flex-col">
        <div className="mx-auto w-full max-w-[1232px] shrink-0 px-6 pt-5">
          <PageTitle title="Campanii" />
        </div>
        <div className="mx-auto grid min-h-0 w-full max-w-[1232px] flex-1 grid-cols-12 gap-4 px-6 pb-5 pt-4">
          <div className="prs-scroll col-span-4 min-h-0">{form}</div>
          <div className="col-span-3 flex min-h-0 flex-col items-center">
            <p className="mb-2 self-start text-[13px] font-medium" style={{ color: C.mutedFg }}>
              Previzualizare
            </p>
            <PhonePreview d={d} />
          </div>
          <div className="prs-scroll col-span-5 min-h-0 space-y-4 pr-0.5">
            {saved && <SavedNote title={saved} />}
            <CampaignList />
            <Rules />
          </div>
        </div>
      </div>
    </StaffShell>
  );
}

function SavedNote({ title }: { title: string }) {
  return (
    <p role="status" className="a-in flex items-center gap-2 rounded-[8px] px-3 py-2.5 text-[13px] font-medium" style={{ background: C.greenBg, color: C.greenInk }}>
      <CircleCheck size={16} strokeWidth={SW} className="shrink-0" aria-hidden /> Ciornă salvată: „{title}”
    </p>
  );
}

/* ---------------- formularul ---------------- */

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-1.5 text-[13px] font-medium">{label}</legend>
      {children}
    </fieldset>
  );
}

function CampaignForm({
  d,
  setD,
  err,
  onSave,
  onLaunch,
}: {
  d: Draft;
  setD: (p: Partial<Draft>) => void;
  err: string | null;
  onSave: () => void;
  onLaunch: () => void;
}) {
  return (
    <Card className="p-4">
      <h2 className="text-[14px] font-semibold">Campanie nouă</h2>
      <div className="mt-3 space-y-3">
        <div>
          <Label htmlFor="prs-ct">Titlu</Label>
          <input
            id="prs-ct"
            value={d.title}
            maxLength={40}
            onChange={(e) => setD({ title: e.target.value })}
            placeholder="Ex.: Puncte triple luni dimineața"
            className={inputCls}
          />
        </div>
        <div>
          <Label htmlFor="prs-cd">Descriere</Label>
          <textarea
            id="prs-cd"
            value={d.description}
            maxLength={120}
            rows={2}
            onChange={(e) => setD({ description: e.target.value })}
            placeholder="Ex.: Strânge 200 L în octombrie și primești o spălare."
            className="field block w-full resize-none rounded-[8px] bg-white px-3 py-2 text-[14px] leading-snug"
          />
        </div>
        <Group label="Tip">
          <Pills<CampaignKind>
            kind="radio"
            stretch="auto"
            label="Tip"
            value={d.kind}
            onChange={(k) => setD({ kind: k })}
            items={(Object.keys(KIND_LABEL) as CampaignKind[]).map((k) => ({ id: k, label: KIND_LABEL[k] }))}
          />
        </Group>
        <Group label="Public">
          <div className="overflow-hidden rounded-[8px]" style={{ border: line }}>
            {AUDIENCES.map((a, i) => (
              <label key={a.id} className="row flex h-9 cursor-pointer items-center gap-2.5 px-3 text-[13.5px]" style={{ borderTop: i ? line : undefined }}>
                <input type="radio" name="prs-aud" checked={d.audience === a.id} onChange={() => setD({ audience: a.id })} />
                <span className="min-w-0 flex-1 truncate">{a.label}</span>
                <span className="shrink-0 text-[12.5px]" style={{ color: C.mutedFg }}>
                  {num(a.reach)}
                </span>
              </label>
            ))}
          </div>
        </Group>
        <Group label="Canale">
          <div className="flex flex-wrap gap-x-4 gap-y-2 text-[13.5px]">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked disabled readOnly /> Banner în aplicație
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input type="checkbox" checked={d.push} onChange={(e) => setD({ push: e.target.checked })} /> Notificare push
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input type="checkbox" checked={d.sms} onChange={(e) => setD({ sms: e.target.checked })} /> SMS
            </label>
          </div>
        </Group>
        <Group label="Perioadă">
          <Pills<PeriodId>
            kind="radio"
            stretch="auto"
            label="Perioadă"
            value={d.period}
            onChange={(p) => setD({ period: p })}
            items={PERIODS.map((p) => ({ id: p.id, label: p.label }))}
          />
        </Group>
        {/* acțiunile rămân mereu la vedere, chiar dacă formularul se derulează */}
        <div className="sticky bottom-0 z-10 -mx-4 -mb-4 space-y-2 rounded-b-[12px] bg-white px-4 pb-4 pt-3" style={{ borderTop: line }}>
          {err && (
            <p role="alert" className="flex items-start gap-2 text-[13px] font-medium" style={{ color: C.red }}>
              <TriangleAlert size={16} strokeWidth={SW} className="mt-0.5 shrink-0" aria-hidden /> {err}
            </p>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Btn variant="secondary" onClick={onSave}>
              Salvează ciorna
            </Btn>
            <Btn onClick={onLaunch}>Lansează campania</Btn>
          </div>
        </div>
      </div>
    </Card>
  );
}

/* ---------------- previzualizare ----------------
   Ecranul de start al aplicației, desenat cu aceleași piese ca în
   aplicația clientului, la lățimea telefonului (390px), micșorat. */

function PhonePreview({ d }: { d: Draft }) {
  const { s } = useDemo();
  const pts = s.customers[0].points;
  const active = s.vouchers.filter((v) => v.customer === 0 && v.status === "active").length;
  const SCREEN = 240;
  return (
    <div className="relative w-[258px] shrink-0 rounded-[40px] bg-[#111] p-[9px]" style={{ boxShadow: "0 12px 32px -16px rgba(0,0,0,0.35)" }}>
      <div className="relative h-[486px] overflow-hidden rounded-[32px] bg-white">
        <div inert aria-hidden className="absolute left-0 top-0 origin-top-left" style={{ width: 390, transform: `scale(${SCREEN / 390})` }}>
          <StatusBar tone="dark" bg="#fff" time={clockLabel(s.clock)} />
          <div className="flex h-14 items-center justify-between pl-4 pr-2" style={{ borderBottom: line }}>
            <Logo size={30} />
            <span className="flex size-11 items-center justify-center">
              <Menu size={24} strokeWidth={SW} />
            </span>
          </div>
          <div className="space-y-3 px-4 pt-4">
            <Hero points={pts} next={nextReward(pts)} />
            <div className="grid grid-cols-2 gap-3">
              <Tile title="Voucherele mele" note={active === 1 ? "1 activ" : active > 1 ? `${active} active` : undefined} />
              <Tile title="Istoric alimentări" />
            </div>
            <CampaignBanner title={d.title || "Titlul campaniei"} description={d.description || "Descrierea apare aici."} />
            <RewardsPill />
            <HomeLinks />
          </div>
        </div>
        <span className="absolute left-1/2 top-[7px] z-10 h-[17px] w-[64px] -translate-x-1/2 rounded-full bg-black" aria-hidden />
        {d.push && (
          <div
            className="a-in absolute inset-x-2 top-[30px] z-20 rounded-[14px] p-2.5"
            style={{ background: "#F2F2F2", boxShadow: "0 6px 16px -8px rgba(0,0,0,0.3)" }}
            aria-hidden
          >
            <div className="flex items-center gap-1.5">
              <span className="flex size-5 items-center justify-center rounded-[5px] bg-white">
                <Mark size={13} />
              </span>
              <span className="text-[10px] font-medium" style={{ color: C.mutedFg }}>
                Prosperanța
              </span>
              <span className="ml-auto text-[10px]" style={{ color: C.mutedFg }}>
                acum
              </span>
            </div>
            <p className="mt-1 truncate text-[11.5px] font-semibold">{d.title || "Titlul campaniei"}</p>
            <p className="line-clamp-2 text-[10.5px] leading-snug" style={{ color: "#444" }}>
              {d.description || "Descrierea apare aici."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- lista de campanii ---------------- */

function CampaignList() {
  const { s, toggleCampaign } = useDemo();
  const shown = s.campaigns.find((c) => c.active && !c.draft)?.id;
  return (
    <Card>
      <CardHead right={<Meta>{s.campaigns.length}</Meta>}>Toate campaniile</CardHead>
      <ul>
        {s.campaigns.map((c, i) => {
          const state = c.active ? "Activă" : c.draft ? "Ciornă" : "Oprită";
          return (
            <li key={c.id} className={`flex items-center gap-4 px-4 py-3 ${c.draft ? "a-flash" : ""}`} style={{ borderTop: i ? line : undefined }}>
              <div className="min-w-0 flex-1">
                <p className="flex min-w-0 items-center gap-2">
                  <span className="truncate text-[14px] font-semibold">{c.title}</span>
                  {shown === c.id && <Badge>În aplicație</Badge>}
                </p>
                <p className="truncate text-[12.5px]" style={{ color: C.mutedFg }}>
                  {c.audience} · {c.period}
                </p>
                {c.joined > 0 && (
                  <p className="mt-0.5 text-[12.5px]" style={{ color: C.mutedFg }}>
                    <span className="font-medium" style={{ color: C.fg }}>
                      {num(c.joined)}
                    </span>{" "}
                    {unit(c.joined, "participant", "participanți")} ·{" "}
                    <span className="font-medium" style={{ color: C.fg }}>
                      {compact(c.litres)} L
                    </span>
                  </p>
                )}
              </div>
              <Switch on={c.active} onChange={() => toggleCampaign(c.id)} label={c.title}>
                <span className="w-[44px] text-left text-[13px]">{state}</span>
              </Switch>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

/* ---------------- reguli de punctare (setările de combustibil) ---------------- */

function Rules() {
  const { s, setPpl } = useDemo();
  return (
    <Card>
      <CardHead>Puncte pe litru</CardHead>
      <ul>
        {FUELS.map((f, i) => {
          const v = s.ppl[f.id];
          const set = (n: number) => setPpl(f.id, Math.max(0.5, Math.min(5, Math.round(n * 2) / 2)));
          const step = (n: number, label: string, icon: ReactNode, disabled: boolean) => (
            <button
              type="button"
              aria-label={`${label} punctele pentru ${f.label}`}
              onClick={() => set(v + n)}
              disabled={disabled}
              className="ico flex h-full w-9 items-center justify-center disabled:cursor-not-allowed"
              style={disabled ? { color: "#C4C4C4", background: "transparent" } : undefined}
            >
              {icon}
            </button>
          );
          return (
            <li key={f.id} className="flex items-center gap-3 px-4 py-2.5" style={{ borderTop: i ? line : undefined }}>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-medium">{f.label}</p>
                <p className="text-[12.5px]" style={{ color: C.mutedFg }}>
                  {dec(f.price)} lei/L
                </p>
              </div>
              <div className="flex h-9 items-center overflow-hidden rounded-[8px]" style={{ border: `1px solid ${C.line}` }}>
                {step(-0.5, "Scade", <Minus size={14} strokeWidth={2} />, v <= 0.5)}
                <span className="w-[64px] text-center text-[14px] font-semibold" aria-live="polite">
                  {String(v).replace(".", ",")} p/L
                </span>
                {step(0.5, "Crește", <Plus size={14} strokeWidth={2} />, v >= 5)}
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
