const MOVEMENT_IDS = new Set([
  "reach_left",
  "reach_right",
  "open_arms",
  "hands_together",
  "gentle_wave",
]);
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type StoredPostcard = {
  toName: string;
  fromName: string;
  message: string;
  theme: "seaside" | "garden" | "dance";
  provider: "openai" | "anthropic" | "demo";
  plan: {
    title: string;
    opening: string;
    closing: string;
    movements: Array<{ id: string; label: string; cue: string }>;
  };
};

function cleanText(value: unknown, maximum: number) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text && Array.from(text).length <= maximum ? text : null;
}

function parsePostcard(value: unknown): StoredPostcard | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  const toName = cleanText(input.toName, 40);
  const fromName = cleanText(input.fromName, 40);
  const message = cleanText(input.message, 400);
  const theme =
    input.theme === "garden" || input.theme === "dance"
      ? input.theme
      : input.theme === "seaside"
        ? "seaside"
        : null;
  const provider =
    input.provider === "openai" || input.provider === "anthropic"
      ? input.provider
      : input.provider === "demo"
        ? "demo"
        : null;
  const rawPlan =
    input.plan && typeof input.plan === "object"
      ? (input.plan as Record<string, unknown>)
      : null;
  const title = cleanText(rawPlan?.title, 72);
  const opening = cleanText(rawPlan?.opening, 140);
  const closing = cleanText(rawPlan?.closing, 120);
  const rawMovements = Array.isArray(rawPlan?.movements)
    ? rawPlan.movements
    : null;
  if (
    !toName ||
    !fromName ||
    !message ||
    !theme ||
    !provider ||
    !title ||
    !opening ||
    !closing ||
    !rawMovements ||
    rawMovements.length !== 3
  ) {
    return null;
  }
  const movements = rawMovements.map((rawMovement) => {
    if (!rawMovement || typeof rawMovement !== "object") return null;
    const movement = rawMovement as Record<string, unknown>;
    const id =
      typeof movement.id === "string" && MOVEMENT_IDS.has(movement.id)
        ? movement.id
        : null;
    const label = cleanText(movement.label, 56);
    const cue = cleanText(movement.cue, 140);
    return id && label && cue ? { id, label, cue } : null;
  });
  if (
    movements.some((movement) => !movement) ||
    new Set(movements.map((movement) => movement?.id)).size !== 3
  ) {
    return null;
  }
  return {
    toName,
    fromName,
    message,
    theme,
    provider,
    plan: {
      title,
      opening,
      closing,
      movements: movements as StoredPostcard["plan"]["movements"],
    },
  };
}

function supabaseConfig() {
  const url = process.env.SUPABASE_URL?.trim().replace(/\/+$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  return url && key ? { url, key } : null;
}

function supabaseHeaders(key: string) {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

export async function POST(request: Request) {
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return Response.json({ error: "Request body must be JSON." }, { status: 400 });
  }
  const postcard = parsePostcard(input);
  if (!postcard) {
    return Response.json({ error: "Invalid postcard." }, { status: 400 });
  }
  const config = supabaseConfig();
  if (!config) {
    return Response.json({ id: null, mode: "encoded-link" });
  }

  try {
    const upstream = await fetch(
      `${config.url}/rest/v1/movement_postcards`,
      {
        method: "POST",
        headers: {
          ...supabaseHeaders(config.key),
          Prefer: "return=representation",
        },
        body: JSON.stringify({
          to_name: postcard.toName,
          from_name: postcard.fromName,
          message: postcard.message,
          theme: postcard.theme,
          plan: postcard.plan,
          provider: postcard.provider,
        }),
        signal: AbortSignal.timeout(5_000),
      },
    );
    if (!upstream.ok) {
      return Response.json({ id: null, mode: "encoded-link" });
    }
    const rows = (await upstream.json()) as Array<{ id?: unknown }>;
    const id = typeof rows[0]?.id === "string" ? rows[0].id : null;
    return Response.json({ id, mode: id ? "supabase" : "encoded-link" });
  } catch {
    return Response.json({ id: null, mode: "encoded-link" });
  }
}

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id") || "";
  if (!UUID_PATTERN.test(id)) {
    return Response.json({ error: "Postcard not found." }, { status: 404 });
  }
  const config = supabaseConfig();
  if (!config) {
    return Response.json({ error: "Postcard not found." }, { status: 404 });
  }

  try {
    const query =
      "select=to_name,from_name,message,theme,plan,provider&id=eq." +
      encodeURIComponent(id) +
      "&limit=1";
    const upstream = await fetch(
      `${config.url}/rest/v1/movement_postcards?${query}`,
      {
        headers: supabaseHeaders(config.key),
        signal: AbortSignal.timeout(5_000),
      },
    );
    if (!upstream.ok) {
      return Response.json({ error: "Postcard not found." }, { status: 404 });
    }
    const rows = (await upstream.json()) as Array<Record<string, unknown>>;
    const row = rows[0];
    if (!row) {
      return Response.json({ error: "Postcard not found." }, { status: 404 });
    }
    const postcard = parsePostcard({
      toName: row.to_name,
      fromName: row.from_name,
      message: row.message,
      theme: row.theme,
      plan: row.plan,
      provider: row.provider,
    });
    if (!postcard) {
      return Response.json({ error: "Postcard not found." }, { status: 404 });
    }
    return Response.json(
      { postcard, mode: "supabase" },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return Response.json({ error: "Postcard not found." }, { status: 404 });
  }
}
