/**
 * Small accessibility helpers shared by the screen controller and gameplay.
 * All functions are safe to import in a non-browser test environment.
 */

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "summary",
  "[contenteditable='true']",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

const defaultAnnouncers = new Map();

function browserDocument() {
  return typeof document === "undefined" ? null : document;
}

function resolveElement(target, root = browserDocument()) {
  if (!target || !root) {
    return null;
  }
  if (typeof target !== "string") {
    return typeof target.focus === "function" ? target : null;
  }
  try {
    return root.querySelector(target);
  } catch {
    return null;
  }
}

function isAvailable(element) {
  if (!element || element.hidden || element.getAttribute("aria-hidden") === "true") {
    return false;
  }
  if ("disabled" in element && element.disabled) {
    return false;
  }
  const ownerWindow = element.ownerDocument?.defaultView;
  if (ownerWindow?.getComputedStyle) {
    const style = ownerWindow.getComputedStyle(element);
    if (style.display === "none" || style.visibility === "hidden") {
      return false;
    }
  }
  return true;
}

export function prefersReducedMotion() {
  try {
    return Boolean(
      typeof window !== "undefined" &&
        window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
    );
  } catch {
    return false;
  }
}

/**
 * Listen for reduced-motion preference changes. The current value is reported
 * immediately. The returned function removes the listener.
 */
export function watchReducedMotion(callback) {
  if (typeof callback !== "function") {
    return () => {};
  }

  let mediaQuery = null;
  try {
    mediaQuery =
      typeof window === "undefined"
        ? null
        : window.matchMedia?.("(prefers-reduced-motion: reduce)");
  } catch {
    mediaQuery = null;
  }

  callback(Boolean(mediaQuery?.matches));
  if (!mediaQuery) {
    return () => {};
  }

  const handleChange = (event) => callback(Boolean(event.matches));
  if (typeof mediaQuery.addEventListener === "function") {
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }

  mediaQuery.addListener?.(handleChange);
  return () => mediaQuery.removeListener?.(handleChange);
}

/**
 * Create a visually hidden live region.
 */
export function createAnnouncer({
  priority = "polite",
  clearAfter = 6000,
  parent,
} = {}) {
  const doc = browserDocument();
  if (!doc) {
    return Object.freeze({
      announce: () => false,
      clear: () => {},
      destroy: () => {},
      element: null,
    });
  }

  const politeness = priority === "assertive" ? "assertive" : "polite";
  const region = doc.createElement("div");
  region.setAttribute("aria-live", politeness);
  region.setAttribute("aria-atomic", "true");
  region.setAttribute("role", politeness === "assertive" ? "alert" : "status");
  region.dataset.moveMailAnnouncer = politeness;
  Object.assign(region.style, {
    position: "fixed",
    width: "1px",
    height: "1px",
    padding: "0",
    margin: "-1px",
    overflow: "hidden",
    clip: "rect(0, 0, 0, 0)",
    whiteSpace: "nowrap",
    border: "0",
  });
  (parent || doc.body || doc.documentElement).append(region);

  let announceTimer = null;
  let clearTimer = null;

  function clear() {
    if (announceTimer !== null) {
      clearTimeout(announceTimer);
      announceTimer = null;
    }
    if (clearTimer !== null) {
      clearTimeout(clearTimer);
      clearTimer = null;
    }
    region.textContent = "";
  }

  function announceMessage(message) {
    const text = String(message || "").trim();
    if (!text || !region.isConnected) {
      return false;
    }
    clear();
    // A short empty interval allows repeated messages to be announced again.
    announceTimer = setTimeout(() => {
      region.textContent = text;
      announceTimer = null;
      if (clearAfter > 0) {
        clearTimer = setTimeout(() => {
          region.textContent = "";
          clearTimer = null;
        }, clearAfter);
      }
    }, 30);
    return true;
  }

  function destroy() {
    clear();
    region.remove();
  }

  return Object.freeze({
    announce: announceMessage,
    clear,
    destroy,
    element: region,
  });
}

/**
 * Announce through a lazily created shared polite or assertive live region.
 */
export function announce(message, { priority = "polite" } = {}) {
  const politeness = priority === "assertive" ? "assertive" : "polite";
  if (!defaultAnnouncers.has(politeness)) {
    defaultAnnouncers.set(
      politeness,
      createAnnouncer({ priority: politeness }),
    );
  }
  return defaultAnnouncers.get(politeness).announce(message);
}

