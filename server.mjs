import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readFile, realpath, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { dirname, extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = dirname(fileURLToPath(import.meta.url));
const DEFAULT_PUBLIC_ROOT = join(PROJECT_ROOT, "public");
const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 8080;
const MAX_REQUEST_BYTES = 4_096;
const MAX_AUDIO_BYTES = 2 * 1024 * 1024;
const UPSTREAM_TIMEOUT_MS = 15_000;
const VOICE_CACHE_MS = 5 * 60_000;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_REQUESTS = 24;
const MODEL_ID = "eleven_flash_v2_5";
const OUTPUT_FORMAT = "mp3_44100_128";
const CLIENT_HEADER = "x-movemail-request";
const CLIENT_HEADER_VALUE = "voice-v1";
const VOICE_ALIAS_PATTERN = /^voice_[a-f0-9]{16}$/;
const LOOPBACK_HOST_PATTERN =
  /^(?:localhost|127\.0\.0\.1)(?::(?:[1-9]\d{0,4}))?$/i;

const MIME_TYPES = Object.freeze({
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".task": "application/octet-stream",
  ".wasm": "application/wasm",
});

const SECURITY_HEADERS = Object.freeze({
  "Content-Security-Policy":
    "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self'; img-src 'self' data:; media-src 'self' blob:; connect-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Permissions-Policy":
    "camera=(self), microphone=(), geolocation=(), payment=(), usb=()",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
});

class HttpError extends Error {
  constructor(statusCode, publicMessage) {
    super(publicMessage);
    this.statusCode = statusCode;
    this.publicMessage = publicMessage;
  }
}

function applyHeaders(response, extraHeaders = {}) {
  for (const [name, value] of Object.entries({
    ...SECURITY_HEADERS,
    ...extraHeaders,
  })) {
    response.setHeader(name, value);
  }
}

function sendJson(response, statusCode, payload) {
  const body = JSON.stringify(payload);
  response.statusCode = statusCode;
  applyHeaders(response, {
    "Cache-Control": "no-store",
    "Content-Length": Buffer.byteLength(body),
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(body);
}

function sendEmpty(response, statusCode, extraHeaders = {}) {
  response.statusCode = statusCode;
  applyHeaders(response, {
    "Cache-Control": "no-store",
    ...extraHeaders,
  });
  response.end();
}

function isAllowedHost(hostHeader, localPort) {
  const host = String(hostHeader || "");
  if (!LOOPBACK_HOST_PATTERN.test(host)) {
    return false;
  }
  const port = Number(localPort);
  const allowedHosts = new Set([
    `localhost:${port}`,
    `127.0.0.1:${port}`,
  ]);
  if (port === 80) {
    allowedHosts.add("localhost");
    allowedHosts.add("127.0.0.1");
  }
  return allowedHosts.has(host.toLowerCase());
}

function requireLocalRequest(request, { requireOrigin = false } = {}) {
  const host = String(request.headers.host || "");
  if (!isAllowedHost(host, request.socket.localPort)) {
    throw new HttpError(403, "Request not allowed.");
  }

  const origin = request.headers.origin;
  if (!origin) {
    if (requireOrigin) {
      throw new HttpError(403, "Request not allowed.");
    }
    return;
  }

  let parsedOrigin;
  try {
    parsedOrigin = new URL(origin);
  } catch {
    throw new HttpError(403, "Request not allowed.");
  }

  if (
    parsedOrigin.protocol !== "http:" ||
    parsedOrigin.host.toLowerCase() !== host.toLowerCase() ||
    !["localhost", "127.0.0.1"].includes(
      parsedOrigin.hostname.toLowerCase(),
    )
  ) {
    throw new HttpError(403, "Request not allowed.");
  }
}

function requireVoiceClient(request) {
  if (request.headers[CLIENT_HEADER] !== CLIENT_HEADER_VALUE) {
    throw new HttpError(403, "Request not allowed.");
  }
}

async function readJsonBody(request) {
  const contentType = String(request.headers["content-type"] || "");
  if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(contentType)) {
    throw new HttpError(415, "JSON is required.");
  }

  const declaredLength = Number(request.headers["content-length"] || 0);
  if (declaredLength > MAX_REQUEST_BYTES) {
    throw new HttpError(413, "Request is too large.");
  }

  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_REQUEST_BYTES) {
      throw new HttpError(413, "Request is too large.");
    }
    chunks.push(chunk);
  }

  let value;
  try {
    value = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new HttpError(400, "Invalid JSON.");
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpError(400, "Invalid request.");
  }
  return value;
}

