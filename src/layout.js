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

// The saved sets are not a panel: they live in a drawer at the workspace's
// left edge (SetsDrawer.vue), so every arrangement gives the grid to the
// gallery and the charts.
function defaultLayouts() {
  var chartsW = 22;
  var galleryW = LAYOUT_COLUMNS - chartsW;
  var half = LAYOUT_ROWS / 2;
  return [
    { type: "ParallelCoordinatesPlot", x: galleryW, y: 0, w: chartsW, h: half },
    { type: "ScatterPlot", x: galleryW, y: half, w: chartsW, h: half },
    { type: "Grid", x: 0, y: 0, w: galleryW, h: LAYOUT_ROWS },
  ];
}

/**
 * Ready-made arrangements, offered when layout editing starts. Each one keeps
 * the same panels; they differ in what gets the room.
 */
export const LAYOUT_PRESETS = [
  {
    id: "balanced",
    name: "Balanced",
    description: "Gallery on the left, both charts stacked on the right.",
    build: defaultLayouts,
  },
  {
    id: "gallery",
    name: "Gallery first",
    description: "A wide gallery for browsing images, with narrow charts.",
    build: function () {
      var chartsW = 14;
      var half = LAYOUT_ROWS / 2;
      return [
        {
          type: "Grid",
          x: 0,
          y: 0,
          w: LAYOUT_COLUMNS - chartsW,
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
    build: function () {
      var half = LAYOUT_COLUMNS / 2;
      var topH = 11;
      return [
        {
          type: "ParallelCoordinatesPlot",
          x: 0,
          y: 0,
          w: LAYOUT_COLUMNS,
          h: topH,
        },
        {
          type: "ScatterPlot",
          x: 0,
          y: topH,
          w: half,
          h: LAYOUT_ROWS - topH,
        },
        {
          type: "Grid",
          x: half,
          y: topH,
          w: half,
          h: LAYOUT_ROWS - topH,
        },
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

/**
 * A layout saved while the sets were still a panel. Their columns go to the
 * panels that began at their right edge (or, with none there, ended at their
 * left), which turns every old preset into its new form and keeps an
 * arrangement of one's own whole.
 */
function withoutSetsPanel(layouts) {
  var sets = layouts.find(function (p) {
    return p.type === "Sets";
  });
  if (!sets) return layouts;
  var rest = layouts.filter(function (p) {
    return p !== sets;
  });
  var besideRows = function (p) {
    return p.y < sets.y + sets.h && p.y + p.h > sets.y;
  };
  var right = rest.filter(function (p) {
    return besideRows(p) && p.x === sets.x + sets.w;
  });
  if (right.length > 0) {
    right.forEach(function (p) {
      p.x = sets.x;
      p.w += sets.w;
    });
  } else {
    rest.forEach(function (p) {
      if (besideRows(p) && p.x + p.w === sets.x) p.w += sets.w;
    });
  }
  return rest;
}

export function loadLayouts() {
  try {
    var raw = localStorage.getItem(LAYOUT_STORAGE_KEY);
    if (raw) {
      var parsed = JSON.parse(raw);
      if (isValidLayouts(parsed)) {
        var layouts = withoutSetsPanel(parsed);
        if (layouts !== parsed) saveLayouts(layouts);
        if (layouts.length > 0) return layouts;
      }
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
