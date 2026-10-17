// "Atta se roti tak": warm editorial reel from three photos. Starts on the finished roti, rewinds,
// then plays the journey (atta → goondhna → tawa) and lands on Zidane's flour range.
import React from "react";
import { AbsoluteFill, Audio, Composition, Img, interpolate, random, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import "../Fonts";
import { products } from "../corporate/catalogData";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const ease = (x: number) => 1 - Math.pow(1 - x, 3);
const A = { cream: "#F4EADB", wheat: "#D9A55B", brown: "#3B2414", dim: "#8A6F58", red: "#D7262E", white: "#FFF8EE" };
const PAD = 90;

const IMG = {
  sack: { src: "atta/sack.jpg", ar: 678 / 452 },
  knead: { src: "atta/knead.jpg", ar: 739 / 415 },
  roti: { src: "atta/roti.jpg", ar: 480 / 640 },
};

// blurred fill + crisp photo card with slow push-in
const PhotoScene: React.FC<{ img: keyof typeof IMG; w: number; top?: number; pulse?: boolean; children?: React.ReactNode }> = ({ img, w, top = 250, pulse, children }) => {
  const frame = useCurrentFrame();
  const { src, ar } = IMG[img];
  const h = w / ar;
  const beat = pulse ? 1 + 0.025 * Math.max(0, Math.sin((frame / 20) * Math.PI)) : 1;
  const card = ease(interpolate(frame, [0, 16], [0, 1], clamp));
  return (
    <AbsoluteFill style={{ background: A.brown }}>
      <Img src={staticFile(src)} style={{ position: "absolute", inset: -80, width: "calc(100% + 160px)", height: "calc(100% + 160px)", objectFit: "cover", filter: "blur(40px) brightness(0.5) saturate(1.2)" }} />
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(59,36,20,0.1), rgba(59,36,20,0.75) 70%)" }} />
      <div style={{ position: "absolute", left: (1080 - w) / 2, top: top + (1 - card) * 60, width: w, height: h, borderRadius: 30, overflow: "hidden", opacity: card,
        boxShadow: "0 40px 80px rgba(0,0,0,0.45)", transform: `scale(${beat})` }}>
        <Img src={staticFile(src)} style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${1.04 + frame * 0.0009})` }} />
      </div>
      {children}
    </AbsoluteFill>
  );
};

const Kick: React.FC<{ children: React.ReactNode; color?: string; delay?: number }> = ({ children, color = A.wheat, delay = 0 }) => {
  const frame = useCurrentFrame();
  const p = ease(interpolate(frame, [delay, delay + 14], [0, 1], clamp));
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 18, opacity: p }}>
      <div style={{ width: 60 * p, height: 4, background: A.red }} />
      <div style={{ fontFamily: "Inter", fontWeight: 600, fontSize: 30, letterSpacing: "0.2em", textTransform: "uppercase", color }}>{children}</div>
    </div>
  );
};
const Line: React.FC<{ delay: number; children: React.ReactNode; italic?: boolean; color?: string; size?: number }> = ({ delay, children, italic, color = A.white, size = 96 }) => {
  const frame = useCurrentFrame();
  const p = ease(interpolate(frame, [delay, delay + 16], [0, 1], clamp));
  return (
    <div style={{ overflow: "hidden", paddingBottom: 12 }}>
      <div style={{ transform: `translateY(${(1 - p) * 110}%)`, fontFamily: italic ? "Fraunces" : "Sora", fontStyle: italic ? "italic" : "normal", fontWeight: italic ? 600 : 700,
        fontSize: italic ? size * 1.08 : size, lineHeight: 1.04, letterSpacing: italic ? "-0.01em" : "-0.035em", color }}>{children}</div>
    </div>
  );
};
const TextBlock: React.FC<{ top: number; children: React.ReactNode }> = ({ top, children }) => (
  <div style={{ position: "absolute", left: PAD, right: PAD, top }}>{children}</div>
);

// flour dust floating up
const Dust: React.FC<{ n?: number; area?: [number, number, number, number] }> = ({ n = 40, area = [120, 300, 840, 600] }) => {
  const frame = useCurrentFrame();
  return (
    <>
      {Array.from({ length: n }).map((_, i) => {
        const r = (k: string) => random(`${k}${i}`);
        const life = 60 + r("l") * 60, t = ((frame + r("o") * life) % life) / life;
        const x = area[0] + r("x") * area[2] + Math.sin((frame + i * 20) / 18) * 20;
        const y = area[1] + area[3] - t * (area[3] + 80);
        const s = 3 + r("s") * 7;
        return <div key={i} style={{ position: "absolute", left: x, top: y, width: s, height: s, borderRadius: "50%", background: "#fff", opacity: Math.sin(t * Math.PI) * 0.75, filter: "blur(1px)" }} />;
      })}
    </>
  );
};

// steam wisps rising
const Steam: React.FC<{ x: number; y: number }> = ({ x, y }) => {
  const frame = useCurrentFrame();
  return (
    <svg width={500} height={600} style={{ position: "absolute", left: x - 250, top: y - 560, filter: "blur(10px)", overflow: "visible" }}>
      {[0, 1, 2].map((i) => {
        const t = ((frame + i * 25) % 75) / 75;
        const dx = 150 + i * 100;
        return (
          <path key={i} d={`M${dx} 580 C ${dx - 60} 460, ${dx + 60} 360, ${dx} 240 S ${dx - 40} 80, ${dx + 20} 0`} stroke="#fff" strokeWidth={26} fill="none" strokeLinecap="round"
            opacity={Math.sin(t * Math.PI) * 0.35} transform={`translate(${Math.sin((frame + i * 30) / 15) * 14} ${-t * 140})`} />
        );
      })}
    </svg>
  );
};

const Fade: React.FC<{ len: number; children: React.ReactNode }> = ({ len, children }) => {
  const frame = useCurrentFrame();
  return <AbsoluteFill style={{ opacity: interpolate(frame, [0, 8, len - 6, len], [0, 1, 1, 0], clamp) }}>{children}</AbsoluteFill>;
};

// ── Hook: roti, then rewind ──
const Hook: React.FC = () => {
  const frame = useCurrentFrame();
  const rw = frame >= 52;
  const order: (keyof typeof IMG)[] = ["roti", "knead", "sack", "knead", "sack"];
  const which = rw ? order[Math.min(order.length - 1, Math.floor((frame - 52) / 4))] : "roti";
  const jitter = rw ? (random(`j${frame}`) - 0.5) * 40 : 0;
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ transform: `translateX(${jitter}px) skewX(${rw ? jitter * 0.15 : 0}deg)`, filter: rw ? "contrast(1.2) saturate(0.7)" : "none" }}>
        <PhotoScene img={which} w={which === "roti" ? 760 : 960} top={which === "roti" ? 220 : 360}>
          {!rw && <Steam x={540} y={560} />}
        </PhotoScene>
      </AbsoluteFill>
      {rw && (
        <AbsoluteFill style={{ pointerEvents: "none" }}>
          <AbsoluteFill style={{ backgroundImage: "repeating-linear-gradient(0deg, rgba(255,255,255,0.08) 0 2px, transparent 2px 6px)" }} />
          <div style={{ position: "absolute", left: 0, right: 0, top: 200 + ((frame * 97) % 1400), height: 30, background: "rgba(255,255,255,0.25)" }} />
          <div style={{ position: "absolute", left: 70, top: 120, fontFamily: "Inter", fontWeight: 700, fontSize: 56, color: "#fff", textShadow: "0 3px 10px #000" }}>◀◀ REWIND</div>
        </AbsoluteFill>
      )}
      {!rw && (
        <TextBlock top={1300}>
          <Line delay={6}>Ek garam roti…</Line>
          <Line delay={20} italic color={A.wheat}>shuru kahan se hoti hai?</Line>
        </TextBlock>
      )}
    </AbsoluteFill>
  );
};

const Step: React.FC<{ img: keyof typeof IMG; n: string; l1: string; l2: string; w?: number; top?: number; textTop: number; pulse?: boolean; extra?: React.ReactNode }> = ({ img, n, l1, l2, w = 960, top = 300, textTop, pulse, extra }) => (
  <PhotoScene img={img} w={w} top={top} pulse={pulse}>
    {extra}
    <TextBlock top={textTop}>
      <Kick delay={6}>{n}</Kick>
      <div style={{ marginTop: 26 }}>
        <Line delay={10}>{l1}</Line>
        <Line delay={18} italic color={A.wheat}>{l2}</Line>
      </div>
    </TextBlock>
  </PhotoScene>
);

// ── Zidane flour range ──
const range = [
  { id: "1200458", t: "Chakki Atta" },
  { id: "1018134", t: "Super Fine Atta" },
  { id: "1015980", t: "Fine Atta 10kg" },
  { id: "1056341", t: "Maida" },
];
const Range: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 60%, #FBF3E6, ${A.cream} 70%)` }}>
      <Wheat k={0.55} />
      <TextBlock top={230}>
        <Kick delay={2} color={A.dim}>Zidane · Atta desk</Kick>
        <div style={{ marginTop: 26 }}>
          <Line delay={6} color={A.brown}>Canteen mein roz</Line>
          <Line delay={14} italic color={A.red}>sainkron rotiyan?</Line>
        </div>
      </TextBlock>
      <div style={{ position: "absolute", left: 50, right: 50, top: 760, display: "flex", justifyContent: "space-between" }}>
        {range.map((r, i) => {
          const p = spring({ frame: frame - 26 - i * 5, fps, config: { damping: 14, stiffness: 140 } });
          const img = products.find((x) => x.id === r.id)?.img ?? `catalog/${r.id}.png`;
          return (
            <div key={r.id} style={{ width: 230, display: "flex", flexDirection: "column", alignItems: "center", opacity: p, transform: `translateY(${(1 - p) * 120}px)` }}>
              <div style={{ height: 380, display: "flex", alignItems: "flex-end" }}>
                <Img src={staticFile(img)} style={{ maxHeight: 380, maxWidth: 230, objectFit: "contain", filter: "drop-shadow(0 24px 24px rgba(59,36,20,0.25))" }} />
              </div>
              <div style={{ marginTop: 22, fontFamily: "Sora", fontWeight: 700, fontSize: 30, color: A.brown, textAlign: "center" }}>{r.t}</div>
            </div>
          );
        })}
      </div>
      <TextBlock top={1330}>
        <Line delay={52} color={A.brown} size={88}>Atta hum laayenge.</Line>
        <div style={{ marginTop: 22, opacity: interpolate(frame, [60, 72], [0, 1], clamp), fontFamily: "Inter", fontWeight: 600, fontSize: 32, lineHeight: 1.5, color: A.dim }}>
          Bulk supply for factories, offices, hospitals, schools &amp; HoReCa across Karachi.
        </div>
      </TextBlock>
    </AbsoluteFill>
  );
};

