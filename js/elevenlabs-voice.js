export const VOICE_SETTINGS_KEY = "moveMail.voice.v1";

export const DEFAULT_VOICE_SETTINGS = Object.freeze({
  provider: "device",
  voice: "",
  voiceLabel: "",
  onlinePostcardId: "",
});

const CLIENT_HEADERS = Object.freeze({
  Accept: "application/json",
  "X-MoveMail-Request": "voice-v1",
});
const VOICE_ALIAS_PATTERN = /^voice_[a-f0-9]{16}$/;

export class VoiceServiceError extends Error {
  constructor(message, { status = 0 } = {}) {
    super(message);
    this.name = "VoiceServiceError";
    this.status = status;
  }
}

function cleanText(value, maximumLength) {
  return typeof value === "string"
    ? value.trim().slice(0, maximumLength)
    : "";
}

function availableStorage() {
  try {
    return globalThis?.localStorage || null;
  } catch {
    return null;
  }
}

function retryDelay(milliseconds, signal) {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, milliseconds);
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

export function sanitiseVoiceSettings(value) {
  const source =
    value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const voice =
    typeof source.voice === "string" &&
    VOICE_ALIAS_PATTERN.test(source.voice.trim())
      ? source.voice.trim()
      : "";
  const provider =
    source.provider === "elevenlabs" && voice ? "elevenlabs" : "device";
  return Object.freeze({
    provider,
    voice,
    voiceLabel: cleanText(source.voiceLabel, 80),
    onlinePostcardId:
      provider === "elevenlabs"
        ? cleanText(source.onlinePostcardId, 120)
        : "",
  });
}

export function loadVoiceSettings(storage) {
  const targetStorage =
    arguments.length > 0 ? storage : availableStorage();
  try {
    const value = JSON.parse(
      targetStorage?.getItem(VOICE_SETTINGS_KEY) || "null",
    );
    return sanitiseVoiceSettings(value);
  } catch {
    return DEFAULT_VOICE_SETTINGS;
  }
}

export function saveVoiceSettings(
  value,
  storage,
) {
  const settings = sanitiseVoiceSettings(value);
  const targetStorage =
    arguments.length > 1 ? storage : availableStorage();
  try {
    if (!targetStorage) {
      return Object.freeze({ persisted: false, settings });
    }
    targetStorage.setItem(VOICE_SETTINGS_KEY, JSON.stringify(settings));
    return Object.freeze({ persisted: true, settings });
  } catch {
    return Object.freeze({ persisted: false, settings });
  }
}

async function parseError(response, fallback) {
  try {
    const body = await response.json();
    if (typeof body?.error === "string" && body.error.trim()) {
      return body.error.trim();
    }
  } catch {
    // The local service deliberately returns only small sanitised errors.
  }
  return fallback;
}

