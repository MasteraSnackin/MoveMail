# MoveMail QA report

## Release summary

**Test date:** 26 July 2026  
**Build:** Local browser MVP
**Local address:** `http://localhost:8080`

The MoveMail source passes static packaging, the syntax check and 28 automated
tests.
The automated suite covers the postcard record, 59,999/60,000 ms unlock
boundary, pause-time exclusion, accessible screen structure, body movement
rules, hand-shape rules, camera-cleanup structure, typed error recovery,
storage limits and local model packaging.

The existing local server returns the renamed MoveMail page and the new
postcard and timer modules. This release was not operated through a new visual
browser test, so the previous screenshots are retained only as evidence for
the underlying garden game, not the new postcard screens.

## Automated results

| Area | Result | Evidence |
| --- | --- | --- |
| Static packaging | Pass | The source application and all local runtime/model assets were synchronised into `public/`. |
| Source syntax | Pass | Node checked 17 application, test and build-script files. |
| Combined Node suite | Pass | 28/28 tests passed. |
| MoveMail structure | Pass | Welcome, compose, prepared, postcard, mode, safety, setup, game, results and early-stop screens are present. |
| Postcard record | Pass | Explicit sanitisation, save, load and delete tests passed. |
| One-minute boundary | Pass | The clock remains locked at 59,999 ms and completes at 60,000 ms. |
| Pause exclusion | Pass | Multiple paused intervals do not add to active time. |
| Background exclusion | Pass by implementation review | A hidden tab invokes the same pause path and requires manual resume. |
| Recognition independence | Pass by implementation review | The session clock, not challenge score or count, calls the completion path. |
| Message concealment | Pass by source/structure review | The reveal block is empty in static HTML, the general Create route starts blank and message text reaches the recipient view only through `revealPostcard`. |
| Accessible open | Pass by structure review | The sealed postcard offers a direct non-movement route and hides fabricated session results when no game was played. |
| Private read-aloud | Pass | Personal-message speech accepts a browser-confirmed local voice and fails closed when only a remote voice is available. |
| Navigation race guard | Pass by source and regression review | Camera/session continuations carry a generation token, and Home, back-navigation and page lifecycle changes invalidate stale continuations before they can reopen a screen or reveal a message. |
| Camera cleanup | Pass by source/static review | Cleanup paths call track stopping, detach video elements and await cleanup before reveal. A live `MediaStreamTrack` end-state check remains outstanding. |
| Body movement logic | Pass | Existing body-relative detector fixtures passed. |
| Finger movement logic | Pass | 13 hand detector and stability checks passed, including real Hand Landmarker placeholder visibility. |
| Local model assets | Pass | Pose and hand task files, MediaPipe bundle and WASM assets are packaged. |
| Session storage | Pass | The restricted five-field record accepts all four modes. |
| Local serving | Pass | The running Python server returned MoveMail HTML and the new modules with HTTP 200. |

## Privacy review

Passed by implementation and automated source checks:

- no camera or landmark upload path;
- no microphone request;
- local pose and hand models;
- postcard data restricted to one explicit local record;
- personal message absent from the locked recipient HTML;
- composer fields cleared after preparation;
- blank Create route after handover, with confirmation before replacement;
- opt-in, not automatic, message read-aloud restricted to browser-confirmed
  local voices;
- camera cleanup ordering before message insertion, by source review;
- local postcard deletion; and
- no claim that the local MVP sends to another device.

The postcard is plain browser storage and is not encrypted. The interface and
privacy document state this local/same-device boundary.

## Accessibility and safety review

Present in implementation:

- native labelled form controls;
- large buttons and visible focus;
- focus movement to every screen and the revealed message;
- keyboard-operable navigation;
- safety acknowledgements before play;
- seated, standing, finger and camera-free options;
- 30-second and 10-second announcements;
- unlimited pause with excluded time;
- no accuracy gate;
- safe early stop; and
- an explicit access route that does not require starting or continuing
  movement.

## Current unknowns

- The new MoveMail composer, sealed postcard, early-stop and reveal layouts
  have not yet received a fresh browser visual pass.
- A complete 60-second end-to-end browser run has not been timed externally.
- Live camera-track end states and the browser camera indicator have not been
  checked for this release.
- Live seated and standing recognition has not been validated with an intended
  older-adult participant.
- Live Finger Play has not been validated with an intended older-adult
  participant after the latest hand-point fix.
- Chrome, Edge and Safari have not been tested independently for this release.
- The application adapts recognition to mode and body/hand proportions; it does
  not calibrate a person’s individual comfortable reach.
- The local MVP does not deliver a postcard to another device.

## Recommended next validation

1. Complete the same-device sender-to-recipient journey at desktop and mobile
   widths.
2. Time Camera-free, Seated, Standing and Finger sessions through the 60-second
   boundary, including pause and hidden-tab cases.
3. Confirm with a screen reader that no message is announced before reveal and
   that focus reaches the opened message.
4. Exercise deletion and storage-denial behaviour.
5. Run supervised, representative comfort and comprehension testing.
6. Design access control and retention before any remote-delivery work.
