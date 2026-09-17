import { makeEmbeddedApproach } from "./embedded-parser.mjs";

/**
 * A4 — A3's encoder with a trained linear head instead of nearest-example.
 *
 * A3 ranks intents by the best cosine to any example under each command, which
 * treats every direction in the embedding space as equally meaningful. A
 * softmax head learns which directions actually separate these 37 commands.
 * It costs ~14k floats on top of the encoder and trains in seconds, so if it
 * helps it is the cheapest gain on the ladder.
 *
 * Trained on `examples.mjs` only — never on the evaluation set.
 */
export default makeEmbeddedApproach({
  id: "a4",
  name: "A3 plus a trained linear intent head",
  kind: "minilm",
  head: "logreg",
  // Probabilities are on 0..1; the grammar's confidence gate is on a BM25
  // scale. 30 puts the gate at p = 0.3, matching where A3's rescaled cosines
  // put it, so the three share one decision boundary.
  rankScale: 30,
  columnFloor: 0.45,
  columnMargin: 0.05,
  useColumns: true,
});
