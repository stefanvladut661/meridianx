import React from "react";
import { Composition, Folder } from "remotion";
import { CLIPS, clipId, CtaId, StyleId, VoiceId } from "./data/script";
import { LarvenBackground, LOOP } from "./larven/Background";
import { bodySeg, bodySeqSeg, clipPlan, ctaSeg, FPS, hookSeg } from "./lib/timeline";
import { BodyFull, ClipPreview, CtaProps, CtaSegment, HookProps, HookSegment, SeqSegment } from "./segments";
import { ShopifyBackground } from "./shopify/Background";
import "./theme";

// Compozițiile: segmentele de randat (transparente), fundalurile și
// previzualizarea fiecărui clip întreg. Numele segmentelor sunt cele din
// scripts/render-all.mjs.

const STYLES: StyleId[] = ["larven", "shopify"];
const VOICES: VoiceId[] = ["333f", "mihai"];
const size = { width: 1080, height: 1920, fps: FPS };

const hooks = (() => {
  const seen = new Map<string, HookProps>();
  for (const c of CLIPS) seen.set(`hook-${c.voice}-${c.hook}-${c.style}`, { voice: c.voice, hook: c.hook, cta: c.cta, style: c.style });
  return [...seen.entries()];
})();

const ctas: [string, CtaProps][] = [];
for (const style of STYLES)
  for (const voice of VOICES)
    for (const cta of ["c1", "c2"] as CtaId[]) {
      ctas.push([`cta-${voice}-${cta}-${style}`, { voice, cta, complete: false, style }]);
      if (voice === "333f" && cta === "c2") ctas.push([`cta-${voice}-c2complet-${style}`, { voice, cta, complete: true, style }]);
    }

export const RemotionRoot: React.FC = () => (
  <>
    <Folder name="Clipuri">
      {CLIPS.map((c) => (
        <Composition
          key={clipId(c)}
          id={`clip-${clipId(c)}`}
          component={ClipPreview}
          durationInFrames={clipPlan(c).D}
          {...size}
          defaultProps={{ voice: c.voice, hook: c.hook, cta: c.cta, style: c.style }}
        />
      ))}
    </Folder>
    <Folder name="Hookuri">
      {hooks.map(([id, props]) => (
        <Composition
          key={id}
          id={id}
          component={HookSegment}
          durationInFrames={hookSeg(props.voice, props.hook, props.cta).D}
          {...size}
          defaultProps={props}
        />
      ))}
    </Folder>
    <Folder name="Body">
      {STYLES.flatMap((style) =>
        VOICES.flatMap((voice) =>
          [0, 1, 2, 3, 4].map((i) => (
            <Composition
              key={`${voice}-${style}-${i}`}
              id={`seq-${voice}-${style}-${i + 1}`}
              component={SeqSegment}
              durationInFrames={bodySeqSeg(bodySeg(voice), i).D}
              {...size}
              defaultProps={{ voice, style, index: i }}
            />
          )),
        ),
      )}
      {STYLES.flatMap((style) =>
        VOICES.map((voice) => (
          <Composition
            key={`body-${voice}-${style}`}
            id={`body-${voice}-${style}`}
            component={BodyFull}
            durationInFrames={bodySeg(voice).D}
            {...size}
            defaultProps={{ voice, styles: [style], withBg: true }}
          />
        )),
      )}
    </Folder>
    <Folder name="CTA">
      {ctas.map(([id, props]) => (
        <Composition
          key={id}
          id={id}
          component={CtaSegment}
          durationInFrames={ctaSeg(props.voice, props.cta, props.complete).D}
          {...size}
          defaultProps={props}
        />
      ))}
    </Folder>
    <Folder name="Fundaluri">
      <Composition id="bg-larven" component={LarvenBackground} durationInFrames={LOOP} {...size} />
      <Composition id="bg-shopify" component={ShopifyBackground} durationInFrames={LOOP} {...size} />
    </Folder>
  </>
);
