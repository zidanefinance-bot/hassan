// World Food Day (16 Oct) reel. Hook: a roti loses a third of itself — "nearly a third of the
// world's food never gets eaten" (UNEP Food Waste Index / FAO loss estimates combined).
import React from "react";
import { AbsoluteFill, Audio, Composition, Img, interpolate, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import "../Fonts";

const FPS = 30;
const sec = (s: number) => Math.round(s * FPS);
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const ease = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);

const F = {
  paper: "#F3EADA", paper2: "#E9DCC3", field: "#2E3A22", olive: "#5B6B3A", wheat: "#E2B04A", amber: "#B8742A",
  crust: "#C98B45", ink: "#22190F", serif: "Fraunces", sans: "Inter",
};

// warm paper with grain + soft vignette
const Paper: React.FC<{ dark?: boolean }> = ({ dark }) => {
  const frame = useCurrentFrame();
  const noise = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='240'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='240' height='240' filter='url(%23n)' opacity='0.6'/%3E%3C/svg%3E")`;
  return (
    <AbsoluteFill style={{ background: dark ? `radial-gradient(ellipse at 50% 35%, #45542F, ${F.field} 70%)` : `radial-gradient(ellipse at 50% 40%, #FBF4E6, ${F.paper} 55%, ${F.paper2})` }}>
      <AbsoluteFill style={{ backgroundImage: noise, opacity: dark ? 0.12 : 0.16, mixBlendMode: "multiply", backgroundPosition: `${(frame * 3) % 240}px ${(frame * 5) % 240}px` }} />
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at center, transparent 55%, rgba(60,35,10,0.28) 100%)" }} />
    </AbsoluteFill>
  );
};

const Serif: React.FC<{ size: number; color?: string; italic?: boolean; weight?: number; children: React.ReactNode; style?: React.CSSProperties }> = ({ size, color = F.ink, italic, weight = 600, children, style }) => (
  <div style={{ fontFamily: F.serif, fontStyle: italic ? "italic" : "normal", fontWeight: weight, fontSize: size, lineHeight: 1.08, letterSpacing: "-0.02em", color, textAlign: "center", ...style }}>{children}</div>
);

const Rise: React.FC<{ at: number; children: React.ReactNode; dist?: number }> = ({ at, children, dist = 30 }) => {
  const frame = useCurrentFrame();
  const p = ease(interpolate(frame, [at, at + 20], [0, 1], clamp));
  return <div style={{ opacity: p, transform: `translateY(${(1 - p) * dist}px)`, filter: `blur(${(1 - p) * 6}px)` }}>{children}</div>;
};

// ── the roti ──
const SPOTS = Array.from({ length: 34 }).map((_, i) => {
  const r = (n: number) => { const v = Math.sin(i * 127.1 + n * 311.7) * 43758.5453; return v - Math.floor(v); };
  const a = r(1) * Math.PI * 2, d = Math.sqrt(r(2)) * 240;
  return { x: 300 + Math.cos(a) * d, y: 300 + Math.sin(a) * d, rx: 5 + r(3) * 16, ry: 4 + r(4) * 9, rot: r(5) * 180, o: 0.18 + r(6) * 0.4 };
});
const RotiDisk: React.FC = () => (
  <g>
    <defs>
      <radialGradient id="rotiG" cx="45%" cy="40%" r="60%">
        <stop offset="0" stopColor="#F2D49A" /><stop offset="0.65" stopColor="#E3B46C" /><stop offset="1" stopColor={F.crust} />
      </radialGradient>
    </defs>
    <circle cx={300} cy={300} r={280} fill="url(#rotiG)" />
    {SPOTS.map((s, i) => <ellipse key={i} cx={s.x} cy={s.y} rx={s.rx} ry={s.ry} transform={`rotate(${s.rot} ${s.x} ${s.y})`} fill="#7A4518" opacity={s.o} />)}
    <circle cx={300} cy={300} r={280} fill="none" stroke="#B57532" strokeWidth={6} opacity={0.6} />
  </g>
);
// third = wedge from -30° to 90° (lower-right)
const wedge = (a0: number, a1: number) => {
  const r = 320, c = 300;
  const p = (a: number) => `${c + r * Math.cos((a * Math.PI) / 180)} ${c + r * Math.sin((a * Math.PI) / 180)}`;
  return `M${c} ${c} L${p(a0)} A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${p(a1)} Z`;
};
const PARTICLES = Array.from({ length: 160 }).map((_, i) => {
  const r = (n: number) => { const v = Math.sin(i * 78.233 + n * 12.9898) * 43758.5453; return v - Math.floor(v); };
  const a = (-30 + r(1) * 120) * (Math.PI / 180), d = 40 + Math.sqrt(r(2)) * 240;
  return { x: 300 + Math.cos(a) * d, y: 300 + Math.sin(a) * d, vx: (r(3) - 0.35) * 10, vy: -1 - r(4) * 7, s: 3 + r(5) * 9, c: r(6) > 0.5 ? "#D9A65A" : "#8A5222", delay: r(7) * 10 };
});