// soft wheat stalks in the corners
const Wheat: React.FC<{ k?: number }> = ({ k: ks = 1 }) => {
  const frame = useCurrentFrame();
  const stalk = (x: number, y: number, rot: number, s: number, k: number) => (
    <g key={k} transform={`translate(${x} ${y}) rotate(${rot + Math.sin((frame + k * 30) / 30) * 2}) scale(${s})`}>
      <path d="M0 0 L0 -420" stroke={A.wheat} strokeWidth={6} opacity={0.6} />
      {Array.from({ length: 9 }).map((_, i) => (
        <g key={i} transform={`translate(0 ${-200 - i * 24})`}>
          <ellipse cx={-14} cy={0} rx={10} ry={22} transform="rotate(-25)" fill={A.wheat} opacity={0.55} />
          <ellipse cx={14} cy={0} rx={10} ry={22} transform="rotate(25)" fill={A.wheat} opacity={0.55} />
        </g>
      ))}
    </g>
  );
  return (
    <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
      {stalk(-10, 1960, 18, 1.6 * ks, 1)}{stalk(60, 1980, 8, 1.3 * ks, 2)}{stalk(1090, 1960, -18, 1.6 * ks, 3)}{stalk(1020, 1990, -6, 1.2 * ks, 4)}
    </svg>
  );
};

