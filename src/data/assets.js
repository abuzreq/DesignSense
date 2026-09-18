/*
 * Which columns hold pictures and 3D models, and which files go with them.
 *
 * The convention, as the load dialog states it:
 *   images  "img" or "image" is the first view, then "img_2", "img_3", ...
 *   models  "model3d" or "3d" is the first model, then "model3d_2", ...
 * Case and the separator don't matter, and a folder that lists its files
 * (Drive, OneDrive) also offers "<name>_2.png" beside "<name>.png".
 *
 * Kept free of imports so the loader, the views and a plain Node script can
 * all use it.
 */

// "img", "image_2", "IMG 3" -- but not "image_url" or "imgur_link".
export const IMAGE_NAME = /^(img|image)(?:[\s_-]?(\d+))?$/i;
// Names that can only mean a 3D model, whatever the values look like.
export const STRICT_MODEL_NAME = /^(model3d|model_3d|3d|3d_model|threed)(?:[\s_-]?(\d+))?$/i;
// Names that often mean something else ("model" is a car model in the sample
// data), so these are claimed only when their values name model files.
export const LOOSE_MODEL_NAME = /^(model|models|geometry|mesh|glb|gltf|obj)(?:[\s_-]?(\d+))?$/i;

export const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg"];
// ".json" is a three.js scene, which is what Design Explorer's "threeD"
// column holds; see data/threeLegacy.js for what reading one takes.
export const MODEL_EXTENSIONS = ["glb", "gltf", "obj", "json"];

// The app's own columns: added to every row, never shown as dimensions.
const DERIVED_KEYS = ["image", "images", "_models", "json"];

/** A file's extension, lower-cased, with any query or hash ignored. */
export function assetExtension(value) {
  if (typeof value !== "string") return "";
  let text = value.trim().split("?")[0].split("#")[0];
  let dot = text.lastIndexOf(".");
  if (dot === -1 || dot === text.length - 1) return "";
  return text.slice(dot + 1).toLowerCase();
}

/** "glb", "gltf", "obj" or "json" for a model file; null for anything else. */
export function modelFormat(value) {
  let ext = assetExtension(value);
  return MODEL_EXTENSIONS.indexOf(ext) === -1 ? null : ext;
}

/** Whether a cell names a model file rather than holding a value of its own. */
export function looksLikeModelValue(value) {
  return modelFormat(value) !== null;
}

function matchOf(name, pattern) {
  return pattern.exec(String(name).trim());
}

/** Where a view sits in the order: no number means the first. */
function viewNumber(match) {
  let digits = match[2];
  return digits === undefined ? 1 : parseInt(digits, 10);
}

function firstValue(rows, column) {
  for (let i = 0; i < rows.length; i++) {
    let value = rows[i][column];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }
  return undefined;
}

function orderColumns(entries) {
  // Stable: two columns claiming the same view keep the header's order.
  return entries
    .map(function(entry, index) {
      return { name: entry.name, number: entry.number, index: index };
    })
    .sort(function(a, b) {
      return a.number - b.number || a.index - b.index;
    })
    .map(function(entry) {
      return entry.name;
    });
}

/**
 * Sorts a file's columns into the images and the models it names.
 *
 * `types` is the inferred column types, so a loose name such as "model" is
 * judged by what it holds: text naming a .glb is a model, anything else is a
 * dimension. Returns the claimed columns in view order, the loose ones that
 * were taken (the views hide those), and what clashed.
 */
export function classifyColumns(fields, rows, types) {
  let images = [];
  let models = [];
  let claimed = [];
  let conflicts = [];
  let takenImage = {};
  let takenModel = {};
  (fields || []).forEach(function(field) {
    let label = displayNameOf(field);
    let image = matchOf(label, IMAGE_NAME);
    if (image) {
      let number = viewNumber(image);
      if (takenImage[number]) conflicts.push([takenImage[number], field]);
      else takenImage[number] = field;
      images.push({ name: field, number: number });
      return;
    }
    let strict = matchOf(label, STRICT_MODEL_NAME);
    if (strict) {
      let number = viewNumber(strict);
      if (takenModel[number]) conflicts.push([takenModel[number], field]);
      else takenModel[number] = field;
      models.push({ name: field, number: number });
      return;
    }
    let loose = matchOf(label, LOOSE_MODEL_NAME);
    if (!loose) return;
    // A numeric column can't hold a file name, and a column whose first value
    // isn't a model file is a dimension that happens to be called "model".
    let type = types ? types[field] : undefined;
    if (type && type !== "string") return;
    if (!looksLikeModelValue(firstValue(rows || [], field))) return;
    models.push({ name: field, number: viewNumber(loose) });
    claimed.push(field);
  });
  return {
    images: orderColumns(images),
    models: orderColumns(models),
    claimed: claimed,
    conflicts: conflicts,
  };
}

// A copy of columns.js's displayName: this module stays import-free, and the
// prefixes are a one-line rule.
function displayNameOf(name) {
  let text = String(name).trim();
  let stripped = text.replace(/^\s*(in|out|custom|weighted)\s*:\s*/i, "");
  return stripped === "" ? text : stripped;
}

/*
 * What the current dataset's columns turned out to be. A module-level note
 * rather than store state: one dataset is mounted at a time (mountApp destroys
 * the previous app), and the views, the exports and the assistant all need the
 * same answer without threading it through every call.
 */
let claimedColumns = {};
let folderFiles = {};

export function setClaimedColumns(names) {
  claimedColumns = {};
  (names || []).forEach(function(name) {
    claimedColumns[name] = true;
  });
}

/** Whether a column was taken as 3D despite a name that could be a dimension. */
export function isClaimedColumn(name) {
  return claimedColumns[name] === true;
}

export function setFolderFiles(files) {
  folderFiles = files || {};
}

/** A folder file's URL by its name, for a model's companion files. */
export function folderFileUrl(name) {
  if (!name) return undefined;
  let key = String(name);
  if (folderFiles[key]) return folderFiles[key];
  let lower = key.toLowerCase();
  let names = Object.keys(folderFiles);
  for (let i = 0; i < names.length; i++) {
    if (names[i].toLowerCase() === lower) return folderFiles[names[i]];
  }
  return undefined;
}

/** The app's own columns, which never belong in a CSV export. */
export function isDerivedAssetKey(name) {
  // Compared without case, so a file headed "Images" is skipped like the key
  // the app adds rather than colliding with it.
  return DERIVED_KEYS.indexOf(String(name).toLowerCase()) !== -1;
}

/**
 * Whether a column is about assets rather than about the design: the picture
 * and model columns and the keys the app adds. Replaces the
 * hand-written lists that could never cover "img_2" or "model3d_3".
 */
export function isAssetColumn(name) {
  if (isDerivedAssetKey(name)) return true;
  let label = displayNameOf(name);
  return (
    IMAGE_NAME.test(label) ||
    STRICT_MODEL_NAME.test(label) ||
    isClaimedColumn(name)
  );
}
