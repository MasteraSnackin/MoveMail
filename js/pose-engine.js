import { LANDMARKS, isLandmarkVisible } from "./movements.js";

/**
 * Local-only MediaPipe asset locations.
 *
 * Nothing in this module fetches a CDN or uploads camera data. MediaPipe loads
 * its JavaScript, WASM and model files from these paths on the same local web
 * server as the application.
 */
export const DEFAULT_POSE_ASSETS = Object.freeze({
  visionModuleUrl: new URL(
    "./vendor/vision_bundle.mjs",
    import.meta.url,
  ).href,
  wasmRootUrl: new URL("../assets/models/wasm/", import.meta.url).href,
  modelUrl: new URL(
    "../assets/models/pose_landmarker_lite.task",
    import.meta.url,
  ).href,
});

export const POSE_ENGINE_ERROR_CODES = Object.freeze({
  UNSUPPORTED_BROWSER: "unsupported-browser",
  INSECURE_CONTEXT: "insecure-context",
  CAMERA_PERMISSION_DENIED: "camera-permission-denied",
  CAMERA_NOT_FOUND: "camera-not-found",
  CAMERA_BUSY: "camera-busy",
  CAMERA_START_FAILED: "camera-start-failed",
  VIDEO_NOT_READY: "video-not-ready",
  MODEL_LOAD_FAILED: "model-load-failed",
  ENGINE_NOT_READY: "engine-not-ready",
  TRACKING_FAILED: "tracking-failed",
});

const ERROR_MESSAGES = Object.freeze({
  [POSE_ENGINE_ERROR_CODES.UNSUPPORTED_BROWSER]:
    "This browser cannot use the camera for body tracking. You can continue in Camera-free Play.",
  [POSE_ENGINE_ERROR_CODES.INSECURE_CONTEXT]:
    "Camera access needs a secure page or the local game server. You can continue in Camera-free Play.",
  [POSE_ENGINE_ERROR_CODES.CAMERA_PERMISSION_DENIED]:
    "Camera permission was not granted. You can allow it in browser settings or continue in Camera-free Play.",
  [POSE_ENGINE_ERROR_CODES.CAMERA_NOT_FOUND]:
    "We could not find a camera. You can connect one or continue in Camera-free Play.",
  [POSE_ENGINE_ERROR_CODES.CAMERA_BUSY]:
    "The camera may be in use by another app. Close that app, then try again, or continue in Camera-free Play.",
  [POSE_ENGINE_ERROR_CODES.CAMERA_START_FAILED]:
    "We could not start the camera. Please try again or continue in Camera-free Play.",
  [POSE_ENGINE_ERROR_CODES.VIDEO_NOT_READY]:
    "The camera is starting. Please wait a moment, then try again.",
  [POSE_ENGINE_ERROR_CODES.MODEL_LOAD_FAILED]:
    "Body tracking is not available, but the movement demonstration can continue in Camera-free Play.",
  [POSE_ENGINE_ERROR_CODES.ENGINE_NOT_READY]:
    "Body tracking is still getting ready. Please wait a moment.",
  [POSE_ENGINE_ERROR_CODES.TRACKING_FAILED]:
    "Body tracking paused. Please try again or continue in Camera-free Play.",
});

