import {
  dependencyFailureCategory,
  jsonError,
  rejectCrossSiteRequest,
  reportDependencyDiagnostic,
  requestIdFor,
  responseHeaders,
} from "@/lib/http/responses";

const DEFAULT_VOICE_ID = "JBFqnCBsd6RMkjVDRZzb";
const MAX_TEXT_LENGTH = 450;

export async function POST(request: Request) {
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
      "Request body must be JSON.",
      requestId,
    );
  }

  const text =
    body &&
    typeof body === "object" &&
    "text" in body &&
    typeof body.text === "string"
      ? body.text.trim()
      : "";
  if (!text || Array.from(text).length > MAX_TEXT_LENGTH) {
    return jsonError(
      400,
      "INVALID_REQUEST",
      `text must be a string of 1–${MAX_TEXT_LENGTH} characters.`,
      requestId,
    );
  }

  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  if (!apiKey) {
    reportDependencyDiagnostic({
      requestId,
      provider: "elevenlabs",
      category: "unconfigured",
      status: "browser-fallback",
    });
    return new Response(null, {
      status: 204,
      headers: responseHeaders(requestId, {
        "X-MoveMail-Voice": "browser-fallback",
      }),
    });
  }

  const voiceId =
    process.env.ELEVENLABS_VOICE_ID?.trim() || DEFAULT_VOICE_ID;
  const modelId =
    process.env.ELEVENLABS_MODEL?.trim() || "eleven_flash_v2_5";

  try {
    const upstream = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          Accept: "audio/mpeg",
          "Content-Type": "application/json",
          "xi-api-key": apiKey,
        },
        body: JSON.stringify({
          text,
          model_id: modelId,
          voice_settings: {
            stability: 0.62,
            similarity_boost: 0.72,
            style: 0,
            use_speaker_boost: true,
            speed: 0.9,
          },
        }),
        signal: AbortSignal.timeout(5_500),
      },
    );

    if (!upstream.ok || !upstream.body) {
      reportDependencyDiagnostic({
        requestId,
        provider: "elevenlabs",
        category: upstream.ok ? "empty-response" : "upstream-response",
        status: upstream.ok ? "browser-fallback" : upstream.status,
      });
      return new Response(null, {
        status: 204,
        headers: responseHeaders(requestId, {
          "X-MoveMail-Voice": "browser-fallback",
        }),
      });
    }

    return new Response(upstream.body, {
      status: 200,
      headers: responseHeaders(requestId, {
        "Content-Type": upstream.headers.get("Content-Type") || "audio/mpeg",
        "X-MoveMail-Voice": "elevenlabs",
      }),
    });
  } catch (error) {
    reportDependencyDiagnostic({
      requestId,
      provider: "elevenlabs",
      category: dependencyFailureCategory(error),
      status: "browser-fallback",
    });
    return new Response(null, {
      status: 204,
      headers: responseHeaders(requestId, {
        "X-MoveMail-Voice": "browser-fallback",
      }),
    });
  }
}
