/**
 * A pure active-time clock for the one-minute MoveMail unlock.
 *
 * Calling pause() accounts for time up to the pause boundary. Time between a
 * pause and the next start() call is excluded, so breaks and hidden tabs do not
 * unlock a postcard.
 */

export function createActiveSessionClock(durationMs = 60_000) {
  const safeDuration = Math.max(1, Number(durationMs) || 60_000);
  let elapsedMs = 0;
  let lastTimestamp = null;
  let running = false;
  let complete = false;

  function snapshot() {
    return Object.freeze({
      durationMs: safeDuration,
      elapsedMs,
      remainingMs: Math.max(0, safeDuration - elapsedMs),
      progress: Math.min(1, elapsedMs / safeDuration),
      running,
      complete,
    });
  }

  function start(timestamp) {
    if (complete || running) {
      return snapshot();
    }
    running = true;
    lastTimestamp = Number(timestamp);
    return snapshot();
  }

  function advance(timestamp) {
    if (!running || complete) {
      return snapshot();
    }

    const current = Number(timestamp);
    const delta =
      Number.isFinite(current) && Number.isFinite(lastTimestamp)
        ? Math.max(0, current - lastTimestamp)
        : 0;
    elapsedMs = Math.min(safeDuration, elapsedMs + delta);
    lastTimestamp = current;

    if (elapsedMs >= safeDuration) {
      complete = true;
      running = false;
      lastTimestamp = null;
    }
    return snapshot();
  }

  function pause(timestamp) {
    if (running) {
      advance(timestamp);
    }
    running = false;
    lastTimestamp = null;
    return snapshot();
  }

  function reset() {
    elapsedMs = 0;
    lastTimestamp = null;
    running = false;
    complete = false;
    return snapshot();
  }

  return Object.freeze({
    advance,
    pause,
    reset,
    snapshot,
    start,
  });
}
