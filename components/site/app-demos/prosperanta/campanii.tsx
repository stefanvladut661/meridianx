"use client";

import { useState } from "react";
import { ArrowRight, Bell, MessageSquare, Smartphone, Minus, Plus, Send, Save, TriangleAlert, Megaphone } from "lucide-react";
import { compact, num } from "../kit";
import { AUDIENCES, C, FUELS, KIND_LABEL, type Campaign, type CampaignKind } from "./data";
import { useDemo } from "./store";
import { PageTitle, StaffShell } from "./staff";
import { Btn, Card, CardHead, Label, Mark, Pills, de, inputCls, inputStyle } from "./ui";

/* ============================================================
   Unelte de marketing: campanii afișate în aplicația clientului
   (bannerul „Campania săptămânii”), publicul țintă, canalele și
   regulile de punctare pe tip de combustibil.
   ============================================================ */

type MTab = "lista" | "creeaza" | "reguli";
const PERIODS = ["Weekendul acesta", "7 zile", "Tot octombrie"];

type Draft = {
  title: string;
  description: string;
  kind: CampaignKind;
  audience: string;
  period: string;
  push: boolean;
  sms: boolean;
};
const EMPTY: Draft = {
  title: "Spălare gratuită la 200 L",
  description: "Strânge 200 de litri în octombrie și primești o spălare standard din partea noastră.",
  kind: "produs",
  audience: "activi",
  period: PERIODS[2],
  push: true,
  sms: false,
};

