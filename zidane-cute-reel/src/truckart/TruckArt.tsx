// "Zidane × Pakistani Truck Art" reel. Chamak-patti borders, phool patterns, truck-art lettering,
// a decorated truck front, painted rhyme panels and a dhol soundtrack.
import React from "react";
import { AbsoluteFill, Audio, Img, interpolate, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

const FPS = 30;
const sec = (s: number) => Math.round(s * FPS);
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

export const TA = {
  red: "#D7182A", blue: "#1D3FA6", green: "#0E9F6E", yellow: "#FFC81E", orange: "#FF7A00",
  pink: "#EC3E8E", teal: "#10B5C9", ink: "#120A0A", white: "#FFFFFF", cream: "#FFF4D6",
};
const PALETTE = [TA.red, TA.blue, TA.green, TA.yellow, TA.orange, TA.pink, TA.teal];

// ─────────── motifs ───────────
const Flower: React.FC<{ x: number; y: number; r: number; c1: string; c2: string; rot?: number }> = ({ x, y, r, c1, c2, rot = 0 }) => (
  <g transform={`translate(${x} ${y}) rotate(${rot})`}>
    {Array.from({ length: 8 }).map((_, i) => (
      <ellipse key={i} cx={0} cy={-r * 0.55} rx={r * 0.24} ry={r * 0.5} fill={i % 2 ? c1 : c2} stroke={TA.ink} strokeWidth={r * 0.05} transform={`rotate(${i * 45})`} />
    ))}
    <circle r={r * 0.3} fill={TA.yellow} stroke={TA.ink} strokeWidth={r * 0.05} />
    <circle r={r * 0.13} fill={TA.red} />
    <circle r={r * 0.05} cx={-r * 0.06} cy={-r * 0.06} fill="#fff" />
  </g>
);

// Scrolling phool wallpaper
export const FloralBg: React.FC<{ base: string; drift?: number }> = ({ base, drift = 0.6 }) => {
  const frame = useCurrentFrame();
  const T = 220;
  const off = (frame * drift) % T;
  return (
    <AbsoluteFill style={{ background: base, overflow: "hidden" }}>
      <svg width={1080 + T * 2} height={1920 + T * 2} style={{ position: "absolute", left: -T + off, top: -T + off * 0.6 }}>
        {Array.from({ length: Math.ceil((1920 + T * 2) / T) }).map((_, row) =>
          Array.from({ length: Math.ceil((1080 + T * 2) / T) }).map((_, col) => {
            const k = row * 7 + col;
            const x = col * T + (row % 2 ? T / 2 : 0) + T / 2;
            const y = row * T + T / 2;
            return (
              <g key={`${row}-${col}`} opacity={0.9}>
                <Flower x={x} y={y} r={54} c1={PALETTE[k % 7]} c2={PALETTE[(k + 3) % 7]} rot={(k * 17) % 45} />
                {[[-1, -1], [1, 1]].map(([dx, dy], j) => (
                  <path key={j} d={`M${x + dx * 70} ${y + dy * 70} q ${dx * 20} ${-dy * 30} ${dx * 44} ${-dy * 10}`} stroke={TA.green} strokeWidth={10} fill="none" strokeLinecap="round" />
                ))}
                <circle cx={x + T / 2} cy={y} r={7} fill={TA.white} stroke={TA.ink} strokeWidth={2} />
              </g>
            );
          }),
        )}
      </svg>
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at center, rgba(0,0,0,0) 30%, rgba(0,0,0,0.55) 100%)" }} />
    </AbsoluteFill>
  );
};

