export const POSE_LANDMARK_NAMES = [
  "leftShoulder",
  "rightShoulder",
  "leftWrist",
  "rightWrist",
] as const;

export type PoseLandmarkName = (typeof POSE_LANDMARK_NAMES)[number];

export interface PoseLandmark {
  readonly x: number;
  readonly y: number;
  readonly z?: number;
  readonly visibility?: number;
  readonly presence?: number;
}

export type PoseLandmarkSubset = Partial<
  Record<PoseLandmarkName, PoseLandmark>
>;

export type CompletePoseLandmarks = Record<PoseLandmarkName, PoseLandmark>;

export interface Point2D {
  readonly x: number;
  readonly y: number;
}

export interface NormalisedWrist extends Point2D {
  /**
   * Distance from the shoulder centre towards this wrist's side, measured in
   * shoulder widths. Positive values point outwards in either camera layout.
   */
  readonly outward: number;
  /**
   * Height above the shoulder centre, measured in shoulder widths.
   */
  readonly up: number;
}

export interface NormalisedPose {
  readonly shoulderCentre: Point2D;
  readonly shoulderWidth: number;
  readonly confidence: number;
  readonly screenLeftIsAnatomicalLeft: boolean;
  readonly wrists: {
    readonly left: NormalisedWrist;
    readonly right: NormalisedWrist;
  };
  readonly wristDistance: number;
  readonly outwardSpan: number;
}

export type MovementId =
  | "reach_left"
  | "reach_right"
  | "open_arms"
  | "hands_together"
  | "gentle_wave";

export interface CalibrationEnvelope {
  /** Largest observed left reach, in shoulder widths. */
  readonly leftOutwardMax: number;
  /** Largest observed right reach, in shoulder widths. */
  readonly rightOutwardMax: number;
  /** Largest observed two-hand outward span, in shoulder widths. */
  readonly openArmsMax: number;
  /** Wrist gap before the calibrated movements, in shoulder widths. */
  readonly neutralWristGap: number;
  /** Smallest observed wrist gap, in shoulder widths. */
  readonly handsTogetherMinGap: number;
  /** Largest observed side-to-side hand travel, in shoulder widths. */
  readonly waveRangeMax: number;
  /** Minimum hand height used by the wave matcher, in shoulder widths. */
  readonly waveMinimumUp: number;
  /**
   * Portion of the observed comfortable movement used by the game. This is
   * always clamped to the inclusive 0.70–0.80 interval.
   */
  readonly targetFraction: number;
}

export type CalibrationInput = Partial<CalibrationEnvelope>;

export interface MovementThresholds {
  readonly reachLeft: number;
  readonly reachRight: number;
  readonly openArms: number;
  readonly handsTogetherGap: number;
  readonly waveRange: number;
  readonly waveMinimumUp: number;
  readonly targetFraction: number;
}

export type WaveHand = "left" | "right";
export type HorizontalDirection = -1 | 0 | 1;

export interface WaveEvidence {
  readonly hand: WaveHand;
  readonly minX: number | null;
  readonly maxX: number | null;
  readonly lastX: number | null;
  readonly lastDirection: HorizontalDirection;
  readonly directionChanges: number;
  readonly horizontalRange: number;
  readonly sampleCount: number;
  readonly lastTimestampMs: number | null;
  readonly paused: boolean;
}

export interface WaveUpdateOptions {
  readonly minimumConfidence?: number;
  readonly directionDeadZone?: number;
  readonly maximumSampleGapMs?: number;
}

export type MovementEvaluationStatus = "paused" | "moving" | "matching";
export type MovementPauseReason =
  | "missing_landmarks"
  | "low_confidence";

export interface MovementEvaluation {
  readonly movement: MovementId;
  readonly status: MovementEvaluationStatus;
  readonly isMatching: boolean;
  /** Normalised 0–1 matcher progress, not a clinical measurement. */
  readonly score: number;
  readonly confidence: number;
  readonly metric: number | null;
  readonly target: number;
  readonly pauseReason?: MovementPauseReason;
}

