/*
 * Whether the saved sets are docked as a column at the workspace's left
 * edge, and how wide that column is. A preference, kept in localStorage for
 * every dataset: someone who wants the sets in sight wants them in sight
 * whatever they open.
 *
 * Docked, the sets take their width from the panels beside them rather than
 * lying over them as the drawer does; see SetsDrawer.vue.
 */

export const SETS_DOCK_KEY = "designsense-sets-dock-v1";

// Narrow enough to leave the panels most of a laptop screen, wide enough
// for a set's name, its count and its delete button on one line.
export const DOCK_MIN_WIDTH = 200;
export const DOCK_MAX_WIDTH = 480;
export const DOCK_DEFAULT_WIDTH = 240;

export const DEFAULT_SETS_DOCK = Object.freeze({
  docked: false,
  width: DOCK_DEFAULT_WIDTH,
});

/** A whole number of pixels within the column's limits; anything else is the default. */
export function clampDockWidth(width) {
  let value = Number(width);
  if (!Number.isFinite(value)) return DOCK_DEFAULT_WIDTH;
  return Math.round(Math.min(DOCK_MAX_WIDTH, Math.max(DOCK_MIN_WIDTH, value)));
}

/** The saved choice over the defaults; anything unreadable is left at its default. */
export function parseSetsDock(text) {
  let dock = Object.assign({}, DEFAULT_SETS_DOCK);
  let parsed = null;
  try {
    parsed = typeof text === "string" && text ? JSON.parse(text) : null;
  } catch (e) {
    parsed = null;
  }
  if (parsed && typeof parsed === "object") {
    if (typeof parsed.docked === "boolean") dock.docked = parsed.docked;
    if (parsed.width !== undefined) dock.width = clampDockWidth(parsed.width);
  }
  return dock;
}

export function loadSetsDock() {
  try {
    return parseSetsDock(localStorage.getItem(SETS_DOCK_KEY));
  } catch (e) {
    return Object.assign({}, DEFAULT_SETS_DOCK);
  }
}

export function saveSetsDock(dock) {
  try {
    localStorage.setItem(
      SETS_DOCK_KEY,
      JSON.stringify({ docked: !!dock.docked, width: clampDockWidth(dock.width) })
    );
  } catch (e) {
    /* kept until the page is reloaded */
  }
}
