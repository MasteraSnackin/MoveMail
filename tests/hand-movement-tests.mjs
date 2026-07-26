import assert from "node:assert/strict";
import test from "node:test";

import {
  HAND_LANDMARKS,
  closedFist,
  createHandHoldDetector,
  detectHandMovement,
  fingerSpread,
  gentlePinch,
  indexTap,
  openHand,
  pinch,
  pointIndex,
  thumbUp,
  victoryFingers,
} from "../js/hand-movements.js";

function point(x, y, confidence = 0.98) {
  return {
    x,
    y,
    z: 0,
    visibility: confidence,
    presence: confidence,
  };
}

const FINGERS = Object.freeze({
  index: Object.freeze([5, 6, 7, 8]),
  middle: Object.freeze([9, 10, 11, 12]),
  ring: Object.freeze([13, 14, 15, 16]),
  pinky: Object.freeze([17, 18, 19, 20]),
});

function basePalm() {
  const landmarks = Array.from({ length: 21 }, () => point(0.5, 0.7));
  landmarks[HAND_LANDMARKS.WRIST] = point(0.5, 0.9);
  landmarks[HAND_LANDMARKS.THUMB_CMC] = point(0.38, 0.78);
  landmarks[HAND_LANDMARKS.THUMB_MCP] = point(0.31, 0.7);
  landmarks[HAND_LANDMARKS.THUMB_IP] = point(0.24, 0.62);
  landmarks[HAND_LANDMARKS.THUMB_TIP] = point(0.17, 0.54);
  landmarks[HAND_LANDMARKS.INDEX_MCP] = point(0.4, 0.65);
  landmarks[HAND_LANDMARKS.MIDDLE_MCP] = point(0.5, 0.62);
  landmarks[HAND_LANDMARKS.RING_MCP] = point(0.59, 0.64);
  landmarks[HAND_LANDMARKS.PINKY_MCP] = point(0.68, 0.69);
  return landmarks;
}

function setStraightFinger(landmarks, name, tipX, tipY) {
  const indices = FINGERS[name];
  const mcp = landmarks[indices[0]];
  for (let index = 1; index < indices.length; index += 1) {
    const ratio = index / 3;
    landmarks[indices[index]] = point(
      mcp.x + (tipX - mcp.x) * ratio,
      mcp.y + (tipY - mcp.y) * ratio,
    );
  }
}

function setCurledFinger(landmarks, name) {
  const [mcpIndex, pipIndex, dipIndex, tipIndex] = FINGERS[name];
  const mcp = landmarks[mcpIndex];
  const inward = Math.sign(0.5 - mcp.x) || 1;
  landmarks[pipIndex] = point(mcp.x, mcp.y - 0.12);
  landmarks[dipIndex] = point(
    mcp.x + inward * 0.055,
    mcp.y - 0.055,
  );
  landmarks[tipIndex] = point(
    mcp.x + inward * 0.075,
    mcp.y + 0.005,
  );
}

function openPose({ spread = true } = {}) {
  const landmarks = basePalm();
  const tips = spread
    ? {
        index: [0.34, 0.18],
        middle: [0.48, 0.1],
        ring: [0.62, 0.16],
        pinky: [0.75, 0.27],
      }
    : {
        index: [0.47, 0.16],
        middle: [0.49, 0.1],
        ring: [0.51, 0.15],
        pinky: [0.53, 0.22],
      };
  for (const [name, [x, y]] of Object.entries(tips)) {
    setStraightFinger(landmarks, name, x, y);
  }
  return landmarks;
}

function fistPose() {
  const landmarks = basePalm();
  for (const name of Object.keys(FINGERS)) {
    setCurledFinger(landmarks, name);
  }
  landmarks[HAND_LANDMARKS.THUMB_CMC] = point(0.38, 0.78);
  landmarks[HAND_LANDMARKS.THUMB_MCP] = point(0.38, 0.7);
  landmarks[HAND_LANDMARKS.THUMB_IP] = point(0.43, 0.68);
  landmarks[HAND_LANDMARKS.THUMB_TIP] = point(0.49, 0.7);
  return landmarks;
}

function pointPose() {
  const landmarks = fistPose();
  setStraightFinger(landmarks, "index", 0.36, 0.15);
  return landmarks;
}

function victoryPose() {
  const landmarks = fistPose();
  setStraightFinger(landmarks, "index", 0.34, 0.17);
  setStraightFinger(landmarks, "middle", 0.55, 0.1);
  return landmarks;
}

function thumbUpPose() {
  const landmarks = fistPose();
  landmarks[HAND_LANDMARKS.THUMB_CMC] = point(0.39, 0.78);
  landmarks[HAND_LANDMARKS.THUMB_MCP] = point(0.32, 0.68);
  landmarks[HAND_LANDMARKS.THUMB_IP] = point(0.25, 0.58);
  landmarks[HAND_LANDMARKS.THUMB_TIP] = point(0.18, 0.48);
  return landmarks;
}

function pinchPose() {
  const landmarks = openPose({ spread: false });
  landmarks[HAND_LANDMARKS.THUMB_CMC] = point(0.38, 0.78);
  landmarks[HAND_LANDMARKS.THUMB_MCP] = point(0.38, 0.68);
  landmarks[HAND_LANDMARKS.THUMB_IP] = point(0.42, 0.61);
  landmarks[HAND_LANDMARKS.THUMB_TIP] = point(0.46, 0.56);
  landmarks[HAND_LANDMARKS.INDEX_PIP] = point(0.4, 0.48);
  landmarks[HAND_LANDMARKS.INDEX_DIP] = point(0.43, 0.51);
  landmarks[HAND_LANDMARKS.INDEX_TIP] = point(0.465, 0.565);
  return landmarks;
}