export interface MovementEvaluationOptions {
  readonly minimumConfidence?: number;
  readonly waveEvidence?: WaveEvidence | null;
  readonly waveHand?: WaveHand;
}

export type HoldStatus =
  | "idle"
  | "holding"
  | "releasing"
  | "paused"
  | "complete";

export interface HoldState {
  readonly status: HoldStatus;
  readonly heldMs: number;
  readonly progress: number;
  readonly complete: boolean;
  readonly lastUpdateMs: number | null;
  readonly mismatchStartedAtMs: number | null;
}

export interface HoldOptions {
  readonly holdDurationMs?: number;
  /**
   * A brief non-matching interval does not discard progress. Time inside this
   * interval is never added to the hold.
   */
  readonly releaseGraceMs?: number;
}

export interface CalibrationObservations {
  readonly neutral?: NormalisedPose | null;
  readonly reachLeft?: NormalisedPose | null;
  readonly reachRight?: NormalisedPose | null;
  readonly openArms?: NormalisedPose | null;
  readonly handsTogether?: NormalisedPose | null;
  readonly waveRangeMax?: number;
  readonly waveMinimumUp?: number;
  readonly targetFraction?: number;
}

const MIN_SHOULDER_WIDTH = 0.0001;
const DEFAULT_MINIMUM_CONFIDENCE = 0.55;
const DEFAULT_HOLD_DURATION_MS = 700;
const DEFAULT_RELEASE_GRACE_MS = 180;
const MIN_TARGET_FRACTION = 0.7;
const MAX_TARGET_FRACTION = 0.8;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function finiteOr(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : fallback;
}

function positiveOr(value: number | undefined, fallback: number): number {
  const candidate = finiteOr(value, fallback);
  return candidate > 0 ? candidate : fallback;
}

function landmarkConfidence(landmark: PoseLandmark | undefined): number {
  if (!landmark) {
    return 0;
  }

  const visibility = finiteOr(landmark.visibility, 0);
  const presence = finiteOr(landmark.presence, visibility);
  return clamp(Math.min(visibility, presence), 0, 1);
}

function hasFinitePosition(
  landmark: PoseLandmark | undefined,
): landmark is PoseLandmark {
  return Boolean(
    landmark &&
      Number.isFinite(landmark.x) &&
      Number.isFinite(landmark.y),
  );
}

function completeLandmarks(
  landmarks: PoseLandmarkSubset,
): CompletePoseLandmarks | null {
  const { leftShoulder, rightShoulder, leftWrist, rightWrist } = landmarks;

  if (
    !hasFinitePosition(leftShoulder) ||
    !hasFinitePosition(rightShoulder) ||
    !hasFinitePosition(leftWrist) ||
    !hasFinitePosition(rightWrist)
  ) {
    return null;
  }

  return { leftShoulder, rightShoulder, leftWrist, rightWrist };
}

/**
 * Selects the four landmarks used by the game from a MediaPipe-style landmark
 * array. Landmark names remain anatomical; mirroring is handled separately.
 */
export function selectPoseLandmarks(
  landmarks: readonly PoseLandmark[],
): PoseLandmarkSubset {
  return {
    leftShoulder: landmarks[11],
    rightShoulder: landmarks[12],
    leftWrist: landmarks[15],
    rightWrist: landmarks[16],
  };
}

export function mirrorX(x: number): number {
  return 1 - x;
}

function mirrorLandmark(
  landmark: PoseLandmark | undefined,
): PoseLandmark | undefined {
  return landmark ? { ...landmark, x: mirrorX(landmark.x) } : undefined;
}

/**
 * Mirrors coordinates without swapping anatomical landmark names.
 */
export function mirrorLandmarks(
  landmarks: PoseLandmarkSubset,
): PoseLandmarkSubset {
  return {
    leftShoulder: mirrorLandmark(landmarks.leftShoulder),
    rightShoulder: mirrorLandmark(landmarks.rightShoulder),
    leftWrist: mirrorLandmark(landmarks.leftWrist),
    rightWrist: mirrorLandmark(landmarks.rightWrist),
  };
}

