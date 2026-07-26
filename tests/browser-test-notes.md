# Browser test notes

## Purpose and evidence rule

This is the browser test run sheet for MoveMail. It defines the required
manual coverage and provides space for actual results. An unchecked case is
**not tested**, not passed. Camera-free Play does not substitute for a real-camera
test.

Release outcomes and known limitations belong in `docs/QA_REPORT.md`. Screenshot
evidence belongs in `docs/screenshots/`.

## Build record

| Field | Result |
| --- | --- |
| Test date and tester | |
| Build identifier / commit | |
| ZIP filename and checksum | |
| Launch method | |
| Host URL | `http://localhost:8080` |
| Device and webcam | |
| Operating system | |
| Browser and exact version | |
| Display size / browser zoom | |
| Network state | |
| Voice provider and test account | Device / ElevenLabs / Not tested |
| Real camera available? | Yes / No |
| Notes | |

## Target matrix

Run the complete Camera-free Play journey in each available target browser. Run
live camera setup and at least one full session on every device/browser
combination that will be claimed as camera-tested.

| Platform | Browser | Camera-free journey | Live seated | Live standing | Live Finger Play | Responsive / visual | Result and evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| macOS | Current Chrome | | | | | | |
| macOS | Current Safari | | | | | | |
| Windows | Current Edge | | | | | | |
| Windows | Current Chrome | | | | | | |
| Linux | Current Chrome or Chromium | | | | | | |
| Tablet landscape, if available | Current supported browser | | | | | | |
| Narrow/mobile viewport | Current supported browser | | Not primary | Not primary | | | |

Record unavailable environments as **not tested**. Do not infer Safari results
from Chrome, or camera results from Camera-free Play.

## Preconditions

- Serve the extracted project at `http://localhost:8080`; do not open the HTML
  file directly.
- Start with camera permission set to **Ask**.
- Close video-call applications and unrelated camera tabs.
- Record whether local session history is empty.
- When testing ElevenLabs, use a restricted test key and a non-sensitive
  postcard; never paste the key into the browser or developer console.
- Keep browser developer tools open for console and network checks where this
  does not change layout.
- Test once with an internet connection and once offline after the local server
  has started.
- Use a clear area and the safety procedure for any real movement.

## Result codes

- **Pass:** actual behaviour matches every expected result.
- **Fail:** actual behaviour differs; add reproducible detail.
- **Blocked:** environment or dependency prevents execution.
- **Not tested:** not run.

For every failure record browser, viewport, exact step, expected result, actual
result, console message, screenshot and whether the issue is repeatable.

## Core journey

Unless a case explicitly tests postcard creation, prepare a short,
non-sensitive local test postcard first. Movement cases begin from its sealed
recipient view: choose **Unlock with movement**, then select the stated mode.

### B01 — Local launch and welcome

Steps:

1. Start the correct launch script for the operating system.
2. Open `http://localhost:8080`.
3. Wait for the welcome screen without interacting.

Expected:

- No blank screen or uncaught console error.
- Title, description, **Open a postcard**, **Create a postcard**,
  **How it works**, the local-postcard explanation and sound toggle are visible.
- The first primary controls fit at normal laptop size without horizontal
  scrolling.
- The browser has not requested camera permission.

Result:
Evidence / notes:

### B02 — How it works and sound preference

Steps:

1. Open and close **How it works**.
2. Toggle sound off, change screen and return home.
3. Toggle sound on.

Expected:

- Explanation is readable and dismissible by pointer and keyboard.
- Focus returns to a logical control.
- The visible sound state remains consistent.
- Muting prevents speech and generated tones without changing game flow.

Result:  
Evidence / notes:

### B02A — Create, seal and hand over a postcard

Steps:

1. Choose **Create a postcard**.
2. Enter a non-sensitive recipient, sender and short message.
3. Prepare the postcard.
4. Check the prepared screen, then choose **Open recipient view**.

Expected:

- The composer states that this is same-device storage, not sending.
- The prepared and recipient views show recipient and sender but do not render
  the message.
- The general **Create a postcard** route is blank after handover.
- The sealed view offers **Unlock with movement** and **Open without
  movement**.

Result:
Evidence / notes:

### B02B — Voice settings and connection

Steps:

1. Open **Voice settings** with no `.env.local` key configured.
2. Confirm the unavailable state, then stop the server.
3. Configure a restricted test key in `.env.local`, restart and reopen
   **Voice settings**.
