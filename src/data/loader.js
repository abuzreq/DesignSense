import Vue from "vue";
import { buildDataset } from "./table.js";
import { fetchSource, resolveSource } from "./sources.js";
import { addressFor } from "./shareLink.js";

export const DEFAULT_DATASET_URL =
  "https://raw.githubusercontent.com/abuzreq/ds_datasets/refs/heads/main/used_cars/data.csv";

/**
 * The latest load, for the load dialogs and the workspace. `source` says who
 * started it: "url", "preset", "file", "startup" or "tour".
 */
export const loadState = Vue.observable({
  loading: false,
  source: null,
  error: null,
  warnings: [],
  // The link of the dataset on screen (null for a local file).
  link: null,
  // A short confirmation after a load the user started.
  notice: null,
});

let mount = null;
let latestLoad = 0;
const STALE = { stale: true };

/**
 * Keeps the address bar naming the dataset on screen, in the form a share link
 * uses, so that reloading the page or bookmarking it reopens this dataset
 * rather than the sample. Replaced rather than pushed: Back has no dataset of
 * its own to return to. A local file has no link to name, and the sample
 * needs none, so for those the address names nothing.
 */
function rememberInAddressBar(link) {
  if (typeof window === "undefined" || !window.history) return;
  let named = link && link !== DEFAULT_DATASET_URL ? link : null;
  let current =
    window.location.pathname + window.location.search + window.location.hash;
  let next = addressFor(window.location, named);
  // The router keeps its own key in the history state; it stays.
  if (next !== current) window.history.replaceState(window.history.state, "", next);
}

/** `options.mount(data, dataTypesMap, { link, name })` shows a loaded dataset. */
export function configureLoader(options) {
  mount = options.mount;
}

/**
 * Loads a dataset from a link (a CSV file, a folder on a web server, or a
 * Google Drive or OneDrive folder) or from `{ file }`, and mounts it. Only the
 * most recent load mounts, so a slow earlier load can't replace a later one.
 * Resolves with the dataset, or null when a newer load took over; rejects with
 * the error, whose `userMessage` is also shown in `loadState.error`.
 */
export function loadDataset(input, options) {
  let token = ++latestLoad;
  loadState.loading = true;
  loadState.source = (options && options.source) || "url";
  loadState.error = null;
  loadState.warnings = [];
  loadState.notice = null;
  let stillLatest = (value) => {
    if (token !== latestLoad) throw STALE;
    return value;
  };

  let resolved = null;
  return Promise.resolve(input)
    .then(resolveSource)
    .then((source) => {
      resolved = source;
      return fetchSource(source, { apiKey: window.Gkey });
    })
    .then(stillLatest)
    .then((fetched) => {
      let dataset = buildDataset(fetched.text, {
        baseUrl: fetched.baseUrl,
        files: fetched.files,
        rawFiles: fetched.rawFiles,
      });
      mount(dataset.data, dataset.dataTypesMap, {
        link: fetched.link || null,
        // A local file has no link; its name helps tell it from others.
        name: resolved && resolved.kind === "file" ? resolved.file.name : null,
      });
      loadState.warnings = dataset.warnings;
      loadState.link = fetched.link || null;
      rememberInAddressBar(loadState.link);
      let source = loadState.source;
      if (source === "url" || source === "preset" || source === "file") {
        let n = dataset.data.length;
        loadState.notice = "Loaded " + n + (n === 1 ? " option." : " options.");
      }
      loadState.loading = false;
      return dataset;
    })
    .catch((error) => {
      if (error === STALE) return null;
      if (token === latestLoad) {
        loadState.loading = false;
        loadState.error =
          error.userMessage ||
          "The data couldn't be loaded. The browser console has details.";
      }
      console.error(error);
      throw error;
    });
}
