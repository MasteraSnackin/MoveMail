/**
 * Geometry-based hand gesture detectors for MediaPipe's 21 hand landmarks.
 *
 * All thresholds are relative to palm size and all gesture decisions use
 * distances or joint angles. This makes them independent of camera pixels,
 * handedness and horizontal mirroring. Landmarks may omit visibility/presence,
 * as MediaPipe Hand Landmarker commonly does.
 */

export const HAND_LANDMARKS = Object.freeze({
  WRIST: 0,
  THUMB_CMC: 1,
  THUMB_MCP: 2,
  THUMB_IP: 3,
  THUMB_TIP: 4,
  INDEX_MCP: 5,
  INDEX_PIP: 6,
  INDEX_DIP: 7,
  INDEX_TIP: 8,
  MIDDLE_MCP: 9,
  MIDDLE_PIP: 10,
  MIDDLE_DIP: 11,
  MIDDLE_TIP: 12,
  RING_MCP: 13,
  RING_PIP: 14,
  RING_DIP: 15,
  RING_TIP: 16,
  PINKY_MCP: 17,
  PINKY_PIP: 18,
  PINKY_DIP: 19,
  PINKY_TIP: 20,
});

export const HAND_TOLERANCES = Object.freeze({
  minimumConfidence: 0.35,
  minimumPalmScale: 0.025,
  straightPipAngle: 142,
  straightDipAngle: 132,
  extendedFromMcpPalmRatio: 0.62,
  extendedTipReachRatio: 1.01,
  curledJointAngle: 128,
  curledTipReachRatio: 0.96,
  curledTipToPalmRatio: 1.02,
  thumbStraightAngle: 132,
  thumbTipToPalmRatio: 0.72,
  pinchGapPalmRatio: 0.34,
  pinchTipToPalmMinimum: 0.28,
  victoryGapPalmRatio: 0.3,
  spreadAverageGapPalmRatio: 0.31,
  spreadOuterSpanPalmRatio: 0.94,
});

export const DEFAULT_HAND_HOLD_MS = 500;

const FINGER_INDICES = Object.freeze({
  index: Object.freeze([
    HAND_LANDMARKS.INDEX_MCP,
    HAND_LANDMARKS.INDEX_PIP,
    HAND_LANDMARKS.INDEX_DIP,
    HAND_LANDMARKS.INDEX_TIP,
  ]),
  middle: Object.freeze([
    HAND_LANDMARKS.MIDDLE_MCP,
    HAND_LANDMARKS.MIDDLE_PIP,
    HAND_LANDMARKS.MIDDLE_DIP,
    HAND_LANDMARKS.MIDDLE_TIP,
  ]),
  ring: Object.freeze([
    HAND_LANDMARKS.RING_MCP,
    HAND_LANDMARKS.RING_PIP,
    HAND_LANDMARKS.RING_DIP,
    HAND_LANDMARKS.RING_TIP,
  ]),
  pinky: Object.freeze([
    HAND_LANDMARKS.PINKY_MCP,
    HAND_LANDMARKS.PINKY_PIP,
    HAND_LANDMARKS.PINKY_DIP,
    HAND_LANDMARKS.PINKY_TIP,
  ]),
});

const FINGER_NAMES = Object.freeze(Object.keys(FINGER_INDICES));

function confidenceOf(point) {
  if (!point) return 0;

  // MediaPipe Hand Landmarker uses 0 as a placeholder visibility value for
  // otherwise valid landmarks. Its whole-hand presence threshold has already
  // filtered the result, so use per-point presence only when it is available.
  return Number.isFinite(point.presence) ? point.presence : 1;
}

export function isHandLandmarkVisible(
  point,
  minimumConfidence = HAND_TOLERANCES.minimumConfidence,
) {
  return Boolean(
    point &&
      Number.isFinite(point.x) &&
      Number.isFinite(point.y) &&
      confidenceOf(point) >= minimumConfidence,
  );
}

