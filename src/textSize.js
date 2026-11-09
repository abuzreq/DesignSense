/*
 * The reader's text size: one scale for every step of the type scale (the
 * --ds-fs-* tokens in App.vue), and for the root size Vuetify's own text is
 * measured in. A preference, kept in localStorage for every dataset, and
 * chosen on the welcome screen.
 *
 * Bigger only: the interface was laid out at 100%, and smaller would
 * squeeze it. What becomes an image or a PDF keeps its own fixed sizes.
 */

export const TEXT_SIZE_KEY = "designsense-text-size-v1";

export const TEXT_SIZES = Object.freeze([
  Object.freeze({ id: "default", label: "Default", scale: 1 }),
  Object.freeze({ id: "large", label: "Large", scale: 1.15 }),
  Object.freeze({ id: "larger", label: "Larger", scale: 1.3 }),
  Object.freeze({ id: "largest", label: "Largest", scale: 1.5 }),
]);

export const DEFAULT_TEXT_SIZE = "default";

/** A known size's id, else the default. */
export function parseTextSize(value) {
  return TEXT_SIZES.some((size) => size.id === value) ? value : DEFAULT_TEXT_SIZE;
}

/** The scale for a size's id, 1 for anything unknown. */
export function scaleOf(id) {
  let size = TEXT_SIZES.find((s) => s.id === id);
  return size ? size.scale : 1;
}

export function loadTextSize() {
  try {
    return parseTextSize(localStorage.getItem(TEXT_SIZE_KEY));
  } catch (e) {
    return DEFAULT_TEXT_SIZE;
  }
}

export function saveTextSize(id) {
  try {
    localStorage.setItem(TEXT_SIZE_KEY, parseTextSize(id));
  } catch (e) {
    /* kept until the page is reloaded */
  }
}

// The scale in use, for the few sizes set in code (see textPx).
let current = 1;

/** Puts a size into effect: the tokens' scale on the page's root. */
export function applyTextSize(id) {
  current = scaleOf(parseTextSize(id));
  if (typeof document !== "undefined" && document.documentElement) {
    document.documentElement.style.setProperty("--ds-text-scale", String(current));
  }
  return current;
}

/**
 * A size set in code -- a chart's label drawn by d3 -- at the reader's
 * scale, in whole pixels. Charts redraw when the size changes (see
 * TemplateView), so they read it again then.
 */
export function textPx(px) {
  return Math.round(px * current);
}