// ── End card ──
const End: React.FC = () => {
  const frame = useCurrentFrame();
  const logo = ease(interpolate(frame, [2, 20], [0, 1], clamp));
  const rows = ease(interpolate(frame, [30, 46], [0, 1], clamp));
  return (
    <AbsoluteFill style={{ background: A.cream }}>
      <Wheat />
      <div style={{ position: "absolute", left: PAD, right: PAD, top: 520 }}>
        <div style={{ opacity: logo, transform: `translateY(${(1 - logo) * 30}px)` }}><Img src={staticFile("brand/zidane-logo.svg")} style={{ width: 520 }} /></div>
        <div style={{ marginTop: 70 }}>
          <Line delay={12} color={A.brown} size={84}>Har roti ki shuruaat,</Line>
          <Line delay={20} italic color={A.red} size={84}>sahi atte se.</Line>
        </div>
        <div style={{ marginTop: 90, opacity: rows }}>
          {[["Email", "sales@zidane.com.pk"], ["Web", "zidane.com.pk"]].map(([k, v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "28px 0", borderTop: `2px solid rgba(59,36,20,0.18)`, fontFamily: "Inter" }}>
              <span style={{ fontSize: 30, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: A.dim }}>{k}</span>
              <span style={{ fontSize: 44, fontWeight: 600, color: A.brown }}>{v}</span>
            </div>
          ))}
          <div style={{ borderTop: `2px solid rgba(59,36,20,0.18)` }} />
        </div>
      </div>
    </AbsoluteFill>
  );
};

