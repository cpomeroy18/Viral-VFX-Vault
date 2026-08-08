# VFX Vault — Technique Rulebook

The reference for categorizing effects. Used two ways:
1. **Auto-tagger** — the AI proposes technique tags (with confidence) for a new effect; Colin confirms.
2. **Sourcing pre-filter** — the AI does a rough "does this even contain an effect?" pass on a creator's recent posts.

Core principle (per the "match, don't ID" approach): the AI **matches** a video against this fixed list and returns a confidence score. It does NOT invent free-form tags. Low confidence is useful — it flags "human, look closer." Colin's eye is the final word, especially on subtle techniques.

Most effects use ONE main technique; some combine two (tag main + backup). Multi-tagging is expected, not an error.

---

## 1. Match Cut
**What it is:** A transition between two shots (different outfit, location, or moment) where the cut itself creates the transition — no added visual effect layered on top.
**Tells (any):** something swipes across the frame (hand, object) and the scene has changed on the other side; the camera moves/whips and lands on a new scene; a clean hard cut where framing or motion lines up so the change feels intentional and smooth.
**Signature:** if the ONLY thing creating the transition is the cut — no masking, green screen, or speed effect — it's a match cut. It's the "default" transition: tag it when nothing fancier is doing the work.

## 2. Masking
**What it is:** A drawn shape reveals or hides part of the frame, combining two clips (or two versions of a scene) into one impossible shot.
**Tells (any):** the same person appears twice in one frame (a clone); a person/object appears or disappears against an otherwise-still background; the frame looks split, one region behaving differently from another.
**Signature:** a hard boundary where two realities meet inside a single continuous shot ("two clips stacked, a shape decides which shows where").
**Distinguisher:** masking keeps the original background and hides/reveals a region of it; Remove BG replaces the whole backdrop. Clone = masking, not green screen.
**Exemplar:** treadmill — top half walking, bottom half sprinting/dancing, seam across the middle.

