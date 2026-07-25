import assert from "node:assert/strict";
import test from "node:test";

import {
  CAMERA_CONSTRAINTS,
  acquireLocalCameraCapture,
} from "../lib/pose/cameraCapture.ts";

function fakeVideo({ rejectPlayback = false } = {}) {
  return {
    autoplay: false,
    muted: false,
    pauseCalls: 0,
    playCalls: 0,
    playsInline: false,
    srcObject: null,
    pause() {
      this.pauseCalls += 1;
    },
    async play() {
      this.playCalls += 1;
      if (rejectPlayback) throw new Error("Playback blocked");
    },
  };
}

test("camera acquisition creates its own capture video without a preview", async () => {
  let requestedConstraints = null;
  const stream = {
    getTracks() {
      return [];
    },
  };
  const video = fakeVideo();

  const capture = await acquireLocalCameraCapture({
    createVideo: () => video,
    async getUserMedia(constraints) {
      requestedConstraints = constraints;
      return stream;
    },
  });

  assert.equal(requestedConstraints, CAMERA_CONSTRAINTS);
  assert.equal(capture.stream, stream);
  assert.equal(capture.video, video);
  assert.equal(video.srcObject, stream);
  assert.equal(video.playCalls, 1);
});

test("failed capture playback releases the acquired camera stream", async () => {
  const track = {
    stopCalls: 0,
    stop() {
      this.stopCalls += 1;
    },
  };
  const stream = {
    getTracks() {
      return [track];
    },
  };
  const video = fakeVideo({ rejectPlayback: true });

  await assert.rejects(
    acquireLocalCameraCapture({
      createVideo: () => video,
      async getUserMedia() {
        return stream;
      },
    }),
    /Playback blocked/,
  );

  assert.equal(track.stopCalls, 1);
  assert.equal(video.pauseCalls, 1);
  assert.equal(video.srcObject, null);
});