4. Check the connection, choose a voice, test it and save.
5. Turn Sound Off and try the voice test again.

Expected:

- Device voice is selected initially and the game remains usable without a key.
- The page has no API-key field and browser storage contains no key.
- With a valid key, the connection state and curated voice list load without
  exposing a raw voice ID or account response.
- Voice testing is deliberate and uses only the fixed sample sentence.
- Sound Off causes no speech request.
- Leaving Settings stops pending or active test audio.

Result:
Evidence / notes:

### B02C — Online postcard read-aloud consent

Steps:

1. With ElevenLabs selected, leave online postcard reading off and reveal a
   non-sensitive test postcard.
2. Use read-aloud and inspect the network panel.
3. Return to Voice settings, permit online reading for the current postcard,
   save and reveal it again.
4. Choose **Read with ElevenLabs**, then cancel the confirmation.
5. Repeat and choose **Use device voice**.
6. Repeat and choose **Send and read**.
7. Return Home while a deliberately delayed speech request is pending.

Expected:

- Reveal never sends the message automatically.
- With online reading off, the message uses only a browser-confirmed local
  voice; no ElevenLabs speech request contains the message.
- Cancel and Use device voice send no personal text.
- Send and read transmits only the message text, selected voice alias, purpose
  and consent—not names, postcard ID, camera data or results.
- The privacy warning states that ElevenLabs may retain the text and audio.
- Return Home aborts the pending request and no stale audio plays later.

Result:
Evidence / notes:

### B03 — Safety gate

Steps:

1. From the sealed postcard, choose **Unlock with movement**, then
   **Camera-free Play**.
2. Try to continue without confirmations.
3. Select only one confirmation, then both.
4. Use **Back**, enter again and complete the gate.

Expected:

- Continue is unavailable until both confirmations are selected.
- Safety copy covers clear space, stable support, comfortable pace and stopping
  for pain, dizziness, discomfort or instability.
- Back returns to mode selection.
- No camera permission is requested.

Result:  
Evidence / notes:

### B04 — Complete Camera-free Play journey

Steps:

1. From the sealed postcard, unlock with movement, choose Camera-free Play and
   complete safety.
2. Start the session.
3. Allow the 60-second active-time session to finish.
4. Review results.
5. Return home.

Expected:

- A persistent **Camera-free Play** label is visible.
- No browser camera prompt or camera-use indicator appears.
- Record the mini-games and prompts reached; do not expect all 10 prompt
  definitions in one minute.
- Demonstrations, instructions, progress, stars, sound, pause and end controls
  remain visible and usable.
- Success is simulated automatically with relaxed timing.
- There is no failure language or failure screen.
- Results show the actual stars, completed movements, duration, Camera-free
  mode, **Move again** and **Return Home**.
- Return Home restores a clean welcome state.

Result:  
Evidence / notes:

### B05 — Pause and resume

Steps:

1. Start Camera-free Play.
2. Pause during a challenge.
3. Leave the screen untouched for at least five seconds.
4. Resume.

Expected:

- Challenge progress and auto-success do not advance while paused.
- Resume, Restart, End Session and Return Home are present.
- Resume continues the same challenge without duplicate completion or lost
  score.
- Keyboard focus enters and leaves pause in a logical place.

Result:  
Evidence / notes:

### B06 — Restart

Steps:

1. Complete at least two Camera-free Play challenges.
2. Pause and choose Restart.
3. Confirm the restarted state.

Expected:

- Progress returns to challenge 1, score to zero and elapsed session time to a
  new run.
- Only one game timer remains active.
- Camera-free label and chosen sound state remain correct.

Result:  
Evidence / notes:

### B07 — Early finish

Steps:

1. Start Camera-free Play with a still-locked test postcard.
2. Complete at least one challenge.
3. Choose End Session.
4. Confirm if the interface asks for confirmation.

Expected:

- The session stops cleanly.
- The waiting screen states that the message remains sealed.
- **Try the minute again**, **Stop moving and read message** and **Return
  home** work.
- No background timer adds later stars.

Result:  
Evidence / notes:

## Camera permission and setup

### B08 — Permission is requested at the correct time

Steps:

1. Reset camera permission to **Ask** and reload.
2. Browse Welcome and **How it works**, then open the sealed test postcard.
3. Choose **Unlock with movement** and select Standing, Seated or Finger Play.
4. Use Back from safety.
5. Enter again, acknowledge safety and deliberately continue to setup.

