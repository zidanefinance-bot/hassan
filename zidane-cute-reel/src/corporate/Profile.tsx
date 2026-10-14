// Company profile (A4 portrait, 1240×1754 ≈ 150 dpi). Static pages: render the last frame of each, then stitch to PDF.
// Copy is taken from zidane.com.pk (home + about) — no invented numbers or claims.
import React from "react";
import { AbsoluteFill, Composition, Img, staticFile } from "remotion";
import "../Fonts";
import { CorpBg, IconName, LineIcon, corp } from "./kit";
import { products } from "./catalogData";
import { CAT_ORDER } from "./CatalogPdf";

const W = 1240;
const HGT = 1754;
const PAD = 100;
const L = { bg: "#F7F5F1", card: "#FFFFFF", ink: "#121418", dim: "#5F6670", line: "#E2DDD4", red: corp.red, soft: "#FBE9EA" };

const Kick: React.FC<{ children: React.ReactNode; dark?: boolean }> = ({ children, dark }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
    <div style={{ width: 56, height: 4, background: L.red }} />
    <div style={{ fontFamily: "Inter", fontWeight: 600, fontSize: 24, letterSpacing: "0.22em", textTransform: "uppercase", color: dark ? corp.dim : L.dim }}>{children}</div>
  </div>
);
const Head: React.FC<{ children: React.ReactNode; size?: number; color?: string }> = ({ children, size = 78, color = L.ink }) => (
  <div style={{ fontFamily: "Sora", fontWeight: 700, fontSize: size, lineHeight: 1.06, letterSpacing: "-0.035em", color }}>{children}</div>
);
const Body: React.FC<{ children: React.ReactNode; size?: number; color?: string; style?: React.CSSProperties }> = ({ children, size = 27, color = L.dim, style }) => (
  <div style={{ fontFamily: "Inter", fontWeight: 400, fontSize: size, lineHeight: 1.55, color, ...style }}>{children}</div>
);

const TOTAL = 9;
const LightPage: React.FC<{ n: number; section: string; children: React.ReactNode }> = ({ n, section, children }) => (
  <AbsoluteFill style={{ background: L.bg }}>
    <div style={{ position: "absolute", top: 64, left: PAD, right: PAD, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <Img src={staticFile("brand/zidane-logo.svg")} style={{ height: 52 }} />
      <div style={{ fontFamily: "Inter", fontWeight: 600, fontSize: 20, letterSpacing: "0.2em", color: L.dim, textTransform: "uppercase" }}>{String(n).padStart(2, "0")} · {section}</div>
    </div>
    <div style={{ position: "absolute", top: 170, left: PAD, right: PAD, bottom: 140 }}>{children}</div>
    <div style={{ position: "absolute", bottom: 56, left: PAD, right: PAD, borderTop: `2px solid ${L.line}`, paddingTop: 18, display: "flex", justifyContent: "space-between", fontFamily: "Inter", fontWeight: 600, fontSize: 19, color: L.dim }}>
      <span>Zidane Wholesale Solutions · Company Profile 2026</span>
      <span>www.zidane.com.pk · {String(n).padStart(2, "0")} / {String(TOTAL).padStart(2, "0")}</span>
    </div>
  </AbsoluteFill>
);

const Photo: React.FC<{ src: string; h: number; pos?: string; style?: React.CSSProperties }> = ({ src, h, pos = "center", style }) => (
  <div style={{ height: h, borderRadius: 18, overflow: "hidden", ...style }}>
    <Img src={staticFile(src)} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: pos }} />
  </div>
);

// ── 01 Cover ──
const Cover: React.FC = () => (
  <AbsoluteFill>
    <CorpBg />
    <div style={{ position: "absolute", top: 90, left: PAD }}><Img src={staticFile("brand/zidane-logo-white.svg")} style={{ width: 380 }} /></div>
    <div style={{ position: "absolute", top: 380, left: PAD, right: PAD }}>
      <Kick dark>Company Profile · 2026</Kick>
      <div style={{ marginTop: 40 }}>
        <Head size={150} color={corp.text}>Groceries</Head>
        <Head size={150} color={corp.red}>for business.</Head>
      </div>
      <Body size={34} color={corp.dim} style={{ marginTop: 40, maxWidth: 900 }}>
        B2B grocery supply for companies, factories, institutions and organizations across Karachi.
      </Body>
    </div>
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 640, overflow: "hidden" }}>
      <Img src={staticFile("photo/truck.jpg")} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "35% 60%" }} />
      <div style={{ position: "absolute", inset: 0, background: `linear-gradient(180deg, ${corp.bg} 0%, rgba(13,15,18,0.25) 35%, rgba(13,15,18,0.15) 70%, rgba(13,15,18,0.85) 100%)` }} />
      <div style={{ position: "absolute", bottom: 56, left: PAD, right: PAD, display: "flex", justifyContent: "space-between", fontFamily: "Inter", fontWeight: 600, fontSize: 28, color: corp.text }}>
        <span>www.zidane.com.pk</span><span>sales@zidane.com.pk</span>
      </div>
    </div>
  </AbsoluteFill>
);

