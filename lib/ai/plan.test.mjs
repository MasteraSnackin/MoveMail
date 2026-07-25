import assert from "node:assert/strict";
import test from "node:test";

import {
  MOVEMENT_PLAN_JSON_SCHEMA,
  createFallbackPlan,
  parsePlanRequest,
  validateMovementPlan,
} from "./plan.ts";
import { generateMovementPlan } from "./providers.ts";

const request = {
  theme: "Brighton seaside",
  message: "Remember our day by the sea?",
  to: "Pat",
  from: "Sam",
};

test("the deterministic fallback always satisfies the plan contract", () => {
  const plan = createFallbackPlan(request);
  const result = validateMovementPlan(plan);

  assert.equal(result.success, true);
  assert.equal(plan.moves.length, 3);
  assert.equal(new Set(plan.moves.map((move) => move.id)).size, 3);
});

test("the Brighton fallback tells the intended three-move story", () => {
  const plan = createFallbackPlan({
    ...request,
    theme: "seaside",
    message: "Remember our trip to Brighton?",
  });

  assert.deepEqual(
    plan.moves.map((move) => move.id),
    ["gentle_wave", "reach_left", "open_arms"],
  );
  assert.equal(validateMovementPlan(plan).success, true);
});

test("the validator rejects repeated moves and medical claims", () => {
  const duplicatePlan = createFallbackPlan(request);
  duplicatePlan.moves[1] = { ...duplicatePlan.moves[0] };
  assert.equal(validateMovementPlan(duplicatePlan).success, false);

  const claimPlan = createFallbackPlan(request);
  claimPlan.closingLine = "This improves your balance and health.";
  assert.equal(validateMovementPlan(claimPlan).success, false);
});

test("request parsing requires a message and enforces input caps", () => {
  assert.equal(parsePlanRequest({ ...request, message: "" }).success, false);
  assert.equal(
    parsePlanRequest({ ...request, message: "x".repeat(601) }).success,
    false,
  );
  assert.equal(parsePlanRequest(request).success, true);
});

test("the provider schema uses only the shared supported keyword subset", () => {
  const supported = new Set([
    "type",
    "description",
    "additionalProperties",
    "properties",
    "items",
    "enum",
    "required",
  ]);

  visitSchema(MOVEMENT_PLAN_JSON_SCHEMA, (key) => {
    assert.equal(supported.has(key), true, `unsupported schema key: ${key}`);
  });
  assert.deepEqual(
    Object.keys(MOVEMENT_PLAN_JSON_SCHEMA.properties.moves.items.properties),
    ["id"],
  );
});

test("generation falls back to demo mode when no provider is configured", async () => {
  const result = await generateMovementPlan(request, { env: {} });

  assert.equal(result.mode, "demo");
  assert.equal(result.provider, "demo");
  assert.equal(validateMovementPlan(result.plan).success, true);
});

test("auto mode fails over and applies the Brighton movement policy", async () => {
  const livePlan = createFallbackPlan({ ...request, theme: "garden" });
  const calls = [];
  const failures = [];
  const fetchImpl = async (url) => {
    calls.push(String(url));
    if (String(url).includes("openai.com")) {
      return new Response("unavailable", { status: 503 });
    }
    return Response.json({
      stop_reason: "end_turn",
      content: [{ type: "text", text: JSON.stringify(livePlan) }],
    });
  };

  const result = await generateMovementPlan(request, {
    env: {
      LLM_PROVIDER: "auto",
      OPENAI_API_KEY: "test-openai",
      ANTHROPIC_API_KEY: "test-anthropic",
    },
    fetchImpl,
    onProviderFailure: (diagnostic) => failures.push(diagnostic),
  });

  assert.deepEqual(calls, [
    "https://api.openai.com/v1/responses",
    "https://api.anthropic.com/v1/messages",
  ]);
  assert.equal(result.mode, "live");
  assert.equal(result.provider, "anthropic");
  assert.deepEqual(
    result.plan.moves.map((move) => move.id),
    ["gentle_wave", "reach_left", "open_arms"],
  );
  assert.deepEqual(failures, [
    { provider: "openai", category: "upstream-response" },
  ]);
});

test("OpenAI requests disable storage and use current structured outputs", async () => {
  const livePlan = createFallbackPlan(request);
  let requestBody;
  const fetchImpl = async (_url, init) => {
    requestBody = JSON.parse(init.body);
    return Response.json({
      status: "completed",
      output: [
        {
          type: "message",
          content: [
            { type: "output_text", text: JSON.stringify(livePlan) },
          ],
        },
      ],
    });
  };

  const result = await generateMovementPlan(request, {
    env: {
      LLM_PROVIDER: "openai",
      OPENAI_API_KEY: "test-openai",
    },
    fetchImpl,
  });

  assert.equal(result.provider, "openai");
  assert.equal(requestBody.store, false);
  assert.equal(requestBody.model, "gpt-5.6-luna");
  assert.equal(requestBody.text.format.type, "json_schema");
  assert.equal(requestBody.text.format.strict, true);
  assert.deepEqual(requestBody.text.format.schema, MOVEMENT_PLAN_JSON_SCHEMA);
});

test("Anthropic requests use output_config with the shared schema", async () => {
  const livePlan = createFallbackPlan(request);
  let requestBody;
  const fetchImpl = async (_url, init) => {
    requestBody = JSON.parse(init.body);
    return Response.json({
      stop_reason: "end_turn",
      content: [{ type: "text", text: JSON.stringify(livePlan) }],
    });
  };

  const result = await generateMovementPlan(request, {
    env: {
      LLM_PROVIDER: "anthropic",
      ANTHROPIC_API_KEY: "test-anthropic",
    },
    fetchImpl,
  });

  assert.equal(result.provider, "anthropic");
  assert.equal(requestBody.model, "claude-sonnet-5");
  assert.equal(requestBody.output_config.format.type, "json_schema");
  assert.deepEqual(
    requestBody.output_config.format.schema,
    MOVEMENT_PLAN_JSON_SCHEMA,
  );
});

function visitSchema(value, visitor) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return;

  for (const [key, child] of Object.entries(value)) {
    visitor(key);
    if (key === "properties") {
      for (const schema of Object.values(child)) visitSchema(schema, visitor);
    } else if (key === "items") {
      visitSchema(child, visitor);
    }
  }
}