export function poseConfidence(
  landmarks: PoseLandmarkSubset,
  required: readonly PoseLandmarkName[] = POSE_LANDMARK_NAMES,
): number {
  if (required.length === 0) {
    return 0;
  }

  return required.reduce(
    (minimum, name) =>
      Math.min(minimum, landmarkConfidence(landmarks[name])),
    1,
  );
}

function smoothOptionalCoordinate(
  previous: number | undefined,
  current: number | undefined,
  alpha: number,
): number | undefined {
  if (current === undefined || !Number.isFinite(current)) {
    return current;
  }
  if (previous === undefined || !Number.isFinite(previous)) {
    return current;
  }
  return previous + alpha * (current - previous);
}

export function smoothLandmark(
  previous: PoseLandmark | undefined,
  current: PoseLandmark | undefined,
  alpha: number,
): PoseLandmark | undefined {
  if (!current) {
    // Never carry a stale landmark into a frame where it was not detected.
    return undefined;
  }

  if (!previous) {
    return { ...current };
  }

  const boundedAlpha = clamp(finiteOr(alpha, 1), 0, 1);
  const z = smoothOptionalCoordinate(previous.z, current.z, boundedAlpha);

  return {
    x: previous.x + boundedAlpha * (current.x - previous.x),
    y: previous.y + boundedAlpha * (current.y - previous.y),
    ...(z === undefined ? {} : { z }),
    // Current-frame confidence is intentionally not smoothed.
    visibility: current.visibility,
    presence: current.presence,
  };
}

/**
 * Applies exponential smoothing to geometry while retaining current-frame
 * detection confidence and current-frame missing landmarks.
 */
export function smoothLandmarks(
  previous: PoseLandmarkSubset | null | undefined,
  current: PoseLandmarkSubset,
  alpha = 0.35,
): PoseLandmarkSubset {
  return {
    leftShoulder: smoothLandmark(
      previous?.leftShoulder,
      current.leftShoulder,
      alpha,
    ),
    rightShoulder: smoothLandmark(
      previous?.rightShoulder,
      current.rightShoulder,
      alpha,
    ),
    leftWrist: smoothLandmark(
      previous?.leftWrist,
      current.leftWrist,
      alpha,
    ),
    rightWrist: smoothLandmark(
      previous?.rightWrist,
      current.rightWrist,
      alpha,
    ),
  };
}

/**
 * Expresses wrist positions relative to the shoulder centre and shoulder width.
 * The outward values are orientation-independent, so callers may use mirrored
 * or unmirrored camera coordinates.
 */
export function normalisePose(
  landmarks: PoseLandmarkSubset,
): NormalisedPose | null {
  const complete = completeLandmarks(landmarks);
  if (!complete) {
    return null;
  }

  const {
    leftShoulder,
    rightShoulder,
    leftWrist,
    rightWrist,
  } = complete;
  const shoulderCentre = {
    x: (leftShoulder.x + rightShoulder.x) / 2,
    y: (leftShoulder.y + rightShoulder.y) / 2,
  };
  const shoulderWidth = Math.hypot(
    leftShoulder.x - rightShoulder.x,
    leftShoulder.y - rightShoulder.y,
  );

  if (!Number.isFinite(shoulderWidth) || shoulderWidth < MIN_SHOULDER_WIDTH) {
    return null;
  }

  const leftOutwardSign = leftShoulder.x <= rightShoulder.x ? -1 : 1;
  const rightOutwardSign = -leftOutwardSign;

  const normaliseWrist = (
    wrist: PoseLandmark,
    outwardSign: number,
  ): NormalisedWrist => {
    const x = (wrist.x - shoulderCentre.x) / shoulderWidth;
    const y = (wrist.y - shoulderCentre.y) / shoulderWidth;
    return {
      x,
      y,
      outward: x * outwardSign,
      up: -y,
    };
  };

  const left = normaliseWrist(leftWrist, leftOutwardSign);
  const right = normaliseWrist(rightWrist, rightOutwardSign);

  return {
    shoulderCentre,
    shoulderWidth,
    confidence: poseConfidence(complete),
    screenLeftIsAnatomicalLeft: leftShoulder.x <= rightShoulder.x,
    wrists: { left, right },
    wristDistance: Math.hypot(left.x - right.x, left.y - right.y),
    outwardSpan: Math.max(0, left.outward) + Math.max(0, right.outward),
  };
}

