import { getChallenges } from "./game.js";
import { getFingerChallenges } from "./finger-game.js";
import { createAudioController } from "./audio.js";
import {
  createElevenLabsVoiceController,
  loadVoiceSettings,
  saveVoiceSettings,
} from "./elevenlabs-voice.js";
import { save as saveSession } from "./storage.js";
import {
  announce,
  createFocusTrap,
  focusSafely,
} from "./accessibility.js";
import { createHoldDetector } from "./movements.js";
import { createHandHoldDetector } from "./hand-movements.js";
import { HandEngine } from "./hand-engine.js";
import { PoseEngine, asPoseEngineError } from "./pose-engine.js";
import {
  SAMPLE_POSTCARD,
  createPostcard,
  deletePostcard as removePostcard,
  loadPostcard,
  savePostcard,
} from "./postcard.js";
import { createActiveSessionClock } from "./session-clock.js";

const MODE_LABELS = Object.freeze({
  standing: "Standing Play",
  seated: "Seated Play",
  fingers: "Finger Play",
  preview: "Camera-free Play",
});

const RESULT_MODE_LABELS = Object.freeze({
  standing: "Standing",
  seated: "Seated",
  fingers: "Finger",
  preview: "Camera-free",
});

const DEMO_CLASS_PREFIX = "pose-";
const HAND_DEMO_CLASS_PREFIX = "gesture-";
const PREVIEW_SUCCESS_DELAY = 3_200;
const TRANSITION_DELAY = 1_250;
const MIN_PROMPT_DURATION = 5_000;
const SESSION_DURATION = 60_000;
const HOLD_DURATION = 550;
const REMINDER_AFTER = 8_000;
const VOICE_TEST_TEXT =
  "Hello. I’m your MoveMail voice. We can take this gentle minute at your pace.";
const savedPostcard = loadPostcard();

const state = {
  mode: null,
  screen: "welcome",
  postcard: savedPostcard || { ...SAMPLE_POSTCARD },
  postcardStored: Boolean(savedPostcard),
  composerMode: "create",
  audio: createAudioController({ enabled: true }),
  elevenLabs: createElevenLabsVoiceController(),
  voiceSettings: loadVoiceSettings(),
  elevenLabsConfigured: false,
  elevenLabsHostedDeviceOnly: false,
  elevenLabsConnected: false,
  elevenLabsVoices: [],
  voiceConfigLoading: false,
  voiceConfigError: "",
  voiceStatusChecked: false,
  voiceTestActive: false,
  voiceRefreshGeneration: 0,
  voiceTestGeneration: 0,
  poseEngine: null,
  latestPose: null,
  challenges: [],
  challengeIndex: 0,
  challengeStartedAt: 0,
  sessionStartedAt: 0,
  totalPausedMs: 0,
  pausedAt: 0,
  stars: 0,
  completedMovements: 0,
  reminderGiven: false,
  challengeResolved: false,
  challengeFrame: null,
  sessionFrame: null,
  sessionClock: null,
  timeAnnouncements: new Set(),
  transitionTimer: null,
  transitionDueAt: 0,
  transitionRemainingMs: null,
  holdDetector: null,
  pauseRelease: null,
  isPaused: false,
  operationGeneration: 0,
};

const screens = [...document.querySelectorAll("[data-screen]")];
const modePills = [...document.querySelectorAll("[data-mode-pill]")];
const soundLabels = [...document.querySelectorAll("[data-sound-label]")];
const soundButtons = [...document.querySelectorAll('[data-action="sound"]')];
const audioNotice = document.querySelector("[data-audio-notice]");
const safetyChecks = [...document.querySelectorAll("[data-safety-check]")];
const bodySafetyReminders = [
  ...document.querySelectorAll("[data-body-safety]"),
];
const fingerSafetyReminders = [
  ...document.querySelectorAll("[data-finger-safety]"),
];
const safetyContinue = document.querySelector('[data-action="safety-continue"]');
const howDialog = document.querySelector("#how-dialog");
const cloudMessageDialog = document.querySelector("#cloud-message-dialog");
const pauseOverlay = document.querySelector("[data-pause-overlay]");
const setupVideo = document.querySelector("#camera-video");
const setupCanvas = document.querySelector("#pose-canvas");
const gameVideo = document.querySelector("#game-video");
const gameCanvas = document.querySelector("#game-canvas");
const postcardForm = document.querySelector("[data-postcard-form]");
const voiceSettingsForm = document.querySelector(
  "[data-voice-settings-form]",
);
const postcardMessageInput = document.querySelector(
  "[data-postcard-message-input]",
);
const postcardRecipients = [
  ...document.querySelectorAll("[data-postcard-recipient]"),
];
const postcardSenders = [...document.querySelectorAll("[data-postcard-sender]")];

const elements = {
  setupEyebrow: document.querySelector("[data-setup-eyebrow]"),
  setupTitle: document.querySelector("[data-setup-title]"),
  setupIntro: document.querySelector("[data-setup-intro]"),
  cameraFrame: document.querySelector("[data-camera-frame]"),
  cameraLabel: document.querySelector("[data-camera-label]"),
  cameraPrivacy: document.querySelector("[data-camera-privacy]"),
  previewDemo: document.querySelector("[data-preview-demo]"),
  setupStatus: document.querySelector("[data-setup-status]"),
  statusTitle: document.querySelector("[data-status-title]"),
  statusDetail: document.querySelector("[data-status-detail]"),
  modelProgress: document.querySelector("[data-model-progress]"),
  modelProgressLabel: document.querySelector(
    "[data-model-progress-label]",
  ),
  modelPercent: document.querySelector("[data-model-percent]"),
  modelBar: document.querySelector("[data-model-bar]"),
  positionTips: document.querySelector("[data-position-tips]"),
  bodyTips: [...document.querySelectorAll("[data-body-tip]")],
  fingerTips: [...document.querySelectorAll("[data-finger-tip]")],
  standingTip: document.querySelector("[data-standing-tip]"),
  bodyFrameGuide: document.querySelector("[data-body-guide]"),
  handFrameGuide: document.querySelector("[data-hand-guide]"),
  cameraError: document.querySelector("[data-camera-error]"),
  cameraErrorMessage: document.querySelector("[data-camera-error-message]"),
  enableCamera: document.querySelector('[data-action="enable-camera"]'),
  startSession: document.querySelector('[data-action="start-session"]'),
  startSessionLabel: document.querySelector(
    "[data-start-session-label]",
  ),
  retryCamera: document.querySelector('[data-action="retry-camera"]'),
  usePreview: document.querySelector("[data-use-preview]"),
  previewBadge: document.querySelector("[data-preview-badge]"),
  miniGame: document.querySelector("[data-mini-game]"),
  sessionTime: document.querySelector("[data-session-time]"),
  starTotal: document.querySelector("[data-star-total]"),
  gameProgress: document.querySelector("[data-game-progress]"),
  challengeName: document.querySelector("[data-challenge-name]"),
  challengeInstruction: document.querySelector("[data-challenge-instruction]"),
  safetyHint: document.querySelector("[data-safety-hint]"),
  feedback: document.querySelector("[data-feedback]"),
  feedbackTitle: document.querySelector("[data-feedback-title]"),
  feedbackDetail: document.querySelector("[data-feedback-detail]"),
  clockBar: document.querySelector("[data-clock-bar]"),
  clockLabel: document.querySelector("[data-clock-label]"),
  demoPerson: document.querySelector("[data-demo-person]"),
  demoHand: document.querySelector("[data-demo-hand]"),
  demoCaption: document.querySelector("[data-demo-caption]"),
  movementDemo: document.querySelector("[data-movement-demo]"),
  playStage: document.querySelector("[data-play-stage]"),
  playerView: document.querySelector("[data-player-view]"),
  playerViewLabel: document.querySelector("[data-player-view-label]"),
  resultStars: document.querySelector("[data-result-stars]"),
  resultMovements: document.querySelector("[data-result-movements]"),
  resultMovementsLabel: document.querySelector(
    "[data-result-movements-label]",
  ),
  resultDuration: document.querySelector("[data-result-duration]"),
  resultMode: document.querySelector("[data-result-mode]"),
  resultStats: document.querySelector("[data-result-stats]"),
  resultsMessage: document.querySelector("[data-results-message]"),
  historyNote: document.querySelector("[data-history-note]"),
  currentPostcard: document.querySelector("[data-current-postcard]"),
  homeCardTitle: document.querySelector("[data-home-card-title]"),
  unlockLabel: document.querySelector("[data-unlock-label]"),
  messageCount: document.querySelector("[data-message-count]"),
  waitingMessage: document.querySelector("[data-waiting-message]"),
  revealRecipient: document.querySelector("[data-reveal-recipient]"),
  revealSender: document.querySelector("[data-reveal-sender]"),
  revealMessage: document.querySelector("[data-reveal-message]"),
  postcardStorageStatus: document.querySelector(
    "[data-postcard-storage-status]",
  ),
  readMessage: document.querySelector("[data-read-message]"),
  readMessageLabel: document.querySelector("[data-read-message-label]"),
  readMessageNote: document.querySelector("[data-read-message-note]"),
  elevenLabsStatus: document.querySelector("[data-elevenlabs-status]"),
  elevenLabsStatusDetail: document.querySelector(
    "[data-elevenlabs-status-detail]",
  ),
  elevenLabsSetup: document.querySelector("[data-elevenlabs-setup]"),
  elevenLabsHosted: document.querySelector("[data-elevenlabs-hosted]"),
  refreshVoices: document.querySelector("[data-refresh-voices]"),
  voiceProviderDevice: document.querySelector(
    '[data-voice-provider="device"]',
  ),
  voiceProviderElevenLabs: document.querySelector(
    '[data-voice-provider="elevenlabs"]',
  ),
  elevenLabsVoice: document.querySelector("[data-elevenlabs-voice]"),
  testVoice: document.querySelector("[data-test-voice]"),
  onlinePostcardConsent: document.querySelector(
    "[data-online-postcard-consent]",
  ),
  voiceSettingsError: document.querySelector(
    "[data-voice-settings-error]",
  ),
};

