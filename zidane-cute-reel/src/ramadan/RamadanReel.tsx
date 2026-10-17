// Ramadan 2027 reel: calm, cozy, 50s. Night sky, crescent, swinging lanterns, mosque skyline and the
// four reference packages from zidane.com.pk/ration-packages with their real item lists.
// Music: scripts/gen-ramadan-audio.py (72 BPM -> exactly 25 frames per beat).
import React from "react";
import { AbsoluteFill, Audio, Composition, Img, interpolate, random, Sequence, staticFile, useCurrentFrame } from "remotion";
import "../Fonts";
import { corp } from "../corporate/kit";

const FPS = 30;
const B = 25; // frames per beat
const TOTAL = 60 * B; // 50s
const clamp = corp.clamp;
const ease = corp.out;
export const C = {
  night: "#071425",
  night2: "#0E2A40",
  gold: "#E8C170",
  goldSoft: "rgba(232,193,112,0.55)",
  cream: "#FBF3E4",
  red: "#C22A2F",
};

const fade = (frame: number, a: number, b: number) => interpolate(frame, [a, b], [0, 1], { easing: ease, ...clamp });

// ---------- shared backdrop pieces
export const Stars: React.FC<{ n?: number }> = ({ n = 90 }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill>
      {Array.from({ length: n }).map((_, i) => {
        const tw = 0.35 + 0.65 * Math.abs(Math.sin(frame / (18 + random(`t${i}`) * 30) + i));
        const s = 2 + random(`s${i}`) * 4;
        return <div key={i} style={{ position: "absolute", left: random(`x${i}`) * 1080, top: random(`y${i}`) * 1300, width: s, height: s, borderRadius: s,
          background: "#fff", opacity: tw * 0.8, boxShadow: `0 0 ${s * 3}px rgba(255,255,255,0.8)` }} />;
      })}
    </AbsoluteFill>
  );
};

// eight-point star tile, very faint
export const Pattern: React.FC<{ opacity?: number }> = ({ opacity = 0.06 }) => {
  const frame = useCurrentFrame();
  return (
    <svg width="100%" height="100%" style={{ position: "absolute", inset: 0, opacity }}>
      <defs>
        <pattern id="star8" width="180" height="180" patternUnits="userSpaceOnUse" patternTransform={`translate(0 ${-frame * 0.3})`}>
          <g fill="none" stroke={C.gold} strokeWidth="2">
            <rect x="50" y="50" width="80" height="80" />
            <rect x="50" y="50" width="80" height="80" transform="rotate(45 90 90)" />
            <circle cx="90" cy="90" r="18" />
            <path d="M0 90 H32 M148 90 H180 M90 0 V32 M90 148 V180" />
          </g>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#star8)" />
    </svg>
  );
};

export const Crescent: React.FC<{ size: number; x: number; y: number; glow?: number }> = ({ size, x, y, glow = 1 }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" style={{ position: "absolute", left: x, top: y, filter: `drop-shadow(0 0 ${30 * glow}px rgba(232,193,112,0.8))` }}>
    <defs><mask id={`cm${size}`}><rect width="100" height="100" fill="#fff" /><circle cx="64" cy="40" r="38" fill="#000" /></mask></defs>
    <circle cx="48" cy="52" r="42" fill={C.gold} mask={`url(#cm${size})`} />
  </svg>
);

// hanging fanoos lantern on a string, swinging
export const Lantern: React.FC<{ x: number; len: number; scale?: number; phase?: number; drop?: number }> = ({ x, len, scale = 1, phase = 0, drop = 1 }) => {
  const frame = useCurrentFrame();
  const swing = Math.sin(frame / 28 + phase) * 6;
  const flicker = 0.85 + 0.15 * Math.sin(frame / 3 + phase * 7);
  return (
    <div style={{ position: "absolute", left: x, top: -40 - (1 - drop) * (len + 300), transformOrigin: "top center", transform: `rotate(${swing}deg) scale(${scale})` }}>
      <div style={{ width: 3, height: len, background: C.goldSoft, margin: "0 auto" }} />
      <svg width="120" height="230" viewBox="0 0 120 230" style={{ display: "block", marginLeft: -59, filter: `drop-shadow(0 0 ${40 * flicker}px rgba(255,190,90,0.9))` }}>
        <path d="M60 0 L72 18 H48 Z" fill={C.gold} />
        <rect x="40" y="18" width="40" height="10" rx="3" fill={C.gold} />
        <path d="M30 28 H90 L104 70 Q112 120 94 168 L84 190 H36 L26 168 Q8 120 16 70 Z" fill={`rgba(255,200,110,${0.55 * flicker})`} stroke={C.gold} strokeWidth="4" />
        <path d="M60 28 V190 M30 70 Q60 80 90 70 M22 120 Q60 132 98 120 M28 168 Q60 176 92 168" stroke={C.gold} strokeWidth="3" fill="none" opacity="0.9" />
        <rect x="36" y="190" width="48" height="12" rx="3" fill={C.gold} />
        <path d="M50 202 H70 L60 228 Z" fill={C.gold} />
      </svg>
    </div>
  );
};

