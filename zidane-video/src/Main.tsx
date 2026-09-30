import React from "react";
import { AbsoluteFill, Audio, interpolate, Sequence, staticFile, useVideoConfig } from "remotion";
import "./Fonts";
import { theme } from "./theme";
import { BgMesh, Grade, Grain, Vignette } from "./components/Layers";
import { Hook } from "./scenes/Hook";
import { Pillars, PILLAR_LANDS } from "./scenes/Pillars";
import { Payoff, BAR_STEP, BARS_START, LINE_START } from "./scenes/Payoff";
import { Outro, MARK_LAND } from "./scenes/Outro";

export const FPS = 30;
const sec = (s: number) => Math.round(s * FPS);

// Shot table — every timing below derives from this.
const hook = { from: 0, len: sec(3) };
const pillars = { from: hook.from + hook.len, len: sec(4.5) };
const payoff = { from: pillars.from + pillars.len, len: sec(4) };
const outro = { from: payoff.from + payoff.len, len: sec(4.5) };
export const SHOTS = { hook, pillars, payoff, outro } as const;
export const TOTAL = outro.from + outro.len;

type Cue = { at: number; src: string; volume: number; len?: number; note: string };
const LEAD = 2; // SFX lands 2 frames before the visual

const SFX: Cue[] = [
  { at: SHOTS.hook.from + sec(0.2) - LEAD, src: "whoosh", volume: 0.45, note: "hook line 1 rises" },
  { at: SHOTS.hook.from + sec(0.9) + 5 - LEAD, src: "pop", volume: 0.55, note: "accent pill grows on 'rukta'" },
  { at: SHOTS.hook.from + SHOTS.hook.len - 12 - LEAD, src: "whoosh", volume: 0.3, note: "hook exits" },
  ...PILLAR_LANDS.map((t, i) => ({
    at: SHOTS.pillars.from + sec(t) - LEAD,
    src: i % 2 === 0 ? "pop" : "tick",
    volume: [0.5, 0.45, 0.4][i],
    note: `pillar card ${i + 1} lands`,
  })),
  { at: SHOTS.pillars.from + SHOTS.pillars.len - 12 - LEAD, src: "whoosh", volume: 0.3, note: "pillars exit" },
  ...[0, 3, 6].map((k, j) => ({
    at: SHOTS.payoff.from + sec(BARS_START) + k * BAR_STEP - LEAD,
    src: "tick",
    volume: [0.35, 0.3, 0.25][j],
    note: `bars rising (${j + 1})`,
  })),
  { at: SHOTS.payoff.from + sec(LINE_START) - LEAD, src: "whoosh", volume: 0.4, note: "trend line draws" },
  { at: SHOTS.payoff.from + sec(LINE_START + 1.1) - LEAD, src: "pop", volume: 0.5, note: "line tip dot lands" },
  { at: SHOTS.payoff.from + SHOTS.payoff.len - 12 - LEAD, src: "whoosh", volume: 0.3, note: "payoff exits" },
  { at: SHOTS.outro.from + sec(MARK_LAND) - LEAD, src: "bass", volume: 0.8, note: "logo mark impact — loudest hit" },
  { at: SHOTS.outro.from + sec(2.0) - LEAD, src: "tick", volume: 0.35, note: "CTA + URL appear" },
];

export const Main: React.FC = () => {
  const { durationInFrames } = useVideoConfig();
  return (
    <AbsoluteFill style={{ backgroundColor: theme.colors.bg }}>
      <BgMesh />
      <Sequence from={SHOTS.hook.from} durationInFrames={SHOTS.hook.len}><Hook length={SHOTS.hook.len} /></Sequence>
      <Sequence from={SHOTS.pillars.from} durationInFrames={SHOTS.pillars.len}><Pillars length={SHOTS.pillars.len} /></Sequence>
      <Sequence from={SHOTS.payoff.from} durationInFrames={SHOTS.payoff.len}><Payoff length={SHOTS.payoff.len} /></Sequence>
      <Sequence from={SHOTS.outro.from} durationInFrames={SHOTS.outro.len}><Outro /></Sequence>
      <Grade />
      <Grain />
      <Vignette />

      {/* Music bed: synthesized pad, faded in/out, trimmed to the video length */}
      <Audio
        src={staticFile("sfx/pad.wav")}
        endAt={durationInFrames}
        volume={(f) =>
          interpolate(f, [0, sec(0.8), durationInFrames - sec(1.2), durationInFrames], [0, 0.3, 0.3, 0], {
            easing: theme.ease.inOut, ...theme.clamp,
          })
        }
      />
      {SFX.map((c, i) => (
        <Sequence key={i} from={Math.max(0, c.at)} durationInFrames={c.len ?? sec(1.5)}>
          <Audio src={staticFile(`sfx/${c.src}.wav`)} volume={c.volume} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
