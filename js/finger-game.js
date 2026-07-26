/**
 * Data-only session content for Finger Garden mode.
 *
 * Each prompt uses one relaxed hand shape and leaves time to rest between
 * challenges. Detector names match the public names in hand-movements.js.
 */

const FINGER_MODE = Object.freeze(["fingers"]);

function defineFingerChallenge(challenge) {
  return Object.freeze({
    ...challenge,
    modes: Object.freeze([...challenge.modes]),
    feedback: Object.freeze([...challenge.feedback]),
  });
}

export const FINGER_CHALLENGES = Object.freeze([
  defineFingerChallenge({
    id: "seedlings-cosy-seed",
    name: "Cosy Seed",
    miniGame: "SEEDLING STRETCHES",
    modes: FINGER_MODE,
    instruction: "Make a soft, relaxed fist, like a seed resting in the soil.",
    spokenInstruction:
      "Make a soft, relaxed fist, like a seed resting in the soil. There is no need to squeeze.",
    detector: "closedFist",
    duration: 16000,
    demonstration: "closed-fist",
    feedback: ["A cosy little seed!", "Lovely and gentle!"],
    difficulty: 1,
    safetyNotes:
      "Keep your grip loose. Rest your hand straight away if it feels tired or cramped.",
  }),
  defineFingerChallenge({
    id: "seedlings-open-hello",
    name: "Seedling Says Hello",
    miniGame: "SEEDLING STRETCHES",
    modes: FINGER_MODE,
    instruction: "Open one hand gently, like a seedling greeting the sun.",
    spokenInstruction:
      "Open one hand gently, like a seedling greeting the sun. Keep your wrist relaxed.",
    detector: "openHand",
    duration: 16000,
    demonstration: "open-hand",
    feedback: ["Hello, seedling!", "Beautiful opening!"],
    difficulty: 1,
    safetyNotes:
      "Open only as far as feels easy. Let your forearm rest on a table or your lap if helpful.",
  }),
  defineFingerChallenge({
    id: "seedlings-sunshine-fingers",
    name: "Sunshine Fingers",
    miniGame: "SEEDLING STRETCHES",
    modes: FINGER_MODE,
    instruction: "Spread your fingers softly, like warm rays of sunshine.",
    spokenInstruction:
      "Spread your fingers softly, like warm rays of sunshine. A small spread is enough.",
    detector: "fingerSpread",
    duration: 17000,
    demonstration: "finger-spread",
    feedback: ["The sunshine is glowing!", "Wonderful sunshine fingers!"],
    difficulty: 1,
    safetyNotes:
      "Do not force your fingers apart. Relax your hand fully after the prompt.",
  }),
  defineFingerChallenge({
    id: "bee-trail-find-bumblebee",
    name: "Find the Bumblebee",
    miniGame: "BUSY BEE TRAIL",
    modes: FINGER_MODE,
    instruction: "Point one finger gently towards the visiting bumblebee.",
    spokenInstruction:
      "Point one finger gently towards the visiting bumblebee. Keep the other fingers comfortable.",
    detector: "pointIndex",
    duration: 16000,
    demonstration: "point-index",
    feedback: ["You found the bumblebee!", "A lovely gentle point!"],
    difficulty: 1,
    safetyNotes:
      "Keep your elbow supported and avoid holding your hand high for longer than is comfortable.",
  }),
  defineFingerChallenge({
    id: "bee-trail-tiny-petal",
    name: "Tiny Petal Pinch",
    miniGame: "BUSY BEE TRAIL",
    modes: FINGER_MODE,
    instruction: "Bring your thumb and first finger together as softly as a petal.",
    spokenInstruction:
      "Bring your thumb and first finger together as softly as a petal. Use almost no pressure.",
    detector: "gentlePinch",
    duration: 17000,
    demonstration: "gentle-pinch",
    feedback: ["A feather-light touch!", "Perfectly gentle!"],
    difficulty: 2,
    safetyNotes:
      "Touch lightly without pressing. Stop and rest if you notice pain, tingling or stiffness.",
  }),
  defineFingerChallenge({
    id: "bee-trail-best-flower",
    name: "Bee’s Best Flower",
    miniGame: "BUSY BEE TRAIL",
    modes: FINGER_MODE,
    instruction: "Show a comfortable thumbs-up to help the bee choose a flower.",
    spokenInstruction:
      "Show a comfortable thumbs-up to help the bee choose a flower. Keep the rest of your hand loose.",
    detector: "thumbUp",
    duration: 16000,
    demonstration: "thumb-up",
    feedback: ["The bee loves that flower!", "A cheerful thumbs-up!"],
    difficulty: 1,
    safetyNotes:
      "Keep your thumb relaxed rather than stretching it back. Rest your hand in your lap afterwards.",
  }),
  defineFingerChallenge({
    id: "butterfly-meadow-wings",
    name: "Butterfly Wings",
    miniGame: "BUTTERFLY MEADOW",
    modes: FINGER_MODE,
    instruction: "Make two gentle butterfly wings with your first two fingers.",
    spokenInstruction:
      "Make two gentle butterfly wings with your first two fingers. A small V shape is just right.",
    detector: "victoryFingers",
    duration: 17000,
    demonstration: "victory-fingers",
    feedback: ["The butterfly is fluttering!", "Beautiful butterfly wings!"],
    difficulty: 2,
    safetyNotes:
      "Use a small, easy finger opening and keep the remaining fingers relaxed.",
  }),
  defineFingerChallenge({
    id: "butterfly-meadow-landing-pad",
    name: "Butterfly Landing Pad",
    miniGame: "BUTTERFLY MEADOW",
    modes: FINGER_MODE,
    instruction: "Offer the butterfly a calm, open palm to land on.",
    spokenInstruction:
      "Offer the butterfly a calm, open palm to land on. Let your fingers stay soft.",
    detector: "openHand",
    duration: 16000,
    demonstration: "open-palm",
    feedback: ["A perfect landing place!", "The butterfly feels welcome!"],
    difficulty: 1,
    safetyNotes:
      "Support your forearm if needed and lower your hand whenever it feels tired.",
  }),
  defineFingerChallenge({
    id: "garden-cheers-plant-seed",
    name: "Plant a Little Seed",
    miniGame: "GARDEN CHEERS",
    modes: FINGER_MODE,
    instruction: "Make one more light finger-and-thumb touch to plant a seed.",
    spokenInstruction:
      "Make one more light finger-and-thumb touch to plant a seed. Then let your whole hand relax.",
    detector: "gentlePinch",
    duration: 17000,
    demonstration: "plant-seed",
    feedback: ["The seed is safely planted!", "Such a gentle touch!"],
    difficulty: 2,
    safetyNotes:
      "Use no force and release promptly. Skip the pinch if your fingers feel tired.",
  }),
  defineFingerChallenge({
    id: "garden-cheers-thumbs-up",
    name: "Garden Thumbs-Up",
    miniGame: "GARDEN CHEERS",
    modes: FINGER_MODE,
    instruction: "Finish with a relaxed thumbs-up for your growing garden.",
    spokenInstruction:
      "Finish with a relaxed thumbs-up for your growing garden. Wonderful work.",
    detector: "thumbUp",
    duration: 18000,
    demonstration: "garden-thumbs-up",
    feedback: ["Finger Garden complete!", "A wonderful finish!"],
    difficulty: 1,
    safetyNotes:
      "Keep your hand close to your body and lower it as soon as the pose is recognised.",
  }),
]);

/**
 * Return a new array containing the Finger Garden session.
 * A non-finger mode returns no challenges.
 */
export function getFingerChallenges(mode = "fingers") {
  const normalisedMode = String(mode || "")
    .trim()
    .toLowerCase();
  return normalisedMode === "fingers" ? [...FINGER_CHALLENGES] : [];
}
