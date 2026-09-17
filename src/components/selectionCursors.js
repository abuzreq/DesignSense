import { operations } from "@/components/operations.js";

/**
 * In Expert mode the active operation decides what a brush does, so it is
 * shown at the pointer, where the gesture happens, instead of only in the
 * toolbar. Replace keeps the plain crosshair.
 *
 * Glyphs are drawn around the badge centre (22.5, 22.5) of a 32px cursor.
 */
const GLYPHS = {
  [operations.ADD]: "<path d='M18.5 22.5h8M22.5 18.5v8'/>",
  [operations.SUBTRACT]: "<path d='M18.5 22.5h8'/>",
  [operations.INTERSECT]: "<path d='M19 26v-3.5a3.5 3.5 0 0 1 7 0v3.5'/>",
  // The filled half has no stroke of its own, which would widen it off centre.
  [operations.TOGGLE]:
    "<circle cx='22.5' cy='22.5' r='4'/>" +
    "<path d='M22.5 18.5a4 4 0 0 1 0 8z' fill='white' stroke='none'/>",
};

function cursorFor(operation) {
  let glyph = GLYPHS[operation];
  if (!glyph) return null;
  let svg =
    "<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32'>" +
    "<path d='M10 2v16M2 10h16' stroke='white' stroke-width='3.5' stroke-linecap='round'/>" +
    "<path d='M10 2v16M2 10h16' stroke='#111' stroke-width='1.25'/>" +
    "<circle cx='22.5' cy='22.5' r='8.5' fill='#1565c0' stroke='white' stroke-width='1.5'/>" +
    "<g stroke='white' stroke-width='2' fill='none' stroke-linecap='round'>" +
    glyph +
    "</g></svg>";
  return (
    'url("data:image/svg+xml,' +
    encodeURIComponent(svg) +
    '") 10 10, crosshair'
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