function mirror(landmarks) {
  return landmarks.map((landmark) => ({
    ...landmark,
    x: 1 - landmark.x,
  }));
}

function asHandLandmarkerOutput(landmarks) {
  return landmarks.map((landmark) => ({
    x: landmark.x,
    y: landmark.y,
    z: landmark.z,
    // The web task materialises its unsupported per-point visibility as 0.
    visibility: 0,
  }));
}

test("openHand accepts four extended fingers and rejects a fist", () => {
  assert.equal(openHand(openPose()), true);
  assert.equal(openHand(fistPose()), false);
});

test("closedFist accepts four curled fingers and rejects an open hand", () => {
  assert.equal(closedFist(fistPose()), true);
  assert.equal(closedFist(openPose()), false);
});

test("pointIndex requires only the index finger to be extended", () => {
  assert.equal(pointIndex(pointPose()), true);
  assert.equal(pointIndex(victoryPose()), false);
  assert.equal(pointIndex(fistPose()), false);
});

test("gentlePinch and indexTap/pinch aliases use thumb-index proximity", () => {
  const touching = pinchPose();
  assert.equal(gentlePinch(touching), true);
  assert.equal(indexTap(touching), true);
  assert.equal(pinch(touching), true);
  assert.equal(gentlePinch(openPose()), false);
});

test("victoryFingers requires separated index and middle fingers", () => {
  assert.equal(victoryFingers(victoryPose()), true);
  assert.equal(victoryFingers(pointPose()), false);
});

test("thumbUp accepts an extended thumb over a curled hand", () => {
  assert.equal(thumbUp(thumbUpPose()), true);
  assert.equal(thumbUp(fistPose()), false);
  assert.equal(thumbUp(openPose()), false);
});

test("fingerSpread distinguishes spread and together extended fingers", () => {
  assert.equal(fingerSpread(openPose({ spread: true })), true);
  assert.equal(fingerSpread(openPose({ spread: false })), false);
  assert.equal(openHand(openPose({ spread: false })), true);
});

test("all detectors fail safely for missing or low-confidence data", () => {
  const lowConfidence = openPose();
  lowConfidence[HAND_LANDMARKS.INDEX_TIP].visibility = 0.05;
  lowConfidence[HAND_LANDMARKS.INDEX_TIP].presence = 0.05;
  const detectors = [
    openHand,
    closedFist,
    pointIndex,
    gentlePinch,
    victoryFingers,
    thumbUp,
    fingerSpread,
  ];
  for (const detector of detectors) {
    assert.equal(detector(null), false);
    assert.equal(detector([]), false);
    assert.equal(detector(lowConfidence), false);
  }
});

test("distance and angle geometry is invariant under horizontal mirroring", () => {
  const fixtures = [
    [openHand, openPose()],
    [closedFist, fistPose()],
    [pointIndex, pointPose()],
    [gentlePinch, pinchPose()],
    [victoryFingers, victoryPose()],
    [thumbUp, thumbUpPose()],
    [fingerSpread, openPose()],
  ];
  for (const [detector, fixture] of fixtures) {
    assert.equal(detector(fixture), true);
    assert.equal(detector(mirror(fixture)), true);
  }
});

test("real Hand Landmarker visibility placeholders remain usable", () => {
  const fixtures = [
    [openHand, openPose()],
    [closedFist, fistPose()],
    [pointIndex, pointPose()],
    [gentlePinch, pinchPose()],
    [victoryFingers, victoryPose()],
    [thumbUp, thumbUpPose()],
    [fingerSpread, openPose()],
  ];
  for (const [detector, fixture] of fixtures) {
    assert.equal(detector(asHandLandmarkerOutput(fixture)), true);
  }
});

test("named dispatcher accepts punctuation aliases and rejects unknown names", () => {
  assert.equal(detectHandMovement("open-hand", openPose()), true);
  assert.equal(detectHandMovement("indexTap/pinch", pinchPose()), true);
  assert.equal(detectHandMovement("thumb_up", thumbUpPose()), true);
  assert.equal(detectHandMovement("not-a-gesture", openPose()), false);
});

test("createHandHoldDetector matches the app update contract", () => {
  const held = createHandHoldDetector("openHand", { holdMs: 500 });
  const pose = openPose();
  assert.equal(held.update(pose, 0).complete, false);
  assert.equal(held.update(pose, 180).movement, true);
  assert.equal(held.update(pose, 360).complete, false);
  const completed = held.update(pose, 510);
  assert.equal(completed.complete, true);
  assert.equal(completed.progress, 1);
  assert.equal(held(pose, 520), true);
});

test("the hold tolerates a brief miss but resets after a long gap", () => {
  const held = createHandHoldDetector(openHand, {
    holdMs: 500,
    graceMs: 150,
  });
  const pose = openPose();
  held.update(pose, 0);
  held.update(pose, 140);
  assert.equal(held.update(fistPose(), 240).complete, false);
  assert.equal(held.update(pose, 330).complete, false);
  assert.equal(held.update(pose, 510).complete, true);

  held.reset();
  held.update(pose, 0);
  held.update(pose, 120);
  held.update(fistPose(), 300);
  assert.equal(held.update(pose, 420).progress, 0);
  assert.equal(held.update(pose, 930).complete, true);
});
