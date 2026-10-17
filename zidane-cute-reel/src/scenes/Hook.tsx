import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { brand } from "../brand";
import { theme } from "../theme";
import { BounceWords, Exit, Sparkle, Sticker, headline, usePop, useWiggle } from "../components/Cute";

export const BAG_LAND = 0.35; // sec

// Hook — "Psst… Ramadan 2027 aa raha hai!" while the Zidane bag jumps up and blinks.
export const Hook: React.FC<{ length: number }> = ({ length }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const psst = usePop(2);
  const bag = spring({ frame, fps, config: theme.spring.bouncy });
  const w = useWiggle(0, 2.5);
  const moon = usePop(20);
  return (
    <Exit length={length}>
      <AbsoluteFill style={{ alignItems: "center" }}>
        <div style={{ marginTop: 210, transform: psst.transform, opacity: psst.opacity }}>
          <div style={{ ...headline, fontSize: 64, color: theme.colors.red, fontWeight: 700 }}>{brand.hook.small}</div>
        </div>
        <div style={{ marginTop: 30 }}>
          <BounceWords words={brand.hook.line1.split(" ")} delay={10} fontSize={theme.size.hero} accent={0} />
        </div>
        <div style={{ marginTop: 14 }}>
          <BounceWords words={brand.hook.line2.split(" ")} delay={20} fontSize={theme.size.title} color={theme.colors.red} />
        </div>
      </AbsoluteFill>
      {/* crescent moon */}
      <div style={{ position: "absolute", right: 90, top: 120, transform: `${moon.transform} rotate(${Math.sin(frame / 15) * 10}deg)`, opacity: moon.opacity }}>
        <svg width={150} height={150} viewBox="0 0 100 100">
          <path d="M62 8 A44 44 0 1 0 92 70 A34 34 0 1 1 62 8Z" fill={theme.colors.yellow} stroke={theme.colors.ink} strokeWidth={4} />
        </svg>
      </div>
      <Sparkle size={70} x={110} y={170} delay={26} />
      <Sparkle size={50} x={880} y={640} delay={32} color={theme.colors.red} />
      <Sparkle size={60} x={140} y={1180} delay={38} color={theme.colors.pink} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "flex-end" }}>
        <div
          style={{
            marginBottom: -120,
            transform: `translateY(${interpolate(bag, [0, 1], [900, 0]) + w.y}px) rotate(${w.rot}deg) scale(${interpolate(bag, [0, 0.7, 1], [0.8, 1.06, 1])})`,
          }}
        >
          <Sticker src="cut/bag.png" width={720} faceY={0.2} faceScale={0.5} mood="wow" />
        </div>
      </AbsoluteFill>
    </Exit>
  );
};
