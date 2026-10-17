// Static 4:5 posts (1080×1350). Each is a composition; render the last frame as a PNG.
import React from "react";
import { AbsoluteFill, Composition, Img, staticFile } from "remotion";
import { CorpBg, H, IconName, Kicker, LineIcon, Rule, corp } from "./kit";
import { ProductShot } from "./ProductReels";

const W = 1080;
const HGT = 1350;
export const POST_FRAMES = 90;
const P = (n: string) => `products/${n}.png`;

const Frame: React.FC<{ children: React.ReactNode; tag?: string }> = ({ children, tag }) => (
  <AbsoluteFill>
    <CorpBg />
    <div style={{ position: "absolute", top: 70, left: corp.pad, right: corp.pad, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <Img src={staticFile("brand/zidane-logo-white.svg")} style={{ width: 230 }} />
      {tag && <div style={{ fontFamily: corp.body, fontWeight: 600, fontSize: 24, letterSpacing: "0.2em", color: corp.dim, textTransform: "uppercase" }}>{tag}</div>}
    </div>
    {children}
    <div style={{ position: "absolute", bottom: 60, left: corp.pad, right: corp.pad }}>
      <Rule />
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 22, fontFamily: corp.body, fontWeight: 600, fontSize: 28, color: corp.dim }}>
        <span>sales@zidane.com.pk</span><span>zidane.com.pk</span>
      </div>
    </div>
  </AbsoluteFill>
);

const Body: React.FC<{ top?: number; children: React.ReactNode }> = ({ top = 230, children }) => (
  <div style={{ position: "absolute", top, left: corp.pad, right: corp.pad }}>{children}</div>
);

// ── 01 intro
const Intro: React.FC = () => (
  <Frame>
    <Body top={330}>
      <Kicker>B2B grocery supply · Karachi</Kicker>
      <div style={{ marginTop: 40 }}>
        <H size={96}>Groceries</H><H size={96}>for business.</H>
        <H size={96} color={corp.red}>Built for teams that</H><H size={96} color={corp.red}>buy in volume.</H>
      </div>
      <div style={{ marginTop: 50, fontFamily: corp.body, fontSize: 38, lineHeight: 1.45, color: corp.dim, maxWidth: 820 }}>
        Bulk staples and custom ration programs for factories, offices, hospitals, schools and NGOs.
      </div>
    </Body>
  </Frame>
);

// ── 02–07 category spotlights
type Cat = { slug: string; n: string; name: string; items: string[]; line: string };
export const postCats: Cat[] = [
  { slug: "oil-ghee", n: "01", name: "Oil & Ghee", items: ["mezan-oil", "dalda-oil", "nurpur-ghee"], line: "Dalda · Mezan · Soya Supreme · Nurpur · Olper's" },
  { slug: "atta", n: "02", name: "Atta & Flour", items: ["ashrafi-atta", "sunridge-atta", "bake-parlor-atta"], line: "Sunridge · Ashrafi · Bake Parlor" },
  { slug: "rice", n: "03", name: "Rice", items: ["falak-rice"], line: "Basmati and institutional grades, bulk packs" },
  { slug: "masala", n: "04", name: "Masala & Spices", items: ["national-biryani", "shan-biryani", "mehran-biryani"], line: "Shan · National · Mehran" },
  { slug: "tea", n: "05", name: "Tea", items: ["tapal", "lipton"], line: "Tapal · Lipton" },
  { slug: "milk", n: "06", name: "Milk & Dairy", items: ["haleeb", "olpers-milk"], line: "Olper's · Haleeb" },
];
const CatPost: React.FC<{ c: Cat }> = ({ c }) => {
  const layout = c.items.length === 3 ? [{ h: 400, x: -270 }, { h: 540, x: 0 }, { h: 400, x: 270 }] : c.items.length === 2 ? [{ h: 500, x: -170 }, { h: 500, x: 170 }] : [{ h: 580, x: 0 }];
  return (
    <Frame tag={`Category ${c.n} / 06`}>
      <Body top={210}>
        <Kicker>Available in bulk</Kicker>
        <div style={{ marginTop: 26 }}><H size={100}>{c.name}</H></div>
      </Body>
      <div style={{ position: "absolute", left: 0, right: 0, top: 470, height: 600 }}>
        {c.items.map((it, k) => (
          <div key={it} style={{ position: "absolute", left: 540 + layout[k].x, bottom: 0, transform: "translateX(-50%)", zIndex: layout[k].h }}>
            <ProductShot src={P(it)} height={layout[k].h} glow={k === Math.floor(c.items.length / 2)} />
          </div>
        ))}
      </div>
      <Body top={1120}>
        <div style={{ fontFamily: corp.body, fontWeight: 600, fontSize: 34, color: corp.text }}>{c.line}</div>
      </Body>
    </Frame>
  );
};