// Chamak-patti mirror-mosaic strip with a moving glint
const Chamak: React.FC<{ w: number; h: number; vertical?: boolean; phase?: number }> = ({ w, h, vertical, phase = 0 }) => {
  const frame = useCurrentFrame();
  const n = Math.ceil((vertical ? h : w) / (vertical ? w : h));
  const s = vertical ? w : h;
  const glint = ((frame * 18 + phase) % ((vertical ? h : w) + 600)) - 300;
  return (
    <svg width={w} height={h} style={{ display: "block" }}>
      <defs>
        <linearGradient id={`g${phase}`} x1={vertical ? 0 : glint - 160} x2={vertical ? 0 : glint + 160} y1={vertical ? glint - 160 : 0} y2={vertical ? glint + 160 : 0} gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#fff" stopOpacity={0} /><stop offset="0.5" stopColor="#fff" stopOpacity={0.85} /><stop offset="1" stopColor="#fff" stopOpacity={0} />
        </linearGradient>
      </defs>
      <rect width={w} height={h} fill={TA.ink} />
      {Array.from({ length: n }).map((_, i) => {
        const o = i * s;
        const c = PALETTE[i % 7];
        const c2 = PALETTE[(i + 4) % 7];
        return vertical ? (
          <g key={i}>
            <path d={`M0 ${o} L${s} ${o} L${s / 2} ${o + s / 2} Z`} fill={c} />
            <path d={`M0 ${o + s} L${s} ${o + s} L${s / 2} ${o + s / 2} Z`} fill={c2} />
            <path d={`M0 ${o} L${s / 2} ${o + s / 2} L0 ${o + s} Z`} fill="#C9D3E0" />
            <path d={`M${s} ${o} L${s / 2} ${o + s / 2} L${s} ${o + s} Z`} fill="#8C9AAE" />
          </g>
        ) : (
          <g key={i}>
            <path d={`M${o} 0 L${o} ${s} L${o + s / 2} ${s / 2} Z`} fill={c} />
            <path d={`M${o + s} 0 L${o + s} ${s} L${o + s / 2} ${s / 2} Z`} fill={c2} />
            <path d={`M${o} 0 L${o + s / 2} ${s / 2} L${o + s} 0 Z`} fill="#C9D3E0" />
            <path d={`M${o} ${s} L${o + s / 2} ${s / 2} L${o + s} ${s} Z`} fill="#8C9AAE" />
          </g>
        );
      })}
      <rect width={w} height={h} fill={`url(#g${phase})`} style={{ mixBlendMode: "screen" }} />
    </svg>
  );
};

export const ChamakFrame: React.FC<{ t?: number }> = ({ t = 1 }) => {
  const B = 44;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div style={{ position: "absolute", top: 0, left: 0, width: 1080 * t, overflow: "hidden" }}><Chamak w={1080} h={B} /></div>
      <div style={{ position: "absolute", bottom: 0, right: 0, width: 1080 * t, overflow: "hidden", display: "flex", justifyContent: "flex-end" }}><Chamak w={1080} h={B} phase={300} /></div>
      <div style={{ position: "absolute", top: 0, left: 0, height: 1920 * t, overflow: "hidden" }}><Chamak w={B} h={1920} vertical phase={150} /></div>
      <div style={{ position: "absolute", bottom: 0, right: 0, height: 1920 * t, overflow: "hidden", display: "flex", alignItems: "flex-end" }}><Chamak w={B} h={1920} vertical phase={450} /></div>
    </AbsoluteFill>
  );
};

// Truck-art lettering: stacked strokes (black > yellow > blue) under a red/orange fill with a white catch-light
export const TruckText: React.FC<{ children: string; size: number; fill?: string; style?: React.CSSProperties; thin?: boolean }> = ({ children, size, fill = TA.red, style, thin }) => {
  const k = thin ? 0.6 : 1;
  const base: React.CSSProperties = {
    position: "absolute", inset: 0, fontFamily: "Sora", fontWeight: 800, fontSize: size, lineHeight: 1.05,
    letterSpacing: "0.01em", textAlign: "center", whiteSpace: "pre",
  };
  return (
    <div style={{ position: "relative", ...style }}>
      <div style={{ ...base, position: "relative", visibility: "hidden" }}>{children}</div>
      <div style={{ ...base, color: TA.ink, WebkitTextStroke: `${size * 0.3 * k}px ${TA.ink}`, transform: `translate(${size * 0.05}px, ${size * 0.06}px)` }}>{children}</div>
      <div style={{ ...base, color: TA.ink, WebkitTextStroke: `${size * 0.26 * k}px ${TA.ink}` }}>{children}</div>
      <div style={{ ...base, color: TA.yellow, WebkitTextStroke: `${size * 0.18 * k}px ${TA.yellow}` }}>{children}</div>
      <div style={{ ...base, color: TA.blue, WebkitTextStroke: `${size * 0.08 * k}px ${TA.blue}` }}>{children}</div>
      <div style={{ ...base, color: fill, textShadow: `0 ${-size * 0.04}px 0 rgba(255,255,255,0.55)` }}>{children}</div>
    </div>
  );
};

