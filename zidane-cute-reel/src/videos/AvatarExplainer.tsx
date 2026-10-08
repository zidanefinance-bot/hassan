// 30s explainer: animated presenter (Zidane Bhai) in an office, lip-synced to a Pakistani-accent
// voiceover, with a wall screen behind him that illustrates each line, pop-ups and captions.
import React from "react";
import { AbsoluteFill, Audio, Img, interpolate, Sequence, staticFile, useCurrentFrame } from "remotion";
import { CorpOutro, corp } from "../corporate/kit";
import { Brow, Pose, ZidaneBhai } from "../components/ZidaneBhai";
import { vo } from "./voData";

const FPS = 30;
const sec = (s: number) => Math.round(s * FPS);
const END_AT = vo.duration + 0.2; // seconds: end card starts
const OUTRO = 3.2;
export const AVATAR_TOTAL = sec(END_AT + OUTRO);

// ── word timings: spread across each line, weighted by word length ──
type Word = { w: string; t: number; line: number };
const words: Word[] = [];
vo.lines.forEach((l) => {
  const ws = l.text.replace(/zidane dot com dot p k/gi, "zidane.com.pk").split(" ");
  const weights = ws.map((w) => w.replace(/[^A-Za-z.]/g, "").length + 2 + (/[,.]$/.test(w) ? 3 : 0));
  const total = weights.reduce((a, b) => a + b, 0);
  let acc = 0;
  ws.forEach((w, i) => { words.push({ w, t: l.start + ((l.end - l.start) * acc) / total, line: l.i }); acc += weights[i]; });
});
const lineAt = (t: number) => {
  let cur = 0;
  vo.lines.forEach((l) => { if (t >= l.start - 0.2) cur = l.i; });
  return cur;
};
const wordTime = (line: number, match: string) => words.find((w) => w.line === line && w.w.toLowerCase().startsWith(match))?.t ?? vo.lines[line].start;

const looks: { brow: Brow; pose: Pose }[] = [
  { brow: "raised", pose: "chin" },
  { brow: "sad", pose: "open" },
  { brow: "sure", pose: "rest" },
  { brow: "neutral", pose: "phone" },
  { brow: "sure", pose: "open" },
  { brow: "raised", pose: "point" },
];

const ease = (f: number, a: number, b: number) => interpolate(f, [a, b], [0, 1], { easing: corp.out, ...corp.clamp });

// ── office set ──
const Office: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: "linear-gradient(180deg, #23262C 0%, #1B1D22 60%, #15171B 100%)" }}>
      {/* wood slat wall on the right */}
      {Array.from({ length: 9 }).map((_, i) => (
        <div key={i} style={{ position: "absolute", top: 0, bottom: 300, left: 1000 + i * 22, width: 14, background: "linear-gradient(180deg,#5A4130,#3E2C20)", opacity: 0.55 }} />
      ))}
      {/* window light */}
      <div style={{ position: "absolute", left: -200, top: 120, width: 600, height: 1200, background: "radial-gradient(ellipse, rgba(255,236,210,0.10), transparent 70%)", transform: `translateX(${Math.sin(frame / 90) * 10}px)` }} />
      {/* pendant lights */}
      {[260, 820].map((x) => (
        <div key={x} style={{ position: "absolute", left: x - 2, top: 0, width: 4, height: 140, background: "#0E0F11" }}>
          <div style={{ position: "absolute", left: -38, top: 140, width: 80, height: 34, borderRadius: "40px 40px 6px 6px", background: "#0E0F11" }} />
          <div style={{ position: "absolute", left: -140, top: 160, width: 284, height: 220, background: "radial-gradient(ellipse at top, rgba(255,214,160,0.18), transparent 70%)" }} />
        </div>
      ))}
      {/* plant */}
      <svg style={{ position: "absolute", left: 10, top: 1080 }} width={220} height={520} viewBox="0 0 220 520">
        {[[-30, 0.9], [-10, 1], [15, 0.95], [35, 0.85], [-50, 0.7], [55, 0.7]].map(([r, s], i) => (
          <ellipse key={i} cx={110} cy={180} rx={26 * (s as number)} ry={150 * (s as number)} fill={i % 2 ? "#2F5A3A" : "#3B6E47"} transform={`rotate(${r} 110 330)`} />
        ))}
        <path d="M60 330 h100 l-14 190 h-72z" fill="#2A2C31" />
      </svg>
    </AbsoluteFill>
  );
};

