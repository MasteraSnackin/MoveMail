import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { createAudioController } from "../js/audio.js";
import { CHALLENGES } from "../js/game.js";
import { FINGER_CHALLENGES } from "../js/finger-game.js";
import {
  DEFAULT_HAND_ASSETS,
  HandEngine,
  drawHandOverlay,
  evaluateHandCalibration,
} from "../js/hand-engine.js";
import {
  LANDMARKS,
  armsOpen,
  bothHandsRaised,
  leftHandRaised,
  leftReach,
  rightHandRaised,
  rightReach,
} from "../js/movements.js";
import {
  POSE_ENGINE_ERROR_CODES,
  PoseEngine,
} from "../js/pose-engine.js";
import {
  clear as clearStoredSessions,
  get as getStoredSessions,
  save as saveStoredSession,
} from "../js/storage.js";
import {
  createPostcard,
  deletePostcard,
  loadPostcard,
  sanitisePostcard,
  savePostcard,
} from "../js/postcard.js";
import { createActiveSessionClock } from "../js/session-clock.js";

const projectRoot = new URL("../", import.meta.url);

function point(x, y, visibility = 0.98) {
  return { x, y, z: 0, visibility, presence: visibility };
}

function neutralPose() {
  const pose = Array.from({ length: 33 }, () => point(0.5, 0.5));
  pose[LANDMARKS.NOSE] = point(0.5, 0.17);
  pose[LANDMARKS.LEFT_SHOULDER] = point(0.38, 0.36);
  pose[LANDMARKS.RIGHT_SHOULDER] = point(0.62, 0.36);
  pose[LANDMARKS.LEFT_ELBOW] = point(0.36, 0.49);
  pose[LANDMARKS.RIGHT_ELBOW] = point(0.64, 0.49);
  pose[LANDMARKS.LEFT_WRIST] = point(0.38, 0.61);
  pose[LANDMARKS.RIGHT_WRIST] = point(0.62, 0.61);
  pose[LANDMARKS.LEFT_HIP] = point(0.42, 0.66);
  pose[LANDMARKS.RIGHT_HIP] = point(0.58, 0.66);
  return pose;
}

function changedPose(changes) {
  const pose = neutralPose();
  for (const [index, value] of changes) {
    pose[index] = value;
  }
  return pose;
}

test("standalone app contains the complete accessible journey", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");

  for (const screen of [
    "welcome",
    "compose",
    "prepared",
    "postcard",
    "mode",
    "safety",
    "setup",
    "game",
    "results",
    "waiting",
  ]) {
    assert.match(html, new RegExp(`data-screen="${screen}"`));
  }
  for (const action of [
    "Standing Play",
    "Seated Play",
    "Finger Play",
    "Camera-free Play",
    "How it works",
    "Open a postcard",
    "Create a postcard",
    "Unlock with movement",
    "Read message aloud",
    "Pause",
    "End Session",
    "Move again",
    "Return Home",
  ]) {
    assert.match(html, new RegExp(action));
  }

  assert.match(html, /stop immediately if you feel pain, dizziness, discomfort/i);
  assert.match(
    html,
    /Nothing is\s+uploaded,\s+recorded,\s+or\s+saved/i,
  );
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /data-audio-notice/);
  assert.match(html, /data-testid="finger-play"/);
  assert.match(html, /data-hand-guide/);
  assert.match(html, /data-demo-hand/);
  assert.match(html, /data-testid="preview-play"/);
  assert.match(html, /data-postcard-form/);
  assert.match(html, /data-reveal-message/);
  assert.match(html, /data-session-time/);
  assert.match(html, /This prepares one postcard in this browser/i);
  assert.match(html, /does not email,\s+text or upload/i);
  assert.match(html, /postcard is not encrypted/i);
  assert.match(html, /Open without movement/i);
  assert.match(html, /read-aloud uses a local device voice only/i);
  assert.match(
    html,
    /Open the recipient view,\s+then hand the device/i,
  );
  assert.doesNotMatch(
    html,
    /class="message-count"[^>]*aria-live/i,
  );
  assert.doesNotMatch(html, /Thinking of you today/i);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/i);
  assert.doesNotMatch(html, /https?:\/\//i);
});

