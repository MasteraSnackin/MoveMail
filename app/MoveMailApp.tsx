"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
} from "react";
import { usePoseCamera } from "@/hooks/usePoseCamera";
import {
  createCalibrationEnvelope,
  createHoldState,
  createWaveEvidence,
  evaluateMovement,
  holdSignal,
  normalisePose,
  selectPoseLandmarks,
  smoothLandmarks,
  updateHoldState,
  updateWaveEvidence,
  type CalibrationEnvelope,
  type HoldState,
  type PoseLandmarkSubset,
  type WaveEvidence,
} from "@/lib/game";

type Screen =
  | "create"
  | "opening"
  | "loading"
  | "ready"
  | "prepare"
  | "calibrate"
  | "play"
  | "reveal";
type Theme = "seaside" | "garden" | "dance";
type Provider = "openai" | "anthropic" | "demo";
type MovementId =
  | "reach_left"
  | "reach_right"
  | "open_arms"
  | "hands_together"
  | "gentle_wave";

type Movement = {
  id: MovementId;
  label: string;
  cue: string;
};

type MovementPlan = {
  title: string;
  opening: string;
  movements: [Movement, Movement, Movement];
  closing: string;
};

type Postcard = {
  toName: string;
  fromName: string;
  message: string;
  theme: Theme;
  plan: MovementPlan;
  provider: Provider;
};

type CalibrationSamples = {
  neutralWristGaps: number[];
  leftOutward: number[];
  rightOutward: number[];
  openArms: number[];
};

const MAX_ENCODED_POSTCARD_LENGTH = 6_000;
const PLAN_REQUEST_TIMEOUT_MS = 9_500;
const POSTCARD_REQUEST_TIMEOUT_MS = 5_500;
const VOICE_REQUEST_TIMEOUT_MS = 6_500;

const movementCopy: Record<
  MovementId,
  { label: string; cue: string; short: string }
> = {
  reach_left: {
    label: "Reach to the lighthouse",
    cue: "Reach your left hand gently out to the side.",
    short: "Left reach",
  },
  reach_right: {
    label: "Reach for the sunshine",
    cue: "Reach your right hand gently out to the side.",
    short: "Right reach",
  },
  open_arms: {
    label: "Welcome the view",
    cue: "Open both arms gently, with your shoulders relaxed.",
    short: "Open arms",
  },
  hands_together: {
    label: "Gather the flowers",
    cue: "Bring your hands together softly in front of you.",
    short: "Hands together",
  },
  gentle_wave: {
    label: "Wave from the promenade",
    cue: "Give a small, friendly wave with either hand.",
    short: "Gentle wave",
  },
};

const fallbackPlans: Record<Theme, MovementPlan> = {
  seaside: {
    title: "A little trip to the coast",
    opening: "Three gentle movements stand between you and your postcard.",
    movements: [
      {
        id: "gentle_wave",
        label: "Wave to the boat",
        cue: "Give a small, friendly wave with either hand.",
      },
      {
        id: "reach_left",
        label: "Reach to the lighthouse",
        cue: "Reach your left hand gently out to the side.",
      },
      {
        id: "open_arms",
        label: "Welcome the sea breeze",
        cue: "Open both arms gently, with your shoulders relaxed.",
      },
    ],
    closing: "The postcard is ready to open.",
  },
  garden: {
    title: "A gentle garden visit",
    opening: "Let us collect three small moments from the garden.",
    movements: [
      {
        id: "reach_right",
        label: "Reach for the sunshine",
        cue: "Reach your right hand gently out to the side.",
      },
      {
        id: "hands_together",
        label: "Gather the flowers",
        cue: "Bring your hands together softly in front of you.",
      },
      {
        id: "gentle_wave",
        label: "Wave to the robin",
        cue: "Give a small, friendly wave with either hand.",
      },
    ],
    closing: "Your flowers have delivered a message.",
  },
  dance: {
    title: "One song, three easy moves",
    opening: "Take these at your own pace. There is no perfect score.",
    movements: [
      {
        id: "open_arms",
        label: "Open to the music",
        cue: "Open both arms gently, with your shoulders relaxed.",
      },
      {
        id: "reach_left",
        label: "Follow the rhythm left",
        cue: "Reach your left hand gently out to the side.",
      },
      {
        id: "reach_right",
        label: "Follow the rhythm right",
        cue: "Reach your right hand gently out to the side.",
      },
    ],
    closing: "That deserves an encore — and a postcard.",
  },
};

const themeNames: Record<Theme, string> = {
  seaside: "Seaside",
  garden: "Garden",
  dance: "Dance hall",
};

const providerNames: Record<Provider, string> = {
  openai: "OpenAI-assisted story",
  anthropic: "Claude-assisted story",
  demo: "Built-in demo story",
};

function emptyCalibrationSamples(): CalibrationSamples {
  return {
    neutralWristGaps: [],
    leftOutward: [],
    rightOutward: [],
    openArms: [],
  };
}

function boundedPercentile(
  samples: number[],
  percentile: number,
  fallback: number,
  minimum: number,
  maximum: number,
) {
  const finite = samples.filter(Number.isFinite).sort((a, b) => a - b);
  if (!finite.length) return fallback;
  const index = Math.min(
    finite.length - 1,
    Math.max(0, Math.round((finite.length - 1) * percentile)),
  );
  return Math.min(maximum, Math.max(minimum, finite[index]));
}

