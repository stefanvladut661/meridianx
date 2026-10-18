import React from "react";
import { AbsoluteFill, Audio, Sequence, staticFile, useVideoConfig } from "remotion";
import { CtaId, HookId, StyleId, VoiceId } from "./data/script";
import { LarvenBackground } from "./larven/Background";
import { LARVEN_SEQS, LarvenCta } from "./larven/Body";
import { LarvenHook } from "./larven/Hook";
import { bodySeg, bodySeqSeg, bodyWindows, clipPlan, ctaSeg, FPS, hookSeg, Seg } from "./lib/timeline";
import { SHOPIFY_SEQS } from "./shopify/Body";
import { ShopifyBackground } from "./shopify/Background";
import { ShopifyCta } from "./shopify/Cta";
import { ShopifyHook } from "./shopify/Hook";

// Segmentele randate separat (cu fundal transparent) și asamblate apoi cu
// ffmpeg. `withBg` pune fundalul stilului dedesubt, pentru previzualizare.

export const MUSIC: Record<StyleId, string> = {
  larven: "norm/house-02-744.wav",
  shopify: "norm/light-it-up-boy-849.wav",
};

export const Background: React.FC<{ style: StyleId }> = ({ style }) => (style === "larven" ? <LarvenBackground /> : <ShopifyBackground />);

const Wrap: React.FC<{ style: StyleId; withBg?: boolean; children: React.ReactNode }> = ({ style, withBg, children }) => (
  <AbsoluteFill>
    {withBg && <Background style={style} />}
    {children}
  </AbsoluteFill>
);

export type HookProps = { voice: VoiceId; hook: HookId; cta: CtaId; style: StyleId; withBg?: boolean };
export const HookSegment: React.FC<HookProps> = ({ voice, hook, cta, style, withBg }) => {
  const seg = hookSeg(voice, hook, cta);
  return <Wrap style={style} withBg={withBg}>{style === "larven" ? <LarvenHook seg={seg} hook={hook} /> : <ShopifyHook seg={seg} hook={hook} />}</Wrap>;
};

export type SeqProps = { voice: VoiceId; style: StyleId; index: number; withBg?: boolean };
export const SeqSegment: React.FC<SeqProps> = ({ voice, style, index, withBg }) => {
  const seg = bodySeqSeg(bodySeg(voice), index);
  const C = (style === "larven" ? LARVEN_SEQS : SHOPIFY_SEQS)[index];
  return (
    <Wrap style={style} withBg={withBg}>
      <C seg={seg} />
    </Wrap>
  );
};

/** Variantele de body: câte o secvență pe frază, din orice stil (A = Larven, B = Shopify). */
export type BodyProps = { voice: VoiceId; styles: StyleId[]; withBg?: boolean; bgStyle?: StyleId };
export const BodyFull: React.FC<BodyProps> = ({ voice, styles, withBg, bgStyle }) => {
  const body = bodySeg(voice);
  return (
    <AbsoluteFill>
      {withBg && <Background style={bgStyle ?? styles[0]} />}
      {bodyWindows(body).map((win, i) => (
        <Sequence key={i} from={win.from} durationInFrames={win.D}>
          <SeqSegment voice={voice} style={styles[i] ?? styles[0]} index={i} withBg={withBg && styles[i] !== (bgStyle ?? styles[0])} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

export type CtaProps = { voice: VoiceId; cta: CtaId; complete: boolean; style: StyleId; withBg?: boolean };
export const CtaSegment: React.FC<CtaProps> = ({ voice, cta, complete, style, withBg }) => {
  const seg = ctaSeg(voice, cta, complete);
  return <Wrap style={style} withBg={withBg}>{style === "larven" ? <LarvenCta seg={seg} cta={cta} /> : <ShopifyCta seg={seg} cta={cta} />}</Wrap>;
};

const VoiceAudio: React.FC<{ seg: Seg; at: number }> = ({ seg, at }) =>
  seg.audio ? (
    <Sequence from={at + seg.audio.at} durationInFrames={seg.audio.dur} layout="none">
      <Audio src={staticFile(seg.audio.src)} trimBefore={seg.audio.trimBefore} durationInFrames={seg.audio.dur} />
    </Sequence>
  ) : null;

/** Clipul întreg, pentru Remotion Studio. Fișierele finale se asamblează cu ffmpeg. */
export type ClipProps = { voice: VoiceId; hook: HookId; cta: CtaId; style: StyleId };
export const ClipPreview: React.FC<ClipProps> = ({ voice, hook, cta, style }) => {
  const plan = clipPlan({ voice, hook, cta });
  const { durationInFrames } = useVideoConfig();
  return (
    <AbsoluteFill>
      <Background style={style} />
      <Sequence durationInFrames={plan.hook.D}>
        <HookSegment voice={voice} hook={hook} cta={cta} style={style} />
      </Sequence>
      <Sequence from={plan.at.body} durationInFrames={plan.body.D}>
        <BodyFull voice={voice} styles={[style]} />
      </Sequence>
      <Sequence from={plan.at.cta} durationInFrames={plan.cta.D}>
        <CtaSegment voice={voice} cta={cta} complete={plan.complete} style={style} />
      </Sequence>
      <VoiceAudio seg={plan.hook} at={0} />
      <VoiceAudio seg={plan.body} at={plan.at.body} />
      <VoiceAudio seg={plan.cta} at={plan.at.cta} />
      <Audio src={staticFile(MUSIC[style])} volume={(f) => (f > durationInFrames - FPS ? 0.16 * ((durationInFrames - f) / FPS) : 0.16)} />
    </AbsoluteFill>
  );
};
