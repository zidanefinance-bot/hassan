import React from "react";
import { AbsoluteFill } from "remotion";
import { Presenter, PBrow, PGesture } from "../components/Presenter";

const looks: [PBrow, PGesture, number][] = [["neutral", "rest", 0], ["raised", "open", 0.6], ["concern", "count", 0], ["confident", "point", 0.9]];
export const PresenterPreview: React.FC = () => (
  <AbsoluteFill style={{ background: "#1B1D22", flexDirection: "row" }}>
    {looks.map(([b, g, m], i) => (
      <div key={i} style={{ width: 500, height: 560, position: "relative" }}>
        <Presenter mouth={m} brow={b} gesture={g} gestureT={1} />
      </div>
    ))}
  </AbsoluteFill>
);
