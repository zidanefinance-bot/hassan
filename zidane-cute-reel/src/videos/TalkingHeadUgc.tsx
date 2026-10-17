// UGC edit of the supplied talking-head clip (16:9) into a 9:16 "podcast frame" reel:
// changing hook on top, framed video with jump-cut zooms, word-by-word captions, pop-up stamps, end card.
import React from "react";
import { AbsoluteFill, Img, interpolate, OffthreadVideo, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Audio } from "remotion";
import { CorpBg, CorpOutro, corp, useIn } from "../corporate/kit";

const FPS = 30;
const sec = (s: number) => Math.round(s * FPS);
const CLIP = 10.0; // seconds of source video
const OUTRO = 4.2;
export const TALKING_TOTAL = sec(CLIP + OUTRO);

// Word timings (seconds) from the clip's audio.
type W = { w: string; t: number };
const phrases: { start: number; end: number; words: W[]; zoom: number }[] = [
  { start: 0.0, end: 2.2, zoom: 1.0, words: [
    { w: "Looking", t: 0.12 }, { w: "to", t: 0.35 }, { w: "get", t: 0.5 }, { w: "your", t: 0.7 }, { w: "business", t: 0.85 },
    { w: "the", t: 1.3 }, { w: "best", t: 1.37 }, { w: "deals?", t: 1.62 }] },
  { start: 2.2, end: 4.3, zoom: 1.16, words: [
    { w: "Zidane", t: 2.27 }, { w: "Wholesale", t: 2.62 }, { w: "Solutions", t: 2.93 }, { w: "is", t: 3.39 }, { w: "your", t: 3.52 }, { w: "go-to,", t: 3.68 }] },
  { start: 4.3, end: 6.0, zoom: 1.05, words: [
    { w: "where", t: 3.97 }, { w: "we", t: 4.34 }, { w: "deliver", t: 4.48 }, { w: "quality", t: 4.84 }, { w: "and", t: 5.27 }, { w: "reliability.", t: 5.37 }] },
  { start: 6.0, end: 8.1, zoom: 1.22, words: [
    { w: "Buy", t: 6.06 }, { w: "from", t: 6.33 }, { w: "Zidane", t: 6.51 }, { w: "Wholesale", t: 6.88 }, { w: "Solutions", t: 7.2 }] },
  { start: 8.1, end: 10.0, zoom: 1.08, words: [
    { w: "and", t: 8.15 }, { w: "see", t: 8.29 }, { w: "the", t: 8.43 }, { w: "difference", t: 8.52 }, { w: "for", t: 8.88 }, { w: "yourself", t: 8.99 }, { w: "today.", t: 9.32 }] },
];
const BRAND_WORDS = new Set(["Zidane", "Wholesale", "Solutions"]);

const VIDEO = { top: 790, w: 1000, h: 563 };

const Hook: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const first = t < 4.3;
  const lines = first ? ["Still chasing", "5 suppliers?"] : ["One supplier.", "Every staple."];
  const local = first ? frame : frame - sec(4.3);
  return (
    <div style={{ position: "absolute", top: 330, left: corp.pad, right: corp.pad }}>
      <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 24 }}>
        <div style={{ width: 56, height: 4, background: corp.red }} />
        <div style={{ fontFamily: corp.body, fontWeight: 600, fontSize: 28, letterSpacing: "0.22em", color: corp.dim, textTransform: "uppercase" }}>B2B grocery supply · Karachi</div>
      </div>
      {lines.map((l, i) => {
        const p = interpolate(local, [i * 4, i * 4 + 14], [0, 1], { easing: corp.out, ...corp.clamp });
        return (
          <div key={l} style={{ overflow: "hidden" }}>
            <div style={{
              fontFamily: corp.display, fontWeight: 800, fontSize: 104, lineHeight: 1.04, letterSpacing: "-0.04em",
              color: i === 1 ? corp.red : corp.text, transform: `translateY(${(1 - p) * 100}%)`,
            }}>{l}</div>
          </div>
        );
      })}
    </div>
  );
};

