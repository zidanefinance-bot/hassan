// "Zidane Mode": 60s crazy hype reel cut to public/sfx/hype-bed.wav (128 BPM, 32 bars).
// Every cut, slam and shake lands on the beat grid below. Music: scripts/gen-hype-audio.py
import React from "react";
import { AbsoluteFill, Audio, Composition, Img, interpolate, OffthreadVideo, random, Sequence, staticFile, useCurrentFrame } from "remotion";
import "../Fonts";
import { corp } from "../corporate/kit";
import products from "../../public/catalog/products.json";

const FPS = 30;
const BEAT = (60 / 128) * FPS; // 14.0625 frames
const fb = (beats: number) => Math.round(beats * BEAT); // beat -> frame
const TOTAL = fb(128); // 60s
const clamp = corp.clamp;
const RED = corp.red;
const YEL = "#FFC93C";

// beats into the current beat (0..1) for a local frame
const beatPhase = (frame: number) => (frame / BEAT) % 1;
// punch: 1 on the beat, decays fast
const punch = (frame: number, k = 6) => Math.exp(-beatPhase(frame) * k);

const Grain: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <svg width="100%" height="100%" style={{ position: "absolute", inset: 0, opacity: 0.12, mixBlendMode: "overlay", pointerEvents: "none" }}>
      <filter id={`g${frame % 4}`}><feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves={2} seed={frame % 4} /></filter>
      <rect width="100%" height="100%" filter={`url(#g${frame % 4})`} />
    </svg>
  );
};

// big slam word: scales down from huge, with chromatic red/cyan ghosts on the hit
const Slam: React.FC<{ text: string; size?: number; color?: string; at?: number; y?: number; font?: string }> = ({ text, size = 200, color = "#fff", at = 0, y = 0, font = "Passion One" }) => {
  const frame = useCurrentFrame() - at;
  if (frame < 0) return null;
  const p = interpolate(frame, [0, 5], [0, 1], { easing: corp.out, ...clamp });
  const s = interpolate(p, [0, 1], [2.4, 1]);
  const ghost = interpolate(frame, [0, 8], [26, 0], clamp);
  const base: React.CSSProperties = { position: "absolute", left: 0, right: 0, textAlign: "center", fontFamily: font, fontWeight: 900, fontSize: size, lineHeight: 0.95,
    letterSpacing: font === "Passion One" ? "0.01em" : "-0.04em", textTransform: "uppercase", whiteSpace: "pre-line" };
  return (
    <AbsoluteFill style={{ justifyContent: "center", transform: `translateY(${y}px) scale(${s})`, opacity: p }}>
      <div style={{ position: "relative", height: size }}>
        {ghost > 0.5 && <div style={{ ...base, color: "#00E5FF", transform: `translateX(${-ghost}px)`, mixBlendMode: "screen", opacity: 0.8 }}>{text}</div>}
        {ghost > 0.5 && <div style={{ ...base, color: "#FF2D55", transform: `translateX(${ghost}px)`, mixBlendMode: "screen", opacity: 0.8 }}>{text}</div>}
        <div style={{ ...base, color, textShadow: "0 10px 40px rgba(0,0,0,0.5)", top: 0 }}>{text}</div>
      </div>
    </AbsoluteFill>
  );
};

const Clip: React.FC<{ clip: string; from?: number; zoom?: number; filter?: string }> = ({ clip, from = 0, zoom = 1.08, filter = "contrast(1.15) saturate(1.2)" }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ transform: `scale(${zoom + punch(frame) * 0.05 + frame * 0.0015})` }}>
      <OffthreadVideo src={staticFile(`realvid/${clip}.mp4`)} startFrom={Math.round(from * FPS)} muted style={{ width: "100%", height: "100%", objectFit: "cover", filter }} />
    </AbsoluteFill>
  );
};

