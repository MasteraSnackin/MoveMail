import { parsePlanRequest } from "@/lib/ai/plan";
import { demoResult, generateMovementPlan } from "@/lib/ai/providers";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
} as const;

export async function POST(request: Request): Promise<Response> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "Request body must be valid JSON." },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  const parsed = parsePlanRequest(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  try {
    return Response.json(await generateMovementPlan(parsed.data), {
      status: 200,
      headers: NO_STORE_HEADERS,
    });
  } catch {
    // Keep expected provider outages and malformed upstream responses away
    // from the live demo, without exposing provider details to the browser.
    return Response.json(demoResult(parsed.data), {
      status: 200,
      headers: NO_STORE_HEADERS,
    });
  }
}