export class PoseEngineError extends Error {
  constructor(code, options = {}) {
    const safeCode =
      ERROR_MESSAGES[code] ? code : POSE_ENGINE_ERROR_CODES.TRACKING_FAILED;
    const userMessage = options.userMessage ?? ERROR_MESSAGES[safeCode];
    super(userMessage, {
      cause: options.cause,
    });
    this.name = "PoseEngineError";
    this.code = safeCode;
    this.userMessage = userMessage;
    this.recoverable = options.recoverable ?? true;
    this.cause = options.cause;
    this.debugMessage = options.message ?? options.cause?.message ?? null;
  }
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

export function asPoseEngineError(error, fallbackCode) {
  if (error instanceof PoseEngineError) return error;
  return new PoseEngineError(fallbackCode, {
    cause: error,
  });
}

function normaliseMode(mode) {
  return String(mode).toLowerCase() === "seated" ? "seated" : "standing";
}

function landmarkVisible(landmarks, index, threshold = 0.42) {
  return isLandmarkVisible(landmarks?.[index], threshold);
}

function anyLandmarkVisible(landmarks, indices, threshold = 0.42) {
  return indices.some((index) =>
    landmarkVisible(landmarks, index, threshold),
  );
}

function boundingBox(landmarks, threshold = 0.42) {
  const visible = (Array.isArray(landmarks) ? landmarks : []).filter((point) =>
    isLandmarkVisible(point, threshold),
  );
  if (!visible.length) return null;
  const xs = visible.map((point) => point.x);
  const ys = visible.map((point) => point.y);
  return {
    left: Math.min(...xs),
    right: Math.max(...xs),
    top: Math.min(...ys),
    bottom: Math.max(...ys),
  };
}

/**
 * Evaluates whether the useful body area is in frame for the selected mode.
 * "ready" means tracking can start; "quality" distinguishes an ideal view from
 * a usable one, so standing players are not blocked when knees are unavailable.
 */
export function evaluateCalibration(landmarks, mode = "standing") {
  const selectedMode = normaliseMode(mode);
  const points = Array.isArray(landmarks) ? landmarks : [];

  const headVisible = anyLandmarkVisible(points, [
    LANDMARKS.NOSE,
    LANDMARKS.LEFT_EAR,
    LANDMARKS.RIGHT_EAR,
  ]);
  const shouldersVisible =
    landmarkVisible(points, LANDMARKS.LEFT_SHOULDER) &&
    landmarkVisible(points, LANDMARKS.RIGHT_SHOULDER);
  const hipsVisible =
    landmarkVisible(points, LANDMARKS.LEFT_HIP) &&
    landmarkVisible(points, LANDMARKS.RIGHT_HIP);
  const elbowsVisible =
    landmarkVisible(points, LANDMARKS.LEFT_ELBOW) &&
    landmarkVisible(points, LANDMARKS.RIGHT_ELBOW);
  const wristsVisible =
    landmarkVisible(points, LANDMARKS.LEFT_WRIST) &&
    landmarkVisible(points, LANDMARKS.RIGHT_WRIST);
  const someLegVisible = anyLandmarkVisible(points, [
    LANDMARKS.LEFT_KNEE,
    LANDMARKS.RIGHT_KNEE,
    LANDMARKS.LEFT_ANKLE,
    LANDMARKS.RIGHT_ANKLE,
  ]);
  const box = boundingBox(points);

  const visibility = {
    head: headVisible,
    shoulders: shouldersVisible,
    elbows: elbowsVisible,
    wrists: wristsVisible,
    hips: hipsVisible,
    legs: someLegVisible,
  };

  if (!headVisible && !shouldersVisible) {
    return {
      ready: false,
      quality: "not-visible",
      message: "Move gently back into view.",
      visibility,
    };
  }

  const essentialVisible =
    selectedMode === "seated"
      ? headVisible && shouldersVisible && elbowsVisible && wristsVisible
      : headVisible && shouldersVisible && hipsVisible;

  if (!essentialVisible) {
    return {
      ready: false,
      quality: "adjust",
      message:
        selectedMode === "seated"
          ? "Make sure your head, shoulders, elbows and hands are visible."
          : "Make sure your head, shoulders and hips are visible.",
      visibility,
    };
  }

  const shoulders = [
    points[LANDMARKS.LEFT_SHOULDER],
    points[LANDMARKS.RIGHT_SHOULDER],
  ];
  const shoulderWidth = Math.hypot(
    shoulders[0].x - shoulders[1].x,
    shoulders[0].y - shoulders[1].y,
  );

  if (
    shoulderWidth > 0.48 ||
    (box && (box.left < -0.03 || box.right > 1.03))
  ) {
    return {
      ready: false,
      quality: "adjust",
      message: "Move slightly backward so there is room to move.",
      visibility,
    };
  }

  if (shoulderWidth < 0.085) {
    return {
      ready: false,
      quality: "adjust",
      message: "Move a little closer so we can see you clearly.",
      visibility,
    };
  }

  if (
    box &&
    (box.left < 0.015 ||
      box.right > 0.985 ||
      box.top < -0.015 ||
      box.bottom > 1.015)
  ) {
    return {
      ready: false,
      quality: "adjust",
      message: "Move towards the centre of the camera view.",
      visibility,
    };
  }

  if (selectedMode === "standing" && !someLegVisible) {
    return {
      ready: true,
      quality: "acceptable",
      message:
        "Camera ready. If comfortable, move slightly backward so part of your legs is visible.",
      visibility,
    };
  }

  return {
    ready: true,
    quality: "good",
    message: "Great position. You are ready to begin.",
    visibility,
  };
}

const POSE_CONNECTIONS = Object.freeze([
  [LANDMARKS.NOSE, LANDMARKS.LEFT_EAR],
  [LANDMARKS.NOSE, LANDMARKS.RIGHT_EAR],
  [LANDMARKS.LEFT_EAR, LANDMARKS.LEFT_SHOULDER],
  [LANDMARKS.RIGHT_EAR, LANDMARKS.RIGHT_SHOULDER],
  [LANDMARKS.LEFT_SHOULDER, LANDMARKS.RIGHT_SHOULDER],
  [LANDMARKS.LEFT_SHOULDER, LANDMARKS.LEFT_ELBOW],
  [LANDMARKS.LEFT_ELBOW, LANDMARKS.LEFT_WRIST],
  [LANDMARKS.RIGHT_SHOULDER, LANDMARKS.RIGHT_ELBOW],
  [LANDMARKS.RIGHT_ELBOW, LANDMARKS.RIGHT_WRIST],
  [LANDMARKS.LEFT_SHOULDER, LANDMARKS.LEFT_HIP],
  [LANDMARKS.RIGHT_SHOULDER, LANDMARKS.RIGHT_HIP],
  [LANDMARKS.LEFT_HIP, LANDMARKS.RIGHT_HIP],
  [LANDMARKS.LEFT_HIP, LANDMARKS.LEFT_KNEE],
  [LANDMARKS.LEFT_KNEE, LANDMARKS.LEFT_ANKLE],
  [LANDMARKS.RIGHT_HIP, LANDMARKS.RIGHT_KNEE],
  [LANDMARKS.RIGHT_KNEE, LANDMARKS.RIGHT_ANKLE],
]);

export function drawPoseOverlay(
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
  if (!context) return false;

  const width = canvas.width;
  const height = canvas.height;
  context.clearRect(0, 0, width, height);

  if (!Array.isArray(landmarks) || !landmarks.length) return false;

  const position = (point) => ({
    x: (mirror ? 1 - point.x : point.x) * width,
    y: point.y * height,
  });

  context.save();
  context.lineCap = "round";
  context.lineJoin = "round";
  context.strokeStyle = lineColour;
  context.lineWidth = Math.max(2, lineWidth);

  for (const [fromIndex, toIndex] of POSE_CONNECTIONS) {
    const from = landmarks[fromIndex];
    const to = landmarks[toIndex];
    if (!isLandmarkVisible(from, 0.35) || !isLandmarkVisible(to, 0.35)) {
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
  for (const index of new Set(POSE_CONNECTIONS.flat())) {
    const point = landmarks[index];
    if (!isLandmarkVisible(point, 0.35)) continue;
    const location = position(point);
    context.beginPath();
    context.arc(
      location.x,
      location.y,
      Math.max(4, lineWidth * 0.9),
      0,
      Math.PI * 2,
    );
    context.fill();
  }
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

/**
 * Browser pose engine with explicit lifecycle boundaries.
 *
 * Typical use:
 *   const engine = new PoseEngine({ video, canvas, mode: "seated" });
 *   await engine.initialise();  // loads local model only; no camera prompt
 *   await engine.startCamera(); // the only method that asks for permission
 *   await engine.startTracking();
 *   await engine.stop();        // stops RAF, every track, and the landmarker
 */
export class PoseEngine {
  constructor({
    video = null,
    canvas = null,
    mode = "standing",
    assets = {},
    mirrorOverlay = false,
    onResults = null,
    onStatus = null,
    onError = null,
  } = {}) {
    this.video = video;
    this.canvas = canvas;
    this.mode = normaliseMode(mode);
    this.assets = Object.freeze({
      ...DEFAULT_POSE_ASSETS,
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
    this.tracking = false;
    this.modelState = "idle";
    this.cameraState = "off";
    this.lastResult = null;
    this.lastCalibration = evaluateCalibration([], this.mode);
    this._initialisePromise = null;
    this._destroyed = false;
    this._visibilityState = null;
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

  setMode(mode) {
    this.mode = normaliseMode(mode);
    this.lastCalibration = evaluateCalibration(
      this.lastResult?.landmarks ?? [],
      this.mode,
    );
    return this.mode;
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

  /**
   * Loads MediaPipe and the pose model from local files. This method never
   * touches the camera and is safe to call while showing the privacy screen.
   */
  async initialise() {
    if (this.landmarker) return this.landmarker;
    if (this._initialisePromise) return this._initialisePromise;
    if (this._destroyed) {
      this._destroyed = false;
      globalThis.addEventListener?.("pagehide", this._handlePageHide);
    }

    this.modelState = "loading";
    this._emitStatus(
      "model-loading",
      "Getting gentle body tracking ready…",
      { progress: 0.08 },
    );

    this._initialisePromise = (async () => {
      try {
        const visionModule = await import(this.assets.visionModuleUrl);
        const { FilesetResolver, PoseLandmarker } = visionModule;
        if (!FilesetResolver || !PoseLandmarker) {
          throw new TypeError(
            "The local MediaPipe module did not expose the expected API.",
          );
        }

        this._emitStatus(
          "model-loading",
          "Preparing body tracking…",
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
          numPoses: 1,
          minPoseDetectionConfidence: 0.45,
          minPosePresenceConfidence: 0.45,
          minTrackingConfidence: 0.42,
          outputSegmentationMasks: false,
        };

        this._emitStatus(
          "model-loading",
          "Almost ready…",
          { progress: 0.72 },
        );

        try {
          this.landmarker = await PoseLandmarker.createFromOptions(
            vision,
            options,
          );
        } catch (gpuError) {
          this.landmarker = await PoseLandmarker.createFromOptions(vision, {
            ...options,
            baseOptions: {
              ...options.baseOptions,
              delegate: "CPU",
            },
          });
          this._emitStatus(
            "model-fallback",
            "Body tracking is ready in compatibility mode.",
            { progress: 1, cause: gpuError },
          );
        }

        this.modelState = "ready";
        this._emitStatus("model-ready", "Body tracking is ready.", {
          progress: 1,
        });
        return this.landmarker;
      } catch (error) {
        this.modelState = "error";
        const typedError = asPoseEngineError(
          error,
          POSE_ENGINE_ERROR_CODES.MODEL_LOAD_FAILED,
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

  // US spelling for integrations that use initialize().
  initialize() {
    return this.initialise();
  }

  /**
   * Explicit camera-permission boundary. No other PoseEngine method calls
   * getUserMedia.
   */
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
        {
          message: "A video element is required before starting the camera.",
        },
      );
    }
    if (this.stream?.active) return this.stream;

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
    if (!this.canvas || !this.video) return;
    const width = this.video.videoWidth || this.canvas.clientWidth || 640;
    const height = this.video.videoHeight || this.canvas.clientHeight || 480;
    if (this.canvas.width !== width) this.canvas.width = width;
    if (this.canvas.height !== height) this.canvas.height = height;
  }

  _stopTracks() {
    const attachedStream =
      typeof this.video?.srcObject?.getTracks === "function"
        ? this.video.srcObject
        : null;
    const streams = new Set([
      this.stream,
      attachedStream,
    ]);
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

  calibrate(landmarks) {
    this.lastCalibration = evaluateCalibration(landmarks, this.mode);
    return this.lastCalibration;
  }

  drawOverlay(landmarks, options = {}) {
    this._syncCanvasSize();
    return drawPoseOverlay(this.canvas, landmarks, {
      mirror: this.mirrorOverlay,
      ...options,
    });
  }

  /**
   * Starts local inference for a camera that has already been explicitly
   * opened with startCamera().
   */
  async startTracking() {
    if (!this.landmarker) {
      throw new PoseEngineError(
        POSE_ENGINE_ERROR_CODES.ENGINE_NOT_READY,
      );
    }
    if (!this.stream || !this.video) {
      throw new PoseEngineError(
        POSE_ENGINE_ERROR_CODES.CAMERA_START_FAILED,
      );
    }
    await waitForVideo(this.video);
    if (this.tracking) return;

    this.tracking = true;
    this.lastVideoTime = -1;
    this._emitStatus("tracking-started", "Body tracking is active.");

    const frame = () => {
      if (!this.tracking) return;

      try {
        if (
          this.video.readyState >= 2 &&
          this.video.currentTime !== this.lastVideoTime
        ) {
          this.lastVideoTime = this.video.currentTime;
          const timestamp = globalThis.performance?.now?.() ?? Date.now();
          const result = this.landmarker.detectForVideo(
            this.video,
            timestamp,
          );
          const landmarks = result?.landmarks?.[0] ?? [];
          const worldLandmarks = result?.worldLandmarks?.[0] ?? [];
          const calibration = this.calibrate(landmarks);

          this.lastResult = {
            timestamp,
            landmarks,
            worldLandmarks,
            calibration,
            raw: result,
          };

          if (landmarks.length) {
            this.drawOverlay(landmarks);
            if (this._visibilityState !== "visible") {
              this._visibilityState = "visible";
              this._emitStatus(
                "pose-visible",
                calibration.message,
                { calibration },
              );
            }
          } else {
            this._clearOverlay();
            if (this._visibilityState !== "missing") {
              this._visibilityState = "missing";
              this._emitStatus(
                "pose-missing",
                "Move gently back into view.",
                { calibration },
              );
            }
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
    this._visibilityState = null;
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
      } catch (error) {
        this.onError?.(
          asPoseEngineError(
            error,
            POSE_ENGINE_ERROR_CODES.TRACKING_FAILED,
          ),
        );
      }
    }
    this.modelState = "idle";
    this.lastResult = null;
    this.lastCalibration = evaluateCalibration([], this.mode);
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

export function createPoseEngine(options) {
  return new PoseEngine(options);
}
