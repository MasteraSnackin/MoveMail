import assert from "node:assert/strict";
import test from "node:test";

import {
  connectVideoStream,
  disconnectVideoStream,
} from "../lib/pose/video.ts";

function fakeVideo() {
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
    },
  };
}

test("camera capture can start independently of a mounted preview", async () => {
  const video = fakeVideo();
  const stream = { id: "local-camera-stream" };

  await connectVideoStream(video, stream);
  await connectVideoStream(video, stream);

  assert.equal(video.srcObject, stream);
  assert.equal(video.muted, true);
  assert.equal(video.playsInline, true);
  assert.equal(video.autoplay, true);
  assert.equal(
    video.playCalls,
    2,
    "reattaching the same stream must retry preview playback",
  );
});

test("camera video cleanup pauses playback and releases its stream", () => {
  const video = fakeVideo();
  video.srcObject = { id: "local-camera-stream" };

  disconnectVideoStream(video);

  assert.equal(video.pauseCalls, 1);
  assert.equal(video.srcObject, null);
});