export function Campanii() {
  const { s, mobile, notify, addCampaign } = useDemo();
  const [tab, setTab] = useState<MTab>("lista");
  const [d, setD] = useState<Draft>(EMPTY);
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const aud = AUDIENCES.find((a) => a.id === d.audience)!;
  const activeCount = s.campaigns.filter((c) => c.active).length;

  const check = () => {
    if (!d.title.trim()) {
      setErr("Scrie un titlu: e primul lucru pe care îl vede clientul.");
      return false;
    }
    if (!d.description.trim()) {
      setErr("Scrie o descriere scurtă: clientul trebuie să știe ce are de făcut.");
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
      period: d.period,
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
    const ch = [d.push && "notificare push", d.sms && "SMS"].filter(Boolean).join(" și ");
    notify(
      `În demo, trimiterea e oprită. În aplicația reală, campania pleacă la ${num(aud.reach)} de clienți${ch ? ` prin ${ch}` : ""} și apare ca banner în aplicație.`
    );
  };

  const form = (
    <CampaignForm d={d} setD={(p) => { setD({ ...d, ...p }); setErr(null); setSaved(null); }} err={err} onSave={saveDraft} onLaunch={launch} reach={aud.reach} />
  );

  if (mobile)
    return (
      <StaffShell face="admin" screen="campanii">
        <div className="prs-scroll absolute inset-0">
          <main className="space-y-3 px-3 pb-10 pt-4">
            <PageTitle title="Campanii" sub={`${activeCount} active · ${num(s.totals.members)} de membri în club`} />
            <Pills<MTab>
              label="Secțiuni campanii"
              value={tab}
              onChange={setTab}
              size="sm"
              items={[
                { id: "lista", label: `Campanii · ${s.campaigns.length}` },
                { id: "creeaza", label: "Creează" },
                { id: "reguli", label: "Puncte / litru" },
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
                <BannerPreview title={d.title} description={d.description} kind={d.kind} />
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
          <PageTitle
            title="Campanii"
            sub={`${activeCount} active acum · bannerul din aplicație îl văd toți cei ${num(s.totals.members)} de membri`}
          />
        </div>
        <div className="mx-auto grid min-h-0 w-full max-w-[1232px] flex-1 grid-cols-12 gap-4 px-6 pb-5 pt-4">
          <div className="prs-scroll col-span-4 min-h-0">{form}</div>
          <div className="col-span-3 flex min-h-0 flex-col items-center">
            <p className="mb-2 self-start text-[11px] font-bold uppercase tracking-[0.08em]" style={{ color: C.mutedFg }}>
              Previzualizare în aplicație
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
    <p role="status" className="a-in rounded-[14px] px-4 py-3 text-[13px] font-bold" style={{ background: C.greenBg, color: C.green }}>
      Ciornă salvată: „{title}”. Activeaz-o din listă și apare pe ecranul de start al clienților.
    </p>
  );
}

/* ---------------- formularul ---------------- */

function CampaignForm({
  d,
  setD,
  err,
  onSave,
  onLaunch,
  reach,
}: {
  d: Draft;
  setD: (p: Partial<Draft>) => void;
  err: string | null;
  onSave: () => void;
  onLaunch: () => void;
  reach: number;
}) {
  return (
    <Card className="p-5">
      <p className="flex items-center gap-2 text-[13px] font-black uppercase">
        <Megaphone size={16} strokeWidth={2.4} style={{ color: C.red }} /> Campanie nouă
      </p>
      <div className="mt-3.5 space-y-3.5">
        <div>
          <Label htmlFor="prs-ct">Titlu</Label>
          <input id="prs-ct" value={d.title} maxLength={40} onChange={(e) => setD({ title: e.target.value })} placeholder="ex. Puncte triple luni dimineața" className={inputCls} style={inputStyle} />
        </div>
        <div>
          <Label htmlFor="prs-cd">Descriere</Label>
          <textarea
            id="prs-cd"
            value={d.description}
            maxLength={120}
            rows={3}
            onChange={(e) => setD({ description: e.target.value })}
            placeholder="Ce primește clientul și ce are de făcut."
            className="w-full resize-none rounded-[12px] bg-white px-3.5 py-2.5 text-[14px] leading-snug outline-none"
            style={inputStyle}
          />
        </div>
        <div>
          <Label>Tip</Label>
          <div className="flex gap-1.5">
            {(Object.keys(KIND_LABEL) as CampaignKind[]).map((k) => {
              const on = d.kind === k;
              return (
                <button
                  key={k}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setD({ kind: k })}
                  className="h-8 flex-1 whitespace-nowrap rounded-full px-2 text-[10.5px] font-black uppercase"
                  style={on ? { background: C.red, color: "#fff" } : { background: C.muted }}
                >
                  {KIND_LABEL[k]}
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <Label>Public</Label>
          <div role="radiogroup" aria-label="Public" className="grid grid-cols-2 gap-1.5">
            {AUDIENCES.map((a) => {
              const on = d.audience === a.id;
              return (
                <button
                  key={a.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setD({ audience: a.id })}
                  className="flex flex-col rounded-[12px] px-3 py-2 text-left"
                  style={{ border: `2px solid ${on ? C.red : C.border}`, background: on ? "#FFF8F8" : "#fff" }}
                >
                  <span className="truncate text-[12px] font-bold leading-tight">{a.label}</span>
                  <span className="tnum mt-0.5 text-[13px] font-black" style={{ color: on ? C.red : C.mutedFg }}>
                    {num(a.reach)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <Label>Canale</Label>
          <div className="flex gap-1.5">
            <Chan icon={<Smartphone size={14} />} label="Banner" on locked />
            <Chan icon={<Bell size={14} />} label="Push" on={d.push} onChange={(v) => setD({ push: v })} />
            <Chan icon={<MessageSquare size={14} />} label="SMS" on={d.sms} onChange={(v) => setD({ sms: v })} />
          </div>
        </div>
        <div>
          <Label>Perioadă</Label>
          <div className="flex gap-1.5">
            {PERIODS.map((p) => {
              const on = d.period === p;
              return (
                <button
                  key={p}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setD({ period: p })}
                  className="h-8 flex-1 whitespace-nowrap rounded-full px-2 text-[10.5px] font-black uppercase"
                  style={on ? { background: C.fg, color: "#fff" } : { background: C.muted }}
                >
                  {p}
                </button>
              );
            })}
          </div>
        </div>
        {/* acțiunile rămân mereu la vedere, chiar dacă formularul se derulează */}
        <div className="sticky bottom-0 z-10 -mx-5 -mb-5 space-y-2 rounded-b-[16px] bg-white px-5 pb-5 pt-3" style={{ borderTop: `1px solid ${C.border}` }}>
          {err && (
            <p role="alert" className="flex items-start gap-2 text-[13px] font-bold" style={{ color: C.red }}>
              <TriangleAlert size={16} className="mt-0.5 shrink-0" /> {err}
            </p>
          )}
          <div className="grid grid-cols-[1fr_1.4fr] gap-2">
            <Btn variant="outline" onClick={onSave}>
              <Save size={15} strokeWidth={2.4} /> Ciornă
            </Btn>
            <Btn onClick={onLaunch}>
              <Send size={15} strokeWidth={2.4} /> Lansează · {compact(reach)}
            </Btn>
          </div>
        </div>
      </div>
    </Card>
  );
}

function Chan({ icon, label, on, onChange, locked = false }: { icon: React.ReactNode; label: string; on: boolean; onChange?: (v: boolean) => void; locked?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-disabled={locked}
      aria-label={locked ? `${label}: mereu activ` : label}
      onClick={() => !locked && onChange?.(!on)}
      className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full text-[11.5px] font-black uppercase transition-colors"
      style={
        on
          ? { background: locked ? "#FDECEE" : C.red, color: locked ? C.red : "#fff", border: `2px solid ${locked ? "#FDECEE" : C.red}` }
          : { background: "#fff", color: C.mutedFg, border: `2px solid ${C.border}` }
      }
    >
      {icon}
      {label}
      {on && !locked && <span aria-hidden>✓</span>}
    </button>
  );
}

/* ---------------- previzualizare ---------------- */

function BannerPreview({ title, description, kind }: { title: string; description: string; kind: CampaignKind }) {
  return (
    <div className="relative overflow-hidden rounded-[24px] p-5 pr-16" style={{ background: C.campGrad }}>
      <span className="pointer-events-none absolute -right-3 -top-6 text-[120px] font-black leading-none text-white/[0.09]" aria-hidden>
        {kind === "dublu" ? "×2" : kind === "bonus" ? "+" : "★"}
      </span>
      <p className="relative text-[11px] font-black uppercase tracking-[0.2em]" style={{ color: C.orange }}>
        Campania săptămânii
      </p>
      <p className="relative mt-1.5 break-words text-[21px] font-black uppercase leading-[1.05] text-white">{title || "Titlul campaniei"}</p>
      <p className="relative mt-1.5 text-[13px] text-white/95">{description || "Descrierea apare aici."}</p>
      <span className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white p-2.5" style={{ color: C.red }}>
        <ArrowRight size={18} strokeWidth={2.6} />
      </span>
    </div>
  );
}

function PhonePreview({ d }: { d: Draft }) {
  const { s } = useDemo();
  const pts = s.customers[0].points;
  return (
    <div className="relative w-[258px] rounded-[40px] bg-[#111] p-[9px] shadow-[0_30px_60px_-25px_rgba(0,0,0,.45)]">
      <div className="relative h-[486px] overflow-hidden rounded-[32px] bg-white">
        <span className="absolute left-1/2 top-2 z-10 h-[20px] w-[78px] -translate-x-1/2 rounded-full bg-black" aria-hidden />
        {d.push && (
          <div className="a-in absolute inset-x-2 top-9 z-20 rounded-[16px] bg-[#F2F2F2] p-2.5 shadow-[0_10px_24px_-10px_rgba(0,0,0,.35)]">
            <div className="flex items-center gap-1.5">
              <span className="flex size-5 items-center justify-center rounded-[6px] bg-white">
                <Mark size={13} />
              </span>
              <span className="text-[9.5px] font-bold uppercase tracking-[0.06em]" style={{ color: C.mutedFg }}>
                Prosperanța · acum
              </span>
            </div>
            <p className="mt-1 truncate text-[11.5px] font-black">{d.title || "Titlul campaniei"}</p>
            <p className="line-clamp-2 text-[10.5px] leading-snug" style={{ color: "#444" }}>
              {d.description || "Descrierea apare aici."}
            </p>
          </div>
        )}
        <div className="flex items-center justify-between px-3.5 pb-2 pt-9" style={{ borderBottom: `1px solid ${C.border}` }}>
          <span className="flex items-center gap-1.5">
            <Mark size={17} />
            <span className="text-[9.5px] font-black uppercase">Prosperanța</span>
          </span>
          <span className="flex flex-col gap-[3px]" aria-hidden>
            <span className="h-[2px] w-3.5 bg-black" />
            <span className="h-[2px] w-3.5 bg-black" />
            <span className="h-[2px] w-3.5 bg-black" />
          </span>
        </div>
        <div className="space-y-2 p-2.5">
          <div className="rounded-[14px] p-3 text-white" style={{ background: C.heroGrad }}>
            <p className="text-[7px] font-bold uppercase tracking-[0.2em] opacity-90">Puncte disponibile</p>
            <p className="text-[26px] font-black leading-none">
              {num(pts)} <span className="text-[10px]">PUNCTE</span>
            </p>
            <div className="mt-2 h-1.5 rounded-full bg-white/30">
              <div className="h-full w-[80%] rounded-full" style={{ background: C.orange }} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <div className="h-[54px] rounded-[12px] p-2 text-[7.5px] font-black uppercase text-white" style={{ background: C.red }}>
              Voucherele mele
            </div>
            <div className="h-[54px] rounded-[12px] p-2 text-[7.5px] font-black uppercase" style={{ border: `1.5px solid ${C.red}`, color: C.red }}>
              Istoric alimentări
            </div>
          </div>
          <div className="relative overflow-hidden rounded-[14px] p-3 pr-9 ring-2 ring-[#F59E24] ring-offset-2" style={{ background: C.campGrad }}>
            <span className="pointer-events-none absolute -right-1 -top-3 text-[64px] font-black leading-none text-white/[0.09]" aria-hidden>
              {d.kind === "dublu" ? "×2" : d.kind === "bonus" ? "+" : "★"}
            </span>
            <p className="relative text-[7px] font-black uppercase tracking-[0.2em]" style={{ color: C.orange }}>
              Campania săptămânii
            </p>
            <p className="relative mt-1 break-words text-[13px] font-black uppercase leading-[1.05] text-white">{d.title || "Titlul campaniei"}</p>
            <p className="relative mt-1 line-clamp-3 text-[8.5px] leading-snug text-white/95">{d.description || "Descrierea apare aici."}</p>
            <span className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white p-1" style={{ color: C.red }}>
              <ArrowRight size={10} strokeWidth={3} />
            </span>
          </div>
          <div className="rounded-full py-2.5 pl-3.5 text-[8.5px] font-black uppercase text-white" style={{ background: C.red }}>
            Recompensele mele
          </div>
          <div className="rounded-full py-2.5 pl-3.5 text-[8.5px] font-black uppercase" style={{ border: `1.5px solid ${C.red}`, color: C.red }}>
            Cum funcționează
          </div>
        </div>
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
      <CardHead right={<span className="text-[12px] font-bold" style={{ color: C.mutedFg }}>cele mai noi sus</span>}>Campaniile tale</CardHead>
      <ul>
        {s.campaigns.map((c, i) => (
          <li key={c.id} className={`px-5 py-3.5 ${c.draft ? "a-flash" : ""}`} style={{ borderTop: i ? `1px solid ${C.border}` : undefined }}>
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="rounded-full px-2 py-0.5 text-[9.5px] font-black uppercase" style={{ background: "#FDECEE", color: C.red }}>
                    {KIND_LABEL[c.kind]}
                  </span>
                  {c.draft && (
                    <span className="rounded-full px-2 py-0.5 text-[9.5px] font-black uppercase" style={{ background: C.muted, color: C.mutedFg }}>
                      Ciornă
                    </span>
                  )}
                  {shown === c.id && (
                    <span className="rounded-full px-2 py-0.5 text-[9.5px] font-black uppercase text-white" style={{ background: C.green }}>
                      Banner în aplicație acum
                    </span>
                  )}
                </div>
                <p className="mt-1.5 truncate text-[14.5px] font-black uppercase">{c.title}</p>
                <p className="mt-0.5 text-[12px]" style={{ color: C.mutedFg }}>
                  {c.audience} · {num(c.reach)} · {c.period}
                </p>
                {c.joined > 0 && (
                  <p className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-[12px] font-bold">
                    <span className="whitespace-nowrap">
                      <b className="font-black" style={{ color: C.red }}>{num(c.joined)}</b> {de(c.joined)}participanți
                    </span>
                    <span className="whitespace-nowrap">
                      <b className="font-black" style={{ color: C.red }}>{compact(c.litres)} L</b> în campanie
                    </span>
                  </p>
                )}
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={c.active}
                aria-label={`${c.title}: ${c.active ? "activă" : "inactivă"}`}
                onClick={() => toggleCampaign(c.id)}
                className="mt-1 h-8 shrink-0 rounded-full px-3 text-[11px] font-black uppercase transition-colors"
                style={c.active ? { background: C.red, color: "#fff", border: `2px solid ${C.red}` } : { background: "#fff", color: C.fg, border: `2px solid ${C.border}` }}
              >
                {c.active ? "Activă" : c.draft ? "Activează" : "Inactivă"}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/* ---------------- reguli de punctare (setările de combustibil) ---------------- */

function Rules() {
  const { s, setPpl } = useDemo();
  return (
    <Card>
      <CardHead right={<span className="text-[12px] font-bold" style={{ color: C.mutedFg }}>se aplică imediat în stații</span>}>Reguli de punctare</CardHead>
      <p className="px-5 pt-3 text-[12.5px]" style={{ color: C.mutedFg }}>
        Câte puncte primește clientul pentru fiecare litru, în funcție de combustibil.
      </p>
      <ul className="px-3 pb-3 pt-1">
        {FUELS.map((f) => {
          const v = s.ppl[f.id];
          const set = (n: number) => setPpl(f.id, Math.max(0.5, Math.min(5, Math.round(n * 2) / 2)));
          return (
            <li key={f.id} className="flex items-center gap-3 rounded-[12px] px-2 py-2">
              <span className="flex-1 text-[14px] font-black uppercase">{f.label}</span>
              <span className="text-[12px] font-bold" style={{ color: C.mutedFg }}>
                {f.price.toLocaleString("ro-RO")} lei/L
              </span>
              <div className="flex h-9 items-center rounded-full" style={{ background: C.muted }}>
                <button type="button" aria-label={`Scade punctele pentru ${f.label}`} onClick={() => set(v - 0.5)} className="flex size-9 items-center justify-center rounded-full">
                  <Minus size={14} strokeWidth={2.8} />
                </button>
                <span className="tnum w-[62px] text-center text-[14px] font-black" style={{ color: C.red }} aria-live="polite">
                  {String(v).replace(".", ",")} p/L
                </span>
                <button type="button" aria-label={`Crește punctele pentru ${f.label}`} onClick={() => set(v + 0.5)} className="flex size-9 items-center justify-center rounded-full">
                  <Plus size={14} strokeWidth={2.8} />
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