const Roti: React.FC<{ f: number; breakAt: number }> = ({ f, breakAt }) => {
  const t = f - breakAt;
  const crack = ease(interpolate(f, [breakAt - 12, breakAt], [0, 1], clamp));
  const gone = interpolate(t, [0, 9], [1, 0], clamp);
  return (
    <svg width={760} height={760} viewBox="-40 -40 680 680" style={{ overflow: "visible" }}>
      <defs>
        <clipPath id="keep"><path d={wedge(90, 330)} /></clipPath>
        <clipPath id="lost"><path d={wedge(-30, 90)} /></clipPath>
      </defs>
      <ellipse cx={300} cy={600} rx={260} ry={26} fill="rgba(60,35,10,0.22)" />
      <g clipPath="url(#keep)"><RotiDisk /></g>
      {/* the third that breaks off */}
      <g opacity={gone} transform={t > 0 ? `translate(${t * 3} ${t * 10}) rotate(${t * 2.5} 400 330)` : ""}><g clipPath="url(#lost)"><RotiDisk /></g></g>
      {/* crack lines */}
      {t < 2 && (
        <g stroke="#5B3412" strokeWidth={5} strokeLinecap="round" fill="none" opacity={crack}>
          <path d="M300 300 L330 250 L325 200 L350 140 L343 80 L360 30" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - crack} />
          <path d="M300 300 L280 360 L300 420 L285 480 L300 540 L300 580" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - crack} />
        </g>
      )}
      {/* crumbs */}
      {t > 0 && PARTICLES.map((p, i) => {
        const tt = Math.max(0, t - p.delay);
        const o = interpolate(tt, [0, 4, 40], [0, 1, 0], clamp);
        return <circle key={i} cx={p.x + p.vx * tt} cy={p.y + p.vy * tt + 0.35 * tt * tt} r={p.s * (1 - tt / 60)} fill={p.c} opacity={o} />;
      })}
    </svg>
  );
};

// ── wheat stalk ──
const Wheat: React.FC<{ x: number; h: number; delay: number; phase: number }> = ({ x, h, delay, phase }) => {
  const frame = useCurrentFrame();
  const g = ease(interpolate(frame, [delay, delay + 26], [0, 1], clamp));
  const sway = Math.sin((frame + phase) / 18) * 4 + Math.sin((frame + phase) / 7) * 1.2;
  return (
    <svg width={140} height={h + 60} viewBox={`-70 ${-h - 40} 140 ${h + 60}`} style={{ position: "absolute", left: x - 70, bottom: -10, overflow: "visible" }}>
      <g transform={`rotate(${sway} 0 0) scale(1 ${g})`}>
        <path d={`M0 0 Q 6 ${-h * 0.5} 0 ${-h}`} stroke={F.amber} strokeWidth={5} fill="none" />
        {Array.from({ length: 9 }).map((_, i) => {
          const y = -h + 10 + i * 17;
          return (
            <g key={i}>
              <ellipse cx={-11} cy={y} rx={8} ry={17} fill={F.wheat} transform={`rotate(-28 -11 ${y})`} />
              <ellipse cx={11} cy={y + 8} rx={8} ry={17} fill="#D49B36" transform={`rotate(28 11 ${y + 8})`} />
            </g>
          );
        })}
        <path d={`M0 ${-h} l-6 -36 M0 ${-h} l6 -40 M0 ${-h + 12} l-14 -30 M0 ${-h + 12} l14 -32`} stroke={F.wheat} strokeWidth={2} />
        <path d={`M2 ${-h * 0.35} q 40 -30 60 -10 q -30 0 -60 20`} fill={F.olive} />
      </g>
    </svg>
  );
};