// ---------- 1. HOOK (bars 0-1, beats 0-7): 1 bag... 10,000 bags? Koi masla nahi.
const hookWords = ["1 bag", "10 bags", "100 bags", "1,000", "10,000\nbags?", "Koi", "masla", "nahi."];
const Hook: React.FC = () => {
  const frame = useCurrentFrame();
  const i = Math.min(7, Math.floor(frame / BEAT));
  const shake = punch(frame, 8) * (6 + i * 3);
  return (
    <AbsoluteFill style={{ background: i % 2 ? "#000" : i >= 5 ? RED : "#111", transform: `translate(${(random(`hx${frame}`) - 0.5) * shake}px, ${(random(`hy${frame}`) - 0.5) * shake}px)` }}>
      <Sequence from={fb(i)} durationInFrames={fb(1) + 1} layout="none">
        <Slam text={hookWords[i]} size={i === 4 ? 230 : 260} color={i >= 5 ? "#fff" : i === 4 ? YEL : "#fff"} />
      </Sequence>
      <div style={{ position: "absolute", bottom: 220, left: 0, right: 0, textAlign: "center", fontFamily: "Inter", fontWeight: 600, fontSize: 34, letterSpacing: "0.3em", color: "rgba(255,255,255,0.55)" }}>
        KARACHI · B2B GROCERY
      </div>
    </AbsoluteFill>
  );
};

// ---------- 2. DROP 1 (bars 2-5, beats 0-15): logo slam then a grocery word per beat over real footage
const dropWords = ["", "", "Atta", "Chawal", "Cheeni", "Daal", "Oil", "Ghee", "Masala", "Chai", "Doodh", "Maida", "Chana", "Basmati", "Sab", "kuch."];
const dropClips: [string, number][] = [["hero", 0.2], ["stock", 0.2], ["stock", 3.6], ["packing", 0.4], ["hero", 2.6], ["ration-program", 0.7], ["dispatch", 1.0], ["dispatch", 3.6]];
const DropOne: React.FC = () => {
  const frame = useCurrentFrame();
  const b = Math.floor(frame / BEAT);
  const flash = interpolate(frame % fb(4), [0, 6], [0.9, 0], clamp);
  const shake = punch(frame, 7) * 18;
  return (
    <AbsoluteFill style={{ background: "#000", transform: `translate(${(random(`dx${frame}`) - 0.5) * shake}px, ${(random(`dy${frame}`) - 0.5) * shake}px) rotate(${(random(`dr${frame}`) - 0.5) * shake * 0.08}deg)` }}>
      {dropClips.map(([c, f], i) => (
        <Sequence key={i} from={fb(i * 2)} durationInFrames={fb(2) + 1}><Clip clip={c} from={f} /></Sequence>
      ))}
      <AbsoluteFill style={{ background: "radial-gradient(circle, transparent 30%, rgba(0,0,0,0.75))" }} />
      {b < 2 ? (
        <AbsoluteFill style={{ background: "rgba(0,0,0,0.55)", justifyContent: "center", alignItems: "center" }}>
          <Img src={staticFile("brand/zidane-logo-white.svg")} style={{ width: 860, transform: `scale(${interpolate(frame, [0, 6], [2.6, 1], { easing: corp.out, ...clamp }) + punch(frame) * 0.04})` }} />
        </AbsoluteFill>
      ) : (
        dropWords.map((w, i) => i >= 2 && (
          <Sequence key={i} from={fb(i)} durationInFrames={fb(1) + 1} layout="none">
            <Slam text={w} size={i >= 14 ? 300 : 250} color={i % 3 === 0 ? YEL : "#fff"} y={i >= 14 ? 0 : 520} />
          </Sequence>
        ))
      )}
      <AbsoluteFill style={{ background: "#fff", opacity: flash }} />
    </AbsoluteFill>
  );
};