function now() {
  return globalThis.performance?.now?.() ?? Date.now();
}

function beginOperation() {
  state.operationGeneration += 1;
  return state.operationGeneration;
}

function isOperationCurrent(operation) {
  return operation === state.operationGeneration;
}

function formatDuration(totalSeconds) {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const minutesPart = Math.floor(seconds / 60);
  const secondsPart = String(seconds % 60).padStart(2, "0");
  return `${minutesPart}:${secondsPart}`;
}

function setText(element, text) {
  if (element) {
    element.textContent = text;
  }
}

function formatCountdown(milliseconds) {
  return formatDuration(Math.ceil(Math.max(0, milliseconds) / 1_000));
}

function clearRevealedMessage() {
  setText(elements.revealMessage, "");
}

function renderPostcardDetails() {
  const { recipient, sender, unlocked, isSample } = state.postcard;
  for (const element of postcardRecipients) {
    setText(element, recipient);
  }
  for (const element of postcardSenders) {
    setText(element, sender);
  }
  setText(elements.revealRecipient, recipient);
  setText(elements.revealSender, sender);
  setText(elements.homeCardTitle, `For ${recipient}, from ${sender}`);
  setText(
    elements.currentPostcard,
    isSample
      ? "A sample MoveMail is ready to try."
      : `A MoveMail for ${recipient}, from ${sender}, is ready on this device.`,
  );
  setText(
    elements.unlockLabel,
    unlocked ? "Read opened message" : "Unlock with movement",
  );
  updateMessageReadAloudControls();
}

function fillPostcardForm(postcard = null) {
  if (!postcardForm) {
    return;
  }
  postcardForm.elements.recipient.value = postcard?.recipient || "";
  postcardForm.elements.sender.value = postcard?.sender || "";
  postcardForm.elements.message.value = postcard?.message || "";
  for (const field of postcardForm.elements) {
    field.setCustomValidity?.("");
  }
  setText(
    elements.messageCount,
    String(postcardForm.elements.message.value.length),
  );
  messageLengthAnnouncement = "";
}

function clearSessionFrame() {
  if (state.sessionFrame !== null) {
    cancelAnimationFrame(state.sessionFrame);
    state.sessionFrame = null;
  }
}

function clearChallengeTimers() {
  if (state.challengeFrame !== null) {
    cancelAnimationFrame(state.challengeFrame);
    state.challengeFrame = null;
  }
  if (state.transitionTimer !== null) {
    clearTimeout(state.transitionTimer);
    state.transitionTimer = null;
  }
  state.transitionDueAt = 0;
  state.transitionRemainingMs = null;
}

function showScreen(name, focusTarget) {
  clearChallengeTimers();
  if (name !== "game") {
    clearSessionFrame();
  }
  state.screen = name;

  for (const screen of screens) {
    const active = screen.dataset.screen === name;
    screen.hidden = !active;
    screen.classList.toggle("is-active", active);
    screen.classList.remove("is-entering");
    if (active) {
      requestAnimationFrame(() => screen.classList.add("is-entering"));
    }
  }

  window.scrollTo({ top: 0, behavior: "auto" });
  const activeScreen = document.querySelector(`[data-screen="${name}"]`);
  requestAnimationFrame(() => {
    focusSafely(
      focusTarget || activeScreen?.querySelector("h1, h2") || activeScreen,
    );
  });
}

function setModeLabels() {
  const label = MODE_LABELS[state.mode] || "Camera-free Play";
  for (const pill of modePills) {
    pill.textContent = label;
  }
}

function stopVoiceOutput() {
  state.voiceTestGeneration += 1;
  state.elevenLabs.stop();
  state.audio.stopSpeaking();
  state.voiceTestActive = false;
  if (elements.testVoice) {
    setText(elements.testVoice, "Test voice");
  }
}

function onlineVoiceReady() {
  return Boolean(
      state.elevenLabs.support.audio &&
      state.elevenLabsConfigured &&
      state.elevenLabsConnected &&
      state.voiceSettings.provider === "elevenlabs" &&
      state.voiceSettings.voice &&
      state.elevenLabsVoices.some(
        (voice) => voice.alias === state.voiceSettings.voice,
      ),
  );
}

function onlinePostcardVoiceReady() {
  return Boolean(
    onlineVoiceReady() &&
      state.voiceSettings.onlinePostcardId === state.postcard.id,
  );
}

function updateMessageReadAloudControls() {
  const onlineReady = onlinePostcardVoiceReady();
  const deviceReady = state.audio.support.speech;
  if (elements.readMessage) {
    elements.readMessage.hidden = !(onlineReady || deviceReady);
  }
  setText(
    elements.readMessageLabel,
    onlineReady ? "Read with ElevenLabs" : "Read message aloud",
  );
  setText(
    elements.readMessageNote,
    onlineReady
      ? "Choosing Read with ElevenLabs sends this message’s text to ElevenLabs after one more confirmation."
      : state.voiceSettings.provider === "elevenlabs" &&
          state.elevenLabsConfigured
        ? "Personal messages still use the device voice. Online message reading is off in Voice settings."
        : "For privacy, message read-aloud uses a local device voice only.",
  );
}

async function speakGuidance(text) {
  if (!state.audio.enabled) {
    return false;
  }
  if (onlineVoiceReady()) {
    state.audio.stopSpeaking();
    try {
      return await state.elevenLabs.speak(text, {
        voice: state.voiceSettings.voice,
        purpose: "guidance",
      });
    } catch {
      if (!state.audio.enabled) {
        return false;
      }
    }
  }
  return state.audio.speak(text);
}

function setVoiceSettingsError(message = "") {
  if (!elements.voiceSettingsError) {
    return;
  }
  setText(elements.voiceSettingsError, message);
  elements.voiceSettingsError.hidden = !message;
}

function populateVoiceOptions(selectedVoice = "") {
  if (!elements.elevenLabsVoice) {
    return;
  }
  elements.elevenLabsVoice.replaceChildren();
  const initialOption = document.createElement("option");
  initialOption.value = "";
  initialOption.textContent = state.voiceConfigLoading
    ? "Loading voices…"
    : "Choose a voice";
  elements.elevenLabsVoice.append(initialOption);

  for (const voice of state.elevenLabsVoices) {
    const option = document.createElement("option");
    option.value = voice.alias;
    option.textContent = voice.label;
    elements.elevenLabsVoice.append(option);
  }
  elements.elevenLabsVoice.value = state.elevenLabsVoices.some(
    (voice) => voice.alias === selectedVoice,
  )
    ? selectedVoice
    : "";
}

function updateVoiceSettingsAvailability() {
  const onlineAvailable = Boolean(
    state.elevenLabsConfigured &&
      state.elevenLabsConnected &&
      state.elevenLabsVoices.length,
  );
  if (elements.voiceProviderElevenLabs) {
    elements.voiceProviderElevenLabs.disabled = !onlineAvailable;
    if (
      !onlineAvailable &&
      elements.voiceProviderElevenLabs.checked &&
      elements.voiceProviderDevice
    ) {
      elements.voiceProviderDevice.checked = true;
    }
  }
  if (elements.elevenLabsVoice) {
    elements.elevenLabsVoice.disabled = !onlineAvailable;
  }
  if (elements.refreshVoices) {
    elements.refreshVoices.disabled =
      state.voiceConfigLoading || !state.elevenLabsConfigured;
  }

  const onlineSelected =
    elements.voiceProviderElevenLabs?.checked === true;
  const voiceSelected = Boolean(elements.elevenLabsVoice?.value);
  if (elements.testVoice) {
    elements.testVoice.disabled =
      !onlineAvailable || !voiceSelected || state.voiceConfigLoading;
  }
  if (elements.onlinePostcardConsent) {
    elements.onlinePostcardConsent.disabled =
      !onlineAvailable || !onlineSelected || !voiceSelected;
    if (elements.onlinePostcardConsent.disabled) {
      elements.onlinePostcardConsent.checked = false;
    }
  }
}

