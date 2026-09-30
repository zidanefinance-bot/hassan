import React from "react";
import { Composition } from "remotion";
import { Main, FPS, TOTAL } from "./Main";

export const RemotionRoot: React.FC = () => (
  <Composition id="ZidaneReel" component={Main} durationInFrames={TOTAL} fps={FPS} width={1080} height={1920} />
);