// ─────────── the truck ───────────
const Eye: React.FC<{ x: number; flip?: boolean; blink: number }> = ({ x, flip, blink }) => (
  <g transform={`translate(${x} 250) scale(${flip ? -1 : 1} 1)`}>
    <path d="M-70 0 Q0 -60 70 0 Q0 50 -70 0 Z" fill="#fff" stroke={TA.ink} strokeWidth={6} />
    <g transform={`scale(1 ${blink})`}>
      <circle r={26} fill={TA.blue} stroke={TA.ink} strokeWidth={5} />
      <circle r={12} fill={TA.ink} />
      <circle cx={-7} cy={-8} r={5} fill="#fff" />
    </g>
    {Array.from({ length: 7 }).map((_, i) => (
      <path key={i} d={`M${-60 + i * 20} ${-28 + Math.abs(i - 3) * 6} l${-6 + i * 2} -26`} stroke={TA.ink} strokeWidth={6} strokeLinecap="round" />
    ))}
    <path d="M-80 -58 Q0 -112 80 -58" stroke={TA.ink} strokeWidth={12} fill="none" strokeLinecap="round" />
  </g>
);

export const Truck: React.FC<{ lightsOn: number }> = ({ lightsOn }) => {
  const frame = useCurrentFrame();
  const swing = Math.sin(frame / 4) * 10;
  const blink = frame % 70 > 66 ? 0.15 : 1;
  return (
    <svg viewBox="0 0 800 1000" width="100%" height="100%" style={{ overflow: "visible" }}>
      {/* taj / crown */}
      <path d="M40 360 L40 170 Q40 60 140 40 L300 10 Q400 -30 500 10 L660 40 Q760 60 760 170 L760 360 Z" fill={TA.blue} stroke={TA.ink} strokeWidth={10} />
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
        <path key={i} d={`M${60 + i * 85} 340 L${100 + i * 85} 300 L${140 + i * 85} 340 Z`} fill={PALETTE[i % 7]} stroke={TA.ink} strokeWidth={4} />
      ))}
      <path d="M90 175 Q400 60 710 175 L710 205 Q400 95 90 205 Z" fill={TA.yellow} stroke={TA.ink} strokeWidth={6} />
      <text x={400} y={150} textAnchor="middle" fontFamily="Sora" fontWeight={800} fontSize={64} fill={TA.red} stroke={TA.ink} strokeWidth={4} paintOrder="stroke">ZIDANE</text>
      <Eye x={250} blink={blink} />
      <Eye x={550} flip blink={blink} />
      <Flower x={400} y={268} r={48} c1={TA.pink} c2={TA.orange} rot={frame} />
      {/* windshield */}
      <path d="M70 360 L730 360 L700 560 L100 560 Z" fill="#1B2533" stroke={TA.ink} strokeWidth={10} />
      <path d="M130 380 L330 380 L250 540 L120 540 Z" fill="rgba(255,255,255,0.10)" />
      <path d="M400 360 L400 560" stroke={TA.ink} strokeWidth={10} />
      {/* fringe tassels across top of windshield */}
      {Array.from({ length: 22 }).map((_, i) => (
        <path key={i} d={`M${86 + i * 29} 362 l0 ${26 + (i % 3) * 8}`} stroke={PALETTE[i % 7]} strokeWidth={8} strokeLinecap="round" transform={`rotate(${Math.sin((frame + i * 3) / 5) * 6} ${86 + i * 29} 362)`} />
      ))}
      {/* body + grill */}
      <path d="M60 560 L740 560 L760 820 L40 820 Z" fill={TA.red} stroke={TA.ink} strokeWidth={10} />
      <rect x={250} y={590} width={300} height={200} rx={14} fill="#D9DEE6" stroke={TA.ink} strokeWidth={8} />
      {Array.from({ length: 9 }).map((_, i) => <rect key={i} x={268 + i * 31} y={604} width={14} height={172} rx={6} fill="#9AA6B6" />)}
      <circle cx={400} cy={690} r={44} fill={TA.yellow} stroke={TA.ink} strokeWidth={6} />
      <text x={400} y={712} textAnchor="middle" fontFamily="Sora" fontWeight={800} fontSize={60} fill={TA.red}>Z</text>
      {/* headlights */}
      {[140, 660].map((x) => (
        <g key={x}>
          <circle cx={x} cy={690} r={70} fill="#E9EEF5" stroke={TA.ink} strokeWidth={8} />
          <circle cx={x} cy={690} r={52} fill={lightsOn > 0.5 ? "#FFF7C2" : "#B9C4D3"} />
          {lightsOn > 0.5 && <circle cx={x} cy={690} r={140} fill="url(#beam)" />}
        </g>
      ))}
      <defs>
        <radialGradient id="beam"><stop offset="0" stopColor="#FFF7C2" stopOpacity={0.9} /><stop offset="1" stopColor="#FFF7C2" stopOpacity={0} /></radialGradient>
      </defs>
      {/* bumper with chains and bells */}
      <rect x={20} y={820} width={760} height={70} rx={12} fill={TA.yellow} stroke={TA.ink} strokeWidth={8} />
      {Array.from({ length: 12 }).map((_, i) => <path key={i} d={`M${40 + i * 62} 830 l20 50 l20 -50`} stroke={TA.green} strokeWidth={8} fill="none" />)}
      {Array.from({ length: 9 }).map((_, i) => {
        const x = 70 + i * 82;
        return (
          <g key={i} transform={`rotate(${swing * (i % 2 ? 1 : -1)} ${x} 890)`}>
            {Array.from({ length: 4 }).map((_, k) => <circle key={k} cx={x} cy={900 + k * 16} r={7} fill="none" stroke="#C9D3E0" strokeWidth={4} />)}
            <path d={`M${x - 14} 980 Q${x} 950 ${x + 14} 980 Z`} fill={TA.yellow} stroke={TA.ink} strokeWidth={4} />
          </g>
        );
      })}
    </svg>
  );
};

