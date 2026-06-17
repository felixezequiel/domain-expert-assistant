import "@testing-library/jest-dom/vitest";

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
