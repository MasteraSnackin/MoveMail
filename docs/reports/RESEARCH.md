# MoveMail Research Report

Reviewed: 25 July 2026

## Research question

Can a family message be turned into a short, camera-optional movement game for older adults while keeping the interaction understandable, bounded and usable during sponsor-service failure?

## Facts

### Movement and health context

- The [World Health Organization brief for older people](https://www.who.int/publications/i/item/9789240064096) summarises WHO physical-activity and sedentary-behaviour recommendations for this population. It supports the importance of enabling activity, but it does not validate MoveMail or its individual movements.
- The [NHS sitting-exercise guidance](https://www.nhs.uk/live-well/exercise/sitting-exercises/) advises using a solid, stable chair, placing the feet flat where possible, moving gently and checking with a health professional when suitability is uncertain. MoveMail reflects some of these precautions in its preparation copy.
- A [2024 overview of systematic reviews and meta-analyses indexed by PubMed](https://pubmed.ncbi.nlm.nih.gov/38655514/) examined active exergames and physical-performance measures in older people. It reported mixed results across outcomes and substantial heterogeneity in several analyses. It is evidence about studied interventions, not evidence that this prototype is effective.
- MoveMail has not been evaluated as a medical device, rehabilitation programme or health intervention. The repository contains no evidence that it improves balance, mobility, cognition, strength or fall risk.

### Accessibility and interaction

- [WCAG 2.2](https://www.w3.org/TR/WCAG22/) includes requirements relevant to this interface, including keyboard access, visible focus, status communication, reflow, alternatives to motion-dependent input and target size.
- The current application provides a non-camera path, written cues, keyboard-operable demo controls, reduced-motion CSS and focus transfer between screens. These are implementation facts, not proof of WCAG conformance.

### AI generation

- The current default OpenAI model is `gpt-5.6-luna`. OpenAI describes [GPT-5.6 Luna](https://developers.openai.com/api/docs/models/gpt-5.6-luna) as intended for cost-sensitive, high-volume work and lists Structured Outputs as supported.
- OpenAI’s [Structured Outputs guide](https://developers.openai.com/api/docs/guides/structured-outputs) documents constraining model output with a JSON Schema through `text.format`, subject to the supported schema subset.
- The current Anthropic alternative is `claude-sonnet-5`. Anthropic’s [Claude Sonnet 5 documentation](https://platform.claude.com/docs/en/about-claude/models/whats-new-sonnet-5) identifies that model ID and documents current API constraints.
- Anthropic’s [Structured Outputs documentation](https://platform.claude.com/docs/en/build-with-claude/structured-outputs) uses `output_config.format` with `type: "json_schema"`.
- MoveMail sends the same narrow movement-plan schema to either provider, then applies its own deterministic validation. The model can select and theme only three distinct items from a fixed five-movement vocabulary.
- In automatic mode, OpenAI is tried first when configured; Anthropic is tried only if the preceding configured provider fails. Both providers are not called after a successful response.
- If no configured provider succeeds, the API returns a deterministic built-in plan with a successful demo-mode response.

### Voice, camera, storage and hosting

- ElevenLabs describes [Flash v2.5](https://elevenlabs.io/docs/overview/models) as a low-latency model suited to interactive applications. MoveMail uses it when configured, with browser speech and visible text as fallbacks.
- Google’s [MediaPipe Pose Landmarker web guide](https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker/web_js) states that video detection is synchronous and recommends a web worker to avoid blocking the main interface. MoveMail runs pose inference in a worker and sends landmarks, not frames, back to the UI.
- Supabase’s [Data API security guide](https://supabase.com/docs/guides/api/securing-your-api) explains that grants and Row Level Security are separate controls and recommends using both for exposed objects. MoveMail keeps its service-role key server-side and its schema revokes anonymous and authenticated access.
- Vercel documents [WAF rate limiting](https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting) as a hosting-layer control. The repository does not prove that a production rate-limit rule has been enabled.
- Camera frames are processed locally in the browser. The application code does not upload or persist video frames or pose landmarks.
- The Supabase schema gives postcards a 30-day expiry timestamp, but expiry enforcement still needs an operational deletion job.

## Inferences

- The emotional reward of revealing a family message may be a clearer motivation than presenting the same movements as exercise. This is the product hypothesis, not a user-proven result.
- A fixed vocabulary plus deterministic validation is a more appropriate safety boundary than asking either language model to invent unrestricted movements.
- OpenAI-first with Anthropic fallback gives sponsor coverage and resilience without paying for two successful generations. Which provider produces better stories for this audience remains unmeasured.
- Local pose processing is likely to improve privacy and responsiveness compared with uploading camera frames, but device performance and compatibility may vary.
- A no-camera path is necessary for trust, accessibility and a reliable live demo; it should remain a supported mode rather than being framed as failure.
- Short written cues and optional narration are likely easier to follow than audio alone, particularly when hearing, speakers or a sponsor API are unreliable.

## Unknowns

- No older adult has used or evaluated this version.
- No real-user evidence has been collected. The hackathon real-user bonus must not be claimed.
- There is no evidence yet about comprehension, enjoyment, repeat use, perceived dignity, physical comfort or whether the family-message concept motivates completion.
- There is no evidence that the three calibrated camera targets are appropriate across the intended population.
- There has been no structured review by a qualified health, accessibility or safeguarding professional.
- MediaPipe accuracy and latency are unknown across the intended range of phones, laptops, browsers, lighting, clothing, bodies, chairs and assistive equipment.
- WCAG 2.2 conformance, screen-reader usability, zoom behaviour and colour contrast have not been independently verified.
- Live provider quality, latency, quotas, regional availability and cost have not been measured with production credentials.
- It is unknown whether recipients understand that anyone with the link can open the message.
- Production WAF rate limiting, monitoring, postcard deletion and incident procedures are not evidenced by this repository.

## Options

### Story generation

| Option | Advantages | Trade-offs |
| --- | --- | --- |
| OpenAI only | Simplest sponsor integration; current model supports structured output | One external failure domain; no comparative evidence that its stories suit the audience best |
| Anthropic only | Simple alternative with structured output | Same single-provider risk; no comparative evidence |
| OpenAI then Anthropic | Current implementation; resilient; never calls both after success | More integration surface; provider behaviour and cost need monitoring |
| Deterministic only | Most predictable and works offline | Less personalisation and weaker sponsor demonstration |

### Postcard persistence

| Option | Advantages | Trade-offs |
| --- | --- | --- |
| Supabase only | Short links and central expiry control | Requires live storage and operational retention controls |
| Embedded fragment only | No database required; fragment is not sent in ordinary HTTP requests | Long bearer link; no revocation; the message is encoded, not encrypted |
| Supabase plus embedded fallback | Current implementation; short link when available and resilient fallback | Largest implementation surface; recipients still need clear bearer-link warnings |

### Movement input

| Option | Advantages | Trade-offs |
| --- | --- | --- |
| Camera only | Strongest “AI vision” demonstration | Permission, device, accuracy and accessibility risks |
| On-screen controls only | Reliable and avoids camera permission or tracking requirements | Does not demonstrate pose tracking |
| Explicit user choice | Current implementation; preserves agency and recovery | Requires both modes to remain equally maintained |

## Recommendation

Keep the current hybrid:

- OpenAI first, Anthropic second and deterministic fallback.
- One shared JSON Schema followed by exact server-side validation.
- A fixed, seated, upper-body movement vocabulary that the model cannot extend.
- Camera tracking as an optional enhancement, with equivalent on-screen controls.
- ElevenLabs as optional narration, with browser speech and visible text fallbacks.
- Supabase short links when available, with an embedded fragment fallback and clear bearer-link warnings.

This architecture uses sponsor services where they add personalisation, narration or storage, but it does not make the core journey depend on them. Do not position it as treatment, rehabilitation, fall prevention or a proven healthy-ageing intervention.

Before expanding the movement library, prioritise evidence about comprehension, comfort and willingness to use the product. Better copy or another theme is lower risk than adding standing, balance or rapid movements.

## Experiment

### Hypothesis

An older recipient can understand the proposition, select either camera or on-screen controls, complete the three-move sequence and reveal the message without physical prompting or believing the product is medical.

### Participants

- Recruit five to eight older adults through a documented, legitimate route such as a community group, care network or family contacts.
- Recruit two or three family members to create the postcards.
- Record the recruitment route and obtain consent for anonymised notes.
- Do not invent participants, backfill results or describe the current self-test as older-adult evidence.

### Method

1. Ask each sender to create and share one non-sensitive postcard.
2. Give each recipient the link without coaching beyond the on-screen text.
3. Let the recipient choose camera or on-screen controls.
4. Observe task completion, requests for help, mis-clicks, pauses and abandonment.
5. Ask the recipient to explain what the camera does, who can open the link and whether the product is medical.
6. Ask for a simple comfort and enjoyment rating, plus one thing they would change.
7. Test at least one iPhone, one Android phone and one laptop if available.

### Measures

- Percentage completing the journey.
- Time to first movement and total completion time.
- Number and type of prompts required.
- Camera versus on-screen control choice.
- Whether the stop/comfort instruction is noticed.
- Whether the bearer-link and local-camera explanations are understood.
- Reported discomfort, confusion or loss of confidence.
- Sender confidence in sharing the link.

### Decision rule

Proceed to a second iteration only if at least four of the first five recipients complete the journey without physical prompting, every participant can find the no-camera route, and no participant reports that the interface encouraged movement beyond their comfortable range. Treat any discomfort, medical misunderstanding or privacy misunderstanding as a design issue to fix before adding features.

This is a usability experiment, not an efficacy study. Any attempt to measure health outcomes would require an appropriate study design, professional oversight and a longer evidence plan.