export function clearAnnouncements() {
  defaultAnnouncers.forEach((announcer) => announcer.destroy());
  defaultAnnouncers.clear();
}

/**
 * Focus a selector or element without throwing. Non-interactive headings and
 * screen containers receive a temporary tabindex so screen changes can be
 * announced in a predictable place.
 */
export function focusSafely(target, { preventScroll = true, root } = {}) {
  const element = resolveElement(target, root || browserDocument());
  if (!element || !isAvailable(element)) {
    return false;
  }

  const needsTemporaryTabIndex =
    element.tabIndex < 0 && !element.hasAttribute("tabindex");
  if (needsTemporaryTabIndex) {
    element.setAttribute("tabindex", "-1");
    element.addEventListener(
      "blur",
      () => element.removeAttribute("tabindex"),
      { once: true },
    );
  }

  try {
    element.focus({ preventScroll });
    return element.ownerDocument?.activeElement === element;
  } catch {
    try {
      element.focus();
      return true;
    } catch {
      return false;
    }
  }
}

export function getFocusableElements(container = browserDocument()) {
  if (!container?.querySelectorAll) {
    return [];
  }
  return [...container.querySelectorAll(FOCUSABLE_SELECTOR)].filter(
    isAvailable,
  );
}

export function focusFirst(container, options) {
  const [first] = getFocusableElements(container);
  return first ? focusSafely(first, options) : false;
}

/**
 * Keep Tab focus within a visible modal or pause panel.
 * The returned release function removes the trap and optionally restores focus.
 */
export function createFocusTrap(
  container,
  { onEscape, initialFocus = true, restoreFocus = true } = {},
) {
  const doc = browserDocument();
  const panel = resolveElement(container, doc);
  if (!doc || !panel) {
    return () => {};
  }

  const previousFocus = doc.activeElement;

  function handleKeydown(event) {
    if (event.key === "Escape" && typeof onEscape === "function") {
      event.preventDefault();
      onEscape(event);
      return;
    }
    if (event.key !== "Tab") {
      return;
    }

    const focusable = getFocusableElements(panel);
    if (focusable.length === 0) {
      event.preventDefault();
      focusSafely(panel);
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && doc.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && doc.activeElement === last) {
      event.preventDefault();
      first.focus();
    } else if (!panel.contains(doc.activeElement)) {
      event.preventDefault();
      first.focus();
    }
  }

  // Listen on the document so focus cannot escape through a control outside
  // the panel while the trap is active.
  doc.addEventListener("keydown", handleKeydown);
  if (initialFocus) {
    queueMicrotask(() => focusFirst(panel) || focusSafely(panel));
  }

  return function releaseFocusTrap() {
    doc.removeEventListener("keydown", handleKeydown);
    if (restoreFocus && previousFocus?.isConnected) {
      focusSafely(previousFocus);
    }
  };
}

export function isActivationKey(event) {
  return (
    Boolean(event) &&
    !event.repeat &&
    (event.key === "Enter" ||
      event.key === " " ||
      event.key === "Space" ||
      event.key === "Spacebar")
  );
}

/**
 * Add click plus Enter/Space activation to a custom control. Native buttons
 * keep their browser-provided keyboard behaviour and receive only the click
 * listener, avoiding double activation.
 */
export function bindKeyboardActivation(element, handler) {
  if (!element?.addEventListener || typeof handler !== "function") {
    return () => {};
  }

  const tagName = element.tagName?.toLowerCase();
  const isNativeControl =
    tagName === "button" ||
    (tagName === "a" && element.hasAttribute("href")) ||
    tagName === "input" ||
    tagName === "select" ||
    tagName === "textarea" ||
    tagName === "summary";

  const handleClick = (event) => handler(event);
  const handleKeydown = (event) => {
    if (!isActivationKey(event)) {
      return;
    }
    event.preventDefault();
    handler(event);
  };

  element.addEventListener("click", handleClick);
  if (!isNativeControl) {
    if (!element.hasAttribute("role")) {
      element.setAttribute("role", "button");
    }
    if (!element.hasAttribute("tabindex")) {
      element.setAttribute("tabindex", "0");
    }
    element.addEventListener("keydown", handleKeydown);
  }

  return () => {
    element.removeEventListener("click", handleClick);
    element.removeEventListener("keydown", handleKeydown);
  };
}
