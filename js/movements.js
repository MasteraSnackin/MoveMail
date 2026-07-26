/**
 * Forgiving, body-relative movement detectors for MoveMail.
 *
 * MediaPipe coordinates are normalised to the image (0–1). The detector
 * thresholds below are expressed relative to shoulder width or torso height,
 * so they continue to work when the player moves nearer to or farther from the
 * camera. All detectors return false when the landmarks they need are missing
 * or have low visibility.
 */

export const LANDMARKS = Object.freeze({
  NOSE: 0,
  LEFT_EYE_INNER: 1,
  LEFT_EYE: 2,
  LEFT_EYE_OUTER: 3,
  RIGHT_EYE_INNER: 4,
  RIGHT_EYE: 5,
  RIGHT_EYE_OUTER: 6,
  LEFT_EAR: 7,
  RIGHT_EAR: 8,
  MOUTH_LEFT: 9,
  MOUTH_RIGHT: 10,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_PINKY: 17,
  RIGHT_PINKY: 18,
  LEFT_INDEX: 19,
  RIGHT_INDEX: 20,
  LEFT_THUMB: 21,
  RIGHT_THUMB: 22,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
  LEFT_HEEL: 29,
  RIGHT_HEEL: 30,
  LEFT_FOOT_INDEX: 31,
  RIGHT_FOOT_INDEX: 32,
});

const STANDING_TOLERANCES = Object.freeze({
  minimumVisibility: 0.45,
  handRaiseTorsoRatio: 0.16,
  reachShoulderWidths: 0.62,
  reachElbowShoulderWidths: 0.12,
  reachVerticalTorsoRatio: 0.72,
  armsOpenShoulderWidths: 0.5,
  armsOpenElbowShoulderWidths: 0.14,
  armsOpenVerticalTorsoRatio: 0.62,
  leanShoulderWidths: 0.14,
  waveHandHeightTorsoRatio: 0.22,
  waveAmplitudeShoulderWidths: 0.3,
  waveMinimumStepShoulderWidths: 0.035,
  waveWindowMs: 1_350,
});

const SEATED_TOLERANCES = Object.freeze({
  minimumVisibility: 0.4,
  handRaiseTorsoRatio: 0.1,
  reachShoulderWidths: 0.48,
  reachElbowShoulderWidths: 0.08,
  reachVerticalTorsoRatio: 0.88,
  armsOpenShoulderWidths: 0.38,
  armsOpenElbowShoulderWidths: 0.08,
  armsOpenVerticalTorsoRatio: 0.78,
  leanShoulderWidths: 0.1,
  waveHandHeightTorsoRatio: 0.3,
  waveAmplitudeShoulderWidths: 0.22,
  waveMinimumStepShoulderWidths: 0.025,
  waveWindowMs: 1_500,
});

export const TOLERANCES = Object.freeze({
  standing: STANDING_TOLERANCES,
  seated: SEATED_TOLERANCES,
});

export const DEFAULT_HOLD_MS = 550;

function normaliseMode(mode) {
  return String(mode).toLowerCase() === "seated" ? "seated" : "standing";
}

function toleranceFor(mode) {
  return TOLERANCES[normaliseMode(mode)];
}

function confidenceOf(point) {
  if (!point) return 0;
  const visibility = Number.isFinite(point.visibility) ? point.visibility : 1;
  const presence = Number.isFinite(point.presence) ? point.presence : 1;
  return Math.min(visibility, presence);
}

export function isLandmarkVisible(point, minimumVisibility = 0.4) {
  return Boolean(
    point &&
      Number.isFinite(point.x) &&
      Number.isFinite(point.y) &&
      confidenceOf(point) >= minimumVisibility,
  );
}

function getVisibleLandmark(landmarks, index, minimumVisibility) {
  const point = Array.isArray(landmarks) ? landmarks[index] : undefined;
  return isLandmarkVisible(point, minimumVisibility) ? point : null;
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function midpoint(a, b) {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
  };
}

/**
 * Returns a scale and orientation frame for a visible upper body.
 *
 * leftDirection is +1 when the anatomical left side points towards increasing
 * image x and -1 when it points towards decreasing image x. This keeps "left"
 * and "right" anatomical even when the video presentation is mirrored.
 */
