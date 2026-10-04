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
 * Tableau's "Orange-Gold", one of its ordered-sequential palettes, for a
 * dimension whose values measure something.
 *
 * Of the ordered ramps this one holds up best under how these colours are
 * used. The parallel coordinates draw hundreds of lines over one another at
 * an alpha well below one, and compositing on white flattens the lightness
 * difference that a single-hue ramp like Tableau's "Blue" has nothing else
 * to fall back on; gold through orange to brick keeps a hue difference too,
 * and a wider one than the cooler "Blue-Teal" that was tried before it.
 *
 * It does say something as well as order: a hot end reads as the bad end.
 * Which end is the good one is settled per dimension by the goal arrows on
 * the axes, which is the only place that knows.
 */
export const TABLEAU_ORANGE_GOLD = [
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
