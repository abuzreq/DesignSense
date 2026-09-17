import Vue from "vue";
import { buildDataset } from "./table.js";
import { fetchSource, resolveSource } from "./sources.js";

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
});

let mount = null;
let latestLoad = 0;
const STALE = { stale: true };

/** `options.mount(data, dataTypesMap, { link })` shows a loaded dataset. */
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
  let stillLatest = (value) => {
    if (token !== latestLoad) throw STALE;
    return value;
  };

  return Promise.resolve(input)
    .then(resolveSource)
    .then((source) => fetchSource(source, { apiKey: window.Gkey }))
    .then(stillLatest)
    .then((fetched) => {
      let dataset = buildDataset(fetched.text, {
        baseUrl: fetched.baseUrl,
        files: fetched.files,
      });
      mount(dataset.data, dataset.dataTypesMap, { link: fetched.link || null });
      loadState.warnings = dataset.warnings;
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