export function measureBody(landmarks, mode = "standing", requireHips = false) {
  const tolerance = toleranceFor(mode);
  const leftShoulder = getVisibleLandmark(
    landmarks,
    LANDMARKS.LEFT_SHOULDER,
    tolerance.minimumVisibility,
  );
  const rightShoulder = getVisibleLandmark(
    landmarks,
    LANDMARKS.RIGHT_SHOULDER,
    tolerance.minimumVisibility,
  );

  if (!leftShoulder || !rightShoulder) return null;

  const shoulderWidth = distance(leftShoulder, rightShoulder);
  if (!Number.isFinite(shoulderWidth) || shoulderWidth < 0.025) return null;

  const shoulderCentre = midpoint(leftShoulder, rightShoulder);
  const leftHip = getVisibleLandmark(
    landmarks,
    LANDMARKS.LEFT_HIP,
    tolerance.minimumVisibility,
  );
  const rightHip = getVisibleLandmark(
    landmarks,
    LANDMARKS.RIGHT_HIP,
    tolerance.minimumVisibility,
  );
  const hipsVisible = Boolean(leftHip && rightHip);

  if (requireHips && !hipsVisible) return null;

  const hipCentre = hipsVisible ? midpoint(leftHip, rightHip) : null;
  const measuredTorsoHeight = hipCentre
    ? distance(shoulderCentre, hipCentre)
    : 0;
  const torsoHeight =
    measuredTorsoHeight >= shoulderWidth * 0.45
      ? measuredTorsoHeight
      : shoulderWidth * 1.25;
  const leftDirection =
    Math.sign(leftShoulder.x - rightShoulder.x) || -1;

  return {
    leftShoulder,
    rightShoulder,
    leftHip,
    rightHip,
    shoulderCentre,
    hipCentre,
    shoulderWidth,
    torsoHeight,
    leftDirection,
    rightDirection: -leftDirection,
  };
}

function handRaised(landmarks, mode, side) {
  const tolerance = toleranceFor(mode);
  const frame = measureBody(landmarks, mode);
  if (!frame) return false;

  const shoulder =
    side === "left" ? frame.leftShoulder : frame.rightShoulder;
  const wrist = getVisibleLandmark(
    landmarks,
    side === "left" ? LANDMARKS.LEFT_WRIST : LANDMARKS.RIGHT_WRIST,
    tolerance.minimumVisibility,
  );

  return Boolean(
    wrist &&
      shoulder.y - wrist.y >=
        frame.torsoHeight * tolerance.handRaiseTorsoRatio,
  );
}

export function leftHandRaised(landmarks, mode = "standing") {
  return handRaised(landmarks, mode, "left");
}

export function rightHandRaised(landmarks, mode = "standing") {
  return handRaised(landmarks, mode, "right");
}

export function bothHandsRaised(landmarks, mode = "standing") {
  return (
    leftHandRaised(landmarks, mode) && rightHandRaised(landmarks, mode)
  );
}

function sideReach(landmarks, mode, side) {
  const tolerance = toleranceFor(mode);
  const frame = measureBody(landmarks, mode);
  if (!frame) return false;

  const isLeft = side === "left";
  const shoulder = isLeft ? frame.leftShoulder : frame.rightShoulder;
  const direction = isLeft ? frame.leftDirection : frame.rightDirection;
  const elbow = getVisibleLandmark(
    landmarks,
    isLeft ? LANDMARKS.LEFT_ELBOW : LANDMARKS.RIGHT_ELBOW,
    tolerance.minimumVisibility,
  );
  const wrist = getVisibleLandmark(
    landmarks,
    isLeft ? LANDMARKS.LEFT_WRIST : LANDMARKS.RIGHT_WRIST,
    tolerance.minimumVisibility,
  );
  if (!elbow || !wrist) return false;

  const wristExtension =
    ((wrist.x - shoulder.x) * direction) / frame.shoulderWidth;
  const elbowExtension =
    ((elbow.x - shoulder.x) * direction) / frame.shoulderWidth;
  const verticalOffset =
    Math.abs(wrist.y - shoulder.y) / frame.torsoHeight;

  return (
    wristExtension >= tolerance.reachShoulderWidths &&
    elbowExtension >= tolerance.reachElbowShoulderWidths &&
    verticalOffset <= tolerance.reachVerticalTorsoRatio
  );
}

