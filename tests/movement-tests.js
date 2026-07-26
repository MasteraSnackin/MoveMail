import {
  LANDMARKS,
  TOLERANCES,
  armsOpen,
  bothHandsRaised,
  celebration,
  createHoldDetector,
  createMovementContext,
  detectMovement,
  gentleLeftLean,
  gentleRightLean,
  leftHandRaised,
  leftReach,
  rightHandRaised,
  rightReach,
  wave,
} from "../js/movements.js";

const tests = [];

function test(name, run) {
  tests.push({ name, run });
}

function assert(value, message = "Expected a truthy result.") {
  if (!value) throw new Error(message);
}

function assertFalse(value, message = "Expected a false result.") {
  if (value) throw new Error(message);
}

function point(x, y, visibility = 0.98) {
  return { x, y, z: 0, visibility, presence: visibility };
}

/**
 * A synthetic, front-facing pose. MediaPipe's anatomical left/right labels are
 * retained. Detectors derive side orientation from the shoulders, so mirroring
 * this fixture does not change the expected movement.
 */
function neutralPose() {
  const landmarks = Array.from({ length: 33 }, () =>
    point(0.5, 0.5, 0.98),
  );
  landmarks[LANDMARKS.NOSE] = point(0.5, 0.17);
  landmarks[LANDMARKS.LEFT_EAR] = point(0.46, 0.18);
  landmarks[LANDMARKS.RIGHT_EAR] = point(0.54, 0.18);
  landmarks[LANDMARKS.LEFT_SHOULDER] = point(0.38, 0.36);
  landmarks[LANDMARKS.RIGHT_SHOULDER] = point(0.62, 0.36);
  landmarks[LANDMARKS.LEFT_ELBOW] = point(0.36, 0.49);
  landmarks[LANDMARKS.RIGHT_ELBOW] = point(0.64, 0.49);
  landmarks[LANDMARKS.LEFT_WRIST] = point(0.38, 0.61);
  landmarks[LANDMARKS.RIGHT_WRIST] = point(0.62, 0.61);
  landmarks[LANDMARKS.LEFT_HIP] = point(0.42, 0.66);
  landmarks[LANDMARKS.RIGHT_HIP] = point(0.58, 0.66);
  landmarks[LANDMARKS.LEFT_KNEE] = point(0.43, 0.83);
  landmarks[LANDMARKS.RIGHT_KNEE] = point(0.57, 0.83);
  landmarks[LANDMARKS.LEFT_ANKLE] = point(0.43, 0.97);
  landmarks[LANDMARKS.RIGHT_ANKLE] = point(0.57, 0.97);
  return landmarks;
}

function withPoints(changes) {
  const landmarks = neutralPose();
  for (const [index, value] of changes) landmarks[index] = value;
  return landmarks;
}

function mirrorPose(landmarks) {
  return landmarks.map((landmark) => ({
    ...landmark,
    x: 1 - landmark.x,
  }));
}

const leftRaisedPose = () =>
  withPoints([
    [LANDMARKS.LEFT_ELBOW, point(0.36, 0.3)],
    [LANDMARKS.LEFT_WRIST, point(0.37, 0.2)],
  ]);

const rightRaisedPose = () =>
  withPoints([
    [LANDMARKS.RIGHT_ELBOW, point(0.64, 0.3)],
    [LANDMARKS.RIGHT_WRIST, point(0.63, 0.2)],
  ]);

const bothRaisedPose = () =>
  withPoints([
    [LANDMARKS.LEFT_ELBOW, point(0.36, 0.3)],
    [LANDMARKS.LEFT_WRIST, point(0.37, 0.2)],
    [LANDMARKS.RIGHT_ELBOW, point(0.64, 0.3)],
    [LANDMARKS.RIGHT_WRIST, point(0.63, 0.2)],
  ]);

const leftReachPose = () =>
  withPoints([
    [LANDMARKS.LEFT_ELBOW, point(0.3, 0.37)],
    [LANDMARKS.LEFT_WRIST, point(0.18, 0.37)],
  ]);

