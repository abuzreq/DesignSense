/**
 * Builds an approach that is A1G with its two fuzzy parts swapped for an
 * encoder: intent ranking, and the column fallback that fires only when
 * lexical matching found nothing.
 *
 * Everything else — the grammar, the guards, the alias table — is shared, so a
 * difference in the numbers is a difference in the encoder and nothing else.
 */

import { makeParser } from "./a1-grammar.mjs";
import { documents } from "./examples.mjs";
import { buildColumnIndex } from "./lexicon.mjs";
import { cosine, makeEncoder } from "./embedding.mjs";
import { DATASETS } from "../schema.mjs";
import { trainSoftmax } from "./linear.mjs";

/**
 * `columnFloor` and `columnMargin` are set from the probe runs, not tuned
 * against the evaluation set: a guess needs both an absolute similarity and a
 * clear lead over the runner-up before it may name a column nobody typed.
 */
export function makeEmbeddedApproach(config) {
  let encoder = null;
  let exampleVectors = [];
  let columnVectors = new Map(); // dataset -> [{ column, vec }]
  let head = null; // A4's linear classifier, when config.head is "logreg"
  let labels = [];

  async function warmup(items) {
    encoder = await makeEncoder(config.kind);

    let examples = documents();
    let columnText = new Map();
    Object.keys(DATASETS).forEach((dataset) => {
      let entries = buildColumnIndex(dataset);
      columnText.set(dataset, entries);
    });

    let texts = items.map((i) => i.utterance).concat(examples.map((d) => d.text));
    columnText.forEach((entries) => entries.forEach((e) => texts.push(e.norm)));
    await encoder.warmup(texts);

    exampleVectors = examples
      .map((d) => ({ label: d.label, vec: encoder.vec(d.text) }))
      .filter((d) => d.vec);
    columnText.forEach((entries, dataset) => {
      columnVectors.set(
        dataset,
        entries.map((e) => ({ column: e.column, vec: encoder.vec(e.norm) })).filter((e) => e.vec)
      );
    });

    if (config.head === "logreg") {
      // Trained on the example corpus only. The evaluation set is never seen.
      labels = Array.from(new Set(examples.map((d) => d.label))).sort();
      let rows = [];
      let targets = [];
      examples.forEach((d) => {
        let vec = encoder.vec(d.text);
        if (!vec) return;
        rows.push(vec);
        targets.push(labels.indexOf(d.label));
      });
      head = trainSoftmax(rows, targets, labels.length, { epochs: 400, rate: 1.5 });
    }
  }

  function rank(text) {
    let query = encoder && encoder.vec(text);
    if (!query) return [];

    if (head) {
      let probabilities = head.predict(query);
      return labels
        .map((label, i) => ({ label: label, score: probabilities[i] * config.rankScale }))
        .sort((a, b) => b.score - a.score);
    }

    let best = new Map();
    for (let example of exampleVectors) {
      let score = cosine(query, example.vec);
      if (score > (best.get(example.label) || -Infinity)) best.set(example.label, score);
    }
    // The grammar's BM25 threshold is on a BM25 scale; cosines are not, so
    // they are rescaled onto it rather than the thresholds being retuned.
    return Array.from(best.entries())
      .map(([label, score]) => ({ label: label, score: score * config.rankScale }))
      .sort((a, b) => b.score - a.score);
  }

  function embedColumns(dataset, text, exclude) {
    let query = encoder && encoder.vec(text);
    if (!query) return null;
    let pool = (columnVectors.get(dataset) || []).filter((c) => !exclude.includes(c.column));
    if (pool.length < 2) return null;
    let scored = pool
      .map((c) => ({ column: c.column, score: cosine(query, c.vec) }))
      .sort((a, b) => b.score - a.score);
    if (scored[0].score < config.columnFloor) return null;
    if (scored[0].score - scored[1].score < config.columnMargin) return null;
    return scored[0].column;
  }

  return {
    id: config.id,
    name: config.name,
    warmup: warmup,
    parse: makeParser({
      guarded: true,
      compose: config.compose,
      rank: rank,
      embedColumns: config.useColumns ? embedColumns : null,
    }),
    notes() {
      return {
        model: encoder ? encoder.name : "(not loaded)",
        download: encoder ? (encoder.bytes / 1e6).toFixed(0) + " MB" : "-",
        encode: encoder ? encoder.perTextMicros().toFixed(0) + "us per text" : "-",
        "column-fb": config.useColumns ? "on" : "off",
        head: head ? "logreg, " + head.parameters + " params" : "nearest example",
      };
    },
  };
}
