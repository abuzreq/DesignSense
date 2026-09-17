import Papa from "papaparse";
import { LoadError } from "./errors.js";

/*
 * Turns CSV text into the rows DesignSense works with. Free of the DOM and of
 * Vue, so it can be tested on its own. Problems that stop a load throw a
 * LoadError; problems worth mentioning come back as warnings.
 */

const ID_COLUMNS = ["_id", "ID", "id"];
const NUMBER = /^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i;
const UNNAMED_COLUMN = "column_";
// Columns added to every row, with the types the views expect of them.
const ADDED_COLUMN_TYPES = {
  _id: "string",
  Rating: "Float",
  Tags: "string",
  image: "string",
  images: "string",
  json: "string",
};

export function isBlank(value) {
  return value === undefined || value === null || String(value).trim() === "";
}

export function looksLikeHtml(text) {
  return /^\s*<(!doctype|html|head|body)\b/i.test(text);
}

function plural(count, one, many) {
  return count + " " + (count === 1 ? one : many);
}

/**
 * Parses comma-, tab- or semicolon-separated text with a header row into
 * `{ rows, fields, warnings }`. Blank lines are skipped.
 */
export function parseCsvText(text) {
  if (typeof text !== "string" || text.trim() === "") {
    throw new LoadError("The file is empty.");
  }
  if (looksLikeHtml(text)) {
    throw new LoadError("This is a web page, not a CSV file.");
  }
  let unnamed = [];
  let result = Papa.parse(text, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (header, index) => {
      let name = header.replace(/^﻿/, "").trim();
      if (name !== "") return name;
      name = UNNAMED_COLUMN + (index + 1);
      unnamed.push(name);
      return name;
    },
  });
  let fields = (result.meta && result.meta.fields) || [];
  let rows = result.data;

  let raggedRows = 0;
  rows.forEach((row) => {
    let ragged = false;
    if (row.__parsed_extra !== undefined) {
      delete row.__parsed_extra;
      ragged = true;
    }
    fields.forEach((field) => {
      if (row[field] === undefined) {
        row[field] = "";
        ragged = true;
      }
    });
    if (ragged) raggedRows += 1;
  });

  // A delimiter at the end of every line leaves an empty, nameless column.
  let emptyUnnamed = unnamed.filter((name) =>
    rows.every((row) => isBlank(row[name]))
  );
  if (emptyUnnamed.length > 0) {
    fields = fields.filter((field) => emptyUnnamed.indexOf(field) === -1);
    rows.forEach((row) => emptyUnnamed.forEach((name) => delete row[name]));
  }

  let warnings = [];
  if (raggedRows > 0) {
    warnings.push(
      plural(raggedRows, "row has", "rows have") +
        " a different number of values than the header."
    );
  }
  let renamed = unnamed.length - emptyUnnamed.length;
  if (renamed > 0) {
    warnings.push(
      plural(renamed, "column has", "columns have") +
        " no header and got a placeholder name."
    );
  }
  return { rows: rows, fields: fields, warnings: warnings };
}

export function validateTable(rows, fields) {
  if (fields.length === 0) {
    throw new LoadError("The file has no header row.");
  }
  if (fields.length === 1 && fields[0].charAt(0) === "<") {
    throw new LoadError("This is a web page, not a CSV file.");
  }
  let seen = new Set();
  let repeated = new Set();
  fields.forEach((field) => {
    if (seen.has(field)) repeated.add(field);
    seen.add(field);
  });
  if (repeated.size > 0) {
    throw new LoadError(
      "Each column needs its own name, but these appear more than once: " +
        Array.from(repeated).join(", ") +
        "."
    );
  }
  if (rows.length === 0) {
    throw new LoadError("The file has a header row but no data rows.");
  }
}

/** "Float" for columns whose non-blank values are all numbers, else "string". */
export function inferColumnTypes(rows, fields) {
  let types = {};
  fields.forEach((field) => {
    if (ID_COLUMNS.indexOf(field) !== -1) {
      types[field] = "string";
      return;
    }
    let hasValue = false;
    let allNumbers = rows.every((row) => {
      let value = row[field];
      if (isBlank(value)) return true;
      hasValue = true;
      return NUMBER.test(String(value).trim());
    });
    types[field] = hasValue && allNumbers ? "Float" : "string";
  });
  return types;
}

/**
 * Converts numeric columns to numbers, in place. Blank cells become undefined,
 * so they read as missing rather than as zero. Returns blank counts by column.
 */