test("the MoveMail clock unlocks at sixty active seconds only", () => {
  const clock = createActiveSessionClock(60_000);
  clock.start(1_000);
  assert.equal(clock.advance(60_999).complete, false);
  assert.equal(clock.snapshot().elapsedMs, 59_999);
  assert.equal(clock.advance(61_000).complete, true);
  assert.equal(clock.snapshot().elapsedMs, 60_000);

  clock.reset();
  clock.start(10_000);
  clock.pause(25_000);
  assert.equal(clock.snapshot().elapsedMs, 15_000);
  clock.start(125_000);
  clock.pause(130_000);
  assert.equal(clock.snapshot().elapsedMs, 20_000);
  assert.equal(clock.snapshot().complete, false);
});

test("personal message speech requires a browser-confirmed local voice", () => {
  const windowDescriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    "window",
  );
  const spoken = [];
  let voices = [
    { lang: "en-GB", localService: false, name: "Remote voice" },
    { lang: "en-US", localService: true, name: "Local voice" },
  ];

  class FakeUtterance {
    constructor(text) {
      this.text = text;
      this.voice = null;
    }
  }

  try {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        SpeechSynthesisUtterance: FakeUtterance,
        speechSynthesis: {
          cancel() {},
          getVoices() {
            return voices;
          },
          speak(utterance) {
            spoken.push(utterance);
          },
        },
      },
    });

    const audio = createAudioController({ enabled: true });
    assert.equal(audio.canSpeakLocally("en-GB"), true);
    assert.equal(
      audio.speak("Private postcard", { localOnly: true }),
      true,
    );
    assert.equal(spoken.length, 1);
    assert.equal(spoken[0].voice.localService, true);

    voices = [{ lang: "en-GB", localService: false, name: "Remote voice" }];
    assert.equal(audio.canSpeakLocally("en-GB"), false);
    assert.equal(
      audio.speak("Do not send this", { localOnly: true }),
      false,
    );
    assert.equal(spoken.length, 1);
    assert.equal(audio.speak("Generic game guidance"), true);
    assert.equal(spoken.length, 2);
  } finally {
    if (windowDescriptor) {
      Object.defineProperty(globalThis, "window", windowDescriptor);
    } else {
      delete globalThis.window;
    }
  }
});

test("a postcard is sanitised and stored as one explicit local record", () => {
  const storageDescriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    "localStorage",
  );
  const values = new Map();
  const localStorage = {
    getItem(key) {
      return values.get(key) ?? null;
    },
    removeItem(key) {
      values.delete(key);
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
  };

  try {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: localStorage,
    });
    const postcard = createPostcard({
      recipient: "  Alex  ",
      sender: " Sam ",
      message: "Thinking of you.\n\nWith love.",
      cameraFrame: "must not persist",
    });
    assert.equal(postcard.recipient, "Alex");
    assert.equal(postcard.sender, "Sam");
    assert.equal(postcard.unlocked, false);
    assert.equal(savePostcard(postcard), true);
    assert.deepEqual(loadPostcard(), postcard);
    assert.doesNotMatch(
      values.get("moveMail.postcard.v1"),
      /cameraFrame|must not persist/,
    );
    assert.equal(deletePostcard(), true);
    assert.equal(loadPostcard(), null);
    assert.equal(
      sanitisePostcard({
        recipient: "",
        sender: "Sam",
        message: "Hello",
      }),
      null,
    );
  } finally {
    if (storageDescriptor) {
      Object.defineProperty(
        globalThis,
        "localStorage",
        storageDescriptor,
      );
    } else {
      delete globalThis.localStorage;
    }
  }
});