// ── 08 how it works
const steps: { icon: IconName; t: string; s: string }[] = [
  { icon: "list", t: "Share your list", s: "Excel, PDF, RFQ or WhatsApp" },
  { icon: "search", t: "We source", s: "Brands, packs, quantities quoted" },
  { icon: "check", t: "Packed to spec", s: "Against your approved list" },
  { icon: "truck", t: "Delivered", s: "One-time, weekly or monthly" },
];
const HowItWorks: React.FC = () => (
  <Frame tag="How it works">
    <Body top={230}>
      <H size={80}>From list to delivery,</H><H size={80} color={corp.red}>in four steps.</H>
      <div style={{ marginTop: 50, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        {steps.map((s, i) => (
          <div key={s.t} style={{ border: `2px solid ${corp.lineStrong}`, borderRadius: 28, padding: "28px 30px 30px", background: "rgba(255,255,255,0.02)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <LineIcon name={s.icon} size={84} color={corp.red} />
              <div style={{ fontFamily: corp.display, fontWeight: 800, fontSize: 56, color: corp.lineStrong }}>0{i + 1}</div>
            </div>
            <div style={{ marginTop: 18, fontFamily: corp.display, fontWeight: 700, fontSize: 42, color: corp.text, letterSpacing: "-0.02em" }}>{s.t}</div>
            <div style={{ marginTop: 10, fontFamily: corp.body, fontSize: 28, color: corp.dim }}>{s.s}</div>
          </div>
        ))}
      </div>
    </Body>
  </Frame>
);

// ── 09 industries
const inds: { icon: IconName; n: string }[] = [
  { icon: "factory", n: "Textile & Manufacturing" }, { icon: "office", n: "Corporate Offices" },
  { icon: "hospital", n: "Hospitals & Healthcare" }, { icon: "school", n: "Schools, Colleges & Hostels" },
  { icon: "ngo", n: "NGOs & Welfare" }, { icon: "horeca", n: "Restaurants / HoReCa" }, { icon: "site", n: "Project Sites & Camps" },
];
const Industries: React.FC = () => (
  <Frame tag="Who we supply">
    <Body top={220}>
      <H size={92}>One supplier.</H><H size={92} color={corp.red}>Seven industries.</H>
      <div style={{ marginTop: 50 }}>
        {inds.map((it) => (
          <div key={it.n}>
            <Rule />
            <div style={{ display: "flex", alignItems: "center", gap: 30, padding: "17px 0" }}>
              <LineIcon name={it.icon} size={60} color={corp.red} />
              <div style={{ fontFamily: corp.display, fontWeight: 600, fontSize: 40, color: corp.text }}>{it.n}</div>
            </div>
          </div>
        ))}
      </div>
    </Body>
  </Frame>
);

// ── 10 formats
const Formats: React.FC = () => (
  <Frame tag="Send it your way">
    <Body top={300}>
      <H size={92}>Your buying list</H><H size={92}>can be messy.</H><H size={92} color={corp.red}>Our quote won't be.</H>
      <div style={{ marginTop: 80, display: "flex", flexWrap: "wrap", gap: 20 }}>
        {["Excel / CSV", "PDF RFQ", "WhatsApp list", "Photo of a handwritten list"].map((f) => (
          <div key={f} style={{ border: `2px solid ${corp.lineStrong}`, borderRadius: 999, padding: "18px 36px", fontFamily: corp.body, fontWeight: 600, fontSize: 36, color: corp.text }}>{f}</div>
        ))}
      </div>
    </Body>
  </Frame>
);

// ── 11 quote
const Quote: React.FC = () => (
  <Frame>
    <Body top={360}>
      <div style={{ fontFamily: corp.display, fontWeight: 800, fontSize: 220, color: corp.red, lineHeight: 0.6, height: 120 }}>“</div>
      <H size={92}>Procurement</H><H size={92}>shouldn't slow</H><H size={92}>your operations</H><H size={92} color={corp.red}>down.</H>
      <div style={{ marginTop: 60 }}><Rule width={200} color={corp.red} /></div>
    </Body>
  </Frame>
);

// ── 12 chai math
const Chai: React.FC = () => (
  <Frame tag="Office pantry math">
    <Body top={230}>
      <H size={84}>A 100-person office drinks</H>
      <div style={{ fontFamily: corp.display, fontWeight: 800, fontSize: 210, color: corp.red, letterSpacing: "-0.05em", lineHeight: 1, marginTop: 10 }}>5,200</div>
      <H size={84}>cups of chai a month.</H>
      <div style={{ marginTop: 20, fontFamily: corp.body, fontSize: 30, color: corp.dim }}>100 people × 2 cups × 26 working days</div>
      <div style={{ marginTop: 60, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 24 }}>
        {[{ v: "≈13 kg", k: "Tea" }, { v: "≈520 L", k: "Milk" }, { v: "≈52 kg", k: "Sugar" }].map((x) => (
          <div key={x.k} style={{ borderTop: `4px solid ${corp.red}`, paddingTop: 22 }}>
            <div style={{ fontFamily: corp.display, fontWeight: 800, fontSize: 64, color: corp.text, letterSpacing: "-0.03em" }}>{x.v}</div>
            <div style={{ fontFamily: corp.body, fontSize: 32, color: corp.dim }}>{x.k}</div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 40, fontFamily: corp.body, fontSize: 24, color: corp.dim }}>Estimates for planning: ~2.5 g tea, 100 ml milk, 10 g sugar per cup.</div>
    </Body>
  </Frame>
);

// ── 13 month-end CTA
const MonthEnd: React.FC = () => (
  <Frame tag="Month-end">
    <Body top={330}>
      <Kicker>Planning November?</Kicker>
      <div style={{ marginTop: 36 }}>
        <H size={92}>Send next month's</H><H size={92}>grocery list by</H><H size={92} color={corp.red}>25 October.</H>
      </div>
      <div style={{ marginTop: 50, fontFamily: corp.body, fontSize: 38, lineHeight: 1.45, color: corp.dim, maxWidth: 840 }}>
        Get a structured quote and a delivery schedule before the month begins.
      </div>
    </Body>
  </Frame>
);

export const posts: { id: string; C: React.FC }[] = [
  { id: "Post01-Intro", C: Intro },
  ...postCats.map((c, i) => ({ id: `Post0${i + 2}-${c.slug}`, C: () => <CatPost c={c} /> })),
  { id: "Post08-HowItWorks", C: HowItWorks },
  { id: "Post09-Industries", C: Industries },
  { id: "Post10-Formats", C: Formats },
  { id: "Post11-Quote", C: Quote },
  { id: "Post12-ChaiMath", C: Chai },
  { id: "Post13-MonthEnd", C: MonthEnd },
];

export const PostCompositions: React.FC = () => (
  <>
    {posts.map((p) => (
      <Composition key={p.id} id={p.id} component={p.C} durationInFrames={POST_FRAMES} fps={30} width={W} height={HGT} />
    ))}
  </>
);
