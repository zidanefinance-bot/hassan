import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { brand } from "../brand";
import { theme } from "../theme";
import { Entrance, useBreathe } from "../components/Layers";
import { ZMark } from "../components/Icons";
import { headline } from "../components/Text";

export const MARK_LAND = 0.45; // sec from shot start

// CTA — logo sting: mark → wordmark → descriptor → URL + CTA, then a long still hold.
export const Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const b = useBreathe();
  const s = spring({ frame, fps, config: theme.spring.bouncy });
  const rot = spring({ frame, fps, config: theme.spring.smooth });
  const draw = interpolate(frame, [fps * 0.3, fps * 0.9], [0, 1], { easing: theme.ease.out, ...theme.clamp });
  const letters = brand.name.split("");
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", flexDirection: "column" }}>
      <div
        style={{
          transform: `scale(${interpolate(s, [0, 1], [0.4, 1]) * b.scale}) rotate(${interpolate(rot, [0, 1], [-120, 0])}deg)`,
          opacity: interpolate(s, [0, 0.25], [0, 1], theme.clamp),
          filter: `drop-shadow(0 0 60px ${theme.colors.glow})`,
          marginBottom: 56,
        }}
      >
        <ZMark size={260} progress={draw} />
      </div>
      <div style={{ display: "flex", gap: 10, ...headline, fontSize: 150, letterSpacing: "0.02em" }}>
        {letters.map((l, i) => {
          const p = spring({ frame: frame - fps * 0.6 - i * 3, fps, config: theme.spring.snappy });
          return (
            <span key={i} style={{ display: "inline-block", opacity: p, transform: `translateY(${interpolate(p, [0, 1], [60, 0])}px) scale(${interpolate(p, [0, 1], [0.8, 1])})` }}>
              {l}
            </span>
          );
        })}
      </div>
      <Entrance delay={Math.round(fps * 1.35)} style={{ marginTop: 20 }}>
        <div style={{ fontFamily: theme.fonts.body, fontWeight: 600, fontSize: theme.size.small + 4, color: theme.colors.textDim, letterSpacing: "0.18em", textTransform: "uppercase" }}>
          {brand.descriptor}
        </div>
      </Entrance>
      <Entrance delay={Math.round(fps * 2.0)} style={{ marginTop: 110 }}>
        <div style={{ ...headline, fontWeight: 700, fontSize: theme.size.caption, textAlign: "center" }}>{brand.cta}</div>
      </Entrance>
      <Entrance delay={Math.round(fps * 2.0) + 5} style={{ marginTop: 36 }}>
        <div
          style={{
            fontFamily: theme.fonts.body, fontWeight: 600, fontSize: theme.size.caption, color: theme.colors.text,
            padding: "22px 52px", borderRadius: 999, border: `2px solid rgba(246,241,232,0.35)`,
            background: "rgba(246,241,232,0.06)",
          }}
        >
          {brand.url}
        </div>
      </Entrance>
    </AbsoluteFill>
  );
};
