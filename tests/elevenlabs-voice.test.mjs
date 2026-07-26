import assert from "node:assert/strict";
import test from "node:test";

import {
  VOICE_SETTINGS_KEY,
  createElevenLabsVoiceController,
  loadVoiceSettings,
  sanitiseVoiceSettings,
  saveVoiceSettings,
} from "../js/elevenlabs-voice.js";

const VALID_VOICE = "voice_0123456789abcdef";

test("voice settings keep only sanitised, non-secret preferences", () => {
  const settings = sanitiseVoiceSettings({
    provider: "elevenlabs",
    voice: VALID_VOICE,
    voiceLabel: "  Calm voice  ",
    onlinePostcardId: "postcard-123",
    apiKey: "sentinel-secret",
    modelId: "untrusted-model",
  });

  assert.deepEqual(settings, {
    provider: "elevenlabs",
    voice: VALID_VOICE,
    voiceLabel: "Calm voice",
    onlinePostcardId: "postcard-123",
  });
  assert.doesNotMatch(JSON.stringify(settings), /sentinel-secret|apiKey/);

  assert.deepEqual(
    sanitiseVoiceSettings({
      provider: "elevenlabs",
      voice: "../../untrusted",
      onlinePostcardId: "postcard-123",
    }),
    {
      provider: "device",
      voice: "",
      voiceLabel: "",
      onlinePostcardId: "",
    },
  );
});

test("saved voice preferences never persist an API key", () => {
  const values = new Map();
  const storage = {
    getItem(key) {
      return values.get(key) || null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
  };

  const saved = saveVoiceSettings(
    {
      provider: "elevenlabs",
      voice: VALID_VOICE,
      voiceLabel: "Garden",
      onlinePostcardId: "card-1",
      apiKey: "sentinel-secret",
    },
    storage,
  );

  assert.equal(saved.persisted, true);
  assert.equal(saved.settings.provider, "elevenlabs");
  const raw = values.get(VOICE_SETTINGS_KEY);
  assert.doesNotMatch(raw, /sentinel-secret|apiKey|xi-api-key/i);
  assert.deepEqual(loadVoiceSettings(storage), {
    provider: "elevenlabs",
    voice: VALID_VOICE,
    voiceLabel: "Garden",
    onlinePostcardId: "card-1",
  });
});

test("blocked browser storage fails safely without preventing startup", () => {
  const storageDescriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    "localStorage",
  );
  try {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      get() {
        throw new DOMException("Blocked", "SecurityError");
      },
    });
    assert.equal(loadVoiceSettings().provider, "device");
    const saved = saveVoiceSettings({
      provider: "elevenlabs",
      voice: VALID_VOICE,
    });
    assert.equal(saved.persisted, false);
    assert.equal(saved.settings.provider, "elevenlabs");
  } finally {
    if (storageDescriptor) {
      Object.defineProperty(
        globalThis,
        "localStorage",
        storageDescriptor,
      );
    } else {
      delete globalThis.localStorage;
    }
  }
});

test("the client uses only same-origin voice routes and sanitises config", async () => {
  const requests = [];
  const controller = createElevenLabsVoiceController({
    fetchImpl: async (path, options) => {
      requests.push({ path, options });
      if (path === "/api/elevenlabs/status") {
        return Response.json({ configured: true });
      }
      return Response.json({
        available: true,
        modelLabel: "Eleven Flash v2.5",
        voices: [
          { alias: VALID_VOICE, label: "  Garden  ", secret: "not returned" },
          { alias: "../bad", label: "Bad" },
        ],
      });
    },
    AudioClass: class {},
    urlApi: {
      createObjectURL() {},
      revokeObjectURL() {},
    },
  });

  assert.deepEqual(await controller.getStatus(), {
    configured: true,
    hostedDeviceOnly: false,
  });
  assert.deepEqual(await controller.getConfig(), {
    available: true,
    modelLabel: "Eleven Flash v2.5",
    voices: [{ alias: VALID_VOICE, label: "Garden" }],
  });
  assert.deepEqual(
    requests.map(({ path }) => path),
    ["/api/elevenlabs/status", "/api/elevenlabs/config"],
  );
  assert.ok(
    requests.every(
      ({ options }) =>
        options.headers["X-MoveMail-Request"] === "voice-v1",
    ),
  );
});

