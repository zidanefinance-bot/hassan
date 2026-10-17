# Zidane — "Ration Squad" cute reel

A 20s vertical reel (1080×1920, 30fps) for zidane.com.pk, built with Remotion. Real Zidane
studio product photos are cut out as die-cut stickers and given googly eyes, blush and a smile.
They pop in as a "ration squad", jump into the Zidane bag, and hand off to a price reveal and
a branded outro.

- Latest render: `renders/zidane-cute-reel.mp4` (social-ready: yuv420p, faststart)
- All on-screen wording, price and contact details: `src/brand.ts`. Edit it and re-render.
- Colours, fonts, springs: `src/theme.ts`

## Storyboard

| Shot | Time | What happens | SFX |
|---|---|---|---|
| Hook | 0–3.2s | "Psst… **Ramadan** 2027 aa raha hai!", moon swings, Zidane bag jumps up surprised | pop, whoosh |
| Squad | 3.2–8.8s | "Ration **squad** ready!", 6 items pop in with speech bubbles | pop × 6 |
| Jump in | 8.8–12.4s | "Sab ek **bag** mein!", items hop into the bag, bag squashes, +1s | tick × 6 |
| Price | 12.4–15.6s | Yellow starburst, PKR 0 → 2,149 counter, confetti | pop, bass |
| Outro | 15.6–20.2s | Red circle wipe, white logo, audience chips, CTA, WhatsApp, URL | whoosh, bass, pop |

Music bed is synthesized by `scripts/gen-cute-bed.py` (pure Python, 124 BPM pluck loop) and the
SFX are synthesized too, so there are no licensing issues.

## Render

```bash
npm install
python3 scripts/gen-cute-bed.py   # only if you change the music
# In a sandbox without Chrome download access, point at a local headless shell:
export REMOTION_BROWSER=/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell
npm run render        # -> out/zidane-cute-reel.mp4
npm run studio        # live preview/editor
```

## Assets

- `public/img/p/*.jpg` studio product photos and `public/brand/*.svg` logos come from the Zidane
  website (commit 12aca92). `public/cut/*.png` are background-removed versions of those photos.
- The PKR 2,149 price is the "Package 01" reference price shown on zidane.com.pk. Update
  `src/brand.ts` if it changes.

## "Zidane Mode": 60s hype reel

A 60s vertical reel cut to a synthesized dhol-trap track (128 BPM, 32 bars). Every cut and slam lands on the beat.

- Renders: `renders/hype/Zidane-Mode-60s.mp4` (HQ) and `renders/hype/Zidane-Mode-60s-whatsapp.mp4` (~20MB)
- Code: `src/hype/ZidaneMode.tsx` · Music: `python3 scripts/gen-hype-audio.py` → `public/sfx/hype-bed.wav`
- Render: `npx remotion render src/index.ts ZidaneMode renders/hype/Zidane-Mode-60s.mp4 --codec h264 --crf 18 --browser-executable=$REMOTION_BROWSER`

| Time | Scene |
|---|---|
| 0–3.75s | Hook: "1 bag… 10,000 bags? Koi masla nahi." |
| 3.75–11.25s | Drop 1: logo slam, then a grocery word per beat over real footage |
| 11.25–22.5s | Product storm: real catalog products fly out of a red vortex, 100+ counter |
| 22.5–30s | Build: "Aapki list kaisi bhi ho…" Excel, CSV, PDF, WhatsApp, handwritten. 3-2-1 |
| 30–41.25s | Drop 2: custom ration bags, footage grid, PKR 2,149 se shuru |
| 41.25–48.75s | Supply for: textile, factories, corporate, healthcare, schools, NGOs, restaurants, sites |
| 48.75–60s | Groceries for business. Logo, WhatsApp, UAN, website, CTA |

## Ramadan 2027 reel

A calm 50s vertical reel: night sky, crescent, swinging fanoos lanterns, mosque skyline, the real Zidane
Ramadan bag, then all four reference packages from zidane.com.pk/ration-packages with their item lists.

- Render: `renders/ramadan/Zidane-Ramadan-2027.mp4`
- Code: `src/ramadan/RamadanReel.tsx` (package contents and prices live in the `packages` array)
- Music: `python3 scripts/gen-ramadan-audio.py` → `public/sfx/ramadan-naat.wav`. This is a soft naat-style
  instrumental: a hummed melody in maqam Hijaz, daf, oud plucks, a drone and chimes, at 72 BPM (25 frames per beat). It needs scipy.
- Prices are labelled "2026 reference". The website says the 2027 rate is confirmed by quotation.

## "Aao, Rehmatein Baantein": animated Ramadan story with Urdu voiceover

A 45s 2D-animated story. Workers pack bags in the warehouse, ration day happens at a factory gate, Rashid chacha rides home,
the family opens the bag, a bag goes to the neighbour, then iftar and dua. It ends on the four packages. Everything is free and local.

- Render: `renders/ramadan/Zidane-Rehmat-Story.mp4` · Code: `src/ramadan/RehmatStory.tsx`
- Voiceover: Kokoro TTS (open source, CPU). There is no Urdu voice, so the Hindi voices speak the lines, written in Devanagari:
  `python3 scripts/make_ramadan_vo.py <kokoro_dir> [hm_omega|hm_psi|hf_alpha|hf_beta]`. The model files come from
  github.com/thewh1teagle/kokoro-onnx/releases (model-files-v1.0). Subtitles are in Roman Urdu.
- Music bed (no hum, sits under the VO): `python3 scripts/gen-ramadan-audio.py bed`

## "Crazy Zidane": fast pop-art animated reel with English voiceover

A 40s reel. Factory with 500 workers → supplier chaos (ringing phones, prices flipping) → "STOP. Meet Zidane." → a wall of 100+ products →
any list format goes into the Zidane machine → the quote prints and the truck zooms off → ration bags for team/NGO/Ramadan → end card.

- Render: `renders/crazy/Zidane-Crazy-Animated.mp4` · Code: `src/crazy/CrazyZidane.tsx` (word-by-word captions are timed from VO length)
- Voiceover: `python3 scripts/make_crazy_vo.py <kokoro_dir> [am_michael]` (Kokoro, local)
- Music: `python3 scripts/gen-crazy-audio.py`. It reads the VO durations, so re-run it after changing the voiceover.
