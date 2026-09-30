// Printable / LinkedIn-document catalogue pages (1080×1350). Render each page's last frame, then stitch to PDF.
import React from "react";
import { AbsoluteFill, Composition, Img, staticFile } from "remotion";
import { CorpBg, H, Kicker, LineIcon, Rule, corp } from "./kit";
import { products } from "./catalogData";

const W = 1080;
const HGT = 1350;
const FRAMES = 90;
const PER_PAGE = 12;
export const CAT_ORDER = ["Oil & Ghee", "Rice", "Atta & Flour", "Sugar", "Pulses & Chickpeas", "Masala & Spices", "Tea & Coffee", "Milk & Dairy", "Essentials"];

type Page =
  | { kind: "cover" }
  | { kind: "index" }
  | { kind: "cat"; cat: string; items: typeof products; part: number; parts: number }
  | { kind: "back" };

export const pages: Page[] = [{ kind: "cover" }, { kind: "index" }];
CAT_ORDER.forEach((c) => {
  const items = products.filter((p) => p.cat === c);
  const parts = Math.ceil(items.length / PER_PAGE);
  const per = Math.ceil(items.length / parts);
  for (let k = 0; k < parts; k++) pages.push({ kind: "cat", cat: c, items: items.slice(k * per, (k + 1) * per), part: k + 1, parts });
});
pages.push({ kind: "back" });

const Footer: React.FC<{ n: number }> = ({ n }) => (
  <div style={{ position: "absolute", bottom: 50, left: corp.pad, right: corp.pad }}>
    <Rule />
    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 18, fontFamily: corp.body, fontWeight: 600, fontSize: 24, color: corp.dim }}>
      <span>Zidane Wholesale Solutions · Product Catalogue 2026</span><span>{String(n).padStart(2, "0")} / {String(pages.length).padStart(2, "0")}</span>
    </div>
  </div>
);

const Cover: React.FC = () => {
  const hero = ["1148810", "1017740", "1119315", "1145167", "1018326", "1215041"];
  return (
    <AbsoluteFill>
      <CorpBg />
      <div style={{ position: "absolute", top: 90, left: corp.pad }}><Img src={staticFile("brand/zidane-logo-white.svg")} style={{ width: 360 }} /></div>
      <div style={{ position: "absolute", top: 330, left: corp.pad, right: corp.pad }}>
        <Kicker>Product catalogue · 2026</Kicker>
        <div style={{ marginTop: 34 }}>
          <H size={120}>{products.length} products.</H>
          <H size={120} color={corp.red}>One supplier.</H>
        </div>
        <div style={{ marginTop: 34, fontFamily: corp.body, fontSize: 36, lineHeight: 1.45, color: corp.dim, maxWidth: 820 }}>
          Bulk grocery supply for factories, offices, hospitals, schools, NGOs and HoReCa across Karachi.
        </div>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 150, height: 360, display: "flex", justifyContent: "center", alignItems: "flex-end", gap: 18 }}>
        {hero.map((id, i) => (
          <Img key={id} src={staticFile(`catalog/${id}.png`)} style={{ height: [230, 260, 200, 230, 250, 210][i], maxWidth: 150, objectFit: "contain", filter: "drop-shadow(0 20px 24px rgba(0,0,0,.5))" }} />
        ))}
      </div>
      <div style={{ position: "absolute", bottom: 60, left: corp.pad, right: corp.pad, display: "flex", justifyContent: "space-between", fontFamily: corp.body, fontWeight: 600, fontSize: 28, color: corp.text }}>
        <span>sales@zidane.com.pk</span><span>zidane.com.pk</span>
      </div>
    </AbsoluteFill>
  );
};

const Index: React.FC = () => {
  const counts = CAT_ORDER.map((c) => [c, products.filter((p) => p.cat === c).length] as const);
  return (
    <AbsoluteFill>
      <CorpBg />
      <div style={{ position: "absolute", top: 110, left: corp.pad, right: corp.pad }}>
        <Kicker>Contents</Kicker>
        <div style={{ marginTop: 26 }}><H size={80}>Nine categories.</H><H size={80} color={corp.dim}>Brands you know.</H></div>
        <div style={{ marginTop: 44 }}>
          {counts.map(([c, n]) => {
            const first = pages.findIndex((p) => p.kind === "cat" && p.cat === c) + 1;
            return (
              <div key={c}>
                <Rule />
                <div style={{ display: "flex", alignItems: "baseline", padding: "15px 0", fontFamily: corp.display }}>
                  <span style={{ fontWeight: 700, fontSize: 42, color: corp.text, flex: 1, letterSpacing: "-0.02em" }}>{c}</span>
                  <span style={{ fontFamily: corp.body, fontSize: 30, color: corp.dim, marginRight: 40 }}>{n} products</span>
                  <span style={{ fontWeight: 800, fontSize: 40, color: corp.red, width: 70, textAlign: "right" }}>{String(first).padStart(2, "0")}</span>
                </div>
              </div>
            );
          })}
          <Rule />
        </div>
      </div>
      <Footer n={2} />
    </AbsoluteFill>
  );
};

