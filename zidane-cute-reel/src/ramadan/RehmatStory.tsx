// "Aao, Rehmatein Baantein": ~45s 2D-animated Ramadan story with an Urdu voiceover.
// Warehouse → factory gate distribution → Rashid chacha rides home → family opens the bag →
// a bag goes to the neighbour → family iftar → four reference packages.
// Voiceover: scripts/make_ramadan_vo.py (Kokoro, local). Music: scripts/gen-ramadan-audio.py bed
import React from "react";
import { AbsoluteFill, Audio, Composition, Img, interpolate, random, Sequence, staticFile, useCurrentFrame } from "remotion";
import "../Fonts";
import { corp } from "../corporate/kit";
import { C, Crescent, Lantern, Pattern, Stars } from "./RamadanReel";
import vo from "../../public/vo/ramadan-vo.json";

const FPS = 30;
const clamp = corp.clamp;
const ease = corp.out;
const fade = (f: number, a: number, b: number) => interpolate(f, [a, b], [0, 1], { easing: ease, ...clamp });
const XF = 12; // cross-fade frames between scenes
const RED = "#C22A2F";

// ---------- characters
type PersonProps = {
  skin?: string; kameez: string; shalwar?: string; female?: boolean; beard?: "none" | "short" | "white"; topi?: boolean;
  dupatta?: string; hair?: string; armL?: number; armR?: number; flip?: boolean; scale?: number; x: number; y: number;
  bob?: number; holdR?: React.ReactNode; vest?: string; seated?: boolean; dua?: number;
};

// Drawn in a 200×460 box, feet at the bottom centre; (x, y) is where the feet stand.
const Person: React.FC<PersonProps> = ({ skin = "#C48A62", kameez, shalwar, female, beard = "none", topi, dupatta = "#8E2B4A", hair = "#1A1412",
  armL = 10, armR = -10, flip, scale = 1.6, x, y, bob = 0, holdR, vest, seated, dua = 0 }) => {
  const frame = useCurrentFrame();
  const blink = frame % 110 > 104 ? 0.15 : 1;
  const sh = shalwar ?? kameez;
  const shade = "rgba(0,0,0,0.14)";
  const arm = (side: "L" | "R", ang: number) => {
    const sx = side === "L" ? 64 : 136;
    return (
      <g transform={`rotate(${ang} ${sx} 168)`}>
        <rect x={sx - 15} y={160} width={30} height={118} rx={15} fill={kameez} />
        <rect x={sx - 15} y={160} width={30} height={118} rx={15} fill={shade} opacity={side === "L" ? 1 : 0} />
        <circle cx={sx} cy={284} r={14} fill={skin} />
      </g>
    );
  };
  return (
    <div style={{ position: "absolute", left: x - 100 * scale, top: y - 460 * scale + bob, width: 200 * scale, height: 460 * scale, transform: flip ? "scaleX(-1)" : undefined }}>
      <svg viewBox="0 0 200 460" width="100%" height="100%" style={{ overflow: "visible" }}>
        <ellipse cx={100} cy={456} rx={70} ry={10} fill="rgba(0,0,0,0.22)" />
        {!seated && <>
          <path d="M70 330 L58 448 H92 L100 360 L108 448 H142 L130 330 Z" fill={sh} />
          <path d="M100 360 L108 448 H142 L130 330 Z" fill={shade} />
          <ellipse cx={74} cy={452} rx={20} ry={7} fill="#3A2A20" />
          <ellipse cx={126} cy={452} rx={20} ry={7} fill="#3A2A20" />
        </>}
        {arm("L", armL)}
        {/* kameez */}
        <path d="M62 150 Q100 136 138 150 L150 360 Q100 372 50 360 Z" fill={kameez} />
        <path d="M100 142 Q122 144 138 150 L150 360 Q125 366 100 368 Z" fill={shade} />
        {vest && <path d="M66 156 Q80 150 92 158 L94 330 L60 330 Z M134 156 Q120 150 108 158 L106 330 L140 330 Z" fill={vest} />}
        <path d="M92 150 L100 186 L108 150" fill="none" stroke="rgba(0,0,0,0.25)" strokeWidth={3} />
        {/* neck + head */}
        <rect x={88} y={122} width={24} height={28} rx={8} fill={skin} />
        {female && <path d="M52 92 Q54 30 100 28 Q146 30 148 92 L160 200 Q130 170 120 150 L80 150 Q70 170 40 200 Z" fill={dupatta} />}
        <ellipse cx={100} cy={92} rx={36} ry={42} fill={skin} />
        {!female && !topi && <path d="M64 86 Q62 46 100 46 Q140 46 136 86 Q130 64 100 62 Q72 64 64 86 Z" fill={hair} />}
        {topi && <path d="M66 70 Q66 44 100 42 Q134 44 134 70 Z" fill="#F5F1E8" stroke="#D8D0C0" strokeWidth={2} />}
        {female && <path d="M62 80 Q64 44 100 42 Q136 44 138 80 Q120 58 100 58 Q80 58 62 80 Z" fill={dupatta} />}
        {beard !== "none" && <path d="M66 96 Q68 140 100 146 Q132 140 134 96 Q128 122 100 124 Q72 122 66 96 Z" fill={beard === "white" ? "#EDEBE6" : hair} />}
        {/* face */}
        <ellipse cx={86} cy={92} rx={4.5} ry={5.5 * blink} fill="#20140F" />
        <ellipse cx={114} cy={92} rx={4.5} ry={5.5 * blink} fill="#20140F" />
        <path d="M78 80 Q86 76 94 80 M106 80 Q114 76 122 80" stroke={beard === "white" ? "#CFCBC2" : "#20140F"} strokeWidth={3} fill="none" strokeLinecap="round" />
        <path d="M100 96 Q97 106 102 108" stroke="rgba(0,0,0,0.3)" strokeWidth={2.5} fill="none" strokeLinecap="round" />
        <path d="M89 114 Q100 122 111 114" stroke={beard !== "none" ? "#5A3326" : "#7A3B30"} strokeWidth={3.5} fill="none" strokeLinecap="round" />
        {female && <path d="M40 200 Q60 150 70 150 L60 260 Z" fill={dupatta} opacity={0.9} />}
        {arm("R", armR)}
        {dua > 0 && (
          <g opacity={dua} transform={`translate(0 ${(1 - dua) * 30})`}>
            <ellipse cx={89} cy={250} rx={13} ry={22} fill={skin} transform="rotate(-14 89 250)" />
            <ellipse cx={111} cy={250} rx={13} ry={22} fill={skin} transform="rotate(14 111 250)" />
            <path d="M80 262 Q100 276 120 262" stroke="rgba(0,0,0,0.18)" strokeWidth={3} fill="none" />
          </g>
        )}
      </svg>
      {holdR}
    </div>
  );
};