// ── tip icons (line art, olive + wheat accent) ──
const TipIcon: React.FC<{ kind: "plan" | "fifo" | "share"; p: number }> = ({ kind, p }) => {
  const st = { stroke: F.field, strokeWidth: 5, fill: "none", strokeLinecap: "round" as const, strokeLinejoin: "round" as const, pathLength: 1, strokeDasharray: 1, strokeDashoffset: 1 - p };
  return (
    <svg width={120} height={120} viewBox="0 0 100 100">
      <circle cx={50} cy={50} r={46} fill={F.wheat} opacity={0.35 * p} />
      {kind === "plan" && (<><rect x={28} y={20} width={44} height={60} rx={6} {...st} /><path d="M38 38h24M38 50h24M38 62h14" {...st} /><path d="M58 64l5 5 10-12" {...st} stroke={F.amber} /></>)}
      {kind === "fifo" && (<><rect x={18} y={40} width={26} height={26} rx={4} {...st} /><rect x={56} y={40} width={26} height={26} rx={4} {...st} /><path d="M44 30 Q50 20 56 30M52 26l4 4 4-4" {...st} stroke={F.amber} /></>)}
      {kind === "share" && (<><circle cx={50} cy={46} r={20} {...st} /><path d="M24 70 Q50 86 76 70" {...st} /><path d="M42 46 Q50 38 58 46" {...st} stroke={F.amber} /></>)}
    </svg>
  );
};

const tips: { kind: "plan" | "fifo" | "share"; t: string; s: string }[] = [
  { kind: "plan", t: "Order by headcount", s: "Buy what your kitchen will actually use." },
  { kind: "fifo", t: "First in, first out", s: "Use older stock before the new." },
  { kind: "share", t: "Share, don't bin", s: "Good leftovers can feed someone today." },
];

const S = { hook: 4.4, title: 3.2, tips: 6.0, close: 4.4 };
export const FOODDAY_TOTAL = sec(S.hook + S.title + S.tips + S.close);
const BREAK = 46; // frame in hook when the third breaks off

const Hook: React.FC = () => {
  const frame = useCurrentFrame();
  const inP = ease(interpolate(frame, [0, 18], [0, 1], clamp));
  const steam = (i: number) => interpolate((frame + i * 20) % 60, [0, 60], [0, 1]);
  return (
    <AbsoluteFill>
      <Paper />
      <div style={{ position: "absolute", top: 250, left: 0, right: 0 }}>
        <Rise at={4}><Serif size={92} italic>Is roti ko dekho.</Serif></Rise>
      </div>
      <div style={{ position: "absolute", left: 160, top: 560, transform: `scale(${0.85 + 0.15 * inP})`, opacity: inP }}>
        {/* steam */}
        {frame < BREAK && [0, 1, 2].map((i) => (
          <div key={i} style={{ position: "absolute", left: 300 + (i - 1) * 90, top: 40 - steam(i) * 120, width: 16, height: 70, borderRadius: 8, background: "rgba(255,255,255,0.55)", filter: "blur(8px)", opacity: Math.sin(steam(i) * Math.PI) }} />
        ))}
        <Roti f={frame} breakAt={BREAK} />
      </div>
      <div style={{ position: "absolute", top: 1430, left: 80, right: 80 }}>
        <Rise at={BREAK + 12}><Serif size={64}>Nearly <span style={{ color: F.amber, fontStyle: "italic" }}>a third</span> of the world's</Serif></Rise>
        <Rise at={BREAK + 20}><Serif size={64}>food never gets eaten.</Serif></Rise>
      </div>
    </AbsoluteFill>
  );
};

