import assert from "node:assert/strict";
import test from "node:test";

import {
  calibrationFromObservations,
  clampTargetFraction,
  createCalibrationEnvelope,
  createHoldState,
  createWaveEvidence,
  evaluateMovement,
  holdSignal,
  mirrorLandmarks,
  mirrorX,
  movementThresholds,
  normalisePose,
  poseConfidence,
  smoothLandmarks,
  updateHoldState,
  updateWaveEvidence,
} from "../lib/game/engine.ts";

const visible = 0.98;

function landmark(x, y, confidence = visible) {
  return {
    x,
    y,
    z: 0,
    visibility: confidence,
    presence: confidence,
  };
}

function landmarks({
  leftShoulder = [0.4, 0.5],
  rightShoulder = [0.6, 0.5],
  leftWrist = [0.2, 0.35],
  rightWrist = [0.8, 0.35],
  confidence = visible,
} = {}) {
  return {
    leftShoulder: landmark(...leftShoulder, confidence),
    rightShoulder: landmark(...rightShoulder, confidence),
    leftWrist: landmark(...leftWrist, confidence),
    rightWrist: landmark(...rightWrist, confidence),
  };
}

const calibration = createCalibrationEnvelope({
  leftOutwardMax: 1.5,
  rightOutwardMax: 1.5,
  openArmsMax: 3,
  neutralWristGap: 2,
  handsTogetherMinGap: 0.1,
  waveRangeMax: 0.8,
  waveMinimumUp: 0.2,
  targetFraction: 0.75,
});

test("mirrors x without changing anatomical landmark names or input", () => {
  const source = landmarks();
  const mirrored = mirrorLandmarks(source);

  assert.equal(mirrorX(0.2), 0.8);
  assert.equal(mirrored.leftWrist.x, 0.8);
  assert.ok(Math.abs(mirrored.rightWrist.x - 0.2) < 1e-12);
  assert.equal(source.leftWrist.x, 0.2);
});

test("normalises wrists by shoulder centre and width in either camera layout", () => {
  const pose = normalisePose(landmarks());
  const mirroredPose = normalisePose(mirrorLandmarks(landmarks()));

  assert.ok(pose);
  assert.ok(mirroredPose);
  assert.equal(pose.shoulderCentre.x, 0.5);
  assert.ok(Math.abs(pose.shoulderWidth - 0.2) < 1e-12);
  assert.ok(Math.abs(pose.wrists.left.outward - 1.5) < 1e-12);
  assert.ok(Math.abs(pose.wrists.right.outward - 1.5) < 1e-12);
  assert.ok(Math.abs(pose.wrists.left.up - 0.75) < 1e-12);
  assert.ok(
    Math.abs(
      pose.wrists.left.outward - mirroredPose.wrists.left.outward,
    ) < 1e-12,
  );
  assert.equal(pose.screenLeftIsAnatomicalLeft, true);
  assert.equal(mirroredPose.screenLeftIsAnatomicalLeft, false);
});

test("returns null for incomplete or degenerate pose geometry", () => {
  const incomplete = landmarks();
  delete incomplete.leftWrist;

  assert.equal(normalisePose(incomplete), null);
  assert.equal(
    normalisePose(
      landmarks({
        leftShoulder: [0.5, 0.5],
        rightShoulder: [0.5, 0.5],
      }),
    ),
    null,
  );
});

test("uses the weakest required landmark as pose confidence", () => {
  const source = landmarks();
  source.rightWrist = landmark(0.8, 0.35, 0.42);

  assert.equal(poseConfidence(source), 0.42);
  assert.equal(
    poseConfidence({
      ...source,
      leftWrist: undefined,
    }),
    0,
  );
});

test("smooths geometry exponentially but never carries a missing landmark", () => {
  const previous = landmarks({
    leftWrist: [0.1, 0.3],
    rightWrist: [0.9, 0.3],
  });
  const current = landmarks({
    leftWrist: [0.3, 0.5],
    rightWrist: [0.7, 0.5],
    confidence: 0.7,
  });
  delete current.rightWrist;

  const smoothed = smoothLandmarks(previous, current, 0.25);
  assert.ok(Math.abs(smoothed.leftWrist.x - 0.15) < 1e-12);
  assert.ok(Math.abs(smoothed.leftWrist.y - 0.35) < 1e-12);
  assert.equal(smoothed.leftWrist.visibility, 0.7);
  assert.equal(smoothed.rightWrist, undefined);
});

test("clamps calibrated game targets to 70–80% of observations", () => {
  assert.equal(clampTargetFraction(0.5), 0.7);
  assert.equal(clampTargetFraction(0.75), 0.75);
  assert.equal(clampTargetFraction(0.95), 0.8);

  const low = movementThresholds(
    createCalibrationEnvelope({
      ...calibration,
      targetFraction: 0.2,
    }),
  );
  const high = movementThresholds(
    createCalibrationEnvelope({
      ...calibration,
      targetFraction: 0.95,
    }),
  );

  assert.equal(low.reachLeft, 1.5 * 0.7);
  assert.equal(high.reachLeft, 1.5 * 0.8);
  assert.equal(low.openArms, 3 * 0.7);
  assert.equal(high.waveRange, 0.8 * 0.8);
  assert.equal(
    high.handsTogetherGap,
    2 - (2 - 0.1) * 0.8,
  );
});

