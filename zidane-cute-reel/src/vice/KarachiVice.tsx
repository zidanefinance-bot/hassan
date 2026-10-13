// "Karachi Vice × Zidane" — open-world-game trailer vibe (neon sunset, slanted titles, HUD, mission passed).
// Style homage only: no game logos, names or fonts.
import React from "react";
import { AbsoluteFill, Audio, Composition, Img, interpolate, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import "../Fonts";

const FPS = 30;
const sec = (s: number) => Math.round(s * FPS);
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const V = { night: "#12061F", violet: "#5B21B6", magenta: "#FF2E88", orange: "#FF8A3D", yellow: "#FFD34D", teal: "#19E3D3", white: "#FFF6EC" };

// Slanted, outlined gradient title with chromatic split
const Title: React.FC<{ size: number; children: string; grad?: string; skew?: number; style?: React.CSSProperties }> = ({ size, children, grad = `linear-gradient(180deg, ${V.yellow} 10%, ${V.orange} 55%, ${V.magenta} 95%)`, skew = -10, style }) => {
  const base: React.CSSProperties = { fontFamily: "Sora", fontWeight: 800, fontSize: size, lineHeight: 0.95, letterSpacing: "-0.02em", whiteSpace: "pre", textAlign: "center" };
  return (
    <div style={{ position: "relative", transform: `skewX(${skew}deg)`, ...style }}>
      <div style={{ ...base, position: "absolute", inset: 0, color: "#000", WebkitTextStroke: `${size * 0.16}px #000`, transform: `translate(${size * 0.04}px, ${size * 0.05}px)` }}>{children}</div>
      <div style={{ ...base, position: "absolute", inset: 0, color: "transparent", WebkitTextStroke: `${size * 0.1}px #000` }}>{children}</div>
      <div style={{ ...base, position: "absolute", inset: 0, color: V.teal, transform: `translate(${-size * 0.025}px, 0)`, opacity: 0.7, mixBlendMode: "screen" }}>{children}</div>
      <div style={{ ...base, position: "relative", background: grad, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>{children}</div>
    </div>
  );
};

// VHS overlay: scanlines, grain flicker, letterbox
const VHS: React.FC<{ bars?: number }> = ({ bars = 120 }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <AbsoluteFill style={{ backgroundImage: "repeating-linear-gradient(0deg, rgba(0,0,0,0.18) 0 2px, transparent 2px 5px)", opacity: 0.5 }} />
      <AbsoluteFill style={{ background: `rgba(255,255,255,${0.02 + (frame % 7 === 0 ? 0.03 : 0)})`, mixBlendMode: "overlay" }} />
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: bars, background: "#000" }} />
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: bars, background: "#000" }} />
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.55) 100%)" }} />
    </AbsoluteFill>
  );
};

const Palm: React.FC<{ x: number; h: number; flip?: boolean; sway: number }> = ({ x, h, flip, sway }) => (
  <svg width={360} height={h} viewBox={`0 0 360 ${h}`} style={{ position: "absolute", left: x, bottom: 0, transform: flip ? "scaleX(-1)" : undefined, overflow: "visible" }}>
    <path d={`M180 ${h} C170 ${h * 0.6} 200 ${h * 0.35} 190 ${h * 0.18}`} stroke="#14051F" strokeWidth={22} fill="none" strokeLinecap="round" />
    <g transform={`translate(190 ${h * 0.18}) rotate(${sway})`}>
      {[-160, -120, -70, -20, 30, 80, 130, 175].map((a, i) => (
        <path key={i} d="M0 0 C 60 -40 120 -20 170 30 C 120 0 60 -10 0 0 Z" fill="#14051F" transform={`rotate(${a})`} />
      ))}
    </g>
  </svg>
);

