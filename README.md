# MoveMail

MoveMail turns a personal family message into a three-move, seated postcard.
The recipient completes the gentle movements to reveal the message.

## Why this prototype is deliberately small

The product tests one idea: a message from somebody you love can make a short
movement session feel emotionally meaningful. It does not diagnose, prescribe,
measure health or claim to prevent falls.

## Safety and privacy boundaries

- Every plan contains exactly three distinct movements from a five-item,
  seated, upper-body allow-list.
- Model output is validated locally. Invalid or unavailable model output is
  replaced with a deterministic built-in plan.
- Pose estimation runs locally in a Web Worker. No camera frame, video or pose
  landmark is sent to the server or stored.
- Postcard URLs are bearer links, not encrypted messages. The UI tells senders
  not to include medical or highly private information.
- The player is told to use a steady chair, keep the area clear, move only
  within an easy range and stop if uncomfortable.
- Camera-free controls are always available.

## Resilience

The complete journey remains demonstrable with no service credentials:

| Capability | Live path | Automatic fallback |
| --- | --- | --- |
| Story planning | OpenAI, then Anthropic | Validated built-in story |
| Narration | ElevenLabs Flash v2.5 | Browser speech synthesis and captions |
| Sharing | Supabase | Self-contained encoded link |
| Movement input | Local MediaPipe pose tracking | Keyboard and on-screen controls |

Set `LLM_PROVIDER=openai` or `LLM_PROVIDER=anthropic` to force one story
provider. `auto` prefers OpenAI, then Anthropic, and never calls both for one
successful postcard.

## Local run

Requirements: Node.js 22.13 or newer.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`. Environment variables are optional; the default
experience is the honest demo fallback.

## Verification

```bash
npm test
npm run lint
npx tsc --noEmit
```

The Supabase table definition is in `supabase/schema.sql`.
