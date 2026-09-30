// Corporate product reels built on the dark kit + brand product cutouts (public/products).
import React from "react";
import { AbsoluteFill, Img, interpolate, Sequence, staticFile, useCurrentFrame } from "remotion";
import { Cue, Soundtrack } from "../components/Soundtrack";
import { CExit, CorpBg, CorpOutro, Count, H, Kicker, Reveal, Rule, corp, useIn } from "./kit";

const FPS = 30;
const sec = (s: number) => Math.round(s * FPS);
const MUSIC = "sfx/corp-bed.wav";
const P = (n: string) => `products/${n}.png`;

// Product on a spotlight with a floor shadow; rises in, then floats.
export const ProductShot: React.FC<{ src: string; height: number; delay?: number; glow?: boolean; phase?: number }> = ({
  src, height, delay = 0, glow = true, phase = 0,
}) => {
  const frame = useCurrentFrame();
  const p = useIn(delay, 24);
  const float = Math.sin((frame + phase) / 22) * 6;
  return (
    <div style={{ position: "relative", height, display: "flex", alignItems: "flex-end", justifyContent: "center", opacity: interpolate(p, [0, 0.3], [0, 1], corp.clamp) }}>
      {glow && (
        <div style={{ position: "absolute", width: height * 1.2, height: height * 1.2, left: "50%", top: "50%", transform: "translate(-50%, -50%)", borderRadius: "50%", background: "radial-gradient(circle, rgba(255,255,255,0.10), transparent 62%)" }} />
      )}
      <div style={{ position: "absolute", bottom: -14, width: height * 0.7, height: 34, borderRadius: "50%", background: "rgba(0,0,0,0.55)", filter: "blur(14px)" }} />
      <Img src={staticFile(src)} style={{
        maxHeight: height, maxWidth: height * 1.1, objectFit: "contain", position: "relative",
        transform: `translateY(${interpolate(p, [0, 1], [80, 0]) + float}px) scale(${interpolate(p, [0, 1], [0.92, 1])})`,
        filter: "drop-shadow(0 24px 30px rgba(0,0,0,0.45))",
      }} />
    </div>
  );
};

const Foot: React.FC<{ children: React.ReactNode; delay?: number }> = ({ children, delay = 0 }) => {
  const p = useIn(delay, 20);
  return <div style={{ fontFamily: corp.body, fontSize: 30, color: corp.dim, opacity: p * 0.9 }}>{children}</div>;
};

// ─────────────────────────── A. BRANDS SHOWCASE ───────────────────────────
const cats: { n: string; name: string; items: string[]; brands: string }[] = [
  { n: "01", name: "Oil & Ghee", items: ["mezan-oil", "dalda-oil", "nurpur-ghee"], brands: "Dalda · Mezan · Soya Supreme · Nurpur · Olper's" },
  { n: "02", name: "Atta & Flour", items: ["ashrafi-atta", "sunridge-atta", "bake-parlor-atta"], brands: "Sunridge · Ashrafi · Bake Parlor" },
  { n: "03", name: "Rice", items: ["falak-rice"], brands: "Basmati · Sella · Institutional grade" },
  { n: "04", name: "Masala & Spices", items: ["national-biryani", "shan-biryani", "mehran-biryani"], brands: "Shan · National · Mehran" },
  { n: "05", name: "Tea", items: ["tapal", "lipton"], brands: "Tapal · Lipton" },
  { n: "06", name: "Milk", items: ["haleeb", "olpers-milk"], brands: "Olper's · Haleeb" },
];
const B = { hook: sec(2.8), cat: sec(2.3), outro: sec(4.4) };
export const BRANDS_TOTAL = B.hook + B.cat * cats.length + B.outro;

