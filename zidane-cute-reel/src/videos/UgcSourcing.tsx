// UGC-style talking-head reel with the animated presenter "Zidane Bhai".
// Format mirrors creator reels: one person talking to camera, jump-cut zooms, bold captions.
import React from "react";
import { AbsoluteFill, interpolate, Sequence, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { theme } from "../theme";
import { Sticker, usePop } from "../components/Cute";
import { Brow, Pose, ZidaneBhai } from "../components/ZidaneBhai";
import { Outro, LOGO_LAND } from "../scenes/Outro";
import { Cue, Soundtrack } from "../components/Soundtrack";

const FPS = 30;
const sec = (s: number) => Math.round(s * FPS);

type Line = { text: string; dur: number; brow: Brow; pose: Pose; zoom: number; extra?: "phones" | "chat" | "bags" | "arrow" | "clock" };

// Edit the script here.
export const ugcLines: Line[] = [
  { text: "Agar aapki company ki sourcing aisi hai…", dur: 2.3, brow: "raised", pose: "chin", zoom: 1 },
  { text: "5 vendors. 50 calls.", dur: 1.7, brow: "raised", pose: "chin", zoom: 1.14, extra: "phones" },
  { text: "Phir bhi delivery late?", dur: 1.7, brow: "sad", pose: "rest", zoom: 1, extra: "clock" },
  { text: "Bas karo yaar.", dur: 1.5, brow: "sure", pose: "open", zoom: 1.22 },
  { text: "List bhejo Zidane ko. WhatsApp pe.", dur: 2.2, brow: "neutral", pose: "phone", zoom: 1.05, extra: "chat" },
  { text: "Quote bhi hum banayenge, delivery bhi.", dur: 2.3, brow: "sure", pose: "open", zoom: 1.12, extra: "bags" },
  { text: "Number neeche hai.", dur: 1.6, brow: "raised", pose: "point", zoom: 1, extra: "arrow" },
];

const starts = ugcLines.reduce<number[]>((acc, l, i) => [...acc, i === 0 ? 0 : acc[i - 1] + sec(ugcLines[i - 1].dur)], []);
const TALK_LEN = starts[starts.length - 1] + sec(ugcLines[ugcLines.length - 1].dur);
const outro = { from: TALK_LEN, len: sec(4.4) };
export const UGC_TOTAL = outro.from + outro.len;

const CUES: Cue[] = [
  ...ugcLines.map((l, i) => ({ at: starts[i], src: (i === 3 ? "bass" : "tick") as Cue["src"], volume: i === 3 ? 0.5 : 0.25, note: `cut ${i + 1}` })),
  { at: starts[1] + 4, src: "pop", volume: 0.45, note: "phones" },
  { at: starts[4] + 10, src: "pop", volume: 0.5, note: "chat bubble" },
  { at: starts[5] + 8, src: "pop", volume: 0.5, note: "bags" },
  { at: outro.from, src: "whoosh", volume: 0.45, note: "red wipe" },
  { at: outro.from + LOGO_LAND, src: "bass", volume: 0.8, note: "logo" },
  { at: outro.from + 44, src: "pop", volume: 0.45, note: "WhatsApp pill" },
];

// Flat illustrated warehouse, blurred like a phone camera's portrait mode.
const Warehouse: React.FC = () => (
  <AbsoluteFill style={{ filter: "blur(7px)", transform: "scale(1.05)" }}>
    <svg width={1080} height={1920} viewBox="0 0 1080 1920">
      <rect width={1080} height={1920} fill="#EFE2CF" />
      <rect y={0} width={1080} height={140} fill="#D9C7AE" />
      {[0, 1, 2, 3].map((i) => <rect key={i} x={60 + i * 270} y={20} width={120} height={60} rx={10} fill="#FFF6D8" />)}
      {[380, 700, 1020].map((y) => <rect key={y} x={0} y={y} width={1080} height={26} fill="#8B6A4E" />)}
      {[0, 1, 2].map((row) =>
        Array.from({ length: 7 }).map((_, i) => {
          const red = (i + row) % 3 === 0;
          return (
            <rect key={`${row}-${i}`} x={20 + i * 150} y={220 + row * 320} width={130} height={160} rx={26}
              fill={red ? theme.colors.red : "#F7F0E1"} stroke={red ? "#8E1B21" : "#D8C9AE"} strokeWidth={6} />
          );
        }),
      )}
      <rect y={1300} width={1080} height={620} fill="#CDB89A" />
    </svg>
  </AbsoluteFill>
);

const Caption: React.FC<{ text: string }> = ({ text }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = text.split(" ");
  return (
    <div style={{ position: "absolute", top: 300, left: 70, right: 70, display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "4px 20px" }}>
      {words.map((w, i) => {
        const p = spring({ frame: frame - i * 2, fps, config: theme.spring.snappy });
        return (
          <span key={i} style={{
            fontFamily: theme.fonts.display, fontWeight: 800, fontSize: 76, color: theme.colors.white, lineHeight: 1.15,
            textShadow: "0 0 3px #111, 0 0 3px #111, 3px 3px 0 #111, -3px -3px 0 #111, 3px -3px 0 #111, -3px 3px 0 #111, 0 5px 12px rgba(0,0,0,0.5)", letterSpacing: "-0.01em",
            display: "inline-block", opacity: p, transform: `scale(${interpolate(p, [0, 1], [0.7, 1])})`,
          }}>{w}</span>
        );
      })}
    </div>
  );
};

const Extra: React.FC<{ kind: Line["extra"] }> = ({ kind }) => {
  const frame = useCurrentFrame();
  const a = usePop(4);
  const b = usePop(9);
  const c = usePop(14);
  if (kind === "phones") {
    return (
      <>
        {[a, b, c].map((p, i) => (
          <div key={i} style={{ position: "absolute", left: [110, 820, 150][i], top: [620, 700, 1000][i], transform: `${p.transform} rotate(${Math.sin(frame / 2 + i) * 12}deg)`, opacity: p.opacity }}>
            <div style={{ width: 130, height: 130, borderRadius: 65, background: theme.colors.white, border: `6px solid #111`, display: "grid", placeItems: "center" }}>
              <svg width={70} height={70} viewBox="0 0 24 24"><path fill={theme.colors.red} d="M6.6 10.8a15.1 15.1 0 006.6 6.6l2.2-2.2a1 1 0 011-.25 11.4 11.4 0 003.6.57 1 1 0 011 1V20a1 1 0 01-1 1A17 17 0 013 4a1 1 0 011-1h3.5a1 1 0 011 1c0 1.25.2 2.45.57 3.57a1 1 0 01-.25 1z" /></svg>
            </div>
          </div>
        ))}
      </>
    );
  }
  if (kind === "clock") {
    return (
      <div style={{ position: "absolute", left: 90, top: 640, transform: `${a.transform} rotate(${Math.sin(frame / 1.5) * 8}deg)`, opacity: a.opacity }}>
        <svg width={200} height={200} viewBox="0 0 100 100">
          <circle cx={50} cy={54} r={40} fill="#fff" stroke="#111" strokeWidth={6} />
          <path d={`M50 54 L50 28 M50 54 L${50 + Math.cos(frame / 3) * 22} ${54 + Math.sin(frame / 3) * 22}`} stroke={theme.colors.red} strokeWidth={6} strokeLinecap="round" />
          <path d="M20 14 L32 24 M80 14 L68 24" stroke="#111" strokeWidth={7} strokeLinecap="round" />
        </svg>
      </div>
    );
  }
  if (kind === "chat") {
    return (
      <div style={{ position: "absolute", left: 60, top: 640, transform: b.transform, opacity: b.opacity, transformOrigin: "right bottom" }}>
        <div style={{ background: "#DCF8C6", border: "5px solid #111", borderRadius: 30, borderBottomRightRadius: 6, padding: "20px 30px", fontFamily: theme.fonts.body, fontWeight: 600, fontSize: 40, boxShadow: "8px 8px 0 #111", lineHeight: 1.35 }}>
          atta 50 bori ✔️<br />chai 20 dabbe ✔️<br />oil 5L × 30 ✔️
        </div>
      </div>
    );
  }
  if (kind === "bags") {
    return (
      <>
        <div style={{ position: "absolute", left: 20, top: 1250, transform: `${a.transform} rotate(-8deg)`, opacity: a.opacity }}>
          <Sticker src="cut/bag.png" width={260} noFace />
        </div>
        <div style={{ position: "absolute", left: 60, top: 820, transform: `${b.transform} rotate(6deg)`, opacity: b.opacity }}>
          <Sticker src="cut/oil.png" width={190} noFace />
        </div>
        <div style={{ position: "absolute", right: 30, top: 700, transform: `${c.transform} rotate(10deg)`, opacity: c.opacity }}>
          <Sticker src="cut/atta.png" width={190} noFace />
        </div>
      </>
    );
  }
  if (kind === "arrow") {
    return (
      <div style={{ position: "absolute", left: 470, top: 1560 + Math.abs(Math.sin(frame / 5)) * 40, transform: a.transform, opacity: a.opacity }}>
        <svg width={140} height={180} viewBox="0 0 70 90"><path d="M35 5 V70 M10 48 L35 80 L60 48" stroke={theme.colors.yellow} strokeWidth={12} fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </div>
    );
  }
  return null;
};

// One "take": presenter + caption + extra. Jump-cut zoom and handheld jitter per take.
const Take: React.FC<{ line: Line; index: number }> = ({ line, index }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const poseT = spring({ frame: frame - 2, fps, config: theme.spring.snappy });
  const jx = Math.sin((frame + index * 40) / 9) * 5 + Math.sin(frame / 3.1) * 1.5;
  const jy = Math.cos((frame + index * 40) / 11) * 5;
  const speakingEnd = sec(line.dur) - 6;
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ transform: `translate(${jx}px, ${jy}px) scale(${line.zoom})`, transformOrigin: "50% 42%" }}>
        <Warehouse />
        <ZidaneBhai speaking={frame > 3 && frame < speakingEnd} brow={line.brow} pose={line.pose} poseT={poseT} smile={line.brow !== "sad"} />
        <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 45%, transparent 60%, rgba(0,0,0,0.28) 100%)" }} />
      </AbsoluteFill>
      <Extra kind={line.extra} />
      <Caption text={line.text} />
    </AbsoluteFill>
  );
};

export const UgcSourcing: React.FC = () => (
  <AbsoluteFill style={{ background: "#000" }}>
    {ugcLines.map((l, i) => (
      <Sequence key={i} from={starts[i]} durationInFrames={sec(l.dur)}>
        <Take line={l} index={i} />
      </Sequence>
    ))}
    <Sequence from={outro.from} durationInFrames={outro.len}>
      <AbsoluteFill style={{ background: theme.colors.bg }} />
      <Outro cta="List bhejo, quote lo!" chips={["Factories", "Offices", "NGOs"]} />
    </Sequence>
    <Soundtrack cues={CUES} bed={0.4} />
  </AbsoluteFill>
);