function renderVoiceConnectionStatus() {
  if (!elements.elevenLabsStatus) {
    return;
  }

  if (!state.voiceStatusChecked) {
    setText(elements.elevenLabsStatus, "Checking voice setup…");
    setText(
      elements.elevenLabsStatusDetail,
      "MoveMail is checking which voice options are available.",
    );
    elements.elevenLabsStatus.dataset.state = "checking";
  } else if (state.elevenLabsHostedDeviceOnly) {
    setText(elements.elevenLabsStatus, "Device voice on this hosted version");
    setText(
      elements.elevenLabsStatusDetail,
      "Online ElevenLabs speech is disabled on this public site. Device voice and on-screen instructions remain available.",
    );
    elements.elevenLabsStatus.dataset.state = "idle";
  } else if (!state.elevenLabsConfigured) {
    setText(elements.elevenLabsStatus, "Not configured");
    setText(
      elements.elevenLabsStatusDetail,
      "Add an ElevenLabs API key to the local server to choose an online voice. Device voice remains available.",
    );
    elements.elevenLabsStatus.dataset.state = "idle";
  } else if (state.voiceConfigLoading) {
    setText(elements.elevenLabsStatus, "Checking connection…");
    setText(
      elements.elevenLabsStatusDetail,
      "MoveMail is securely checking the available voices.",
    );
    elements.elevenLabsStatus.dataset.state = "checking";
  } else if (state.elevenLabsConnected) {
    setText(elements.elevenLabsStatus, "Connected to ElevenLabs");
    setText(
      elements.elevenLabsStatusDetail,
      `${state.elevenLabsVoices.length} online ${state.elevenLabsVoices.length === 1 ? "voice is" : "voices are"} available. The API key remains in the local server.`,
    );
    elements.elevenLabsStatus.dataset.state = "connected";
  } else if (state.voiceConfigError) {
    setText(elements.elevenLabsStatus, "Connection could not be verified");
    setText(elements.elevenLabsStatusDetail, state.voiceConfigError);
    elements.elevenLabsStatus.dataset.state = "error";
  } else {
    setText(elements.elevenLabsStatus, "API key found");
    setText(
      elements.elevenLabsStatusDetail,
      "Check the connection to load the voices available to this account.",
    );
    elements.elevenLabsStatus.dataset.state = "idle";
  }

  if (elements.elevenLabsSetup) {
    elements.elevenLabsSetup.hidden =
      state.elevenLabsConfigured || state.elevenLabsHostedDeviceOnly;
  }
  if (elements.elevenLabsHosted) {
    elements.elevenLabsHosted.hidden =
      !state.elevenLabsHostedDeviceOnly;
  }
  updateVoiceSettingsAvailability();
}

async function refreshElevenLabsStatus({
  loadVoices = false,
  refresh = false,
  operation = state.operationGeneration,
} = {}) {
  const refreshGeneration = ++state.voiceRefreshGeneration;
  const currentSelection =
    elements.elevenLabsVoice?.value || state.voiceSettings.voice;
  const refreshIsCurrent = () =>
    refreshGeneration === state.voiceRefreshGeneration &&
    isOperationCurrent(operation);
  if (loadVoices) {
    state.voiceConfigLoading = true;
    state.voiceConfigError = "";
    populateVoiceOptions(currentSelection);
    renderVoiceConnectionStatus();
    updateVoiceSettingsAvailability();
  }

  try {
    const status = await state.elevenLabs.getStatus();
    if (!refreshIsCurrent()) {
      return false;
    }
    state.voiceStatusChecked = true;
    state.elevenLabsConfigured = status.configured;
    state.elevenLabsHostedDeviceOnly = status.hostedDeviceOnly;
    if (!status.configured) {
      state.elevenLabsConnected = false;
      state.elevenLabsVoices = [];
      state.voiceConfigError = "";
      populateVoiceOptions();
      return false;
    }
    if (!loadVoices) {
      return true;
    }

    const config = await state.elevenLabs.getConfig({ refresh });
    if (!refreshIsCurrent()) {
      return false;
    }
    state.elevenLabsVoices = [...config.voices];
    state.elevenLabsConnected =
      config.available && state.elevenLabsVoices.length > 0;
    state.voiceConfigError = state.elevenLabsConnected
      ? ""
      : "The account connected, but no usable voices were returned.";
    populateVoiceOptions(currentSelection);
    return state.elevenLabsConnected;
  } catch {
    if (!refreshIsCurrent()) {
      return false;
    }
    state.elevenLabsConnected = false;
    state.elevenLabsVoices = [];
    state.voiceConfigError =
      "Check the API key, its Text to Speech permission and account credit, then try again.";
    populateVoiceOptions();
    return false;
  } finally {
    if (refreshIsCurrent()) {
      state.voiceConfigLoading = false;
      renderVoiceConnectionStatus();
      updateSoundControls();
      updateAudioSupportNotice();
    }
  }
}

function renderVoiceSettingsForm() {
  setVoiceSettingsError();
  const onlineStored =
    state.voiceSettings.provider === "elevenlabs" &&
    state.elevenLabsConnected;
  if (elements.voiceProviderDevice) {
    elements.voiceProviderDevice.checked = !onlineStored;
  }
  if (elements.voiceProviderElevenLabs) {
    elements.voiceProviderElevenLabs.checked = onlineStored;
  }
  populateVoiceOptions(state.voiceSettings.voice);
  if (elements.onlinePostcardConsent) {
    elements.onlinePostcardConsent.checked =
      onlineStored &&
      state.voiceSettings.onlinePostcardId === state.postcard.id;
  }
  renderVoiceConnectionStatus();
}

async function openVoiceSettings() {
  const operation = beginOperation();
  stopVoiceOutput();
  showScreen("settings", "#settings-title");
  renderVoiceSettingsForm();
  const connected = await refreshElevenLabsStatus({
    loadVoices: true,
    operation,
  });
  if (!isOperationCurrent(operation) || state.screen !== "settings") {
    return;
  }
  renderVoiceSettingsForm();
  announce(
    connected
      ? "ElevenLabs connected. Choose a voice."
      : state.elevenLabsHostedDeviceOnly
        ? "Online voice is disabled on this hosted version. Device voice is selected."
        : state.elevenLabsConfigured
          ? "The ElevenLabs connection could not be verified."
          : "ElevenLabs is not configured. Device voice is selected.",
  );
}

function closeVoiceSettings(announcement = "MoveMail home.") {
  beginOperation();
  stopVoiceOutput();
  showScreen("welcome", "#welcome-title");
  announce(announcement);
}

async function testElevenLabsVoice() {
  if (state.voiceTestActive) {
    stopVoiceOutput();
    announce("Voice test stopped.");
    return;
  }
  if (!state.audio.enabled) {
    setVoiceSettingsError("Turn Sound On before testing an online voice.");
    return;
  }
  const voice = elements.elevenLabsVoice?.value || "";
  if (!voice || !state.elevenLabsConnected) {
    setVoiceSettingsError("Choose an available ElevenLabs voice first.");
    return;
  }

  const operation = state.operationGeneration;
  const testGeneration = ++state.voiceTestGeneration;
  setVoiceSettingsError();
  state.voiceTestActive = true;
  setText(elements.testVoice, "Stop voice test");
  state.audio.stopSpeaking();
  try {
    await state.elevenLabs.speak(VOICE_TEST_TEXT, {
      voice,
      purpose: "test",
    });
  } catch {
    if (
      testGeneration === state.voiceTestGeneration &&
      isOperationCurrent(operation) &&
      state.screen === "settings"
    ) {
      setVoiceSettingsError(
        "The voice test could not play. Check the connection and account credit, then try again.",
      );
    }
  } finally {
    if (
      testGeneration === state.voiceTestGeneration &&
      isOperationCurrent(operation) &&
      state.screen === "settings"
    ) {
      state.voiceTestActive = false;
      setText(elements.testVoice, "Test voice");
    }
  }
}

function updateSoundControls() {
  const isEnabled = state.audio.enabled;
  const hasAudioSupport =
    state.audio.support.speech ||
    state.audio.support.tones ||
    (state.elevenLabsConfigured && state.elevenLabs.support.audio);
  for (const label of soundLabels) {
    label.textContent = hasAudioSupport
      ? isEnabled
        ? "Sound On"
        : "Sound Off"
      : "Audio Unavailable";
  }
  for (const button of soundButtons) {
    button.disabled = !hasAudioSupport;
    button.setAttribute(
      "aria-pressed",
      String(isEnabled && hasAudioSupport),
    );
    button.setAttribute(
      "aria-label",
      hasAudioSupport
        ? isEnabled
          ? "Turn sound off"
          : "Turn sound on"
      : "Audio is unavailable in this browser",
    );
  }
  updateMessageReadAloudControls();
}

function updateAudioSupportNotice() {
  if (!audioNotice) {
    return;
  }

  if (
    state.audio.support.speech ||
    (onlineVoiceReady() && state.elevenLabs.support.audio)
  ) {
    audioNotice.hidden = true;
    return;
  }

  audioNotice.hidden = false;
  setText(
    audioNotice,
    state.audio.support.tones
      ? "Spoken instructions are unavailable in this browser. Visual instructions and gentle sound cues will continue."
      : "Audio is unavailable in this browser. Visual instructions will remain on screen throughout the game.",
  );
}

async function toggleSound() {
  const enabled = state.audio.toggle();
  if (!enabled) {
    state.elevenLabs.stop();
    state.voiceTestActive = false;
    setText(elements.testVoice, "Test voice");
  }
  updateSoundControls();
  if (enabled) {
    await state.audio.unlock();
    await state.audio.playTransition();
    announce("Sound on.");
  } else {
    announce("Sound off.");
  }
}

