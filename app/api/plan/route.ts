import { parsePlanRequest } from "@/lib/ai/plan";
import { demoResult, generateMovementPlan } from "@/lib/ai/providers";
import {
  jsonError,
  jsonSuccess,
  rejectCrossSiteRequest,
  reportDependencyDiagnostic,
  requestIdFor,
} from "@/lib/http/responses";

export async function POST(request: Request): Promise<Response> {
  const requestId = requestIdFor(request);
  const crossSiteError = rejectCrossSiteRequest(request, requestId);
  if (crossSiteError) return crossSiteError;
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonError(
      400,
      "INVALID_JSON",
      "Request body must be valid JSON.",
      requestId,
    );
  }

  const parsed = parsePlanRequest(body);
  if (!parsed.success) {
    return jsonError(400, "INVALID_REQUEST", parsed.error, requestId);
  }

  try {
    const result = await generateMovementPlan(parsed.data, {
      onProviderFailure: ({ provider, category }) => {
        reportDependencyDiagnostic({
          requestId,
          provider,
          category,
          status: "trying-fallback",
        });
      },
    });
    if (result.mode === "demo") {
      reportDependencyDiagnostic({
        requestId,
        provider: "llm",
        category: "unconfigured-or-unavailable",
        status: "demo-fallback",
      });
    }
    return jsonSuccess(result, requestId);
  } catch {
    // Keep expected provider outages and malformed upstream responses away
    // from the live demo, without exposing provider details to the browser.
    reportDependencyDiagnostic({
      requestId,
      provider: "llm",
      category: "unexpected",
      status: "demo-fallback",
    });
    return jsonSuccess(demoResult(parsed.data), requestId);
  }
}