// Painted panel like the back of a truck: scalloped frame, painted sky, product, rhyme ribbon
export const Panel: React.FC<{ img?: string[]; lines: string[]; art?: "phones" | "list"; sky: [string, string]; f: number }> = ({ img = [], lines, art, sky, f }) => {
  const line1 = lines[0];
  const { fps } = useVideoConfig();
  const p = spring({ frame: f, fps, config: { damping: 12, stiffness: 140, mass: 0.7 } });
  const W = 900, H = 720;
  return (
    <div style={{ position: "relative", width: W, height: H + 340, transform: `scale(${interpolate(p, [0, 1], [0.6, 1])}) rotate(${interpolate(p, [0, 1], [-6, 0])}deg)`, opacity: interpolate(p, [0, 0.2], [0, 1], clamp) }}>
      <svg width={W} height={H} style={{ position: "absolute", left: 0, top: 0 }}>
        <rect x={0} y={0} width={W} height={H} rx={40} fill={TA.yellow} stroke={TA.ink} strokeWidth={10} />
        {Array.from({ length: 22 }).map((_, i) => <circle key={`t${i}`} cx={30 + i * 40} cy={26} r={14} fill={PALETTE[i % 7]} stroke={TA.ink} strokeWidth={3} />)}
        {Array.from({ length: 22 }).map((_, i) => <circle key={`b${i}`} cx={30 + i * 40} cy={H - 26} r={14} fill={PALETTE[(i + 3) % 7]} stroke={TA.ink} strokeWidth={3} />)}
        <rect x={56} y={56} width={W - 112} height={H - 112} rx={24} fill={`url(#sky${line1.length})`} stroke={TA.ink} strokeWidth={8} />
        <defs><linearGradient id={`sky${line1.length}`} x1={0} y1={0} x2={0} y2={1}><stop offset="0" stopColor={sky[0]} /><stop offset="1" stopColor={sky[1]} /></linearGradient></defs>
        <circle cx={W - 170} cy={170} r={60} fill={TA.yellow} opacity={0.9} />
        <path d={`M56 ${H - 200} Q${W / 2} ${H - 300} ${W - 56} ${H - 200} L${W - 56} ${H - 80} L56 ${H - 80} Z`} fill={TA.green} opacity={0.85} />
        <Flower x={110} y={H - 110} r={40} c1={TA.pink} c2={TA.orange} />
        <Flower x={W - 110} y={H - 110} r={40} c1={TA.teal} c2={TA.red} />
      </svg>
      <div style={{ position: "absolute", left: 0, top: 90, width: W, height: H - 200, display: "flex", justifyContent: "center", alignItems: "flex-end", gap: 10 }}>
        {img.map((s, i) => {
          const ip = spring({ frame: f - 6 - i * 4, fps, config: { damping: 11, stiffness: 160, mass: 0.6 } });
          return <Img key={s} src={staticFile(s)} style={{ height: [380, 440, 380][i] ?? 400, maxWidth: 270, objectFit: "contain", transform: `translateY(${(1 - ip) * 300}px) rotate(${(i - 1) * 6}deg)`, filter: "drop-shadow(0 18px 18px rgba(0,0,0,.45))" }} />;
        })}
      </div>
      {art === "phones" && <PhonesArt f={f} />}
      {art === "list" && <ListArt f={f} />}
      <div style={{ position: "absolute", left: -60, right: -60, top: H + 40, display: "flex", flexDirection: "column", gap: 18 }}>
        {lines.map((l, i) => {
          const lp = spring({ frame: f - 10 - i * 5, fps, config: { damping: 12, stiffness: 170 } });
          return (
            <div key={i} style={{ transform: `scale(${lp})`, opacity: lp }}>
              <TruckText size={Math.min(92, Math.floor(1520 / l.length))} fill={i === lines.length - 1 ? TA.yellow : TA.white}>{l}</TruckText>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const PhonesArt: React.FC<{ f: number }> = ({ f }) => {
  const spots = [[180, 260, -14], [430, 200, 8], [680, 280, -6], [300, 470, 12], [580, 480, -10]];
  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: 900, height: 760 }}>
      {spots.map(([x, y, r], i) => {
        const on = f > 6 + i * 5;
        const shake = on ? Math.sin((f + i * 9) / 1.3) * 10 : 0;
        return (
          <svg key={i} width={170} height={150} viewBox="0 0 170 150" style={{ position: "absolute", left: x - 85, top: y - 75, transform: `rotate(${r + shake}deg) scale(${on ? 1 : 0})` }}>
            <path d="M20 60 Q85 10 150 60 L135 80 Q85 50 35 80 Z" fill={PALETTE[i]} stroke={TA.ink} strokeWidth={6} />
            <rect x={40} y={70} width={90} height={60} rx={14} fill={PALETTE[(i + 3) % 7]} stroke={TA.ink} strokeWidth={6} />
            <circle cx={85} cy={100} r={16} fill={TA.cream} stroke={TA.ink} strokeWidth={5} />
            {on && <path d="M150 30 l14 -14 M158 50 l18 -4 M20 30 l-14 -14" stroke={TA.yellow} strokeWidth={7} strokeLinecap="round" />}
          </svg>
        );
      })}
      <div style={{ position: "absolute", right: 70, top: 70, width: 150, height: 150, borderRadius: 75, background: TA.red, border: `8px solid ${TA.ink}`, display: "grid", placeItems: "center", fontFamily: "Sora", fontWeight: 800, fontSize: 64, color: "#fff", transform: `scale(${f > 30 ? 1 : 0})` }}>50</div>
    </div>
  );
};

const ListArt: React.FC<{ f: number }> = ({ f }) => {
  const stamp = f > 34;
  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: 900, height: 760 }}>
      <svg width={420} height={520} viewBox="0 0 420 520" style={{ position: "absolute", left: 240, top: 110, transform: `rotate(${stamp ? 0 : -6}deg)` }}>
        <path d="M30 20 L390 20 L390 470 Q330 440 270 470 Q210 500 150 470 Q90 440 30 470 Z" fill={TA.cream} stroke={TA.ink} strokeWidth={8} />
        {[90, 160, 230, 300, 370].map((y, i) => (
          <g key={y} opacity={f > 4 + i * 4 ? 1 : 0}>
            <circle cx={75} cy={y} r={14} fill={stamp ? TA.green : PALETTE[i]} stroke={TA.ink} strokeWidth={4} />
            <path d={stamp ? `M110 ${y} L${330 - i * 14} ${y}` : `M110 ${y} q30 -14 60 0 t60 0 t60 ${i % 2 ? 6 : -6}`} stroke={TA.blue} strokeWidth={10} fill="none" strokeLinecap="round" />
          </g>
        ))}
      </svg>
      <svg width={220} height={220} viewBox="0 0 100 100" style={{ position: "absolute", left: 560, top: 360, transform: `scale(${stamp ? 1 : 0}) rotate(-12deg)` }}>
        <circle cx={50} cy={50} r={44} fill={TA.green} stroke={TA.ink} strokeWidth={6} />
        <path d="M28 52 L44 68 L74 34" stroke="#fff" strokeWidth={11} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
};

// ─────────── timeline ───────────
const T = { title: 2.8, truck: 4.0, panel: 2.6, end: 4.6 };
const panels: { img?: string[]; art?: "phones" | "list"; lines: string[]; sky: [string, string]; base: string }[] = [
  { art: "phones", lines: ["Paanch Supplier,", "Pachaas Call?"], sky: ["#5B2C83", "#E8507A"], base: TA.blue },
  { img: ["catalog/1200458.png", "catalog/1148810.png", "catalog/1119315.png"], lines: ["Atta, Chawal,", "Ghee, Masala,", "Sab Zidane Wala!"], sky: ["#14A3C7", "#FFE08A"], base: TA.red },
  { art: "list", lines: ["List Bhejo Kaisi Bhi,", "Quote Milega Saaf Hi!"], sky: ["#F2711C", "#FFD34E"], base: TA.green },
  { img: ["catalog/1145167.png", "catalog/1017740.png", "catalog/1018326.png"], lines: ["Waqt Pe Delivery,", "Na Tension Na Worry!"], sky: ["#0E7C66", "#9BE15D"], base: TA.pink },
];
const at = {
  truck: T.title,
  panels: T.title + T.truck,
  end: T.title + T.truck + T.panel * panels.length,
};
export const TRUCKART_TOTAL = sec(at.end + T.end);

const Shake: React.FC<{ hits: number[]; children: React.ReactNode }> = ({ hits, children }) => {
  const frame = useCurrentFrame();
  const amp = hits.reduce((a, h) => { const d = frame - h; return d >= 0 && d < 12 ? a + (12 - d) * 1.6 : a; }, 0);
  return <AbsoluteFill style={{ transform: `translate(${Math.sin(frame * 2.1) * amp}px, ${Math.cos(frame * 1.7) * amp}px)` }}>{children}</AbsoluteFill>;
};

const Title: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const slam = spring({ frame: frame - 6, fps, config: { damping: 9, stiffness: 200, mass: 0.8 } });
  const sub = spring({ frame: frame - 22, fps, config: { damping: 14, stiffness: 160 } });
  return (
    <AbsoluteFill>
      <FloralBg base={TA.red} />
      <Shake hits={[10]}>
        <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
          <div style={{ transform: `scale(${interpolate(slam, [0, 1], [3.2, 1])})`, opacity: interpolate(slam, [0, 0.15], [0, 1], clamp) }}>
            <TruckText size={210} fill={TA.red}>ZIDANE</TruckText>
          </div>
          <div style={{ marginTop: 30, transform: `translateY(${(1 - sub) * 60}px)`, opacity: sub }}>
            <div style={{ background: TA.ink, border: `6px solid ${TA.yellow}`, borderRadius: 999, padding: "16px 44px", fontFamily: "Sora", fontWeight: 800, fontSize: 48, color: TA.yellow, letterSpacing: "0.06em" }}>
              PESH KARTE HAIN
            </div>
          </div>
        </AbsoluteFill>
      </Shake>
      <ChamakFrame t={interpolate(frame, [0, 20], [0, 1], clamp)} />
    </AbsoluteFill>
  );
};

const TruckScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const drive = interpolate(frame, [0, 34], [0, 1], { ...clamp, easing: (x) => 1 - Math.pow(1 - x, 3) });
  const bounce = Math.abs(Math.sin(frame / 3.2)) * (1 - drive) * 18 + Math.sin(frame / 5) * 3;
  const lights = frame > 36 && frame < 70 ? (Math.floor(frame / 4) % 2) : 0;
  const tag = spring({ frame: frame - 50, fps, config: { damping: 12, stiffness: 150 } });
  return (
    <AbsoluteFill>
      <FloralBg base={TA.blue} drift={1.2} />
      <Shake hits={[34]}>
        <div style={{ position: "absolute", left: 540, top: 1060, width: 900, height: 1125, transform: `translate(-50%, -50%) translateY(${bounce}px) scale(${interpolate(drive, [0, 1], [0.15, 1])})` }}>
          <Truck lightsOn={lights} />
        </div>
      </Shake>
      <div style={{ position: "absolute", left: 0, right: 0, top: 170, transform: `scale(${tag}) rotate(-3deg)`, opacity: tag }}>
        <TruckText size={96} fill={TA.yellow}>{"Supply Ki Tension?"}</TruckText>
      </div>
      <ChamakFrame />
    </AbsoluteFill>
  );
};