test("builds a calibration envelope from named pose observations", () => {
  const neutral = normalisePose(
    landmarks({
      leftWrist: [0.35, 0.5],
      rightWrist: [0.65, 0.5],
    }),
  );
  const open = normalisePose(landmarks());
  const together = normalisePose(
    landmarks({
      leftWrist: [0.49, 0.5],
      rightWrist: [0.51, 0.5],
    }),
  );
  const observed = calibrationFromObservations({
    neutral,
    reachLeft: open,
    reachRight: open,
    openArms: open,
    handsTogether: together,
    waveRangeMax: 0.6,
    targetFraction: 0.76,
  });

  assert.ok(Math.abs(observed.leftOutwardMax - 1.5) < 1e-12);
  assert.ok(Math.abs(observed.rightOutwardMax - 1.5) < 1e-12);
  assert.ok(Math.abs(observed.openArmsMax - 3) < 1e-12);
  assert.ok(Math.abs(observed.neutralWristGap - 1.5) < 1e-12);
  assert.ok(Math.abs(observed.handsTogetherMinGap - 0.1) < 1e-12);
  assert.equal(observed.targetFraction, 0.76);
});

test("matches left reach, right reach and open arms", () => {
  const pose = normalisePose(landmarks());
  assert.ok(pose);

  for (const movement of [
    "reach_left",
    "reach_right",
    "open_arms",
  ]) {
    const result = evaluateMovement(movement, pose, calibration);
    assert.equal(result.status, "matching");
    assert.equal(result.isMatching, true);
    assert.equal(result.score, 1);
  }
});

test("matches hands together using calibrated closing travel", () => {
  const together = normalisePose(
    landmarks({
      leftWrist: [0.49, 0.5],
      rightWrist: [0.51, 0.5],
    }),
  );
  const apart = normalisePose(
    landmarks({
      leftWrist: [0.32, 0.5],
      rightWrist: [0.68, 0.5],
    }),
  );

  const match = evaluateMovement(
    "hands_together",
    together,
    calibration,
  );
  const noMatch = evaluateMovement(
    "hands_together",
    apart,
    calibration,
  );
  assert.equal(match.isMatching, true);
  assert.equal(match.score, 1);
  assert.equal(noMatch.isMatching, false);
  assert.ok(noMatch.score < 1);
});

test("requires side-to-side travel, a reversal and hand height for a wave", () => {
  const poses = [
    normalisePose(landmarks({ rightWrist: [0.68, 0.36] })),
    normalisePose(landmarks({ rightWrist: [0.82, 0.36] })),
    normalisePose(landmarks({ rightWrist: [0.66, 0.36] })),
  ];
  let evidence = createWaveEvidence("right");
  poses.forEach((pose, index) => {
    evidence = updateWaveEvidence(evidence, pose, index * 100);
  });

  const result = evaluateMovement(
    "gentle_wave",
    poses.at(-1),
    calibration,
    { waveEvidence: evidence },
  );
  assert.ok(evidence.horizontalRange > 0.6);
  assert.equal(evidence.directionChanges, 1);
  assert.equal(result.isMatching, true);
  assert.equal(result.score, 1);
});

test("an interrupted wave sample pauses and cannot add movement evidence", () => {
  const first = normalisePose(
    landmarks({ rightWrist: [0.68, 0.36] }),
  );
  const second = normalisePose(
    landmarks({ rightWrist: [0.82, 0.36] }),
  );
  let evidence = updateWaveEvidence(
    createWaveEvidence("right"),
    first,
    0,
  );
  evidence = updateWaveEvidence(evidence, null, 100);

  assert.equal(evidence.paused, true);
  assert.equal(evidence.horizontalRange, 0);

  evidence = updateWaveEvidence(evidence, second, 200);
  assert.equal(evidence.paused, false);
  assert.equal(evidence.horizontalRange, 0);
  assert.equal(evidence.directionChanges, 0);
});

test("missing and low-confidence landmarks pause with zero score", () => {
  const missing = evaluateMovement(
    "reach_left",
    normalisePose({
      leftShoulder: landmark(0.4, 0.5),
    }),
    calibration,
  );
  const lowConfidence = evaluateMovement(
    "reach_left",
    normalisePose(landmarks({ confidence: 0.3 })),
    calibration,
  );

  assert.deepEqual(
    {
      status: missing.status,
      score: missing.score,
      signal: holdSignal(missing),
    },
    { status: "paused", score: 0, signal: null },
  );
  assert.deepEqual(
    {
      status: lowConfidence.status,
      score: lowConfidence.score,
      signal: holdSignal(lowConfidence),
    },
    { status: "paused", score: 0, signal: null },
  );
});

test("hold duration excludes paused and release-grace time", () => {
  const options = { holdDurationMs: 700, releaseGraceMs: 200 };
  let state = createHoldState();

  state = updateHoldState(state, true, 0, options);
  state = updateHoldState(state, true, 300, options);
  assert.equal(state.heldMs, 300);

  state = updateHoldState(state, null, 500, options);
  state = updateHoldState(state, true, 1_000, options);
  assert.equal(state.heldMs, 300);
  assert.equal(state.complete, false);

  state = updateHoldState(state, false, 1_100, options);
  assert.equal(state.status, "releasing");
  state = updateHoldState(state, true, 1_200, options);
  assert.equal(state.heldMs, 300);

  state = updateHoldState(state, true, 1_600, options);
  assert.equal(state.heldMs, 700);
  assert.equal(state.complete, true);
  assert.equal(state.progress, 1);
});

test("hold hysteresis resets only after the release grace expires", () => {
  const options = { holdDurationMs: 700, releaseGraceMs: 180 };
  let state = createHoldState();
  state = updateHoldState(state, true, 0, options);
  state = updateHoldState(state, true, 300, options);
  state = updateHoldState(state, false, 350, options);
  state = updateHoldState(state, false, 500, options);

  assert.equal(state.status, "releasing");
  assert.equal(state.heldMs, 300);

  state = updateHoldState(state, false, 531, options);
  assert.equal(state.status, "idle");
  assert.equal(state.heldMs, 0);
});