test("hosted device-only status is sanitised without exposing server fields", async () => {
  const controller = createElevenLabsVoiceController({
    fetchImpl: async () =>
      Response.json({
        configured: false,
        hostedDeviceOnly: true,
        apiKey: "sentinel-secret",
        provider: "untrusted",
      }),
    AudioClass: class {},
    urlApi: {
      createObjectURL() {},
      revokeObjectURL() {},
    },
  });

  const status = await controller.getStatus();
  assert.deepEqual(status, {
    configured: false,
    hostedDeviceOnly: true,
  });
  assert.doesNotMatch(JSON.stringify(status), /sentinel-secret|apiKey/i);
});

test("postcard speech cannot be requested without explicit consent", async () => {
  let requestCount = 0;
  const controller = createElevenLabsVoiceController({
    fetchImpl: async () => {
      requestCount += 1;
      throw new Error("should not be called");
    },
    AudioClass: class {},
    urlApi: {
      createObjectURL() {},
      revokeObjectURL() {},
    },
  });

  assert.equal(
    await controller.speak("Private message", {
      voice: VALID_VOICE,
      purpose: "postcard",
    }),
    false,
  );
  assert.equal(requestCount, 0);
});

test("consented postcard speech sends only the strict personal-audio payload", async () => {
  let requestPayload = null;
  let audioInstance = null;
  class FakeAudio {
    constructor() {
      audioInstance = this;
    }

    play() {
      return Promise.resolve();
    }

    pause() {}

    removeAttribute() {}

    load() {}
  }

  const controller = createElevenLabsVoiceController({
    fetchImpl: async (_path, options) => {
      requestPayload = JSON.parse(options.body);
      return new Response(new Uint8Array([1]), {
        headers: { "Content-Type": "audio/mpeg" },
      });
    },
    AudioClass: FakeAudio,
    urlApi: {
      createObjectURL() {
        return "blob:postcard";
      },
      revokeObjectURL() {},
    },
  });

  const speaking = controller.speak("Private message", {
    voice: VALID_VOICE,
    purpose: "postcard",
    consent: true,
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(requestPayload, {
    text: "Private message",
    purpose: "postcard",
    voice: VALID_VOICE,
    consent: true,
  });
  assert.equal("recipient" in requestPayload, false);
  assert.equal("postcardId" in requestPayload, false);
  audioInstance.onended();
  assert.equal(await speaking, true);
});

test("generated speech plays once and releases its object URL", async () => {
  const audioInstances = [];
  const revoked = [];
  const payloads = [];

  class FakeAudio {
    constructor(source) {
      this.source = source;
      this.onended = null;
      this.onerror = null;
      audioInstances.push(this);
    }

    play() {
      return Promise.resolve();
    }

    pause() {}

    removeAttribute() {}

    load() {}
  }

  const controller = createElevenLabsVoiceController({
    fetchImpl: async (path, options) => {
      assert.equal(path, "/api/elevenlabs/speech");
      payloads.push(JSON.parse(options.body));
      return new Response(new Uint8Array([1, 2, 3]), {
        headers: { "Content-Type": "audio/mpeg" },
      });
    },
    AudioClass: FakeAudio,
    urlApi: {
      createObjectURL() {
        return "blob:movemail-voice";
      },
      revokeObjectURL(value) {
        revoked.push(value);
      },
    },
  });

  const speaking = controller.speak("Hello there", {
    voice: VALID_VOICE,
    purpose: "guidance",
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(audioInstances.length, 1);
  assert.deepEqual(payloads, [
    {
      text: "Hello there",
      purpose: "guidance",
      voice: VALID_VOICE,
    },
  ]);

  audioInstances[0].onended();
  assert.equal(await speaking, true);
  assert.deepEqual(revoked, ["blob:movemail-voice"]);
});

test("stopping a pending request prevents stale audio playback", async () => {
  let played = false;
  const controller = createElevenLabsVoiceController({
    fetchImpl: async (_path, options) =>
      new Promise((resolve, reject) => {
        options.signal.addEventListener("abort", () => {
          reject(new DOMException("Aborted", "AbortError"));
        });
        setTimeout(
          () =>
            resolve(
              new Response(new Uint8Array([1]), {
                headers: { "Content-Type": "audio/mpeg" },
              }),
            ),
          100,
        );
      }),
    AudioClass: class {
      play() {
        played = true;
        return Promise.resolve();
      }
    },
    urlApi: {
      createObjectURL() {
        return "blob:late";
      },
      revokeObjectURL() {},
    },
  });

  const speaking = controller.speak("Do not play late", {
    voice: VALID_VOICE,
    purpose: "guidance",
  });
  controller.stop();
  assert.equal(await speaking, false);
  assert.equal(played, false);
});

test("stopping during a slow response body aborts before audio is created", async () => {
  let bodyStarted = false;
  let audioCreated = false;
  const controller = createElevenLabsVoiceController({
    fetchImpl: async (_path, options) => ({
      ok: true,
      headers: new Headers({ "Content-Type": "audio/mpeg" }),
      blob: () =>
        new Promise((_resolve, reject) => {
          bodyStarted = true;
          options.signal.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        }),
    }),
    AudioClass: class {
      constructor() {
        audioCreated = true;
      }
    },
    urlApi: {
      createObjectURL() {
        return "blob:late-body";
      },
      revokeObjectURL() {},
    },
  });

  const speaking = controller.speak("Stop during download", {
    voice: VALID_VOICE,
    purpose: "guidance",
  });
  for (let attempt = 0; attempt < 20 && !bodyStarted; attempt += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
  assert.equal(bodyStarted, true);
  controller.stop();
  assert.equal(await speaking, false);
  assert.equal(audioCreated, false);
});

test("a late rejection from stopped audio cannot cancel newer speech", async () => {
  const audioInstances = [];
  const playPromises = [];

  class FakeAudio {
    constructor() {
      this.pauseCount = 0;
      this.onended = null;
      this.onerror = null;
      audioInstances.push(this);
    }

    play() {
      return new Promise((resolve, reject) => {
        playPromises.push({ resolve, reject });
      });
    }

    pause() {
      this.pauseCount += 1;
    }

    removeAttribute() {}

    load() {}
  }

  const controller = createElevenLabsVoiceController({
    fetchImpl: async () =>
      new Response(new Uint8Array([1]), {
        headers: { "Content-Type": "audio/mpeg" },
      }),
    AudioClass: FakeAudio,
    urlApi: {
      createObjectURL() {
        return `blob:voice-${audioInstances.length + 1}`;
      },
      revokeObjectURL() {},
    },
  });

  const first = controller.speak("First", {
    voice: VALID_VOICE,
    purpose: "guidance",
  });
  await new Promise((resolve) => setImmediate(resolve));
  const second = controller.speak("Second", {
    voice: VALID_VOICE,
    purpose: "guidance",
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(audioInstances.length, 2);
  assert.equal(await first, false);

  playPromises[0].reject(new Error("late autoplay rejection"));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(controller.playing, true);
  assert.equal(audioInstances[1].pauseCount, 0);

  playPromises[1].resolve();
  audioInstances[1].onended();
  assert.equal(await second, true);
});

test("a replacement request retries while the server finishes cancellation", async () => {
  let requestCount = 0;
  let audioInstance = null;
  class FakeAudio {
    constructor() {
      audioInstance = this;
    }

    play() {
      return Promise.resolve();
    }

    pause() {}

    removeAttribute() {}

    load() {}
  }

  const controller = createElevenLabsVoiceController({
    fetchImpl: async () => {
      requestCount += 1;
      if (requestCount === 1) {
        return Response.json(
          { error: "The previous voice request is still stopping." },
          { status: 409 },
        );
      }
      return new Response(new Uint8Array([1]), {
        headers: { "Content-Type": "audio/mpeg" },
      });
    },
    AudioClass: FakeAudio,
    urlApi: {
      createObjectURL() {
        return "blob:replacement";
      },
      revokeObjectURL() {},
    },
  });

  const speaking = controller.speak("Replacement", {
    voice: VALID_VOICE,
    purpose: "guidance",
  });
  for (let attempt = 0; attempt < 30 && !audioInstance; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  assert.equal(requestCount, 2);
  audioInstance.onended();
  assert.equal(await speaking, true);
});