const rightReachPose = () =>
  withPoints([
    [LANDMARKS.RIGHT_ELBOW, point(0.7, 0.37)],
    [LANDMARKS.RIGHT_WRIST, point(0.82, 0.37)],
  ]);

const armsOpenPose = () =>
  withPoints([
    [LANDMARKS.LEFT_ELBOW, point(0.3, 0.37)],
    [LANDMARKS.LEFT_WRIST, point(0.18, 0.37)],
    [LANDMARKS.RIGHT_ELBOW, point(0.7, 0.37)],
    [LANDMARKS.RIGHT_WRIST, point(0.82, 0.37)],
  ]);

test("Left hand raised: accepts a clear raised hand", () => {
  assert(leftHandRaised(leftRaisedPose(), "standing"));
  assertFalse(rightHandRaised(leftRaisedPose(), "standing"));
});

test("Left hand raised: rejects a relaxed hand", () => {
  assertFalse(leftHandRaised(neutralPose(), "standing"));
});

test("Right hand raised: accepts a clear raised hand", () => {
  assert(rightHandRaised(rightRaisedPose(), "standing"));
  assertFalse(leftHandRaised(rightRaisedPose(), "standing"));
});

test("Right hand raised: rejects a relaxed hand", () => {
  assertFalse(rightHandRaised(neutralPose(), "standing"));
});

test("Both hands raised: requires both hands", () => {
  assert(bothHandsRaised(bothRaisedPose(), "standing"));
  assertFalse(bothHandsRaised(leftRaisedPose(), "standing"));
});

test("Left reach: accepts outward extension and rejects relaxed arm", () => {
  assert(leftReach(leftReachPose(), "standing"));
  assertFalse(leftReach(neutralPose(), "standing"));
});

test("Right reach: accepts outward extension and rejects relaxed arm", () => {
  assert(rightReach(rightReachPose(), "standing"));
  assertFalse(rightReach(neutralPose(), "standing"));
});

test("Arms open: requires outward extension on both sides", () => {
  assert(armsOpen(armsOpenPose(), "standing"));
  assertFalse(armsOpen(leftReachPose(), "standing"));
});

test("Detectors remain anatomical when camera coordinates are mirrored", () => {
  const mirrored = mirrorPose(leftReachPose());
  assert(leftReach(mirrored, "standing"));
  assertFalse(rightReach(mirrored, "standing"));
});

test("Low wrist visibility is calmly rejected", () => {
  const pose = leftRaisedPose();
  pose[LANDMARKS.LEFT_WRIST].visibility = 0.12;
  pose[LANDMARKS.LEFT_WRIST].presence = 0.12;
  assertFalse(leftHandRaised(pose, "seated"));
});

test("Seated hand-raise tolerance is gentler than standing", () => {
  const pose = withPoints([
    [LANDMARKS.LEFT_ELBOW, point(0.37, 0.35)],
    [LANDMARKS.LEFT_WRIST, point(0.37, 0.325)],
  ]);
  assert(leftHandRaised(pose, "seated"));
  assertFalse(leftHandRaised(pose, "standing"));
  assert(
    TOLERANCES.seated.handRaiseTorsoRatio <
      TOLERANCES.standing.handRaiseTorsoRatio,
  );
});

test("Seated reach tolerance accepts a smaller safe reach", () => {
  const pose = withPoints([
    [LANDMARKS.LEFT_ELBOW, point(0.34, 0.38)],
    [LANDMARKS.LEFT_WRIST, point(0.25, 0.39)],
  ]);
  assert(leftReach(pose, "seated"));
  assertFalse(leftReach(pose, "standing"));
});