test("game content has ten safe, data-driven challenges", () => {
  assert.equal(CHALLENGES.length, 10);
  assert.deepEqual(
    [...new Set(CHALLENGES.map((challenge) => challenge.miniGame))],
    [
      "COPY THE GARDENER",
      "CATCH THE FIREFLIES",
      "RHYTHM GARDEN",
      "GARDEN CELEBRATION",
    ],
  );

  for (const challenge of CHALLENGES) {
    assert.ok(challenge.id);
    assert.ok(challenge.instruction);
    assert.ok(challenge.spokenInstruction);
    assert.ok(challenge.detector);
    assert.ok(challenge.duration >= 15_000);
    assert.ok(challenge.modes.includes("standing"));
    assert.ok(challenge.modes.includes("seated"));
    assert.ok(challenge.modes.includes("preview"));
    assert.doesNotMatch(
      `${challenge.instruction} ${challenge.safetyNotes}`,
      /\b(jump|spin|run|squat|lunge|one-leg|floor exercise)\b/i,
    );
  }
});

test("Finger Play has ten safe challenges across four mini-games", () => {
  assert.equal(FINGER_CHALLENGES.length, 10);
  assert.equal(
    new Set(FINGER_CHALLENGES.map((challenge) => challenge.id)).size,
    10,
  );
  assert.deepEqual(
    [...new Set(FINGER_CHALLENGES.map((challenge) => challenge.miniGame))],
    [
      "SEEDLING STRETCHES",
      "BUSY BEE TRAIL",
      "BUTTERFLY MEADOW",
      "GARDEN CHEERS",
    ],
  );

  const expectedDetectors = new Set([
    "closedFist",
    "openHand",
    "fingerSpread",
    "pointIndex",
    "gentlePinch",
    "thumbUp",
    "victoryFingers",
  ]);
  const usedDetectors = new Set();

  for (const challenge of FINGER_CHALLENGES) {
    assert.deepEqual(challenge.modes, ["fingers"]);
    assert.ok(challenge.name);
    assert.ok(challenge.instruction);
    assert.ok(challenge.spokenInstruction);
    assert.ok(challenge.demonstration);
    assert.ok(challenge.duration >= 15_000);
    assert.ok(challenge.feedback.length >= 2);
    assert.ok(challenge.safetyNotes);
    assert.ok(expectedDetectors.has(challenge.detector));
    usedDetectors.add(challenge.detector);
    assert.doesNotMatch(
      `${challenge.instruction} ${challenge.safetyNotes}`,
      /\b(squeeze hard|strain|painfully)\b/i,
    );
  }

  assert.deepEqual(usedDetectors, expectedDetectors);
});

test("hand calibration needs a visible, comfortably sized hand", () => {
  assert.equal(evaluateHandCalibration([]).ready, false);
  const hand = Array.from({ length: 21 }, (_, index) =>
    point(
      0.35 + (index % 5) * 0.065,
      0.28 + Math.floor(index / 5) * 0.075,
    ),
  );
  assert.equal(evaluateHandCalibration(hand).ready, true);

  const handLandmarkerOutput = hand.map((landmark) => ({
    x: landmark.x,
    y: landmark.y,
    z: landmark.z,
    visibility: 0,
  }));
  assert.equal(evaluateHandCalibration(handLandmarkerOutput).ready, true);

  const context = {
    arc() {},
    beginPath() {},
    clearRect() {},
    fill() {},
    lineTo() {},
    moveTo() {},
    restore() {},
    save() {},
    stroke() {},
  };
  const canvas = {
    height: 480,
    width: 640,
    getContext() {
      return context;
    },
  };
  assert.equal(drawHandOverlay(canvas, handLandmarkerOutput), true);
});