// red Zidane ration bag
const Bag: React.FC<{ w?: number; style?: React.CSSProperties }> = ({ w = 150, style }) => (
  <svg viewBox="0 0 150 150" width={w} height={w} style={{ position: "absolute", overflow: "visible", ...style }}>
    <path d="M45 40 Q45 8 75 8 Q105 8 105 40" fill="none" stroke="#8E1C22" strokeWidth={8} />
    <path d="M18 40 H132 L142 140 Q75 150 8 140 Z" fill={RED} />
    <path d="M18 40 H132 L135 62 H15 Z" fill="rgba(0,0,0,0.15)" />
    <text x={75} y={104} textAnchor="middle" fontFamily="Sora" fontWeight={800} fontSize={30} fill="#fff">Zidane</text>
    <text x={75} y={122} textAnchor="middle" fontFamily="Inter" fontWeight={600} fontSize={10} fill="rgba(255,255,255,0.85)">Wholesale Solutions</text>
  </svg>
);

const Subtitle: React.FC<{ text: string; dur: number }> = ({ text, dur }) => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [0, 8, dur - 6, dur], [0, 1, 1, 0], clamp);
  return (
    <div style={{ position: "absolute", left: 60, right: 60, bottom: 150, display: "flex", justifyContent: "center", opacity: o }}>
      <div style={{ background: "rgba(0,0,0,0.6)", borderRadius: 22, padding: "18px 32px", fontFamily: "Sora", fontWeight: 700, fontSize: 46, lineHeight: 1.25, color: "#fff", textAlign: "center" }}>{text}</div>
    </div>
  );
};

