# MoveMail Design Lead Report

Reviewed: 25 July 2026

Status: implemented and statically reviewed; browser visual verification remains outstanding.

## Evidence boundary

This review is based on the current React, CSS and supporting application code. The browser visual inspection required by the audit could not be completed in this environment. Therefore this report does not claim pixel-perfect rendering, WCAG conformance, tested screen-reader behaviour or verified usability on a physical mobile device.

## Target user and primary task

MoveMail has two linked users:

- A family member creates and shares a personal movement postcard.
- The recipient, intended to include older adults, completes three gentle seated movements and then reads or hears the message.

The primary recipient journey is deliberately short:

1. Open the postcard.
2. Read the comfort and safety guidance.
3. Choose camera tracking or on-screen controls.
4. Complete three movements.
5. Reveal the family message.

The narrow product idea is stronger than a general fitness product: the movement is a small ritual for opening a personal message.

## Diagnosis

### What is working

- The postcard metaphor gives the product a recognisable identity beyond a standard AI dashboard.
- Seaside, garden and dance-hall themes create variation without changing the core interaction.
- The sender and recipient journeys are clearly separated.
- One active movement, one cue and one progress indicator dominate the play screen.
- Camera use is optional and the non-camera route remains a first-class path.
- Safety, privacy and service fallbacks are described in the interface rather than hidden in technical documentation.

### Problems found in the earlier experience

- A quotation looked like user testimony even though no older-adult user research existed.
- The form did not explain clearly that a live story could send message text to an AI provider.
- Rapid repeated submission could start duplicate creation requests.
- Screen changes did not consistently move keyboard or assistive-technology focus to the new heading.
- Some trust and error text was too small for the intended audience.
- Calibration could progress before the camera had reliable shoulder and hand landmarks.
- A camera session did not provide a prominent recovery route to on-screen controls.
- Progress relied too heavily on visual styling and symbols.
- The embedded fallback link used a query parameter, which was more likely to appear in server logs and referrer data.
- The earlier copy could imply that an AI-generated sequence was inherently safe, rather than constrained by a fixed movement vocabulary and deterministic validator.

## Changes made

### Information architecture and copy

- Replaced the unsupported testimonial-style quotation with an explicitly labelled product hypothesis.
- Kept creation, preparation, calibration, play and reveal as distinct screens with a single primary action on each.
- Added a dedicated “Finding your postcard…” state for stored-link loading.
- Added the generated opening and closing lines at the points where they support the story.
- Reworded provider labels as “assisted story” rather than implying that an AI provider controls the movement mechanic.
- Made the wellbeing boundary explicit: MoveMail is not medical advice or rehabilitation.
- Added plain-language warnings that a bearer link is not encrypted and that sensitive or medical information should not be included.

### Interaction and recovery

- Disabled the creation button while a postcard is being generated and guarded against duplicate submission.
- Added client-side timeouts so AI, storage and voice delays cannot trap the interface indefinitely.
- Preserved an embedded hash-link fallback when Supabase is absent or unavailable.
- Added “Continue without camera” before play and “Use on-screen controls” during calibration and play.
- Prevented calibration from advancing until camera tracking has usable landmarks.
- Kept “Skip and use the default range” available so the comfort check never becomes a dead end.
- Made failed clipboard copying select and focus the share link for manual copying.
- Stopped stale narration when screens or movements change.

### Accessibility

- Added native required and length constraints to sender fields.
- Retained visible labels, a fieldset and legend for the scene choice.
- Added `aria-busy`, live status messages and programmatic focus on the primary heading after screen changes.
- Added `aria-current="step"` and screen-reader-only progress descriptions to the movement list.
- Kept a visible keyboard-operable completion button in demo mode; global Space or Enter handling ignores form controls and repeated key events.
- Increased trust and error text to a more legible size.
- Strengthened focus outlines and brought interactive controls to at least 44 CSS pixels high where the shared control styles apply.
- Added a reduced-motion media query that suppresses non-essential animation and transition duration.
- Preserved written instructions and captions when voice playback is unavailable.

