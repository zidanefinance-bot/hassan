import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { brand } from "../brand";
import { theme } from "../theme";
import { Entrance, Exit, useBreathe } from "../components/Layers";
import { Icon } from "../components/Icons";
import { headline } from "../components/Text";

// Card landing times, sec from shot start — gaps shrink (dealt faster and faster, R2).
export const PILLAR_LANDS = [0.75, 1.35, 1.75] as const;

const Card: React.FC<{ i: number; start: number }> = ({ i, start }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: frame - start, fps, config: theme.spring.snappy });
  const b = useBreathe(i * 17);
  const pillar = brand.pillars[i];
  const fromX = i % 2 === 0 ? -900 : 900;
  return (
    <div
      style={{
        opacity: interpolate(p, [0, 0.3], [0, 1], theme.clamp),
        transform: `translateX(${interpolate(p, [0, 1], [fromX, 0])}px) rotate(${interpolate(p, [0, 1], [i % 2 === 0 ? -8 : 8, 0])}deg) translateY(${b.float}px)`,
        filter: `blur(${interpolate(p, [0, 0.6], [10, 0], theme.clamp)}px)`,
        display: "flex", alignItems: "center", gap: 40,
        width: 900, padding: "44px 48px", borderRadius: 36,
        background: `linear-gradient(135deg, ${theme.colors.bgAlt}, ${theme.colors.bg})`,
        border: `1px solid ${theme.colors.line}`,
        boxShadow: "0 40px 80px -20px rgba(0,0,0,0.6)",
      }}
    >
      <div
        style={{
          width: 128, height: 128, borderRadius: 32, flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(246,241,232,0.06)", border: `1px solid ${theme.colors.line}`,
        }}
      >
        <Icon name={pillar.icon} size={80} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ ...headline, fontWeight: 700, fontSize: theme.size.caption }}>{pillar.title}</div>
        <div style={{ fontFamily: theme.fonts.body, fontWeight: 500, fontSize: theme.size.small, color: theme.colors.textDim }}>
          {pillar.sub}
        </div>
      </div>
    </div>
  );
};

// BODY — three services dealt in like cards; the board holds still before the exit.
export const Pillars: React.FC<{ length: number }> = ({ length }) => {
  const { fps } = useVideoConfig();
  return (
    <Exit length={length}>
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", flexDirection: "column", gap: 56 }}>
        <Entrance delay={Math.round(fps * 0.1)}>
          <div style={{ ...headline, fontSize: theme.size.title, textAlign: "center" }}>
            {brand.pillarsHeading.pre}{" "}
            <span style={{ color: theme.colors.primary, textShadow: `0 0 60px ${theme.colors.glow}` }}>{brand.pillarsHeading.accent}</span>
          </div>
        </Entrance>
        <div style={{ display: "flex", flexDirection: "column", gap: 36 }}>
          {brand.pillars.map((_, i) => (
            // spring overshoot ~6 frames — start earlier so the card *lands* on its time
            <Card key={i} i={i} start={Math.round(fps * PILLAR_LANDS[i]) - 6} />
          ))}
        </div>
      </AbsoluteFill>
    </Exit>
  );
};