export function leftReach(landmarks, mode = "standing") {
  return sideReach(landmarks, mode, "left");
}

export function rightReach(landmarks, mode = "standing") {
  return sideReach(landmarks, mode, "right");
}

export function armsOpen(landmarks, mode = "standing") {
  const tolerance = toleranceFor(mode);
  const frame = measureBody(landmarks, mode);
  if (!frame) return false;

  const leftElbow = getVisibleLandmark(
    landmarks,
    LANDMARKS.LEFT_ELBOW,
    tolerance.minimumVisibility,
  );
  const rightElbow = getVisibleLandmark(
    landmarks,
    LANDMARKS.RIGHT_ELBOW,
    tolerance.minimumVisibility,
  );
  const leftWrist = getVisibleLandmark(
    landmarks,
    LANDMARKS.LEFT_WRIST,
    tolerance.minimumVisibility,
  );
  const rightWrist = getVisibleLandmark(
    landmarks,
    LANDMARKS.RIGHT_WRIST,
    tolerance.minimumVisibility,
  );

  if (!leftElbow || !rightElbow || !leftWrist || !rightWrist) return false;

  const leftWristExtension =
    ((leftWrist.x - frame.leftShoulder.x) * frame.leftDirection) /
    frame.shoulderWidth;
  const rightWristExtension =
    ((rightWrist.x - frame.rightShoulder.x) * frame.rightDirection) /
    frame.shoulderWidth;
  const leftElbowExtension =
    ((leftElbow.x - frame.leftShoulder.x) * frame.leftDirection) /
    frame.shoulderWidth;
  const rightElbowExtension =
    ((rightElbow.x - frame.rightShoulder.x) * frame.rightDirection) /
    frame.shoulderWidth;
  const leftVerticalOffset =
    Math.abs(leftWrist.y - frame.leftShoulder.y) / frame.torsoHeight;
  const rightVerticalOffset =
    Math.abs(rightWrist.y - frame.rightShoulder.y) / frame.torsoHeight;

  return (
    leftWristExtension >= tolerance.armsOpenShoulderWidths &&
    rightWristExtension >= tolerance.armsOpenShoulderWidths &&
    leftElbowExtension >= tolerance.armsOpenElbowShoulderWidths &&
    rightElbowExtension >= tolerance.armsOpenElbowShoulderWidths &&
    leftVerticalOffset <= tolerance.armsOpenVerticalTorsoRatio &&
    rightVerticalOffset <= tolerance.armsOpenVerticalTorsoRatio
  );
}

function gentleLean(landmarks, mode, side) {
  const tolerance = toleranceFor(mode);
  const frame = measureBody(landmarks, mode, true);
  if (!frame?.hipCentre) return false;

  const direction =
    side === "left" ? frame.leftDirection : frame.rightDirection;
  const lean =
    ((frame.shoulderCentre.x - frame.hipCentre.x) * direction) /
    frame.shoulderWidth;

  return lean >= tolerance.leanShoulderWidths;
}

export function gentleLeftLean(landmarks, mode = "standing") {
  return gentleLean(landmarks, mode, "left");
}

export function gentleRightLean(landmarks, mode = "standing") {
  return gentleLean(landmarks, mode, "right");
}

export const leftLean = gentleLeftLean;
export const rightLean = gentleRightLean;

function monotonicNow() {
  if (globalThis.performance?.now) return globalThis.performance.now();
  return Date.now();
}

export function createMovementContext() {
  return {
    waveSamples: [],
    waveHand: null,
  };
}

const DEFAULT_CONTEXTS = {
  standing: createMovementContext(),
  seated: createMovementContext(),
};

export function resetMovementContext(context) {
  const contexts = context ? [context] : Object.values(DEFAULT_CONTEXTS);
  for (const item of contexts) {
    item.waveSamples = [];
    item.waveHand = null;
  }
}

function waveCandidate(landmarks, mode, side, frame) {
  const tolerance = toleranceFor(mode);
  const isLeft = side === "left";
  const shoulder = isLeft ? frame.leftShoulder : frame.rightShoulder;
  const wrist = getVisibleLandmark(
    landmarks,
    isLeft ? LANDMARKS.LEFT_WRIST : LANDMARKS.RIGHT_WRIST,
    tolerance.minimumVisibility,
  );
  if (!wrist) return null;

  const isHighEnough =
    wrist.y - shoulder.y <=
    frame.torsoHeight * tolerance.waveHandHeightTorsoRatio;
  if (!isHighEnough) return null;

  return {
    side,
    x: (wrist.x - shoulder.x) / frame.shoulderWidth,
    height: (shoulder.y - wrist.y) / frame.torsoHeight,
  };
}