const Title: React.FC = () => {
  const stalks = Array.from({ length: 11 }).map((_, i) => ({ x: 40 + i * 100 + ((i * 37) % 30), h: 380 + ((i * 53) % 220), delay: 2 + (i % 4) * 3, phase: i * 13 }));
  return (
    <AbsoluteFill>
      <Paper dark />
      <AbsoluteFill style={{ alignItems: "center", paddingTop: 560 }}>
        <Rise at={4}><div style={{ fontFamily: F.sans, fontWeight: 600, fontSize: 30, letterSpacing: "0.32em", color: F.wheat, textTransform: "uppercase" }}>16 October</div></Rise>
        <div style={{ height: 22 }} />
        <Rise at={8}><Serif size={150} color="#F6EBD3">World</Serif></Rise>
        <Rise at={13}><Serif size={150} color="#F6EBD3" italic>Food Day</Serif></Rise>
      </AbsoluteFill>
      {stalks.map((s, i) => <Wheat key={i} {...s} />)}
    </AbsoluteFill>
  );
};

const Tips: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill>
      <Paper />
      <AbsoluteFill style={{ padding: "330px 90px 0" }}>
        <Rise at={2}><Serif size={88}>Waste less,</Serif></Rise>
        <Rise at={8}><Serif size={88} italic color={F.olive}>one kitchen at a time.</Serif></Rise>
        <div style={{ marginTop: 80, display: "flex", flexDirection: "column", gap: 34 }}>
          {tips.map((t, i) => {
            const at = 22 + i * 18;
            const p = ease(interpolate(frame, [at, at + 22], [0, 1], clamp));
            return (
              <div key={t.t} style={{ display: "flex", alignItems: "center", gap: 30, opacity: p, transform: `translateX(${(1 - p) * 40}px)`, paddingBottom: 30, borderBottom: `2px solid rgba(46,58,34,${0.18 * p})` }}>
                <TipIcon kind={t.kind} p={p} />
                <div>
                  <div style={{ fontFamily: F.serif, fontWeight: 600, fontSize: 56, color: F.ink, letterSpacing: "-0.02em" }}>{t.t}</div>
                  <div style={{ fontFamily: F.sans, fontWeight: 500, fontSize: 34, color: "#5A4A33", marginTop: 6 }}>{t.s}</div>
                </div>
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const Close: React.FC = () => {
  const frame = useCurrentFrame();
  const logo = ease(interpolate(frame, [40, 60], [0, 1], clamp));
  return (
    <AbsoluteFill>
      <Paper />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: "0 80px" }}>
        <div style={{ marginTop: -200 }}>
          <Rise at={6}><Serif size={128} italic>Har dana</Serif></Rise>
          <Rise at={12}><Serif size={128} color={F.amber}>qeemti hai.</Serif></Rise>
          <div style={{ height: 26 }} />
          <Rise at={22}><Serif size={50} weight={400} italic color="#5A4A33">Every grain matters.</Serif></Rise>
        </div>
      </AbsoluteFill>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 230, display: "flex", flexDirection: "column", alignItems: "center", gap: 16, opacity: logo, transform: `translateY(${(1 - logo) * 20}px)` }}>
        <Img src={staticFile("brand/zidane-logo.svg")} style={{ width: 320 }} />
        <div style={{ fontFamily: F.sans, fontWeight: 600, fontSize: 28, letterSpacing: "0.2em", color: "#5A4A33", textTransform: "uppercase" }}>Plan smarter · Waste less</div>
      </div>
    </AbsoluteFill>
  );
};

