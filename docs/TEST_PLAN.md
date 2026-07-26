# Supervised older-adult usability test plan

## Purpose

This plan describes a formative, supervised study with five older adults. It
tests whether people can use MoveMail safely and understand it without
unnecessary assistance. It does not test a treatment, diagnose a condition or
establish clinical benefit.

The sample is deliberately small. Results will identify usability and
recognition problems for the next design iteration; percentages must not be
presented as representative of all older adults.

## Study questions

For each participant, determine:

- Can a family member create a postcard and understand that the local MVP has
  not sent it remotely?
- Does the recipient understand that the message is sealed until the
  one-minute activity or the explicit safety bypass?
- Is the sender and recipient handover clear without accidentally exposing the
  message?
- Can they start a suitable mode?
- Can they distinguish Finger Play from standing, seated and camera-free play?
- Do they understand the safety confirmation and movement instructions?
- Can they grant or decline camera permission knowingly?
- Can they position themselves without unsafe movement?
- Do their body-movement or hand-shape attempts receive appropriate
  recognition?
- Can they present one relaxed hand without force, unsafe arm elevation or
  unnecessary finger stretching?
- Can they find, use and understand pause, resume, sound and end controls?
- Can they complete, pause or safely stop the minute and open the message?
- Can they find optional read-aloud, deletion and return-home controls?
- Can they find Voice settings and distinguish device speech from ElevenLabs
  speech, including internet, credit and text-transmission implications?
- If online postcard reading is tested, do they understand both the
  postcard-specific permission and the final send confirmation?
- Do they feel safe?
- Do they enjoy the experience?
- Would they choose to play again?
- Which movements, words, demonstrations or controls are difficult?

The facilitator must also verify that the visible message is absent before
reveal, background-tab time does not count, and stopping early does not pressure
the participant to continue through discomfort.

## Participants

Recruit five adults aged approximately 60–80 who:

- live independently;
- can remain seated or stand without continuous assistance;
- have a range of confidence with laptops or desktop computers;
- include, where possible, different levels of vision, hearing, reaction speed,
  flexibility and mobility; and
- can understand the study information and give informed consent.

Aim to include at least two participants who prefer Seated Play and two who
prefer Standing Play. Recruit a fifth participant who independently prefers
Finger Play where possible, and provide a short secondary Finger Play task to
one seated participant after a rest only if they choose it. Never ask a person
to stand or make a hand shape merely to fill a study quota. If safe standing or
Finger Play coverage cannot be recruited, test the comfortable alternatives
and report the gap plainly.

Do not exclude a participant because they use glasses, hearing aids, a walking
aid or another ordinary support. Record only the accommodation relevant to the
test; do not collect an unnecessary diagnosis or detailed medical history.
Where practical, include different levels of hand dexterity and confidence,
without recruiting by diagnosis or asking for medical details.

## Roles

- **Facilitator:** explains consent, gives the standard task prompts, controls
  the assistance protocol and stops the session if needed.
- **Observer:** records behaviour, timing, movement attempts, system
  recognition, assistance and verbatim comments. The observer does not coach.
- **Safety support:** a family member, carer or appropriate professional is
  present when the participant may need assistance. They follow the same
  no-coaching rule unless safety requires intervention.

One person may act as facilitator and observer only if doing so does not reduce
safety monitoring. The study team must know how to stop the game and camera
immediately.

## Consent, privacy and accessibility

Before the session:

1. Provide a plain-language participant information sheet in an accessible
   format and allow time for questions.
2. Explain that participation is voluntary, they may skip any movement or stop
   at any time, and doing so has no disadvantage.
3. Obtain explicit consent before opening a camera mode, including Finger Play.
4. Explain that the live camera image and body or hand inference stay on the
   computer; the application does not upload, record or store camera video,
   images or landmarks.
5. Explain the limited session summary saved by the browser.
6. If ElevenLabs is included in the session, explain which spoken text leaves
   the device, that personal reading is off by default, and that ElevenLabs may
   retain submitted text and generated audio under the test account’s settings.
7. Do not make a separate video, audio or screen recording for research. Use
   de-identified written observation notes unless separately approved,
   justified and consented.
8. Confirm the participant’s preferred mode, chair, text size, sound level,
   hearing arrangement, lighting and rest needs.
9. Ask whether they feel comfortable and well enough to try gentle movement
   today. This is a comfort check, not medical screening or clearance.

Use a participant code such as P1, never a name, in the observation sheet.
Store consent records separately from test notes. Limit access to the study
team and define a deletion date before recruitment.

