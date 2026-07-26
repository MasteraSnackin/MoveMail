# MoveMail privacy explanation

## Plain-language summary

MoveMail is a local movement-postcard MVP. A family member can enter a
recipient name, sender name and personal message. The postcard stays in that
browser for a same-device handover; this build does not email, text, remotely
deliver, synchronise or store a cloud copy of it. Optional online read-aloud is
a separate speech request described below.

Standing Play, Seated Play and Finger Play use the camera only after the player
passes the safety screen and deliberately selects **Turn On Camera**. Camera
images are processed in the browser and are never uploaded, recorded or
stored. Camera-free Play never requests camera permission.

MoveMail itself has no account, advertising, analytics or cloud database.
Optional ElevenLabs speech uses the account associated with the API key and
requires an internet connection. Device speech remains the default. This
description applies to the supplied build at `http://localhost:8080`. Any
separately hosted or modified version requires a new privacy review.

## Postcard data

MoveMail stores at most one postcard in browser `localStorage`, under:

```text
moveMail.postcard.v1
```

The record contains only:

| Field | Meaning |
| --- | --- |
| `id` | A locally generated postcard identifier |
| `recipient` | Recipient name entered by the family member |
| `sender` | Sender name entered by the family member |
| `message` | Personal message, limited to 280 characters |
| `createdAt` | Creation date and time |
| `unlocked` | Whether the postcard has been opened |
| `isSample` | Whether the built-in sample is in use |

The postcard is not encrypted. Anyone with access to the same device and
browser profile may be able to inspect it. Do not use this local prototype for
highly sensitive information or on a shared device without deleting the
postcard afterwards.

The **Delete this postcard** control attempts to remove this record and warns
if browser storage cannot confirm deletion. Clearing site data for `localhost`
removes it.

## Camera processing

1. The recipient chooses Standing, Seated or Finger Play.
2. MoveMail shows safety and privacy guidance.
3. The recipient selects **Turn On Camera**.
4. The browser displays its own camera-permission prompt.
5. If allowed, the page receives a live stream.
6. Standing and Seated Play use the local MediaPipe Pose Landmarker.
7. Finger Play uses the local MediaPipe Hand Landmarker for one hand.
8. Application rules use temporary landmarks to recognise broad movements or
   hand shapes.

The MediaPipe JavaScript, models and WebAssembly runtime are packaged locally:

- `js/vendor/vision_bundle.mjs`
- `assets/models/pose_landmarker_lite.task`
- `assets/models/hand_landmarker.task`
- `assets/models/wasm/`

The app does not persist webcam frames, body landmarks, hand landmarks, world
landmarks, handedness or recognised-shape history. It does not use facial
recognition, identify the player or request microphone access.

## When the camera stops

Camera tracks stop when:

- camera set-up is abandoned;
- the player changes to Camera-free Play;
- tracking fails and the game changes to camera-free continuation;
- the session ends;
- the player returns home; or
- the page closes or reloads.

Pausing keeps the camera stream available for an immediate resume. The
browser’s camera indicator remains visible. **End Session** and **Return Home**
stop the stream.

The personal message is rendered in the recipient view only after the
60-second unlock or the deliberate **Open without movement** action. That
action is available from the sealed postcard so camera or movement difficulty
cannot block a family message. The message is not placed behind a visual blur
while locked.

## Speech and personal messages

Spoken guidance is optional. Generic game instructions use the browser’s
speech-synthesis feature; depending on the browser and installed voices, the
browser vendor may process that generic text through its own speech service.

The Voice settings page can instead use ElevenLabs:

- the API key is read by the loopback-only Node server from
  `ELEVENLABS_API_KEY` or `.env.local`;
- the key is not returned to the page or stored in `localStorage`;
- game-guidance text is sent to ElevenLabs only when that provider is selected;
- online personal-message reading is off by default and its permission is tied
  to the current postcard;
- choosing **Read with ElevenLabs** opens a second confirmation before any
  message text is sent; and
- the speech request contains the message text only, not recipient, sender,
  postcard identifier, camera data or session results.