/** US-spelling alias for integrations that use it. */
export const normalizePose = normalisePose;

export function clampTargetFraction(value: number): number {
  return clamp(
    finiteOr(value, 0.75),
    MIN_TARGET_FRACTION,
    MAX_TARGET_FRACTION,
  );
}

export function createCalibrationEnvelope(
  input: CalibrationInput = {},
): CalibrationEnvelope {
  const neutralWristGap = positiveOr(input.neutralWristGap, 1.6);
  const handsTogetherMinGap = clamp(
    finiteOr(input.handsTogetherMinGap, 0.18),
    0,
    neutralWristGap,
  );

  return {
    leftOutwardMax: positiveOr(input.leftOutwardMax, 1.45),
    rightOutwardMax: positiveOr(input.rightOutwardMax, 1.45),
    openArmsMax: positiveOr(input.openArmsMax, 2.9),
    neutralWristGap,
    handsTogetherMinGap,
    waveRangeMax: positiveOr(input.waveRangeMax, 0.7),
    waveMinimumUp: Math.max(0, finiteOr(input.waveMinimumUp, 0.15)),
    targetFraction: clampTargetFraction(
      finiteOr(input.targetFraction, 0.75),
    ),
  };
}

export const DEFAULT_CALIBRATION: CalibrationEnvelope =
  createCalibrationEnvelope();

export function calibrationFromObservations(
  observations: CalibrationObservations,
): CalibrationEnvelope {
  return createCalibrationEnvelope({
    leftOutwardMax: observations.reachLeft?.wrists.left.outward,
    rightOutwardMax: observations.reachRight?.wrists.right.outward,
    openArmsMax: observations.openArms?.outwardSpan,
    neutralWristGap: observations.neutral?.wristDistance,
    handsTogetherMinGap: observations.handsTogether?.wristDistance,
    waveRangeMax: observations.waveRangeMax,
    waveMinimumUp: observations.waveMinimumUp,
    targetFraction: observations.targetFraction,
  });
}

/**
 * Converts observed comfortable movement into game targets. Outward, open-arm
 * and wave targets are always 70–80% of the corresponding observation. The
 * hands-together target uses the same fraction of the observed closing travel.
 */
export function movementThresholds(
  calibration: CalibrationEnvelope = DEFAULT_CALIBRATION,
): MovementThresholds {
  const targetFraction = clampTargetFraction(calibration.targetFraction);
  const neutralWristGap = positiveOr(
    calibration.neutralWristGap,
    DEFAULT_CALIBRATION.neutralWristGap,
  );
  const minimumGap = clamp(
    finiteOr(
      calibration.handsTogetherMinGap,
      DEFAULT_CALIBRATION.handsTogetherMinGap,
    ),
    0,
    neutralWristGap,
  );

  return {
    reachLeft:
      positiveOr(
        calibration.leftOutwardMax,
        DEFAULT_CALIBRATION.leftOutwardMax,
      ) * targetFraction,
    reachRight:
      positiveOr(
        calibration.rightOutwardMax,
        DEFAULT_CALIBRATION.rightOutwardMax,
      ) * targetFraction,
    openArms:
      positiveOr(calibration.openArmsMax, DEFAULT_CALIBRATION.openArmsMax) *
      targetFraction,
    handsTogetherGap:
      neutralWristGap -
      (neutralWristGap - minimumGap) * targetFraction,
    waveRange:
      positiveOr(calibration.waveRangeMax, DEFAULT_CALIBRATION.waveRangeMax) *
      targetFraction,
    waveMinimumUp: Math.max(
      0,
      finiteOr(
        calibration.waveMinimumUp,
        DEFAULT_CALIBRATION.waveMinimumUp,
      ),
    ),
    targetFraction,
  };
}

