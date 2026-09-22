import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig, spring } from 'remotion';

export const TrustReady: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const deliveryScale = spring({ frame, fps, from: 0, to: 1.2, duration: 60, mass: 1.5 });
  const deliveryOpacity = interpolate(frame, [0, 30], [0, 1], { extrapolateRight: 'clamp' });

  const check1Scale = spring({ frame: Math.max(0, frame - 90), fps, from: 0, to: 1.1, duration: 60, mass: 1.5 });
  const check1Opacity = interpolate(frame, [90, 120], [0, 1], { extrapolateRight: 'clamp' });

  const check2Scale = spring({ frame: Math.max(0, frame - 150), fps, from: 0, to: 1.1, duration: 60, mass: 1.5 });
  const check2Opacity = interpolate(frame, [150, 180], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', flexDirection: 'column', padding: 60 }}>
      <h1 style={{ fontSize: 48, fontWeight: 700, color: '#1A1A1A', marginBottom: 80, textAlign: 'center' }}>
        Ready to deliver quality and trust
      </h1>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 60 }}>
        {/* Delivery Icon */}
        <div
          style={{
            transform: `scale(${deliveryScale})`,
            opacity: deliveryOpacity,
            fontSize: 120,
          }}
        >
          🚚
        </div>

        {/* Checkmarks */}
        <div style={{ display: 'flex', gap: 40 }}>
          <div
            style={{
              transform: `scale(${check1Scale})`,
              opacity: check1Opacity,
              fontSize: 80,
            }}
          >
            ✅
          </div>
          <div
            style={{
              transform: `scale(${check2Scale})`,
              opacity: check2Opacity,
              fontSize: 80,
            }}
          >
            ✅
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
