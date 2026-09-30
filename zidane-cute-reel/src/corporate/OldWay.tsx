// Corporate reel: "The old way vs the Zidane way". Logo + theme only, no photography.
import React from "react";
import { AbsoluteFill, Img, interpolate, Sequence, staticFile, useCurrentFrame } from "remotion";
import { Cue, Soundtrack } from "../components/Soundtrack";
import { CExit, CorpBg, CorpOutro, H, Kicker, Reveal, Rule, corp, useIn } from "./kit";

const FPS = 30;
const sec = (s: number) => Math.round(s * FPS);

const oldWay = ["5+ vendors to chase", "Rates change every call", "Lists lost in chats", "Deliveries whenever"];
const newWay = ["One point of contact", "Clear, structured quotes", "Your list, organized for you", "Scheduled deliveries"];

const S = { hook: sec(2.8), old: sec(4.2), bridge: sec(1.8), neu: sec(4.2), statement: sec(2.4), outro: sec(4.4) };
const f = {
  old: S.hook,
  bridge: S.hook + S.old,
  neu: S.hook + S.old + S.bridge,
  statement: S.hook + S.old + S.bridge + S.neu,
  outro: S.hook + S.old + S.bridge + S.neu + S.statement,
};
export const OLDWAY_TOTAL = f.outro + S.outro;
const ROW = { start: 14, step: 9 };
const STRIKE = ROW.start + ROW.step * oldWay.length + 14;

const Hook: React.FC = () => {
  const strike = useIn(30, 16);
  return (
    <CExit length={S.hook}>
      <AbsoluteFill style={{ padding: `0 ${corp.pad}px`, justifyContent: "center" }}>
        <Reveal delay={2}><H size={130}>Still buying</H></Reveal>
        <Reveal delay={7}><H size={130}>groceries</H></Reveal>
        <div style={{ position: "relative", display: "inline-block", alignSelf: "flex-start" }}>
          <Reveal delay={12}><H size={130} color={corp.dim}>the old way?</H></Reveal>
          <div style={{ position: "absolute", left: 0, top: "52%", height: 12, width: `${strike * 100}%`, background: corp.red }} />
        </div>
      </AbsoluteFill>
    </CExit>
  );
};

const Mark: React.FC<{ kind: "x" | "check"; delay: number; color: string; bg: string }> = ({ kind, delay, color, bg }) => {
  const p = useIn(delay, 16);
  return (
    <svg width={76} height={76} viewBox="0 0 40 40" style={{ flexShrink: 0, opacity: p, transform: `scale(${interpolate(p, [0, 1], [0.6, 1])})` }}>
      <circle cx={20} cy={20} r={18} fill={bg} stroke={color} strokeWidth={2} />
      <path d={kind === "x" ? "M14 14l12 12M26 14L14 26" : "M12 20.5l5.5 5.5L28 15"} stroke={color} strokeWidth={3.2} fill="none" strokeLinecap="round" strokeLinejoin="round"
        pathLength={1} strokeDasharray={1} strokeDashoffset={1 - useIn(delay + 4, 14)} />
    </svg>
  );
};

const Rows: React.FC<{ items: string[]; kind: "x" | "check"; text: string; line: string; markColor: string; markBg: string }> = ({ items, kind, text, line, markColor, markBg }) => {
  const frame = useCurrentFrame();
  return (
    <div style={{ marginTop: 90 }}>
      {items.map((it, i) => {
        const d = ROW.start + i * ROW.step;
        const p = interpolate(frame, [d, d + 18], [0, 1], { easing: corp.out, ...corp.clamp });
        return (
          <div key={it}>
            <Rule delay={d} color={line} />
            <div style={{ display: "flex", alignItems: "center", gap: 36, padding: "40px 0", opacity: p, transform: `translateX(${interpolate(p, [0, 1], [50, 0])}px)` }}>
              <Mark kind={kind} delay={d + 3} color={markColor} bg={markBg} />
              <div style={{ fontFamily: corp.display, fontWeight: 600, fontSize: 58, letterSpacing: "-0.02em", color: text }}>{it}</div>
            </div>
          </div>
        );
      })}
      <Rule delay={ROW.start + items.length * ROW.step} color={line} />
    </div>
  );
};

