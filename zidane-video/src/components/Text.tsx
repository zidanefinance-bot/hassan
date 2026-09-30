import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { theme } from "../theme";

export const headline: React.CSSProperties = {
  fontFamily: theme.fonts.display,
  fontWeight: 800,
  letterSpacing: "-0.03em",
  lineHeight: 1.05,
  color: theme.colors.text,
};

// Word-by-word reveal. `accentIndex` word gets a gold pill that grows in 5 frames after it lands.
export const WordReveal: React.FC<{
  words: readonly string[];
  delay?: number;
  per?: number;
  fontSize: number;
  accentIndex?: number;
  gap?: number;
}> = ({ words, delay = 0, per = 4, fontSize, accentIndex, gap = 26 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap, ...headline, fontSize }}>
      {words.map((word, i) => {
        const start = delay + i * per;
        const p = spring({ frame: frame - start, fps, config: theme.spring.snappy });
        const isAccent = i === accentIndex;
        const pill = isAccent ? spring({ frame: frame - start - 5, fps, config: theme.spring.bouncy }) : 0;
        return (
          <span
            key={i}
            style={{
              position: "relative",
              display: "inline-block",
              opacity: p,
              transform: `translateY(${interpolate(p, [0, 1], [40, 0])}px) scale(${interpolate(p, [0, 1], [0.9, 1])})`,
              padding: isAccent ? "0 22px" : undefined,
              color: isAccent ? interpolateColor(pill) : undefined,
            }}
          >
            {isAccent && (
              <span
                style={{
                  position: "absolute", inset: "4px 0 -2px 0", borderRadius: 22, zIndex: -1,
                  background: theme.colors.primary,
                  transform: `scaleX(${pill})`, transformOrigin: "left center",
                  boxShadow: `0 0 60px ${theme.colors.glow}, 0 0 120px ${theme.colors.primary}33`,
                }}
              />
            )}
            {word}
          </span>
        );
      })}
    </div>
  );
};

// Accent word flips from cream to ink as the gold pill grows under it.
const interpolateColor = (p: number) => (p > 0.45 ? theme.colors.ink : theme.colors.text);