function evaluationTarget(
  movement: MovementId,
  thresholds: MovementThresholds,
): number {
  switch (movement) {
    case "reach_left":
      return thresholds.reachLeft;
    case "reach_right":
      return thresholds.reachRight;
    case "open_arms":
      return thresholds.openArms;
    case "hands_together":
      return thresholds.handsTogetherGap;
    case "gentle_wave":
      return thresholds.waveRange;
  }
}

function pausedEvaluation(
  movement: MovementId,
  thresholds: MovementThresholds,
  confidence: number,
  pauseReason: MovementPauseReason,
): MovementEvaluation {
  return {
    movement,
    status: "paused",
    isMatching: false,
    score: 0,
    confidence,
    metric: null,
    target: evaluationTarget(movement, thresholds),
    pauseReason,
  };
}

function activeEvaluation(
  movement: MovementId,
  confidence: number,
  metric: number,
  target: number,
  score: number,
  isMatching: boolean,
): MovementEvaluation {
  return {
    movement,
    status: isMatching ? "matching" : "moving",
    isMatching,
    score: clamp(score, 0, 1),
    confidence,
    metric,
    target,
  };
}

/**
 * Evaluates one movement without mutating pose, calibration or wave state.
 * A null pose or a low-confidence pose always pauses with a zero score.
 */
export function evaluateMovement(
  movement: MovementId,
  pose: NormalisedPose | null,
  calibration: CalibrationEnvelope = DEFAULT_CALIBRATION,
  options: MovementEvaluationOptions = {},
): MovementEvaluation {
  const thresholds = movementThresholds(calibration);
  if (!pose) {
    return pausedEvaluation(
      movement,
      thresholds,
      0,
      "missing_landmarks",
    );
  }

  const minimumConfidence = clamp(
    finiteOr(options.minimumConfidence, DEFAULT_MINIMUM_CONFIDENCE),
    0,
    1,
  );
  if (pose.confidence < minimumConfidence) {
    return pausedEvaluation(
      movement,
      thresholds,
      pose.confidence,
      "low_confidence",
    );
  }

  switch (movement) {
    case "reach_left": {
      const metric = pose.wrists.left.outward;
      const target = thresholds.reachLeft;
      return activeEvaluation(
        movement,
        pose.confidence,
        metric,
        target,
        metric / target,
        metric >= target,
      );
    }
    case "reach_right": {
      const metric = pose.wrists.right.outward;
      const target = thresholds.reachRight;
      return activeEvaluation(
        movement,
        pose.confidence,
        metric,
        target,
        metric / target,
        metric >= target,
      );
    }
    case "open_arms": {
      const metric = pose.outwardSpan;
      const target = thresholds.openArms;
      return activeEvaluation(
        movement,
        pose.confidence,
        metric,
        target,
        metric / target,
        metric >= target,
      );
    }
    case "hands_together": {
      const metric = pose.wristDistance;
      const target = thresholds.handsTogetherGap;
      const closingTravel =
        calibration.neutralWristGap - pose.wristDistance;
      const targetTravel =
        calibration.neutralWristGap - thresholds.handsTogetherGap;
      const score =
        targetTravel <= 0 ? Number(metric <= target) : closingTravel / targetTravel;
      return activeEvaluation(
        movement,
        pose.confidence,
        metric,
        target,
        score,
        metric <= target,
      );
    }
    case "gentle_wave": {
      const hand = options.waveHand ?? options.waveEvidence?.hand ?? "right";
      const wrist = pose.wrists[hand];
      const evidence =
        options.waveEvidence?.hand === hand ? options.waveEvidence : null;
      const metric = evidence?.horizontalRange ?? 0;
      const target = thresholds.waveRange;
      const rangeScore = metric / target;
      const heightScore =
        thresholds.waveMinimumUp <= 0
          ? 1
          : wrist.up / thresholds.waveMinimumUp;
      const directionScore =
        (evidence?.directionChanges ?? 0) >= 1 ? 1 : 0;
      const score = Math.min(rangeScore, heightScore, directionScore);
      const isMatching =
        Boolean(evidence && !evidence.paused) &&
        metric >= target &&
        wrist.up >= thresholds.waveMinimumUp &&
        directionScore === 1;

      return activeEvaluation(
        movement,
        pose.confidence,
        metric,
        target,
        score,
        isMatching,
      );
    }
  }
}

