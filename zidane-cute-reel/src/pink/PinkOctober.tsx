// Pink October (Breast Cancer Awareness Month) reel + 4:5 post. Awareness only, no selling.
import React from "react";
import { AbsoluteFill, Audio, Composition, Img, interpolate, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

const FPS = 30;
const sec = (s: number) => Math.round(s * FPS);
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const ease = (x: number) => 1 - Math.pow(1 - x, 3);

const P = {
  blush: "#FDE7EF", petal: "#F9C6D7", rose: "#E8467C", deep: "#A3194F", ink: "#3A0F22", white: "#FFFFFF",
  display: "Sora", body: "Inter",
};

// Soft drifting bokeh on a blush gradient
const PinkBg: React.FC<{ dark?: boolean }> = ({ dark }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: dark ? `linear-gradient(160deg, ${P.rose}, ${P.deep})` : `linear-gradient(170deg, ${P.blush}, #FFD6E4 60%, ${P.petal})`, overflow: "hidden" }}>
      {Array.from({ length: 14 }).map((_, i) => {
        const r = (n: number) => (Math.sin(i * 91.7 + n * 13.3) + 1) / 2;
        const size = 80 + r(1) * 260;
        return (
          <div key={i} style={{
            position: "absolute", width: size, height: size, borderRadius: "50%",
            left: r(2) * 1080 - size / 2 + Math.sin((frame + i * 40) / 70) * 30,
            top: ((r(3) * 2200 - frame * (0.4 + r(4) * 0.8)) % 2200 + 2200) % 2200 - 200,
            background: dark ? "rgba(255,255,255,0.10)" : "rgba(232,70,124,0.10)", filter: "blur(6px)",
          }} />
        );
      })}
    </AbsoluteFill>
  );
};

// Awareness ribbon: outline draws, then fills
const Ribbon: React.FC<{ size: number; draw: number; fill: number; color?: string }> = ({ size, draw, fill, color = P.rose }) => (
  <svg width={size} height={size * 1.3} viewBox="0 0 200 260">
    <defs>
      <linearGradient id="rib" x1="0" x2="1"><stop offset="0" stopColor={color} /><stop offset="1" stopColor={P.deep} /></linearGradient>
    </defs>
    {/* left tail goes to lower right, right tail to lower left, crossing under the loop */}
    <path d="M100 118 C82 92 58 64 64 38 C70 12 130 12 136 38 C142 64 118 92 100 118 L44 246 L22 228 L84 104"
      fill="none" stroke="url(#rib)" strokeWidth={30} strokeLinejoin="round" strokeLinecap="round"
      pathLength={1} strokeDasharray={1} strokeDashoffset={1 - draw} opacity={0.35 + 0.65 * fill} />
    <path d="M100 118 L156 246 L178 228 L116 104" fill="none" stroke="url(#rib)" strokeWidth={30} strokeLinejoin="round" strokeLinecap="round"
      pathLength={1} strokeDasharray={1} strokeDashoffset={1 - draw} />
    <path d="M70 40 C76 22 124 22 130 40" stroke="rgba(255,255,255,0.55)" strokeWidth={6} fill="none" strokeLinecap="round" opacity={fill} />
  </svg>
);

const Line: React.FC<{ delay: number; children: React.ReactNode; size: number; color?: string; weight?: number }> = ({ delay, children, size, color = P.ink, weight = 800 }) => {
  const frame = useCurrentFrame();
  const p = ease(interpolate(frame, [delay, delay + 18], [0, 1], clamp));
  return (
    <div style={{ overflow: "hidden", paddingBottom: 8 }}>
      <div style={{ transform: `translateY(${(1 - p) * 100}%)`, opacity: p, fontFamily: P.display, fontWeight: weight, fontSize: size, lineHeight: 1.06, letterSpacing: "-0.035em", color, textAlign: "center" }}>{children}</div>
    </div>
  );
};

const steps = [
  { n: "1", t: "Check yourself", s: "every month" },
  { n: "2", t: "Notice a change?", s: "See a doctor early" },
  { n: "3", t: "Talk about it", s: "with the women in your life" },
];

const S = { open: 4.0, line: 3.3, steps: 5.2, close: 4.2 };
export const PINK_TOTAL = sec(S.open + S.line + S.steps + S.close);

const Open: React.FC = () => {
  const frame = useCurrentFrame();
  const draw = ease(interpolate(frame, [4, 40], [0, 1], clamp));
  const fill = interpolate(frame, [36, 52], [0, 1], clamp);
  const breathe = 1 + Math.sin(frame / 14) * 0.015;
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 60 }}>
      <div style={{ transform: `scale(${breathe})` }}><Ribbon size={300} draw={draw} fill={fill} /></div>
      <div>
        <Line delay={44} size={104}>Pink October</Line>
        <Line delay={52} size={44} color={P.deep} weight={600}>Breast Cancer Awareness Month</Line>
      </div>
    </AbsoluteFill>
  );
};

const BigLine: React.FC = () => (
  <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: "0 80px" }}>
    <Line delay={2} size={128} color={P.white}>Early</Line>
    <Line delay={8} size={128} color={P.white}>detection</Line>
    <Line delay={14} size={128} color={P.blush}>saves lives.</Line>
  </AbsoluteFill>
);

