// "Karachi Vice VI": next-gen open-world trailer homage — sunset cold open, in-game social feed clips,
// freeze-frame character intros, tagline slams, gradient badge logo. No game logos or names.
import React from "react";
import { AbsoluteFill, Audio, Composition, Img, interpolate, random, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import "../Fonts";
import { Canteen, Sunset } from "./KarachiVice";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const C = { pink: "#FF5FA2", peach: "#FF9A5A", gold: "#FFC86B", purple: "#7B4DFF", blue: "#3A3FD9", teal: "#22D3C5", night: "#0B0614" };
const VI_GRAD = `linear-gradient(160deg, ${C.gold} 0%, ${C.peach} 28%, ${C.pink} 55%, ${C.purple} 85%, ${C.blue} 100%)`;

// film grain + subtle vignette
const Grain: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <svg width="100%" height="100%" style={{ position: "absolute", opacity: 0.12, mixBlendMode: "overlay" }}>
        <filter id={`g${frame % 4}`}><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={2} seed={frame % 4} /></filter>
        <rect width="100%" height="100%" filter={`url(#g${frame % 4})`} />
      </svg>
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,0.45) 100%)" }} />
    </AbsoluteFill>
  );
};

const Letterbox: React.FC<{ h?: number }> = ({ h = 300 }) => (
  <>
    <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: h, background: "#000" }} />
    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: h, background: "#000" }} />
  </>
);

// hand-held camera wobble
const useShake = (amt = 1) => {
  const f = useCurrentFrame();
  return `translate(${Math.sin(f / 7) * 6 * amt + Math.sin(f / 2.3) * 1.5 * amt}px, ${Math.cos(f / 9) * 5 * amt}px) rotate(${Math.sin(f / 11) * 0.6 * amt}deg)`;
};

// ── 1. Cold open ──
const ColdOpen: React.FC = () => {
  const frame = useCurrentFrame();
  const fade = interpolate(frame, [0, 22], [0, 1], clamp);
  const t1 = interpolate(frame, [12, 24], [0, 1], clamp);
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <AbsoluteFill style={{ opacity: fade, transform: `scale(${1.25 - frame * 0.002}) translateY(${-frame * 0.6}px)` }}><Sunset /></AbsoluteFill>
      {/* gulls */}
      {[0, 1, 2, 3].map((i) => {
        const x = 200 + i * 110 + frame * (2 + i * 0.4), y = 640 + i * 40 + Math.sin(frame / 6 + i) * 8, w = Math.sin(frame / 3 + i * 2) * 10;
        return <svg key={i} width={60} height={30} style={{ position: "absolute", left: x, top: y }}><path d={`M0 ${14 - w * 0.4} Q15 ${4 + w} 30 14 Q45 ${4 + w} 60 ${14 - w * 0.4}`} stroke="#1B0A2E" strokeWidth={4} fill="none" /></svg>;
      })}
      <Letterbox h={interpolate(frame, [0, 20], [600, 300], clamp)} />
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 360, textAlign: "center", opacity: t1, fontFamily: "Inter", fontWeight: 600, fontSize: 40, letterSpacing: "0.5em", color: "#fff", textShadow: "0 2px 12px rgba(0,0,0,0.6)" }}>
        KARACHI
      </div>
      <Grain />
    </AbsoluteFill>
  );
};

