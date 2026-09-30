// Corporate design kit: dark charcoal, hairline grid, Zidane red accent, masked type reveals,
// line icons, photo panels. Motion is smooth (expo-out), never bouncy.
import React from "react";
import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

export const corp = {
  bg: "#0D0F12",
  surface: "#16191E",
  line: "rgba(244,241,236,0.10)",
  lineStrong: "rgba(244,241,236,0.22)",
  text: "#F4F1EC",
  dim: "#98A0AA",
  red: "#D7262E",
  display: "Sora",
  body: "Inter",
  out: Easing.bezier(0.16, 1, 0.3, 1),
  inOut: Easing.bezier(0.65, 0, 0.35, 1),
  in: Easing.bezier(0.7, 0, 0.84, 0),
  clamp: { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const,
  pad: 96, // side margin
};

// 0→1 progress with expo-out over `dur` frames starting at `delay`
export const useIn = (delay: number, dur = 18) => {
  const frame = useCurrentFrame();
  return interpolate(frame, [delay, delay + dur], [0, 1], { easing: corp.out, ...corp.clamp });
};

// Background: charcoal, six hairline columns, slow red glow, fine grain
export const CorpBg: React.FC = () => {
  const frame = useCurrentFrame();
  const noise = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='220'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='220' height='220' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E")`;
  return (
    <AbsoluteFill style={{ background: corp.bg }}>
      <div style={{
        position: "absolute", width: 1400, height: 1400, borderRadius: "50%", filter: "blur(120px)",
        left: -500 + Math.sin(frame / 80) * 80, top: 900 + Math.cos(frame / 90) * 60,
        background: `radial-gradient(circle, ${corp.red}30, transparent 65%)`,
      }} />
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} style={{ position: "absolute", top: 0, bottom: 0, left: 180 * (i + 1), width: 1, background: corp.line }} />
      ))}
      <AbsoluteFill style={{ backgroundImage: noise, backgroundSize: "220px", backgroundPosition: `${(frame * 7) % 220}px ${(frame * 13) % 220}px`, opacity: 0.06, mixBlendMode: "overlay" }} />
    </AbsoluteFill>
  );
};

// Text line that slides up out of a mask
export const Reveal: React.FC<{ delay?: number; children: React.ReactNode; style?: React.CSSProperties }> = ({ delay = 0, children, style }) => {
  const p = useIn(delay, 22);
  return (
    <div style={{ overflow: "hidden", paddingBottom: 16, marginBottom: -10 }}>
      <div style={{ transform: `translateY(${interpolate(p, [0, 1], [105, 0])}%)`, opacity: interpolate(p, [0, 0.3], [0, 1], corp.clamp), ...style }}>
        {children}
      </div>
    </div>
  );
};

export const H: React.FC<{ size?: number; color?: string; children: React.ReactNode }> = ({ size = 104, color = corp.text, children }) => (
  <div style={{ fontFamily: corp.display, fontWeight: 700, fontSize: size, lineHeight: 1.04, letterSpacing: "-0.035em", color }}>{children}</div>
);

// "— 01 / PROCESS" style label with a drawing red dash
export const Kicker: React.FC<{ delay?: number; children: React.ReactNode }> = ({ delay = 0, children }) => {
  const p = useIn(delay, 20);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 22, opacity: interpolate(p, [0, 0.4], [0, 1], corp.clamp) }}>
      <div style={{ width: 70 * p, height: 4, background: corp.red }} />
      <div style={{ fontFamily: corp.body, fontWeight: 600, fontSize: 30, letterSpacing: "0.22em", textTransform: "uppercase", color: corp.dim }}>{children}</div>
    </div>
  );
};

// Horizontal hairline that draws in
export const Rule: React.FC<{ delay?: number; width?: number | string; color?: string }> = ({ delay = 0, width = "100%", color = corp.lineStrong }) => {
  const p = useIn(delay, 24);
  return <div style={{ width, height: 2, background: color, transform: `scaleX(${p})`, transformOrigin: "left" }} />;
};

// Photo panel: clip-path wipe in, slow push, dark gradient for type on top
export const PhotoPanel: React.FC<{ src: string; delay?: number; height: number; focus?: string; style?: React.CSSProperties }> = ({
  src, delay = 0, height, focus = "50% 50%", style,
}) => {
  const frame = useCurrentFrame();
  const p = useIn(delay, 26);
  const push = 1.08 + frame * 0.0008;
  return (
    <div style={{ position: "relative", height, overflow: "hidden", clipPath: `inset(0 ${(1 - p) * 100}% 0 0)`, ...style }}>
      <Img src={staticFile(src)} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: focus, transform: `scale(${push})`, filter: "saturate(0.85) contrast(1.05)" }} />
      <AbsoluteFill style={{ background: `linear-gradient(180deg, rgba(13,15,18,0.05) 0%, rgba(13,15,18,0.25) 55%, ${corp.bg} 100%)` }} />
    </div>
  );
};

// Scene exit: quick fade + lift
export const CExit: React.FC<{ length: number; children: React.ReactNode }> = ({ length, children }) => {
  const frame = useCurrentFrame();
  const r = [length - 10, length - 1];
  const o = interpolate(frame, r, [1, 0], { easing: corp.in, ...corp.clamp });
  const y = interpolate(frame, r, [0, -40], { easing: corp.in, ...corp.clamp });
  return <AbsoluteFill style={{ opacity: o, transform: `translateY(${y}px)` }}>{children}</AbsoluteFill>;
};