test("the six required movement detectors accept body-relative fixtures", () => {
  const leftRaised = changedPose([
    [LANDMARKS.LEFT_ELBOW, point(0.36, 0.3)],
    [LANDMARKS.LEFT_WRIST, point(0.37, 0.2)],
  ]);
  const rightRaised = changedPose([
    [LANDMARKS.RIGHT_ELBOW, point(0.64, 0.3)],
    [LANDMARKS.RIGHT_WRIST, point(0.63, 0.2)],
  ]);
  const bothRaised = changedPose([
    [LANDMARKS.LEFT_ELBOW, point(0.36, 0.3)],
    [LANDMARKS.LEFT_WRIST, point(0.37, 0.2)],
    [LANDMARKS.RIGHT_ELBOW, point(0.64, 0.3)],
    [LANDMARKS.RIGHT_WRIST, point(0.63, 0.2)],
  ]);
  const leftReached = changedPose([
    [LANDMARKS.LEFT_ELBOW, point(0.3, 0.37)],
    [LANDMARKS.LEFT_WRIST, point(0.18, 0.37)],
  ]);
  const rightReached = changedPose([
    [LANDMARKS.RIGHT_ELBOW, point(0.7, 0.37)],
    [LANDMARKS.RIGHT_WRIST, point(0.82, 0.37)],
  ]);
  const open = changedPose([
    [LANDMARKS.LEFT_ELBOW, point(0.3, 0.37)],
    [LANDMARKS.LEFT_WRIST, point(0.18, 0.37)],
    [LANDMARKS.RIGHT_ELBOW, point(0.7, 0.37)],
    [LANDMARKS.RIGHT_WRIST, point(0.82, 0.37)],
  ]);

  assert.ok(leftHandRaised(leftRaised, "standing"));
  assert.ok(rightHandRaised(rightRaised, "standing"));
  assert.ok(bothHandsRaised(bothRaised, "standing"));
  assert.ok(leftReach(leftReached, "standing"));
  assert.ok(rightReach(rightReached, "standing"));
  assert.ok(armsOpen(open, "standing"));
});