Reasonable adjustments include:

- a stable chair with a back and, if preferred, arms;
- browser zoom or a larger connected display;
- reduced screen glare and suitable room lighting;
- visual-only use, repeated app audio or sound off;
- extra reading and response time;
- a rest before or during the session;
- a participant’s ordinary glasses, hearing aids or mobility support;
- forearm support on the participant’s lap, a stable table or a cushion during
  Finger Play; and
- the participant’s chosen supporter, provided the supporter does not answer
  usability questions for them.

Record every adjustment so it can be distinguished from facilitator help.

## Stop criteria

Stop the movement immediately if any of the following occurs:

- the participant reports pain, dizziness, discomfort, instability,
  breathlessness, unusual fatigue, hand cramp, numbness, tingling or feeling
  unwell;
- the participant loses balance, nearly falls or reaches for support suddenly;
- the participant asks to stop, declines a movement or withdraws consent;
- the observer sees distress, unsafe posture or an unsafe attempt to satisfy
  the camera framing guide, including forceful gripping, finger stretching or
  holding an arm uncomfortably high;
- a chair, cable, device or other environmental hazard becomes unstable;
- the camera or application behaviour causes distress or a privacy concern; or
- the facilitator or safety support has any reason to think continuation is
  unsafe.

When stopping:

1. Say “Please stop moving now” in a calm voice.
2. Pause or end the session and stop the camera.
3. Help make the environment safe without asking the participant to complete
   another movement.
4. Follow the venue’s incident and emergency procedure if any symptom or
   incident needs attention.
5. Do not restart simply to complete the test. Restart only if the participant
   has recovered, clearly wishes to continue, the cause has been addressed and
   the responsible supervisor considers it appropriate.
6. Record the trigger, action and outcome without speculating about a medical
   cause.

A skipped movement is not a test failure. Safety takes priority over data
completion.

## Setting and equipment

Use a quiet, evenly lit room with:

- a clear, non-slip movement area;
- a stable chair or support within comfortable reach;
- secure cables and no trip hazards;
- a laptop or desktop at a useful height on a stable surface;
- a tested webcam;
- a current target browser;
- audible but comfortable sound, unless the participant chooses sound off;
- the local application running at `http://localhost:8080`, or the exact
  production Vercel build when testing hosted device-voice mode; and
- a printed or digital observation sheet that does not obscure the screen.

Avoid backlighting and do not make the participant move furniture or the device
during testing. The facilitator may safely reposition the device when asked.

Before the first participant, verify:

- the build identifier and checksum;
- a non-sensitive postcard from creation and sealed handover through
  Camera-free Play to message reveal;
- camera permission reset to **Ask**;
- camera and model readiness on the test device;
- local hand-model readiness and one-hand calibration on the test device;
- pause, resume, early finish and camera shutdown;
- no unrelated notifications or video-call applications;
- local session history is empty, or its starting state is recorded; and
- the intended device or ElevenLabs provider, voice and test-account credit
  are verified without placing the API key in the browser;
- a hosted run confirms that Voice settings reports device-only mode and that
  `/api/elevenlabs/speech` is unavailable;
- emergency and incident procedures for the venue.

## Study allocation

| Participant | Primary session | Secondary coverage |
| --- | --- | --- |
| P1 | Seated camera mode | Short Finger Play set-up and first three prompts after a rest |
| P2 | Seated camera mode | Sound-off comprehension |
| P3 | Standing camera mode, only if self-selected and safe | Keyboard navigation on welcome and pause |
| P4 | Standing camera mode, only if self-selected and safe | Reduced-motion setting |
| P5 | Finger Play, only if self-selected and comfortable | Camera-free Play early finish and sealed waiting screen |

This allocation is a guide. Participant comfort overrides it. Record any change
and the resulting coverage gap.

## Standard session procedure

Allow approximately 30–40 minutes including consent, setup, rests and
interview. The active movement session is exactly one minute; postcard,
permission, pause and results tasks make the full journey longer.

### 1. Introduction and consent — 5–10 minutes

- Complete the consent, privacy and comfort checks.
- Explain: “We are testing the game, not you. There are no wrong actions.”
- Tell the participant they can stop or skip a movement at any time.
- Ask for light comments during menus, but do not require talking while moving.

### 2. Postcard preparation and handover — up to 4 minutes

Ask the accompanying family member to create a short, agreed, non-sensitive
test postcard. If no family member is taking part, the facilitator may prepare
the agreed test copy. Observe whether they understand that this build keeps the
postcard on the same device and does not send it.

