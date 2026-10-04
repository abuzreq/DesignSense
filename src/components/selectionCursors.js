import { operations } from "@/components/operations.js";

/**
 * The pointer over a chart that can be brushed, drawn here rather than left
 * to the window system.
 *
 * CSS `crosshair` is a one-pixel black cross drawn at whatever size the
 * window system keeps for it, and over a white plot ruled with gridlines of
 * about the same weight the pointer is simply lost. This one is wider, has a
 * white edge so it holds against a dark ground as well as a light one, and
 * is open across the middle so the point being aimed at stays in sight.
 *
 * In Expert the active operation decides what a brush does, so it is shown
 * at the pointer, where the gesture happens, instead of only in the toolbar.
 * Replace adds no badge, and so is the plain crosshair.
 *
 * Everything is drawn in a 32px square: the cross about (10, 10), which is
 * the hotspot, and the badge clear of its arms at (22.5, 22.5).
 */
const SIZE = 32;
const HOTSPOT = [10, 10];
// Four arms about the hotspot, parted over the middle four pixels. They stop
// two pixels inside the square so the white edge's round ends are not cut off.
const CROSS = "M10 2v6M10 12v6M2 10h6M12 10h6";

const GLYPHS = {
  [operations.ADD]: "<path d='M18.5 22.5h8M22.5 18.5v8'/>",
  [operations.SUBTRACT]: "<path d='M18.5 22.5h8'/>",
  [operations.INTERSECT]: "<path d='M19 26v-3.5a3.5 3.5 0 0 1 7 0v3.5'/>",
  // The filled half has no stroke of its own, which would widen it off centre.
  [operations.TOGGLE]:
    "<circle cx='22.5' cy='22.5' r='4'/>" +
    "<path d='M22.5 18.5a4 4 0 0 1 0 8z' fill='white' stroke='none'/>",
};

function cursor(badge) {
  let svg =
    "<svg xmlns='http://www.w3.org/2000/svg' width='" +
    SIZE +
    "' height='" +
    SIZE +
    "'>" +
    "<path d='" +
    CROSS +
    "' stroke='white' stroke-width='4' stroke-linecap='round'/>" +
    "<path d='" +
    CROSS +
    "' stroke='#111' stroke-width='1.75' stroke-linecap='round'/>" +
    (badge || "") +
    "</svg>";
  // The system crosshair after it, for anywhere the data url is refused.
  return (
    'url("data:image/svg+xml,' +
    encodeURIComponent(svg) +
    '") ' +
    HOTSPOT[0] +
    " " +
    HOTSPOT[1] +
    ", crosshair"
  );
}

/** The pointer over a plot, with no operation riding on it. */
export const PLOT_CROSSHAIR = cursor(null);

function cursorFor(operation) {
  let glyph = GLYPHS[operation];
  if (!glyph) return null;
  return cursor(
    "<circle cx='22.5' cy='22.5' r='8.5' fill='#1565c0' stroke='white' stroke-width='1.5'/>" +
    "<g stroke='white' stroke-width='2' fill='none' stroke-linecap='round'>" +
      glyph +
      "</g>"
  );
}

/** Pass a null operation to restore the default cursor. */
export function applySelectionCursor(el, operation) {
  let cursor = operation ? cursorFor(operation) : null;
  if (cursor) {
    el.style.setProperty("--ds-selection-cursor", cursor);
    el.setAttribute("data-selection-op", operation);
  } else {
    el.style.removeProperty("--ds-selection-cursor");
    el.removeAttribute("data-selection-op");
  }
}
