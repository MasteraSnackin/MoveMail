"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";

import { createDemoPose } from "../lib/pose/demoPose";
import type {
  PoseCameraStatus,
  PoseLandmark,
  PoseWorkerRequest,
  PoseWorkerResponse,
} from "../lib/pose/types";

const CAPTURE_FPS = 15;
const CAPTURE_INTERVAL_MS = 1_000 / CAPTURE_FPS;
const WORKER_READY_TIMEOUT_MS = 15_000;

export interface UsePoseCameraResult {
  videoRef: RefObject<HTMLVideoElement | null>;
  landmarks: PoseLandmark[] | null;
  status: PoseCameraStatus;
  error: string | null;
  startCamera: () => Promise<void>;
  stopCamera: () => void;
  attachCameraPreview: () => void;
  trackingConfidence: number;
}

function userFacingError(error: unknown): string {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError") {
      return "Camera access was not allowed. Showing the labelled demo pose instead.";
    }
    if (error.name === "NotFoundError") {
      return "No camera was found. Showing the labelled demo pose instead.";
    }
    if (error.name === "NotReadableError") {
      return "The camera is already in use or unavailable. Showing the labelled demo pose instead.";
    }
  }

  if (error instanceof Error) {
    return `${error.message} Showing the labelled demo pose instead.`;
  }

  return "Camera tracking is unavailable. Showing the labelled demo pose instead.";
}