async function fetchWithClientTimeout(
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs: number,
) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timeout);
  }
}

function isMovementId(value: unknown): value is MovementId {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(movementCopy, value)
  );
}

function safePlan(value: unknown, theme: Theme): MovementPlan {
  if (!value || typeof value !== "object") return fallbackPlans[theme];
  const candidate = value as Partial<MovementPlan> & {
    themeTitle?: unknown;
    openingLine?: unknown;
    moves?: unknown;
    closingLine?: unknown;
  };
  const rawMovements = Array.isArray(candidate.movements)
    ? candidate.movements
    : Array.isArray(candidate.moves)
      ? candidate.moves
      : null;
  if (!rawMovements || rawMovements.length !== 3) {
    return fallbackPlans[theme];
  }
  const movements = rawMovements
    .map((movement) => {
      if (!movement || typeof movement !== "object") return null;
      const item = movement as Partial<Movement> & { celebration?: unknown };
      if (!isMovementId(item.id)) return null;
      return {
        id: item.id,
        label: movementCopy[item.id].label,
        cue: movementCopy[item.id].cue,
      };
    })
    .filter(Boolean) as Movement[];
  if (movements.length !== 3 || new Set(movements.map((item) => item.id)).size !== 3) {
    return fallbackPlans[theme];
  }
  const title =
    typeof candidate.title === "string"
      ? candidate.title
      : typeof candidate.themeTitle === "string"
        ? candidate.themeTitle
        : "";
  const opening =
    typeof candidate.opening === "string"
      ? candidate.opening
      : typeof candidate.openingLine === "string"
        ? candidate.openingLine
        : "";
  const closing =
    typeof candidate.closing === "string"
      ? candidate.closing
      : typeof candidate.closingLine === "string"
        ? candidate.closingLine
        : "";
  return {
    title: title.trim() ? title.slice(0, 72) : fallbackPlans[theme].title,
    opening: opening.trim()
      ? opening.slice(0, 140)
      : fallbackPlans[theme].opening,
    movements: movements as [Movement, Movement, Movement],
    closing: closing.trim()
      ? closing.slice(0, 120)
      : fallbackPlans[theme].closing,
  };
}

