import React, { useMemo } from "react";
import { AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Background } from "./components/Background";
import type { WordSpec } from "./components/Text";
import { B1, CTAS, CtaId, DEMO, HOOKS, HookId, VoiceId } from "./data/script";
import { p } from "./lib/anim";
import { layoutFor, pillRect } from "./lib/layout";
import { buildTimeline } from "./lib/timeline";
import { timePhrases, timeWords } from "./lib/words";
import { CampaignsScene } from "./scenes/CampaignsScene";
import { CinemaScene } from "./scenes/CinemaScene";
import { CtaScene } from "./scenes/CtaScene";
import { hookLayout, HookScene } from "./scenes/HookScene";
import { IdeasScene } from "./scenes/IdeasScene";
import { MonthlyScene } from "./scenes/MonthlyScene";
import { ReadScene } from "./scenes/ReadScene";
import { PillState, StatusPill } from "./scenes/StatusPill";
import { C } from "./theme";

export type AdProps = { voice: VoiceId; hook: HookId; cta: CtaId; transparent?: boolean };

// Cât intră o scenă înaintea frazei ei și cât rămâne după începutul următoarei.
const PRE = 12;
const POST = 16;

export const Ad: React.FC<AdProps> = ({ voice, hook, cta, transparent }) => {
  const frame = useCurrentFrame();
  const { width, height, fps, durationInFrames } = useVideoConfig();
  const L = layoutFor(width, height);
  const tl = useMemo(() => buildTimeline(voice, hook, cta), [voice, hook, cta]);
  const F = (s: number) => Math.round(s * fps);

  const hookDef = HOOKS[hook];
  const ctaDef = CTAS[cta];

  const plan = useMemo(() => {
    // Hook: cuvintele cu momentele lor și tonul (alb / gri).
    const hookTexts = hookDef.phrases.map((ph) => ph.lines.join(" "));
    const hw = timePhrases(hookTexts, tl.hook.phrases);
    const two = hookDef.phrases.length > 1;
    let k = 0;
    const hookWords: WordSpec[] = [];
    hookDef.phrases.forEach((ph, pi) => {
      const n = hookTexts[pi].split(/\s+/).length;
      for (let j = 0; j < n; j++, k++) {
        const spec: WordSpec = { text: hw[k].text, at: F(hw[k].start) };
        if (two && pi === 0) {
          spec.dimAt = F(tl.hook.phrases[1].start);
          spec.dimColor = C.dim;
        } else if (!two && hookDef.greyFrom !== undefined && k >= hookDef.greyFrom) {
          spec.color = C.dim;
        }
        hookWords.push(spec);
      }
    });

    // Body: începutul fiecărei fraze și cuvintele care declanșează bătăile.
    const B = tl.body.phrases.map((ph) => F(ph.start));
    const bw = B1.map((text, i) => timeWords(text, tl.body.phrases[i]));
    const at = (phrase: number, prefix: string) => {
      const w = bw[phrase].find((x) => x.text.toLowerCase().startsWith(prefix));
      if (!w) throw new Error(`Nu găsesc „${prefix}" în fraza ${phrase + 1}`);
      return F(w.start);
    };
    const oameni = bw[3].findIndex((x) => x.text.startsWith("oameni"));
    const masaWords: WordSpec[] = bw[3].slice(oameni, oameni + 4).map((w, i) => ({
      text: i === 0 ? w.text[0].toUpperCase() + w.text.slice(1) : w.text,
      at: F(w.start),
      color: i >= 2 ? "#4D8BFF" : undefined,
    }));

    // CTA: titlul, rândul secundar și „sună".
    const cw = timePhrases(ctaDef.phrases, tl.cta.phrases);
    const nTitle = ctaDef.titleLines.reduce((a, b) => a + b, 0);
    const title = cw.slice(0, nTitle).map((w) => ({ text: w.text, at: F(w.start) }));
    const subtitle = cw.slice(nTitle, nTitle + ctaDef.subtitleWords).map((w, i, arr) => ({
      text: i === arr.length - 1 && ctaDef.subtitleSuffix ? w.text.replace(/[,.]$/, "") + ctaDef.subtitleSuffix : w.text,
      at: F(w.start),
    }));

    return {
      hookWords,
      lastPhraseAt: F(tl.hook.phrases.at(-1)!.start),
      B,
      C0: F(tl.cta.start),
      suna: F(tl.cta.suna),
      scriptAt: at(1, "scriem"),
      equipmentAt: at(2, "echipament"),
      pubAt: at(3, "publicăm"),
      admAt: at(3, "administrăm"),
      masaAt: at(3, "care"),
      masaWords,
      analysisAt: at(4, "analiză"),
      proposalsAt: at(4, "propuneri"),
      title,
      subtitle,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tl, hook, cta, fps]);

  const { B, C0 } = plan;
  const states: PillState[] = [
    { at: B[0], primary: "Analizăm", secondary: DEMO.domain, chip: "ÎN LUCRU", tone: "blue", icon: "spin" },
    { at: B[1], primary: "Venim cu ideile", secondary: "scriem scenariile", chip: "ÎN LUCRU", tone: "blue", icon: "spin" },
    { at: B[2], primary: "Filmăm", secondary: "cinematografie gastronomică", chip: "ÎN LUCRU", tone: "blue", icon: "spin" },
    { at: B[3], primary: "Edităm", secondary: "clipuri și reclame", chip: "ÎN LUCRU", tone: "blue", icon: "spin" },
    { at: plan.pubAt, primary: "Publicăm", secondary: "Meta + TikTok", chip: "ÎN LUCRU", tone: "blue", icon: "spin" },
    { at: plan.admAt, primary: "Administrăm", secondary: "campaniile", chip: "LIVE", tone: "green", icon: "check" },
    { at: B[4], primary: "În fiecare lună", secondary: "analiză și propuneri", chip: "LIVE", tone: "green", icon: "check" },
  ];

  // Fereastra fiecărei scene: intră cu PRE cadre înainte, iese după POST.
  const scene = (startAt: number, endAt: number) => ({
    from: startAt - PRE,
    durationInFrames: endAt + POST - (startAt - PRE),
    start: PRE,
    end: endAt - (startAt - PRE),
  });
  const read = scene(B[0], B[1]);
  const ideas = scene(B[1], B[2]);
  const cinema = scene(B[2], B[3]);
  const camp = scene(B[3], B[4]);
  const month = scene(B[4], C0);
  const ctaFrom = C0 - PRE;
  const local = (abs: number, s: { from: number }) => abs - s.from;

  const glow = 1 - 0.75 * p(frame, B[0] - 6, 20) + 0.5 * p(frame, C0 - 10, 20);

  return (
    <AbsoluteFill style={{ backgroundColor: transparent ? undefined : C.bg }}>
      <Background glow={glow} transparent={transparent} />

      {tl.audio.map((a, i) => (
        <Sequence key={i} from={a.at} durationInFrames={a.durationInFrames} layout="none">
          <Audio src={staticFile(a.src)} trimBefore={a.trimBefore} durationInFrames={a.durationInFrames} />
        </Sequence>
      ))}

      <Sequence durationInFrames={B[0] + 18}>
        <HookScene L={L} hook={hookDef} words={plan.hookWords} end={B[0]} lastPhraseAt={plan.lastPhraseAt} />
      </Sequence>

      <Sequence from={read.from} durationInFrames={read.durationInFrames}>
        <ReadScene L={L} start={read.start} end={read.end} />
      </Sequence>
      <Sequence from={ideas.from} durationInFrames={ideas.durationInFrames}>
        <IdeasScene L={L} start={ideas.start} end={ideas.end} scriptAt={local(plan.scriptAt, ideas)} />
      </Sequence>
      <Sequence from={cinema.from} durationInFrames={cinema.durationInFrames}>
        <CinemaScene L={L} start={cinema.start} end={cinema.end} equipmentAt={local(plan.equipmentAt, cinema)} />
      </Sequence>
      <Sequence from={camp.from} durationInFrames={camp.durationInFrames}>
        <CampaignsScene
          L={L}
          start={camp.start}
          end={camp.end}
          pubAt={local(plan.pubAt, camp)}
          admAt={local(plan.admAt, camp)}
          masaAt={local(plan.masaAt, camp)}
          masaWords={plan.masaWords.map((w) => ({ ...w, at: local(w.at, camp) }))}
        />
      </Sequence>
      <Sequence from={month.from} durationInFrames={month.durationInFrames}>
        <MonthlyScene
          L={L}
          start={month.start}
          end={month.end}
          analysisAt={local(plan.analysisAt, month)}
          proposalsAt={local(plan.proposalsAt, month)}
        />
      </Sequence>

      <StatusPill from={hookLayout(L, hookDef).bar} rect={pillRect(L)} bornAt={B[0]} exitAt={C0} states={states} />

      <Sequence from={ctaFrom} durationInFrames={durationInFrames - ctaFrom}>
        <CtaScene
          L={L}
          start={PRE}
          sunaAt={plan.suna - ctaFrom}
          title={plan.title.map((w) => ({ ...w, at: w.at - ctaFrom }))}
          titleLines={ctaDef.titleLines}
          subtitle={plan.subtitle.map((w) => ({ ...w, at: w.at - ctaFrom }))}
        />
      </Sequence>
    </AbsoluteFill>
  );
};