Expected:

- No prompt occurs on page load, welcome, **How it works**, sealed postcard,
  mode selection alone or
  returning from safety.
- A plain privacy explanation is visible before the browser prompt.
- Permission is requested only after deliberate continuation.
- Camera state remains obvious.

Result:  
Evidence / notes:

### B09 — Camera permission denied

Steps:

1. Reset permission to **Ask**.
2. Enter a camera mode and deny the browser prompt.
3. Try the available recovery actions.

Expected:

- A calm “could not start the camera” message replaces indefinite loading.
- The message explains how to check permission or retry.
- **Use Camera-free Play** works without another camera prompt.
- No gameplay control is left in a false camera-ready state.

Result:  
Evidence / notes:

### B10 — No camera or camera already in use

Steps:

1. Run on a device without a camera, disable the camera, or occupy it with a
   controlled test application.
2. Enter a camera mode.

Expected:

- No blank or frozen setup screen.
- The message suggests checking whether another application is using the
  camera.
- Retry works after the conflict is removed.
- Camera-free Play remains available.

Result:  
Evidence / notes:

### B11 — Seated calibration

Steps:

1. Allow camera access and choose Seated Play.
2. Begin out of frame, then move into a comfortable seated frame.
3. Start when ready.

Expected:

- Guidance prioritises head, shoulders, elbows, wrists and torso.
- It does not require legs or standing.
- Messages change calmly as landmarks become available.
- Start Session becomes available once tracking is ready; calibration guidance
  remains advisory and never requires a raised-hand pose.
- The mirrored image and overlay align sufficiently for guidance.

Result:  
Evidence / notes:

### B12 — Standing calibration

Steps:

1. Allow camera access and choose Standing Play.
2. Begin too close, then safely adjust the device or distance.
3. Start when ready.

Expected:

- Guidance prioritises head, shoulders and hips, with part of the legs when
  safely possible.
- It never instructs the player to step backwards blindly.
- Start Session becomes available once tracking is ready; calibration guidance
  remains advisory.
- The player can choose **Use Camera-free Play** without losing control.

Result:  
Evidence / notes:

### B13 — Tracking loss and recovery

Steps:

1. Start a live-camera session.
2. Move safely out of frame or cover the camera briefly.
3. Return to the accepted frame.

Expected:

- No score penalty or failure wording.
- A calm message such as “Move gently back into view” appears.
- Challenge state is preserved.
- Recognition resumes without restarting the whole session.

Result:  
Evidence / notes:

### B14 — Body or hand model unavailable

Steps:

1. Use developer tools to block the local task-model request, or test a
  controlled copy with the model file unavailable.
2. Enter a body camera mode, then repeat with Finger Play.
3. Remove the block and try retry, if offered.

Expected:

- Loading progress ends in a clear error rather than an indefinite spinner.
- The message identifies body or finger tracking as unavailable.
- Camera-free Play remains usable.
- No remote model fallback or camera upload is attempted.

Result:  
Evidence / notes:

### B15 — Camera shutdown

For a real camera session, test each exit separately:

1. Cancel camera setup.
2. Switch from setup to Camera-free Play.
3. End gameplay early.
4. Complete the 60-second active-time session.
5. Return Home from pause.
6. Reload or close the tab.

Expected:

- All application-owned `MediaStreamTrack` objects reach `ended`.
- The browser camera-use indicator turns off when no other application is using
  the device.
- Re-entering a camera mode creates a fresh, controllable stream.

Result:  
Evidence / notes:

## Movement and scoring

### B16 — Live seated movements

Run the full seated session. For each challenge record an observer-labelled
comfortable attempt separately from system recognition.

| Movement | Attempted comfortably | Recognised | False early trigger | Hold feels reasonable | Notes |
| --- | --- | --- | --- | --- | --- |
| Left hand raised | | | | | |
| Right hand raised | | | | | |
| Arms open | | | | | |
| Left reach | | | | | |
| Right reach | | | | | |
| Both hands raised | | | | | |
| Gentle left lean | | | | | |
| Gentle right lean | | | | | |
| Slow arm opening | | | | | |
| Celebration pose | | | | | |

Expected:

- All targets are reachable using upper-body movement.
- A match requires a stable brief hold rather than a single-frame flicker.
- Timing is generous and extra guidance remains positive.
- Timeout awards participation-positive completion, not a failure.

Result:  
Evidence / notes:

