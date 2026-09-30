// Three corporate reels: Process, Industries, Categories. Copy mirrors zidane.com.pk.
import React from "react";
import { AbsoluteFill, interpolate, Sequence, useCurrentFrame } from "remotion";
import { Cue, Soundtrack } from "../components/Soundtrack";
import { CExit, CorpBg, CorpOutro, Count, H, IconName, Kicker, LineIcon, PhotoPanel, Reveal, Rule, corp, useIn } from "./kit";

const FPS = 30;
const sec = (s: number) => Math.round(s * FPS);
const MUSIC = "sfx/corp-bed.wav";
const Page: React.FC<{ children: React.ReactNode; top?: number }> = ({ children, top = 260 }) => (
  <AbsoluteFill style={{ padding: `${top}px ${corp.pad}px 0` }}>{children}</AbsoluteFill>
);

// ─────────────────────────── 1. PROCESS ───────────────────────────
const steps: { n: string; icon: IconName; title: string; sub: string }[] = [
  { n: "01", icon: "list", title: "Share your requirement", sub: "Excel, PDF, RFQ or a WhatsApp list." },
  { n: "02", icon: "search", title: "We structure & source", sub: "Pack sizes, brands and quantities, quoted clearly." },
  { n: "03", icon: "check", title: "Packed to spec", sub: "Checked against your approved item list." },
  { n: "04", icon: "truck", title: "Delivered on schedule", sub: "One-time, weekly or monthly." },
];
const P = { hook: sec(3.4), step: sec(2), stats: sec(3), outro: sec(4.4) };
const pStepsFrom = P.hook;
const pStatsFrom = pStepsFrom + P.step * steps.length;
const pOutroFrom = pStatsFrom + P.stats;
export const PROCESS_TOTAL = pOutroFrom + P.outro;

const ProcessHook: React.FC = () => (
  <CExit length={P.hook}>
    <PhotoPanel src="photo/warehouse.jpg" height={980} focus="50% 30%" />
    <AbsoluteFill style={{ padding: `0 ${corp.pad}px`, top: 900 }}>
      <Kicker delay={8}>Zidane Wholesale Solutions</Kicker>
      <div style={{ marginTop: 36 }}>
        <Reveal delay={12}><H>Procurement,</H></Reveal>
        <Reveal delay={18}><H color={corp.red}>without the chaos.</H></Reveal>
      </div>
    </AbsoluteFill>
  </CExit>
);

const ProcessStep: React.FC<{ i: number }> = ({ i }) => {
  const frame = useCurrentFrame();
  const s = steps[i];
  return (
    <CExit length={P.step}>
      <Page top={380}>
        <Kicker delay={0}>How it works · {s.n} / 04</Kicker>
        {/* progress rail */}
        <div style={{ display: "flex", gap: 14, marginTop: 50 }}>
          {steps.map((_, k) => (
            <div key={k} style={{ flex: 1, height: 6, background: corp.line, borderRadius: 3, overflow: "hidden" }}>
              <div style={{ height: "100%", background: corp.red, width: k < i ? "100%" : k === i ? `${interpolate(frame, [0, P.step - 6], [0, 100], corp.clamp)}%` : "0%" }} />
            </div>
          ))}
        </div>
        <div style={{ marginTop: 130, fontFamily: corp.display, fontWeight: 800, fontSize: 330, lineHeight: 0.9, letterSpacing: "-0.06em", color: "transparent", WebkitTextStroke: `3px ${corp.lineStrong}`, opacity: useIn(0, 20) }}>
          {s.n}
        </div>
        <div style={{ marginTop: 40 }}><LineIcon name={s.icon} size={130} delay={4} color={corp.red} /></div>
        <div style={{ marginTop: 40 }}>
          <Reveal delay={6}><H size={96}>{s.title}</H></Reveal>
        </div>
        <div style={{ marginTop: 34 }}><Rule delay={10} width={180} color={corp.red} /></div>
        <Reveal delay={12}><div style={{ marginTop: 34, fontFamily: corp.body, fontSize: 48, lineHeight: 1.35, color: corp.dim }}>{s.sub}</div></Reveal>
      </Page>
    </CExit>
  );
};

