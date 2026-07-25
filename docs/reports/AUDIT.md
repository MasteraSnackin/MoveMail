# MoveMail Product Audit

**Audit date:** 25 July 2026  
**Scope:** sender journey, recipient journey, demo fallback, responsive implementation, accessibility, safety, privacy and failure handling.

## Evidence boundary

Browser visual inspection was blocked by the environment's connection policy. No live desktop or mobile screenshots, camera-permission exercise, screen-reader pass or measured browser contrast check was available. The assessment below is therefore based on source inspection, server-render and API tests, game-engine tests, type checking, linting and the production build. This is an explicit evidence gap, not a visual or interaction pass.

## Scorecard

| Area | Score | Evidence-based assessment |
| --- | ---: | --- |
| Visual design | **8/10** | The interface has a coherent postcard concept, a restrained colour and type system, distinct themed scenes, strong headline hierarchy and dedicated layouts for create, opening, ready, safety, calibration, play and reveal. Responsive breakpoints and reduced-motion rules are present. The score is capped because browser rendering, text wrapping and colour contrast were not visually inspected. |
| Functional quality | **8/10** | The complete sender-to-recipient journey exists, including deterministic AI fallback, durable sharing, camera-free play and message reveal. Input validation, loading states, request timeouts and duplicate-submit protection are implemented. The score is capped because the complete journey and real camera tracking were not exercised in a browser. |
| Trust and resilience | **9/10** | Model output is restricted to three distinct moves from a fixed seated upper-body vocabulary, then validated independently. Camera processing stays in the browser. The sender is told when message text may reach an AI provider, bearer-link limitations are stated, provider failures degrade safely and API errors carry request IDs. Platform rate limiting and operational telemetry are not implemented. |
| Accessibility | **8/10** | Native labels, required fields, a fieldset/legend, visible focus styles, focus movement between screens, live status text, keyboard-compatible demo controls, reduced-motion CSS, 44-pixel minimum controls and a camera-free route are present. Screen-reader behaviour, browser zoom, contrast and touch use remain unverified. |
| Demo readiness | **9/10** | The product tells one clear story, works without sponsor credentials, exposes the sponsor contribution honestly, and has an on-screen path that avoids camera and network uncertainty. A rehearsed two-minute live run and browser preflight are still required. |
| **Overall** | **8.4/10** | Arithmetic mean of the five category scores. |

## Primary journey

1. The sender enters recipient, sender, theme and message details in a single form.
2. A live provider may create the themed plan; otherwise a deterministic built-in plan is returned.
3. The sender receives a shareable bearer link containing an embedded hash fallback. A Supabase identifier is added when persistence succeeds.
4. The recipient sees a safety screen before choosing camera tracking or on-screen controls.
5. Calibration waits for actual tracking data in camera mode. The recipient may use the default range or switch to on-screen controls at any time.
6. Three supported movements unlock the message.
7. Narration uses ElevenLabs when available and browser speech when it is not.

The information architecture is appropriate for a two-minute demonstration: one task per screen, one dominant action, and a visible conclusion.

## State coverage

| State | Evidence |
| --- | --- |
| Loading | Separate `opening` and `loading` screens cover recipient lookup and plan creation. |
| Empty or invalid input | Native constraints and an inline status message prevent incomplete creation. |
| Success | Ready, prepare, play and reveal states give clear progress and completion. |
| LLM failure | OpenAI can fail over to Anthropic; both can fall back to the deterministic plan. |
| Storage failure | The embedded `#card=` copy remains usable if Supabase is unavailable. |
| Stored-card failure | A `503` or invalid stored response causes the client to open the embedded copy when present. |
| Voice failure | A `204` response selects browser speech; the written instruction remains visible. |
| Camera failure | The experience exposes on-screen controls before and during play. |
| Clipboard failure | The share field receives focus and selection, with a visible manual-copy instruction. |

## Safety and trust assessment

- The LLM selects movement identifiers only. Labels and physical cues come from the fixed local vocabulary.
- Generated plans must contain exactly three distinct allow-listed moves and must not contain medical or health claims.
- The preparation screen says to use a steady chair, clear the area, stay within an easy range and stop for pain, dizziness or discomfort.
- The product describes itself as a wellbeing game, not medical advice or rehabilitation.
- The camera note accurately limits the claim to image/video handling: pose processing is local and no image or video is uploaded or stored.
- Share links are described as bearer links rather than encrypted messages.
- The form discloses that a live story may send the message to OpenAI or Anthropic.
- Stored postcards expire from application lookup after 30 days when the supplied Supabase schema is used.

## Accessibility assessment

Implemented evidence includes:

- semantic form controls and a `fieldset` for scene selection;
- clear visible focus treatment;
- programmatic focus on the active screen heading;
- `aria-live`, `role="status"`, `aria-busy`, `aria-current` and screen-reader-only progress text where relevant;
- an explicit reduced-motion media query;
- large controls and mobile single-column layouts;
- no camera-only requirement; and
- Space/Enter shortcuts that ignore repeated keys and interactive descendants.

The remaining accessibility uncertainty is practical rather than hidden: no VoiceOver/NVDA run, browser zoom check, contrast measurement or motor-access test was possible in this environment.

## Smallest remaining fixes

### High priority before judging

1. Run the entire journey in a supported browser at approximately 1440 × 900 and 390 × 844. Check overflow, text wrapping, focus order, the share-link field and the reveal layout.
2. Exercise camera permission granted, denied and no-pose states. Confirm that the on-screen control switch remains reachable without refreshing.
3. Run one keyboard-only and one screen-reader pass. Measure all text/control contrast rather than relying on palette inspection.

### Medium priority after the hackathon

1. Add deployment-level rate limiting for the plan, voice and postcard-write endpoints.
2. Send the existing request-ID diagnostics to a structured log/metrics service with latency and fallback counters.
3. Move the report-only content security policy to an enforced policy after recording and fixing any violations.
4. Add a browser-level regression test for the embedded fallback link and narration cancellation.

## Recorded verification

- `npm run lint`: passed.
- `npx tsc --noEmit`: passed.
- `npm test`: passed after the Vinext build, with 34 tests, no failures.
- `npx next build`: passed; `/` is static and the three API routes are dynamic.
- `npm audit --omit=dev --json`: no production dependency vulnerabilities reported.
- Full `npm audit --json`: nine high-severity findings remain in the ESLint/minimatch/brace-expansion development-only dependency graph.

## Demo recommendation

Use the on-screen-control route for the judged two-minute demo. It proves the complete idea without camera-permission or lighting risk, while the camera option remains visible and technically implemented. Show the provider receipt and briefly disconnect or omit credentials only if there is time to demonstrate the honest built-in fallback.

## User evidence

No older adult or independent real-user test is evidenced in the repository. Self-testing is useful for defect discovery but does not qualify for the real-users bonus and should not be presented as such.