After preparation, do not expose the message while handing over. Record whether
the sender can find **Open recipient view**, whether the sealed view shows only
recipient and sender, and whether the device handover is clear.

### 3. Independent recipient start — up to 3 minutes

Begin from the sealed postcard and say:

> “Please open this postcard in whichever way feels comfortable. Tell me what
> you expect before you select anything.”

Do not point to a control. Record whether the recipient chooses movement or the
direct non-movement route. If they choose movement, record mode choice, first
action, hesitation, misreading and assistance.

### 4. Safety and permission — up to 3 minutes

Say:

> “Please continue when you understand and agree with what the screen asks.”

Observe whether both confirmations are read, whether camera use is understood
and whether permission is granted deliberately. For Finger Play, check that the
participant understands that one hand is followed locally and that video is not
recorded. Do not tell the participant to agree. If they do not agree, respect
the decision and offer Camera-free Play.

### 5. Camera positioning — up to 3 minutes

Say:

> “Please follow the positioning guidance only as far as feels comfortable.
> Ask me to move the device if that would be easier.”

Record time to “Great position”, messages encountered, unsafe compensations,
whether device adjustment was needed and assistance level. Do not encourage a
larger range of motion.

For Finger Play, ask the participant to use either comfortable hand, keep the
palm and fingertips in view and support the forearm if helpful. The facilitator
must reposition the device rather than asking the participant to lift or hold
the arm higher. Record whether the hand guide is understood and whether the
player can start without waiting for perfect framing.

### 6. One-minute session — approximately 3–5 minutes

Allow the 60-second active-time session to finish. Record every prompt that
appears; do not extend the session or hurry the participant in order to expose
all 10 prompt definitions. For each prompt encountered, separately record:

- whether the instruction was understood;
- whether a recognisable attempt was made;
- whether the system recognised it;
- recognition time or timeout;
- any extra guidance;
- apparent comfort and stability; and
- spontaneous comments.

For Finger Play, separately record force, comfort and whether the requested
shape is distinguishable from the neighbouring shape. A small, comfortable
shape is a valid attempt. Do not ask for a tighter fist, wider finger spread,
firmer pinch or longer arm hold to satisfy the detector.

After challenge 3, say at a calm transition:

> “When you are ready, please pause the game, then continue.”

This is the only requested pause. Do not interrupt a movement to issue it.

### 7. Message, results and return — up to 2 minutes

Say:

> “Please finish what you would normally do after seeing this screen.”

Observe whether the message and results are understood and whether **Move again** and
**Return Home** are distinguishable. Do not require another full session.

If online postcard reading is in the approved test scope, use only the agreed
non-sensitive test message. Observe whether the participant understands the
privacy note, deliberately enables online reading for that postcard, and
chooses **Send and read**, **Use device voice** or **Cancel** without coaching.
Cancelling or choosing device voice is a valid outcome and must make no online
personal-message request.

### 8. Secondary task — up to 3 minutes

Use the allocation table only after a rest and only if the participant is
comfortable. For a short Finger Play secondary task, complete set-up and the
first three prompts only, then offer **End Session**; do not require the
participant to continue. For Camera-free Play early finish, say:

> “Please start Camera-free Play, then end it early and return home.”

Confirm that no camera prompt or camera indicator appears.

### 9. Interview — 8–10 minutes

Conduct the interview while the participant is comfortably seated. Use the
questions below and avoid defending the design.

## Assistance protocol

Allow reasonable reading and reaction time. During navigation, wait about 15
seconds after apparent hesitation before asking, “What are you looking for?”
Wait up to a further 15 seconds before providing the smallest useful verbal
prompt. Do not wait when safety is involved.

Code the highest assistance used for each task:

| Code | Assistance |
| --- | --- |
| 0 | Independent; no facilitator input beyond the standard task prompt |
| 1 | Participant asks a question; facilitator repeats existing wording without explaining |
| 2 | Verbal hint or explanation needed |
| 3 | Facilitator or supporter operates/repositions the device or intervenes physically |
| S | Task stopped or skipped for comfort, consent or safety |

Ordinary accessibility adjustments agreed before the task are recorded
separately and are not automatically assistance.

## Measures and operational definitions

