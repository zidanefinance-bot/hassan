import React from "react";
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { brand } from "../brand";
import { theme } from "../theme";
import { Sparkle, headline, usePop } from "../components/Cute";

export const LOGO_LAND = 12; // frames

// Red circle wipe → white Zidane logo → audience chips → CTA, WhatsApp, URL. Long still hold.
export const Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const wipe = spring({ frame, fps, config: theme.spring.smooth });
  const logo = usePop(LOGO_LAND);
  const cta = usePop(36);
  const wa = usePop(44);
  const url = usePop(50);
  const float = Math.sin(frame / 20) * 6;
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ background: theme.colors.red, clipPath: `circle(${interpolate(wipe, [0, 1], [0, 130])}% at 50% 50%)` }}>
        <AbsoluteFill
          style={{
            backgroundImage: `radial-gradient(rgba(255,255,255,0.10) 9px, transparent 10px)`,
            backgroundSize: "90px 90px", backgroundPosition: `${frame * 0.6}px ${frame * 0.9}px`,
          }}
        />
        <AbsoluteFill style={{ alignItems: "center" }}>
          <div style={{ marginTop: 330, transform: `${logo.transform} translateY(${float}px)`, opacity: logo.opacity }}>
            <Img src={staticFile("brand/zidane-logo-white.svg")} style={{ width: 800 }} />
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 18, marginTop: 70, width: 900 }}>
            {brand.audience.map((a, i) => {
              const p = spring({ frame: frame - 22 - i * 4, fps, config: theme.spring.bouncy });
              return (
                <div key={a}
                  style={{
                    transform: `scale(${p})`, border: `4px solid ${theme.colors.white}`, color: theme.colors.white,
                    borderRadius: 999, padding: "12px 32px", fontFamily: theme.fonts.display, fontWeight: 700, fontSize: 40,
                  }}>
                  {a}
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 90, transform: cta.transform, opacity: cta.opacity }}>
            <div style={{ ...headline, fontSize: 84, color: theme.colors.yellow }}>{brand.cta}</div>
          </div>
          <div style={{ marginTop: 50, transform: wa.transform, opacity: wa.opacity }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 22, background: theme.colors.whatsapp, color: theme.colors.white,
              borderRadius: 999, padding: "24px 52px", border: `5px solid ${theme.colors.ink}`, boxShadow: `8px 8px 0 ${theme.colors.ink}`,
              fontFamily: theme.fonts.display, fontWeight: 800, fontSize: 58,
            }}>
              <WhatsAppIcon />
              {brand.whatsapp}
            </div>
          </div>
          <div style={{ marginTop: 56, transform: url.transform, opacity: url.opacity, textAlign: "center" }}>
            <div style={{ ...headline, color: theme.colors.white, fontSize: 60 }}>{brand.url}</div>
            <div style={{ fontFamily: theme.fonts.body, fontWeight: 600, color: "rgba(255,255,255,0.8)", fontSize: 40, marginTop: 14 }}>{brand.uan}</div>
          </div>
        </AbsoluteFill>
        <Sparkle size={80} x={110} y={220} delay={20} />
        <Sparkle size={60} x={880} y={250} delay={26} color={theme.colors.white} />
        <Sparkle size={70} x={900} y={1560} delay={32} />
        <Sparkle size={50} x={120} y={1620} delay={38} color={theme.colors.white} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const WhatsAppIcon: React.FC = () => (
  <svg width={64} height={64} viewBox="0 0 32 32">
    <path fill="#fff" d="M16 3C9 3 3.3 8.6 3.3 15.6c0 2.2.6 4.4 1.7 6.3L3 29l7.3-1.9c1.8 1 3.8 1.5 5.8 1.5 7 0 12.7-5.7 12.7-12.6C28.7 8.6 23 3 16 3zm0 23.1c-1.9 0-3.7-.5-5.3-1.4l-.4-.2-4.3 1.1 1.2-4.2-.3-.4c-1-1.7-1.5-3.6-1.5-5.5C5.4 9.8 10.2 5 16 5s10.6 4.8 10.6 10.6S21.8 26.1 16 26.1zm5.8-7.9c-.3-.2-1.9-.9-2.2-1-.3-.1-.5-.2-.7.2-.2.3-.8 1-1 1.2-.2.2-.4.2-.7.1-.3-.2-1.3-.5-2.6-1.6-1-.9-1.6-1.9-1.8-2.2-.2-.3 0-.5.1-.7l.5-.6c.2-.2.2-.3.3-.6.1-.2 0-.4 0-.6l-1-2.4c-.3-.6-.5-.5-.7-.5h-.6c-.2 0-.6.1-.9.4-.3.3-1.2 1.1-1.2 2.8s1.2 3.2 1.4 3.5c.2.2 2.4 3.6 5.8 5 .8.4 1.4.6 1.9.7.8.3 1.5.2 2.1.1.6-.1 1.9-.8 2.2-1.5.3-.7.3-1.4.2-1.5-.1-.2-.3-.3-.6-.4z"/>
  </svg>
);
