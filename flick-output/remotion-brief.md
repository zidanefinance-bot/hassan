# Remotion Composition Brief: Flick

## Objective
Create approved short-form scene animations for ration packing social media video, optimized for vertical sharing (Instagram Reels/TikTok).

## Output
- Remotion project: `/home/user/hassan/flick-output/remotion/`
- Format: 9:16 vertical — 1080x1920 at 30 fps
- Rendered scenes: Individual MP4 files for each approved scene

## Source Material
- Transcript: `transcript.json`
- Approved plan: `flick-plan.md`
- Audio: Voiceover track from original video
- Sound effects: `remotion/public/sounds/` bundled collection

## Creative Direction
**Goal:** Professional, engaging social media content for ration packing business
**Visual Style:** Modern, clean, trustworthy
**Tone:** Professional with subtle energy
**Avoid:** Cluttered layouts, too many animations, dark themes

## Scene Compositions

### Scene 1: Opening Hook
- Composition ID: `opening-hook`
- Component: `OpeningHook`
- Transcript: "Ration packing - quality assured" (0-6s)
- Time: 0–6 seconds (0–180 frames)
- Output: `scenes/opening-hook/opening-hook.mp4`
- Visual: Logo animation with text reveal, professional intro
- Text on screen: "Ration packing - quality assured"
- Assets: Company logo/brand colors
- Animation sequence: 
  1. Background fades in (0-1s)
  2. Logo scales up and bounces (1-3s)
  3. Text slides in from bottom (3-5s)
  4. Hold and fade (5-6s)
- Sound effect: Smooth transition chime
- Transition: Fade in from black

### Scene 2: Professional Process
- Composition ID: `professional-process`
- Component: `ProfessionalProcess`
- Transcript: "Professional packing process" (6-13s)
- Time: 6–13 seconds (180–390 frames)
- Output: `scenes/professional-process/professional-process.mp4`
- Visual: Process flow animation showing packing steps
- Text on screen: "Professional packing process"
- Assets: Process icons/graphics
- Animation sequence:
  1. Title appears (6-7s)
  2. Step 1 icon appears with arrow (7-9s)
  3. Step 2 icon appears with arrow (9-11s)
  4. Step 3 icon appears with arrow (11-13s)
- Sound effect: Subtle mechanical/action sounds
- Transition: Slide from left

### Scene 3: Fresh Ingredients
- Composition ID: `fresh-ingredients`
- Component: `FreshIngredients`
- Transcript: "Fresh ingredients carefully selected" (13-20s)
- Time: 13–20 seconds (390–600 frames)
- Output: `scenes/fresh-ingredients/fresh-ingredients.mp4`
- Visual: Product/ingredient showcase with icons
- Text on screen: "Fresh ingredients carefully selected"
- Assets: Ingredient icons/product images
- Animation sequence:
  1. Title appears (13-14s)
  2. Item 1 bounces in (14-16s)
  3. Item 2 bounces in (16-18s)
  4. Item 3 bounces in (18-20s)
- Sound effect: Light, clean selection sounds
- Transition: Zoom transition

### Scene 4: Seal of Trust
- Composition ID: `seal-of-trust`
- Component: `SealOfTrust`
- Transcript: "Sealed with care for your family" (20-28s)
- Time: 20–28 seconds (600–840 frames)
- Output: `scenes/seal-of-trust/seal-of-trust.mp4`
- Visual: Package closing animation with quality seal
- Text on screen: "Sealed with care for your family"
- Assets: Package icon, seal/badge graphics
- Animation sequence:
  1. Package appears (20-21s)
  2. Package closes (21-24s)
  3. Quality seal badge appears (24-26s)
  4. Hold for emphasis (26-28s)
- Sound effect: Satisfying seal/closure sound
- Transition: Zoom in on package

### Scene 5: Trust & Ready
- Composition ID: `trust-ready`
- Component: `TrustReady`
- Transcript: "Ready to deliver quality and trust" (28-35s)
- Time: 28–35 seconds (840–1050 frames)
- Output: `scenes/trust-ready/trust-ready.mp4`
- Visual: Delivery/trust emphasis with checkmarks
- Text on screen: "Ready to deliver quality and trust"
- Assets: Delivery icon, checkmark animations
- Animation sequence:
  1. Title appears (28-29s)
  2. Delivery truck icon (29-31s)
  3. Checkmarks appear in sequence (31-35s)
- Sound effect: Confirmation/success sound
- Transition: Bounce in from corners

### Scene 6: Call to Action
- Composition ID: `call-to-action`
- Component: `CallToAction`
- Transcript: "Order your ration pack today" (35-41s)
- Time: 35–41 seconds (1050–1230 frames)
- Output: `scenes/call-to-action/call-to-action.mp4`
- Visual: CTA button with text emphasis
- Text on screen: "Order your ration pack today"
- Assets: Button graphics, contact info placeholder
- Animation sequence:
  1. Text appears (35-37s)
  2. Button grows and pulses (37-39s)
  3. Pulse repeats for emphasis (39-41s)
- Sound effect: Upbeat success chime
- Transition: Bounce and hold

## Remotion Instructions
- Build one React component for each scene under `src/scenes/`
- Register each scene as a Composition in `src/Root.tsx`
- Vertical format: 1080x1920 pixels at 30 fps
- Text should be readable at 1080p width
- Use approved brand assets only
- All animations should feel professional and smooth
- No background music; only SFX that match on-screen actions
- Each scene renders independently
