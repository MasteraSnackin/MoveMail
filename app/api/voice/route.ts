const DEFAULT_VOICE_ID = "JBFqnCBsd6RMkjVDRZzb";
const MAX_TEXT_LENGTH = 450;

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be JSON." }, { status: 400 });
  }

  const text =
    body && typeof body === "object" && "text" in body
      ? String(body.text).trim()
      : "";
  if (!text || Array.from(text).length > MAX_TEXT_LENGTH) {
    return Response.json(
      { error: `text must be 1–${MAX_TEXT_LENGTH} characters.` },
      { status: 400 },
    );
  }

  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  if (!apiKey) {
    return new Response(null, {
      status: 204,
      headers: { "X-MoveMail-Voice": "browser-fallback" },
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
        signal: AbortSignal.timeout(7_500),
      },
    );

    if (!upstream.ok || !upstream.body) {
      return new Response(null, {
        status: 204,
        headers: { "X-MoveMail-Voice": "browser-fallback" },
      });
    }

    return new Response(upstream.body, {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": upstream.headers.get("Content-Type") || "audio/mpeg",
        "X-MoveMail-Voice": "elevenlabs",
      },
    });
  } catch {
    return new Response(null, {
      status: 204,
      headers: { "X-MoveMail-Voice": "browser-fallback" },
    });
  }
}