### B17 — Live standing movements

Repeat B16 using Standing Play with a willing tester and a safe clear area.

Expected:

- The mode uses standing tolerances without requiring impact, deep bending,
  stepping, one-leg balance or fast direction changes.
- Broad upper-body attempts are recognised across reasonable camera distance.
- No prompt asks for a larger range after the player indicates discomfort.

Result:  
Evidence / notes:

### B18 — Score boundaries

Steps:

1. Exercise prompt recognition at quick, guided and timeout timing.
2. Complete and end sessions at different progress points.

Expected:

- Per-challenge score is 1–3.
- Total score remains 0–30.
- Completed movements remains 0–10.
- No challenge completes twice.
- Results match the visible in-game totals.

Result:  
Evidence / notes:

## Accessibility and responsive presentation

### B19 — Keyboard

Steps:

1. Complete welcome, sealed postcard, mode selection, safety, Camera-free
   start, pause, resume, end and home using Tab, Shift+Tab, Space and Enter.
2. Use Escape only where documented by the interface.

Expected:

- Every essential control is reachable and activated.
- Focus order follows the visual order.
- Focus is always visible and never trapped behind an overlay.
- Screen changes place focus at a useful heading or primary action.

Result:  
Evidence / notes:

### B20 — Screen-reader smoke test

Steps:

1. Use VoiceOver, Narrator or another available screen reader.
2. Navigate welcome, sealed postcard, mode selection, safety, one gameplay
   challenge, pause and results.

Expected:

- One clear page/screen heading is announced.
- Controls have meaningful names and states.
- Safety confirmations have associated labels.
- Progress and important status feedback are available without rapid,
  repetitive announcements.
- Decorative garden art is ignored or described appropriately.

Result:  
Evidence / notes:

### B21 — Reduced motion

Steps:

1. Enable the operating system/browser reduced-motion preference.
2. Reload and complete several Camera-free Play challenges.

Expected:

- Non-essential floating, pulsing and transition motion is removed or reduced.
- Movement demonstration meaning remains available.
- No essential state depends solely on animation.

Result:  
Evidence / notes:

### B22 — Zoom and viewport

Check at minimum:

- 1440 × 900 and 1280 × 720 laptop viewports;
- 1024 × 768 tablet landscape;
- 200% browser zoom at a laptop viewport; and
- a 390 × 844 narrow/mobile viewport.

Expected:

- No overlapping or clipped essential text.
- No horizontal page scrolling at target sizes.
- Buttons remain large and labels do not disappear.
- Controls stack vertically where needed.
- Camera/preview is not reduced to an unusably tiny box.
- Gameplay pause, sound and end controls remain visible or readily reachable.

Result:  
Evidence / notes:

### B23 — Sound unavailable

Steps:

1. Test sound off.
2. Test with speech synthesis unavailable or disabled.
3. Test generated audio after a browser-required user gesture.

Expected:

- Every instruction and result remains understandable visually.
- A speech failure does not block progression or flood the console.
- The sound toggle accurately represents the state.

Result:  
Evidence / notes:

## Persistence and privacy

### B24 — Session summary storage

Steps:

1. Complete body-camera, Finger Play and preview sessions.
2. Inspect `localStorage["moveMail.sessions.v1"]`.
3. Create more than 10 controlled sessions.
4. Disable or make local storage unavailable, then play again.

Expected:

- Records are newest-first and capped at 10.
- Each record contains exactly `date`, `mode`, `sessionDuration`,
  `completedMovements` and `score`.
- The mode field accepts `standing`, `seated`, `fingers` or `preview`.
- Values stay within documented types and ranges.
- No image, video, landmark, name or other identifier is stored.
- Storage failure does not stop gameplay.

Result:  
Evidence / notes:

### B25 — Clear data

Steps:

1. Save at least one session.
2. Clear site data for `localhost` using the browser instructions in
   `docs/PRIVACY.md`.
3. Reload.

Expected:

- The history key is absent.
- The welcome screen and game remain usable.
- Camera permission follows the browser’s own site-data/permission behaviour.

Result:  
Evidence / notes:

### B26 — Network privacy

Steps:

1. Clear the network log and preserve it across navigation.
2. Complete camera setup and several live challenges.
3. End and return home.
4. Repeat with the computer offline while the local server remains running.

Expected:

- MediaPipe bundle, both task models and WebAssembly files load from
  `localhost:8080`.
