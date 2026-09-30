import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { theme } from "../theme";

// Layer 1 — moving background mesh (a flat fill is not a background)
export const BgMesh: React.FC = () => {
  const frame = useCurrentFrame();
  const d1 = Math.sin(frame / 55) * 60;
  const d2 = Math.cos(frame / 70) * 50;
  return (
    <AbsoluteFill style={{ background: theme.colors.bg }}>
      <div
        style={{
          position: "absolute", width: 1400, height: 1400, borderRadius: "50%",
          top: -600, left: -500 + d1, filter: "blur(60px)",
          background: `radial-gradient(circle, ${theme.colors.primary}2E, transparent 62%)`,
        }}
      />
      <div
        style={{
          position: "absolute", width: 1300, height: 1300, borderRadius: "50%",
          bottom: -500, right: -550 - d2, filter: "blur(80px)",
          background: `radial-gradient(circle, ${theme.colors.secondary}40, transparent 65%)`,
        }}
      />
      {/* faint grid, drifts slowly for depth */}
      <AbsoluteFill
        style={{
          backgroundImage: `linear-gradient(${theme.colors.line} 1px, transparent 1px), linear-gradient(90deg, ${theme.colors.line} 1px, transparent 1px)`,
          backgroundSize: "120px 120px",
          backgroundPosition: `0px ${-frame * 0.4}px`,
          opacity: 0.35,
          maskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)",
        }}
      />
    </AbsoluteFill>
  );
};

// Layer 4 — colour grade
export const Grade: React.FC = () => (
  <AbsoluteFill style={{ pointerEvents: "none" }}>
    <AbsoluteFill style={{ backgroundColor: theme.colors.primary, mixBlendMode: "soft-light", opacity: 0.2 }} />
    <AbsoluteFill
      style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.18), transparent 25%, transparent 75%, rgba(0,0,0,0.28))" }}
    />
  </AbsoluteFill>
);

// Layer 5a — procedural film grain
export const Grain: React.FC = () => {
  const frame = useCurrentFrame();
  const noise = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='220'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='220' height='220' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E")`;
  return (
    <AbsoluteFill
      style={{
        pointerEvents: "none", backgroundImage: noise, backgroundSize: "220px",
        backgroundPosition: `${(frame * 7) % 220}px ${(frame * 13) % 220}px`,
        opacity: 0.07, mixBlendMode: "overlay",
      }}
    />
  );
};

// Layer 5b — vignette (topmost)
export const Vignette: React.FC = () => (
  <AbsoluteFill
    style={{ pointerEvents: "none", background: "radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.45) 100%)" }}
  />
);

// Premium entrance: opacity + rise + scale, never a lone fade
export const Entrance: React.FC<{ delay?: number; rise?: number; children: React.ReactNode; style?: React.CSSProperties }> = ({
  delay = 0, rise = 40, children, style,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: frame - delay, fps, config: theme.spring.smooth });
  return (
    <div
      style={{
        opacity: p,
        transform: `translateY(${interpolate(p, [0, 1], [rise, 0])}px) scale(${interpolate(p, [0, 1], [0.94, 1])})`,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

// Scene wrapper exit — faster than entrances (~10 frames). `length` = shot length (Sequence-local).
export const Exit: React.FC<{ length: number; frames?: number; children: React.ReactNode }> = ({
  length, frames = 10, children,
}) => {
  const frame = useCurrentFrame();
  const range = [length - frames - 2, length - 2];
  const y = interpolate(frame, range, [0, -70], { easing: theme.ease.in, ...theme.clamp });
  const o = interpolate(frame, range, [1, 0], { easing: theme.ease.in, ...theme.clamp });
  const s = interpolate(frame, range, [1, 0.97], { easing: theme.ease.in, ...theme.clamp });
  const blur = interpolate(frame, range, [0, 6], { easing: theme.ease.in, ...theme.clamp });
  return (
    <AbsoluteFill style={{ opacity: o, transform: `translateY(${y}px) scale(${s})`, filter: `blur(${blur}px)` }}>
      {children}
    </AbsoluteFill>
  );
};

// Idle micro-motion for anything on screen > 2s
export const useBreathe = (phase = 0) => {
  const frame = useCurrentFrame();
  return {
    scale: 1 + Math.sin((frame + phase) / 22) * 0.012,
    float: Math.sin((frame + phase) / 30) * 4,
  };
};