// Sunset skyline with Mazar-e-Quaid dome, striped retro sun, palms, water reflection
const Sunset: React.FC = () => {
  const frame = useCurrentFrame();
  const sway = Math.sin(frame / 25) * 3;
  return (
    <AbsoluteFill style={{ background: `linear-gradient(180deg, ${V.night} 0%, ${V.violet} 30%, ${V.magenta} 55%, ${V.orange} 72%, ${V.yellow} 80%)` }}>
      {/* sun */}
      <div style={{ position: "absolute", left: 540 - 300, top: 760 + Math.sin(frame / 40) * 6, width: 600, height: 600, borderRadius: "50%", background: `linear-gradient(180deg, ${V.yellow}, ${V.orange} 60%, ${V.magenta})`,
        WebkitMaskImage: "linear-gradient(180deg, #000 0 52%, transparent 52% 56%, #000 56% 63%, transparent 63% 68%, #000 68% 74%, transparent 74% 80%, #000 80% 85%, transparent 85% 92%, #000 92%)",
        boxShadow: "0 0 120px rgba(255,138,61,0.8)" }} />
      {/* skyline */}
      <svg width={1080} height={520} viewBox="0 0 1080 520" style={{ position: "absolute", left: 0, top: 860 }}>
        <path d="M0 520 L0 300 L60 300 L60 220 L120 220 L120 280 L170 280 L170 160 L230 160 L230 260 L280 260 L280 330
                 L340 330 L340 250 Q360 200 380 250 L380 330
                 L420 330 L420 270 L450 270 Q450 150 540 120 Q630 150 630 270 L660 270 L660 330
                 L700 330 L700 180 L760 180 L760 250 L800 250 L800 120 L860 120 L860 240 L920 240 L920 200 L980 200 L980 290 L1080 290 L1080 520 Z" fill="#1B0A2E" />
        <rect x={536} y={70} width={8} height={50} fill="#1B0A2E" />
        {Array.from({ length: 40 }).map((_, i) => {
          const x = 20 + ((i * 97) % 1040), y = 200 + ((i * 53) % 240);
          return <rect key={i} x={x} y={y} width={8} height={10} fill={i % 3 ? V.yellow : V.teal} opacity={0.35 + ((frame + i * 7) % 40 > 35 ? 0.4 : 0)} />;
        })}
      </svg>
      {/* water */}
      <div style={{ position: "absolute", left: 0, right: 0, top: 1380, bottom: 0, background: `linear-gradient(180deg, ${V.magenta}, ${V.violet} 50%, ${V.night})` }}>
        {Array.from({ length: 14 }).map((_, i) => (
          <div key={i} style={{ position: "absolute", left: 300 + Math.sin((frame + i * 20) / 15) * 40 - i * 4, width: 480 - i * 24, top: 20 + i * 34, height: 6, borderRadius: 3, background: V.yellow, opacity: 0.6 - i * 0.04 }} />
        ))}
      </div>
      <Palm x={-90} h={1300} sway={sway} />
      <Palm x={820} h={1100} flip sway={-sway} />
    </AbsoluteFill>
  );
};

// ── Scene 1: trailer opening ──
const Opening: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const slam = spring({ frame: frame - 20, fps, config: { damping: 10, stiffness: 220, mass: 0.9 } });
  const shake = frame > 20 && frame < 32 ? Math.sin(frame * 3) * (32 - frame) * 1.5 : 0;
  const sub = interpolate(frame, [40, 56], [0, 1], clamp);
  const zoom = 1.12 - interpolate(frame, [0, 110], [0, 0.12], clamp);
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ transform: `scale(${zoom})` }}><Sunset /></AbsoluteFill>
      <AbsoluteFill style={{ alignItems: "center", paddingTop: 300, transform: `translate(${shake}px, ${shake * 0.6}px)` }}>
        <div style={{ transform: `scale(${interpolate(slam, [0, 1], [2.6, 1])})`, opacity: interpolate(slam, [0, 0.1], [0, 1], clamp) }}>
          <Title size={210}>ZIDANE</Title>
        </div>
        <div style={{ marginTop: 26, opacity: sub, fontFamily: "Sora", fontWeight: 800, fontSize: 52, letterSpacing: `${0.2 + sub * 0.4}em`, color: V.white, textShadow: `0 0 20px ${V.magenta}, 0 0 40px ${V.magenta}` }}>KARACHI</div>
      </AbsoluteFill>
      <VHS bars={interpolate(frame, [0, 14], [960, 120], clamp)} />
    </AbsoluteFill>
  );
};