function resetSafetyChecks() {
  for (const check of safetyChecks) {
    check.checked = false;
  }
  safetyContinue.disabled = true;
}

function updateSafetyContinue() {
  safetyContinue.disabled = !safetyChecks.every((check) => check.checked);
}

function updateSafetyMode() {
  const fingers = state.mode === "fingers";
  for (const reminder of bodySafetyReminders) {
    reminder.hidden = fingers;
  }
  for (const reminder of fingerSafetyReminders) {
    reminder.hidden = !fingers;
  }
}

function openComposer({ edit = false } = {}) {
  const existingPostcard =
    edit && !state.postcard.isSample ? state.postcard : null;
  state.composerMode = existingPostcard ? "edit" : "create";
  fillPostcardForm(existingPostcard);
  showScreen("compose", "#compose-title");
  announce(
    existingPostcard
      ? "Edit the movement postcard before handover."
      : "Create a new movement postcard.",
  );
}

function validatePostcardForm() {
  const messages = {
    recipient: "Enter the recipient’s name.",
    sender: "Enter the sender’s name.",
    message: "Enter a personal message.",
  };
  let firstInvalid = null;

  for (const [name, message] of Object.entries(messages)) {
    const field = postcardForm.elements[name];
    field.setCustomValidity(field.value.trim() ? "" : message);
    if (!field.checkValidity() && !firstInvalid) {
      firstInvalid = field;
    }
  }

  if (!firstInvalid) {
    return true;
  }

  firstInvalid.focus();
  firstInvalid.reportValidity();
  announce(firstInvalid.validationMessage, { priority: "assertive" });
  return false;
}

function preparePostcard(event) {
  event.preventDefault();
  if (!validatePostcardForm()) {
    return;
  }
  if (
    state.composerMode === "create" &&
    !state.postcard.isSample &&
    !window.confirm(
      `Replace the existing MoveMail for ${state.postcard.recipient}? The old postcard will be deleted.`,
    )
  ) {
    announce("The existing postcard was kept.");
    return;
  }
  const formData = new FormData(postcardForm);
  const postcard = createPostcard({
    recipient: formData.get("recipient"),
    sender: formData.get("sender"),
    message: formData.get("message"),
    unlocked: false,
  });

  if (!postcard) {
    announce("Add a recipient, sender and message before continuing.", {
      priority: "assertive",
    });
    return;
  }

  state.postcard = postcard;
  state.postcardStored = savePostcard(postcard);
  renderPostcardDetails();
  setText(
    elements.postcardStorageStatus,
    state.postcardStored
      ? "The postcard is stored only in this browser until it is deleted."
      : "This browser could not retain the postcard. Keep this page open until the recipient has read it.",
  );
  postcardForm.reset();
  setText(elements.messageCount, "0");
  clearRevealedMessage();
  showScreen("prepared", "#prepared-title");
  announce(
    `MoveMail for ${postcard.recipient} is ready on this device. The message is sealed.`,
  );
}

function showPostcard() {
  if (state.postcard.unlocked) {
    revealPostcard({ completionReason: "existing" });
    return;
  }
  clearRevealedMessage();
  renderPostcardDetails();
  showScreen("postcard", "#postcard-title");
  announce(
    `A sealed MoveMail for ${state.postcard.recipient}, from ${state.postcard.sender}.`,
  );
}

function beginUnlock() {
  if (state.postcard.unlocked) {
    revealPostcard({ completionReason: "existing" });
    return;
  }
  showScreen("mode", "#mode-title");
  announce("Choose the most comfortable way to move.");
}

function clearCurrentPostcard() {
  const removed = removePostcard();
  state.postcard = { ...SAMPLE_POSTCARD };
  state.postcardStored = false;
  postcardForm?.reset();
  setText(elements.messageCount, "0");
  clearRevealedMessage();
  renderPostcardDetails();
  return removed;
}

function chooseMode(mode) {
  if (!Object.hasOwn(MODE_LABELS, mode)) {
    return;
  }
  state.mode = mode;
  setModeLabels();
  resetSafetyChecks();
  updateSafetyMode();
  showScreen("safety", "#safety-title");
  announce(`${MODE_LABELS[mode]} selected. Review the safety checks.`);
}

function resetSetupStatus() {
  elements.setupStatus.classList.remove("is-ready", "is-loading");
  setText(elements.statusTitle, "Camera is off");
  setText(
    elements.statusDetail,
    "Choose “Turn On Camera” when you are ready.",
  );
  elements.cameraLabel.classList.remove("is-on");
  elements.cameraLabel.innerHTML =
    '<i aria-hidden="true"></i> Camera is off';
  elements.modelProgress.hidden = true;
  elements.modelBar.style.width = "0%";
  elements.cameraError.hidden = true;
  elements.enableCamera.hidden = false;
  elements.enableCamera.disabled = false;
  elements.startSession.hidden = true;
  elements.startSession.disabled = true;
  elements.retryCamera.hidden = true;
}

function configureSetup() {
  resetSetupStatus();
  const preview = state.mode === "preview";
  const fingers = state.mode === "fingers";

  elements.previewDemo.hidden = !preview;
  setupVideo.hidden = preview;
  setupCanvas.hidden = preview;
  elements.bodyFrameGuide.hidden = preview || fingers;
  elements.handFrameGuide.hidden = !fingers;
  elements.cameraPrivacy.hidden = preview;
  elements.positionTips.hidden = preview;
  elements.usePreview.hidden = preview;
  elements.standingTip.hidden = state.mode !== "standing";
  for (const tip of elements.bodyTips) {
    tip.hidden = fingers;
  }
  for (const tip of elements.fingerTips) {
    tip.hidden = !fingers;
  }
  setText(
    elements.modelProgressLabel,
    fingers
      ? "Preparing private finger tracking…"
      : "Preparing private body tracking…",
  );
  setText(
    elements.startSessionLabel,
    "Start one-minute unlock",
  );

  if (preview) {
    setText(elements.setupEyebrow, "Camera-free play");
    setText(elements.setupTitle, "Your camera-free unlock is ready.");
    setText(
      elements.setupIntro,
      "Follow the gentle demonstrations for one minute. You can pause or stop whenever you like.",
    );
    elements.cameraLabel.innerHTML =
      '<i aria-hidden="true"></i> Camera-free Play';
    elements.cameraLabel.classList.add("is-on");
    elements.setupStatus.classList.add("is-ready");
    setText(elements.statusTitle, "No camera needed");
    setText(
      elements.statusDetail,
      "Movements will be demonstrated automatically for one gentle minute.",
    );
    elements.enableCamera.hidden = true;
    elements.startSession.hidden = false;
    elements.startSession.disabled = false;
  } else if (fingers) {
    setText(elements.setupEyebrow, "Finger camera set-up");
    setText(elements.setupTitle, "Let’s find one comfortable hand.");
    setText(
      elements.setupIntro,
      "We will check that one relaxed hand is comfortably in view before the one-minute game begins.",
    );
  } else {
    setText(elements.setupEyebrow, "Camera set-up");
    setText(elements.setupTitle, "Let’s find your comfortable spot.");
    setText(
      elements.setupIntro,
      "We will check that your body is comfortably in view before the one-minute game begins.",
    );
  }
}

function enterSetup() {
  configureSetup();
  showScreen("setup", "#setup-title");
  announce(
    state.mode === "preview"
      ? "Camera-free play is ready. No camera is needed."
      : state.mode === "fingers"
        ? "Finger Play camera set-up. Your camera is still off."
        : "Camera set-up. Your camera is still off.",
  );
}

function updateModelProgress(progress) {
  const percentage = Math.max(4, Math.min(100, Math.round(progress * 100)));
  elements.modelProgress.hidden = false;
  setText(elements.modelPercent, `${percentage}%`);
  elements.modelBar.style.width = `${percentage}%`;
}

function showCameraError(error) {
  const typedError = asPoseEngineError(error, "camera-start-failed");
  elements.cameraError.hidden = false;
  setText(elements.cameraErrorMessage, typedError.userMessage);
  elements.enableCamera.hidden = true;
  elements.startSession.hidden = true;
  elements.retryCamera.hidden = false;
  elements.modelProgress.hidden = true;
  elements.setupStatus.classList.remove("is-loading", "is-ready");
  setText(elements.statusTitle, "Camera not ready");
  setText(
    elements.statusDetail,
    "Try again, check your browser settings, or use Camera-free Play.",
  );
  announce(typedError.userMessage, { priority: "assertive" });
}

function handlePoseStatus(detail) {
  if (!detail) {
    return;
  }

  if (detail.type === "model-loading") {
    elements.setupStatus.classList.add("is-loading");
    setText(
      elements.statusTitle,
      state.mode === "fingers"
        ? "Preparing finger tracking"
        : "Preparing body tracking",
    );
    setText(elements.statusDetail, detail.message);
    updateModelProgress(detail.progress || 0.1);
  }

  if (detail.type === "model-ready" || detail.type === "model-fallback") {
    updateModelProgress(1);
    setTimeout(() => {
      elements.modelProgress.hidden = true;
    }, 450);
  }

  if (detail.type === "camera-ready") {
    elements.cameraLabel.classList.add("is-on");
    elements.cameraLabel.innerHTML =
      '<i aria-hidden="true"></i> Camera on · private';
  }

  if (detail.type === "pose-missing" && state.screen === "game") {
    setFeedback(
      state.mode === "fingers"
        ? "Hold one hand gently in view."
        : "Move gently back into view.",
      "Nothing is lost. We will continue when you are ready.",
      false,
    );
  }
}