export function createElevenLabsVoiceController({
  fetchImpl = globalThis.fetch,
  AudioClass = globalThis.Audio,
  urlApi = globalThis.URL,
} = {}) {
  let activeAbortController = null;
  let activeAudio = null;
  let activeObjectUrl = "";
  let activeResolve = null;
  let generation = 0;
  let disposed = false;

  const support = Object.freeze({
    audio: Boolean(
      AudioClass &&
        urlApi?.createObjectURL &&
        urlApi?.revokeObjectURL &&
        fetchImpl,
    ),
  });

  function cleanUpAudio() {
    if (activeAudio) {
      activeAudio.onended = null;
      activeAudio.onerror = null;
      try {
        activeAudio.pause();
        activeAudio.removeAttribute?.("src");
        activeAudio.load?.();
      } catch {
        // Audio may already be detached or unsupported.
      }
      activeAudio = null;
    }
    if (activeObjectUrl) {
      urlApi.revokeObjectURL(activeObjectUrl);
      activeObjectUrl = "";
    }
    if (activeResolve) {
      activeResolve(false);
      activeResolve = null;
    }
  }

  function stop() {
    generation += 1;
    activeAbortController?.abort();
    activeAbortController = null;
    cleanUpAudio();
  }

  async function requestJson(path) {
    if (!fetchImpl || disposed) {
      throw new VoiceServiceError("The local voice service is unavailable.");
    }
    const response = await fetchImpl(path, {
      cache: "no-store",
      headers: CLIENT_HEADERS,
    });
    if (!response.ok) {
      throw new VoiceServiceError(
        await parseError(response, "The local voice service is unavailable."),
        { status: response.status },
      );
    }
    return response.json();
  }

  async function getStatus() {
    if (!fetchImpl || disposed) {
      return Object.freeze({
        configured: false,
        hostedDeviceOnly: false,
      });
    }
    try {
      const response = await fetchImpl("/api/elevenlabs/status", {
        cache: "no-store",
        headers: CLIENT_HEADERS,
      });
      if (!response.ok) {
        return Object.freeze({
          configured: false,
          hostedDeviceOnly: false,
        });
      }
      const result = await response.json();
      return Object.freeze({
        configured: result?.configured === true,
        hostedDeviceOnly: result?.hostedDeviceOnly === true,
      });
    } catch {
      return Object.freeze({
        configured: false,
        hostedDeviceOnly: false,
      });
    }
  }

  async function getConfig({ refresh = false } = {}) {
    const suffix = refresh ? "?refresh=1" : "";
    const result = await requestJson(`/api/elevenlabs/config${suffix}`);
    const voices = Array.isArray(result?.voices)
      ? result.voices
          .map((voice) => {
            const alias =
              typeof voice?.alias === "string" ? voice.alias.trim() : "";
            const label = cleanText(voice?.label, 80);
            return VOICE_ALIAS_PATTERN.test(alias) && label
              ? Object.freeze({ alias, label })
              : null;
          })
          .filter(Boolean)
      : [];
    return Object.freeze({
      available: result?.available === true,
      modelLabel: cleanText(result?.modelLabel, 60),
      voices: Object.freeze(voices),
    });
  }

  async function speak(
    text,
    { voice, purpose = "guidance", consent = false } = {},
  ) {
    const message = cleanText(text, purpose === "postcard" ? 280 : 360);
    if (
      disposed ||
      !support.audio ||
      !message ||
      !VOICE_ALIAS_PATTERN.test(String(voice || ""))
    ) {
      return false;
    }
    if (!["guidance", "postcard", "test"].includes(purpose)) {
      return false;
    }
    if (purpose === "postcard" && consent !== true) {
      return false;
    }

    stop();
    const requestGeneration = generation;
    const controller = new AbortController();
    activeAbortController = controller;
    const payload = { text: message, purpose, voice };
    if (purpose === "postcard") {
      payload.consent = true;
    }

    let response;
    let blob;
    try {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        response = await fetchImpl("/api/elevenlabs/speech", {
          method: "POST",
          cache: "no-store",
          credentials: "same-origin",
          headers: {
            ...CLIENT_HEADERS,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        if (response.status !== 409 || attempt === 2) {
          break;
        }
        await response.body?.cancel?.();
        await retryDelay(70 * 2 ** attempt, controller.signal);
      }
      if (requestGeneration !== generation || disposed) {
        return false;
      }
      if (!response.ok) {
        const errorMessage = await parseError(
          response,
          "The online voice could not speak.",
        );
        if (requestGeneration !== generation || disposed) {
          return false;
        }
        throw new VoiceServiceError(
          errorMessage,
          { status: response.status },
        );
      }
      const contentType = String(
        response.headers.get("content-type") || "",
      );
      if (!contentType.toLowerCase().startsWith("audio/")) {
        throw new VoiceServiceError(
          "The online voice returned invalid audio.",
        );
      }
      blob = await response.blob();
    } catch (error) {
      if (error?.name === "AbortError") {
        return false;
      }
      if (error instanceof VoiceServiceError) {
        throw error;
      }
      throw new VoiceServiceError("The online voice could not be reached.");
    } finally {
      if (activeAbortController === controller) {
        activeAbortController = null;
      }
    }

    if (requestGeneration !== generation || disposed) {
      return false;
    }
    const objectUrl = urlApi.createObjectURL(blob);
    const audio = new AudioClass(objectUrl);
    activeObjectUrl = objectUrl;
    activeAudio = audio;

    return new Promise((resolve, reject) => {
      activeResolve = resolve;
      audio.onended = () => {
        if (
          activeAudio !== audio ||
          requestGeneration !== generation
        ) {
          return;
        }
        activeResolve = null;
        cleanUpAudio();
        resolve(true);
      };
      audio.onerror = () => {
        if (
          activeAudio !== audio ||
          requestGeneration !== generation
        ) {
          return;
        }
        activeResolve = null;
        cleanUpAudio();
        reject(new VoiceServiceError("The online voice could not play."));
      };
      Promise.resolve(audio.play()).catch(() => {
        if (
          activeAudio !== audio ||
          requestGeneration !== generation
        ) {
          return;
        }
        activeResolve = null;
        cleanUpAudio();
        reject(
          new VoiceServiceError(
            "The browser blocked playback. Select the button again.",
          ),
        );
      });
    });
  }

  function dispose() {
    disposed = true;
    stop();
  }

  return Object.freeze({
    dispose,
    getConfig,
    getStatus,
    speak,
    stop,
    support,
    get playing() {
      return Boolean(activeAudio || activeAbortController);
    },
  });
}