export function castColumns(rows, types) {
  let blanks = {};
  Object.keys(types).forEach((field) => {
    if (types[field] !== "Float") return;
    let count = 0;
    rows.forEach((row) => {
      if (isBlank(row[field])) {
        row[field] = undefined;
        count += 1;
      } else {
        row[field] = Number(String(row[field]).trim());
      }
    });
    if (count > 0) blanks[field] = count;
  });
  return blanks;
}

/**
 * Gives every row a unique `_id` built from its `_id` or `ID` column. Views use
 * ids in DOM selectors and as keys, so only letters, digits, "_" and "-" are
 * kept. Returns how many rows repeated an id already taken.
 */
export function assignIds(rows) {
  let used = new Set();
  let repeats = 0;
  rows.forEach((row, index) => {
    let source = !isBlank(row._id) ? row._id : row.ID;
    let base = isBlank(source)
      ? ""
      : String(source)
          .trim()
          .replace(/[^A-Za-z0-9_-]/g, "_");
    if (base === "") base = "row" + (index + 1);
    let id = base;
    for (let n = 2; used.has(id); n++) id = base + "__" + n;
    if (id !== base) repeats += 1;
    used.add(id);
    row._id = id;
  });
  return repeats;
}

function fileName(path) {
  return path.split(/[\\/]/).pop();
}

/**
 * Maps values of image and model columns to URLs. Absolute URLs pass through.
 * Names are looked up among a folder's files (exactly, then ignoring case, then
 * by file name alone), then resolved against `baseUrl`, the CSV's location.
 */
export function makeAssetResolver(options) {
  let baseUrl = (options && options.baseUrl) || null;
  let files = (options && options.files) || {};
  let byLowerName = {};
  let byFileName = {};
  Object.keys(files).forEach((name) => {
    byLowerName[name.toLowerCase()] = files[name];
    byFileName[fileName(name).toLowerCase()] = files[name];
  });
  let missing = 0;
  return {
    resolve(value) {
      if (isBlank(value)) return undefined;
      let text = String(value).trim();
      if (/^(https?|data|blob):/i.test(text) || text.slice(0, 2) === "//") {
        return text;
      }
      let match =
        files[text] ||
        byLowerName[text.toLowerCase()] ||
        byFileName[fileName(text).toLowerCase()];
      if (match) return match;
      if (baseUrl) {
        try {
          return new URL(text, baseUrl).href;
        } catch (err) {
          // Counted as missing below.
        }
      }
      missing += 1;
      return text;
    },
    get missing() {
      return missing;
    },
  };
}

/** Adds what every view relies on: ratings, tags, and resolved images and models. */
export function prepareRows(rows, resolver) {
  rows.forEach((row) => {
    // A blank rating means not rated yet.
    if (typeof row.Rating !== "number" || !isFinite(row.Rating)) row.Rating = 0;
    if (!row.Tags) row.Tags = [];
    if (!isBlank(row.img)) {
      row.image = resolver.resolve(row.img);
      row.images = [row.image];
    } else {
      row.images = Object.keys(row)
        .filter((key) => key.indexOf("img") !== -1)
        .map((key) => resolver.resolve(row[key]))
        .filter((src) => src !== undefined);
      row.image = row.images[0];
    }
    row.json = resolver.resolve(row.threeD);
  });
  return rows;
}

/**
 * CSV text to `{ data, dataTypesMap, warnings }`. `options.baseUrl` is where the
 * CSV came from and `options.files` maps a folder's file names to URLs; both
 * resolve image and model columns.
 */
export function buildDataset(text, options) {
  let table = parseCsvText(text);
  validateTable(table.rows, table.fields);
  let rows = table.rows;
  let warnings = table.warnings.slice();

  let repeats = assignIds(rows);
  let types = inferColumnTypes(rows, table.fields);
  let blanks = castColumns(rows, types);
  let resolver = makeAssetResolver(options);
  prepareRows(rows, resolver);

  delete blanks.Rating;
  let blankColumns = Object.keys(blanks);
  if (blankColumns.length > 0) {
    let listed = blankColumns
      .slice(0, 4)
      .map((field) => field + " (" + blanks[field] + ")")
      .join(", ");
    warnings.push(
      "Some numeric cells are blank and are treated as missing: " +
        listed +
        (blankColumns.length > 4 ? ", and more" : "") +
        "."
    );
  }
  if (repeats > 0) {
    warnings.push(
      plural(repeats, "row repeats", "rows repeat") +
        " an ID used by another row and got a unique one."
    );
  }
  if (resolver.missing > 0) {
    warnings.push(
      plural(resolver.missing, "image or model file", "image or model files") +
        " named in the data could not be found."
    );
  }
  return {
    data: rows,
    dataTypesMap: Object.assign({}, types, ADDED_COLUMN_TYPES),
    warnings: warnings,
  };
}
