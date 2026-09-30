import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { brand } from "../brand";
import { theme } from "../theme";
import { Entrance, Exit, useBreathe } from "../components/Layers";
import { headline } from "../components/Text";

// Relative bar heights — an abstract growth shape, not real client data.
const BARS = [0.28, 0.36, 0.33, 0.48, 0.55, 0.52, 0.7, 0.86];
export const BAR_STEP = 3; // frames between bars
export const BARS_START = 0.2; // sec
export const LINE_START = 0.9; // sec

const W = 860;
const H = 620;

// PAYOFF — the biggest animation: bars rise, then the gold trend line draws through them.
export const Payoff: React.FC<{ length: number }> = ({ length }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const b = useBreathe(40);
  const barW = W / BARS.length;
  const pts = BARS.map((v, i) => [i * barW + barW / 2, H - v * H - 30] as const);
  const d = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const lineP = interpolate(frame, [fps * LINE_START, fps * LINE_START + fps * 1.1], [0, 1], { easing: theme.ease.inOut, ...theme.clamp });
  const pathLen = 1400;
  const tipIndex = Math.min(BARS.length - 1, Math.floor(lineP * (BARS.length - 1) + 0.0001));
  const tip = pts[tipIndex];
  const tipScale = spring({ frame: frame - fps * (LINE_START + 1.1), fps, config: theme.spring.bouncy });

  return (
    <Exit length={length}>
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", flexDirection: "column", gap: 70 }}>
        <div style={{ position: "relative", width: W, height: H, transform: `scale(${b.scale})` }}>
          {BARS.map((v, i) => {
            const p = spring({ frame: frame - fps * BARS_START - i * BAR_STEP, fps, config: theme.spring.smooth });
            return (
              <div
                key={i}
                style={{
                  position: "absolute", bottom: 0, left: i * barW + 14, width: barW - 28,
                  height: v * H * p, opacity: interpolate(p, [0, 0.2], [0, 1], theme.clamp),
                  borderRadius: "18px 18px 6px 6px",
                  background: `linear-gradient(180deg, rgba(246,241,232,${0.18 + v * 0.2}), rgba(246,241,232,0.04))`,
                  border: `1px solid ${theme.colors.line}`,
                }}
              />
            );
          })}
          <svg width={W} height={H} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
            <path
              d={d} fill="none" stroke={theme.colors.primary} strokeWidth={12} strokeLinecap="round" strokeLinejoin="round"
              strokeDasharray={pathLen} strokeDashoffset={pathLen * (1 - lineP)}
              style={{ filter: `drop-shadow(0 0 18px ${theme.colors.glow})` }}
            />
            {lineP > 0.99 && (
              <circle cx={tip[0]} cy={tip[1]} r={22 * tipScale} fill={theme.colors.primary} />
            )}
          </svg>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
          <Entrance delay={Math.round(fps * 1.6)}>
            <div style={{ ...headline, fontSize: theme.size.title }}>{brand.payoff.line1}</div>
          </Entrance>
          <Entrance delay={Math.round(fps * 1.6) + 5}>
            <div style={{ ...headline, fontSize: theme.size.title, color: theme.colors.textDim }}>{brand.payoff.line2}</div>
          </Entrance>
        </div>
      </AbsoluteFill>
    </Exit>
  );
};