function handlePoseResults(result) {
  state.latestPose = result;
  if (state.screen !== "setup") {
    return;
  }

  const calibration = result.calibration;
  elements.setupStatus.classList.remove("is-loading");
  elements.setupStatus.classList.toggle("is-ready", calibration.ready);
  setText(
    elements.statusTitle,
    calibration.ready ? "Great position" : "Ready when you are",
  );
  setText(
    elements.statusDetail,
    calibration.ready
      ? calibration.message
      : `${calibration.message} You can start now, or adjust if comfortable.`,
  );
  elements.startSession.hidden = false;
  elements.startSession.disabled = false;
}

async function enableCamera() {
  const operation = beginOperation();
  elements.enableCamera.disabled = true;
  elements.retryCamera.hidden = true;
  elements.cameraError.hidden = true;
  elements.setupStatus.classList.add("is-loading");
  setText(elements.statusTitle, "Starting the camera");
  setText(
    elements.statusDetail,
    "Your browser may ask for permission. Choose Allow to continue.",
  );
  updateModelProgress(0.04);

  await stopPoseEngine();
  if (!isOperationCurrent(operation)) {
    return;
  }
  state.latestPose = null;
  const TrackingEngine =
    state.mode === "fingers" ? HandEngine : PoseEngine;
  const trackingEngine = new TrackingEngine({
    video: setupVideo,
    canvas: setupCanvas,
    ...(state.mode === "fingers" ? {} : { mode: state.mode }),
    mirrorOverlay: false,
    onResults: handlePoseResults,
    onStatus: handlePoseStatus,
    onError: (error) => {
      void handlePoseEngineFailure(error);
    },
  });
  state.poseEngine = trackingEngine;

  try {
    await trackingEngine.startCamera();
    if (!isOperationCurrent(operation)) {
      await trackingEngine.destroy().catch(() => undefined);
      return;
    }
    await trackingEngine.initialise();
    if (!isOperationCurrent(operation)) {
      await trackingEngine.destroy().catch(() => undefined);
      return;
    }
    await trackingEngine.startTracking();
    if (!isOperationCurrent(operation)) {
      await trackingEngine.destroy().catch(() => undefined);
      return;
    }
    elements.enableCamera.hidden = true;
    elements.enableCamera.disabled = false;
    elements.startSession.hidden = false;
    elements.startSession.disabled = false;
    setText(elements.statusTitle, "Finding your position");
    setText(
      elements.statusDetail,
      state.mode === "fingers"
        ? "Hold one comfortable hand in view. You can start now."
        : state.mode === "seated"
          ? "Keep your head, shoulders, elbows and hands in view if comfortable. You can start now."
          : "Keep your head, shoulders and hips in view if comfortable. You can start now.",
    );
    announce(
      state.mode === "fingers"
        ? "Camera and finger tracking are ready. You can start the one-minute unlock now."
        : "Camera and body tracking are ready. You can start the one-minute unlock now.",
    );
  } catch (error) {
    if (!isOperationCurrent(operation)) {
      await trackingEngine.destroy().catch(() => undefined);
      return;
    }
    await stopPoseEngine();
    if (!isOperationCurrent(operation)) {
      return;
    }
    showCameraError(error);
  }
}

function showCameraOffLabel() {
  elements.cameraLabel.classList.remove("is-on");
  elements.cameraLabel.innerHTML =
    '<i aria-hidden="true"></i> Camera is off';
}

async function stopPoseEngine() {
  const engine = state.poseEngine;
  state.poseEngine = null;
  state.latestPose = null;
  if (engine) {
    try {
      engine.setCallbacks({ onError: null });
      await engine.destroy();
    } catch {
      // Leaving a screen must never be blocked by a best-effort cleanup.
    }
  }
  for (const video of [setupVideo, gameVideo]) {
    if (video) {
      video.srcObject = null;
    }
  }
  showCameraOffLabel();
}

async function handlePoseEngineFailure(error) {
  const operation = beginOperation();
  const failedDuringGame = state.screen === "game";
  const fingerFailure = state.mode === "fingers";
  await stopPoseEngine();
  if (!isOperationCurrent(operation)) {
    return;
  }

  if (!failedDuringGame) {
    showCameraError(error);
    return;
  }
  if (state.screen !== "game") {
    return;
  }

  state.mode = "preview";
  state.challenges = getChallenges("preview");
  state.challengeIndex %= state.challenges.length;
  setModeLabels();
  elements.previewBadge.hidden = false;
  elements.playerView.hidden = true;
  renderChallenge();
  setFeedback(
    fingerFailure
      ? "Finger tracking is unavailable."
      : "Body tracking is unavailable.",
    "Your camera is off. The session will continue safely in Camera-free Play.",
    false,
  );
  announce(
    `${fingerFailure ? "Finger" : "Body"} tracking is unavailable. The camera is off and Camera-free Play will continue.`,
    { priority: "assertive" },
  );
}

async function switchToPreview() {
  const operation = beginOperation();
  await stopPoseEngine();
  if (!isOperationCurrent(operation)) {
    return;
  }
  state.mode = "preview";
  setModeLabels();
  configureSetup();
  announce("Camera-free Play selected. The camera is off.");
  focusSafely(elements.startSession);
}

async function moveCameraToGame() {
  if (!state.poseEngine?.stream) {
    return;
  }
  state.poseEngine.stopTracking();
  const stream = state.poseEngine.stream;
  setupVideo.srcObject = null;
  gameVideo.srcObject = stream;
  gameVideo.muted = true;
  gameVideo.playsInline = true;
  await gameVideo.play();
  state.poseEngine.attach({ video: gameVideo, canvas: gameCanvas });
  await state.poseEngine.startTracking();
}

function resetSessionState() {
  clearChallengeTimers();
  clearSessionFrame();
  state.challenges =
    state.mode === "fingers"
      ? getFingerChallenges()
      : getChallenges(state.mode);
  state.challengeIndex = 0;
  state.challengeStartedAt = 0;
  state.sessionStartedAt = now();
  state.totalPausedMs = 0;
  state.pausedAt = 0;
  state.stars = 0;
  state.completedMovements = 0;
  state.reminderGiven = false;
  state.challengeResolved = false;
  state.holdDetector = null;
  state.isPaused = false;
  state.sessionClock = createActiveSessionClock(SESSION_DURATION);
  state.timeAnnouncements = new Set();
  setText(elements.starTotal, "0");
  setText(elements.sessionTime, "1:00");
  elements.gameProgress.style.width = "0%";
}

function updateSessionDisplay(snapshot) {
  setText(elements.sessionTime, formatCountdown(snapshot.remainingMs));
  elements.gameProgress.style.width = `${snapshot.progress * 100}%`;

  const remainingSeconds = Math.ceil(snapshot.remainingMs / 1_000);
  for (const threshold of [30, 10]) {
    if (
      remainingSeconds <= threshold &&
      !state.timeAnnouncements.has(threshold)
    ) {
      state.timeAnnouncements.add(threshold);
      announce(`${threshold} seconds remaining.`);
    }
  }
}

function updateSessionTimer(timestamp) {
  if (state.screen !== "game" || state.isPaused || !state.sessionClock) {
    return;
  }
  const snapshot = state.sessionClock.advance(timestamp);
  updateSessionDisplay(snapshot);
  if (snapshot.complete) {
    void finishSession({ completionReason: "completed" });
    return;
  }
  state.sessionFrame = requestAnimationFrame(updateSessionTimer);
}

function startSessionTimer() {
  if (!state.sessionClock || state.sessionClock.snapshot().complete) {
    return;
  }
  const snapshot = state.sessionClock.start(now());
  updateSessionDisplay(snapshot);
  clearSessionFrame();
  state.sessionFrame = requestAnimationFrame(updateSessionTimer);
}

async function startSession() {
  const operation = beginOperation();
  elements.startSession.disabled = true;
  await state.audio.unlock();
  if (!isOperationCurrent(operation)) {
    return;
  }
  resetSessionState();

  if (state.mode !== "preview") {
    try {
      await moveCameraToGame();
      if (!isOperationCurrent(operation)) {
        return;
      }
    } catch (error) {
      if (!isOperationCurrent(operation)) {
        return;
      }
      await stopPoseEngine();
      if (!isOperationCurrent(operation)) {
        return;
      }
      showCameraError(error);
      elements.startSession.disabled = false;
      return;
    }
  }

  elements.previewBadge.hidden = state.mode !== "preview";
  elements.playerView.hidden = state.mode === "preview";
  setText(
    elements.playerViewLabel,
    state.mode === "fingers" ? "Your hand" : "Your movement",
  );
  showScreen("game", "#challenge-instruction");
  renderChallenge();
  startSessionTimer();
  announce("Your one-minute MoveMail unlock has started.");
}