export function evaluateReachLeft(
  pose: NormalisedPose | null,
  calibration: CalibrationEnvelope = DEFAULT_CALIBRATION,
  options?: MovementEvaluationOptions,
): MovementEvaluation {
  return evaluateMovement("reach_left", pose, calibration, options);
}

export function evaluateReachRight(
  pose: NormalisedPose | null,
  calibration: CalibrationEnvelope = DEFAULT_CALIBRATION,
  options?: MovementEvaluationOptions,
): MovementEvaluation {
  return evaluateMovement("reach_right", pose, calibration, options);
}

export function evaluateOpenArms(
  pose: NormalisedPose | null,
  calibration: CalibrationEnvelope = DEFAULT_CALIBRATION,
  options?: MovementEvaluationOptions,
): MovementEvaluation {
  return evaluateMovement("open_arms", pose, calibration, options);
}

export function evaluateHandsTogether(
  pose: NormalisedPose | null,
  calibration: CalibrationEnvelope = DEFAULT_CALIBRATION,
  options?: MovementEvaluationOptions,
): MovementEvaluation {
  return evaluateMovement("hands_together", pose, calibration, options);
}

export function evaluateGentleWave(
  pose: NormalisedPose | null,
  calibration: CalibrationEnvelope = DEFAULT_CALIBRATION,
  options?: MovementEvaluationOptions,
): MovementEvaluation {
  return evaluateMovement("gentle_wave", pose, calibration, options);
}

export function createWaveEvidence(hand: WaveHand = "right"): WaveEvidence {
  return {
    hand,
    minX: null,
    maxX: null,
    lastX: null,
    lastDirection: 0,
    directionChanges: 0,
    horizontalRange: 0,
    sampleCount: 0,
    lastTimestampMs: null,
    paused: false,
  };
}

function pausedWaveEvidence(
  previous: WaveEvidence,
  nowMs: number,
): WaveEvidence {
  return {
    ...previous,
    lastX: null,
    lastDirection: 0,
    lastTimestampMs: nowMs,
    paused: true,
  };
}

/**
 * Adds one valid camera sample to a side-to-side wave trace. An interrupted or
 * low-confidence trace cannot gain range or direction changes.
 */
export function updateWaveEvidence(
  previous: WaveEvidence,
  pose: NormalisedPose | null,
  nowMs: number,
  options: WaveUpdateOptions = {},
): WaveEvidence {
  if (!Number.isFinite(nowMs)) {
    throw new RangeError("nowMs must be finite");
  }

  const minimumConfidence = clamp(
    finiteOr(options.minimumConfidence, DEFAULT_MINIMUM_CONFIDENCE),
    0,
    1,
  );
  if (!pose || pose.confidence < minimumConfidence) {
    return pausedWaveEvidence(previous, nowMs);
  }

  const maximumSampleGapMs = Math.max(
    0,
    finiteOr(options.maximumSampleGapMs, 500),
  );
  const sampleGap =
    previous.lastTimestampMs === null
      ? 0
      : Math.max(0, nowMs - previous.lastTimestampMs);
  const mustRestart =
    previous.paused ||
    previous.lastX === null ||
    sampleGap > maximumSampleGapMs;
  const x = pose.wrists[previous.hand].x;

  if (mustRestart) {
    return {
      hand: previous.hand,
      minX: x,
      maxX: x,
      lastX: x,
      lastDirection: 0,
      directionChanges: 0,
      horizontalRange: 0,
      sampleCount: 1,
      lastTimestampMs: nowMs,
      paused: false,
    };
  }

  const deadZone = Math.max(
    0,
    finiteOr(options.directionDeadZone, 0.04),
  );
  const delta = x - previous.lastX;
  const direction: HorizontalDirection =
    Math.abs(delta) < deadZone ? 0 : delta > 0 ? 1 : -1;
  const changedDirection =
    direction !== 0 &&
    previous.lastDirection !== 0 &&
    direction !== previous.lastDirection;
  const nextDirection =
    direction === 0 ? previous.lastDirection : direction;
  const minX = Math.min(previous.minX ?? x, x);
  const maxX = Math.max(previous.maxX ?? x, x);

  return {
    hand: previous.hand,
    minX,
    maxX,
    lastX: direction === 0 ? previous.lastX : x,
    lastDirection: nextDirection,
    directionChanges:
      previous.directionChanges + Number(changedDirection),
    horizontalRange: maxX - minX,
    sampleCount: previous.sampleCount + 1,
    lastTimestampMs: nowMs,
    paused: false,
  };
}