| Measure | Record | Success definition for one participant |
| --- | --- | --- |
| Starts the game | First action, chosen mode, time, assistance | Reaches the intended safety/setup path with assistance 0 or 1 |
| Understands instructions | Paraphrase and first three movement responses | Understands the purpose and acts without facilitator rephrasing |
| Positions themselves | Time to ready, messages, device adjustment, safety | Reaches an acceptable body or one-hand frame within two minutes without unsafe movement or physical help |
| Responds to prompts | Body-movement or hand-shape attempts and system recognitions, recorded separately | Comfortably responds to the prompts encountered; there is no minimum count and recognition misses are recorded as system issues |
| Pauses | Time and assistance after standard pause request | Activates pause within 15 seconds with assistance 0 or 1 |
| Resumes | Time and assistance | Returns to the same session without explanation |
| Finishes independently | End path, message/results or waiting-screen understanding, return action | Reaches the appropriate completion or safe-stop screen and chooses a next action with assistance 0 or 1 |
| Feels safe | 1–5 rating, explanation, observed events | Rates safety 4 or 5 and has no safety event; any lower rating requires follow-up |
| Enjoys it | 1–5 rating and explanation | Rates enjoyment 4 or 5 |
| Would play again | Yes / Maybe / No and conditions | Answers Yes, or gives a specific remediable condition |
| Difficult movements | Per-challenge ease 1–5 plus comments | No target; identify movement-specific redesign needs |

Also record total session time, number and level of interventions, permission
outcome, camera/model errors, sound state, mode, browser, device, chosen hand
for Finger Play and any accessibility adjustment.

Do not treat a detector timeout as proof that a participant did not move.
Observer-labelled attempts and system recognition are separate measures.

## Per-participant observation sheet

### Session details

| Field | Entry |
| --- | --- |
| Participant code | |
| Date and study location | |
| Facilitator / observer codes | |
| Build identifier / checksum | |
| Device, operating system and browser version | |
| Webcam | |
| Chosen mode | |
| Chosen hand for Finger Play, if applicable | Left / Right / Changed / Not applicable |
| Sound on/off | |
| Relevant accessibility adjustments | |
| Consent confirmed | Yes / No |
| Camera explanation understood | Yes / No / Unclear |
| Camera permission outcome | Allowed / Declined / Not requested |
| Start time / end time | |

### Journey observations

| Task | Start–finish time | Assistance | Completed? | What the participant did or said | Confusion, error or safety note |
| --- | --- | --- | --- | --- | --- |
| Prepare and hand over a local postcard | | | | | |
| Understand the sealed postcard and choose an unlock route | | | | | |
| Choose a mode | | | | | |
| Read and acknowledge safety | | | | | |
| Understand camera privacy | | | | | |
| Reach acceptable position | | | | | |
| Understand Finger Play hand guide, if used | | | | | |
| Start session | | | | | |
| Pause | | | | | |
| Resume | | | | | |
| View and interpret the message/results or early-stop waiting screen | | | | | |
| Return home | | | | | |
| Secondary task, if used | | | | | |

### Challenge observations

Use **A** for a visible comfortable attempt, **R** for recognised, **T** for
timeout and **S** for skipped/stopped.

| # | Movement | Understood? | A/R/T/S | Recognition time | Stars | Extra guidance | Comfort, stability and comment |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Left hand raised | | | | | | |
| 2 | Right hand raised | | | | | | |
| 3 | Arms open | | | | | | |
| 4 | Left reach | | | | | | |
| 5 | Right reach | | | | | | |
| 6 | Both hands raised | | | | | | |
| 7 | Gentle left lean | | | | | | |
| 8 | Gentle right lean | | | | | | |
| 9 | Slow arm opening | | | | | | |
| 10 | Celebration pose | | | | | | |

For Finger Play, use this table instead:

| # | Hand shape | Understood? | A/R/T/S | Recognition time | Stars | Extra guidance | Comfort, force and comment |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Soft closed fist | | | | | | |
| 2 | Open hand | | | | | | |
| 3 | Finger spread | | | | | | |
| 4 | Index point | | | | | | |
| 5 | Gentle pinch | | | | | | |
| 6 | Thumbs-up | | | | | | |
| 7 | Victory fingers | | | | | | |
| 8 | Open palm | | | | | | |
| 9 | Gentle pinch | | | | | | |
| 10 | Thumbs-up | | | | | | |

### Safety and accessibility record

| Check | Observation |
| --- | --- |
| Clear area remained safe | |
| Chair/support remained stable | |
| Secure footwear / seated stability | |
| Pain, dizziness, discomfort or instability reported | |
| Near-fall, distress or unsafe compensation observed | |
| Hand pain, stiffness, numbness, tingling, cramp or forceful movement observed | |
| Forearm support used in Finger Play | |
| Pause/rest/stop requested | |
| Stop action taken and camera stopped | |
| Adjustments that helped | |
| Adjustments still needed | |

