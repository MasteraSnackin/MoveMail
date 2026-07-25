import assert from "node:assert/strict";
import test, { after } from "node:test";

for (const name of [
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "ELEVENLABS_API_KEY",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
]) {
  delete process.env[name];
}

const nativeFetch = globalThis.fetch;
let storageResponse = "unused";
globalThis.fetch = async (input, init) => {
  const url = input instanceof Request ? input.url : String(input);
  if (url.startsWith("https://storage.example/")) {
    if (storageResponse === "empty") return Response.json([]);
    if (storageResponse === "upstream-error") {
      return Response.json({ message: "unavailable" }, { status: 503 });
    }
    if (storageResponse === "timeout") {
      throw new DOMException("Timed out", "TimeoutError");
    }
  }
  return nativeFetch(input, init);
};

after(() => {
  globalThis.fetch = nativeFetch;
});

const workerUrl = new URL("../dist/server/index.js", import.meta.url);
workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
const { default: worker } = await import(workerUrl.href);

const runtimeEnvironment = {
  ASSETS: {
    fetch: async () => new Response("Not found", { status: 404 }),
  },
  IMAGES: {
    input() {
      throw new Error("Image optimisation is not used by the API tests.");
    },
  },
};

const executionContext = {
  waitUntil() {},
  passThroughOnException() {},
};

function request(path, init = {}) {
  return worker.fetch(
    new Request(`http://localhost${path}`, init),
    runtimeEnvironment,
    executionContext,
  );
}

async function assertJsonError(response, status, code) {
  assert.equal(response.status, status);
  assert.match(response.headers.get("cache-control") ?? "", /\bno-store\b/);
  const body = await response.json();
  assert.deepEqual(Object.keys(body).sort(), ["error", "ok"]);
  assert.equal(body.ok, false);
  assert.equal(body.error.code, code);
  assert.equal(typeof body.error.message, "string");
  assert.ok(body.error.message.length > 0);
  assert.match(body.error.requestId, /^[a-zA-Z0-9][a-zA-Z0-9._:-]{7,99}$/);
  assert.equal(response.headers.get("x-request-id"), body.error.requestId);
}

test("plan validation errors use the shared error contract", async () => {
  const response = await request("/api/plan", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Request-Id": "test-plan-invalid-json",
    },
    body: "{",
  });

  await assertJsonError(response, 400, "INVALID_JSON");
});

test("voice rejects non-string text using the shared error contract", async () => {
  const response = await request("/api/voice", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: 42 }),
  });

  await assertJsonError(response, 400, "INVALID_REQUEST");
});

test("cross-site sponsor requests are rejected before provider work", async () => {
  const response = await request("/api/plan", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Sec-Fetch-Site": "cross-site",
    },
    body: JSON.stringify({
      theme: "seaside",
      message: "A short note from the coast.",
    }),
  });

  await assertJsonError(response, 403, "CROSS_SITE_REQUEST");
});

test("plan generation remains a successful demo without LLM keys", async () => {
  const response = await request("/api/plan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      theme: "seaside",
      message: "A short note from the coast.",
      to: "Mum",
      from: "Sam",
    }),
  });

  assert.equal(response.status, 200);
  assert.match(response.headers.get("cache-control") ?? "", /\bno-store\b/);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.mode, "demo");
  assert.equal(body.provider, "demo");
  assert.equal(body.plan.moves.length, 3);
  assert.equal(response.headers.get("x-request-id"), body.requestId);
});

test("postcard creation remains a successful encoded link without Supabase", async () => {
  const response = await request("/api/postcards", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      toName: "Mum",
      fromName: "Sam",
      message: "A short note from the coast.",
      theme: "seaside",
      provider: "demo",
      plan: {
        title: "A little trip",
        opening: "Three gentle movements.",
        closing: "Your message is ready.",
        movements: [
          {
            id: "gentle_wave",
            label: "Wave to the boat",
            cue: "Give a small, friendly wave.",
          },
          {
            id: "reach_left",
            label: "Reach to the lighthouse",
            cue: "Reach your left hand gently.",
          },
          {
            id: "open_arms",
            label: "Welcome the sea breeze",
            cue: "Open both arms gently.",
          },
        ],
      },
    }),
  });

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.id, null);
  assert.equal(body.mode, "encoded-link");
  assert.equal(response.headers.get("x-request-id"), body.requestId);
});

test("voice returns an explicit browser fallback without ElevenLabs", async () => {
  const response = await request("/api/voice", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: "Reach gently to the side." }),
  });

  assert.equal(response.status, 204);
  assert.equal(response.headers.get("x-movemail-voice"), "browser-fallback");
  assert.match(response.headers.get("cache-control") ?? "", /\bno-store\b/);
  assert.ok(response.headers.get("x-request-id"));
  assert.equal(await response.text(), "");
});

test("stored postcard lookup reports unavailable storage when unconfigured", async () => {
  const response = await request(
    "/api/postcards?id=16f3f304-402d-4fd0-9b39-bf28a72fcfab",
  );

  await assertJsonError(response, 503, "STORAGE_UNAVAILABLE");
});

test("malformed postcard identifiers remain a not-found response", async () => {
  const response = await request("/api/postcards?id=not-a-uuid");

  await assertJsonError(response, 404, "POSTCARD_NOT_FOUND");
});

test("a successful empty Supabase lookup is a genuine not-found response", async () => {
  process.env.SUPABASE_URL = "https://storage.example";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-secret";
  storageResponse = "empty";

  try {
    const response = await request(
      "/api/postcards?id=16f3f304-402d-4fd0-9b39-bf28a72fcfab",
    );
    await assertJsonError(response, 404, "POSTCARD_NOT_FOUND");
  } finally {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    storageResponse = "unused";
  }
});

test("an unsuccessful Supabase response is reported as unavailable", async () => {
  process.env.SUPABASE_URL = "https://storage.example";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-secret";
  storageResponse = "upstream-error";

  try {
    const response = await request(
      "/api/postcards?id=16f3f304-402d-4fd0-9b39-bf28a72fcfab",
    );
    await assertJsonError(response, 503, "STORAGE_UNAVAILABLE");
  } finally {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    storageResponse = "unused";
  }
});

test("a timed-out Supabase lookup is reported as unavailable", async () => {
  process.env.SUPABASE_URL = "https://storage.example";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-secret";
  storageResponse = "timeout";

  try {
    const response = await request(
      "/api/postcards?id=16f3f304-402d-4fd0-9b39-bf28a72fcfab",
    );
    await assertJsonError(response, 503, "STORAGE_UNAVAILABLE");
  } finally {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    storageResponse = "unused";
  }
});