function validateSpeechRequest(value) {
  const allowedKeys = new Set(["consent", "purpose", "text", "voice"]);
  if (Object.keys(value).some((key) => !allowedKeys.has(key))) {
    throw new HttpError(400, "Invalid request.");
  }

  const purpose = value.purpose;
  if (!["guidance", "postcard", "test"].includes(purpose)) {
    throw new HttpError(400, "Invalid speech purpose.");
  }

  const text = typeof value.text === "string" ? value.text.trim() : "";
  const maximumLength = purpose === "postcard" ? 280 : 360;
  if (!text || text.length > maximumLength) {
    throw new HttpError(400, "Text length is invalid.");
  }

  const voice =
    typeof value.voice === "string" ? value.voice.trim() : "";
  if (!VOICE_ALIAS_PATTERN.test(voice)) {
    throw new HttpError(400, "Voice is invalid.");
  }

  if (purpose === "postcard" && value.consent !== true) {
    throw new HttpError(
      400,
      "Online postcard read-aloud requires explicit consent.",
    );
  }
  if (purpose !== "postcard" && "consent" in value) {
    throw new HttpError(400, "Invalid request.");
  }

  return { purpose, text, voice };
}

function createVoiceAlias(voiceId) {
  const digest = createHash("sha256").update(voiceId).digest("hex");
  return `voice_${digest.slice(0, 16)}`;
}

function sanitiseVoices(value) {
  if (!Array.isArray(value?.voices)) {
    throw new HttpError(502, "ElevenLabs voices could not be loaded.");
  }

  return value.voices
    .map((voice) => {
      const voiceId =
        typeof voice?.voice_id === "string" ? voice.voice_id.trim() : "";
      const label =
        typeof voice?.name === "string" ? voice.name.trim().slice(0, 80) : "";
      if (!voiceId || !label) {
        return null;
      }
      return Object.freeze({
        alias: createVoiceAlias(voiceId),
        label,
        voiceId,
      });
    })
    .filter(Boolean)
    .sort((left, right) => left.label.localeCompare(right.label))
    .slice(0, 100);
}

async function fetchWithTimeout(fetchImpl, url, options) {
  const { signal: externalSignal, ...fetchOptions } = options;
  const timeoutSignal = AbortSignal.timeout(UPSTREAM_TIMEOUT_MS);
  const signal = externalSignal
    ? AbortSignal.any([timeoutSignal, externalSignal])
    : timeoutSignal;
  try {
    return await fetchImpl(url, {
      ...fetchOptions,
      redirect: "error",
      signal,
    });
  } catch (error) {
    if (timeoutSignal.aborted) {
      throw new HttpError(504, "The ElevenLabs request timed out.");
    }
    if (externalSignal?.aborted) {
      throw new HttpError(499, "The voice request was cancelled.");
    }
    throw new HttpError(502, "ElevenLabs could not be reached.");
  }
}

async function readBoundedResponse(response, maximumBytes) {
  const declaredLength = Number(response.headers.get("content-length") || 0);
  if (declaredLength > maximumBytes) {
    throw new HttpError(502, "The ElevenLabs response was too large.");
  }

  if (!response.body) {
    throw new HttpError(502, "ElevenLabs returned an empty response.");
  }

  const chunks = [];
  let size = 0;
  try {
    for await (const chunk of response.body) {
      size += chunk.length;
      if (size > maximumBytes) {
        throw new HttpError(502, "The ElevenLabs response was too large.");
      }
      chunks.push(Buffer.from(chunk));
    }
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }
    if (error?.name === "AbortError") {
      throw new HttpError(504, "The ElevenLabs request timed out.");
    }
    throw new HttpError(502, "ElevenLabs returned an invalid response.");
  }
  return Buffer.concat(chunks);
}

async function readEnvironmentFile(projectRoot = PROJECT_ROOT) {
  let source = "";
  try {
    source = await readFile(join(projectRoot, ".env.local"), "utf8");
  } catch (error) {
    if (error?.code !== "ENOENT") {
      throw error;
    }
  }

  const entries = {};
  for (const line of source.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match || match[1] !== "ELEVENLABS_API_KEY") {
      continue;
    }
    let value = match[2];
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    entries[match[1]] = value;
  }
  return entries;
}

export async function loadServerConfiguration({
  environment = process.env,
  projectRoot = PROJECT_ROOT,
} = {}) {
  const localEnvironment = await readEnvironmentFile(projectRoot);
  const apiKey = String(
    environment.ELEVENLABS_API_KEY ||
      localEnvironment.ELEVENLABS_API_KEY ||
      "",
  ).trim();
  return Object.freeze({ apiKey });
}