// ── 02 About ──
const About: React.FC = () => (
  <LightPage n={2} section="About us">
    <Kick>Who we are</Kick>
    <div style={{ marginTop: 26 }}><Head>Grocery trading and ration programs, <span style={{ color: L.red }}>built for institutions.</span></Head></div>
    <Body size={30} color={L.ink} style={{ marginTop: 36 }}>
      Zidane Corporation / Zidane Wholesale Solutions sources and delivers wholesale groceries for institutions, and turns that same
      procurement capability into ration bags for the people who need them most: corporate welfare, NGO distribution, Ramadan programs
      and monthly household support.
    </Body>
    <div style={{ marginTop: 50, display: "flex", gap: 36 }}>
      <Photo src="photo/warehouse.jpg" h={560} pos="center 30%" style={{ flex: "0 0 470px" }} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 26 }}>
        <div style={{ fontFamily: "Inter", fontWeight: 600, fontSize: 22, letterSpacing: "0.18em", color: L.dim, textTransform: "uppercase" }}>Two sides of one supply chain</div>
        {[
          { t: "B2B Grocery Supply", d: "Bulk sourcing and recurring supply of staples, oils, spices and dairy for factories, hospitals, schools and HoReCa operators." },
          { t: "Ration Programs", d: "Custom and fixed-package ration bags for corporate welfare, NGO distribution, Ramadan campaigns and monthly household support." },
        ].map((c) => (
          <div key={c.t} style={{ background: L.card, borderRadius: 18, padding: "30px 32px", borderTop: `6px solid ${L.red}` }}>
            <div style={{ fontFamily: "Sora", fontWeight: 700, fontSize: 34, color: L.ink }}>{c.t}</div>
            <Body size={25} style={{ marginTop: 10 }}>{c.d}</Body>
          </div>
        ))}
      </div>
    </div>
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 10, background: L.ink, borderRadius: 18, padding: "28px 36px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <div style={{ fontFamily: "Inter", fontWeight: 600, fontSize: 20, letterSpacing: "0.18em", color: corp.dim, textTransform: "uppercase" }}>Head office</div>
      <div style={{ fontFamily: "Inter", fontWeight: 600, fontSize: 26, color: "#fff" }}>B-55, Sector 31-D, PNT Society, Korangi, Karachi</div>
    </div>
  </LightPage>
);

// ── 03 Services ──
const services = [
  ["Bulk Grocery Supply", "Staples, oils, spices and dairy in institutional volumes."],
  ["Contract-Based Supply", "Agreed items and terms for ongoing requirements."],
  ["Multi-Category Consolidated Sourcing", "Many categories through one supplier and one point of contact."],
  ["Scheduled & Recurring Deliveries", "Supply planned on an agreed weekly or monthly schedule."],
  ["High-Volume / Emergency Support", "Support for large and urgent requirements."],
  ["Logistics & Distribution Coordination", "Delivery planned around your locations and dates."],
  ["Restaurant & HoReCa Supply", "Kitchen staples for restaurants, hotels and caterers."],
  ["Custom Ration Programs", "Ration bags for employees, NGOs, welfare and Ramadan."],
];
const Services: React.FC = () => (
  <LightPage n={3} section="What we do">
    <Kick>How we work</Kick>
    <div style={{ marginTop: 26 }}><Head>Procurement, <span style={{ color: L.red }}>not just supply.</span></Head></div>
    <Body size={28} color={L.ink} style={{ marginTop: 30 }}>
      Every order, whether a single bulk delivery or a recurring program, starts with a defined requirement: items, quantities, budget,
      packaging and delivery locations. We coordinate sourcing, packing and distribution against that specification, with documentation
      suited to institutional and donor reporting where needed.
    </Body>
    <div style={{ marginTop: 50, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 22 }}>
      {services.map(([t, d], i) => (
        <div key={t} style={{ background: L.card, borderRadius: 18, padding: "28px 30px", minHeight: 190 }}>
          <div style={{ fontFamily: "Sora", fontWeight: 700, fontSize: 22, color: L.red }}>{String(i + 1).padStart(2, "0")}</div>
          <div style={{ marginTop: 10, fontFamily: "Sora", fontWeight: 700, fontSize: 29, lineHeight: 1.15, color: L.ink }}>{t}</div>
          <Body size={23} style={{ marginTop: 8 }}>{d}</Body>
        </div>
      ))}
    </div>
  </LightPage>
);