const stats = [
  { n: 8, label: "Grocery categories" },
  { n: 7, label: "Industries served" },
  { n: 1, label: "Point of contact" },
];
const ProcessStats: React.FC = () => (
  <CExit length={P.stats}>
    <Page top={380}>
      <Reveal><H size={88}>One supplier.</H></Reveal>
      <Reveal delay={5}><H size={88} color={corp.dim}>Every staple.</H></Reveal>
      <div style={{ marginTop: 120 }}>
        {stats.map((s, i) => (
          <div key={s.label}>
            <Rule delay={10 + i * 5} />
            <div style={{ display: "flex", alignItems: "baseline", gap: 50, padding: "34px 0" }}>
              <div style={{ fontFamily: corp.display, fontWeight: 800, fontSize: 150, color: corp.red, width: 170, letterSpacing: "-0.05em" }}>
                <Count to={s.n} delay={12 + i * 5} dur={20} />
              </div>
              <Reveal delay={12 + i * 5}><div style={{ fontFamily: corp.body, fontSize: 52, fontWeight: 500, color: corp.text }}>{s.label}</div></Reveal>
            </div>
          </div>
        ))}
        <Rule delay={25} />
      </div>
    </Page>
  </CExit>
);

const processCues: Cue[] = [
  { at: 10, src: "whoosh", volume: 0.25, note: "photo wipe" },
  ...steps.map((_, i) => ({ at: pStepsFrom + i * P.step, src: "tick" as const, volume: 0.35, note: `step ${i + 1}` })),
  { at: pStatsFrom, src: "whoosh", volume: 0.25, note: "stats" },
  { at: pOutroFrom + 4, src: "bass", volume: 0.5, note: "logo" },
];

export const CorpProcess: React.FC = () => (
  <AbsoluteFill>
    <CorpBg />
    <Sequence durationInFrames={P.hook}><ProcessHook /></Sequence>
    {steps.map((_, i) => (
      <Sequence key={i} from={pStepsFrom + i * P.step} durationInFrames={P.step}><ProcessStep i={i} /></Sequence>
    ))}
    <Sequence from={pStatsFrom} durationInFrames={P.stats}><ProcessStats /></Sequence>
    <Sequence from={pOutroFrom} durationInFrames={P.outro}><CorpOutro line1="Send the requirement." line2="We'll take it from there." /></Sequence>
    <Soundtrack cues={processCues} bed={0.5} music={MUSIC} />
  </AbsoluteFill>
);

// ─────────────────────────── 2. INDUSTRIES ───────────────────────────
const industries: { icon: IconName; name: string; need: string }[] = [
  { icon: "factory", name: "Textile & Manufacturing", need: "Worker canteens & ration programs" },
  { icon: "office", name: "Corporate Offices", need: "Pantry supply & employee rations" },
  { icon: "hospital", name: "Hospitals & Healthcare", need: "Patient and staff kitchens" },
  { icon: "school", name: "Schools, Colleges & Hostels", need: "Mess and hostel supply" },
  { icon: "ngo", name: "NGOs & Welfare", need: "Distribution-ready ration kits" },
  { icon: "horeca", name: "Restaurants / HoReCa", need: "Daily bulk staples" },
  { icon: "site", name: "Project Sites & Camps", need: "Remote-site supply" },
];
const I = { hook: sec(3.2), list: sec(5.6), close: sec(2.8), outro: sec(4.4) };
const iListFrom = I.hook;
const iCloseFrom = iListFrom + I.list;
const iOutroFrom = iCloseFrom + I.close;
export const INDUSTRIES_TOTAL = iOutroFrom + I.outro;
const ROW_STEP = 7;

const IndustriesHook: React.FC = () => (
  <CExit length={I.hook}>
    <AbsoluteFill style={{ padding: `300px ${corp.pad}px 0` }}>
      <Kicker delay={4}>Who we supply</Kicker>
      <div style={{ marginTop: 40 }}>
        <Reveal delay={8}><H size={118}>One supplier.</H></Reveal>
        <Reveal delay={14}><H size={118} color={corp.red}>Seven industries.</H></Reveal>
      </div>
    </AbsoluteFill>
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 0 }}>
      <PhotoPanel src="photo/truck.jpg" height={1000} delay={16} focus="40% 50%" />
    </div>
  </CExit>
);