// ── 2. In-game social feed clips ──
const FeedUI: React.FC<{ user: string; caption: string; likes: string; idx: number }> = ({ user, caption, likes, idx }) => {
  const frame = useCurrentFrame();
  const prog = interpolate(frame, [0, 60], [0, 1], clamp);
  const heart = spring({ frame: frame - 28, fps: 30, config: { damping: 9 } });
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.45), transparent 16%, transparent 62%, rgba(0,0,0,0.75))" }} />
      {/* story progress segments */}
      <div style={{ position: "absolute", left: 30, right: 30, top: 60, display: "flex", gap: 8 }}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ flex: 1, height: 6, borderRadius: 3, background: "rgba(255,255,255,0.35)", overflow: "hidden" }}>
            <div style={{ width: `${i < idx ? 100 : i === idx ? prog * 100 : 0}%`, height: "100%", background: "#fff" }} />
          </div>
        ))}
      </div>
      {/* right rail */}
      <div style={{ position: "absolute", right: 34, bottom: 420, display: "flex", flexDirection: "column", alignItems: "center", gap: 34, fontFamily: "Inter", fontWeight: 600, fontSize: 28, color: "#fff", textShadow: "0 2px 6px #000" }}>
        <div style={{ textAlign: "center" }}><div style={{ fontSize: 66, color: heart > 0.5 ? C.pink : "#fff", transform: `scale(${1 + Math.max(0, heart - 0.8) * 0.8})` }}>♥</div>{likes}</div>
        <div style={{ textAlign: "center" }}><div style={{ fontSize: 56 }}>💬</div>2,4k</div>
        <div style={{ textAlign: "center" }}><div style={{ fontSize: 56 }}>↗</div>Share</div>
      </div>
      {/* user + caption */}
      <div style={{ position: "absolute", left: 40, right: 170, bottom: 260 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ width: 76, height: 76, borderRadius: 38, background: VI_GRAD, border: "4px solid #fff" }} />
          <div style={{ fontFamily: "Inter", fontWeight: 600, fontSize: 36, color: "#fff", textShadow: "0 2px 6px #000" }}>{user}</div>
        </div>
        <div style={{ marginTop: 18, fontFamily: "Inter", fontWeight: 500, fontSize: 40, lineHeight: 1.3, color: "#fff", textShadow: "0 2px 8px #000" }}>{caption}</div>
      </div>
    </AbsoluteFill>
  );
};

const ClipCanteen: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <AbsoluteFill style={{ transform: `${useShake(1.4)} scale(${1.04 + frame * 0.002}) translateY(60px)`, filter: "saturate(1.15) contrast(1.05)" }}><Canteen full /></AbsoluteFill>
      <FeedUI idx={0} user="@canteen_uncle_khi" caption="bhai ne poori canteen ek order mein restock kar di 😭🔥" likes="48,2k" />
    </AbsoluteFill>
  );
};

const ClipDashcam: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: "#000", overflow: "hidden" }}>
      <AbsoluteFill style={{ transform: useShake(0.8) }}>
        <AbsoluteFill style={{ transform: "scale(1.1) translateY(-120px)" }}><Sunset /></AbsoluteFill>
        {/* road */}
        <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
          <path d="M540 1140 L-400 1920 L1480 1920 Z" fill="#241830" />
          {Array.from({ length: 8 }).map((_, i) => {
            const z = ((i / 8 + frame * 0.02) % 1);
            const y = 1140 + Math.pow(z, 2.2) * 780, w = 4 + z * 30, h = 10 + z * 120;
            return <rect key={i} x={540 - w / 2} y={y} width={w} height={h} fill={C.gold} opacity={0.9} />;
          })}
        </svg>
        {/* truck from behind */}
        <div style={{ position: "absolute", left: 540 - 230 + Math.sin(frame / 14) * 10, top: 1060 + Math.sin(frame / 3) * 2, width: 460, height: 420 }}>
          <div style={{ position: "absolute", inset: "0 0 70px 0", background: "linear-gradient(180deg, #F5F2EC, #D9D3C8)", borderRadius: 10, border: "6px solid #1B0A2E", display: "grid", placeItems: "center" }}>
            <div style={{ fontFamily: "Sora", fontWeight: 800, fontSize: 78, color: "#D7262E", letterSpacing: "-0.02em" }}>ZIDANE</div>
          </div>
          <div style={{ position: "absolute", left: 20, right: 20, bottom: 30, height: 50, background: "#1B0A2E", borderRadius: 6 }} />
          <div style={{ position: "absolute", left: 34, bottom: 44, width: 60, height: 22, background: "#FF3B3B", borderRadius: 4, boxShadow: "0 0 30px #FF3B3B" }} />
          <div style={{ position: "absolute", right: 34, bottom: 44, width: 60, height: 22, background: "#FF3B3B", borderRadius: 4, boxShadow: "0 0 30px #FF3B3B" }} />
          <div style={{ position: "absolute", left: 50, bottom: 0, width: 90, height: 40, background: "#000", borderRadius: 8 }} />
          <div style={{ position: "absolute", right: 50, bottom: 0, width: 90, height: 40, background: "#000", borderRadius: 8 }} />
        </div>
      </AbsoluteFill>
      <div style={{ position: "absolute", left: 40, top: 110, fontFamily: "Inter", fontWeight: 600, fontSize: 34, color: "#fff", textShadow: "0 2px 4px #000" }}>
        <span style={{ color: "#FF3B3B", opacity: Math.floor(frame / 10) % 2 ? 1 : 0.2 }}>●</span> REC&nbsp;&nbsp;08:42 AM
      </div>
      <FeedUI idx={1} user="@shahrae_faisal_cams" caption="zidane ka truck phir se on time 🚚 kaise bhai" likes="31,7k" />
    </AbsoluteFill>
  );
};

