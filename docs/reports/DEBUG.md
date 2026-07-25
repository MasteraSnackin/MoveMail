# Debug Report

## Root Cause

### Calibration race

Camera calibration originally advanced on fixed timers even when the pose worker had not produced usable landmarks. It also derived thresholds from a single neutral reading and extreme samples, so startup delay or one noisy frame could produce a default or distorted comfort range.

### Durable links

The client originally replaced its self-contained link with a Supabase identifier after a successful write. If Supabase later became unavailable, the identifier-only link contained no postcard data and the recipient could not recover.

### Audio lifecycle

Narration cancellation originally aborted only the active HTTP request. Audio that had already started, delayed reveal narration and browser speech were not managed as one lifecycle. The browser timeout was also shorter than the server's ElevenLabs timeout, making avoidable fallback and overlapping playback possible.

### API errors

API routes returned unrelated `{ error: string }` bodies and swallowed dependency failures without a request identifier or safe provider context. Storage outages were reported as `404`, making a temporary dependency failure indistinguishable from a genuinely missing postcard.

## Fix

### Calibration race

- Camera calibration now advances only when demo mode is active or pose tracking has usable landmarks.
- The UI explains that it is waiting for shoulders and hands rather than silently advancing.
- Neutral and reach observations are collected across frames.
- Bounded median/80th-percentile samples replace single or maximum values, with conservative defaults and hard limits.
- The reach step has a longer sampling window, and the player can switch to on-screen controls or use the default range.

### Durable links

- The client creates an embedded `#card=` copy before attempting persistence.
- A successful Supabase write produces a hybrid `?postcard=<id>#card=<encoded>` link rather than discarding the embedded copy.
- Opening a hybrid link tries Supabase first and then the embedded copy after timeout, error or invalid data.
- Legacy `?card=` links are migrated into the URL fragment so the message is not included in future HTTP requests.
- Supabase returns `404` only for a successful empty lookup and `503 STORAGE_UNAVAILABLE` for configuration, upstream, timeout or invalid-response failures.

### Audio lifecycle

- `stopNarration` now cancels delayed narration, the active fetch, active audio and browser speech as one operation.
- A narration token prevents stale responses from starting playback.
- Object URLs are revoked on completion and failure.
- Turning sound off, replaying and starting over stop current narration.
- The client allows 6,500 ms while the ElevenLabs route allows 5,500 ms, so the server can return its explicit browser fallback before the client aborts.

### API errors

- Shared helpers now return stable success/error envelopes, `Cache-Control: no-store` and an `X-Request-Id` header.
- Error responses use:

  ```json
  {
    "ok": false,
    "error": {
      "code": "INVALID_REQUEST",
      "message": "Safe user-facing text.",
      "requestId": "..."
    }
  }
  ```

- A supplied request ID is accepted only when it matches the restricted format; otherwise a UUID is generated.
- Cross-site sponsor requests are rejected before provider work.
- Dependency diagnostics contain only request ID, provider, category and status.
- Plan generation reports provider failure categories while retaining the valid deterministic fallback.

## Verification

- Unit coverage exercises movement thresholds, pose normalisation, smoothing, wave evidence and hold hysteresis.
- AI tests cover request validation, the shared structured-output schema, OpenAI-to-Anthropic failover, deterministic fallback and provider diagnostics.
- API tests cover the error envelope, request-ID correlation, cross-site rejection, no-key fallbacks, voice type validation, storage `404` versus `503`, upstream failure and timeout.
- The server-render test checks the start-screen content, provider disclosure, privacy metadata and absence of placeholder content.
- `npm test` passed after the Vinext build with 34 tests and no failures.
- `npm run lint`, `npx tsc --noEmit` and `npx next build` passed.
- `npm audit --omit=dev --json` reported no production dependency vulnerabilities. The full development audit still reports nine high-severity findings in the ESLint/minimatch/brace-expansion dependency graph.
- Browser verification was not completed because the environment's connection policy blocked live browser inspection.

## Residual Risk

- Calibration has not been exercised with an older participant, varied mobility, low light or a real webcam in this audit.
- A hybrid link is deliberately a bearer link. The fragment avoids server/referrer disclosure but is not encryption; anyone receiving the full URL can read the embedded message.
- ElevenLabs playback and browser speech behaviour still depend on browser autoplay and voice support.
- Safe diagnostics are emitted to the runtime console, but no telemetry backend, alerting or retention policy is configured in this repository.
- There is no deployment-level rate limit, so same-origin checks do not prevent high-volume direct requests.

## Follow-up

1. Run the four repaired paths in a real browser: delayed camera startup, Supabase outage after link creation, rapid narration replacement and malformed API input.
2. Add browser regression tests for hybrid-link fallback, clipboard failure and narration cancellation.
3. Test calibration with representative users before treating the comfort-range behaviour as validated.
4. Configure platform rate limiting and aggregate request-ID diagnostics without logging message content.
