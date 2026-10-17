// Reel 3 — "Team ko khush karna hai?" Monthly employee ration programs.
import React from "react";
import { AbsoluteFill, Img, interpolate, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { theme } from "../theme";
import { BounceWords, Confetti, CuteBg, Exit, Face, Sparkle, Sticker, headline, usePop, useWiggle } from "../components/Cute";
import { JumpIn, landsFor } from "../scenes/JumpIn";
import { Perks, PERK_START, PERK_STEP } from "../components/Perks";
import { Outro, LOGO_LAND } from "../scenes/Outro";
import { Cue, Soundtrack } from "../components/Soundtrack";

const FPS = 30;
const sec = (s: number) => Math.round(s * FPS);

export const team = {
  hook: { line1: ["Team", "ko", "khush"], line2: "karna hai?" },
  jumpHeading: { words: ["Monthly", "ration", "bag"], accent: 1 },
  items: [
    { img: "cut/atta.png", w: 300 },
    { img: "cut/oil.png", w: 300 },
    { img: "cut/moong.png", w: 300 },
    { img: "cut/tea.png", w: 300 },
    { img: "cut/salt.png", w: 280 },
    { img: "cut/chilli.png", w: 300 },
  ],
  scale: { pre: "10 ho ya", target: 5000, post: "bags", sub: "Har bag same quality" },
  perksHeading: "Aapki marzi ka bag",
  perks: [
    { icon: "box", title: "Custom items", sub: "Budget ke hisaab se" },
    { icon: "brand", title: "Aapki branding", sub: "Company logo wala bag" },
    { icon: "truck", title: "Site pe delivery", sub: "Har mahine on time" },
  ],
  cta: "Apni team ka program banao!",
  chips: ["Factories", "Corporate", "NGOs"],
} as const;

const hook = { from: 0, len: sec(3) };
const jump = { from: hook.from + hook.len, len: sec(3.6) };
const scale = { from: jump.from + jump.len, len: sec(3.6) };
const perks = { from: scale.from + scale.len, len: sec(3.4) };
const outro = { from: perks.from + perks.len, len: sec(4.4) };
export const TEAM_TOTAL = outro.from + outro.len;

const GRID = { cols: 5, rows: 5, start: 6, step: 1.4 };

const CUES: Cue[] = [
  { at: hook.from + 3, src: "pop", volume: 0.45, note: "hook words" },
  { at: hook.from + 20, src: "whoosh", volume: 0.4, note: "workers pop" },
  { at: jump.from, src: "whoosh", volume: 0.35, note: "bag enters" },
  ...landsFor(team.items.length).map((L, i) => ({ at: jump.from + L, src: "tick" as const, volume: 0.45, note: `item ${i + 1} lands` })),
  { at: scale.from + GRID.start, src: "whoosh", volume: 0.4, note: "bags multiply" },
  { at: scale.from + 46, src: "bass", volume: 0.55, note: "5,000 locks + confetti" },
  ...team.perks.map((_, i) => ({ at: perks.from + PERK_START + i * PERK_STEP, src: "tick" as const, volume: 0.45, note: `perk ${i + 1}` })),
  { at: outro.from, src: "whoosh", volume: 0.45, note: "red wipe" },
  { at: outro.from + LOGO_LAND, src: "bass", volume: 0.8, note: "logo" },
  { at: outro.from + 44, src: "pop", volume: 0.45, note: "WhatsApp pill" },
];

// Hook: three little "employee" blobs with hard hats/caps go from meh to happy when a bag lands.
const Hook: React.FC<{ length: number }> = ({ length }) => {
  const frame = useCurrentFrame();
  const bag = usePop(40);
  const w = useWiggle(0, 3);
  const happy = frame >= 42;
  return (
    <Exit length={length}>
      <AbsoluteFill style={{ alignItems: "center" }}>
        <div style={{ marginTop: 260 }}>
          <BounceWords words={team.hook.line1} delay={0} fontSize={theme.size.hero} accent={2} />
        </div>
        <div style={{ marginTop: 14 }}>
          <BounceWords words={team.hook.line2.split(" ")} delay={10} fontSize={theme.size.title} color={theme.colors.red} />
        </div>
      </AbsoluteFill>
      {[0, 1, 2].map((i) => <Worker key={i} i={i} happy={happy} />)}
      <div style={{ position: "absolute", left: 540, top: 1560, transform: `translate(-50%, -50%) ${bag.transform} rotate(${w.rot}deg)`, opacity: bag.opacity }}>
        <Sticker src="cut/bag.png" width={300} faceY={0.22} faceScale={0.55} />
      </div>
      {happy && <Sparkle size={80} x={150} y={700} delay={42} />}
      {happy && <Sparkle size={70} x={860} y={720} delay={46} color={theme.colors.red} />}
    </Exit>
  );
};

const Worker: React.FC<{ i: number; happy: boolean }> = ({ i, happy }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: frame - 16 - i * 5, fps, config: theme.spring.bouncy });
  const jump = happy ? Math.abs(Math.sin((frame - 42 + i * 5) / 5)) * 50 : 0;
  const colors = [theme.colors.yellow, "#9EE6B8", "#9FD3FF"];
  const x = [230, 540, 850][i];
  return (
    <div style={{ position: "absolute", left: x, top: 1080, transform: `translate(-50%, -50%) scale(${p}) translateY(${-jump}px)` }}>
      <svg width={250} height={300} viewBox="0 0 250 300" style={{ overflow: "visible" }}>
        <path d="M30 300 Q30 170 125 170 Q220 170 220 300Z" fill={theme.colors.red} stroke={theme.colors.ink} strokeWidth={6} />
        <circle cx={125} cy={115} r={85} fill="#F2C9A0" stroke={theme.colors.ink} strokeWidth={6} />
        <path d="M40 95 Q125 -10 210 95Z" fill={colors[i]} stroke={theme.colors.ink} strokeWidth={6} />
        <rect x={30} y={88} width={190} height={16} rx={8} fill={colors[i]} stroke={theme.colors.ink} strokeWidth={5} />
      </svg>
      <div style={{ position: "absolute", left: 125, top: 128, transform: "translate(-50%, -50%)" }}>
        <Face size={150} phase={i * 17} mood={happy ? "smile" : "sad"} />
      </div>
    </div>
  );
};

