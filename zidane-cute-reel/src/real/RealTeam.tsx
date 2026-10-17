// "Asli team, asli kaam": reel cut from Zidane's own website footage (public/realvid, 480×752 web encodes).
// Swap in the original high-res files with the same names to re-render in HD.
import React from "react";
import { AbsoluteFill, Audio, Composition, Img, interpolate, OffthreadVideo, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import "../Fonts";
import { corp } from "../corporate/kit";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const FPS = 30;

// [clip, start (s), length (s), subtitle, highlighted word]
const shots: { clip: string; from: number; len: number; sub: string; hi?: string }[] = [
  { clip: "hero", from: 0.1, len: 2.1, sub: "Ye Karachi hai.", hi: "Karachi" },
  { clip: "hero", from: 2.3, len: 2.4, sub: "Aur ye hai Zidane ki team.", hi: "Zidane" },
  { clip: "stock", from: 0.2, len: 2.2, sub: "Atta, chawal, cheeni, daal…" },
  { clip: "stock", from: 3.6, len: 2.2, sub: "…bori bori, packet packet." },
  { clip: "packing", from: 0.4, len: 2.6, sub: "Har bag haath se pack hota hai.", hi: "haath" },
  { clip: "ration-program", from: 0.7, len: 2.4, sub: "Order ke hisaab se, item by item.", hi: "item by item" },
  { clip: "dispatch", from: 1.0, len: 2.4, sub: "Phir truck load…", hi: "truck" },
  { clip: "dispatch", from: 3.6, len: 2.2, sub: "…aur delivery. ✓", hi: "delivery" },
];
const starts = shots.reduce<number[]>((a, s, i) => [...a, i === 0 ? 0 : a[i - 1] + Math.round(shots[i - 1].len * FPS)], []);
const ENDCARD = starts[starts.length - 1] + Math.round(shots[shots.length - 1].len * FPS);
const TOTAL = ENDCARD + 105;

// Reels-style subtitle: words pop in one after another, one phrase highlighted red
const Subtitle: React.FC<{ text: string; hi?: string }> = ({ text, hi }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = text.split(" ");
  const hiWords = hi ? hi.split(" ") : [];
  return (
    <div style={{ position: "absolute", left: 70, right: 70, top: 1260, display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "6px 20px" }}>
      {words.map((w, i) => {
        const p = spring({ frame: frame - 2 - i * 3, fps, config: { damping: 12, stiffness: 220 } });
        const isHi = hiWords.some((h) => w.replace(/[.,…✓]/g, "") === h);
        return (
          <span key={i} style={{ display: "inline-block", opacity: p, transform: `scale(${interpolate(p, [0, 1], [0.6, 1])}) translateY(${(1 - p) * 20}px)`,
            fontFamily: "Sora", fontWeight: 800, fontSize: 84, lineHeight: 1.12, letterSpacing: "-0.02em",
            color: isHi ? "#fff" : "#fff", background: isHi ? corp.red : "transparent", padding: isHi ? "0 14px" : 0, borderRadius: 10,
            WebkitTextStroke: isHi ? "0" : "12px #000", paintOrder: "stroke fill", textShadow: "0 6px 18px rgba(0,0,0,0.45)" }}>{w}</span>
        );
      })}
    </div>
  );
};

const Shot: React.FC<{ i: number }> = ({ i }) => {
  const frame = useCurrentFrame();
  const s = shots[i];
  const len = Math.round(s.len * FPS);
  const push = 1.04 + (frame / len) * 0.06;
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <AbsoluteFill style={{ transform: `scale(${push})` }}>
        <OffthreadVideo src={staticFile(`realvid/${s.clip}.mp4`)} startFrom={Math.round(s.from * FPS)} muted
          style={{ width: "100%", height: "100%", objectFit: "cover", filter: "contrast(1.08) saturate(1.1)" }} />
      </AbsoluteFill>
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.35), transparent 18%, transparent 55%, rgba(0,0,0,0.55))" }} />
      <Subtitle text={s.sub} hi={s.hi} />
    </AbsoluteFill>
  );
};

