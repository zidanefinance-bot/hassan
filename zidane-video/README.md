# Zidane — social media reel

A 16s vertical reel (1080×1920, 30fps) for zidane.com.pk, built with Remotion using the
`video-motion-craft` skill rules (five-layer stack, springs, staggered entrances, fast exits, SFX).

- Latest render: `renders/zidane-reel.mp4`
- All on-screen wording: `src/brand.ts`. Edit it and re-render.
- Colours, fonts, easings: `src/theme.ts`

## Storyboard

| Shot | Time | What happens | SFX |
|---|---|---|---|
| Hook | 0–3s | "Paisa aata hai… par **rukta** kyun nahi?" words rise in, gold pill on "rukta" | whoosh, pop |
| Pillars | 3–7.5s | "Plan it with Zidane" + 3 service cards dealt in, faster each time | pop / tick / pop |
| Payoff | 7.5–11.5s | Bars rise, gold trend line draws, "Clear numbers. Confident decisions." | ticks, whoosh, pop |
| Outro | 11.5–16s | Z mark spins in, ZIDANE wordmark, CTA + URL, still hold | bass impact, tick |

Music bed and SFX are synthesized (`public/sfx`, from the skill's `gen-sfx.mjs`), so there are no licensing issues.

## Render

```bash
npm install
# In a sandbox without Chrome download access, point at a local headless shell:
export REMOTION_BROWSER=/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell
npm run render        # -> out/zidane-reel.mp4
npm run studio        # live preview/editor
```

## Notes

- The chart in the Payoff shot is an abstract growth shape, not real client data.
- The services copy is a placeholder based on a Finance + Business focus. Swap in the real
  offerings in `src/brand.ts` before posting.
- The `ai-video-generation` skill (inference.sh / Veo etc.) was not used. It needs the `infsh` CLI
  and a logged-in inference.sh account, which this environment doesn't have.
