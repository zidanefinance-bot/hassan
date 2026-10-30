// "The Invisible Department": a quiet, editorial film for LinkedIn and social.
// Every company has a department that isn't on its org chart: supplies. Zidane is that department.
// Cream paper, ink, hairlines and a light serif; Zidane red only where it matters.
import React from "react";
import { AbsoluteFill, Audio, Easing, Img, interpolate, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

export const INV_FPS = 30;
export const INV_TOTAL = 900; // 30 s

const C = { paper: "#F4EFE6", ink: "#16130F", muted: "#7A7268", hair: "rgba(22,19,15,0.22)", red: "#B3262B" };
const SERIF = "Fraunces";
const SANS = "Inter";
const ease = Easing.bezier(0.22, 1, 0.36, 1);

const fade = (f: number, a: number, b: number) => interpolate(f, [a, b], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
const out = (f: number, a: number, b: number) => interpolate(f, [a, b], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });

// a line of text that rises softly into place
const Rise: React.FC<{ at: number; children: React.ReactNode; style?: React.CSSProperties; dur?: number }> = ({ at, children, style, dur = 22 }) => {
  const f = useCurrentFrame();
  const p = fade(f, at, at + dur);
  return <div style={{ opacity: p, transform: `translateY(${(1 - p) * 18}px)`, ...style }}>{children}</div>;
};

const Label: React.FC<{ children: React.ReactNode; color?: string; style?: React.CSSProperties }> = ({ children, color = C.muted, style }) => (
  <div style={{ fontFamily: SANS, fontWeight: 500, fontSize: 22, letterSpacing: "0.32em", textTransform: "uppercase", color, ...style }}>{children}</div>
);

// paper texture: a faint grain and a hairline frame that stays the whole film
const Paper: React.FC = () => {
  const f = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const frame = fade(f, 0, 30);
  return (
    <AbsoluteFill style={{ background: C.paper }}>
      <AbsoluteFill style={{ background: "radial-gradient(120% 90% at 50% 40%, rgba(255,255,255,0.55), rgba(0,0,0,0.05))" }} />
      <svg width={width} height={height} style={{ position: "absolute", inset: 0, opacity: frame }}>
        <rect x={40} y={40} width={width - 80} height={height - 80} fill="none" stroke={C.hair} strokeWidth={1.5} />
      </svg>
    </AbsoluteFill>
  );
};

// 1. the line that opens it
const Opening: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ justifyContent: "center", padding: "0 110px", opacity: out(f, 92, 108) }}>
      <Rise at={6}><Label>A note on how offices work</Label></Rise>
      <Rise at={20} style={{ fontFamily: SERIF, fontWeight: 300, fontSize: 84, lineHeight: 1.08, color: C.ink, marginTop: 36 }}>Every company has a department</Rise>
      <Rise at={44} style={{ fontFamily: SERIF, fontWeight: 300, fontStyle: "italic", fontSize: 84, lineHeight: 1.08, color: C.ink }}>that isn't on its org chart.</Rise>
    </AbsoluteFill>
  );
};

