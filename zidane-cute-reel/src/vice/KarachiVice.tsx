// "Karachi Vice × Zidane": open-world crime-game homage (wasted hook, cover-art grid, GPS mission, mission passed).
// Style homage only: no game logos or names. Heavy display font is Passion One (OFL).
import React from "react";
import { AbsoluteFill, Audio, Composition, Img, interpolate, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import "../Fonts";

const FPS = 30;
const sec = (s: number) => Math.round(s * FPS);
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const V = { night: "#12061F", violet: "#5B21B6", magenta: "#FF2E88", orange: "#FF8A3D", yellow: "#FFD34D", teal: "#19E3D3", gold: "#F2C230", red: "#C8262C" };
const GAME = "Passion One";

// Heavy outlined game title (stroke painted behind the fill)
const Title: React.FC<{ size: number; children: React.ReactNode; color?: string; fill?: string; stroke?: number; style?: React.CSSProperties }> = ({ size, children, color = "#fff", fill, stroke = 0.16, style }) => (
  <div style={{
    fontFamily: GAME, fontWeight: 900, fontSize: size, lineHeight: 0.92, letterSpacing: "0.01em", textAlign: "center", whiteSpace: "pre",
    color, WebkitTextStroke: `${size * stroke}px #000`, paintOrder: "stroke fill", filter: `drop-shadow(0 ${size * 0.05}px 0 rgba(0,0,0,0.6))`,
    ...(fill ? { background: fill, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" } : {}), ...style,
  }}>{children}</div>
);

// Gradient-filled title needs the outline as a separate layer behind it
const GradTitle: React.FC<{ size: number; children: string; fill: string }> = ({ size, children, fill }) => (
  <div style={{ position: "relative" }}>
    <Title size={size} style={{ position: "absolute", inset: 0 }}>{children}</Title>
    <Title size={size} stroke={0} fill={fill} style={{ position: "relative", filter: "none" }}>{children}</Title>
  </div>
);

// ── Canteen set: empty (hook) or stocked (payoff) ──
const stock = ["1148810", "1200458", "1119315", "1145167", "1017740", "1018326"];
export const Canteen: React.FC<{ full: boolean }> = ({ full }) => {
  const shelves = [520, 820];
  return (
    <AbsoluteFill style={{ background: "repeating-linear-gradient(0deg, #D9D2C3 0 118px, #BDB4A3 118px 122px), #D9D2C3" }}>
      <AbsoluteFill style={{ backgroundImage: "repeating-linear-gradient(90deg, transparent 0 118px, #BDB4A3 118px 122px)" }} />
      {/* neon-ish sign */}
      <div style={{ position: "absolute", left: 0, right: 0, top: 230, textAlign: "center", fontFamily: GAME, fontWeight: 900, fontSize: 120, color: full ? "#FF5A4F" : "#7A6F66", textShadow: full ? "0 0 30px #FF5A4F" : "none", letterSpacing: "0.06em" }}>CANTEEN</div>
      {shelves.map((y, si) => (
        <React.Fragment key={y}>
          <div style={{ position: "absolute", left: 70, right: 70, top: y, height: 26, background: "#6B4A2E", boxShadow: "0 14px 0 #4A3220" }} />
          {full && stock.slice(si * 3, si * 3 + 3).map((id, i) => (
            <Img key={id} src={staticFile(`catalog/${id}.png`)} style={{ position: "absolute", left: 110 + i * 300, top: y - 250, width: 260, height: 250, objectFit: "contain", objectPosition: "bottom" }} />
          ))}
          {!full && si === 1 && <div style={{ position: "absolute", left: 640, top: y - 34, width: 60, height: 34, border: "6px solid #8B8073", borderTop: "none", borderRadius: "0 0 14px 14px", transform: "rotate(80deg)" }} />}
        </React.Fragment>
      ))}
      {/* counter */}
      <div style={{ position: "absolute", left: 0, right: 0, top: 1240, bottom: 0, background: "linear-gradient(180deg, #8A5A36, #5E3B22)" }} />
      <div style={{ position: "absolute", left: 0, right: 0, top: 1220, height: 40, background: "#3E2615" }} />
      {/* chai cups on the counter */}
      {[0, 1, 2, 3].map((i) => (
        <div key={i} style={{ position: "absolute", left: 170 + i * 200, top: 1120, width: 110, height: 110, background: "#F4F1EA", borderRadius: "0 0 30px 30px", border: "5px solid #2B1A10", overflow: "hidden" }}>
          {full && <div style={{ position: "absolute", left: 0, right: 0, top: 18, bottom: 0, background: "#B5793F" }} />}
        </div>
      ))}
    </AbsoluteFill>
  );
};

// ── Scene 1: WASTED hook ──
const Wasted: React.FC = () => {
  const frame = useCurrentFrame();
  const g = interpolate(frame, [10, 27], [0, 1], clamp);
  const hit = interpolate(frame, [27, 31], [1.25, 1], clamp);
  const band = interpolate(frame, [26, 30], [0, 1], clamp);
  const retry = interpolate(frame, [58, 66], [0, 1], clamp);
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <AbsoluteFill style={{ transform: `scale(${1.05 + frame * 0.0025}) rotate(${g * -2}deg)`, filter: `grayscale(${g}) blur(${g * 5}px) brightness(${1 - g * 0.35})` }}>
        <Canteen full={false} />
      </AbsoluteFill>
      <AbsoluteFill style={{ background: `rgba(255,255,255,${interpolate(frame, [26, 27, 34], [0, 0.6, 0], clamp)})` }} />
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <div style={{ width: "100%", padding: "34px 0 44px", background: `rgba(0,0,0,${0.55 * band})`, display: "flex", flexDirection: "column", alignItems: "center", opacity: band }}>
          <Title size={230} color={V.red} style={{ transform: `scale(${hit})`, filter: "drop-shadow(0 6px 0 rgba(0,0,0,0.7))" }}>WASTED</Title>
          <div style={{ marginTop: 18, fontFamily: "Inter", fontWeight: 600, fontSize: 46, color: "#fff", textShadow: "0 3px 6px #000" }}>The canteen ran out of chai.</div>
        </div>
      </AbsoluteFill>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 260, textAlign: "center", opacity: retry, fontFamily: "Inter", fontWeight: 600, fontSize: 40, color: "#fff", textShadow: "0 3px 6px #000" }}>
        <span style={{ display: "inline-block", background: "#fff", color: "#000", borderRadius: 10, padding: "2px 18px", marginRight: 16, fontWeight: 800 }}>▶</span>
        Retry with <span style={{ color: V.gold }}>Zidane</span>
      </div>
    </AbsoluteFill>
  );
};

