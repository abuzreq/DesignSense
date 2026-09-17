/**
 * A1P — the parser as it ships in src/assistant, scored on the same set.
 *
 * The port from eval to src changed how the schema is supplied: the app builds
 * it from the loaded CSV, while the eval has frozen headers. This approach
 * feeds the frozen headers through the app's own entry point, so any mistake
 * in that port shows up as a difference from A1C rather than as a surprise in
 * the browser.
 *
 * Regenerate the copies under approaches/ported/ whenever src/assistant
 * changes; `node eval/port-check.mjs` does it.
 */

import { parse } from "./ported/parser.mjs";
import { buildColumnIndex } from "./ported/lexicon.mjs";
import { DATASETS, DATASET_VALUES } from "../schema.mjs";

const SKIP = ["_id", "img", "images", "image", "image_url", "threed", "json", "url", "region_url", "lat", "long"];
const CACHE = new Map();

function schemaFor(dataset) {
  if (!CACHE.has(dataset)) {
    let columns = (DATASETS[dataset] || []).filter(
      (c) => SKIP.indexOf(String(c).trim().toLowerCase()) < 0
    );
    CACHE.set(dataset, {
      columns: columns,
      numeric: columns,
      index: buildColumnIndex(columns),
      values: DATASET_VALUES[dataset] || {},
      prefer: null,
    });
  }
  return CACHE.get(dataset);
}

export default {
  id: "a1p",
  name: "the parser as shipped in src/assistant",
  parse: (utterance, context) =>
    parse(utterance, { schema: schemaFor(context.dataset), state: context.state || {} }),
};
