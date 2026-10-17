// "Crazy Zidane": ~40s fast pop-art animated reel with an English voiceover and word-by-word captions.
// Scene i plays VO line i; scene length = VO duration + PAD (keep PAD in sync with scripts/gen-crazy-audio.py).
import React from "react";
import { AbsoluteFill, Audio, Composition, Img, interpolate, random, Sequence, spring, staticFile, useCurrentFrame } from "remotion";
import "../Fonts";
import { corp } from "../corporate/kit";
import vo from "../../public/vo/crazy-vo.json";
import products from "../../public/catalog/products.json";

const FPS = 30;
const PAD = [10, 10, 36, 10, 10, 10, 10, 60];
const LENS = vo.lines.map((l, i) => Math.round(l.dur * FPS) + PAD[i]);
const STARTS = LENS.reduce<number[]>((a, _, i) => [...a, i === 0 ? 0 : a[i - 1] + LENS[i - 1]], []);
const TOTAL = STARTS[7] + LENS[7];
const BEAT = (60 / 140) * FPS;
const clamp = corp.clamp;
const ease = corp.out;
const P = { yellow: "#FFD23F", red: "#E63946", teal: "#2EC4B6", purple: "#7B2CBF", ink: "#14110F", cream: "#FFF8E7", green: "#25D366" };
const OUT = `8px solid ${P.ink}`;

const pop = (frame: number, at = 0, k = { damping: 9, stiffness: 200, mass: 0.6 }) => spring({ frame: frame - at, fps: FPS, config: k });
const punch = (frame: number) => Math.exp(-((frame / BEAT) % 1) * 6);

// halftone dots + bold flat colour
const Bg: React.FC<{ color: string; dot?: string }> = ({ color, dot = "rgba(0,0,0,0.12)" }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: color }}>
      <AbsoluteFill style={{ backgroundImage: `radial-gradient(${dot} 22%, transparent 24%)`, backgroundSize: "44px 44px", backgroundPosition: `${frame * 2}px ${frame * 2}px` }} />
    </AbsoluteFill>
  );
};

const Burst: React.FC<{ color: string; size: number; x: number; y: number; spin?: number }> = ({ color, size, x, y, spin = 0 }) => {
  const pts = Array.from({ length: 24 }).map((_, i) => {
    const r = i % 2 ? size * 0.36 : size * 0.5;
    const a = (i / 24) * Math.PI * 2;
    return `${size / 2 + Math.cos(a) * r},${size / 2 + Math.sin(a) * r}`;
  }).join(" ");
  return <svg width={size} height={size} style={{ position: "absolute", left: x - size / 2, top: y - size / 2, transform: `rotate(${spin}deg)` }}><polygon points={pts} fill={color} stroke={P.ink} strokeWidth={8} /></svg>;
};

// word-by-word captions, timed by word length across the line
const KEY = /zidane|hundred|one|whatsapp|quote|ration|ramadan|stop|karachi|fifty|ten|schedule|business/i;
const Captions: React.FC<{ text: string; dur: number; y?: number }> = ({ text, dur, y = 1420 }) => {
  const frame = useCurrentFrame();
  const words = text.split(" ");
  const weights = words.map((w) => w.length + 2);
  const total = weights.reduce((a, b) => a + b, 0);
  const at = weights.reduce<number[]>((a, w, i) => [...a, i === 0 ? 0 : a[i - 1] + weights[i - 1]], []).map((v) => (v / total) * dur * FPS * 0.96);
  let cur = 0;
  at.forEach((t, i) => { if (frame >= t) cur = i; });
  const group = Math.floor(cur / 3) * 3;
  const shown = words.slice(group, Math.min(words.length, group + 3));
  return (
    <div style={{ position: "absolute", left: 40, right: 40, top: y, display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "0 22px" }}>
      {shown.map((w, k) => {
        const i = group + k;
        if (frame < at[i]) return null;
        const s = pop(frame, at[i]);
        const hot = KEY.test(w);
        return <span key={i} style={{ display: "inline-block", transform: `scale(${interpolate(s, [0, 1], [0.3, 1])}) rotate(${(k - 1) * 2}deg)`, fontFamily: "Passion One", fontSize: 128, lineHeight: 1,
          color: hot ? P.yellow : "#fff", WebkitTextStroke: `14px ${P.ink}`, paintOrder: "stroke fill", textTransform: "uppercase", textShadow: `0 10px 0 ${P.ink}` }}>{w}</span>;
      })}
    </div>
  );
};

