# Technical Audit

**Project:** MoveMail  
**Audit date:** 25 July 2026  
**Scope:** correctness, type safety, performance, state and race behaviour, privacy, security, test coverage and build/deployment risk.

## Outcome

The prototype has a sound technical core for a hackathon demonstration: strict TypeScript passes, both build paths compile, all 34 tests pass, production dependencies have no reported vulnerabilities, movement evaluation is isolated and tested, and every sponsor integration has an offline fallback.

Material defects found during the audit were fixed, including query-string postcard exposure, premature/noisy calibration, global keyboard interference, narration overlap, duplicate creation, unbounded client waits, inconsistent API errors and silent dependency failures.

The system is not production-ready. Public sponsor-backed endpoints still lack authentication, platform rate limiting and pre-parse byte limits. Bearer links do not establish identity or integrity, expired Supabase rows are not physically purged, and important browser/camera/live-service paths remain outside automated coverage.

## Prioritised Residual Risks

| Priority | Residual risk | Evidence and impact | Recommended action |
| --- | --- | --- | --- |
| P0 when paid credentials are enabled | No authentication, configured platform rate limit, quota or pre-parse request-body byte limit protects `/api/plan`, `/api/voice` or postcard creation. | The repository routes are public. `Origin`/`Sec-Fetch-Site` rejection only constrains normal browsers; direct clients can omit both. Scripted traffic could consume model/TTS credit or storage. | Configure platform/WAF limits, route-specific quotas and maximum body bytes before enabling sponsor credentials. Add `429` contract tests. |
| P1 | Bearer links do not prove sender or provider identity. | Embedded cards are base64url JSON, not signatures. The decoder now forces demo provenance and fixed copy, but names and messages remain mutable. Stored creation accepts a client-supplied provider label and has no authenticated sender. | Add authenticated creation or sign a versioned canonical payload server-side. Describe all unsigned links as unverified. |
| P1 | Data expiry is logical, not physical. | `/api/postcards` filters for future `expires_at`; `supabase/schema.sql` adds a 30-day default and index. No purge job or deletion endpoint exists, so expired personal messages can remain in Postgres. | Add scheduled deletion, sender deletion/revocation and an explicit retention notice. |
| P1 | Intended-user and real-device evidence is absent. | The camera worker, comfort calibration and UI were not tested with an older participant or representative low-powered phone in the repository suite. False negatives, confusing cues or slow startup may only appear there. | Run observed sessions and record task completion, confusion, camera fallback and stop behaviour without making health claims. |
| P2 | Dual build paths can drift. | `npm test` exercises Vinext/Vite/Cloudflare output; Vercel uses `npx next build`. Both currently pass, but no CI enforces both and Vinext reports that some route classification is unknown. | Add explicit `build:vinext` and `build:next` scripts and require both in CI. |
| P2 | Observability is diagnostic rather than operational. | API warnings now contain request ID, provider, category and status without message content. There is no metrics collector, alert, trace, uptime check or defined service objective. | Aggregate provider latency/fallback/error rates and alert on sustained changes. Retain no postcard content. |
| P2 | CSP is not enforced. | `next.config.ts` configures a restrictive `Content-Security-Policy-Report-Only`, including allowances needed by the current Next/MediaPipe path. Report-only violations do not block execution. | Collect violations in target browsers, reduce allowances and move to an enforced policy. |
| P2 | Camera startup remains a sizeable client workload. | The checked-in pose model is about 5.5 MB and the selected WASM binary about 11 MB, excluding worker/framework code. Seven-day caching is configured, but cold-start and thermal behaviour are unmeasured. | Version the assets, verify runtime cache headers after deployment and measure cold start/CPU on target devices before tuning 15 FPS. |
| P2 | Domain validation is duplicated. | Provider plans, client postcards and stored postcards use related but separate shapes and validators. This is intentional at trust boundaries but field lengths and names can drift. | Introduce versioned shared primitives plus explicit provider/client/storage adapters; keep independent validation at each external boundary. |
| P2 | Full dependency audit reports nine high-severity development findings. | `npm audit` identifies the ESLint 9 / `eslint-config-next` / minimatch / brace-expansion graph. `npm audit --omit=dev` reports zero. The affected graph is used during development and CI, not served at runtime. | Track an upstream-compatible release and keep CI inputs trusted. Do not apply an incompatible cross-major override merely to silence the audit. |
| P3 | Browser interaction and live integration coverage is incomplete. | Route, AI, engine and rendered-HTML tests pass, but no committed test drives the client state machine, actual MediaPipe worker, clipboard, audio APIs, stored/hash recovery or live sponsor endpoints. | Add deterministic browser tests and a separate opt-in live-integration smoke suite with strict spend controls. |