const order = [["Dalda Cooking Oil 5L", "× 40"], ["Tapal Danedar 950g", "× 60"], ["Sunridge Chakki Atta 10kg", "× 25"], ["Shan Biryani Masala", "× 120"], ["Olper's Milk 1L", "× 200"]];
const ClipQuote: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: `linear-gradient(170deg, #2A1B3D, #120A1E)` }}>
      <AbsoluteFill style={{ transform: `${useShake(1)} rotate(-4deg)`, alignItems: "center", paddingTop: 300 }}>
        <div style={{ width: 760, background: "#FBF8F2", borderRadius: 16, padding: "48px 50px", boxShadow: "0 30px 80px rgba(0,0,0,0.6)", fontFamily: "Inter" }}>
          <div style={{ fontFamily: "Sora", fontWeight: 800, fontSize: 52, color: "#1B0A2E" }}>QUOTATION</div>
          <div style={{ fontWeight: 500, fontSize: 28, color: "#7A6F80", marginTop: 4 }}>Zidane Wholesale Solutions · Karachi</div>
          <div style={{ height: 3, background: "#1B0A2E", margin: "26px 0" }} />
          {order.map(([n, q], i) => {
            const o = interpolate(frame, [6 + i * 5, 12 + i * 5], [0, 1], clamp);
            return (
              <div key={n} style={{ opacity: o, display: "flex", justifyContent: "space-between", fontSize: 34, fontWeight: 600, color: "#1B0A2E", padding: "12px 0", borderBottom: "2px dashed #D6CFC4" }}>
                <span>{n}</span><span style={{ color: "#7A6F80" }}>{q}</span>
              </div>
            );
          })}
          <div style={{ marginTop: 30, display: "flex", justifyContent: "flex-end" }}>
            <div style={{ opacity: interpolate(frame, [34, 38], [0, 1], clamp), transform: `rotate(-10deg) scale(${interpolate(frame, [34, 38], [1.6, 1], clamp)})`, border: "6px solid #1E9E5A", color: "#1E9E5A", fontWeight: 800, fontSize: 40, padding: "6px 22px", borderRadius: 10, letterSpacing: "0.08em" }}>
              CLEAR RATES ✓
            </div>
          </div>
        </div>
      </AbsoluteFill>
      <FeedUI idx={2} user="@factory_admin_site" caption="quote aaya, rates clear, koi drama nahi 📋" likes="22,9k" />
    </AbsoluteFill>
  );
};