const Place: React.FC<{ text: string }> = ({ text }) => {
  const frame = useCurrentFrame();
  const p = fade(frame, 10, 30);
  return <div style={{ position: "absolute", left: 60, top: 120, opacity: p, transform: `translateX(${(1 - p) * -30}px)`, background: "rgba(0,0,0,0.45)", color: "#fff",
    padding: "12px 26px", borderRadius: 999, fontFamily: "Inter", fontWeight: 600, fontSize: 32, letterSpacing: "0.06em" }}>{text}</div>;
};

const FairyLights: React.FC<{ y: number; sag?: number; n?: number }> = ({ y, sag = 80, n = 16 }) => {
  const frame = useCurrentFrame();
  return (
    <svg width="1080" height={sag + 80} style={{ position: "absolute", left: 0, top: y }}>
      <path d={`M-20 10 Q540 ${sag * 2} 1100 10`} stroke="#3A2E22" strokeWidth={3} fill="none" />
      {Array.from({ length: n }).map((_, i) => {
        const t = (i + 0.5) / n;
        const bx = -20 + t * 1120;
        const by = 10 + 2 * t * (1 - t) * (sag * 2 - 10) * 1;
        const on = 0.6 + 0.4 * Math.sin(frame / 8 + i * 1.7);
        const col = ["#FFD36B", "#FF8A5B", "#FFE9A8"][i % 3];
        return <circle key={i} cx={bx} cy={by + 14} r={9} fill={col} opacity={on} style={{ filter: `drop-shadow(0 0 10px ${col})` }} />;
      })}
    </svg>
  );
};

// camera: slow push-in for every scene
const Cam: React.FC<{ children: React.ReactNode; from?: number; to?: number; ox?: string }> = ({ children, from = 1, to = 1.06, ox = "50% 60%" }) => {
  const frame = useCurrentFrame();
  return <AbsoluteFill style={{ transform: `scale(${from + (to - from) * Math.min(1, frame / 240)})`, transformOrigin: ox }}>{children}</AbsoluteFill>;
};

// ---------- S1: warehouse, workers packing
const Warehouse: React.FC = () => {
  const frame = useCurrentFrame();
  const stack = Math.min(6, Math.floor(frame / 22));
  const reach = Math.sin(frame / 11) * 18;
  return (
    <Cam>
      <AbsoluteFill style={{ background: "linear-gradient(180deg, #5E422C 0%, #3D2B1F 62%, #2A1E16 62%, #20170F 100%)" }} />
      {[340, 640, 940].map((sy, r) => (
        <div key={sy}>
          <div style={{ position: "absolute", left: 0, right: 0, top: sy + 150, height: 16, background: "#2A1D13" }} />
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} style={{ position: "absolute", left: 20 + i * 150 + (r % 2) * 40, top: sy + 40, width: 120, height: 112, borderRadius: "30px 30px 14px 14px",
              background: ["#E9DFC8", "#F2E6B8", "#D8C29A", "#EFE9DF"][(i + r) % 4], boxShadow: "inset -14px 0 0 rgba(0,0,0,0.12)" }} />
          ))}
        </div>
      ))}
      <div style={{ position: "absolute", left: 600, top: -100, width: 260, height: 1700, background: "linear-gradient(180deg, rgba(255,214,140,0.35), transparent)", transform: "rotate(18deg)", filter: "blur(10px)" }} />
      {[260, 820].map((lx) => (
        <div key={lx} style={{ position: "absolute", left: lx, top: 0 }}>
          <div style={{ width: 4, height: 180, background: "#1A120C", margin: "0 auto" }} />
          <div style={{ width: 120, height: 60, marginLeft: -58, borderRadius: "60px 60px 0 0", background: "#2C2C2C", boxShadow: "0 40px 90px 30px rgba(255,200,120,0.45)" }} />
        </div>
      ))}
      <Person x={290} y={1500} kameez={RED} shalwar="#2A2A2A" beard="short" armR={-70 + reach} armL={20} />
      <Person x={800} y={1500} kameez={RED} shalwar="#2A2A2A" topi flip armR={-60 - reach} armL={15} />
      <div style={{ position: "absolute", left: 120, right: 120, top: 1230, height: 40, background: "#7A5232", borderRadius: 8 }} />
      <div style={{ position: "absolute", left: 160, top: 1270, width: 30, height: 230, background: "#5A3B23" }} />
      <div style={{ position: "absolute", left: 890, top: 1270, width: 30, height: 230, background: "#5A3B23" }} />
      {Array.from({ length: stack }).map((_, i) => {
        const p = fade(frame, i * 22, i * 22 + 10);
        return <Bag key={i} w={140} style={{ left: 330 + (i % 3) * 140, top: 1110 - Math.floor(i / 3) * 110 - (1 - p) * 60, opacity: p }} />;
      })}
      <Place text="📍 Korangi, Karachi · Asr" />
    </Cam>
  );
};