const PanelScene: React.FC<{ i: number }> = ({ i }) => {
  const frame = useCurrentFrame();
  const p = panels[i];
  return (
    <AbsoluteFill>
      <FloralBg base={p.base} drift={0.9} />
      <AbsoluteFill style={{ alignItems: "center", paddingTop: 360 }}>
        <Panel img={p.img} art={p.art} lines={p.lines} sky={p.sky} f={frame} />
      </AbsoluteFill>
      <ChamakFrame />
    </AbsoluteFill>
  );
};

const EndScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const a = spring({ frame: frame - 4, fps, config: { damping: 10, stiffness: 170 } });
  const b = spring({ frame: frame - 18, fps, config: { damping: 12, stiffness: 150 } });
  const c = spring({ frame: frame - 34, fps, config: { damping: 12, stiffness: 150 } });
  const beat = 1 + Math.max(0, Math.sin(frame / 4.3)) * 0.06;
  return (
    <AbsoluteFill>
      <FloralBg base={TA.ink} drift={0.4} />
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", gap: 40 }}>
        <div style={{ transform: `scale(${a}) rotate(${(1 - a) * -10}deg)` }}>
          <TruckText size={104} fill={TA.yellow}>{"Dekh Magar\nPyar Se"}</TruckText>
        </div>
        <svg width={170} height={150} viewBox="0 0 100 90" style={{ transform: `scale(${b * beat})` }}>
          <path d="M50 85 C20 62 2 45 2 25 C2 10 14 2 26 2 C36 2 45 8 50 18 C55 8 64 2 74 2 C86 2 98 10 98 25 C98 45 80 62 50 85 Z" fill={TA.red} stroke={TA.yellow} strokeWidth={6} />
        </svg>
        <div style={{ transform: `scale(${c})`, background: TA.yellow, border: `10px solid ${TA.ink}`, borderRadius: 36, padding: "26px 40px", boxShadow: `0 0 0 10px ${TA.red}` }}>
          <div style={{ fontFamily: "Sora", fontWeight: 800, fontSize: 30, letterSpacing: "0.22em", color: TA.ink, textAlign: "center" }}>ORDER KARO</div>
          <div style={{ fontFamily: "Sora", fontWeight: 800, fontSize: 78, color: TA.red, letterSpacing: "-0.02em", WebkitTextStroke: `2px ${TA.ink}` }}>zidane.com.pk</div>
        </div>
      </AbsoluteFill>
      <ChamakFrame />
    </AbsoluteFill>
  );
};

