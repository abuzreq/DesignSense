/**
 * What a column's name says about it. A name may start with a prefix naming
 * the column's role:
 *
 *   in:width         an input parameter of the design
 *   out:area         an output parameter, measured or simulated
 *   min:cost         an output where lower is better
 *   max:daylight     an output where higher is better
 *   custom:looks     a custom dimension, with values entered by hand
 *   weighted:score   a weighted dimension, a weighted sum of other dimensions
 *
 * The prefix stays part of the column's name in the data, so a file saved
 * from DesignSense loads back the same way, but the interface shows only what
 * follows it.
 *
 * A user can give a column another role after loading (see
 * data/columnRoles.js). Those roles are set here, with setColumnRoles, before
 * a dataset's store is built, and win over the prefixes.
 *
 * Kept free of imports so the loader, the store and the views can share it.
 */

export const INPUT = "in";
export const OUTPUT = "out";
export const CUSTOM = "custom";
export const WEIGHTED = "weighted";

// The star rating's column: a custom dimension of its own (see ratings.js).
export const RATING_DIMENSION = CUSTOM + ":Rating";

// The goals (see GOAL_MARKS) a name's prefix can declare.
export const MAX = "max";
export const MIN = "min";

const PREFIX = /^\s*(in|out|min|max|custom|weighted)\s*:\s*/i;

function prefixOf(name) {
  let match = PREFIX.exec(String(name));
  return match ? match[1].toLowerCase() : null;
}

// Roles given after loading: { column: "in" | "out" | "none" }.
let roleOverrides = {};

/** Sets the roles the user gave the current dataset's columns. */
export function setColumnRoles(roles) {
  roleOverrides = Object.assign({}, roles || {});
}

/** "in", "out", "custom" or "weighted" by the name's prefix alone, or null. */
export function prefixKind(name) {
  let prefix = prefixOf(name);
  return prefix === MIN || prefix === MAX ? OUTPUT : prefix;
}

/**
 * "in", "out", "custom" or "weighted", or null: the role the user gave the
 * column, else its prefix's. A "min:" or "max:" column is an output that also
 * says which way is better.
 */
export function columnKind(name) {
  let kind = prefixKind(name);
  if (kind === CUSTOM || kind === WEIGHTED) return kind;
  let role = roleOverrides[name];
  if (role === INPUT || role === OUTPUT) return role;
  if (role === "none") return null;
  return kind;
}

/**
 * "min" or "max" when the name's prefix declares its goal, else null. A
 * column the user made something other than an output declares none.
 */
export function fileGoal(name) {
  let prefix = prefixOf(name);
  if (prefix !== MIN && prefix !== MAX) return null;
  let role = roleOverrides[name];
  return role && role !== OUTPUT ? null : prefix;
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

/**
 * Which way is better for a dimension, shown after its name wherever it is
 * named (see the store's goalOf).
 */
export const GOAL_MARKS = {
  [MAX]: { mark: "↑", title: "Higher is better" },
  [MIN]: { mark: "↓", title: "Lower is better" },
};

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
