import React from "react";
import { theme } from "../theme";
import type { IconName } from "../brand";

// Hand-drawn SVG glyphs in theme colours — never emoji.
export const Icon: React.FC<{ name: IconName; size?: number; color?: string }> = ({
  name, size = 84, color = theme.colors.text,
}) => {
  const common = { fill: "none", stroke: color, strokeWidth: 3.2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg width={size} height={size} viewBox="0 0 48 48">
      {name === "wallet" && (
        <>
          <rect x="6" y="13" width="36" height="26" rx="5" {...common} />
          <path d="M6 19h30a6 6 0 0 1 6 6v0" {...common} />
          <path d="M11 13l20-6 3 6" {...common} />
          <circle cx="34" cy="28" r="2.4" fill={color} />
        </>
      )}
      {name === "flow" && (
        <>
          <path d="M6 16h28" {...common} />
          <path d="M28 10l6 6-6 6" {...common} />
          <path d="M42 32H14" {...common} />
          <path d="M20 26l-6 6 6 6" {...common} />
        </>
      )}
      {name === "target" && (
        <>
          <circle cx="24" cy="24" r="17" {...common} />
          <circle cx="24" cy="24" r="10" {...common} />
          <circle cx="24" cy="24" r="3" fill={color} />
          <path d="M24 24L40 8M34 8h6v6" {...common} />
        </>
      )}
    </svg>
  );
};

// Brand mark: a geometric "Z" built from a rising line (finance growth motif).
export const ZMark: React.FC<{ size: number; progress: number }> = ({ size, progress }) => {
  const len = 150;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      <rect x="4" y="4" width="92" height="92" rx="24" fill={theme.colors.primary} />
      <path
        d="M28 30H72L28 70H72"
        fill="none"
        stroke={theme.colors.ink}
        strokeWidth="10"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={len}
        strokeDashoffset={len * (1 - progress)}
      />
    </svg>
  );
};