function setFeedback(title, detail, isSuccess) {
  setText(elements.feedbackTitle, title);
  setText(elements.feedbackDetail, detail);
  elements.feedback.classList.toggle("is-success", Boolean(isSuccess));
}

function setDemonstration(challenge) {
  for (const className of [...elements.demoPerson.classList]) {
    if (className.startsWith(DEMO_CLASS_PREFIX)) {
      elements.demoPerson.classList.remove(className);
    }
  }
  for (const className of [...elements.demoHand.classList]) {
    if (className.startsWith(HAND_DEMO_CLASS_PREFIX)) {
      elements.demoHand.classList.remove(className);
    }
  }
  const fingerChallenge = challenge.modes.includes("fingers");
  elements.demoPerson.hidden = fingerChallenge;
  elements.demoHand.hidden = !fingerChallenge;
  if (fingerChallenge) {
    elements.demoHand.classList.add(
      `${HAND_DEMO_CLASS_PREFIX}${challenge.demonstration}`,
    );
    setText(elements.demoCaption, "Copy this hand shape");
  } else {
    elements.demoPerson.classList.add(
      `${DEMO_CLASS_PREFIX}${challenge.demonstration}`,
    );
    setText(elements.demoCaption, "Copy me gently");
  }
  elements.playStage.dataset.demonstration = challenge.demonstration;
}

function renderChallenge() {
  clearChallengeTimers();
  const challenge = state.challenges[state.challengeIndex];
  if (!challenge) {
    finishSession();
    return;
  }

  state.challengeStartedAt = now();
  state.reminderGiven = false;
  state.challengeResolved = false;
  state.latestPose =
    state.mode === "preview" ? null : state.poseEngine?.lastResult || null;
  state.holdDetector =
    state.mode === "fingers"
      ? createHandHoldDetector(challenge.detector, {
          holdMs: HOLD_DURATION,
        })
      : createHoldDetector(challenge.detector, {
          mode: state.mode === "seated" ? "seated" : "standing",
          holdMs: HOLD_DURATION,
        });

  setText(elements.miniGame, challenge.miniGame);
  setText(elements.starTotal, String(state.stars));
  setText(elements.challengeName, challenge.name);
  setText(elements.challengeInstruction, challenge.instruction);
  setText(elements.safetyHint, challenge.safetyNotes);
  setFeedback(
    "Take your time.",
    state.mode === "preview"
      ? "Follow the gentle demonstration in any way that feels comfortable."
      : state.mode === "fingers"
        ? "Make the hand shape when you are ready."
        : "Follow the gardener when you are ready.",
    false,
  );
  setText(elements.clockLabel, "Plenty of time");
  elements.clockBar.style.transform = "scaleX(1)";
  setDemonstration(challenge);

  void speakGuidance(challenge.spokenInstruction);
  announce(challenge.instruction);
  state.challengeFrame = requestAnimationFrame(updateChallenge);
}

function reminderFor(challenge) {
  const gentleDirection = {
    leftHandRaised: "Lift your left hand a little, only if comfortable.",
    rightHandRaised: "Lift your right hand a little, only if comfortable.",
    bothHandsRaised: "Move gently upward, within your comfortable range.",
    leftReach: "Reach softly towards the left flower.",
    rightReach: "Reach softly towards the right flower.",
    armsOpen: "Open your arms like a flower, as far as feels easy.",
    gentleLeftLean: "Try a very small lean to the left.",
    gentleRightLean: "Try a very small lean to the right.",
    celebration: "Choose any comfortable open or raised-arm pose.",
    closedFist: "Curl your fingers softly without squeezing.",
    openHand: "Relax your palm and open your fingers gently.",
    fingerSpread: "Let a little space appear between each finger.",
    pointIndex: "Lift just your first finger while the others stay relaxed.",
    gentlePinch: "Bring your thumb and first finger lightly together.",
    victoryFingers: "Lift your first two fingers in a small V shape.",
    thumbUp: "Raise your thumb gently while your fingers stay relaxed.",
  };
  return gentleDirection[challenge.detector] || "Keep going gently.";
}

function updateChallenge(timestamp) {
  if (
    state.screen !== "game" ||
    state.isPaused ||
    state.challengeResolved
  ) {
    return;
  }

  const challenge = state.challenges[state.challengeIndex];
  const elapsed = timestamp - state.challengeStartedAt;
  const remainingRatio = Math.max(0, 1 - elapsed / challenge.duration);
  elements.clockBar.style.transform = `scaleX(${remainingRatio})`;

  if (remainingRatio > 0.55) {
    setText(elements.clockLabel, "Plenty of time");
  } else if (remainingRatio > 0.22) {
    setText(elements.clockLabel, "Keep going at your pace");
  } else {
    setText(elements.clockLabel, "One more gentle try");
  }

  if (!state.reminderGiven && elapsed >= REMINDER_AFTER) {
    state.reminderGiven = true;
    const reminder = reminderFor(challenge);
    setFeedback("You’re doing well.", reminder, false);
    void speakGuidance(reminder);
  }

  if (state.mode === "preview" && elapsed >= PREVIEW_SUCCESS_DELAY) {
    completeChallenge(3, "preview");
    return;
  }

  if (state.mode !== "preview") {
    const pose = state.latestPose;
    if (!pose?.landmarks?.length) {
      if (elapsed > 1_600) {
        setFeedback(
          state.mode === "fingers"
            ? "Hold one hand gently in view."
            : "Move gently back into view.",
          "Nothing is lost. We will continue when you are ready.",
          false,
        );
      }
    } else {
      const held = state.holdDetector.update(pose.landmarks, timestamp);
      if (held.movement && held.progress > 0.2) {
        const percentage = Math.round(held.progress * 100);
        setFeedback(
          "That’s it—hold gently.",
          `${percentage}% of the short comfortable hold.`,
          false,
        );
      }
      if (held.complete) {
        const stars = elapsed <= 7_000 ? 3 : elapsed <= 13_000 ? 2 : 1;
        completeChallenge(stars, "recognised");
        return;
      }
    }
  }

  if (elapsed >= challenge.duration) {
    completeChallenge(1, "participation");
    return;
  }

  state.challengeFrame = requestAnimationFrame(updateChallenge);
}

function completeChallenge(stars, reason) {
  if (state.challengeResolved) {
    return;
  }
  state.challengeResolved = true;
  if (state.challengeFrame !== null) {
    cancelAnimationFrame(state.challengeFrame);
    state.challengeFrame = null;
  }

  const challenge = state.challenges[state.challengeIndex];
  const feedback =
    challenge.feedback[state.challengeIndex % challenge.feedback.length];
  state.stars += stars;
  state.completedMovements += 1;
  setText(elements.starTotal, String(state.stars));

  setFeedback(
    feedback,
    reason === "participation"
      ? "A participation star for your excellent effort."
      : `${stars} ${stars === 1 ? "star" : "stars"} for that lovely movement.`,
    true,
  );
  state.audio.playCompletion();
  void speakGuidance(feedback);
  announce(`${feedback} ${stars} stars.`);

  const elapsed = now() - state.challengeStartedAt;
  scheduleNextChallenge(
    Math.max(TRANSITION_DELAY, MIN_PROMPT_DURATION - elapsed),
  );
}

function scheduleNextChallenge(delay = TRANSITION_DELAY) {
  state.transitionDueAt = now() + delay;
  state.transitionRemainingMs = null;
  state.transitionTimer = setTimeout(() => {
    state.transitionTimer = null;
    state.transitionDueAt = 0;
    if (state.screen !== "game" || state.isPaused) {
      return;
    }
    if (state.challengeIndex + 1 >= state.challenges.length) {
      setFeedback(
        "Keep moving gently.",
        "Your MoveMail is nearly ready to open.",
        true,
      );
      return;
    }
    state.challengeIndex += 1;
    state.audio.playTransition();
    renderChallenge();
  }, delay);
}

function pauseSession() {
  if (state.screen !== "game" || state.isPaused) {
    return;
  }
  state.isPaused = true;
  state.pausedAt = now();
  const clockSnapshot = state.sessionClock?.pause(state.pausedAt);
  clearSessionFrame();
  if (clockSnapshot?.complete) {
    void finishSession({ completionReason: "completed" });
    return;
  }
  if (state.challengeFrame !== null) {
    cancelAnimationFrame(state.challengeFrame);
    state.challengeFrame = null;
  }
  if (state.transitionTimer !== null) {
    state.transitionRemainingMs = Math.max(
      0,
      state.transitionDueAt - state.pausedAt,
    );
    clearTimeout(state.transitionTimer);
    state.transitionTimer = null;
    state.transitionDueAt = 0;
  }
  stopVoiceOutput();
  state.poseEngine?.stopTracking();
  pauseOverlay.hidden = false;
  document.body.style.overflow = "hidden";
  state.pauseRelease = createFocusTrap(pauseOverlay, {
    onEscape: resumeSession,
  });
  announce("Your one-minute MoveMail unlock is paused.");
}