## 3. Remove BG (background removal / rotoscoping)
**What it is:** A subject or object is cut out of its original footage and isolated, then placed over a different scene or moved independently.
**Tells (any):** subject composited onto a scene they clearly weren't filmed in; someone flies/launches on- or off-screen unnaturally fast; a subject moving in front of / outside a graphic element (e.g. fake movie borders); cut-out/isolated edges.
**Signature:** the subject has been lifted off its original background and now acts independently of it.
**Distinguisher vs Green Screen:** if the *subject* is moved/flown/repositioned → Remove BG. If the *background* is swapped while the subject stays put → Green Screen. When in doubt between the two, lean Remove BG (it's far more common in this library).
**Exemplars:** superhero banding (jump → cut out → keyframed flight); stepping outside fake letterbox borders.

## 4. Green Screen
**What it is:** The subject stays roughly in place while the entire background behind them is replaced.
**Tells:** subject stationary/acting naturally (not flying), but the whole backdrop is clearly not where they filmed.
**Distinguisher:** subject moved → Remove BG; background swapped, subject put → Green Screen.
**Note:** uncommon in this library — don't over-guess; when torn with Remove BG, prefer Remove BG.

## 5. Speed Tool (speed ramping / time manipulation)
**What it is:** Playback speed is deliberately changed — whole clip, or shifting within a single shot for rhythm and transitions.
**Tells (any):** whole video obviously sped up or slowed down; speed changes within one continuous shot (camera orbiting a subject at normal speed, ramping fast, slowing again, using ramps as transitions); motion punching slow↔fast on a beat.
**Signature:** time is manipulated — the giveaway is speed *change*, especially mid-shot ramps timed to music.
**Common combo:** pairs with Masking when only part of the frame is sped up while the rest stays normal (tag both).
**Exemplar:** camera orbiting a shopping cart, spinning normal → fast → transition → slow → repeat.

## 6. Reverse
**What it is:** Footage plays backward to create an impossible or striking moment.
**Tells:** motion running in reverse — things assembling instead of falling apart, objects flying into frame or into a hand, crumpled things un-crumpling. The reveal works because the destructive action was filmed forward, then reversed.
**Note:** uncommon — don't over-guess; tag when reverse motion is clearly the point.
**Exemplar:** crumpled paper flies into a hand and un-crumples to reveal writing (filmed: show page → crumple → throw, then reversed).

## 7. Splice (overlay / blend mode)
**What it is:** A clip is layered over another and blended in via a blend mode — literally CapCut's "Splice" tool (normal, dark, overlay, lighten, hard/soft, burn, color burn, dodge). Same as an overlay/blend layer in Premiere.
**Tells:** usually a clip with a solid black (or white) background laid over the main footage, background blending away so only the bright/dark element shows — e.g. white text on black composited onto a scene, or a black-background screen-recording (scrolling Spotify) blended over the video.
**Signature:** two layers blended by luminance, not cut side-by-side; the background "disappears" through blending.
**Distinguisher:** NOT a match cut (nothing cut and joined in sequence — one clip sits on top of another); NOT masking (no shape drawn; the blend mode hides the background by light/dark).
**Note:** rare (currently one effect), expected to grow.

## 8. Keyframes
**What it is:** A property (position, scale, crop/frame, or similar) is animated to change over time via markers on the timeline — a "start state" and "end state" are set, and the edit moves between them, smoothly or step-wise.
**Tells (any):** the frame/crop shifts or repositions triggered by an action (e.g. horizontal footage reframed in a vertical video, shifting down slightly each time the subject jumps, then holding until the next trigger); an element's size, position, or crop visibly changes over the course of the clip rather than staying fixed.
**Distinguisher from Speed Tool:** Speed Tool changes *how fast time plays back* (the footage itself speeds up/slows down). Keyframes changes *a property's value* over time (position, scale, crop) — playback speed stays normal.
**Distinguisher from Masking:** Masking is typically a shape drawn once to reveal/hide part of the frame. Keyframes is about *animating* a property's change over time — very often the thing doing the combining (e.g. "Masking, Keyframes" = a mask whose position/size itself moves). Expect this combo often.
**Exemplar:** horizontal video reframed inside a vertical crop; each time the subject jumps, the crop shifts down slightly and holds until the next jump.

## 10. Practical Effect
**What it is:** The effect is achieved physically, in-camera, at the time of filming — no software manipulation involved (props, camera tricks, forced perspective, lighting, physical rigs).
**Tells:** the "how" is explainable by physics/staging rather than editing — nothing was cut, masked, keyframed, or composited; what you see is what the camera actually recorded.
**Distinguisher:** if removing all editing software from the equation would still produce the same visual, it's Practical Effect. If the trick lives in the edit, it's one of the other techniques.

## 11. Template
**What it is:** The video was built using an Instagram Edits app template — a reusable structure other creators plug their own footage into.
**Tells:** a "Template" tag/badge appears directly on the video itself while playing (tappable, opens in the Edits app). This is a visual on-screen UI element, NOT something present in the caption or metadata.
**Important:** this tag cannot be detected from scraped data (caption/metadata) — it must always be supplied manually by Colin after watching the video. Never AI-guess this one; treat it as a required-manual field. No generic tutorial exists for this technique — leave reference_tutorial blank rather than guessing a link.

## 12. Stop Motion
**What it is:** A sequence of still frames/images played in succession to simulate motion, rather than continuous video footage.
**Tells:** movement looks segmented/staccato rather than fluid; the video is built from a series of photos rather than a single continuous take.

## 13. Color Change
**What it is:** Colors are deliberately altered mid-clip — recoloring a specific object or shifting the whole frame's color — usually as a reveal or transition.
**Tells (any):** an object changes color over time (shirt blue→red, outfit green→red); a color shift triggered by a touch/gesture; a full-scene color/grade shift happening in the *middle* of the video (not a static filter).
**Signature:** color that *changes* during the clip. A constant filter over the whole video does NOT count — it's the transition from one color state to another.
**Note:** rare (currently one effect).
**Exemplar:** girl dancing with clones, onesie slowly shifts green→red, then loops.

---

## Base-rate notes for the AI (reduces false positives)
- **Common:** Match Cut, Masking, Remove BG, Speed Tool.
- **Uncommon:** Green Screen, Reverse, Splice, Color Change, Keyframes, Practical Effect, Stop Motion — require a clear tell, don't guess them on weak evidence.
- **Template is manual-only:** never AI-guess it. It can only be identified by watching the video for the on-screen "Template" badge, which scraped data never contains. If a row's technique is left blank for AI guessing, Template should never be among the suggestions.
- Keyframes very often pairs with Masking (an animated mask) — expect the combo.
- When torn between Remove BG and Green Screen → Remove BG.
- A static color filter is NOT Color Change.
- A plain overlay blend is NOT a Match Cut.
