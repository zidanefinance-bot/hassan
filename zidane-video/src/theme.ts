// theme.ts — single source of truth. No hex codes, easings or springs in components.
import { Easing } from "remotion";

export const theme = {
  colors: {
    bg: "#0B1220", // deep navy base (60%)
    bgAlt: "#131D33", // card surfaces (30%)
    primary: "#E8A33D", // THE hero gold — max one accented element per frame (10%)
    secondary: "#3B5BDB", // cool blue, only inside the background mesh
    text: "#F6F1E8",
    textDim: "#AEB6C8",
    line: "rgba(246, 241, 232, 0.10)",
    ink: "#0B1220",
    glow: "rgba(232, 163, 61, 0.45)",
  },
  fonts: {
    display: "Sora",
    body: "Inter",
  },
  ease: {
    out: Easing.bezier(0.16, 1, 0.3, 1), // easeOutExpo — entrances
    inOut: Easing.bezier(0.83, 0, 0.17, 1), // easeInOutQuint — moves
    in: Easing.bezier(0.7, 0, 0.84, 0), // exits only
    accel: Easing.bezier(0.55, 0, 1, 0.45), // dealing cards faster and faster
  },
  spring: {
    snappy: { damping: 14, stiffness: 160, mass: 0.6 },
    smooth: { damping: 20, stiffness: 90, mass: 1 },
    bouncy: { damping: 11, stiffness: 170, mass: 0.7 },
    counter: { damping: 30, stiffness: 60 },
  },
  size: {
    hero: 124, // reel headline
    title: 84,
    caption: 60, // T1: narrative captions >= 56px
    small: 40, // T1: auxiliary >= 32px
  },
  clamp: { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const,
} as const;
