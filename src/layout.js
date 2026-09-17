const LAYOUT_STORAGE_KEY = "designsense-layouts-v2";
const PRESET_STORAGE_KEY = "designsense-layout-preset-v1";

/**
 * Panels sit on a grid of LAYOUT_COLUMNS x LAYOUT_ROWS cells that is stretched
 * over the workspace, so a layout fills any screen and keeps its proportions
 * when the window is resized.
 */
export const LAYOUT_COLUMNS = 48;
export const LAYOUT_ROWS = 24;

/** Height of the header at the top of each panel (see PanelHeader.vue). */
export const PANEL_HEADER_HEIGHT = 40;

// Narrow screens give the sets list a larger share so its cards stay readable.
function setsWidth(viewportWidth) {
  var w =
    viewportWidth || (typeof window !== "undefined" ? window.innerWidth : 1920);
  return w < 1600 ? 8 : 6;
}

function defaultLayouts(viewportWidth) {
  var setsW = setsWidth(viewportWidth);
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

/**
 * Ready-made arrangements, offered when layout editing starts. Each one keeps
 * the same panels; they differ in what gets the room. `build` takes the
 * viewport width, as the default arrangement does.
 */
export const LAYOUT_PRESETS = [
  {
    id: "balanced",
    name: "Balanced",
    description: "Gallery in the middle, both charts stacked on the right.",
    build: defaultLayouts,
  },
  {
    id: "gallery",
    name: "Gallery first",
    description: "A wide gallery for browsing images, with narrow charts.",
    build: function (viewportWidth) {
      var setsW = setsWidth(viewportWidth);
      var chartsW = 14;
      var half = LAYOUT_ROWS / 2;
      return [
        { type: "Sets", x: 0, y: 0, w: setsW, h: LAYOUT_ROWS },
        {
          type: "Grid",
          x: setsW,
          y: 0,
          w: LAYOUT_COLUMNS - setsW - chartsW,
          h: LAYOUT_ROWS,
        },
        {
          type: "ParallelCoordinatesPlot",
          x: LAYOUT_COLUMNS - chartsW,
          y: 0,
          w: chartsW,
          h: half,
        },
        {
          type: "ScatterPlot",
          x: LAYOUT_COLUMNS - chartsW,
          y: half,
          w: chartsW,
          h: half,
        },
      ];
    },
  },
  {
    id: "charts",
    name: "Charts first",
    description:
      "Parallel coordinates across the top, the scatterplot and gallery below.",
    build: function (viewportWidth) {
      var setsW = setsWidth(viewportWidth);
      var rest = LAYOUT_COLUMNS - setsW;
      var topH = 11;
      return [
        { type: "Sets", x: 0, y: 0, w: setsW, h: LAYOUT_ROWS },
        {
          type: "ParallelCoordinatesPlot",
          x: setsW,
          y: 0,
          w: rest,
          h: topH,
        },
        {
          type: "ScatterPlot",
          x: setsW,
          y: topH,
          w: Math.round(rest / 2),
          h: LAYOUT_ROWS - topH,
        },
        {
          type: "Grid",
          x: setsW + Math.round(rest / 2),
          y: topH,
          w: rest - Math.round(rest / 2),
          h: LAYOUT_ROWS - topH,
        },
      ];
    },
  },
  {
    id: "compare",
    name: "Images and charts",
    description:
      "No sets panel: the gallery on the left, both charts on the right.",
    build: function () {
      var half = LAYOUT_COLUMNS / 2;
      var rows = LAYOUT_ROWS / 2;
      return [
        { type: "Grid", x: 0, y: 0, w: half, h: LAYOUT_ROWS },
        { type: "ParallelCoordinatesPlot", x: half, y: 0, w: half, h: rows },
        { type: "ScatterPlot", x: half, y: rows, w: half, h: rows },
      ];
    },
  },
];

/** The panels of a preset, or null when the id is unknown. */
export function presetLayouts(id, viewportWidth) {
  var preset = LAYOUT_PRESETS.find(function (p) {
    return p.id === id;
  });
  return preset ? preset.build(viewportWidth) : null;
}

/** The preset the layout on screen came from, or null once it was edited. */
export function loadPresetId() {
  try {
    var id = localStorage.getItem(PRESET_STORAGE_KEY);
    return presetLayouts(id) ? id : null;
  } catch (e) {
    return null;
  }
}

export function savePresetId(id) {
  try {
    if (id) localStorage.setItem(PRESET_STORAGE_KEY, id);
    else localStorage.removeItem(PRESET_STORAGE_KEY);
  } catch (e) {
    /* ignore */
  }
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