// ---------- S0: factory + 500 workers
const Factory: React.FC = () => {
  const frame = useCurrentFrame();
  const f = pop(frame, 0);
  const count = Math.round(interpolate(frame, [40, 95], [0, 500], { easing: ease, ...clamp }));
  return (
    <AbsoluteFill>
      <Bg color={P.yellow} />
      <div style={{ position: "absolute", left: 140, top: 260, transform: `scale(${f})`, transformOrigin: "bottom center" }}>
        <svg width="800" height="520" viewBox="0 0 800 520">
          <g stroke={P.ink} strokeWidth={10} strokeLinejoin="round">
            <path d="M20 500 V260 L200 160 V260 L380 160 V260 L560 160 V500 Z" fill={P.teal} />
            <rect x={560} y={60} width={90} height={440} fill={P.red} />
            <rect x={650} y={250} width={130} height={250} fill={P.cream} />
            {[80, 220, 360].map((x) => <rect key={x} x={x} y={330} width={90} height={90} fill={P.yellow} />)}
          </g>
        </svg>
        {[0, 1, 2].map((i) => {
          const t = ((frame + i * 20) % 60) / 60;
          return <div key={i} style={{ position: "absolute", left: 590 + t * 40, top: 20 - t * 200, width: 90 + t * 80, height: 90 + t * 80, borderRadius: "50%", background: "#fff", border: OUT, opacity: 1 - t }} />;
        })}
      </div>
      <div style={{ position: "absolute", left: 90, right: 90, top: 820, display: "flex", flexWrap: "wrap", gap: 8 }}>
        {Array.from({ length: 60 }).map((_, i) => {
          const p = pop(frame, 30 + i * 0.9);
          return <div key={i} style={{ width: 80, height: 80, borderRadius: 40, background: [P.red, P.teal, P.purple, P.cream][i % 4], border: `5px solid ${P.ink}`, transform: `scale(${p})` }} />;
        })}
      </div>
      {frame > 40 && <div style={{ position: "absolute", right: 60, top: 680, transform: `rotate(-8deg) scale(${pop(frame, 40)})`, background: P.red, color: "#fff", border: OUT, borderRadius: 20,
        padding: "6px 30px", fontFamily: "Passion One", fontSize: 110 }}>{count}</div>}
    </AbsoluteFill>
  );
};