// ── 04 Product range ──
const catLabel: Record<string, string> = { "Atta & Flour": "Flour / Atta / Maida", "Pulses & Chickpeas": "Pulses / Daal", "Masala & Spices": "Spices & Masala", "Oil & Ghee": "Cooking Oil & Ghee" };
const heroPick: Record<string, string[]> = {
  "Oil & Ghee": ["1148810", "1040249"], Rice: ["1017740", "1019951"], "Atta & Flour": ["1200458", "1052940"], "Tea & Coffee": ["1145167", "1033425"], "Milk & Dairy": ["1018326", "1017781"],
};
const Range: React.FC = () => (
  <LightPage n={4} section="Product range">
    <Kick>The grocery desk</Kick>
    <div style={{ marginTop: 26 }}><Head>The everyday categories <span style={{ color: L.red }}>your business buys in volume.</span></Head></div>
    <Body size={28} style={{ marginTop: 26 }}>Well-known brands and pack sizes sourced against your requirement, not a retail cart.</Body>
    <div style={{ marginTop: 44, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20 }}>
      {CAT_ORDER.map((c) => {
        const ids = heroPick[c] ?? products.filter((p) => p.cat === c).slice(0, 2).map((p) => p.id);
        return (
          <div key={c} style={{ background: L.card, borderRadius: 18, padding: "22px 20px 24px", height: 330, display: "flex", flexDirection: "column" }}>
            <div style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "flex-end", gap: 8 }}>
              {ids.map((id, k) => <Img key={id} src={staticFile(`catalog/${id}.png`)} style={{ height: k === 0 ? 210 : 170, maxWidth: 160, objectFit: "contain" }} />)}
            </div>
            <div style={{ marginTop: 16, fontFamily: "Sora", fontWeight: 700, fontSize: 25, color: L.ink, textAlign: "center" }}>{catLabel[c] ?? c}</div>
          </div>
        );
      })}
    </div>
  </LightPage>
);

// ── 05 Industries ──
const industries: { icon: IconName; t: string; d: string }[] = [
  { icon: "factory", t: "Textile & Manufacturing", d: "Canteens, staff welfare and employee ration." },
  { icon: "office", t: "Corporate Offices", d: "Pantry supply and employee programs." },
  { icon: "hospital", t: "Hospitals & Healthcare", d: "Kitchen staples for patients and staff." },
  { icon: "school", t: "Schools, Colleges & Hostels", d: "Mess and cafeteria requirements." },
  { icon: "ngo", t: "NGOs & Welfare Organizations", d: "Ration kits and distribution programs." },
  { icon: "horeca", t: "Restaurants / HoReCa", d: "Recurring kitchen supply." },
  { icon: "site", t: "Project Sites & Camps", d: "Bulk supply for crews on site." },
];
const Industries: React.FC = () => (
  <LightPage n={5} section="Industries">
    <Kick>Built around procurement teams</Kick>
    <div style={{ marginTop: 26 }}><Head>Grocery requirements look different <span style={{ color: L.red }}>in every organization.</span></Head></div>
    <div style={{ marginTop: 56, display: "flex", flexDirection: "column", gap: 20 }}>
      {industries.map((x) => (
        <div key={x.t} style={{ background: L.card, borderRadius: 18, padding: "24px 32px", display: "flex", alignItems: "center", gap: 30 }}>
          <div style={{ width: 96, height: 96, borderRadius: 48, background: L.soft, display: "grid", placeItems: "center", flexShrink: 0 }}>
            <LineIcon name={x.icon} size={62} color={L.red} />
          </div>
          <div>
            <div style={{ fontFamily: "Sora", fontWeight: 700, fontSize: 32, color: L.ink }}>{x.t}</div>
            <Body size={24} style={{ marginTop: 4 }}>{x.d}</Body>
          </div>
        </div>
      ))}
    </div>
  </LightPage>
);