export const Skyline: React.FC<{ rise?: number; color?: string }> = ({ rise = 1, color = "#040B16" }) => (
  <svg width="1080" height="560" viewBox="0 0 1080 560" style={{ position: "absolute", left: 0, bottom: -10, transform: `translateY(${(1 - rise) * 300}px)` }}>
    <path fill={color} d="M0 560 V420 H80 V360 H90 V300 L100 270 L110 300 V360 H120 V420 H260 V380 Q260 290 360 250 Q380 200 400 180 Q420 200 440 250 Q540 290 540 380 V420 H600 V330 H610 V250 L622 210 L634 250 V330 H644 V420 H760 V390 Q760 330 830 305 Q850 280 860 270 Q870 280 890 305 Q960 330 960 390 V420 H1080 V560 Z" />
    <circle cx="400" cy="168" r="10" fill={C.gold} opacity="0.9" />
    <circle cx="860" cy="260" r="7" fill={C.gold} opacity="0.9" />
  </svg>
);

const NightBg: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
  <AbsoluteFill style={{ background: `linear-gradient(180deg, ${C.night} 0%, ${C.night2} 70%, #1A3A4F 100%)` }}>
    <Stars />
    <Pattern />
    {children}
  </AbsoluteFill>
);

// ---------- 1. Intro (beats 0-8): Ramadan Kareem
const Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const moonY = interpolate(frame, [0, 4 * B], [520, 300], { easing: ease, ...clamp });
  const drop = (d: number) => fade(frame, d, d + 40);
  return (
    <NightBg>
      <Crescent size={300} x={390} y={moonY} glow={fade(frame, 10, 70)} />
      <Lantern x={150} len={260} phase={0} drop={drop(10)} />
      <Lantern x={920} len={380} phase={1.4} drop={drop(22)} scale={0.9} />
      <Lantern x={300} len={520} phase={2.6} drop={drop(34)} scale={0.7} />
      <Lantern x={780} len={160} phase={3.3} drop={drop(46)} scale={0.75} />
      <Skyline rise={fade(frame, 0, 60)} />
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", paddingTop: 260 }}>
        <div style={{ opacity: fade(frame, 2 * B, 3 * B), transform: `translateY(${(1 - fade(frame, 2 * B, 3 * B)) * 30}px)`, fontFamily: "Fraunces", fontStyle: "italic", fontWeight: 600,
          fontSize: 150, color: C.gold, textShadow: "0 0 40px rgba(232,193,112,0.45)" }}>Ramadan</div>
        <div style={{ opacity: fade(frame, 3 * B, 4 * B), fontFamily: "Fraunces", fontStyle: "italic", fontWeight: 400, fontSize: 110, color: C.cream, marginTop: -20 }}>Kareem</div>
        <div style={{ opacity: fade(frame, 5 * B, 6 * B), marginTop: 40, fontFamily: "Inter", fontWeight: 600, fontSize: 32, letterSpacing: "0.35em", color: C.goldSoft }}>RAMADAN 2027</div>
      </AbsoluteFill>
    </NightBg>
  );
};

// ---------- 2. Message (beats 8-14): the Zidane bag rises under the moon
const Message: React.FC = () => {
  const frame = useCurrentFrame();
  const bag = fade(frame, 10, 60);
  return (
    <NightBg>
      <Crescent size={170} x={820} y={140} />
      <Lantern x={130} len={200} phase={0.5} scale={0.75} />
      <AbsoluteFill style={{ background: "radial-gradient(circle at 50% 62%, rgba(232,193,112,0.35), transparent 45%)", opacity: bag }} />
      <AbsoluteFill style={{ alignItems: "center", paddingTop: 330 }}>
        {["Is Ramadan,", "kisi ka dastarkhwan", "bhar dein."].map((l, i) => {
          const p = fade(frame, i * 18, i * 18 + 30);
          return <div key={l} style={{ opacity: p, transform: `translateY(${(1 - p) * 24}px)`, fontFamily: i === 1 ? "Fraunces" : "Sora", fontStyle: i === 1 ? "italic" : "normal",
            fontWeight: i === 1 ? 600 : 700, fontSize: i === 1 ? 92 : 80, color: i === 1 ? C.gold : C.cream, lineHeight: 1.2, textAlign: "center" }}>{l}</div>;
        })}
      </AbsoluteFill>
      <Img src={staticFile("ramadan/bag-cutout.png")} style={{ position: "absolute", left: 40, top: 900 + (1 - bag) * 200, width: 1000, opacity: bag,
        filter: "drop-shadow(0 30px 60px rgba(0,0,0,0.6))", transform: `scale(${1 + Math.sin(frame / 30) * 0.01})` }} />
      <Skyline color="#030913" />
    </NightBg>
  );
};

