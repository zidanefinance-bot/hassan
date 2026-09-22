import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig, Easing } from 'remotion';

export const CallToAction: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const textOpacity = interpolate(frame, [0, 30], [0, 1], { extrapolateRight: 'clamp' });
  const textTranslateY = interpolate(frame, [0, 60], [50, 0], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });

  const buttonScale = interpolate(frame, [60, 120], [0.8, 1.1], { extrapolateRight: 'clamp' });
  const buttonOpacity = interpolate(frame, [60, 90], [0, 1], { extrapolateRight: 'clamp' });
  const pulseIntensity = Math.abs(Math.sin((frame - 60) * 0.05)) * 0.1 + 0.95;

  return (
    <AbsoluteFill style={{ backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', flexDirection: 'column', padding: 60 }}>
      {/* Main Text */}
      <h1
        style={{
          fontSize: 52,
          fontWeight: 700,
          color: '#000000',
          marginBottom: 80,
          textAlign: 'center',
          transform: `translateY(${textTranslateY}px)`,
          opacity: textOpacity,
          maxWidth: 900,
          lineHeight: 1.3,
        }}
      >
        Order your ration pack today
      </h1>

      {/* CTA Button */}
      <div
        style={{
          backgroundColor: '#2D5016',
          color: '#FFFFFF',
          padding: '20px 60px',
          borderRadius: 12,
          fontSize: 36,
          fontWeight: 700,
          textAlign: 'center',
          cursor: 'pointer',
          transform: `scale(${buttonScale * pulseIntensity})`,
          opacity: buttonOpacity,
          boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
          transition: 'all 0.3s ease',
        }}
      >
        ORDER NOW
      </div>

      {/* Contact Info */}
      <div
        style={{
          marginTop: 80,
          fontSize: 20,
          color: '#666',
          textAlign: 'center',
          opacity: interpolate(frame, [120, 150], [0, 0.8], { extrapolateRight: 'clamp' }),
        }}
      >
        📱 Call us today | Free delivery available
      </div>
    </AbsoluteFill>
  );
};
