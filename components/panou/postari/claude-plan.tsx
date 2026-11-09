"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { PLAN_FORMAT } from "@/lib/postari/plan-schema";
import { isDay, isTime } from "@/lib/postari/timp";
import { cn } from "@/lib/utils";
import { InlineNote } from "../ui/actions";
import { Btn, Card, SectionTitle } from "../ui/primitives";
import { SoftSelect, TextInput } from "../ui/select";
import { inputClass } from "../ui/states";
import { PLAN_DRAFT_KEY, PLAN_SOURCE_KEY } from "./shared";

type Caption = { fisier: string; descriere: string; hashtaguri: string[] };
type CaptionsResponse = { ok: true; captions: Caption[]; missing: string[] } | { ok: false; message: string };
type WriteInput = { folder: string; fisiere: string[]; indicatii: string; deja: string[]; ultimul: boolean };

/** Câte clipuri scrie Claude într-o cerere (aceeași valoare ca pe server: `CLAUDE_BATCH`). */
const BATCH = 5;

const labelClass = "text-[12px] uppercase tracking-[0.12em] text-muted-foreground";

function hasDraft(): boolean {
  try {
    return Boolean(window.localStorage.getItem(PLAN_DRAFT_KEY)?.trim());
  } catch {
    return false;
  }
}

/**
 * „Scrie planul cu Claude”, sub lotul cu manifest.json: Claude scrie
 * descrierea și hashtag-urile fiecărui clip, pe loturi de câte 5, apoi planul
 * (cu opțiunile alese aici) ajunge în „Plan nou”, unde îl corectezi, îl
 * verifici și îl aprobi. Nimic nu intră în coadă de aici.
 */
