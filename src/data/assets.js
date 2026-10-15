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

/*
 * Google Drive serves the same picture from several addresses and only one of
 * them is any use to a browser. Measured in October 2026 against a public
 * file, from a page on another origin:
 *
 *   drive.google.com/thumbnail?id=...&sz=w200     loaded  200x100    16 kB
 *   drive.google.com/thumbnail?id=...&sz=w1000    loaded  1000x500  274 kB
 *   docs.google.com/uc?id=...&export=download     failed
 *   drive.usercontent.google.com/download?id=...  failed
 *
 * curl is answered 200 and an image/png by all four: it is the browser that
 * refuses the two download endpoints, which is why a Drive link pasted into an
 * image column shows as a broken picture. Design Explorer hit the same wall
 * and moved to the thumbnail service; this does too.
 *
 * The width is the other half of it. A gallery card is 170 pixels wide and was
 * being sent 274 kB to fill them; the same picture at the width it is drawn at
 * is 16. So the address is built where the picture is used rather than once at
 * load, and `imageAtWidth` can be handed its own output -- the id is read back
 * out of a thumbnail URL as readily as out of a share link.
 *
 * Nothing here can list a Drive folder: that needs files.list and an API key
 * of the site's own (see sources.js). Showing a picture needs neither.
 */
const DRIVE_HOST = /^(drive|docs)\.google\.com$|^drive\.usercontent\.google\.com$/i;
const DRIVE_PATH_ID = /\/file\/d\/([A-Za-z0-9_-]{10,})/;
const DRIVE_ID = /^[A-Za-z0-9_-]{10,}$/;

/** What a picture is asked for at: a card's worth, or the inspector's. */
export const IMAGE_WIDTH = { card: 500, large: 1200 };

/** The file id in any shape of Google Drive link, or "" for anything else. */
export function driveFileId(value) {
  let text = String(value == null ? "" : value).trim();
  if (!/^https?:\/\//i.test(text)) return "";
  let url;
  try {
    url = new URL(text);
  } catch (err) {
    return "";
  }
  if (!DRIVE_HOST.test(url.hostname)) return "";
  let inPath = DRIVE_PATH_ID.exec(url.pathname);
  if (inPath) return inPath[1];
  let id = url.searchParams.get("id") || "";
  return DRIVE_ID.test(id) ? id : "";
}

/** A Drive picture at a width, through the one address a browser accepts. */
export function driveThumbnail(id, width) {
  return (
    "https://drive.google.com/thumbnail?id=" +
    encodeURIComponent(id) +
    "&sz=w" +
    Math.round(width)
  );
}

/**
 * The same picture at the width it is about to be drawn at, where its host
 * offers the choice. Anything that is not a Drive link -- a folder's blob,
 * OneDrive's own thumbnail, a file served beside the data -- is handed back
 * untouched, since nobody else lets us ask.
 */
export function imageAtWidth(url, width) {
  let id = driveFileId(url);
  return id ? driveThumbnail(id, width) : url;
}
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
  let stripped = text.replace(/^\s*(in|out|min|max|custom|weighted)\s*:\s*/i, "");
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
  // A folder on this computer names its files by path; the file beside a
  // model in a subfolder is still found by its name alone.
  for (let i = 0; i < names.length; i++) {
    if (names[i].toLowerCase().split("/").pop() === lower) {
      return folderFiles[names[i]];
    }
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
