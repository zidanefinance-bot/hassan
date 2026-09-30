import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { brand } from "../brand";
import { theme } from "../theme";
import { Confetti, Exit, Sparkle, Sticker, headline, usePop, useWiggle } from "../components/Cute";

export const BURST_LAND = 6; // frames
export const COUNT_END = 30; // frames

// Price reveal — yellow starburst, number counts up, confetti.
export const Price: React.FC<{ length: number }> = ({ length }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const burst = usePop(0);
  const c = spring({ frame: frame - 8, fps, config: theme.spring.counter, durationInFrames: COUNT_END - 8 });
  const amount = Math.round(interpolate(c, [0, 1], [0, brand.price.amount]));
  const sub = usePop(34);
  const bag = usePop(14);
  const w = useWiggle(5, 4);
  const pts = Array.from({ length: 28 }).map((_, i) => {
    const r = i % 2 ? 360 : 440;
    const a = (i / 28) * Math.PI * 2;
    return `${500 + Math.cos(a) * r},${500 + Math.sin(a) * r}`;
  }).join(" ");
  return (
    <Exit length={length}>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div style={{ position: "absolute", top: 380, transform: burst.transform, opacity: burst.opacity }}>
          <svg width={940} height={940} viewBox="0 0 1000 1000" style={{ transform: `rotate(${frame * 0.4}deg)` }}>
            <polygon points={pts} fill={theme.colors.yellow} stroke={theme.colors.ink} strokeWidth={10} strokeLinejoin="round" />
          </svg>
        </div>
        <div style={{ position: "absolute", top: 560, width: "100%", display: "flex", flexDirection: "column", alignItems: "center", transform: burst.transform }}>
          <div style={{ ...headline, fontSize: 72 }}>{brand.price.pre}</div>
          <div style={{ ...headline, fontSize: 80, color: theme.colors.red, marginTop: 20 }}>{brand.price.currency}</div>
          <div style={{ ...headline, fontSize: 190, color: theme.colors.red, fontVariantNumeric: "tabular-nums" }}>
            {amount.toLocaleString("en-US")}
          </div>
          <div style={{ ...headline, fontSize: 68, marginTop: 6 }}>{brand.price.post}</div>
        </div>
        <div style={{ position: "absolute", top: 1420, transform: sub.transform, opacity: sub.opacity }}>
          <div style={{
            background: theme.colors.red, color: theme.colors.white, borderRadius: 999, padding: "20px 44px",
            fontFamily: theme.fonts.display, fontWeight: 800, fontSize: 46, border: `4px solid ${theme.colors.ink}`,
            boxShadow: `8px 8px 0 ${theme.colors.ink}`,
          }}>
            {brand.price.sub}
          </div>
        </div>
      </AbsoluteFill>
      <div style={{ position: "absolute", left: 40, top: 1520, transform: `${bag.transform} rotate(${-10 + w.rot}deg)`, opacity: bag.opacity }}>
        <Sticker src="cut/bag.png" width={260} faceY={0.2} faceScale={0.55} mood="wink" />
      </div>
      <div style={{ position: "absolute", right: 60, top: 1560, transform: `${bag.transform} rotate(${12 - w.rot}deg)`, opacity: bag.opacity }}>
        <Sticker src="cut/oil.png" width={230} faceY={0.5} phase={30} />
      </div>
      <Sparkle size={80} x={120} y={330} delay={10} color={theme.colors.red} />
      <Sparkle size={60} x={900} y={420} delay={16} />
      <Sparkle size={50} x={860} y={1330} delay={22} color={theme.colors.pink} />
      <Confetti start={COUNT_END - 4} />
    </Exit>
  );
};
