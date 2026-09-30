import React from "react";
import { AbsoluteFill, Audio, interpolate, Sequence, staticFile, useVideoConfig } from "remotion";
import "./Fonts";
import { theme } from "./theme";
import { brand } from "./brand";
import { CuteBg } from "./components/Cute";
import { Hook, BAG_LAND } from "./scenes/Hook";
import { Squad, SQUAD_START, SQUAD_STEP } from "./scenes/Squad";
import { JumpIn, LANDS } from "./scenes/JumpIn";
import { Price, BURST_LAND, COUNT_END } from "./scenes/Price";
import { Outro, LOGO_LAND } from "./scenes/Outro";

export const FPS = 30;
const sec = (s: number) => Math.round(s * FPS);

// Shot table — every timing below derives from this.
const hook = { from: 0, len: sec(3.2) };
const squad = { from: hook.from + hook.len, len: sec(5.6) };
const jump = { from: squad.from + squad.len, len: sec(3.6) };
const price = { from: jump.from + jump.len, len: sec(3.2) };
const outro = { from: price.from + price.len, len: sec(4.6) };
export const SHOTS = { hook, squad, jump, price, outro } as const;
export const TOTAL = outro.from + outro.len;

type Cue = { at: number; src: string; volume: number; note: string };
const LEAD = 2; // SFX lands 2 frames before the visual

const SFX: Cue[] = [
  { at: SHOTS.hook.from + 2, src: "pop", volume: 0.5, note: "Psst" },
  { at: SHOTS.hook.from + sec(BAG_LAND) - LEAD, src: "whoosh", volume: 0.45, note: "bag jumps up" },
  ...brand.squad.map((_, i) => ({
    at: SHOTS.squad.from + SQUAD_START + i * SQUAD_STEP - LEAD,
    src: "pop", volume: 0.5 - i * 0.03, note: `squad member ${i + 1}`,
  })),
  { at: SHOTS.jump.from, src: "whoosh", volume: 0.35, note: "bag enters" },
  ...LANDS.map((L, i) => ({ at: SHOTS.jump.from + L - LEAD, src: "tick", volume: 0.45, note: `item ${i + 1} lands in bag` })),
  { at: SHOTS.price.from + BURST_LAND - LEAD, src: "pop", volume: 0.6, note: "price burst" },
  { at: SHOTS.price.from + COUNT_END - 4 - LEAD, src: "bass", volume: 0.5, note: "price locks + confetti" },
  { at: SHOTS.outro.from, src: "whoosh", volume: 0.45, note: "red wipe" },
  { at: SHOTS.outro.from + LOGO_LAND - LEAD, src: "bass", volume: 0.8, note: "logo impact — loudest hit" },
  { at: SHOTS.outro.from + 44 - LEAD, src: "pop", volume: 0.45, note: "WhatsApp pill" },
];

export const Main: React.FC = () => {
  const { durationInFrames } = useVideoConfig();
  return (
    <AbsoluteFill style={{ backgroundColor: theme.colors.bg }}>
      <CuteBg />
      <Sequence from={SHOTS.hook.from} durationInFrames={SHOTS.hook.len}><Hook length={SHOTS.hook.len} /></Sequence>
      <Sequence from={SHOTS.squad.from} durationInFrames={SHOTS.squad.len}><Squad length={SHOTS.squad.len} /></Sequence>
      <Sequence from={SHOTS.jump.from} durationInFrames={SHOTS.jump.len}><JumpIn length={SHOTS.jump.len} /></Sequence>
      <Sequence from={SHOTS.price.from} durationInFrames={SHOTS.price.len}><Price length={SHOTS.price.len} /></Sequence>
      <Sequence from={SHOTS.outro.from} durationInFrames={SHOTS.outro.len}><Outro /></Sequence>

      {/* Music bed: synthesized bouncy pluck loop (public/sfx/cute-bed.wav) — no licensing issues */}
      <Audio
        src={staticFile("sfx/cute-bed.wav")}
        endAt={durationInFrames}
        volume={(f) =>
          interpolate(f, [0, sec(0.3), durationInFrames - sec(1), durationInFrames], [0, 0.55, 0.55, 0], theme.clamp)
        }
      />
      {SFX.map((c, i) => (
        <Sequence key={i} from={Math.max(0, c.at)} durationInFrames={sec(1.5)}>
          <Audio src={staticFile(`sfx/${c.src}.wav`)} volume={c.volume} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