export function usePoseCamera(): UsePoseCameraResult {
  const videoRef = useRef<HTMLVideoElement>(null);
  const workerRef = useRef<Worker | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const captureAnimationRef = useRef<number | null>(null);
  const demoAnimationRef = useRef<number | null>(null);
  const frameInFlightRef = useRef(false);
  const lastCaptureRef = useRef(0);
  const lastDemoUpdateRef = useRef(0);
  const lifecycleRef = useRef(0);
  const mountedRef = useRef(true);

  const [landmarks, setLandmarks] = useState<PoseLandmark[] | null>(null);
  const [status, setStatus] = useState<PoseCameraStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [trackingConfidence, setTrackingConfidence] = useState(0);

  const releaseResources = useCallback(() => {
    if (captureAnimationRef.current !== null) {
      cancelAnimationFrame(captureAnimationRef.current);
      captureAnimationRef.current = null;
    }
    if (demoAnimationRef.current !== null) {
      cancelAnimationFrame(demoAnimationRef.current);
      demoAnimationRef.current = null;
    }

    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }

    if (workerRef.current) {
      const disposeMessage: PoseWorkerRequest = { type: "dispose" };
      workerRef.current.postMessage(disposeMessage);
      workerRef.current.terminate();
      workerRef.current = null;
    }

    frameInFlightRef.current = false;
    lastCaptureRef.current = 0;
    lastDemoUpdateRef.current = 0;
  }, []);

  const startDemoFallback = useCallback(
    (reason: string, lifecycle: number) => {
      releaseResources();
      if (!mountedRef.current || lifecycleRef.current !== lifecycle) {
        return;
      }

      setError(reason);
      setStatus("demo");
      setTrackingConfidence(1);

      const animate = (timestampMs: number) => {
        if (
          !mountedRef.current ||
          lifecycleRef.current !== lifecycle ||
          timestampMs - lastDemoUpdateRef.current < CAPTURE_INTERVAL_MS
        ) {
          if (mountedRef.current && lifecycleRef.current === lifecycle) {
            demoAnimationRef.current = requestAnimationFrame(animate);
          }
          return;
        }

        lastDemoUpdateRef.current = timestampMs;
        setLandmarks(createDemoPose(timestampMs));
        demoAnimationRef.current = requestAnimationFrame(animate);
      };

      demoAnimationRef.current = requestAnimationFrame(animate);
    },
    [releaseResources],
  );

  const stopCamera = useCallback(() => {
    lifecycleRef.current += 1;
    releaseResources();

    if (!mountedRef.current) {
      return;
    }

    setLandmarks(null);
    setStatus("idle");
    setError(null);
    setTrackingConfidence(0);
  }, [releaseResources]);

  const attachCameraPreview = useCallback(() => {
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!video || !stream || video.srcObject === stream) {
      return;
    }
    video.muted = true;
    video.playsInline = true;
    video.autoplay = true;
    video.srcObject = stream;
    void video.play().catch(() => {
      // Tracking continues on the original element if preview playback is blocked.
    });
  }, []);

  const startCamera = useCallback(async () => {
    const lifecycle = lifecycleRef.current + 1;
    lifecycleRef.current = lifecycle;
    releaseResources();
    setLandmarks(null);
    setError(null);
    setTrackingConfidence(0);

    try {
      if (
        typeof window === "undefined" ||
        typeof Worker === "undefined" ||
        typeof createImageBitmap === "undefined" ||
        !navigator.mediaDevices?.getUserMedia
      ) {
        throw new Error("This browser does not support local camera tracking.");
      }

      const video = videoRef.current;
      if (!video) {
        throw new Error("The camera video element is not mounted.");
      }

      setStatus("requesting-permission");
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: "user",
          width: { ideal: 1_280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30, max: 30 },
        },
      });

      if (!mountedRef.current || lifecycleRef.current !== lifecycle) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      streamRef.current = stream;
      video.muted = true;
      video.playsInline = true;
      video.autoplay = true;
      video.srcObject = stream;
      await video.play();

      if (!mountedRef.current || lifecycleRef.current !== lifecycle) {
        return;
      }

      setStatus("initialising");
      const worker = new Worker(
        new URL("../lib/pose/pose.worker.ts", import.meta.url),
        { type: "module", name: "pose-landmarker" },
      );
      workerRef.current = worker;

      let workerReady = false;
      await new Promise<void>((resolve, reject) => {
        const timeout = window.setTimeout(() => {
          reject(new Error("Pose tracker took too long to initialise."));
        }, WORKER_READY_TIMEOUT_MS);

        const rejectInitialisation = (reason: string) => {
          window.clearTimeout(timeout);
          reject(new Error(reason));
        };

        worker.onmessage = (event: MessageEvent<PoseWorkerResponse>) => {
          if (!mountedRef.current || lifecycleRef.current !== lifecycle) {
            return;
          }

          const message = event.data;
          if (message.type === "ready") {
            workerReady = true;
            window.clearTimeout(timeout);
            resolve();
            return;
          }

          if (message.type === "error") {
            frameInFlightRef.current = false;
            if (!workerReady || message.fatal) {
              rejectInitialisation(message.message);
              return;
            }

            setError(message.message);
            return;
          }

          frameInFlightRef.current = false;
          setLandmarks(message.landmarks);
          setTrackingConfidence(message.confidence);
          setStatus(message.landmarks ? "tracking" : "no-pose");
        };

        worker.onerror = (event) => {
          const message = event.message || "Pose-tracking worker failed.";
          if (!workerReady) {
            rejectInitialisation(message);
            return;
          }
          startDemoFallback(message, lifecycle);
        };

        const initMessage: PoseWorkerRequest = {
          type: "init",
          wasmBaseUrl: new URL("/wasm", window.location.origin).toString(),
          modelUrl: new URL(
            "/models/pose_landmarker_lite.task",
            window.location.origin,
          ).toString(),
        };
        worker.postMessage(initMessage);
      });

      if (!mountedRef.current || lifecycleRef.current !== lifecycle) {
        return;
      }

      setStatus("ready");

      const capture = async (timestampMs: number) => {
        if (!mountedRef.current || lifecycleRef.current !== lifecycle) {
          return;
        }

        captureAnimationRef.current = requestAnimationFrame(capture);
        if (
          frameInFlightRef.current ||
          timestampMs - lastCaptureRef.current < CAPTURE_INTERVAL_MS ||
          video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA
        ) {
          return;
        }

        frameInFlightRef.current = true;
        lastCaptureRef.current = timestampMs;

        try {
          const frame = await createImageBitmap(video);
          const activeWorker = workerRef.current;
          if (
            !activeWorker ||
            !mountedRef.current ||
            lifecycleRef.current !== lifecycle
          ) {
            frame.close();
            frameInFlightRef.current = false;
            return;
          }

          const frameMessage: PoseWorkerRequest = {
            type: "frame",
            frame,
            timestampMs: performance.now(),
          };
          activeWorker.postMessage(frameMessage, [frame]);
        } catch (captureError) {
          frameInFlightRef.current = false;
          if (mountedRef.current && lifecycleRef.current === lifecycle) {
            setError(
              captureError instanceof Error
                ? captureError.message
                : "Could not read a camera frame.",
            );
          }
        }
      };

      captureAnimationRef.current = requestAnimationFrame(capture);
    } catch (cameraError) {
      if (mountedRef.current && lifecycleRef.current === lifecycle) {
        startDemoFallback(userFacingError(cameraError), lifecycle);
      }
    }
  }, [releaseResources, startDemoFallback]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      lifecycleRef.current += 1;
      releaseResources();
    };
  }, [releaseResources]);

  return {
    videoRef,
    landmarks,
    status,
    error,
    startCamera,
    stopCamera,
    attachCameraPreview,
    trackingConfidence,
  };
}
