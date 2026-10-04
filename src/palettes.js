/*
 * Tableau's colour palettes, and the choice between them.
 *
 * These are the palettes Maureen Stone and colleagues built for the Tableau
 * 10 redesign ("How we designed the new color palettes in Tableau 10",
 * 2016). They are worth preferring over a set picked by eye: the
 * categorical ones were spaced by measured colour difference, at the sizes a
 * chart actually draws -- a line a pixel wide and a dot a few across need
 * further apart than a filled bar does -- and then checked against the
 * common colour deficiencies. The ordered ones climb steadily in lightness,
 * so they read as more and less even where the hue is lost.
 *
 * There are two kinds, and which kind to use is not a matter of taste: it
 * follows from what the dimension is, which store/index.js decides. Which
 * palette within a kind is a matter of taste, and of the room it will be
 * read in, so that one is the reader's (see PaletteMenu.vue) and is kept in
 * this browser.
 *
 * Kept free of imports so the store and the views can share it.
 */

const RAMP_STORAGE_KEY = "designsense-color-ramp-v1";
const SCHEME_STORAGE_KEY = "designsense-color-scheme-v1";

/**
 * Ten hues told apart at a glance, for a dimension whose values name things.
 * d3 ships this as schemeTableau10, to within a digit in a couple of
 * channels; written out here so the rest come from the same place.
 */
export const TABLEAU_10 = [
  "#4E79A7",
  "#F28E2B",
  "#E15759",
  "#76B7B2",
  "#59A14F",
  "#EDC948",
  "#B07AA1",
  "#FF9DA7",
  "#9C755F",
  "#BAB0AC",
];

/**
 * Tableau's twenty, for when ten will not go round. It is not the ten with
 * ten more after it: the hues are paired dark and light, so neighbouring
 * values are easy to tell apart and a pair still reads as one family.
 */
export const TABLEAU_20 = [
  "#4E79A7",
  "#A0CBE8",
  "#F28E2B",
  "#FFBE7D",
  "#59A14F",
  "#8CD17D",
  "#B6992D",
  "#F1CE63",
  "#499894",
  "#86BCB6",
  "#E15759",
  "#FF9D9A",
  "#79706E",
  "#BAB0AC",
  "#D37295",
  "#FABFD2",
  "#B07AA1",
  "#D4A6C8",
  "#9D7660",
  "#D7B5A6",
];

/**
 * Tableau's "Color Blind": ten chosen to stay apart for a reader with a
 * red-green deficiency, which is about one man in twelve. Blues and
 * oranges, the pair that deficiency leaves alone, set further apart again
 * by lightness.
 */
export const TABLEAU_COLOR_BLIND = [
  "#1170AA",
  "#FC7D0B",
  "#A3ACB9",
  "#57606C",
  "#5FA2CE",
  "#C85200",
  "#7B848F",
  "#A3CCE9",
  "#FFBC79",
  "#C8D0D9",
];

/*
 * The ordered-sequential palettes, twenty steps each. A ramp is drawn as a
 * spline through them, so these are control points rather than bands.
 */
const ORANGE_GOLD = [
  "#f4d166",
  "#f6c760",
  "#f8bc58",
  "#f8b252",
  "#f7a84a",
  "#f69e41",
  "#f49538",
  "#f38b2f",
  "#f28026",
  "#f0751e",
  "#eb6c1c",
  "#e4641e",
  "#de5d1f",
  "#d75521",
  "#cf4f22",
  "#c64a22",
  "#bc4623",
  "#b24223",
  "#a83e24",
  "#9e3a26",
];

const GREEN_GOLD = [
  "#f4d166",
  "#e3cd62",
  "#d3c95f",
  "#c3c55d",
  "#b2c25b",
  "#a3bd5a",
  "#93b958",
  "#84b457",
  "#76af56",
  "#67a956",
  "#5aa355",
  "#4f9e53",
  "#479751",
  "#40914f",
  "#3a8a4d",
  "#34844a",
  "#2d7d45",
  "#257740",
  "#1c713b",
  "#146c36",
];

const BLUE = [
  "#b9ddf1",
  "#afd6ed",
  "#a5cfe9",
  "#9bc7e4",
  "#92c0df",
  "#89b8da",
  "#80b0d5",
  "#79aacf",
  "#72a3c9",
  "#6a9bc3",
  "#6394be",
  "#5b8cb8",
  "#5485b2",
  "#4e7fac",
  "#4878a6",
  "#437a9f",
  "#3d6a98",
  "#376491",
  "#305d8a",
  "#2a5783",
];

const BLUE_TEAL = [
  "#bce4d8",
  "#aedcd5",
  "#a1d5d2",
  "#95cecf",
  "#89c8cc",
  "#7ec1ca",
  "#72bac6",
  "#66b2c2",
  "#59acbe",
  "#4ba5ba",
  "#419eb6",
  "#3b96b2",
  "#358ead",
  "#3586a7",
  "#347ea1",
  "#32779b",
  "#316f96",
  "#2f6790",
  "#2d608a",
  "#2c5985",
];

