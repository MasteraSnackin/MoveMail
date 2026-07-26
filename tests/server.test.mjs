import assert from "node:assert/strict";
import { mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { request as httpRequest } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { createElevenLabsVoiceController } from "../js/elevenlabs-voice.js";
import {
  createMoveMailServer,
  loadServerConfiguration,
} from "../server.mjs";

async function createFixture(
  t,
  { apiKey = "sentinel-server-key", customFetchImpl = null } = {},
) {
  const temporaryRoot = await mkdtemp(join(tmpdir(), "movemail-server-"));
  const publicRoot = join(temporaryRoot, "public");
  await import("node:fs/promises").then(({ mkdir }) =>
    mkdir(publicRoot, { recursive: true }),
  );
  await writeFile(
    join(publicRoot, "index.html"),
    "<!doctype html><title>MoveMail fixture</title>",
  );
  await writeFile(join(temporaryRoot, ".env.local"), apiKey);
  const outsideFile = join(temporaryRoot, "outside.txt");
  await writeFile(outsideFile, "private");
  await symlink(outsideFile, join(publicRoot, "outside-link.txt"));

  const upstreamCalls = [];
  const defaultFetchImpl = async (url, options = {}) => {
    upstreamCalls.push({ url: String(url), options });
    if (String(url).includes("/v2/voices")) {
      return Response.json({
        voices: [
          { voice_id: "voice-id-one", name: "Garden Voice" },
          { voice_id: "voice-id-two", name: "Warm Voice" },
        ],
      });
    }
    return new Response(new Uint8Array([1, 2, 3, 4]), {
      headers: {
        "Content-Length": "4",
        "Content-Type": "audio/mpeg",
      },
    });
  };
  const fetchImpl = customFetchImpl
    ? (url, options = {}) => {
        upstreamCalls.push({ url: String(url), options });
        return customFetchImpl(url, options);
      }
    : defaultFetchImpl;

  const server = createMoveMailServer({
    apiKey,
    fetchImpl,
    publicRoot,
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;
  t.after(async () => {
    const closed = new Promise((resolve) => server.close(resolve));
    server.closeAllConnections();
    await closed;
    await rm(temporaryRoot, { recursive: true, force: true });
  });

  return { apiKey, baseUrl, upstreamCalls };
}

function clientHeaders(baseUrl, extra = {}) {
  return {
    Origin: baseUrl,
    "X-MoveMail-Request": "voice-v1",
    ...extra,
  };
}

test("the local server exposes no secret and serves only public files", async (t) => {
  const { apiKey, baseUrl } = await createFixture(t);

  const home = await fetch(`${baseUrl}/`);
  assert.equal(home.status, 200);
  assert.match(await home.text(), /MoveMail fixture/);
  assert.match(home.headers.get("content-security-policy"), /connect-src 'self'/);

  for (const path of [
    "/.env.local",
    "/.git/config",
    "/%2e%2e%2f.env.local",
    "/outside-link.txt",
  ]) {
    const response = await fetch(`${baseUrl}${path}`);
    assert.equal(response.status, 404, path);
    assert.doesNotMatch(await response.text(), new RegExp(apiKey));
  }

  const status = await fetch(`${baseUrl}/api/elevenlabs/status`);
  assert.equal(status.status, 200);
  const statusText = await status.text();
  assert.deepEqual(JSON.parse(statusText), { configured: true });
  assert.doesNotMatch(statusText, new RegExp(apiKey));
});

test("voice inventory is sanitised behind a same-origin client header", async (t) => {
  const { apiKey, baseUrl, upstreamCalls } = await createFixture(t);

  const denied = await fetch(`${baseUrl}/api/elevenlabs/config`);
  assert.equal(denied.status, 403);

  const response = await fetch(`${baseUrl}/api/elevenlabs/config`, {
    headers: clientHeaders(baseUrl),
  });
  assert.equal(response.status, 200);
  const config = await response.json();
  assert.equal(config.available, true);
  assert.equal(config.voices.length, 2);
  assert.match(config.voices[0].alias, /^voice_[a-f0-9]{16}$/);
  assert.deepEqual(
    config.voices.map(({ label }) => label),
    ["Garden Voice", "Warm Voice"],
  );
  assert.doesNotMatch(JSON.stringify(config), /voice-id|sentinel-server-key/);
  assert.equal(upstreamCalls[0].options.headers["xi-api-key"], apiKey);
});

test("speech uses a fixed upstream contract and returns bounded audio", async (t) => {
  const { apiKey, baseUrl, upstreamCalls } = await createFixture(t);
  const config = await fetch(`${baseUrl}/api/elevenlabs/config`, {
    headers: clientHeaders(baseUrl),
  }).then((response) => response.json());
  const voice = config.voices[0].alias;

  const response = await fetch(`${baseUrl}/api/elevenlabs/speech`, {
    method: "POST",
    headers: clientHeaders(baseUrl, {
      "Content-Type": "application/json",
    }),
    body: JSON.stringify({
      text: "A gentle movement.",
      purpose: "guidance",
      voice,
    }),
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "audio/mpeg");
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual([...new Uint8Array(await response.arrayBuffer())], [1, 2, 3, 4]);

  const speechCall = upstreamCalls.at(-1);
  assert.match(
    speechCall.url,
    /^https:\/\/api\.elevenlabs\.io\/v1\/text-to-speech\/voice-id-one\?output_format=mp3_44100_128$/,
  );
  assert.equal(speechCall.options.headers["xi-api-key"], apiKey);
  assert.deepEqual(JSON.parse(speechCall.options.body), {
    text: "A gentle movement.",
    model_id: "eleven_flash_v2_5",
  });

  const postcardResponse = await fetch(
    `${baseUrl}/api/elevenlabs/speech`,
    {
      method: "POST",
      headers: clientHeaders(baseUrl, {
        "Content-Type": "application/json",
      }),
      body: JSON.stringify({
        text: "A private family message.",
        purpose: "postcard",
        voice,
        consent: true,
      }),
    },
  );
  assert.equal(postcardResponse.status, 200);
  const postcardCall = upstreamCalls.at(-1);
  assert.deepEqual(JSON.parse(postcardCall.options.body), {
    text: "A private family message.",
    model_id: "eleven_flash_v2_5",
  });
  assert.doesNotMatch(
    postcardCall.options.body,
    /recipient|sender|postcard|consent|purpose/i,
  );
});

test("postcard text is rejected without consent before any TTS call", async (t) => {
  const { baseUrl, upstreamCalls } = await createFixture(t);
  const config = await fetch(`${baseUrl}/api/elevenlabs/config`, {
    headers: clientHeaders(baseUrl),
  }).then((response) => response.json());
  const callsBefore = upstreamCalls.length;

  const response = await fetch(`${baseUrl}/api/elevenlabs/speech`, {
    method: "POST",
    headers: clientHeaders(baseUrl, {
      "Content-Type": "application/json",
    }),
    body: JSON.stringify({
      text: "Private postcard",
      purpose: "postcard",
      voice: config.voices[0].alias,
    }),
  });
  assert.equal(response.status, 400);
  assert.equal(upstreamCalls.length, callsBefore);
  assert.match((await response.json()).error, /explicit consent/i);
});

test("foreign origins and untrusted speech fields are rejected locally", async (t) => {
  const { baseUrl, upstreamCalls } = await createFixture(t);
  const config = await fetch(`${baseUrl}/api/elevenlabs/config`, {
    headers: clientHeaders(baseUrl),
  }).then((response) => response.json());
  const callsBefore = upstreamCalls.length;

  const foreign = await fetch(`${baseUrl}/api/elevenlabs/speech`, {
    method: "POST",
    headers: clientHeaders("https://example.test", {
      "Content-Type": "application/json",
    }),
    body: JSON.stringify({
      text: "Do not send",
      purpose: "guidance",
      voice: config.voices[0].alias,
    }),
  });
  assert.equal(foreign.status, 403);

  const extraField = await fetch(`${baseUrl}/api/elevenlabs/speech`, {
    method: "POST",
    headers: clientHeaders(baseUrl, {
      "Content-Type": "application/json",
    }),
    body: JSON.stringify({
      text: "Do not choose a model",
      purpose: "guidance",
      voice: config.voices[0].alias,
      modelId: "untrusted",
    }),
  });
  assert.equal(extraField.status, 400);
  assert.equal(upstreamCalls.length, callsBefore);
});

test("the complete app remains available when no key is configured", async (t) => {
  const { baseUrl, upstreamCalls } = await createFixture(t, { apiKey: "" });

  const status = await fetch(`${baseUrl}/api/elevenlabs/status`);
  assert.deepEqual(await status.json(), { configured: false });

  const config = await fetch(`${baseUrl}/api/elevenlabs/config`, {
    headers: clientHeaders(baseUrl),
  });
  assert.equal(config.status, 503);
  assert.equal(upstreamCalls.length, 0);

  const home = await fetch(`${baseUrl}/`);
  assert.equal(home.status, 200);
});

test("the documented .env.local setting is loaded without exposing it", async (t) => {
  const temporaryRoot = await mkdtemp(join(tmpdir(), "movemail-env-"));
  t.after(() => rm(temporaryRoot, { recursive: true, force: true }));
  await writeFile(
    join(temporaryRoot, ".env.local"),
    [
      "# Local MoveMail voice key",
      "ELEVENLABS_API_KEY='sentinel-loaded-key'",
      "IGNORED_VALUE=not-used",
    ].join("\n"),
  );

  const configuration = await loadServerConfiguration({
    environment: {},
    projectRoot: temporaryRoot,
  });
  assert.deepEqual(configuration, { apiKey: "sentinel-loaded-key" });
  assert.equal(Object.keys(configuration).length, 1);
});

test("closing the browser request aborts pending upstream generation", async (t) => {
  let speechStarted = false;
  let speechAborted = false;
  const customFetchImpl = async (url, options = {}) => {
    if (String(url).includes("/v2/voices")) {
      return Response.json({
        voices: [{ voice_id: "voice-id-one", name: "Garden Voice" }],
      });
    }
    speechStarted = true;
    return new Promise((_resolve, reject) => {
      options.signal.addEventListener("abort", () => {
        speechAborted = true;
        reject(new DOMException("Aborted", "AbortError"));
      });
    });
  };
  const { baseUrl } = await createFixture(t, { customFetchImpl });
  const config = await fetch(`${baseUrl}/api/elevenlabs/config`, {
    headers: clientHeaders(baseUrl),
  }).then((response) => response.json());
  const target = new URL("/api/elevenlabs/speech", baseUrl);
  const body = JSON.stringify({
    text: "Cancel this request.",
    purpose: "guidance",
    voice: config.voices[0].alias,
  });

  const request = httpRequest({
    hostname: target.hostname,
    port: target.port,
    path: target.pathname,
    method: "POST",
    headers: {
      ...clientHeaders(baseUrl, {
        "Content-Type": "application/json",
      }),
      "Content-Length": Buffer.byteLength(body),
    },
  });
  request.on("error", () => {});
  request.end(body);

  for (let attempt = 0; attempt < 50 && !speechStarted; attempt += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
  assert.equal(speechStarted, true);
  request.destroy();
  for (let attempt = 0; attempt < 50 && !speechAborted; attempt += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
  assert.equal(speechAborted, true);
});

test("the client replaces a delayed server request without losing newer speech", async (t) => {
  let speechCalls = 0;
  let firstSpeechStarted = false;
  const customFetchImpl = async (url, options = {}) => {
    if (String(url).includes("/v2/voices")) {
      return Response.json({
        voices: [{ voice_id: "voice-id-one", name: "Garden Voice" }],
      });
    }
    speechCalls += 1;
    if (speechCalls === 1) {
      firstSpeechStarted = true;
      return new Promise((_resolve, reject) => {
        options.signal.addEventListener("abort", () => {
          setTimeout(
            () => reject(new DOMException("Aborted", "AbortError")),
            120,
          );
        });
      });
    }
    return new Response(new Uint8Array([1, 2]), {
      headers: { "Content-Type": "audio/mpeg" },
    });
  };
  const { baseUrl } = await createFixture(t, { customFetchImpl });
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
  const browserFetch = (path, options = {}) => {
    const headers = new Headers(options.headers);
    if (options.method === "POST") {
      headers.set("Origin", baseUrl);
    }
    return fetch(new URL(path, baseUrl), { ...options, headers });
  };
  const controller = createElevenLabsVoiceController({
    fetchImpl: browserFetch,
    AudioClass: FakeAudio,
    urlApi: {
      createObjectURL() {
        return "blob:integrated-replacement";
      },
      revokeObjectURL() {},
    },
  });
  const config = await controller.getConfig();
  const voice = config.voices[0].alias;

  const first = controller.speak("First instruction", {
    voice,
    purpose: "guidance",
  });
  for (
    let attempt = 0;
    attempt < 30 && !firstSpeechStarted;
    attempt += 1
  ) {
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  assert.equal(firstSpeechStarted, true);
  const second = controller.speak("Newer feedback", {
    voice,
    purpose: "guidance",
  });
  assert.equal(await first, false);

  for (let attempt = 0; attempt < 80 && !audioInstance; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  assert.equal(speechCalls, 2);
  assert.ok(audioInstance);
  audioInstance.onended();
  assert.equal(await second, true);
});
