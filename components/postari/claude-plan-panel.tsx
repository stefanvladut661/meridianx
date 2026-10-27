"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { PLAN_FORMAT } from "@/lib/postari/plan-schema";
import { isDay, isTime } from "@/lib/postari/timp";
import { cn } from "@/lib/utils";
import { PLAN_DRAFT_KEY, PLAN_SOURCE_KEY } from "./plan-editor";
import { btnPrimary, btnSecondary, Field, inputClass, labelClass, Notice, textareaClass } from "./ui";

type Caption = { fisier: string; descriere: string; hashtaguri: string[] };
type CaptionsResponse = { ok: true; captions: Caption[]; missing: string[] } | { ok: false; message: string };
type WriteInput = { folder: string; fisiere: string[]; indicatii: string; deja: string[]; ultimul: boolean };

const BATCH = 5;

function hasDraft(): boolean {
  try {
    return Boolean(window.localStorage.getItem(PLAN_DRAFT_KEY)?.trim());
  } catch {
    return false;
  }
}

/**
 * „Scrie planul cu Claude”, sub manifest.json: Claude scrie descrierile pe
 * loturi de câte 5 clipuri, apoi planul (cu opțiunile alese aici) ajunge în
 * editorul de la „Plan nou”, unde îl corectezi, îl verifici și îl aprobi.
 * Nimic nu intră în coadă de aici.
 */
export function ClaudePlanPanel({
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

  const hours = ore.split(/[,\s]+/).map((hour) => hour.trim()).filter(Boolean).map((hour) => (/^\d:\d\d$/.test(hour) ? `0${hour}` : hour));
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
      setError("Browserul nu lasă salvarea planului (stocare locală blocată). Deschide adminul într-o fereastră obișnuită.");
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
      setError("Serverul n-a răspuns (rețea sau sesiune). Descrierile scrise până acum rămân; apasă „Continuă”.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <section aria-labelledby="claude-plan" className="mt-4 max-w-3xl rounded-xl border border-hair bg-white px-4 py-4 sm:px-5">
      <h3 id="claude-plan" className="text-[15px] font-semibold text-bone">
        Scrie planul cu Claude
      </h3>
      <p className="mt-0.5 text-[13.5px] text-dim">
        Claude scrie descrierea și hashtag-urile fiecărui clip din hook, CTA și voce. Planul ajunge la „Plan nou”, unde îl corectezi și îl verifici. Nimic nu intră în coadă de aici.
      </p>

      {!configured ? (
        <Notice tone="warn" className="mt-3">
          Claude nu e legat: lipsește ANTHROPIC_API_KEY în Vercel. Planul se poate scrie și de mână, la Plan nou.
        </Notice>
      ) : (
        <div className="mt-4 grid gap-4">
          <fieldset className="grid gap-2">
            <legend className={labelClass}>Platformele</legend>
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              <label className="inline-flex min-h-9 items-center gap-2 text-[14px] text-bone">
                <input type="checkbox" checked={instagram} onChange={(event) => setInstagram(event.currentTarget.checked)} className="size-4 accent-[var(--md-a1)]" />
                Instagram
              </label>
              <label className="inline-flex min-h-9 items-center gap-2 text-[14px] text-bone">
                <input type="checkbox" checked={tiktok} onChange={(event) => setTiktok(event.currentTarget.checked)} className="size-4 accent-[var(--md-a1)]" />
                TikTok, în ciorne
              </label>
            </div>
          </fieldset>

          {instagram ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="cp-tip" label="Pe Instagram, ca">
                <select id="cp-tip" value={tip} onChange={(event) => setTip(event.currentTarget.value as "reel" | "trial_reel")} className={inputClass}>
                  <option value="reel">Reel (la urmăritori și în feed)</option>
                  <option value="trial_reel">Trial Reel (întâi la cei care nu te urmăresc)</option>
                </select>
              </Field>
              {tip === "trial_reel" ? (
                <Field id="cp-absolvire" label="Trecerea la urmăritori">
                  <select id="cp-absolvire" value={absolvire} onChange={(event) => setAbsolvire(event.currentTarget.value as "manual" | "automat")} className={inputClass}>
                    <option value="manual">O fac eu, din aplicație</option>
                    <option value="automat">Singur, dacă merge bine</option>
                  </select>
                </Field>
              ) : null}
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="cp-start" label="Sloturile încep din" error={startOk ? null : "Alege o zi."}>
              <input id="cp-start" type="date" value={start} onChange={(event) => setStart(event.currentTarget.value)} className={inputClass} aria-invalid={startOk ? undefined : true} />
            </Field>
            <Field id="cp-ore" label="Orele sloturilor" hint={`În fusul ${defaults.fus}. Postările iau sloturile pe rând, în ordinea din manifest.`} error={hoursOk ? null : "Scrie orele ca „12:30, 19:00”."}>
              <input id="cp-ore" value={ore} onChange={(event) => setOre(event.currentTarget.value)} className={inputClass} aria-invalid={hoursOk ? undefined : true} />
            </Field>
          </div>

          <Field id="cp-indicatii" label="Indicații pentru Claude (opțional)" hint="De exemplu: oferta lunii, orașul, publicul, un cuvânt de evitat. Claude nu inventează prețuri, cifre sau clienți.">
            <textarea id="cp-indicatii" value={indicatii} onChange={(event) => setIndicatii(event.currentTarget.value)} rows={3} maxLength={2000} className={textareaClass} />
          </Field>

          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => void run()} disabled={!canRun} className={btnPrimary}>
              {running ? "Claude scrie…" : written.length > 0 && remaining.length > 0 ? "Continuă" : `Scrie planul pentru ${clips.length} ${clips.length === 1 ? "clip" : "clipuri"}`}
            </button>
            {running ? (
              <button type="button" onClick={() => (stop.current = true)} className={btnSecondary}>
                Oprește după lotul ăsta
              </button>
            ) : written.length > 0 ? (
              <button type="button" onClick={() => openInEditor(written)} className={btnSecondary}>
                Deschide în editor ce s-a scris
              </button>
            ) : null}
            <p role="status" aria-live="polite" className={cn("text-[13px]", error ? "text-[var(--ap-error)]" : "text-dim")}>
              {running ? `Descrieri scrise: ${written.length} din ${clips.length}.` : error ? error : platforms.length === 0 ? "Alege cel puțin o platformă." : null}
            </p>
          </div>
          {draftExists && !running ? <p className="text-[12.5px] text-dim">În editorul de la „Plan nou” e deja o ciornă. Planul scris aici o înlocuiește.</p> : null}
        </div>
      )}
    </section>
  );
}
