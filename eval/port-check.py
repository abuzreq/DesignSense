"""Score the parser that actually ships, not the one that was measured.

Copies src/assistant's parser files into eval as .mjs (Node will not load a
.js as ESM here) and wires them to the frozen dataset headers, so a porting
mistake shows up as a drop in the same numbers.
"""
import io, os, re

OUT = "eval/approaches/ported"
os.makedirs(OUT, exist_ok=True)

# The parser files, and the one module outside src/assistant they import
# (which column holds pictures or models); all land flat in OUT.
SOURCES = [("src/assistant/", name) for name in
           ["lexicon", "composition", "bm25", "examples", "parser", "templates", "semantic", "suggest"]]
SOURCES.append(("src/data/", "assets"))

for folder, name in SOURCES:
    s = io.open(folder + name + ".js", encoding="utf-8").read()
    s = re.sub(r'from "\.\.?/(?:data/)?([a-z0-9]+)\.js"', r'from "./\1.mjs"', s)
    io.open(OUT + "/" + name + ".mjs", "w", encoding="utf-8", newline="\n").write(
        "/* GENERATED from " + folder + name + ".js by the eval harness. Do not edit. */\n" + s
    )

io.open("eval/approaches/a1p-ported.mjs", "w", encoding="utf-8", newline="\n").write(
'''/**
 * A1P — the parser as it ships in src/assistant, scored on the same set.
 *
 * The port from eval to src changed how the schema is supplied: the app builds
 * it from the loaded CSV, while the eval has frozen headers. This approach
 * feeds the frozen headers through the app's own entry point, so any mistake
 * in that port shows up as a difference from A1C rather than as a surprise in
 * the browser.
 *
 * Regenerate the copies under approaches/ported/ whenever src/assistant
 * changes; `python eval/port-check.py` does it.
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
''')
print("generated")
