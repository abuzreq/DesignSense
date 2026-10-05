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
 *   name:variant     what to call each option, rather than "Option 12"
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
// Not a dimension: a column whose values name the options.
export const NAME = "name";

// The star rating's column: a custom dimension of its own (see ratings.js).
export const RATING_DIMENSION = CUSTOM + ":Rating";

// The goals (see GOAL_MARKS) a name's prefix can declare.
export const MAX = "max";
export const MIN = "min";

const PREFIX = /^\s*(in|out|min|max|custom|weighted|name)\s*:\s*/i;

/*
 * Design Explorer's wiki documents a "name:" prefix, but its own files --
 * the three of them this app ships as samples -- carry a plain "Description"
 * column instead. So a column named like one of these is *offered* as the
 * name, the way data/assets.js offers "img" as a picture, and the Columns
 * dialog lets it be changed or turned off.
 *
 * Only offered, though, and only once its values look like names: the used
 * cars sample has a "description" too, holding the whole of each listing,
 * and a paragraph is not what a card should be called.
 */
export const NAME_COLUMN = /^(name|description|label|title)$/i;
// Longer than this and it is prose, not a name.
const NAME_MAX_LENGTH = 60;
// How many rows are enough to tell one from the other.
const NAME_SAMPLE = 50;

function looksLikeNames(rows, column) {
  let seen = [];
  for (let i = 0; i < rows.length && seen.length < NAME_SAMPLE; i++) {
    let value = rows[i][column];
    if (value === undefined || value === null || value === "") continue;
    let text = String(value);
    if (text.length > NAME_MAX_LENGTH) return false;
    seen.push(text);
  }
  if (seen.length === 0) return false;
  // Mostly the same value over and over names nothing.
  return new Set(seen).size * 2 >= seen.length;
}

function prefixOf(name) {
  let match = PREFIX.exec(String(name));
  return match ? match[1].toLowerCase() : null;
}

// Roles given after loading: { column: "in" | "out" | "none" }.
let roleOverrides = {};
// Which column names the options, "" for none, null until one is worked out.
let nameColumn = null;

/** Sets the roles the user gave the current dataset's columns. */
export function setColumnRoles(roles) {
  roleOverrides = Object.assign({}, roles || {});
}

// Numbers a sample says are not dimensions of the design (see
// data/presets.js): a used car's latitude measures where it is sitting, not
// anything about the car. Unlike a role of "none", which still plots the
// column, these are left out of the dimensions altogether.
let ignoredColumns = {};

/** Sets the columns this dataset is not to treat as dimensions. */
export function setIgnoredColumns(names) {
  ignoredColumns = {};
  (names || []).forEach((name) => {
    ignoredColumns[name] = true;
  });
}

/** Whether this column is a number the options are not judged by. */
export function isIgnoredColumn(name) {
  return ignoredColumns[name] === true;
}

/**
 * Says which column names the options: a column name, or "" for none. Null
 * hands the choice back to the file, which `nameColumnFor` reads.
 */
export function setNameColumn(column) {
  nameColumn = column === null || column === undefined ? null : String(column);
}

export function getNameColumn() {
  return nameColumn;
}

/**
 * The column a file means to name its options by: one carrying the "name:"
 * prefix, else one called Name, Description, Label or Title. "" when the
 * file offers neither.
 */
export function nameColumnFor(allDimensions, rows) {
  let names = allDimensions || [];
  let prefixed = names.find((dim) => prefixOf(dim) === NAME);
  if (prefixed) return prefixed;
  let candidate = names.find((dim) => NAME_COLUMN.test(String(dim).trim()));
  if (!candidate) return "";
  if (!rows || rows.length === 0) return candidate;
  return looksLikeNames(rows, candidate) ? candidate : "";
}

/**
 * "in", "out", "custom", "weighted" or "name" by the name's prefix alone, or
 * null.
 */
export function prefixKind(name) {
  let prefix = prefixOf(name);
  return prefix === MIN || prefix === MAX ? OUTPUT : prefix;
}

/** Whether this column names the options rather than measuring them. */
export function isNameColumn(name) {
  if (prefixKind(name) === NAME) return true;
  return nameColumn !== null && nameColumn !== "" && name === nameColumn;
}

/**
 * "in", "out", "custom" or "weighted", or null: the role the user gave the
 * column, else its prefix's. A "min:" or "max:" column is an output that also
 * says which way is better.
 */
export function columnKind(name) {
  let kind = prefixKind(name);
  if (kind === CUSTOM || kind === WEIGHTED) return kind;
  if (kind === NAME) return null;
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
 * inspector, a column in Compare: the column the file names them by when it
 * has one, else its own ID column, else the id the app gave it.
 */
export function optionName(item) {
  if (!item) return "";
  if (nameColumn) {
    let given = item[nameColumn];
    if (given !== undefined && given !== null && String(given) !== "") {
      return String(given);
    }
  }
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
