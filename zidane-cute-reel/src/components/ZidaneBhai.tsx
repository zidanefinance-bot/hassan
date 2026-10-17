// "Zidane Bhai" — the brand's animated presenter. Pakistani man, early 30s: short black hair,
// trimmed full beard, rectangular glasses, red Zidane polo with a lavalier mic.
// Everything is vector, so he can talk (mouth), blink, move his brows and gesture.
import React from "react";
import { interpolate, staticFile, useCurrentFrame } from "remotion";
import { theme } from "../theme";

export type Brow = "neutral" | "raised" | "sad" | "sure";
export type Pose = "chin" | "open" | "point" | "phone" | "rest";

const SKIN = "#C98E62";
const SKIN_DARK = "#A8704A";
const HAIR = "#1A1311";
const POLO = theme.colors.red;
const POLO_DARK = "#A21F26";

// Pseudo-random syllable envelope so the mouth doesn't flap like a metronome.
const talk = (f: number) => {
  const a = (Math.sin(f * 1.35) + Math.sin(f * 2.7 + 1.3) + Math.sin(f * 0.55 + 2)) / 3;
  return Math.max(0, Math.min(1, 0.45 + a * 0.75));
};

export const ZidaneBhai: React.FC<{
  speaking: boolean;
  brow: Brow;
  pose: Pose;
  poseT: number; // 0..1 blend into the pose
  smile?: boolean;
  mouth?: number; // 0..1 from the voice track; overrides the synthetic talk envelope
}> = ({ speaking, brow, pose, poseT, smile = true, mouth }) => {
  const frame = useCurrentFrame();
  const open = mouth !== undefined ? mouth : speaking ? talk(frame) : 0;
  const cycle = frame % 84;
  const blink = cycle > 78 ? interpolate(cycle, [78, 80, 83], [1, 0.08, 1], theme.clamp) : 1;
  const nod = speaking ? Math.sin(frame / 4.2) * 1.6 : 0;
  const tilt = Math.sin(frame / 26) * 2.2 + (brow === "raised" ? 3 : 0);
  const breathe = Math.sin(frame / 18) * 4;
  const browY = { neutral: 0, raised: -18, sad: -6, sure: 4 }[brow];
  const browTilt = { neutral: 0, raised: -4, sad: 12, sure: -8 }[brow];
  return (
    <svg width={1080} height={1920} viewBox="0 0 1080 1920" style={{ position: "absolute", inset: 0, overflow: "visible" }}>
      {/* ---------- body ---------- */}
      <g transform={`translate(540 ${1035 + breathe})`}>
        <path d="M-72 -70 L72 -70 L82 60 L-82 60 Z" fill={SKIN_DARK} />
        <path d="M-440 900 C-440 330 -350 130 -170 80 L170 80 C350 130 440 330 440 900 Z" fill={POLO} />
        <path d="M-170 80 C-120 70 -80 62 -60 60 L0 150 L60 60 C80 62 120 70 170 80 L150 100 L60 88 L0 190 L-60 88 L-150 100 Z" fill={POLO_DARK} />
        <path d="M-26 150 L26 150 L26 360 L-26 360 Z" fill={POLO_DARK} />
        <circle cx={0} cy={220} r={9} fill="#F4E9E0" />
        <circle cx={0} cy={300} r={9} fill="#F4E9E0" />
        {/* chest logo */}
        <rect x={160} y={220} width={116} height={116} rx={30} fill="#FFFFFF" />
        <image href={staticFile("brand/zidane-icon.svg")} x={170} y={230} width={96} height={96} />
        {/* lav mic */}
        <path d="M-92 118 q-10 70 30 130" stroke="#111" strokeWidth={5} fill="none" />
        <rect x={-110} y={98} width={30} height={46} rx={10} fill="#111" />
      </g>

      {/* ---------- head ---------- */}
      <g transform={`translate(540 ${800 + breathe * 0.6 + nod}) rotate(${tilt})`}>
        {/* ears */}
        <ellipse cx={-186} cy={10} rx={34} ry={54} fill={SKIN} />
        <ellipse cx={186} cy={10} rx={34} ry={54} fill={SKIN} />
        {/* face */}
        <path d="M-178 -60 C-182 120 -110 238 0 238 C110 238 182 120 178 -60 C176 -190 100 -250 0 -250 C-100 -250 -176 -190 -178 -60 Z" fill={SKIN} />
        {/* hair */}
        <path d="M-186 -40 C-200 -170 -140 -268 -20 -278 C60 -290 150 -262 186 -190 C204 -140 196 -80 186 -40 C176 -110 160 -150 120 -168 C60 -150 -40 -176 -120 -150 C-160 -130 -176 -90 -186 -40 Z" fill={HAIR} />
        {/* beard */}
        <path
          d="M-180 -30 C-182 140 -100 250 0 252 C100 250 182 140 180 -30 L156 -20 C156 70 120 118 70 128 C44 112 -44 112 -70 128 C-120 118 -156 70 -156 -20 Z"
          fill={HAIR}
        />
        {/* moustache */}
        <path d="M-78 112 C-50 84 -18 88 0 98 C18 88 50 84 78 112 C50 104 20 108 0 116 C-20 108 -50 104 -78 112 Z" fill={HAIR} />
        {/* mouth */}
        {open > 0.05 ? (
          <g>
            <ellipse cx={0} cy={140} rx={40 - open * 6} ry={6 + open * 24} fill="#3D1716" />
            <rect x={-26} y={134 - open * 12} width={52} height={8} rx={3} fill="#F7F1EA" opacity={open > 0.3 ? 1 : 0} />
            <ellipse cx={0} cy={148 + open * 12} rx={18} ry={6 * open} fill="#B4514E" />
          </g>
        ) : (
          <path d={smile ? "M-38 134 Q0 160 38 134" : "M-34 142 Q0 136 34 142"} stroke="#3D1716" strokeWidth={9} fill="none" strokeLinecap="round" />
        )}
        {/* nose */}
        <path d="M-6 -6 C-12 30 -30 58 -22 74 C-10 84 10 84 22 74" stroke={SKIN_DARK} strokeWidth={8} fill="none" strokeLinecap="round" />
        {/* eyes */}
        {[-72, 72].map((x) => (
          <g key={x} transform={`translate(${x} -24) scale(1 ${blink})`}>
            <ellipse cx={0} cy={0} rx={27} ry={19} fill="#FFFDF8" />
            <circle cx={Math.sin(frame / 40) * 3} cy={1} r={12} fill="#2B1A12" />
            <circle cx={4} cy={-4} r={4} fill="#fff" />
          </g>
        ))}
        {/* brows */}
        {[-1, 1].map((s) => (
          <path
            key={s}
            transform={`translate(${s * 72} ${-78 + browY}) rotate(${s * browTilt})`}
            d="M-44 8 C-20 -10 20 -12 46 0 L42 12 C18 4 -18 6 -40 20 Z"
            fill={HAIR}
          />
        ))}
        {/* glasses */}
        {[-74, 74].map((x) => (
          <rect key={x} x={x - 58} y={-62} width={116} height={78} rx={20} fill="rgba(255,255,255,0.08)" stroke="#141414" strokeWidth={9} />
        ))}
        <path d="M-16 -30 Q0 -40 16 -30" stroke="#141414" strokeWidth={8} fill="none" />
        <path d="M-132 -34 L-182 -24 M132 -34 L182 -24" stroke="#141414" strokeWidth={8} />
      </g>

      {/* ---------- gesturing arm ---------- */}
      <Arm pose={pose} t={poseT} frame={frame} />
    </svg>
  );
};