const GRAY = [
  "#d5d5d5",
  "#cdcecd",
  "#c5c7c6",
  "#bcbfbe",
  "#b4b7b7",
  "#acb0b1",
  "#a4a9ab",
  "#9ca3a4",
  "#939c9e",
  "#8b9598",
  "#848e93",
  "#7c878d",
  "#758087",
  "#6e7a81",
  "#67737c",
  "#616c77",
  "#5b6570",
  "#555f6a",
  "#4f5864",
  "#49525e",
];

/**
 * The ordered ramps on offer, for a dimension that measures something.
 *
 * Orange-Gold leads because of how these colours are used here: the
 * parallel coordinates draw hundreds of lines over one another at an alpha
 * well below one, and compositing on white flattens the lightness
 * difference a single-hue ramp has nothing else to fall back on. Gold
 * through orange to brick keeps the widest hue difference through it.
 *
 * That is also what makes it the one that asks most of a reader with a
 * red-green deficiency, which is why the others are here for more than
 * taste. Blue is the safest of them; Gray is the one that survives a
 * photocopier, a projector with the lamp going, and a report printed in
 * black and white.
 */
export const COLOR_RAMPS = [
  {
    id: "orange-gold",
    name: "Orange-Gold",
    note: "The widest separation, and the hardest on red-green deficiency",
    colors: ORANGE_GOLD,
  },
  {
    id: "green-gold",
    name: "Green-Gold",
    note: "Nearly as wide, and cooler at the far end",
    colors: GREEN_GOLD,
  },
  {
    id: "blue",
    name: "Blue",
    note: "Calm, and safe for every reader",
    colors: BLUE,
  },
  {
    id: "blue-teal",
    name: "Blue-Teal",
    note: "Calm, with a little more to tell the middle apart",
    colors: BLUE_TEAL,
  },
  {
    id: "gray",
    name: "Gray",
    note: "For printing, photocopying and tired projectors",
    colors: GRAY,
  },
];

export const AUTO_SCHEME_ID = "auto";

/**
 * The hue sets on offer, for a dimension whose values name things.
 *
 * Automatic is the default and the only one that answers to the data: ten
 * hues until there are more than ten things to name, then twenty. The named
 * ones are taken at their word and start over once they run out -- quietly
 * reaching for a longer palette would undo the reason somebody asked for
 * the colour-blind one.
 */
export const COLOR_SCHEMES = [
  {
    id: AUTO_SCHEME_ID,
    name: "Automatic",
    note: "Ten hues, or twenty once ten will not go round",
    colors: TABLEAU_10,
  },
  {
    id: "tableau10",
    name: "Tableau 10",
    note: "Ten, starting over past the tenth",
    colors: TABLEAU_10,
  },
  {
    id: "tableau20",
    name: "Tableau 20",
    note: "Twenty, in dark and light pairs",
    colors: TABLEAU_20,
  },
  {
    id: "colorblind",
    name: "Colour-blind safe",
    note: "Ten that stay apart for a red-green deficiency",
    colors: TABLEAU_COLOR_BLIND,
  },
];

export const DEFAULT_RAMP_ID = COLOR_RAMPS[0].id;
export const DEFAULT_SCHEME_ID = AUTO_SCHEME_ID;

function entry(list, id, fallback) {
  var byId = function (wanted) {
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === wanted) return list[i];
    }
    return null;
  };
  // An id saved by a later build, or none saved at all.
  return byId(id) || byId(fallback) || list[0];
}

/** The ordered ramp with this id, or the one everybody starts on. */
export function rampFor(id) {
  return entry(COLOR_RAMPS, id, DEFAULT_RAMP_ID);
}

/** The hue set with this id, or the one everybody starts on. */
export function schemeFor(id) {
  return entry(COLOR_SCHEMES, id, DEFAULT_SCHEME_ID);
}

/**
 * The hues to use for `count` things to name: the chosen set, except that
 * Automatic steps up to the twenty once there are more than ten.
 */
export function schemeColorsFor(id, count) {
  var scheme = schemeFor(id);
  if (scheme.id === AUTO_SCHEME_ID && count > TABLEAU_10.length) return TABLEAU_20;
  return scheme.colors;
}

function loadChoice(key, list, fallback) {
  try {
    var id = localStorage.getItem(key);
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) return id;
    }
  } catch (e) {
    /* private mode, or storage turned off */
  }
  return fallback;
}

function saveChoice(key, id) {
  try {
    localStorage.setItem(key, id);
  } catch (e) {
    /* ignore quota / private-mode failures */
  }
}

export function loadColorRamp() {
  return loadChoice(RAMP_STORAGE_KEY, COLOR_RAMPS, DEFAULT_RAMP_ID);
}

export function saveColorRamp(id) {
  saveChoice(RAMP_STORAGE_KEY, id);
}

export function loadColorScheme() {
  return loadChoice(SCHEME_STORAGE_KEY, COLOR_SCHEMES, DEFAULT_SCHEME_ID);
}

export function saveColorScheme(id) {
  saveChoice(SCHEME_STORAGE_KEY, id);
}