/**
 * A lightweight temporal wave detector.
 *
 * Pass a per-session context from createMovementContext() when more than one
 * game may be active on the same page. Without one, a safe module-level context
 * is used. A wave needs horizontal travel plus a change in direction within a
 * short time window; one large reach is not accepted as a wave.
 */
export function wave(
  landmarks,
  mode = "standing",
  context = DEFAULT_CONTEXTS[normaliseMode(mode)],
  timestamp = monotonicNow(),
) {
  const tolerance = toleranceFor(mode);
  const frame = measureBody(landmarks, mode);
  if (!frame) {
    resetMovementContext(context);
    return false;
  }

  const candidates = [
    waveCandidate(landmarks, mode, "left", frame),
    waveCandidate(landmarks, mode, "right", frame),
  ].filter(Boolean);

  if (candidates.length === 0) {
    resetMovementContext(context);
    return false;
  }

  let candidate = candidates.find((item) => item.side === context.waveHand);
  if (!candidate) {
    candidate = candidates.reduce((best, item) =>
      item.height > best.height ? item : best,
    );
    context.waveHand = candidate.side;
    context.waveSamples = [];
  }

  context.waveSamples.push({
    time: timestamp,
    x: candidate.x,
  });
  context.waveSamples = context.waveSamples.filter(
    (sample) => timestamp - sample.time <= tolerance.waveWindowMs,
  );

  if (context.waveSamples.length < 4) return false;

  const xs = context.waveSamples.map((sample) => sample.x);
  const amplitude = Math.max(...xs) - Math.min(...xs);
  if (amplitude < tolerance.waveAmplitudeShoulderWidths) return false;

  const meaningfulDirections = [];
  for (let index = 1; index < xs.length; index += 1) {
    const delta = xs[index] - xs[index - 1];
    if (Math.abs(delta) >= tolerance.waveMinimumStepShoulderWidths) {
      meaningfulDirections.push(Math.sign(delta));
    }
  }

  return meaningfulDirections.some(
    (direction, index) =>
      index > 0 && direction !== meaningfulDirections[index - 1],
  );
}

export function celebration(
  landmarks,
  mode = "standing",
  context,
  timestamp,
) {
  if (bothHandsRaised(landmarks, mode) || armsOpen(landmarks, mode)) {
    return true;
  }
  return wave(landmarks, mode, context, timestamp);
}

export const MOVEMENT_DETECTORS = Object.freeze({
  leftHandRaised,
  rightHandRaised,
  bothHandsRaised,
  leftReach,
  rightReach,
  armsOpen,
  gentleLeftLean,
  gentleRightLean,
  leftLean,
  rightLean,
  wave,
  celebration,
});

const MOVEMENT_ALIASES = Object.freeze({
  lefthandraised: "leftHandRaised",
  righthandraised: "rightHandRaised",
  bothhandsraised: "bothHandsRaised",
  leftreach: "leftReach",
  rightreach: "rightReach",
  armsopen: "armsOpen",
  gentleleftlean: "gentleLeftLean",
  gentlerightlean: "gentleRightLean",
  leftlean: "leftLean",
  rightlean: "rightLean",
  wave: "wave",
  celebration: "celebration",
});

function resolveDetectorName(name) {
  if (typeof name !== "string") return null;
  if (Object.hasOwn(MOVEMENT_DETECTORS, name)) return name;
  const compact = name.replace(/[\s_-]+/g, "").toLowerCase();
  return MOVEMENT_ALIASES[compact] ?? null;
}

/**
 * Dispatches a named movement. Unknown names and incomplete poses simply
 * return false so gameplay can continue with a calm "move back into view"
 * state rather than an exception.
 */
export function detectMovement(
  name,
  landmarks,
  mode = "standing",
  context,
  timestamp,
) {
  const resolvedName = resolveDetectorName(name);
  if (!resolvedName) return false;
  return Boolean(
    MOVEMENT_DETECTORS[resolvedName](
      landmarks,
      normaliseMode(mode),
      context,
      timestamp,
    ),
  );
}

