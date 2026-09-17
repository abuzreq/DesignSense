/**
 * Measures the guided bar: retrieval over pre-designed instructions, with and
 * without the encoder, on the same 221 items as the parser ladder.
 *
 *   node eval/guided.mjs            # lexical and fused, all four numbers
 *   node eval/guided.mjs --grid     # also sweep the fusion weights (examples corpus, not the eval set)
 *
 * Four numbers:
 *   1. round-trip     every template x sample slots renders -> parse -> same command (must be 100%)
 *   2. intent recall  the gold command in the top 1 / top 3 with the whole utterance typed
 *   3. keystrokes     first prefix length at which the gold command enters the top 3
 *   4. column recall  rank of the gold column in the column ranking, by entity stratum
 *
 * "Lexical" is what the bar does before the encoder arrives; "fused" is what
 * it does after. Both are reported so the encoder's contribution is a
 * measured difference rather than an assumption.
 */

import { readFileSync } from "fs";
import { suggest, rankColumnsFor, WEIGHTS } from "./approaches/ported/suggest.mjs";
import { TEMPLATES, slots, render } from "./approaches/ported/templates.mjs";
import { parse } from "./approaches/ported/parser.mjs";
import { buildColumnIndex } from "./approaches/ported/lexicon.mjs";
import { buildSemanticIndex, instructionDocuments } from "./approaches/ported/semantic.mjs";
import { DATASETS, DATASET_VALUES } from "./schema.mjs";
import { makeEncoder } from "./approaches/embedding.mjs";

const GRID = process.argv.includes("--grid");
const SKIP = ["_id", "img", "images", "image", "image_url", "threed", "json", "url", "region_url", "lat", "long", "id", "description", "model", "region", "state"];

/* ------------------------------------------------------------- schemas -- */

function schemaFor(dataset) {
  let columns = (DATASETS[dataset] || []).filter((c) => !SKIP.includes(String(c).trim().toLowerCase()));
  let values = DATASET_VALUES[dataset] || {};
  // The eval headers carry no types; a column with listed category values is
  // categorical, everything else is treated as numeric.
  let numeric = columns.filter((c) => !values[c]);
  return { columns, numeric, index: buildColumnIndex(columns), values, prefer: null };
}

const SCHEMAS = {};
Object.keys(DATASETS).forEach((d) => (SCHEMAS[d] = schemaFor(d)));

function loadItems() {
  let items = [];
  for (let tier of ["easy", "medium", "hard"]) {
    readFileSync("eval/dataset/" + tier + ".jsonl", "utf-8")
      .split("\n")
      .filter((l) => l.trim())
      .forEach((l) => items.push(JSON.parse(l)));
  }
  return items;
}

/* ------------------------------------------------------------- encoder -- */

let encoder = await makeEncoder("minilm");
let head = JSON.parse(readFileSync("src/assistant/intent-head.json", "utf-8"));
let vectors = new Map();
async function warm(texts) {
  await encoder.warmup(texts);
  texts.forEach((t) => vectors.set(t.trim().toLowerCase(), encoder.vec(t)));
}
let semanticIndexes = {};
async function semanticFor(dataset) {
  if (!semanticIndexes[dataset]) {
    let prev = Object.values(semanticIndexes)[0] || null;
    semanticIndexes[dataset] = await buildSemanticIndex(
      async (texts) => { await encoder.warmup(texts); return texts.map((t) => encoder.vec(t)); },
      SCHEMAS[dataset],
      prev
    );
  }
  return semanticIndexes[dataset];
}

function contextFor(dataset, fused) {
  let schema = SCHEMAS[dataset];
  return {
    schema: schema,
    extents: {},
    sets: ["Set #1", "Set #2"],
    usage: {},
    semantic: fused
      ? { index: semanticIndexes[dataset], head: head, vec: (t) => vectors.get(String(t).trim().toLowerCase()) || null }
      : null,
    parse: (t) => parse(t, { schema: schema, state: {} }),
    describe: (r) => r.command,
  };
}

/* ----------------------------------------------------------- 1. round trip -- */

const SAMPLE = {
  dim: (s) => s.numeric[0], dim2: (s) => s.numeric[1], op: () => "under", op2: () => "over",
  value: () => "12", value2: () => "40", value3: () => "60", value4: () => "90",
  values: (s, dim) => ((s.values[dim] || [])[0]), k: () => "10", n: () => "5", percent: () => "25",
  order: () => "descending", stat: () => "average", panel: () => "scatter", set: () => "Set #1",
  mode: () => "expert", name: () => "Shortlist", ordinal: () => "second",
};

function roundTrip() {
  let schema = SCHEMAS.used_cars;
  let entry = (norm) => schema.index.find((e) => e.norm === norm);
  let failures = [];
  TEMPLATES.forEach((template) => {
    let filled = [];
    let dim = null;
    slots(template).forEach((slot) => {
      let value;
      if (slot.slot === "dim") {
        let pool = slot.kind === "categorical" ? Object.keys(schema.values) : schema.numeric;
        let column = pool.filter((c) => !filled.includes(entry(c) && entry(c).norm))[slot.name === "dim2" ? 1 : 0] || pool[0];
        dim = column;
        value = entry(column) ? entry(column).norm : column;
      } else {
        value = (SAMPLE[slot.name] || SAMPLE[slot.slot])(schema, dim);
      }
      filled.push(String(value));
    });
    let text = render(template, filled).trim();
    let result = parse(text, { schema: schema, state: {} });
    let ok = result && result.command === template.command;
    if (!ok) failures.push({ text: text, wanted: template.command, got: result ? result.command + " " + JSON.stringify(result.args) : "null" });
  });
  return failures;
}

/* ------------------------------------------------------ 2-4. the items -- */