test("camera source keeps video local and includes cleanup paths", async () => {
  const [poseEngine, handEngine, handMovements, storage, app] =
    await Promise.all([
    readFile(new URL("../js/pose-engine.js", import.meta.url), "utf8"),
    readFile(new URL("../js/hand-engine.js", import.meta.url), "utf8"),
    readFile(
      new URL("../js/hand-movements.js", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../js/storage.js", import.meta.url), "utf8"),
    readFile(new URL("../js/app.js", import.meta.url), "utf8"),
  ]);

  assert.equal((poseEngine.match(/getUserMedia\s*\(/g) || []).length, 1);
  assert.equal((handEngine.match(/getUserMedia\s*\(/g) || []).length, 1);
  assert.match(poseEngine, /track\.stop\(\)/);
  assert.match(handEngine, /track\.stop\(\)/);
  assert.match(poseEngine, /audio:\s*false/);
  assert.match(handEngine, /audio:\s*false/);
  assert.match(poseEngine, /outputSegmentationMasks:\s*false/);
  assert.match(app, /trackingEngine\.destroy\(\)\.catch/);
  assert.match(app, /engine\.setCallbacks\(\{ onError: null \}\)/);
  assert.match(
    app,
    /Camera and body tracking are ready\. You can start the one-minute unlock now\./,
  );
  assert.match(
    app,
    /Camera and finger tracking are ready\. You can start the one-minute unlock now\./,
  );
  assert.doesNotMatch(app, /startSession\.disabled\s*=\s*!calibration\.ready/);
  assert.match(app, /state\.screen !== "game" \|\| state\.isPaused/);
  assert.match(app, /state\.screen = "finishing"/);
  assert.match(
    app,
    /await stopPoseEngine\(\);[\s\S]*?if \(!isOperationCurrent\(operation\)\) \{[\s\S]*?if \(effectiveReason === "completed"\) \{[\s\S]*?revealPostcard/,
  );
  assert.match(app, /operationGeneration:\s*0/);
  assert.match(
    app,
    /async function startSession\(\)[\s\S]*?const operation = beginOperation\(\);[\s\S]*?await state\.audio\.unlock\(\);[\s\S]*?isOperationCurrent\(operation\)/,
  );
  assert.match(
    app,
    /async function returnHome\(\)[\s\S]*?state\.screen = "leaving";[\s\S]*?showScreen\("welcome"[\s\S]*?await cameraCleanup;[\s\S]*?isOperationCurrent\(operation\)/,
  );
  assert.match(app, /document\.addEventListener\("visibilitychange"/);
  assert.match(app, /window\.addEventListener\("pageshow"/);
  assert.match(
    app,
    /function restartSession\(\)[\s\S]*?beginOperation\(\);[\s\S]*?resetSessionState\(\);[\s\S]*?startSessionTimer\(\);/,
  );
  assert.match(
    app,
    /const clockSnapshot = state\.sessionClock\?\.pause\(state\.pausedAt\);[\s\S]*?clockSnapshot\?\.complete/,
  );
  assert.doesNotMatch(
    `${poseEngine}\n${handEngine}\n${handMovements}\n${app}`,
    /MediaRecorder|toDataURL|convertToBlob|XMLHttpRequest|WebSocket|fetch\s*\(/,
  );
  assert.match(storage, /moveMail\.sessions\.v1/);
  assert.match(storage, /"fingers"/);
  assert.match(app, /state\.audio\.support\.speech/);
  assert.match(app, /Spoken instructions are unavailable in this browser/);
  assert.match(
    app,
    /case "create-postcard":\s+openComposer\(\);[\s\S]*?case "edit-postcard":\s+openComposer\(\{ edit: true \}\);/,
  );
  assert.match(
    app,
    /edit && !state\.postcard\.isSample \? state\.postcard : null;[\s\S]*?fillPostcardForm\(existingPostcard\)/,
  );
  assert.match(
    app,
    /state\.composerMode === "create"[\s\S]*?Replace the existing MoveMail/,
  );
  assert.match(
    app,
    /const showSessionSummary =[\s\S]*?completionReason !== "existing" && hasSession/,
  );
  assert.match(app, /window\.confirm\(/);
  const executableStorageCode = storage.replace(/\/\*[\s\S]*?\*\//g, "");
  assert.doesNotMatch(
    executableStorageCode,
    /landmark|camera|image|video|blob/i,
  );
});

test("the static build contains the current standalone product", async () => {
  const [sourceIndex, publicIndex] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../public/index.html", import.meta.url), "utf8"),
  ]);

  assert.match(publicIndex, /MoveMail/);
  assert.equal(publicIndex, sourceIndex);
});

test("required local model assets are packaged", async () => {
  const required = [
    "js/vendor/vision_bundle.mjs",
    "assets/models/hand_landmarker.task",
    "assets/models/pose_landmarker_lite.task",
    "assets/models/wasm/vision_wasm_internal.js",
    "assets/models/wasm/vision_wasm_internal.wasm",
    "assets/models/wasm/vision_wasm_nosimd_internal.js",
    "assets/models/wasm/vision_wasm_nosimd_internal.wasm",
  ];

  for (const path of required) {
    const contents = await readFile(new URL(path, projectRoot));
    assert.ok(contents.byteLength > 1_000, `${path} should not be empty`);
  }

  const visionModule = await import(
    new URL("../js/vendor/vision_bundle.mjs", import.meta.url)
  );
  assert.equal(typeof visionModule.HandLandmarker, "function");
  assert.match(DEFAULT_HAND_ASSETS.modelUrl, /hand_landmarker\.task$/);
});

test("Finger Play results use the same privacy-limited local history", () => {
  const storageDescriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    "localStorage",
  );
  const values = new Map();
  const localStorage = {
    getItem(key) {
      return values.get(key) ?? null;
    },
    removeItem(key) {
      values.delete(key);
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
  };

  try {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: localStorage,
    });
    assert.equal(
      saveStoredSession({
        date: "2026-07-26T10:00:00.000Z",
        mode: "fingers",
        sessionDuration: 97.4,
        completedMovements: 10,
        score: 24,
        landmarks: [{ x: 0.5, y: 0.5 }],
        handedness: "Left",
      }),
      true,
    );
    assert.deepEqual(getStoredSessions(), [
      {
        date: "2026-07-26T10:00:00.000Z",
        mode: "fingers",
        sessionDuration: 97,
        completedMovements: 10,
        score: 24,
      },
    ]);
    assert.equal(clearStoredSessions(), true);
    assert.deepEqual(getStoredSessions(), []);
  } finally {
    if (storageDescriptor) {
      Object.defineProperty(
        globalThis,
        "localStorage",
        storageDescriptor,
      );
    } else {
      delete globalThis.localStorage;
    }
  }
});

test("camera permission, missing-camera and busy-camera errors stay calm", async () => {
  const navigatorDescriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    "navigator",
  );
  const secureContextDescriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    "isSecureContext",
  );
  const cases = [
    ["NotAllowedError", POSE_ENGINE_ERROR_CODES.CAMERA_PERMISSION_DENIED],
    ["NotFoundError", POSE_ENGINE_ERROR_CODES.CAMERA_NOT_FOUND],
    ["NotReadableError", POSE_ENGINE_ERROR_CODES.CAMERA_BUSY],
  ];

  try {
    Object.defineProperty(globalThis, "isSecureContext", {
      configurable: true,
      value: true,
    });

    for (const [browserErrorName, expectedCode] of cases) {
      Object.defineProperty(globalThis, "navigator", {
        configurable: true,
        value: {
          mediaDevices: {
            async getUserMedia() {
              const error = new Error("Synthetic browser camera error");
              error.name = browserErrorName;
              throw error;
            },
          },
        },
      });

      const video = {
        pause() {},
        play() {
          return Promise.resolve();
        },
        srcObject: null,
      };
      const engine = new PoseEngine({ video });
      await assert.rejects(engine.startCamera(), (error) => {
        assert.equal(error.code, expectedCode);
        assert.match(error.userMessage, /Camera-free Play|try again/i);
        return true;
      });
      await engine.destroy();
    }
  } finally {
    if (navigatorDescriptor) {
      Object.defineProperty(globalThis, "navigator", navigatorDescriptor);
    } else {
      delete globalThis.navigator;
    }
    if (secureContextDescriptor) {
      Object.defineProperty(
        globalThis,
        "isSecureContext",
        secureContextDescriptor,
      );
    } else {
      delete globalThis.isSecureContext;
    }
  }
});

test("a missing pose model becomes a typed recoverable error", async () => {
  const engine = new PoseEngine({
    assets: {
      visionModuleUrl: new URL(
        "./fixtures/not-a-real-vision-module.mjs",
        import.meta.url,
      ).href,
    },
  });

  await assert.rejects(engine.initialise(), (error) => {
    assert.equal(error.code, POSE_ENGINE_ERROR_CODES.MODEL_LOAD_FAILED);
    assert.match(error.userMessage, /Camera-free Play/i);
    return true;
  });
  await engine.destroy();
});

test("a missing hand model becomes a typed recoverable error", async () => {
  const engine = new HandEngine({
    assets: {
      visionModuleUrl: new URL(
        "./fixtures/not-a-real-hand-vision-module.mjs",
        import.meta.url,
      ).href,
    },
  });

  await assert.rejects(engine.initialise(), (error) => {
    assert.equal(error.code, POSE_ENGINE_ERROR_CODES.MODEL_LOAD_FAILED);
    assert.match(error.userMessage, /Hand tracking|Camera-free Play/i);
    return true;
  });
  await engine.destroy();
});