const IndustriesList: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <CExit length={I.list}>
      <Page top={330}>
        <Kicker>Industries · 07</Kicker>
        <div style={{ marginTop: 60 }}>
          {industries.map((it, i) => {
            const d = 6 + i * ROW_STEP;
            const p = interpolate(frame, [d, d + 18], [0, 1], { easing: corp.out, ...corp.clamp });
            const entering = frame < 6 + industries.length * ROW_STEP + 8;
            const active = entering
              ? i === Math.floor((frame - 6) / ROW_STEP)
              : i === Math.floor((frame - (6 + industries.length * ROW_STEP + 8)) / 14) % industries.length;
            return (
              <div key={it.name} style={{ opacity: p * (active ? 1 : entering ? 1 : 0.55), transform: `translateX(${interpolate(p, [0, 1], [60, 0]) + (active && !entering ? 14 : 0)}px)` }}>
                <Rule delay={d} />
                <div style={{ display: "flex", alignItems: "center", gap: 36, padding: "26px 0" }}>
                  <LineIcon name={it.icon} size={84} delay={d + 2} color={active ? corp.red : corp.text} />
                  <div>
                    <div style={{ fontFamily: corp.display, fontWeight: 700, fontSize: 50, color: corp.text, letterSpacing: "-0.02em" }}>{it.name}</div>
                    <div style={{ fontFamily: corp.body, fontSize: 34, color: corp.dim, marginTop: 6 }}>{it.need}</div>
                  </div>
                </div>
              </div>
            );
          })}
          <Rule delay={6 + industries.length * ROW_STEP} />
        </div>
      </Page>
    </CExit>
  );
};

const IndustriesClose: React.FC = () => (
  <CExit length={I.close}>
    <Page top={700}>
      <Reveal><H size={100}>Different requirements.</H></Reveal>
      <Reveal delay={8}><H size={100} color={corp.red}>One sourcing backbone.</H></Reveal>
      <div style={{ marginTop: 60 }}><Rule delay={14} width={220} color={corp.red} /></div>
    </Page>
  </CExit>
);

const industriesCues: Cue[] = [
  { at: 16, src: "whoosh", volume: 0.25, note: "truck wipe" },
  ...industries.map((_, i) => ({ at: iListFrom + 6 + i * ROW_STEP, src: "tick" as const, volume: 0.25, note: `row ${i + 1}` })),
  { at: iCloseFrom, src: "whoosh", volume: 0.25, note: "close" },
  { at: iOutroFrom + 4, src: "bass", volume: 0.5, note: "logo" },
];

export const CorpIndustries: React.FC = () => (
  <AbsoluteFill>
    <CorpBg />
    <Sequence durationInFrames={I.hook}><IndustriesHook /></Sequence>
    <Sequence from={iListFrom} durationInFrames={I.list}><IndustriesList /></Sequence>
    <Sequence from={iCloseFrom} durationInFrames={I.close}><IndustriesClose /></Sequence>
    <Sequence from={iOutroFrom} durationInFrames={I.outro}><CorpOutro line1="Tell us your industry." line2="We'll build the supply plan." /></Sequence>
    <Soundtrack cues={industriesCues} bed={0.5} music={MUSIC} />
  </AbsoluteFill>
);

// ─────────────────────────── 3. CATEGORIES ───────────────────────────
const categories = ["Sugar", "Flour · Atta · Maida", "Rice", "Pulses · Daal", "Cooking Oil & Ghee", "Spices", "Tea & Coffee", "Milk & Dairy"];
const C = { hook: sec(2.8), list: sec(6), send: sec(3.4), outro: sec(4.4) };
const cListFrom = C.hook;
const cSendFrom = cListFrom + C.list;
const cOutroFrom = cSendFrom + C.send;
export const CATEGORIES_TOTAL = cOutroFrom + C.outro;
const CAT_STEP = 20; // frames each category is "current"
const ROW_H = 150;

const CategoriesHook: React.FC = () => (
  <CExit length={C.hook}>
    <Page top={700}>
      <Kicker delay={2}>The grocery desk</Kicker>
      <div style={{ marginTop: 40 }}>
        <Reveal delay={6}><H size={104}>Everything your</H></Reveal>
        <Reveal delay={10}><H size={104}>organization buys</H></Reveal>
        <Reveal delay={14}><H size={104} color={corp.red}>in volume.</H></Reveal>
      </div>
    </Page>
  </CExit>
);

