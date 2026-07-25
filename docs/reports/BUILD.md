# Build Report

**Project:** MoveMail  
**Review date:** 25 July 2026  
**Result:** The hardened local build passes both supported production build paths, strict TypeScript, lint and all 34 repository tests.

## Implemented Behaviour

### Core journey

- A sender creates a themed postcard containing a personal note.
- The planner returns exactly three distinct identifiers from a five-item seated movement vocabulary.
- The recipient sees safety guidance, chooses camera or on-screen controls, completes three moves and reveals the message.
- Opening and closing story copy is now visible in the preparation and reveal screens.
- The complete journey remains available without external credentials.

### AI planning and safety

- `LLM_PROVIDER=auto` tries configured OpenAI first, then configured Anthropic, and stops after a success.
- Forced OpenAI and Anthropic modes remain supported.
- Each provider has a 4.5-second timeout and provider failures are classified for safe diagnostics.
- Both providers use the same structured-output schema.
- The schema was reduced to fields the interface consumes: title, opening, three movement IDs and closing.
- Local validation requires exact fields, supported distinct movement IDs, bounded text and no detected medical claim.
- Physical labels and cues always come from the fixed local movement copy.
- A deterministic validated plan is returned when providers are absent, slow, unavailable or invalid.

### Sharing and storage resilience

- Self-contained postcard data now uses `#card=…`, so new fallback payloads are not sent in HTTP requests.
- Embedded payload length is bounded before decoding.
- Legacy `?card=` links are migrated out of browser history after load.
- An embedded card is treated as demo provenance and uses fixed story/movement copy rather than trusting embedded provider claims.
- Supabase creation is optional. A successful stored share URL also carries the fragment fallback.
- Stored-card opening has a visible loading state and falls back to the embedded copy after a bounded failure.
- Stored reads exclude rows after their 30-day `expires_at` value.

### Camera and game reliability

- Camera calibration waits until shoulders and hands are being tracked.
- Calibration wording now matches the sampled side reaches.
- Neutral and reach samples use bounded percentiles rather than a single value or an unbounded maximum.
- Players can skip to the default range or switch to on-screen controls during calibration or play.
- Keyboard completion ignores repeats and events originating from interactive controls.
- The existing movement engine retains confidence pauses, smoothing, 75% calibrated targets, a short hold and release hysteresis.

### Voice reliability

- The client keeps one narration token and active audio object URL at a time.
- New narration, sound-off, replay, restart and unmount stop previous audio and browser speech.
- Client and server narration timeouts are explicit.
- ElevenLabs failure returns an explicit browser-fallback signal and visible text remains present.

### User interface and accessibility

- Screen headings receive programmatic focus after screen and movement changes.
- Form fields use native required validation, duplicate submission is disabled and the form exposes busy state.
- Clipboard failure selects the share URL for manual copying.
- Movement progress exposes the current step and screen-reader-only status.
- Loading, success, fallback and damaged/unavailable-card states have visible copy.
- The page discloses when personal text may be sent to an AI provider.
- Referrer, framing, content-type and camera permission headers are configured; CSP is report-only.

### API reliability

- JSON successes include `ok: true` and a request ID.
- JSON failures use `{ ok: false, error: { code, message, details?, requestId } }`.
- Responses use `Cache-Control: no-store` and expose `X-Request-Id`.
- Expected storage not-found responses are separated from storage-unavailable responses.
- Browser cross-site requests are rejected before sponsor work.
- Dependency diagnostics log request ID, provider, category and status without postcard content or secrets.

## Principal Files

