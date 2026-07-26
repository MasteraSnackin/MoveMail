import {
  POSE_ENGINE_ERROR_CODES,
  PoseEngineError,
  asPoseEngineError,
} from "./pose-engine.js";

export const DEFAULT_HAND_ASSETS = Object.freeze({
  visionModuleUrl: new URL(
    "./vendor/vision_bundle.mjs",
    import.meta.url,
  ).href,
  wasmRootUrl: new URL("../assets/models/wasm/", import.meta.url).href,
  modelUrl: new URL(
    "../assets/models/hand_landmarker.task",
    import.meta.url,
  ).href,
});

export const HAND_CONNECTIONS = Object.freeze([
  Object.freeze([0, 1]),
  Object.freeze([1, 2]),
  Object.freeze([2, 3]),
  Object.freeze([3, 4]),
  Object.freeze([0, 5]),
  Object.freeze([5, 6]),
  Object.freeze([6, 7]),
  Object.freeze([7, 8]),
  Object.freeze([5, 9]),
  Object.freeze([9, 10]),
  Object.freeze([10, 11]),
  Object.freeze([11, 12]),
  Object.freeze([9, 13]),
  Object.freeze([13, 14]),
  Object.freeze([14, 15]),
  Object.freeze([15, 16]),
  Object.freeze([13, 17]),
  Object.freeze([17, 18]),
  Object.freeze([18, 19]),
  Object.freeze([19, 20]),
  Object.freeze([17, 0]),
]);

function isHandPoint(point, threshold = 0.35) {
  if (
    !point ||
    !Number.isFinite(point.x) ||
    !Number.isFinite(point.y)
  ) {
    return false;
  }

  // Hand Landmarker returns valid points with a placeholder visibility of 0
  // and no per-point presence value. Whole-hand confidence is already applied
  // by the landmarker, so only honour presence when a provider supplies it.
  return point.presence === undefined
    ? true
    : Number(point.presence) >= threshold;
}

function handBounds(landmarks) {
  const visible = (Array.isArray(landmarks) ? landmarks : []).filter(
    (point) => isHandPoint(point),
  );
  if (visible.length < 8) {
    return null;
  }
  const xs = visible.map((point) => point.x);
  const ys = visible.map((point) => point.y);
  return {
    left: Math.min(...xs),
    right: Math.max(...xs),
    top: Math.min(...ys),
    bottom: Math.max(...ys),
  };
}

export function evaluateHandCalibration(landmarks) {
  const points = Array.isArray(landmarks) ? landmarks : [];
  const bounds = handBounds(points);

  if (!bounds || !isHandPoint(points[0])) {
    return {
      ready: false,
      quality: "not-visible",
      message: "Hold one comfortable hand in the camera view.",
    };
  }

  const width = bounds.right - bounds.left;
  const height = bounds.bottom - bounds.top;
  const size = Math.max(width, height);

  if (size < 0.13) {
    return {
      ready: false,
      quality: "adjust",
      message: "Move your hand a little closer to the camera.",
    };
  }

  if (
    size > 0.76 ||
    bounds.left < 0.015 ||
    bounds.right > 0.985 ||
    bounds.top < 0.015 ||
    bounds.bottom > 0.985
  ) {
    return {
      ready: false,
      quality: "adjust",
      message: "Move your hand slightly towards the centre of the view.",
    };
  }

  return {
    ready: true,
    quality: "good",
    message: "Great hand position. You are ready to begin.",
  };
}

export function drawHandOverlay(
  canvas,
  landmarks,
  {
    mirror = false,
    lineColour = "#fff4b8",
    pointColour = "#ffcf4a",
    lineWidth = 5,
  } = {},
) {
  const context = canvas?.getContext?.("2d");
  if (!context) {
    return false;
  }

  context.clearRect(0, 0, canvas.width, canvas.height);
  if (!Array.isArray(landmarks) || !landmarks.length) {
    return false;
  }

  const position = (point) => ({
    x: (mirror ? 1 - point.x : point.x) * canvas.width,
    y: point.y * canvas.height,
  });

  context.save();
  context.lineCap = "round";
  context.lineJoin = "round";
  context.strokeStyle = lineColour;
  context.lineWidth = Math.max(2, lineWidth);

  for (const [fromIndex, toIndex] of HAND_CONNECTIONS) {
    const from = landmarks[fromIndex];
    const to = landmarks[toIndex];
    if (!isHandPoint(from) || !isHandPoint(to)) {
      continue;
    }
    const start = position(from);
    const end = position(to);
    context.beginPath();
    context.moveTo(start.x, start.y);
    context.lineTo(end.x, end.y);
    context.stroke();
  }

  context.fillStyle = pointColour;
  landmarks.forEach((point, index) => {
    if (!isHandPoint(point)) {
      return;
    }
    const location = position(point);
    context.beginPath();
    context.arc(
      location.x,
      location.y,
      index === 0 ? Math.max(5, lineWidth) : Math.max(3.5, lineWidth * 0.72),
      0,
      Math.PI * 2,
    );
    context.fill();
  });
  context.restore();
  return true;
}

