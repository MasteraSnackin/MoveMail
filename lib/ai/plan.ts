export const MOVEMENT_IDS = [
  "reach_left",
  "reach_right",
  "open_arms",
  "hands_together",
  "gentle_wave",
] as const;

export type MovementId = (typeof MOVEMENT_IDS)[number];

export type MovementPlanMove = {
  id: MovementId;
};

export type MovementPlan = {
  themeTitle: string;
  openingLine: string;
  moves: [
    MovementPlanMove,
    MovementPlanMove,
    MovementPlanMove,
  ];
  closingLine: string;
};

export type PlanRequest = {
  theme: string;
  message: string;
  to: string;
  from: string;
};

type ParseResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

const OUTPUT_LIMITS = {
  themeTitle: 80,
  openingLine: 180,
  closingLine: 180,
} as const;

export const PLAN_INPUT_LIMITS = {
  theme: 80,
  message: 600,
  to: 60,
  from: 60,
} as const;

/**
 * This intentionally uses only the JSON Schema subset shared by the OpenAI
 * and Anthropic structured-output APIs. More specific constraints are kept
 * in validateMovementPlan, which is authoritative for every provider.
 */
export const MOVEMENT_PLAN_JSON_SCHEMA = {
  type: "object",
  description:
    "A gentle seated movement postcard containing exactly three different moves.",
  additionalProperties: false,
  properties: {
    themeTitle: {
      type: "string",
      description: "A warm theme title of 1 to 80 characters.",
    },
    openingLine: {
      type: "string",
      description: "One concise opening line of 1 to 180 characters.",
    },
    moves: {
      type: "array",
      description:
        "Exactly three moves with different ids, in the order they should be played.",
      items: {
        type: "object",
        description: "One gentle seated upper-body movement.",
        additionalProperties: false,
        properties: {
          id: {
            type: "string",
            description: "The supported movement mechanic to play.",
            enum: MOVEMENT_IDS,
          },
        },
        required: ["id"],
      },
    },
    closingLine: {
      type: "string",
      description: "One concise closing line of 1 to 180 characters.",
    },
  },
  required: ["themeTitle", "openingLine", "moves", "closingLine"],
} as const;

const MEDICAL_CLAIM_PATTERNS = [
  /\b(?:diagnos(?:e|es|ed|ing|is)|rehabilitat(?:e|es|ed|ing|ion)|therap(?:y|ies|ist|eutic)|clinical(?:ly)?|medical(?:ly)?)\b/i,
  /\b(?:cure|cures|cured|curing|treat|treats|treated|treating|prevent|prevents|prevented|preventing)\b.{0,40}\b(?:condition|disease|illness|injury|symptom|pain|falls?)\b/i,
  /\b(?:improve|improves|improved|improving|boost|boosts|boosted|boosting|build|builds|building)\b.{0,40}\b(?:balance|mobility|memory|cognition|health|fitness|strength|flexibility|reaction|wellbeing)\b/i,
  /\b(?:reduce|reduces|reduced|reducing|lower|lowers|lowered|lowering)\b.{0,40}\b(?:risk|falls?|pain|symptoms?|stiffness)\b/i,
  /\b(?:good|better|beneficial)\s+for\s+(?:your\s+)?health\b/i,
  /\bkeeps?\s+you\s+healthy\b/i,
] as const;

const PLAN_KEYS = ["themeTitle", "openingLine", "moves", "closingLine"];
const MOVE_KEYS = ["id"];

export function parsePlanRequest(value: unknown): ParseResult<PlanRequest> {
  if (!isPlainRecord(value)) {
    return { success: false, error: "Request body must be a JSON object." };
  }

  for (const field of Object.keys(PLAN_INPUT_LIMITS) as Array<
    keyof typeof PLAN_INPUT_LIMITS
  >) {
    const candidate = value[field];
    if (candidate !== undefined && typeof candidate !== "string") {
      return { success: false, error: `${field} must be text.` };
    }

    if (
      typeof candidate === "string" &&
      codePointLength(candidate) > PLAN_INPUT_LIMITS[field]
    ) {
      return {
        success: false,
        error: `${field} must be ${PLAN_INPUT_LIMITS[field]} characters or fewer.`,
      };
    }
  }

  const message = cleanText(value.message);
  if (!message) {
    return { success: false, error: "message is required." };
  }

  return {
    success: true,
    data: {
      theme: cleanText(value.theme) || "A little moment together",
      message,
      to: cleanText(value.to),
      from: cleanText(value.from),
    },
  };
}