async function resumeSession() {
  if (!state.isPaused) {
    return;
  }
  const operation = state.operationGeneration;
  const pauseDuration = now() - state.pausedAt;
  state.totalPausedMs += pauseDuration;
  state.challengeStartedAt += pauseDuration;
  state.isPaused = false;
  pauseOverlay.hidden = true;
  document.body.style.overflow = "";
  state.pauseRelease?.();
  state.pauseRelease = null;
  if (state.poseEngine) {
    try {
      await state.poseEngine.startTracking();
    } catch {
      if (!isOperationCurrent(operation)) {
        return;
      }
      setFeedback(
        state.mode === "fingers"
          ? "Finger tracking paused."
          : "Body tracking paused.",
        "You can still end the session or continue in Camera-free Play.",
        false,
      );
    }
  }
  if (!isOperationCurrent(operation)) {
    return;
  }
  const challenge = state.challenges[state.challengeIndex];
  if (state.challengeResolved) {
    scheduleNextChallenge(
      state.transitionRemainingMs ??
        Math.max(
          TRANSITION_DELAY,
          MIN_PROMPT_DURATION - (now() - state.challengeStartedAt),
        ),
    );
  } else {
    void speakGuidance(challenge.spokenInstruction);
    state.challengeFrame = requestAnimationFrame(updateChallenge);
  }
  startSessionTimer();
  announce("Session resumed.");
}

function closePauseWithoutResume() {
  state.isPaused = false;
  pauseOverlay.hidden = true;
  document.body.style.overflow = "";
  state.pauseRelease?.();
  state.pauseRelease = null;
}

function restartSession() {
  beginOperation();
  closePauseWithoutResume();
  resetSessionState();
  showScreen("game", "#challenge-instruction");
  if (state.poseEngine) {
    state.poseEngine.startTracking().catch(() => undefined);
  }
  renderChallenge();
  startSessionTimer();
  announce("Session restarted from the first movement.");
}

async function finishSession({ completionReason = "early" } = {}) {
  if (
    state.screen === "results" ||
    state.screen === "waiting" ||
    state.screen === "finishing"
  ) {
    return;
  }
  const operation = beginOperation();
  state.screen = "finishing";
  stopVoiceOutput();
  clearChallengeTimers();
  clearSessionFrame();
  const finishedAt = now();
  const clockSnapshot = state.sessionClock?.pause(finishedAt);
  const effectiveReason = clockSnapshot?.complete
    ? "completed"
    : completionReason;
  if (state.isPaused) {
    closePauseWithoutResume();
  }
  const elapsedSeconds = Math.max(
    0,
    (state.sessionClock?.snapshot().elapsedMs || 0) / 1_000,
  );
  await stopPoseEngine();
  if (!isOperationCurrent(operation)) {
    return;
  }

  const stored = state.mode
    ? saveSession({
        date: new Date().toISOString(),
        mode: state.mode,
        sessionDuration: elapsedSeconds,
        completedMovements: state.completedMovements,
        score: state.stars,
      })
    : false;

  setText(elements.resultStars, String(state.stars));
  setText(elements.resultMovements, String(state.completedMovements));
  setText(
    elements.resultMovementsLabel,
    state.mode === "fingers" ? "Hand shapes" : "Movements",
  );
  setText(elements.resultDuration, formatDuration(elapsedSeconds));
  setText(elements.resultMode, RESULT_MODE_LABELS[state.mode] || "Preview");
  setText(
    elements.historyNote,
    stored
      ? "This result was saved on this device."
      : "Your result is shown here, but local history was not available.",
  );

  if (effectiveReason === "completed") {
    revealPostcard({
      completionReason: effectiveReason,
      elapsedSeconds,
    });
    return;
  }

  if (state.postcard.unlocked) {
    revealPostcard({
      completionReason: "replay-stopped",
      elapsedSeconds,
    });
    return;
  }

  setText(
    elements.waitingMessage,
    `You stopped safely after ${formatDuration(elapsedSeconds)}. The message is still sealed. You can try again, or open it now if moving is not comfortable.`,
  );
  showScreen("waiting", "#waiting-title");
  void speakGuidance(
    "Your postcard is still waiting. Stopping when you need to is always the right choice.",
  );
}

function revealPostcard({
  completionReason = "bypass",
  elapsedSeconds = state.sessionClock?.snapshot().elapsedMs / 1_000 || 0,
} = {}) {
  const hasSession = Boolean(state.mode && state.sessionClock);
  const showSessionSummary =
    completionReason !== "existing" && hasSession;
  state.postcard = { ...state.postcard, unlocked: true };
  state.postcardStored = savePostcard(state.postcard);
  renderPostcardDetails();
  setText(elements.revealMessage, state.postcard.message);
  elements.resultStats.hidden = !showSessionSummary;
  elements.historyNote.hidden = !showSessionSummary;
  setText(
    elements.resultsMessage,
    completionReason === "completed"
      ? "Your gentle minute is complete. Here is your personal message."
      : completionReason === "existing"
        ? "This postcard has already been opened."
        : completionReason === "replay-stopped"
          ? "You stopped safely. Your already-open message remains available."
          : "You chose to open your personal message without a movement barrier.",
  );
  if (showSessionSummary) {
    setText(elements.resultDuration, formatDuration(elapsedSeconds));
  }
  showScreen("results", elements.revealMessage);
  state.audio.playCelebration();
  void speakGuidance("Your MoveMail is open.");
  announce(`MoveMail from ${state.postcard.sender} is open.`);
}

async function returnHome() {
  const operation = beginOperation();
  state.screen = "leaving";
  clearChallengeTimers();
  clearSessionFrame();
  closePauseWithoutResume();
  stopVoiceOutput();
  state.sessionClock?.pause(now());
  clearRevealedMessage();
  const cameraCleanup = stopPoseEngine();
  state.mode = null;
  state.challenges = [];
  state.challengeIndex = 0;
  state.stars = 0;
  state.completedMovements = 0;
  state.sessionClock = null;
  resetSafetyChecks();
  renderPostcardDetails();
  showScreen("welcome", "#welcome-title");
  await cameraCleanup;
  if (!isOperationCurrent(operation) || state.screen !== "welcome") {
    return false;
  }
  announce("MoveMail home.");
  return true;
}

async function returnToSafety() {
  const operation = beginOperation();
  state.screen = "leaving";
  await stopPoseEngine();
  if (!isOperationCurrent(operation)) {
    return;
  }
  showScreen("safety", "#safety-title");
}

function playAgain() {
  beginOperation();
  stopVoiceOutput();
  if (!state.mode) {
    showScreen("mode", "#mode-title");
    announce("Choose the most comfortable way to move.");
    return;
  }
  const previousMode = state.mode;
  state.mode = previousMode;
  setModeLabels();
  resetSafetyChecks();
  updateSafetyMode();
  showScreen("safety", "#safety-title");
  announce(`Play again in ${MODE_LABELS[previousMode]}. Review the safety checks.`);
}

function openHowDialog() {
  if (typeof howDialog.showModal === "function") {
    howDialog.showModal();
    focusSafely("#how-title");
  } else {
    howDialog.setAttribute("open", "");
  }
}

function closeHowDialog() {
  howDialog.close?.();
  howDialog.removeAttribute("open");
  focusSafely('[data-action="how"]');
}

function openCloudMessageDialog() {
  if (typeof cloudMessageDialog?.showModal === "function") {
    cloudMessageDialog.showModal();
    focusSafely('[data-action="confirm-cloud-read"]');
  } else {
    cloudMessageDialog?.setAttribute("open", "");
  }
}

function closeCloudMessageDialog() {
  cloudMessageDialog?.close?.();
  cloudMessageDialog?.removeAttribute("open");
  focusSafely("[data-read-message]");
}

function readPersonalMessageWithDevice() {
  stopVoiceOutput();
  if (
    state.audio.speak(state.postcard.message, {
      localOnly: true,
    })
  ) {
    announce("Reading the personal message with a device voice.");
    return true;
  }
  announce(
    "A local read-aloud voice is unavailable. The message was not sent online.",
    {
      priority: "assertive",
    },
  );
  return false;
}

async function readPersonalMessageWithElevenLabs() {
  if (!state.audio.enabled) {
    announce("Sound is off. Turn Sound On before using read-aloud.", {
      priority: "assertive",
    });
    return;
  }
  if (!onlinePostcardVoiceReady()) {
    announce(
      "Online postcard reading is not currently available. The message was not sent.",
      { priority: "assertive" },
    );
    return;
  }

  const operation = state.operationGeneration;
  state.audio.stopSpeaking();
  announce("Creating the online voice. The message text is being sent to ElevenLabs.");
  try {
    const played = await state.elevenLabs.speak(state.postcard.message, {
      voice: state.voiceSettings.voice,
      purpose: "postcard",
      consent: true,
    });
    if (
      played &&
      isOperationCurrent(operation) &&
      state.screen === "results"
    ) {
      announce("Online read-aloud finished.");
    }
  } catch {
    if (
      !isOperationCurrent(operation) ||
      state.screen !== "results" ||
      !state.audio.enabled
    ) {
      return;
    }
    if (
      state.audio.speak(state.postcard.message, {
        localOnly: true,
      })
    ) {
      announce(
        "The online voice could not play. Reading with a local device voice instead.",
        { priority: "assertive" },
      );
    } else {
      announce(
        "The online voice could not play, and a local voice is unavailable. The message remains visible.",
        { priority: "assertive" },
      );
    }
  }
}