| File | Responsibility |
| --- | --- |
| `app/MoveMailApp.tsx` | Product journey, safe plan adaptation, hash/stored sharing, narration lifecycle, calibration, game state and accessibility |
| `app/globals.css` | Responsive visual system, focus/status states and reduced-motion treatment |
| `app/layout.tsx` | Metadata, language and referrer policy |
| `hooks/usePoseCamera.ts` | Camera/Worker lifecycle, 15 FPS capture and demo fallback |
| `lib/pose/pose.worker.ts` | Local MediaPipe initialisation and frame inference |
| `lib/game/engine.ts` | Pure normalisation, calibration, movement, wave and hold logic |
| `lib/ai/plan.ts` | Provider-neutral schema, request parsing, plan validation and deterministic plans |
| `lib/ai/providers.ts` | OpenAI/Anthropic adapters, timeouts, failover and diagnostic categories |
| `lib/http/responses.ts` | Request IDs, response contracts, cross-site checks and safe diagnostics |
| `lib/http/security-headers.ts` | Shared security policy for the Next and Vinext runtime paths |
| `app/api/plan/route.ts` | Planning endpoint and demo fallback |
| `app/api/postcards/route.ts` | Optional Supabase persistence and lookup |
| `app/api/voice/route.ts` | Optional ElevenLabs narration and browser fallback signal |
| `supabase/schema.sql` | Optional bearer-link postcard table, RLS grants and access expiry |
| `next.config.ts` | Shared Next-path security headers |
| `vite.config.ts`, `worker/index.ts` | Vinext/Cloudflare-compatible build path, including shared response headers |
| `vercel.json` | Standard Next.js Vercel build path and camera-asset caching |
| `tests/api-routes.test.mjs` | API contracts, failure classification and offline fallbacks |
| `tests/game-engine.test.mjs` | Pose geometry, calibration, movement and hold behaviour |
| `lib/ai/plan.test.mjs` | Plan schema, validation, provider selection and payloads |
| `tests/rendered-html.test.mjs` | Server-rendered start-screen and disclosure smoke test |

## Verification

The following checks were run on the final code snapshot represented by this report:

| Check | Result |
| --- | --- |
| `npm run lint` | Passed |
| `npx tsc --noEmit` | Passed with strict TypeScript |
| `npm test` | Passed; Vinext production build completed and 34/34 tests passed |
| `npx next build` | Passed; `/` prerendered and all three API routes built as dynamic functions |
| `npm audit --omit=dev --json` | Passed; 0 production vulnerabilities |
| `npm audit --json` | Reported 9 high-severity development-tool findings in the ESLint/minimatch/brace-expansion graph |

The full audit's non-zero exit is a real development dependency finding, not a production dependency finding. No compatible remediation was verified in this build, so it remains tracked rather than being hidden with an unsafe blanket override.

## Limitations

- There is no authentication, sender verification, recipient authorisation or configured platform rate limit.
- Origin and fetch-site checks do not stop scripted clients that omit browser headers.
- API request bodies have field limits after JSON parsing but no explicit byte limit before parsing.
- Bearer links are not encrypted or signed. Embedded names/messages can be read or changed by recipients, and stored provider labels are not cryptographic provenance.
- Fragment postcards do not expire and cannot be revoked.
- Supabase `expires_at` blocks application reads after 30 days but does not delete data. There is no deletion endpoint or purge job.
- The Content Security Policy is report-only.
- No live OpenAI, Anthropic, ElevenLabs or Supabase transaction was exercised by the offline test suite.
- No full browser interaction, actual camera/model, load, performance or lower-powered-device test is committed.
- No older participant tested this iteration; the product and accessibility hypothesis remains unvalidated with its intended audience.
- The repository has two build paths but no continuous-integration workflow enforcing both.
- This report verifies local build artefacts. Final production deployment status belongs in the release hand-off.

## Next Work

1. Configure platform rate limits, per-route quotas and request-body byte limits before enabling paid sponsor credentials publicly.
2. Add signed server records or authenticated senders if provenance matters.
3. Add physical Supabase purging, deletion and revocation.
4. Run the report-only CSP on the target browsers and then enforce a tested policy.
5. Add end-to-end tests for the fragment/stored fallback, keyboard focus, clipboard denial, audio cancellation and camera denial.
6. Test camera cold start and frame processing on representative phones and lower-powered laptops.
7. Add CI for lint, TypeScript, Vinext tests/build, Next build and the production dependency audit.
8. Track and update the affected ESLint dependency chain when a compatible fix is available.
9. Conduct short observed sessions with older participants or relevant carers before making engagement or wellbeing claims.