// ---------- S2: factory gate, supervisor hands bags to workers
const FactoryGate: React.FC = () => {
  const frame = useCurrentFrame();
  const t = fade(frame, 30, 80); // bag travels from supervisor to worker
  const lift = fade(frame, 85, 110);
  return (
    <Cam>
      <AbsoluteFill style={{ background: "linear-gradient(180deg, #F59E5B 0%, #F4C27A 40%, #F9DDA4 60%, #B9A58E 60%, #9C8A75 100%)" }} />
      <div style={{ position: "absolute", left: 700, top: 330, width: 220, height: 220, borderRadius: 220, background: "#FFE6A6", boxShadow: "0 0 120px 40px rgba(255,220,150,0.7)" }} />
      <svg width="1080" height="700" style={{ position: "absolute", top: 520, left: 0 }}>
        <path d="M60 650 V250 L180 170 V250 L300 170 V250 L420 170 V250 L540 170 V650 Z" fill="#5E6F82" />
        <rect x={430} y={60} width={50} height={200} fill="#4E5D6E" />
        <rect x={560} y={260} width={460} height={390} fill="#6B7C8F" />
        {Array.from({ length: 4 }).map((_, i) => <rect key={i} x={600 + i * 105} y={320} width={70} height={90} fill="#F7D79A" opacity={0.8} />)}
        <rect x={600} y={200} width={380} height={56} rx={8} fill="#2F3A47" />
        <text x={790} y={238} textAnchor="middle" fontFamily="Sora" fontWeight={800} fontSize={30} fill="#F4F1EC">TEXTILE MILLS</text>
      </svg>
      {[[-40, "Ration day"]].map(() => null)}
      {/* truck */}
      <div style={{ position: "absolute", left: -60, top: 1010, width: 520, height: 300 }}>
        <div style={{ position: "absolute", left: 0, top: 0, width: 360, height: 230, background: "#F4F1EC", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "inset 0 -20px 0 rgba(0,0,0,0.08)" }}>
          <Img src={staticFile("brand/zidane-logo.svg")} style={{ width: 240 }} />
        </div>
        <div style={{ position: "absolute", left: 360, top: 60, width: 140, height: 170, background: RED, borderRadius: "12px 40px 12px 12px" }} />
        <div style={{ position: "absolute", left: 400, top: 80, width: 80, height: 60, background: "#BFE3F2", borderRadius: "6px 30px 6px 6px" }} />
        {[60, 280, 420].map((wx) => <div key={wx} style={{ position: "absolute", left: wx, top: 200, width: 80, height: 80, borderRadius: 80, background: "#222", border: "12px solid #555" }} />)}
      </div>
      <Person x={470} y={1520} kameez="#F2EEE6" vest="#2E3B55" beard="short" armR={-75 + t * 10} />
      {[650, 800, 950].map((wx, i) => (
        <Person key={wx} x={wx} y={1520 - i * 6} scale={1.5} kameez={["#7C93A8", "#9C8668", "#6E8C6E"][i]} topi={i === 1} beard={i === 2 ? "short" : "none"} flip
          armR={i === 0 ? -70 + lift * -60 : -8} armL={10} />
      ))}
      <Bag w={130} style={{ left: interpolate(t, [0, 1], [560, 590]), top: interpolate(t, [0, 1], [1060, 1050]) - lift * 120 }} />
      {frame > 60 && <Bag w={110} style={{ left: 380, top: 1090, opacity: fade(frame, 60, 75) }} />}
      <Place text="Iftar se pehle · Ration day" />
    </Cam>
  );
};