- No frame, image, video, landmark or session-summary upload occurs.
- No analytics, advertising or remote pose request occurs.
- The app remains usable offline.

Result:  
Evidence / notes:

## Error-state and visual review

### B27 — No blank states

Exercise camera denied, no camera, camera in use, model unavailable, tracking
lost, speech unavailable and storage unavailable.

Expected:

- Every wait has a visible status.
- Every recoverable error offers a clear next action.
- Camera-free Play remains available where camera/tracking cannot work.
- No error uses blame, failure or technical jargon as the main message.

Result:  
Evidence / notes:

### B28 — Visual consistency

Review Welcome, Safety, Setup, Gameplay, Pause and Results in the target matrix.

Expected:

- Warm garden-postcard style is consistent and not clinical or childish.
- Text contrast remains readable.
- Cards, controls and feedback do not overlap.
- The current mode, camera status, instruction, progress and exit are clear.
- Icons do not replace essential text.
- No remote image fails offline.

Result:  
Evidence / notes:

### B29 — Complete live Finger Play journey

Steps:

1. Choose Finger Play and complete the safety checks.
2. Turn on the camera and begin with no hand visible.
3. Bring either relaxed hand fully into the guide, then start.
4. Attempt each prompt that appears during the minute, resting the hand between
   shapes.
5. Briefly move the hand out of view and return.
6. Finish the session and inspect the result.

Record comfortable attempts separately from recognition:

| Hand shape | Attempted comfortably | Recognised | False early trigger | Hold feels reasonable | Notes |
| --- | --- | --- | --- | --- | --- |
| Closed fist | | | | | |
| Open hand | | | | | |
| Finger spread | | | | | |
| Index point | | | | | |
| Gentle pinch | | | | | |
| Thumbs-up | | | | | |
| Victory fingers | | | | | |

Expected:

- The app tracks one hand and does not require a particular side.
- The set-up guide asks for one centred, comfortably sized hand; starting is
  not blocked by making a specific shape.
- Record the hand prompts and mini-games reached; the data set contains 10
  prompts, but one minute may show only a subset.
- Hand demonstrations remain clear without sound or animation.
- A brief stable hold is required; a single-frame flicker does not score.
- Missing-hand feedback is calm and the same challenge resumes on return.
- Completion stores `mode: "fingers"` and shows **Finger** as the result mode.
- Camera shutdown and generic Camera-free Play fallback behave as documented.

Result:
Evidence / notes:

## Required screenshots

Capture at a representative laptop viewport without personal camera imagery.
Use Camera-free Play or a synthetic/covered setup visual where needed.

| Screen | Suggested filename | Browser / viewport | Captured? | Notes |
| --- | --- | --- | --- | --- |
| Welcome | `welcome.png` | | | |
| Composer | `composer.png` | | | |
| Prepared handover | `prepared.png` | | | |
| Sealed postcard | `sealed-postcard.png` | | | |
| Safety | `safety.png` | | | |
| Camera or simulated setup | `camera-setup.png` | | | |
| Finger Play setup | `finger-setup.png` | | | |
| Finger Play challenge | `finger-gameplay.png` | | | |
| Gameplay | `gameplay.png` | | | |
| Pause | `pause.png` | | | |
| Early-stop waiting | `waiting.png` | | | |
| Results | `results.png` | | | |

Do not include a participant’s live camera image in documentation screenshots
without a separate, explicit and justified consent process.

## Final run summary

| Area | Passed | Failed | Blocked | Not tested | Evidence / issue references |
| --- | ---: | ---: | ---: | ---: | --- |
| Launch, postcard handover and core Camera-free journey | | | | | |
| Camera permission and setup | | | | | |
| Live movement and scoring | | | | | |
| Live Finger Play | | | | | |
| Pause, restart, early-stop waiting and results | | | | | |
| Accessibility and responsive layout | | | | | |
| Error recovery | | | | | |
| Storage and privacy | | | | | |
| Camera shutdown | | | | | |

### Honest test boundary

State explicitly:

- which browser versions were run;
- whether a physical webcam was used;
- whether seated and standing recognition used a real person;
- whether Finger Play model loading and hand-shape recognition used a real
  browser and hand;
- whether permission-denied, no-camera and model-unavailable states were
  induced;
- which viewport and assistive-technology checks were completed; and
- any test that remains manual, blocked or not run.

Do not claim “camera tested” from a simulated feed, Camera-free Play or code review
alone.
