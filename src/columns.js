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

/**
 * What an option is called wherever it is named -- a gallery card, the
 * inspector, a column in Compare: its own ID column when the data has one,
 * otherwise the id the app gave it.
 */
export function optionName(item) {
  if (!item) return "";
  let id = item.ID;
  if (id === undefined || id === null || id === "") id = item.id;
  if (id === undefined || id === null || id === "") id = item._id;
  return "Option " + id;
}

/**
 * How the interface sets apart the dimensions a user makes from the file's
 * own columns, wherever one is named: a colour and a sign after the name.
 */
export const KIND_MARKS = {
  [CUSTOM]: {
    mark: "✎",
    color: "#6a1b9a",
    title: "Custom dimension: values you enter",
  },
  [WEIGHTED]: {
    mark: "Σ",
    color: "#00796b",
    title: "Weighted dimension: a weighted sum of other dimensions",
  },
};

/** The column's mark (see KIND_MARKS) when it is custom or weighted, else null. */
export function kindMark(name) {
  return KIND_MARKS[columnKind(name)] || null;
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