// ── 3. Freeze-frame character intros ──
const cast = [
  { id: "1148810", name: "THE OIL", sub: "Dalda · cooking oil", bg: `linear-gradient(170deg, ${C.peach}, ${C.pink})` },
  { id: "1145167", name: "THE CHAI", sub: "Tapal · Danedar", bg: `linear-gradient(170deg, ${C.teal}, ${C.blue})` },
  { id: "1119315", name: "THE MASALA", sub: "Shan · spices", bg: `linear-gradient(170deg, ${C.pink}, ${C.purple})` },
  { id: "1018326", name: "THE DOODH", sub: "Olper's · milk", bg: `linear-gradient(170deg, ${C.gold}, ${C.peach})` },
];
const Character: React.FC<{ i: number }> = ({ i }) => {
  const frame = useCurrentFrame();
  const c = cast[i];
  const frozen = frame >= 10;
  const move = interpolate(Math.min(frame, 10), [0, 10], [i % 2 ? -260 : 260, 0]);
  const flash = interpolate(frame, [10, 11, 16], [0, 0.7, 0], clamp);
  const name = interpolate(frame, [11, 16], [0, 1], clamp);
  return (
    <AbsoluteFill style={{ background: c.bg, overflow: "hidden" }}>
      <AbsoluteFill style={{ background: "repeating-linear-gradient(115deg, rgba(255,255,255,0.08) 0 30px, transparent 30px 90px)", transform: `translateX(${frozen ? 0 : frame * 8}px)` }} />
      <Img src={staticFile(`catalog/${c.id}.png`)} style={{ position: "absolute", left: "50%", top: 760, height: 900, maxWidth: 900, objectFit: "contain",
        transform: `translate(-50%, -50%) translateX(${move}px) rotate(${(i % 2 ? -1 : 1) * 6}deg) scale(${frozen ? 1.04 : 1})`,
        filter: `drop-shadow(0 40px 40px rgba(0,0,0,0.45)) ${frozen ? "saturate(1.25) contrast(1.1)" : "blur(6px)"}` }} />
      <AbsoluteFill style={{ background: "#fff", opacity: flash }} />
      <div style={{ position: "absolute", left: 70, right: 40, bottom: 400, opacity: name, transform: `translateX(${(1 - name) * -40}px)` }}>
        <div style={{ fontFamily: "Sora", fontWeight: 800, fontSize: 132, lineHeight: 0.95, letterSpacing: "-0.03em", color: "#fff", transform: "skewX(-8deg)", textShadow: "0 6px 30px rgba(0,0,0,0.35)" }}>{c.name}</div>
        <div style={{ marginTop: 14, fontFamily: "Inter", fontWeight: 600, fontSize: 40, color: "#fff", opacity: 0.9, letterSpacing: "0.04em" }}>{c.sub}</div>
      </div>
      <Letterbox h={210} />
      <Grain />
    </AbsoluteFill>
  );
};

