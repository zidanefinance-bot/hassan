import React from "react";
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { brand } from "../brand";
import { theme } from "../theme";
import { BounceWords, Exit, Sticker } from "../components/Cute";

export const JUMP_START = 14;
export const JUMP_STEP = 10;
export const FLIGHT = 16;
export const LANDS = brand.squad.map((_, i) => JUMP_START + i * JUMP_STEP + FLIGHT);

const MOUTH = { x: 540, y: 1150 }; // just below the bag's top edge, so items vanish behind it
const FROM = [
  { x: 150, y: 520 }, { x: 930, y: 560 }, { x: 110, y: 820 },
  { x: 960, y: 860 }, { x: 250, y: 420 }, { x: 840, y: 400 },
];

// Every item hops into the big Zidane bag; the bag squashes on each landing.
export const JumpIn: React.FC<{ length: number }> = ({ length }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: theme.spring.bouncy });
  // sum of damped wobbles, one per landing
  const squash = LANDS.reduce((acc, L) => {
    const t = frame - L;
    return t < 0 ? acc : acc + 0.09 * Math.exp(-t / 5) * Math.cos(t / 1.6);
  }, 0);
  const landed = LANDS.filter((L) => frame >= L).length;
  const happy = landed === LANDS.length;
  return (
    <Exit length={length}>
      <AbsoluteFill style={{ alignItems: "center" }}>
        <div style={{ marginTop: 200 }}>
          <BounceWords words={[brand.jumpHeading.pre, ...brand.jumpHeading.accent.split(" "), brand.jumpHeading.post]} delay={0} fontSize={theme.size.title} accent={2} />
        </div>
      </AbsoluteFill>
      {/* flying items */}
      {brand.squad.map((item, i) => {
        const t0 = JUMP_START + i * JUMP_STEP;
        const p = interpolate(frame, [t0, t0 + FLIGHT], [0, 1], { easing: theme.ease.inOut, ...theme.clamp });
        if (frame < t0 - 8 || p >= 1) return null;
        const appear = spring({ frame: frame - (t0 - 8), fps, config: theme.spring.snappy });
        const f = FROM[i];
        const x = interpolate(p, [0, 1], [f.x, MOUTH.x]);
        const y = interpolate(p, [0, 1], [f.y, MOUTH.y]) - Math.sin(p * Math.PI) * 260;
        const s = interpolate(p, [0, 1], [0.75, 0.3]) * appear;
        return (
          <div key={item.img} style={{ position: "absolute", left: x, top: y, transform: `translate(-50%, -50%) scale(${s}) rotate(${p * 360}deg)` }}>
            <Img src={staticFile(item.img)} style={{ width: item.w * 1.3, filter: "drop-shadow(0 10px 12px rgba(90,20,20,0.3))" }} />
          </div>
        );
      })}
      {/* bag */}
      <div
        style={{
          position: "absolute", left: 540, top: 1000, width: 600,
          transform: `translate(-50%, 0) translateY(${interpolate(enter, [0, 1], [700, 0])}px) scale(${1 + squash}, ${1 - squash})`,
          transformOrigin: "50% 100%",
        }}
      >
        <Sticker src="cut/bag.png" width={600} faceY={0.2} faceScale={0.5} mood={happy ? "smile" : "wow"} />
      </div>
      {/* +1 pops */}
      {LANDS.map((L, i) => {
        const t = frame - L;
        if (t < 0 || t > 18) return null;
        return (
          <div key={i}
            style={{
              position: "absolute", left: 540 + (i % 2 ? 150 : -190), top: 980 - t * 6,
              fontFamily: theme.fonts.display, fontWeight: 800, fontSize: 72, color: theme.colors.red,
              opacity: interpolate(t, [0, 3, 14, 18], [0, 1, 1, 0]), textShadow: `0 0 8px ${theme.colors.white}, 0 0 16px ${theme.colors.white}`,
            }}>
            +1
          </div>
        );
      })}
    </Exit>
  );
};
