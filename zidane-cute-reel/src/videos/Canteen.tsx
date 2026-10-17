// Reel 1 — "Canteen ka stock phir khatam?" Bulk grocery supply for factories and offices.
import React from "react";
import { AbsoluteFill, interpolate, Sequence, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { theme } from "../theme";
import { BounceWords, CuteBg, Exit, Sparkle, Sticker, headline, usePop, useWiggle } from "../components/Cute";
import { Squad, SQUAD_START, SQUAD_STEP } from "../scenes/Squad";
import { Perks, PERK_START, PERK_STEP } from "../components/Perks";
import { Outro, LOGO_LAND } from "../scenes/Outro";
import { Cue, Soundtrack } from "../components/Soundtrack";

const FPS = 30;
const sec = (s: number) => Math.round(s * FPS);

export const canteen = {
  hook: { line1: "Canteen ka stock", line2: "phir khatam?" },
  relief: { small: "Tension na lo…", big: ["Zidane", "hai", "na!"] },
  squadHeading: "Bulk mein sab kuch",
  squad: [
    { img: "cut/atta.png", say: "50 bori bhi chalegi", w: 300 },
    { img: "cut/oil.png", say: "Cartons ready", w: 300 },
    { img: "cut/moong.png", say: "Har qism ki daal", w: 300 },
    { img: "cut/kala-chana.png", say: "Chana bhi mera", w: 300 },
    { img: "cut/chilli.png", say: "Masala fresh", w: 300 },
    { img: "cut/salt.png", say: "Namak kabhi khatam nahi", w: 280 },
  ],
  perksHeading: "Aapka kaam easy",
  perks: [
    { icon: "calendar", title: "Scheduled delivery", sub: "Weekly ya monthly" },
    { icon: "tag", title: "Wholesale rates", sub: "Bulk ka faida aapka" },
    { icon: "receipt", title: "Proper invoice", sub: "Accounts bhi khush" },
  ],
  cta: "Aaj hi quote lo!",
  chips: ["Factories", "Offices", "Hospitals", "Schools"],
} as const;

const hook = { from: 0, len: sec(3) };
const relief = { from: hook.from + hook.len, len: sec(2.2) };
const squad = { from: relief.from + relief.len, len: sec(5.2) };
const perks = { from: squad.from + squad.len, len: sec(3.4) };
const outro = { from: perks.from + perks.len, len: sec(4.4) };
export const CANTEEN_TOTAL = outro.from + outro.len;

const CUES: Cue[] = [
  { at: hook.from + 3, src: "pop", volume: 0.45, note: "hook words" },
  { at: hook.from + 16, src: "tick", volume: 0.4, note: "sad bag drops" },
  { at: relief.from, src: "whoosh", volume: 0.45, note: "relief" },
  { at: relief.from + 8, src: "bass", volume: 0.55, note: "big happy bag" },
  ...canteen.squad.map((_, i) => ({ at: squad.from + SQUAD_START + i * SQUAD_STEP, src: "pop" as const, volume: 0.48, note: `item ${i + 1}` })),
  ...canteen.perks.map((_, i) => ({ at: perks.from + PERK_START + i * PERK_STEP, src: "tick" as const, volume: 0.45, note: `perk ${i + 1}` })),
  { at: outro.from, src: "whoosh", volume: 0.45, note: "red wipe" },
  { at: outro.from + LOGO_LAND, src: "bass", volume: 0.8, note: "logo" },
  { at: outro.from + 44, src: "pop", volume: 0.45, note: "WhatsApp pill" },
];

const Hook: React.FC<{ length: number }> = ({ length }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const drop = spring({ frame: frame - 10, fps, config: theme.spring.bouncy });
  const shake = Math.sin(frame / 2) * interpolate(frame, [30, 40, 60], [0, 5, 0], theme.clamp);
  return (
    <Exit length={length}>
      <AbsoluteFill style={{ alignItems: "center" }}>
        <div style={{ marginTop: 260 }}>
          <BounceWords words={canteen.hook.line1.split(" ")} delay={0} fontSize={theme.size.title} />
        </div>
        <div style={{ marginTop: 16 }}>
          <BounceWords words={canteen.hook.line2.split(" ")} delay={10} fontSize={theme.size.hero} accent={1} color={theme.colors.red} />
        </div>
      </AbsoluteFill>
      {/* empty shelf + sad bag */}
      <div style={{ position: "absolute", left: 140, right: 140, top: 1500, height: 22, borderRadius: 11, background: theme.colors.ink, opacity: 0.85 }} />
      <div style={{ position: "absolute", left: 540, top: 1500, transform: `translate(-50%, -100%) translateY(${interpolate(drop, [0, 1], [-900, 0])}px) rotate(${shake}deg)` }}>
        <Sticker src="cut/bag.png" width={420} faceY={0.22} faceScale={0.55} mood="sad" />
      </div>
      <div style={{ ...headline, position: "absolute", width: "100%", top: 1580, fontSize: 48, color: theme.colors.ink, opacity: interpolate(frame, [30, 40], [0, 0.7], theme.clamp) }}>
        *shelf bilkul khaali*
      </div>
    </Exit>
  );
};

const Relief: React.FC<{ length: number }> = ({ length }) => {
  const small = usePop(0);
  const bag = usePop(6);
  const w = useWiggle(0, 5);
  return (
    <Exit length={length}>
      <AbsoluteFill style={{ alignItems: "center" }}>
        <div style={{ marginTop: 280, transform: small.transform, opacity: small.opacity }}>
          <div style={{ ...headline, fontSize: 64, color: theme.colors.red, fontWeight: 700 }}>{canteen.relief.small}</div>
        </div>
        <div style={{ marginTop: 20 }}>
          <BounceWords words={canteen.relief.big} delay={4} fontSize={140} accent={0} />
        </div>
        <div style={{ marginTop: 90, transform: `${bag.transform} translateY(${w.y}px) rotate(${w.rot}deg)`, opacity: bag.opacity }}>
          <Sticker src="cut/bag.png" width={560} faceY={0.2} faceScale={0.5} />
        </div>
      </AbsoluteFill>
      <Sparkle size={90} x={120} y={900} delay={10} />
      <Sparkle size={70} x={880} y={1000} delay={14} color={theme.colors.red} />
      <Sparkle size={60} x={860} y={560} delay={18} color={theme.colors.pink} />
    </Exit>
  );
};

export const Canteen: React.FC = () => (
  <AbsoluteFill>
    <CuteBg />
    <Sequence from={hook.from} durationInFrames={hook.len}><Hook length={hook.len} /></Sequence>
    <Sequence from={relief.from} durationInFrames={relief.len}><Relief length={relief.len} /></Sequence>
    <Sequence from={squad.from} durationInFrames={squad.len}>
      <Squad length={squad.len} heading={canteen.squadHeading} accent={0} items={canteen.squad} />
    </Sequence>
    <Sequence from={perks.from} durationInFrames={perks.len}>
      <Perks length={perks.len} heading={canteen.perksHeading} accent={2} perks={canteen.perks} />
    </Sequence>
    <Sequence from={outro.from} durationInFrames={outro.len}><Outro cta={canteen.cta} chips={canteen.chips} /></Sequence>
    <Soundtrack cues={CUES} />
  </AbsoluteFill>
);
