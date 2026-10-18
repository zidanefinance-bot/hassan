// "Zidane Books in 90 seconds": real screen recordings of the app (scripted clicks, demo data), explained simply.
// Clips: public/demo/clips/*.mp4 + public/demo/segments.json (recorded with Playwright). Voiceover: scripts/make_demo_vo.py
import React from "react";
import { AbsoluteFill, Audio, Composition, Img, interpolate, OffthreadVideo, Sequence, spring, staticFile, useCurrentFrame } from "remotion";
import "../Fonts";
import vo from "../../public/demo/vo.json";
import segments from "../../public/demo/segments.json";

const FPS = 30;
const INTRO = 3.2 * FPS;
const OUTRO = 4.5 * FPS;
const RED = "#C22A2F";
const INK = "#1D2433";
const ROLE: Record<string, { label: string; color: string }> = {
  director1: { label: "Director", color: "#7A2FB0" }, director2: { label: "Director", color: "#7A2FB0" },
  sales1: { label: "Sales", color: "#2457C5" }, sales2: { label: "Sales", color: "#2457C5" },
  ops: { label: "Operations", color: "#B86A00" }, accounts: { label: "Accounts", color: "#1A7F4B" },
};
const STAGES = ["Ask", "Buy", "Deliver", "Get paid", "Profit"];
const STAGE_OF: Record<string, number> = { enquiry: 0, job: 0, "ops-start": 1, buy: 1, bill: 1, ready: 1, dc: 2, invoice: 2, accounts: 3, profit: 4 };

// one scene per voiceover line; its length is the recorded segment (always at least the line)
const scenes = segments.map((s) => {
  const line = vo.lines.find((l) => l.id === s.id)!;
  return { ...s, ...line, frames: Math.round(Math.max(s.end - s.start, line.dur + 0.6) * FPS) };
});
const starts = scenes.reduce<number[]>((a, sc, i) => [...a, i === 0 ? INTRO : a[i - 1] + scenes[i - 1].frames], []);
const TOTAL = starts[starts.length - 1] + scenes[scenes.length - 1].frames + OUTRO;

const pop = (f: number, at = 0) => spring({ frame: f - at, fps: FPS, config: { damping: 14, stiffness: 160 } });

const Bg: React.FC = () => (
  <AbsoluteFill style={{ background: "linear-gradient(135deg, #F6F1EE 0%, #EEF1F6 100%)" }}>
    <div style={{ position: "absolute", width: 900, height: 900, borderRadius: 900, background: "radial-gradient(circle, rgba(194,42,47,0.10), transparent 70%)", left: -300, top: -350 }} />
    <div style={{ position: "absolute", width: 800, height: 800, borderRadius: 800, background: "radial-gradient(circle, rgba(36,87,197,0.08), transparent 70%)", right: -250, bottom: -300 }} />
  </AbsoluteFill>
);