const BrandsHook: React.FC = () => (
  <CExit length={B.hook}>
    <AbsoluteFill style={{ padding: `0 ${corp.pad}px`, justifyContent: "center" }}>
      <Kicker delay={2}>Brands we supply</Kicker>
      <div style={{ marginTop: 40 }}>
        <Reveal delay={6}><H size={112}>The brands your</H></Reveal>
        <Reveal delay={10}><H size={112}>kitchen trusts.</H></Reveal>
        <Reveal delay={16}><H size={112} color={corp.red}>In bulk.</H></Reveal>
      </div>
    </AbsoluteFill>
  </CExit>
);

const Cat: React.FC<{ i: number }> = ({ i }) => {
  const c = cats[i];
  const layout = c.items.length === 3 ? [{ h: 520, x: -300 }, { h: 700, x: 0 }, { h: 520, x: 300 }] : c.items.length === 2 ? [{ h: 640, x: -190 }, { h: 640, x: 190 }] : [{ h: 760, x: 0 }];
  return (
    <CExit length={B.cat}>
      <AbsoluteFill style={{ padding: `300px ${corp.pad}px 0` }}>
        <Kicker>{c.n} / 06</Kicker>
        <div style={{ marginTop: 30 }}><Reveal delay={3}><H size={110}>{c.name}</H></Reveal></div>
      </AbsoluteFill>
      <div style={{ position: "absolute", left: 0, right: 0, top: 640, height: 780 }}>
        {c.items.map((it, k) => {
          const L = layout[k];
          const order = c.items.length === 3 ? [1, 0, 2][k] : k;
          return (
            <div key={it} style={{ position: "absolute", left: 540 + L.x, bottom: 0, transform: "translateX(-50%)", zIndex: L.h }}>
              <ProductShot src={P(it)} height={L.h} delay={6 + order * 4} phase={k * 20} glow={k === Math.floor(c.items.length / 2)} />
            </div>
          );
        })}
      </div>
      <AbsoluteFill style={{ padding: `0 ${corp.pad}px`, top: 1500 }}>
        <Rule delay={10} />
        <Reveal delay={12}><div style={{ marginTop: 26, fontFamily: corp.body, fontWeight: 600, fontSize: 40, color: corp.text }}>{c.brands}</div></Reveal>
      </AbsoluteFill>
    </CExit>
  );
};

export const CorpBrands: React.FC = () => (
  <AbsoluteFill>
    <CorpBg />
    <Sequence durationInFrames={B.hook}><BrandsHook /></Sequence>
    {cats.map((_, i) => <Sequence key={i} from={B.hook + i * B.cat} durationInFrames={B.cat}><Cat i={i} /></Sequence>)}
    <Sequence from={B.hook + cats.length * B.cat} durationInFrames={B.outro}><CorpOutro line1="Your brands. Your pack sizes." line2="Quoted in one place." /></Sequence>
    <Soundtrack music={MUSIC} bed={0.5} cues={[
      ...cats.map((_, i) => ({ at: B.hook + i * B.cat, src: "whoosh" as const, volume: 0.2, note: `cat ${i + 1}` })),
      { at: B.hook + cats.length * B.cat + 4, src: "bass", volume: 0.5, note: "logo" },
    ]} />
  </AbsoluteFill>
);

