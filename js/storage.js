/**
 * Minimal local session history.
 *
 * The serialised object is constructed explicitly so no accidental properties
 * (and no camera or pose data) can reach localStorage.
 */

const STORAGE_KEY = "moveMail.sessions.v1";
const LEGACY_STORAGE_KEY = "moveAndSmile.sessions.v1";
const MAX_SESSIONS = 10;
const VALID_MODES = new Set([
  "standing",
  "seated",
  "fingers",
  "preview",
]);

function availableStorage() {
  try {
    return typeof globalThis === "undefined" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}

function wholeNumber(value, maximum) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    return null;
  }
  return Math.min(maximum, Math.round(number));
}

function isoDate(value, allowDefault) {
  if ((value === undefined || value === null || value === "") && allowDefault) {
    return new Date().toISOString();
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function sanitise(session, allowDefaultDate = false) {
  if (!session || typeof session !== "object" || Array.isArray(session)) {
    return null;
  }

  const date = isoDate(session.date, allowDefaultDate);
  const mode = String(session.mode || "")
    .trim()
    .toLowerCase();
  const sessionDuration = wholeNumber(session.sessionDuration, 24 * 60 * 60);
  const completedMovements = wholeNumber(session.completedMovements, 10);
  const score = wholeNumber(session.score, 30);

  if (
    !date ||
    !VALID_MODES.has(mode) ||
    sessionDuration === null ||
    completedMovements === null ||
    score === null
  ) {
    return null;
  }

  return {
    date,
    mode,
    sessionDuration,
    completedMovements,
    score,
  };
}

/**
 * Return up to ten sessions, newest first. Invalid or unavailable storage
 * behaves like an empty history.
 */
export function get() {
  const storage = availableStorage();
  if (!storage) {
    return [];
  }

  try {
    const parsed = JSON.parse(
      storage.getItem(STORAGE_KEY) ||
        storage.getItem(LEGACY_STORAGE_KEY) ||
        "[]",
    );
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .map((session) => sanitise(session))
      .filter(Boolean)
      .slice(0, MAX_SESSIONS);
  } catch {
    return [];
  }
}

/**
 * Save a session and return whether persistence succeeded.
 * sessionDuration is stored as whole seconds.
 */
export function save(session) {
  const storage = availableStorage();
  const safeSession = sanitise(session, true);
  if (!storage || !safeSession) {
    return false;
  }

  try {
    const history = [safeSession, ...get()].slice(0, MAX_SESSIONS);
    storage.setItem(STORAGE_KEY, JSON.stringify(history));
    return true;
  } catch {
    return false;
  }
}

/**
 * Remove only MoveMail's session history, including the legacy key.
 */
export function clear() {
  const storage = availableStorage();
  if (!storage) {
    return false;
  }

  try {
    storage.removeItem(STORAGE_KEY);
    storage.removeItem(LEGACY_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}
