"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { CheckCircle2, Database, ExternalLink, FolderOpen, Loader2, Plug, Plus, RefreshCw, ShieldCheck, Unplug, X } from "lucide-react";
import type { ContView } from "@/lib/postari/conturi";
import type { Setari } from "@/lib/postari/setari";
import { cn } from "@/lib/utils";
import { ConfirmDialog, InlineNote } from "../ui/actions";
import { relativeRo, timeRo, dateTimeRo } from "../ui/format";
import { Modal } from "../ui/modal";
import { Btn, btnClass, Card, Pill, SectionTitle } from "../ui/primitives";
import { inputClass } from "../ui/states";
import { SoftSelect, TextInput } from "../ui/select";
import { useToast } from "../ui/toast";
import { ScreenHead, UNREACHABLE, type ActionResult } from "./shared";

type SaveResult = { ok: true; message: string } | { ok: false; field?: string; message: string };

export interface DriveInfo {
  /** „Legat, ca tine (OAuth)” sau „Legat, cont de serviciu”; `null` = nu e legat deloc. */
  linked: string | null;
  missingText: string;
  rootName: string | null;
  rootLink: string | null;
  /** Rezultatul citirii folderului la Google: `unset` = nu e ales, `unchecked` = nu s-a putut încerca. */
  rootState: "ok" | "error" | "unset" | "unchecked";
  rootMessage: string | null;
}

export interface StatusItem {
  label: string;
  ok: boolean;
  value: string;
}

const labelClass = "text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground";
const TIMEZONES = ["Europe/Bucharest", "Europe/Chisinau"];
const TZ_LABEL: Record<string, string> = { "Europe/Bucharest": "Europa/București", "Europe/Chisinau": "Europa/Chișinău" };
const GAPS = [0, 5, 10, 15, 30, 45, 60, 90, 120, 180, 360];
const gapLabel = (minutes: number) => (minutes === 0 ? "fără distanță" : minutes === 60 ? "o oră" : minutes % 60 === 0 && minutes > 60 ? `${minutes / 60} ore` : `${minutes} de minute`);

interface Values {
  driveFolder: string;
  slots: string[];
  tz: string;
  capIg: string;
  capTt: string;
  gap: string;
  storage: string;
  email: string;
}

function initialValues(settings: Setari): Values {
  return {
    driveFolder: settings.driveFolderId ?? "",
    slots: [...settings.sloturiOre].sort(),
    tz: settings.sloturiFus,
    capIg: String(settings.plafonInstagram),
    capTt: String(settings.plafonTiktok),
    gap: String(settings.distantaMinimaMin),
    storage: String(settings.stocareLimitaMb),
    email: settings.emailAlerte ?? "",
  };
}

function FieldError({ message }: { message?: string }) {
  return message ? (
    <span role="alert" className="mt-1 block text-[10.5px] text-[#FFC2CE]">
      {message}
    </span>
  ) : null;
}

/** Formularul „Conectează Instagram”: tokenul se lipește o dată, se verifică la Instagram și se salvează criptat. */
function InstagramForm({ replacing, keyProblem, connect, onDone, onCancel }: { replacing: boolean; keyProblem: string | null; connect: (token: string) => Promise<ActionResult>; onDone: () => void; onCancel: () => void }) {
  const { notify } = useToast();
  const [token, setToken] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        startTransition(async () => {
          try {
            const result = await connect(token);
            if (result.ok) {
              notify(result.message);
              onDone();
            } else setError(result.message);
          } catch {
            setError(UNREACHABLE);
          }
        });
      }}
    >
      <h2 className="text-[16px] font-semibold">{replacing ? "Înlocuiește tokenul Instagram" : "Conectează Instagram"}</h2>
      <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">Tokenul se verifică la Instagram, apoi se salvează criptat. Nu se mai vede după salvare și nu ajunge niciodată înapoi în browser.</p>
      {keyProblem ? <InlineNote tone="apricot" className="mt-3">{keyProblem}</InlineNote> : null}
      <label className="mt-4 block">
        <span className={labelClass}>Tokenul din panoul Meta</span>
        <textarea
          value={token}
          onChange={(event) => setToken(event.target.value)}
          rows={3}
          autoComplete="off"
          spellCheck={false}
          autoFocus
          className={inputClass("mt-1.5 h-auto py-2 font-mono text-[12px]")}
          aria-describedby="ig-token-ajutor"
        />
      </label>
      <p id="ig-token-ajutor" className="mt-2 text-[10.5px] leading-relaxed text-muted-foreground">
        developers.facebook.com → aplicația → Instagram → <em>API setup with Instagram business login</em> → <em>Generate token</em> lângă contul Meridian. Pașii întregi sunt în README, la „Instagram”.
      </p>
      {error ? (
        <InlineNote tone="rose" className="mt-3">
          <span role="alert">{error}</span>
        </InlineNote>
      ) : null}
      <div className="mt-5 flex justify-end gap-2">
        <Btn variant="ghost" onClick={onCancel}>
          Renunță
        </Btn>
        <Btn type="submit" variant="primary" icon={pending ? Loader2 : Plug} disabled={pending || token.trim().length < 20 || Boolean(keyProblem)}>
          {pending ? "Se verifică la Instagram…" : replacing ? "Înlocuiește tokenul" : "Conectează Instagram"}
        </Btn>
      </div>
    </form>
  );
}