// ── 06 Process ──
const steps = [
  ["Send the requirement", "Your list, quantities and preferred pack sizes."],
  ["We structure it", "Messy lists turned into a clean, itemised requirement."],
  ["Clear quotation", "Brands, pack sizes and rates you can compare."],
  ["Sourcing & packing", "Prepared against the confirmed requirement."],
  ["Scheduled delivery", "Dispatched to your locations on the agreed date."],
];
const brief = [["Atta", "10 kg bags", "500 kg"], ["Rice", "Institutional grade", "250 kg"], ["Cooking oil", "1 L / 5 L · brand options", "As required"], ["Tea", "170–180 g · approved brands", "As required"]];
const Process: React.FC = () => (
  <LightPage n={6} section="How it works">
    <Kick>Send the requirement, not a perfect brief</Kick>
    <div style={{ marginTop: 26 }}><Head>Your buying list can be messy. <span style={{ color: L.red }}>Our quote should not be.</span></Head></div>
    <div style={{ marginTop: 34, display: "flex", gap: 14, flexWrap: "wrap" }}>
      {["Excel / CSV", "PDF RFQ", "WhatsApp list", "Photo of a handwritten list"].map((c) => (
        <div key={c} style={{ border: `2px solid ${L.ink}`, borderRadius: 40, padding: "10px 24px", fontFamily: "Inter", fontWeight: 600, fontSize: 24, color: L.ink }}>{c}</div>
      ))}
    </div>
    <div style={{ marginTop: 50, position: "relative" }}>
      <div style={{ position: "absolute", left: 35, top: 30, bottom: 30, width: 3, background: L.line }} />
      {steps.map(([t, d], i) => (
        <div key={t} style={{ display: "flex", gap: 30, alignItems: "center", marginBottom: 36, position: "relative" }}>
          <div style={{ width: 72, height: 72, borderRadius: 36, background: i === 4 ? L.red : L.ink, color: "#fff", display: "grid", placeItems: "center", fontFamily: "Sora", fontWeight: 700, fontSize: 30, flexShrink: 0 }}>{i + 1}</div>
          <div>
            <div style={{ fontFamily: "Sora", fontWeight: 700, fontSize: 32, color: L.ink }}>{t}</div>
            <Body size={24}>{d}</Body>
          </div>
        </div>
      ))}
    </div>
    <div style={{ marginTop: 40, background: L.card, borderRadius: 18, padding: "30px 32px" }}>
      <div style={{ fontFamily: "Inter", fontWeight: 600, fontSize: 20, letterSpacing: "0.18em", color: L.dim, textTransform: "uppercase" }}>Example buying brief</div>
      {brief.map(([a, b, c]) => (
        <div key={a} style={{ display: "flex", justifyContent: "space-between", padding: "14px 0", borderBottom: `2px dashed ${L.line}`, fontFamily: "Inter", fontSize: 25 }}>
          <span style={{ fontWeight: 600, color: L.ink, width: 230 }}>{a}</span><span style={{ color: L.dim, flex: 1 }}>{b}</span><span style={{ fontWeight: 600, color: L.ink }}>{c}</span>
        </div>
      ))}
      <Body size={19} style={{ marginTop: 12 }}>Specs shown only to illustrate how a raw requirement can be structured.</Body>
    </div>
  </LightPage>
);

