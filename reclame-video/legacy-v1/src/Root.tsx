import React from "react";
import { Composition, Folder } from "remotion";
import { Ad, AdProps } from "./Ad";
import { CLIPS } from "./data/script";
import { FORMATS, Format } from "./lib/layout";
import { buildTimeline, FPS } from "./lib/timeline";
import "./theme";

// O compoziție pe clip și format, cu numele fișierului final:
// <voce>-<hook>-<cta>-<format>, de exemplu 333f-h3-c2-9x16.
export const RemotionRoot: React.FC = () => (
  <>
    {(Object.keys(FORMATS) as Format[]).map((format) => (
      <Folder key={format} name={`Reclame-${format}`}>
        {CLIPS.map(({ voice, hook, cta }) => (
          <Composition
            key={`${voice}-${hook}-${cta}-${format}`}
            id={`${voice}-${hook}-${cta}-${format}`}
            component={Ad}
            durationInFrames={buildTimeline(voice, hook, cta).durationInFrames}
            fps={FPS}
            width={FORMATS[format].width}
            height={FORMATS[format].height}
            defaultProps={{ voice, hook, cta } satisfies AdProps}
          />
        ))}
      </Folder>
    ))}
  </>
);