// 2. the org chart draws itself; a dashed box appears under it
const Box: React.FC<{ x: number; y: number; w: number; h: number; text: string; at: number; dashed?: boolean; color?: string; italic?: boolean; size?: number }> = ({ x, y, w, h, text, at, dashed, color = C.ink, italic, size = 30 }) => {
  const f = useCurrentFrame();
  const p = fade(f, at, at + 24);
  const per = 2 * (w + h);
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill="none" stroke={color} strokeWidth={dashed ? 2 : 1.6} strokeDasharray={dashed ? "10 9" : `${per}`} strokeDashoffset={dashed ? 0 : per * (1 - p)} opacity={dashed ? p : 1} />
      <text x={x + w / 2} y={y + h / 2 + size * 0.35} textAnchor="middle" fontFamily={SERIF} fontWeight={italic ? 400 : 300} fontStyle={italic ? "italic" : "normal"} fontSize={size} fill={color} opacity={fade(f, at + 10, at + 30)}>{text}</text>
    </g>
  );
};
const Wire: React.FC<{ d: string; len: number; at: number }> = ({ d, len, at }) => {
  const f = useCurrentFrame();
  return <path d={d} fill="none" stroke={C.ink} strokeWidth={1.4} strokeDasharray={len} strokeDashoffset={len * (1 - fade(f, at, at + 20))} />;
};
const OrgChart: React.FC = () => {
  const f = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const cx = width / 2, top = height * 0.2;
  const bw = 214, bh = 84, gap = 22, row2 = top + 220;
  const xs = [0, 1, 2, 3].map((i) => cx - (4 * bw + 3 * gap) / 2 + i * (bw + gap));
  const sy = row2 + 260;
  // the dashed box slowly grows: it is about to become the whole frame
  const grow = interpolate(f, [150, 195], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.65, 0, 0.35, 1) });
  return (
    <AbsoluteFill style={{ opacity: out(f, 186, 196) }}>
      <svg width={width} height={height} style={{ transform: `scale(${1 + grow * 5})`, transformOrigin: `${cx}px ${sy + bh / 2}px` }}>
        <Box x={cx - 180} y={top} w={360} h={bh} text="Managing Director" at={4} size={33} />
        <Wire d={`M ${cx} ${top + bh} V ${row2 - 50} M ${xs[0] + bw / 2} ${row2 - 50} H ${xs[3] + bw / 2}`} len={900} at={22} />
        {["Finance", "People", "Operations", "Sales"].map((t, i) => (
          <g key={t}>
            <Wire d={`M ${xs[i] + bw / 2} ${row2 - 50} V ${row2}`} len={50} at={34 + i * 4} />
            <Box x={xs[i]} y={row2} w={bw} h={bh} text={t} at={38 + i * 6} size={31} />
          </g>
        ))}
        <Box x={cx - 170} y={sy} w={340} h={bh + 8} text="Supplies" at={84} dashed color={C.red} italic size={38} />
      </svg>
      <div style={{ position: "absolute", left: 0, right: 0, top: sy + bh + 70, textAlign: "center", opacity: fade(f, 104, 126) * out(f, 150, 166) }}>
        <div style={{ fontFamily: SERIF, fontWeight: 300, fontStyle: "italic", fontSize: 40, color: C.ink }}>Everyone's job. Nobody's job.</div>
      </div>
    </AbsoluteFill>
  );
};

// 3. inside the dashed box: a day of small emergencies, like a ledger
const LEDGER = [
  ["09:12", "The tea has run out."],
  ["11:40", "Toner, before the board meeting."],
  ["15:05", "Gloves for the night shift."],
  ["17:20", "Rations for five hundred families."],
  ["18:30", "Six vendors. Nine invoices."],
];
const Ledger: React.FC = () => {
  const f = useCurrentFrame();
  const { width } = useVideoConfig();
  const strike = fade(f, 150, 176);
  return (
    <AbsoluteFill style={{ justifyContent: "center", padding: "0 100px", opacity: fade(f, 0, 14) * out(f, 196, 210) }}>
      <Rise at={4}><Label color={C.red}>Supplies · a Tuesday</Label></Rise>
      <div style={{ marginTop: 40 }}>
        {LEDGER.map(([t, s], i) => {
          const at = 18 + i * 24;
          const last = i === LEDGER.length - 1;
          return (
            <div key={t} style={{ position: "relative", display: "flex", gap: 34, alignItems: "baseline", padding: "22px 0", borderTop: `1px solid ${C.hair}`, opacity: fade(f, at, at + 18), transform: `translateX(${(1 - fade(f, at, at + 18)) * -14}px)` }}>
              <div style={{ fontFamily: SANS, fontWeight: 500, fontSize: 24, color: C.muted, letterSpacing: "0.08em", width: 90 }}>{t}</div>
              <div style={{ fontFamily: SERIF, fontWeight: 300, fontSize: 46, color: C.ink, lineHeight: 1.15, position: "relative" }}>
                {s}
                {last && <div style={{ position: "absolute", left: -4, top: "55%", height: 3, background: C.red, width: `${strike * 104}%` }} />}
              </div>
            </div>
          );
        })}
        <div style={{ borderTop: `1px solid ${C.hair}`, width: width - 200 }} />
      </div>
    </AbsoluteFill>
  );
};