// ── Scene 2: cover-art grid of the "crew" ──
const crew: { id: string; name: string; bg: string }[] = [
  { id: "1148810", name: "THE OIL", bg: `linear-gradient(160deg, ${V.orange}, ${V.magenta})` },
  { id: "1200458", name: "THE ATTA", bg: `linear-gradient(160deg, ${V.teal}, ${V.violet})` },
  { id: "1119315", name: "THE MASALA", bg: `linear-gradient(160deg, ${V.magenta}, ${V.violet})` },
  { id: "1145167", name: "THE CHAI", bg: `linear-gradient(160deg, ${V.yellow}, ${V.orange})` },
  { id: "1017740", name: "THE RICE", bg: `linear-gradient(160deg, ${V.violet}, ${V.teal})` },
  { id: "1018326", name: "THE DOODH", bg: `linear-gradient(160deg, ${V.orange}, ${V.yellow})` },
];
const Crew: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const cells = [
    { x: 40, y: 150, w: 520, h: 520 }, { x: 580, y: 150, w: 460, h: 340 }, { x: 580, y: 510, w: 460, h: 520 },
    { x: 40, y: 690, w: 520, h: 600 }, { x: 40, y: 1310, w: 460, h: 460 }, { x: 520, y: 1050, w: 520, h: 720 },
  ];
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {crew.map((c, i) => {
        const cell = cells[i];
        const p = spring({ frame: frame - i * 6, fps, config: { damping: 15, stiffness: 160 } });
        const dir = i % 2 ? 1 : -1;
        return (
          <div key={c.id} style={{ position: "absolute", left: cell.x, top: cell.y, width: cell.w, height: cell.h, overflow: "hidden", border: "8px solid #000",
            transform: `translateX(${(1 - p) * dir * 700}px) skewY(-3deg)`, background: c.bg }}>
            <div style={{ position: "absolute", inset: 0, backgroundImage: "repeating-linear-gradient(-45deg, rgba(255,255,255,0.08) 0 6px, transparent 6px 22px)" }} />
            <Img src={staticFile(`catalog/${c.id}.png`)} style={{ position: "absolute", left: "50%", bottom: 40, height: cell.h * 0.78, maxWidth: cell.w * 0.8, objectFit: "contain",
              transform: `translateX(-50%) scale(${1 + (frame - i * 6) * 0.002}) rotate(${dir * 4}deg)`, filter: "drop-shadow(0 20px 20px rgba(0,0,0,.5)) saturate(1.2)" }} />
            <div style={{ position: "absolute", left: 18, top: 16 }}>
              <Title size={Math.min(64, cell.w / 7)} skew={-8} grad={`linear-gradient(180deg, #fff, ${V.yellow})`}>{c.name}</Title>
            </div>
          </div>
        );
      })}
      <VHS bars={0} />
    </AbsoluteFill>
  );
};

