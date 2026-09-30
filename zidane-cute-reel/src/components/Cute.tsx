import React from "react";
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { theme } from "../theme";

// Layer 1 — cream background with drifting polka dots and two soft brand-red blobs
export const CuteBg: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: theme.colors.bg }}>
      <AbsoluteFill
        style={{
          backgroundImage: `radial-gradient(${theme.colors.bgDot} 9px, transparent 10px)`,
          backgroundSize: "90px 90px",
          backgroundPosition: `${frame * 0.6}px ${frame * 0.9}px`,
          opacity: 0.8,
        }}
      />
      <div
        style={{
          position: "absolute", width: 900, height: 900, borderRadius: "50%", filter: "blur(90px)",
          top: -350 + Math.sin(frame / 40) * 40, right: -350,
          background: `radial-gradient(circle, ${theme.colors.red}33, transparent 65%)`,
        }}
      />
      <div
        style={{
          position: "absolute", width: 900, height: 900, borderRadius: "50%", filter: "blur(90px)",
          bottom: -380, left: -380 + Math.cos(frame / 50) * 40,
          background: `radial-gradient(circle, ${theme.colors.yellow}55, transparent 65%)`,
        }}
      />
    </AbsoluteFill>
  );
};

// Googly eyes + blush + smile. Blinks every ~2.3s, pupils drift. `mood` "wow" opens the mouth.
export const Face: React.FC<{ size: number; phase?: number; mood?: "smile" | "wow" | "wink" }> = ({
  size, phase = 0, mood = "smile",
}) => {
  const frame = useCurrentFrame() + phase;
  const cycle = frame % 70;
  const blink = cycle > 62 ? interpolate(cycle, [62, 65, 68], [1, 0.1, 1], theme.clamp) : 1;
  const px = Math.sin(frame / 18) * size * 0.025;
  const py = Math.cos(frame / 23) * size * 0.015;
  const eye = (cx: number, winkThis: boolean) => (
    <g transform={`translate(${cx} 40) scale(1 ${winkThis ? 1 : blink}) translate(${-cx} -40)`}>
      {winkThis ? (
        <path d={`M${cx - 13} 42 Q${cx} 30 ${cx + 13} 42`} stroke={theme.colors.ink} strokeWidth={6} fill="none" strokeLinecap="round" />
      ) : (
        <>
          <ellipse cx={cx} cy={40} rx={17} ry={19} fill={theme.colors.white} stroke={theme.colors.ink} strokeWidth={4} />
          <circle cx={cx + px / 3} cy={43 + py / 3} r={9} fill={theme.colors.ink} />
          <circle cx={cx + 3 + px / 3} cy={38 + py / 3} r={3.2} fill={theme.colors.white} />
        </>
      )}
    </g>
  );
  return (
    <svg width={size} height={size * 0.62} viewBox="0 0 160 100" style={{ overflow: "visible" }}>
      <ellipse cx={30} cy={70} rx={15} ry={8} fill={theme.colors.pink} opacity={0.85} />
      <ellipse cx={130} cy={70} rx={15} ry={8} fill={theme.colors.pink} opacity={0.85} />
      {eye(55, false)}
      {eye(105, mood === "wink")}
      {mood === "wow" ? (
        <ellipse cx={80} cy={78} rx={10} ry={12} fill={theme.colors.redDeep} stroke={theme.colors.ink} strokeWidth={4} />
      ) : (
        <path d="M66 70 Q80 86 94 70" stroke={theme.colors.ink} strokeWidth={5.5} fill="none" strokeLinecap="round" />
      )}
    </svg>
  );
};

// A product photo as a die-cut sticker (white outline + soft shadow) with a face on it.
export const Sticker: React.FC<{
  src: string;
  width: number;
  faceY?: number; // 0..1 from top
  faceScale?: number;
  phase?: number;
  mood?: "smile" | "wow" | "wink";
  noFace?: boolean;
}> = ({ src, width, faceY = 0.5, faceScale = 0.62, phase = 0, mood, noFace }) => {
  const o = 6;
  const outline = [
    `drop-shadow(${o}px 0 0 #fff)`, `drop-shadow(-${o}px 0 0 #fff)`,
    `drop-shadow(0 ${o}px 0 #fff)`, `drop-shadow(0 -${o}px 0 #fff)`,
    `drop-shadow(0 18px 22px rgba(90,20,20,0.28))`,
  ].join(" ");
  return (
    <div style={{ position: "relative", width }}>
      <Img src={staticFile(src)} style={{ width: "100%", display: "block", filter: outline }} />
      {!noFace && (
        <div
          style={{
            position: "absolute", left: "50%", top: `${faceY * 100}%`,
            transform: "translate(-50%, -50%)",
          }}
        >
          <Face size={Math.max(90, width * faceScale)} phase={phase} mood={mood} />
        </div>
      )}
    </div>
  );
};