### Post-session ratings

Ask for a number and the reason. A rating of 1 means “not at all”; 5 means
“very”.

| Question | Rating / answer | Reason in participant’s words |
| --- | --- | --- |
| How easy was it to start? (1–5) | | |
| How clear were the instructions? (1–5) | | |
| How easy was camera positioning? (1–5) | | |
| How safe did you feel? (1–5) | | |
| How enjoyable was it? (1–5) | | |
| Would you play again? | Yes / Maybe / No | |
| Most difficult movement | | |
| Most comfortable movement | | |

## Interview questions

Ask these in a conversational order without suggesting a preferred answer:

1. What did you think the game wanted you to do when you first saw it?
2. How did you decide between Standing, Seated, Finger Play and Camera-free
   Play?
3. Was any safety wording unclear, worrying or easy to miss?
4. Before you allowed the camera, what did you think would happen to the
   picture?
5. How did positioning yourself for the camera feel?
6. Which instructions were easiest to understand? Which were hardest?
7. Which body movements or hand shapes felt comfortable?
8. Was any movement or hand shape difficult, uncomfortable or too far to
   reach?
9. Did the game ever fail to notice a movement you thought you had completed?
10. Did you have enough time, too much time or too little time?
11. Were the demonstrations, words and spoken instructions useful together?
12. Could you find pause, sound and finish when you wanted them?
13. How did the stars and encouragement make you feel?
14. Was anything too small, low contrast, fast, busy or distracting?
15. Did you feel safe throughout? What would make it feel safer?
16. Did the camera explanation give you enough confidence? What was missing?
17. Would you play this again? If not, what would need to change?
18. Where and with whom, if anyone, would you prefer to play?
19. What is the one thing you would change first?
20. Is there anything else you expected the game to do?

If the participant reports discomfort or a privacy concern, stop probing for
positive feedback and document the concern accurately.

## Aggregate scorecard

Complete after all five sessions. Use `0–3` assistance codes, counts for
movement attempts and recognitions, and `S` for a stopped task.

| Measure | P1 | P2 | P3 | P4 | P5 | Summary / design action |
| --- | --- | --- | --- | --- | --- | --- |
| Started chosen mode | | | | | | |
| Understood first instruction | | | | | | |
| Positioned within 2 minutes | | | | | | |
| Prompts attempted / prompts shown | | | | | | |
| Attempts recognised / attempted | | | | | | |
| Paused | | | | | | |
| Resumed | | | | | | |
| Reached message/results or safe-stop waiting screen | | | | | | |
| Returned home | | | | | | |
| Safety rating / 5 | | | | | | |
| Enjoyment rating / 5 | | | | | | |
| Would play again | | | | | | |
| Safety stop or incident | | | | | | |

## Analysis and reporting

For each task:

- report independent completion, assisted completion, skips and stops;
- calculate median time rather than relying only on a mean;
- compare observer-labelled attempts with detector recognitions;
- group issues by safety, comprehension, navigation, camera positioning, body
  or hand recognition, accessibility and privacy;
- list affected participant codes and relevant mode;
- retain concise verbatim comments without names; and
- assign a design action and priority.

Treat any safety incident, unclear camera consent or camera data leaving the
device as a release-blocking issue. Prioritise repeated assistance, unsafe
camera-positioning responses and comfortable attempts that the detector misses.

The provisional success targets are in `MVP_SPEC.md`. A missed target is a
finding, not a reason to reinterpret the measure. Report any mode, browser,
movement or participant group that was not tested.

## Study completion checklist

- [ ] Five consented participants completed or safely stopped a session.
- [ ] At least two seated sessions were observed.
- [ ] Standing coverage was attempted only with willing, safe participants.
- [ ] At least one full Finger Play session and one short secondary Finger Play
      task were attempted only with willing, comfortable participants.
- [ ] Finger Play force, forearm support, hand comfort and one-hand framing were
      recorded.
- [ ] Observer attempts and system recognition were recorded separately.
- [ ] Pause, resume, timed completion, early-stop waiting and return home were
      covered.
- [ ] Camera-free Play was reviewed without a camera request.
- [ ] Voice settings, Sound Off and the device-voice fallback were reviewed.
- [ ] Any ElevenLabs test used a restricted test key, non-sensitive text and
      explicit consent; cancellation was verified to send no personal text.
- [ ] Stop criteria and any incidents were recorded.
- [ ] De-identified interviews were completed.
- [ ] Consent records and observation notes were stored separately.
- [ ] Findings, unknowns and untested coverage were reported plainly.
