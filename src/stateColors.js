/*
 * The four colours that say what state an option is in.
 *
 * Not the colours the data is drawn in -- those are Tableau's and live in
 * palettes.js, and which of them to use follows from the data. These four
 * are fixed, and each one means one thing wherever it appears: an option is
 * in the selection, is the one being inspected, is on the shortlist, or has
 * the keyboard.
 *
 * They were typed again in every component that needed them -- ten rules
 * for the selection blue alone, across the gallery, the clusters, the
 * scatterplot's canvas, the matrix and the SPLOM. Here once instead, in two
 * forms because they are needed in two places: the custom properties below
 * for stylesheets, and the exports for the handful of views that draw to a
 * canvas or build a stylesheet as a string.
 *
 * One source, not two: `applyStateColors` writes the exports onto the
 * document at startup (see main.js), so the CSS reads them back rather than
 * repeating them. The app already drives custom properties this way for
 * --ds-bar-height and the pointer cursors.
 *
 * Kept free of imports so anything can take it.
 */

/** In the current selection; also what a drag box is about to take in. */
export const SELECTED = "rgb(33, 119, 180)";
/** The one option the inspector is showing. */
export const INSPECTED = "#263238";
/** Kept aside on the shortlist. */
export const SHORTLIST = "#f57c00";
/** Where the keyboard is. */
export const FOCUS = "#1976d2";

const PROPERTIES = {
  "--ds-selected": SELECTED,
  "--ds-inspected": INSPECTED,
  "--ds-shortlist": SHORTLIST,
  "--ds-focus": FOCUS,
};

/**
 * Puts them where the stylesheets can read them. Called once on the document
 * element before the app mounts, so no rule ever sees an unset property.
 */
export function applyStateColors(element) {
  if (!element || !element.style) return;
  Object.keys(PROPERTIES).forEach(function (name) {
    element.style.setProperty(name, PROPERTIES[name]);
  });
}