function waitForVideo(video, timeoutMs = 6_000) {
  if (video.readyState >= 2 && video.videoWidth > 0) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    let timeout;
    const finish = () => {
      clearTimeout(timeout);
      video.removeEventListener("loadeddata", handleReady);
      video.removeEventListener("error", handleError);
    };
    const handleReady = () => {
      finish();
      resolve();
    };
    const handleError = (event) => {
      finish();
      reject(
        new PoseEngineError(POSE_ENGINE_ERROR_CODES.VIDEO_NOT_READY, {
          cause: event,
        }),
      );
    };

    timeout = setTimeout(() => {
      finish();
      reject(
        new PoseEngineError(POSE_ENGINE_ERROR_CODES.VIDEO_NOT_READY),
      );
    }, timeoutMs);

    video.addEventListener("loadeddata", handleReady, { once: true });
    video.addEventListener("error", handleError, { once: true });
  });
}

function cameraErrorCode(error) {
  switch (error?.name) {
    case "NotAllowedError":
    case "PermissionDeniedError":
    case "SecurityError":
      return POSE_ENGINE_ERROR_CODES.CAMERA_PERMISSION_DENIED;
    case "NotFoundError":
    case "DevicesNotFoundError":
      return POSE_ENGINE_ERROR_CODES.CAMERA_NOT_FOUND;
    case "NotReadableError":
    case "TrackStartError":
    case "AbortError":
      return POSE_ENGINE_ERROR_CODES.CAMERA_BUSY;
    default:
      return POSE_ENGINE_ERROR_CODES.CAMERA_START_FAILED;
  }
}

export class HandEngine {
  constructor({
    video = null,
    canvas = null,
    assets = {},
    mirrorOverlay = false,
    onResults = null,
    onStatus = null,
    onError = null,
  } = {}) {
    this.video = video;
    this.canvas = canvas;
    this.assets = Object.freeze({
      ...DEFAULT_HAND_ASSETS,
      ...assets,
    });
    this.mirrorOverlay = Boolean(mirrorOverlay);
    this.onResults = onResults;
    this.onStatus = onStatus;
    this.onError = onError;

    this.landmarker = null;
    this.stream = null;
    this.rafId = null;
    this.lastVideoTime = -1;
    this.lastInferenceAt = 0;
    this.tracking = false;
    this.modelState = "idle";
    this.cameraState = "off";
    this.lastResult = null;
    this.lastCalibration = evaluateHandCalibration([]);
    this._initialisePromise = null;
    this._destroyed = false;
    this._handlePageHide = () => {
      void this.stop();
    };

    globalThis.addEventListener?.("pagehide", this._handlePageHide);
  }

  get ready() {
    return Boolean(this.landmarker && this.stream);
  }

  get status() {
    return {
      model: this.modelState,
      camera: this.cameraState,
      tracking: this.tracking,
      ready: this.ready,
      calibration: this.lastCalibration,
    };
  }

  attach({ video = this.video, canvas = this.canvas } = {}) {
    this.video = video;
    this.canvas = canvas;
    return this;
  }

  setMode() {
    return "fingers";
  }

  setCallbacks({
    onResults = this.onResults,
    onStatus = this.onStatus,
    onError = this.onError,
  } = {}) {
    this.onResults = onResults;
    this.onStatus = onStatus;
    this.onError = onError;
    return this;
  }

  _emitStatus(type, message, extra = {}) {
    const detail = { type, message, ...extra };
    this.onStatus?.(detail);
    return detail;
  }