// ---------- S1: supplier chaos: ringing phones, flipping prices, stressed face
const Chaos: React.FC = () => {
  const frame = useCurrentFrame();
  const shake = (random(`c${frame}`) - 0.5) * 22;
  return (
    <AbsoluteFill style={{ transform: `translate(${shake}px, ${-shake * 0.6}px)` }}>
      <Bg color={P.red} dot="rgba(0,0,0,0.18)" />
      {Array.from({ length: 6 }).map((_, i) => {
        const p = pop(frame, i * 8);
        const wob = Math.sin(frame / 1.5 + i) * 10;
        return (
          <div key={i} style={{ position: "absolute", left: [60, 720, 90, 760, 380, 420][i], top: [140, 180, 620, 640, 80, 940][i], transform: `scale(${p}) rotate(${wob + (i % 2 ? 12 : -12)}deg)` }}>
            <div style={{ width: 190, height: 320, background: P.ink, borderRadius: 34, border: `8px solid ${P.ink}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ width: 160, height: 250, background: frame % 8 < 4 ? P.yellow : "#fff", borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: "Passion One", fontSize: 54, color: P.ink }}>RING!</div>
            </div>
          </div>
        );
      })}
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={`p${i}`} style={{ position: "absolute", left: 60 + i * 200, top: 1160 + (i % 2) * 70, transform: `rotate(${(i % 2 ? 8 : -8)}deg) scale(${pop(frame, 20 + i * 6)})`, background: P.cream, border: OUT, borderRadius: 14,
          padding: "4px 16px", fontFamily: "Sora", fontWeight: 800, fontSize: 40, color: random(`d${i}${Math.floor(frame / 4)}`) > 0.5 ? P.red : "#1A7F37" }}>
          Rs {Math.round(100 + random(`v${i}${Math.floor(frame / 4)}`) * 300)} {random(`d${i}${Math.floor(frame / 4)}`) > 0.5 ? "▲" : "▼"}
        </div>
      ))}
      {/* stressed face */}
      <div style={{ position: "absolute", left: 340, top: 480, width: 400, height: 400, transform: `scale(${pop(frame, 4)}) rotate(${Math.sin(frame / 2) * 6}deg)` }}>
        <svg viewBox="0 0 200 200" width="400" height="400">
          <circle cx={100} cy={100} r={90} fill={P.yellow} stroke={P.ink} strokeWidth={8} />
          {[70, 130].map((cx) => <g key={cx} transform={`rotate(${frame * 25} ${cx} 85)`}><path d={`M${cx - 14} 85 a14 14 0 1 1 28 0 a10 10 0 1 1 -20 0 a6 6 0 1 1 12 0`} fill="none" stroke={P.ink} strokeWidth={5} /></g>)}
          <path d="M60 145 Q75 130 90 145 T120 145 T150 140" fill="none" stroke={P.ink} strokeWidth={7} strokeLinecap="round" />
          <path d="M165 50 Q175 70 165 80 Q155 70 165 50 Z" fill="#5BC0EB" stroke={P.ink} strokeWidth={3} transform={`translate(0 ${(frame * 3) % 40})`} />
        </svg>
      </div>
    </AbsoluteFill>
  );
};

// ---------- S2: STOP. -> Meet Zidane (red circle wipe + logo)
const Stop: React.FC = () => {
  const frame = useCurrentFrame();
  const wipe = interpolate(frame, [18, 34], [0, 1], { easing: ease, ...clamp });
  const logo = pop(frame, 26);
  return (
    <AbsoluteFill style={{ background: P.ink }}>
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <div style={{ fontFamily: "Passion One", fontSize: 360, color: "#fff", transform: `scale(${interpolate(pop(frame, 0), [0, 1], [3, 1])})` }}>STOP.</div>
      </AbsoluteFill>
      <div style={{ position: "absolute", left: 540 - 1400 * wipe, top: 960 - 1400 * wipe, width: 2800 * wipe, height: 2800 * wipe, borderRadius: "50%", background: P.red }} />
      {frame > 24 && <Burst color={P.yellow} size={900} x={540} y={900} spin={frame * 2} />}
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", paddingBottom: 120 }}>
        {frame > 24 && <div style={{ background: P.red, border: OUT, borderRadius: 40, padding: "40px 50px", transform: `scale(${logo}) rotate(-4deg)` }}>
          <Img src={staticFile("brand/zidane-logo-white.svg")} style={{ width: 600, display: "block" }} />
        </div>}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ---------- S3: product bounce wall + 100+
const Products: React.FC = () => {
  const frame = useCurrentFrame();
  const pick = products.filter((_, i) => i % 4 === 0).slice(0, 20);
  const count = Math.round(interpolate(frame, [60, 120], [0, 100], { easing: ease, ...clamp }));
  return (
    <AbsoluteFill style={{ transform: `scale(${1 + punch(frame) * 0.02})` }}>
      <Bg color={P.teal} />
      <div style={{ position: "absolute", left: 50, right: 50, top: 130, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 18 }}>
        {pick.map((p, i) => {
          const s = pop(frame, i * 3);
          return (
            <div key={p.id} style={{ height: 210, background: P.cream, border: `6px solid ${P.ink}`, borderRadius: 24, display: "flex", alignItems: "center", justifyContent: "center",
              transform: `scale(${s}) rotate(${Math.sin(frame / 5 + i) * 4}deg) translateY(${-punch(frame + i * 3) * 10}px)`, boxShadow: `0 8px 0 ${P.ink}` }}>
              <Img src={staticFile(p.img)} style={{ maxHeight: 170, maxWidth: 170, objectFit: "contain" }} />
            </div>
          );
        })}
      </div>
      {frame > 60 && <>
        <Burst color={P.yellow} size={560} x={540} y={760} spin={frame} />
        <div style={{ position: "absolute", left: 0, right: 0, top: 620, textAlign: "center", fontFamily: "Passion One", fontSize: 230, color: P.red, WebkitTextStroke: `10px ${P.ink}`, paintOrder: "stroke fill",
          transform: `scale(${pop(frame, 60)})` }}>{count}+</div>
      </>}
    </AbsoluteFill>
  );
};

// ---------- S4: any list format gets sucked into the Zidane machine
const Formats: React.FC = () => {
  const frame = useCurrentFrame();
  const icons = [
    { label: "XLS", bg: "#1D6F42", at: 30 }, { label: "PDF", bg: "#D93025", at: 60 }, { label: "💬", bg: P.green, at: 95 }, { label: "📝", bg: P.cream, at: 130 },
  ];
  const machine = pop(frame, 0);
  return (
    <AbsoluteFill>
      <Bg color={P.purple} dot="rgba(255,255,255,0.08)" />
      {icons.map((ic, i) => {
        const fly = interpolate(frame, [ic.at, ic.at + 22], [0, 1], { easing: corp.in, ...clamp });
        const sx = [120, 960, 120, 960][i]; const sy = [260, 260, 640, 640][i];
        const x = interpolate(fly, [0, 1], [sx, 540]); const y = interpolate(fly, [0, 1], [sy, 900]);
        const appear = pop(frame, ic.at - 22);
        return (
          <div key={i} style={{ position: "absolute", left: x - 110, top: y - 130, width: 220, height: 260, borderRadius: 24, background: ic.bg, border: OUT, display: "flex", alignItems: "center", justifyContent: "center",
            transform: `scale(${appear * (1 - fly * 0.8)}) rotate(${fly * 360}deg)`, opacity: fly > 0.98 ? 0 : 1, fontFamily: "Passion One", fontSize: 100, color: "#fff" }}>{ic.label}</div>
        );
      })}
      {/* machine */}
      <div style={{ position: "absolute", left: 240, top: 860, width: 600, height: 420, transform: `scale(${machine}) translateY(${Math.sin(frame / 2) * 4}px)` }}>
        <div style={{ position: "absolute", left: 180, top: 0, width: 240, height: 90, background: P.ink, clipPath: "polygon(0 0, 100% 0, 75% 100%, 25% 100%)" }} />
        <div style={{ position: "absolute", left: 0, top: 80, width: 600, height: 340, background: P.red, border: OUT, borderRadius: 30, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Img src={staticFile("brand/zidane-logo-white.svg")} style={{ width: 380 }} />
        </div>
        {[60, 540].map((gx) => <div key={gx} style={{ position: "absolute", left: gx - 45, top: 340, width: 90, height: 90, borderRadius: 45, border: `14px dashed ${P.yellow}`, transform: `rotate(${frame * 8}deg)` }} />)}
      </div>
    </AbsoluteFill>
  );
};

// ---------- S5: quote prints, truck zooms
const Deliver: React.FC = () => {
  const frame = useCurrentFrame();
  const paper = interpolate(frame, [0, 20], [0, 1], { easing: ease, ...clamp });
  const truckX = interpolate(frame, [30, 80], [-700, 1200], { easing: corp.inOut, ...clamp });
  return (
    <AbsoluteFill>
      <Bg color={P.yellow} />
      <div style={{ position: "absolute", left: 220, top: 200 + (1 - paper) * 300, width: 640, height: 560, background: "#fff", border: OUT, borderRadius: 20, padding: 40, transform: `rotate(-3deg) scale(${0.6 + paper * 0.4})`, boxShadow: `14px 14px 0 ${P.ink}` }}>
        <div style={{ fontFamily: "Passion One", fontSize: 90, color: P.ink }}>QUOTE</div>
        {[0, 1, 2, 3].map((i) => <div key={i} style={{ marginTop: 20, height: 26, width: `${90 - i * 12}%`, background: "#DDD", borderRadius: 13 }} />)}
        <div style={{ position: "absolute", right: 30, bottom: 30, width: 150, height: 150, borderRadius: 75, background: P.green, border: OUT, display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 100, color: "#fff", transform: `scale(${pop(frame, 14)})` }}>✓</div>
      </div>
      {/* road + truck */}
      <div style={{ position: "absolute", left: 0, right: 0, top: 1060, height: 220, background: P.ink }} />
      {Array.from({ length: 6 }).map((_, i) => <div key={i} style={{ position: "absolute", top: 1160, left: ((i * 220 - frame * 30) % 1320 + 1320) % 1320 - 220, width: 120, height: 16, background: P.yellow }} />)}
      <div style={{ position: "absolute", left: truckX, top: 820, width: 620, height: 320 }}>
        {Array.from({ length: 5 }).map((_, i) => <div key={i} style={{ position: "absolute", left: -260 - (i % 2) * 60, top: 60 + i * 40, width: 220, height: 12, borderRadius: 6, background: P.ink, opacity: 0.6 }} />)}
        <div style={{ position: "absolute", left: 0, top: 0, width: 420, height: 240, background: P.cream, border: OUT, borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Img src={staticFile("brand/zidane-logo.svg")} style={{ width: 300 }} />
        </div>
        <div style={{ position: "absolute", left: 412, top: 70, width: 180, height: 170, background: P.red, border: OUT, borderRadius: "12px 50px 12px 12px" }} />
        {[70, 300, 480].map((wx) => <div key={wx} style={{ position: "absolute", left: wx, top: 210, width: 100, height: 100, borderRadius: 50, background: P.ink, border: `14px solid #999` }} />)}
      </div>
      {frame > 70 && <div style={{ position: "absolute", left: 240, top: 1340, transform: `rotate(-6deg) scale(${pop(frame, 70)})`, border: `10px solid ${P.red}`, color: P.red, borderRadius: 20, padding: "6px 40px",
        fontFamily: "Passion One", fontSize: 120, background: "rgba(255,255,255,0.7)" }}>ON TIME!</div>}
    </AbsoluteFill>
  );
};

// ---------- S6: ration bags multiply with stamps
const Bags: React.FC = () => {
  const frame = useCurrentFrame();
  const stamps = [["TEAM", 20], ["NGO", 50], ["RAMADAN", 80]] as const;
  return (
    <AbsoluteFill style={{ transform: `scale(${1 + punch(frame) * 0.02})` }}>
      <Bg color={P.red} dot="rgba(0,0,0,0.15)" />
      <div style={{ position: "absolute", left: 40, right: 40, top: 160, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
        {Array.from({ length: 9 }).map((_, i) => {
          const at = i === 0 ? 0 : i < 3 ? 12 : 24 + i * 2;
          return <Img key={i} src={staticFile("ramadan/bag-cutout.png")} style={{ width: "100%", transform: `scale(${pop(frame, at)}) rotate(${Math.sin(frame / 6 + i) * 3}deg)`, filter: `drop-shadow(8px 8px 0 ${P.ink})` }} />;
        })}
      </div>
      {stamps.map(([t, at], i) => frame > at && (
        <div key={t} style={{ position: "absolute", left: [80, 560, 220][i], top: [900, 960, 1130][i], transform: `rotate(${[-10, 8, -4][i]}deg) scale(${interpolate(pop(frame, at), [0, 1], [2.5, 1])})`,
          background: P.yellow, border: OUT, borderRadius: 18, padding: "4px 30px", fontFamily: "Passion One", fontSize: 110, color: P.ink }}>{t}</div>
      ))}
    </AbsoluteFill>
  );
};

// ---------- S7: end card
const End: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill>
      <Bg color={P.ink} dot="rgba(255,255,255,0.06)" />
      <Burst color={P.red} size={1300} x={540} y={700} spin={frame * 0.8} />
      <AbsoluteFill style={{ alignItems: "center", paddingTop: 420 }}>
        <Img src={staticFile("brand/zidane-logo-white.svg")} style={{ width: 760, transform: `scale(${pop(frame, 0)})` }} />
        <div style={{ marginTop: 40, padding: "0 60px", textAlign: "center", lineHeight: 0.95, fontFamily: "Passion One", fontSize: 130, color: P.yellow, WebkitTextStroke: `10px ${P.ink}`, paintOrder: "stroke fill", transform: `scale(${pop(frame, 12)})` }}>GROCERIES FOR<br />BUSINESS</div>
      </AbsoluteFill>
      <div style={{ position: "absolute", left: 80, right: 80, top: 1180, display: "flex", flexDirection: "column", gap: 22 }}>
        {[["🌐", "zidane.com.pk", P.yellow], ["💬", "0339 2639315", P.green], ["📞", "021 111 ZIDANE", P.cream]].map(([ic, t, col], i) => (
          <div key={t} style={{ transform: `translateX(${(1 - pop(frame, 24 + i * 8)) * 900}px)`, background: col, border: OUT, borderRadius: 26, padding: "18px 36px", display: "flex", alignItems: "center", gap: 24,
            fontFamily: "Sora", fontWeight: 800, fontSize: 62, color: P.ink, boxShadow: `0 10px 0 ${P.red}` }}><span>{ic}</span>{t}</div>
        ))}
      </div>
    </AbsoluteFill>
  );
};

const SCENES: React.FC[] = [Factory, Chaos, Stop, Products, Formats, Deliver, Bags, End];

const Flash: React.FC = () => {
  const frame = useCurrentFrame();
  return <AbsoluteFill style={{ background: "#fff", opacity: interpolate(frame, [0, 5], [0.85, 0], clamp) }} />;
};

export const CrazyZidane: React.FC = () => (
  <AbsoluteFill style={{ background: P.ink }}>
    {SCENES.map((S, i) => (
      <Sequence key={i} from={STARTS[i]} durationInFrames={LENS[i]}>
        <S />
        {i !== 2 && i !== 7 && <Captions text={vo.lines[i].text} dur={vo.lines[i].dur} />}
        {i > 0 && <Flash />}
      </Sequence>
    ))}
    {vo.lines.map((l, i) => (
      <Sequence key={`vo${i}`} from={STARTS[i] + 2} durationInFrames={Math.ceil(l.dur * FPS) + 4}>
        <Audio src={staticFile(`vo/crazy-${i}.wav`)} />
      </Sequence>
    ))}
    <Audio src={staticFile("sfx/crazy-bed.wav")} volume={0.38} />
    {STARTS.slice(1).map((s) => <Sequence key={s} from={s - 6} durationInFrames={20}><Audio src={staticFile("sfx/whoosh.wav")} volume={0.3} /></Sequence>)}
  </AbsoluteFill>
);

export const CrazyZidaneCompositions: React.FC = () => (
  <Composition id="CrazyZidane" component={CrazyZidane} durationInFrames={TOTAL} fps={FPS} width={1080} height={1920} />
);
