// "Daal hai to lunch hai": pulses reel built from one top-down photo of bowls, cut into spinning circles.
// Hook pull-back → bowl spotlights with Urdu/English names → bowls fly into a Z → corporate end card.
import React from "react";
import { AbsoluteFill, Audio, Composition, Easing, Img, interpolate, random, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import "../Fonts";
import { CorpBg, CorpOutro, H, Kicker, corp } from "../corporate/kit";

const clamp = corp.clamp;
const BOWLS = ["b232-130", "b232-400", "b232-670", "b232-940", "b467-265", "b467-535", "b467-805", "b700-130", "b700-400", "b700-670", "b700-940", "b935-265", "b935-535", "b935-805", "b1167-130", "b1167-400", "b1167-670", "b1167-940"];
const src = (id: string) => staticFile(`pulses/${id}.png`);

const Bowl: React.FC<{ id: string; d: number; spin: number; shadow?: number; style?: React.CSSProperties }> = ({ id, d, spin, shadow = 0.5, style }) => (
  <Img src={src(id)} style={{ position: "absolute", width: d, height: d, borderRadius: "50%", transform: `rotate(${spin}deg)`, boxShadow: `0 ${d * 0.06}px ${d * 0.12}px rgba(0,0,0,${shadow})`, ...style }} />
);

// Vertical hex grid of slowly spinning bowls
const D = 300;
const cells = (() => {
  const out: { x: number; y: number; id: string; dir: number }[] = [];
  for (let r = 0; r < 9; r++) for (let k = 0; k < 5; k++) {
    const x = -75 + (r % 2) * 150 + k * 300, y = -60 + r * 255;
    const id = r === 4 && k === 2 ? "b700-670" : BOWLS[(r * 7 + k * 3) % BOWLS.length];
    out.push({ x, y, id, dir: (r + k) % 2 ? 1 : -1 });
  }
  return out;
})();
const Grid: React.FC<{ hide?: boolean }> = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: "#050505" }}>
      {cells.map((c, i) => (
        <Bowl key={i} id={c.id} d={D - 14} spin={frame * 0.35 * c.dir + i * 37} style={{ left: c.x - D / 2 + 7, top: c.y - D / 2 + 7 }} />
      ))}
    </AbsoluteFill>
  );
};

// ── 1. Hook: macro on red lentils pulls back to the full grid ──
const Hook: React.FC = () => {
  const frame = useCurrentFrame();
  const z = interpolate(frame, [0, 46], [3.4, 1], { easing: Easing.bezier(0.65, 0, 0.35, 1), ...clamp });
  const dim = interpolate(frame, [44, 56], [0, 0.72], clamp);
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ transform: `scale(${z * (1 + frame * 0.0008)}) rotate(${(1 - z) * 4}deg)`, transformOrigin: "525px 960px" }}><Grid /></AbsoluteFill>
      <AbsoluteFill style={{ background: `rgba(5,5,5,${dim})` }} />
      <AbsoluteFill style={{ padding: `0 ${corp.pad}px`, justifyContent: "center" }}>
        <Sequence from={46} layout="none">
          <Kicker>Zidane · Pulses desk</Kicker>
          <div style={{ marginTop: 36 }}>
            <HookLine delay={4} color={corp.text}>Daal hai,</HookLine>
            <HookLine delay={10} color={corp.red}>to lunch hai.</HookLine>
          </div>
        </Sequence>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
const HookLine: React.FC<{ delay: number; color: string; children: React.ReactNode }> = ({ delay, color, children }) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [delay, delay + 16], [0, 1], { easing: corp.out, ...clamp });
  return (
    <div style={{ overflow: "hidden", paddingBottom: 10 }}>
      <div style={{ transform: `translateY(${(1 - p) * 110}%)` }}><H size={136} color={color}>{children}</H></div>
    </div>
  );
};

// ── 2. Spotlight: one bowl at a time with its name ──
const spot = [
  { id: "b700-670", ur: "Masoor Daal", en: "Red lentils" },
  { id: "b700-940", ur: "Sabut Moong", en: "Mung beans" },
  { id: "b232-940", ur: "Kabuli Chana", en: "Chickpeas" },
  { id: "b700-400", ur: "Rajma", en: "Kidney beans" },
  { id: "b935-265", ur: "Lobia", en: "Black-eyed peas" },
];
const SPOT = 42;
const SpotItem: React.FC<{ i: number }> = ({ i }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spot[i];
  const enter = spring({ frame, fps, config: { damping: 15, stiffness: 120, mass: 0.9 } });
  const exit = interpolate(frame, [SPOT - 8, SPOT + 4], [0, 1], { easing: corp.in, ...clamp });
  const d = 700;
  const x = 540 + exit * -900, y = 800 + (1 - enter) * 1100 - exit * 200;
  const label = interpolate(frame, [8, 20], [0, 1], { easing: corp.out, ...clamp }) * (1 - exit);
  return (
    <AbsoluteFill>
      <Bowl id={s.id} d={d} shadow={0.7} spin={(1 - enter) * -160 + frame * 0.6 - exit * 120} style={{ left: x - d / 2, top: y - d / 2, transform: `rotate(${(1 - enter) * -160 + frame * 0.6}deg) scale(${1 - exit * 0.3})` }} />
      <div style={{ position: "absolute", left: corp.pad, right: corp.pad, top: 1250, opacity: label, transform: `translateY(${(1 - label) * 30}px)` }}>
        <div style={{ fontFamily: corp.body, fontWeight: 600, fontSize: 30, letterSpacing: "0.22em", color: corp.red }}>{String(i + 1).padStart(2, "0")} / {String(spot.length).padStart(2, "0")}</div>
        <div style={{ marginTop: 16 }}><H size={124}>{s.ur}</H></div>
        <div style={{ marginTop: 6, fontFamily: corp.body, fontWeight: 500, fontSize: 46, color: corp.dim }}>{s.en}</div>
      </div>
    </AbsoluteFill>
  );
};
const Spotlight: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ filter: "blur(8px) brightness(0.3)", transform: `scale(1.1) translateY(${-frame * 0.6}px)` }}><Grid /></AbsoluteFill>
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(5,5,5,0) 50%, rgba(5,5,5,0.85) 75%)" }} />
      {spot.map((_, i) => <Sequence key={i} from={i * SPOT} durationInFrames={SPOT + 6}><SpotItem i={i} /></Sequence>)}
    </AbsoluteFill>
  );
};

