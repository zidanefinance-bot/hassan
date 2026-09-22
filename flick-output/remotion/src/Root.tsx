import React from 'react';
import { Composition } from 'remotion';
import { OpeningHook } from './scenes/OpeningHook';
import { ProfessionalProcess } from './scenes/ProfessionalProcess';
import { FreshIngredients } from './scenes/FreshIngredients';
import { SealOfTrust } from './scenes/SealOfTrust';
import { TrustReady } from './scenes/TrustReady';
import { CallToAction } from './scenes/CallToAction';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="opening-hook"
        component={OpeningHook}
        durationInFrames={180}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="professional-process"
        component={ProfessionalProcess}
        durationInFrames={210}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="fresh-ingredients"
        component={FreshIngredients}
        durationInFrames={210}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="seal-of-trust"
        component={SealOfTrust}
        durationInFrames={240}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="trust-ready"
        component={TrustReady}
        durationInFrames={210}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="call-to-action"
        component={CallToAction}
        durationInFrames={180}
        fps={30}
        width={1080}
        height={1920}
      />
    </>
  );
};