// 4. the turn: one of everything
const Turn: React.FC = () => {
  const f = useCurrentFrame();
  const items = [["One", "supplier."], ["One", "invoice."], ["One", "call."]];
  return (
    <AbsoluteFill style={{ justifyContent: "center", padding: "0 110px", opacity: fade(f, 0, 12) * out(f, 150, 164) }}>
      <Rise at={4} style={{ fontFamily: SERIF, fontWeight: 300, fontSize: 78, lineHeight: 1.1, color: C.ink }}>So we became</Rise>
      <Rise at={18} style={{ fontFamily: SERIF, fontWeight: 400, fontStyle: "italic", fontSize: 78, lineHeight: 1.1, color: C.red }}>that department.</Rise>
      <div style={{ marginTop: 70 }}>
        {items.map(([a, b], i) => (
          <Rise key={b} at={56 + i * 16} style={{ display: "flex", alignItems: "baseline", gap: 22, padding: "14px 0", borderBottom: `1px solid ${C.hair}` }}>
            <span style={{ fontFamily: SANS, fontWeight: 500, fontSize: 22, color: C.muted, letterSpacing: "0.2em", width: 60 }}>0{i + 1}</span>
            <span style={{ fontFamily: SERIF, fontWeight: 300, fontSize: 56, color: C.ink }}>{a} <i style={{ fontWeight: 400 }}>{b}</i></span>
          </Rise>
        ))}
      </div>
      <Rise at={108} style={{ marginTop: 40, fontFamily: SANS, fontWeight: 400, fontSize: 28, lineHeight: 1.5, color: C.muted }}>
        Grocery, pantry, hygiene, stationery, tools and rations, delivered to your floor.
      </Rise>
    </AbsoluteFill>
  );
};

// 5. who already works this way
const Who: React.FC = () => {
  const f = useCurrentFrame();
  const sectors = ["Textile mills", "Hospitals", "Corporate offices", "Welfare programmes"];
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", textAlign: "center", padding: "0 100px", opacity: fade(f, 0, 12) * out(f, 106, 120) }}>
      <Rise at={4}><Label>Quietly running across Karachi</Label></Rise>
      <div style={{ marginTop: 46, display: "flex", flexDirection: "column", gap: 10 }}>
        {sectors.map((s, i) => (
          <Rise key={s} at={16 + i * 12} style={{ fontFamily: SERIF, fontWeight: 300, fontSize: 66, color: C.ink }}>{s}</Rise>
        ))}
      </div>
    </AbsoluteFill>
  );
};

// 6. the signature
const Signature: React.FC = () => {
  const f = useCurrentFrame();
  const { width } = useVideoConfig();
  const line = fade(f, 30, 60);
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", textAlign: "center", opacity: fade(f, 0, 16) }}>
      <div style={{ opacity: fade(f, 4, 28), transform: `scale(${0.96 + 0.04 * fade(f, 4, 40)})` }}>
        <Img src={staticFile("brand/zidane-logo.svg")} style={{ width: 460 }} />
      </div>
      <div style={{ width: (width * 0.42) * line, height: 1.5, background: C.ink, opacity: 0.35, margin: "46px 0" }} />
      <Rise at={44} style={{ fontFamily: SERIF, fontWeight: 300, fontStyle: "italic", fontSize: 52, color: C.ink, lineHeight: 1.15, padding: "0 90px" }}>The department you don't have to hire.</Rise>
      <Rise at={70} style={{ marginTop: 40 }}><Label color={C.red}>zidane.com.pk</Label></Rise>
    </AbsoluteFill>
  );
};

export const InvisibleDepartment: React.FC = () => (
  <AbsoluteFill style={{ background: C.paper }}>
    <Audio src={staticFile("sfx/invisible-bed.wav")} volume={(f) => interpolate(f, [0, 30, INV_TOTAL - 45, INV_TOTAL], [0, 0.7, 0.7, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })} />
    <Paper />
    <Sequence from={0} durationInFrames={110}><Opening /></Sequence>
    <Sequence from={104} durationInFrames={200}><OrgChart /></Sequence>
    <Sequence from={290} durationInFrames={212}><Ledger /></Sequence>
    {LEDGER.map((_, i) => <Sequence key={i} from={290 + 18 + i * 24} durationInFrames={20}><Audio src={staticFile("sfx/tick.wav")} volume={0.18} /></Sequence>)}
    <Sequence from={500} durationInFrames={166}><Turn /></Sequence>
    <Sequence from={662} durationInFrames={122}><Who /></Sequence>
    <Sequence from={780} durationInFrames={120}><Signature /></Sequence>
  </AbsoluteFill>
);