// ---------- 3. PRODUCT STORM (bars 6-11, 24 beats): 107 real catalog products fly out of a red vortex
const cats = ["Oil & Ghee", "Masala", "Doodh & Dairy", "Chai & Coffee", "Daal & Chana", "Chawal", "Atta & Maida", "Cheeni", "Essentials", "Bulk mein", "Best rates", "Ek supplier"];
const Storm: React.FC = () => {
  const frame = useCurrentFrame();
  const dur = fb(24);
  const p = punch(frame, 5);
  const count = Math.round(interpolate(frame, [fb(0), fb(6)], [0, 100], { easing: corp.out, ...clamp }));
  const catIdx = Math.min(cats.length - 1, Math.floor(frame / fb(2)));
  return (
    <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 46%, #ff3b3b, ${RED} 40%, #5a0b10 100%)`, overflow: "hidden" }}>
      {/* rotating sun rays */}
      <AbsoluteFill style={{ transform: `rotate(${frame * 0.6}deg) scale(${2.2 + p * 0.06})`, opacity: 0.18 }}>
        <div style={{ position: "absolute", inset: 0, background: "repeating-conic-gradient(from 0deg at 50% 50%, #fff 0deg 7deg, transparent 7deg 22.5deg)" }} />
      </AbsoluteFill>
      {/* product vortex */}
      {products.map((pr, i) => {
        const start = Math.floor(i * (dur - 30) / products.length);
        const life = 42;
        const t = (frame - start) / life;
        if (t < 0 || t > 1) return null;
        const ang = random(`a${i}`) * Math.PI * 2 + t * 1.4;
        const r = interpolate(t, [0, 1], [0, 1300], { easing: corp.in });
        const s = interpolate(t, [0, 1], [0.15, 2.6]);
        return (
          <Img key={pr.id} src={staticFile(pr.img)} style={{ position: "absolute", left: 540 + Math.cos(ang) * r - 110, top: 880 + Math.sin(ang) * r * 1.2 - 160, height: 320,
            transform: `scale(${s}) rotate(${(random(`r${i}`) - 0.5) * 120 * t}deg)`, opacity: interpolate(t, [0, 0.1, 0.85, 1], [0, 1, 1, 0]), filter: "drop-shadow(0 20px 30px rgba(0,0,0,0.45))" }} />
        );
      })}
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", transform: `scale(${1 + p * 0.06})` }}>
        <div style={{ fontFamily: "Passion One", fontWeight: 900, fontSize: 380, lineHeight: 0.9, color: "#fff", textShadow: "0 16px 60px rgba(0,0,0,0.45)" }}>{count}{count >= 100 ? "+" : ""}</div>
        <div style={{ fontFamily: "Sora", fontWeight: 800, fontSize: 72, letterSpacing: "0.12em", color: YEL, marginTop: -10 }}>PRODUCTS</div>
        <div style={{ marginTop: 60, background: "#000", color: "#fff", padding: "18px 44px", borderRadius: 999, fontFamily: "Sora", fontWeight: 800, fontSize: 64,
          transform: `scale(${interpolate(frame % fb(2), [0, 6], [1.4, 1], { easing: corp.out, ...clamp })})` }}>{cats[catIdx]}</div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ---------- 4. BUILD (bars 12-15, 16 beats): any list format, accelerating to the drop
const formats = ["EXCEL", "CSV", "PDF RFQ", "WHATSAPP LIST", "HAATH SE LIKHI LIST 📸"];
const Build: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / fb(16);
  const shake = t > 0.5 ? (t - 0.5) * 30 * (random(`bs${frame}`) - 0.5) : 0;
  const head = interpolate(frame, [0, 12], [0, 1], { easing: corp.out, ...clamp });
  const countdown = ["3", "2", "1"];
  const cdStart = fb(13);
  return (
    <AbsoluteFill style={{ background: "#0B0B0D", transform: `translate(${shake}px, ${-shake}px) scale(${1 + t * t * 0.25})` }}>
      <AbsoluteFill style={{ opacity: 0.35 }}><Clip clip="ration-program" from={1.5} filter="grayscale(1) contrast(1.3) brightness(0.6)" /></AbsoluteFill>
      {frame < cdStart ? (
        <AbsoluteFill style={{ padding: "0 90px", justifyContent: "center" }}>
          <div style={{ opacity: head, fontFamily: "Sora", fontWeight: 800, fontSize: 92, lineHeight: 1.05, color: "#fff", letterSpacing: "-0.03em" }}>
            Aapki list<br /><span style={{ color: RED }}>kaisi bhi ho…</span>
          </div>
          <div style={{ marginTop: 60, display: "flex", flexDirection: "column", gap: 26, alignItems: "flex-start" }}>
            {formats.map((f, i) => {
              const at = fb(3 + i * 1.5);
              const q = interpolate(frame, [at, at + 6], [0, 1], { easing: corp.out, ...clamp });
              return (
                <div key={f} style={{ opacity: q, transform: `translateX(${(1 - q) * -400}px) rotate(${(i % 2 ? 1 : -1) * 2}deg)`, background: i % 2 ? "#fff" : YEL, color: "#000",
                  padding: "16px 34px", borderRadius: 16, fontFamily: "Sora", fontWeight: 800, fontSize: 58 }}>{f}</div>
              );
            })}
          </div>
          <div style={{ marginTop: 56, opacity: interpolate(frame, [fb(11), fb(11) + 6], [0, 1], clamp), fontFamily: "Passion One", fontSize: 130, color: "#fff" }}>BAS BHEJ DO.</div>
        </AbsoluteFill>
      ) : (
        countdown.map((c, i) => (
          <Sequence key={c} from={cdStart + fb(i * 0.9)} durationInFrames={fb(0.9) + 1} layout="none"><Slam text={c} size={600} color={i === 2 ? RED : "#fff"} /></Sequence>
        ))
      )}
    </AbsoluteFill>
  );
};

// ---------- 5. DROP 2 (bars 16-21, 24 beats): custom ration bags, strobing footage grid, price
const grid: [string, number][] = [["packing", 0.4], ["ration-program", 0.7], ["stock", 1.5], ["dispatch", 1.0]];
const promises = ["Aapke items.", "Aapki branding.", "Aapka delivery plan."];
const DropTwo: React.FC = () => {
  const frame = useCurrentFrame();
  const b = Math.floor(frame / BEAT);
  const shake = punch(frame, 7) * 14;
  const flash = interpolate(frame % fb(4), [0, 5], [0.85, 0], clamp);
  const priceAt = fb(14);
  const price = Math.round(interpolate(frame, [priceAt, priceAt + fb(4)], [0, 2149], { easing: corp.out, ...clamp }));
  return (
    <AbsoluteFill style={{ background: "#000", transform: `translate(${(random(`ex${frame}`) - 0.5) * shake}px, ${(random(`ey${frame}`) - 0.5) * shake}px)` }}>
      <AbsoluteFill style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr" }}>
        {grid.map(([c, f], i) => {
          const lit = (b + i) % 4 === 0 || b < 2;
          return (
            <div key={i} style={{ position: "relative", overflow: "hidden", opacity: lit ? 1 : 0.35 }}>
              <OffthreadVideo src={staticFile(`realvid/${c}.mp4`)} startFrom={Math.round(f * FPS)} muted
                style={{ width: "100%", height: "100%", objectFit: "cover", filter: lit ? "contrast(1.2) saturate(1.3)" : "grayscale(1) brightness(0.7)", transform: `scale(${1.1 + (lit ? punch(frame) * 0.08 : 0)})` }} />
            </div>
          );
        })}
      </AbsoluteFill>
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.2), rgba(0,0,0,0.75))" }} />
      {frame < fb(8) && <Slam text={"Custom\nration bags"} size={210} color="#fff" y={-110} />}
      {frame >= fb(8) && frame < priceAt && promises.map((w, i) => (
        <Sequence key={w} from={fb(8 + i * 2)} durationInFrames={fb(2) + 1} layout="none">
          <Slam text={w} size={150} color={i === 1 ? YEL : "#fff"} font="Sora" />
        </Sequence>
      ))}
      {frame >= priceAt && (
        <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", background: "rgba(194,42,47,0.82)" }}>
          <div style={{ fontFamily: "Sora", fontWeight: 800, fontSize: 64, color: "#fff", letterSpacing: "0.08em" }}>RATION BAGS SIRF</div>
          <div style={{ fontFamily: "Passion One", fontSize: 230, lineHeight: 1, whiteSpace: "nowrap", color: YEL, transform: `scale(${1 + punch(frame) * 0.05})` }}>PKR {price.toLocaleString("en-US")}</div>
          <div style={{ fontFamily: "Sora", fontWeight: 800, fontSize: 72, color: "#fff" }}>se shuru!</div>
          <div style={{ marginTop: 40, fontFamily: "Inter", fontWeight: 600, fontSize: 34, color: "rgba(255,255,255,0.8)" }}>Reference package · items aap chuno</div>
        </AbsoluteFill>
      )}
      <AbsoluteFill style={{ background: "#fff", opacity: flash }} />
    </AbsoluteFill>
  );
};

