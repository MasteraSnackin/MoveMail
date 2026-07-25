# Error Handling Summary

## Scope

This report covers the plan, postcard and voice APIs; client-side creation and postcard loading; LLM, Supabase and ElevenLabs dependencies; narration; camera fallback; and privacy-safe diagnostics.

## Stable API contract

JSON errors use one shape:

```json
{
  "ok": false,
  "error": {
    "code": "STORAGE_UNAVAILABLE",
    "message": "Postcard storage is temporarily unavailable.",
    "details": {},
    "requestId": "..."
  }
}
```

`details` is optional. Codes are stable and machine-readable; messages are safe for users. Current codes are:

- `INVALID_JSON`
- `INVALID_REQUEST`
- `CROSS_SITE_REQUEST`
- `POSTCARD_NOT_FOUND`
- `STORAGE_UNAVAILABLE`

Successful JSON responses include the original payload plus `ok: true` and `requestId`. Every API response is marked `no-store` and exposes the same request ID in `X-Request-Id`. Binary ElevenLabs success and empty voice fallback responses use headers rather than a JSON body.

## Validation and request boundaries

- JSON parsing and field validation happen before provider work.
- Plan input has type and length limits.
- Stored postcard input is revalidated, including theme, provider, exactly three distinct allow-listed movements and text lengths.
- Voice input must be a string of 1–450 characters; objects and numbers are rejected.
- Postcard identifiers must be UUIDs.
- Requests identified as cross-site by `Sec-Fetch-Site` or a conflicting `Origin` receive `403 CROSS_SITE_REQUEST`.
- The model receives sender text as explicitly untrusted creative context, and its output is validated before use.

## Timeouts

| Operation | Timeout | Recovery |
| --- | ---: | --- |
| Browser plan request | 9,500 ms | Continue with the built-in plan |
| OpenAI request | 4,500 ms | Try Anthropic in auto mode, then built-in plan |
| Anthropic request | 4,500 ms | Use built-in plan |
| Browser postcard write/load | 5,500 ms | Keep or open the embedded copy |
| Supabase write/load | 5,000 ms | Encoded-link success for writes; `503` for ID-only reads |
| Browser voice request | 6,500 ms | Use browser speech and visible text |
| ElevenLabs request | 5,500 ms | Return explicit `204` browser fallback |
| Pose-worker initialisation | 15,000 ms | Use on-screen controls |

The two LLM attempts are sequential and fit inside the browser's overall plan-request budget under normal abort behaviour.

## Fallbacks and retry policy

| Capability | Preferred path | Fallback |
| --- | --- | --- |
| Story plan | OpenAI, then Anthropic in auto mode | Deterministic validated plan |
| Voice | ElevenLabs audio | Browser speech; written cues remain visible |
| Storage | Supabase identifier | Embedded URL-fragment postcard |
| Stored-card retrieval | Supabase record | Embedded copy carried by the hybrid link |
| Movement input | Local MediaPipe pose tracking | Keyboard and on-screen controls |

No dependency call is automatically retried. This avoids retry storms and avoids duplicating the non-idempotent Supabase insert. The LLM sequence is provider failover, not a retry of the same request.

## UI failure handling

- The creation form combines native required/minimum-length constraints with a visible status message.
- A synchronous in-flight guard and disabled submit control prevent duplicate postcard creation.
- Creation and stored-card retrieval have separate polite loading states.
- AI and storage timeouts keep the valid local plan/link rather than trapping the user.
- A damaged link reports a specific recovery message.
- Clipboard failure focuses and selects the share field and displays manual-copy instructions.
- Camera calibration waits for tracking and offers an immediate on-screen alternative.
- Narration cancellation covers pending requests, delayed starts, active audio, object URLs and browser speech.
- Changing screens moves focus to the current heading.

## Provider and user visibility

- The ready and reveal screens identify whether the story was OpenAI-assisted, Claude-assisted or the built-in demo.
- Dependency details are not exposed in user-facing errors.
- The sender is told that a live story may send the message to OpenAI or Anthropic.
- A voice failure is intentionally quiet because browser speech and the written cue provide immediate recovery.

## Privacy-safe diagnostics

Dependency diagnostics contain only:

```json
{
  "requestId": "...",
  "provider": "supabase",
  "category": "timeout",
  "status": "unavailable"
}
```

They do not include API keys, request headers, names, messages, generated text, audio or camera data. One request ID correlates the safe client response, response header and server diagnostic.

Camera frames and pose landmarks remain in the browser. Embedded postcard data is placed in the URL fragment and the site uses a `no-referrer` policy, reducing accidental server and referrer disclosure. This is not encryption: the whole link remains a bearer credential and the UI warns against sensitive content.

## Verification

- API integration tests cover malformed JSON, wrong voice types, cross-site rejection, request IDs, no-key fallbacks, genuine not-found records, Supabase upstream errors and Supabase timeouts.
- AI tests cover deterministic fallback and provider failover.
- Game-engine tests cover low-confidence input and movement completion behaviour.
- `npm test` passed after the Vinext build with 38 tests and no failures.
- `npm run lint`, `npx tsc --noEmit` and `npx next build` passed.
- `npm audit --omit=dev --json` reported no production dependency vulnerabilities. The full development audit still reports nine high-severity findings in the ESLint/minimatch/brace-expansion dependency graph.

## Residual risks

- **No platform rate limiting:** the repository does not enforce per-IP, per-session or quota-based limits for sponsor-backed routes. Same-origin filtering is not a substitute.
- **No operational telemetry:** diagnostics currently go to the runtime console. There are no dashboards, fallback-rate metrics, latency traces, alerts or documented log retention.
- **No circuit breaker:** repeated provider failures continue to receive one bounded attempt per eligible provider.
- **Browser behaviour remains unverified:** the connection policy blocked end-to-end visual and interaction testing, including real camera and audio.
- **Third-party data handling:** provider retention, regional processing and account-level settings are deployment concerns not established by this code.
- **Report-only CSP:** the content security policy records potential violations but does not yet block them.