const Scene: React.FC<{ sc: (typeof scenes)[number]; n: number }> = ({ sc, n }) => {
  const f = useCurrentFrame();
  const role = ROLE[sc.role];
  const stage = STAGE_OF[sc.id];
  const capIn = pop(f, 6);
  const zoom = interpolate(f, [0, sc.frames], [1, 1.025]);
  return (
    <AbsoluteFill>
      <Bg />
      {/* browser frame with the real recording */}
      <div style={{ position: "absolute", left: 240, top: 92, width: 1440, height: 850, borderRadius: 18, overflow: "hidden", boxShadow: "0 30px 80px rgba(20,25,40,0.25)", background: "#fff", border: "1px solid #E2E5EB" }}>
        <div style={{ height: 40, background: "#F3F4F7", borderBottom: "1px solid #E2E5EB", display: "flex", alignItems: "center", gap: 8, padding: "0 16px" }}>
          {["#FF5F57", "#FEBC2E", "#28C840"].map((c) => <span key={c} style={{ width: 13, height: 13, borderRadius: 13, background: c }} />)}
          <div style={{ marginLeft: 20, flex: 1, maxWidth: 520, height: 24, borderRadius: 6, background: "#fff", border: "1px solid #E2E5EB", fontFamily: "Inter", fontSize: 14, color: "#6B7587", display: "flex", alignItems: "center", padding: "0 10px" }}>🔒 books.zidane.com.pk</div>
        </div>
        <div style={{ width: 1440, height: 810, overflow: "hidden" }}>
          <div style={{ transform: `scale(${zoom})`, transformOrigin: "50% 40%", width: "100%", height: "100%" }}>
            <OffthreadVideo src={staticFile(`demo/clips/${sc.file}`)} startFrom={Math.round(sc.start * FPS)} muted style={{ width: 1440, height: 810 }} />
          </div>
        </div>
      </div>
      {/* who is doing this */}
      <div style={{ position: "absolute", left: 240, top: 26, display: "flex", alignItems: "center", gap: 14, transform: `translateX(${(1 - pop(f)) * -40}px)`, opacity: pop(f) }}>
        <span style={{ background: role.color, color: "#fff", fontFamily: "Sora", fontWeight: 800, fontSize: 26, padding: "8px 20px", borderRadius: 999 }}>{role.label}</span>
        <span style={{ fontFamily: "Inter", fontWeight: 600, fontSize: 22, color: "#6B7587" }}>Step {n + 1} of {scenes.length}</span>
      </div>
      {/* the order's journey */}
      <div style={{ position: "absolute", right: 240, top: 30, display: "flex", gap: 8, alignItems: "center" }}>
        {STAGES.map((s, i) => {
          const done = stage !== undefined && i < stage, now = i === stage;
          return (
            <React.Fragment key={s}>
              {i > 0 && <span style={{ color: "#B7BDC8", fontSize: 20 }}>→</span>}
              <span style={{ fontFamily: "Sora", fontWeight: 700, fontSize: 20, padding: "6px 14px", borderRadius: 999, background: now ? RED : done ? "#E4F3EA" : "#fff", color: now ? "#fff" : done ? "#1A7F4B" : "#8A92A1", border: now ? "none" : "1px solid #E2E5EB",
                transform: now ? `scale(${1 + Math.sin(f / 8) * 0.03})` : undefined }}>{done ? "✓ " : ""}{s}</span>
            </React.Fragment>
          );
        })}
      </div>
      {/* simple caption */}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 22, display: "flex", justifyContent: "center", opacity: capIn, transform: `translateY(${(1 - capIn) * 30}px)` }}>
        <div style={{ background: INK, color: "#fff", fontFamily: "Sora", fontWeight: 800, fontSize: 46, padding: "12px 36px", borderRadius: 20, boxShadow: "0 14px 40px rgba(0,0,0,0.25)" }}>{sc.caption}</div>
      </div>
      <Audio src={staticFile(`demo/vo-${sc.i}.wav`)} />
    </AbsoluteFill>
  );
};

const Intro: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill>
      <Bg />
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", gap: 26 }}>
        <Img src={staticFile("brand/zidane-logo.svg")} style={{ width: 520, transform: `scale(${pop(f)})` }} />
        <div style={{ fontFamily: "Sora", fontWeight: 800, fontSize: 92, color: INK, opacity: pop(f, 10), letterSpacing: "-0.03em" }}>Zidane Books</div>
        <div style={{ fontFamily: "Inter", fontWeight: 600, fontSize: 40, color: RED, opacity: pop(f, 20) }}>The whole system in 90 seconds, made simple</div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const Outro: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill>
      <Bg />
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", gap: 28 }}>
        <div style={{ display: "flex", gap: 18, alignItems: "center" }}>
          {["Ask", "Buy", "Deliver", "Get paid"].map((s, i) => (
            <React.Fragment key={s}>
              {i > 0 && <span style={{ fontSize: 46, color: "#B7BDC8", opacity: pop(f, i * 6) }}>→</span>}
              <span style={{ fontFamily: "Sora", fontWeight: 800, fontSize: 56, color: "#fff", background: [ROLE.sales1.color, ROLE.ops.color, ROLE.sales1.color, ROLE.accounts.color][i], padding: "14px 30px", borderRadius: 24, transform: `scale(${pop(f, i * 6)})` }}>{s}</span>
            </React.Fragment>
          ))}
        </div>
        <Img src={staticFile("brand/zidane-logo.svg")} style={{ width: 360, marginTop: 30, opacity: pop(f, 30) }} />
        <div style={{ fontFamily: "Sora", fontWeight: 700, fontSize: 44, color: INK, opacity: pop(f, 36) }}>books.zidane.com.pk</div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const BooksDemo: React.FC = () => (
  <AbsoluteFill style={{ background: "#F6F1EE" }}>
    <Sequence durationInFrames={INTRO}><Intro /></Sequence>
    {scenes.map((sc, i) => <Sequence key={i} from={starts[i]} durationInFrames={sc.frames}><Scene sc={sc} n={i} /></Sequence>)}
    <Sequence from={TOTAL - OUTRO}><Outro /></Sequence>
    <Audio src={staticFile("sfx/corp-bed-36.wav")} loop volume={(f) => interpolate(f, [0, 20, TOTAL - 40, TOTAL], [0, 0.1, 0.1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })} />
  </AbsoluteFill>
);

export const BooksDemoCompositions: React.FC = () => (
  <Composition id="BooksDemo" component={BooksDemo} durationInFrames={TOTAL} fps={FPS} width={1920} height={1080} />
);
