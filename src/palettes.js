/*
 * Tableau's colour palettes, as published with the Tableau 10 redesign
 * (Maureen Stone and colleagues, "How we designed the new color palettes in
 * Tableau 10", 2016). They are worth preferring over a set picked by eye:
 * the categorical ones were spaced by measured colour difference, at the
 * sizes a chart actually draws -- a line a pixel wide and a dot a few across
 * need further apart than a filled bar does -- and then checked against the
 * common colour deficiencies. The ordered ones climb steadily in lightness,
 * so they read as more and less even where the hue is lost.
 *
 * Which of them to use is not a matter of taste either, and is decided in
 * store/index.js by what the dimension is: names get the categorical ten or
 * twenty, measurements get the ordered ramp.
 *
 * Kept free of imports so the store and the views can share it.
 */

/**
 * Ten hues told apart at a glance, for a dimension whose values name things.
 * d3 ships this as schemeTableau10, to within a digit in a couple of
 * channels; written out here so the twenty below come from the same place.
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
 * Tableau's "Blue-Teal", one of its ordered-sequential palettes, for a
 * dimension whose values measure something.
 *
 * Chosen among Tableau's ordered ramps for two reasons. Over the plainer
 * single-hue "Blue": the parallel coordinates draw hundreds of lines over
 * one another at an alpha well below one, and compositing on white flattens
 * the lightness difference a single hue has nothing else to fall back on,
 * where teal through to deep blue keeps a hue difference as well. Over the
 * warmer "Orange-Gold" and "Green-Gold", which do separate a touch better
 * still: both say something about the values as well as ordering them --
 * red at the top reads as the bad end, green as the good one -- and which
 * end is the good one is already said, per dimension, by the goal arrows on
 * the axes. A colour that disagreed with them would be read as a second
 * opinion.
 *
 * The pale end sits on white no more faintly than the yellow end of
 * viridis, which this replaces.
 */
export const TABLEAU_BLUE_TEAL = [
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
