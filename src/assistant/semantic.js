/**
 * The retrieval layer: vectors over the pre-designed instructions and over
 * the live columns, and the fusion of those rankings with the lexical ones.
 *
 * Nothing here knows how a vector is produced. `buildSemanticIndex` takes an
 * `encode(texts)` function, so the browser can supply a CDN-loaded MiniLM and
 * the eval harness its own copy of the same model, and both build exactly the
 * same index. There is no generation anywhere: the nearest instruction is
 * rendered as text by templates.js, not written by a model.
 */

import { TEMPLATES } from "./templates.js";
import { documents } from "./examples.js";

export function cosine(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return sum;
}

/* ------------------------------------------------------------ documents -- */

/**
 * Template phrasings, the ways people say them (`also`), and the example
 * corpus, each labelled with its command.
 */
export function instructionDocuments() {
  let out = [];
  TEMPLATES.forEach((t) => {
    out.push({ label: t.command, text: t.text.replace(/\{[^}]+\}/g, "").replace(/\s+/g, " ").trim() });
    (t.also || []).forEach((text) => out.push({ label: t.command, text: text }));
  });
  return out.concat(documents());
}

/**
 * What a column is, in words an encoder can place: its humanised name, the
 * alias phrases the lexicon already attaches to it, a unit if the header
 * declares one, and for a categorical column a few of its values. "cost" is
 * near "price"; "how old" is near "year"; "gas, diesel, hybrid" is near
 * "fuel".
 */
export function columnDescription(entry, values) {
  let raw = String(entry.column);
  let unit = (raw.match(/\[([^\]]+)\]|\(([^)]+)\)/) || []).slice(1).find(Boolean);
  let joined = entry.norm.replace(/ /g, "");
  let aliases = Array.from(new Set(
    entry.phrases
      .map((p) => p.join(" "))
      .filter((p) => p !== entry.norm && p !== joined && p.length > 2)
  )).slice(0, 6);
  let text = "the " + entry.norm;
  if (unit) text += " in " + unit;
  if (aliases.length) text += ", also called " + aliases.join(", ");
  if (values && values.length) text += ", for example " + values.slice(0, 5).join(", ");
  return text;
}

/* ---------------------------------------------------------------- index -- */

/**
 * `{ instructions: [{label, text, vec}], columns: [{column, vec}] }`. The
 * columns part is rebuilt whenever the data changes; the instructions part is
 * the same for every dataset and is built once.
 */
export async function buildSemanticIndex(encode, schema, previous) {
  let instructions = previous && previous.instructions;
  if (!instructions) {
    let docs = instructionDocuments();
    let vecs = await encode(docs.map((d) => d.text));
    instructions = docs.map((d, i) => ({ label: d.label, text: d.text, vec: vecs[i] }));
  }
  let entries = schema.index;
  let texts = entries.map((e) => columnDescription(e, (schema.values || {})[e.column]));
  let vecs = await encode(texts);
  let columns = entries.map((e, i) => ({ column: e.column, text: texts[i], vec: vecs[i] }));
  return { instructions: instructions, columns: columns };
}

/** Commands ranked by their best-matching phrasing, highest first. */
export function queryInstructions(index, qvec) {
  let best = new Map();
  for (let doc of index.instructions) {
    let s = cosine(doc.vec, qvec);
    let prev = best.get(doc.label);
    if (!prev || s > prev.score) best.set(doc.label, { label: doc.label, text: doc.text, score: s });
  }
  return Array.from(best.values()).sort((a, b) => b.score - a.score);
}

/** Columns ranked by cosine to the query, highest first. */
export function queryColumns(index, qvec, allowed) {
  let out = [];
  for (let c of index.columns) {
    if (allowed && !allowed.includes(c.column)) continue;
    out.push({ column: c.column, score: cosine(c.vec, qvec) });
  }
  return out.sort((a, b) => b.score - a.score);
}

/* ----------------------------------------------------------------- head -- */

/**
 * The trained intent head from eval/train-head.mjs:
 * `{ labels, dims, weights (class-major, flat), bias }`. Returns every label
 * with its probability, highest first.
 */
export function applyHead(head, qvec) {
  let n = head.labels.length;
  let dims = head.dims;
  let scores = new Array(n);
  let top = -Infinity;
  for (let c = 0; c < n; c++) {
    let sum = head.bias[c];
    let base = c * dims;
    for (let d = 0; d < dims; d++) sum += head.weights[base + d] * qvec[d];
    scores[c] = sum;
    if (sum > top) top = sum;
  }
  let total = 0;
  for (let c = 0; c < n; c++) {
    scores[c] = Math.exp(scores[c] - top);
    total += scores[c];
  }
  return head.labels
    .map((label, c) => ({ label: label, score: scores[c] / total }))
    .sort((a, b) => b.score - a.score);
}

/* --------------------------------------------------------------- fusion -- */

/**
 * Reciprocal-rank fusion. `lists` are rankings (best first) of objects that
 * share a `key` field; `weights` line up with them. Ranks, not scores, are
 * combined, so BM25 points, cosines and probabilities need no calibration
 * against one another. Returns `[{ key, score, ranks }]`, best first.
 */
export function fuse(lists, weights, keyOf) {
  const K = 60;
  let scores = new Map();
  lists.forEach((list, li) => {
    let w = weights[li] || 0;
    if (!w || !list) return;
    list.forEach((item, rank) => {
      let key = keyOf(item);
      let prev = scores.get(key) || { key: key, score: 0, ranks: {} };
      prev.score += w / (K + rank);
      prev.ranks[li] = rank;
      scores.set(key, prev);
    });
  });
  return Array.from(scores.values()).sort((a, b) => b.score - a.score);
}