// Scale: bags multiply into a grid while the counter runs to 5,000.
const Scale: React.FC<{ length: number }> = ({ length }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const c = spring({ frame: frame - GRID.start, fps, config: theme.spring.counter, durationInFrames: 40 });
  const n = Math.round(interpolate(c, [0, 1], [10, team.scale.target]));
  const pre = usePop(0);
  const sub = usePop(48);
  const total = GRID.cols * GRID.rows;
  return (
    <Exit length={length}>
      <AbsoluteFill style={{ alignItems: "center" }}>
        <div style={{ marginTop: 200, transform: pre.transform, opacity: pre.opacity }}>
          <div style={{ ...headline, fontSize: 72 }}>{team.scale.pre}</div>
        </div>
        <div style={{ ...headline, fontSize: 170, color: theme.colors.red, fontVariantNumeric: "tabular-nums", marginTop: 6 }}>
          {n.toLocaleString("en-US")} <span style={{ fontSize: 80, color: theme.colors.ink }}>{team.scale.post}</span>
        </div>
        <div style={{ marginTop: 40, display: "grid", gridTemplateColumns: `repeat(${GRID.cols}, 150px)`, gap: 22 }}>
          {Array.from({ length: total }).map((_, i) => {
            const p = spring({ frame: frame - GRID.start - i * GRID.step, fps, config: theme.spring.bouncy });
            return (
              <div key={i} style={{ transform: `scale(${p}) rotate(${Math.sin(frame / 8 + i) * 4}deg)`, height: 190, display: "grid", placeItems: "center" }}>
                <Img src={staticFile("cut/bag.png")} style={{ height: 180, filter: "drop-shadow(0 6px 6px rgba(90,20,20,0.25))" }} />
              </div>
            );
          })}
        </div>
        <div style={{ marginTop: 50, transform: sub.transform, opacity: sub.opacity }}>
          <div style={{
            background: theme.colors.yellow, borderRadius: 999, padding: "20px 48px", border: `5px solid ${theme.colors.ink}`,
            boxShadow: `8px 8px 0 ${theme.colors.ink}`, ...headline, fontSize: 54,
          }}>{team.scale.sub}</div>
        </div>
      </AbsoluteFill>
      <Confetti start={46} count={50} />
    </Exit>
  );
};

export const TeamRation: React.FC = () => (
  <AbsoluteFill>
    <CuteBg />
    <Sequence from={hook.from} durationInFrames={hook.len}><Hook length={hook.len} /></Sequence>
    <Sequence from={jump.from} durationInFrames={jump.len}>
      <JumpIn length={jump.len} items={team.items} heading={team.jumpHeading} />
    </Sequence>
    <Sequence from={scale.from} durationInFrames={scale.len}><Scale length={scale.len} /></Sequence>
    <Sequence from={perks.from} durationInFrames={perks.len}>
      <Perks length={perks.len} heading={team.perksHeading} accent={1} perks={team.perks} peek={["cut/bag.png", "cut/tea.png"]} />
    </Sequence>
    <Sequence from={outro.from} durationInFrames={outro.len}><Outro cta={team.cta} chips={team.chips} /></Sequence>
    <Soundtrack cues={CUES} />
  </AbsoluteFill>
);