export function ClaudePlan({
  folder,
  folderPath,
  lot,
  clips,
  defaults,
  configured,
  write,
}: {
  folder: string;
  folderPath: string;
  lot: string | null;
  clips: string[];
  defaults: { ore: string[]; fus: string; start: string };
  configured: boolean;
  write: (input: WriteInput) => Promise<CaptionsResponse>;
}) {
  const router = useRouter();
  const [instagram, setInstagram] = useState(true);
  const [tiktok, setTiktok] = useState(true);
  const [tip, setTip] = useState<"reel" | "trial_reel">("reel");
  const [absolvire, setAbsolvire] = useState<"manual" | "automat">("manual");
  const [start, setStart] = useState(defaults.start);
  const [ore, setOre] = useState(defaults.ore.join(", "));
  const [indicatii, setIndicatii] = useState("");
  const [written, setWritten] = useState<Caption[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draftExists, setDraftExists] = useState(false);
  const stop = useRef(false);

  useEffect(() => setDraftExists(hasDraft()), []);

  const hours = ore
    .split(/[,\s]+/)
    .map((hour) => hour.trim())
    .filter(Boolean)
    .map((hour) => (/^\d:\d\d$/.test(hour) ? `0${hour}` : hour));
  const hoursOk = hours.length > 0 && hours.every(isTime);
  const startOk = isDay(start);
  const platforms = [instagram ? "instagram" : null, tiktok ? "tiktok" : null].filter((value): value is "instagram" | "tiktok" => value !== null);
  const remaining = clips.filter((name) => !written.some((caption) => caption.fisier === name));
  const canRun = configured && clips.length > 0 && platforms.length > 0 && hoursOk && startOk && !running;

  function buildPlan(captions: Caption[]) {
    return {
      format: PLAN_FORMAT,
      nume: lot ?? folderPath.split("/").pop() ?? null,
      folder: folderPath,
      sloturi: { start, ore: [...new Set(hours)].sort(), fus: defaults.fus },
      postari: clips.map((name) => {
        const caption = captions.find((item) => item.fisier === name);
        return {
          fisier: name,
          platforme: platforms,
          ora: null,
          descriere: caption?.descriere ?? "",
          hashtaguri: caption?.hashtaguri ?? [],
          instagram: instagram ? (tip === "trial_reel" ? { tip, absolvire } : { tip }) : undefined,
          tiktok: tiktok ? { mod: "ciorna" } : undefined,
        };
      }),
    };
  }

  function openInEditor(captions: Caption[]) {
    try {
      window.localStorage.setItem(PLAN_DRAFT_KEY, JSON.stringify(buildPlan(captions), null, 2));
      window.sessionStorage.setItem(PLAN_SOURCE_KEY, "claude");
    } catch {
      setError("Browserul blochează stocarea locală. Deschide adminul într-o fereastră obișnuită.");
      return;
    }
    router.push("/admin/postari/plan");
  }

  async function run() {
    setError(null);
    setRunning(true);
    stop.current = false;
    let done = [...written];
    try {
      const queue = clips.filter((name) => !done.some((caption) => caption.fisier === name));
      for (let i = 0; i < queue.length; i += BATCH) {
        if (stop.current) return;
        const batch = queue.slice(i, i + BATCH);
        const response = await write({ folder, fisiere: batch, indicatii, deja: done.map((caption) => caption.descriere), ultimul: i + BATCH >= queue.length });
        if (!response.ok) {
          setError(response.message);
          return;
        }
        // Un clip pe care Claude l-a sărit primește descriere goală (de scris în editor), ca lotul să meargă mai departe.
        done = [...done, ...response.captions, ...response.missing.map((fisier) => ({ fisier, descriere: "", hashtaguri: [] }))];
        setWritten(done);
      }
      openInEditor(done);
    } catch {
      setError("Serverul n-a răspuns. Ce s-a scris rămâne; apasă „Continuă”.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <Card id="scrie-plan" className="scroll-mt-24">
      <SectionTitle
        title={
          <span className="inline-flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-lav" aria-hidden="true" /> Scrie planul cu Claude
          </span>
        }
        info="Planul ajunge în „Plan nou”, de corectat și verificat. Nimic nu intră în coadă de aici."
      />

      {!configured ? (
        <InlineNote tone="apricot" className="mt-4">
          Lipsește ANTHROPIC_API_KEY în Vercel. Planul se scrie de mână, la Plan nou.
        </InlineNote>
      ) : (
        <div className="mt-4 space-y-4">
          <fieldset className="space-y-2">
            <legend className={labelClass}>Platforme</legend>
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              <label className="inline-flex min-h-8 items-center gap-2 text-[14px]">
                <input type="checkbox" checked={instagram} onChange={(event) => setInstagram(event.currentTarget.checked)} className="h-4 w-4 accent-[#C6B5FF]" />
                Instagram
              </label>
              <label className="inline-flex min-h-8 items-center gap-2 text-[14px]">
                <input type="checkbox" checked={tiktok} onChange={(event) => setTiktok(event.currentTarget.checked)} className="h-4 w-4 accent-[#C6B5FF]" />
                TikTok, în ciorne
              </label>
            </div>
          </fieldset>

          {instagram ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <SoftSelect
                label="Tip Instagram"
                value={tip}
                onChange={(value) => setTip(value as "reel" | "trial_reel")}
                options={[
                  { value: "reel", label: "Reel" },
                  { value: "trial_reel", label: "Trial Reel" },
                ]}
              />
              {tip === "trial_reel" ? (
                <SoftSelect
                  label="Trecerea la urmăritori"
                  value={absolvire}
                  onChange={(value) => setAbsolvire(value as "manual" | "automat")}
                  options={[
                    { value: "manual", label: "Manual, din aplicație" },
                    { value: "automat", label: "Automat, dacă merge" },
                  ]}
                />
              ) : null}
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className={labelClass}>Începe din</span>
              <TextInput type="date" className="mt-1" value={start} aria-invalid={startOk ? undefined : true} onChange={(event) => setStart(event.target.value)} />
              {startOk ? null : <span className="mt-1 block text-[13px] text-[#FFC2CE]">Alege o zi.</span>}
            </label>
            <label className="block">
              <span className={labelClass}>Ore</span>
              <TextInput className="mt-1" value={ore} aria-invalid={hoursOk ? undefined : true} onChange={(event) => setOre(event.target.value)} />
              <span className={cn("mt-1 block text-[13px]", hoursOk ? "text-muted-foreground" : "text-[#FFC2CE]")}>
                {hoursOk ? defaults.fus : "Scrie orele ca „12:30, 19:00”."}
              </span>
            </label>
          </div>

          <label className="block">
            <span className={labelClass}>Indicații (opțional)</span>
            <textarea
              value={indicatii}
              onChange={(event) => setIndicatii(event.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="oferta lunii, orașul, publicul, un cuvânt de evitat"
              className={inputClass("mt-1 h-auto py-2 leading-relaxed")}
            />
          </label>

          <div className="flex flex-wrap items-center gap-3">
            <Btn size="sm" variant="primary" icon={running ? Loader2 : Sparkles} disabled={!canRun} onClick={() => void run()}>
              {running ? "Claude scrie…" : written.length > 0 && remaining.length > 0 ? "Continuă" : `Scrie planul (${clips.length})`}
            </Btn>
            {running ? (
              <Btn size="sm" variant="outline" onClick={() => (stop.current = true)}>
                Oprește
              </Btn>
            ) : written.length > 0 ? (
              <Btn size="sm" variant="outline" onClick={() => openInEditor(written)}>
                Deschide în editor
              </Btn>
            ) : null}
            <p role="status" aria-live="polite" className={cn("text-[13px]", error ? "text-[#FFC2CE]" : "text-muted-foreground")}>
              {running ? `${written.length} din ${clips.length} scrise` : error ? error : platforms.length === 0 ? "Alege cel puțin o platformă." : null}
            </p>
          </div>
          {draftExists && !running ? <p className="text-[13px] text-[#FFD0AC]">Înlocuiește ciorna din „Plan nou”.</p> : null}
        </div>
      )}
    </Card>
  );
}
