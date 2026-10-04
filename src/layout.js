const LAYOUT_STORAGE_KEY = "designsense-layouts-v2";
const PRESET_STORAGE_KEY = "designsense-layout-preset-v1";
// Whether the welcome screen has already asked which arrangement is wanted.
const ASKED_STORAGE_KEY = "designsense-layout-asked-v1";

/**
 * Panels sit on a grid of LAYOUT_COLUMNS x LAYOUT_ROWS cells that is stretched
 * over the workspace, so a layout fills any screen and keeps its proportions
 * when the window is resized.
 */
export const LAYOUT_COLUMNS = 48;
export const LAYOUT_ROWS = 24;

// Short names for the panels, for the scale drawings of an arrangement.
export const PANEL_LABELS = {
  Grid: "Gallery",
  ScatterPlot: "Scatter",
  ParallelCoordinatesPlot: "PCP",
  SPLOM: "SPLOM",
};

/** Height of the header at the top of each panel (see PanelHeader.vue). */
export const PANEL_HEADER_HEIGHT = 40;

// The saved sets are not a panel: they live in a drawer at the workspace's
// left edge (SetsDrawer.vue), so every arrangement gives the grid to the
// gallery and the charts.
/**
 * The arrangement a new reader starts in, and the one Design Explorer uses:
 * one chart banded across the top, the images filling everything under it.
 * The scatterplot is left out; the Panels list puts it back.
 */
function explorerLayouts() {
  var chartH = 9;
  return [
    { type: "ParallelCoordinatesPlot", x: 0, y: 0, w: LAYOUT_COLUMNS, h: chartH },
    { type: "Grid", x: 0, y: chartH, w: LAYOUT_COLUMNS, h: LAYOUT_ROWS - chartH },
  ];
}

function balancedLayouts() {
  var chartsW = 22;
  var galleryW = LAYOUT_COLUMNS - chartsW;
  var half = LAYOUT_ROWS / 2;
  return [
    { type: "ParallelCoordinatesPlot", x: galleryW, y: 0, w: chartsW, h: half },
    { type: "ScatterPlot", x: galleryW, y: half, w: chartsW, h: half },
    { type: "Grid", x: 0, y: 0, w: galleryW, h: LAYOUT_ROWS },
  ];
}

// Where a layout starts, and what `resetLayouts` goes back to.
export const DEFAULT_PRESET_ID = "explorer";
var defaultLayouts = explorerLayouts;

/**
 * Ready-made arrangements, offered when layout editing starts. Each one keeps
 * the same panels; they differ in what gets the room.
 */
export const LAYOUT_PRESETS = [
  {
    id: "explorer",
    name: "Chart over gallery",
    description:
      "Parallel coordinates across the top, the gallery filling the rest.",
    build: explorerLayouts,
  },
  {
    id: "balanced",
    name: "Balanced",
    description: "Gallery on the left, both charts stacked on the right.",
    build: balancedLayouts,
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
      "Parallel coordinates across the top, the scatterplot beside the gallery.",
    build: function () {
      // Narrower than half, so this stays a chart-led arrangement rather than
      // a second copy of "Chart over gallery" with the images squeezed.
      var plotW = 18;
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
          w: plotW,
          h: LAYOUT_ROWS - topH,
        },
        {
          type: "Grid",
          x: plotW,
          y: topH,
          w: LAYOUT_COLUMNS - plotW,
          h: LAYOUT_ROWS - topH,
        },
      ];
    },
  },
];

/** The panels of a preset, or null when the id is unknown. */
export function presetLayouts(id) {
  var preset = LAYOUT_PRESETS.find(function (p) {
    return p.id === id;
  });
  return preset ? preset.build() : null;
}

/** Whether the welcome screen has already offered a choice of arrangement. */
export function loadLayoutAsked() {
  try {
    return localStorage.getItem(ASKED_STORAGE_KEY) === "1";
  } catch (e) {
    return false;
  }
}

export function saveLayoutAsked() {
  try {
    localStorage.setItem(ASKED_STORAGE_KEY, "1");
  } catch (e) {
    /* ignore */
  }
}