// ---------- 3. Packages (beats 14-46, 8 beats each): real contents from the website
type Item = { n: string; q: string; img?: string };
const I = {
  atta: { n: "Super Fine Aata", img: "cut/atta.png" }, rice: { n: "Basmati Rice", img: "catalog/1020464.png" }, oil: { n: "Cooking Oil", img: "cut/oil.png" },
  besan: { n: "Besan", img: "catalog/1052940.png" }, chana: { n: "Daal Chana", img: "catalog/1058803.png" }, kala: { n: "Kala Chana", img: "cut/kala-chana.png" },
  moong: { n: "Daal Moong", img: "cut/moong.png" }, sugar: { n: "Sugar", img: "catalog/1055803.png" }, tea: { n: "Tea", img: "cut/tea.png" },
  chilli: { n: "Red Chilli Powder", img: "cut/chilli.png" }, dhaniya: { n: "Dhaniya Powder" }, haldi: { n: "Haldi Powder" }, chaat: { n: "Chaat Masala" },
  dates: { n: "Dates", img: "catalog/1193877.png" }, rooh: { n: "Rooh Afza", img: "cut/rooh-afza.png" }, salt: { n: "Salt", img: "cut/salt.png" },
  sev: { n: "Vermicelli", img: "cut/vermicelli.png" },
};
const it = (k: keyof typeof I, q: string): Item => ({ ...I[k], q });
const packages: { no: string; price: string; items: Item[] }[] = [
  { no: "01", price: "2,149", items: [it("atta", "5kg"), it("rice", "1kg"), it("oil", "1L"), it("chana", "1kg"), it("kala", "0.5kg"), it("sugar", "1kg"), it("chilli", "100g"), it("salt", "800g"), it("sev", "100g")] },
  { no: "02", price: "3,149", items: [it("atta", "5kg"), it("rice", "2kg"), it("oil", "1L"), it("besan", "1kg"), it("chana", "1kg"), it("kala", "0.5kg"), it("sugar", "1kg"), it("tea", "80g"), it("chilli", "100g"), it("dates", "200g"), it("rooh", "425ml"), it("salt", "800g"), it("sev", "100g")] },
  { no: "03", price: "5,249", items: [it("atta", "10kg"), it("rice", "3kg"), it("oil", "2L"), it("besan", "1kg"), it("chana", "1kg"), it("kala", "1kg"), it("sugar", "2kg"), it("tea", "170g"), it("chilli", "100g"), it("dhaniya", "100g"), it("chaat", "100g"), it("dates", "200g"), it("rooh", "800ml"), it("salt", "800g"), it("sev", "100g")] },
  { no: "04", price: "7,249", items: [it("atta", "10kg"), it("rice", "5kg"), it("oil", "5L"), it("besan", "1kg"), it("chana", "1kg"), it("moong", "1kg"), it("kala", "1kg"), it("sugar", "2kg"), it("tea", "170g"), it("chilli", "100g"), it("dhaniya", "100g"), it("haldi", "100g"), it("chaat", "100g"), it("dates", "200g"), it("rooh", "800ml"), it("salt", "800g"), it("sev", "100g")] },
];

