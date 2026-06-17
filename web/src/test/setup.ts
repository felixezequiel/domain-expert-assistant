import "@testing-library/jest-dom/vitest";

// Pin the UI language to en-US for tests so the existing English assertions hold (en-US
// values are the verbatim original copy). Production defaults to pt-BR.
try {
  globalThis.localStorage?.setItem("lang", "en-US");
} catch {
  // localStorage may be unavailable; the config falls back to its default.
}

// Initialize i18n once (reading the pinned language above) so components calling
// useTranslation get real strings, not raw keys. Dynamic import so it runs AFTER the pin
// (static imports are hoisted).
await import("../i18n/index.ts");

// jsdom lacks a few browser APIs that Radix/cmdk touch on mount. Stub them so component
// tests don't crash on layout-measurement effects (no behavioural assertions depend on them).
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

if (!("ResizeObserver" in globalThis)) {
  (globalThis as { ResizeObserver?: unknown }).ResizeObserver = ResizeObserverStub;
}

if (typeof Element !== "undefined" && typeof Element.prototype.scrollIntoView !== "function") {
  Element.prototype.scrollIntoView = function scrollIntoView(): void {};
}
