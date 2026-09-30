import React from "react";
import { AbsoluteFill } from "remotion";
import { theme } from "../theme";
import { BounceWords, Exit, Sticker, usePop, useWiggle } from "./Cute";

export const PERK_START = 12;
export const PERK_STEP = 9;

type Perk = { icon: "truck" | "calendar" | "receipt" | "tag" | "brand" | "box"; title: string; sub: string };

// Stack of chunky "sticker cards", each with a doodle icon. Two mascots peek in from the bottom.
export const Perks: React.FC<{
  length: number; heading: string; accent?: number; perks: readonly Perk[];
  peek?: readonly [string, string];
}> = ({ length, heading, accent, perks, peek = ["cut/bag.png", "cut/oil.png"] }) => {
  const a = usePop(PERK_START + perks.length * PERK_STEP);
  const w = useWiggle(0, 4);
  return (
    <Exit length={length}>
      <AbsoluteFill style={{ alignItems: "center" }}>
        <div style={{ marginTop: 200, width: 940 }}>
          <BounceWords words={heading.split(" ")} delay={0} fontSize={theme.size.title} accent={accent} />
        </div>
        <div style={{ marginTop: 80, display: "flex", flexDirection: "column", gap: 40 }}>
          {perks.map((p, i) => <Card key={i} i={i} {...p} />)}
        </div>
      </AbsoluteFill>
      <div style={{ position: "absolute", left: 30, top: 1560, transform: `${a.transform} rotate(${-12 + w.rot}deg)`, opacity: a.opacity }}>
        <Sticker src={peek[0]} width={250} faceY={0.22} faceScale={0.55} mood="wink" />
      </div>
      <div style={{ position: "absolute", right: 40, top: 1600, transform: `${a.transform} rotate(${10 - w.rot}deg)`, opacity: a.opacity }}>
        <Sticker src={peek[1]} width={240} faceY={0.5} phase={20} />
      </div>
    </Exit>
  );
};

const Card: React.FC<Perk & { i: number }> = ({ i, icon, title, sub }) => {
  const p = usePop(PERK_START + i * PERK_STEP);
  const tilt = [-2, 1.5, -1][i % 3];
  return (
    <div
      style={{
        transform: `${p.transform} rotate(${tilt}deg)`, opacity: p.opacity, width: 880,
        display: "flex", alignItems: "center", gap: 36, padding: "30px 40px",
        background: theme.colors.white, border: `5px solid ${theme.colors.ink}`, borderRadius: 40,
        boxShadow: `10px 10px 0 ${theme.colors.ink}`,
      }}
    >
      <div style={{ width: 130, height: 130, borderRadius: 32, background: [theme.colors.yellow, theme.colors.pink, "#9EE6B8"][i % 3], display: "grid", placeItems: "center", border: `4px solid ${theme.colors.ink}`, flexShrink: 0 }}>
        <Doodle name={icon} />
      </div>
      <div>
        <div style={{ fontFamily: theme.fonts.display, fontWeight: 800, fontSize: 56, color: theme.colors.ink, letterSpacing: "-0.02em" }}>{title}</div>
        <div style={{ fontFamily: theme.fonts.body, fontWeight: 600, fontSize: 38, color: theme.colors.red, marginTop: 6 }}>{sub}</div>
      </div>
    </div>
  );
};

const Doodle: React.FC<{ name: Perk["icon"] }> = ({ name }) => {
  const st = { stroke: theme.colors.ink, strokeWidth: 6, fill: "none", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg width={86} height={86} viewBox="0 0 100 100">
      {name === "truck" && (<>
        <rect x={6} y={28} width={54} height={40} rx={6} {...st} fill={theme.colors.red} />
        <path d="M60 40h18l14 16v12H60z" {...st} fill={theme.colors.white} />
        <circle cx={26} cy={74} r={9} {...st} fill={theme.colors.white} /><circle cx={76} cy={74} r={9} {...st} fill={theme.colors.white} />
      </>)}
      {name === "calendar" && (<>
        <rect x={12} y={20} width={76} height={68} rx={10} {...st} fill={theme.colors.white} />
        <path d="M12 40h76M32 12v16M68 12v16" {...st} />
        <path d="M34 62l10 10 20-22" {...st} stroke={theme.colors.red} strokeWidth={8} />
      </>)}
      {name === "receipt" && (<>
        <path d="M22 10h56v80l-9-7-9 7-10-7-9 7-10-7-9 7z" {...st} fill={theme.colors.white} />
        <path d="M34 32h32M34 48h32M34 64h18" {...st} />
      </>)}
      {name === "tag" && (<>
        <path d="M12 50L50 12h38v38L50 88z" {...st} fill={theme.colors.white} />
        <circle cx={70} cy={30} r={7} {...st} fill={theme.colors.red} />
      </>)}
      {name === "brand" && (<>
        <rect x={18} y={14} width={64} height={76} rx={8} {...st} fill={theme.colors.red} />
        <text x={50} y={66} textAnchor="middle" fontSize={44} fontWeight={800} fill={theme.colors.white} fontFamily={theme.fonts.display}>Z</text>
      </>)}
      {name === "box" && (<>
        <path d="M12 32l38-18 38 18v40L50 90 12 72z" {...st} fill={theme.colors.white} />
        <path d="M12 32l38 18 38-18M50 50v40" {...st} />
      </>)}
    </svg>
  );
};