const Tile: React.FC<{ item: Item; at: number; w: number }> = ({ item, at, w }) => {
  const frame = useCurrentFrame();
  const p = fade(frame, at, at + 16);
  return (
    <div style={{ width: w, opacity: p, transform: `translateY(${(1 - p) * 30}px) scale(${0.9 + p * 0.1})`, display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ width: w - 16, height: w - 16, borderRadius: 26, background: "rgba(251,243,228,0.95)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 10px 30px rgba(0,0,0,0.3)" }}>
        {item.img ? <Img src={staticFile(item.img)} style={{ maxWidth: "78%", maxHeight: "78%", objectFit: "contain" }} />
          : <div style={{ fontFamily: "Fraunces", fontStyle: "italic", fontWeight: 600, fontSize: w * 0.18, color: C.red, textAlign: "center", lineHeight: 1.05, padding: 10 }}>{item.n.replace(" Powder", "").replace(" Masala", "\nmasala")}</div>}
      </div>
      <div style={{ marginTop: 8, fontFamily: "Inter", fontWeight: 600, fontSize: Math.max(22, w * 0.12), color: C.cream, textAlign: "center", lineHeight: 1.1, height: Math.max(50, w * 0.27), overflow: "hidden" }}>{item.n}</div>
      <div style={{ fontFamily: "Sora", fontWeight: 700, fontSize: Math.max(24, w * 0.13), color: C.gold }}>{item.q}</div>
    </div>
  );
};

const Package: React.FC<{ i: number }> = ({ i }) => {
  const frame = useCurrentFrame();
  const pk = packages[i];
  const n = pk.items.length;
  const cols = n <= 9 ? 3 : n <= 16 ? 4 : 5;
  const rows = Math.ceil(n / cols);
  // fit the grid between the header and the price pill (~1040px tall, 900px wide)
  const w = Math.min(250, Math.floor((1040 - (rows - 1) * 8) / (rows * 1.45)), Math.floor((900 - (cols - 1) * 6) / cols));
  const stagger = Math.min(9, Math.floor((4.5 * B) / pk.items.length));
  const head = fade(frame, 0, 24);
  const out = interpolate(frame, [8 * B - 12, 8 * B], [1, 0], clamp);
  return (
    <NightBg>
      <Crescent size={120} x={880} y={110} glow={0.6} />
      <AbsoluteFill style={{ opacity: out }}>
        {/* arch window frame */}
        <svg width="1000" height="1660" viewBox="0 0 1000 1660" style={{ position: "absolute", left: 40, top: 150, opacity: head }}>
          <path d="M20 1640 V420 Q20 160 500 20 Q980 160 980 420 V1640 Z" fill="rgba(7,20,37,0.55)" stroke={C.gold} strokeWidth="4" />
          <path d="M44 1616 V428 Q44 190 500 48 Q956 190 956 428 V1616 Z" fill="none" stroke={C.goldSoft} strokeWidth="2" />
        </svg>
        <div style={{ position: "absolute", top: 300, left: 0, right: 0, textAlign: "center", opacity: head, transform: `translateY(${(1 - head) * 20}px)` }}>
          <div style={{ fontFamily: "Inter", fontWeight: 600, fontSize: 30, letterSpacing: "0.35em", color: C.goldSoft }}>RAMADAN PACKAGE</div>
          <div style={{ fontFamily: "Fraunces", fontStyle: "italic", fontWeight: 600, fontSize: 170, lineHeight: 1, color: C.gold }}>{pk.no}</div>
          <div style={{ fontFamily: "Sora", fontWeight: 700, fontSize: 40, color: C.cream }}>{pk.items.length} items</div>
        </div>
        <div style={{ position: "absolute", top: 590, left: 90, right: 90, display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "8px 6px" }}>
          {pk.items.map((item, k) => <Tile key={k} item={item} at={14 + k * stagger} w={w} />)}
        </div>
        <div style={{ position: "absolute", bottom: 150, left: 0, right: 0, textAlign: "center", opacity: fade(frame, 5 * B, 5 * B + 20) }}>
          <div style={{ display: "inline-block", background: C.gold, color: C.night, borderRadius: 999, padding: "18px 50px", fontFamily: "Sora", fontWeight: 800, fontSize: 60 }}>PKR {pk.price}</div>
          <div style={{ marginTop: 14, fontFamily: "Inter", fontWeight: 500, fontSize: 26, color: "rgba(251,243,228,0.7)" }}>2026 reference price · 2027 rate on quotation</div>
        </div>
      </AbsoluteFill>
    </NightBg>
  );
};

