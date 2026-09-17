const LAYOUT_STORAGE_KEY = "designsense-layouts-v2";

/**
 * Panels sit on a grid of LAYOUT_COLUMNS x LAYOUT_ROWS cells that is stretched
 * over the workspace, so a layout fills any screen and keeps its proportions
 * when the window is resized.
 */
export const LAYOUT_COLUMNS = 48;
export const LAYOUT_ROWS = 24;

/** Height of the header at the top of each panel (see PanelHeader.vue). */
export const PANEL_HEADER_HEIGHT = 40;

function defaultLayouts(viewportWidth) {
  var w =
    viewportWidth ||
    (typeof window !== "undefined" ? window.innerWidth : 1920);
  // Narrow screens give the sets list a larger share so its cards stay readable.
  var setsW = w < 1600 ? 8 : 6;
  var chartsW = 22;
  var galleryW = LAYOUT_COLUMNS - setsW - chartsW;
  var chartsX = setsW + galleryW;
  var half = LAYOUT_ROWS / 2;
  return [
    { type: "ParallelCoordinatesPlot", x: chartsX, y: 0, w: chartsW, h: half },
    { type: "ScatterPlot", x: chartsX, y: half, w: chartsW, h: half },
    { type: "Grid", x: setsW, y: 0, w: galleryW, h: LAYOUT_ROWS },
    { type: "Sets", x: 0, y: 0, w: setsW, h: LAYOUT_ROWS },
  ];
}

function isValidLayouts(parsed) {
  if (!Array.isArray(parsed) || parsed.length === 0) return false;
  return parsed.every(function (p) {
    return (
      p &&
      typeof p.type === "string" &&
      typeof p.x === "number" &&
      typeof p.y === "number" &&
      typeof p.w === "number" &&
      typeof p.h === "number" &&
      p.x >= 0 &&
      p.y >= 0 &&
      p.w > 0 &&
      p.h > 0 &&
      p.x + p.w <= LAYOUT_COLUMNS &&
      p.y + p.h <= LAYOUT_ROWS
    );
  });
}

export function loadLayouts() {
  try {
    var raw = localStorage.getItem(LAYOUT_STORAGE_KEY);
    if (raw) {
      var parsed = JSON.parse(raw);
      if (isValidLayouts(parsed)) return parsed;
    }
  } catch (e) {
    /* ignore quota / private-mode failures */
  }
  return defaultLayouts();
}

export function saveLayouts(layouts) {
  try {
    localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(layouts));
  } catch (e) {
    /* ignore */
  }
}

export { defaultLayouts };

export default defaultLayouts();
