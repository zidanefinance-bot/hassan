// Reel 2 — "List messy hai? Chalega!" A WhatsApp chat turns a messy buying list into a clean quote.
import React from "react";
import { AbsoluteFill, Img, interpolate, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { theme } from "../theme";
import { BounceWords, CuteBg, Exit, Sticker, headline, usePop, useWiggle } from "../components/Cute";
import { Outro, LOGO_LAND } from "../scenes/Outro";
import { Cue, Soundtrack } from "../components/Soundtrack";

const FPS = 30;
const sec = (s: number) => Math.round(s * FPS);

export const messy = {
  hook: { line1: ["List", "messy", "hai?"], line2: "Chalega!" },
  userMsg: ["bhai 50 bori atta", "chai k 20 dabbe", "oil 5L wala x30", "daal jo bhi achi ho"],
  zidaneTitle: "Quote ready!",
  quote: [
    ["Atta", "10 kg", "× 50"],
    ["Tea", "950 g", "× 20"],
    ["Cooking oil", "5 L", "× 30"],
    ["Daal moong", "25 kg", "× 4"],
  ],
  zidaneFoot: "Delivery date confirm kar dein?",
  formatsHeading: "Kisi bhi form mein bhejo",
  formats: [
    { label: "Excel", color: "#1D9E5A", glyph: "XLS" },
    { label: "PDF", color: "#D93A3A", glyph: "PDF" },
    { label: "WhatsApp", color: "#25D366", glyph: "WA" },
    { label: "Photo", color: "#3B7BE0", glyph: "IMG" },
  ],
  cta: "List bhejo, quote lo!",
  chips: ["Bulk grocery", "Ration bags", "Karachi"],
} as const;

const hook = { from: 0, len: sec(2.6) };
const chat = { from: hook.from + hook.len, len: sec(7) };
const formats = { from: chat.from + chat.len, len: sec(3) };
const outro = { from: formats.from + formats.len, len: sec(4.4) };
export const MESSY_TOTAL = outro.from + outro.len;

const T = { user: 10, typing: 60, reply: 96, rows: 110, rowStep: 8, foot: 150 }; // chat-local frames

const CUES: Cue[] = [
  { at: hook.from + 2, src: "pop", volume: 0.45, note: "List messy hai" },
  { at: hook.from + 30, src: "bass", volume: 0.5, note: "Chalega!" },
  { at: chat.from, src: "whoosh", volume: 0.4, note: "phone slides in" },
  { at: chat.from + T.user, src: "pop", volume: 0.5, note: "user message" },
  { at: chat.from + T.typing, src: "tick", volume: 0.3, note: "typing" },
  { at: chat.from + T.reply, src: "pop", volume: 0.55, note: "Zidane reply" },
  ...messy.quote.map((_, i) => ({ at: chat.from + T.rows + i * T.rowStep, src: "tick" as const, volume: 0.35, note: `quote row ${i + 1}` })),
  ...messy.formats.map((_, i) => ({ at: formats.from + 10 + i * 6, src: "pop" as const, volume: 0.45, note: `format ${i + 1}` })),
  { at: outro.from, src: "whoosh", volume: 0.45, note: "red wipe" },
  { at: outro.from + LOGO_LAND, src: "bass", volume: 0.8, note: "logo" },
  { at: outro.from + 44, src: "pop", volume: 0.45, note: "WhatsApp pill" },
];

const Hook: React.FC<{ length: number }> = ({ length }) => {
  const frame = useCurrentFrame();
  const chalega = usePop(28);
  const w = useWiggle(0, 4);
  // crumpled paper doodle that shakes
  const shake = Math.sin(frame / 1.5) * interpolate(frame, [0, 20, 28], [6, 6, 0], theme.clamp);
  return (
    <Exit length={length}>
      <AbsoluteFill style={{ alignItems: "center" }}>
        <div style={{ marginTop: 300 }}>
          <BounceWords words={messy.hook.line1} delay={0} fontSize={theme.size.hero} accent={1} />
        </div>
        <div style={{ marginTop: 70, transform: `rotate(${shake}deg)` }}>
          <MessyNote />
        </div>
        <div style={{ position: "absolute", top: 1450, transform: `${chalega.transform} rotate(-4deg)`, opacity: chalega.opacity }}>
          <div style={{
            ...headline, fontSize: 130, color: theme.colors.white, background: theme.colors.red, padding: "18px 60px",
            borderRadius: 40, border: `6px solid ${theme.colors.ink}`, boxShadow: `12px 12px 0 ${theme.colors.ink}`,
          }}>{messy.hook.line2}</div>
        </div>
      </AbsoluteFill>
      <div style={{ position: "absolute", right: 70, top: 1640, transform: `${chalega.transform} rotate(${8 + w.rot}deg)`, opacity: chalega.opacity }}>
        <Sticker src="cut/tea.png" width={220} faceY={0.55} mood="wink" />
      </div>
    </Exit>
  );
};

// Scribbled paper list (all SVG, handwriting-ish strokes)
const MessyNote: React.FC = () => (
  <svg width={620} height={620} viewBox="0 0 300 300">
    <path d="M30 20 L270 30 L262 280 L40 270 Z" fill="#FFFDF4" stroke={theme.colors.ink} strokeWidth={4} strokeLinejoin="round" />
    <path d="M60 30 L80 272" stroke="#FF8FA3" strokeWidth={2} />
    {[70, 110, 150, 190, 230].map((y, i) => (
      <path key={y} d={`M95 ${y} q20 -${8 + i} 40 0 t40 ${i % 2 ? 4 : -4} t40 2 ${i === 2 ? "t30 -6" : ""}`} stroke="#3B4A8C" strokeWidth={5} fill="none" strokeLinecap="round" />
    ))}
    <path d="M100 112 L230 104" stroke={theme.colors.red} strokeWidth={4} strokeLinecap="round" />
    <path d="M200 200 q20 -30 40 0 q-20 30 -40 0" stroke={theme.colors.red} strokeWidth={4} fill="none" />
    <text x={218} y={262} fontSize={30} fill="#3B4A8C" fontFamily="cursive">??</text>
  </svg>
);

const Chat: React.FC<{ length: number }> = ({ length }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const phone = spring({ frame, fps, config: theme.spring.smooth });
  const user = usePop(T.user);
  const reply = usePop(T.reply);
  const foot = usePop(T.foot);
  const typing = frame >= T.typing && frame < T.reply;
  const heading = usePop(4);
  const cheer = usePop(T.reply + 10);
  const w = useWiggle(0, 4);
  return (
    <Exit length={length}>
      <AbsoluteFill style={{ alignItems: "center" }}>
        <div style={{ marginTop: 130, transform: heading.transform, opacity: heading.opacity }}>
          <div style={{ ...headline, fontSize: 64 }}>Aap bhejo aisa… <span style={{ color: theme.colors.red }}>hum dein aisa</span></div>
        </div>
      </AbsoluteFill>
      {/* phone */}
      <div
        style={{
          position: "absolute", left: 540, top: 270, width: 820, height: 1480,
          transform: `translateX(-50%) translateY(${interpolate(phone, [0, 1], [1600, 0])}px) rotate(${interpolate(phone, [0, 1], [8, 0])}deg)`,
          background: theme.colors.ink, borderRadius: 90, padding: 22, boxShadow: "0 40px 80px rgba(60,10,10,0.35)",
        }}
      >
        <div style={{ width: "100%", height: "100%", borderRadius: 70, overflow: "hidden", background: "#ECE5DD", position: "relative" }}>
          {/* header */}
          <div style={{ background: "#075E54", height: 170, display: "flex", alignItems: "center", gap: 24, padding: "40px 36px 0" }}>
            <Img src={staticFile("brand/zidane-icon.svg")} style={{ width: 88, height: 88, borderRadius: 44 }} />
            <div>
              <div style={{ fontFamily: theme.fonts.body, fontWeight: 600, fontSize: 40, color: theme.colors.white }}>Zidane Wholesale</div>
              <div style={{ fontFamily: theme.fonts.body, fontSize: 28, color: "rgba(255,255,255,0.8)" }}>{typing ? "typing…" : "online"}</div>
            </div>
          </div>
          <div style={{ padding: "36px 30px", display: "flex", flexDirection: "column", gap: 28 }}>
            {/* user message */}
            <div style={{ alignSelf: "flex-end", transform: user.transform, opacity: user.opacity, transformOrigin: "right top" }}>
              <Bubble side="right">
                {messy.userMsg.map((l, i) => <div key={i}>{l}</div>)}
              </Bubble>
            </div>
            {typing && (
              <div style={{ alignSelf: "flex-start" }}>
                <Bubble side="left"><Dots frame={frame} /></Bubble>
              </div>
            )}
            {frame >= T.reply && (
              <div style={{ alignSelf: "flex-start", transform: reply.transform, opacity: reply.opacity, transformOrigin: "left top" }}>
                <Bubble side="left">
                  <div style={{ fontFamily: theme.fonts.display, fontWeight: 800, fontSize: 44, color: "#1D9E5A", marginBottom: 14 }}>
                    <Check /> {messy.zidaneTitle}
                  </div>
                  <div style={{ border: "3px solid #E3DED6", borderRadius: 18, overflow: "hidden", width: 590 }}>
                    {messy.quote.map((r, i) => {
                      const rp = spring({ frame: frame - T.rows - i * T.rowStep, fps, config: theme.spring.snappy });
                      return (
                        <div key={i} style={{
                          display: "flex", justifyContent: "space-between", padding: "14px 20px", fontSize: 34,
                          background: i % 2 ? "#FAF7F2" : theme.colors.white, opacity: rp, transform: `translateX(${interpolate(rp, [0, 1], [-30, 0])}px)`,
                        }}>
                          <span style={{ fontWeight: 600, width: 250 }}>{r[0]}</span>
                          <span style={{ color: "#6B6B6B", width: 150 }}>{r[1]}</span>
                          <span style={{ fontWeight: 800, color: theme.colors.red }}>{r[2]}</span>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ marginTop: 16, fontSize: 32, color: "#555", opacity: foot.opacity }}>{messy.zidaneFoot}</div>
                </Bubble>
              </div>
            )}
          </div>
        </div>
      </div>
      <div style={{ position: "absolute", left: 20, top: 1580, transform: `${cheer.transform} rotate(${-10 + w.rot}deg)`, opacity: cheer.opacity }}>
        <Sticker src="cut/bag.png" width={250} faceY={0.22} faceScale={0.55} />
      </div>
    </Exit>
  );
};

const Bubble: React.FC<{ side: "left" | "right"; children: React.ReactNode }> = ({ side, children }) => (
  <div style={{
    background: side === "right" ? "#DCF8C6" : theme.colors.white, borderRadius: 26,
    borderTopRightRadius: side === "right" ? 4 : 26, borderTopLeftRadius: side === "left" ? 4 : 26,
    padding: "22px 28px", fontFamily: theme.fonts.body, fontSize: 40, color: "#111", lineHeight: 1.35,
    boxShadow: "0 2px 3px rgba(0,0,0,0.12)", maxWidth: 680,
  }}>{children}</div>
);

const Dots: React.FC<{ frame: number }> = ({ frame }) => (
  <div style={{ display: "flex", gap: 10, padding: "8px 4px" }}>
    {[0, 1, 2].map((i) => (
      <div key={i} style={{ width: 16, height: 16, borderRadius: 8, background: "#999", transform: `translateY(${Math.sin((frame - i * 4) / 3) * 6}px)` }} />
    ))}
  </div>
);

const Check: React.FC = () => (
  <svg width={40} height={40} viewBox="0 0 40 40" style={{ verticalAlign: "-6px" }}>
    <circle cx={20} cy={20} r={18} fill="#1D9E5A" />
    <path d="M11 20l6 6 12-13" stroke="#fff" strokeWidth={5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const Formats: React.FC<{ length: number }> = ({ length }) => {
  const frame = useCurrentFrame();
  return (
    <Exit length={length}>
      <AbsoluteFill style={{ alignItems: "center" }}>
        <div style={{ marginTop: 260, width: 900 }}>
          <BounceWords words={messy.formatsHeading.split(" ")} delay={0} fontSize={theme.size.title} accent={1} />
        </div>
        <div style={{ marginTop: 110, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 50 }}>
          {messy.formats.map((f, i) => <FormatTile key={f.label} i={i} frame={frame} {...f} />)}
        </div>
        <div style={{ ...headline, marginTop: 110, fontSize: 52, color: theme.colors.red, opacity: interpolate(frame, [40, 50], [0, 1], theme.clamp) }}>
          Handwritten list bhi chalegi!
        </div>
      </AbsoluteFill>
    </Exit>
  );
};

const FormatTile: React.FC<{ i: number; frame: number; label: string; color: string; glyph: string }> = ({ i, frame, label, color, glyph }) => {
  const p = usePop(10 + i * 6);
  return (
    <div style={{ transform: `${p.transform} rotate(${Math.sin((frame + i * 20) / 12) * 3}deg)`, opacity: p.opacity, display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{
        width: 300, height: 300, borderRadius: 60, background: color, border: `6px solid ${theme.colors.ink}`,
        boxShadow: `10px 10px 0 ${theme.colors.ink}`, display: "grid", placeItems: "center",
        fontFamily: theme.fonts.display, fontWeight: 800, fontSize: 96, color: theme.colors.white,
      }}>{glyph}</div>
      <div style={{ ...headline, fontSize: 48, marginTop: 24 }}>{label}</div>
    </div>
  );
};

export const MessyList: React.FC = () => (
  <AbsoluteFill>
    <CuteBg />
    <Sequence from={hook.from} durationInFrames={hook.len}><Hook length={hook.len} /></Sequence>
    <Sequence from={chat.from} durationInFrames={chat.len}><Chat length={chat.len} /></Sequence>
    <Sequence from={formats.from} durationInFrames={formats.len}><Formats length={formats.len} /></Sequence>
    <Sequence from={outro.from} durationInFrames={outro.len}><Outro cta={messy.cta} chips={messy.chips} /></Sequence>
    <Soundtrack cues={CUES} />
  </AbsoluteFill>
);