  async initialise() {
    if (this.landmarker) {
      return this.landmarker;
    }
    if (this._initialisePromise) {
      return this._initialisePromise;
    }
    if (this._destroyed) {
      this._destroyed = false;
      globalThis.addEventListener?.("pagehide", this._handlePageHide);
    }

    this.modelState = "loading";
    this._emitStatus(
      "model-loading",
      "Getting private hand tracking ready…",
      { progress: 0.08 },
    );

    this._initialisePromise = (async () => {
      try {
        const visionModule = await import(this.assets.visionModuleUrl);
        const { FilesetResolver, HandLandmarker } = visionModule;
        if (!FilesetResolver || !HandLandmarker) {
          throw new TypeError(
            "The local MediaPipe module did not expose Hand Landmarker.",
          );
        }

        this._emitStatus(
          "model-loading",
          "Preparing finger tracking…",
          { progress: 0.38 },
        );
        const vision = await FilesetResolver.forVisionTasks(
          this.assets.wasmRootUrl,
        );
        const options = {
          baseOptions: {
            modelAssetPath: this.assets.modelUrl,
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numHands: 1,
          minHandDetectionConfidence: 0.42,
          minHandPresenceConfidence: 0.42,
          minTrackingConfidence: 0.4,
        };

        this._emitStatus(
          "model-loading",
          "Almost ready…",
          { progress: 0.72 },
        );

        try {
          this.landmarker = await HandLandmarker.createFromOptions(
            vision,
            options,
          );
        } catch (gpuError) {
          this.landmarker = await HandLandmarker.createFromOptions(vision, {
            ...options,
            baseOptions: {
              ...options.baseOptions,
              delegate: "CPU",
            },
          });
          this._emitStatus(
            "model-fallback",
            "Hand tracking is ready in compatibility mode.",
            { progress: 1, cause: gpuError },
          );
        }

        this.modelState = "ready";
        this._emitStatus("model-ready", "Hand tracking is ready.", {
          progress: 1,
        });
        return this.landmarker;
      } catch (error) {
        this.modelState = "error";
        const typedError = new PoseEngineError(
          POSE_ENGINE_ERROR_CODES.MODEL_LOAD_FAILED,
          {
            cause: error,
            userMessage:
              "Hand tracking is not available, but you can continue in Camera-free Play.",
          },
        );
        this._emitStatus("model-error", typedError.userMessage, {
          error: typedError,
          progress: 0,
        });
        throw typedError;
      } finally {
        this._initialisePromise = null;
      }
    })();

    return this._initialisePromise;
  }

  initialize() {
    return this.initialise();
  }

  async startCamera(constraints = {}) {
    if (!globalThis.navigator?.mediaDevices?.getUserMedia) {
      throw new PoseEngineError(
        POSE_ENGINE_ERROR_CODES.UNSUPPORTED_BROWSER,
      );
    }
    if (
      globalThis.isSecureContext === false &&
      globalThis.location?.hostname !== "localhost" &&
      globalThis.location?.hostname !== "127.0.0.1"
    ) {
      throw new PoseEngineError(POSE_ENGINE_ERROR_CODES.INSECURE_CONTEXT);
    }
    if (!this.video) {
      throw new PoseEngineError(
        POSE_ENGINE_ERROR_CODES.CAMERA_START_FAILED,
        { message: "A video element is required before starting the camera." },
      );
    }
    if (this.stream?.active) {
      return this.stream;
    }

    this.cameraState = "requesting";
    this._emitStatus(
      "camera-requesting",
      "Your browser will ask for camera permission.",
    );

    try {
      const stream = await globalThis.navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: "user",
          width: { ideal: 1_280 },
          height: { ideal: 720 },
          frameRate: { ideal: 24, max: 30 },
          ...constraints,
        },
      });