// ── Scene 3: mission HUD with neon map ──
const Mission: React.FC = () => {
  const frame = useCurrentFrame();
  const mission = "MISSION: Restock the factory canteen";
  const typed = mission.slice(0, Math.floor(frame / 1.3));
  const route = interpolate(frame, [20, 110], [0, 1], clamp);
  // route polyline
  const pts = [[240, 1300], [240, 1050], [520, 1050], [520, 780], [820, 780], [820, 560]];
  const lens = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]));
  const total = lens.reduce((a, b) => a + b, 0);
  let d = route * total, tx = pts[0][0], ty = pts[0][1], ang = -90;
  for (let i = 0; i < lens.length; i++) {
    if (d <= lens[i]) { const k = d / lens[i]; tx = pts[i][0] + (pts[i + 1][0] - pts[i][0]) * k; ty = pts[i][1] + (pts[i + 1][1] - pts[i][1]) * k; ang = Math.atan2(pts[i + 1][1] - pts[i][1], pts[i + 1][0] - pts[i][0]) * 180 / Math.PI; break; }
    d -= lens[i]; tx = pts[i + 1][0]; ty = pts[i + 1][1];
  }
  const objectives = [{ t: "Send the list", at: 40 }, { t: "Get a clear quote", at: 75 }, { t: "Delivered on time", at: 115 }];
  return (
    <AbsoluteFill style={{ background: V.night }}>
      {/* neon map grid */}
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        {Array.from({ length: 14 }).map((_, i) => <line key={`v${i}`} x1={i * 90} y1={0} x2={i * 90} y2={1920} stroke={V.violet} strokeWidth={i % 3 ? 2 : 6} opacity={0.5} />)}
        {Array.from({ length: 24 }).map((_, i) => <line key={`h${i}`} x1={0} y1={i * 90} x2={1080} y2={i * 90} stroke={V.violet} strokeWidth={i % 4 ? 2 : 6} opacity={0.5} />)}
        <path d="M0 1500 Q 300 1420 540 1480 T 1080 1440 L1080 1920 L0 1920 Z" fill="#0A2B4A" opacity={0.8} />
        <polyline points={pts.map((p) => p.join(",")).join(" ")} fill="none" stroke={V.yellow} strokeWidth={14} strokeLinecap="round" strokeLinejoin="round" opacity={0.25} />
        <polyline points={pts.map((p) => p.join(",")).join(" ")} fill="none" stroke={V.yellow} strokeWidth={14} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - route} style={{ filter: `drop-shadow(0 0 12px ${V.yellow})` }} />
        {/* pins */}
        <g transform="translate(240 1300)"><circle r={34} fill={V.magenta} stroke="#fff" strokeWidth={6} /><text y={12} textAnchor="middle" fontFamily="Sora" fontWeight={800} fontSize={34} fill="#fff">Z</text></g>
        <g transform="translate(820 560)"><circle r={34 + Math.sin(frame / 4) * 4} fill={V.teal} stroke="#fff" strokeWidth={6} /><path d="M-12 8 L-12 -6 L0 -14 L12 -6 L12 8 Z" fill="#fff" /></g>
        {/* truck */}
        <g transform={`translate(${tx} ${ty}) rotate(${ang})`}>
          <rect x={-34} y={-18} width={50} height={36} rx={6} fill={V.orange} stroke="#000" strokeWidth={4} />
          <rect x={16} y={-14} width={22} height={28} rx={5} fill="#fff" stroke="#000" strokeWidth={4} />
        </g>
      </svg>
      <div style={{ position: "absolute", left: 270, top: 1320, fontFamily: "Sora", fontWeight: 800, fontSize: 30, color: "#fff", textShadow: "0 0 10px #000" }}>ZIDANE WAREHOUSE</div>
      <div style={{ position: "absolute", left: 600, top: 470, fontFamily: "Sora", fontWeight: 800, fontSize: 30, color: "#fff", textShadow: "0 0 10px #000" }}>YOUR FACTORY</div>
      {/* mission text */}
      <div style={{ position: "absolute", left: 60, right: 60, top: 170, background: "rgba(0,0,0,0.65)", borderLeft: `10px solid ${V.yellow}`, padding: "22px 28px", fontFamily: "Sora", fontWeight: 700, fontSize: 40, color: "#fff" }}>
        {typed}<span style={{ opacity: Math.floor(frame / 8) % 2 ? 0 : 1 }}>▌</span>
      </div>
      {/* objectives */}
      <div style={{ position: "absolute", left: 60, top: 320, display: "flex", flexDirection: "column", gap: 14, alignItems: "flex-start" }}>
        {objectives.map((o) => {
          const done = frame >= o.at;
          const p = interpolate(frame, [o.at - 30, o.at - 20], [0, 1], clamp);
          return (
            <div key={o.t} style={{ opacity: p, background: "rgba(0,0,0,0.65)", padding: "12px 20px", fontFamily: "Sora", fontWeight: 700, fontSize: 32, color: done ? V.yellow : "#fff", display: "flex", gap: 14, alignItems: "center" }}>
              <span style={{ width: 30, height: 30, border: `3px solid ${done ? V.yellow : "#fff"}`, display: "grid", placeItems: "center", fontSize: 24 }}>{done ? "✓" : ""}</span>{o.t}
            </div>
          );
        })}
      </div>
      {/* minimap ring + stars */}
      <div style={{ position: "absolute", left: 50, bottom: 170, width: 220, height: 220, borderRadius: "50%", border: "8px solid rgba(0,0,0,0.7)", background: "rgba(25,227,211,0.15)", overflow: "hidden" }}>
        <div style={{ position: "absolute", left: 100, top: 100, width: 20, height: 20, background: V.yellow, transform: `rotate(${ang + 90}deg)`, clipPath: "polygon(50% 0, 100% 100%, 0 100%)" }} />
      </div>
      <div style={{ position: "absolute", right: 50, top: 130, fontSize: 46, color: V.yellow, letterSpacing: 6, textShadow: "0 0 8px #000" }}>★★★★★</div>
      <VHS bars={0} />
    </AbsoluteFill>
  );
};