// ---------- S3: Rashid chacha rides home at sunset
const Ride: React.FC = () => {
  const frame = useCurrentFrame();
  const bob = Math.sin(frame / 3) * 3;
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <AbsoluteFill style={{ background: "linear-gradient(180deg, #3B2A5C 0%, #B4527A 38%, #F49B5E 62%, #F7C27C 72%)" }} />
      {/* mosque, slow parallax */}
      <svg width="1600" height="700" style={{ position: "absolute", top: 520, left: -frame * 0.6 }}>
        <path fill="#5B3150" d="M0 700 V420 H300 V360 Q300 250 420 210 Q440 150 460 130 Q480 150 500 210 Q620 250 620 360 V420 H700 V700 Z" />
        <rect x={250} y={180} width={30} height={260} fill="#5B3150" /><path d="M250 180 L265 130 L280 180 Z" fill="#5B3150" />
        <rect x={640} y={180} width={30} height={260} fill="#5B3150" /><path d="M640 180 L655 130 L670 180 Z" fill="#5B3150" />
        <path fill="#6A3A58" d="M760 700 V460 H1600 V700 Z" />
      </svg>
      {/* near buildings, faster parallax */}
      <div style={{ position: "absolute", top: 900, left: -((frame * 4) % 360), display: "flex", gap: 0 }}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} style={{ width: 360, height: 520, background: ["#3E2A3E", "#47304A", "#352436"][i % 3], marginTop: [0, 60, 30][i % 3], position: "relative" }}>
            {Array.from({ length: 6 }).map((__, w) => <div key={w} style={{ position: "absolute", left: 40 + (w % 3) * 100, top: 50 + Math.floor(w / 3) * 130, width: 60, height: 70,
              background: random(`w${i}${w}`) > 0.4 ? "#FFD27A" : "#2A1C2A", opacity: 0.9 }} />)}
          </div>
        ))}
      </div>
      <FairyLights y={860} sag={60} n={18} />
      <div style={{ position: "absolute", left: 0, right: 0, top: 1420, bottom: 0, background: "#2B2B33" }} />
      {Array.from({ length: 6 }).map((_, i) => <div key={i} style={{ position: "absolute", top: 1600, left: ((i * 260 - frame * 9) % 1560 + 1560) % 1560 - 260, width: 140, height: 14, background: "#E8E2D0", opacity: 0.6 }} />)}
      {/* motorbike + rider */}
      <div style={{ position: "absolute", left: 230, top: 1060 + bob, width: 620, height: 460 }}>
        <Person x={330} y={330} kameez="#F3EFE6" vest="#6B4A2E" beard="white" topi armR={-72} armL={-60} seated scale={1.35} />
        <Bag w={150} style={{ left: 60, top: 175 }} />
        <svg viewBox="0 0 620 460" width="620" height="460" style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
          {[130, 490].map((wx) => (
            <g key={wx} transform={`rotate(${frame * 14} ${wx} 380)`}>
              <circle cx={wx} cy={380} r={70} fill="#1C1C1C" /><circle cx={wx} cy={380} r={44} fill="#9A9A9A" />
              {Array.from({ length: 6 }).map((_, s) => <line key={s} x1={wx} y1={380} x2={wx + Math.cos(s) * 44} y2={380 + Math.sin(s) * 44} stroke="#444" strokeWidth={5} />)}
            </g>
          ))}
          <path d="M120 300 L250 280 L420 300 L500 330 L470 360 L180 360 Z" fill={RED} />
          <path d="M210 290 H380 L370 270 H220 Z" fill="#1E1E1E" />
          <path d="M440 300 L500 200 L530 200" stroke="#333" strokeWidth={14} fill="none" strokeLinecap="round" />
          <circle cx={545} cy={250} r={20} fill="#FFE9A0" style={{ filter: "drop-shadow(0 0 20px #FFE9A0)" }} />
        </svg>
      </div>
    </AbsoluteFill>
  );
};