// ── 07 Ration programs ──
const levers = [["People", "How many bags or households?"], ["Budget", "A target per bag or a total program budget."], ["Contents", "Staples, pack sizes and brands / specs."], ["Branding", "Plain, Zidane or organization-branded packing."], ["Delivery", "Locations, dates and distribution plan."]];
const Ration: React.FC = () => (
  <LightPage n={7} section="Ration programs">
    <Kick>Specialist service</Kick>
    <div style={{ marginTop: 26 }}><Head>Ration bags, <span style={{ color: L.red }}>built like a real supply program.</span></Head></div>
    <Body size={28} style={{ marginTop: 26 }}>Budget, headcount, item list, pack sizes, branding and delivery, structured into one clear requirement.</Body>
    <div style={{ marginTop: 30, display: "flex", gap: 14, flexWrap: "wrap" }}>
      {["Corporate", "Employees", "NGO / Welfare", "Ramadan", "Monthly"].map((c) => (
        <div key={c} style={{ background: L.red, color: "#fff", borderRadius: 40, padding: "10px 26px", fontFamily: "Inter", fontWeight: 600, fontSize: 24 }}>{c}</div>
      ))}
    </div>
    <div style={{ marginTop: 44, display: "flex", gap: 34 }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>
        {levers.map(([t, d], i) => (
          <div key={t} style={{ background: L.card, borderRadius: 16, padding: "22px 26px", display: "flex", gap: 22, alignItems: "baseline" }}>
            <div style={{ fontFamily: "Sora", fontWeight: 700, fontSize: 22, color: L.red }}>{String(i + 1).padStart(2, "0")}</div>
            <div>
              <div style={{ fontFamily: "Sora", fontWeight: 700, fontSize: 30, color: L.ink }}>{t}</div>
              <Body size={23}>{d}</Body>
            </div>
          </div>
        ))}
      </div>
      <Photo src="photo/real-rice.jpg" h={760} style={{ flex: "0 0 420px" }} />
    </div>
  </LightPage>
);

// ── 08 Why Zidane ──
const reasons: { icon: IconName; t: string; d: string }[] = [
  { icon: "list", t: "Messy lists welcome", d: "Excel, PDF, WhatsApp or a photo. We structure it before we quote." },
  { icon: "search", t: "Clear quotations", d: "Itemised brands, pack sizes and rates." },
  { icon: "check", t: "One supplier, many categories", d: "Staples to dairy through one point of contact." },
  { icon: "truck", t: "Scheduled & recurring delivery", d: "Planned around your locations and dates." },
  { icon: "office", t: "Institution-ready documentation", d: "Suited to institutional and donor reporting." },
  { icon: "ngo", t: "Programs, not just parcels", d: "Ration programs built on the same sourcing backbone." },
];
const Why: React.FC = () => (
  <LightPage n={8} section="Why Zidane">
    <Kick>Why work with us</Kick>
    <div style={{ marginTop: 26 }}><Head>The work behind <span style={{ color: L.red }}>the quotation.</span></Head></div>
    <div style={{ marginTop: 44, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
      {reasons.map((r) => (
        <div key={r.t} style={{ background: L.card, borderRadius: 18, padding: "26px 28px", minHeight: 230 }}>
          <LineIcon name={r.icon} size={58} color={L.red} />
          <div style={{ marginTop: 10, fontFamily: "Sora", fontWeight: 700, fontSize: 29, lineHeight: 1.15, color: L.ink }}>{r.t}</div>
          <Body size={23} style={{ marginTop: 8 }}>{r.d}</Body>
        </div>
      ))}
    </div>
    <div style={{ marginTop: 34, display: "flex", gap: 18 }}>
      {[["photo/warehouse.jpg", "Grocery sourcing", "center 30%"], ["photo/real-rice.jpg", "Packing", "center"], ["photo/truck.jpg", "Dispatch coordination", "30% center"]].map(([src, cap, pos]) => (
        <div key={cap} style={{ flex: 1 }}>
          <Photo src={src} h={250} pos={pos} />
          <div style={{ marginTop: 10, fontFamily: "Inter", fontWeight: 600, fontSize: 21, color: L.dim }}>{cap}</div>
        </div>
      ))}
    </div>
  </LightPage>
);

// ── 09 Back cover ──
const Back: React.FC = () => (
  <AbsoluteFill>
    <CorpBg />
    <div style={{ position: "absolute", top: 90, left: PAD }}><Img src={staticFile("brand/zidane-logo-white.svg")} style={{ width: 300 }} /></div>
    <div style={{ position: "absolute", top: 460, left: PAD, right: PAD }}>
      <Kick dark>Need pricing?</Kick>
      <div style={{ marginTop: 40 }}>
        <Head size={120} color={corp.text}>Send the grocery list.</Head>
        <Head size={120} color={corp.red}>We'll take it from there.</Head>
      </div>
    </div>
    <div style={{ position: "absolute", left: PAD, right: PAD, bottom: 140, display: "flex", flexDirection: "column", gap: 0 }}>
      {[["Email", "sales@zidane.com.pk"], ["Website", "www.zidane.com.pk"], ["Office", "B-55, Sector 31-D, PNT Society, Korangi, Karachi"]].map(([k, v]) => (
        <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "26px 0", borderTop: `2px solid ${corp.lineStrong}` }}>
          <span style={{ fontFamily: "Inter", fontWeight: 600, fontSize: 22, letterSpacing: "0.2em", textTransform: "uppercase", color: corp.dim }}>{k}</span>
          <span style={{ fontFamily: "Sora", fontWeight: 700, fontSize: 36, color: corp.text }}>{v}</span>
        </div>
      ))}
    </div>
    <div style={{ position: "absolute", bottom: 60, left: PAD, fontFamily: "Inter", fontWeight: 500, fontSize: 20, color: corp.dim }}>Zidane Corporation / Zidane Wholesale Solutions · Karachi, Pakistan</div>
  </AbsoluteFill>
);

export const profilePages = [Cover, About, Services, Range, Industries, Process, Ration, Why, Back];
export const ProfileCompositions: React.FC = () => (
  <>
    {profilePages.map((P, i) => (
      <Composition key={i} id={`Profile${String(i + 1).padStart(2, "0")}`} component={P} durationInFrames={90} fps={30} width={W} height={HGT} />
    ))}
  </>
);