/**
 * A short rolling/hold gate. Small tracking drop-outs are tolerated, while a
 * longer gap resets the hold. update() returns a full status object so the UI
 * can show calm progress rather than a binary pass/fail flicker.
 */
export function createRollingHold({
  holdMs = DEFAULT_HOLD_MS,
  graceMs = 170,
  minimumMatchRatio = 0.72,
  clock = monotonicNow,
} = {}) {
  const safeHoldMs = Math.max(100, Number(holdMs) || DEFAULT_HOLD_MS);
  const safeGraceMs = Math.max(0, Number(graceMs) || 0);
  const safeMinimumRatio = Math.min(
    1,
    Math.max(0.5, Number(minimumMatchRatio) || 0.72),
  );

  let startedAt = null;
  let lastMatchedAt = null;
  let samples = [];
  let complete = false;
  let lastTimestamp = 0;

  function snapshot(timestamp = lastTimestamp) {
    const elapsedMs =
      startedAt === null ? 0 : Math.max(0, timestamp - startedAt);
    const matches = samples.filter((sample) => sample.matched).length;
    const matchRatio = samples.length ? matches / samples.length : 0;
    return {
      complete,
      elapsedMs,
      holdMs: safeHoldMs,
      progress: complete ? 1 : Math.min(1, elapsedMs / safeHoldMs),
      matchRatio,
      sampleCount: samples.length,
    };
  }

  function reset() {
    startedAt = null;
    lastMatchedAt = null;
    samples = [];
    complete = false;
    lastTimestamp = 0;
  }

  function update(isMatching, timestamp = clock()) {
    const time = Number.isFinite(timestamp) ? timestamp : clock();
    lastTimestamp = time;

    if (complete) {
      return {
        ...snapshot(time),
        matching: Boolean(isMatching),
      };
    }

    if (isMatching) {
      if (startedAt === null) startedAt = time;
      lastMatchedAt = time;
    } else if (
      lastMatchedAt === null ||
      time - lastMatchedAt > safeGraceMs
    ) {
      startedAt = null;
      lastMatchedAt = null;
      samples = [];
    }

    if (startedAt !== null) {
      samples.push({ time, matched: Boolean(isMatching) });
      samples = samples.filter((sample) => sample.time >= startedAt);

      const status = snapshot(time);
      if (
        status.elapsedMs >= safeHoldMs &&
        status.matchRatio >= safeMinimumRatio
      ) {
        complete = true;
      }
    }

    return {
      ...snapshot(time),
      matching: Boolean(isMatching),
    };
  }

  return Object.freeze({
    update,
    reset,
    snapshot,
  });
}

/**
 * Wraps either a detector function or a detector name with the rolling hold.
 *
 * The returned callable yields a boolean for convenient game-loop use.
 * callable.update(...) returns the detailed hold status, while reset() clears
 * both hold and wave history.
 */
export function createHoldDetector(
  detectorOrName,
  {
    mode = "standing",
    context = createMovementContext(),
    ...holdOptions
  } = {},
) {
  const detector =
    typeof detectorOrName === "function"
      ? detectorOrName
      : (landmarks, selectedMode, selectedContext, timestamp) =>
          detectMovement(
            detectorOrName,
            landmarks,
            selectedMode,
            selectedContext,
            timestamp,
          );
  const hold = createRollingHold(holdOptions);
  const selectedMode = normaliseMode(mode);

  function detailedUpdate(landmarks, timestamp) {
    const time = Number.isFinite(timestamp)
      ? timestamp
      : holdOptions.clock?.() ?? monotonicNow();
    const matching = Boolean(
      detector(landmarks, selectedMode, context, time),
    );
    return {
      ...hold.update(matching, time),
      movement: matching,
    };
  }

  function heldDetector(landmarks, timestamp) {
    return detailedUpdate(landmarks, timestamp).complete;
  }

  heldDetector.update = detailedUpdate;
  heldDetector.reset = () => {
    hold.reset();
    resetMovementContext(context);
  };
  heldDetector.snapshot = hold.snapshot;
  heldDetector.mode = selectedMode;
  heldDetector.context = context;

  return heldDetector;
}

export const createMovementHold = createHoldDetector;