// ---------- S4: home, the bag is opened
const items = [
  { img: "cut/atta.png", n: "Atta" }, { img: "catalog/1020464.png", n: "Chawal" }, { img: "catalog/1193877.png", n: "Khajoor" }, { img: "cut/rooh-afza.png", n: "Rooh Afza" },
];
const Room: React.FC<{ children?: React.ReactNode; night?: boolean }> = ({ children }) => (
  <>
    <AbsoluteFill style={{ background: "linear-gradient(180deg, #C9744F 0%, #B5623F 60%, #6E3B2A 60%, #5A2F22 100%)" }} />
    <div style={{ position: "absolute", left: 640, top: 360, width: 300, height: 420, borderRadius: "150px 150px 10px 10px", background: "linear-gradient(180deg, #0B1A30, #1F3A5A)", border: "16px solid #7A4A30", overflow: "hidden" }}>
      <Crescent size={120} x={120} y={60} glow={0.7} />
      {Array.from({ length: 12 }).map((_, i) => <div key={i} style={{ position: "absolute", left: random(`rs${i}`) * 260, top: random(`rt${i}`) * 380, width: 4, height: 4, borderRadius: 4, background: "#fff", opacity: 0.8 }} />)}
    </div>
    <FairyLights y={180} sag={90} />
    <div style={{ position: "absolute", left: 80, right: 80, top: 1450, height: 330, borderRadius: 30, background: "repeating-linear-gradient(90deg, #8E2B3A 0 60px, #A63A48 60px 120px)", opacity: 0.9 }} />
    {children}
  </>
);
const Home: React.FC = () => {
  const frame = useCurrentFrame();
  const jump = Math.max(0, Math.sin((frame - 40) / 6)) * (frame > 40 && frame < 120 ? 14 : 0);
  return (
    <Cam>
      <Room />
      <Person x={180} y={1560} kameez="#F3EFE6" vest="#6B4A2E" beard="white" topi armR={-20} armL={30} scale={1.55} />
      <Person x={420} y={1580} kameez="#2F7A5B" female dupatta="#8E2B4A" armR={-55} armL={20} scale={1.5} />
      <Person x={860} y={1590 - jump} kameez="#E88AA6" female dupatta="#F5C5D3" armR={-140 + Math.sin(frame / 5) * 10} armL={10} scale={1.15} flip />
      <Bag w={300} style={{ left: 470, top: 1260 }} />
      {items.map((it, i) => {
        const at = 30 + i * 28;
        const p = fade(frame, at, at + 24);
        const ang = (-150 + i * 40) * (Math.PI / 180);
        return (
          <div key={it.n} style={{ position: "absolute", left: 620 + Math.cos(ang) * 330 * p - 90, top: 1300 + Math.sin(ang) * 420 * p - 110, opacity: p, transform: `scale(${0.4 + p * 0.6}) rotate(${(1 - p) * 40}deg)`, textAlign: "center" }}>
            <div style={{ width: 180, height: 180, borderRadius: 90, background: "rgba(255,243,214,0.95)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 50px rgba(255,220,140,0.8)" }}>
              <Img src={staticFile(it.img)} style={{ maxWidth: 130, maxHeight: 130, objectFit: "contain" }} />
            </div>
            <div style={{ marginTop: 6, fontFamily: "Sora", fontWeight: 800, fontSize: 34, color: "#FFF3D6", textShadow: "0 2px 10px rgba(0,0,0,0.5)" }}>{it.n}</div>
          </div>
        );
      })}
    </Cam>
  );
};

// ---------- S5: a bag goes to the neighbour
const Neighbour: React.FC = () => {
  const frame = useCurrentFrame();
  const walk = fade(frame, 0, 80);
  const step = frame < 80 ? Math.abs(Math.sin(frame / 4)) * 10 : 0;
  const give = fade(frame, 80, 100);
  const heart = fade(frame, 100, 115);
  const door = (x: number, col: string) => (
    <div style={{ position: "absolute", left: x, top: 820, width: 440, height: 700, background: col }}>
      <div style={{ position: "absolute", left: 130, top: 300, width: 180, height: 400, borderRadius: "90px 90px 0 0", background: "#4A2C1E", border: "10px solid #2E1B12" }} />
      <div style={{ position: "absolute", left: 60, top: 80, width: 120, height: 140, background: "#FFD27A", opacity: 0.85, borderRadius: 8 }} />
      <div style={{ position: "absolute", left: 260, top: 80, width: 120, height: 140, background: "#FFD27A", opacity: 0.85, borderRadius: 8 }} />
    </div>
  );
  return (
    <Cam>
      <AbsoluteFill style={{ background: `linear-gradient(180deg, ${C.night}, ${C.night2})` }}><Stars n={50} /></AbsoluteFill>
      <Crescent size={150} x={830} y={180} />
      {door(40, "#7C5A43")}{door(560, "#8E6A4E")}
      <FairyLights y={760} sag={50} />
      <Lantern x={540} len={620} scale={0.8} phase={1} />
      <div style={{ position: "absolute", left: 0, right: 0, top: 1520, bottom: 0, background: "#2C2621" }} />
      <Person x={790} y={1530} kameez="#7E7A86" female dupatta="#B9B3C2" armR={-70 * give} armL={10} scale={1.5} flip />
      <Person x={interpolate(walk, [0, 1], [240, 600])} y={1540} bob={-step} kameez="#E88AA6" female dupatta="#F5C5D3" armR={-75} armL={10} scale={1.2} />
      <Bag w={120} style={{ left: interpolate(walk, [0, 1], [270, 630]) + give * 40, top: 1150 - step }} />
      <div style={{ position: "absolute", left: 690, top: 900 - heart * 80, opacity: heart * (1 - fade(frame, 125, 140)), fontSize: 110 }}>❤️</div>
    </Cam>
  );
};

