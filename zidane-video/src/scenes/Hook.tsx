import React from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";
import { brand } from "../brand";
import { theme } from "../theme";
import { Exit, useBreathe } from "../components/Layers";
import { WordReveal } from "../components/Text";

// HOOK — one hero: the question. Movement starts at frame 6.
export const Hook: React.FC<{ length: number }> = ({ length }) => {
  const { fps } = useVideoConfig();
  const b = useBreathe();
  return (
    <Exit length={length}>
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: "0 80px" }}>
        <div style={{ transform: `translateY(${b.float}px) scale(${b.scale})`, display: "flex", flexDirection: "column", gap: 40 }}>
          <WordReveal words={brand.hook.line1.split(" ")} delay={Math.round(fps * 0.2)} per={4} fontSize={theme.size.title} />
          <WordReveal
            words={brand.hook.line2}
            delay={Math.round(fps * 0.9)}
            per={5}
            fontSize={theme.size.hero}
            accentIndex={brand.hook.accentIndex}
          />
        </div>
      </AbsoluteFill>
    </Exit>
  );
};
