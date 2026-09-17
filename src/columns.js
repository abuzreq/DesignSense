/**
 * What a column's name says about it. A name may start with a prefix naming
 * the column's role:
 *
 *   in:width         an input parameter of the design
 *   out:area         an output parameter, measured or simulated
 *   custom:looks     a custom dimension, with values entered by hand
 *   weighted:score   a weighted dimension, a weighted sum of other dimensions
 *
 * The prefix stays part of the column's name in the data, so a file saved
 * from DesignSense loads back the same way, but the interface shows only what
 * follows it.
 *
 * Kept free of imports so the loader, the store and the views can share it.
 */

export const INPUT = "in";
export const OUTPUT = "out";
export const CUSTOM = "custom";
export const WEIGHTED = "weighted";

const PREFIX = /^\s*(in|out|custom|weighted)\s*:\s*/i;

/** "in", "out", "custom" or "weighted" by the name's prefix, or null. */
export function columnKind(name) {
  let match = PREFIX.exec(String(name));
  return match ? match[1].toLowerCase() : null;
}

/** The name the interface shows: the column's name without its prefix. */
export function displayName(name) {
  if (name === undefined || name === null) return "";
  let text = String(name);
  let label = text.replace(PREFIX, "");
  return label === "" ? text : label;
}

/** The column name for a shown name of this kind: "custom:looks". */
export function prefixedName(kind, label) {
  return kind + ":" + label;
}

/**
 * Columns as `{ text, value }` choices for a select, showing their names.
 * Vuetify's selects read `item-text` only from objects, never from strings.
 */
export function dimensionItems(names) {
  return names.map((name) => ({ text: displayName(name), value: name }));
}