const Framed: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const ph = phrases.find((p) => t >= p.start && t < p.end) ?? phrases[phrases.length - 1];
  // tiny settle after each jump cut
  const since = t - ph.start;
  const settle = interpolate(since, [0, 0.25], [0.03, 0], corp.clamp);
  const scale = ph.zoom + settle;
  return (
    <div style={{ position: "absolute", top: VIDEO.top, left: (1080 - VIDEO.w) / 2, width: VIDEO.w, height: VIDEO.h, borderRadius: 34, overflow: "hidden", boxShadow: "0 40px 80px rgba(0,0,0,.55)", border: `2px solid ${corp.lineStrong}` }}>
      <div style={{ width: "100%", height: "100%", transform: `scale(${scale})`, transformOrigin: "50% 32%" }}>
        <OffthreadVideo src={staticFile("ugc/talking-head.mp4")} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </div>
      {/* REC-style live dot for the UGC feel */}
      <div style={{ position: "absolute", top: 22, left: 24, display: "flex", alignItems: "center", gap: 10, background: "rgba(0,0,0,.45)", borderRadius: 999, padding: "8px 16px" }}>
        <div style={{ width: 14, height: 14, borderRadius: 7, background: corp.red, opacity: Math.floor(frame / 15) % 2 ? 0.35 : 1 }} />
        <div style={{ fontFamily: corp.body, fontWeight: 700, fontSize: 22, color: "#fff", letterSpacing: "0.1em" }}>ZIDANE</div>
      </div>
    </div>
  );
};

// Pop-up stamp anchored to the video frame
const Stamp: React.FC<{ at: number; until: number; x: number; y: number; rot?: number; children: React.ReactNode }> = ({ at, until, x, y, rot = 0, children }) => {
  const frame = useCurrentFrame();
  const inP = interpolate(frame, [sec(at), sec(at) + 7], [0, 1], { easing: corp.out, ...corp.clamp });
  const outP = interpolate(frame, [sec(until) - 5, sec(until)], [1, 0], corp.clamp);
  if (frame < sec(at) || frame > sec(until)) return null;
  const s = interpolate(inP, [0, 0.7, 1], [1.6, 0.94, 1]);
  return (
    <div style={{ position: "absolute", left: x, top: y, transform: `translate(-50%, -50%) rotate(${rot}deg) scale(${s})`, opacity: inP * outP }}>
      {children}
    </div>
  );
};

const Chip: React.FC<{ label: string }> = ({ label }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 12, background: "#fff", borderRadius: 999, padding: "12px 26px 12px 14px", boxShadow: "0 12px 30px rgba(0,0,0,.35)" }}>
    <svg width={38} height={38} viewBox="0 0 40 40"><circle cx={20} cy={20} r={19} fill={corp.red} /><path d="M11 20.5l6 6 12-13" stroke="#fff" strokeWidth={4.5} fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
    <span style={{ fontFamily: corp.display, fontWeight: 800, fontSize: 36, color: "#141414", letterSpacing: "-0.02em" }}>{label}</span>
  </div>
);

const Captions: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const ph = phrases.find((p) => t >= p.start && t < p.end) ?? phrases[phrases.length - 1];
  const pin = interpolate(t - ph.start, [0, 0.15], [0, 1], corp.clamp);
  return (
    <div style={{ position: "absolute", top: VIDEO.top + VIDEO.h + 70, left: 70, right: 70, display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "10px 16px", opacity: pin }}>
      {ph.words.map((w, i) => {
        const next = ph.words[i + 1]?.t ?? ph.end;
        const active = t >= w.t && t < next;
        const said = t >= w.t;
        const brandW = BRAND_WORDS.has(w.w.replace(/[^A-Za-z]/g, ""));
        return (
          <span key={i} style={{
            fontFamily: corp.display, fontWeight: 800, fontSize: 70, lineHeight: 1.12, letterSpacing: "-0.02em",
            padding: "2px 14px", borderRadius: 14,
            color: active ? "#fff" : said ? (brandW ? corp.red : corp.text) : "rgba(244,241,236,0.35)",
            background: active ? corp.red : "transparent",
            transform: `scale(${active ? 1.06 : 1})`,
          }}>{w.w}</span>
        );
      })}
    </div>
  );
};

