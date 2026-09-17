/**
 * Trains the intent head the app ships and writes it to
 * src/assistant/intent-head.json.
 *
 * Same recipe as A4 on the ladder: all-MiniLM-L6-v2 vectors of the example
 * corpus (and the template phrasings), a multinomial logistic regression over
 * them. Trained on examples.js only -- never on eval/dataset -- so the
 * guided-bar numbers in eval/guided.mjs are not measuring memorisation.
 *
 *   node eval/train-head.mjs
 */

import { writeFileSync } from "fs";
import { makeEncoder } from "./approaches/embedding.mjs";
import { trainSoftmax } from "./approaches/linear.mjs";
import { instructionDocuments } from "./approaches/ported/semantic.mjs";

let docs = instructionDocuments();
let labels = Array.from(new Set(docs.map((d) => d.label))).sort();
let encoder = await makeEncoder("minilm");
await encoder.warmup(docs.map((d) => d.text));

let rows = docs.map((d) => encoder.vec(d.text));
let targets = docs.map((d) => labels.indexOf(d.label));
let head = trainSoftmax(rows, targets, labels.length, { epochs: 400, rate: 1.5 });

let right = 0;
docs.forEach((d, i) => {
  let p = head.predict(rows[i]);
  let best = 0;
  for (let c = 1; c < p.length; c++) if (p[c] > p[best]) best = c;
  if (labels[best] === d.label) right++;
});

let out = {
  model: encoder.name,
  labels: labels,
  dims: head.dims,
  weights: Array.from(head.weights).map((w) => +w.toFixed(5)),
  bias: Array.from(head.bias).map((b) => +b.toFixed(5)),
  trainedOn: docs.length + " phrasings from examples.js and templates.js",
};
writeFileSync("src/assistant/intent-head.json", JSON.stringify(out));
console.log(
  labels.length + " classes, " + docs.length + " phrasings, " + head.parameters + " params, " +
  "train accuracy " + ((100 * right) / docs.length).toFixed(0) + "%, " +
  (JSON.stringify(out).length / 1024).toFixed(0) + " KB"
);