const Steps: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 34, padding: "0 90px" }}>
      <Line delay={0} size={64} color={P.deep}>Three small steps</Line>
      {steps.map((s, i) => {
        const p = spring({ frame: frame - 12 - i * 14, fps, config: { damping: 16, stiffness: 120 } });
        return (
          <div key={s.n} style={{ width: "100%", display: "flex", alignItems: "center", gap: 34, background: "rgba(255,255,255,0.78)", borderRadius: 32, padding: "34px 40px", boxShadow: "0 18px 40px rgba(163,25,79,0.15)", opacity: p, transform: `translateY(${(1 - p) * 60}px)` }}>
            <div style={{ width: 96, height: 96, borderRadius: 48, background: P.rose, color: "#fff", display: "grid", placeItems: "center", fontFamily: P.display, fontWeight: 800, fontSize: 52, flexShrink: 0 }}>{s.n}</div>
            <div>
              <div style={{ fontFamily: P.display, fontWeight: 800, fontSize: 54, color: P.ink, letterSpacing: "-0.025em" }}>{s.t}</div>
              <div style={{ fontFamily: P.body, fontWeight: 500, fontSize: 38, color: P.deep, marginTop: 4 }}>{s.s}</div>
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

const Close: React.FC = () => {
  const frame = useCurrentFrame();
  const logo = ease(interpolate(frame, [34, 54], [0, 1], clamp));
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 26, padding: "0 80px" }}>
      <Ribbon size={150} draw={1} fill={1} color="#FFFFFF" />
      <Line delay={6} size={80} color={P.white}>Zidane stands</Line>
      <Line delay={12} size={80} color={P.white}>with every woman.</Line>
      <Line delay={20} size={40} color={P.blush} weight={600}>At home. At work. Everywhere.</Line>
      <div style={{ marginTop: 60, opacity: logo, transform: `translateY(${(1 - logo) * 20}px)`, display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
        <Img src={staticFile("brand/zidane-logo-white.svg")} style={{ width: 340 }} />
        <div style={{ fontFamily: P.body, fontWeight: 600, fontSize: 32, color: P.blush, letterSpacing: "0.12em" }}>#PinkOctober</div>
      </div>
    </AbsoluteFill>
  );
};

const Fade: React.FC<{ len: number; children: React.ReactNode }> = ({ len, children }) => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [0, 8, len - 8, len], [0, 1, 1, 0], clamp);
  return <AbsoluteFill style={{ opacity: o }}>{children}</AbsoluteFill>;
};

export const PinkOctoberReel: React.FC = () => {
  const { durationInFrames } = useVideoConfig();
  const a = sec(S.open), b = a + sec(S.line), c = b + sec(S.steps);
  return (
    <AbsoluteFill style={{ background: P.blush }}>
      <Sequence durationInFrames={a}><PinkBg /><Fade len={a}><Open /></Fade></Sequence>
      <Sequence from={a} durationInFrames={sec(S.line)}><PinkBg dark /><Fade len={sec(S.line)}><BigLine /></Fade></Sequence>
      <Sequence from={b} durationInFrames={sec(S.steps)}><PinkBg /><Fade len={sec(S.steps)}><Steps /></Fade></Sequence>
      <Sequence from={c} durationInFrames={sec(S.close)}><PinkBg dark /><Fade len={sec(S.close) + 8}><Close /></Fade></Sequence>
      <Audio src={staticFile("sfx/corp-bed-36.wav")} endAt={durationInFrames}
        volume={(f) => interpolate(f, [0, 20, durationInFrames - 30, durationInFrames], [0, 0.4, 0.4, 0], clamp)} />
    </AbsoluteFill>
  );
};

// 4:5 static post
export const PinkOctoberPost: React.FC = () => (
  <AbsoluteFill>
    <PinkBg />
    <AbsoluteFill style={{ alignItems: "center", padding: "110px 80px 0" }}>
      <Ribbon size={210} draw={1} fill={1} />
      <div style={{ marginTop: 26, fontFamily: P.body, fontWeight: 600, fontSize: 28, letterSpacing: "0.2em", color: P.deep, textTransform: "uppercase" }}>Pink October</div>
      <div style={{ marginTop: 14, fontFamily: P.display, fontWeight: 800, fontSize: 104, lineHeight: 1.04, letterSpacing: "-0.035em", color: P.ink, textAlign: "center" }}>
        Early detection<br /><span style={{ color: P.rose }}>saves lives.</span>
      </div>
      <div style={{ marginTop: 54, width: "100%", display: "flex", flexDirection: "column", gap: 20 }}>
        {steps.map((s) => (
          <div key={s.n} style={{ display: "flex", alignItems: "center", gap: 24, background: "rgba(255,255,255,0.8)", borderRadius: 26, padding: "26px 30px" }}>
            <div style={{ width: 62, height: 62, borderRadius: 31, background: P.rose, color: "#fff", display: "grid", placeItems: "center", fontFamily: P.display, fontWeight: 800, fontSize: 34 }}>{s.n}</div>
            <div><div style={{ fontFamily: P.display, fontWeight: 700, fontSize: 40, color: P.ink }}>{s.t}</div><div style={{ fontFamily: P.body, fontWeight: 500, color: P.deep, fontSize: 30 }}>{s.s}</div></div>
          </div>
        ))}
      </div>
    </AbsoluteFill>
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 150, background: `linear-gradient(90deg, ${P.rose}, ${P.deep})`, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 90px" }}>
      <div style={{ fontFamily: P.display, fontWeight: 700, fontSize: 34, color: "#fff" }}>Zidane stands with every woman.</div>
      <Img src={staticFile("brand/zidane-logo-white.svg")} style={{ width: 200 }} />
    </div>
  </AbsoluteFill>
);

export const PinkCompositions: React.FC = () => (
  <>
    <Composition id="PinkOctoberReel" component={PinkOctoberReel} durationInFrames={PINK_TOTAL} fps={30} width={1080} height={1920} />
    <Composition id="PinkOctoberPost" component={PinkOctoberPost} durationInFrames={30} fps={30} width={1080} height={1350} />
  </>
);