// Teleprompter-style list: rows scroll up, the current one is bright with a red index.
const CategoriesList: React.FC = () => {
  const frame = useCurrentFrame();
  const pos = interpolate(frame, categories.map((_, i) => 6 + i * CAT_STEP), categories.map((_, i) => i), { easing: corp.inOut, ...corp.clamp });
  const enter = useIn(0, 20);
  return (
    <CExit length={C.list}>
      <AbsoluteFill style={{ padding: `0 ${corp.pad}px` }}>
        <div style={{ position: "absolute", top: 220, left: corp.pad }}><Kicker>Categories · 08</Kicker></div>
        <div style={{ position: "absolute", left: corp.pad, right: corp.pad, top: 960 - ROW_H / 2, height: ROW_H, borderTop: `2px solid ${corp.lineStrong}`, borderBottom: `2px solid ${corp.lineStrong}`, opacity: enter }} />
        {categories.map((c, i) => {
          const dist = i - pos;
          const y = 960 + dist * ROW_H - ROW_H / 2;
          const near = Math.max(0, 1 - Math.abs(dist) / 3.2);
          const cur = Math.max(0, 1 - Math.abs(dist) * 1.6);
          return (
            <div key={c} style={{
              position: "absolute", left: corp.pad, right: corp.pad, top: y, height: ROW_H, display: "flex", alignItems: "center", gap: 40,
              opacity: near * enter,
            }}>
              <div style={{ fontFamily: corp.body, fontWeight: 600, fontSize: 36, color: cur > 0.5 ? corp.red : corp.dim, width: 70 }}>{String(i + 1).padStart(2, "0")}</div>
              <div style={{
                fontFamily: corp.display, fontWeight: 700, letterSpacing: "-0.03em", whiteSpace: "nowrap",
                fontSize: interpolate(cur, [0, 1], [58, 86]), color: cur > 0.5 ? corp.text : corp.dim,
              }}>{c}</div>
            </div>
          );
        })}
      </AbsoluteFill>
    </CExit>
  );
};

const formats = ["Excel / CSV", "PDF RFQ", "WhatsApp list", "Handwritten photo"];
const CategoriesSend: React.FC = () => (
  <CExit length={C.send}>
    <PhotoPanel src="photo/real-rice.jpg" height={820} focus="50% 40%" />
    <AbsoluteFill style={{ padding: `0 ${corp.pad}px`, top: 760 }}>
      <Reveal delay={6}><H size={100}>Send the list.</H></Reveal>
      <Reveal delay={11}><H size={100} color={corp.red}>We structure the quote.</H></Reveal>
      <div style={{ marginTop: 70, display: "flex", flexWrap: "wrap", gap: 20 }}>
        {formats.map((f, i) => {
          const p = useIn(18 + i * 4, 16);
          return (
            <div key={f} style={{ opacity: p, transform: `translateY(${interpolate(p, [0, 1], [20, 0])}px)`, border: `2px solid ${corp.lineStrong}`, borderRadius: 999, padding: "16px 34px", fontFamily: corp.body, fontWeight: 600, fontSize: 36, color: corp.text }}>
              {f}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  </CExit>
);

const categoriesCues: Cue[] = [
  ...categories.map((_, i) => ({ at: cListFrom + 6 + i * CAT_STEP, src: "tick" as const, volume: 0.25, note: `category ${i + 1}` })),
  { at: cSendFrom, src: "whoosh", volume: 0.25, note: "rice wipe" },
  { at: cOutroFrom + 4, src: "bass", volume: 0.5, note: "logo" },
];

export const CorpCategories: React.FC = () => (
  <AbsoluteFill>
    <CorpBg />
    <Sequence durationInFrames={C.hook}><CategoriesHook /></Sequence>
    <Sequence from={cListFrom} durationInFrames={C.list}><CategoriesList /></Sequence>
    <Sequence from={cSendFrom} durationInFrames={C.send}><CategoriesSend /></Sequence>
    <Sequence from={cOutroFrom} durationInFrames={C.outro}><CorpOutro line1="Need pricing?" line2="Send the grocery list." /></Sequence>
    <Soundtrack cues={categoriesCues} bed={0.5} music={MUSIC} />
  </AbsoluteFill>
);