test("Gentle left and right lean use the hip-to-shoulder relationship", () => {
  const left = withPoints([
    [LANDMARKS.LEFT_SHOULDER, point(0.34, 0.36)],
    [LANDMARKS.RIGHT_SHOULDER, point(0.58, 0.36)],
  ]);
  const right = withPoints([
    [LANDMARKS.LEFT_SHOULDER, point(0.42, 0.36)],
    [LANDMARKS.RIGHT_SHOULDER, point(0.66, 0.36)],
  ]);
  assert(gentleLeftLean(left, "standing"));
  assertFalse(gentleRightLean(left, "standing"));
  assert(gentleRightLean(right, "standing"));
  assertFalse(gentleLeftLean(right, "standing"));
});

test("Wave needs sideways travel and a change of direction", () => {
  const context = createMovementContext();
  const xs = [0.35, 0.29, 0.43, 0.3, 0.42];
  const results = xs.map((x, index) => {
    const pose = withPoints([
      [LANDMARKS.LEFT_ELBOW, point(0.36, 0.3)],
      [LANDMARKS.LEFT_WRIST, point(x, 0.22)],
    ]);
    return wave(pose, "standing", context, index * 180);
  });
  assert(results.at(-1), "Expected the final oscillation to count as a wave.");
});

test("Celebration accepts both raised hands or open arms", () => {
  assert(celebration(bothRaisedPose(), "standing"));
  assert(celebration(armsOpenPose(), "seated"));
  assertFalse(celebration(neutralPose(), "standing"));
});

test("Named dispatcher accepts friendly aliases", () => {
  assert(detectMovement("left-hand-raised", leftRaisedPose(), "standing"));
  assert(detectMovement("gentle_left_lean", withPoints([
    [LANDMARKS.LEFT_SHOULDER, point(0.34, 0.36)],
    [LANDMARKS.RIGHT_SHOULDER, point(0.58, 0.36)],
  ]), "standing"));
  assertFalse(detectMovement("unknown-movement", neutralPose(), "standing"));
});

test("Rolling hold completes after about 550 ms", () => {
  const held = createHoldDetector("leftHandRaised", {
    mode: "standing",
    holdMs: 550,
  });
  const pose = leftRaisedPose();
  assertFalse(held(pose, 0));
  assertFalse(held(pose, 180));
  assertFalse(held(pose, 360));
  assert(held(pose, 560));
  assert(held.snapshot(560).complete);
});

test("Rolling hold tolerates one brief tracking flicker", () => {
  const held = createHoldDetector("rightHandRaised", {
    mode: "standing",
    holdMs: 550,
  });
  const raised = rightRaisedPose();
  assertFalse(held(raised, 0));
  assertFalse(held(raised, 170));
  assertFalse(held(neutralPose(), 280));
  assertFalse(held(raised, 360));
  assert(held(raised, 570));
});

function renderResults(results) {
  const output = document.querySelector("#results");
  const summary = document.querySelector("#summary");
  const passed = results.filter((result) => result.passed).length;
  const failed = results.length - passed;

  output.replaceChildren(
    ...results.map((result) => {
      const item = document.createElement("li");
      item.className = result.passed ? "pass" : "fail";

      const heading = document.createElement("strong");
      heading.textContent = `${result.passed ? "PASS" : "FAIL"} — ${result.name}`;
      item.append(heading);

      if (result.error) {
        const message = document.createElement("pre");
        message.textContent = result.error;
        item.append(message);
      }
      return item;
    }),
  );

  summary.className = failed ? "summary fail" : "summary pass";
  summary.textContent = failed
    ? `${passed} passed; ${failed} need attention.`
    : `All ${passed} movement tests passed.`;
  document.documentElement.dataset.testStatus = failed ? "failed" : "passed";
  document.title = failed
    ? `Movement tests: ${failed} failed`
    : `Movement tests: ${passed} passed`;
}

function runAllTests() {
  const results = tests.map(({ name, run }) => {
    try {
      run();
      return { name, passed: true };
    } catch (error) {
      return {
        name,
        passed: false,
        error: error?.stack ?? String(error),
      };
    }
  });

  window.__movementTestResults = results;
  renderResults(results);
}

runAllTests();
