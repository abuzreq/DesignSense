/*
 * The three ways a browser hands over a folder, as localFolder.js reads
 * them, with the browser's objects stood in for. Run with `npm test`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  filesOfInput,
  filesOfList,
  filesOfDrop,
} from "../src/data/localFolder.js";

/** A File as `<input webkitdirectory>` reports one. */
function picked(relativePath) {
  let name = relativePath.split("/").pop();
  return { name: name, webkitRelativePath: relativePath };
}

/** A FileSystemEntry tree: a string is a file, an object a folder. */
function entryOf(name, node, batchSize) {
  if (typeof node === "string") {
    return {
      name: name,
      isFile: true,
      isDirectory: false,
      file: (resolve) => resolve({ name: name, body: node }),
    };
  }
  let children = Object.keys(node).map((child) =>
    entryOf(child, node[child], batchSize)
  );
  return {
    name: name,
    isFile: false,
    isDirectory: true,
    createReader: () => {
      // The real reader answers in batches, and an empty one means the end.
      let given = 0;
      return {
        readEntries: (resolve) => {
          let batch = children.slice(given, given + (batchSize || 100));
          given += batch.length;
          resolve(batch);
        },
      };
    },
  };
}

const paths = (files) => files.map((entry) => entry.path).sort();

test("a picked folder names its files from inside it", () => {
  let files = filesOfInput([
    picked("Colibri/data.csv"),
    picked("Colibri/0001.png"),
    picked("Colibri/models/0001.glb"),
  ]);
  assert.deepEqual(paths(files), ["0001.png", "data.csv", "models/0001.glb"]);
  assert.equal(files[0].file.name, "data.csv");
});

test("a picked folder leaves out what a file manager left behind", () => {
  let files = filesOfInput([
    picked("Colibri/data.csv"),
    picked("Colibri/.DS_Store"),
    picked("Colibri/._0001.png"),
  ]);
  assert.deepEqual(paths(files), ["data.csv"]);
});

test("a file with no relative path keeps its name", () => {
  let files = filesOfInput([{ name: "data.csv", webkitRelativePath: "" }]);
  assert.deepEqual(paths(files), ["data.csv"]);
});

test("nothing picked is nothing", () => {
  assert.deepEqual(filesOfInput(null), []);
  assert.deepEqual(filesOfInput([]), []);
});

test("loose files dropped together go by their names", () => {
  let files = filesOfList([
    { name: "data.csv" },
    { name: ".DS_Store" },
    { name: "0001.png" },
  ]);
  assert.deepEqual(paths(files), ["0001.png", "data.csv"]);
});

test("one dropped folder is the study itself", async () => {
  let files = await filesOfDrop([
    entryOf("Colibri", {
      "data.csv": "id,img",
      "0001.png": "",
      models: { "0001.glb": "" },
      ".DS_Store": "",
    }),
  ]);
  assert.deepEqual(paths(files), ["0001.png", "data.csv", "models/0001.glb"]);
});

test("a dropped folder is read through every batch", async () => {
  let many = {};
  for (let i = 0; i < 25; i++) many[i + ".png"] = "";
  many["data.csv"] = "";
  let files = await filesOfDrop([entryOf("Colibri", many, 10)]);
  assert.equal(files.length, 26);
});

test("several dropped entries are named from where they were picked up", async () => {
  let files = await filesOfDrop([
    entryOf("data.csv", "id,img"),
    entryOf("pictures", { "0001.png": "", "0002.png": "" }),
  ]);
  assert.deepEqual(paths(files), [
    "data.csv",
    "pictures/0001.png",
    "pictures/0002.png",
  ]);
});

test("a dropped file's contents come through", async () => {
  let files = await filesOfDrop([entryOf("data.csv", "id,img")]);
  assert.equal(files[0].file.body, "id,img");
});
