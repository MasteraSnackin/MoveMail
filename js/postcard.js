/**
 * One local MoveMail postcard.
 *
 * The standalone MVP cannot deliver a postcard to another device. It stores
 * only the current, explicitly entered postcard in this browser so a family
 * member can prepare it and hand the device to the recipient.
 */

const POSTCARD_KEY = "moveMail.postcard.v1";
const MAX_NAME_LENGTH = 40;
const MAX_MESSAGE_LENGTH = 280;

export const SAMPLE_POSTCARD = Object.freeze({
  id: "sample-postcard",
  recipient: "You",
  sender: "Your family",
  message:
    "Thinking of you today. I hope this little movement break brings a smile. Sending lots of love.",
  createdAt: "2026-01-01T00:00:00.000Z",
  unlocked: false,
  isSample: true,
});

function availableStorage() {
  try {
    return typeof globalThis === "undefined" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}

function cleanSingleLine(value, maximum) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maximum);
}

function cleanMessage(value) {
  return String(value ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/[^\S\n]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, MAX_MESSAGE_LENGTH);
}

function validDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function createId() {
  try {
    if (globalThis.crypto?.randomUUID) {
      return globalThis.crypto.randomUUID();
    }
  } catch {
    // A timestamp fallback is sufficient for a single local demo postcard.
  }
  return `postcard-${Date.now()}`;
}

export function sanitisePostcard(postcard, { allowDefaults = false } = {}) {
  if (!postcard || typeof postcard !== "object" || Array.isArray(postcard)) {
    return null;
  }

  const recipient = cleanSingleLine(postcard.recipient, MAX_NAME_LENGTH);
  const sender = cleanSingleLine(postcard.sender, MAX_NAME_LENGTH);
  const message = cleanMessage(postcard.message);
  const createdAt =
    validDate(postcard.createdAt) ||
    (allowDefaults ? new Date().toISOString() : null);
  const id =
    cleanSingleLine(postcard.id, 80) || (allowDefaults ? createId() : "");

  if (!recipient || !sender || !message || !createdAt || !id) {
    return null;
  }

  return {
    id,
    recipient,
    sender,
    message,
    createdAt,
    unlocked: postcard.unlocked === true,
    isSample: postcard.isSample === true,
  };
}

export function createPostcard(postcard) {
  return sanitisePostcard(postcard, { allowDefaults: true });
}

export function loadPostcard() {
  const storage = availableStorage();
  if (!storage) {
    return null;
  }

  try {
    const value = storage.getItem(POSTCARD_KEY);
    return value ? sanitisePostcard(JSON.parse(value)) : null;
  } catch {
    return null;
  }
}

export function savePostcard(postcard) {
  const storage = availableStorage();
  const safePostcard = sanitisePostcard(postcard, { allowDefaults: true });
  if (!storage || !safePostcard || safePostcard.isSample) {
    return false;
  }

  try {
    storage.setItem(POSTCARD_KEY, JSON.stringify(safePostcard));
    return true;
  } catch {
    return false;
  }
}

export function deletePostcard() {
  const storage = availableStorage();
  if (!storage) {
    return false;
  }

  try {
    storage.removeItem(POSTCARD_KEY);
    return true;
  } catch {
    return false;
  }
}

export const POSTCARD_LIMITS = Object.freeze({
  name: MAX_NAME_LENGTH,
  message: MAX_MESSAGE_LENGTH,
});