const Old: React.FC = () => {
  const strike = useIn(STRIKE, 14);
  return (
    <CExit length={S.old}>
      <AbsoluteFill style={{ padding: `580px ${corp.pad}px 0` }}>
        <Kicker>The old way</Kicker>
        <div style={{ position: "relative" }}>
          <div style={{ filter: `grayscale(${strike})`, opacity: interpolate(strike, [0, 1], [1, 0.45]) }}>
            <Rows items={oldWay} kind="x" text={corp.dim} line={corp.lineStrong} markColor={corp.red} markBg="transparent" />
          </div>
          {/* one red line crosses the whole list out */}
          <svg style={{ position: "absolute", inset: 0, overflow: "visible" }} width="100%" height="100%" viewBox="0 0 888 760" preserveAspectRatio="none">
            <path d="M-10 690 L900 110" stroke={corp.red} strokeWidth={10} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - strike} />
          </svg>
        </div>
      </AbsoluteFill>
    </CExit>
  );
};

// Red panel wipes up; logo mark lands in the centre.
const Bridge: React.FC = () => {
  const frame = useCurrentFrame();
  const wipe = interpolate(frame, [0, 14], [0, 1], { easing: corp.inOut, ...corp.clamp });
  const logo = useIn(10, 20);
  const line = useIn(20, 18);
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ background: corp.red, clipPath: `inset(${(1 - wipe) * 100}% 0 0 0)` }} />
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <div style={{ opacity: logo, transform: `scale(${interpolate(logo, [0, 1], [0.85, 1])})` }}>
          <Img src={staticFile("brand/zidane-logo-white.svg")} style={{ width: 760 }} />
        </div>
        <div style={{ marginTop: 50, fontFamily: corp.body, fontWeight: 600, fontSize: 36, letterSpacing: "0.3em", textTransform: "uppercase", color: "rgba(255,255,255,0.85)", opacity: line }}>
          There's a better way
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const New: React.FC = () => (
  <AbsoluteFill style={{ background: corp.red }}>
    {/* subtle darker columns on red */}
    {Array.from({ length: 5 }).map((_, i) => (
      <div key={i} style={{ position: "absolute", top: 0, bottom: 0, left: 180 * (i + 1), width: 1, background: "rgba(0,0,0,0.12)" }} />
    ))}
    <CExit length={S.neu}>
      <AbsoluteFill style={{ padding: `580px ${corp.pad}px 0` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
          <div style={{ width: 70, height: 4, background: "#fff" }} />
          <div style={{ fontFamily: corp.body, fontWeight: 600, fontSize: 30, letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(255,255,255,0.85)" }}>The Zidane way</div>
        </div>
        <Rows items={newWay} kind="check" text="#FFFFFF" line="rgba(255,255,255,0.35)" markColor="#FFFFFF" markBg="rgba(0,0,0,0.12)" />
      </AbsoluteFill>
    </CExit>
  </AbsoluteFill>
);

const Statement: React.FC = () => (
  <CExit length={S.statement}>
    <AbsoluteFill style={{ padding: `0 ${corp.pad}px`, justifyContent: "center" }}>
      <Reveal delay={2}><H size={120}>Less chasing.</H></Reveal>
      <Reveal delay={9}><H size={120} color={corp.red}>More running</H></Reveal>
      <Reveal delay={13}><H size={120} color={corp.red}>your business.</H></Reveal>
    </AbsoluteFill>
  </CExit>
);

const cues: Cue[] = [
  { at: 32, src: "whoosh", volume: 0.3, note: "strike 'old way'" },
  ...oldWay.map((_, i) => ({ at: f.old + ROW.start + i * ROW.step, src: "tick" as const, volume: 0.3, note: `old ${i + 1}` })),
  { at: f.old + STRIKE, src: "whoosh", volume: 0.35, note: "list crossed out" },
  { at: f.bridge, src: "whoosh", volume: 0.4, note: "red wipe" },
  { at: f.bridge + 10, src: "bass", volume: 0.6, note: "logo" },
  ...newWay.map((_, i) => ({ at: f.neu + ROW.start + i * ROW.step, src: "tick" as const, volume: 0.35, note: `new ${i + 1}` })),
  { at: f.statement, src: "whoosh", volume: 0.3, note: "statement" },
  { at: f.outro + 4, src: "bass", volume: 0.5, note: "end logo" },
];

export const CorpOldWay: React.FC = () => (
  <AbsoluteFill>
    <CorpBg />
    <Sequence durationInFrames={S.hook}><Hook /></Sequence>
    <Sequence from={f.old} durationInFrames={S.old}><Old /></Sequence>
    <Sequence from={f.bridge} durationInFrames={S.bridge}><Bridge /></Sequence>
    <Sequence from={f.neu} durationInFrames={S.neu}><New /></Sequence>
    <Sequence from={f.statement} durationInFrames={S.statement}><Statement /></Sequence>
    <Sequence from={f.outro} durationInFrames={S.outro}><CorpOutro line1="Switch to the Zidane way." line2="Send your list today." /></Sequence>
    <Soundtrack cues={cues} bed={0.5} music="sfx/corp-bed.wav" />
  </AbsoluteFill>
);