// Arm: elbow fixed low on the right, forearm swings to the hand target for each pose.
const HAND: Record<Pose, { x: number; y: number; rot: number }> = {
  rest: { x: 820, y: 2050, rot: 0 },
  chin: { x: 610, y: 1080, rot: -30 },
  open: { x: 860, y: 1000, rot: 10 },
  point: { x: 800, y: 1330, rot: 180 },
  phone: { x: 820, y: 1060, rot: -8 },
};

const Arm: React.FC<{ pose: Pose; t: number; frame: number }> = ({ pose, t, frame }) => {
  const target = HAND[pose];
  const x = interpolate(t, [0, 1], [HAND.rest.x, target.x]);
  const y = interpolate(t, [0, 1], [HAND.rest.y, target.y]) + (pose === "open" ? Math.sin(frame / 5) * 10 : 0);
  const rot = interpolate(t, [0, 1], [0, target.rot]) + (pose === "point" ? Math.sin(frame / 4) * 6 : 0);
  const elbow = { x: 900, y: 1720 };
  return (
    <g>
      <path d={`M${elbow.x} ${elbow.y} L${x} ${y + 60}`} stroke={SKIN} strokeWidth={125} strokeLinecap="round" />
      <circle cx={elbow.x + 30} cy={elbow.y + 40} r={120} fill={POLO} />
      <g transform={`translate(${x} ${y}) rotate(${rot})`}>
        {pose === "open" && <OpenHand />}
        {(pose === "chin" || pose === "rest") && <Fist />}
        {pose === "point" && <PointHand />}
        {pose === "phone" && <PhoneHand />}
      </g>
    </g>
  );
};

const stroke = { stroke: SKIN_DARK, strokeWidth: 6 };
const OpenHand: React.FC = () => (
  <g>
    <rect x={-62} y={-40} width={124} height={130} rx={50} fill={SKIN} {...stroke} />
    {[-48, -16, 16, 48].map((fx, i) => (
      <rect key={fx} x={fx - 15} y={-120 + Math.abs(i - 1.5) * 12} width={30} height={100} rx={15} fill={SKIN} {...stroke} />
    ))}
    <rect x={-120} y={-10} width={80} height={32} rx={16} fill={SKIN} {...stroke} transform="rotate(-35 -60 0)" />
  </g>
);
const Fist: React.FC = () => (
  <g>
    <rect x={-66} y={-60} width={132} height={120} rx={50} fill={SKIN} {...stroke} />
    <path d="M-40 -58 L-40 -20 M0 -60 L0 -20 M40 -58 L40 -20" {...stroke} />
  </g>
);
const PointHand: React.FC = () => (
  <g>
    <rect x={-66} y={-60} width={132} height={120} rx={50} fill={SKIN} {...stroke} />
    <rect x={-17} y={-170} width={34} height={130} rx={17} fill={SKIN} {...stroke} />
  </g>
);
const PhoneHand: React.FC = () => (
  <g>
    <rect x={-95} y={-190} width={190} height={340} rx={30} fill="#141414" />
    <rect x={-82} y={-170} width={164} height={296} rx={18} fill="#ECE5DD" />
    <rect x={-82} y={-170} width={164} height={50} rx={18} fill="#075E54" />
    <rect x={-10} y={-100} width={84} height={40} rx={12} fill="#DCF8C6" />
    <rect x={-72} y={-48} width={110} height={70} rx={12} fill="#fff" />
    <rect x={-10} y={34} width={84} height={30} rx={12} fill="#DCF8C6" />
    <rect x={-70} y={60} width={140} height={100} rx={40} fill={SKIN} {...stroke} />
  </g>
);