// ── Scene 4: mission passed ──
const Passed: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: frame - 2, fps, config: { damping: 12, stiffness: 140 } });
  const sub = interpolate(frame, [22, 36], [0, 1], clamp);
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ filter: "blur(6px) brightness(0.55)" }}><Sunset /></AbsoluteFill>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div style={{ transform: `scale(${interpolate(p, [0, 1], [0.6, 1])})`, opacity: p }}>
          <Title size={150} grad={`linear-gradient(180deg, #FFF3A0, ${V.yellow} 50%, ${V.orange})`}>{"MISSION\nPASSED"}</Title>
        </div>
        <div style={{ marginTop: 40, opacity: sub, fontFamily: "Sora", fontWeight: 800, fontSize: 54, color: "#fff", textShadow: "0 4px 0 #000" }}>Canteen restocked.</div>
        <div style={{ marginTop: 14, opacity: sub, fontFamily: "Sora", fontWeight: 700, fontSize: 40, color: V.teal, textShadow: "0 3px 0 #000" }}>RESPECT +100</div>
      </AbsoluteFill>
      <VHS />
    </AbsoluteFill>
  );
};

// ── Scene 5: end card ──
const EndCard: React.FC = () => {
  const frame = useCurrentFrame();
  const a = interpolate(frame, [4, 20], [0, 1], clamp);
  const b = interpolate(frame, [18, 34], [0, 1], clamp);
  return (
    <AbsoluteFill>
      <Sunset />
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(18,6,31,0.85), rgba(18,6,31,0.2) 45%, rgba(18,6,31,0.75))" }} />
      <AbsoluteFill style={{ alignItems: "center", paddingTop: 420 }}>
        <div style={{ opacity: a, transform: `translateY(${(1 - a) * 40}px)` }}><Title size={120}>{"zidane\n.com.pk"}</Title></div>
        <div style={{ marginTop: 50, opacity: b, fontFamily: "Sora", fontWeight: 800, fontSize: 46, color: "#fff", letterSpacing: "0.12em", textShadow: `0 0 20px ${V.magenta}` }}>NOW AVAILABLE IN KARACHI</div>
        <div style={{ marginTop: 14, opacity: b, fontFamily: "Inter", fontWeight: 600, fontSize: 34, color: V.yellow }}>Bulk grocery supply for business</div>
      </AbsoluteFill>
      <VHS />
    </AbsoluteFill>
  );
};

const S = { open: 3.8, crew: 4.2, mission: 5.4, passed: 2.8, end: 3.8 };
const at = { crew: S.open, mission: S.open + S.crew, passed: S.open + S.crew + S.mission, end: S.open + S.crew + S.mission + S.passed };
export const VICE_TOTAL = sec(at.end + S.end);

export const KarachiVice: React.FC = () => {
  const { durationInFrames } = useVideoConfig();
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <Sequence durationInFrames={sec(S.open)}><Opening /></Sequence>
      <Sequence from={sec(at.crew)} durationInFrames={sec(S.crew)}><Crew /></Sequence>
      <Sequence from={sec(at.mission)} durationInFrames={sec(S.mission)}><Mission /></Sequence>
      <Sequence from={sec(at.passed)} durationInFrames={sec(S.passed)}><Passed /></Sequence>
      <Sequence from={sec(at.end)} durationInFrames={sec(S.end)}><EndCard /></Sequence>
      <Audio src={staticFile("sfx/synthwave.wav")} endAt={durationInFrames}
        volume={(f) => interpolate(f, [0, 8, sec(at.passed) - 4, sec(at.passed), sec(at.passed + 2.2), durationInFrames - 15, durationInFrames], [0, 0.8, 0.8, 0.25, 0.8, 0.8, 0], clamp)} />
      <Sequence from={18} durationInFrames={30}><Audio src={staticFile("sfx/slam.wav")} volume={0.9} /></Sequence>
      {crew.map((_, i) => <Sequence key={i} from={sec(at.crew) + i * 6} durationInFrames={20}><Audio src={staticFile("sfx/whoosh.wav")} volume={0.25} /></Sequence>)}
      <Sequence from={sec(at.passed)} durationInFrames={75}><Audio src={staticFile("sfx/mission.wav")} volume={0.85} /></Sequence>
      <Sequence from={sec(at.end) + 4} durationInFrames={30}><Audio src={staticFile("sfx/slam.wav")} volume={0.6} /></Sequence>
    </AbsoluteFill>
  );
};

export const ViceCompositions: React.FC = () => (
  <Composition id="KarachiVice" component={KarachiVice} durationInFrames={VICE_TOTAL} fps={30} width={1080} height={1920} />
);