export function createMoveMailServer({
  apiKey = "",
  fetchImpl = globalThis.fetch,
  publicRoot = DEFAULT_PUBLIC_ROOT,
  now = Date.now,
} = {}) {
  const voiceIdByAlias = new Map();
  let cachedVoices = [];
  let voicesCachedAt = 0;
  let speechInFlight = false;
  const requestTimes = [];

  async function loadVoices({ refresh = false } = {}) {
    if (!apiKey) {
      throw new HttpError(503, "ElevenLabs is not configured.");
    }
    if (
      !refresh &&
      cachedVoices.length &&
      now() - voicesCachedAt < VOICE_CACHE_MS
    ) {
      return cachedVoices;
    }

    const response = await fetchWithTimeout(
      fetchImpl,
      "https://api.elevenlabs.io/v2/voices?page_size=100&sort=name&sort_direction=asc&include_total_count=false",
      {
        headers: {
          Accept: "application/json",
          "xi-api-key": apiKey,
        },
      },
    );
    if (!response.ok) {
      throw new HttpError(502, "ElevenLabs voices could not be loaded.");
    }

    const body = await readBoundedResponse(response, 512 * 1024);
    let parsed;
    try {
      parsed = JSON.parse(body.toString("utf8"));
    } catch {
      throw new HttpError(502, "ElevenLabs returned an invalid response.");
    }

    cachedVoices = sanitiseVoices(parsed);
    voiceIdByAlias.clear();
    for (const voice of cachedVoices) {
      voiceIdByAlias.set(voice.alias, voice.voiceId);
    }
    voicesCachedAt = now();
    return cachedVoices;
  }

  function checkSpeechRateLimit() {
    const cutoff = now() - RATE_LIMIT_WINDOW_MS;
    while (requestTimes.length && requestTimes[0] < cutoff) {
      requestTimes.shift();
    }
    if (requestTimes.length >= RATE_LIMIT_REQUESTS) {
      throw new HttpError(429, "Too many voice requests. Please wait.");
    }
    if (speechInFlight) {
      throw new HttpError(
        409,
        "The previous voice request is still stopping. Please try again.",
      );
    }
    requestTimes.push(now());
  }

  async function handleVoiceConfig(request, response, requestUrl) {
    if (request.method !== "GET") {
      sendEmpty(response, 405, { Allow: "GET" });
      return;
    }
    requireLocalRequest(request);
    requireVoiceClient(request);
    const voices = await loadVoices({
      refresh: requestUrl.searchParams.get("refresh") === "1",
    });
    sendJson(response, 200, {
      available: true,
      modelLabel: "Eleven Flash v2.5",
      voices: voices.map(({ alias, label }) => ({ alias, label })),
    });
  }

  async function handleSpeech(request, response) {
    if (request.method !== "POST") {
      sendEmpty(response, 405, { Allow: "POST" });
      return;
    }
    requireLocalRequest(request, { requireOrigin: true });
    requireVoiceClient(request);
    if (!apiKey) {
      throw new HttpError(503, "ElevenLabs is not configured.");
    }
    checkSpeechRateLimit();
    speechInFlight = true;
    const clientAbortController = new AbortController();
    const abortForClient = () => clientAbortController.abort();
    const abortForClosedResponse = () => {
      if (!response.writableEnded) {
        clientAbortController.abort();
      }
    };
    request.once("aborted", abortForClient);
    response.once("close", abortForClosedResponse);

    try {
      const speech = validateSpeechRequest(await readJsonBody(request));
      let voiceId = voiceIdByAlias.get(speech.voice);
      if (!voiceId) {
        await loadVoices();
        voiceId = voiceIdByAlias.get(speech.voice);
      }
      if (!voiceId) {
        throw new HttpError(400, "Voice is unavailable.");
      }

      const upstreamUrl =
        `https://api.elevenlabs.io/v1/text-to-speech/` +
        `${encodeURIComponent(voiceId)}?output_format=${OUTPUT_FORMAT}`;
      const upstream = await fetchWithTimeout(fetchImpl, upstreamUrl, {
        method: "POST",
        headers: {
          Accept: "audio/mpeg",
          "Content-Type": "application/json",
          "xi-api-key": apiKey,
        },
        body: JSON.stringify({
          text: speech.text,
          model_id: MODEL_ID,
        }),
        signal: clientAbortController.signal,
      });
      if (!upstream.ok) {
        throw new HttpError(502, "ElevenLabs could not create the speech.");
      }

      const contentType = String(
        upstream.headers.get("content-type") || "",
      ).toLowerCase();
      if (!contentType.startsWith("audio/")) {
        throw new HttpError(502, "ElevenLabs returned an invalid response.");
      }
      const audio = await readBoundedResponse(upstream, MAX_AUDIO_BYTES);
      response.statusCode = 200;
      applyHeaders(response, {
        "Cache-Control": "no-store",
        "Content-Length": audio.length,
        "Content-Type": contentType,
      });
      response.end(audio);
    } finally {
      request.off("aborted", abortForClient);
      response.off("close", abortForClosedResponse);
      speechInFlight = false;
    }
  }

  async function handleStatic(request, response, requestUrl) {
    if (!["GET", "HEAD"].includes(request.method)) {
      sendEmpty(response, 405, { Allow: "GET, HEAD" });
      return;
    }
    requireLocalRequest(request);

    let decodedPath;
    try {
      decodedPath = decodeURIComponent(requestUrl.pathname);
    } catch {
      throw new HttpError(400, "Invalid path.");
    }
    if (
      decodedPath.includes("\\") ||
      decodedPath.split("/").some((part) => part.startsWith(".")) ||
      /%2e|%2f|%5c/i.test(request.url || "")
    ) {
      throw new HttpError(404, "Not found.");
    }

    const relativePath =
      decodedPath === "/" ? "index.html" : decodedPath.replace(/^\/+/, "");
    const candidate = resolve(publicRoot, relativePath);
    const relativeCandidate = relative(resolve(publicRoot), candidate);
    if (
      relativeCandidate.startsWith(`..${sep}`) ||
      relativeCandidate === ".." ||
      relativeCandidate === ""
    ) {
      throw new HttpError(404, "Not found.");
    }

    let fileStats;
    let resolvedPublicRoot;
    let resolvedFile;
    try {
      [fileStats, resolvedPublicRoot, resolvedFile] = await Promise.all([
        stat(candidate),
        realpath(publicRoot),
        realpath(candidate),
      ]);
    } catch {
      throw new HttpError(404, "Not found.");
    }
    if (
      !fileStats.isFile() ||
      (resolvedFile !== resolvedPublicRoot &&
        !resolvedFile.startsWith(`${resolvedPublicRoot}${sep}`))
    ) {
      throw new HttpError(404, "Not found.");
    }

    response.statusCode = 200;
    applyHeaders(response, {
      "Cache-Control": "no-cache",
      "Content-Length": fileStats.size,
      "Content-Type":
        MIME_TYPES[extname(resolvedFile).toLowerCase()] ||
        "application/octet-stream",
    });
    if (request.method === "HEAD") {
      response.end();
      return;
    }
    createReadStream(resolvedFile).pipe(response);
  }

  return createServer((request, response) => {
    void (async () => {
      try {
        if (request.method === "OPTIONS") {
          throw new HttpError(405, "Method not allowed.");
        }
        const requestUrl = new URL(request.url || "/", "http://localhost");
        if (requestUrl.pathname === "/api/elevenlabs/status") {
          if (request.method !== "GET") {
            sendEmpty(response, 405, { Allow: "GET" });
            return;
          }
          requireLocalRequest(request);
          sendJson(response, 200, {
            configured: Boolean(apiKey),
          });
          return;
        }
        if (requestUrl.pathname === "/api/elevenlabs/config") {
          await handleVoiceConfig(request, response, requestUrl);
          return;
        }
        if (requestUrl.pathname === "/api/elevenlabs/speech") {
          await handleSpeech(request, response);
          return;
        }
        if (requestUrl.pathname.startsWith("/api/")) {
          throw new HttpError(404, "Not found.");
        }
        await handleStatic(request, response, requestUrl);
      } catch (error) {
        if (response.headersSent || response.destroyed || response.writableEnded) {
          response.destroy();
          return;
        }
        const statusCode =
          error instanceof HttpError ? error.statusCode : 500;
        const publicMessage =
          error instanceof HttpError
            ? error.publicMessage
            : "MoveMail could not complete the request.";
        sendJson(response, statusCode, { error: publicMessage });
      }
    })();
  });
}

async function startServer() {
  const { apiKey } = await loadServerConfiguration();
  const server = createMoveMailServer({ apiKey });
  server.on("error", (error) => {
    const message =
      error?.code === "EADDRINUSE"
        ? `MoveMail could not start because port ${DEFAULT_PORT} is already in use.`
        : "MoveMail could not start its local server.";
    console.error(message);
    process.exitCode = 1;
  });
  server.listen(DEFAULT_PORT, DEFAULT_HOST, () => {
    console.log(`MoveMail is running at http://localhost:${DEFAULT_PORT}`);
    console.log(
      apiKey
        ? "ElevenLabs is configured."
        : "ElevenLabs is not configured; device voice remains available.",
    );
    console.log("Press Control-C to stop.");
  });
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))
) {
  void startServer();
}
