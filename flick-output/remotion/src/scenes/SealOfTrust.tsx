import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig, Easing, spring } from 'remotion';

export const SealOfTrust: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const packageScale = spring({ frame, fps, from: 0, to: 1, duration: 60, mass: 1 });
  const packageOpacity = interpolate(frame, [0, 30], [0, 1], { extrapolateRight: 'clamp' });

  const sealScale = spring({ frame: Math.max(0, frame - 180), fps, from: 0, to: 1.2, duration: 60, mass: 1.5 });
  const sealOpacity = interpolate(frame, [180, 210], [0, 1], { extrapolateRight: 'clamp' });
  const sealPulse = interpolate(frame, [210, 240], [1, 1.05], { extrapolateRight: 'clamp', easing: Easing.inOut(Easing.sine) });

  return (
    <AbsoluteFill style={{ backgroundColor: '#F9F9F9', justifyContent: 'center', alignItems: 'center', flexDirection: 'column', padding: 60 }}>
      <h1 style={{ fontSize: 48, fontWeight: 700, color: '#1A1A1A', marginBottom: 80, textAlign: 'center' }}>
        Sealed with care for your family
      </h1>

      <div style={{ position: 'relative', width: 300, height: 400, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        {/* Package */}
        <div
          style={{
            transform: `scale(${packageScale})`,
            opacity: packageOpacity,
            fontSize: 200,
          }}
        >
          📦
        </div>

        {/* Seal Badge */}
        <div
          style={{
            position: 'absolute',
            bottom: 20,
            right: 20,
            transform: `scale(${sealScale * sealPulse})`,
            opacity: sealOpacity,
            fontSize: 80,
          }}
        >
          ✅
        </div>
      </div>
    </AbsoluteFill>
  );
};