// ── wall screen with per-line content ──
const SCREEN = { x: 90, y: 230, w: 900, h: 560 };
const Screen: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const line = lineAt(t);
  const since = sec(t - Math.max(0, vo.lines[line].start - 0.2));
  const swap = ease(since, 0, 12);
  return (
    <div style={{ position: "absolute", left: SCREEN.x - 16, top: SCREEN.y - 16, width: SCREEN.w + 32, height: SCREEN.h + 32, background: "#0A0A0B", borderRadius: 18, boxShadow: "0 40px 90px rgba(0,0,0,.6), 0 0 120px rgba(215,38,46,0.12)" }}>
      <div style={{ position: "absolute", inset: 16, borderRadius: 6, overflow: "hidden", background: "#101216" }}>
        <div style={{ position: "absolute", inset: 0, opacity: swap, transform: `scale(${interpolate(swap, [0, 1], [1.04, 1])})` }}>
          {line === 0 && <ScreenChaos f={since} />}
          {line === 1 && <ScreenProblem f={since} />}
          {line === 2 && <ScreenLogo f={since} />}
          {line === 3 && <ScreenBrowser f={since} />}
          {line === 4 && <ScreenCategories f={since} />}
          {line === 5 && <ScreenUrl f={since} />}
        </div>
        {/* glass reflection */}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(115deg, rgba(255,255,255,0.07) 0%, transparent 38%)", pointerEvents: "none" }} />
      </div>
    </div>
  );
};

const scrTitle: React.CSSProperties = { fontFamily: corp.display, fontWeight: 800, letterSpacing: "-0.03em", color: corp.text };

