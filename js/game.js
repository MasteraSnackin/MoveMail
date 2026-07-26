/**
 * Data-only session content for MoveMail.
 *
 * Detector names deliberately match the public names in movements.js. Keeping
 * the content here makes it possible to add themes or translated instructions
 * later without changing the gameplay controller.
 */

const ALL_MODES = Object.freeze(["standing", "seated", "preview"]);

function defineChallenge(challenge) {
  return Object.freeze({
    ...challenge,
    modes: Object.freeze([...challenge.modes]),
    feedback: Object.freeze([...challenge.feedback]),
  });
}

export const CHALLENGES = Object.freeze([
  defineChallenge({
    id: "gardener-left-hello",
    name: "A Sunny Hello",
    miniGame: "COPY THE GARDENER",
    modes: ALL_MODES,
    instruction: "Lift your left hand to greet the gardener.",
    spokenInstruction:
      "Lift your left hand to greet the gardener. Take your time.",
    detector: "leftHandRaised",
    duration: 18000,
    demonstration: "raise-left",
    feedback: ["Wonderful movement!", "A lovely hello!"],
    difficulty: 1,
    safetyNotes:
      "Keep your shoulders relaxed and lift only as high as feels comfortable.",
  }),
  defineChallenge({
    id: "gardener-right-hello",
    name: "Hello Again",
    miniGame: "COPY THE GARDENER",
    modes: ALL_MODES,
    instruction: "Now lift your right hand for another gentle hello.",
    spokenInstruction:
      "Now lift your right hand for another gentle hello. Move comfortably.",
    detector: "rightHandRaised",
    duration: 18000,
    demonstration: "raise-right",
    feedback: ["You’ve got it!", "Beautiful!"],
    difficulty: 1,
    safetyNotes:
      "Keep your body supported and do not stretch through pain or discomfort.",
  }),
  defineChallenge({
    id: "gardener-open-gate",
    name: "Open the Garden Gate",
    miniGame: "COPY THE GARDENER",
    modes: ALL_MODES,
    instruction: "Open both arms gently, like a welcoming garden gate.",
    spokenInstruction:
      "Open both arms gently, like a welcoming garden gate.",
    detector: "armsOpen",
    duration: 18000,
    demonstration: "open-arms",
    feedback: ["What a warm welcome!", "Great job!"],
    difficulty: 1,
    safetyNotes:
      "Keep both hands near shoulder height or lower and use a comfortable range.",
  }),
  defineChallenge({
    id: "firefly-left-flower",
    name: "Firefly by the Left Flower",
    miniGame: "CATCH THE FIREFLIES",
    modes: ALL_MODES,
    instruction: "Reach your left hand gently towards the glowing flower.",
    spokenInstruction:
      "Reach your left hand gently towards the glowing flower.",
    detector: "leftReach",
    duration: 18000,
    demonstration: "reach-left",
    feedback: ["Lovely reach!", "The firefly found you!"],
    difficulty: 1,
    safetyNotes:
      "Reach to the side without twisting, and keep your hips steady.",
  }),
  defineChallenge({
    id: "firefly-right-flower",
    name: "Firefly by the Right Flower",
    miniGame: "CATCH THE FIREFLIES",
    modes: ALL_MODES,
    instruction: "Reach your right hand gently towards the next firefly.",
    spokenInstruction:
      "Reach your right hand gently towards the next firefly.",
    detector: "rightReach",
    duration: 18000,
    demonstration: "reach-right",
    feedback: ["A sparkling reach!", "Excellent effort!"],
    difficulty: 1,
    safetyNotes:
      "Stay centred on your chair or feet and use only a comfortable reach.",
  }),
  defineChallenge({
    id: "firefly-soft-glow",
    name: "Firefly Glow Above",
    miniGame: "CATCH THE FIREFLIES",
    modes: ALL_MODES,
    instruction: "Lift both hands towards the firefly, only as high as is comfortable.",
    spokenInstruction:
      "Lift both hands towards the firefly, only as high as is comfortable.",
    detector: "bothHandsRaised",
    duration: 18000,
    demonstration: "raise-both",
    feedback: ["The garden is glowing!", "Wonderful movement!"],
    difficulty: 2,
    safetyNotes:
      "Do not force an overhead reach. A smaller comfortable lift still counts as participation.",
  }),
  defineChallenge({
    id: "rhythm-breeze-left",
    name: "Breeze to the Left",
    miniGame: "RHYTHM GARDEN",
    modes: ALL_MODES,
    instruction: "Follow the slow breeze with a small lean to your left.",
    spokenInstruction:
      "Follow the slow breeze with a small lean to your left. Keep it gentle.",
    detector: "gentleLeftLean",
    duration: 18000,
    demonstration: "lean-left",
    feedback: ["Moving like a leaf!", "Calm and lovely!"],
    difficulty: 2,
    safetyNotes:
      "Make only a small upper-body lean. Keep both feet grounded and your hips supported.",
  }),
  defineChallenge({
    id: "rhythm-breeze-right",
    name: "Breeze to the Right",
    miniGame: "RHYTHM GARDEN",
    modes: ALL_MODES,
    instruction: "Follow the slow breeze with a small lean to your right.",
    spokenInstruction:
      "Follow the slow breeze with a small lean to your right. Take your time.",
    detector: "gentleRightLean",
    duration: 18000,
    demonstration: "lean-right",
    feedback: ["Gently does it!", "Beautiful!"],
    difficulty: 2,
    safetyNotes:
      "Make only a small upper-body lean. Use your chair or nearby support if needed.",
  }),
  defineChallenge({
    id: "rhythm-flower-bloom",
    name: "The Garden Blooms",
    miniGame: "RHYTHM GARDEN",
    modes: ALL_MODES,
    instruction: "Slowly open your arms, then relax when you are ready.",
    spokenInstruction:
      "Slowly open your arms, like a flower blooming. There is no need to match the beat exactly.",
    detector: "armsOpen",
    duration: 18000,
    demonstration: "bloom",
    feedback: ["A beautiful bloom!", "You’re moving wonderfully!"],
    difficulty: 1,
    safetyNotes:
      "Use a small, smooth movement and keep your shoulders relaxed.",
  }),
  defineChallenge({
    id: "celebration-garden-complete",
    name: "Garden Celebration",
    miniGame: "GARDEN CELEBRATION",
    modes: ALL_MODES,
    instruction: "Choose a comfortable celebration pose and hold it gently.",
    spokenInstruction:
      "Choose a comfortable celebration pose. Lift or open your arms, and hold gently.",
    detector: "celebration",
    duration: 20000,
    demonstration: "celebration",
    feedback: ["Garden complete!", "A wonderful finish!"],
    difficulty: 1,
    safetyNotes:
      "Stay seated or keep both feet on the floor. Do not balance on one leg.",
  }),
]);

/**
 * Return the challenges compatible with a play mode.
 * With no mode, a new array containing the complete session is returned.
 */
export function getChallenges(mode) {
  if (mode === undefined || mode === null || mode === "") {
    return [...CHALLENGES];
  }

  const normalisedMode = String(mode).trim().toLowerCase();
  return CHALLENGES.filter((challenge) =>
    challenge.modes.includes(normalisedMode),
  );
}