// persistent overlays: REAL FOOTAGE tag + logo bug + grain
const Overlay: React.FC = () => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [4, 14, ENDCARD - 6, ENDCARD], [0, 1, 1, 0], clamp);
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <svg width="100%" height="100%" style={{ position: "absolute", opacity: 0.1, mixBlendMode: "overlay" }}>
        <filter id={`n${frame % 3}`}><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves={2} seed={frame % 3} /></filter>
        <rect width="100%" height="100%" filter={`url(#n${frame % 3})`} />
      </svg>
      <div style={{ position: "absolute", left: 60, top: 110, opacity: o, display: "flex", alignItems: "center", gap: 14, background: "rgba(0,0,0,0.55)", padding: "12px 22px", borderRadius: 40,
        fontFamily: "Inter", fontWeight: 700, fontSize: 30, letterSpacing: "0.14em", color: "#fff" }}>
        <span style={{ width: 18, height: 18, borderRadius: 9, background: corp.red, opacity: Math.floor(frame / 15) % 2 ? 1 : 0.35 }} />REAL FOOTAGE
      </div>
      <Img src={staticFile("brand/zidane-logo-white.svg")} style={{ position: "absolute", right: 60, top: 108, width: 210, opacity: o * 0.9 }} />
    </AbsoluteFill>
  );
};

const EndCard: React.FC = () => {
  const frame = useCurrentFrame();
  const a = interpolate(frame, [4, 20], [0, 1], { easing: corp.out, ...clamp });
  const b = interpolate(frame, [14, 30], [0, 1], { easing: corp.out, ...clamp });
  const c = interpolate(frame, [32, 48], [0, 1], { easing: corp.out, ...clamp });
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <AbsoluteFill style={{ filter: "blur(18px) brightness(0.35)", transform: "scale(1.15)" }}>
        <OffthreadVideo src={staticFile("realvid/packing.mp4")} startFrom={60} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </AbsoluteFill>
      <AbsoluteFill style={{ padding: `0 ${corp.pad}px`, justifyContent: "center" }}>
        <div style={{ opacity: a, transform: `translateY(${(1 - a) * 30}px)`, fontFamily: "Inter", fontWeight: 600, fontSize: 36, letterSpacing: "0.2em", color: corp.dim, textTransform: "uppercase" }}>No stock footage.</div>
        <div style={{ marginTop: 26, opacity: b, transform: `translateY(${(1 - b) * 30}px)` }}>
          <div style={{ fontFamily: "Sora", fontWeight: 700, fontSize: 120, lineHeight: 1.04, letterSpacing: "-0.035em", color: "#fff" }}>Asli team.</div>
          <div style={{ fontFamily: "Sora", fontWeight: 700, fontSize: 120, lineHeight: 1.04, letterSpacing: "-0.035em", color: corp.red }}>Asli kaam.</div>
        </div>
        <div style={{ marginTop: 100, opacity: c }}>
          <Img src={staticFile("brand/zidane-logo-white.svg")} style={{ width: 420 }} />
          <div style={{ marginTop: 44, fontFamily: "Inter", fontWeight: 600, fontSize: 44, color: "#fff" }}>sales@zidane.com.pk</div>
          <div style={{ marginTop: 10, fontFamily: "Inter", fontWeight: 600, fontSize: 40, color: corp.dim }}>zidane.com.pk</div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const RealTeam: React.FC = () => {
  const { durationInFrames } = useVideoConfig();
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {shots.map((s, i) => <Sequence key={i} from={starts[i]} durationInFrames={Math.round(s.len * FPS)}><Shot i={i} /></Sequence>)}
      <Sequence from={ENDCARD}><EndCard /></Sequence>
      <Overlay />
      <Audio src={staticFile("sfx/corp-bed.wav")} endAt={durationInFrames} volume={(f) => interpolate(f, [0, 10, durationInFrames - 25, durationInFrames], [0, 0.8, 0.8, 0], clamp)} />
      {starts.slice(1).map((f, i) => <Sequence key={i} from={f} durationInFrames={15}><Audio src={staticFile("sfx/tick.wav")} volume={0.25} /></Sequence>)}
      <Sequence from={ENDCARD} durationInFrames={30}><Audio src={staticFile("sfx/whoosh.wav")} volume={0.3} /></Sequence>
    </AbsoluteFill>
  );
};

export const RealTeamCompositions: React.FC = () => (
  <Composition id="RealTeam" component={RealTeam} durationInFrames={TOTAL} fps={FPS} width={1080} height={1920} />
);
