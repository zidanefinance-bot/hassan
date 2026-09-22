import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig, spring } from 'remotion';

export const FreshIngredients: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const item1Scale = spring({ frame, fps, from: 0, to: 1.1, duration: 60, mass: 1.5 });
  const item1Opacity = interpolate(frame, [0, 30], [0, 1], { extrapolateRight: 'clamp' });

  const item2Scale = spring({ frame: Math.max(0, frame - 60), fps, from: 0, to: 1.1, duration: 60, mass: 1.5 });
  const item2Opacity = interpolate(frame, [60, 90], [0, 1], { extrapolateRight: 'clamp' });

  const item3Scale = spring({ frame: Math.max(0, frame - 120), fps, from: 0, to: 1.1, duration: 60, mass: 1.5 });
  const item3Opacity = interpolate(frame, [120, 150], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ backgroundColor: '#FFFFFF', padding: 60, justifyContent: 'center', alignItems: 'center', flexDirection: 'column' }}>
      <h1 style={{ fontSize: 46, fontWeight: 700, color: '#2D5016', marginBottom: 80, textAlign: 'center' }}>
        Fresh ingredients carefully selected
      </h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 40, maxWidth: 800 }}>
        {/* Rice */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 20,
          transform: `scale(${item1Scale})`,
          opacity: item1Opacity,
        }}>
          <div style={{ fontSize: 80 }}>🌾</div>
          <div style={{ fontSize: 24, fontWeight: 600, color: '#1A1A1A', textAlign: 'center' }}>Rice</div>
        </div>

        {/* Lentils */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 20,
          transform: `scale(${item2Scale})`,
          opacity: item2Opacity,
        }}>
          <div style={{ fontSize: 80 }}>🫘</div>
          <div style={{ fontSize: 24, fontWeight: 600, color: '#1A1A1A', textAlign: 'center' }}>Lentils</div>
        </div>

        {/* Flour */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 20,
          transform: `scale(${item3Scale})`,
          opacity: item3Opacity,
        }}>
          <div style={{ fontSize: 80 }}>🌾</div>
          <div style={{ fontSize: 24, fontWeight: 600, color: '#1A1A1A', textAlign: 'center' }}>Flour</div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