const T = { s1: 75, s2: 165, s3: 255, s4: 345, s5: 450, end: 555 };
export const AttaRoti: React.FC = () => {
  const { durationInFrames } = useVideoConfig();
  return (
    <AbsoluteFill style={{ background: A.brown }}>
      <Sequence durationInFrames={T.s1}><Hook /></Sequence>
      <Sequence from={T.s1} durationInFrames={T.s2 - T.s1}><Fade len={T.s2 - T.s1}>
        <Step img="sack" n="01 · Atta" l1="Sab se pehle," l2="sahi atta." textTop={1080} extra={<Dust />} />
      </Fade></Sequence>
      <Sequence from={T.s2} durationInFrames={T.s3 - T.s2}><Fade len={T.s3 - T.s2}>
        <Step img="knead" n="02 · Goondhna" l1="Phir paani," l2="aur thodi mehnat." top={360} textTop={1060} pulse extra={<Dust n={18} area={[120, 380, 840, 500]} />} />
      </Fade></Sequence>
      <Sequence from={T.s3} durationInFrames={T.s4 - T.s3}><Fade len={T.s4 - T.s3}>
        <Step img="roti" n="03 · Tawa" l1="Aur garam garam" l2="roti tayyar." w={680} top={200} textTop={1220} extra={<Steam x={540} y={480} />} />
      </Fade></Sequence>
      <Sequence from={T.s4} durationInFrames={T.s5 - T.s4}><Fade len={T.s5 - T.s4}><Range /></Fade></Sequence>
      <Sequence from={T.s5} durationInFrames={T.end - T.s5}><End /></Sequence>
      {/* audio */}
      <Audio src={staticFile("sfx/atta-bed.wav")} endAt={durationInFrames} volume={(f) => interpolate(f, [0, 8, 50, 54, 76, 82, durationInFrames - 20, durationInFrames], [0, 0.85, 0.85, 0.15, 0.15, 0.85, 0.85, 0], clamp)} />
      <Sequence from={52} durationInFrames={28}><Audio src={staticFile("sfx/atta-rewind.wav")} volume={0.8} /></Sequence>
      <Sequence from={T.s1} durationInFrames={25}><Audio src={staticFile("sfx/whoosh.wav")} volume={0.3} /></Sequence>
      <Sequence from={T.s3} durationInFrames={80}><Audio src={staticFile("sfx/tawa-sizzle.wav")} volume={0.35} /></Sequence>
      {range.map((_, i) => <Sequence key={i} from={T.s4 + 26 + i * 5} durationInFrames={15}><Audio src={staticFile("sfx/pop.wav")} volume={0.35} /></Sequence>)}
    </AbsoluteFill>
  );
};

export const AttaCompositions: React.FC = () => (
  <Composition id="AttaRoti" component={AttaRoti} durationInFrames={T.end} fps={30} width={1080} height={1920} />
);