// ---------- 6. WHO (bars 22-25, 16 beats): sectors flash every 2 beats on red-duotone footage
const sectors = ["Textile", "Factories", "Corporate", "Healthcare", "Schools &\nHostels", "NGOs", "Restaurants", "Project sites"];
const whoClips: [string, number][] = [["dispatch", 0.5], ["hero", 1.2], ["packing", 2.2], ["stock", 2.8], ["ration-program", 2.4], ["hero", 4.2], ["dispatch", 2.6], ["packing", 3.8]];
const Who: React.FC = () => {
  const frame = useCurrentFrame();
  const i = Math.min(7, Math.floor(frame / fb(2)));
  return (
    <AbsoluteFill style={{ background: RED }}>
      {whoClips.map(([c, f], k) => (
        <Sequence key={k} from={fb(k * 2)} durationInFrames={fb(2) + 1}>
          <AbsoluteFill style={{ mixBlendMode: "multiply" }}><Clip clip={c} from={f} filter="grayscale(1) contrast(1.4) brightness(1.1)" /></AbsoluteFill>
        </Sequence>
      ))}
      <div style={{ position: "absolute", top: 300, left: 0, right: 0, textAlign: "center", fontFamily: "Sora", fontWeight: 800, fontSize: 56, letterSpacing: "0.25em", color: "#fff" }}>SUPPLY FOR</div>
      <Sequence from={fb(i * 2)} durationInFrames={fb(2) + 1} layout="none"><Slam text={sectors[i]} size={200} /></Sequence>
      <div style={{ position: "absolute", bottom: 260, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 18 }}>
        {sectors.map((_, k) => <div key={k} style={{ width: k === i ? 60 : 18, height: 18, borderRadius: 9, background: k <= i ? "#fff" : "rgba(255,255,255,0.35)" }} />)}
      </div>
    </AbsoluteFill>
  );
};