// ── Retro sunset with Mazar-e-Quaid skyline (used in cover panel and end card) ──
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
export const Sunset: React.FC = () => {
  const frame = useCurrentFrame();
  const sway = Math.sin(frame / 25) * 3;
  return (
    <AbsoluteFill style={{ background: `linear-gradient(180deg, ${V.night} 0%, ${V.violet} 30%, ${V.magenta} 55%, ${V.orange} 72%, ${V.yellow} 80%)`, overflow: "hidden" }}>
      <div style={{ position: "absolute", left: 240, top: 760, width: 600, height: 600, borderRadius: "50%", background: `linear-gradient(180deg, ${V.yellow}, ${V.orange} 60%, ${V.magenta})`,
        WebkitMaskImage: "linear-gradient(180deg, #000 0 52%, transparent 52% 56%, #000 56% 63%, transparent 63% 68%, #000 68% 74%, transparent 74% 80%, #000 80% 85%, transparent 85% 92%, #000 92%)",
        boxShadow: "0 0 120px rgba(255,138,61,0.8)" }} />
      <svg width={1080} height={520} viewBox="0 0 1080 520" style={{ position: "absolute", left: 0, top: 860 }}>
        <path d="M0 520 L0 300 L60 300 L60 220 L120 220 L120 280 L170 280 L170 160 L230 160 L230 260 L280 260 L280 330
                 L340 330 L340 250 Q360 200 380 250 L380 330
                 L420 330 L420 270 L450 270 Q450 150 540 120 Q630 150 630 270 L660 270 L660 330
                 L700 330 L700 180 L760 180 L760 250 L800 250 L800 120 L860 120 L860 240 L920 240 L920 200 L980 200 L980 290 L1080 290 L1080 520 Z" fill="#1B0A2E" />
        <rect x={536} y={70} width={8} height={50} fill="#1B0A2E" />
      </svg>
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

// ── Scene 2: cover-art grid ──
type Panel = { x: number; y: number; w: number; h: number; bg: string; id?: string; tilt: number };
const panels: Panel[] = [
  { x: 0, y: 0, w: 534, h: 640, bg: `linear-gradient(170deg, ${V.orange}, ${V.magenta})`, id: "1148810", tilt: -6 },
  { x: 546, y: 0, w: 534, h: 430, bg: `linear-gradient(170deg, ${V.teal}, #0E6E8C)`, id: "1145167", tilt: 5 },
  { x: 546, y: 442, w: 534, h: 420, bg: `linear-gradient(170deg, ${V.magenta}, ${V.violet})`, id: "1119315", tilt: -4 },
  { x: 0, y: 652, w: 420, h: 640, bg: `linear-gradient(170deg, #7B5CFF, ${V.violet})`, id: "1200458", tilt: 4 },
  { x: 432, y: 874, w: 648, h: 418, bg: `linear-gradient(170deg, ${V.yellow}, ${V.orange})`, id: "1017740", tilt: -5 },
  { x: 0, y: 1304, w: 600, h: 616, bg: `linear-gradient(170deg, #FF5A4F, #8E1630)`, id: "1018326", tilt: 6 },
  { x: 612, y: 1304, w: 468, h: 616, bg: "", tilt: 0 },
];
const Cover: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const logo = spring({ frame: frame - 34, fps, config: { damping: 11, stiffness: 200, mass: 0.8 } });
  const sub = interpolate(frame, [48, 58], [0, 1], clamp);
  return (
    <AbsoluteFill style={{ background: "#fff" }}>
      {panels.map((p, i) => {
        const s = spring({ frame: frame - i * 4, fps, config: { damping: 16, stiffness: 170 } });
        const drift = frame * 0.12 * (i % 2 ? 1 : -1);
        return (
          <div key={i} style={{ position: "absolute", left: p.x, top: p.y, width: p.w, height: p.h, overflow: "hidden", background: p.bg || "#000", opacity: s, transform: `scale(${1.2 - 0.2 * s})` }}>
            {p.id ? (
              <>
                <div style={{ position: "absolute", inset: -200, background: "repeating-conic-gradient(from 0deg at 50% 70%, rgba(255,255,255,0.14) 0 6deg, transparent 6deg 14deg)" }} />
                <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(rgba(0,0,0,0.22) 2.2px, transparent 2.6px)", backgroundSize: "12px 12px" }} />
                <Img src={staticFile(`catalog/${p.id}.png`)} style={{ position: "absolute", left: "50%", top: "52%", height: p.h * 0.82, maxWidth: p.w * 0.84, objectFit: "contain",
                  transform: `translate(-50%, -50%) translateX(${drift}px) rotate(${p.tilt}deg) scale(${1 + frame * 0.0012})`, filter: "contrast(1.2) saturate(1.35) drop-shadow(8px 8px 0 #000)" }} />
              </>
            ) : (
              <div style={{ position: "absolute", left: (p.w - 1080) / 2, top: (p.h - 1920) / 2 - 300, width: 1080, height: 1920, transform: "scale(0.62)" }}><Sunset /></div>
            )}
          </div>
        );
      })}
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <div style={{ transform: `scale(${interpolate(logo, [0, 1], [2.4, 1])}) rotate(-3deg)`, opacity: interpolate(logo, [0, 0.15], [0, 1], clamp), display: "flex", flexDirection: "column", alignItems: "center" }}>
          <Title size={250} stroke={0.13}>ZIDANE</Title>
          <div style={{ marginTop: 6, opacity: sub, background: "#000", padding: "8px 26px 10px", transform: "skewX(-10deg)" }}>
            <div style={{ fontFamily: GAME, fontWeight: 900, fontSize: 64, color: V.gold, letterSpacing: "0.18em" }}>KARACHI</div>
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ── Scene 3: GPS mission on the city map ──
const route: [number, number][] = [[150, 1500], [400, 1500], [400, 1180], [700, 1180], [700, 820], [930, 820], [930, 560]];
const routeAt = (k: number) => {
  const lens = route.slice(1).map((p, i) => Math.hypot(p[0] - route[i][0], p[1] - route[i][1]));
  let d = k * lens.reduce((a, b) => a + b, 0);
  for (let i = 0; i < lens.length; i++) {
    const [x0, y0] = route[i], [x1, y1] = route[i + 1];
    if (d <= lens[i] || i === lens.length - 1) {
      const t = Math.min(1, d / lens[i]);
      return { x: x0 + (x1 - x0) * t, y: y0 + (y1 - y0) * t, a: (Math.atan2(y1 - y0, x1 - x0) * 180) / Math.PI };
    }
    d -= lens[i];
  }
  return { x: route[0][0], y: route[0][1], a: 0 };
};
const roadsX = [-300, 150, 400, 700, 930, 1300];
const roadsY = [-200, 200, 560, 820, 1180, 1500, 1820];
const CityMap: React.FC<{ progress: number; frame: number; labels?: boolean }> = ({ progress, frame, labels = true }) => {
  const truck = routeAt(progress);
  const blocks: React.ReactNode[] = [];
  for (let i = 0; i < roadsX.length - 1; i++) for (let j = 0; j < roadsY.length - 1; j++) {
    const x0 = roadsX[i] + 26, x1 = roadsX[i + 1] - 26, y0 = roadsY[j] + 26, y1 = roadsY[j + 1] - 26;
    const park = (i * 7 + j * 3) % 9 === 4;
    if (park) { blocks.push(<rect key={`${i}-${j}`} x={x0} y={y0} width={x1 - x0} height={y1 - y0} rx={18} fill="#3E5B3A" />); continue; }
    for (let k = 0; k < 4; k++) {
      const r = (n: number) => (Math.sin(i * 12.9 + j * 78.2 + k * 37.7 + n) + 1) / 2;
      const w = (x1 - x0) * (0.3 + r(1) * 0.4), h = (y1 - y0) * (0.3 + r(2) * 0.4);
      blocks.push(<rect key={`${i}-${j}-${k}`} x={x0 + r(3) * (x1 - x0 - w)} y={y0 + r(4) * (y1 - y0 - h)} width={w} height={h} fill={k % 2 ? "#4A535E" : "#535D69"} />);
    }
  }
  const pts = route.map((p) => p.join(",")).join(" ");
  return (
    <svg width={1080} height={1920} viewBox="0 0 1080 1920" style={{ overflow: "visible", position: "absolute", left: 0, top: 0 }}>
      <rect x={-1500} y={-1500} width={4080} height={4920} fill="#3F4750" />
      {blocks}
      <path d="M-1500 1660 Q 200 1600 540 1700 T 2600 1640 L2600 3500 L-1500 3500 Z" fill="#1E4E6B" />
      {roadsX.map((x) => <line key={`x${x}`} x1={x} y1={-1500} x2={x} y2={3500} stroke="#9AA3AD" strokeWidth={30} />)}
      {roadsY.map((y) => <line key={`y${y}`} x1={-1500} y1={y} x2={2600} y2={y} stroke="#9AA3AD" strokeWidth={30} />)}
      <line x1={-200} y1={1400} x2={1300} y2={-100} stroke="#B3BAC2" strokeWidth={40} />
      {/* GPS route */}
      <polyline points={pts} fill="none" stroke="#000" strokeOpacity={0.35} strokeWidth={34} strokeLinejoin="round" strokeLinecap="round" />
      <polyline points={pts} fill="none" stroke={V.gold} strokeWidth={22} strokeLinejoin="round" strokeLinecap="round" />
      {/* blips */}
      <g transform="translate(150 1500)"><circle r={40} fill="#000" /><circle r={33} fill="#fff" /><text y={15} textAnchor="middle" fontFamily={GAME} fontWeight={900} fontSize={44} fill="#000">Z</text></g>
      <g transform="translate(930 560)"><circle r={46 + Math.sin(frame / 4) * 5} fill={V.gold} opacity={0.35} /><circle r={34} fill={V.gold} stroke="#000" strokeWidth={6} /></g>
      {labels && <>
        <text x={210} y={1460} fontFamily="Inter" fontWeight={600} fontSize={34} fill="#fff" stroke="#000" strokeWidth={6} paintOrder="stroke">Zidane Warehouse</text>
        <text x={930} y={490} textAnchor="middle" fontFamily="Inter" fontWeight={600} fontSize={34} fill="#fff" stroke="#000" strokeWidth={6} paintOrder="stroke">Your Factory</text>
      </>}
      {/* player arrow */}
      <g transform={`translate(${truck.x} ${truck.y}) rotate(${truck.a + 90})`}>
        <path d="M0 -36 L26 28 L0 14 L-26 28 Z" fill="#fff" stroke="#000" strokeWidth={6} strokeLinejoin="round" />
      </g>
    </svg>
  );
};

const Mission: React.FC = () => {
  const frame = useCurrentFrame();
  const progress = interpolate(frame, [100, 180], [0, 1], { ...clamp, easing: (t) => t * t * (3 - 2 * t) });
  const truck = routeAt(progress);
  const s = 1.25;
  const camX = 540 - truck.x * s, camY = 900 - truck.y * s;
  const title = interpolate(frame, [0, 6, 34, 42], [0, 1, 1, 0], clamp);
  const subs = [
    { from: 42, to: 92, pre: "Send your ", key: "list", post: " to Zidane." },
    { from: 92, to: 140, pre: "Get a clear ", key: "quote", post: "." },
    { from: 140, to: 999, pre: "Deliver the stock to the ", key: "factory", post: "." },
  ];
  const cur = subs.find((x) => frame >= x.from && frame < x.to);
  const notes = [{ at: 52, icon: "📋", t: "List sent", s: "Canteen restock" }, { at: 100, icon: "✅", t: "Zidane", s: "Quote ready. Dispatching." }];
  return (
    <AbsoluteFill style={{ background: "#3F4750", overflow: "hidden" }}>
      <div style={{ position: "absolute", left: 0, top: 0, width: 1080, height: 1920, transformOrigin: "0 0", transform: `translate(${camX}px, ${camY}px) scale(${s})` }}>
        <CityMap progress={progress} frame={frame} />
      </div>
      {/* mission title */}
      <AbsoluteFill style={{ background: `rgba(0,0,0,${title * 0.55})`, justifyContent: "center", alignItems: "center", opacity: title }}>
        <Title size={150}>{"RESTOCK\nTHE CANTEEN"}</Title>
      </AbsoluteFill>
      {/* notifications */}
      <div style={{ position: "absolute", left: 40, top: 140, display: "flex", flexDirection: "column", gap: 16 }}>
        {notes.map((n) => {
          const o = interpolate(frame, [n.at, n.at + 6], [0, 1], clamp);
          return (
            <div key={n.t} style={{ opacity: o, transform: `translateX(${(1 - o) * -60}px)`, display: "flex", gap: 18, alignItems: "center", background: "rgba(10,10,10,0.82)", padding: "16px 26px 16px 18px", borderRadius: 6 }}>
              <div style={{ width: 64, height: 64, borderRadius: 8, background: "#fff", display: "grid", placeItems: "center", fontSize: 36 }}>{n.icon}</div>
              <div>
                <div style={{ fontFamily: "Inter", fontWeight: 600, fontSize: 32, color: V.gold }}>{n.t}</div>
                <div style={{ fontFamily: "Inter", fontWeight: 500, fontSize: 30, color: "#fff" }}>{n.s}</div>
              </div>
            </div>
          );
        })}
      </div>
      {/* top-right: time + wanted stars (all empty) */}
      <div style={{ position: "absolute", right: 44, top: 140, textAlign: "right" }}>
        <div style={{ fontFamily: GAME, fontWeight: 900, fontSize: 64, color: "#fff", WebkitTextStroke: "8px #000", paintOrder: "stroke fill" }}>08:45</div>
        <div style={{ fontSize: 46, color: "transparent", WebkitTextStroke: "2.5px #fff", letterSpacing: 4, textShadow: "0 0 4px #000" }}>★★★★★</div>
      </div>
      {/* subtitles */}
      {cur && (
        <div style={{ position: "absolute", left: 60, right: 60, bottom: 470, textAlign: "center", fontFamily: "Inter", fontWeight: 600, fontSize: 50, color: "#fff", textShadow: "0 3px 0 #000, 0 0 10px #000" }}>
          {cur.pre}<span style={{ color: V.gold }}>{cur.key}</span>{cur.post}
        </div>
      )}
      {/* minimap + health/armour */}
      <div style={{ position: "absolute", left: 44, bottom: 150, width: 420, height: 270, borderRadius: 10, overflow: "hidden", border: "4px solid rgba(0,0,0,0.75)" }}>
        <div style={{ position: "absolute", left: 0, top: 0, width: 1080, height: 1920, transformOrigin: "0 0", transform: `translate(${210 - truck.x * 0.45}px, ${150 - truck.y * 0.45}px) scale(0.45)` }}>
          <CityMap progress={progress} frame={frame} labels={false} />
        </div>
      </div>
      <div style={{ position: "absolute", left: 44, bottom: 124, width: 420, display: "flex", gap: 6 }}>
        <div style={{ flex: 1, height: 14, background: "#3C8D3C", border: "2px solid #000" }} />
        <div style={{ flex: 1, height: 14, background: "#3C83C8", border: "2px solid #000" }} />
      </div>
    </AbsoluteFill>
  );
};

// ── Scene 4: mission passed ──
const Passed: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: frame - 19, fps, config: { damping: 13, stiffness: 180 } });
  const sub = interpolate(frame, [32, 42], [0, 1], clamp);
  const band = interpolate(frame, [14, 20], [0, 1], clamp);
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ transform: `scale(${1.08 - frame * 0.0008})`, filter: `blur(${band * 4}px) brightness(${1 - band * 0.25})` }}><Canteen full /></AbsoluteFill>
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <div style={{ width: "100%", padding: "40px 0 46px", background: `rgba(0,0,0,${0.6 * band})`, display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ opacity: p, transform: `scale(${interpolate(p, [0, 1], [1.4, 1])})` }}>
            <Title size={170} color={V.gold}>{"MISSION\nPASSED"}</Title>
          </div>
          <div style={{ marginTop: 22, opacity: sub, fontFamily: "Inter", fontWeight: 600, fontSize: 46, color: "#fff" }}>Restock the Canteen</div>
          <div style={{ marginTop: 22, opacity: sub, display: "flex", gap: 30, fontFamily: "Inter", fontWeight: 600, fontSize: 34, color: "#fff" }}>
            <span><span style={{ color: V.gold }}>✓</span> Clear quote</span>
            <span><span style={{ color: V.gold }}>✓</span> On time</span>
            <span><span style={{ color: V.gold }}>✓</span> Chai is back</span>
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ── Scene 5: end card ──
const EndCard: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const a = spring({ frame: frame - 3, fps, config: { damping: 12, stiffness: 160 } });
  const b = interpolate(frame, [18, 30], [0, 1], clamp);
  return (
    <AbsoluteFill>
      <Sunset />
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(18,6,31,0.8), rgba(18,6,31,0.1) 50%, rgba(18,6,31,0.6))" }} />
      <AbsoluteFill style={{ alignItems: "center", paddingTop: 330 }}>
        <div style={{ opacity: a, transform: `scale(${interpolate(a, [0, 1], [1.5, 1])}) rotate(-3deg)` }}>
          <GradTitle size={250} fill={`linear-gradient(180deg, ${V.yellow} 15%, ${V.orange} 50%, ${V.magenta} 90%)`}>ZIDANE</GradTitle>
        </div>
        <div style={{ marginTop: 34, opacity: b, fontFamily: GAME, fontWeight: 900, fontSize: 78, color: "#fff", WebkitTextStroke: "10px #000", paintOrder: "stroke fill" }}>zidane.com.pk</div>
        <div style={{ marginTop: 18, opacity: b, fontFamily: "Inter", fontWeight: 600, fontSize: 36, color: "#fff", textShadow: "0 2px 8px #000" }}>Bulk grocery supply for business · Karachi</div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const S = { wasted: 3.0, cover: 4.0, mission: 6.4, passed: 3.0, end: 3.2 };