export const TruckArtReel: React.FC = () => {
  const { durationInFrames } = useVideoConfig();
  return (
    <AbsoluteFill style={{ background: TA.ink }}>
      <Sequence durationInFrames={sec(T.title)}><Title /></Sequence>
      <Sequence from={sec(at.truck)} durationInFrames={sec(T.truck)}><TruckScene /></Sequence>
      {panels.map((_, i) => (
        <Sequence key={i} from={sec(at.panels + i * T.panel)} durationInFrames={sec(T.panel)}><PanelScene i={i} /></Sequence>
      ))}
      <Sequence from={sec(at.end)} durationInFrames={sec(T.end)}><EndScene /></Sequence>

      <Audio src={staticFile("sfx/truck-dhol.wav")} endAt={durationInFrames}
        volume={(f) => interpolate(f, [0, 8, durationInFrames - 20, durationInFrames], [0, 0.85, 0.85, 0], clamp)} />
      <Sequence from={8} durationInFrames={45}><Audio src={staticFile("sfx/bass.wav")} volume={0.7} /></Sequence>
      <Sequence from={sec(at.truck) + 30} durationInFrames={30}><Audio src={staticFile("sfx/truck-horn.wav")} volume={0.75} /></Sequence>
      <Sequence from={sec(at.truck) + 4} durationInFrames={50}><Audio src={staticFile("sfx/truck-bells.wav")} volume={0.5} /></Sequence>
      {panels.map((_, i) => (
        <Sequence key={i} from={sec(at.panels + i * T.panel)} durationInFrames={50}><Audio src={staticFile("sfx/truck-bells.wav")} volume={0.35} /></Sequence>
      ))}
      <Sequence from={sec(at.end) + 2} durationInFrames={30}><Audio src={staticFile("sfx/truck-horn.wav")} volume={0.6} /></Sequence>
    </AbsoluteFill>
  );
};