const XFade: React.FC<{ len: number; children: React.ReactNode }> = ({ len, children }) => {
  const frame = useCurrentFrame();
  return <AbsoluteFill style={{ opacity: interpolate(frame, [0, 10, len - 8, len], [0, 1, 1, 0], clamp) }}>{children}</AbsoluteFill>;
};

export const WorldFoodDayReel: React.FC = () => {
  const { durationInFrames } = useVideoConfig();
  const a = sec(S.hook), b = a + sec(S.title), c = b + sec(S.tips);
  return (
    <AbsoluteFill style={{ background: F.paper }}>
      <Sequence durationInFrames={a}><XFade len={a}><Hook /></XFade></Sequence>
      <Sequence from={a} durationInFrames={sec(S.title)}><XFade len={sec(S.title)}><Title /></XFade></Sequence>
      <Sequence from={b} durationInFrames={sec(S.tips)}><XFade len={sec(S.tips)}><Tips /></XFade></Sequence>
      <Sequence from={c} durationInFrames={sec(S.close)}><XFade len={sec(S.close) + 10}><Close /></XFade></Sequence>
      <Audio src={staticFile("sfx/foodday-strings.wav")} endAt={durationInFrames}
        volume={(f) => interpolate(f, [0, 12, durationInFrames - 20, durationInFrames], [0, 0.85, 0.85, 0], clamp)} />
      <Sequence from={BREAK - 3} durationInFrames={40}><Audio src={staticFile("sfx/crumble.wav")} volume={0.7} /></Sequence>
      <Sequence from={a - 6} durationInFrames={60}><Audio src={staticFile("sfx/wind.wav")} volume={0.45} /></Sequence>
    </AbsoluteFill>
  );
};

// 4:5 post: roti with missing third + message
export const WorldFoodDayPost: React.FC = () => (
  <AbsoluteFill>
    <Paper />
    <AbsoluteFill style={{ alignItems: "center", paddingTop: 90 }}>
      <div style={{ fontFamily: F.sans, fontWeight: 600, fontSize: 26, letterSpacing: "0.3em", color: F.amber, textTransform: "uppercase" }}>World Food Day · 16 October</div>
      <div style={{ marginTop: 18 }}><Serif size={84}>Nearly <span style={{ color: F.amber, fontStyle: "italic" }}>a third</span><br />of our food is never eaten.</Serif></div>
      <div style={{ marginTop: 10, transform: "scale(0.78)" }}>
        <svg width={760} height={680} viewBox="-40 -40 680 640">
          <defs><clipPath id="keepP"><path d={wedge(90, 330)} /></clipPath></defs>
          <ellipse cx={300} cy={600} rx={260} ry={26} fill="rgba(60,35,10,0.22)" />
          <g clipPath="url(#keepP)"><RotiDisk /></g>
          {PARTICLES.slice(0, 60).map((p, i) => <circle key={i} cx={p.x + p.vx * 6} cy={p.y + 40 + (i % 7) * 10} r={p.s * 0.6} fill={p.c} opacity={0.7} />)}
        </svg>
      </div>
      <div style={{ marginTop: -60 }}><Serif size={64} italic>Har dana qeemti hai.</Serif></div>
    </AbsoluteFill>
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 50, display: "flex", justifyContent: "center" }}>
      <Img src={staticFile("brand/zidane-logo.svg")} style={{ width: 220 }} />
    </div>
  </AbsoluteFill>
);

export const FoodDayCompositions: React.FC = () => (
  <>
    <Composition id="WorldFoodDayReel" component={WorldFoodDayReel} durationInFrames={FOODDAY_TOTAL} fps={30} width={1080} height={1920} />
    <Composition id="WorldFoodDayPost" component={WorldFoodDayPost} durationInFrames={30} fps={30} width={1080} height={1350} />
  </>
);
