/*
 * A folder chosen or dropped from the user's computer, as the loader takes
 * it: `[{ path, file }]`, each path counted from inside the folder, so that
 * "data.csv" is the study's table and "0001.png" the picture a cell names.
 * The browser's two ways of handing over a folder are read here; what the
 * files mean is the loader's business (see sources.js).
 */

// ".DS_Store", "._0001.png": what a file manager leaves behind.
function isHidden(name) {
  return name.charAt(0) === ".";
}

/** The files of an `<input type="file" webkitdirectory>`. */
export function filesOfInput(fileList) {
  return Array.prototype.slice
    .call(fileList || [])
    .filter((file) => !isHidden(file.name))
    .map((file) => {
      // "Colibri/data.csv": the folder's own name comes first, and goes.
      let relative = file.webkitRelativePath || file.name;
      let slash = relative.indexOf("/");
      return {
        path: slash === -1 ? relative : relative.slice(slash + 1),
        file: file,
      };
    });
}

/** Loose files dropped together: a folder's contents without the folder. */
export function filesOfList(fileList) {
  return Array.prototype.slice
    .call(fileList || [])
    .filter((file) => !isHidden(file.name))
    .map((file) => ({ path: file.name, file: file }));
}

/** What a drop holds, as entries; empty where the browser offers none. */
export function entriesOfDrop(dataTransfer) {
  // Read before the drop event returns: the items are gone after it.
  return Array.prototype.map
    .call((dataTransfer && dataTransfer.items) || [], (item) =>
      item.webkitGetAsEntry ? item.webkitGetAsEntry() : null
    )
    .filter(Boolean);
}

function readAll(reader) {
  // A folder is handed over in batches, the last of them empty.
  let all = [];
  let next = () =>
    new Promise((resolve, reject) => reader.readEntries(resolve, reject)).then(
      (batch) => {
        if (batch.length === 0) return all;
        all = all.concat(batch);
        return next();
      }
    );
  return next();
}

function walk(entry, prefix) {
  if (isHidden(entry.name)) return Promise.resolve([]);
  if (entry.isFile) {
    return new Promise((resolve, reject) => entry.file(resolve, reject)).then(
      (file) => [{ path: prefix + entry.name, file: file }]
    );
  }
  return walkInto(entry, prefix + entry.name + "/");
}

function walkInto(directory, prefix) {
  return readAll(directory.createReader())
    .then((children) =>
      Promise.all(children.map((child) => walk(child, prefix)))
    )
    .then((lists) => [].concat.apply([], lists));
}

/** Every file under the dropped entries, subfolders included. */
export function filesOfDrop(entries) {
  // One folder dropped is the study itself, so its files are named from
  // inside it; anything else is named from where it was picked up.
  if (entries.length === 1 && entries[0].isDirectory) {
    return walkInto(entries[0], "");
  }
  return Promise.all(entries.map((entry) => walk(entry, ""))).then((lists) =>
    [].concat.apply([], lists)
  );
}