The returned audio is held only for playback, is not cached by MoveMail and its
temporary browser object URL is revoked when playback ends or is stopped.
ElevenLabs may retain submitted text and generated audio under the connected
account’s settings. ElevenLabs documents that API logging is enabled by default
and that zero-retention mode is limited to eligible Enterprise accounts:
<https://elevenlabs.io/docs/eleven-api/resources/zero-retention-mode>.

If online personal-message reading is not enabled, **Read message aloud** uses
only an English voice that the browser marks with `localService: true`. It
fails closed when no such voice exists. An ElevenLabs failure may fall back
only to this local-device route. The application does not request microphone
access or create a voice recording.

Voice preferences are stored under:

```text
moveMail.voice.v1
```

That record contains only provider, server-generated voice alias and label,
plus the current postcard identifier when online reading has been permitted.
It contains no API key, message text or generated audio.

## Session history

The browser keeps at most the 10 newest session summaries under:

```text
moveMail.sessions.v1
```

Each summary contains only:

```text
date, mode, sessionDuration, completedMovements, score
```

`mode` is `standing`, `seated`, `fingers` or `preview`. The application can
read the previous `moveAndSmile.sessions.v1` key as a migration aid, but new
records use the MoveMail key.

The session summary contains no name or message. Storage failure does not
prevent the game from running.

## What is not stored or transmitted

MoveMail does not store or transmit:

- webcam video, frames, still images or screenshots;
- body, face, pose or hand landmarks;
- world coordinates or handedness labels;
- microphone or voice recordings;
- health conditions, diagnoses or medical notes;
- exact location, advertising identifiers or biometric templates; or
- a cloud copy of the postcard or session history.

Camera images, landmarks, names and session results are never sent to
ElevenLabs. Personal postcard text is an exception to the list above only
after the two deliberate online read-aloud confirmations described in
**Speech and personal messages**.

Browser software may perform its own updates, safe-browsing checks or telemetry
according to the browser vendor’s settings. Those activities are outside the
MoveMail application.

## Clear local data

Use **Delete this postcard** to remove the postcard only. If MoveMail warns
that deletion could not be confirmed, clear site data instead.

To remove the postcard, session history and voice preferences, clear site data
for `localhost` in the browser’s site or privacy settings. A developer can
also run:

```js
localStorage.removeItem("moveMail.postcard.v1");
localStorage.removeItem("moveMail.sessions.v1");
localStorage.removeItem("moveMail.voice.v1");
localStorage.removeItem("moveAndSmile.sessions.v1");
```

Cleared data cannot be recovered by MoveMail.

## Revoke camera permission

Open the browser’s site settings for `http://localhost:8080`, then change
**Camera** to **Block** or **Ask** and reload. The operating system may also
control camera access:

- **macOS:** **System Settings > Privacy & Security > Camera**
- **Windows:** **Settings > Privacy & security > Camera**
- **Linux:** review the browser package or sandbox camera permission

Camera-free Play remains available when permission is denied.

## Release verification

- [ ] Camera permission follows an explicit camera-mode and safety choice.
- [ ] Camera-free Play makes no `getUserMedia` request.
- [ ] No recorder, upload, analytics or remote tracking endpoint is present.
- [ ] Models and WebAssembly load from local project paths.
- [ ] No frame or landmark enters persistent storage.
- [ ] Camera tracks stop on all documented exit paths.
- [ ] The locked recipient page contains no message text.
- [ ] The postcard is limited to the documented fields and can be deleted.
- [ ] The API key is absent from source, `public/`, browser storage and API
  responses.
- [ ] The server serves only `public/` and rejects dotfiles, traversal and
  symlink escape.
- [ ] Device personal-message read-aloud refuses voices not marked as local.
- [ ] No personal text reaches ElevenLabs without postcard-specific permission
  and a just-in-time confirmation.
- [ ] Sound Off, Home and page exit abort pending online speech and stop
  playback.
- [ ] Session history is limited to the five documented fields and 10 records.
- [ ] Storage denial does not prevent movement play.

Any camera upload, recording, unintended message disclosure or continued
camera use after exit is release-blocking.