const CatPage: React.FC<{ p: Extract<Page, { kind: "cat" }>; n: number }> = ({ p, n }) => (
  <AbsoluteFill>
    <CorpBg />
    <div style={{ position: "absolute", top: 90, left: corp.pad, right: corp.pad, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
      <div>
        <Kicker>{`${products.filter((x) => x.cat === p.cat).length} products${p.parts > 1 ? ` · part ${p.part} of ${p.parts}` : ""}`}</Kicker>
        <div style={{ marginTop: 18 }}><H size={p.cat.length > 14 ? 68 : 84}>{p.cat}</H></div>
      </div>
      <Img src={staticFile("brand/zidane-logo-white.svg")} style={{ width: 200, marginBottom: 12 }} />
    </div>
    <div style={{ position: "absolute", top: 300, left: corp.pad - 10, right: corp.pad - 10, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
      {p.items.map((it) => (
        <div key={it.id} style={{ background: "rgba(255,255,255,0.035)", border: `1.5px solid ${corp.line}`, borderRadius: 20, padding: "16px 14px 18px", height: 290, display: "flex", flexDirection: "column" }}>
          <div style={{ height: 170, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Img src={staticFile(it.img)} style={{ maxHeight: 165, maxWidth: "100%", objectFit: "contain", filter: "drop-shadow(0 10px 12px rgba(0,0,0,.45))" }} />
          </div>
          <div style={{ marginTop: 12, fontFamily: corp.body, fontWeight: 700, fontSize: 15, letterSpacing: "0.14em", textTransform: "uppercase", color: corp.red }}>{it.brand}</div>
          <div style={{ marginTop: 4, fontFamily: corp.body, fontWeight: 600, fontSize: 21, lineHeight: 1.25, color: corp.text }}>{it.name}</div>
        </div>
      ))}
    </div>
    <Footer n={n} />
  </AbsoluteFill>
);

const Back: React.FC<{ n: number }> = ({ n }) => {
  const steps: { icon: "list" | "search" | "check" | "truck"; t: string; s: string }[] = [
    { icon: "list", t: "Send your list", s: "Excel, PDF, RFQ, WhatsApp or a photo" },
    { icon: "search", t: "Get a structured quote", s: "Brands, pack sizes and quantities, clearly" },
    { icon: "check", t: "Packed to spec", s: "Against your approved item list" },
    { icon: "truck", t: "Delivered on schedule", s: "One-time, weekly or monthly" },
  ];
  return (
    <AbsoluteFill>
      <CorpBg />
      <div style={{ position: "absolute", top: 110, left: corp.pad, right: corp.pad }}>
        <Kicker>How to order</Kicker>
        <div style={{ marginTop: 26 }}><H size={80}>Send the list.</H><H size={80} color={corp.red}>We'll take it from there.</H></div>
        <div style={{ marginTop: 44 }}>
          {steps.map((s, i) => (
            <div key={s.t}>
              <Rule />
              <div style={{ display: "flex", alignItems: "center", gap: 30, padding: "18px 0" }}>
                <LineIcon name={s.icon} size={78} color={corp.red} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: corp.display, fontWeight: 700, fontSize: 44, color: corp.text }}>{s.t}</div>
                  <div style={{ fontFamily: corp.body, fontSize: 28, color: corp.dim, marginTop: 4 }}>{s.s}</div>
                </div>
                <div style={{ fontFamily: corp.display, fontWeight: 800, fontSize: 48, color: corp.lineStrong }}>0{i + 1}</div>
              </div>
            </div>
          ))}
          <Rule />
        </div>
        <div style={{ marginTop: 50, display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 20 }}>
          <div>
            <div style={{ fontFamily: corp.body, fontWeight: 600, fontSize: 24, letterSpacing: "0.16em", color: corp.dim, textTransform: "uppercase" }}>Email</div>
            <div style={{ fontFamily: corp.display, fontWeight: 700, fontSize: 46, color: corp.text, marginTop: 6 }}>sales@zidane.com.pk</div>
            <div style={{ fontFamily: corp.body, fontSize: 30, color: corp.dim, marginTop: 10 }}>zidane.com.pk · Karachi</div>
          </div>
          <Img src={staticFile("brand/zidane-logo-white.svg")} style={{ width: 200, flexShrink: 0 }} />
        </div>
        <div style={{ marginTop: 30, fontFamily: corp.body, fontSize: 22, color: corp.dim }}>Images for reference. Brands, pack sizes and availability are confirmed in your quote.</div>
      </div>
      <Footer n={n} />
    </AbsoluteFill>
  );
};

export const catalogPageIds = pages.map((_, i) => `Catalog${String(i + 1).padStart(2, "0")}`);

export const CatalogCompositions: React.FC = () => (
  <>
    {pages.map((p, i) => {
      const n = i + 1;
      const C: React.FC = () =>
        p.kind === "cover" ? <Cover /> : p.kind === "index" ? <Index /> : p.kind === "back" ? <Back n={n} /> : <CatPage p={p} n={n} />;
      return <Composition key={i} id={catalogPageIds[i]} component={C} durationInFrames={FRAMES} fps={30} width={W} height={HGT} />;
    })}
  </>
);
