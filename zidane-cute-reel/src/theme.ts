// theme.ts — single source of truth. No hex codes, easings or springs in components.
import { Easing } from "remotion";

export const theme = {
  colors: {
    bg: "#FFF3E6", // warm cream base
    bgDot: "#FFD9C7", // polka dots
    red: "#C22A2F", // Zidane brand red (from zidane-icon.svg)
    redDeep: "#9E1C22",
    yellow: "#FFC93C", // highlight / price burst
    pink: "#FF8FA3", // blush
    ink: "#2A1414",
    white: "#FFFFFF",
    whatsapp: "#25D366",
  },
  fonts: {
    display: "Sora",
    body: "Inter",
  },
  ease: {
    out: Easing.bezier(0.16, 1, 0.3, 1),
    inOut: Easing.bezier(0.83, 0, 0.17, 1),
    in: Easing.bezier(0.7, 0, 0.84, 0),
  },
  spring: {
    snappy: { damping: 14, stiffness: 160, mass: 0.6 },
    smooth: { damping: 20, stiffness: 90, mass: 1 },
    bouncy: { damping: 9, stiffness: 180, mass: 0.7 }, // extra jelly for the cute look
    counter: { damping: 30, stiffness: 60 },
  },
  size: {
    hero: 118,
    title: 92,
    caption: 60,
    small: 40,
  },
  clamp: { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const,
} as const;