const at = { cover: S.wasted, mission: S.wasted + S.cover, passed: S.wasted + S.cover + S.mission, end: S.wasted + S.cover + S.mission + S.passed };
export const VICE_TOTAL = sec(at.end + S.end);

export const KarachiVice: React.FC = () => {
  const { durationInFrames } = useVideoConfig();
  const P = sec(at.passed), E = sec(at.end);
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <Sequence durationInFrames={sec(S.wasted)}><Wasted /></Sequence>
      <Sequence from={sec(at.cover)} durationInFrames={sec(S.cover)}><Cover /></Sequence>
      <Sequence from={sec(at.mission)} durationInFrames={sec(S.mission)}><Mission /></Sequence>
      <Sequence from={P} durationInFrames={sec(S.passed)}><Passed /></Sequence>
      <Sequence from={E} durationInFrames={sec(S.end)}><EndCard /></Sequence>
      {/* audio */}
      <Audio src={staticFile("sfx/wasted.wav")} volume={0.95} />
      <Sequence from={sec(at.cover)}>
        <Audio src={staticFile("sfx/gfunk-beat.wav")} endAt={durationInFrames - sec(at.cover)}
          volume={(f) => interpolate(f, [0, P - sec(at.cover) - 3, P - sec(at.cover) + 2, E - sec(at.cover) - 4, E - sec(at.cover) + 2, durationInFrames - sec(at.cover) - 18, durationInFrames - sec(at.cover)], [0.62, 0.62, 0.1, 0.1, 0.62, 0.62, 0], clamp)} />
      </Sequence>
      <Sequence from={sec(at.cover)} durationInFrames={30}><Audio src={staticFile("sfx/slam.wav")} volume={0.7} /></Sequence>
      <Sequence from={sec(at.cover) + 34} durationInFrames={30}><Audio src={staticFile("sfx/slam.wav")} volume={0.8} /></Sequence>
      {[52, 100].map((f) => <Sequence key={f} from={sec(at.mission) + f} durationInFrames={20}><Audio src={staticFile("sfx/pop.wav")} volume={0.5} /></Sequence>)}
      <Sequence from={sec(at.mission) + 100} durationInFrames={30}><Audio src={staticFile("sfx/whoosh.wav")} volume={0.35} /></Sequence>
      <Sequence from={P} durationInFrames={sec(S.passed) + 10}><Audio src={staticFile("sfx/passed.wav")} volume={0.95} /></Sequence>
    </AbsoluteFill>
  );
};

export const ViceCompositions: React.FC = () => (
  <Composition id="KarachiVice" component={KarachiVice} durationInFrames={VICE_TOTAL} fps={30} width={1080} height={1920} />
);