function saveCurrentVoiceSettings(event) {
  event.preventDefault();
  setVoiceSettingsError();
  const provider =
    voiceSettingsForm?.elements.voiceProvider?.value === "elevenlabs"
      ? "elevenlabs"
      : "device";
  const voice = elements.elevenLabsVoice?.value || "";
  if (
    provider === "elevenlabs" &&
    (!state.elevenLabsConnected || !voice)
  ) {
    setVoiceSettingsError(
      "Check the ElevenLabs connection and choose a voice before saving.",
    );
    focusSafely("#elevenlabs-voice");
    return;
  }

  const voiceLabel =
    elements.elevenLabsVoice?.selectedOptions?.[0]?.textContent || "";
  const savedVoiceSettings = saveVoiceSettings({
    provider,
    voice,
    voiceLabel,
    onlinePostcardId:
      provider === "elevenlabs" &&
      elements.onlinePostcardConsent?.checked
        ? state.postcard.id
        : "",
  });
  state.voiceSettings = savedVoiceSettings.settings;
  stopVoiceOutput();
  updateSoundControls();
  closeVoiceSettings(
    savedVoiceSettings.persisted
      ? "Voice settings saved. MoveMail home."
      : "Voice settings are active for this visit, but this browser could not save them.",
  );
}

async function handleAction(action) {
  switch (action) {
    case "sound":
      await toggleSound();
      break;
    case "how":
      openHowDialog();
      break;
    case "close-how":
      closeHowDialog();
      break;
    case "settings":
      await openVoiceSettings();
      break;
    case "cancel-settings":
      closeVoiceSettings();
      break;
    case "refresh-voices":
      {
        const operation = state.operationGeneration;
        setVoiceSettingsError();
        const connected = await refreshElevenLabsStatus({
          loadVoices: true,
          refresh: true,
          operation,
        });
        if (isOperationCurrent(operation) && state.screen === "settings") {
          announce(
            connected
              ? "ElevenLabs connected. Voices refreshed."
              : "The ElevenLabs connection could not be verified.",
            { priority: connected ? "polite" : "assertive" },
          );
        }
      }
      break;
    case "test-voice":
      await testElevenLabsVoice();
      break;
    case "create-postcard":
      openComposer();
      break;
    case "edit-postcard":
      openComposer({ edit: true });
      break;
    case "view-postcard":
      showPostcard();
      break;
    case "unlock-postcard":
      beginUnlock();
      break;
    case "back-postcard":
      showPostcard();
      break;
    case "back-mode":
      showScreen("mode", "#mode-title");
      break;
    case "delete-postcard":
      {
        const confirmed = window.confirm(
          `Delete the MoveMail for ${state.postcard.recipient}? This cannot be undone.`,
        );
        if (!confirmed) {
          announce("The postcard was not deleted.");
          break;
        }
        const removed = clearCurrentPostcard();
        const returnedHome = await returnHome();
        if (returnedHome) {
          announce(
            removed
              ? "The local postcard was deleted. A sample is ready to try."
              : "The postcard was removed from this page, but browser storage could not confirm deletion. Clear this site’s data before sharing the device.",
            { priority: removed ? "polite" : "assertive" },
          );
        }
      }
      break;
    case "read-message":
      if (!state.audio.enabled) {
        announce("Sound is off. Turn Sound On before using read-aloud.", {
          priority: "assertive",
        });
        break;
      }
      if (onlinePostcardVoiceReady()) {
        openCloudMessageDialog();
      } else {
        readPersonalMessageWithDevice();
      }
      break;
    case "confirm-cloud-read":
      closeCloudMessageDialog();
      await readPersonalMessageWithElevenLabs();
      break;
    case "use-device-read":
      closeCloudMessageDialog();
      readPersonalMessageWithDevice();
      break;
    case "cancel-cloud-read":
      closeCloudMessageDialog();
      announce("Online read-aloud cancelled. The message was not sent.");
      break;
    case "open-without-movement":
      revealPostcard({ completionReason: "bypass" });
      break;
    case "back-home":
    case "return-home":
    case "home":
    case "pause-home":
      await returnHome();
      break;
    case "back-safety":
      await returnToSafety();
      break;
    case "safety-continue":
      if (!safetyContinue.disabled) {
        enterSetup();
      }
      break;
    case "enable-camera":
    case "retry-camera":
      await enableCamera();
      break;
    case "use-preview":
      await switchToPreview();
      break;
    case "start-session":
      await startSession();
      break;
    case "pause":
      pauseSession();
      break;
    case "resume":
      await resumeSession();
      break;
    case "restart":
      restartSession();
      break;
    case "end-session":
    case "pause-end":
      await finishSession({ completionReason: "early" });
      break;
    case "play-again":
      playAgain();
      break;
    default:
      break;
  }
}

document.addEventListener("click", (event) => {
  const modeButton = event.target.closest("[data-mode]");
  if (modeButton) {
    chooseMode(modeButton.dataset.mode);
    return;
  }

  const actionButton = event.target.closest("[data-action]");
  if (actionButton && !actionButton.disabled) {
    void handleAction(actionButton.dataset.action);
  }
});

postcardForm?.addEventListener("submit", preparePostcard);
postcardForm?.addEventListener("input", (event) => {
  event.target.setCustomValidity?.("");
});
voiceSettingsForm?.addEventListener("submit", saveCurrentVoiceSettings);
elements.voiceProviderDevice?.addEventListener("change", () => {
  stopVoiceOutput();
  updateVoiceSettingsAvailability();
});
elements.voiceProviderElevenLabs?.addEventListener("change", () => {
  stopVoiceOutput();
  updateVoiceSettingsAvailability();
});
elements.elevenLabsVoice?.addEventListener("change", () => {
  stopVoiceOutput();
  setVoiceSettingsError();
  updateVoiceSettingsAvailability();
});
let messageLengthAnnouncement = "";
postcardMessageInput?.addEventListener("input", () => {
  const length = postcardMessageInput.value.length;
  setText(elements.messageCount, String(length));
  const announcement =
    length >= 280
      ? "Message character limit reached."
      : length >= 260
        ? "Twenty or fewer message characters remain."
        : "";
  if (announcement && announcement !== messageLengthAnnouncement) {
    announce(announcement);
  }
  messageLengthAnnouncement = announcement;
});

for (const check of safetyChecks) {
  check.addEventListener("change", updateSafetyContinue);
}

document.addEventListener("keydown", (event) => {
  if (
    event.key === "Escape" &&
    state.screen === "game" &&
    !state.isPaused &&
    !howDialog.open
  ) {
    event.preventDefault();
    pauseSession();
  }
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden && state.screen === "game" && !state.isPaused) {
    pauseSession();
  }
});

howDialog.addEventListener("cancel", (event) => {
  event.preventDefault();
  closeHowDialog();
});
cloudMessageDialog?.addEventListener("cancel", (event) => {
  event.preventDefault();
  closeCloudMessageDialog();
  announce("Online read-aloud cancelled. The message was not sent.");
});

let restoreSetupAfterPageShow = false;

window.addEventListener("pagehide", () => {
  beginOperation();
  restoreSetupAfterPageShow = ["setup", "game", "finishing"].includes(
    state.screen,
  );
  clearChallengeTimers();
  clearSessionFrame();
  state.sessionClock?.pause(now());
  stopVoiceOutput();
  state.poseEngine?.stopCamera();
});

window.addEventListener("pageshow", (event) => {
  if (!event.persisted || !restoreSetupAfterPageShow) {
    return;
  }
  restoreSetupAfterPageShow = false;
  void (async () => {
    const operation = beginOperation();
    closePauseWithoutResume();
    await stopPoseEngine();
    if (!isOperationCurrent(operation)) {
      return;
    }
    state.sessionClock = null;
    configureSetup();
    showScreen("setup", "#setup-title");
    announce(
      state.mode === "preview"
        ? "The page was restored. Start a new one-minute camera-free unlock when ready."
        : "The page was restored. Turn the camera on again to start a new one-minute unlock.",
      { priority: "assertive" },
    );
  })();
});

updateSoundControls();
updateAudioSupportNotice();
resetSafetyChecks();
clearRevealedMessage();
renderPostcardDetails();
void refreshElevenLabsStatus({
  loadVoices: state.voiceSettings.provider === "elevenlabs",
  operation: state.operationGeneration,
});

// A small read-only snapshot helps automated QA confirm cleanup and flow
// without exposing camera frames or pose landmarks.
Object.defineProperty(window, "moveMailStatus", {
  configurable: false,
  enumerable: false,
  get() {
    return Object.freeze({
      screen: state.screen,
      mode: state.mode,
      cameraActive: Boolean(state.poseEngine?.stream?.active),
      trackingActive: Boolean(state.poseEngine?.tracking),
      challenge: state.challengeIndex + 1,
      completedMovements: state.completedMovements,
      stars: state.stars,
      sound: state.audio.enabled,
      voiceProvider: state.voiceSettings.provider,
      elevenLabsConfigured: state.elevenLabsConfigured,
      elevenLabsHostedDeviceOnly: state.elevenLabsHostedDeviceOnly,
      remainingSeconds: Math.ceil(
        (state.sessionClock?.snapshot().remainingMs || 0) / 1_000,
      ),
      postcardUnlocked: state.postcard.unlocked,
    });
  },
});