function encodePostcard(postcard: Postcard) {
  const bytes = new TextEncoder().encode(JSON.stringify(postcard));
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function decodePostcard(encoded: string): Postcard | null {
  try {
    if (!encoded || encoded.length > MAX_ENCODED_POSTCARD_LENGTH) return null;
    const normalised = encoded.replaceAll("-", "+").replaceAll("_", "/");
    const padded = normalised.padEnd(Math.ceil(normalised.length / 4) * 4, "=");
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const value = JSON.parse(new TextDecoder().decode(bytes)) as Partial<Postcard>;
    const theme: Theme =
      value.theme === "garden" || value.theme === "dance" ? value.theme : "seaside";
    if (
      typeof value.toName !== "string" ||
      typeof value.fromName !== "string" ||
      typeof value.message !== "string"
    ) {
      return null;
    }
    const embeddedPlan = safePlan(value.plan, theme);
    return {
      toName: value.toName.slice(0, 40),
      fromName: value.fromName.slice(0, 40),
      message: value.message.slice(0, 400),
      theme,
      plan: {
        ...fallbackPlans[theme],
        movements: embeddedPlan.movements,
      },
      provider: "demo",
    };
  } catch {
    return null;
  }
}

export function MoveMailApp() {
  const [screen, setScreen] = useState<Screen>("create");
  const [toName, setToName] = useState("Mum");
  const [fromName, setFromName] = useState("Sam");
  const [message, setMessage] = useState(
    "I was thinking about our windy walks by the sea. I hope this brings a little bit of the coast to your living room. Love you.",
  );
  const [theme, setTheme] = useState<Theme>("seaside");
  const [postcard, setPostcard] = useState<Postcard | null>(null);
  const [shareUrl, setShareUrl] = useState("");
  const [notice, setNotice] = useState("");
  const [soundOn, setSoundOn] = useState(true);
  const [sessionMode, setSessionMode] = useState<"camera" | "demo">("demo");
  const [calibrationStep, setCalibrationStep] = useState(0);
  const [moveIndex, setMoveIndex] = useState(0);
  const [holdProgress, setHoldProgress] = useState(0);
  const [completedMoves, setCompletedMoves] = useState<MovementId[]>([]);
  const [copied, setCopied] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const screenHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const shareInputRef = useRef<HTMLInputElement | null>(null);
  const createInFlightRef = useRef(false);
  const voiceAbortRef = useRef<AbortController | null>(null);
  const narrationTokenRef = useRef(0);
  const narrationDelayRef = useRef<number | null>(null);
  const activeAudioRef = useRef<{
    audio: HTMLAudioElement;
    url: string;
    token: number;
  } | null>(null);
  const smoothedPoseRef = useRef<PoseLandmarkSubset | null>(null);
  const calibrationRef = useRef<CalibrationEnvelope>(
    createCalibrationEnvelope(),
  );
  const calibrationSamplesRef = useRef<CalibrationSamples>(
    emptyCalibrationSamples(),
  );
  const holdStateRef = useRef<HoldState>(createHoldState());
  const waveEvidenceRef = useRef<WaveEvidence>(createWaveEvidence("right"));
  const completionLockRef = useRef(false);
  const {
    videoRef,
    landmarks,
    status: cameraStatus,
    error: cameraError,
    startCamera,
    stopCamera,
    attachCameraPreview,
    trackingConfidence,
  } = usePoseCamera();

  const activeMove = postcard?.plan.movements[moveIndex] ?? null;
  const cameraIsLive =
    cameraStatus === "ready" ||
    cameraStatus === "tracking" ||
    cameraStatus === "no-pose" ||
    cameraStatus === "initialising";
  const activeSessionMode =
    cameraStatus === "demo" ? "demo" : sessionMode;
  const calibrationCanAdvance =
    activeSessionMode === "demo" ||
    (cameraStatus === "tracking" && Boolean(landmarks));

  const resetSession = useCallback(() => {
    stopCamera();
    setCalibrationStep(0);
    setMoveIndex(0);
    setHoldProgress(0);
    setCompletedMoves([]);
    smoothedPoseRef.current = null;
    calibrationRef.current = createCalibrationEnvelope();
    calibrationSamplesRef.current = emptyCalibrationSamples();
    holdStateRef.current = createHoldState();
    waveEvidenceRef.current = createWaveEvidence("right");
    completionLockRef.current = false;
  }, [stopCamera]);

  useEffect(() => {
    const parameters = new URLSearchParams(window.location.search);
    const hashParameters = new URLSearchParams(
      window.location.hash.replace(/^#/, ""),
    );
    const legacyEncoded = parameters.get("card");
    const encoded = hashParameters.get("card") || legacyEncoded;
    const postcardId = parameters.get("postcard");

    if (legacyEncoded && !hashParameters.get("card")) {
      const saferUrl = new URL(window.location.href);
      saferUrl.searchParams.delete("card");
      saferUrl.hash = `card=${legacyEncoded}`;
      window.history.replaceState(
        {},
        "",
        `${saferUrl.pathname}${saferUrl.search}${saferUrl.hash}`,
      );
    }

    const openPostcard = (nextPostcard: Postcard) => {
      setPostcard(nextPostcard);
      setTheme(nextPostcard.theme);
      setNotice("");
      setScreen("prepare");
    };
    const openEmbeddedFallback = () => {
      const decoded = encoded ? decodePostcard(encoded) : null;
      if (decoded) {
        openPostcard(decoded);
        return true;
      }
      return false;
    };

    if (!postcardId) {
      if (!encoded) return;
      const timer = window.setTimeout(() => {
        if (!openEmbeddedFallback()) {
          setNotice(
            "This postcard link is incomplete or damaged. You can still create a new one.",
          );
        }
      }, 0);
      return () => window.clearTimeout(timer);
    }

    const controller = new AbortController();
    let cancelled = false;
    const timeout = window.setTimeout(
      () => controller.abort(),
      POSTCARD_REQUEST_TIMEOUT_MS,
    );
    const openingTimer = window.setTimeout(() => setScreen("opening"), 0);
    fetch(`/api/postcards?id=${encodeURIComponent(postcardId)}`, {
      signal: controller.signal,
    })
      .then((response) =>
        response.ok
          ? response.json()
          : Promise.reject(new Error("Postcard unavailable")),
      )
      .then((data) => {
        const candidate = (data as { postcard: Partial<Postcard> }).postcard;
        if (!candidate || typeof candidate !== "object") {
          throw new Error("Invalid postcard");
        }
        const resolvedTheme: Theme =
          candidate.theme === "garden" || candidate.theme === "dance"
            ? candidate.theme
            : "seaside";
        if (
          typeof candidate.toName !== "string" ||
          typeof candidate.fromName !== "string" ||
          typeof candidate.message !== "string"
        ) {
          throw new Error("Invalid postcard");
        }
        openPostcard({
          toName: candidate.toName,
          fromName: candidate.fromName,
          message: candidate.message,
          theme: resolvedTheme,
          plan: safePlan(candidate.plan, resolvedTheme),
          provider:
            candidate.provider === "openai" ||
            candidate.provider === "anthropic"
              ? candidate.provider
              : "demo",
        });
      })
      .catch(() => {
        if (cancelled) return;
        if (!openEmbeddedFallback()) {
          setNotice(
            "That postcard is temporarily unavailable. Try the link again or create a new one.",
          );
          setScreen("create");
        }
      })
      .finally(() => {
        window.clearTimeout(timeout);
      });
    return () => {
      cancelled = true;
      window.clearTimeout(openingTimer);
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, []);

  const stopNarration = useCallback(() => {
    narrationTokenRef.current += 1;
    if (narrationDelayRef.current !== null) {
      window.clearTimeout(narrationDelayRef.current);
      narrationDelayRef.current = null;
    }
    voiceAbortRef.current?.abort();
    voiceAbortRef.current = null;
    const activeAudio = activeAudioRef.current;
    if (activeAudio) {
      activeAudio.audio.pause();
      activeAudio.audio.currentTime = 0;
      URL.revokeObjectURL(activeAudio.url);
      activeAudioRef.current = null;
    }
    window.speechSynthesis?.cancel();
  }, []);

  const speak = useCallback(
    async (text: string) => {
      stopNarration();
      if (!soundOn || !text.trim()) return;

      const token = narrationTokenRef.current;
      const controller = new AbortController();
      voiceAbortRef.current = controller;
      const timeout = window.setTimeout(
        () => controller.abort(),
        VOICE_REQUEST_TIMEOUT_MS,
      );
      let audioUrl = "";
      try {
        const response = await fetch("/api/voice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
          signal: controller.signal,
        });
        if (!response.ok || response.status === 204) throw new Error("fallback");
        const blob = await response.blob();
        if (token !== narrationTokenRef.current) return;

        audioUrl = URL.createObjectURL(blob);
        const audio = new Audio(audioUrl);
        activeAudioRef.current = { audio, url: audioUrl, token };
        audio.addEventListener(
          "ended",
          () => {
            if (activeAudioRef.current?.token === token) {
              activeAudioRef.current = null;
            }
            URL.revokeObjectURL(audioUrl);
          },
          { once: true },
        );
        await audio.play();
      } catch {
        if (audioUrl) {
          if (activeAudioRef.current?.token === token) {
            activeAudioRef.current = null;
          }
          URL.revokeObjectURL(audioUrl);
        }
        if (
          token === narrationTokenRef.current &&
          soundOn &&
          "speechSynthesis" in window
        ) {
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.rate = 0.86;
          utterance.pitch = 1;
          window.speechSynthesis.speak(utterance);
        }
      } finally {
        if (voiceAbortRef.current === controller) {
          voiceAbortRef.current = null;
        }
        window.clearTimeout(timeout);
      }
    },
    [soundOn, stopNarration],
  );

  useEffect(() => {
    if (!soundOn) stopNarration();
  }, [soundOn, stopNarration]);

  useEffect(() => {
    if (screen === "calibrate") {
      void speak(
        calibrationStep === 0
          ? "Sit comfortably where we can see your head and hands."
          : calibrationStep === 1
            ? "Reach one hand gently out to the side, then the other."
            : "Lovely. Relax your shoulders.",
      );
    }
  }, [calibrationStep, screen, speak]);

  useEffect(() => {
    if (screen !== "calibrate" || !calibrationCanAdvance) return;
    const timer = window.setTimeout(() => {
      if (calibrationStep < 2) {
        setCalibrationStep((current) => current + 1);
      } else {
        const samples = calibrationSamplesRef.current;
        calibrationRef.current = createCalibrationEnvelope({
          neutralWristGap: boundedPercentile(
            samples.neutralWristGaps,
            0.5,
            1.6,
            0.35,
            4,
          ),
          leftOutwardMax: boundedPercentile(
            samples.leftOutward,
            0.8,
            1.45,
            0.2,
            3.5,
          ),
          rightOutwardMax: boundedPercentile(
            samples.rightOutward,
            0.8,
            1.45,
            0.2,
            3.5,
          ),
          openArmsMax: boundedPercentile(
            samples.openArms,
            0.8,
            2.9,
            0.4,
            7,
          ),
          targetFraction: 0.75,
        });
        setMoveIndex(0);
        setCompletedMoves([]);
        setScreen("play");
      }
    }, calibrationStep === 1 ? 3_200 : 1_900);
    return () => window.clearTimeout(timer);
  }, [calibrationCanAdvance, calibrationStep, screen]);

  useEffect(() => {
    if (screen !== "calibrate" || !landmarks) return;
    const selected = selectPoseLandmarks(landmarks);
    const smoothed = smoothLandmarks(smoothedPoseRef.current, selected, 0.35);
    smoothedPoseRef.current = smoothed;
    const pose = normalisePose(smoothed);
    if (!pose || pose.confidence < 0.5) return;
    if (calibrationStep === 0) {
      calibrationSamplesRef.current.neutralWristGaps.push(pose.wristDistance);
      return;
    }
    if (calibrationStep === 1) {
      const samples = calibrationSamplesRef.current;
      samples.leftOutward.push(pose.wrists.left.outward);
      samples.rightOutward.push(pose.wrists.right.outward);
      samples.openArms.push(pose.outwardSpan);
    }
  }, [calibrationStep, landmarks, screen]);

  useEffect(() => {
    if (screen === "play" && activeMove) {
      void speak(`${activeMove.label}. ${activeMove.cue}`);
    }
  }, [activeMove, screen, speak]);

  const completeCurrentMove = useCallback(() => {
    if (!postcard || !activeMove || completionLockRef.current) return;
    completionLockRef.current = true;
    setCompletedMoves((current) =>
      current.includes(activeMove.id) ? current : [...current, activeMove.id],
    );
    holdStateRef.current = createHoldState();
    waveEvidenceRef.current = createWaveEvidence("right");
    setHoldProgress(0);
    if (moveIndex >= postcard.plan.movements.length - 1) {
      if (activeSessionMode === "demo") setSessionMode("demo");
      stopCamera();
      setScreen("reveal");
      narrationDelayRef.current = window.setTimeout(() => {
        narrationDelayRef.current = null;
        void speak(postcard.message);
      }, 550);
    } else {
      setMoveIndex((current) => current + 1);
    }
  }, [
    activeMove,
    activeSessionMode,
    moveIndex,
    postcard,
    speak,
    stopCamera,
  ]);

  useEffect(() => {
    completionLockRef.current = false;
    holdStateRef.current = createHoldState();
    waveEvidenceRef.current = createWaveEvidence("right");
  }, [activeMove?.id]);

  useEffect(() => {
    if (
      screen !== "play" ||
      activeSessionMode !== "camera" ||
      !activeMove ||
      !landmarks
    ) {
      return;
    }
    const now = performance.now();
    const selected = selectPoseLandmarks(landmarks);
    const smoothed = smoothLandmarks(smoothedPoseRef.current, selected, 0.35);
    smoothedPoseRef.current = smoothed;
    const pose = normalisePose(smoothed);
    if (activeMove.id === "gentle_wave") {
      waveEvidenceRef.current = updateWaveEvidence(
        waveEvidenceRef.current,
        pose,
        now,
      );
    }
    const evaluation = evaluateMovement(
      activeMove.id,
      pose,
      calibrationRef.current,
      activeMove.id === "gentle_wave"
        ? { waveEvidence: waveEvidenceRef.current }
        : undefined,
    );
    holdStateRef.current = updateHoldState(
      holdStateRef.current,
      holdSignal(evaluation),
      now,
      { holdDurationMs: 720, releaseGraceMs: 200 },
    );
    setHoldProgress(holdStateRef.current.progress);
    if (holdStateRef.current.complete) completeCurrentMove();
  }, [
    activeMove,
    completeCurrentMove,
    landmarks,
    screen,
    activeSessionMode,
  ]);

  useEffect(() => {
    if (screen !== "play" || activeSessionMode !== "demo") return;
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        event.repeat ||
        (target instanceof Element &&
          target.closest(
            "button, a, input, textarea, select, [contenteditable='true']",
          ))
      ) {
        return;
      }
      if (event.code === "Space" || event.code === "Enter") {
        event.preventDefault();
        completeCurrentMove();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeSessionMode, completeCurrentMove, screen]);

  useEffect(() => {
    if (
      activeSessionMode !== "camera" ||
      (screen !== "calibrate" && screen !== "play")
    ) {
      return;
    }
    const frame = window.requestAnimationFrame(attachCameraPreview);
    return () => window.cancelAnimationFrame(frame);
  }, [activeSessionMode, attachCameraPreview, cameraStatus, screen]);

  useEffect(
    () => () => {
      stopNarration();
      stopCamera();
    },
    [stopCamera, stopNarration],
  );

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      screenHeadingRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [moveIndex, screen]);

  const createPostcard = async (event: FormEvent) => {
    event.preventDefault();
    if (createInFlightRef.current) return;
    if (!toName.trim() || !fromName.trim() || message.trim().length < 8) {
      setNotice("Add who it is for, who it is from and a short personal message.");
      return;
    }
    createInFlightRef.current = true;
    setIsCreating(true);
    setNotice("");
    setScreen("loading");
    try {
      let plan = fallbackPlans[theme];
      let provider: Provider = "demo";
      try {
        const response = await fetchWithClientTimeout(
          "/api/plan",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              to: toName.trim(),
              from: fromName.trim(),
              message: message.trim(),
              theme,
            }),
          },
          PLAN_REQUEST_TIMEOUT_MS,
        );
        if (response.ok) {
          const data = (await response.json()) as {
            plan?: unknown;
            provider?: Provider;
            mode?: "live" | "demo";
          };
          plan = safePlan(data.plan, theme);
          provider =
            data.provider === "openai" || data.provider === "anthropic"
              ? data.provider
              : "demo";
        }
      } catch {
        // The built-in sequence is deliberately available without a network.
      }

      const nextPostcard: Postcard = {
        toName: toName.trim().slice(0, 40),
        fromName: fromName.trim().slice(0, 40),
        message: message.trim().slice(0, 400),
        theme,
        plan,
        provider,
      };
      setPostcard(nextPostcard);
      const encoded = encodePostcard(nextPostcard);
      const embeddedUrl = `${window.location.origin}${window.location.pathname}#card=${encoded}`;
      setShareUrl(embeddedUrl);
      try {
        const response = await fetchWithClientTimeout(
          "/api/postcards",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(nextPostcard),
          },
          POSTCARD_REQUEST_TIMEOUT_MS,
        );
        if (response.ok) {
          const data = (await response.json()) as { id?: string };
          if (data.id) {
            setShareUrl(
              `${window.location.origin}${window.location.pathname}?postcard=${encodeURIComponent(data.id)}#card=${encoded}`,
            );
          }
        }
      } catch {
        // The embedded hash link remains usable when persistence is unavailable.
      }
      setScreen("ready");
    } finally {
      createInFlightRef.current = false;
      setIsCreating(false);
    }
  };

  const copyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      shareInputRef.current?.focus();
      shareInputRef.current?.select();
      setNotice("Copy the link from the box and send it to your family member.");
    }
  };

  const beginCameraSession = async () => {
    setSessionMode("camera");
    setNotice("");
    setCalibrationStep(0);
    setScreen("calibrate");
    await new Promise<void>((resolve) => {
      window.requestAnimationFrame(() => resolve());
    });
    await startCamera();
  };

  const beginDemoSession = () => {
    stopCamera();
    setSessionMode("demo");
    setCalibrationStep(0);
    setScreen("calibrate");
  };

  const useDemoControls = () => {
    stopCamera();
    setSessionMode("demo");
    setNotice("");
  };

  const startOver = () => {
    stopNarration();
    resetSession();
    window.history.replaceState({}, "", window.location.pathname);
    setPostcard(null);
    setShareUrl("");
    setNotice("");
    setScreen("create");
  };

  const currentTheme = postcard?.theme ?? theme;
  const stageStyle = {
    "--hold-progress": `${Math.round(holdProgress * 360)}deg`,
  } as CSSProperties;

  return (
    <main className={`app app-theme-${currentTheme}`}>
      <header className="topbar">
        <button className="brand" type="button" onClick={startOver}>
          <span className="brand-symbol" aria-hidden="true">
            M
          </span>
          <span>MoveMail</span>
        </button>
        <div className="topbar-actions">
          <span className="topbar-note">
            <span className="privacy-dot" aria-hidden="true" />
            Camera stays on this device
          </span>
          <button
            className="sound-toggle"
            type="button"
            aria-pressed={soundOn}
            onClick={() => setSoundOn((current) => !current)}
          >
            Sound {soundOn ? "on" : "off"}
          </button>
        </div>
      </header>

      {screen === "create" && (
        <section className="hero-grid">
          <div className="hero-copy">
            <p className="eyebrow">Movement postcards for people you love</p>
            <h1
              ref={screenHeadingRef}
              className="screen-heading"
              tabIndex={-1}
            >
              A message worth
              <span className="headline-accent"> moving for.</span>
            </h1>
            <p className="hero-intro">
              Write a personal note. MoveMail turns its story into three gentle,
              seated movements. Complete them to open the postcard.
            </p>
            <div className="promise-row" aria-label="MoveMail promises">
              <span>Seated</span>
              <span>At your pace</span>
              <span>No perfect score</span>
            </div>
            <p className="product-hypothesis">
              Product hypothesis: a movement should feel like opening a memory,
              not starting a workout.
            </p>
          </div>

          <form
            className="postcard-form"
            aria-busy={isCreating}
            onSubmit={createPostcard}
          >
            <span className="postcard-stamp" aria-hidden="true">
              MM
            </span>
            <div className="form-heading">
              <div>
                <p className="eyebrow">Create a postcard</p>
                <h2>Who are we moving for?</h2>
              </div>
              <span className="step-count">1 minute</span>
            </div>
            <div className="two-fields">
              <label>
                To
                <input
                  value={toName}
                  onChange={(event) => setToName(event.target.value)}
                  maxLength={40}
                  autoComplete="off"
                  required
                />
              </label>
              <label>
                From
                <input
                  value={fromName}
                  onChange={(event) => setFromName(event.target.value)}
                  maxLength={40}
                  autoComplete="off"
                  required
                />
              </label>
            </div>
            <fieldset className="theme-picker">
              <legend>Choose their scene</legend>
              <div className="theme-options">
                {(["seaside", "garden", "dance"] as Theme[]).map((item) => (
                  <label
                    className={`theme-option ${theme === item ? "selected" : ""}`}
                    key={item}
                  >
                    <input
                      type="radio"
                      name="theme"
                      value={item}
                      checked={theme === item}
                      onChange={() => setTheme(item)}
                    />
                    <span className={`theme-mark theme-mark-${item}`} />
                    <span>{themeNames[item]}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="message-field">
              Your message
              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                maxLength={400}
                minLength={8}
                rows={5}
                aria-describedby="postcard-data-note"
                required
              />
              <span>{message.length}/400</span>
            </label>
            {notice && (
              <p className="inline-notice" role="status">
                {notice}
              </p>
            )}
            <button
              className="primary-button"
              type="submit"
              disabled={isCreating}
            >
              {isCreating ? "Creating postcard…" : "Create their movement postcard"}
              <span aria-hidden="true">→</span>
            </button>
            <p className="resilience-note" id="postcard-data-note">
              For a live story, this message may be sent to OpenAI or Anthropic.
              Built-in demo mode takes over if either is unavailable.
            </p>
            <p className="resilience-note">
              Treat it like a postcard: do not include medical or highly private
              information.
            </p>
          </form>
        </section>
      )}

      {screen === "opening" && (
        <section className="loading-screen" aria-live="polite">
          <div className="scene-loader scene-loader-seaside" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <p className="eyebrow">Opening MoveMail</p>
          <h1
            ref={screenHeadingRef}
            className="screen-heading"
            tabIndex={-1}
          >
            Finding your postcard…
          </h1>
          <p>An embedded copy will take over if storage is unavailable.</p>
        </section>
      )}

      {screen === "loading" && (
        <section className="loading-screen" aria-live="polite">
          <div className={`scene-loader scene-loader-${theme}`} aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <p className="eyebrow">Preparing the route</p>
          <h1
            ref={screenHeadingRef}
            className="screen-heading"
            tabIndex={-1}
          >
            Turning your memory into three gentle moves…
          </h1>
          <p>
            Every suggestion is checked against a fixed, seated movement library.
          </p>
        </section>
      )}

      {screen === "ready" && postcard && (
        <section className="ready-layout">
          <div className="ready-copy">
            <p className="eyebrow">Postcard ready</p>
            <h1
              ref={screenHeadingRef}
              className="screen-heading"
              tabIndex={-1}
            >
              Send {postcard.toName} something they can feel.
            </h1>
            <p>
              This link carries the postcard and three supported seated movements.
              The experience reveals the message after the sequence.
            </p>
            <label className="share-box">
              Shareable link
              <span>
                <input
                  ref={shareInputRef}
                  value={shareUrl}
                  readOnly
                  aria-label="Shareable postcard link"
                />
                <button type="button" onClick={copyShareLink}>
                  {copied ? "Copied" : "Copy"}
                </button>
              </span>
            </label>
            {notice && (
              <p className="inline-notice" role="status">
                {notice}
              </p>
            )}
            <div className="ready-actions">
              <button
                className="primary-button"
                type="button"
                onClick={() => setScreen("prepare")}
              >
                Preview their experience
                <span aria-hidden="true">→</span>
              </button>
              <button className="text-button" type="button" onClick={startOver}>
                Make another
              </button>
            </div>
            <p className="resilience-note">
              {postcard.provider === "demo"
                ? "Demo fallback used: no sponsor AI key was required."
                : `${providerNames[postcard.provider]}; the fixed movement validator accepted all three moves.`}
            </p>
            <p className="medical-boundary">
              Anyone with this link can open it. The link is not encrypted, so
              keep sensitive information out of the message.
            </p>
          </div>
          <PostcardPreview postcard={postcard} />
        </section>
      )}

      {screen === "prepare" && postcard && (
        <section className="prepare-layout">
          <div className="prepare-visual">
            <p className="postcard-kicker">A MoveMail for {postcard.toName}</p>
            <div className="sealed-message">
              <span className="seal" aria-hidden="true">
                M
              </span>
              <p>Complete three gentle moves to open</p>
            </div>
          </div>
          <div className="prepare-card">
            <p className="eyebrow">Before we begin</p>
            <h1
              ref={screenHeadingRef}
              className="screen-heading"
              tabIndex={-1}
            >
              Get comfortable.
            </h1>
            <p className="plan-opening">{postcard.plan.opening}</p>
            <ul className="safety-list">
              <li>
                <span>1</span>
                Sit in a steady chair with both feet comfortable.
              </li>
              <li>
                <span>2</span>
                Keep the space around you clear. Move only within your easy range.
              </li>
              <li>
                <span>3</span>
                Stop if anything feels painful, dizzy or uncomfortable.
              </li>
            </ul>
            <button
              className="primary-button"
              type="button"
              onClick={beginCameraSession}
            >
              Use my camera
              <span aria-hidden="true">→</span>
            </button>
            <button
              className="secondary-button"
              type="button"
              onClick={beginDemoSession}
            >
              Continue without camera
            </button>
            {(cameraError || cameraStatus === "demo") && (
              <p className="inline-notice" role="status">
                Camera tracking is unavailable, so the camera-free on-screen
                controls are ready instead.
              </p>
            )}
            <p className="camera-note">
              Pose landmarks are calculated in your browser. No image or video is
              uploaded or saved.
            </p>
            <p className="medical-boundary">
              MoveMail is a wellbeing game, not medical advice or rehabilitation.
            </p>
          </div>
        </section>
      )}

      {screen === "calibrate" && postcard && (
        <section className="session-layout">
          <div className="session-stage">
            <div className="session-topline">
              <span>Comfort check</span>
              <span>{calibrationStep + 1} of 3</span>
            </div>
            <div className="camera-frame">
              {activeSessionMode === "camera" && cameraIsLive ? (
                <video
                  ref={videoRef}
                  className="camera-video"
                  muted
                  playsInline
                  aria-label="Your local camera preview"
                />
              ) : (
                <DemoSilhouette pose={calibrationStep === 1 ? "reach" : "rest"} />
              )}
              <div className={`calibration-rings step-${calibrationStep}`} />
            </div>
          </div>
          <aside className="session-aside calibration-copy" aria-live="polite">
            <p className="eyebrow">Your comfortable range</p>
            <h1
              ref={screenHeadingRef}
              className="screen-heading"
              tabIndex={-1}
            >
              {calibrationStep === 0
                ? "Sit naturally."
                : calibrationStep === 1
                  ? "Reach to each side."
                  : "That is plenty."}
            </h1>
            <p>
              {calibrationStep === 0
                ? "We are finding your shoulders and hands — no special pose needed."
                : calibrationStep === 1
                  ? "Reach one hand gently out, then the other. Stop wherever feels easy today."
                  : "Relax your shoulders. The game rewards your range, not somebody else’s."}
            </p>
            {activeSessionMode === "camera" && !calibrationCanAdvance && (
              <p className="inline-notice" role="status">
                Waiting until the camera can see your shoulders and hands. This
                check will not advance before tracking is ready.
              </p>
            )}
            <div className="calibration-progress" aria-hidden="true">
              <span
                style={{ width: `${((calibrationStep + 1) / 3) * 100}%` }}
              />
            </div>
            {activeSessionMode === "camera" && (
              <button
                className="secondary-button compact-button"
                type="button"
                onClick={useDemoControls}
              >
                Use on-screen controls
              </button>
            )}
            <button
              className="text-button"
              type="button"
              onClick={() => setScreen("play")}
            >
              Skip and use the default range
            </button>
          </aside>
        </section>
      )}

      {screen === "play" && postcard && activeMove && (
        <section className="game-frame" style={stageStyle}>
          <div className="game-landscape" aria-hidden="true">
            <span className="sun-shape" />
            <span className="hill hill-one" />
            <span className="hill hill-two" />
            <span className="flower flower-one" />
            <span className="flower flower-two" />
            <span className="flower flower-three" />
          </div>
          <div className="game-main">
            <div className="session-topline game-topline">
              <span>
                Move {moveIndex + 1} of {postcard.plan.movements.length}
              </span>
              <span className="session-mode">
                {activeSessionMode === "camera"
                  ? cameraStatus === "tracking"
                    ? `Camera tracking · ${Math.round(trackingConfidence * 100)}%`
                    : "Camera finding you"
                  : "Demo controls"}
              </span>
            </div>
            <div className="movement-stage">
              <div className={`movement-target target-${activeMove.id}`}>
                {activeSessionMode === "camera" && cameraIsLive ? (
                  <video
                    ref={videoRef}
                    className="camera-video game-video"
                    muted
                    playsInline
                    aria-label="Your local camera preview"
                  />
                ) : (
                  <DemoSilhouette pose={activeMove.id} />
                )}
                <div className="hold-ring" aria-hidden="true">
                  <span>{holdProgress > 0 ? "Hold" : "Move"}</span>
                </div>
              </div>
            </div>
          </div>
          <aside className="play-aside">
            <p className="eyebrow">{postcard.plan.title}</p>
            <h1
              ref={screenHeadingRef}
              className="screen-heading"
              tabIndex={-1}
            >
              {activeMove.label}
            </h1>
            <p className="cue-copy">{activeMove.cue}</p>
            <ol className="move-list" aria-label="Movement progress">
              {postcard.plan.movements.map((movement, index) => (
                <li
                  key={movement.id}
                  aria-current={index === moveIndex ? "step" : undefined}
                  className={
                    index < moveIndex
                      ? "complete"
                      : index === moveIndex
                        ? "active"
                        : ""
                  }
                >
                  <span className="move-number" aria-hidden="true">
                    {index < moveIndex ? "✓" : index + 1}
                  </span>
                  {movementCopy[movement.id].short}
                  <span className="sr-only">
                    {index < moveIndex
                      ? " completed"
                      : index === moveIndex
                        ? " current"
                        : " upcoming"}
                  </span>
                </li>
              ))}
            </ol>
            {activeSessionMode === "demo" ? (
              <button
                className="demo-complete-button"
                type="button"
                onClick={completeCurrentMove}
              >
                I did this move
                <span>Space or Enter</span>
              </button>
            ) : (
              <>
                <p className="camera-note">
                  Hold the movement briefly. If tracking pauses, relax and try
                  again.
                </p>
                <button
                  className="secondary-button compact-button"
                  type="button"
                  onClick={useDemoControls}
                >
                  Use on-screen controls
                </button>
              </>
            )}
            <button
              className="text-button"
              type="button"
              onClick={() => speak(`${activeMove.label}. ${activeMove.cue}`)}
            >
              Hear the instruction again
            </button>
          </aside>
        </section>
      )}

      {screen === "reveal" && postcard && (
        <section className="reveal-layout">
          <div className="reveal-scene" aria-hidden="true">
            <span className="reveal-sun" />
            <span className="reveal-wave reveal-wave-one" />
            <span className="reveal-wave reveal-wave-two" />
            <p>{completedMoves.length || 3} gentle moves</p>
          </div>
          <article className="message-reveal">
            <p className="eyebrow">Postcard opened</p>
            <h1
              ref={screenHeadingRef}
              className="screen-heading"
              tabIndex={-1}
            >
              For {postcard.toName}
            </h1>
            <p className="plan-closing">{postcard.plan.closing}</p>
            <p className="revealed-message">{postcard.message}</p>
            <p className="message-meta">With love, {postcard.fromName}</p>
            <div className="reveal-actions">
              <button
                className="primary-button"
                type="button"
                onClick={() => speak(postcard.message)}
              >
                Read it aloud
                <span aria-hidden="true">♪</span>
              </button>
              <button
                className="secondary-button"
                type="button"
                onClick={() => {
                  stopNarration();
                  resetSession();
                  setScreen("prepare");
                }}
              >
                Play again
              </button>
            </div>
            <dl className="tech-receipt">
              <div>
                <dt>Story</dt>
                <dd>{providerNames[postcard.provider]}</dd>
              </div>
              <div>
                <dt>Movement</dt>
                <dd>
                  {activeSessionMode === "camera"
                    ? "On-device pose tracking"
                    : "Accessible demo controls"}
                </dd>
              </div>
              <div>
                <dt>Privacy</dt>
                <dd>No video stored</dd>
              </div>
            </dl>
            <button className="text-button" type="button" onClick={startOver}>
              Create a postcard for someone else
            </button>
          </article>
        </section>
      )}
    </main>
  );
}

function PostcardPreview({ postcard }: { postcard: Postcard }) {
  return (
    <article className={`postcard-preview postcard-${postcard.theme}`}>
      <div className="postcard-scene" aria-hidden="true">
        <span className="scene-orbit" />
        <span className="scene-land" />
        <span className="scene-flower scene-flower-one" />
        <span className="scene-flower scene-flower-two" />
      </div>
      <div className="postcard-preview-copy">
        <p className="postcard-route">
          {postcard.fromName} <span>→</span> {postcard.toName}
        </p>
        <h2>{postcard.plan.title}</h2>
        <ol>
          {postcard.plan.movements.map((movement, index) => (
            <li key={movement.id}>
              <span>{index + 1}</span>
              {movement.label}
            </li>
          ))}
        </ol>
        <p className="provider-badge">{providerNames[postcard.provider]}</p>
      </div>
    </article>
  );
}

function DemoSilhouette({
  pose,
}: {
  pose: MovementId | "rest" | "reach";
}) {
  return (
    <div className={`demo-silhouette silhouette-${pose}`} aria-hidden="true">
      <span className="silhouette-head" />
      <span className="silhouette-body" />
      <span className="silhouette-arm arm-left" />
      <span className="silhouette-arm arm-right" />
      <span className="silhouette-chair" />
    </div>
  );
}