/** The preset the layout on screen came from, or null once it was edited. */
export function loadPresetId() {
  try {
    var id = localStorage.getItem(PRESET_STORAGE_KEY);
    if (presetLayouts(id)) return id;
    // Nothing has been arranged yet, so what is on screen is still the
    // arrangement we start from, and its button should say so.
    if (!localStorage.getItem(LAYOUT_STORAGE_KEY)) return DEFAULT_PRESET_ID;
    return null;
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

/*
 * Seams: the shared edges between panels, which can be dragged to give one
 * panel room at its neighbour's expense without entering layout editing.
 *
 * A seam is not a whole grid line. In the balanced arrangement the gallery
 * runs the full height, so the line between the two charts is only a seam
 * along the columns the charts occupy. So a seam is a maximal run of cells
 * along one line where no panel crosses it and panels meet on both sides.
 *
 * A panel is a rectangle, so resizing it changes every row it covers. A seam
 * may therefore only move panels that lie wholly within its run; anything
 * else would open a gap outside the seam.
 */

// How small a panel may be dragged, in cells. Not Card.vue's pixel minimums,
// which guard hand-resizing in editing mode only.
export const MIN_PANEL_CELLS = {
  default: { w: 8, h: 4 },
  ParallelCoordinatesPlot: { w: 12, h: 4 },
  ScatterPlot: { w: 8, h: 4 },
  Grid: { w: 8, h: 5 },
};

export function minCells(type) {
  return MIN_PANEL_CELLS[type] || MIN_PANEL_CELLS.default;
}

// A seam runs along one axis; these read a panel either way round, so the
// search below is written once instead of twice.
var ALONG = {
  v: {
    line: LAYOUT_COLUMNS,
    cross: LAYOUT_ROWS,
    start: function (p) { return p.x; },
    size: function (p) { return p.w; },
    crossStart: function (p) { return p.y; },
    crossSize: function (p) { return p.h; },
    least: function (p) { return minCells(p.type).w; },
  },
  h: {
    line: LAYOUT_ROWS,
    cross: LAYOUT_COLUMNS,
    start: function (p) { return p.y; },
    size: function (p) { return p.h; },
    crossStart: function (p) { return p.x; },
    crossSize: function (p) { return p.w; },
    least: function (p) { return minCells(p.type).h; },
  },
};

/** A seam for one run, or null when it could not be dragged anywhere. */
function makeSeam(layouts, axis, at, from, to) {
  var a = ALONG[axis];
  var touching = layouts.filter(function (p) {
    return (
      a.crossStart(p) < to &&
      a.crossStart(p) + a.crossSize(p) > from &&
      (a.start(p) + a.size(p) === at || a.start(p) === at)
    );
  });
  var contained = touching.every(function (p) {
    return a.crossStart(p) >= from && a.crossStart(p) + a.crossSize(p) <= to;
  });
  if (!contained) return null;
  var before = touching.filter(function (p) {
    return a.start(p) + a.size(p) === at;
  });
  var after = touching.filter(function (p) {
    return a.start(p) === at;
  });
  if (before.length === 0 || after.length === 0) return null;
  var min = -Infinity;
  var max = Infinity;
  before.forEach(function (p) {
    min = Math.max(min, a.start(p) + a.least(p));
  });
  after.forEach(function (p) {
    max = Math.min(max, a.start(p) + a.size(p) - a.least(p));
  });
  if (min > max) return null;
  return {
    id: axis + ":" + at + ":" + from + "-" + to,
    axis: axis,
    at: at,
    from: from,
    to: to,
    before: before.map(function (p) { return p.type; }),
    after: after.map(function (p) { return p.type; }),
    min: min,
    max: max,
  };
}

function seamsAlong(layouts, axis) {
  var a = ALONG[axis];
  var seams = [];
  for (var at = 1; at < a.line; at++) {
    var runStart = null;
    // One past the end, so a run reaching the last cell is closed too.
    for (var c = 0; c <= a.cross; c++) {
      var open = false;
      if (c < a.cross) {
        var covers = layouts.filter(function (p) {
          return a.crossStart(p) <= c && a.crossStart(p) + a.crossSize(p) > c;
        });
        var crosses = covers.some(function (p) {
          return a.start(p) < at && a.start(p) + a.size(p) > at;
        });
        var ends = covers.some(function (p) {
          return a.start(p) + a.size(p) === at;
        });
        var begins = covers.some(function (p) {
          return a.start(p) === at;
        });
        open = !crosses && ends && begins;
      }
      if (open && runStart === null) runStart = c;
      if (!open && runStart !== null) {
        var seam = makeSeam(layouts, axis, at, runStart, c);
        if (seam) seams.push(seam);
        runStart = null;
      }
    }
  }
  return seams;
}

/** Every edge in this arrangement that can be dragged. */
export function layoutSeams(layouts) {
  if (!Array.isArray(layouts) || layouts.length < 2) return [];
  return seamsAlong(layouts, "v").concat(seamsAlong(layouts, "h"));
}

/**
 * The arrangement with `seam` moved to cell `at`, clamped to what the panels
 * on either side can give. Returns `layouts` itself when nothing moved, so a
 * drag that stays in one cell costs nothing.
 */
export function moveSeam(layouts, seam, at) {
  var target = Math.round(at);
  if (target < seam.min) target = seam.min;
  if (target > seam.max) target = seam.max;
  if (target === seam.at) return layouts;
  var grows = {};
  var shifts = {};
  seam.before.forEach(function (type) { grows[type] = true; });
  seam.after.forEach(function (type) { shifts[type] = true; });
  var vertical = seam.axis === "v";
  return layouts.map(function (p) {
    if (grows[p.type]) {
      return vertical
        ? Object.assign({}, p, { w: target - p.x })
        : Object.assign({}, p, { h: target - p.y });
    }
    if (shifts[p.type]) {
      return vertical
        ? Object.assign({}, p, { x: target, w: p.x + p.w - target })
        : Object.assign({}, p, { y: target, h: p.y + p.h - target });
    }
    return p;
  });
}

/*
 * Taking a panel off the workspace, and putting one back.
 *
 * Both have to leave the grid whole. A closed panel's room goes to whoever
 * shares its edge -- the rule `withoutSetsPanel` used when the saved sets
 * stopped being a panel -- and a reopened one takes half of whichever panel
 * can best spare it. Anything else leaves a hole, or two panels drawn over
 * each other.
 */

/** Whether `group` covers [from, to) exactly, end to end and without gaps. */
function tiles(group, from, to, startOf, sizeOf) {
  if (group.length === 0) return false;
  var sorted = group.slice().sort(function (a, b) {
    return startOf(a) - startOf(b);
  });
  var edge = from;
  for (var i = 0; i < sorted.length; i++) {
    if (startOf(sorted[i]) !== edge) return false;
    edge += sizeOf(sorted[i]);
  }
  return edge === to;
}

var byX = function (p) { return p.x; };
var byW = function (p) { return p.w; };
var byY = function (p) { return p.y; };
var byH = function (p) { return p.h; };

/**
 * The arrangement without `type`, its room given to the panels along one of
 * its edges. Returns `layouts` unchanged when it holds no such panel, or when
 * that panel is the only one left.
 */
export function withoutPanel(layouts, type) {
  var gone = layouts.find(function (p) {
    return p.type === type;
  });
  if (!gone || layouts.length < 2) return layouts;
  var rest = layouts
    .filter(function (p) {
      return p !== gone;
    })
    .map(function (p) {
      return Object.assign({}, p);
    });

  var right = gone.x + gone.w;
  var bottom = gone.y + gone.h;
  var inColumns = function (p) {
    return p.x >= gone.x && p.x + p.w <= right;
  };
  var inRows = function (p) {
    return p.y >= gone.y && p.y + p.h <= bottom;
  };

  var above = rest.filter(function (p) {
    return inColumns(p) && p.y + p.h === gone.y;
  });
  if (tiles(above, gone.x, right, byX, byW)) {
    above.forEach(function (p) {
      p.h += gone.h;
    });
    return rest;
  }
  var below = rest.filter(function (p) {
    return inColumns(p) && p.y === bottom;
  });
  if (tiles(below, gone.x, right, byX, byW)) {
    below.forEach(function (p) {
      p.y = gone.y;
      p.h += gone.h;
    });
    return rest;
  }
  var before = rest.filter(function (p) {
    return inRows(p) && p.x + p.w === gone.x;
  });
  if (tiles(before, gone.y, bottom, byY, byH)) {
    before.forEach(function (p) {
      p.w += gone.w;
    });
    return rest;
  }
  var after = rest.filter(function (p) {
    return inRows(p) && p.x === right;
  });
  if (tiles(after, gone.y, bottom, byY, byH)) {
    after.forEach(function (p) {
      p.x = gone.x;
      p.w += gone.w;
    });
    return rest;
  }
  // No edge to give it to: better a gap, which a preset or a seam can close,
  // than panels on top of one another.
  return rest;
}

/**
 * The arrangement with `type` added, taking half of the panel that can best
 * spare it. Returns `layouts` unchanged when the panel is already there, or
 * when nothing is big enough to divide.
 */
export function withPanel(layouts, type) {
  var already = layouts.some(function (p) {
    return p.type === type;
  });
  if (already) return layouts;
  if (layouts.length === 0) {
    return [{ type: type, x: 0, y: 0, w: LAYOUT_COLUMNS, h: LAYOUT_ROWS }];
  }
  var want = minCells(type);
  var host = null;
  var axis = null;
  layouts.forEach(function (p) {
    var least = minCells(p.type);
    var canStack = p.h >= least.h + want.h;
    var canShare = p.w >= least.w + want.w;
    if (!canStack && !canShare) return;
    // Across the longer side, so the halves stay as square as the whole was.
    var pick = p.h * 2 > p.w ? (canStack ? "h" : "v") : canShare ? "v" : "h";
    if (host && p.w * p.h <= host.w * host.h) return;
    host = p;
    axis = pick;
  });
  if (!host) return layouts;
  var keep = axis === "h" ? Math.ceil(host.h / 2) : Math.ceil(host.w / 2);
  var next = layouts.map(function (p) {
    if (p !== host) return Object.assign({}, p);
    return axis === "h"
      ? Object.assign({}, p, { h: keep })
      : Object.assign({}, p, { w: keep });
  });
  next.push(
    axis === "h"
      ? {
          type: type,
          x: host.x,
          y: host.y + keep,
          w: host.w,
          h: host.h - keep,
        }
      : {
          type: type,
          x: host.x + keep,
          y: host.y,
          w: host.w - keep,
          h: host.h,
        }
  );
  return next;
}

export { defaultLayouts, explorerLayouts, balancedLayouts };