// ---------- S6: family iftar, dua
const Iftar: React.FC = () => {
  const frame = useCurrentFrame();
  const dua = fade(frame, 20, 45);
  const glow = 0.6 + 0.4 * Math.sin(frame / 10);
  const people: PersonProps[] = [
    { x: 200, y: 1500, kameez: "#2F7A5B", female: true, dupatta: "#8E2B4A" },
    { x: 430, y: 1490, kameez: "#F3EFE6", vest: "#6B4A2E", beard: "white", topi: true },
    { x: 660, y: 1500, kameez: "#E88AA6", female: true, dupatta: "#F5C5D3", scale: 1.3 },
    { x: 880, y: 1500, kameez: "#7E7A86", female: true, dupatta: "#B9B3C2" },
  ];
  return (
    <Cam to={1.04}>
      <Room />
      <div style={{ position: "absolute", left: 300, top: 900, width: 500, height: 500, borderRadius: 500, background: `radial-gradient(circle, rgba(255,210,130,${0.35 * glow}), transparent 70%)` }} />
      {people.map((p, i) => <Person key={i} {...p} scale={p.scale ?? 1.45} seated dua={dua} armL={10 - 32 * dua} armR={-10 + 32 * dua} />)}
      {/* dastarkhwan */}
      <div style={{ position: "absolute", left: 40, right: 40, top: 1300, height: 520, background: "linear-gradient(180deg, #F3E6C8, #E5D2A8)", borderRadius: 24, boxShadow: "0 -10px 30px rgba(0,0,0,0.2)" }} />
      {[[140, "#6B3A1E"], [420, "#E09A3A"], [700, "#6B3A1E"]].map(([x, col], i) => (
        <div key={i} style={{ position: "absolute", left: x as number, top: 1400, width: 240, height: 120, borderRadius: "50%", background: "#FFFFFF", boxShadow: "0 8px 0 #D8CBB0" }}>
          {Array.from({ length: 7 }).map((_, k) => <div key={k} style={{ position: "absolute", left: 40 + (k % 4) * 40, top: 30 + Math.floor(k / 4) * 30, width: 38, height: i === 1 ? 32 : 22,
            borderRadius: i === 1 ? "40%" : 12, background: col as string }} />)}
        </div>
      ))}
      {[260, 560, 840].map((x) => <div key={x} style={{ position: "absolute", left: x, top: 1560, width: 70, height: 110, borderRadius: "8px 8px 16px 16px", background: "linear-gradient(180deg, rgba(255,255,255,0.6) 0 12%, #C8102E 12%)" }} />)}
      <div style={{ position: "absolute", left: 60, right: 60, top: 230, textAlign: "center", opacity: fade(frame, 60, 90) }}>
        <div style={{ fontFamily: "Fraunces", fontStyle: "italic", fontWeight: 600, fontSize: 100, lineHeight: 1.1, color: "#FFF3D6", textShadow: "0 4px 30px rgba(0,0,0,0.5)" }}>Aao, is Ramzan<br /><span style={{ color: C.gold }}>rehmatein baantein.</span></div>
      </div>
    </Cam>
  );
};

