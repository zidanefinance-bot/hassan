import React from "react";
import { Audio, interpolate, Sequence, staticFile, useVideoConfig } from "remotion";
import { theme } from "../theme";

export type Cue = { at: number; src: "pop" | "tick" | "whoosh" | "bass"; volume: number; note: string };
export const LEAD = 2; // SFX lands 2 frames before the visual

// Music bed (synthesized, royalty-free) + SFX cues.
export const Soundtrack: React.FC<{ cues: Cue[]; bed?: number }> = ({ cues, bed = 0.55 }) => {
  const { durationInFrames, fps } = useVideoConfig();
  return (
    <>
      <Audio
        src={staticFile("sfx/cute-bed.wav")}
        endAt={durationInFrames}
        volume={(f) => interpolate(f, [0, fps * 0.3, durationInFrames - fps, durationInFrames], [0, bed, bed, 0], theme.clamp)}
      />
      {cues.map((c, i) => (
        <Sequence key={i} from={Math.max(0, c.at - LEAD)} durationInFrames={Math.round(fps * 1.5)}>
          <Audio src={staticFile(`sfx/${c.src}.wav`)} volume={c.volume} />
        </Sequence>
      ))}
    </>
  );
};