// ---------- 4. Custom (beats 46-52): every package can change
const Custom: React.FC = () => {
  const frame = useCurrentFrame();
  const lines = ["Apne items chunein.", "Apni branding lagayein.", "Hum deliver karein."];
  const who = ["Corporate", "Factories", "NGOs", "Welfare"];
  return (
    <NightBg>
      <Lantern x={540} len={140} phase={0.8} scale={0.9} />
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: "0 80px" }}>
        {lines.map((l, i) => {
          const p = fade(frame, 10 + i * 30, 40 + i * 30);
          return <div key={l} style={{ opacity: p, transform: `translateY(${(1 - p) * 24}px)`, fontFamily: i === 1 ? "Fraunces" : "Sora", fontStyle: i === 1 ? "italic" : "normal",
            fontWeight: i === 1 ? 600 : 700, fontSize: 82, color: i === 1 ? C.gold : C.cream, lineHeight: 1.3, textAlign: "center" }}>{l}</div>;
        })}
        <div style={{ marginTop: 70, display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 18 }}>
          {who.map((w, i) => {
            const p = fade(frame, 100 + i * 8, 120 + i * 8);
            return <div key={w} style={{ opacity: p, border: `2px solid ${C.gold}`, color: C.gold, borderRadius: 999, padding: "12px 30px", fontFamily: "Inter", fontWeight: 600, fontSize: 38 }}>{w}</div>;
          })}
        </div>
      </AbsoluteFill>
      <Skyline color="#030913" />
    </NightBg>
  );
};

// ---------- 5. End card (beats 52-60)
const End: React.FC = () => {
  const frame = useCurrentFrame();
  const q = (d: number) => fade(frame, d, d + 22);
  const rows = [["WhatsApp", "0339 2639315"], ["UAN", "021 111 ZIDANE"], ["Web", "zidane.com.pk"]];
  return (
    <NightBg>
      <Crescent size={240} x={420} y={190} glow={1.2} />
      <Lantern x={140} len={300} phase={0.2} scale={0.8} />
      <Lantern x={940} len={220} phase={1.9} scale={0.7} />
      <AbsoluteFill style={{ alignItems: "center", paddingTop: 560, paddingLeft: 90, paddingRight: 90 }}>
        <Img src={staticFile("brand/zidane-logo-white.svg")} style={{ width: 640, opacity: q(0), transform: `scale(${0.94 + q(0) * 0.06})` }} />
        <div style={{ marginTop: 40, opacity: q(14), fontFamily: "Fraunces", fontStyle: "italic", fontWeight: 600, fontSize: 70, color: C.gold, textAlign: "center", lineHeight: 1.15 }}>Ramadan 2027 ki planning,<br />abhi se.</div>
        <div style={{ marginTop: 60, width: "100%", display: "flex", flexDirection: "column", gap: 16 }}>
          {rows.map(([k, v], i) => (
            <div key={k} style={{ opacity: q(30 + i * 8), display: "flex", justifyContent: "space-between", alignItems: "center", border: `1.5px solid ${C.goldSoft}`, borderRadius: 22, padding: "22px 36px", background: "rgba(7,20,37,0.5)" }}>
              <span style={{ fontFamily: "Inter", fontWeight: 600, fontSize: 34, color: "rgba(251,243,228,0.7)" }}>{k}</span>
              <span style={{ fontFamily: "Sora", fontWeight: 700, fontSize: 50, color: C.cream }}>{v}</span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 40, opacity: q(70), fontFamily: "Inter", fontWeight: 500, fontSize: 26, color: "rgba(251,243,228,0.6)", textAlign: "center" }}>Shown prices are 2026 reference figures. Final rate confirmed by quotation.</div>
      </AbsoluteFill>
    </NightBg>
  );
};

// soft cross-fade wrapper so scenes melt into each other instead of cutting
const Soft: React.FC<{ len: number; children: React.ReactNode }> = ({ len, children }) => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [0, 15, len - 10, len], [0, 1, 1, 1], clamp);
  return <AbsoluteFill style={{ opacity: o }}>{children}</AbsoluteFill>;
};

const scenes: [React.ReactNode, number, number][] = [
  [<Intro />, 0, 8], [<Message />, 8, 6],
  [<Package i={0} />, 14, 8], [<Package i={1} />, 22, 8], [<Package i={2} />, 30, 8], [<Package i={3} />, 38, 8],
  [<Custom />, 46, 6], [<End />, 52, 8],
];

export const RamadanReel: React.FC = () => (
  <AbsoluteFill style={{ background: C.night }}>
    {scenes.map(([node, at, len], i) => (
      <Sequence key={i} from={at * B} durationInFrames={len * B + (i < scenes.length - 1 ? 15 : 0)}><Soft len={len * B + 15}>{node}</Soft></Sequence>
    ))}
    <Audio src={staticFile("sfx/ramadan-naat.wav")} />
  </AbsoluteFill>
);

export const RamadanCompositions: React.FC = () => (
  <Composition id="RamadanReel" component={RamadanReel} durationInFrames={TOTAL} fps={FPS} width={1080} height={1920} />
);