const ScreenChaos: React.FC<{ f: number }> = ({ f }) => {
  const n = Math.min(47, Math.floor(f / 3));
  return (
    <AbsoluteFill style={{ padding: 40 }}>
      <div style={{ fontFamily: corp.body, fontWeight: 600, fontSize: 20, letterSpacing: "0.2em", color: corp.dim, textTransform: "uppercase" }}>Your grocery buying today</div>
      <div style={{ marginTop: 22, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
        {Array.from({ length: 12 }).map((_, i) => {
          const on = f > i * 6;
          const shake = on ? Math.sin((f + i * 7) / 1.4) * 4 : 0;
          return (
            <div key={i} style={{ height: 96, borderRadius: 14, background: on ? "#1E2128" : "#16181C", border: `2px solid ${on && i % 3 === 0 ? corp.red : "#262A31"}`, display: "grid", placeItems: "center", transform: `rotate(${shake}deg)` }}>
              <svg width={44} height={44} viewBox="0 0 24 24"><path fill={on ? (i % 3 === 0 ? corp.red : corp.text) : "#3A3F47"} d={i % 2 ? "M6.6 10.8a15.1 15.1 0 006.6 6.6l2.2-2.2a1 1 0 011-.25 11.4 11.4 0 003.6.57 1 1 0 011 1V20a1 1 0 01-1 1A17 17 0 013 4a1 1 0 011-1h3.5a1 1 0 011 1c0 1.25.2 2.45.57 3.57a1 1 0 01-.25 1z" : "M6 2h12v20l-3-2-3 2-3-2-3 2zM9 7h6M9 11h6M9 15h4"} stroke={i % 2 ? "none" : on ? corp.text : "#3A3F47"} strokeWidth={i % 2 ? 0 : 1.8} /></svg>
            </div>
          );
        })}
      </div>
      <div style={{ position: "absolute", right: 40, top: 30, background: corp.red, color: "#fff", borderRadius: 999, padding: "8px 18px", fontFamily: corp.display, fontWeight: 800, fontSize: 26 }}>{n} missed calls</div>
    </AbsoluteFill>
  );
};

const ScreenProblem: React.FC<{ f: number }> = ({ f }) => {
  const items = [{ k: "5", v: "suppliers" }, { k: "50", v: "calls" }, { k: "±", v: "prices, every time" }];
  const pts = Array.from({ length: 24 }).map((_, i) => `${40 + i * 35},${430 - (Math.sin(i * 1.7) * 60 + Math.cos(i * 0.9) * 40 + i * 2)}`).join(" ");
  const draw = ease(f, 70, 110);
  return (
    <AbsoluteFill style={{ padding: 44 }}>
      <div style={{ display: "flex", gap: 26 }}>
        {items.map((it, i) => {
          const p = ease(f, i * 24, i * 24 + 14);
          return (
            <div key={it.v} style={{ flex: 1, opacity: p, transform: `translateY(${(1 - p) * 30}px)`, borderTop: `4px solid ${corp.red}`, paddingTop: 16 }}>
              <div style={{ ...scrTitle, fontSize: 96, lineHeight: 1 }}>{it.k}</div>
              <div style={{ fontFamily: corp.body, fontSize: 26, color: corp.dim, marginTop: 6 }}>{it.v}</div>
            </div>
          );
        })}
      </div>
      <svg style={{ position: "absolute", left: 0, bottom: 0 }} width={900} height={500} viewBox="0 0 900 500">
        <polyline points={pts} fill="none" stroke={corp.red} strokeWidth={6} strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - draw} />
      </svg>
    </AbsoluteFill>
  );
};

const ScreenLogo: React.FC<{ f: number }> = ({ f }) => {
  const p = ease(f, 18, 40);
  return (
    <AbsoluteFill style={{ background: corp.red, justifyContent: "center", alignItems: "center" }}>
      <div style={{ fontFamily: corp.body, fontWeight: 600, fontSize: 24, letterSpacing: "0.3em", color: "rgba(255,255,255,.85)", textTransform: "uppercase", opacity: ease(f, 0, 14), marginBottom: 30 }}>There's a simpler way</div>
      <div style={{ opacity: p, transform: `scale(${interpolate(p, [0, 1], [0.85, 1])})` }}>
        <Img src={staticFile("brand/zidane-logo-white.svg")} style={{ width: 560 }} />
      </div>
    </AbsoluteFill>
  );
};

const ScreenBrowser: React.FC<{ f: number }> = ({ f }) => {
  const url = "www.zidane.com.pk";
  const typed = url.slice(0, Math.min(url.length, Math.floor(f / 2)));
  const rows = [["Cooking oil", "5 L", "× 40"], ["Basmati rice", "5 kg", "× 60"], ["Atta", "10 kg", "× 100"], ["Tea", "430 g", "× 30"]];
  return (
    <AbsoluteFill style={{ background: "#F4F2EF" }}>
      <div style={{ height: 64, background: "#E4E0DB", display: "flex", alignItems: "center", gap: 10, padding: "0 20px" }}>
        {["#E25B56", "#E9B94A", "#5DBB63"].map((c) => <div key={c} style={{ width: 14, height: 14, borderRadius: 7, background: c }} />)}
        <div style={{ marginLeft: 16, flex: 1, height: 38, borderRadius: 10, background: "#fff", display: "flex", alignItems: "center", padding: "0 16px", fontFamily: corp.body, fontSize: 22, color: "#222" }}>
          {typed}<span style={{ opacity: Math.floor(f / 8) % 2 ? 0 : 1 }}>|</span>
        </div>
      </div>
      <div style={{ padding: "26px 34px", display: "flex", gap: 26 }}>
        <div style={{ flex: 1, opacity: ease(f, 40, 55) }}>
          <div style={{ fontFamily: corp.display, fontWeight: 800, fontSize: 40, color: "#1A1516", letterSpacing: "-0.03em", lineHeight: 1.05 }}>Send the list.<br /><span style={{ color: corp.red }}>We'll quote it.</span></div>
          <div style={{ marginTop: 18, display: "flex", flexWrap: "wrap", gap: 8 }}>
            {["Excel", "PDF", "WhatsApp", "Photo"].map((x, i) => (
              <div key={x} style={{ border: "2px solid #D9D3CD", borderRadius: 999, padding: "6px 14px", fontFamily: corp.body, fontWeight: 600, fontSize: 18, color: "#333", opacity: ease(f, 55 + i * 6, 65 + i * 6) }}>{x}</div>
            ))}
          </div>
        </div>
        <div style={{ width: 400, background: "#fff", borderRadius: 16, boxShadow: "0 12px 30px rgba(0,0,0,.12)", padding: 18, opacity: ease(f, 95, 110), transform: `translateY(${(1 - ease(f, 95, 110)) * 30}px)` }}>
          <div style={{ fontFamily: corp.display, fontWeight: 800, fontSize: 22, color: "#1D9E5A" }}>✓ Quote ready</div>
          {rows.map((r, i) => (
            <div key={r[0]} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderTop: "1px solid #EEE", fontFamily: corp.body, fontSize: 19, opacity: ease(f, 110 + i * 7, 120 + i * 7) }}>
              <span style={{ fontWeight: 600, width: 170, color: "#222" }}>{r[0]}</span><span style={{ color: "#777" }}>{r[1]}</span><span style={{ fontWeight: 800, color: corp.red }}>{r[2]}</span>
            </div>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const ScreenCategories: React.FC<{ f: number }> = ({ f }) => {
  const cats = ["Oil & Ghee", "Rice", "Atta", "Masala", "Tea", "Dairy"];
  const L = vo.lines[4];
  const tNow = L.start - 0.2 + f / FPS;
  return (
    <AbsoluteFill style={{ padding: 40 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
        {cats.map((c, i) => {
          const key = ["oil", "rice", "atta", "masala", "tea", "dairy"][i];
          const on = tNow >= wordTime(4, key) - 0.05;
          return (
            <div key={c} style={{ height: 150, borderRadius: 18, border: `2px solid ${on ? corp.red : "#2A2E35"}`, background: on ? "rgba(215,38,46,0.14)" : "#16181C", display: "flex", alignItems: "flex-end", padding: 20, transform: `scale(${on ? 1 : 0.96})` }}>
              <div style={{ ...scrTitle, fontSize: 38, color: on ? corp.text : "#4A4F58" }}>{c}</div>
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 26, display: "flex", alignItems: "center", gap: 18, opacity: ease(f, 90, 110) }}>
        <svg width={56} height={56} viewBox="0 0 48 48"><rect x={6} y={10} width={36} height={32} rx={5} fill="none" stroke={corp.red} strokeWidth={3} /><path d="M6 19h36M16 6v8M32 6v8M17 30l5 5 10-11" stroke={corp.red} strokeWidth={3} fill="none" strokeLinecap="round" /></svg>
        <div style={{ ...scrTitle, fontSize: 40 }}>One supplier. <span style={{ color: corp.red }}>On your schedule.</span></div>
      </div>
    </AbsoluteFill>
  );
};

const ScreenUrl: React.FC<{ f: number }> = ({ f }) => {
  const p = ease(f, 0, 18);
  const ripple = ease(f, 30, 50);
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", background: "radial-gradient(circle at 50% 50%, #2A1416, #101216 70%)" }}>
      <div style={{ fontFamily: corp.body, fontWeight: 600, fontSize: 24, letterSpacing: "0.3em", color: corp.dim, textTransform: "uppercase", opacity: p }}>Visit today</div>
      <div style={{ position: "relative", marginTop: 20, ...scrTitle, fontSize: 70, opacity: p, transform: `scale(${interpolate(p, [0, 1], [0.9, 1])})` }}>
        www.<span style={{ color: corp.red }}>zidane</span>.com.pk
        <div style={{ position: "absolute", right: 60, bottom: -40, width: 30 + ripple * 120, height: 30 + ripple * 120, marginRight: -ripple * 60, marginBottom: -ripple * 60, borderRadius: "50%", border: `3px solid ${corp.red}`, opacity: 1 - ripple }} />
      </div>
    </AbsoluteFill>
  );
};

// ── foreground UI ──
const Chip: React.FC<{ label: string; at: number; until: number; x: number; y: number; side: "l" | "r" }> = ({ label, at, until, x, y, side }) => {
  const frame = useCurrentFrame();
  const p = ease(frame, sec(at), sec(at) + 10);
  const out = interpolate(frame, [sec(until) - 6, sec(until)], [1, 0], corp.clamp);
  if (frame < sec(at) || frame > sec(until)) return null;
  return (
    <div style={{ position: "absolute", left: x, top: y, opacity: p * out, transform: `translateX(${(1 - p) * (side === "l" ? -60 : 60)}px)`, display: "flex", alignItems: "center", gap: 12, background: "rgba(255,255,255,.96)", borderRadius: 999, padding: "12px 26px 12px 12px", boxShadow: "0 16px 40px rgba(0,0,0,.45)" }}>
      <svg width={40} height={40} viewBox="0 0 40 40"><circle cx={20} cy={20} r={19} fill={corp.red} /><path d="M11 20.5l6 6 12-13" stroke="#fff" strokeWidth={4.5} fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
      <span style={{ fontFamily: corp.display, fontWeight: 800, fontSize: 34, color: "#141414", letterSpacing: "-0.02em", whiteSpace: "nowrap" }}>{label}</span>
    </div>
  );
};

const Captions: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const idx = words.reduce((a, w, i) => (t >= w.t ? i : a), -1);
  if (idx < 0 || t > vo.lines[vo.lines.length - 1].end + 0.3) return null;
  const line = words[idx].line;
  const lw = words.filter((w) => w.line === line);
  const pos = lw.indexOf(words[idx]);
  const chunk = Math.floor(pos / 5);
  const shown = lw.slice(chunk * 5, chunk * 5 + 5);
  return (
    <div style={{ position: "absolute", left: 60, right: 60, top: 1500, display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "8px 14px" }}>
      {shown.map((w, i) => {
        const active = w === words[idx];
        return (
          <span key={i} style={{ fontFamily: corp.display, fontWeight: 800, fontSize: 64, letterSpacing: "-0.02em", padding: "2px 14px", borderRadius: 12, color: "#fff", background: active ? corp.red : "rgba(10,10,12,0.72)", textShadow: "0 2px 8px rgba(0,0,0,.5)" }}>{w.w}</span>
        );
      })}
    </div>
  );
};

const LowerThird: React.FC = () => {
  const frame = useCurrentFrame();
  const p = ease(frame, 15, 30);
  const out = interpolate(frame, [sec(6), sec(6.5)], [1, 0], corp.clamp);
  return (
    <div style={{ position: "absolute", left: 60, top: 1340, opacity: p * out, transform: `translateX(${(1 - p) * -80}px)`, display: "flex", alignItems: "stretch" }}>
      <div style={{ width: 10, background: corp.red }} />
      <div style={{ background: "rgba(12,13,16,.88)", padding: "14px 24px" }}>
        <div style={{ fontFamily: corp.display, fontWeight: 800, fontSize: 36, color: "#fff" }}>Zidane Wholesale Solutions</div>
        <div style={{ fontFamily: corp.body, fontWeight: 600, fontSize: 24, color: corp.dim, letterSpacing: "0.12em", textTransform: "uppercase" }}>B2B grocery supply · Karachi</div>
      </div>
    </div>
  );
};

const Presenter: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const line = lineAt(t);
  const L = vo.lines[line];
  const look = looks[line];
  const poseT = ease(frame, sec(L.start - 0.2), sec(L.start - 0.2) + 10);
  const raw = vo.env[Math.min(frame, vo.env.length - 1)] ?? 0;
  const mouth = Math.min(1, Math.max(0, (raw - 0.08) * 1.4));
  return (
    <div style={{ position: "absolute", inset: 0, transform: "translateY(150px) scale(0.84)", transformOrigin: "50% 100%" }}>
      <ZidaneBhai speaking={t > L.start && t < L.end} mouth={mouth} brow={look.brow} pose={look.pose} poseT={poseT} smile={look.brow !== "sad"} />
    </div>
  );
};

const Desk: React.FC = () => (
  <div style={{ position: "absolute", left: -40, right: -40, top: 1745, bottom: 0, background: "linear-gradient(180deg, #4A3526, #2E2119)", borderTop: "6px solid #5E4433", boxShadow: "0 -20px 40px rgba(0,0,0,.35)" }} />
);

export const AvatarExplainer: React.FC = () => {
  const l = vo.lines;
  return (
    <AbsoluteFill style={{ background: "#15171B" }}>
      <Sequence durationInFrames={sec(END_AT)}>
        <Office />
        <Screen />
        <Presenter />
        <Desk />
        <LowerThird />
        <Chip label="Any format" at={wordTime(3, "format")} until={l[3].end + 0.3} x={36} y={930} side="l" />
        <Chip label="Clear quotes" at={wordTime(3, "quote")} until={l[3].end + 0.3} x={745} y={1060} side="r" />
        <Chip label="One supplier" at={wordTime(4, "one")} until={l[4].end + 0.3} x={36} y={930} side="l" />
        <Chip label="On schedule" at={wordTime(4, "schedule")} until={l[4].end + 0.3} x={745} y={1060} side="r" />
        <Captions />
      </Sequence>
      <Sequence from={sec(END_AT)} durationInFrames={sec(OUTRO)}>
        <AbsoluteFill style={{ background: corp.bg }}>
          <CorpOutro line1="Groceries for business." line2="Send us your list today." rows={[{ k: "Visit", v: "www.zidane.com.pk" }]} />
        </AbsoluteFill>
      </Sequence>
      <Audio src={staticFile("vo/zidane-vo.wav")} />
      <Audio src={staticFile("sfx/corp-bed-36.wav")} endAt={AVATAR_TOTAL}
        volume={(f) => interpolate(f, [0, 10, sec(END_AT) - 10, sec(END_AT), AVATAR_TOTAL - 15, AVATAR_TOTAL], [0, 0.12, 0.12, 0.42, 0.42, 0], corp.clamp)} />
      {l.slice(1).map((x) => (
        <Sequence key={x.i} from={sec(x.start - 0.25)} durationInFrames={40}><Audio src={staticFile("sfx/whoosh.wav")} volume={0.18} /></Sequence>
      ))}
      {[wordTime(3, "format"), wordTime(3, "quote"), wordTime(4, "one"), wordTime(4, "schedule")].map((t, i) => (
        <Sequence key={i} from={sec(t) - 2} durationInFrames={30}><Audio src={staticFile("sfx/pop.wav")} volume={0.3} /></Sequence>
      ))}
      <Sequence from={sec(END_AT) + 2} durationInFrames={45}><Audio src={staticFile("sfx/bass.wav")} volume={0.55} /></Sequence>
    </AbsoluteFill>
  );
};
