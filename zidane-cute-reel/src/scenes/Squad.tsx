import React from "react";
import { AbsoluteFill } from "remotion";
import { brand } from "../brand";
import { theme } from "../theme";
import { BounceWords, Exit, Sticker, usePop, useWiggle } from "../components/Cute";

export const SQUAD_START = 18; // frames
export const SQUAD_STEP = 13; // frames between items
const COLS = [290, 790];
const ROWS = [650, 1110, 1570];

// Six ration items pop in as a "squad", each with a speech-bubble line.
type Item = { img: string; say: string; w: number };

export const Squad: React.FC<{ length: number; heading?: string; accent?: number; items?: readonly Item[] }> = ({
  length, heading = brand.squadHeading, accent = 1, items = brand.squad,
}) => (
  <Exit length={length}>
    <AbsoluteFill style={{ alignItems: "center" }}>
      <div style={{ marginTop: 190 }}>
        <BounceWords words={heading.split(" ")} delay={2} fontSize={theme.size.title} accent={accent} />
      </div>
    </AbsoluteFill>
    {items.map((item, i) => (
      <Member key={item.img} i={i} x={COLS[i % 2]} y={ROWS[Math.floor(i / 2)]} {...item} />
    ))}
  </Exit>
);

const Member: React.FC<{ i: number; x: number; y: number; img: string; say: string; w: number }> = ({ i, x, y, img, say, w }) => {
  const pop = usePop(SQUAD_START + i * SQUAD_STEP);
  const bubble = usePop(SQUAD_START + i * SQUAD_STEP + 7);
  const wig = useWiggle(i * 17, 3);
  return (
    <div style={{ position: "absolute", left: x, top: y, transform: "translate(-50%, -50%)", display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ transform: `${pop.transform} translateY(${wig.y}px) rotate(${wig.rot}deg)`, opacity: pop.opacity, height: 350, display: "flex", alignItems: "flex-end" }}>
        <Sticker src={img} width={w} faceY={0.45} faceScale={w < 200 ? 1 : 0.6} phase={i * 23} mood={i === 3 ? "wink" : "smile"} />
      </div>
      <div
        style={{
          marginTop: 22, transform: bubble.transform, opacity: bubble.opacity,
          background: theme.colors.white, color: theme.colors.red, border: `4px solid ${theme.colors.ink}`,
          borderRadius: 999, padding: "12px 28px", whiteSpace: "nowrap",
          fontFamily: theme.fonts.display, fontWeight: 800, fontSize: 42, boxShadow: `6px 6px 0 ${theme.colors.ink}`,
        }}
      >
        {say}
      </div>
    </div>
  );
};