// ─────────────────────────── shared: "quantity rows" scene ───────────────────────────
type QRow = { img: string; name: string; qty: number; unit: string; prefix?: string };
const QtyRows: React.FC<{ rows: QRow[]; start?: number; step?: number }> = ({ rows, start = 8, step = 12 }) => {
  const frame = useCurrentFrame();
  return (
    <div>
      {rows.map((r, i) => {
        const d = start + i * step;
        const p = interpolate(frame, [d, d + 18], [0, 1], { easing: corp.out, ...corp.clamp });
        return (
          <div key={r.name}>
            <Rule delay={d} />
            <div style={{ display: "flex", alignItems: "center", gap: 34, padding: "22px 0", opacity: p, transform: `translateX(${interpolate(p, [0, 1], [50, 0])}px)` }}>
              <div style={{ width: 150, height: 170, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {r.img ? (
                  <Img src={staticFile(r.img)} style={{ maxWidth: 150, maxHeight: 170, filter: "drop-shadow(0 10px 14px rgba(0,0,0,0.5))" }} />
                ) : (
                  <div style={{ width: 120, height: 120, borderRadius: 24, border: `2px solid ${corp.lineStrong}`, display: "grid", placeItems: "center", fontFamily: corp.display, fontWeight: 800, fontSize: 56, color: corp.text }}>{r.name[0]}</div>
                )}
              </div>
              <div style={{ flex: 1, fontFamily: corp.display, fontWeight: 600, fontSize: 48, color: corp.text, letterSpacing: "-0.02em" }}>{r.name}</div>
              <div style={{ textAlign: "right" }}>
                <span style={{ fontFamily: corp.display, fontWeight: 800, fontSize: 84, color: corp.red, letterSpacing: "-0.04em" }}>
                  {r.prefix ?? "≈"}<Count to={r.qty} delay={d + 4} dur={22} />
                </span>
                <span style={{ fontFamily: corp.body, fontWeight: 600, fontSize: 38, color: corp.dim, marginLeft: 10 }}>{r.unit}</span>
              </div>
            </div>
          </div>
        );
      })}
      <Rule delay={start + rows.length * step} />
    </div>
  );
};

// ─────────────────────────── B. BIRYANI DAY FOR 500 ───────────────────────────
const biryaniRows: QRow[] = [
  { img: P("falak-rice"), name: "Basmati rice", qty: 75, unit: "kg" },
  { img: P("dalda-oil"), name: "Cooking oil", qty: 20, unit: "L" },
  { img: P("shan-biryani"), name: "Biryani masala", qty: 50, unit: "packs" },
  { img: P("olpers-tarrka-ghee"), name: "Desi ghee", qty: 5, unit: "kg" },
];
const BY = { hook: sec(3), rows: sec(5.2), close: sec(2.6), outro: sec(4.4) };
export const BIRYANI_TOTAL = BY.hook + BY.rows + BY.close + BY.outro;

export const CorpBiryani: React.FC = () => (
  <AbsoluteFill>
    <CorpBg />
    <Sequence durationInFrames={BY.hook}>
      <CExit length={BY.hook}>
        <AbsoluteFill style={{ padding: `0 ${corp.pad}px`, justifyContent: "center" }}>
          <Kicker delay={2}>Factory canteen math</Kicker>
          <div style={{ marginTop: 40 }}>
            <Reveal delay={6}><H size={116}>Biryani day</H></Reveal>
            <Reveal delay={10}><H size={116}>for <span style={{ color: corp.red }}><Count to={500} delay={12} dur={26} /></span> workers?</H></Reveal>
          </div>
          <Reveal delay={22}><div style={{ marginTop: 40, fontFamily: corp.body, fontSize: 46, color: corp.dim }}>Here's roughly what goes in.</div></Reveal>
        </AbsoluteFill>
      </CExit>
    </Sequence>
    <Sequence from={BY.hook} durationInFrames={BY.rows}>
      <CExit length={BY.rows}>
        <AbsoluteFill style={{ padding: `380px ${corp.pad}px 0` }}>
          <Kicker>One day · 500 plates</Kicker>
          <div style={{ marginTop: 60 }}><QtyRows rows={biryaniRows} /></div>
          <div style={{ marginTop: 40 }}><Foot delay={60}>Approximate planning quantities. Final quote follows your menu.</Foot></div>
        </AbsoluteFill>
      </CExit>
    </Sequence>
    <Sequence from={BY.hook + BY.rows} durationInFrames={BY.close}>
      <CExit length={BY.close}>
        <AbsoluteFill style={{ padding: `0 ${corp.pad}px`, justifyContent: "center" }}>
          <Reveal delay={2}><H size={112}>One list.</H></Reveal>
          <Reveal delay={7}><H size={112}>One supplier.</H></Reveal>
          <Reveal delay={12}><H size={112} color={corp.red}>On schedule.</H></Reveal>
        </AbsoluteFill>
      </CExit>
    </Sequence>
    <Sequence from={BY.hook + BY.rows + BY.close} durationInFrames={BY.outro}><CorpOutro line1="Planning a canteen menu?" line2="Send us the headcount." /></Sequence>
    <Soundtrack music={MUSIC} bed={0.5} cues={[
      ...biryaniRows.map((_, i) => ({ at: BY.hook + 8 + i * 12, src: "tick" as const, volume: 0.3, note: `row ${i + 1}` })),
      { at: BY.hook + BY.rows, src: "whoosh", volume: 0.25, note: "close" },
      { at: BY.hook + BY.rows + BY.close + 4, src: "bass", volume: 0.5, note: "logo" },
    ]} />
  </AbsoluteFill>
);

// ─────────────────────────── C. CHAI MATH ───────────────────────────
const chaiRows: QRow[] = [
  { img: P("tapal"), name: "Tea leaves", qty: 13, unit: "kg" },
  { img: P("olpers-milk"), name: "Milk", qty: 520, unit: "L" },
  { img: "", name: "Sugar", qty: 52, unit: "kg" },
];
const CH = { hook: sec(3), math: sec(3.6), rows: sec(4.6), close: sec(2.4), outro: sec(4.4) };
export const CHAI_TOTAL = CH.hook + CH.math + CH.rows + CH.close + CH.outro;

const Term: React.FC<{ v: number; label: string; delay: number }> = ({ v, label, delay }) => {
  const p = useIn(delay, 18);
  return (
    <div style={{ opacity: p, transform: `translateY(${interpolate(p, [0, 1], [30, 0])}px)` }}>
      <div style={{ fontFamily: corp.display, fontWeight: 800, fontSize: 130, color: corp.text, letterSpacing: "-0.05em", lineHeight: 1 }}>{v}</div>
      <div style={{ fontFamily: corp.body, fontSize: 32, color: corp.dim, marginTop: 8 }}>{label}</div>
    </div>
  );
};
const Op: React.FC<{ c: string; delay: number }> = ({ c, delay }) => (
  <div style={{ fontFamily: corp.display, fontWeight: 300, fontSize: 90, color: corp.red, opacity: useIn(delay, 12), alignSelf: "flex-start", marginTop: 14 }}>{c}</div>
);

export const CorpChai: React.FC = () => (
  <AbsoluteFill>
    <CorpBg />
    <Sequence durationInFrames={CH.hook}>
      <CExit length={CH.hook}>
        <AbsoluteFill style={{ padding: `0 ${corp.pad}px`, justifyContent: "center" }}>
          <Kicker delay={2}>Office pantry math</Kicker>
          <div style={{ marginTop: 40 }}>
            <Reveal delay={6}><H size={108}>How much chai</H></Reveal>
            <Reveal delay={10}><H size={108}>do 100 people</H></Reveal>
            <Reveal delay={14}><H size={108} color={corp.red}>drink a month?</H></Reveal>
          </div>
        </AbsoluteFill>
      </CExit>
    </Sequence>
    <Sequence from={CH.hook} durationInFrames={CH.math}>
      <CExit length={CH.math}>
        <AbsoluteFill style={{ padding: `0 ${corp.pad}px`, justifyContent: "center" }}>
          <div style={{ display: "flex", gap: 34, alignItems: "flex-start" }}>
            <Term v={100} label="people" delay={2} /><Op c="×" delay={8} />
            <Term v={2} label="cups a day" delay={10} /><Op c="×" delay={16} />
            <Term v={26} label="working days" delay={18} />
          </div>
          <div style={{ marginTop: 70 }}><Rule delay={28} color={corp.red} /></div>
          <div style={{ marginTop: 50, fontFamily: corp.display, fontWeight: 800, fontSize: 180, color: corp.red, letterSpacing: "-0.05em", lineHeight: 1 }}>
            <Count to={5200} delay={32} dur={30} />
          </div>
          <Reveal delay={40}><div style={{ fontFamily: corp.body, fontSize: 48, color: corp.text, marginTop: 10 }}>cups every month</div></Reveal>
        </AbsoluteFill>
      </CExit>
    </Sequence>
    <Sequence from={CH.hook + CH.math} durationInFrames={CH.rows}>
      <CExit length={CH.rows}>
        <AbsoluteFill style={{ padding: `420px ${corp.pad}px 0` }}>
          <Kicker>That's roughly</Kicker>
          <div style={{ marginTop: 60 }}><QtyRows rows={chaiRows} /></div>
          <div style={{ marginTop: 40 }}><Foot delay={50}>Estimate: ~2.5 g tea, 100 ml milk, 10 g sugar per cup.</Foot></div>
        </AbsoluteFill>
      </CExit>
    </Sequence>
    <Sequence from={CH.hook + CH.math + CH.rows} durationInFrames={CH.close}>
      <CExit length={CH.close}>
        <AbsoluteFill style={{ padding: `0 ${corp.pad}px`, justifyContent: "center" }}>
          <Reveal delay={2}><H size={112}>Never run out.</H></Reveal>
          <Reveal delay={8}><H size={112} color={corp.red}>Delivered monthly.</H></Reveal>
        </AbsoluteFill>
      </CExit>
    </Sequence>
    <Sequence from={CH.hook + CH.math + CH.rows + CH.close} durationInFrames={CH.outro}><CorpOutro line1="Set up your pantry supply." line2="Tell us your headcount." /></Sequence>
    <Soundtrack music={MUSIC} bed={0.5} cues={[
      { at: CH.hook + 32, src: "whoosh", volume: 0.3, note: "total" },
      ...chaiRows.map((_, i) => ({ at: CH.hook + CH.math + 8 + i * 12, src: "tick" as const, volume: 0.3, note: `row ${i + 1}` })),
      { at: CH.hook + CH.math + CH.rows + CH.close + 4, src: "bass", volume: 0.5, note: "logo" },
    ]} />
  </AbsoluteFill>
);

// ─────────────────────────── D. FIVE QUESTIONS (type only) ───────────────────────────
const questions = [
  "Can you quote from my messy list?",
  "Which brands and pack sizes do you carry?",
  "Can you deliver on a fixed schedule?",
  "Will I get proper documentation?",
  "Who is my single point of contact?",
];
const Q = { hook: sec(3), q: sec(2.3), close: sec(2.4), outro: sec(4.4) };
export const QUESTIONS_TOTAL = Q.hook + Q.q * questions.length + Q.close + Q.outro;

const Question: React.FC<{ i: number }> = ({ i }) => {
  const frame = useCurrentFrame();
  return (
    <CExit length={Q.q}>
      <AbsoluteFill style={{ padding: `0 ${corp.pad}px`, justifyContent: "center" }}>
        <div style={{ display: "flex", gap: 14, marginBottom: 80 }}>
          {questions.map((_, k) => (
            <div key={k} style={{ flex: 1, height: 6, borderRadius: 3, background: k < i ? corp.red : corp.line, overflow: "hidden" }}>
              {k === i && <div style={{ height: "100%", background: corp.red, width: `${interpolate(frame, [0, Q.q - 6], [0, 100], corp.clamp)}%` }} />}
            </div>
          ))}
        </div>
        <div style={{ fontFamily: corp.display, fontWeight: 800, fontSize: 260, color: "transparent", WebkitTextStroke: `3px ${corp.red}`, letterSpacing: "-0.06em", lineHeight: 0.9, opacity: useIn(0, 16) }}>
          Q{i + 1}
        </div>
        <div style={{ marginTop: 60 }}>
          <Reveal delay={5}><H size={96}>{questions[i]}</H></Reveal>
        </div>
      </AbsoluteFill>
    </CExit>
  );
};

export const CorpQuestions: React.FC = () => (
  <AbsoluteFill>
    <CorpBg />
    <Sequence durationInFrames={Q.hook}>
      <CExit length={Q.hook}>
        <AbsoluteFill style={{ padding: `0 ${corp.pad}px`, justifyContent: "center" }}>
          <Kicker delay={2}>Procurement checklist</Kicker>
          <div style={{ marginTop: 40 }}>
            <Reveal delay={6}><H size={120}><span style={{ color: corp.red }}>5 questions</span></H></Reveal>
            <Reveal delay={10}><H size={92}>to ask before</H></Reveal>
            <Reveal delay={13}><H size={92}>choosing a</H></Reveal>
            <Reveal delay={16}><H size={92}>grocery supplier.</H></Reveal>
          </div>
        </AbsoluteFill>
      </CExit>
    </Sequence>
    {questions.map((_, i) => <Sequence key={i} from={Q.hook + i * Q.q} durationInFrames={Q.q}><Question i={i} /></Sequence>)}
    <Sequence from={Q.hook + questions.length * Q.q} durationInFrames={Q.close}>
      <CExit length={Q.close}>
        <AbsoluteFill style={{ padding: `0 ${corp.pad}px`, justifyContent: "center" }}>
          <Reveal delay={2}><H size={110}>Ask us all five.</H></Reveal>
          <Reveal delay={8}><H size={110} color={corp.red}>We'll answer in writing.</H></Reveal>
        </AbsoluteFill>
      </CExit>
    </Sequence>
    <Sequence from={Q.hook + questions.length * Q.q + Q.close} durationInFrames={Q.outro}><CorpOutro line1="Evaluating suppliers?" line2="Start with a quote." /></Sequence>
    <Soundtrack music={MUSIC} bed={0.5} cues={[
      ...questions.map((_, i) => ({ at: Q.hook + i * Q.q, src: "tick" as const, volume: 0.35, note: `q${i + 1}` })),
      { at: Q.hook + questions.length * Q.q + Q.close + 4, src: "bass", volume: 0.5, note: "logo" },
    ]} />
  </AbsoluteFill>
);

// ─────────────────────────── E. LIST → QUOTE ───────────────────────────
const lines = [
  { raw: "dalda 5L — 40", img: P("dalda-oil"), item: "Dalda Cooking Oil", pack: "5 L", qty: "× 40" },
  { raw: "sunridge atta 5kg x100", img: P("sunridge-atta"), item: "Sunridge Chakki Atta", pack: "5 kg", qty: "× 100" },
  { raw: "shan biryani 50 dabbe", img: P("shan-biryani"), item: "Shan Biryani Masala", pack: "50 g", qty: "× 50" },
  { raw: "lipton 430g - 30??", img: P("lipton"), item: "Lipton Yellow Label", pack: "430 g", qty: "× 30" },
  { raw: "haleeb 1L 2 carton", img: P("haleeb"), item: "Haleeb Milk", pack: "1 L", qty: "× 24" },
];
const LQ = { raw: sec(3.4), quote: sec(5.4), outro: sec(4.4) };
export const LISTQUOTE_TOTAL = LQ.raw + LQ.quote + LQ.outro;

const RawList: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <CExit length={LQ.raw}>
      <AbsoluteFill style={{ padding: `300px ${corp.pad}px 0` }}>
        <Kicker>What we receive</Kicker>
        <div style={{ marginTop: 30 }}><Reveal delay={3}><H size={100}>Your list,</H></Reveal><Reveal delay={7}><H size={100} color={corp.dim}>as it comes.</H></Reveal></div>
        <div style={{ marginTop: 70, background: "#F3EEE3", borderRadius: 10, padding: "50px 56px", transform: "rotate(-2deg)", boxShadow: "0 30px 60px rgba(0,0,0,0.5)", opacity: useIn(10, 16) }}>
          {lines.map((l, i) => {
            const p = interpolate(frame, [16 + i * 6, 26 + i * 6], [0, 1], corp.clamp);
            return (
              <div key={i} style={{ fontFamily: "'Comic Sans MS', 'Segoe Print', cursive", fontSize: 50, color: "#243a8c", lineHeight: 1.6, clipPath: `inset(0 ${(1 - p) * 100}% 0 0)`, transform: `rotate(${(i % 2 ? 1 : -1) * 0.8}deg)` }}>
                {l.raw}
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    </CExit>
  );
};

const QuoteTable: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <CExit length={LQ.quote}>
      <AbsoluteFill style={{ padding: `300px ${corp.pad}px 0` }}>
        <Kicker>What you get back</Kicker>
        <div style={{ marginTop: 30 }}><Reveal delay={3}><H size={100}>Structured,</H></Reveal><Reveal delay={7}><H size={100} color={corp.red}>as it should be.</H></Reveal></div>
        <div style={{ marginTop: 60 }}>
          <div style={{ display: "flex", fontFamily: corp.body, fontWeight: 600, fontSize: 26, letterSpacing: "0.16em", color: corp.dim, textTransform: "uppercase", paddingBottom: 18, opacity: useIn(10, 14) }}>
            <span style={{ width: 130 }} /><span style={{ flex: 1 }}>Item</span><span style={{ width: 150 }}>Pack</span><span style={{ width: 120, textAlign: "right" }}>Qty</span>
          </div>
          {lines.map((l, i) => {
            const d = 14 + i * 9;
            const p = interpolate(frame, [d, d + 16], [0, 1], { easing: corp.out, ...corp.clamp });
            return (
              <div key={i}>
                <Rule delay={d} />
                <div style={{ display: "flex", alignItems: "center", padding: "16px 0", opacity: p, transform: `translateY(${interpolate(p, [0, 1], [20, 0])}px)` }}>
                  <div style={{ width: 130, height: 110, display: "flex", justifyContent: "center" }}>
                    <Img src={staticFile(l.img)} style={{ maxHeight: 110, maxWidth: 110, filter: "drop-shadow(0 8px 10px rgba(0,0,0,0.5))" }} />
                  </div>
                  <div style={{ flex: 1, fontFamily: corp.display, fontWeight: 600, fontSize: 40, color: corp.text, letterSpacing: "-0.02em" }}>{l.item}</div>
                  <div style={{ width: 150, fontFamily: corp.body, fontSize: 36, color: corp.dim }}>{l.pack}</div>
                  <div style={{ width: 120, textAlign: "right", fontFamily: corp.display, fontWeight: 800, fontSize: 42, color: corp.red }}>{l.qty}</div>
                </div>
              </div>
            );
          })}
          <Rule delay={14 + lines.length * 9} />
          <div style={{ marginTop: 30 }}><Foot delay={70}>Sample list for illustration. Brands and pack sizes as per your approval.</Foot></div>
        </div>
      </AbsoluteFill>
    </CExit>
  );
};

export const CorpListQuote: React.FC = () => (
  <AbsoluteFill>
    <CorpBg />
    <Sequence durationInFrames={LQ.raw}><RawList /></Sequence>
    <Sequence from={LQ.raw} durationInFrames={LQ.quote}><QuoteTable /></Sequence>
    <Sequence from={LQ.raw + LQ.quote} durationInFrames={LQ.outro}><CorpOutro line1="Send it however you have it." line2="We'll structure the quote." /></Sequence>
    <Soundtrack music={MUSIC} bed={0.5} cues={[
      ...lines.map((_, i) => ({ at: 16 + i * 6, src: "tick" as const, volume: 0.2, note: `scribble ${i + 1}` })),
      { at: LQ.raw, src: "whoosh", volume: 0.3, note: "to table" },
      ...lines.map((_, i) => ({ at: LQ.raw + 14 + i * 9, src: "tick" as const, volume: 0.3, note: `row ${i + 1}` })),
      { at: LQ.raw + LQ.quote + 4, src: "bass", volume: 0.5, note: "logo" },
    ]} />
  </AbsoluteFill>
);