## Fixed Findings

### Postcard URL privacy

**Before:** the complete encoded postcard was placed in `?card=…`, so its first navigation reached the host and could appear in request and same-origin referrer data.

**Now:** new links use `#card=…`; pages declare `no-referrer`; decoding rejects payloads above 6,000 encoded characters; stored links include the fragment as a storage-outage fallback. Legacy query links are moved into the fragment after load.

**Boundary:** a legacy query value has already reached the host on its first request. A fragment prevents transport to the server but is still readable and editable by anyone holding the link.

### Embedded provenance and movement tampering

**Before:** an embedded payload could claim OpenAI or Anthropic provenance and supply display labels.

**Now:** embedded cards are labelled as the built-in demo, generated prose is replaced with the selected theme's fixed fallback copy, movement IDs must be supported and distinct, and labels/cues come from the local vocabulary.

**Boundary:** the sender name and message are expected user content and remain unsigned. Stored postcard provenance is still not cryptographically verified.

### Calibration race and outliers

**Before:** a three-step timer started before the camera/worker could be ready, the instruction described a vertical lift while horizontal reach was sampled, and one maximum outlier could make a target impractical.

**Now:** timed calibration advances only while a tracked pose is available, the instruction requests side reaches, neutral range uses a median-like percentile, reach/open-arm range uses bounded 80th percentiles, and the player can select the default range or manual controls.

**Boundary:** these constants are game settings, not validated clinical measures. Real-device and intended-user testing is still required.

### Keyboard interference

**Before:** the global demo Space/Enter listener could complete a move while another control was focused.

**Now:** repeated events and events originating inside buttons, links, inputs, textareas, selects or editable content are ignored.

### Narration lifecycle

**Before:** cancelling a fetch did not stop audio that had already started, object URLs could survive abnormal playback, and switching sound off did not stop current narration.

**Now:** a narration token, active audio reference and URL are owned centrally. A new cue, sound-off, replay, restart or unmount stops audio, cancels speech synthesis and revokes the object URL.

### Client request and submission races

**Before:** creation had no client timeout or duplicate-submission guard.

**Now:** a synchronous ref prevents duplicate creation, the form exposes busy/disabled state, and plan, postcard and voice client waits are bounded. Stored-card lookup also has a visible loading screen and timeout.

### API contracts and diagnostics

**Before:** error bodies varied by route and expected dependency errors were silent.

**Now:** JSON errors share stable codes/messages/request IDs; successes carry request IDs; all relevant responses are no-store; storage not-found and unavailable are distinct; dependency logs contain only correlation metadata.

**Boundary:** request IDs and logs do not replace metrics, rate limiting or authentication.

### AI payload scope

**Before:** providers generated per-move cues and celebrations that the client discarded.

**Now:** the schema sends only the story text and movement identifiers that the interface consumes. The client supplies all physical instructions from its fixed vocabulary, and the provider output cap has dropped from 700 to 400 tokens.

### Static and document security configuration

**Now configured:** `no-referrer`, `nosniff`, frame denial, camera-only Permissions Policy and report-only CSP on both runtime paths. The Vercel deployment also configures seven-day caching for model/WASM assets.

**Boundary:** the policy and cache headers still need verification on the final deployed version; Vinext asset caching is host-specific. CSP is intentionally non-enforcing at this stage.

## Correctness and Type Safety

