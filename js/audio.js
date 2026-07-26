/**
 * Optional, generated audio for MoveMail.
 *
 * No sound files or network requests are used. The controller is deliberately
 * defensive: every method remains safe when speech synthesis or Web Audio is
 * unavailable. Call unlock() from a deliberate button press before gameplay
 * for the most reliable behaviour on browsers with autoplay restrictions.
 */

const TONE_PATTERNS = Object.freeze({
  transition: Object.freeze([
    Object.freeze({ frequency: 440, delay: 0, duration: 0.11, volume: 0.035 }),
  ]),
  completion: Object.freeze([
    Object.freeze({ frequency: 523.25, delay: 0, duration: 0.13, volume: 0.045 }),
    Object.freeze({
      frequency: 659.25,
      delay: 0.13,
      duration: 0.17,
      volume: 0.05,
    }),
  ]),
  celebration: Object.freeze([
    Object.freeze({ frequency: 523.25, delay: 0, duration: 0.14, volume: 0.04 }),
    Object.freeze({
      frequency: 659.25,
      delay: 0.14,
      duration: 0.14,
      volume: 0.045,
    }),
    Object.freeze({
      frequency: 783.99,
      delay: 0.28,
      duration: 0.16,
      volume: 0.05,
    }),
    Object.freeze({
      frequency: 1046.5,
      delay: 0.44,
      duration: 0.28,
      volume: 0.04,
    }),
  ]),
});

function clamp(value, minimum, maximum, fallback) {
  const number = Number(value);
  return Number.isFinite(number)
    ? Math.min(maximum, Math.max(minimum, number))
    : fallback;
}

export function createAudioController(options = {}) {
  const browserWindow = typeof window === "undefined" ? null : window;
  const AudioContextClass =
    browserWindow?.AudioContext || browserWindow?.webkitAudioContext || null;
  const speechSynthesis = browserWindow?.speechSynthesis || null;
  const SpeechUtterance = browserWindow?.SpeechSynthesisUtterance || null;

  let enabled = options.enabled !== false;
  let audioContext = null;
  let disposed = false;
  const activeOscillators = new Set();

  const defaultSpeech = Object.freeze({
    lang: options.lang || "en-GB",
    rate: clamp(options.rate, 0.6, 1.4, 0.88),
    pitch: clamp(options.pitch, 0.7, 1.4, 1.02),
    volume: clamp(options.volume, 0, 1, 0.8),
  });

  const support = Object.freeze({
    speech: Boolean(speechSynthesis && SpeechUtterance),
    tones: Boolean(AudioContextClass),
  });

  function stopTones() {
    activeOscillators.forEach((oscillator) => {
      try {
        oscillator.stop();
      } catch {
        // It may already have reached its scheduled stop time.
      }
    });
    activeOscillators.clear();
  }

  function stopSpeaking() {
    if (!support.speech) {
      return false;
    }

    try {
      speechSynthesis.cancel();
      return true;
    } catch {
      return false;
    }
  }

  async function unlock() {
    if (!enabled || disposed || !support.tones) {
      return false;
    }

    try {
      if (!audioContext || audioContext.state === "closed") {
        audioContext = new AudioContextClass();
      }
      if (audioContext.state === "suspended") {
        await audioContext.resume();
      }
      return audioContext.state === "running";
    } catch {
      return false;
    }
  }

  function speak(text, speechOptions = {}) {
    const message = String(text || "").trim();
    if (!enabled || disposed || !message || !support.speech) {
      return false;
    }

    try {
      speechSynthesis.cancel();
      const utterance = new SpeechUtterance(message);
      utterance.lang = speechOptions.lang || defaultSpeech.lang;
      utterance.rate = clamp(
        speechOptions.rate,
        0.6,
        1.4,
        defaultSpeech.rate,
      );
      utterance.pitch = clamp(
        speechOptions.pitch,
        0.7,
        1.4,
        defaultSpeech.pitch,
      );
      utterance.volume = clamp(
        speechOptions.volume,
        0,
        1,
        defaultSpeech.volume,
      );

      const preferredVoice = speechSynthesis
        .getVoices()
        .find((voice) =>
          voice.lang
            ?.toLowerCase()
            .startsWith(utterance.lang.toLowerCase().split("-")[0]),
        );
      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }

      speechSynthesis.speak(utterance);
      return true;
    } catch {
      return false;
    }
  }

  async function playTone(type = "transition") {
    const pattern = TONE_PATTERNS[type];
    if (!enabled || disposed || !pattern || !(await unlock())) {
      return false;
    }

    try {
      const startTime = audioContext.currentTime + 0.015;
      pattern.forEach((note) => {
        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();
        const noteStart = startTime + note.delay;
        const noteEnd = noteStart + note.duration;

        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(note.frequency, noteStart);
        gain.gain.setValueAtTime(0.0001, noteStart);
        gain.gain.exponentialRampToValueAtTime(note.volume, noteStart + 0.025);
        gain.gain.exponentialRampToValueAtTime(0.0001, noteEnd);

        oscillator.connect(gain);
        gain.connect(audioContext.destination);
        oscillator.onended = () => {
          activeOscillators.delete(oscillator);
          oscillator.disconnect();
          gain.disconnect();
        };

        activeOscillators.add(oscillator);
        oscillator.start(noteStart);
        oscillator.stop(noteEnd + 0.02);
      });
      return true;
    } catch {
      return false;
    }
  }

  function setEnabled(nextEnabled) {
    enabled = Boolean(nextEnabled);
    if (enabled) {
      // This succeeds when setEnabled() is called directly from a user gesture.
      void unlock();
    } else {
      stopSpeaking();
      stopTones();
    }
    return enabled;
  }

  function toggle() {
    return setEnabled(!enabled);
  }

  async function dispose() {
    if (disposed) {
      return;
    }
    disposed = true;
    stopSpeaking();
    stopTones();
    if (audioContext && audioContext.state !== "closed") {
      try {
        await audioContext.close();
      } catch {
        // Closing audio is best-effort and must never block leaving the game.
      }
    }
    audioContext = null;
  }

  return Object.freeze({
    get enabled() {
      return enabled;
    },
    support,
    unlock,
    speak,
    stopSpeaking,
    playTone,
    playTransition: () => playTone("transition"),
    playCompletion: () => playTone("completion"),
    playCelebration: () => playTone("celebration"),
    setEnabled,
    toggle,
    dispose,
  });
}
