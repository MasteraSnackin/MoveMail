# MoveMail MVP specification

## Product

**Name:** MoveMail
**Proposition:** A personal family message opened through one gentle minute of
movement.
**Theme:** A warm garden movement postcard.

MoveMail is a browser-based wellbeing game, not a medical, rehabilitation or
fitness product. A family member prepares a postcard on the device. The older
adult completes 60 active seconds of comfortable movement to reveal the
message. Recognition creates encouraging feedback but does not determine
whether the postcard opens.

## MVP boundaries

Included:

- one local postcard with recipient, sender and a message of up to 280
  characters;
- an explicit same-device handover flow;
- sealed recipient view with no message text rendered in that view;
- Standing, Seated, Finger and Camera-free Play;
- local Pose Landmarker or Hand Landmarker processing for camera modes;
- one authoritative 60-second active-time unlock;
- pauses and hidden-tab time excluded from the minute;
- movement prompts, positive recognition feedback and participation stars;
- safe early stop with an explicit non-movement message-access option;
- a revealed postcard plus optional device or ElevenLabs read-aloud;
- a Voice settings screen with device speech as the default, a server-curated
  ElevenLabs voice list and no browser API-key field;
- a loopback-only local server that keeps the ElevenLabs key outside the
  browser and serves only the built `public/` directory;
- local deletion of the postcard; and
- up to 10 privacy-limited session summaries.

Excluded:

- email, text, push notification or remote postcard delivery;
- accounts, login, access control, cloud storage, analytics or advertising;
- claims of clinical benefit;
- personalised comfortable-reach calibration;
- camera recording, image storage or landmark persistence; and
- competitive scoring, failure states or movement-quality assessment.

The local MVP must not imply that a postcard has been sent to another device.
It uses wording such as **Prepare MoveMail**, **ready on this device** and
**Open recipient view**. Optional speech transmission is separate from
postcard delivery.

## Users and safety

The primary recipient is an older adult who may prefer large controls, clear
language, a slower pace or seated and hand-only alternatives. A family member,
carer or appropriate professional should supervise anyone who may need help.

Before play, the recipient confirms:

- there is enough clear space;
- stable support is available if helpful;
- they will move only in a comfortable range; and
- they will stop for pain, dizziness, discomfort or instability.

Finger Play adds relaxed-hand and supported-forearm guidance. The game never
requires squeezing, forced finger spreading or a sustained raised arm.

## Journey

1. **Home:** choose **Open a postcard** or **Create a postcard**.
2. **Voice settings, optional:** choose device or ElevenLabs guidance, load a
   curated online voice and decide whether the current postcard may offer
   online read-aloud.
3. **Compose:** enter To, From and a message. Explain that this is a local
   same-device MVP.
4. **Prepared:** show recipient and sender only. The family member opens the
   recipient view, then hands over the device.
5. **Sealed postcard:** state who sent it without rendering the message.
6. **Mode:** choose Standing, Seated, Finger or Camera-free Play.
7. **Safety:** complete the two acknowledgements.
8. **Set-up:** camera modes show privacy and deliberate permission controls;
   Camera-free Play requires no permission.
9. **Game:** move for 60 active seconds. Pause is unlimited and excluded from
   the timer.
10. **Reveal:** stop the camera first, then insert and focus the personal
    message. Read-aloud is opt-in. Online read-aloud asks for just-in-time
    confirmation and is never automatic.
11. **Accessible open or early stop:** the sealed view always offers deliberate
    access without movement. An early stop keeps a still-locked postcard sealed,
    then offers retry, non-movement access or return home.

## One-minute unlock

The unlock clock is independent of challenge recognition, star score and
tracking quality.

- Duration: exactly 60,000 milliseconds of active game time.
- Start: when the first movement prompt is visible.
- Pause: manual pauses and hidden-tab pauses stop accumulation.
- Resume: continues from the prior elapsed time.
- Restart: resets the clock to zero.
- Completion: one idempotent path stops camera tracking before message render.
- Recognition: changes encouragement and stars only.
- Tracking failure: stops the camera and continues camera-free.

The interface announces 30 and 10 seconds remaining without speaking every
second.

## Movement recognition

Standing and Seated Play use broad body-relative relationships based on pose
landmarks. Finger Play uses scale-normalised relationships between 21 temporary
hand landmarks. A short hold reduces accidental triggers.

The current set-up checks framing and model readiness. Recognition adapts to
play mode and body or hand proportions, but it does not measure a person’s
individual comfortable reach. Copy must not claim otherwise.

The data files retain 10 body challenges and 10 finger challenges. A one-minute
session may show only part of a set when the recipient moves slowly. Completing
all prompts early does not unlock the postcard before the active-time boundary.

## Accessibility

- Native buttons, labels, form fields and headings.
- Visible keyboard focus and large pointer targets.
- Focus moves to every new screen and to the revealed message.
- Visual instructions remain available when speech is unavailable or muted.
- Reduced-motion and forced-colour considerations.
- No accuracy gate or failure state; the visible countdown and stars use
  relaxed, participation-first timing.
- Camera-free and explicit safety-bypass routes.
- The non-movement access route is available directly from the sealed postcard;
  it does not require starting and ending a game first.
- The personal message is not automatically spoken.
- Device personal-message read-aloud uses only a voice marked as local by the
  browser and fails closed when one is unavailable.
- Online personal-message read-aloud requires both postcard-specific
  permission and a confirmation at the read action.

## Privacy and data

The postcard record uses `moveMail.postcard.v1` and includes only:

```text
id, recipient, sender, message, createdAt, unlocked, isSample
```

Session history uses `moveMail.sessions.v1` and includes only:

```text
date, mode, sessionDuration, completedMovements, score
```

Camera frames and landmarks are transient. No microphone is requested. See
`PRIVACY.md` for the full boundaries and deletion instructions.

Voice preferences use `moveMail.voice.v1` and contain only:

```text
provider, voice, voiceLabel, onlinePostcardId
```

The API key remains in the local Node process or ignored `.env.local` file.
Generic text is sent to ElevenLabs only when online guidance is selected.
Personal message text is sent only through the explicit two-step read-aloud
choice. Names, camera data and session results are excluded from those
requests.

## Acceptance criteria

- All 11 screens render with semantic headings and working navigation.
- A postcard can be created, sanitised, saved, opened and deleted locally.
- The message is absent from the locked recipient view and from the blank
  general Create route.
- Replacing or deleting the only local postcard requires confirmation.
- The timer remains locked at 59,999 ms and completes at 60,000 ms.
- Paused and hidden-tab time does not count.
- Stars and recognition cannot unlock early.
- Early stop does not silently unlock and provides a safe access route.
- Camera cleanup completes before message reveal.
- The ElevenLabs key is absent from browser code, browser storage, the public
  build and API responses.
- Personal text cannot reach the speech endpoint without explicit consent, and
  reveal never requests speech automatically.
- Sound Off and navigation cancel pending online speech and active playback.
- Standing, Seated, Finger and Camera-free modes retain their existing setup,
  prompts and positive feedback.
- Build, lint, syntax, movement, hand-model, storage and rendered-structure
  checks pass.
- The local ZIP and checksum are regenerated for the MoveMail release.

## Future work

Real delivery to another device requires a hosted service or private share link,
an opaque postcard identifier, access control, retention rules and an updated
privacy design. Personalised comfortable-reach scaling would require a new
session-only calibration and detector profile; it must not be inferred from the
current body-relative recognition.