// ── 3. Bowls fly in and form a Z ──
const zPts: [number, number][] = [[280, 540], [410, 540], [540, 540], [670, 540], [800, 540], [670, 670], [540, 800], [410, 930], [280, 1060], [410, 1060], [540, 1060], [670, 1060], [800, 1060]];
const zIds = ["b1167-400", "b232-670", "b700-940", "b935-265", "b700-130", "b700-400", "b232-940", "b467-535", "b700-670", "b467-265", "b232-400", "b935-805", "b1167-670"];
const ZForm: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const txt = interpolate(frame, [44, 62], [0, 1], { easing: corp.out, ...clamp });
  const out = interpolate(frame, [104, 120], [0, 1], { easing: corp.in, ...clamp });
  return (
    <AbsoluteFill>
      <CorpBg />
      {zPts.map(([tx, ty], i) => {
        const p = spring({ frame: frame - i * 3, fps, config: { damping: 14, stiffness: 110 } });
        const a = random(`a${i}`) * Math.PI * 2;
        const sx = 540 + Math.cos(a) * 1400, sy = 900 + Math.sin(a) * 1400;
        const x = sx + (tx - sx) * p, y = sy + (ty - sy) * p, d = 126 * (1 - out * 0.6);
        return <Bowl key={i} id={zIds[i]} d={d} shadow={0.6} spin={(1 - p) * 540 + frame * 0.8} style={{ left: x - d / 2, top: y - d / 2, opacity: 1 - out }} />;
      })}
      <div style={{ position: "absolute", left: corp.pad, right: corp.pad, top: 1240, opacity: txt * (1 - out), transform: `translateY(${(1 - txt) * 30}px)` }}>
        <Kicker delay={44}>Daal · Chana · Lobia · Rajma</Kicker>
        <div style={{ marginTop: 30 }}>
          <H size={104}>Bulk pulses.</H>
          <H size={104} color={corp.red}>One supplier.</H>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const T = { spot: 90, z: 90 + SPOT * spot.length, outro: 90 + SPOT * spot.length + 120 };
const TOTAL = T.outro + 150;

export const PulsesReel: React.FC = () => {
  const { durationInFrames } = useVideoConfig();
  return (
    <AbsoluteFill style={{ background: "#050505" }}>
      <Sequence durationInFrames={T.spot}><Hook /></Sequence>
      <Sequence from={T.spot} durationInFrames={T.z - T.spot}><Spotlight /></Sequence>
      <Sequence from={T.z} durationInFrames={T.outro - T.z}><ZForm /></Sequence>
      <Sequence from={T.outro}><CorpBg /><CorpOutro line1="Daal, chana, lobia, rajma." line2="Bulk supply across Karachi." /></Sequence>
      <Audio src={staticFile("sfx/corp-bed.wav")} endAt={durationInFrames} volume={(f) => interpolate(f, [0, 10, durationInFrames - 20, durationInFrames], [0, 0.7, 0.7, 0], clamp)} />
      <Audio src={staticFile("sfx/grains.wav")} volume={0.55} />
      {spot.map((_, i) => <Sequence key={i} from={T.spot + i * SPOT} durationInFrames={20}><Audio src={staticFile("sfx/whoosh.wav")} volume={0.3} /></Sequence>)}
      {spot.map((_, i) => <Sequence key={`p${i}`} from={T.spot + i * SPOT + 12} durationInFrames={20}><Audio src={staticFile("sfx/pop.wav")} volume={0.45} /></Sequence>)}
      <Sequence from={T.z} durationInFrames={80}><Audio src={staticFile("sfx/grains.wav")} volume={0.4} /></Sequence>
      <Sequence from={T.outro} durationInFrames={30}><Audio src={staticFile("sfx/whoosh.wav")} volume={0.3} /></Sequence>
    </AbsoluteFill>
  );
};

export const PulsesCompositions: React.FC = () => (
  <Composition id="PulsesReel" component={PulsesReel} durationInFrames={TOTAL} fps={30} width={1080} height={1920} />
);
