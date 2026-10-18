// Exportă planul tuturor clipurilor (segmente, voce, intervale de vorbire,
// efecte sonore) ca JSON, pentru asamblarea cu ffmpeg. Se rulează prin
// scripts/plan.mjs, care îl compilează cu esbuild.

import { writeFileSync, mkdirSync } from "node:fs";
import { CLIPS, clipFile, clipId } from "../src/data/script";
import { bodyWindows, clipPlan, ClipPlan, FPS, Seg, speechSpans } from "../src/lib/timeline";
import { larvenHookCues } from "../src/larven/Hook";
import { larvenSeq3Cuts } from "../src/larven/Body";
import { shopifyHookCues } from "../src/shopify/Hook";
import { shopifySeq3Take, shopifySeq4Times, shopifySeq5Times } from "../src/shopify/Body";
import { shopifyCtaTimes } from "../src/shopify/Cta";
import { bodySeqSeg } from "../src/lib/timeline";

type Cue = { f: number; sfx: string; gain?: number };

const outDir = process.argv[2] ?? "out";
mkdirSync(outDir, { recursive: true });

const bodyCues = (plan: ClipPlan, style: string): Cue[] => {
  const cues: Cue[] = [];
  const wins = bodyWindows(plan.body);
  wins.forEach((w, i) => {
    const seg = bodySeqSeg(plan.body, i);
    const at = plan.at.body + w.from;
    if (style === "larven") {
      if (i === 0) cues.push({ f: at, sfx: "whoosh-soft", gain: -4 });
      if (i === 2) larvenSeq3Cuts(seg).forEach((f, k) => cues.push({ f: at + f, sfx: k === 0 ? "whoosh" : "tick", gain: k === 0 ? 0 : -8 }));
      if (i === 3) cues.push({ f: at, sfx: "whoosh-soft", gain: -3 });
    } else {
      if (i === 0) cues.push({ f: at + Math.round(seg.words[3].f) - 2, sfx: "flip", gain: -4 });
      if (i === 1) cues.push({ f: at + Math.round(seg.words[4].f) - 1, sfx: "paper", gain: -2 });
      if (i === 2) cues.push({ f: at + shopifySeq3Take(seg), sfx: "whoosh", gain: -2 });
      if (i === 3) {
        const t = shopifySeq4Times(seg);
        cues.push({ f: at + t.tap, sfx: "click", gain: 0 });
        cues.push({ f: at + t.p3 + 2, sfx: "pop", gain: -6 });
        cues.push({ f: at + t.scatter, sfx: "swoosh", gain: -3 });
      }
      if (i === 4) {
        const t = shopifySeq5Times(seg);
        cues.push({ f: at + t.p2 + 2, sfx: "paper", gain: -4 });
        cues.push({ f: at + t.next, sfx: "paper", gain: -4 });
      }
    }
  });
  return cues;
};

const ctaCues = (plan: ClipPlan, style: string): Cue[] => {
  const at = plan.at.cta;
  const { suna, tap } = shopifyCtaTimes(plan.cta);
  return style === "larven"
    ? [{ f: at + suna - 3, sfx: "pop", gain: -5 }]
    : [
        { f: at + suna - 4, sfx: "pop", gain: -5 },
        { f: at + tap, sfx: "click", gain: 0 },
      ];
};

const segTable = (seg: Seg) => ({ D: seg.D, audio: seg.audio, phrases: seg.phrases.map((p) => [Math.round(p.f0), Math.round(p.f1)]) });

const clips = CLIPS.map((c) => {
  const plan = clipPlan(c);
  const hookCues: Cue[] = (c.style === "larven" ? larvenHookCues(plan.hook, c.hook) : shopifyHookCues(plan.hook, c.hook)).map((q) => ({ ...q }));
  const cues = [...hookCues, ...bodyCues(plan, c.style), ...ctaCues(plan, c.style)].sort((a, b) => a.f - b.f);
  const voice = c.voice;
  return {
    id: clipId(c),
    file: clipFile(c),
    batch: c.batch,
    style: c.style,
    voice,
    D: plan.D,
    seconds: +(plan.D / FPS).toFixed(2),
    segments: [
      { kind: "hook", comp: `hook-${voice}-${c.hook}-${c.style}`, at: plan.at.hook, ...segTable(plan.hook) },
      ...bodyWindows(plan.body).map((w, i) => ({ kind: "seq", comp: `seq-${voice}-${c.style}-${i + 1}`, at: plan.at.body + w.from, D: w.D })),
      { kind: "cta", comp: `cta-${voice}-${plan.complete ? "c2complet" : c.cta}-${c.style}`, at: plan.at.cta, ...segTable(plan.cta) },
    ],
    voiceAudio: [
      plan.hook.audio && { ...plan.hook.audio, at: plan.at.hook + plan.hook.audio.at },
      plan.body.audio && { ...plan.body.audio, at: plan.at.body + plan.body.audio.at },
      plan.cta.audio && { ...plan.cta.audio, at: plan.at.cta + plan.cta.audio.at },
    ].filter(Boolean),
    speech: speechSpans(plan).map(([a, b]) => [Math.round(a), Math.round(b)]),
    cues,
    words: {
      hook: plan.hook.words.map((w) => `${w.text}@${Math.round(w.f)}`).join(" "),
      body: plan.body.words.map((w) => `${w.text}@${Math.round(w.f)}`).join(" "),
      cta: plan.cta.words.map((w) => `${w.text}@${Math.round(w.f)}`).join(" "),
      suna: plan.cta.suna,
    },
  };
});

writeFileSync(`${outDir}/plan.json`, JSON.stringify({ fps: FPS, clips }, null, 1));
for (const c of clips) {
  console.log(`${c.file.padEnd(36)} ${String(c.D).padStart(4)} cadre ${String(c.seconds).padStart(6)} s  ` + c.segments.map((s) => `${s.comp.replace(/^(hook|seq|cta)-/, "")}:${s.D}`).join(" "));
}