const Progress: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <div style={{ position: "absolute", top: 200, left: corp.pad, right: corp.pad, height: 6, borderRadius: 3, background: corp.line, overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${Math.min(100, (frame / sec(CLIP)) * 100)}%`, background: corp.red }} />
    </div>
  );
};

const Talk: React.FC = () => {
  const fade = useIn(0, 10);
  const vx = (1080 - VIDEO.w) / 2;
  return (
    <AbsoluteFill style={{ opacity: fade }}>
      <Progress />
      <Hook />
      <Framed />
      <Stamp at={1.55} until={2.2} x={vx + VIDEO.w - 170} y={VIDEO.top + 90} rot={-8}>
        <div style={{ border: `6px solid ${corp.red}`, color: corp.red, background: "rgba(255,255,255,.92)", borderRadius: 14, padding: "8px 22px", fontFamily: corp.display, fontWeight: 800, fontSize: 52, letterSpacing: "0.04em" }}>BEST DEALS</div>
      </Stamp>
      <Stamp at={2.3} until={4.25} x={vx + 250} y={VIDEO.top + VIDEO.h - 70}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, background: corp.red, borderRadius: 18, padding: "14px 22px", boxShadow: "0 14px 34px rgba(0,0,0,.45)" }}>
          <Img src={staticFile("brand/zidane-logo-white.svg")} style={{ width: 230 }} />
        </div>
      </Stamp>
      <Stamp at={4.84} until={6.0} x={vx + VIDEO.w - 190} y={VIDEO.top + 90}><Chip label="Quality" /></Stamp>
      <Stamp at={5.37} until={6.0} x={vx + VIDEO.w - 220} y={VIDEO.top + 190}><Chip label="Reliability" /></Stamp>
      <Stamp at={6.5} until={8.1} x={540} y={VIDEO.top + VIDEO.h - 60}>
        <div style={{ background: "#fff", color: "#141414", borderRadius: 999, padding: "14px 34px", fontFamily: corp.display, fontWeight: 800, fontSize: 40, boxShadow: "0 14px 34px rgba(0,0,0,.4)" }}>
          www.zidane.com.pk
        </div>
      </Stamp>
      <Captions />
    </AbsoluteFill>
  );
};

export const TalkingHeadUgc: React.FC = () => {
  const { durationInFrames } = useVideoConfig();
  return (
    <AbsoluteFill>
      <CorpBg />
      <Sequence durationInFrames={sec(CLIP)}><Talk /></Sequence>
      <Sequence from={sec(CLIP)} durationInFrames={sec(OUTRO)}><CorpOutro line1="See the difference." line2="Send us your list today." /></Sequence>
      {/* soft music bed under the voice, louder on the end card */}
      <Audio src={staticFile("sfx/corp-bed.wav")} endAt={durationInFrames}
        volume={(f) => interpolate(f, [0, sec(CLIP) - 6, sec(CLIP), durationInFrames - 20, durationInFrames], [0.1, 0.1, 0.45, 0.45, 0], corp.clamp)} />
      {[1.55, 2.3, 4.84, 5.37, 6.5].map((t) => (
        <Sequence key={t} from={sec(t) - 2} durationInFrames={30}><Audio src={staticFile("sfx/pop.wav")} volume={0.35} /></Sequence>
      ))}
      <Sequence from={sec(CLIP) + 2} durationInFrames={45}><Audio src={staticFile("sfx/bass.wav")} volume={0.6} /></Sequence>
    </AbsoluteFill>
  );
};
