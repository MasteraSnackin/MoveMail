/// <reference lib="webworker" />

import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";

import type {
  PoseLandmark,
  PoseWorkerRequest,
  PoseWorkerResponse,
} from "./types";

const workerScope = self as DedicatedWorkerGlobalScope;
const CONFIDENCE_LANDMARKS = [0, 11, 12, 13, 14, 15, 16, 23, 24] as const;

let poseLandmarker: PoseLandmarker | null = null;
let initialising: Promise<void> | null = null;

function respond(message: PoseWorkerResponse): void {
  workerScope.postMessage(message);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown pose-tracking error";
}

function trackingConfidence(landmarks: PoseLandmark[]): number {
  const visibility = CONFIDENCE_LANDMARKS.map(
    (index) => landmarks[index]?.visibility ?? 0,
  );

  return visibility.reduce((sum, value) => sum + value, 0) / visibility.length;
}

async function initialise(
  wasmBaseUrl: string,
  modelUrl: string,
): Promise<void> {
  poseLandmarker?.close();
  poseLandmarker = null;

  const vision = await FilesetResolver.forVisionTasks(wasmBaseUrl);
  poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: modelUrl,
    },
    runningMode: "VIDEO",
    numPoses: 1,
    minPoseDetectionConfidence: 0.5,
    minPosePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
    outputSegmentationMasks: false,
  });
}

function processFrame(frame: ImageBitmap, timestampMs: number): void {
  if (!poseLandmarker) {
    frame.close();
    respond({
      type: "error",
      message: "Pose tracker received a frame before it was ready.",
      fatal: false,
    });
    return;
  }

  try {
    poseLandmarker.detectForVideo(frame, timestampMs, (result) => {
      const firstPose = result.landmarks[0];
      if (!firstPose) {
        respond({ type: "result", landmarks: null, confidence: 0 });
        return;
      }

      const landmarks: PoseLandmark[] = firstPose.map((landmark) => ({
        x: landmark.x,
        y: landmark.y,
        z: landmark.z,
        visibility: landmark.visibility ?? 0,
      }));

      respond({
        type: "result",
        landmarks,
        confidence: trackingConfidence(landmarks),
      });
    });
  } catch (error) {
    respond({
      type: "error",
      message: errorMessage(error),
      fatal: false,
    });
  } finally {
    // The transferred camera frame is consumed locally and immediately released.
    frame.close();
  }
}

workerScope.onmessage = (event: MessageEvent<PoseWorkerRequest>) => {
  const message = event.data;

  if (message.type === "init") {
    if (initialising) {
      return;
    }

    initialising = initialise(message.wasmBaseUrl, message.modelUrl)
      .then(() => {
        respond({ type: "ready" });
      })
      .catch((error: unknown) => {
        respond({
          type: "error",
          message: errorMessage(error),
          fatal: true,
        });
      })
      .finally(() => {
        initialising = null;
      });
    return;
  }

  if (message.type === "frame") {
    processFrame(message.frame, message.timestampMs);
    return;
  }

  poseLandmarker?.close();
  poseLandmarker = null;
  workerScope.close();
};

export {};