export function createHoldState(
  lastUpdateMs: number | null = null,
): HoldState {
  return {
    status: "idle",
    heldMs: 0,
    progress: 0,
    complete: false,
    lastUpdateMs,
    mismatchStartedAtMs: null,
  };
}

function holdProgress(heldMs: number, holdDurationMs: number): number {
  return clamp(heldMs / holdDurationMs, 0, 1);
}

/**
 * Updates a movement hold. Use `null` for `isMatching` while landmarks are
 * missing or below the confidence threshold. Paused and release-grace time is
 * never added to the hold.
 */
export function updateHoldState(
  previous: HoldState,
  isMatching: boolean | null,
  nowMs: number,
  options: HoldOptions = {},
): HoldState {
  if (!Number.isFinite(nowMs)) {
    throw new RangeError("nowMs must be finite");
  }

  const holdDurationMs = Math.max(
    1,
    finiteOr(options.holdDurationMs, DEFAULT_HOLD_DURATION_MS),
  );
  const releaseGraceMs = Math.max(
    0,
    finiteOr(options.releaseGraceMs, DEFAULT_RELEASE_GRACE_MS),
  );
  const effectiveNow =
    previous.lastUpdateMs === null
      ? nowMs
      : Math.max(nowMs, previous.lastUpdateMs);
  const elapsed =
    previous.lastUpdateMs === null
      ? 0
      : effectiveNow - previous.lastUpdateMs;

  if (previous.complete) {
    return {
      ...previous,
      status: "complete",
      progress: 1,
      lastUpdateMs: effectiveNow,
    };
  }

  if (isMatching === null) {
    return {
      ...previous,
      status: "paused",
      progress: holdProgress(previous.heldMs, holdDurationMs),
      lastUpdateMs: effectiveNow,
      mismatchStartedAtMs: null,
    };
  }

  if (isMatching) {
    const heldMs =
      previous.heldMs +
      (previous.status === "holding" ? elapsed : 0);
    const complete = heldMs >= holdDurationMs;
    return {
      status: complete ? "complete" : "holding",
      heldMs,
      progress: holdProgress(heldMs, holdDurationMs),
      complete,
      lastUpdateMs: effectiveNow,
      mismatchStartedAtMs: null,
    };
  }

  if (previous.heldMs <= 0 || previous.status === "idle") {
    return createHoldState(effectiveNow);
  }

  if (
    previous.status === "releasing" &&
    previous.mismatchStartedAtMs !== null
  ) {
    if (
      effectiveNow - previous.mismatchStartedAtMs >
      releaseGraceMs
    ) {
      return createHoldState(effectiveNow);
    }

    return {
      ...previous,
      status: "releasing",
      progress: holdProgress(previous.heldMs, holdDurationMs),
      lastUpdateMs: effectiveNow,
    };
  }

  return {
    ...previous,
    status: "releasing",
    progress: holdProgress(previous.heldMs, holdDurationMs),
    lastUpdateMs: effectiveNow,
    mismatchStartedAtMs: effectiveNow,
  };
}

export function holdSignal(
  evaluation: MovementEvaluation,
): boolean | null {
  return evaluation.status === "paused"
    ? null
    : evaluation.isMatching;
}