// Jelly pop-in: overshoot scale + a squash that settles, driven by the bouncy spring.
export const usePop = (delay: number) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: frame - delay, fps, config: theme.spring.bouncy });
  const sx = interpolate(p, [0, 0.6, 1], [0, 1.15, 1]);
  const sy = interpolate(p, [0, 0.6, 1], [0, 0.88, 1]);
  return { p, transform: `scale(${sx}, ${sy})`, opacity: interpolate(p, [0, 0.15], [0, 1], theme.clamp) };
};

// Idle wiggle for anything on screen > 1s
export const useWiggle = (phase = 0, amp = 3) => {
  const frame = useCurrentFrame() + phase;
  return {
    rot: Math.sin(frame / 9) * amp,
    y: Math.sin(frame / 13) * 8,
  };
};

// Four-point sparkle
export const Sparkle: React.FC<{ size: number; color?: string; x: number; y: number; delay?: number }> = ({
  size, color = theme.colors.yellow, x, y, delay = 0,
}) => {
  const frame = useCurrentFrame();
  const t = frame - delay;
  const s = t < 0 ? 0 : 0.6 + Math.abs(Math.sin(t / 10)) * 0.5;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100"
      style={{ position: "absolute", left: x, top: y, transform: `scale(${s}) rotate(${t * 2}deg)` }}>
      <path d="M50 0 C55 38 62 45 100 50 C62 55 55 62 50 100 C45 62 38 55 0 50 C38 45 45 38 50 0Z" fill={color} />
    </svg>
  );
};

// Confetti burst — deterministic pseudo-random pieces
export const Confetti: React.FC<{ start: number; count?: number }> = ({ start, count = 60 }) => {
  const frame = useCurrentFrame();
  const t = frame - start;
  if (t < 0) return null;
  const colors = [theme.colors.red, theme.colors.yellow, theme.colors.pink, theme.colors.whatsapp, "#6EC6FF"];
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {Array.from({ length: count }).map((_, i) => {
        const r = (n: number) => ((Math.sin(i * 928.37 + n * 13.1) + 1) / 2);
        const ang = r(1) * Math.PI * 2;
        const v = 18 + r(2) * 26;
        const x = 540 + Math.cos(ang) * v * t;
        const y = 900 + Math.sin(ang) * v * t * 0.8 + 0.9 * t * t;
        return (
          <div key={i}
            style={{
              position: "absolute", left: x, top: y, width: 18 + r(3) * 14, height: 10 + r(4) * 10,
              borderRadius: 4, background: colors[i % colors.length],
              transform: `rotate(${t * (6 + r(5) * 12)}deg)`,
              opacity: interpolate(t, [40, 60], [1, 0], theme.clamp),
            }} />
        );
      })}
    </AbsoluteFill>
  );
};

export const headline: React.CSSProperties = {
  fontFamily: theme.fonts.display,
  fontWeight: 800,
  letterSpacing: "-0.03em",
  lineHeight: 1.05,
  color: theme.colors.ink,
  textAlign: "center",
};

// Bouncy word-by-word reveal; the accent word sits on a tilted yellow highlight.
export const BounceWords: React.FC<{
  words: readonly string[]; delay?: number; per?: number; fontSize: number; accent?: number; color?: string;
}> = ({ words, delay = 0, per = 4, fontSize, accent, color }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: fontSize * 0.25, ...headline, fontSize, color: color ?? theme.colors.ink }}>
      {words.map((w, i) => {
        const p = spring({ frame: frame - delay - i * per, fps, config: theme.spring.bouncy });
        const isA = i === accent;
        return (
          <span key={i}
            style={{
              display: "inline-block", position: "relative", opacity: interpolate(p, [0, 0.2], [0, 1], theme.clamp),
              transform: `translateY(${interpolate(p, [0, 1], [60, 0])}px) rotate(${interpolate(p, [0, 1], [-8, 0])}deg) scale(${interpolate(p, [0, 1], [0.6, 1])})`,
              padding: isA ? "0 18px" : undefined,
            }}>
            {isA && (
              <span style={{
                position: "absolute", inset: "8% 0 2% 0", background: theme.colors.yellow, borderRadius: 20, zIndex: -1,
                transform: `rotate(-3deg) scaleX(${spring({ frame: frame - delay - i * per - 5, fps, config: theme.spring.snappy })})`,
                transformOrigin: "left",
              }} />
            )}
            {w}
          </span>
        );
      })}
    </div>
  );
};

// Fast exit wrapper (~10 frames): shrink + drop + fade. `length` = shot length.
export const Exit: React.FC<{ length: number; frames?: number; children: React.ReactNode }> = ({
  length, frames = 9, children,
}) => {
  const frame = useCurrentFrame();
  const range = [length - frames - 1, length - 1];
  const s = interpolate(frame, range, [1, 0.85], { easing: theme.ease.in, ...theme.clamp });
  const o = interpolate(frame, range, [1, 0], { easing: theme.ease.in, ...theme.clamp });
  return <AbsoluteFill style={{ opacity: o, transform: `scale(${s})` }}>{children}</AbsoluteFill>;
};