      this.stream = stream;
      this.video.srcObject = stream;
      this.video.muted = true;
      this.video.playsInline = true;
      await this.video.play();
      await waitForVideo(this.video);
      this.cameraState = "ready";
      this._syncCanvasSize();
      this._emitStatus("camera-ready", "Camera ready.");
      return stream;
    } catch (error) {
      this.cameraState = "error";
      this._stopTracks();
      const typedError =
        error instanceof PoseEngineError
          ? error
          : new PoseEngineError(cameraErrorCode(error), { cause: error });
      this._emitStatus("camera-error", typedError.userMessage, {
        error: typedError,
      });
      throw typedError;
    }
  }

  _syncCanvasSize() {
    if (!this.canvas || !this.video) {
      return;
    }
    const width = this.video.videoWidth || this.canvas.clientWidth || 640;
    const height = this.video.videoHeight || this.canvas.clientHeight || 480;
    if (this.canvas.width !== width) {
      this.canvas.width = width;
    }
    if (this.canvas.height !== height) {
      this.canvas.height = height;
    }
  }

  _stopTracks() {
    const attachedStream =
      typeof this.video?.srcObject?.getTracks === "function"
        ? this.video.srcObject
        : null;
    const streams = new Set([this.stream, attachedStream]);
    for (const stream of streams) {
      for (const track of stream?.getTracks?.() ?? []) {
        track.stop();
      }
    }
    this.stream = null;
    if (this.video) {
      this.video.pause?.();
      this.video.srcObject = null;
    }
  }

  _clearOverlay() {
    const context = this.canvas?.getContext?.("2d");
    if (context) {
      context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  async startTracking() {
    if (!this.landmarker) {
      throw new PoseEngineError(
        POSE_ENGINE_ERROR_CODES.ENGINE_NOT_READY,
        { userMessage: "Hand tracking is still getting ready." },
      );
    }
    if (!this.stream || !this.video) {
      throw new PoseEngineError(
        POSE_ENGINE_ERROR_CODES.CAMERA_START_FAILED,
      );
    }
    await waitForVideo(this.video);
    if (this.tracking) {
      return;
    }

    this.tracking = true;
    this.lastVideoTime = -1;
    this.lastInferenceAt = 0;
    this._emitStatus("tracking-started", "Hand tracking is active.");

    const frame = (timestamp) => {
      if (!this.tracking) {
        return;
      }

      try {
        const readyForInference =
          timestamp - this.lastInferenceAt >= 60 &&
          this.video.readyState >= 2 &&
          this.video.currentTime !== this.lastVideoTime;

        if (readyForInference) {
          this.lastInferenceAt = timestamp;
          this.lastVideoTime = this.video.currentTime;
          const result = this.landmarker.detectForVideo(
            this.video,
            timestamp,
          );
          const landmarks = result?.landmarks?.[0] ?? [];
          const worldLandmarks = result?.worldLandmarks?.[0] ?? [];
          const handedness =
            result?.handedness?.[0]?.[0]?.categoryName ?? null;
          const calibration = evaluateHandCalibration(landmarks);

          this.lastCalibration = calibration;
          this.lastResult = {
            timestamp,
            landmarks,
            worldLandmarks,
            handedness,
            calibration,
          };

          if (landmarks.length) {
            this._syncCanvasSize();
            drawHandOverlay(this.canvas, landmarks, {
              mirror: this.mirrorOverlay,
            });
            this._emitStatus("pose-visible", calibration.message, {
              calibration,
            });
          } else {
            this._clearOverlay();
            this._emitStatus(
              "pose-missing",
              "Hold one hand gently in view.",
              { calibration },
            );
          }

          this.onResults?.(this.lastResult);
        }
      } catch (error) {
        const typedError = asPoseEngineError(
          error,
          POSE_ENGINE_ERROR_CODES.TRACKING_FAILED,
        );
        this.stopTracking();
        this._emitStatus("tracking-error", typedError.userMessage, {
          error: typedError,
        });
        this.onError?.(typedError);
        return;
      }

      this.rafId = globalThis.requestAnimationFrame(frame);
    };

    this.rafId = globalThis.requestAnimationFrame(frame);
  }

  stopTracking() {
    this.tracking = false;
    if (this.rafId !== null) {
      globalThis.cancelAnimationFrame?.(this.rafId);
      this.rafId = null;
    }
    this.lastVideoTime = -1;
    this.lastInferenceAt = 0;
    this._clearOverlay();
  }

  stopCamera() {
    this.stopTracking();
    this._stopTracks();
    this.cameraState = "off";
    this._emitStatus("camera-off", "Camera off.");
  }

  async stop() {
    this.stopCamera();
    if (this._initialisePromise) {
      await this._initialisePromise.catch(() => undefined);
    }
    const activeLandmarker = this.landmarker;
    this.landmarker = null;
    if (activeLandmarker?.close) {
      try {
        await activeLandmarker.close();
      } catch {
        // Cleanup remains best-effort when the browser is closing.
      }
    }
    this.modelState = "idle";
    this.lastResult = null;
    this.lastCalibration = evaluateHandCalibration([]);
  }

  async destroy() {
    await this.stop();
    globalThis.removeEventListener?.("pagehide", this._handlePageHide);
    this._destroyed = true;
    this.video = null;
    this.canvas = null;
    this.onResults = null;
    this.onStatus = null;
    this.onError = null;
  }
}

export function createHandEngine(options) {
  return new HandEngine(options);
}