- `tsconfig.json` uses `strict: true`; final `npx tsc --noEmit` passed.
- No `any`, TypeScript suppression or lint-disable marker was found in the application, game or API code during the audit.
- The provider validator requires exact object keys and exactly three distinct movement identifiers.
- The game engine rejects missing/degenerate geometry, uses the weakest required landmark confidence, never carries a missing landmark through smoothing, pauses rather than accruing hold time on lost tracking and bounds calibrated fractions to 70–80%.
- Postcard storage separately validates all fields and distinct movement IDs before using the Supabase service role.
- `AbortSignal.timeout` bounds server dependencies; client-side abort controllers bound all user-facing waits.

Residual correctness risk is concentrated in browser lifecycle code rather than the pure engine. The main application state machine is a single large client component, and it lacks component-level tests.

## Performance

- Positive: pose inference runs in a Worker, capture is limited to 15 FPS, only one frame is in flight, the camera model is loaded only after camera selection, and server planning output is small.
- Improved: model and WASM caching is configured; unused provider tokens were removed; client/provider timeouts now match the two-provider failover budget.
- Unknown: cold model start, inference latency, UI render cost at 15 landmark updates per second, battery/thermal impact and low-memory behaviour have not been measured on target hardware.
- The static pose assets dominate transfer size. Optimising the ordinary page bundle before measuring would be premature.

## Privacy and Security Boundaries

- Camera frames remain inside the browser/Worker path; no route accepts frames or landmarks.
- Personal text can leave the browser for planning, narration and configured storage. The form discloses the LLM path and warns against medical/highly private content.
- OpenAI requests set `store: false`; no equivalent broad claim is made for every third party.
- Supabase anonymous/authenticated table access is revoked in the supplied schema. The service-role key remains server-side.
- The service role means route validation and abuse controls are the effective database boundary.
- Cross-site browser rejection is useful defence in depth but is not an API credential.
- There is no authenticated identity, access-control list, signature, link revocation or proof of provider provenance.
- The prototype has no healthcare, medical-device or data-protection compliance assessment.

## Test Coverage

### Covered

- Provider-neutral schema and input/output validation.
- Deterministic fallback and OpenAI-to-Anthropic failover.
- OpenAI storage flag and both provider structured-output request shapes.
- Shared API error contract and request ID correlation.
- Cross-site browser request rejection.
- Offline LLM, Supabase and ElevenLabs fallbacks.
- Storage not-found versus unavailable/timeout responses.
- Pose mirroring, normalisation, confidence, smoothing and degenerate input.
- Calibration fraction and movement thresholds.
- Reach, open-arm, hands-together and wave matching.
- Paused tracking, hold duration and release hysteresis.
- Server-rendered start screen and privacy/resilience disclosure.

### Not covered

- Full create/share/open/play/reveal browser journey.
- Hash parsing, legacy migration and stored-to-hash fallback at client level.
- Duplicate-submit, focus transition and interactive-keyboard behaviour.
- Audio cancellation and object URL release.
- Camera permission, Worker initialisation and actual MediaPipe inference.
- Responsive layout, contrast and assistive-technology behaviour.
- Live sponsor API compatibility, rate limiting, load and cost controls.
- Supabase migration application and physical retention.

## Build and Dependency Evidence

Commands were run on the final code snapshot:

| Command | Evidence |
| --- | --- |
| `npm run lint` | Passed |
| `npx tsc --noEmit` | Passed |
| `npm test` | Vinext build passed; 34 tests passed, 0 failed |
| `npx next build` | Next 16.2.12 build passed; `/` static and three API routes dynamic |
| `npm audit --omit=dev --json` | 0 production vulnerabilities |
| `npm audit --json` | 9 high development findings; non-zero exit |

The two production compilers succeeding on the same snapshot is useful evidence, but it is not a substitute for automated release checks or a final deployed smoke test.

## Recommended Order of Work

1. Protect paid endpoints with platform rate limits, quotas and body-byte limits.
2. Decide whether MoveMail needs trusted sender/provider provenance; if so, add authentication or signatures.
3. Implement physical data purging, deletion and revocation.
4. Add browser tests for the primary journey and all fallback transitions.
5. Test camera and narration on representative real devices with intended users.
6. Add privacy-preserving operational metrics and alerts.
7. Enforce CSP after report-only validation.
8. Add CI for both build paths and production dependency audit.
9. Update the ESLint toolchain when a compatible advisory fix is available.