// ---------- S7: packages end card
const pk = [["01", 9, "2,149"], ["02", 13, "3,149"], ["03", 15, "5,249"], ["04", 17, "7,249"]] as const;
const EndCard: React.FC = () => {
  const frame = useCurrentFrame();
  const q = (d: number) => fade(frame, d, d + 20);
  return (
    <AbsoluteFill style={{ background: `linear-gradient(180deg, ${C.night}, ${C.night2})` }}>
      <Stars n={60} /><Pattern />
      <Crescent size={150} x={860} y={120} />
      <Lantern x={130} len={180} scale={0.7} />
      <AbsoluteFill style={{ alignItems: "center", paddingTop: 300, paddingLeft: 80, paddingRight: 80 }}>
        <Img src={staticFile("brand/zidane-logo-white.svg")} style={{ width: 520, opacity: q(0) }} />
        <div style={{ marginTop: 26, opacity: q(10), fontFamily: "Fraunces", fontStyle: "italic", fontWeight: 600, fontSize: 76, color: C.gold }}>Ramzan Packages 2027</div>
        <div style={{ marginTop: 50, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 26, width: "100%" }}>
          {pk.map(([no, n, price], i) => (
            <div key={no} style={{ opacity: q(24 + i * 10), transform: `translateY(${(1 - q(24 + i * 10)) * 30}px)`, border: `2px solid ${C.goldSoft}`, borderRadius: 28, padding: "28px 20px", textAlign: "center", background: "rgba(7,20,37,0.55)" }}>
              <div style={{ fontFamily: "Inter", fontWeight: 600, fontSize: 26, letterSpacing: "0.25em", color: C.goldSoft }}>PACKAGE</div>
              <div style={{ fontFamily: "Fraunces", fontStyle: "italic", fontWeight: 600, fontSize: 110, lineHeight: 1, color: C.gold }}>{no}</div>
              <div style={{ fontFamily: "Sora", fontWeight: 700, fontSize: 34, color: C.cream }}>{n} items</div>
              <div style={{ marginTop: 14, display: "inline-block", background: C.gold, color: C.night, borderRadius: 999, padding: "8px 26px", fontFamily: "Sora", fontWeight: 800, fontSize: 40 }}>PKR {price}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 18, opacity: q(70), fontFamily: "Inter", fontWeight: 500, fontSize: 25, color: "rgba(251,243,228,0.65)" }}>2026 reference prices · 2027 rate on quotation · items customizable</div>
        <div style={{ marginTop: 44, opacity: q(90), fontFamily: "Sora", fontWeight: 800, fontSize: 54, color: C.cream }}>WhatsApp 0339 2639315</div>
        <div style={{ marginTop: 8, opacity: q(100), fontFamily: "Sora", fontWeight: 700, fontSize: 40, color: C.gold }}>021 111 ZIDANE · zidane.com.pk</div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// [scene, length in frames]; voiceover line i plays in scene i
const SCENES: [React.FC, number][] = [[Warehouse, 195], [FactoryGate, 174], [Ride, 165], [Home, 210], [Neighbour, 144], [Iftar, 165], [EndCard, 300]];
const starts = SCENES.reduce<number[]>((a, [, len], i) => [...a, i === 0 ? 0 : a[i - 1] + SCENES[i - 1][1]], []);
const TOTAL = starts[starts.length - 1] + SCENES[SCENES.length - 1][1];
const VO_DELAY = [24, 14, 12, 14, 12, 50, 20];

export const RehmatStory: React.FC = () => (
  <AbsoluteFill style={{ background: "#000" }}>
    {SCENES.map(([S, len], i) => {
      const from = starts[i];
      return (
        <Sequence key={i} from={from} durationInFrames={len + (i < SCENES.length - 1 ? XF : 0)}>
          <XFade><S /></XFade>
        </Sequence>
      );
    })}
    {vo.lines.map((l, i) => {
      const dur = Math.ceil(l.dur * FPS);
      const at = starts[i] + VO_DELAY[i];
      return (
        <Sequence key={`vo${i}`} from={at} durationInFrames={dur + 10}>
          <Audio src={staticFile(`vo/ramadan-${i}.wav`)} volume={1} />
          <Subtitle text={l.sub} dur={dur + 10} />
        </Sequence>
      );
    })}
    <Audio src={staticFile("sfx/ramadan-bed.wav")} endAt={TOTAL} volume={(f) => interpolate(f, [0, 20, TOTAL - 45, TOTAL], [0, 0.32, 0.32, 0], clamp)} />
  </AbsoluteFill>
);

const XFade: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const frame = useCurrentFrame();
  return <AbsoluteFill style={{ opacity: interpolate(frame, [0, XF], [0, 1], clamp) }}>{children}</AbsoluteFill>;
};

export const RehmatStoryCompositions: React.FC = () => (
  <Composition id="RehmatStory" component={RehmatStory} durationInFrames={TOTAL} fps={FPS} width={1080} height={1920} />
);
