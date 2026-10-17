// LinkedIn banners. Company page cover 1128×191, personal profile banner 1584×396.
// Left zones are kept clear: the page logo / profile photo overlaps them on LinkedIn.
import React from "react";
import { AbsoluteFill, Composition, Img, staticFile } from "remotion";
import { CorpBg, corp } from "./kit";

const shot = (id: string) => staticFile(`catalog/${id}.png`);
const CLUSTER = [
  { id: "1017740", h: 0.78 }, // Falak basmati
  { id: "1148810", h: 0.86 }, // Dalda 5L
  { id: "1119315", h: 0.62 }, // Shan biryani
  { id: "1215041", h: 0.66 }, // Olper's ghee
  { id: "1145167", h: 0.7 }, // Tapal danedar
  { id: "1018326", h: 0.8 }, // Olper's milk
];

const Products: React.FC<{ height: number; gap: number; width: number; ids?: string[] }> = ({ height, gap, width, ids }) => {
  const list = ids ? CLUSTER.filter((c) => ids.includes(c.id)) : CLUSTER;
  const each = (width - gap * (list.length - 1)) / list.length;
  return (
  <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "flex-end", gap, position: "relative", width }}>
    <div style={{ position: "absolute", left: "8%", right: "8%", bottom: -height * 0.04, height: height * 0.08, borderRadius: "50%", background: "rgba(0,0,0,.6)", filter: `blur(${height * 0.05}px)` }} />
    {list.map((c) => (
      <div key={c.id} style={{ width: each, height: height * c.h, display: "flex", alignItems: "flex-end", justifyContent: "center", position: "relative" }}>
        <Img src={shot(c.id)} style={{ maxHeight: "100%", maxWidth: "100%", objectFit: "contain", filter: `drop-shadow(0 ${height * 0.05}px ${height * 0.06}px rgba(0,0,0,.5))` }} />
      </div>
    ))}
  </div>
  );
};

const Glow: React.FC<{ size: number; x: number; y: number }> = ({ size, x, y }) => (
  <div style={{ position: "absolute", width: size, height: size, left: x - size / 2, top: y - size / 2, borderRadius: "50%", background: `radial-gradient(circle, ${corp.red}55, transparent 65%)`, filter: `blur(${size * 0.08}px)` }} />
);

// Personal profile: photo sits bottom-left (~x 40–360), so text starts at x 470.
export const BannerPersonal: React.FC = () => (
  <AbsoluteFill style={{ overflow: "hidden" }}>
    <CorpBg />
    <Glow size={900} x={1250} y={330} />
    <div style={{ position: "absolute", left: 470, top: 70 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ width: 44, height: 3, background: corp.red }} />
        <div style={{ fontFamily: corp.body, fontWeight: 600, fontSize: 17, letterSpacing: "0.24em", textTransform: "uppercase", color: corp.dim }}>B2B grocery supply · Karachi</div>
      </div>
      <div style={{ marginTop: 18, fontFamily: corp.display, fontWeight: 800, fontSize: 56, lineHeight: 1.04, letterSpacing: "-0.035em", color: corp.text }}>
        Groceries for business.<br /><span style={{ color: corp.red }}>One supplier.</span>
      </div>
      <div style={{ marginTop: 20, fontFamily: corp.body, fontWeight: 600, fontSize: 18, color: corp.text }}>
        Factories · Offices · Hospitals · Schools · HoReCa
      </div>
      <div style={{ marginTop: 6, fontFamily: corp.body, fontWeight: 700, fontSize: 18, color: corp.red }}>www.zidane.com.pk</div>
    </div>
    <div style={{ position: "absolute", right: 70, top: 0, bottom: 0, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "flex-end" }}>
      <Img src={staticFile("brand/zidane-logo-white.svg")} style={{ width: 310 }} />
      <div style={{ marginTop: 22, width: 120, height: 4, background: corp.red }} />
    </div>
  </AbsoluteFill>
);

// Company page: the page logo overlaps bottom-left (~x 0–220), so text starts at x 250.
export const BannerCompany: React.FC = () => (
  <AbsoluteFill style={{ overflow: "hidden" }}>
    <CorpBg />
    <Glow size={520} x={900} y={150} />
    <div style={{ position: "absolute", left: 250, top: 26 }}>
      <div style={{ fontFamily: corp.body, fontWeight: 600, fontSize: 11, letterSpacing: "0.24em", textTransform: "uppercase", color: corp.dim }}>B2B grocery supply · Karachi</div>
      <div style={{ marginTop: 8, fontFamily: corp.display, fontWeight: 800, fontSize: 32, lineHeight: 1.04, letterSpacing: "-0.035em", color: corp.text }}>
        Groceries for business.<br /><span style={{ color: corp.red }}>One supplier.</span>
      </div>
      <div style={{ marginTop: 10, fontFamily: corp.body, fontWeight: 600, fontSize: 12.5, color: corp.text }}>
        Factories · Offices · Hospitals · HoReCa · <span style={{ color: corp.red }}>www.zidane.com.pk</span>
      </div>
    </div>
    <div style={{ position: "absolute", right: 60, top: 0, bottom: 0, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "flex-end" }}>
      <Img src={staticFile("brand/zidane-logo-white.svg")} style={{ width: 250 }} />
      <div style={{ marginTop: 12, width: 80, height: 3, background: corp.red }} />
    </div>
  </AbsoluteFill>
);

export const BannerCompositions: React.FC = () => (
  <>
    <Composition id="BannerLinkedInPersonal" component={BannerPersonal} durationInFrames={30} fps={30} width={1584} height={396} />
    <Composition id="BannerLinkedInCompany" component={BannerCompany} durationInFrames={30} fps={30} width={1128} height={191} />
  </>
);