These changes support relevant [WCAG 2.2](https://www.w3.org/TR/WCAG22/) concerns such as focus visibility, reflow, status communication, keyboard operation and target size. Conformance has not been established.

### Mobile

- Two-column creation, ready, preparation, session and reveal layouts collapse to one column below 1,020 pixels.
- Sender name fields and theme choices stack on small screens.
- Primary action groups become full-width vertical controls.
- The postcard preview becomes a single-column card.
- Calibration and play instructions appear before the visual stage when the layout stacks.
- The technical receipt collapses to a vertical list.
- Decorative card rotation is removed from the small-screen form.

The CSS has breakpoints at 1,020 and 650 pixels, but actual reflow, zoom and browser-chrome behaviour still require device testing.

### Demo readiness

- The complete journey works without AI, Supabase, ElevenLabs or camera permission.
- The interface names the active story source and movement mode instead of silently degrading.
- The no-camera path uses the same three-move story, progress and reveal as camera mode.
- The demo control is explicit and large enough to operate with a pointer or keyboard.
- The current flow can be explained in a two-minute demo: create, share, choose a mode, complete three moves, reveal the message.

## Relevant files

- `app/MoveMailApp.tsx` — journey states, trust copy, focus handling, fallbacks, calibration gating and camera-free controls.
- `app/globals.css` — hierarchy, focus treatment, text size, responsive layouts and reduced motion.
- `app/layout.tsx` — metadata and referrer policy alignment.
- `next.config.ts` — browser security and permission headers that reinforce the privacy story.
- `public/favicon.svg` and `public/og.png` — existing product identity used on browser and shared-link surfaces.

Supporting resilience and trust behaviour also lives in:

- `app/api/plan/route.ts`
- `app/api/postcards/route.ts`
- `app/api/voice/route.ts`
- `hooks/usePoseCamera.ts`
- `lib/game/engine.ts`

## Before and after

| Area | Before | Current |
| --- | --- | --- |
| Social proof | Unverified quotation looked like a real testimonial | Clearly labelled product hypothesis |
| AI disclosure | Generic fallback statement | Message-transfer disclosure and named provider receipt |
| Camera choice | Fallback existed but recovery was less prominent | No-camera entry plus an in-session switch |
| Calibration | Timed progression could outpace tracking | Progress waits for usable pose data; skip remains available |
| Submission | Repeated clicks could duplicate work | Disabled state and in-flight guard |
| Screen changes | Visual transition only | New primary heading receives focus |
| Progress | Colour and check mark carried much of the state | Current-step semantics and screen-reader text |
| Share fallback | Embedded data in the query string | Embedded copy in the URL fragment, with a stored-link preference |
| Motion | Animated presentation only | Reduced-motion override |
| Health framing | Safety wording could be read as a product guarantee | Fixed-vocabulary explanation and explicit non-medical boundary |

## Residual risks

- No older adult has tested comprehension, comfort, dexterity demands or emotional tone.
- No occupational therapist, physiotherapist or other qualified professional has reviewed the movement vocabulary.
- Camera accuracy has not been characterised across devices, lighting, clothing, skin tones, body shapes, seating positions or assistive equipment.
- Browser visual inspection, keyboard traversal, screen-reader testing, contrast measurement and 200–400% zoom checks remain incomplete.
- The largest headings may wrap awkwardly on unusually narrow screens or with user-selected large text.
- The privacy note in the top bar is hidden below 650 pixels, although the preparation screen retains the fuller privacy explanation.
- A bearer link can be forwarded. The embedded copy is not encryption, access control or revocation.
- English-only copy and voice behaviour have not been tested with users who have hearing, vision, cognitive or language-access needs.

## Next design validation

Run the primary recipient journey on a physical iPhone and Android phone, then with VoiceOver and TalkBack. Follow that with observed usability sessions involving older adults. Record task completion, assistance required, the chosen camera mode, misunderstandings and discomfort reports. Do not describe the current prototype as validated until that evidence exists.
