const REQUEST_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{7,99}$/;

export type DependencyDiagnostic = {
  requestId: string;
  provider: "llm" | "openai" | "anthropic" | "supabase" | "elevenlabs";
  category: string;
  status: string | number;
};

export function requestIdFor(request: Request): string {
  const supplied = request.headers.get("X-Request-Id")?.trim();
  return supplied && REQUEST_ID_PATTERN.test(supplied)
    ? supplied
    : crypto.randomUUID();
}

export function responseHeaders(
  requestId: string,
  additional?: HeadersInit,
): Headers {
  const headers = new Headers(additional);
  headers.set("Cache-Control", "no-store, max-age=0");
  headers.set("X-Request-Id", requestId);
  return headers;
}

export function jsonSuccess<T extends Record<string, unknown>>(
  payload: T,
  requestId: string,
  status = 200,
): Response {
  return Response.json(
    {
      ...payload,
      ok: true,
      requestId,
    },
    {
      status,
      headers: responseHeaders(requestId),
    },
  );
}

export function jsonError(
  status: number,
  code: string,
  message: string,
  requestId: string,
  details?: Record<string, unknown>,
): Response {
  return Response.json(
    {
      ok: false,
      error: {
        code,
        message,
        ...(details ? { details } : {}),
        requestId,
      },
    },
    {
      status,
      headers: responseHeaders(requestId),
    },
  );
}

export function rejectCrossSiteRequest(
  request: Request,
  requestId: string,
): Response | null {
  const fetchSite = request.headers.get("Sec-Fetch-Site");
  const origin = request.headers.get("Origin");
  const expectedOrigin = new URL(request.url).origin;
  if (
    fetchSite === "cross-site" ||
    (origin && origin !== "null" && origin !== expectedOrigin)
  ) {
    return jsonError(
      403,
      "CROSS_SITE_REQUEST",
      "This endpoint only accepts requests from MoveMail.",
      requestId,
    );
  }
  return null;
}

export function dependencyFailureCategory(error: unknown): string {
  if (
    error &&
    typeof error === "object" &&
    "name" in error &&
    (error.name === "AbortError" || error.name === "TimeoutError")
  ) {
    return "timeout";
  }
  return "request-failed";
}

export function reportDependencyDiagnostic(
  diagnostic: DependencyDiagnostic,
): void {
  console.warn(JSON.stringify(diagnostic));
}
