import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig, Easing, spring } from 'remotion';

export const OpeningHook: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoScale = spring({
    frame,
    fps,
    from: 0,
    to: 1.2,
    duration: 60,
    mass: 1.5,
    damping: 8,
  });

  const textOpacity = interpolate(frame, [60, 90], [0, 1], {
    extrapolateRight: 'clamp',
  });

  const textTranslateY = interpolate(frame, [60, 150], [50, 0], {
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  return (
    <AbsoluteFill style={{ backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center' }}>
      {/* Logo */}
      <div
        style={{
          transform: `scale(${logoScale})`,
          fontSize: 80,
          fontWeight: 'bold',
          color: '#1A1A1A',
          marginBottom: 40,
          opacity: interpolate(frame, [0, 30], [0, 1], { extrapolateRight: 'clamp' }),
        }}
      >
        📦
      </div>

      {/* Main Text */}
      <div
        style={{
          fontSize: 54,
          fontWeight: 700,
          color: '#000000',
          textAlign: 'center',
          transform: `translateY(${textTranslateY}px)`,
          opacity: textOpacity,
          maxWidth: 900,
          lineHeight: 1.3,
        }}
      >
        Ration packing - quality assured
      </div>
    </AbsoluteFill>
  );
};