/**
 * Setările, ca în prototip: șase carduri — Drive, sloturi, plafoane, alerte,
 * conturi, starea programării — și „Salvează setările” sus, activ doar cât
 * e ceva nesalvat. Tot ce se salvează trece prin aceeași acțiune de server ca
 * înainte (validată cu Zod); conturile și testul Drive au acțiunile lor.
 */
export function SettingsScreen({
  settings,
  drive,
  status,
  cron,
  alertTo,
  instagram,
  tiktok,
  tiktokMissing,
  redirectUri,
  keyProblem,
  notice,
  now,
  save,
  checkDrive,
  connectInstagram,
  disconnect,
}: {
  settings: Setari;
  drive: DriveInfo;
  status: StatusItem[];
  cron: { lastAt: string | null; fresh: boolean };
  alertTo: string;
  instagram: ContView | null;
  tiktok: ContView | null;
  tiktokMissing: string | null;
  redirectUri: string;
  keyProblem: string | null;
  notice: { tone: "mint" | "apricot" | "rose"; text: string } | null;
  now: number;
  save: (raw: unknown) => Promise<SaveResult>;
  checkDrive: () => Promise<SaveResult>;
  connectInstagram: (token: string) => Promise<ActionResult>;
  disconnect: (platform: "instagram" | "tiktok") => Promise<ActionResult>;
}) {
  const router = useRouter();
  const { notify } = useToast();
  const [values, setValues] = useState<Values>(() => initialValues(settings));
  const [saved, setSaved] = useState<Values>(() => initialValues(settings));
  const [newSlot, setNewSlot] = useState("09:00");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, startSaving] = useTransition();
  const [testing, setTesting] = useState(false);
  const [igOpen, setIgOpen] = useState(false);
  const [leaving, setLeaving] = useState<"instagram" | "tiktok" | null>(null);

  const dirty = useMemo(() => JSON.stringify(values) !== JSON.stringify(saved), [values, saved]);
  const set = <K extends keyof Values>(key: K, value: Values[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!(key in current)) return current;
      const copy = { ...current };
      delete copy[key as string];
      return copy;
    });
  };

  const capIgNumber = Number(values.capIg);
  const timezones = TIMEZONES.includes(values.tz) ? TIMEZONES : [...TIMEZONES, values.tz];
  const gaps = GAPS.includes(Number(values.gap)) ? GAPS : [...GAPS, Number(values.gap)].sort((a, b) => a - b);
  // Câmpurile din acțiune (numele de acolo) față de cele de aici.
  const FIELD: Record<string, keyof Values> = { driveFolder: "driveFolder", sloturiOre: "slots", sloturiFus: "tz", plafonInstagram: "capIg", plafonTiktok: "capTt", distantaMinimaMin: "gap", stocareLimitaMb: "storage", emailAlerte: "email" };

  function submit() {
    startSaving(async () => {
      try {
        const result = await save({
          driveFolder: values.driveFolder,
          sloturiOre: values.slots.join(", "),
          sloturiFus: values.tz,
          plafonInstagram: values.capIg,
          plafonTiktok: values.capTt,
          distantaMinimaMin: values.gap,
          stocareLimitaMb: values.storage,
          emailAlerte: values.email,
        });
        if (!result.ok) {
          const key = result.field ? FIELD[result.field] : undefined;
          if (key) setErrors({ [key]: result.message });
          notify(result.message, "error");
          return;
        }
        setErrors({});
        setSaved(values);
        notify(result.message === "Salvat." ? "Setările au fost salvate. Următoarea rulare le folosește." : `${result.message} Următoarea rulare le folosește.`);
        router.refresh();
      } catch {
        notify("Serverul n-a răspuns (rețea sau sesiune). Nu s-a salvat nimic; încearcă din nou.", "error");
      }
    });
  }

  async function testDrive() {
    setTesting(true);
    try {
      const result = await checkDrive();
      notify(result.message, result.ok ? "default" : "error");
    } catch {
      notify(UNREACHABLE, "error");
    } finally {
      setTesting(false);
    }
  }

  function addSlot() {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(newSlot)) {
      setErrors((current) => ({ ...current, slots: "Alege o oră validă, HH:MM." }));
      return;
    }
    if (values.slots.includes(newSlot)) return;
    set("slots", [...values.slots, newSlot].sort());
  }

  const daysLeft = (iso: string | null) => (iso ? Math.ceil((new Date(iso).getTime() - now) / 86_400_000) : null);

  /** Un cont (rând), ca în prototip. Funcție, nu componentă: stă în același render ca formularul. */
  function accountRow(platform: "instagram" | "tiktok", label: string, account: ContView | null) {
    const connected = account !== null && account.stare === "activ";
    const left = daysLeft(platform === "instagram" ? account?.tokenExpiraLa ?? null : account?.refreshExpiraLa ?? null);
    const stateText = !account ? "neconectat" : account.stare === "activ" ? "conectat" : account.stare === "expirat" ? "expirat" : "eroare";
    const line = !account
      ? platform === "instagram"
        ? "nu poate trimite — postările Instagram așteaptă în coadă"
        : "nu poate trimite — postările TikTok așteaptă în coadă"
      : account.stare === "expirat"
        ? "token expirat — nu poate trimite"
        : account.stare === "eroare"
          ? (account.eroare ?? "eroare la ultima verificare")
          : platform === "instagram"
            ? left === null
              ? "token valid, fără dată de expirare știută; se reînnoiește singur, săptămânal"
              : `token valid, expiră în ${Math.max(left, 0)} ${left === 1 ? "zi" : "zile"}; se reînnoiește singur, săptămânal`
            : left === null
              ? "accesul se reînnoiește singur, zilnic"
              : `accesul se reînnoiește singur, zilnic; conectarea ține încă ${Math.max(left, 0)} ${left === 1 ? "zi" : "zile"}`;
    return (
      <li key={platform} className="rounded-xl border border-white/[0.07] px-3 py-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <p className="min-w-[7rem] flex-1 text-[12.5px]">
            {label} {account?.nume ? <span className="text-muted-foreground">· {account.nume}</span> : null}
          </p>
          <Pill tone={connected ? "mint" : "rose"} dot>
            {stateText}
          </Pill>
          {platform === "instagram" ? (
            <Btn size="xs" variant="outline" icon={Plug} onClick={() => setIgOpen(true)}>
              {account ? (connected ? "Înlocuiește tokenul" : "Reconectează") : "Conectează"}
            </Btn>
          ) : tiktokMissing ? null : (
            // Ruta de server redirecționează spre TikTok: are nevoie de încărcare completă, nu de navigarea din client.
            // eslint-disable-next-line @next/next/no-html-link-for-pages
            <a
              href="/admin/postari/conturi/tiktok"
              className={btnClass({ variant: "outline", size: "xs", className: cn("gap-1.5", keyProblem && "pointer-events-none opacity-45") })}
              aria-disabled={keyProblem ? true : undefined}
            >
              <Plug className="h-3.5 w-3.5" aria-hidden="true" /> {account ? (connected ? "Reconectează" : "Conectează din nou") : "Conectează"}
            </a>
          )}
          {account ? (
            <Btn size="xs" variant="ghost" icon={Unplug} onClick={() => setLeaving(platform)}>
              Deconectează
            </Btn>
          ) : null}
        </div>
        <p className={cn("mt-1 text-[10.5px]", connected ? "text-mint" : "text-rose")}>{line}</p>
        {account ? (
          <p className="mt-1 text-[10.5px] leading-relaxed text-muted-foreground">
            Conectat {dateTimeRo(account.conectatLa)} de {account.conectatDe}.
            {account.reinnoitLa ? ` Ultima reînnoire ${dateTimeRo(account.reinnoitLa)}.` : ""}
            {account.eroare && account.stare === "activ" ? <span className="text-[#FFC2CE]"> {account.eroare}</span> : null}
          </p>
        ) : platform === "tiktok" && tiktokMissing ? (
          <p className="mt-1.5 text-[10.5px] leading-relaxed text-[#FFD0AC]">{tiktokMissing}</p>
        ) : null}
      </li>
    );
  }

  return (
    <div className="space-y-4">
      <ScreenHead
        title="Setări"
        text="Drive, sloturi, plafoane, conturi și starea programării."
        actions={
          <>
            {dirty ? <Pill tone="apricot">nesalvat</Pill> : null}
            <Btn size="sm" variant="primary" disabled={!dirty || saving} icon={saving ? Loader2 : undefined} onClick={submit}>
              {saving ? "Se salvează…" : "Salvează setările"}
            </Btn>
          </>
        }
      />

      {notice ? (
        <InlineNote tone={notice.tone}>
          <span role={notice.tone === "mint" ? "status" : "alert"}>{notice.text}</span>
        </InlineNote>
      ) : null}
      <p className="text-[10.5px] text-muted-foreground">Cheile (Google, Anthropic, TikTok) stau doar în Vercel; tokenurile conturilor stau criptate în Supabase.</p>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionTitle
            title="Folderul principal de pe Drive"
            hint="de aici se citesc loturile și manifestele"
            action={
              <Pill tone={drive.rootState === "ok" ? "mint" : drive.rootState === "error" ? "rose" : "neutral"} dot>
                {drive.rootState === "ok" ? "conectat" : drive.rootState === "error" ? "nu se vede" : drive.rootState === "unset" ? "neales" : "necitit"}
              </Pill>
            }
          />
          <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10.5px] text-muted-foreground">
            Legătura (aceeași ca la adminul firmei):{" "}
            {drive.linked ? <span className="text-mint">{drive.linked}</span> : <span className="text-[#FFD0AC]">{drive.missingText}</span>}
          </p>
          <label className="mt-3 block">
            <span className={labelClass}>Adresa folderului sau id-ul</span>
            <div className="relative mt-1">
              <FolderOpen className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <TextInput className="pl-9 font-mono text-[11.5px]" placeholder="https://drive.google.com/drive/folders/…" value={values.driveFolder} aria-invalid={errors.driveFolder ? true : undefined} onChange={(event) => set("driveFolder", event.target.value)} />
            </div>
            <FieldError message={errors.driveFolder} />
          </label>
          {drive.rootState === "ok" && drive.rootName && drive.rootLink ? (
            <p className="mt-2 text-[11px] text-muted-foreground">
              Acum:{" "}
              <a href={drive.rootLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-lav underline-offset-2 hover:underline">
                {drive.rootName} <ExternalLink className="h-3 w-3" aria-hidden="true" />
                <span className="sr-only">(filă nouă)</span>
              </a>
              . Planurile scriu subfolderul, ex. „{drive.rootName}/lot-1”.
            </p>
          ) : null}
          {drive.rootState === "error" && drive.rootMessage ? <InlineNote tone="rose" className="mt-3">{drive.rootMessage}</InlineNote> : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <Btn size="sm" variant="outline" icon={testing ? Loader2 : RefreshCw} onClick={() => void testDrive()} disabled={testing || dirty}>
              {testing ? "Se testează…" : "Testează conexiunea"}
            </Btn>
            <Btn
              size="sm"
              variant="ghost"
              icon={Unplug}
              disabled={!values.driveFolder}
              onClick={() => {
                set("driveFolder", "");
                notify("Folderul se scoate la „Salvează setările”. Fără el, coada nu mai citește clipuri.", "warn");
              }}
            >
              Deconectează
            </Btn>
          </div>
          {dirty ? <p className="mt-2 text-[10.5px] text-muted-foreground">Testul folosește folderul salvat: salvează întâi schimbările.</p> : null}
          {drive.rootState === "ok" ? (
            <p className="mt-2 flex items-center gap-1.5 text-[10.5px] text-muted-foreground">
              <CheckCircle2 className="h-3 w-3 text-mint" aria-hidden="true" /> citire permisă · scriere nu
            </p>
          ) : null}
        </Card>

        <Card>
          <SectionTitle title="Sloturi implicite" hint="orele propuse când nu scrii una" />
          <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Sloturile alese">
            {values.slots.map((slot) => (
              <li key={slot} className="inline-flex items-center gap-1 rounded-full border border-white/[0.1] bg-white/[0.04] px-2.5 py-1 font-mono text-[11.5px]">
                {slot}
                <button type="button" aria-label={`Scoate slotul ${slot}`} onClick={() => set("slots", values.slots.filter((item) => item !== slot))} className="text-muted-foreground hover:text-rose">
                  <X className="h-3 w-3" aria-hidden="true" />
                </button>
              </li>
            ))}
            {values.slots.length === 0 ? <li className="text-[11.5px] text-[#FFC2CE]">Adaugă cel puțin un slot.</li> : null}
          </ul>
          <FieldError message={errors.slots} />
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <label className="block">
              <span className={labelClass}>Slot nou</span>
              <TextInput type="time" className="mt-1 w-[132px]" value={newSlot} onChange={(event) => setNewSlot(event.target.value)} />
            </label>
            <Btn size="sm" variant="outline" icon={Plus} onClick={addSlot}>
              Adaugă
            </Btn>
            <SoftSelect
              label="Fus orar"
              value={values.tz}
              onChange={(value) => set("tz", value)}
              options={timezones.map((zone) => ({ value: zone, label: TZ_LABEL[zone] ?? zone }))}
              className="ml-auto w-[150px]"
            />
          </div>
          <FieldError message={errors.tz} />
          <p className="mt-3 text-[10.5px] leading-relaxed text-muted-foreground">Un plan fără „sloturi” proprii folosește orele de aici, începând de mâine. O postare fără oră ia următorul slot liber.</p>
        </Card>

        <Card>
          <SectionTitle title="Plafoane pe 24 de ore" hint="platforma refuză peste limită" />
          <div className="mt-3 grid grid-cols-2 gap-3">
            <label className="block">
              <span className={labelClass}>Instagram</span>
              <TextInput type="number" min={1} max={100} className="mt-1" value={values.capIg} aria-invalid={errors.capIg ? true : undefined} onChange={(event) => set("capIg", event.target.value)} />
              <span className="mt-1 block text-[10px] text-muted-foreground">cota citită din API: 50 (cel mult 100)</span>
              <FieldError message={errors.capIg} />
            </label>
            <label className="block">
              <span className={labelClass}>TikTok</span>
              <TextInput type="number" min={1} max={5} className="mt-1" value={values.capTt} aria-invalid={errors.capTt ? true : undefined} onChange={(event) => set("capTt", event.target.value)} />
              <span className="mt-1 block text-[10px] text-muted-foreground">limita platformei: 5 ciorne nepublicate</span>
              <FieldError message={errors.capTt} />
            </label>
          </div>
          {capIgNumber > 100 ? <InlineNote tone="rose" className="mt-3">Instagram: plafonul e între 1 și 100. Salvarea va fi refuzată.</InlineNote> : null}
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <SoftSelect label="Distanța minimă între postări" value={values.gap} onChange={(value) => set("gap", value)} options={gaps.map((minutes) => ({ value: String(minutes), label: gapLabel(minutes) }))} />
              <FieldError message={errors.gap} />
            </div>
            <label className="block">
              <span className="mb-1 block text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">Stocare temporară (MB / fișier)</span>
              <TextInput type="number" min={1} max={5000} value={values.storage} aria-invalid={errors.storage ? true : undefined} onChange={(event) => set("storage", event.target.value)} />
              <span className="mt-1 block text-[10px] text-muted-foreground">planul gratuit Supabase: 50 MB</span>
              <FieldError message={errors.storage} />
            </label>
          </div>
          <p className="mt-3 text-[10.5px] leading-relaxed text-muted-foreground">Distanța se ține pe aceeași platformă: două postări mai apropiate sunt suprapuse.</p>
        </Card>

        <Card>
          <SectionTitle title="Alerte" hint="unde primești eșecurile" />
          <label className="mt-3 block">
            <span className={labelClass}>Email pentru alerte</span>
            <TextInput type="text" inputMode="email" className="mt-1" placeholder="tu@exemplu.ro" value={values.email} aria-invalid={errors.email ? true : undefined} onChange={(event) => set("email", event.target.value)} />
            <FieldError message={errors.email} />
          </label>
          <p className="mt-2 text-[10.5px] leading-relaxed text-muted-foreground">
            Primești email la o postare eșuată definitiv, la un token care nu se mai reînnoiește (coada se oprește) și la un cont care expiră curând. Fără rapoarte zilnice. Mai multe adrese: separate prin virgulă. Gol = adresele din ADMIN_EMAILS.
          </p>
          {alertTo ? <p className="mt-1.5 text-[10.5px] text-muted-foreground">Acum pleacă la: <span className="text-foreground/80">{alertTo}</span></p> : null}
        </Card>

        <Card id="conturi" className="scroll-mt-24">
          <SectionTitle title="Conturi" hint="tokenul se verifică la fiecare rulare" />
          {keyProblem ? <InlineNote tone="apricot" className="mt-3">{keyProblem}</InlineNote> : null}
          <ul className="mt-3 space-y-2">
            {accountRow("instagram", "Instagram", instagram)}
            {accountRow("tiktok", "TikTok", tiktok)}
          </ul>
          <p className="mt-3 text-[10.5px] leading-relaxed text-muted-foreground">
            Adresa de întoarcere, de pus în aplicația TikTok (Login Kit → Redirect URI): <span className="select-all break-all font-mono text-foreground/80">{redirectUri}</span>
          </p>
        </Card>

        <Card>
          <SectionTitle title="Starea programării" hint="cine rulează coada" />
          <ul className="mt-3 space-y-2 text-[12px]">
            <li className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Supabase Cron</span>
              <span className={cn("flex items-center gap-1.5", cron.fresh ? "text-mint" : "text-rose")}>
                <Database className="h-3 w-3" aria-hidden="true" /> {cron.fresh ? "da, la fiecare 5 minute" : cron.lastAt ? "nu pare să ruleze" : "n-a rulat încă"}
              </span>
            </li>
            <li className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Ultima rulare</span>
              <span>{cron.lastAt ? `${timeRo(cron.lastAt)} (${relativeRo(cron.lastAt, now)})` : "n-a rulat niciodată"}</span>
            </li>
            <li className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Următoarea</span>
              <span>{settings.coadaPornita && cron.fresh ? "în cel mult 5 minute" : "—"}</span>
            </li>
            <li className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Coada</span>
              <span className={settings.coadaPornita ? "text-mint" : "text-rose"}>{settings.coadaPornita ? "pornită" : "oprită"}</span>
            </li>
          </ul>
          <ul className="mt-3 space-y-2 border-t border-white/[0.06] pt-3">
            {status.map((item) => (
              <li key={item.label} className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11.5px] text-muted-foreground">{item.label}</p>
                  <p className="text-[10.5px] leading-relaxed text-muted-foreground/80">{item.value}</p>
                </div>
                <Pill tone={item.ok ? "mint" : "apricot"}>{item.ok ? "da" : "nu"}</Pill>
              </li>
            ))}
          </ul>
          <p className="mt-3 flex items-start gap-1.5 text-[10.5px] leading-relaxed text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-3 w-3 shrink-0 text-mint" aria-hidden="true" />
            Dacă rularea nu pornește, postările rămân în coadă și pleacă la prima rulare următoare, în 6 ore de la ora lor. După, le repui cu „Reîncearcă”. Nimic nu se pierde.
          </p>
        </Card>
      </div>

      <Modal open={igOpen} onOpenChange={setIgOpen} label="Conectează Instagram">
        <InstagramForm replacing={Boolean(instagram)} keyProblem={keyProblem} connect={connectInstagram} onCancel={() => setIgOpen(false)} onDone={() => { setIgOpen(false); router.refresh(); }} />
      </Modal>

      <ConfirmDialog
        open={leaving !== null}
        onOpenChange={(open) => !open && setLeaving(null)}
        title={leaving === "tiktok" ? "Deconectezi TikTok?" : "Deconectezi Instagram?"}
        description="Tokenul se șterge din admin. Postările acestui cont așteaptă în coadă până îl conectezi din nou."
        consequence={leaving === "tiktok" ? "Accesul se revocă și la TikTok. Clipurile nu mai ajung în ciorne până reconectezi." : "Instagram nu mai primește nimic de la coadă până lipești un token nou."}
        confirmLabel="Deconectează"
        onConfirm={async () => {
          if (!leaving) return;
          try {
            const result = await disconnect(leaving);
            notify(result.message, result.ok ? "warn" : "error");
          } catch {
            notify(UNREACHABLE, "error");
          }
          router.refresh();
        }}
      />
    </div>
  );
}