function visiblePoint(landmarks, index) {
  const point = Array.isArray(landmarks) ? landmarks[index] : null;
  return isHandLandmarkVisible(point) ? point : null;
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function averagePoint(points) {
  return {
    x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
    y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
  };
}

function angleDegrees(a, vertex, c) {
  const firstX = a.x - vertex.x;
  const firstY = a.y - vertex.y;
  const secondX = c.x - vertex.x;
  const secondY = c.y - vertex.y;
  const firstLength = Math.hypot(firstX, firstY);
  const secondLength = Math.hypot(secondX, secondY);
  if (firstLength < 1e-6 || secondLength < 1e-6) return 0;
  const cosine = Math.min(
    1,
    Math.max(
      -1,
      (firstX * secondX + firstY * secondY) /
        (firstLength * secondLength),
    ),
  );
  return (Math.acos(cosine) * 180) / Math.PI;
}

/**
 * Derives a stable palm centre and scale. The scale averages palm width and
 * wrist-to-middle-MCP length, avoiding dependence on one camera axis.
 */
export function measureHand(landmarks) {
  const wrist = visiblePoint(landmarks, HAND_LANDMARKS.WRIST);
  const indexMcp = visiblePoint(landmarks, HAND_LANDMARKS.INDEX_MCP);
  const middleMcp = visiblePoint(landmarks, HAND_LANDMARKS.MIDDLE_MCP);
  const ringMcp = visiblePoint(landmarks, HAND_LANDMARKS.RING_MCP);
  const pinkyMcp = visiblePoint(landmarks, HAND_LANDMARKS.PINKY_MCP);
  if (!wrist || !indexMcp || !middleMcp || !ringMcp || !pinkyMcp) {
    return null;
  }

  const palmWidth = distance(indexMcp, pinkyMcp);
  const palmLength = distance(wrist, middleMcp);
  const palmScale = (palmWidth + palmLength) / 2;
  if (
    !Number.isFinite(palmScale) ||
    palmScale < HAND_TOLERANCES.minimumPalmScale
  ) {
    return null;
  }

  return {
    wrist,
    palmCentre: averagePoint([
      wrist,
      indexMcp,
      middleMcp,
      ringMcp,
      pinkyMcp,
    ]),
    palmScale,
    palmWidth,
    palmLength,
  };
}

function fingerMetrics(landmarks, name, frame) {
  const indices = FINGER_INDICES[name];
  if (!indices || !frame) return null;
  const points = indices.map((index) => visiblePoint(landmarks, index));
  if (points.some((point) => !point)) return null;
  const [mcp, pip, dip, tip] = points;
  const pipAngle = angleDegrees(mcp, pip, dip);
  const dipAngle = angleDegrees(pip, dip, tip);
  const tipFromMcp = distance(tip, mcp) / frame.palmScale;
  const tipReach =
    distance(tip, frame.wrist) /
    Math.max(distance(pip, frame.wrist), 1e-6);
  const tipToPalm = distance(tip, frame.palmCentre) / frame.palmScale;

  return {
    mcp,
    pip,
    dip,
    tip,
    pipAngle,
    dipAngle,
    tipFromMcp,
    tipReach,
    tipToPalm,
    extended:
      pipAngle >= HAND_TOLERANCES.straightPipAngle &&
      dipAngle >= HAND_TOLERANCES.straightDipAngle &&
      tipFromMcp >= HAND_TOLERANCES.extendedFromMcpPalmRatio &&
      tipReach >= HAND_TOLERANCES.extendedTipReachRatio,
    curled:
      (pipAngle <= HAND_TOLERANCES.curledJointAngle ||
        dipAngle <= HAND_TOLERANCES.curledJointAngle ||
        tipReach <= HAND_TOLERANCES.curledTipReachRatio) &&
      tipToPalm <= HAND_TOLERANCES.curledTipToPalmRatio,
  };
}

function thumbMetrics(landmarks, frame) {
  if (!frame) return null;
  const cmc = visiblePoint(landmarks, HAND_LANDMARKS.THUMB_CMC);
  const mcp = visiblePoint(landmarks, HAND_LANDMARKS.THUMB_MCP);
  const ip = visiblePoint(landmarks, HAND_LANDMARKS.THUMB_IP);
  const tip = visiblePoint(landmarks, HAND_LANDMARKS.THUMB_TIP);
  if (!cmc || !mcp || !ip || !tip) return null;

  const mcpAngle = angleDegrees(cmc, mcp, ip);
  const ipAngle = angleDegrees(mcp, ip, tip);
  const tipToPalm = distance(tip, frame.palmCentre) / frame.palmScale;
  const tipReach =
    distance(tip, frame.wrist) /
    Math.max(distance(ip, frame.wrist), 1e-6);

  return {
    cmc,
    mcp,
    ip,
    tip,
    mcpAngle,
    ipAngle,
    tipToPalm,
    tipReach,
    extended:
      mcpAngle >= HAND_TOLERANCES.thumbStraightAngle &&
      ipAngle >= HAND_TOLERANCES.thumbStraightAngle &&
      tipToPalm >= HAND_TOLERANCES.thumbTipToPalmRatio &&
      tipReach >= 0.95,
  };
}

function analyseHand(landmarks) {
  const frame = measureHand(landmarks);
  if (!frame) return null;
  const fingers = Object.fromEntries(
    FINGER_NAMES.map((name) => [
      name,
      fingerMetrics(landmarks, name, frame),
    ]),
  );
  if (Object.values(fingers).some((metrics) => !metrics)) return null;
  const thumb = thumbMetrics(landmarks, frame);
  if (!thumb) return null;
  return { frame, fingers, thumb };
}

function allFingers(analysis, property, names = FINGER_NAMES) {
  return Boolean(
    analysis &&
      names.every((name) => analysis.fingers[name]?.[property] === true),
  );
}

export function openHand(landmarks) {
  const analysis = analyseHand(landmarks);
  return allFingers(analysis, "extended");
}

export function closedFist(landmarks) {
  const analysis = analyseHand(landmarks);
  return allFingers(analysis, "curled");
}

export function pointIndex(landmarks) {
  const analysis = analyseHand(landmarks);
  return Boolean(
    analysis?.fingers.index.extended &&
      allFingers(analysis, "curled", ["middle", "ring", "pinky"]),
  );
}

export function gentlePinch(landmarks) {
  const analysis = analyseHand(landmarks);
  if (!analysis) return false;
  const gap =
    distance(analysis.thumb.tip, analysis.fingers.index.tip) /
    analysis.frame.palmScale;
  const pinchCentre = averagePoint([
    analysis.thumb.tip,
    analysis.fingers.index.tip,
  ]);
  const pinchToPalm =
    distance(pinchCentre, analysis.frame.palmCentre) /
    analysis.frame.palmScale;

  return (
    gap <= HAND_TOLERANCES.pinchGapPalmRatio &&
    pinchToPalm >= HAND_TOLERANCES.pinchTipToPalmMinimum
  );
}

export function victoryFingers(landmarks) {
  const analysis = analyseHand(landmarks);
  if (!analysis) return false;
  const separation =
    distance(analysis.fingers.index.tip, analysis.fingers.middle.tip) /
    analysis.frame.palmScale;
  return (
    analysis.fingers.index.extended &&
    analysis.fingers.middle.extended &&
    allFingers(analysis, "curled", ["ring", "pinky"]) &&
    separation >= HAND_TOLERANCES.victoryGapPalmRatio
  );
}

/**
 * "Thumb up" is detected relative to the closed hand rather than screen-up.
 * That deliberately tolerates left/right hands, camera rotation and mirroring.
 */
export function thumbUp(landmarks) {
  const analysis = analyseHand(landmarks);
  return Boolean(
    analysis?.thumb.extended && allFingers(analysis, "curled"),
  );
}

export function fingerSpread(landmarks) {
  const analysis = analyseHand(landmarks);
  if (!analysis || !allFingers(analysis, "extended")) return false;
  const tips = FINGER_NAMES.map((name) => analysis.fingers[name].tip);
  const adjacentGaps = tips
    .slice(0, -1)
    .map(
      (tip, index) =>
        distance(tip, tips[index + 1]) / analysis.frame.palmScale,
    );
  const averageGap =
    adjacentGaps.reduce((sum, gap) => sum + gap, 0) /
    adjacentGaps.length;
  const outerSpan =
    distance(tips[0], tips.at(-1)) / analysis.frame.palmScale;

  return (
    averageGap >= HAND_TOLERANCES.spreadAverageGapPalmRatio &&
    outerSpan >= HAND_TOLERANCES.spreadOuterSpanPalmRatio
  );
}

// A gentle index-to-thumb tap is the same geometry as a pinch in this MVP.
export const indexTap = gentlePinch;
export const pinch = gentlePinch;

export const HAND_MOVEMENT_DETECTORS = Object.freeze({
  openHand,
  closedFist,
  pointIndex,
  gentlePinch,
  victoryFingers,
  thumbUp,
  fingerSpread,
  indexTap,
  pinch,
});

const HAND_MOVEMENT_ALIASES = Object.freeze({
  openhand: "openHand",
  closedfist: "closedFist",
  pointindex: "pointIndex",
  indexpoint: "pointIndex",
  gentlepinch: "gentlePinch",
  victoryfingers: "victoryFingers",
  victory: "victoryFingers",
  thumbup: "thumbUp",
  fingerspread: "fingerSpread",
  indextap: "indexTap",
  pinch: "pinch",
  indextappinch: "indexTap",
});

function resolveDetectorName(name) {
  if (typeof name !== "string") return null;
  if (Object.hasOwn(HAND_MOVEMENT_DETECTORS, name)) return name;
  const compact = name.replace(/[^a-z0-9]+/gi, "").toLowerCase();
  return HAND_MOVEMENT_ALIASES[compact] ?? null;
}

export function detectHandMovement(name, landmarks) {
  const resolvedName = resolveDetectorName(name);
  return resolvedName
    ? Boolean(HAND_MOVEMENT_DETECTORS[resolvedName](landmarks))
    : false;
}

function monotonicNow() {
  return globalThis.performance?.now?.() ?? Date.now();
}

function createRollingHandHold({
  holdMs = DEFAULT_HAND_HOLD_MS,
  graceMs = 150,
  minimumMatchRatio = 0.72,
  clock = monotonicNow,
} = {}) {
  const safeHoldMs = Math.max(
    100,
    Number(holdMs) || DEFAULT_HAND_HOLD_MS,
  );
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
    const matchedSamples = samples.filter((sample) => sample.matched).length;
    const matchRatio = samples.length
      ? matchedSamples / samples.length
      : 0;
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

  function update(matching, timestamp = clock()) {
    const time = Number.isFinite(timestamp) ? timestamp : clock();
    lastTimestamp = time;

    if (complete) {
      return { ...snapshot(time), matching: Boolean(matching) };
    }

    if (matching) {
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
      samples.push({ time, matched: Boolean(matching) });
      const status = snapshot(time);
      if (
        status.elapsedMs >= safeHoldMs &&
        status.matchRatio >= safeMinimumRatio
      ) {
        complete = true;
      }
    }

    return { ...snapshot(time), matching: Boolean(matching) };
  }

  return Object.freeze({ update, reset, snapshot });
}

/**
 * App-compatible temporal wrapper.
 *
 * const held = createHandHoldDetector("openHand", { holdMs: 500 });
 * held.update(landmarks, timestamp) -> { movement, progress, complete, ... }
 * held(landmarks, timestamp) -> boolean complete
 */
export function createHandHoldDetector(
  detectorOrName,
  { mode = "hand", ...holdOptions } = {},
) {
  const detector =
    typeof detectorOrName === "function"
      ? detectorOrName
      : (landmarks) => detectHandMovement(detectorOrName, landmarks);
  const hold = createRollingHandHold(holdOptions);

  function detailedUpdate(landmarks, timestamp) {
    const time = Number.isFinite(timestamp)
      ? timestamp
      : holdOptions.clock?.() ?? monotonicNow();
    const movement = Boolean(detector(landmarks));
    return {
      ...hold.update(movement, time),
      movement,
    };
  }

  function heldDetector(landmarks, timestamp) {
    return detailedUpdate(landmarks, timestamp).complete;
  }

  heldDetector.update = detailedUpdate;
  heldDetector.reset = hold.reset;
  heldDetector.snapshot = hold.snapshot;
  heldDetector.mode = mode;
  return heldDetector;
}
