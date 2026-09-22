import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig, Easing, spring } from 'remotion';

export const ProfessionalProcess: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const step1Opacity = interpolate(frame, [0, 30], [0, 1], { extrapolateRight: 'clamp' });
  const step1Scale = spring({ frame, fps, from: 0, to: 1, duration: 60, mass: 1 });

  const step2Opacity = interpolate(frame, [60, 90], [0, 1], { extrapolateRight: 'clamp' });
  const step2Scale = spring({ frame: Math.max(0, frame - 60), fps, from: 0, to: 1, duration: 60, mass: 1 });

  const step3Opacity = interpolate(frame, [120, 150], [0, 1], { extrapolateRight: 'clamp' });
  const step3Scale = spring({ frame: Math.max(0, frame - 120), fps, from: 0, to: 1, duration: 60, mass: 1 });

  return (
    <AbsoluteFill style={{ backgroundColor: '#F5F5F5', padding: 60, justifyContent: 'center', alignItems: 'center', flexDirection: 'column' }}>
      <h1 style={{ fontSize: 48, fontWeight: 700, color: '#1A1A1A', marginBottom: 60 }}>
        Professional packing process
      </h1>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 40, width: '100%', maxWidth: 800 }}>
        {/* Step 1 */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 30,
          transform: `scale(${step1Scale})`,
          opacity: step1Opacity,
        }}>
          <div style={{ fontSize: 60, minWidth: 80 }}>1️⃣</div>
          <div style={{ fontSize: 32, color: '#333', fontWeight: 500 }}>Collect & Inspect</div>
        </div>

        {/* Step 2 */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 30,
          transform: `scale(${step2Scale})`,
          opacity: step2Opacity,
        }}>
          <div style={{ fontSize: 60, minWidth: 80 }}>2️⃣</div>
          <div style={{ fontSize: 32, color: '#333', fontWeight: 500 }}>Pack with Care</div>
        </div>

        {/* Step 3 */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 30,
          transform: `scale(${step3Scale})`,
          opacity: step3Opacity,
        }}>
          <div style={{ fontSize: 60, minWidth: 80 }}>3️⃣</div>
          <div style={{ fontSize: 32, color: '#333', fontWeight: 500 }}>Quality Check</div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
