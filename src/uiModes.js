/**
 * Lite and Expert are two interaction models, not two skins.
 *
 * - Lite narrows the collection with filters. A brush is a range on a
 *   dimension, listed as a removable chip and kept drawn on its chart; several
 *   brushes on one axis, or several rectangles on one scatterplot, are OR-ed
 *   into one chip. Zoom and exclude turn the current result into a chip as
 *   well.
 * - Expert keeps expressive selection: set operations, zoom and exclude on
 *   the selection, layout editing, and the inspection controls.
 *
 * Components ask `can(feature)` rather than testing the mode, so what each
 * mode offers is decided here and nowhere else.
 */
export const UI_MODES = Object.freeze({ LITE: "lite", EXPERT: "expert" });

// feature: [lite, expert]
const FEATURES = {
  // Replace/Add/Subtract/Toggle/Intersect, number keys, Shift/Ctrl quasimodes.
  selectionOperations: [false, true],
  // In Lite, inverting turns the current result into "everything else".
  invertSelection: [true, true],
  zoomAndExclude: [true, true],
  layoutEditing: [false, true],
  lassoBrush: [false, true],
  // Several brushes on one chart, OR-ed: rectangles on the scatterplot,
  // ranges along an axis. Expert brushes once and combines with operations.
  multiBrush: [true, false],
  // Checkboxes and rubber-band selection on gallery thumbnails.
  gallerySelection: [false, true],
  // Selecting/unselecting in the gallery narrows the results; unselected
  // options stay in the gallery, dimmed.
  galleryFiltering: [true, false],
  // Adding or removing the current selection to or from an existing set.
  setEditing: [false, true],
  // Pinning and the continuous-inspection toggle.
  inspectionControls: [false, true],
  // The clusters panel beside the scatterplot.
  clustering: [false, true],
  // Clicking a point or line inspects it. In both modes hovering inspects only
  // while Space is held.
  clickToInspect: [true, false],
};

// Lite is the default; only an explicit "expert" selects Expert.
export function normalizeMode(value) {
  return value === UI_MODES.EXPERT ? UI_MODES.EXPERT : UI_MODES.LITE;
}

export function canUse(mode, feature) {
  let entry = FEATURES[feature];
  if (!entry) {
    console.warn('Unknown UI feature "' + feature + '"');
    return false;
  }
  return entry[mode === UI_MODES.LITE ? 0 : 1];
}
