import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import hostedStatus from "../api/elevenlabs/status.mjs";

test("Vercel builds the generated public app with equivalent security headers", async () => {
  const config = JSON.parse(
    await readFile(new URL("../vercel.json", import.meta.url), "utf8"),
  );

  assert.equal(config.framework, null);
  assert.equal(config.buildCommand, "npm run build");
  assert.equal(config.outputDirectory, "public");
  assert.equal(config.installCommand, "npm ci");

  const headers = Object.fromEntries(
    config.headers[0].headers.map(({ key, value }) => [key, value]),
  );
  assert.match(headers["Content-Security-Policy"], /connect-src 'self'/);
  assert.match(headers["Content-Security-Policy"], /media-src 'self' blob:/);
  assert.equal(
    headers["Permissions-Policy"],
    "camera=(self), microphone=(), geolocation=(), payment=(), usb=()",
  );
  assert.equal(headers["X-Content-Type-Options"], "nosniff");
  assert.equal(headers["X-Frame-Options"], "DENY");
});

test("the hosted status endpoint is explicitly device-only and secret-free", async () => {
  const response = await hostedStatus.fetch(
    new Request("https://movemail.example/api/elevenlabs/status"),
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const body = await response.text();
  assert.deepEqual(JSON.parse(body), {
    configured: false,
    hostedDeviceOnly: true,
  });
  assert.doesNotMatch(body, /api.?key|elevenlabs_api_key|secret/i);

  const rejected = await hostedStatus.fetch(
    new Request("https://movemail.example/api/elevenlabs/status", {
      method: "POST",
    }),
  );
  assert.equal(rejected.status, 405);
  assert.equal(rejected.headers.get("allow"), "GET");
});

test("Vercel uploads no local environment file and the hosted notice is built", async () => {
  const [ignoreFile, publicIndex] = await Promise.all([
    readFile(new URL("../.vercelignore", import.meta.url), "utf8"),
    readFile(new URL("../public/index.html", import.meta.url), "utf8"),
  ]);

  assert.match(ignoreFile, /^\.env$/m);
  assert.match(ignoreFile, /^\.env\.\*$/m);
  assert.match(ignoreFile, /^\.vercel$/m);
  assert.match(publicIndex, /data-elevenlabs-hosted/);
  assert.match(publicIndex, /Online ElevenLabs speech is disabled/);
  assert.doesNotMatch(publicIndex, /VERCEL_OIDC_TOKEN/);
});