// Counter that eases to `to`
export const Count: React.FC<{ to: number; delay?: number; dur?: number }> = ({ to, delay = 0, dur = 30 }) => {
  const p = useIn(delay, dur);
  return <>{Math.round(to * p).toLocaleString("en-US")}</>;
};

export type IconName =
  | "list" | "search" | "check" | "truck" | "factory" | "office" | "hospital" | "school" | "ngo" | "horeca" | "site";

// 1.5px-equivalent line icons on a 48 grid, drawn with stroke-dash reveal
export const LineIcon: React.FC<{ name: IconName; size?: number; delay?: number; color?: string }> = ({ name, size = 96, delay = 0, color = corp.text }) => {
  const p = useIn(delay, 26);
  const st = { stroke: color, strokeWidth: 2.2, fill: "none", strokeLinecap: "round" as const, strokeLinejoin: "round" as const, pathLength: 1, strokeDasharray: 1, strokeDashoffset: 1 - p };
  const d: Record<IconName, string[]> = {
    list: ["M14 8h20a2 2 0 012 2v30a2 2 0 01-2 2H14a2 2 0 01-2-2V10a2 2 0 012-2z", "M18 18h12", "M18 25h12", "M18 32h8"],
    search: ["M21 34a13 13 0 100-26 13 13 0 000 26z", "M30.5 30.5L40 40", "M15 21h12"],
    check: ["M8 16l16-8 16 8v18l-16 8-16-8z", "M8 16l16 8 16-8", "M24 24v18", "M30 33l3 3 6-7"],
    truck: ["M4 12h24v20H4z", "M28 18h9l7 7v7H28z", "M12 38a4 4 0 100-8 4 4 0 000 8z", "M36 38a4 4 0 100-8 4 4 0 000 8z"],
    factory: ["M6 40V20l10 6v-6l10 6v-6l10 6V8h6v32z", "M12 34h4", "M22 34h4", "M32 34h4"],
    office: ["M10 42V8h20v34", "M30 18h8v24", "M16 14h2", "M22 14h2", "M16 22h2", "M22 22h2", "M16 30h2", "M22 30h2", "M6 42h36"],
    hospital: ["M8 42V14h32v28", "M20 22h8", "M24 18v8", "M4 42h40", "M20 42v-8h8v8"],
    school: ["M4 18l20-10 20 10-20 10z", "M12 22v10c0 3 5 6 12 6s12-3 12-6V22", "M44 18v12"],
    ngo: ["M24 40S8 30 8 19a8 8 0 0116-3 8 8 0 0116 3c0 11-16 21-16 21z", "M17 22h14", "M24 15v14"],
    horeca: ["M14 6v14a4 4 0 008 0V6", "M18 6v36", "M34 6c-4 0-6 6-6 14h6v22"],
    site: ["M8 30a16 16 0 0132 0", "M4 30h40v6H4z", "M20 14v-4h8v4", "M24 14v16"],
  };
  return (
    <svg width={size} height={size} viewBox="0 0 48 48">
      {d[name].map((path, i) => <path key={i} d={path} {...st} />)}
    </svg>
  );
};

// Corporate end card
export const CorpOutro: React.FC<{ line1: string; line2: string }> = ({ line1, line2 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const logo = useIn(4, 26);
  const rows = [
    { k: "Email", v: "sales@zidane.com.pk" },
    { k: "Web", v: "zidane.com.pk" },
  ];
  return (
    <AbsoluteFill style={{ padding: `0 ${corp.pad}px`, justifyContent: "center" }}>
      <div style={{ opacity: logo, transform: `translateY(${interpolate(logo, [0, 1], [30, 0])}px)` }}>
        <Img src={staticFile("brand/zidane-logo-white.svg")} style={{ width: 620 }} />
      </div>
      <div style={{ marginTop: 40 }}><Rule delay={14} color={corp.red} width={220} /></div>
      <div style={{ marginTop: 80 }}>
        <Reveal delay={18}><H size={84}>{line1}</H></Reveal>
        <Reveal delay={24}><H size={84} color={corp.dim}>{line2}</H></Reveal>
      </div>
      <div style={{ marginTop: 100 }}>
        {rows.map((r, i) => {
          const p = interpolate(frame, [fps + i * 5, fps + i * 5 + 18], [0, 1], { easing: corp.out, ...corp.clamp });
          return (
            <div key={r.k} style={{ opacity: p, transform: `translateY(${interpolate(p, [0, 1], [20, 0])}px)` }}>
              <Rule delay={fps + i * 5} />
              <div style={{ display: "flex", justifyContent: "space-between", padding: "30px 0", fontFamily: corp.body }}>
                <span style={{ fontSize: 34, color: corp.dim, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600 }}>{r.k}</span>
                <span style={{ fontSize: 46, color: corp.text, fontWeight: 600 }}>{r.v}</span>
              </div>
            </div>
          );
        })}
        <Rule delay={fps + 10} />
      </div>
    </AbsoluteFill>
  );
};