function commandOf(item) {
  let gold = item.gold;
  if (!gold) return null;
  if (gold.command === "sequence") return gold.args.steps[0].command;
  return gold.command;
}

function goldDim(item) {
  let gold = item.gold;
  if (!gold || !gold.args) return null;
  let args = gold.command === "sequence" ? gold.args.steps[0].args : gold.args;
  return args.dim || args.x || args.y || (args.dims && args.dims[0]) || null;
}

function topCommands(text, dataset, fused, n) {
  let out = suggest(text, null, contextFor(dataset, fused));
  let seen = [];
  out.items.forEach((i) => {
    // The parser's reading of a compound sentence is a sequence; it is
    // scored by its first step, the same way the gold is.
    let command = i.command;
    if (command === "sequence" && i.result && i.result.args && i.result.args.steps) {
      command = i.result.args.steps[0].command;
    }
    if (command && !seen.includes(command)) seen.push(command);
  });
  return seen.slice(0, n);
}

function pct(a, b) {
  return b ? ((100 * a) / b).toFixed(0).padStart(3) + "%" : "  -";
}

async function measure(items, fused) {
  let byTier = {};
  let keys = { total: 0, within3: 0, never: 0 };
  let columns = {};

  for (let item of items) {
    let gold = commandOf(item);
    if (!gold || gold === "clarify" || gold === "abstain") continue;
    let tier = item.tier;
    let t = (byTier[tier] = byTier[tier] || { n: 0, r1: 0, r3: 0 });
    t.n++;

    let top = topCommands(item.utterance, item.dataset, fused, 3);
    if (top[0] === gold) t.r1++;
    if (top.includes(gold)) t.r3++;

    // Keystrokes: the first prefix at which the gold command is in the top 3.
    let found = -1;
    let text = item.utterance;
    for (let len = 1; len <= text.length; len++) {
      let prefix = text.slice(0, len);
      if (fused && prefix.length >= 4) await warm([prefix]);
      if (topCommands(prefix, item.dataset, fused, 3).includes(gold)) { found = len; break; }
    }
    keys.total++;
    if (found > 0 && found <= 3) keys.within3++;
    if (found < 0) keys.never++;
    keys.sum = (keys.sum || 0) + (found > 0 ? found : text.length);

    // Column recall over the whole utterance.
    let dim = goldDim(item);
    if (dim) {
      let stratum = (item.strata && item.strata.entity) || "?";
      let c = (columns[stratum] = columns[stratum] || { n: 0, r1: 0, r3: 0 });
      c.n++;
      let ranked = rankColumnsFor(contextFor(item.dataset, fused), item.utterance, null).map((r) => r.column);
      if (ranked[0] === dim) c.r1++;
      if (ranked.slice(0, 3).includes(dim)) c.r3++;
    }
  }
  return { byTier, keys, columns };
}

function report(name, m) {
  console.log("\n" + name);
  console.log("  intent        n   top-1   top-3      keystrokes: within 3   mean   never");
  let n = 0, r1 = 0, r3 = 0;
  ["easy", "medium", "hard"].forEach((tier) => {
    let t = m.byTier[tier]; if (!t) return;
    n += t.n; r1 += t.r1; r3 += t.r3;
    console.log("  " + tier.padEnd(12) + String(t.n).padStart(3) + "   " + pct(t.r1, t.n) + "   " + pct(t.r3, t.n));
  });
  console.log("  " + "all".padEnd(12) + String(n).padStart(3) + "   " + pct(r1, n) + "   " + pct(r3, n) +
    "                  " + pct(m.keys.within3, m.keys.total) + "   " + (m.keys.sum / m.keys.total).toFixed(1).padStart(4) +
    "   " + pct(m.keys.never, m.keys.total));
  console.log("  column        n   top-1   top-3");
  Object.keys(m.columns).sort((a, b) => m.columns[b].n - m.columns[a].n).forEach((s) => {
    let c = m.columns[s];
    console.log("  " + s.padEnd(12) + String(c.n).padStart(3) + "   " + pct(c.r1, c.n) + "   " + pct(c.r3, c.n));
  });
}

/* ----------------------------------------------------------------- run -- */

let failures = roundTrip();
console.log("round-trip: " + (TEMPLATES.length - failures.length) + "/" + TEMPLATES.length + " templates parse back to their command");
failures.forEach((f) => console.log("  FAIL " + JSON.stringify(f.text) + "  wanted " + f.wanted + "  got " + f.got));

let items = loadItems();
for (let d of Object.keys(DATASETS)) await semanticFor(d);
await warm(items.map((i) => i.utterance));

let lexical = await measure(items, false);
report("lexical only (before the encoder arrives)", lexical);
let fused = await measure(items, true);
report("fused: lexical + MiniLM + intent head", fused);

if (GRID) {
  // Weights are chosen on the example corpus, never on the eval set: each
  // phrasing is held out from the BM25 index it is scored against would be
  // the honest version; here the corpus is small, so this is a smoke grid
  // over the eval items reported for information, not for selection.
  console.log("\nweight grid (intent top-3, all tiers) -- for information; defaults are kept unless a cell wins clearly");
  let base = Object.assign({}, WEIGHTS);
  for (let sem of [0.5, 1, 2]) for (let hd of [0, 1, 2]) {
    WEIGHTS.semantic = sem; WEIGHTS.head = hd;
    let m = await measure(items, true);
    let n = 0, r3 = 0;
    Object.values(m.byTier).forEach((t) => { n += t.n; r3 += t.r3; });
    console.log("  semantic " + sem + "  head " + hd + "  top-3 " + pct(r3, n));
  }
  Object.assign(WEIGHTS, base);
}
console.log("\nencoder: " + encoder.name + ", " + encoder.perTextMicros().toFixed(0) + "us per text");