// ---------- 7. FINALE (bars 26-31, 24 beats): Groceries for business. -> logo + contacts on the final hit
const Finale: React.FC = () => {
  const frame = useCurrentFrame();
  const hit = fb(16); // bar 30
  const words = ["Groceries", "for", "business."];
  if (frame < hit) {
    return (
      <AbsoluteFill style={{ background: "#000", transform: `scale(${1 + punch(frame) * 0.03})` }}>
        <AbsoluteFill style={{ opacity: 0.3 }}><Clip clip="hero" from={0.5} filter="contrast(1.2) brightness(0.7)" /></AbsoluteFill>
        <AbsoluteFill style={{ padding: "0 90px", justifyContent: "center" }}>
          {words.map((w, i) => {
            const at = fb(i * 4);
            const q = interpolate(frame, [at, at + 6], [0, 1], { easing: corp.out, ...clamp });
            return <div key={w} style={{ opacity: q, transform: `scale(${interpolate(q, [0, 1], [1.8, 1])})`, transformOrigin: "left center", fontFamily: "Sora", fontWeight: 800,
              fontSize: 168, lineHeight: 1.02, letterSpacing: "-0.045em", color: i === 2 ? RED : "#fff" }}>{w}</div>;
          })}
        </AbsoluteFill>
      </AbsoluteFill>
    );
  }
  const f = frame - hit;
  const q = (d: number) => interpolate(f, [d, d + 10], [0, 1], { easing: corp.out, ...clamp });
  const rows = [["WhatsApp", "0339 2639315"], ["UAN", "021 111 ZIDANE"], ["Web", "zidane.com.pk"]];
  return (
    <AbsoluteFill style={{ background: RED, overflow: "hidden" }}>
      {products.slice(0, 40).map((pr, i) => {
        const ang = (i / 40) * Math.PI * 2;
        const r = interpolate(f, [0, 30], [0, 900 + random(`fr${i}`) * 500], { easing: corp.out, ...clamp });
        return <Img key={pr.id} src={staticFile(pr.img)} style={{ position: "absolute", left: 540 + Math.cos(ang) * r - 60, top: 960 + Math.sin(ang) * r * 1.3 - 90, height: 180,
          opacity: interpolate(f, [0, 4, 40, 60], [0, 1, 1, 0.25], clamp), transform: `rotate(${ang * 57 + f}deg)` }} />;
      })}
      <AbsoluteFill style={{ background: "#fff", opacity: interpolate(f, [0, 8], [1, 0], clamp) }} />
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: "0 80px" }}>
        <Img src={staticFile("brand/zidane-logo-white.svg")} style={{ width: 820, transform: `scale(${interpolate(f, [0, 8], [2.2, 1], { easing: corp.out, ...clamp })})` }} />
        <div style={{ marginTop: 24, opacity: q(10), fontFamily: "Sora", fontWeight: 800, fontSize: 60, color: YEL }}>Groceries for business.</div>
        <div style={{ marginTop: 80, width: "100%", display: "flex", flexDirection: "column", gap: 20 }}>
          {rows.map(([k, v], i) => (
            <div key={k} style={{ opacity: q(22 + i * 6), transform: `translateY(${(1 - q(22 + i * 6)) * 40}px)`, display: "flex", justifyContent: "space-between", alignItems: "center",
              background: "rgba(0,0,0,0.35)", borderRadius: 24, padding: "24px 40px" }}>
              <span style={{ fontFamily: "Inter", fontWeight: 600, fontSize: 38, color: "rgba(255,255,255,0.75)" }}>{k}</span>
              <span style={{ fontFamily: "Sora", fontWeight: 800, fontSize: 56, color: "#fff" }}>{v}</span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 60, opacity: q(46), background: "#fff", color: RED, padding: "22px 56px", borderRadius: 999, fontFamily: "Sora", fontWeight: 800, fontSize: 56,
          transform: `scale(${1 + Math.sin(f / 6) * 0.03})` }}>Aaj hi quote mangwao →</div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// [component, start beat, length in beats]
const scenes: [React.FC, number, number][] = [[Hook, 0, 8], [DropOne, 8, 16], [Storm, 24, 24], [Build, 48, 16], [DropTwo, 64, 24], [Who, 88, 16], [Finale, 104, 24]];

export const ZidaneMode: React.FC = () => (
  <AbsoluteFill style={{ background: "#000" }}>
    {scenes.map(([C, at, len], i) => (
      <Sequence key={i} from={fb(at)} durationInFrames={fb(at + len) - fb(at)}><C /></Sequence>
    ))}
    <Grain />
    <Audio src={staticFile("sfx/hype-bed.wav")} />
    {[24, 48, 88].map((b) => <Sequence key={b} from={fb(b) - 20} durationInFrames={30}><Audio src={staticFile("sfx/whoosh.wav")} volume={0.35} /></Sequence>)}
  </AbsoluteFill>
);

export const ZidaneModeCompositions: React.FC = () => (
  <Composition id="ZidaneMode" component={ZidaneMode} durationInFrames={TOTAL} fps={FPS} width={1080} height={1920} />
);