export function validateMovementPlan(
  value: unknown,
): ParseResult<MovementPlan> {
  if (!isPlainRecord(value) || !hasExactKeys(value, PLAN_KEYS)) {
    return { success: false, error: "Plan has unexpected fields." };
  }

  const themeTitle = validatePlanText(
    value.themeTitle,
    "themeTitle",
    OUTPUT_LIMITS.themeTitle,
  );
  if (!themeTitle.success) return themeTitle;

  const openingLine = validatePlanText(
    value.openingLine,
    "openingLine",
    OUTPUT_LIMITS.openingLine,
  );
  if (!openingLine.success) return openingLine;

  const closingLine = validatePlanText(
    value.closingLine,
    "closingLine",
    OUTPUT_LIMITS.closingLine,
  );
  if (!closingLine.success) return closingLine;

  if (!Array.isArray(value.moves) || value.moves.length !== 3) {
    return { success: false, error: "Plan must contain exactly three moves." };
  }

  const moves: MovementPlanMove[] = [];
  const usedIds = new Set<MovementId>();

  for (const [index, move] of value.moves.entries()) {
    if (!isPlainRecord(move) || !hasExactKeys(move, MOVE_KEYS)) {
      return {
        success: false,
        error: `Move ${index + 1} has unexpected fields.`,
      };
    }

    if (!isMovementId(move.id)) {
      return {
        success: false,
        error: `Move ${index + 1} has an unsupported id.`,
      };
    }

    if (usedIds.has(move.id)) {
      return {
        success: false,
        error: "Each move id must be different.",
      };
    }

    usedIds.add(move.id);
    moves.push({ id: move.id });
  }

  return {
    success: true,
    data: {
      themeTitle: themeTitle.data,
      openingLine: openingLine.data,
      moves: moves as MovementPlan["moves"],
      closingLine: closingLine.data,
    },
  };
}

export function createFallbackPlan(input: PlanRequest): MovementPlan {
  const searchable = `${input.theme} ${input.message}`.toLowerCase();

  if (containsAny(searchable, ["sea", "beach", "brighton", "coast", "shell"])) {
    return {
      themeTitle: "A Little Seaside Hello",
      openingLine:
        "Let’s make a seaside picture together, moving only as far as feels comfortable.",
      moves: [
        {
          id: "reach_left",
        },
        {
          id: "reach_right",
        },
        {
          id: "gentle_wave",
        },
      ],
      closingLine: "All done. Your seaside message is ready to open.",
    };
  }

  if (containsAny(searchable, ["garden", "flower", "park", "nature", "spring"])) {
    return {
      themeTitle: "A Garden Hello",
      openingLine:
        "Let’s bring a little garden scene to life with three gentle movements.",
      moves: [
        {
          id: "reach_left",
        },
        {
          id: "open_arms",
        },
        {
          id: "gentle_wave",
        },
      ],
      closingLine: "All done. Your garden message is ready to open.",
    };
  }

  if (
    containsAny(searchable, [
      "music",
      "song",
      "dance",
      "disco",
      "birthday",
      "celebrat",
    ])
  ) {
    return {
      themeTitle: "A Song Just for You",
      openingLine:
        "Let’s make a tiny celebration together with three gentle movements.",
      moves: [
        {
          id: "hands_together",
        },
        {
          id: "open_arms",
        },
        {
          id: "gentle_wave",
        },
      ],
      closingLine: "All done. Your special message is ready to open.",
    };
  }

  return {
    themeTitle: "A Little Hello",
    openingLine:
      "Let’s bring this postcard to life with three gentle movements.",
    moves: [
      {
        id: "reach_left",
      },
      {
        id: "reach_right",
      },
      {
        id: "gentle_wave",
      },
    ],
    closingLine: "All done. Your message is ready to open.",
  };
}

function validatePlanText(
  value: unknown,
  field: string,
  maxLength: number,
): ParseResult<string> {
  if (typeof value !== "string") {
    return { success: false, error: `${field} must be text.` };
  }

  const cleaned = cleanText(value);
  if (!cleaned || codePointLength(cleaned) > maxLength) {
    return {
      success: false,
      error: `${field} must be between 1 and ${maxLength} characters.`,
    };
  }

  if (MEDICAL_CLAIM_PATTERNS.some((pattern) => pattern.test(cleaned))) {
    return {
      success: false,
      error: `${field} contains a medical or health claim.`,
    };
  }

  return { success: true, data: cleaned };
}

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function codePointLength(value: string): number {
  return Array.from(value).length;
}

function isMovementId(value: unknown): value is MovementId {
  return (
    typeof value === "string" &&
    (MOVEMENT_IDS as readonly string[]).includes(value)
  );
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function hasExactKeys(
  value: Record<string, unknown>,
  expectedKeys: readonly string[],
): boolean {
  const keys = Object.keys(value);
  return (
    keys.length === expectedKeys.length &&
    expectedKeys.every((key) => Object.hasOwn(value, key))
  );
}

function containsAny(value: string, fragments: readonly string[]): boolean {
  return fragments.some((fragment) => value.includes(fragment));
}