// ── 4. Tagline slams ──
const tags = [
  { t: "BULK.", bg: C.night },
  { t: "CLEAR\nQUOTES.", bg: "sunset" },
  { t: "ON\nTIME.", bg: C.pink },
  { t: "EVERY\nTIME.", bg: C.night },
];
const Tagline: React.FC<{ i: number }> = ({ i }) => {
  const frame = useCurrentFrame();
  const s = interpolate(frame, [0, 5], [1.35, 1], clamp);
  const tag = tags[i];
  const dark = tag.bg !== C.pink;
  return (
    <AbsoluteFill style={{ background: tag.bg === "sunset" ? "#000" : tag.bg, justifyContent: "center", alignItems: "center" }}>
      {tag.bg === "sunset" && <AbsoluteFill style={{ filter: "brightness(0.55)" }}><Sunset /></AbsoluteFill>}
      <div style={{ transform: `scale(${s + frame * 0.003})`, fontFamily: "Sora", fontWeight: 800, fontSize: 210, lineHeight: 0.9, letterSpacing: "-0.04em", textAlign: "center", whiteSpace: "pre",
        ...(dark ? { background: VI_GRAD, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" } : { color: "#fff" }) }}>{tag.t}</div>
      <Grain />
    </AbsoluteFill>
  );
};

// ── 5. Badge logo ──
const Logo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 40 });
  const glow = interpolate(frame, [0, 40], [0, 1], clamp);
  const b = interpolate(frame, [36, 50], [0, 1], clamp);
  const sparkle = random(`s${Math.floor(frame / 3)}`);
  return (
    <AbsoluteFill style={{ background: C.night, alignItems: "center", justifyContent: "center" }}>
      <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 45%, rgba(255,95,162,${0.35 * glow}), transparent 55%)` }} />
      <div style={{ opacity: p, transform: `scale(${interpolate(p, [0, 1], [0.86, 1])})`, position: "relative", width: 600, height: 600 }}>
        <div style={{ position: "absolute", inset: 0, borderRadius: 120, padding: 14, background: VI_GRAD, WebkitMask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)", WebkitMaskComposite: "xor", maskComposite: "exclude" }} />
        <div style={{ position: "absolute", left: 58, top: 52, fontFamily: "Sora", fontWeight: 800, fontSize: 34, lineHeight: 1.05, color: "#fff", letterSpacing: "0.04em" }}>ZIDANE<br />WHOLESALE</div>
        <div style={{ position: "absolute", left: 0, right: 0, top: 120, textAlign: "center", fontFamily: "Sora", fontWeight: 800, fontSize: 470, lineHeight: 1, letterSpacing: "-0.06em",
          background: VI_GRAD, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent", filter: `drop-shadow(0 0 ${30 * glow}px rgba(255,95,162,0.5))` }}>Z</div>
        <div style={{ position: "absolute", left: 470 + sparkle * 30, top: 150 + sparkle * 20, width: 14, height: 14, background: "#fff", transform: "rotate(45deg)", opacity: glow * (0.4 + sparkle * 0.6), boxShadow: "0 0 20px #fff" }} />
      </div>
      <div style={{ marginTop: 70, opacity: b, fontFamily: "Inter", fontWeight: 600, fontSize: 40, letterSpacing: "0.35em", color: "#fff" }}>NOW DELIVERING</div>
      <div style={{ marginTop: 18, opacity: b, fontFamily: "Sora", fontWeight: 800, fontSize: 64, background: VI_GRAD, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>zidane.com.pk</div>
      <Grain />
    </AbsoluteFill>
  );
};

// timeline (frames, 30 fps; music bar = 60 frames)
const T = { feed: 60, cast: 240, tag: 420, logo: 540, end: 675 };
export const ViceSix: React.FC = () => (
  <AbsoluteFill style={{ background: "#000" }}>
    <Sequence durationInFrames={T.feed}><ColdOpen /></Sequence>
    <Sequence from={T.feed} durationInFrames={60}><ClipCanteen /></Sequence>
    <Sequence from={T.feed + 60} durationInFrames={60}><ClipDashcam /></Sequence>
    <Sequence from={T.feed + 120} durationInFrames={60}><ClipQuote /></Sequence>
    {cast.map((_, i) => <Sequence key={i} from={T.cast + i * 45} durationInFrames={45}><Character i={i} /></Sequence>)}
    {tags.map((_, i) => <Sequence key={i} from={T.tag + i * 30} durationInFrames={30}><Tagline i={i} /></Sequence>)}
    <Sequence from={T.logo} durationInFrames={T.end - T.logo}><Logo /></Sequence>
    <Audio src={staticFile("sfx/vi-rock.wav")} endAt={T.end} volume={(f) => interpolate(f, [0, 6, T.end - 20, T.end], [0, 1, 1, 0], clamp)} />
    {cast.map((_, i) => <Sequence key={i} from={T.cast + i * 45} durationInFrames={20}><Audio src={staticFile("sfx/whoosh.wav")} volume={0.3} /></Sequence>)}
    {cast.map((_, i) => <Sequence key={i} from={T.cast + i * 45 + 10} durationInFrames={20}><Audio src={staticFile("sfx/tick.wav")} volume={0.6} /></Sequence>)}
  </AbsoluteFill>
);

export const ViceSixCompositions: React.FC = () => (
  <Composition id="KarachiViceVI" component={ViceSix} durationInFrames={T.end} fps={30} width={1080} height={1920} />
);
